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
  emptyRecords,
  documentToRecords,
  recordsToDocument,
  createMemoryStore,
  exportDocument
} from "../site/persistence.js";
import {
  LEGACY_ID_PREFIX,
  MIGRATION_STATUS,
  detectHistoricalDocument,
  projectHistoricalDocument,
  reproduceHistoricalDocument,
  mapLegacyId,
  unmapLegacyId,
  mapRecords,
  unmapRecords,
  describeMigration,
  planMigration,
  runMigration
} from "../site/migration.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

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
  subject.items[3].done = true;
  document.subjects.push(subject);
  const second = newSubject("Autre", "s2");
  second.items.push(newItem("E", "normal", "e"));
  document.subjects.push(second);
  return document;
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { writes.push(["set", key]); map.set(key, String(value)); },
    removeItem: (key) => { writes.push(["remove", key]); map.delete(key); }
  };
}

function spyStore(store) {
  let calls = 0;
  return {
    commit(operations) { calls += 1; return store.commit(operations); },
    get calls() { return calls; },
    snapshot: () => store.snapshot()
  };
}

test("1.1 detectHistoricalDocument strictly validates the V1 value", () => {
  const historical = fixture();
  const present = detectHistoricalDocument(fakeStorage({ [STORAGE_KEY]: JSON.stringify(historical) }));
  assert.equal(present.status, MIGRATION_STATUS.PRESENT);
  assert.deepEqual(present.document, historical);
  assert.equal(present.message, null);

  const absent = detectHistoricalDocument(fakeStorage());
  assert.equal(absent.status, MIGRATION_STATUS.ABSENT);
  assert.equal(absent.document, null);

  const broken = detectHistoricalDocument(fakeStorage({ [STORAGE_KEY]: "{broken" }));
  assert.equal(broken.status, MIGRATION_STATUS.INVALID);
  assert.equal(typeof broken.message, "string");
  assert.equal(broken.message.length > 0, true);

  const wrongVersion = detectHistoricalDocument(fakeStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, subjects: [] }) }));
  assert.equal(wrongVersion.status, MIGRATION_STATUS.INVALID);

  const orphan = detectHistoricalDocument(fakeStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      subjects: [{ id: "s1", title: "S", items: [{ id: "c", title: "C", priority: "normal", done: false, parentId: "missing" }] }]
    })
  }));
  assert.equal(orphan.status, MIGRATION_STATUS.INVALID);

  assert.equal(detectHistoricalDocument(null).status, MIGRATION_STATUS.UNAVAILABLE);
  assert.equal(
    detectHistoricalDocument({ getItem() { throw new Error("boom"); } }).status,
    MIGRATION_STATUS.UNREADABLE
  );

  // An invalid or absent value yields no migration plan and no write.
  const store = createMemoryStore();
  for (const status of [broken, absent, wrongVersion, orphan]) {
    const plan = planMigration(store.snapshot(), status.document, {});
    assert.equal(plan.operations.length, 0);
    assert.deepEqual(store.snapshot(), emptyRecords());
  }
});

test("1.2 preservation projection reproduces the exact V1 content and keeps the resume preference local", () => {
  const historical = fixture();
  const records = projectHistoricalDocument(historical);
  assert.deepEqual(reproduceHistoricalDocument(records), historical);
  assert.deepEqual(parseDocument(JSON.stringify(reproduceHistoricalDocument(records))), historical);
  const rebuilt = recordsToDocument(records).subjects[0].items;
  assert.equal(rebuilt.find((item) => item.id === "a").note, "Note A\nligne 2");
  assert.equal(rebuilt.find((item) => item.id === "c").parentId, "b");
  assert.equal(rebuilt.find((item) => item.id === "d").done, true);
  assert.equal(rebuilt.find((item) => item.id === "d").priority, "later");
  assert.equal(rebuilt.find((item) => item.id === "b").parentId, null);
  assert.equal(JSON.stringify(records).includes(RESUME_KEY), false);
  assert.equal(JSON.stringify(records).includes("resume"), false);

  const storage = fakeStorage({
    [STORAGE_KEY]: JSON.stringify(historical),
    [RESUME_KEY]: JSON.stringify({ subjectId: "s1", itemId: "a" })
  });
  const detected = detectHistoricalDocument(storage);
  assert.deepEqual(detected.document, historical);
  assert.equal(JSON.stringify(projectHistoricalDocument(detected.document)).includes("resume"), false);
  assert.notEqual(storage.getItem(RESUME_KEY), null);
});

test("1.3 npm run check covers site/migration.js and node --check succeeds", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /node --check site\/migration\.js/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", resolve(root, "site/migration.js")]));
});

test("2.1 describeMigration discloses destination, counts and synchronization before consent", () => {
  const historical = fixture();
  const records = projectHistoricalDocument(historical);
  const destination = "https://demo.dexie.cloud";
  const disclosure = describeMigration(historical, destination, records);
  assert.equal(disclosure.destination, destination);
  assert.equal(disclosure.subjectCount, 2);
  assert.equal(disclosure.itemCount, 6);
  assert.equal(disclosure.synchronized, true);
  assert.match(disclosure.message, /demo\.dexie\.cloud/);
  assert.match(disclosure.message, /synchronis/i);

  const store = createMemoryStore();
  const before = JSON.stringify(store.snapshot());
  describeMigration(historical, destination, records);
  assert.equal(JSON.stringify(store.snapshot()), before);
});

test("2.2 runMigration is gated by an explicit consent flag", async () => {
  const historical = fixture();
  const store = createMemoryStore();
  const spy = spyStore(store);
  const plan = planMigration(store.snapshot(), historical, {});

  const refused = await runMigration(spy, plan, { confirmed: false });
  assert.equal(refused.status, "refused");
  assert.equal(spy.calls, 0);
  assert.deepEqual(store.snapshot(), emptyRecords());

  const accepted = await runMigration(spy, plan, { confirmed: true });
  assert.equal(accepted.status, "migrated");
  assert.equal(spy.calls, 1);
  assert.equal(store.snapshot().subjects.length, 2);
  assert.equal(store.snapshot().items.length, 6);
});

test("3.1 planMigration returns one operation set and runMigration commits it atomically", async () => {
  const historical = fixture();
  const store = createMemoryStore();
  const spy = spyStore(store);
  const plan = planMigration(store.snapshot(), historical, {});
  assert.ok(plan.operations.length > 0);
  for (const operation of plan.operations) {
    assert.ok([SUBJECTS_STORE, ITEMS_STORE].includes(operation.store));
    assert.equal(operation.type, "put");
  }
  const outcome = await runMigration(spy, plan, { confirmed: true });
  assert.equal(outcome.status, "migrated");
  assert.equal(spy.calls, 1);

  const failing = createMemoryStore({ failCommit: true });
  const failingSpy = spyStore(failing);
  const failPlan = planMigration(failing.snapshot(), historical, {});
  const before = JSON.stringify(failing.snapshot());
  const failed = await runMigration(failingSpy, failPlan, { confirmed: true });
  assert.equal(failed.status, "failed");
  assert.equal(JSON.stringify(failing.snapshot()), before);
  assert.equal(failing.snapshot().subjects.length, 0);
  assert.equal(failing.snapshot().items.length, 0);
});

test("3.2 a second confirmed run is idempotent and duplicates nothing", async () => {
  const historical = fixture();
  const store = createMemoryStore();
  await runMigration(store, planMigration(store.snapshot(), historical, {}), { confirmed: true });
  const afterFirst = store.snapshot();

  const rerun = planMigration(store.snapshot(), historical, {});
  assert.equal(rerun.status, "already-migrated");
  assert.equal(rerun.alreadyMigrated, true);
  assert.equal(rerun.operations.length, 0);

  const outcome = await runMigration(store, rerun, { confirmed: true });
  assert.equal(outcome.status, "already-migrated");
  assert.deepEqual(store.snapshot(), afterFirst);
  assert.equal(store.snapshot().subjects.length, 2);
  assert.equal(store.snapshot().items.length, 6);
});

test("3.3 collisions and a populated target are reported without silent overwrite", async () => {
  const historical = fixture();

  const populated = createMemoryStore({
    initial: { subjects: [{ id: "other", title: "Existant", order: 0 }], items: [] }
  });
  const populatedPlan = planMigration(populated.snapshot(), historical, {});
  assert.equal(populatedPlan.populated, true);
  assert.equal(populatedPlan.status, "populated");
  assert.ok(populatedPlan.operations.length > 0);

  const beforePopulated = JSON.stringify(populated.snapshot());
  const refused = await runMigration(populated, populatedPlan, { confirmed: false });
  assert.equal(refused.status, "refused");
  assert.equal(JSON.stringify(populated.snapshot()), beforePopulated);
  assert.equal(populated.snapshot().subjects.some((record) => record.id === "other"), true);

  const accepted = await runMigration(populated, populatedPlan, { confirmed: true });
  assert.equal(accepted.status, "migrated");
  assert.equal(populated.snapshot().subjects.some((record) => record.id === "other"), true);

  const migrated = createMemoryStore();
  await runMigration(migrated, planMigration(migrated.snapshot(), historical, {}), { confirmed: true });
  const targetId = mapLegacyId("a");
  const initial = JSON.parse(JSON.stringify(migrated.snapshot()));
  initial.items.find((record) => record.id === targetId).title = "Contenu différent";
  const collidingStore = createMemoryStore({ initial });
  const collisionPlan = planMigration(collidingStore.snapshot(), historical, {});
  assert.equal(collisionPlan.status, "collision");
  assert.ok(collisionPlan.collisions.includes(targetId));
  const collisionOutcome = await runMigration(collidingStore, collisionPlan, { confirmed: true });
  assert.equal(collisionOutcome.status, "collision");
  assert.equal(collidingStore.snapshot().items.find((record) => record.id === targetId).title, "Contenu différent");
});

test("4.1 mapLegacyId is deterministic and injective and parent references follow it", () => {
  assert.equal(mapLegacyId("a"), LEGACY_ID_PREFIX + "a");
  assert.equal(mapLegacyId("a"), mapLegacyId("a"));
  assert.notEqual(mapLegacyId("a"), mapLegacyId("b"));
  assert.equal(unmapLegacyId(mapLegacyId("a")), "a");

  const historical = fixture();
  const mapped = mapRecords(projectHistoricalDocument(historical));
  const child = mapped.items.find((record) => record.id === mapLegacyId("c"));
  assert.equal(child.parentId, mapLegacyId("b"));
  assert.equal(child.subjectId, mapLegacyId("s1"));
  assert.equal(mapped.items.find((record) => record.id === mapLegacyId("b")).parentId, null);
  assert.deepEqual(reproduceHistoricalDocument(unmapRecords(mapped)), historical);
});

test("5.1 no migration path erases the source and export stays usable", async () => {
  const historical = fixture();
  const raw = JSON.stringify(historical);
  const storage = fakeStorage({
    [STORAGE_KEY]: raw,
    [RESUME_KEY]: JSON.stringify({ subjectId: "s1", itemId: "a" })
  });
  const detected = detectHistoricalDocument(storage);
  const records = projectHistoricalDocument(detected.document);
  const plan = planMigration(emptyRecords(), detected.document, {});

  await runMigration(createMemoryStore(), plan, { confirmed: false });
  assert.equal(storage.getItem(STORAGE_KEY), raw);

  const failing = createMemoryStore({ failCommit: true });
  const failed = await runMigration(failing, plan, { confirmed: true });
  assert.equal(failed.status, "failed");
  assert.equal(storage.getItem(STORAGE_KEY), raw);

  await runMigration(createMemoryStore(), plan, { confirmed: true });
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(exportDocument(records), historical);

  const source = read("site/migration.js");
  assert.doesNotMatch(source, /removeItem/);
  assert.doesNotMatch(source, /deleteDatabase/);
});

test("5.2 a destination change aborts before the commit and leaves both sides unchanged", async () => {
  const historical = fixture();
  const store = createMemoryStore();
  const spy = spyStore(store);
  const plan = planMigration(store.snapshot(), historical, {
    destination: "https://a.dexie.cloud",
    currentDestination: "https://a.dexie.cloud"
  });
  const before = JSON.stringify(store.snapshot());
  const outcome = await runMigration(
    spy,
    plan,
    { confirmed: true, destination: "https://a.dexie.cloud" },
    () => "https://b.dexie.cloud"
  );
  assert.equal(outcome.status, "destination-changed");
  assert.equal(spy.calls, 0);
  assert.equal(JSON.stringify(store.snapshot()), before);
  assert.equal(store.snapshot().subjects.length, 0);
});

test("5.3 a destination change alone produces no plan and copies nothing", () => {
  const historical = fixture();
  const source = createMemoryStore();
  const target = createMemoryStore();
  const plan = planMigration(target.snapshot(), historical, {
    destination: "https://new.dexie.cloud",
    currentDestination: "https://old.dexie.cloud"
  });
  assert.equal(plan.status, "destination-changed");
  assert.equal(plan.operations.length, 0);
  assert.deepEqual(target.snapshot(), emptyRecords());
  assert.deepEqual(source.snapshot(), emptyRecords());
});

test("6.1 app wiring keeps the consent gate before the commit and core.js pure", () => {
  const app = read("site/app.js");
  assert.match(app, /from "\.\/migration\.js"/);
  assert.match(app, /detectHistoricalDocument\(localStorage\)/);
  assert.match(app, /describeMigration\(/);
  assert.match(app, /planMigration\(/);
  assert.match(app, /runMigration\(/);
  assert.match(app, /nonOverwritingMigrationAdapter\(\)/);
  assert.match(app, /operation\.type === "add"/);
  assert.match(app, /confirmed: true/);
  assert.match(app, /migration-refuse/);
  assert.ok(
    app.indexOf("describeMigration(") < app.indexOf("runMigration("),
    "the disclosure must precede the execution wiring"
  );

  const migration = read("site/migration.js");
  const consentIndex = migration.indexOf("consentConfirmed(consent)");
  const commitIndex = migration.indexOf("adapter.commit(plan.operations)");
  assert.notEqual(consentIndex, -1);
  assert.notEqual(commitIndex, -1);
  assert.ok(consentIndex < commitIndex, "consent must be checked before the commit");

  const core = read("site/core.js");
  assert.doesNotMatch(core, /\bfetch\s*\(/);
  assert.doesNotMatch(core, /XMLHttpRequest/);
  assert.doesNotMatch(core, /localStorage/);
  assert.doesNotMatch(core, /indexedDB/);
  assert.doesNotMatch(core, /\bwindow\b/);
  assert.doesNotMatch(core, /\bdocument\.(?:createElement|querySelector|getElementById|addEventListener|body)\b/);
});

test("6.2 the developer guide and MVP describe the migration guarantees", () => {
  const guide = read("docs/product/developer-guide.md");
  assert.match(guide, /site\/migration\.js/);
  assert.match(guide, /consentement/i);
  assert.match(guide, /idempotent/i);
  assert.match(guide, /non destructive|non-destructive/i);

  const mvp = read("docs/product/mvp.md");
  assert.match(mvp, /TS-026/);
  assert.match(mvp, /migration/i);
});
