import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STORAGE_KEY,
  RESUME_KEY,
  emptyDocument,
  newSubject,
  newItem,
  parseDocument
} from "../site/core.js";
import {
  SUBJECTS_STORE,
  ITEMS_STORE,
  LOCAL_ERROR_KIND,
  SYNC_ERROR_KIND,
  LOCAL_PREFERENCE_KEYS,
  documentToRecords,
  recordsToDocument,
  applyOperations,
  planCreateSubject,
  planRenameSubject,
  planAddStep,
  planAddSubstep,
  planEditStep,
  planSetPriority,
  planCompleteStep,
  planPromoteStep,
  planReorderStep,
  planMoveStep,
  planMoveSubject,
  planRemoveStep,
  planRestoreRemoval,
  planImport,
  localError,
  syncError,
  isLocalError,
  isSyncError,
  createChangeChannel,
  createMemoryStore,
  recordLocalWrite,
  markSyncFailure,
  readHistoricalDocument,
  compatibilityGuard,
  isLocalPreferenceKey,
  exportDocument
} from "../site/persistence.js";
import { SYNCHRONIZED_STORES, validateSynchronizedStores } from "../site/dexie-foundation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const pkg = JSON.parse(read("package.json"));

function fixture() {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(
    newItem("A", "urgent", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c", "b"),
    newItem("D", "later", "d"),
    newItem("F", "normal", "f")
  );
  subject.items[0].note = "Note A\nligne 2";
  document.subjects.push(subject);
  const second = newSubject("Autre", "s2");
  second.items.push(newItem("E", "normal", "e"));
  document.subjects.push(second);
  return document;
}

function spyStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { writes.push(["set", key]); map.set(key, String(value)); },
    removeItem: (key) => { writes.push(["remove", key]); map.delete(key); }
  };
}

function itemParentInvariant(records) {
  const topLevel = new Set(records.items.filter((record) => record.parentId === null).map((record) => record.id));
  for (const record of records.items) {
    if (record.parentId === null) continue;
    assert.equal(topLevel.has(record.parentId), true, "parentId must reference a top-level step");
  }
}

test("1.1 records carry globally unique string ids and the synchronized stores stay valid", () => {
  const records = documentToRecords(fixture());
  const ids = [...records.subjects, ...records.items].map((record) => record.id);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.equal(typeof id, "string");
  assert.equal(new Set(ids).size, ids.length);
  for (const record of records.items) {
    assert.equal(typeof record.subjectId, "string");
    assert.equal(Number.isInteger(record.order), true);
  }
  assert.equal(validateSynchronizedStores(SYNCHRONIZED_STORES), true);
  assert.doesNotMatch(read("site/persistence.js"), /\+\+id/);
});

test("1.2 documentToRecords and recordsToDocument reproduce the exact V1 shape", () => {
  const document = fixture();
  const records = documentToRecords(document);
  const rebuilt = recordsToDocument(records);
  assert.deepEqual(rebuilt, document);
  assert.deepEqual(parseDocument(JSON.stringify(rebuilt)), document);
  assert.equal(rebuilt.subjects[0].items.find((item) => item.id === "a").note, "Note A\nligne 2");
  assert.equal(rebuilt.subjects[0].items.find((item) => item.id === "b").parentId, null);
  assert.equal(rebuilt.subjects[0].items.find((item) => item.id === "c").parentId, "b");
  assert.equal(rebuilt.subjects[0].items.find((item) => item.id === "d").priority, "later");
});

test("1.3 every mutation planner emits only affected per-record operations", () => {
  const records = documentToRecords(fixture());
  const total = records.subjects.length + records.items.length;
  const cases = [
    planCreateSubject(records, { title: "Nouveau", id: "s3" }),
    planRenameSubject(records, "s1", "Renommé"),
    planAddStep(records, "s1", { title: "N", priority: "normal", id: "n" }),
    planAddSubstep(records, "s1", "b", { title: "Sub", id: "sub" }),
    planEditStep(records, "s1", "a", { title: "A2", priority: "urgent" }),
    planSetPriority(records, "s1", "a", "later"),
    planCompleteStep(records, "s1", "a", true),
    planReorderStep(records, "s1", "f", "b", "before"),
    planMoveStep(records, "s1", "f", "up"),
    planMoveSubject(records, "s2", "up"),
    planPromoteStep(records, "s1", "c")
  ];
  for (const operations of cases) {
    assert.ok(operations.length >= 1);
    assert.ok(operations.length < total, "a planner must not rewrite every record");
    for (const operation of operations) {
      assert.ok([SUBJECTS_STORE, ITEMS_STORE].includes(operation.store));
      assert.ok(operation.type === "put" || operation.type === "delete");
      assert.equal(operation.value && "version" in operation.value, false);
      assert.equal(operation.value && "subjects" in operation.value, false);
    }
    itemParentInvariant(applyOperations(records, operations));
  }
});

test("1.3 removal deletes only the removed records and restore puts them back", () => {
  const records = documentToRecords(fixture());
  const { operations, removal } = planRemoveStep(records, "s1", "b");
  assert.equal(removal !== null, true);
  const deleted = operations.filter((operation) => operation.type === "delete").map((operation) => operation.key).sort();
  assert.deepEqual(deleted, ["b", "c"]);
  const afterRemoval = applyOperations(records, operations);
  assert.equal(afterRemoval.items.some((record) => record.id === "b"), false);
  assert.equal(afterRemoval.items.some((record) => record.id === "c"), false);
  const restored = applyOperations(afterRemoval, planRestoreRemoval(afterRemoval, removal));
  assert.deepEqual(recordsToDocument(restored), recordsToDocument(records));
});

test("1.4 npm run check covers site/persistence.js and node --check succeeds", () => {
  assert.match(pkg.scripts.check, /node --check site\/persistence\.js/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", resolve(root, "site/persistence.js")]));
});

test("2.1 a successful commit records locally, applies the change and makes no network call", async () => {
  const store = createMemoryStore({ initial: documentToRecords(fixture()) });
  const operations = planAddStep(store.snapshot(), "s1", { title: "N", priority: "normal", id: "n" });
  const result = await store.commit(operations);
  assert.equal(result.status, "recorded");
  assert.equal(store.snapshot().items.some((record) => record.id === "n"), true);
  assert.equal(store.networkCalls, 0);
});

test("2.2 a failed transaction rejects with a distinct local kind and leaves the store unchanged", async () => {
  const store = createMemoryStore({ initial: documentToRecords(fixture()), failCommit: true });
  const before = JSON.stringify(store.snapshot());
  const operations = planAddStep(store.snapshot(), "s1", { title: "N", priority: "normal", id: "n" });
  await assert.rejects(() => store.commit(operations), (error) => {
    assert.equal(error.kind, LOCAL_ERROR_KIND);
    assert.equal(isLocalError(error), true);
    assert.equal(isSyncError(error), false);
    return true;
  });
  assert.equal(JSON.stringify(store.snapshot()), before);
  assert.notEqual(LOCAL_ERROR_KIND, SYNC_ERROR_KIND);
  assert.equal(isLocalError(syncError("réseau")), false);
  assert.equal(isSyncError(syncError("réseau")), true);
});

test("2.3 a local confirmation is kept after a later synchronization error", async () => {
  const store = createMemoryStore({ initial: documentToRecords(fixture()) });
  const operations = planAddStep(store.snapshot(), "s1", { title: "N", priority: "normal", id: "n" });
  const confirmation = await recordLocalWrite(store, operations);
  assert.equal(confirmation.status, "recorded");
  assert.equal(confirmation.sync, "pending");
  assert.equal(store.networkCalls, 0);
  const afterFailure = markSyncFailure(confirmation, syncError("réseau indisponible"));
  assert.equal(afterFailure.status, "recorded");
  assert.equal(afterFailure.sync, "error");
  assert.equal(store.snapshot().items.some((record) => record.id === "n"), true);
});

test("3.1 a commit in one store reaches another subscriber without a storage event", async () => {
  const channel = createChangeChannel();
  const initial = documentToRecords(fixture());
  const tabA = createMemoryStore({ channel, initial });
  const tabB = createMemoryStore({ channel, initial });
  const seen = [];
  tabB.subscribe((change) => seen.push(change.operations));
  const operations = planAddStep(tabA.snapshot(), "s1", { title: "N", priority: "normal", id: "n" });
  await tabA.commit(operations);
  assert.equal(seen.length, 1);
  assert.equal(tabB.snapshot().items.some((record) => record.id === "n"), true);
  assert.deepEqual(recordsToDocument(tabB.snapshot()), recordsToDocument(tabA.snapshot()));
});

test("3.2 independent edits to distinct steps both survive propagation", async () => {
  const channel = createChangeChannel();
  const initial = documentToRecords(fixture());
  const tabA = createMemoryStore({ channel, initial });
  const tabB = createMemoryStore({ channel, initial });
  const opsA = planCompleteStep(tabA.snapshot(), "s1", "a", true);
  const opsB = planEditStep(tabB.snapshot(), "s1", "d", { title: "D2", priority: "later" });
  assert.ok(opsA.every((operation) => !operation.value || operation.value.id !== "d"));
  assert.ok(opsB.every((operation) => !operation.value || operation.value.id !== "a"));
  await tabA.commit(opsA);
  await tabB.commit(opsB);
  assert.equal(tabA.snapshot().items.find((record) => record.id === "a").done, true);
  assert.equal(tabA.snapshot().items.find((record) => record.id === "d").title, "D2");
  assert.deepEqual(recordsToDocument(tabA.snapshot()), recordsToDocument(tabB.snapshot()));
});

test("4.1 a valid V1 import replaces records in a single operation set", async () => {
  const store = createMemoryStore({ initial: documentToRecords(fixture()) });
  const incoming = emptyDocument();
  const subject = newSubject("Importé", "s9");
  subject.items.push(newItem("X", "urgent", "x"));
  subject.items[0].note = "note importée\nligne 2";
  incoming.subjects.push(subject);
  const operations = planImport(store.snapshot(), JSON.stringify(incoming));
  assert.ok(Array.isArray(operations) && operations.length > 0);
  await store.commit(operations);
  assert.deepEqual(recordsToDocument(store.snapshot()), incoming);
  assert.deepEqual(parseDocument(JSON.stringify(exportDocument(store.snapshot()))), incoming);
});

test("4.2 an invalid import changes nothing and reports the validation error", () => {
  const store = createMemoryStore({ initial: documentToRecords(fixture()) });
  const before = JSON.stringify(store.snapshot());
  assert.throws(() => planImport(store.snapshot(), JSON.stringify({ version: 2, subjects: [] })), /Format ThreadStep incompatible/);
  assert.equal(JSON.stringify(store.snapshot()), before);
  const orphan = JSON.stringify({
    version: 1,
    subjects: [{ id: "s1", title: "S", items: [{ id: "c", title: "C", priority: "normal", done: false, parentId: "missing" }] }]
  });
  assert.throws(() => planImport(store.snapshot(), orphan), /Hiérarchie/);
  assert.equal(JSON.stringify(store.snapshot()), before);
});

test("4.3 preferences stay local, out of the synchronized records and out of the export", () => {
  const records = documentToRecords(fixture());
  assert.equal(JSON.stringify(records).includes(RESUME_KEY), false);
  assert.equal(JSON.stringify(exportDocument(records)).includes(RESUME_KEY), false);
  assert.equal(JSON.stringify(exportDocument(records)).includes("resume"), false);
  assert.equal(isLocalPreferenceKey(RESUME_KEY), true);
  assert.deepEqual(LOCAL_PREFERENCE_KEYS, [RESUME_KEY]);
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  const app = read("site/app.js");
  assert.match(app, /localStorage\.setItem\(RESUME_KEY/);
});

test("5.1 core.js stays pure and app.js routes mutations through the adapter", () => {
  const core = read("site/core.js");
  assert.doesNotMatch(core, /\bfetch\s*\(/);
  assert.doesNotMatch(core, /XMLHttpRequest/);
  assert.doesNotMatch(core, /localStorage/);
  assert.doesNotMatch(core, /indexedDB/);
  assert.doesNotMatch(core, /\bdocument\.(?:createElement|querySelector|getElementById|addEventListener|body)\b/);
  assert.doesNotMatch(core, /\bwindow\b/);
  const app = read("site/app.js");
  assert.match(app, /import \{[^}]*\} from "\.\/persistence\.js"/);
  assert.match(app, /documentToRecords\(documentState\)/);
  assert.match(app, /diffRecords\(lastRecords, records\)/);
  assert.match(app, /businessStore\.commit\(operations\)/);
});

test("5.2 app subscribes through a broadcast channel, not only the storage event", () => {
  const app = read("site/app.js");
  assert.match(app, /new BroadcastChannel\(/);
  assert.match(app, /function subscribeToChanges\(/);
  assert.match(app, /syncedDatabase\.cloud\.events\.syncComplete\.subscribe/);
  assert.match(app, /window\.addEventListener\("storage"/);
  assert.match(app, /subscribeToChanges\(\);/);
});

test("5.3 the compatibility guard preserves the historical document and no path deletes it", () => {
  const historical = fixture();
  const storage = spyStorage({ [STORAGE_KEY]: JSON.stringify(historical) });
  const guard = compatibilityGuard(storage);
  assert.deepEqual(guard.historical, historical);
  assert.notEqual(storage.getItem(STORAGE_KEY), null);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), historical);
  assert.deepEqual(storage.writes, []);
  assert.equal(readHistoricalDocument(spyStorage()), null);
  assert.equal(readHistoricalDocument(spyStorage({ [STORAGE_KEY]: "{broken" })), null);
  const app = read("site/app.js");
  assert.match(app, /compatibilityGuard\(localStorage\)/);
  assert.doesNotMatch(app, /removeItem\(STORAGE_KEY\)/);
  assert.doesNotMatch(app, /deleteDatabase/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /XMLHttpRequest/);
});

test("5.4 the developer guide and MVP note describe the transactional adapter", () => {
  const guide = read("docs/product/developer-guide.md");
  assert.match(guide, /site\/persistence\.js/);
  assert.match(guide, /commit\(operations\)/);
  assert.match(guide, /garde de compatibilité/);
  const mvp = read("docs/product/mvp.md");
  assert.match(mvp, /TS-025/);
  assert.match(mvp, /persistence\.js/);
});
