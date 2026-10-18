// Pure, deterministic conversion of the historical `threadstep.document.v1`
// localStorage document into the synchronized fine-grained records. No DOM,
// network or framework access: the module only reads through an injected
// storage, plans one operation set and commits it through an injected
// `commit(operations)` adapter after explicit consent.
import { STORAGE_KEY, parseDocument } from "./core.js";
import {
  SUBJECTS_STORE,
  ITEMS_STORE,
  emptyRecords,
  documentToRecords,
  recordsToDocument
} from "./persistence.js";

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

export const MIGRATION_STATUS = Object.freeze({
  PRESENT: "present",
  ABSENT: "absent",
  INVALID: "invalid",
  UNREADABLE: "unreadable",
  UNAVAILABLE: "unavailable"
});

function rejection(status, message) {
  return { status, document: null, message };
}

// Strict detection: a document is migratable only when `parseDocument`
// accepts it. An absent, unreadable or invalid value never migrates.
export function detectHistoricalDocument(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return rejection(MIGRATION_STATUS.UNAVAILABLE, "Le stockage local n'est pas disponible.");
  }
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return rejection(MIGRATION_STATUS.UNREADABLE, "Le document historique est illisible.");
  }
  if (raw === null || raw === undefined || raw === "") {
    return rejection(MIGRATION_STATUS.ABSENT, "Aucun document historique à migrer.");
  }
  try {
    return { status: MIGRATION_STATUS.PRESENT, document: parseDocument(raw), message: null };
  } catch {
    return rejection(MIGRATION_STATUS.INVALID, "Le document historique n'est pas exploitable.");
  }
}

// Preservation projection: the validated document becomes the fine-grained
// records through the existing `documentToRecords`, and the reverse keeps the
// exact V1 export shape. The resume preference is local and never projected.
export function projectHistoricalDocument(document) {
  return documentToRecords(document);
}

export function reproduceHistoricalDocument(records) {
  return recordsToDocument(records);
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

// Discloses the destination, the transferred data and the future
// synchronization effect before any consent is requested or any write occurs.
export function describeMigration(document, destination, records) {
  const source = records && typeof records === "object"
    ? records
    : documentToRecords(document);
  const subjectCount = Array.isArray(source.subjects) ? source.subjects.length : 0;
  const itemCount = Array.isArray(source.items) ? source.items.length : 0;
  const message = "Migration vers " + destination + " : " + subjectCount +
    " sujet(s) et " + itemCount +
    " étape(s). Ces données seront synchronisées avec votre instance Dexie Cloud.";
  return {
    destination,
    subjectCount,
    itemCount,
    synchronized: true,
    message
  };
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

// Internal compatibility wrapper: `planMigration` delegates identifier policy
// to `mapRecords`/the shared provenance resolver and must not implement its own
// prefix rule. New call sites use `planReconciliation` or the local planner.
// Builds one operation set for the injected adapter without ever deleting
// existing target records. Re-running yields no operation (idempotence), an id
// present with different content is a collision and a non-empty target is
// reported rather than silently overwritten.
export function planMigration(records, document, options = {}) {
  const target = records && typeof records === "object" ? records : emptyRecords();
  const projected = mapRecords(documentToRecords(document), options);
  const destination = options && options.destination !== undefined ? options.destination : null;
  const currentDestination = options && options.currentDestination !== undefined
    ? options.currentDestination
    : null;
  const base = {
    destination,
    projected,
    operations: [],
    collisions: [],
    alreadyMigrated: false,
    populated: false
  };
  if (destination !== null && currentDestination !== null && destination !== currentDestination) {
    return { ...base, status: "destination-changed" };
  }
  const existing = new Map();
  for (const record of Array.isArray(target.subjects) ? target.subjects : []) {
    existing.set(record.id, record);
  }
  for (const record of Array.isArray(target.items) ? target.items : []) {
    existing.set(record.id, record);
  }
  const operations = [];
  const collisions = [];
  let missing = 0;
  const inspect = (store, record) => {
    const current = existing.get(record.id);
    if (!current) {
      operations.push({ type: "put", store, value: { ...record } });
      missing += 1;
    } else if (!Object.keys(record).every((key) =>
      recordEquals(current[key], record[key]))) {
      // Cloud adds owner/realmId/$ts metadata after synchronization. Compare
      // only the user's projected properties to preserve idempotence.
      collisions.push(record.id);
    }
  };
  for (const record of projected.subjects) inspect(SUBJECTS_STORE, record);
  for (const record of projected.items) inspect(ITEMS_STORE, record);
  const alreadyMigrated = missing === 0 && collisions.length === 0 && !recordsEmpty(target);
  const populated = !alreadyMigrated && !recordsEmpty(target);
  let status = "ready";
  if (alreadyMigrated) status = "already-migrated";
  else if (collisions.length > 0) status = "collision";
  else if (populated) status = "populated";
  return { ...base, status, operations, collisions, alreadyMigrated, populated };
}

function consentConfirmed(consent) {
  return consent === true || (!!consent && typeof consent === "object" && consent.confirmed === true);
}

function consentDestination(consent) {
  return consent && typeof consent === "object" && typeof consent.destination === "string"
    ? consent.destination
    : null;
}

function currentDestination(destinationCheck) {
  if (typeof destinationCheck === "function") return destinationCheck();
  if (destinationCheck && typeof destinationCheck === "object") return destinationCheck.current;
  return undefined;
}

// Commits the plan in a single `commit(operations)` call and only after an
// explicit consent. A refusal, a collision, a changed destination or a failed
// transaction leaves the adapter (and therefore the source and target) intact.
export async function runMigration(adapter, plan, consent, destinationCheck) {
  if (!adapter || typeof adapter.commit !== "function") {
    return { status: "invalid-adapter", operations: [] };
  }
  if (!plan || !Array.isArray(plan.operations)) {
    return { status: "invalid-plan", operations: [] };
  }
  if (!consentConfirmed(consent)) {
    return { status: "refused", operations: [] };
  }
  if (plan.status === "collision" || (Array.isArray(plan.collisions) && plan.collisions.length > 0)) {
    return { status: "collision", collisions: plan.collisions || [], operations: [] };
  }
  if (plan.status === "destination-changed") {
    return { status: "destination-changed", operations: [] };
  }
  if (destinationCheck !== undefined && destinationCheck !== null) {
    const disclosed = consentDestination(consent);
    const current = currentDestination(destinationCheck);
    if (disclosed !== null && current !== undefined && current !== disclosed) {
      return { status: "destination-changed", operations: [] };
    }
  }
  if (plan.operations.length === 0) {
    return { status: plan.alreadyMigrated ? "already-migrated" : "up-to-date", operations: [] };
  }
  try {
    const confirmation = await adapter.commit(plan.operations);
    return { status: "migrated", operations: plan.operations, confirmation };
  } catch (error) {
    return { status: "failed", operations: [], error };
  }
}
