// Pure, read-only integrity diagnosis, degraded consultation, raw recovery
// export and conservatively consented reference repair. No DOM, network,
// IndexedDB or framework access: every browser side effect is injected.
import { recordsToDocument } from "./persistence.js";
import { documentToRecords } from "./persistence.js";
import { sha256Hex } from "./fingerprint.js";
import {
  BACKUP_FORMAT,
  canonicalBackupRecords,
  computeBackupChecksum,
  parseIndexedDbBackup,
  serializeIndexedDbBackup,
  validateBackupRecords
} from "./indexeddb-backup.js";
import {
  EXPORT_KIND,
  classifyProvenance,
  describeProvenanceInterpretations,
  isAmbiguousProvenance,
  mapRecords,
  normalizeProvenance,
  PROVENANCE_MAPPING_VERSION
} from "./migration.js";

export const READ_FAILURE = Object.freeze({
  STORAGE_UNAVAILABLE: "storage-unavailable",
  READ_REFUSED: "read-refused",
  PROJECTION_INVALID: "projection-invalid",
  NOT_VISIBLE_UNAUTHORIZED: "not-visible-unauthorized",
  INDETERMINATE: "indeterminate"
});

export const ANOMALY = Object.freeze({
  DANGLING_SUBJECT: "dangling-subject",
  DANGLING_PARENT: "dangling-parent",
  DUPLICATE_ID: "duplicate-id",
  PREFIX_VARIANT: "prefix-variant",
  LOGICAL_DUPLICATE: "logical-duplicate",
  IDENTITY_COLLISION: "identity-collision",
  PARENT_INCONSISTENCY: "parent-inconsistency",
  CONTENT_CONFLICT: "content-conflict",
  INVISIBLE_OR_UNAUTHORIZED: "invisible-or-unauthorized",
  INDETERMINATE: "indeterminate"
});

export const BLOCKING_ANOMALIES = Object.freeze([
  ANOMALY.DANGLING_SUBJECT,
  ANOMALY.DANGLING_PARENT,
  ANOMALY.DUPLICATE_ID,
  ANOMALY.PREFIX_VARIANT,
  ANOMALY.IDENTITY_COLLISION,
  ANOMALY.PARENT_INCONSISTENCY,
  ANOMALY.CONTENT_CONFLICT,
  ANOMALY.INDETERMINATE
]);

export const RAW_RECOVERY_FORMAT = "threadstep.raw-recovery.v1";
const LEGACY_PREFIX = "legacy:";

const SUBJECT_FIELDS = Object.freeze(["id", "title", "order"]);
const ITEM_FIELDS = Object.freeze([
  "id", "subjectId", "parentId", "title", "note", "priority", "done", "order"
]);
const NATIVE_METADATA_FIELDS = Object.freeze(["owner", "realmId", "$ts", "$baseRev"]);
const FORBIDDEN_FIELD = /token|otp|secret|credential|password|email|apikey|api_key|accesskey/i;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function canonical(value) {
  return JSON.stringify(value, (key, item) => {
    if (Array.isArray(item)) return item.map((entry) => entry);
    if (isPlainObject(item)) {
      return Object.keys(item).sort().reduce((sorted, name) => {
        sorted[name] = item[name];
        return sorted;
      }, {});
    }
    return item;
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rawArrays(raw) {
  return {
    subjects: Array.isArray(raw && raw.subjects) ? raw.subjects : [],
    items: Array.isArray(raw && raw.items) ? raw.items : []
  };
}

export function typedReadError(code, cause) {
  const error = new Error(code);
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function classifyReadError(error) {
  const explicit = error && (error.code || error.readCode);
  if (Object.values(READ_FAILURE).includes(explicit)) return explicit;
  if (!error) return READ_FAILURE.INDETERMINATE;
  const text = String(error.name || "") + " " + String(error.message || "");
  if (/permission|denied|unauthori[sz]ed|forbidden|realm|not.?allowed/i.test(text)) {
    return READ_FAILURE.NOT_VISIBLE_UNAUTHORIZED;
  }
  if (/unavailable|not.?supported|no.?such.?database|database.?missing|open.*fail/i.test(text)) {
    return READ_FAILURE.STORAGE_UNAVAILABLE;
  }
  if (/dangling|projection|invalid.?tables|malformed|parse|hierarchy/i.test(text)) {
    return READ_FAILURE.PROJECTION_INVALID;
  }
  return READ_FAILURE.READ_REFUSED;
}

function strictProjection(raw) {
  const records = documentToRecords(recordsToDocument(raw));
  const subjects = Array.isArray(raw && raw.subjects) ? raw.subjects : [];
  const items = Array.isArray(raw && raw.items) ? raw.items : [];
  const itemIds = new Set(items.map((record) => record.id));
  for (const record of items) {
    if (!subjects.some((subject) => subject.id === record.subjectId)) {
      throw new Error("Dangling subject references in IndexedDB");
    }
    if (record.parentId !== undefined && record.parentId !== null) {
      if (!itemIds.has(record.parentId)) throw new Error("Dangling parent references in IndexedDB");
    }
  }
  if (records.subjects.length !== subjects.length || records.items.length !== items.length) {
    throw new Error("Dangling subject references in IndexedDB");
  }
  return records;
}

// Reads the two stores and classifies the outcome instead of collapsing every
// failure into an exception. A projection failure keeps the raw tables so the
// degraded read-only consultation can still show what is readable.
export async function readWorkspaceResult(read) {
  if (typeof read !== "function") {
    return { code: READ_FAILURE.STORAGE_UNAVAILABLE, raw: null, records: null, error: null };
  }
  let raw;
  try {
    raw = await read();
  } catch (error) {
    return { code: classifyReadError(error), raw: null, records: null, error };
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.subjects) || !Array.isArray(raw.items)) {
    return {
      code: READ_FAILURE.INDETERMINATE,
      raw: isPlainObject(raw) ? raw : null,
      records: null,
      error: typedReadError(READ_FAILURE.INDETERMINATE)
    };
  }
  try {
    return { code: "ok", raw, records: strictProjection(raw), error: null };
  } catch (error) {
    return { code: READ_FAILURE.PROJECTION_INVALID, raw, records: null, error };
  }
}

// Contradictory or missing native signals never become "empty" or "synced".
export function classifyReadSignals(input = {}) {
  if (input.storageAvailable === false) return READ_FAILURE.STORAGE_UNAVAILABLE;
  if (input.readRefused === true) return READ_FAILURE.READ_REFUSED;
  if (input.projectionInvalid === true) return READ_FAILURE.PROJECTION_INVALID;
  if (input.notVisibleUnauthorized === true) return READ_FAILURE.NOT_VISIBLE_UNAUTHORIZED;
  if (Object.values(READ_FAILURE).includes(input.code)) return input.code;
  return READ_FAILURE.INDETERMINATE;
}

function stripPrefixes(id) {
  let value = id;
  while (typeof value === "string" && value.startsWith(LEGACY_PREFIX)) {
    value = value.slice(LEGACY_PREFIX.length);
  }
  return value;
}

function businessFields(store, record) {
  const fields = store === "subjects" ? SUBJECT_FIELDS : ITEM_FIELDS;
  const projected = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) projected[field] = record[field];
  }
  return projected;
}

function businessFieldsWithoutId(store, record) {
  const projected = businessFields(store, record);
  delete projected.id;
  return projected;
}

function anomaly(code, store, record, extra = {}) {
  return {
    code,
    store,
    id: record && typeof record.id === "string" ? record.id : null,
    ...extra
  };
}

function permissionsMayHideTarget(context) {
  if (context && context.permissionsMayHide === true) return true;
  if (context && context.visibility === "restricted") return true;
  return false;
}

// Pure read-only inventory. Never creates, renames, deletes or repairs.
export function buildIntegrityInventory(raw, context = {}) {
  const anomalies = [];
  const codes = {};
  const record = (entry) => {
    anomalies.push(entry);
    codes[entry.code] = (codes[entry.code] || 0) + 1;
  };
  if (!isPlainObject(raw) || !Array.isArray(raw.subjects) || !Array.isArray(raw.items)) {
    record({ code: ANOMALY.INDETERMINATE, store: null, id: null, reason: "unreadable-tables" });
    return {
      ok: false,
      counts: { subjects: 0, items: 0 },
      anomalies,
      codes,
      groups: [],
      instanceContext: sanitizeInstanceContext(context)
    };
  }
  const { subjects, items } = rawArrays(raw);
  const subjectGroups = new Map();
  const itemGroups = new Map();
  for (const subject of subjects) {
    if (!isPlainObject(subject) || typeof subject.id !== "string" || subject.id.length === 0) {
      record({ code: ANOMALY.INDETERMINATE, store: "subjects", id: null, reason: "invalid-record" });
      continue;
    }
    if (!subjectGroups.has(subject.id)) subjectGroups.set(subject.id, []);
    subjectGroups.get(subject.id).push(subject);
  }
  for (const item of items) {
    if (!isPlainObject(item) || typeof item.id !== "string" || item.id.length === 0) {
      record({ code: ANOMALY.INDETERMINATE, store: "items", id: null, reason: "invalid-record" });
      continue;
    }
    if (!itemGroups.has(item.id)) itemGroups.set(item.id, []);
    itemGroups.get(item.id).push(item);
  }
  for (const [id, group] of subjectGroups) {
    if (group.length > 1) record({ code: ANOMALY.DUPLICATE_ID, store: "subjects", id, count: group.length });
  }
  for (const [id, group] of itemGroups) {
    if (group.length > 1) record({ code: ANOMALY.DUPLICATE_ID, store: "items", id, count: group.length });
  }

  const subjectById = new Map();
  for (const [id, group] of subjectGroups) subjectById.set(id, group[0]);
  const itemById = new Map();
  for (const [id, group] of itemGroups) itemById.set(id, group[0]);

  const visible = permissionsMayHideTarget(context);
  for (const item of items) {
    if (!isPlainObject(item) || typeof item.id !== "string") continue;
    if (typeof item.subjectId !== "string" || !subjectById.has(item.subjectId)) {
      record(visible
        ? { code: ANOMALY.INVISIBLE_OR_UNAUTHORIZED, store: "items", id: item.id, reference: item.subjectId }
        : { code: ANOMALY.DANGLING_SUBJECT, store: "items", id: item.id, reference: item.subjectId });
    }
  }

  for (const item of items) {
    if (!isPlainObject(item) || typeof item.id !== "string") continue;
    if (item.parentId === undefined || item.parentId === null) continue;
    const parent = itemById.get(item.parentId);
    if (!parent) {
      record({ code: ANOMALY.DANGLING_PARENT, store: "items", id: item.id, reference: item.parentId });
      continue;
    }
    if (parent.subjectId !== item.subjectId) {
      record({ code: ANOMALY.PARENT_INCONSISTENCY, store: "items", id: item.id, reason: "cross-subject-parent" });
    }
    if (parent.parentId !== undefined && parent.parentId !== null) {
      record({ code: ANOMALY.PARENT_INCONSISTENCY, store: "items", id: item.id, reason: "nested-parent" });
    }
    const visiting = new Set([item.id]);
    let cursor = parent;
    while (cursor && cursor.parentId !== undefined && cursor.parentId !== null) {
      if (visiting.has(cursor.id)) {
        record({ code: ANOMALY.PARENT_INCONSISTENCY, store: "items", id: item.id, reason: "cycle" });
        break;
      }
      visiting.add(cursor.id);
      cursor = itemById.get(cursor.parentId);
    }
  }

  const reportDuplicates = (store, records) => {
    const byBusiness = new Map();
    for (const entry of records) {
      if (!isPlainObject(entry) || typeof entry.id !== "string") continue;
      const digest = canonical(businessFieldsWithoutId(store, entry));
      if (!byBusiness.has(digest)) byBusiness.set(digest, []);
      byBusiness.get(digest).push(entry);
    }
    for (const entries of byBusiness.values()) {
      const ids = [...new Set(entries.map((entry) => entry.id))];
      if (ids.length < 2) continue;
      record({ code: ANOMALY.LOGICAL_DUPLICATE, store, id: null, ids: ids.sort() });
    }
  };
  const reportIdentityCollisions = (store, records) => {
    const byCanonical = new Map();
    for (const entry of records) {
      if (!isPlainObject(entry) || typeof entry.id !== "string") continue;
      const canonicalId = entry.id.startsWith(LEGACY_PREFIX) ? entry.id : LEGACY_PREFIX + entry.id;
      if (!byCanonical.has(canonicalId)) byCanonical.set(canonicalId, []);
      byCanonical.get(canonicalId).push(entry);
    }
    for (const [canonicalId, entries] of byCanonical) {
      const ids = [...new Set(entries.map((entry) => entry.id))];
      if (ids.length < 2) continue;
      record({ code: ANOMALY.IDENTITY_COLLISION, store, id: canonicalId, ids: ids.sort() });
    }
  };
  reportDuplicates("subjects", subjects);
  reportDuplicates("items", items);
  reportIdentityCollisions("subjects", subjects);
  reportIdentityCollisions("items", items);

  const groups = [];
  const seenVariantGroups = new Set();
  const reportVariants = (store, records) => {
    const byStem = new Map();
    for (const entry of records) {
      if (!isPlainObject(entry) || typeof entry.id !== "string") continue;
      const stem = stripPrefixes(entry.id);
      if (!byStem.has(stem)) byStem.set(stem, []);
      byStem.get(stem).push(entry);
    }
    for (const [stem, entries] of byStem) {
      const ids = [...new Set(entries.map((entry) => entry.id))];
      if (ids.length < 2) continue;
      const fields = entries.map((entry) => canonical(businessFieldsWithoutId(store, entry)));
      const divergent = new Set(fields).size > 1;
      if (seenVariantGroups.has(store + ":" + stem)) continue;
      seenVariantGroups.add(store + ":" + stem);
      const group = {
        key: store + ":" + stem,
        code: ANOMALY.PREFIX_VARIANT,
        store,
        stem,
        variants: ids.slice().sort(),
        count: entries.length
      };
      groups.push(group);
      record({ code: ANOMALY.PREFIX_VARIANT, store, id: null, variants: group.variants, count: entries.length });
      if (divergent) {
        record({ code: ANOMALY.CONTENT_CONFLICT, store, id: null, variants: group.variants });
      }
    }
  };
  reportVariants("subjects", subjects);
  reportVariants("items", items);

  // Cross-record references also participate in the variant diagnosis: an
  // orphan item referencing `legacy:s1` while the store only contains
  // `legacy:legacy:s1` must surface as a prefix variant, never as a decision.
  const referenceVariants = (store, references) => {
    const byStem = new Map();
    for (const id of references) {
      if (typeof id !== "string" || id.length === 0) continue;
      const stem = stripPrefixes(id);
      if (!byStem.has(stem)) byStem.set(stem, new Set());
      byStem.get(stem).add(id);
    }
    for (const [stem, ids] of byStem) {
      if (ids.size < 2) continue;
      if (seenVariantGroups.has(store + ":" + stem)) continue;
      seenVariantGroups.add(store + ":" + stem);
      const variants = [...ids].sort();
      groups.push({ key: store + ":" + stem, code: ANOMALY.PREFIX_VARIANT, store, stem, variants, count: variants.length });
      record({ code: ANOMALY.PREFIX_VARIANT, store, id: null, variants, count: variants.length, reference: true });
    }
  };
  referenceVariants("subjects",
    subjects.filter((entry) => isPlainObject(entry) && typeof entry.id === "string").map((entry) => entry.id)
      .concat(items.filter((entry) => isPlainObject(entry) && typeof entry.subjectId === "string").map((entry) => entry.subjectId)));
  referenceVariants("items",
    items.filter((entry) => isPlainObject(entry) && typeof entry.id === "string").map((entry) => entry.id)
      .concat(items.filter((entry) => isPlainObject(entry) && typeof entry.parentId === "string").map((entry) => entry.parentId)));

  return {
    ok: true,
    counts: { subjects: subjects.length, items: items.length },
    anomalies,
    codes,
    groups,
    instanceContext: sanitizeInstanceContext(context),
    hasBlockingAnomaly: hasBlockingAnomaly({ anomalies })
  };
}

function hasBlockingAnomaly(inventory) {
  if (!inventory || !Array.isArray(inventory.anomalies)) return false;
  return inventory.anomalies.some((entry) => BLOCKING_ANOMALIES.includes(entry.code));
}

export { hasBlockingAnomaly };

export function summarizeIntegrityInventory(inventory) {
  const summary = {};
  for (const entry of (inventory && inventory.anomalies) || []) {
    summary[entry.code] = summary[entry.code] || { count: 0, stores: new Set() };
    summary[entry.code].count += 1;
    if (entry.store) summary[entry.code].stores.add(entry.store);
  }
  return Object.keys(summary).sort().map((code) => ({
    code,
    count: summary[code].count,
    stores: [...summary[code].stores].sort()
  }));
}

// Tolerant, strictly read-only view. Every accessible record is either placed
// in the coherent view or listed in the anomaly report.
export function buildDegradedView(raw, inventory) {
  const { subjects, items } = rawArrays(raw);
  const report = inventory || buildIntegrityInventory(raw);
  const placedSubjects = [];
  const subjectIndex = new Map();
  for (const subject of subjects) {
    if (!isPlainObject(subject) || typeof subject.id !== "string" ||
        typeof subject.title !== "string" || subjectIndex.has(subject.id)) continue;
    const entry = { id: subject.id, title: subject.title, items: [] };
    subjectIndex.set(subject.id, entry);
    placedSubjects.push(entry);
  }
  const itemById = new Map();
  for (const item of items) {
    if (isPlainObject(item) && typeof item.id === "string" && !itemById.has(item.id)) {
      itemById.set(item.id, item);
    }
  }
  const placeable = (item) => {
    if (!isPlainObject(item) || typeof item.id !== "string" || typeof item.title !== "string") return false;
    const subject = subjectIndex.get(item.subjectId);
    if (!subject) return false;
    if (item.parentId === undefined || item.parentId === null) return true;
    const parent = itemById.get(item.parentId);
    return !!parent && parent.subjectId === item.subjectId &&
      (parent.parentId === undefined || parent.parentId === null) && parent.id !== item.id;
  };
  let placedTasks = 0;
  const anomalous = [];
  for (const item of items) {
    if (!placeable(item)) {
      anomalous.push({
        store: "items",
        id: isPlainObject(item) && typeof item.id === "string" ? item.id : null,
        code: ANOMALY.INDETERMINATE
      });
      continue;
    }
    subjectIndex.get(item.subjectId).items.push({
      id: item.id,
      title: item.title,
      subjectId: item.subjectId,
      parentId: item.parentId === undefined ? null : item.parentId,
      priority: item.priority,
      done: item.done === true,
      order: item.order,
      ...(Object.prototype.hasOwnProperty.call(item, "note") ? { note: item.note } : {})
    });
    placedTasks += 1;
  }
  for (const entry of (report && report.anomalies) || []) {
    if (entry.code === ANOMALY.DANGLING_SUBJECT || entry.code === ANOMALY.INVISIBLE_OR_UNAUTHORIZED ||
        entry.code === ANOMALY.DANGLING_PARENT || entry.code === ANOMALY.PARENT_INCONSISTENCY ||
        entry.code === ANOMALY.DUPLICATE_ID || entry.code === ANOMALY.INDETERMINATE) {
      anomalous.push(entry);
    }
  }
  return {
    editable: false,
    document: { subjects: placedSubjects },
    displayed: { subjects: placedSubjects.length, items: placedTasks },
    anomalies: anomalous,
    inventory: report,
    accountsForEveryRecord: placedTasks + items.filter((item) => !placeable(item)).length === items.length
  };
}

export function sanitizeInstanceContext(context = {}) {
  const source = isPlainObject(context) ? context : {};
  const url = typeof source.url === "string" ? source.url : null;
  return {
    workspace: source.workspace === "synced" ? "synced" : "local",
    url,
    remoteDbId: typeof source.remoteDbId === "string" ? source.remoteDbId : null,
    sessionCategory: typeof source.sessionCategory === "string"
      ? source.sessionCategory
      : "unauthenticated",
    rightsAvailable: source.rightsAvailable === true,
    realmsAvailable: source.realmsAvailable === true,
    permissionsMayHide: source.permissionsMayHide === true
  };
}

function sanitizeRecord(store, record) {
  if (!isPlainObject(record)) return null;
  const allowed = store === "subjects" ? SUBJECT_FIELDS : ITEM_FIELDS;
  const output = {};
  for (const field of [...allowed, ...NATIVE_METADATA_FIELDS]) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) continue;
    if (FORBIDDEN_FIELD.test(field)) continue;
    output[field] = clone(record[field]);
  }
  return output;
}

function sanitizeRecords(store, records) {
  const result = [];
  for (const record of records) {
    const sanitized = sanitizeRecord(store, record);
    if (sanitized) result.push(sanitized);
  }
  return result;
}

// Faithful raw recovery export built from the store arrays already read. It is
// never reconstructed from an in-memory `lastRecords` snapshot.
export function buildRawRecoveryExport(raw, context = {}) {
  if (!isPlainObject(raw) || !Array.isArray(raw.subjects) || !Array.isArray(raw.items)) {
    return { status: "unavailable", code: READ_FAILURE.READ_REFUSED, rawRecoveryExport: null };
  }
  const records = {
    subjects: sanitizeRecords("subjects", raw.subjects),
    items: sanitizeRecords("items", raw.items)
  };
  return {
    status: "ready",
    format: RAW_RECOVERY_FORMAT,
    exportKind: "raw-recovery",
    counts: { subjects: records.subjects.length, items: records.items.length },
    checksum: sha256Hex(canonical(records)),
    instanceContext: sanitizeInstanceContext(context),
    records
  };
}

export function verifyRecoverySnapshot(snapshot, expected = {}) {
  if (!isPlainObject(snapshot) || snapshot.status !== "ready" || !isPlainObject(snapshot.records)) {
    return { valid: false, code: "backup-missing" };
  }
  const records = snapshot.records;
  const counts = {
    subjects: Array.isArray(records.subjects) ? records.subjects.length : -1,
    items: Array.isArray(records.items) ? records.items.length : -1
  };
  if (counts.subjects < 0 || counts.items < 0) return { valid: false, code: "backup-corrupt" };
  const checksum = sha256Hex(canonical({ subjects: records.subjects, items: records.items }));
  if (typeof snapshot.checksum !== "string" || snapshot.checksum !== checksum) {
    return { valid: false, code: "backup-checksum-mismatch" };
  }
  if (isPlainObject(expected.counts)) {
    if (expected.counts.subjects !== counts.subjects || expected.counts.items !== counts.items) {
      return { valid: false, code: "backup-count-mismatch" };
    }
  }
  if (typeof expected.checksum === "string" && expected.checksum !== checksum) {
    return { valid: false, code: "backup-checksum-mismatch" };
  }
  return { valid: true, code: "backup-valid", counts, checksum };
}

export function buildRepairRecoverySnapshot(raw, context = {}) {
  return buildRawRecoveryExport(raw, context);
}

// The normal modern business backup is gated as soon as an integrity anomaly
// exists. The raw recovery export stays available and distinct.
export function evaluateBusinessExport(inventory) {
  if (hasBlockingAnomaly(inventory)) {
    return {
      allowed: false,
      code: "business-export-disabled",
      reason: "integrity-anomaly",
      rawRecoveryRequired: true
    };
  }
  return { allowed: true, code: "business-export-ready", rawRecoveryRequired: false };
}

export function buildBusinessExport(records, options = {}) {
  const gate = evaluateBusinessExport(options.inventory);
  if (!gate.allowed) {
    return { status: "disabled", ...gate, document: null, records: null };
  }
  const serialized = serializeIndexedDbBackup(records, {
    schemaVersion: options.schemaVersion
  });
  if (!serialized.ok) {
    return {
      status: "incomplete",
      allowed: false,
      code: serialized.code,
      reason: "invalid-records",
      document: null,
      records: null,
      message: serialized.message
    };
  }
  return {
    status: "ready",
    allowed: true,
    code: serialized.code,
    document: serialized.document,
    records: serialized.records,
    counts: serialized.counts,
    checksum: serialized.checksum
  };
}

function verifyRestoreBackup(snapshot, expected = {}) {
  if (isPlainObject(snapshot) && snapshot.format === BACKUP_FORMAT) {
    const parsed = parseIndexedDbBackup(snapshot);
    if (!parsed.ok) return { valid: false, code: parsed.code };
    if (isPlainObject(expected.counts) &&
        (expected.counts.subjects !== parsed.counts.subjects ||
         expected.counts.items !== parsed.counts.items)) {
      return { valid: false, code: "backup-count-mismatch" };
    }
    if (typeof expected.checksum === "string" && expected.checksum !== parsed.checksum) {
      return { valid: false, code: "backup-checksum-mismatch" };
    }
    return { valid: true, code: "backup-valid", counts: parsed.counts, checksum: parsed.checksum };
  }
  return verifyRecoverySnapshot(snapshot, expected);
}

// Restoring is a distinct, explicit intention, never an effect of import/merge.
// This pure helper exposes the scope, the potential losses and a fingerprint
// bound to both the modern source records and the current target.
export function buildRestorePlan(input = {}) {
  const current = isPlainObject(input.current) ? input.current : { subjects: [], items: [] };
  const incoming = isPlainObject(input.records) && Array.isArray(input.records.subjects) &&
    Array.isArray(input.records.items)
    ? input.records
    : isPlainObject(input.incoming) && Array.isArray(input.incoming.subjects) &&
      Array.isArray(input.incoming.items) ? input.incoming : null;
  if (!incoming) {
    return { status: "invalid-source", allowed: false, code: "invalid-source", operations: [] };
  }
  const validation = validateBackupRecords({ subjects: current.subjects, items: current.items });
  const incomingValidation = validateBackupRecords({ subjects: incoming.subjects, items: incoming.items });
  if (!incomingValidation.ok) {
    return {
      status: "invalid-source",
      allowed: false,
      code: incomingValidation.code,
      message: incomingValidation.message,
      operations: []
    };
  }
  const currentKeys = new Set([
    ...current.subjects.map((record) => "subjects:" + record.id),
    ...current.items.map((record) => "items:" + record.id)
  ]);
  const incomingKeys = new Set([
    ...incoming.subjects.map((record) => "subjects:" + record.id),
    ...incoming.items.map((record) => "items:" + record.id)
  ]);
  const removed = [...currentKeys].filter((key) => !incomingKeys.has(key)).sort();
  const added = [...incomingKeys].filter((key) => !currentKeys.has(key)).sort();
  const scope = { subjects: incoming.subjects.length, items: incoming.items.length };
  const backup = input.backup === undefined ? null : input.backup;
  const backupCheck = backup === null
    ? { valid: false, code: "backup-missing" }
    : verifyRestoreBackup(backup, input.backupExpected);
  const sourceChecksum = computeBackupChecksum(incomingValidation.records);
  const targetChecksum = validation.ok ? computeBackupChecksum(validation.records) : null;
  const fingerprint = sha256Hex(canonical({
    version: 1,
    sourceChecksum,
    targetChecksum,
    backupChecksum: backupCheck.valid ? backupCheck.checksum : null
  }));
  return {
    status: backupCheck.valid ? "ready" : "backup-required",
    allowed: backupCheck.valid,
    code: backupCheck.valid ? "restore-ready" : backupCheck.code,
    replacement: true,
    scope,
    counts: {
      current: { subjects: current.subjects.length, items: current.items.length },
      incoming: scope,
      added: added.length,
      removed: removed.length
    },
    added,
    removed,
    backupCheck,
    sourceChecksum,
    targetChecksum,
    fingerprint
  };
}

export const REPAIR_OUTCOME = Object.freeze({
  REPAIRED: "repaired",
  ALREADY_REPAIRED: "already-repaired",
  AMBIGUOUS: "ambiguous",
  REJECTED: "rejected",
  STALE_PLAN: "stale-plan",
  COLLISION: "collision",
  TRANSACTION_ERROR: "transaction-error",
  BACKUP_INVALID: "backup-invalid",
  DESTINATION_CHANGED: "destination-changed",
  INVALID_PLAN: "invalid-plan"
});

function destinationIdentity(destination) {
  const source = isPlainObject(destination) ? destination : {};
  return {
    url: typeof source.url === "string" ? source.url : null,
    remoteDbId: typeof source.remoteDbId === "string" ? source.remoteDbId : null,
    userCategory: typeof source.userCategory === "string" ? source.userCategory : "anonymous",
    rightsAvailable: source.rightsAvailable === true,
    realmsAvailable: source.realmsAvailable === true
  };
}

export function computeDestinationIdentityFingerprint(destination) {
  return sha256Hex(canonical(destinationIdentity(destination)));
}

function recordsCandidates(records) {
  const normalized = canonicalBackupRecords(records);
  const subjects = new Map();
  const items = new Map();
  for (const record of normalized.subjects) subjects.set(record.id, record);
  for (const record of normalized.items) items.set(record.id, record);
  return { subjects, items, ambiguity: false };
}

function sourceCandidates(source, provenance) {
  const normalized = normalizeProvenance(provenance);
  if (!source || isAmbiguousProvenance(normalized)) {
    return { subjects: new Map(), items: new Map(), ambiguity: true };
  }
  const originals = documentToRecords(source);
  const records = mapRecords(originals, { provenance: normalized });
  const subjects = new Map();
  const items = new Map();
  originals.subjects.forEach((original, index) => {
    const mapped = records.subjects[index];
    subjects.set(mapped.id, mapped);
    subjects.set(original.id, mapped);
  });
  originals.items.forEach((original, index) => {
    const mapped = records.items[index];
    items.set(mapped.id, mapped);
    items.set(original.id, mapped);
  });
  return { subjects, items, ambiguity: false };
}

function groupKey(store, id, field) {
  return store + ":" + id + ":" + field;
}

// Pure, deterministic repair plan. Only references are planned; every other
// business field is preserved by construction.
export function buildRepairPlan(input = {}) {
  const raw = isPlainObject(input.raw) ? input.raw : { subjects: [], items: [] };
  const inventory = input.inventory || buildIntegrityInventory(raw, input.context || {});
  const provenance = input.sourceRecords
    ? { exportKind: EXPORT_KIND.INDEXEDDB_EXPORT, idsCanonical: true, mappingVersion: PROVENANCE_MAPPING_VERSION }
    : classifyProvenance(input.source, { provenance: input.provenance });
  const candidates = input.sourceRecords
    ? recordsCandidates(input.sourceRecords)
    : sourceCandidates(input.source, provenance);
  const decisions = isPlainObject(input.decisions) ? input.decisions : {};
  const targetSubjectIds = new Set(rawArrays(raw).subjects
    .filter((record) => isPlainObject(record) && typeof record.id === "string")
    .map((record) => record.id));
  const targetItems = new Map(rawArrays(raw).items
    .filter((record) => isPlainObject(record) && typeof record.id === "string")
    .map((record) => [record.id, record]));
  const destination = destinationIdentity(input.destination);
  const changes = [];
  const groups = [];
  const seen = new Set();
  const plannedItems = new Map();

  const plannedItemSubject = (item) => plannedItems.has(item.id)
    ? plannedItems.get(item.id).to
    : item.subjectId;

  const propose = (store, item, field, from, key) => {
    const decision = typeof decisions[key] === "string" ? decisions[key] : null;
    const matches = [];
    if (candidates.ambiguity) {
      groups.push({ key, store, id: item.id, field, from, status: "ambiguous", code: "no-provenance", candidates: [] });
      return;
    }
    if (field === "subjectId") {
      for (const [sourceId, record] of candidates.subjects) {
        if (targetSubjectIds.has(record.id) && (sourceId === from || record.id === from)) {
          if (!matches.includes(record.id)) matches.push(record.id);
        }
      }
    } else {
      for (const [sourceId, record] of candidates.items) {
        if (targetItems.has(record.id) && (sourceId === from || record.id === from)) {
          if (!matches.includes(record.id)) matches.push(record.id);
        }
      }
    }
    if (matches.length === 0) {
      groups.push({ key, store, id: item.id, field, from, status: "blocked", code: "identity-unproven", candidates: [] });
      return;
    }
    if (matches.length > 1) {
      groups.push({ key, store, id: item.id, field, from, status: "ambiguous", code: "multiple-candidates", candidates: matches.slice().sort() });
      return;
    }
    const to = matches[0];
    if (decision !== null && decision !== to) {
      groups.push({ key, store, id: item.id, field, from, status: "blocked", code: "consent-unproven", candidates: [to], proposal: to });
      return;
    }
    if (from === to) return;
    const consented = decision === to;
    groups.push({
      key,
      store,
      id: item.id,
      field,
      from,
      status: consented ? "proposed" : "proposed-unconsented",
      code: consented ? "evidence-match" : "consent-required",
      candidates: [to],
      proposal: to,
      consented
    });
    changes.push({ store, id: item.id, field, from, to, consented });
    if (store === "items" && field === "subjectId") {
      plannedItems.set(item.id, { from, to });
    }
  };

  for (const item of rawArrays(raw).items) {
    if (!isPlainObject(item) || typeof item.id !== "string") continue;
    const subjectMissing = typeof item.subjectId !== "string" || !targetSubjectIds.has(item.subjectId);
    if (subjectMissing) {
      const key = groupKey("items", item.id, "subjectId");
      if (!seen.has(key)) {
        seen.add(key);
        propose("items", item, "subjectId", item.subjectId, key);
      }
    }
  }
  for (const item of rawArrays(raw).items) {
    if (!isPlainObject(item) || typeof item.id !== "string") continue;
    if (item.parentId === undefined || item.parentId === null) continue;
    if (!targetItems.has(item.parentId)) {
      const key = groupKey("items", item.id, "parentId");
      if (!seen.has(key)) {
        seen.add(key);
        propose("items", item, "parentId", item.parentId, key);
      }
    }
  }

  // Coherent nested remap: when a planned subject reference moves, descendants
  // of the same orphan branch follow it and keep their parent/child link.
  const byParent = new Map();
  for (const item of rawArrays(raw).items) {
    if (!isPlainObject(item) || typeof item.id !== "string") continue;
    if (item.parentId === undefined || item.parentId === null) continue;
    if (!byParent.has(item.parentId)) byParent.set(item.parentId, []);
    byParent.get(item.parentId).push(item);
  }
  const propagate = (parent, newSubject, visited) => {
    for (const child of byParent.get(parent.id) || []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      if (child.subjectId !== newSubject) {
        const key = groupKey("items", child.id, "subjectId");
        if (!seen.has(key)) {
          seen.add(key);
          changes.push({ store: "items", id: child.id, field: "subjectId", from: child.subjectId, to: newSubject, consented: true });
          plannedItems.set(child.id, { from: child.subjectId, to: newSubject });
        }
      }
      propagate(child, newSubject, visited);
    }
  };
  for (const item of rawArrays(raw).items) {
    if (!isPlainObject(item) || !plannedItems.has(item.id)) continue;
    propagate(item, plannedItems.get(item.id).to, new Set([item.id]));
  }

  changes.sort((left, right) => (left.store + ":" + left.id + ":" + left.field)
    .localeCompare(right.store + ":" + right.id + ":" + right.field));
  const ambiguous = groups.filter((group) => group.status === "ambiguous");
  const blocked = groups.filter((group) => group.status === "blocked");
  const before = {
    subjects: inventory.counts.subjects,
    items: inventory.counts.items,
    danglingSubjects: (inventory.codes[ANOMALY.DANGLING_SUBJECT] || 0) +
      (inventory.codes[ANOMALY.INVISIBLE_OR_UNAUTHORIZED] || 0),
    danglingParents: inventory.codes[ANOMALY.DANGLING_PARENT] || 0
  };
  const after = {
    ...before,
    danglingSubjects: Math.max(0, before.danglingSubjects - changes.filter((change) => change.field === "subjectId").length),
    danglingParents: Math.max(0, before.danglingParents - changes.filter((change) => change.field === "parentId").length)
  };
  const subjectMapping = {};
  const itemMapping = {};
  for (const change of changes) {
    if (change.store === "items" && change.field === "subjectId") itemMapping[change.id] = change.to;
    if (change.store === "subjects" && change.field === "id") subjectMapping[change.from] = change.to;
  }
  const planBody = {
    version: 1,
    target: sha256Hex(canonical(raw)),
    source: input.sourceRecords
      ? sha256Hex(canonical(canonicalBackupRecords(input.sourceRecords)))
      : input.source ? sha256Hex(canonical(input.source)) : null,
    provenance: normalizeProvenance(provenance),
    decisions: clone(decisions),
    interpretations: isAmbiguousProvenance(provenance)
      ? describeProvenanceInterpretations(input.source)
      : [],
    destination,
    destinationFingerprint: computeDestinationIdentityFingerprint(destination),
    mappingVersion: PROVENANCE_MAPPING_VERSION,
    idVariant: isAmbiguousProvenance(provenance) ? EXPORT_KIND.UNKNOWN : provenance.exportKind,
    subjectMapping,
    itemMapping,
    changes,
    groups,
    ambiguous,
    blocked,
    preservedFields: {
      subjects: SUBJECT_FIELDS.slice(),
      items: ITEM_FIELDS.slice()
    },
    counts: { before, after }
  };
  return {
    ...planBody,
    fingerprint: sha256Hex(canonical(planBody)),
    operations: changes.map((change) => ({ ...change })),
    writable: ambiguous.length === 0 && changes.length > 0 &&
      changes.every((change) => change.consented === true),
    blockedGroups: blocked,
    ambiguousGroups: ambiguous
  };
}

function consentDestination(consent) {
  return consent && typeof consent.destinationFingerprint === "string"
    ? consent.destinationFingerprint
    : null;
}

function validChange(change) {
  return isPlainObject(change) &&
    (change.store === "items" || change.store === "subjects") &&
    typeof change.id === "string" &&
    (change.field === "subjectId" || change.field === "parentId") &&
    typeof change.to === "string";
}

// Commits only planned reference updates through one adapter call. A missing or
// invalid backup, stale consent, changed destination, late collision or failed
// transaction writes nothing.
export async function runRepair(adapter, plan, consent, revalidate) {
  if (!adapter || typeof adapter.commitRepairs !== "function") {
    return { status: REPAIR_OUTCOME.INVALID_PLAN, code: "invalid-adapter", operations: [] };
  }
  if (!plan || !Array.isArray(plan.changes) || typeof plan.fingerprint !== "string" ||
      !plan.changes.every(validChange)) {
    return { status: REPAIR_OUTCOME.INVALID_PLAN, code: "invalid-plan", operations: [] };
  }
  if (!isPlainObject(consent) || consent.confirmed !== true) {
    return { status: REPAIR_OUTCOME.REJECTED, code: "consent-required", operations: [] };
  }
  if (consent.fingerprint !== plan.fingerprint) {
    return { status: REPAIR_OUTCOME.REJECTED, code: "consent-mismatch", operations: [] };
  }
  const expectedDestination = consentDestination(consent);
  if (!expectedDestination || expectedDestination !== plan.destinationFingerprint) {
    return { status: REPAIR_OUTCOME.DESTINATION_CHANGED, code: "destination-changed", operations: [] };
  }
  const backupCheck = verifyRecoverySnapshot(consent.backup, consent.backupExpected || {
    counts: { subjects: plan.counts.before.subjects, items: plan.counts.before.items }
  });
  if (!backupCheck.valid) {
    return { status: REPAIR_OUTCOME.BACKUP_INVALID, code: backupCheck.code, operations: [] };
  }
  if (plan.ambiguousGroups && plan.ambiguousGroups.length > 0) {
    return { status: REPAIR_OUTCOME.AMBIGUOUS, code: "ambiguous-groups", operations: [] };
  }
  if (plan.writable === false || !plan.changes.every((change) => change.consented === true)) {
    return { status: REPAIR_OUTCOME.REJECTED, code: "consent-required", operations: [] };
  }
  if (typeof revalidate !== "function") {
    return { status: REPAIR_OUTCOME.STALE_PLAN, code: "stale-plan", operations: [] };
  }
  let fresh;
  try {
    fresh = await revalidate();
  } catch (error) {
    return { status: REPAIR_OUTCOME.STALE_PLAN, code: "stale-plan", error, operations: [] };
  }
  const freshDestination = destinationIdentity(fresh && fresh.destination);
  if (computeDestinationIdentityFingerprint(freshDestination) !== plan.destinationFingerprint) {
    return { status: REPAIR_OUTCOME.DESTINATION_CHANGED, code: "destination-changed", operations: [] };
  }
  const freshPlan = buildRepairPlan({
    raw: fresh && fresh.raw,
    source: fresh && fresh.source,
    provenance: fresh && fresh.provenance !== undefined ? fresh.provenance : plan.provenance,
    decisions: fresh && fresh.decisions !== undefined ? fresh.decisions : plan.decisions,
    destination: freshDestination,
    context: fresh && fresh.context
  });
  if (freshPlan.changes.length === 0 && freshPlan.ambiguousGroups.length === 0) {
    return { status: REPAIR_OUTCOME.ALREADY_REPAIRED, code: "already-repaired", operations: [] };
  }
  if (freshPlan.fingerprint !== plan.fingerprint) {
    return { status: REPAIR_OUTCOME.STALE_PLAN, code: "stale-plan", operations: [] };
  }
  if (plan.changes.length === 0) {
    return { status: REPAIR_OUTCOME.ALREADY_REPAIRED, code: "already-repaired", operations: [] };
  }
  try {
    const confirmation = await adapter.commitRepairs(plan.changes.map((change) => ({ ...change })));
    return {
      status: REPAIR_OUTCOME.REPAIRED,
      code: "repaired",
      operations: plan.changes.map((change) => ({ ...change })),
      confirmation
    };
  } catch (error) {
    const code = error && error.code === "collision" ? REPAIR_OUTCOME.COLLISION : REPAIR_OUTCOME.TRANSACTION_ERROR;
    return { status: code, code, error, operations: [] };
  }
}

export const REPAIR_STATE = Object.freeze({
  IDLE: "idle",
  LOCAL_WRITTEN: "local-written",
  SYNC_PENDING: "sync-pending",
  OFFLINE_PENDING: "offline-pending",
  CONVERGED_ON_THIS_DEVICE: "converged-on-this-device",
  SYNC_ERROR: "sync-error",
  INDETERMINATE: "indeterminate"
});

export function initialRepairStatus() {
  return {
    status: REPAIR_STATE.IDLE,
    localWritten: false,
    nativePullObserved: false,
    businessReadFresh: false,
    crossDeviceConverged: false,
    sync: "idle"
  };
}

// Truthful repair convergence: a local commit or a generic `in-sync` signal is
// never convergence. Only a proven native pull plus a fresh successful business
// read that contains the repaired records may report local convergence.
export function reduceRepairConvergence(current, event = {}) {
  const state = current || initialRepairStatus();
  switch (event.type) {
    case "local-committed":
      return {
        ...state,
        status: event.online === false ? REPAIR_STATE.OFFLINE_PENDING : REPAIR_STATE.SYNC_PENDING,
        localWritten: true,
        sync: event.online === false ? "offline-pending" : "pending",
        crossDeviceConverged: false
      };
    case "in-sync":
      if (!state.localWritten) return { ...state, sync: "in-sync", status: REPAIR_STATE.INDETERMINATE };
      return {
        ...state,
        status: state.businessReadFresh ? REPAIR_STATE.CONVERGED_ON_THIS_DEVICE : REPAIR_STATE.SYNC_PENDING,
        sync: "in-sync"
      };
    case "native-pull":
      return { ...state, nativePullObserved: true, sync: "native-pull" };
    case "business-read":
      if (state.localWritten && state.nativePullObserved &&
          event.containsRepaired === true && event.fresh !== false) {
        return {
          ...state,
          status: REPAIR_STATE.CONVERGED_ON_THIS_DEVICE,
          businessReadFresh: true,
          crossDeviceConverged: false
        };
      }
      return { ...state, businessReadFresh: false };
    case "sync-error":
      return {
        ...state,
        status: REPAIR_STATE.SYNC_ERROR,
        sync: "error",
        localWritten: state.localWritten,
        crossDeviceConverged: false
      };
    case "indeterminate":
      return { ...state, status: REPAIR_STATE.INDETERMINATE, crossDeviceConverged: false };
    default:
      return state;
  }
}

const EVENT_FIELDS = Object.freeze([
  "code", "store", "count", "subjects", "items", "status", "reason"
]);

// Traceable outcome events: only codes and counts, never business content.
export function repairEvent(code, details = {}) {
  const event = { code: typeof code === "string" ? code : "indeterminate" };
  for (const field of EVENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(details, field)) continue;
    const value = details[field];
    if (typeof value === "number" || typeof value === "string") event[field] = value;
  }
  return event;
}

export function repairEventIsRedacted(event) {
  return Object.keys(event || {}).every((key) => EVENT_FIELDS.includes(key));
}
