// Pure local-first persistence model: fine-grained records, V1 projection,
// mutation planners, an injectable commit adapter contract and the
// non-destructive compatibility guard. No DOM, network or framework access.
import {
  STORAGE_KEY,
  RESUME_KEY,
  PRIORITIES,
  parseDocument,
  newSubject,
  newItem,
  renameSubject as renameSubjectDocument,
  updateItem,
  setItemPriority,
  promoteItemToTopLevel,
  planRemoval,
  restoreRemoval,
  moveSubject,
  reorderWithinPriority,
  moveWithinPriority
} from "./core.js";

export const SUBJECTS_STORE = "subjects";
export const ITEMS_STORE = "items";
export const LOCAL_ERROR_KIND = "local";
export const SYNC_ERROR_KIND = "sync";
export const LOCAL_PREFERENCE_KEYS = Object.freeze([RESUME_KEY]);

export function emptyRecords() {
  return { subjects: [], items: [] };
}

function cloneRecords(records) {
  const source = records && typeof records === "object" ? records : emptyRecords();
  return {
    subjects: Array.isArray(source.subjects) ? source.subjects.map((record) => ({ ...record })) : [],
    items: Array.isArray(source.items) ? source.items.map((record) => ({ ...record })) : []
  };
}

export function subjectRecord(subject, order) {
  return { id: subject.id, title: subject.title, order };
}

export function itemRecord(subjectId, item, order) {
  const record = {
    id: item.id,
    subjectId,
    parentId: item.parentId === undefined ? null : item.parentId,
    title: item.title,
    priority: item.priority,
    done: item.done === true,
    order
  };
  if (Object.prototype.hasOwnProperty.call(item, "note")) record.note = item.note;
  return record;
}

export function documentToRecords(document) {
  const source = document && Array.isArray(document.subjects) ? document : emptyRecords();
  const records = emptyRecords();
  source.subjects.forEach((subject, subjectOrder) => {
    records.subjects.push(subjectRecord(subject, subjectOrder));
    if (!Array.isArray(subject.items)) return;
    subject.items.forEach((item, itemOrder) => {
      records.items.push(itemRecord(subject.id, item, itemOrder));
    });
  });
  return records;
}

function itemToDocumentItem(record) {
  const item = {
    id: record.id,
    title: record.title,
    priority: record.priority,
    done: record.done === true,
    parentId: record.parentId === undefined ? null : record.parentId
  };
  if (Object.prototype.hasOwnProperty.call(record, "note")) item.note = record.note;
  return item;
}

function byOrder(left, right) {
  return left.order - right.order;
}

export function recordsToDocument(records) {
  const source = records && typeof records === "object" ? records : emptyRecords();
  const subjects = (Array.isArray(source.subjects) ? source.subjects.slice() : [])
    .sort(byOrder)
    .map((record) => ({ id: record.id, title: record.title, items: [] }));
  const index = new Map(subjects.map((subject) => [subject.id, subject]));
  const items = Array.isArray(source.items) ? source.items.slice() : [];
  for (const record of items.sort(byOrder)) {
    const subject = index.get(record.subjectId);
    if (subject) subject.items.push(itemToDocumentItem(record));
  }
  return { version: 1, subjects };
}

function upsert(list, value) {
  const at = list.findIndex((record) => record.id === value.id);
  if (at === -1) list.push({ ...value });
  else list[at] = { ...value };
}

function removeById(list, key) {
  const at = list.findIndex((record) => record.id === key);
  if (at !== -1) list.splice(at, 1);
}

export function applyOperations(records, operations) {
  const next = cloneRecords(records);
  for (const operation of operations) {
    if (!operation || typeof operation !== "object") continue;
    const list = operation.store === SUBJECTS_STORE ? next.subjects
      : operation.store === ITEMS_STORE ? next.items : null;
    if (!list) continue;
    if (operation.type === "put") upsert(list, operation.value);
    else if (operation.type === "delete") removeById(list, operation.key);
  }
  return next;
}

function recordEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffStore(store, before, after, operations) {
  const previous = new Map((before || []).map((record) => [record.id, record]));
  for (const record of after || []) {
    const existing = previous.get(record.id);
    if (!existing || !recordEquals(existing, record)) {
      operations.push({ type: "put", store, value: { ...record } });
    }
    previous.delete(record.id);
  }
  for (const id of previous.keys()) {
    operations.push({ type: "delete", store, key: id });
  }
}

export function diffRecords(before, after) {
  const operations = [];
  diffStore(SUBJECTS_STORE, before ? before.subjects : [], after ? after.subjects : [], operations);
  diffStore(ITEMS_STORE, before ? before.items : [], after ? after.items : [], operations);
  return operations;
}

function replaceSubjectItems(document, subjectId, items) {
  const subjects = document.subjects.map((subject) =>
    subject.id === subjectId ? { ...subject, items } : subject);
  return { ...document, subjects };
}

function planDocument(records, transform) {
  const before = recordsToDocument(records);
  const after = transform(before);
  if (after === before) return [];
  return diffRecords(records, documentToRecords(after));
}

export function planCreateSubject(records, { title, id }) {
  return planDocument(records, (document) => {
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 100) return document;
    if (typeof id !== "string" || id.length === 0) return document;
    if (document.subjects.length >= 40) return document;
    if (document.subjects.some((subject) => subject.id === id)) return document;
    return { ...document, subjects: [...document.subjects, newSubject(title, id)] };
  });
}

export function planRenameSubject(records, subjectId, title) {
  return planDocument(records, (document) => renameSubjectDocument(document, subjectId, title));
}

export function planAddStep(records, subjectId, { title, priority, id, parentId = null }) {
  return planDocument(records, (document) => {
    const subject = document.subjects.find((entry) => entry.id === subjectId);
    if (!subject) return document;
    if (subject.items.length >= 500) return document;
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 300) return document;
    if (!PRIORITIES.includes(priority)) return document;
    if (typeof id !== "string" || id.length === 0) return document;
    if (parentId !== null) {
      const parent = subject.items.find((entry) => entry.id === parentId);
      if (!parent || parent.parentId !== null) return document;
    }
    return replaceSubjectItems(document, subjectId, [...subject.items, newItem(title, priority, id, parentId)]);
  });
}

export function planAddSubstep(records, subjectId, parentId, { title, id, priority = "normal" }) {
  return planAddStep(records, subjectId, { title, priority, id, parentId });
}

export function planEditStep(records, subjectId, itemId, patch) {
  return planDocument(records, (document) => updateItem(document, subjectId, itemId, patch));
}

export function planSetPriority(records, subjectId, itemId, priority) {
  return planDocument(records, (document) => setItemPriority(document, subjectId, itemId, priority));
}

export function planCompleteStep(records, subjectId, itemId, done) {
  return planDocument(records, (document) => {
    const subject = document.subjects.find((entry) => entry.id === subjectId);
    if (!subject) return document;
    const item = subject.items.find((entry) => entry.id === itemId);
    if (!item) return document;
    const value = done === true;
    if (item.done === value) return document;
    const items = subject.items.map((entry) => entry.id === itemId ? { ...entry, done: value } : entry);
    return replaceSubjectItems(document, subjectId, items);
  });
}

export function planPromoteStep(records, subjectId, itemId) {
  return planDocument(records, (document) => promoteItemToTopLevel(document, subjectId, itemId));
}

export function planReorderStep(records, subjectId, itemId, targetId, position) {
  return planDocument(records, (document) => {
    const subject = document.subjects.find((entry) => entry.id === subjectId);
    if (!subject) return document;
    const items = reorderWithinPriority(subject.items, itemId, targetId, position);
    if (items === subject.items) return document;
    return replaceSubjectItems(document, subjectId, items);
  });
}

export function planMoveStep(records, subjectId, itemId, direction) {
  return planDocument(records, (document) => {
    const subject = document.subjects.find((entry) => entry.id === subjectId);
    if (!subject) return document;
    const items = moveWithinPriority(subject.items, itemId, direction);
    if (items === subject.items) return document;
    return replaceSubjectItems(document, subjectId, items);
  });
}

export function planMoveSubject(records, subjectId, direction) {
  return planDocument(records, (document) => {
    const subjects = moveSubject(document.subjects, subjectId, direction);
    if (subjects === document.subjects) return document;
    return { ...document, subjects };
  });
}

export function planRemoveStep(records, subjectId, itemId) {
  const before = recordsToDocument(records);
  const result = planRemoval(before, subjectId, itemId);
  if (!result.removal) return { operations: [], removal: null };
  return {
    operations: diffRecords(records, documentToRecords(result.document)),
    removal: result.removal
  };
}

export function planRestoreRemoval(records, removal) {
  return planDocument(records, (document) => restoreRemoval(document, removal));
}

export function planImport(records, source) {
  const incoming = parseDocument(typeof source === "string" ? source : JSON.stringify(source));
  return diffRecords(records, documentToRecords(incoming));
}

export function localError(message, cause) {
  const error = new Error(message);
  error.kind = LOCAL_ERROR_KIND;
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function syncError(message, cause) {
  const error = new Error(message);
  error.kind = SYNC_ERROR_KIND;
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function isLocalError(error) {
  return !!error && error.kind === LOCAL_ERROR_KIND;
}

export function isSyncError(error) {
  return !!error && error.kind === SYNC_ERROR_KIND;
}

export function createChangeChannel() {
  const listeners = new Set();
  return {
    publish(change) {
      for (const listener of [...listeners]) listener(change);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// Injectable store adapter used by the tests: the browser Dexie adapter
// implements the same commit(operations) contract in site/app.js.
export function createMemoryStore(options = {}) {
  const channel = options.channel || createChangeChannel();
  let state = cloneRecords(options.initial || emptyRecords());
  let failNext = options.failCommit === true;
  const listeners = new Set();
  let store = null;
  channel.subscribe((change) => {
    if (!change || change.source === store) return;
    state = applyOperations(state, change.operations);
    for (const listener of [...listeners]) {
      listener({ operations: change.operations, records: cloneRecords(state) });
    }
  });
  store = {
    commit(operations) {
      if (failNext) {
        failNext = false;
        return Promise.reject(localError("Échec de la transaction locale."));
      }
      state = applyOperations(state, operations);
      channel.publish({ source: store, operations });
      return Promise.resolve({ status: "recorded", operations });
    },
    failNextCommit() {
      failNext = true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      return cloneRecords(state);
    },
    networkCalls: 0
  };
  return store;
}

export async function recordLocalWrite(store, operations) {
  const result = await store.commit(operations);
  return { status: result.status, sync: "pending", operations: result.operations };
}

export function markSyncFailure(confirmation, error) {
  return {
    status: confirmation.status,
    sync: "error",
    operations: confirmation.operations,
    syncMessage: error && error.message ? error.message : String(error)
  };
}

export function readHistoricalDocument(storage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseDocument(raw);
  } catch {
    return null;
  }
}

export function compatibilityGuard(storage) {
  return { historical: readHistoricalDocument(storage) };
}

export function isLocalPreferenceKey(key) {
  return LOCAL_PREFERENCE_KEYS.includes(key);
}

export function exportDocument(records) {
  return recordsToDocument(records);
}
