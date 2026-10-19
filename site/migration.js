// Pure provenance vocabulary shared by modern imports and reconciliation.
// No storage, network or framework access: this module never reads a legacy
// key and never converts a V1 document.
import { emptyRecords, documentToRecords } from "./persistence.js";

// Deterministic, injective prefix applied to legacy identifiers when the
// synchronized `@id` strategy requires a distinct key space. The concrete
// format is intentionally centralized here so it can be confirmed later
// without changing the mapping contract.
export const LEGACY_ID_PREFIX = "legacy:";
export const PROVENANCE_MAPPING_VERSION = 1;

// Explicit provenance vocabulary shared by every import/conversion path. A
// source is never classified from a title, a note or the mere presence of the
// `legacy:` prefix. `unknown` is genuinely ambiguous and must block writes.
export const EXPORT_KIND = Object.freeze({
  V1_RAW: "v1-raw",
  INDEXEDDB_EXPORT: "indexeddb-export",
  PROJECTED: "projected",
  LEGACY_DOUBLE: "legacy-double",
  UNKNOWN: "unknown"
});

const KNOWN_EXPORT_KINDS = new Set([
  EXPORT_KIND.V1_RAW,
  EXPORT_KIND.INDEXEDDB_EXPORT,
  EXPORT_KIND.PROJECTED,
  EXPORT_KIND.LEGACY_DOUBLE
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function unknownProvenance(reason = null) {
  return {
    exportKind: EXPORT_KIND.UNKNOWN,
    idsCanonical: null,
    mappingVersion: null,
    sourceFingerprint: null,
    reason
  };
}

// Returns a normalized descriptor or null when the metadata is present but
// contradictory. `unknown` is preserved so callers can block explicitly.
export function normalizeProvenance(value) {
  if (value === undefined || value === null) return null;
  if (value === EXPORT_KIND.V1_RAW) {
    return { exportKind: EXPORT_KIND.V1_RAW, idsCanonical: false, mappingVersion: PROVENANCE_MAPPING_VERSION, sourceFingerprint: null };
  }
  if (!isPlainObject(value)) return null;
  const exportKind = value.exportKind;
  if (exportKind === EXPORT_KIND.UNKNOWN) return unknownProvenance(value.reason || null);
  if (!KNOWN_EXPORT_KINDS.has(exportKind)) return null;
  const expectsCanonical = exportKind !== EXPORT_KIND.V1_RAW;
  if (value.idsCanonical !== undefined && value.idsCanonical !== null &&
      value.idsCanonical !== expectsCanonical) {
    return null;
  }
  if (value.mappingVersion !== undefined && value.mappingVersion !== null &&
      value.mappingVersion !== PROVENANCE_MAPPING_VERSION) {
    return null;
  }
  return {
    exportKind,
    idsCanonical: expectsCanonical,
    mappingVersion: value.mappingVersion === undefined || value.mappingVersion === null
      ? PROVENANCE_MAPPING_VERSION
      : value.mappingVersion,
    sourceFingerprint: typeof value.sourceFingerprint === "string" ? value.sourceFingerprint : null
  };
}

export function provenanceFromDocument(document) {
  if (!isPlainObject(document) || !isPlainObject(document.provenance)) return null;
  return normalizeProvenance(document.provenance);
}

// Precedence: an explicit caller decision wins over embedded metadata. Without
// either, the source is ambiguous, even when no identifier starts with
// `legacy:`.
export function classifyProvenance(document, options = {}) {
  if (options && options.provenance !== undefined && options.provenance !== null) {
    const explicit = normalizeProvenance(options.provenance);
    return explicit || unknownProvenance("invalid-provenance");
  }
  const embedded = provenanceFromDocument(document);
  if (embedded) return embedded;
  return unknownProvenance("unmarked-source");
}

export function isAmbiguousProvenance(provenance) {
  return !provenance || provenance.exportKind === EXPORT_KIND.UNKNOWN;
}

function prefixedIdentifierCount(records) {
  const all = [
    ...(Array.isArray(records.subjects) ? records.subjects : []),
    ...(Array.isArray(records.items) ? records.items : [])
  ];
  let prefixed = 0;
  let doublePrefixed = 0;
  for (const record of all) {
    if (typeof record.id !== "string") continue;
    if (record.id.startsWith(LEGACY_ID_PREFIX)) prefixed += 1;
    if (record.id.startsWith(LEGACY_ID_PREFIX + LEGACY_ID_PREFIX)) doublePrefixed += 1;
  }
  return { prefixed, doublePrefixed };
}

// Both (or three) interpretations are exposed with counts so a human can pick
// one. Nothing is inferred from the shape of the identifiers.
export function describeProvenanceInterpretations(document) {
  const records = documentToRecords(document);
  const prefixed = prefixedIdentifierCount(records);
  const counts = {
    subjects: Array.isArray(records.subjects) ? records.subjects.length : 0,
    items: Array.isArray(records.items) ? records.items.length : 0
  };
  return [
    {
      exportKind: EXPORT_KIND.V1_RAW,
      idsCanonical: false,
      mappingVersion: PROVENANCE_MAPPING_VERSION,
      counts,
      prefixedIdentifiers: prefixed.prefixed,
      wouldCreateDoublePrefix: prefixed.prefixed
    },
    {
      exportKind: EXPORT_KIND.INDEXEDDB_EXPORT,
      idsCanonical: true,
      mappingVersion: PROVENANCE_MAPPING_VERSION,
      counts,
      prefixedIdentifiers: prefixed.prefixed,
      wouldCreateDoublePrefix: 0
    },
    {
      exportKind: EXPORT_KIND.LEGACY_DOUBLE,
      idsCanonical: true,
      mappingVersion: PROVENANCE_MAPPING_VERSION,
      counts,
      prefixedIdentifiers: prefixed.prefixed,
      alreadyDoublePrefixed: prefixed.doublePrefixed,
      wouldCreateDoublePrefix: 0
    }
  ];
}

// Deterministic and injective: a fixed prefix is prepended to the legacy id.
export function mapLegacyId(legacyId, options = {}) {
  const prefix = options && typeof options.prefix === "string" ? options.prefix : LEGACY_ID_PREFIX;
  // An already projected/IndexedDB source keeps every identifier verbatim.
  if (options && options.keep === true) return legacyId;
  // The local conversion is re-entrant: a value produced by a later export may
  // already carry the stable prefix and must never become `legacy:legacy:ID`.
  if (options && options.idempotent === true &&
      typeof legacyId === "string" && legacyId.startsWith(prefix)) {
    return legacyId;
  }
  return prefix + legacyId;
}

export function unmapLegacyId(mappedId, options = {}) {
  const prefix = options && typeof options.prefix === "string" ? options.prefix : LEGACY_ID_PREFIX;
  return typeof mappedId === "string" && mappedId.startsWith(prefix)
    ? mappedId.slice(prefix.length)
    : mappedId;
}

// Provenance-aware mapping options: raw V1 identifiers are mapped exactly once;
// an already projected/IndexedDB source keeps its canonical identifiers. An
// unknown provenance is never mapped silently.
export function mappingOptionsFor(provenance, options = {}) {
  const normalized = normalizeProvenance(provenance);
  if (!normalized || isAmbiguousProvenance(normalized)) {
    return { ...options, ambiguous: true };
  }
  return {
    ...options,
    keep: normalized.exportKind !== EXPORT_KIND.V1_RAW,
    idempotent: normalized.exportKind !== EXPORT_KIND.V1_RAW
  };
}

export function canonicalRecords(records, provenance) {
  const normalized = normalizeProvenance(provenance);
  if (!normalized || isAmbiguousProvenance(normalized)) {
    return { status: "ambiguous-provenance", records: null, provenance: unknownProvenance("ambiguous") };
  }
  return {
    status: "ok",
    records: mapRecords(records, mappingOptionsFor(normalized)),
    provenance: normalized
  };
}

// Remaps `id`, `subjectId` and `parentId` consistently through one function so
// references stay coherent while the V1 export identifiers are recoverable.
export function mapRecords(records, options = {}) {
  const source = records && typeof records === "object" ? records : emptyRecords();
  const effective = options && options.provenance !== undefined
    ? mappingOptionsFor(options.provenance, options)
    : options;
  if (effective && effective.ambiguous === true) {
    throw new TypeError("Ambiguous provenance: mapping requires an explicit choice");
  }
  const subjects = (Array.isArray(source.subjects) ? source.subjects : []).map((record) => ({
    ...record,
    id: mapLegacyId(record.id, effective)
  }));
  const items = (Array.isArray(source.items) ? source.items : []).map((record) => ({
    ...record,
    id: mapLegacyId(record.id, effective),
    subjectId: mapLegacyId(record.subjectId, effective),
    parentId: record.parentId === null || record.parentId === undefined
      ? record.parentId
      : mapLegacyId(record.parentId, effective)
  }));
  return { subjects, items };
}

export function unmapRecords(records, options = {}) {
  const source = records && typeof records === "object" ? records : emptyRecords();
  const subjects = (Array.isArray(source.subjects) ? source.subjects : []).map((record) => ({
    ...record,
    id: unmapLegacyId(record.id, options)
  }));
  const items = (Array.isArray(source.items) ? source.items : []).map((record) => ({
    ...record,
    id: unmapLegacyId(record.id, options),
    subjectId: unmapLegacyId(record.subjectId, options),
    parentId: record.parentId === null || record.parentId === undefined
      ? record.parentId
      : unmapLegacyId(record.parentId, options)
  }));
  return { subjects, items };
}

function canonical(value) {
  return JSON.stringify(value, (key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.keys(item).sort().reduce((sorted, name) => {
        sorted[name] = item[name];
        return sorted;
      }, {});
    }
    return item;
  });
}

function recordEquals(left, right) {
  return canonical(left) === canonical(right);
}

function recordsEmpty(records) {
  const subjects = Array.isArray(records && records.subjects) ? records.subjects : [];
  const items = Array.isArray(records && records.items) ? records.items : [];
  return subjects.length === 0 && items.length === 0;
}

