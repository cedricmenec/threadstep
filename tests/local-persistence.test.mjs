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
  emptyRecords,
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
  createDexieStore,
  normalizedRecords,
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

function fakeTable(initial = []) {
  const map = new Map(initial.map((record) => [record.id, structuredClone(record)]));
  let failPut = false;
  return {
    async put(value) {
      if (failPut) {
        failPut = false;
        throw new Error("IndexedDB put refused");
      }
      map.set(value.id, structuredClone(value));
    },
    async add(value) {
      if (map.has(value.id)) throw new Error("ConstraintError");
      map.set(value.id, structuredClone(value));
    },
    async delete(key) { map.delete(key); },
    async toArray() { return [...map.values()].map((record) => structuredClone(record)); },
    failNextPut() { failPut = true; },
    snapshot() { return [...map.values()].map((record) => structuredClone(record)); },
    restore(records) {
      map.clear();
      for (const record of records) map.set(record.id, structuredClone(record));
    }
  };
}

function fakeDexieDatabase(options = {}) {
  const subjects = fakeTable(options.subjects || []);
  const items = fakeTable(options.items || []);
  let openFailures = options.failOpen || 0;
  let readFailures = options.failRead || 0;
  return {
    subjects,
    items,
    networkCalls: 0,
    async open() {
      if (openFailures > 0) {
        openFailures -= 1;
        throw new Error("IndexedDB open refused");
      }
    },
    async transaction(mode, first, second, callback) {
      assert.equal(first, this.subjects);
      assert.equal(second, this.items);
      if (mode === "r" && readFailures > 0) {
        readFailures -= 1;
        throw new Error("IndexedDB read refused");
      }
      const snapshot = { subjects: subjects.snapshot(), items: items.snapshot() };
      try {
        return await callback();
      } catch (error) {
        subjects.restore(snapshot.subjects);
        items.restore(snapshot.items);
        throw error;
      }
    }
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

test("6.1 the local Dexie adapter creates, edits, deletes and reloads a parent/child tree", async () => {
  const db = fakeDexieDatabase();
  const store = createDexieStore(db);
  await store.open();
  assert.deepEqual(await store.read(), emptyRecords());

  await store.commit(planCreateSubject(emptyRecords(), { title: "Projet", id: "s1" }));
  let records = await store.read();
  await store.commit(planAddStep(records, "s1", { title: "Parent", priority: "normal", id: "parent" }));
  records = await store.read();
  await store.commit(planAddSubstep(records, "s1", "parent", { title: "Enfant", id: "child" }));
  records = await store.read();
  await store.commit(planAddStep(records, "s1", { title: "À retirer", priority: "later", id: "gone" }));
  records = await store.read();
  await store.commit(planEditStep(records, "s1", "child", { title: "Enfant modifié", priority: "urgent" }));
  records = await store.read();
  await store.commit(planCompleteStep(records, "s1", "parent", true));
  records = await store.read();
  await store.commit(planRemoveStep(records, "s1", "gone").operations);

  const reloaded = createDexieStore(db);
  const restored = await reloaded.read();
  const document = recordsToDocument(restored);
  assert.equal(document.subjects.length, 1);
  assert.equal(document.subjects[0].id, "s1");
  assert.equal(document.subjects[0].title, "Projet");
  const parent = document.subjects[0].items.find((item) => item.id === "parent");
  const child = document.subjects[0].items.find((item) => item.id === "child");
  assert.equal(parent.parentId, null);
  assert.equal(parent.done, true);
  assert.equal(child.parentId, "parent");
  assert.equal(child.title, "Enfant modifié");
  assert.equal(child.priority, "urgent");
  assert.equal(document.subjects[0].items.some((item) => item.id === "gone"), false);
  for (const record of [...restored.subjects, ...restored.items]) {
    assert.equal(typeof record.id, "string");
  }
  assert.equal(db.networkCalls, 0);
});

test("6.2 a failed local transaction keeps the previous state and leaves no partial records", async () => {
  const db = fakeDexieDatabase();
  const store = createDexieStore(db);
  await store.commit(planCreateSubject(emptyRecords(), { title: "Projet", id: "s1" }));
  const before = await store.read();
  db.items.failNextPut();
  const operations = [
    { store: SUBJECTS_STORE, type: "put", value: { id: "s1", title: "Renommé", order: 0 } },
    { store: ITEMS_STORE, type: "put", value: {
      id: "new", subjectId: "s1", parentId: null, title: "Nouvelle",
      priority: "normal", done: false, order: 0
    } }
  ];
  await assert.rejects(() => store.commit(operations), (error) => {
    assert.equal(isLocalError(error), true);
    assert.equal(error.kind, LOCAL_ERROR_KIND);
    assert.equal(isSyncError(error), false);
    return true;
  });
  assert.deepEqual(await store.read(), before);
  assert.equal((await store.read()).items.length, 0);
});

test("6.3 unavailable open and failed reads surface distinct local errors", async () => {
  const openFailure = createDexieStore(fakeDexieDatabase({ failOpen: 1 }));
  await assert.rejects(() => openFailure.open(), (error) => {
    assert.equal(isLocalError(error), true);
    assert.match(error.message, /ouvrir le stockage local IndexedDB/i);
    return true;
  });

  const readFailure = createDexieStore(fakeDexieDatabase({ failRead: 1 }));
  await assert.rejects(() => readFailure.read(), (error) => {
    assert.equal(isLocalError(error), true);
    assert.match(error.message, /Lecture de l'espace IndexedDB impossible/);
    return true;
  });

  assert.throws(() => createDexieStore(null), /not initialized/);
  assert.throws(() => normalizedRecords({ subjects: [], items: [{ id: "orphan" }] }), /Dangling subject references/);
});

test("6.4 the local adapter never reads or writes the historical localStorage document", async () => {
  const historical = fixture();
  const raw = JSON.stringify(historical);
  const storage = spyStorage({
    [STORAGE_KEY]: raw,
    [RESUME_KEY]: JSON.stringify({ subjectId: "s1", itemId: "a" })
  });
  const db = fakeDexieDatabase();
  const store = createDexieStore(db);
  await store.open();
  assert.deepEqual(await store.read(), emptyRecords());
  await store.commit(planCreateSubject(emptyRecords(), { title: "Local", id: "local-1" }));
  const beforeFailure = await store.read();
  db.items.failNextPut();
  await assert.rejects(() => store.commit([
    { store: ITEMS_STORE, type: "put", value: {
      id: "x", subjectId: "local-1", parentId: null, title: "X",
      priority: "normal", done: false, order: 0
    } }
  ]));
  assert.deepEqual(await store.read(), beforeFailure);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.deepEqual(storage.writes, []);
  assert.equal(JSON.stringify(await store.read()).includes(RESUME_KEY), false);
});

test("6.5 local export is built from committed records without Cloud data", async () => {
  const db = fakeDexieDatabase();
  const store = createDexieStore(db);
  await store.commit(documentToRecords(fixture()).items.map((value) => ({ store: ITEMS_STORE, type: "put", value }))
    .concat(documentToRecords(fixture()).subjects.map((value) => ({ store: SUBJECTS_STORE, type: "put", value }))));
  const document = exportDocument(await store.read());
  assert.deepEqual(document, fixture());
  const json = JSON.stringify(document);
  assert.doesNotMatch(json, /databaseUrl|cloud\.config|dexie\.cloud|otp|secret|credential|token/i);
  assert.deepEqual(parseDocument(json), fixture());
});

test("6.6 app starts the business view on local IndexedDB without authentication", () => {
  const app = read("site/app.js");
  const html = read("site/index.html");
  assert.match(app, /function bootstrapLocalDatabase\(\)/);
  assert.match(app, /return openLocalDatabase\(Dexie\)/);
  assert.match(app, /createDexieStore\(localDatabase\)/);
  assert.match(app, /function startLocalWorkspace\(\)/);
  assert.match(app, /function refreshLocalDocument\(\)/);
  assert.match(app, /if \(!syncedDatabase\)[\s\S]*?startLocalWorkspace\(\)/);
  assert.match(app, /localExportLegacyEl\.addEventListener\("click", exportLegacyBackup\)/);
  assert.doesNotMatch(app, /localStorage\.getItem\(STORAGE_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(app, /innerHTML/);

  const bootstrap = app.slice(
    app.indexOf("function bootstrapLocalDatabase"),
    app.indexOf("// TS-038 workspace identity")
  );
  assert.doesNotMatch(bootstrap, /dexieCloud|cloud\.configure|addons|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|setupAuthentication|renderAuthPanel/);
  const localStart = app.slice(
    app.indexOf("function startLocalWorkspace"),
    app.indexOf("function readResumePreference")
  );
  assert.doesNotMatch(localStart, /setupAuthentication|renderAuthPanel|authController|OTP/);
  const startup = app.slice(app.lastIndexOf("syncedDatabase = bootstrapSyncedDatabase(workspaceEntry)"));
  assert.match(startup, /if \(syncedDatabase\) \{[\s\S]*?setupAuthentication\(\);[\s\S]*?\} else \{[\s\S]*?startLocalWorkspace\(\);/);
  assert.doesNotMatch(startup.slice(startup.indexOf("} else {")), /setupAuthentication|offerHistoricalMigration|detectHistoricalDocument|runMigration|planMigration/);

  assert.match(html, /id="local-panel"[^>]*hidden/);
  assert.match(html, /id="local-status"[^>]*role="status"/);
  assert.match(html, /id="local-legacy-notice"[^>]*role="status"/);
  assert.match(html, /id="local-storage-error"[^>]*role="alert"/);
  assert.match(html, /id="local-export-legacy"[^>]*type="button"[^>]*hidden/);
  assert.match(app, /aucune conversion ni transmission Cloud n'est lancée automatiquement/i);
  assert.doesNotMatch(html, /convertir automatiquement|migrer automatiquement/i);
  assert.doesNotMatch(html, /innerHTML/);
  assert.match(app, /Échec de la transaction locale/);
  assert.match(app, /Lecture de l'espace IndexedDB impossible/);
  assert.match(app, /Stockage local IndexedDB indisponible/);
  assert.match(app, /openLocalImportPreview\(text\)/);
  assert.match(app, /businessStore\.commit\(operations\)/);
  assert.doesNotMatch(app, /confirm\("Remplacer toutes les données locales par cet import \?"\)/);
});

test("6.7 documentation records local-first startup, legacy export and TS boundaries", () => {
  const guide = read("docs/product/developer-guide.md");
  const mvp = read("docs/product/mvp.md");
  const rollout = read("docs/product/dexie-cloud-rollout.md");
  const acceptance = read("docs/product/acceptance-checklist.md");
  for (const source of [guide, mvp, rollout, acceptance]) {
    assert.match(source, /IndexedDB/);
  }
  assert.match(guide, /threadstep-local/);
  assert.match(guide, /TS-032/);
  assert.match(guide, /TS-033/);
  assert.match(guide, /TS-037/);
  assert.match(guide, /threadstep\.document\.v1/);
  assert.match(mvp, /TS-032/);
  assert.match(rollout, /TS-032/);
  assert.match(acceptance, /hors ligne|offline/i);
  const docs = guide + mvp + rollout + acceptance;
  assert.doesNotMatch(docs, /https:\/\/[a-z0-9-]+\.dexie\.cloud/i);
});

test("6.8 local JSON import is one atomic adapter commit and invalid input changes nothing", async () => {
  const db = fakeDexieDatabase();
  const store = createDexieStore(db);
  await store.commit(documentToRecords(fixture()));
  const before = await store.read();
  assert.throws(() => planImport(before, JSON.stringify({ version: 2, subjects: [] })), /Format ThreadStep incompatible/);
  assert.deepEqual(await store.read(), before);

  const incoming = emptyDocument();
  const subject = newSubject("Importé", "s9");
  subject.items.push(newItem("X", "urgent", "x"));
  incoming.subjects.push(subject);
  const operations = planImport(before, JSON.stringify(incoming));
  let commits = 0;
  const counting = {
    async commit(values) { commits += 1; return store.commit(values); }
  };
  await counting.commit(operations);
  assert.equal(commits, 1);
  assert.deepEqual(recordsToDocument(await store.read()), incoming);
  assert.deepEqual(exportDocument(await store.read()), incoming);
});

test("6.9 local reads preserve UUID and legacy identifiers as stable strings", async () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const db = fakeDexieDatabase({
    subjects: [{ id: uuid, title: "UUID", order: 0 }],
    items: [{ id: "legacy:a", subjectId: uuid, parentId: null, title: "Legacy",
      priority: "normal", done: false, order: 0 }]
  });
  const store = createDexieStore(db);
  const records = await store.read();
  assert.equal(records.subjects[0].id, uuid);
  assert.equal(records.items[0].id, "legacy:a");
  assert.equal(records.items[0].subjectId, uuid);
  assert.equal(records.items[0].parentId, null);
  const reloaded = await createDexieStore(db).read();
  assert.deepEqual(reloaded, records);
});
