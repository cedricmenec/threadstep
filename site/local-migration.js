// Pure, deterministic conversion of the historical `threadstep.document.v1`
// localStorage document into the autonomous local IndexedDB workspace. No DOM,
// network, Dexie Cloud or framework access: every browser side effect is
// injected by `site/app.js`. This path is deliberately separate from the
// Cloud reconciliation module.
import { STORAGE_KEY, parseDocument } from "./core.js";
import {
  SUBJECTS_STORE,
  ITEMS_STORE,
  emptyRecords,
  documentToRecords
} from "./persistence.js";
import {
  EXPORT_KIND,
  classifyProvenance,
  describeProvenanceInterpretations,
  isAmbiguousProvenance,
  mapLegacyId,
  mapRecords,
  normalizeProvenance,
  provenanceFromDocument
} from "./migration.js";
import { sha256Hex } from "./fingerprint.js";

export const LOCAL_MIGRATION_KEY = "threadstep.migration.v1";
export const LOCAL_TARGET = "threadstep-local";
export const MAPPING_VERSION = 1;

export const LOCAL_MIGRATION_STATUS = Object.freeze({
  PRESENT: "present",
  ABSENT: "absent",
  INVALID: "invalid",
  UNREADABLE: "unreadable",
  UNAVAILABLE: "unavailable",
  AMBIGUOUS_PROVENANCE: "ambiguous-provenance",
  READY: "ready",
  ALREADY_MIGRATED: "already-migrated",
  POPULATED: "populated",
  COLLISION: "collision",
  LOCAL_COMPLETE: "local-complete",
  REFUSED: "refused",
  CONSENT_MISMATCH: "consent-mismatch",
  STALE_SOURCE: "stale-source",
  STALE_PLAN: "stale-plan",
  READ_ERROR: "read-error",
  FAILED: "failed",
  INVALID_PLAN: "invalid-plan",
  INVALID_ADAPTER: "invalid-adapter"
});

const SUBJECT_FIELDS = Object.freeze(["id", "title", "order"]);
const ITEM_FIELDS = Object.freeze([
  "id", "subjectId", "parentId", "title", "note", "priority", "done", "order"
]);

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

function sourceResult(status, raw, document, message) {
  return {
    status,
    raw: raw === undefined ? null : raw,
    document: document || null,
    fingerprint: null,
    message
  };
}

// Detection is strict and the fingerprint covers the exact stored string, so
// whitespace or any byte rewrite invalidates a reviewed plan.
export function detectLocalSource(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return sourceResult(LOCAL_MIGRATION_STATUS.UNAVAILABLE, null, null,
      "Le stockage local n'est pas disponible.");
  }
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return sourceResult(LOCAL_MIGRATION_STATUS.UNREADABLE, null, null,
      "Le document historique est illisible.");
  }
  const detected = detectSourceText(raw);
  return { ...detected, context: "historical-key" };
}

export function detectSourceText(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return sourceResult(LOCAL_MIGRATION_STATUS.ABSENT, raw, null,
      "Aucun document historique à convertir.");
  }
  if (typeof raw !== "string") {
    return sourceResult(LOCAL_MIGRATION_STATUS.INVALID, raw, null,
      "Le document historique n'est pas exploitable.");
  }
  let document;
  try {
    document = parseDocument(raw);
  } catch {
    return sourceResult(LOCAL_MIGRATION_STATUS.INVALID, raw, null,
      "Le document historique n'est pas exploitable.");
  }
  return {
    status: LOCAL_MIGRATION_STATUS.PRESENT,
    raw,
    document,
    fingerprint: sha256Hex(raw),
    context: null,
    message: null
  };
}

function normalizeSource(source) {
  if (typeof source === "string" || source === null || source === undefined) {
    return detectSourceText(source);
  }
  if (typeof source === "object" && typeof source.status === "string" &&
      Object.prototype.hasOwnProperty.call(source, "document")) {
    if (source.status !== LOCAL_MIGRATION_STATUS.PRESENT || !source.document) return source;
    if (typeof source.fingerprint === "string") return source;
    return { ...source, fingerprint: sha256Hex(source.raw === null ? "" : source.raw) };
  }
  return sourceResult(LOCAL_MIGRATION_STATUS.INVALID, null, null,
    "Le document historique n'est pas exploitable.");
}

// Lossless local projection driven by explicit provenance. The historical
// shortcut `projectLocalRecords(document)` keeps the raw-V1 default for
// compatibility; planning is the layer that blocks ambiguous sources.
export function projectLocalRecords(document, provenance) {
  if (provenance === undefined) {
    return mapRecords(documentToRecords(document), {});
  }
  const normalized = normalizeProvenance(provenance);
  if (!normalized || isAmbiguousProvenance(normalized)) {
    throw new TypeError("Ambiguous provenance: explicit choice required");
  }
  return mapRecords(documentToRecords(document), { provenance: normalized });
}

function hasPrefixedIdentifiers(document) {
  const records = documentToRecords(document);
  return [...records.subjects, ...records.items].some((record) =>
    typeof record.id === "string" && record.id.startsWith("legacy:"));
}

// A source read from `threadstep.document.v1` carries a documented raw-V1
// context, but only while its identifiers are not already prefixed. Any other
// unmarked source stays ambiguous, whatever the identifier shape.
export function resolveLocalProvenance(source, explicit) {
  if (explicit !== undefined && explicit !== null) {
    return classifyProvenance(source && source.document, { provenance: explicit });
  }
  const embedded = provenanceFromDocument(source && source.document);
  if (embedded) return embedded;
  if (source && source.context === "historical-key" && source.document &&
      !hasPrefixedIdentifiers(source.document)) {
    return {
      exportKind: EXPORT_KIND.V1_RAW,
      idsCanonical: false,
      mappingVersion: 1,
      sourceFingerprint: source.fingerprint || null
    };
  }
  return {
    exportKind: EXPORT_KIND.UNKNOWN,
    idsCanonical: null,
    mappingVersion: null,
    sourceFingerprint: source ? source.fingerprint || null : null,
    reason: "unmarked-source"
  };
}

function normalizeRecords(records) {
  const source = records && typeof records === "object" ? records : emptyRecords();
  return {
    subjects: Array.isArray(source.subjects) ? source.subjects.map((record) => ({ ...record })) : [],
    items: Array.isArray(source.items) ? source.items.map((record) => ({ ...record })) : []
  };
}

function businessProjection(records) {
  const normalized = normalizeRecords(records);
  const pick = (record, fields) => fields.reduce((projected, field) => {
    if (Object.prototype.hasOwnProperty.call(record, field)) projected[field] = record[field];
    return projected;
  }, {});
  const byId = (left, right) => String(left.id).localeCompare(String(right.id));
  return {
    subjects: normalized.subjects.map((record) => pick(record, SUBJECT_FIELDS)).sort(byId),
    items: normalized.items.map((record) => pick(record, ITEM_FIELDS)).sort(byId)
  };
}

function targetFingerprint(records) {
  return sha256Hex(canonical(businessProjection(records)));
}

function recordsEmpty(records) {
  return records.subjects.length === 0 && records.items.length === 0;
}

function recordMatches(existing, projected) {
  return canonical(existing) === canonical(projected);
}

// The business projection is the source of truth for idempotency. Only absent
// identifiers produce a `put`; identical ones produce nothing and a different
// existing content is a collision that blocks the whole plan.
function classify(target, projected) {
  const existing = new Map();
  for (const record of target.subjects) existing.set(record.id, record);
  for (const record of target.items) existing.set(record.id, record);
  const operations = [];
  const collisions = [];
  let missing = 0;
  const inspect = (store, record) => {
    const current = existing.get(record.id);
    if (!current) {
      operations.push({ type: "put", store, value: { ...record } });
      missing += 1;
      return;
    }
    const comparable = {};
    for (const field of Object.keys(record)) comparable[field] = current[field];
    if (!recordMatches(comparable, record)) collisions.push(record.id);
  };
  for (const record of projected.subjects) inspect(SUBJECTS_STORE, record);
  for (const record of projected.items) inspect(ITEMS_STORE, record);
  return { operations, collisions, missing };
}

// A preference is remapped only when both referenced identifiers exist in the
// source document; an unreferenced preference is preserved untouched by the
// caller (this function returns null and never rewrites it).
export function remapResumePreference(document, preference, provenance) {
  if (!preference || typeof preference !== "object" || Array.isArray(preference)) return null;
  const subjectId = preference.subjectId;
  const itemId = preference.itemId;
  if (typeof subjectId !== "string" || typeof itemId !== "string") return null;
  const subject = Array.isArray(document && document.subjects)
    ? document.subjects.find((entry) => entry.id === subjectId)
    : null;
  if (!subject || !Array.isArray(subject.items)) return null;
  const item = subject.items.find((entry) => entry.id === itemId);
  if (!item) return null;
  const normalized = provenance !== undefined && provenance !== null
    ? normalizeProvenance(provenance)
    : null;
  const options = normalized
    ? { keep: normalized.exportKind !== EXPORT_KIND.V1_RAW,
        idempotent: normalized.exportKind !== EXPORT_KIND.V1_RAW }
    : { idempotent: true };
  return {
    subjectId: mapLegacyId(subjectId, options),
    itemId: mapLegacyId(itemId, options)
  };
}

export function planLocalConversion(input = {}) {
  const source = normalizeSource(input.source);
  const target = normalizeRecords(input.target);
  const empty = {
    status: source.status,
    source,
    provenance: null,
    ambiguous: false,
    interpretations: [],
    sourceFingerprint: source.fingerprint,
    targetFingerprint: targetFingerprint(target),
    fingerprint: null,
    projected: emptyRecords(),
    operations: [],
    collisions: [],
    populated: false,
    alreadyMigrated: false,
    counts: { subjects: 0, items: 0 },
    targetCounts: { subjects: target.subjects.length, items: target.items.length },
    resumePreference: null,
    resumePreferenceOriginal: input.resumePreference === undefined ? null : input.resumePreference
  };
  if (source.status !== LOCAL_MIGRATION_STATUS.PRESENT) return empty;

  const provenance = resolveLocalProvenance(source, input.provenance);
  if (isAmbiguousProvenance(provenance)) {
    return {
      ...empty,
      status: LOCAL_MIGRATION_STATUS.AMBIGUOUS_PROVENANCE,
      provenance,
      ambiguous: true,
      interpretations: describeProvenanceInterpretations(source.document)
    };
  }

  const projected = projectLocalRecords(source.document, provenance);
  const { operations, collisions, missing } = classify(target, projected);
  const populatedTarget = !recordsEmpty(target);
  const alreadyMigrated = missing === 0 && collisions.length === 0 && populatedTarget;
  let status = LOCAL_MIGRATION_STATUS.READY;
  if (alreadyMigrated) status = LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED;
  else if (collisions.length > 0) status = LOCAL_MIGRATION_STATUS.COLLISION;
  else if (populatedTarget) status = LOCAL_MIGRATION_STATUS.POPULATED;

  const targetDigest = targetFingerprint(target);
  const fingerprint = sha256Hex(canonical({
    version: MAPPING_VERSION,
    source: source.fingerprint,
    target: targetDigest,
    provenance,
    operations
  }));
  return {
    ...empty,
    status,
    provenance,
    targetFingerprint: targetDigest,
    fingerprint,
    projected,
    operations,
    collisions,
    populated: populatedTarget,
    alreadyMigrated,
    counts: {
      subjects: projected.subjects.length,
      items: projected.items.length
    },
    resumePreference: remapResumePreference(source.document, input.resumePreference, provenance)
  };
}

export function buildLocalProvenance(plan) {
  if (!plan || typeof plan.sourceFingerprint !== "string" ||
      !plan.counts || typeof plan.counts.subjects !== "number") {
    throw new TypeError("A validated local plan is required for provenance");
  }
  return {
    version: 1,
    sourceKey: STORAGE_KEY,
    sourceFingerprint: plan.sourceFingerprint,
    mappingVersion: MAPPING_VERSION,
    target: LOCAL_TARGET,
    status: LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE,
    subjects: plan.counts.subjects,
    items: plan.counts.items
  };
}

export function parseLocalProvenance(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.version !== 1 || value.sourceKey !== STORAGE_KEY ||
      typeof value.sourceFingerprint !== "string" ||
      value.mappingVersion !== MAPPING_VERSION || value.target !== LOCAL_TARGET ||
      value.status !== LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE ||
      typeof value.subjects !== "number" || typeof value.items !== "number") {
    return null;
  }
  return {
    version: value.version,
    sourceKey: value.sourceKey,
    sourceFingerprint: value.sourceFingerprint,
    mappingVersion: value.mappingVersion,
    target: value.target,
    status: value.status,
    subjects: value.subjects,
    items: value.items
  };
}

// Provenance lives in non-synchronized origin-local storage: it is metadata
// only and is never exported with the business records.
export function writeLocalProvenance(storage, provenance) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(LOCAL_MIGRATION_KEY, JSON.stringify(provenance));
    return true;
  } catch {
    return false;
  }
}

export function readLocalProvenance(storage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    return parseLocalProvenance(storage.getItem(LOCAL_MIGRATION_KEY));
  } catch {
    return null;
  }
}

export function isLocalCompletion(provenance) {
  return !!provenance && provenance.status === LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE;
}

// Reload/recovery state: the provenance marker proves a complete local
// conversion, an empty target means it never started, and any other populated
// target is uncertain because a commit may not have been followed by its
// metadata write.
export function localConversionState(storage, target) {
  const provenance = readLocalProvenance(storage);
  if (isLocalCompletion(provenance)) return { status: "complete", provenance };
  if (recordsEmpty(normalizeRecords(target))) return { status: "not-started", provenance: null };
  return { status: "uncertain", provenance: null };
}

function consentConfirmed(consent) {
  return !!consent && typeof consent === "object" && consent.confirmed === true;
}

function reading(adapter, method) {
  return typeof adapter[method] === "function";
}

// Confirmation re-reads the source and the target, recomputes the plan and
// commits exactly once. A refusal, a changed source, a changed target, a
// collision or a failed transaction writes nothing.
export async function runLocalConversion(adapter, plan, consent) {
  if (!adapter || !reading(adapter, "commit")) {
    return { status: LOCAL_MIGRATION_STATUS.INVALID_ADAPTER, operations: [] };
  }
  if (!plan || !Array.isArray(plan.operations) || typeof plan.fingerprint !== "string") {
    return { status: LOCAL_MIGRATION_STATUS.INVALID_PLAN, operations: [] };
  }
  if (!consentConfirmed(consent)) {
    return { status: LOCAL_MIGRATION_STATUS.REFUSED, operations: [] };
  }
  if (consent.fingerprint !== plan.fingerprint) {
    return { status: LOCAL_MIGRATION_STATUS.CONSENT_MISMATCH, operations: [] };
  }
  if (!reading(adapter, "readSource") || !reading(adapter, "readTarget")) {
    return { status: LOCAL_MIGRATION_STATUS.INVALID_ADAPTER, operations: [] };
  }

  let raw;
  try {
    raw = await adapter.readSource();
  } catch {
    return { status: LOCAL_MIGRATION_STATUS.STALE_SOURCE, operations: [] };
  }
  const source = detectSourceText(raw);
  if (source.status !== LOCAL_MIGRATION_STATUS.PRESENT ||
      source.fingerprint !== plan.sourceFingerprint) {
    return { status: LOCAL_MIGRATION_STATUS.STALE_SOURCE, operations: [] };
  }

  let target;
  try {
    target = await adapter.readTarget();
  } catch {
    return { status: LOCAL_MIGRATION_STATUS.READ_ERROR, operations: [] };
  }

  const fresh = planLocalConversion({
    source,
    target,
    resumePreference: plan.resumePreferenceOriginal,
    provenance: plan.provenance
  });
  if (fresh.fingerprint !== plan.fingerprint) {
    return { status: LOCAL_MIGRATION_STATUS.STALE_PLAN, operations: [] };
  }
  if (fresh.status === LOCAL_MIGRATION_STATUS.COLLISION) {
    return {
      status: LOCAL_MIGRATION_STATUS.COLLISION,
      collisions: fresh.collisions,
      operations: []
    };
  }
  if (fresh.operations.length === 0) {
    return { status: LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED, operations: [] };
  }

  try {
    await adapter.commit(fresh.operations);
  } catch (error) {
    return { status: LOCAL_MIGRATION_STATUS.FAILED, operations: [], error };
  }

  const provenance = buildLocalProvenance(fresh);
  let provenanceWritten = false;
  let provenanceError = null;
  if (reading(adapter, "writeProvenance")) {
    try {
      provenanceWritten = (await adapter.writeProvenance(provenance)) !== false;
    } catch (error) {
      provenanceError = error;
    }
  }

  let preferenceWritten = false;
  let preferenceError = null;
  if (fresh.resumePreference && reading(adapter, "writeResumePreference")) {
    try {
      await adapter.writeResumePreference(fresh.resumePreference);
      preferenceWritten = true;
    } catch (error) {
      preferenceError = error;
    }
  }

  return {
    status: LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE,
    operations: fresh.operations,
    provenance,
    provenanceWritten,
    provenanceError,
    preference: fresh.resumePreference,
    preferenceWritten,
    preferenceError,
    counts: fresh.counts
  };
}
