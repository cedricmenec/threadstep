// Pure reconciliation core for importing a historical V1 document or a JSON
// backup into an already-authenticated Dexie Cloud base. No DOM, network,
// IndexedDB or framework access: every browser concern is injected through the
// adapters used by `site/app.js`.
import { documentToRecords, SUBJECTS_STORE, ITEMS_STORE, emptyRecords } from "./persistence.js";
import { mapRecords, unmapLegacyId } from "./migration.js";
import { sha256Hex } from "./fingerprint.js";

export { sha256Hex };

export const CATEGORY = Object.freeze({
  IDENTICAL: "identical",
  ABSENT: "absent-in-cloud",
  CONFLICT: "conflict",
  CLOUD_ONLY: "cloud-only",
  INVALID: "invalid"
});

export const RESOLUTION = Object.freeze({
  KEEP_CLOUD: "keep-cloud",
  IMPORT_COPY: "import-copy"
});

export const RECONCILIATION_STATUS = Object.freeze({
  IDLE: "idle",
  LOCAL_WRITTEN: "local-written",
  SYNC_PENDING: "sync-pending",
  SYNCED: "synced",
  SYNC_ERROR: "sync-error",
  OFFLINE_PENDING: "offline-pending",
  ERROR: "error"
});

export const QUOTAS = Object.freeze({ subjects: 40, itemsPerSubject: 500 });

export const STORE_FIELDS = Object.freeze({
  [SUBJECTS_STORE]: Object.freeze(["title", "order"]),
  [ITEMS_STORE]: Object.freeze(["subjectId", "parentId", "title", "note", "priority", "done", "order"])
});

const HEALTHY_SYNC_PHASE = "in-sync";
const HEALTHY_SYNC_STATUSES = new Set(["connected"]);
const COPY_PREFIX = "copy:";

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeOrder(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function copyNote(record) {
  if (!hasOwn(record, "note")) return {};
  const note = record.note;
  if (note === null || note === undefined) return {};
  return { note };
}

// Business projection: an allowlist of user-owned fields. Native Cloud
// metadata (`owner`, `realmId`, `$ts`, sync flags, extensions) is never read.
export function projectBusinessRecord(store, record) {
  const source = isPlainObject(record) ? record : {};
  if (store === SUBJECTS_STORE) {
    return {
      id: source.id,
      title: typeof source.title === "string" ? source.title : source.title,
      order: normalizeOrder(source.order, 0)
    };
  }
  return {
    id: source.id,
    subjectId: source.subjectId === undefined ? null : source.subjectId,
    parentId: source.parentId === undefined || source.parentId === null ? null : source.parentId,
    title: source.title,
    ...copyNote(source),
    priority: source.priority,
    done: source.done === true,
    order: normalizeOrder(source.order, 0)
  };
}

export function canonicalJson(value) {
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

export function businessRecordsEqual(store, left, right) {
  return canonicalJson(projectBusinessRecord(store, left)) ===
    canonicalJson(projectBusinessRecord(store, right));
}

export function compareBusinessRecords(store, sourceRecord, targetRecord, options = {}) {
  const source = projectBusinessRecord(store, sourceRecord);
  const target = projectBusinessRecord(store, targetRecord);
  const includeOrder = options.includeOrder !== false;
  const fields = STORE_FIELDS[store].filter((field) => {
    if (field === "order" && !includeOrder) return false;
    if (hasOwn(source, field) !== hasOwn(target, field)) return true;
    return canonicalJson(source[field]) !== canonicalJson(target[field]);
  });
  return { identical: fields.length === 0, fields };
}

function normalizeDestination(destination) {
  if (typeof destination === "string") {
    return { url: destination, remoteDbId: null };
  }
  if (!isPlainObject(destination)) return { url: null, remoteDbId: null };
  return {
    url: typeof destination.url === "string" ? destination.url : null,
    remoteDbId: typeof destination.remoteDbId === "string" ? destination.remoteDbId : null
  };
}

function normalizedResolutions(resolutions) {
  const source = isPlainObject(resolutions) ? resolutions : {};
  const result = {};
  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    if (value === RESOLUTION.KEEP_CLOUD || value === RESOLUTION.IMPORT_COPY) {
      result[key] = value;
    }
  }
  return result;
}

function normalizedTargetProjection(target) {
  const source = isPlainObject(target) ? target : emptyRecords();
  const subjects = (Array.isArray(source.subjects) ? source.subjects : [])
    .map((record) => projectBusinessRecord(SUBJECTS_STORE, record))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const items = (Array.isArray(source.items) ? source.items : [])
    .map((record) => projectBusinessRecord(ITEMS_STORE, record))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return { subjects, items };
}

export function computeSourceFingerprint(document) {
  return sha256Hex(canonicalJson(document));
}

export function computeDestinationFingerprint(destination) {
  return sha256Hex(canonicalJson(normalizeDestination(destination)));
}

export function computeUserFingerprint(userId) {
  return sha256Hex(canonicalJson({ userId: userId === undefined ? null : userId }));
}

export function computeTargetFingerprint(target) {
  return sha256Hex(canonicalJson(normalizedTargetProjection(target)));
}

export function computePlanFingerprint(input = {}) {
  const fingerprints = {
    source: computeSourceFingerprint(input.document),
    destination: computeDestinationFingerprint(input.destination),
    user: computeUserFingerprint(input.userId),
    target: computeTargetFingerprint(input.target)
  };
  const plan = sha256Hex(canonicalJson({
    version: 1,
    source: fingerprints.source,
    destination: fingerprints.destination,
    user: fingerprints.user,
    target: fingerprints.target,
    resolutions: normalizedResolutions(input.resolutions)
  }));
  return { ...fingerprints, plan };
}

// Attested initial synchronization: a narrow, conservative predicate. Every
// missing, ambiguous or unhealthy signal fails closed with a typed reason.
export function evaluateSyncAttestation(input = {}) {
  const online = input.online !== false;
  const user = isPlainObject(input.user) ? input.user : null;
  const syncState = isPlainObject(input.syncState) ? input.syncState : null;
  const persisted = isPlainObject(input.persistedSyncState) ? input.persistedSyncState : null;
  const databaseUrl = typeof input.databaseUrl === "string" ? input.databaseUrl : null;
  const identity = {
    userId: user && typeof user.userId === "string" ? user.userId : null,
    databaseUrl,
    remoteDbId: persisted && typeof persisted.remoteDbId === "string" ? persisted.remoteDbId : null
  };
  const reject = (reason) => ({ attested: false, reason, identity });
  if (!online) return reject("offline");
  if (!user || user.isLoggedIn !== true || !identity.userId) return reject("unauthenticated");
  if (!databaseUrl) return reject("destination-missing");
  if (!syncState) return reject("indeterminate");
  if (syncState.status === "error" || syncState.phase === "error") return reject("sync-error");
  if (syncState.status === "offline" || syncState.phase === "offline") return reject("sync-offline");
  if (!HEALTHY_SYNC_STATUSES.has(syncState.status)) return reject("sync-offline");
  if (syncState.phase !== HEALTHY_SYNC_PHASE) return reject("initial-sync-pending");
  if (!persisted) return reject("indeterminate");
  if (persisted.initiallySynced !== true) return reject("initial-sync-pending");
  if (!identity.remoteDbId) return reject("indeterminate");
  if (persisted.serverRevision === undefined || persisted.serverRevision === null) {
    return reject("indeterminate");
  }
  const realms = persisted.realms;
  let realmMatches = false;
  if (Array.isArray(realms)) realmMatches = realms.includes(identity.userId);
  else if (isPlainObject(realms)) realmMatches = hasOwn(realms, identity.userId);
  if (!Array.isArray(realms) && !isPlainObject(realms)) return reject("indeterminate");
  if (!realmMatches) return reject("session-mismatch");
  if (typeof persisted.databaseUrl === "string" && persisted.databaseUrl !== databaseUrl) {
    return reject("session-mismatch");
  }
  if (typeof input.remoteDbId === "string" && input.remoteDbId !== identity.remoteDbId) {
    return reject("session-mismatch");
  }
  return { attested: true, reason: null, identity };
}

export function describeAttestationReason(reason) {
  switch (reason) {
    case "offline":
      return "Hors ligne : la migration est bloquée tant que Dexie Cloud n'est pas joignable. Vos données locales sont intactes.";
    case "unauthenticated":
      return "Session Dexie Cloud absente ou refusée : aucune migration n'est proposée.";
    case "destination-missing":
      return "Aucune destination Dexie Cloud valide n'est configurée : aucune migration n'est proposée.";
    case "sync-error":
      return "Dexie Cloud signale une erreur de synchronisation : les écritures de migration sont bloquées.";
    case "sync-offline":
      return "Dexie Cloud n'est pas connecté : la migration est bloquée sans conclure que le Cloud est vide.";
    case "initial-sync-pending":
      return "La synchronisation initiale avec le Cloud n'est pas encore attestée : attendez la fin de la synchronisation avant de migrer.";
    case "session-mismatch":
      return "La session ou l'instance Cloud ne correspond pas à la base persistée : aucune migration n'est proposée.";
    case "indeterminate":
    default:
      return "L'état distant n'est pas déterminable : la migration est bloquée et le Cloud n'est pas considéré comme vide.";
  }
}

// Reads the target only after the attestation succeeds. A failed read is a
// distinct status and never becomes an empty target.
export async function withAttestedTarget(attestationInput, readTarget) {
  const attestation = evaluateSyncAttestation(attestationInput);
  if (!attestation.attested) {
    return { status: "blocked", attestation, records: null, error: null };
  }
  if (typeof readTarget !== "function") {
    return { status: "blocked", attestation, records: null, error: null, reason: "read-error" };
  }
  try {
    const records = await readTarget();
    return { status: "ready", attestation, records, error: null };
  } catch (error) {
    return { status: "read-error", attestation, records: null, error };
  }
}

export function mapSourceDocument(document, options = {}) {
  return mapRecords(documentToRecords(document), options);
}

function invalidKey(store, id) {
  return store + ":" + id;
}

function validateTargetRecords(raw) {
  const records = emptyRecords();
  const invalid = new Set();
  const issues = [];
  if (!isPlainObject(raw) || !Array.isArray(raw.subjects) || !Array.isArray(raw.items)) {
    issues.push({ code: "malformed-target" });
    return { records, invalid, issues, valid: false };
  }
  const subjectIds = new Set();
  raw.subjects.forEach((record, index) => {
    const id = record && record.id;
    if (typeof id !== "string" || id.length === 0 || typeof record.title !== "string") {
      invalid.add(invalidKey(SUBJECTS_STORE, typeof id === "string" ? id : "?" + index));
      issues.push({ code: "malformed-target-record", store: SUBJECTS_STORE, index });
      return;
    }
    if (subjectIds.has(id)) {
      invalid.add(invalidKey(SUBJECTS_STORE, id));
      issues.push({ code: "duplicate-target-id", store: SUBJECTS_STORE, id });
      return;
    }
    subjectIds.add(id);
    records.subjects.push({ ...record });
  });
  const itemIds = new Set();
  raw.items.forEach((record, index) => {
    const id = record && record.id;
    if (typeof id !== "string" || id.length === 0 || typeof record.title !== "string") {
      invalid.add(invalidKey(ITEMS_STORE, typeof id === "string" ? id : "?" + index));
      issues.push({ code: "malformed-target-record", store: ITEMS_STORE, index });
      return;
    }
    if (itemIds.has(id)) {
      invalid.add(invalidKey(ITEMS_STORE, id));
      issues.push({ code: "duplicate-target-id", store: ITEMS_STORE, id });
      return;
    }
    itemIds.add(id);
    records.items.push({ ...record });
  });
  const itemById = new Map(records.items.map((record) => [record.id, record]));
  for (const record of records.items) {
    const danglingSubject = typeof record.subjectId !== "string" || !subjectIds.has(record.subjectId);
    if (danglingSubject) {
      invalid.add(invalidKey(ITEMS_STORE, record.id));
      issues.push({ code: "dangling-subject", store: ITEMS_STORE, id: record.id });
      continue;
    }
    if (record.parentId === undefined || record.parentId === null) continue;
    const parent = itemById.get(record.parentId);
    if (!parent || parent.subjectId !== record.subjectId || parent.id === record.id ||
        (parent.parentId !== undefined && parent.parentId !== null)) {
      invalid.add(invalidKey(ITEMS_STORE, record.id));
      issues.push({ code: "dangling-parent", store: ITEMS_STORE, id: record.id });
    }
  }
  return { records, invalid, issues, valid: true };
}

function validateSourceRecords(records) {
  const invalid = new Set();
  const issues = [];
  const subjectIds = new Set();
  for (const record of records.subjects) {
    if (subjectIds.has(record.id)) {
      invalid.add(invalidKey(SUBJECTS_STORE, record.id));
      issues.push({ code: "duplicate-source-id", store: SUBJECTS_STORE, id: record.id });
    }
    subjectIds.add(record.id);
  }
  const itemIds = new Set();
  for (const record of records.items) {
    if (itemIds.has(record.id)) {
      invalid.add(invalidKey(ITEMS_STORE, record.id));
      issues.push({ code: "duplicate-source-id", store: ITEMS_STORE, id: record.id });
    }
    itemIds.add(record.id);
  }
  const itemById = new Map(records.items.map((record) => [record.id, record]));
  for (const record of records.items) {
    if (!subjectIds.has(record.subjectId)) {
      invalid.add(invalidKey(ITEMS_STORE, record.id));
      issues.push({ code: "dangling-source-subject", store: ITEMS_STORE, id: record.id });
      continue;
    }
    if (record.parentId === undefined || record.parentId === null) continue;
    const parent = itemById.get(record.parentId);
    if (!parent || parent.subjectId !== record.subjectId || parent.id === record.id ||
        (parent.parentId !== undefined && parent.parentId !== null)) {
      invalid.add(invalidKey(ITEMS_STORE, record.id));
      issues.push({ code: "dangling-source-parent", store: ITEMS_STORE, id: record.id });
    }
  }
  return { invalid, issues };
}

function relativeOrderDiscrepancies(sourceIds, targetOrderedIds) {
  const expected = sourceIds.filter((id) => targetOrderedIds.includes(id));
  if (expected.length !== targetOrderedIds.length) {
    // A record disappeared; its own classification covers the change.
    return new Set();
  }
  const discrepant = new Set();
  expected.forEach((id, index) => {
    if (targetOrderedIds[index] !== id) discrepant.add(id);
  });
  return discrepant;
}

function inventoryEntry(store, record, category, fields = [], extra = {}) {
  return {
    store,
    id: record.id,
    title: record.title,
    category,
    fields: fields.slice().sort(),
    ...extra
  };
}

function buildInventoryFrom(sourceRecords, sourceInvalid, targetValidation) {
  const entries = { [SUBJECTS_STORE]: [], [ITEMS_STORE]: [] };
  const index = { [SUBJECTS_STORE]: new Map(), [ITEMS_STORE]: new Map() };
  const targetSubjects = new Map(targetValidation.records.subjects.map((record) => [record.id, record]));
  const targetItems = new Map(targetValidation.records.items.map((record) => [record.id, record]));

  const sourceSubjectIds = sourceRecords.subjects.map((record) => record.id);
  const sourceItemIds = sourceRecords.items.map((record) => record.id);
  const targetSubjectOrder = targetValidation.records.subjects
    .filter((record) => sourceSubjectIds.includes(record.id))
    .slice()
    .sort((left, right) => normalizeOrder(left.order, 0) - normalizeOrder(right.order, 0) ||
      String(left.id).localeCompare(String(right.id)))
    .map((record) => record.id);
  const subjectOrderIssues = relativeOrderDiscrepancies(sourceSubjectIds, targetSubjectOrder);

  const sourceItemsBySubject = new Map();
  for (const record of sourceRecords.items) {
    if (!sourceItemsBySubject.has(record.subjectId)) sourceItemsBySubject.set(record.subjectId, []);
    sourceItemsBySubject.get(record.subjectId).push(record);
  }
  const itemOrderIssues = new Map();
  for (const [subjectId, items] of sourceItemsBySubject) {
    const orderedSource = items.map((record) => record.id);
    const orderedTarget = targetValidation.records.items
      .filter((record) => record.subjectId === subjectId && orderedSource.includes(record.id))
      .slice()
      .sort((left, right) => normalizeOrder(left.order, 0) - normalizeOrder(right.order, 0) ||
        String(left.id).localeCompare(String(right.id)))
      .map((record) => record.id);
    itemOrderIssues.set(subjectId, relativeOrderDiscrepancies(orderedSource, orderedTarget));
  }

  const add = (store, record, category, fields = []) => {
    const entry = inventoryEntry(store, record, category, fields);
    entries[store].push(entry);
    index[store].set(record.id, entry);
    return entry;
  };

  for (const source of sourceRecords.subjects) {
    const key = invalidKey(SUBJECTS_STORE, source.id);
    if (sourceInvalid.has(key)) {
      add(SUBJECTS_STORE, source, CATEGORY.INVALID, [], { reason: "invalid-source" });
      continue;
    }
    const target = targetSubjects.get(source.id);
    if (!target) {
      add(SUBJECTS_STORE, source, CATEGORY.ABSENT);
      continue;
    }
    if (targetValidation.invalid.has(invalidKey(SUBJECTS_STORE, source.id))) {
      add(SUBJECTS_STORE, source, CATEGORY.INVALID, [], { reason: "invalid-target" });
      continue;
    }
    const comparison = compareBusinessRecords(SUBJECTS_STORE, source, target, { includeOrder: false });
    const fields = comparison.fields.slice();
    if (subjectOrderIssues.has(source.id) && !fields.includes("order")) fields.push("order");
    add(SUBJECTS_STORE, source, fields.length ? CATEGORY.CONFLICT : CATEGORY.IDENTICAL, fields);
  }

  for (const source of sourceRecords.items) {
    const key = invalidKey(ITEMS_STORE, source.id);
    if (sourceInvalid.has(key)) {
      add(ITEMS_STORE, source, CATEGORY.INVALID, [], { reason: "invalid-source" });
      continue;
    }
    const target = targetItems.get(source.id);
    if (!target) {
      add(ITEMS_STORE, source, CATEGORY.ABSENT);
      continue;
    }
    if (targetValidation.invalid.has(invalidKey(ITEMS_STORE, source.id))) {
      add(ITEMS_STORE, source, CATEGORY.INVALID, [], { reason: "invalid-target" });
      continue;
    }
    const comparison = compareBusinessRecords(ITEMS_STORE, source, target, { includeOrder: false });
    const fields = comparison.fields.slice();
    const orderIssues = itemOrderIssues.get(source.subjectId) || new Set();
    if (orderIssues.has(source.id) && !fields.includes("order")) fields.push("order");
    add(ITEMS_STORE, source, fields.length ? CATEGORY.CONFLICT : CATEGORY.IDENTICAL, fields);
  }

  const sourceSubjectSet = new Set(sourceSubjectIds);
  const sourceItemSet = new Set(sourceItemIds);
  for (const record of targetValidation.records.subjects) {
    if (sourceSubjectSet.has(record.id)) continue;
    const category = targetValidation.invalid.has(invalidKey(SUBJECTS_STORE, record.id))
      ? CATEGORY.INVALID : CATEGORY.CLOUD_ONLY;
    add(SUBJECTS_STORE, record, category);
  }
  for (const record of targetValidation.records.items) {
    if (sourceItemSet.has(record.id)) continue;
    const category = targetValidation.invalid.has(invalidKey(ITEMS_STORE, record.id))
      ? CATEGORY.INVALID : CATEGORY.CLOUD_ONLY;
    add(ITEMS_STORE, record, category);
  }

  const counts = {
    [SUBJECTS_STORE]: countCategories(entries[SUBJECTS_STORE]),
    [ITEMS_STORE]: countCategories(entries[ITEMS_STORE])
  };
  return { entries, index, counts, sourceInvalid: sourceInvalid, targetIssues: targetValidation.issues };
}

function countCategories(entries) {
  const counts = {
    [CATEGORY.IDENTICAL]: 0,
    [CATEGORY.ABSENT]: 0,
    [CATEGORY.CONFLICT]: 0,
    [CATEGORY.CLOUD_ONLY]: 0,
    [CATEGORY.INVALID]: 0
  };
  for (const entry of entries) counts[entry.category] += 1;
  return counts;
}

// Pure inventory of a mapped source against a raw target. Also used directly by
// tests and by the plan builder.
export function buildInventory(sourceRecords, targetRecords) {
  const source = isPlainObject(sourceRecords) ? sourceRecords : emptyRecords();
  const sourceValidation = validateSourceRecords(source);
  const targetValidation = validateTargetRecords(targetRecords);
  return buildInventoryFrom(source, sourceValidation.invalid, targetValidation);
}

function topologicallyOrderedItems(items) {
  const byId = new Map(items.map((record) => [record.id, record]));
  const result = [];
  const seen = new Set();
  const visiting = new Set();
  const visit = (record) => {
    if (!record || seen.has(record.id)) return;
    if (visiting.has(record.id)) return;
    visiting.add(record.id);
    if (record.parentId !== undefined && record.parentId !== null) {
      visit(byId.get(record.parentId));
    }
    visiting.delete(record.id);
    seen.add(record.id);
    result.push(record);
  };
  for (const record of items) visit(record);
  return result;
}

function descendantsByParent(items) {
  const map = new Map();
  for (const record of items) {
    if (record.parentId === undefined || record.parentId === null) continue;
    if (!map.has(record.parentId)) map.set(record.parentId, []);
    map.get(record.parentId).push(record);
  }
  return map;
}

function collectSubtree(item, children, order) {
  const result = [];
  const visit = (record) => {
    result.push(record);
    for (const child of children.get(record.id) || []) visit(child);
  };
  visit(item);
  const position = new Map(order.map((record, index) => [record.id, index]));
  return result.sort((left, right) => (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0));
}

function createOrderPlacer(sourceIds, targetOrders) {
  const orderById = new Map(targetOrders);
  const maximum = () => {
    let value = -1;
    for (const order of orderById.values()) {
      if (typeof order === "number" && Number.isFinite(order) && order > value) value = order;
    }
    return value;
  };
  return {
    remember(id, order) {
      orderById.set(id, order);
      return order;
    },
    place(id) {
      if (orderById.has(id)) return orderById.get(id);
      const index = sourceIds.indexOf(id);
      let previous = null;
      let next = null;
      if (index >= 0) {
        for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
          if (orderById.has(sourceIds[cursor])) {
            previous = orderById.get(sourceIds[cursor]);
            break;
          }
        }
        for (let cursor = index + 1; cursor < sourceIds.length; cursor += 1) {
          if (orderById.has(sourceIds[cursor])) {
            next = orderById.get(sourceIds[cursor]);
            break;
          }
        }
      }
      let order;
      if (previous !== null && next !== null) order = (previous + next) / 2;
      else if (previous !== null) order = previous + 1;
      else if (next !== null) order = next > 0 ? next - 1 : next - 0.5;
      else order = maximum() + 1;
      orderById.set(id, order);
      return order;
    }
  };
}

function buildRecord(store, source, id, subjectId, parentId, order) {
  if (store === SUBJECTS_STORE) {
    return { id, title: source.title, order };
  }
  const record = {
    id,
    subjectId,
    parentId,
    title: source.title,
    priority: source.priority,
    done: source.done === true,
    order
  };
  if (hasOwn(source, "note")) record.note = source.note;
  return record;
}

function resolutionFor(resolutions, store, id) {
  const value = resolutions[store + ":" + id];
  return value === RESOLUTION.KEEP_CLOUD || value === RESOLUTION.IMPORT_COPY ? value : null;
}

function copyIdFor(store, legacyId, sourceFingerprint, destinationFingerprint) {
  const digest = sha256Hex(canonicalJson({
    version: 1,
    store,
    legacyId,
    sourceFingerprint,
    destinationFingerprint
  }));
  return COPY_PREFIX + digest;
}

function rejectedPlan(base, status, extra = {}) {
  return { ...base, status, operations: [], blocked: [], ...extra };
}

// Builds one deterministic, side-effect-free reconciliation plan.
export function planReconciliation(input = {}) {
  const document = input.document;
  const destination = normalizeDestination(input.destination);
  const userId = typeof input.userId === "string" ? input.userId : null;
  const resolutions = normalizedResolutions(input.resolutions);
  const fingerprints = computePlanFingerprint({ document, target: input.target, destination, userId, resolutions });
  const sourceRecords = mapSourceDocument(document);
  const sourceValidation = validateSourceRecords(sourceRecords);
  const targetValidation = validateTargetRecords(input.target);
  const inventory = buildInventoryFrom(sourceRecords, sourceValidation.invalid, targetValidation);
  const base = {
    destination,
    userId,
    resolutions,
    inventory,
    fingerprints,
    fingerprint: fingerprints.plan,
    operations: [],
    blocked: [],
    indeterminate: false,
    sourceIssues: sourceValidation.issues,
    targetIssues: targetValidation.issues
  };
  if (sourceValidation.issues.length > 0 || targetValidation.issues.length > 0 ||
      inventory.counts[SUBJECTS_STORE][CATEGORY.INVALID] > 0 ||
      inventory.counts[ITEMS_STORE][CATEGORY.INVALID] > 0) {
    base.indeterminate = true;
  }
  if (!isPlainObject(document) || !Array.isArray(document.subjects) || sourceRecords.subjects.length === 0) {
    return rejectedPlan(base, "empty-source", { indeterminate: false });
  }

  const operations = [];
  const blocked = [];
  const blockedItems = new Set();
  const plannedItems = new Set();
  const copiedItems = new Map();
  const subjectIds = sourceRecords.subjects.map((record) => record.id);
  const subjectTargets = new Map(targetValidation.records.subjects.map((record) => [record.id, record]));
  const itemTargets = new Map(targetValidation.records.items.map((record) => [record.id, record]));
  const sourceItemsBySubject = new Map();
  for (const record of sourceRecords.items) {
    if (!sourceItemsBySubject.has(record.subjectId)) sourceItemsBySubject.set(record.subjectId, []);
    sourceItemsBySubject.get(record.subjectId).push(record);
  }
  const itemOrderBySubject = new Map();
  for (const [subjectId] of sourceItemsBySubject) {
    itemOrderBySubject.set(subjectId, targetValidation.records.items
      .filter((record) => record.subjectId === subjectId)
      .map((record) => [record.id, normalizeOrder(record.order, 0)]));
  }
  const subjectPlacer = createOrderPlacer(subjectIds, targetValidation.records.subjects
    .map((record) => [record.id, normalizeOrder(record.order, 0)]));
  const itemPlacers = new Map();
  const itemCounts = new Map();
  for (const record of targetValidation.records.items) {
    itemCounts.set(record.subjectId, (itemCounts.get(record.subjectId) || 0) + 1);
  }
  let projectedSubjectCount = targetValidation.records.subjects.length;

  const itemPlacer = (subjectId) => {
    if (!itemPlacers.has(subjectId)) {
      const sources = (sourceItemsBySubject.get(subjectId) || []).map((record) => record.id);
      itemPlacers.set(subjectId, createOrderPlacer(sources, itemOrderBySubject.get(subjectId) || []));
    }
    return itemPlacers.get(subjectId);
  };

  const block = (store, id, reason, title) => {
    blocked.push({ store, id, reason, title });
  };

  const blockItemBranch = (item, reason) => {
    if (blockedItems.has(item.id)) return;
    blockedItems.add(item.id);
    block(ITEMS_STORE, item.id, reason, item.title);
    const children = descendantsByParent(sourceItemsBySubject.get(item.subjectId) || []);
    for (const descendant of collectSubtree(item, children, sourceItemsBySubject.get(item.subjectId) || [])) {
      if (descendant.id === item.id || blockedItems.has(descendant.id)) continue;
      blockedItems.add(descendant.id);
      block(ITEMS_STORE, descendant.id, "parent-blocked", descendant.title);
    }
  };

  const effectiveItemId = (sourceId) => {
    if (copiedItems.has(sourceId)) return copiedItems.get(sourceId);
    if (itemTargets.has(sourceId)) return sourceId;
    if (plannedItems.has(sourceId)) return sourceId;
    return null;
  };

  const planItemsForSubject = (subject, subjectTargetId, quotaSubjectId) => {
    const items = topologicallyOrderedItems(sourceItemsBySubject.get(subject.id) || []);
    const children = descendantsByParent(items);
    for (const item of items) {
      if (copiedItems.has(item.id)) continue;
      if (blockedItems.has(item.id)) {
        blockItemBranch(item, "parent-blocked");
        continue;
      }
      const entry = inventory.index[ITEMS_STORE].get(item.id);
      if (!entry || entry.category === CATEGORY.INVALID) {
        blockItemBranch(item, "invalid");
        continue;
      }
      if (entry.category === CATEGORY.IDENTICAL) continue;
      if (entry.category === CATEGORY.CONFLICT) {
        const choice = resolutionFor(resolutions, ITEMS_STORE, item.id);
        if (choice === RESOLUTION.KEEP_CLOUD) {
          blockItemBranch(item, "kept-cloud");
          continue;
        }
        if (choice !== RESOLUTION.IMPORT_COPY) {
          blockItemBranch(item, "unresolved-conflict");
          continue;
        }
        planCopySubtree(item, subjectTargetId, quotaSubjectId);
        continue;
      }
      if (entry.category !== CATEGORY.ABSENT) continue;
      let parentId = null;
      if (item.parentId !== undefined && item.parentId !== null) {
        parentId = effectiveItemId(item.parentId);
        if (parentId === null) {
          blockItemBranch(item, "parent-blocked");
          continue;
        }
      }
      if ((itemCounts.get(quotaSubjectId) || 0) >= QUOTAS.itemsPerSubject) {
        blockItemBranch(item, "quota");
        continue;
      }
      const order = itemPlacer(subject.id).place(item.id);
      operations.push({
        type: "add",
        store: ITEMS_STORE,
        value: buildRecord(ITEMS_STORE, item, item.id, subjectTargetId, parentId, order)
      });
      plannedItems.add(item.id);
      itemCounts.set(quotaSubjectId, (itemCounts.get(quotaSubjectId) || 0) + 1);
    }
  };

  const planCopySubtree = (item, subjectTargetId, quotaSubjectId) => {
    const items = sourceItemsBySubject.get(item.subjectId) || [];
    const children = descendantsByParent(items);
    for (const node of collectSubtree(item, children, items)) {
      if (blockedItems.has(node.id)) {
        blockItemBranch(node, "parent-blocked");
        continue;
      }
      let parentId = null;
      if (node.parentId !== undefined && node.parentId !== null) {
        if (copiedItems.has(node.parentId)) parentId = copiedItems.get(node.parentId);
        else parentId = effectiveItemId(node.parentId);
        if (parentId === null) {
          blockItemBranch(node, "parent-blocked");
          continue;
        }
      }
      const id = copyIdFor(
        ITEMS_STORE,
        unmapLegacyId(node.id),
        fingerprints.source,
        fingerprints.destination
      );
      const existing = itemTargets.get(id);
      const desired = buildRecord(
        ITEMS_STORE, node, id, subjectTargetId, parentId, itemPlacer(item.subjectId).place(id)
      );
      if (existing) {
        if (!businessRecordsEqual(ITEMS_STORE, existing, desired)) {
          blockItemBranch(node, "copy-collision");
          continue;
        }
        copiedItems.set(node.id, id);
        continue;
      }
      if ((itemCounts.get(quotaSubjectId) || 0) >= QUOTAS.itemsPerSubject) {
        blockItemBranch(node, "quota");
        continue;
      }
      operations.push({ type: "add", store: ITEMS_STORE, value: desired });
      copiedItems.set(node.id, id);
      itemCounts.set(quotaSubjectId, (itemCounts.get(quotaSubjectId) || 0) + 1);
    }
  };

  const planSubjectCopy = (subject) => {
    if (projectedSubjectCount >= QUOTAS.subjects) {
      block(SUBJECTS_STORE, subject.id, "quota", subject.title);
      for (const item of sourceItemsBySubject.get(subject.id) || []) {
        block(ITEMS_STORE, item.id, "quota", item.title);
      }
      return;
    }
    const copySubjectId = copyIdFor(
      SUBJECTS_STORE,
      unmapLegacyId(subject.id),
      fingerprints.source,
      fingerprints.destination
    );
    const existingSubject = subjectTargets.get(copySubjectId);
    const order = subjectPlacer.place(copySubjectId);
    const desiredSubject = buildRecord(SUBJECTS_STORE, subject, copySubjectId, null, null, order);
    if (existingSubject) {
      if (!businessRecordsEqual(SUBJECTS_STORE, existingSubject, desiredSubject)) {
        block(SUBJECTS_STORE, subject.id, "copy-collision", subject.title);
        return;
      }
    } else {
      operations.push({ type: "add", store: SUBJECTS_STORE, value: desiredSubject });
      projectedSubjectCount += 1;
      subjectPlacer.remember(copySubjectId, order);
    }
    const items = topologicallyOrderedItems(sourceItemsBySubject.get(subject.id) || []);
    for (const item of items) {
      const id = copyIdFor(
        ITEMS_STORE,
        unmapLegacyId(item.id),
        fingerprints.source,
        fingerprints.destination
      );
      const parentId = item.parentId === undefined || item.parentId === null
        ? null
        : copiedItems.get(item.parentId) || null;
      if (item.parentId !== undefined && item.parentId !== null && parentId === null) {
        blockItemBranch(item, "parent-blocked");
        continue;
      }
      const existing = itemTargets.get(id);
      const desired = buildRecord(ITEMS_STORE, item, id, copySubjectId, parentId, item.order);
      if (existing) {
        if (!businessRecordsEqual(ITEMS_STORE, existing, desired)) {
          blockItemBranch(item, "copy-collision");
          continue;
        }
        copiedItems.set(item.id, id);
        continue;
      }
      if ((itemCounts.get(copySubjectId) || 0) >= QUOTAS.itemsPerSubject) {
        blockItemBranch(item, "quota");
        continue;
      }
      operations.push({ type: "add", store: ITEMS_STORE, value: desired });
      copiedItems.set(item.id, id);
      itemCounts.set(copySubjectId, (itemCounts.get(copySubjectId) || 0) + 1);
    }
  };

  for (const subject of sourceRecords.subjects) {
    const entry = inventory.index[SUBJECTS_STORE].get(subject.id);
    if (!entry || entry.category === CATEGORY.INVALID) {
      block(SUBJECTS_STORE, subject.id, "invalid", subject.title);
      for (const item of sourceItemsBySubject.get(subject.id) || []) {
        block(ITEMS_STORE, item.id, "subject-blocked", item.title);
      }
      continue;
    }
    if (entry.category === CATEGORY.ABSENT) {
      if (projectedSubjectCount >= QUOTAS.subjects) {
        block(SUBJECTS_STORE, subject.id, "quota", subject.title);
        for (const item of sourceItemsBySubject.get(subject.id) || []) {
          block(ITEMS_STORE, item.id, "quota", item.title);
        }
        continue;
      }
      const order = subjectPlacer.place(subject.id);
      operations.push({
        type: "add",
        store: SUBJECTS_STORE,
        value: buildRecord(SUBJECTS_STORE, subject, subject.id, null, null, order)
      });
      projectedSubjectCount += 1;
      subjectPlacer.remember(subject.id, order);
      planItemsForSubject(subject, subject.id, subject.id);
      continue;
    }
    if (entry.category === CATEGORY.CONFLICT) {
      const choice = resolutionFor(resolutions, SUBJECTS_STORE, subject.id);
      if (choice === RESOLUTION.IMPORT_COPY) {
        planSubjectCopy(subject);
        continue;
      }
      const reason = choice === RESOLUTION.KEEP_CLOUD ? "kept-cloud" : "unresolved-conflict";
      block(SUBJECTS_STORE, subject.id, reason, subject.title);
      for (const item of sourceItemsBySubject.get(subject.id) || []) {
        block(ITEMS_STORE, item.id, "subject-blocked", item.title);
      }
      continue;
    }
    if (entry.category === CATEGORY.IDENTICAL) {
      planItemsForSubject(subject, subject.id, subject.id);
    }
  }

  const sourceEntryCount = sourceRecords.subjects.length + sourceRecords.items.length;
  const alreadyMigrated = operations.length === 0 && blocked.length === 0 && sourceEntryCount > 0;
  let status = "ready";
  if (operations.length === 0) status = alreadyMigrated ? "already-migrated" : "blocked";
  return {
    ...base,
    status,
    operations,
    blocked,
    alreadyMigrated
  };
}

function consentConfirmed(consent) {
  return isPlainObject(consent) && consent.confirmed === true &&
    typeof consent.fingerprint === "string" && consent.fingerprint.length > 0;
}

function planContainsOnlyAdds(plan) {
  if (!plan || !Array.isArray(plan.operations)) return false;
  return plan.operations.every((operation) =>
    isPlainObject(operation) &&
    operation.type === "add" &&
    (operation.store === SUBJECTS_STORE || operation.store === ITEMS_STORE) &&
    isPlainObject(operation.value));
}

// Commit gate enforced below the UI: explicit plan-bound consent, fresh
// attestation and fingerprint revalidation before exactly one adapter call.
export async function runReconciliation(adapter, plan, consent, revalidate) {
  if (!adapter || typeof adapter.commit !== "function") {
    return { status: "invalid-adapter", operations: [] };
  }
  if (!planContainsOnlyAdds(plan)) {
    return { status: "invalid-plan", operations: [] };
  }
  if (!consentConfirmed(consent)) {
    return { status: "refused", operations: [] };
  }
  if (consent.fingerprint !== plan.fingerprint) {
    return { status: "consent-mismatch", operations: [] };
  }
  if (typeof revalidate !== "function") {
    return { status: "stale-plan", operations: [] };
  }
  let fresh;
  try {
    fresh = await revalidate();
  } catch {
    return { status: "read-error", operations: [] };
  }
  const attestation = fresh && fresh.attestation;
  if (!attestation || attestation.attested !== true) {
    return { status: "sync-blocked", reason: attestation ? attestation.reason : "indeterminate", operations: [] };
  }
  const next = computePlanFingerprint({
    document: fresh.document,
    target: fresh.target,
    destination: fresh.destination === undefined ? plan.destination : fresh.destination,
    userId: fresh.userId === undefined ? plan.userId : fresh.userId,
    resolutions: plan.resolutions
  });
  if (next.plan !== plan.fingerprint) {
    return { status: "stale-plan", operations: [] };
  }
  if (plan.operations.length === 0) {
    return { status: plan.alreadyMigrated ? "already-migrated" : "up-to-date", operations: [] };
  }
  try {
    const confirmation = await adapter.commit(plan.operations);
    return { status: "local-written", operations: plan.operations, confirmation };
  } catch (error) {
    return { status: "failed", operations: [], error };
  }
}

export function initialReconciliationStatus() {
  return {
    status: RECONCILIATION_STATUS.IDLE,
    localWritten: false,
    sync: "idle",
    localError: null,
    syncError: null
  };
}

// Truthful status reduction: a local commit can never become `synced` without
// a later native sync-complete event and a healthy attestation.
export function reduceReconciliationStatus(current, event = {}) {
  const state = current || initialReconciliationStatus();
  switch (event.type) {
    case "local-written":
      return { ...state, status: RECONCILIATION_STATUS.LOCAL_WRITTEN, localWritten: true, sync: "unknown" };
    case "committed":
      return {
        ...state,
        status: event.online === false
          ? RECONCILIATION_STATUS.OFFLINE_PENDING
          : RECONCILIATION_STATUS.SYNC_PENDING,
        localWritten: true,
        sync: event.online === false ? "offline-pending" : "pending",
        localError: null
      };
    case "sync-complete":
      if (state.localWritten && event.attested === true) {
        return { ...state, status: RECONCILIATION_STATUS.SYNCED, sync: "synced", syncError: null };
      }
      return state;
    case "sync-error":
      return {
        ...state,
        status: RECONCILIATION_STATUS.SYNC_ERROR,
        sync: "error",
        syncError: event.error || "sync-error"
      };
    case "offline":
      if (state.localWritten) {
        return { ...state, status: RECONCILIATION_STATUS.OFFLINE_PENDING, sync: "offline-pending" };
      }
      return state;
    case "transaction-error":
      return {
        ...state,
        status: RECONCILIATION_STATUS.ERROR,
        localWritten: false,
        localError: event.error || "transaction-error"
      };
    default:
      return state;
  }
}

export function buildReconciliationView(plan) {
  if (!plan || !plan.inventory) {
    return {
      status: "unavailable",
      destination: null,
      fingerprint: null,
      counts: null,
      conflicts: [],
      blocked: [],
      operationCount: 0
    };
  }
  const conflicts = [];
  for (const store of [SUBJECTS_STORE, ITEMS_STORE]) {
    for (const entry of plan.inventory.entries[store]) {
      if (entry.category !== CATEGORY.CONFLICT) continue;
      conflicts.push({
        key: store + ":" + entry.id,
        store,
        id: entry.id,
        title: entry.title,
        fields: entry.fields.slice(),
        options: [RESOLUTION.KEEP_CLOUD, RESOLUTION.IMPORT_COPY]
      });
    }
  }
  return {
    status: plan.status,
    destination: plan.destination,
    fingerprint: plan.fingerprint,
    counts: plan.inventory.counts,
    conflicts,
    blocked: plan.blocked.map((entry) => ({ ...entry })),
    operationCount: plan.operations.length
  };
}
