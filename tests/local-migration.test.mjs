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
  parseDocument,
  parseResumePreference,
  serializeResumePreference,
  resumeView
} from "../site/core.js";
import {
  SUBJECTS_STORE,
  ITEMS_STORE,
  emptyRecords,
  documentToRecords,
  recordsToDocument,
  exportDocument,
  createMemoryStore
} from "../site/persistence.js";
import { mapLegacyId } from "../site/migration.js";
import { sha256Hex } from "../site/fingerprint.js";
import {
  LOCAL_MIGRATION_KEY,
  LOCAL_TARGET,
  MAPPING_VERSION,
  LOCAL_MIGRATION_STATUS,
  buildLocalProvenance,
  detectLocalSource,
  detectSourceText,
  isLocalCompletion,
  localConversionState,
  parseLocalProvenance,
  planLocalConversion,
  projectLocalRecords,
  readLocalProvenance,
  remapResumePreference,
  runLocalConversion,
  writeLocalProvenance
} from "../site/local-migration.js";
import { availableLocalBackup } from "../site/local-recovery.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

function fixture() {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(
    newItem("A", "urgent", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c", "b"),
    newItem("D", "later", "d")
  );
  subject.items[0].note = "Note A\nligne 2";
  subject.items[3].done = true;
  document.subjects.push(subject);
  const second = newSubject("Autre", "s2");
  second.items.push(newItem("E", "normal", "e"));
  document.subjects.push(second);
  return document;
}

function bigFixture() {
  const document = emptyDocument();
  const specs = [
    ["s1", ["a1", "a2", "a3", "a4"], { a2: "a1", a3: "a1", note: "a1" }],
    ["s2", ["b1", "b2", "b3", "b4"], { b2: "b1", b4: "b1", note: "b3" }],
    ["s3", ["c1", "c2", "c3", "c4"], { c2: "c1", c3: "c1", note: "c4" }],
    ["s4", ["d1", "d2", "d3"], { d3: "d2", note: "d2" }],
    ["s5", ["e1", "e2", "e3"], { e2: "e1", note: "e1" }]
  ];
  const priorities = ["urgent", "normal", "later"];
  specs.forEach(([subjectId, ids, relations], subjectIndex) => {
    const subject = newSubject("Sujet " + subjectId, subjectId);
    ids.forEach((id, itemIndex) => {
      const item = newItem("Étape " + id, priorities[(subjectIndex + itemIndex) % 3], id,
        relations[id] === undefined ? null : relations[id]);
      if (relations.note === id) item.note = "Note " + id + "\nDétail";
      if (itemIndex === ids.length - 1) item.done = subjectIndex % 2 === 0;
      subject.items.push(item);
    });
    document.subjects.push(subject);
  });
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

function harness(options = {}) {
  const raw = options.raw === undefined ? JSON.stringify(options.document || fixture()) : options.raw;
  const storage = fakeStorage(raw === null ? {} : { [STORAGE_KEY]: raw });
  if (options.resume !== undefined) {
    storage.setItem(RESUME_KEY, options.resume);
  }
  const store = options.store || createMemoryStore();
  const calls = { commits: 0, provenance: [], preferences: [] };
  const adapter = {
    readSource: () => storage.getItem(STORAGE_KEY),
    readTarget: () => store.snapshot(),
    commit(operations) {
      calls.commits += 1;
      return store.commit(operations);
    },
    writeProvenance(record) {
      calls.provenance.push(record);
      return writeLocalProvenance(storage, record);
    },
    writeResumePreference(value) {
      calls.preferences.push(value);
      const serialized = serializeResumePreference(value);
      storage.setItem(RESUME_KEY, serialized);
    }
  };
  return { raw, storage, store, calls, adapter };
}

function planFor(context, preference) {
  return planLocalConversion({
    source: detectLocalSource(context.storage),
    target: context.store.snapshot(),
    resumePreference: preference === undefined
      ? parseResumePreference(context.storage.getItem(RESUME_KEY))
      : preference
  });
}

function functionSource(source, name) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "function " + name + " must exist");
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("1.1 fingerprint module keeps the known SHA-256 vector and is re-exported", () => {
  const vector = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal(sha256Hex("abc"), vector);
  const reconciliation = read("site/migration-reconciliation.js");
  assert.match(reconciliation, /from "\.\/fingerprint\.js"/);
  assert.match(reconciliation, /export \{ sha256Hex \}/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", resolve(root, "site/fingerprint.js")]));
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", resolve(root, "site/migration-reconciliation.js")]));
});

test("1.2 detection returns raw, parsed document and exact-string fingerprint", () => {
  const document = fixture();
  const raw = JSON.stringify(document);
  const detected = detectLocalSource(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.equal(detected.status, LOCAL_MIGRATION_STATUS.PRESENT);
  assert.equal(detected.raw, raw);
  assert.deepEqual(detected.document, document);
  assert.equal(detected.fingerprint, sha256Hex(raw));
  assert.notEqual(detected.fingerprint, sha256Hex(JSON.stringify(document, null, 2)));

  assert.equal(detectLocalSource(fakeStorage()).status, LOCAL_MIGRATION_STATUS.ABSENT);
  assert.equal(detectLocalSource(fakeStorage({ [STORAGE_KEY]: "{broken" })).status, LOCAL_MIGRATION_STATUS.INVALID);
  assert.equal(detectLocalSource(fakeStorage({
    [STORAGE_KEY]: JSON.stringify({ version: 2, subjects: [] })
  })).status, LOCAL_MIGRATION_STATUS.INVALID);
  assert.equal(detectLocalSource(null).status, LOCAL_MIGRATION_STATUS.UNAVAILABLE);
  assert.equal(detectLocalSource({ getItem() { throw new Error("boom"); } }).status, LOCAL_MIGRATION_STATUS.UNREADABLE);
  assert.equal(detectSourceText(undefined).status, LOCAL_MIGRATION_STATUS.ABSENT);
});

test("1.2 invalid, absent and unreadable values produce no plan and no target write", () => {
  const cases = [
    detectSourceText("{broken"),
    detectSourceText(null),
    detectSourceText(JSON.stringify({ version: 1, subjects: [{ id: "s", title: "S", items: [{ id: "c", title: "C", priority: "normal", done: false, parentId: "missing" }] }] })),
    { status: LOCAL_MIGRATION_STATUS.UNREADABLE, raw: null, document: null, fingerprint: null, message: "illisible" },
    { status: LOCAL_MIGRATION_STATUS.UNAVAILABLE, raw: null, document: null, fingerprint: null, message: "absent" }
  ];
  const store = createMemoryStore({ initial: { subjects: [{ id: "existing", title: "Existant", order: 0 }], items: [] } });
  const before = JSON.stringify(store.snapshot());
  for (const source of cases) {
    const plan = planLocalConversion({ source, target: store.snapshot() });
    assert.notEqual(plan.status, LOCAL_MIGRATION_STATUS.READY);
    assert.equal(plan.operations.length, 0);
    assert.equal(plan.fingerprint, null);
    assert.equal(JSON.stringify(store.snapshot()), before);
  }
});

test("1.3 npm run check parses the new modules", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /node --check site\/fingerprint\.js/);
  assert.match(pkg.scripts.check, /node --check site\/local-migration\.js/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", resolve(root, "site/local-migration.js")]));
});

test("2.1 local mapping is lossless and never prefixes an already mapped identifier twice", () => {
  const document = bigFixture();
  const projected = projectLocalRecords(document);
  assert.equal(projected.subjects.length, 5);
  assert.equal(projected.items.length, 18);
  assert.equal(JSON.stringify(projected).includes("legacy:legacy:"), false);

  const child = projected.items.find((record) => record.id === mapLegacyId("a2"));
  assert.equal(child.parentId, mapLegacyId("a1"));
  assert.equal(child.subjectId, mapLegacyId("s1"));
  const noted = projected.items.find((record) => record.id === mapLegacyId("a1"));
  assert.equal(noted.note, "Note a1\nDétail");
  const done = projected.items.find((record) => record.id === mapLegacyId("a4"));
  assert.equal(done.done, true);
  assert.equal(done.priority, "urgent");
  const orders = projected.items.filter((record) => record.subjectId === mapLegacyId("s1")).map((record) => record.order);
  assert.deepEqual(orders, [0, 1, 2, 3]);

  const alreadyMapped = {
    version: 1,
    subjects: [{
      id: "legacy:s1",
      title: "Déjà converti",
      items: [
        { id: "legacy:a1", title: "A", priority: "normal", done: false, parentId: null },
        { id: "legacy:a2", title: "B", priority: "normal", done: false, parentId: "legacy:a1" }
      ]
    }]
  };
  const again = projectLocalRecords(parseDocument(JSON.stringify(alreadyMapped)));
  assert.equal(again.subjects[0].id, "legacy:s1");
  assert.equal(again.items[1].id, "legacy:a2");
  assert.equal(again.items[1].parentId, "legacy:a1");
  assert.equal(JSON.stringify(again).includes("legacy:legacy:"), false);
});

test("2.2 plan classifies ready, populated, already-migrated and collision without side effects", async () => {
  const context = harness();
  const ready = planFor(context);
  assert.equal(ready.status, LOCAL_MIGRATION_STATUS.READY);
  assert.equal(ready.operations.length, 7);
  for (const operation of ready.operations) {
    assert.ok([SUBJECTS_STORE, ITEMS_STORE].includes(operation.store));
    assert.equal(operation.type, "put");
  }
  assert.deepEqual(context.store.snapshot(), emptyRecords());
  assert.equal(context.calls.commits, 0);

  const invalid = planLocalConversion({ source: detectSourceText("{"), target: context.store.snapshot() });
  assert.equal(invalid.status, LOCAL_MIGRATION_STATUS.INVALID);
  assert.equal(invalid.operations.length, 0);

  const populatedStore = createMemoryStore({
    initial: {
      subjects: [{ id: "own", title: "Propre", order: 0 }],
      items: [{ id: "own-item", subjectId: "own", parentId: null, title: "I", priority: "normal", done: false, order: 0 }]
    }
  });
  const populated = planLocalConversion({
    source: detectLocalSource(context.storage),
    target: populatedStore.snapshot()
  });
  assert.equal(populated.status, LOCAL_MIGRATION_STATUS.POPULATED);
  assert.equal(populated.populated, true);
  assert.equal(populated.operations.length, 7);

  const outcome = await runLocalConversion(context.adapter, ready, {
    confirmed: true,
    fingerprint: ready.fingerprint
  });
  assert.equal(outcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  const rerun = planFor(context);
  assert.equal(rerun.status, LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED);
  assert.equal(rerun.alreadyMigrated, true);
  assert.equal(rerun.operations.length, 0);

  const collidingStore = createMemoryStore({ initial: context.store.snapshot() });
  const collisionId = mapLegacyId("a");
  const wrong = collidingStore.snapshot();
  wrong.items.find((record) => record.id === collisionId).title = "Contenu différent";
  await collidingStore.commit([{ type: "put", store: ITEMS_STORE, value: wrong.items.find((record) => record.id === collisionId) }]);
  const collision = planLocalConversion({
    source: detectLocalSource(context.storage),
    target: collidingStore.snapshot()
  });
  assert.equal(collision.status, LOCAL_MIGRATION_STATUS.COLLISION);
  assert.deepEqual(collision.collisions, [collisionId]);
});

test("2.3 five subjects and eighteen steps survive reload with relations and business fields", async () => {
  const document = bigFixture();
  const context = harness({ document });
  const plan = planFor(context);
  assert.equal(plan.counts.subjects, 5);
  assert.equal(plan.counts.items, 18);
  const outcome = await runLocalConversion(context.adapter, plan, {
    confirmed: true,
    fingerprint: plan.fingerprint
  });
  assert.equal(outcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  assert.equal(context.calls.commits, 1);

  const snapshot = context.store.snapshot();
  const reloaded = createMemoryStore({ initial: snapshot }).snapshot();
  const reloadedDocument = recordsToDocument(reloaded);
  assert.equal(reloadedDocument.subjects.length, 5);
  assert.equal(reloadedDocument.subjects.reduce((count, subject) => count + subject.items.length, 0), 18);

  const expected = projectLocalRecords(document);
  for (const record of expected.subjects) {
    const actual = reloaded.subjects.find((entry) => entry.id === record.id);
    assert.deepEqual(actual, record);
  }
  for (const record of expected.items) {
    const actual = reloaded.items.find((entry) => entry.id === record.id);
    assert.deepEqual(actual, record);
  }
  assert.deepEqual(exportDocument(reloaded), (() => {
    const rebuilt = recordsToDocument(expected);
    return rebuilt;
  })());
  assert.equal(reloadedDocument.subjects[0].items.find((item) => item.id === mapLegacyId("a2")).parentId, mapLegacyId("a1"));
});

test("2.4 resume preference is remapped only when both references exist", async () => {
  const context = harness({ resume: JSON.stringify({ subjectId: "s1", itemId: "a" }) });
  const documented = detectLocalSource(context.storage).document;
  const remapped = remapResumePreference(documented, { subjectId: "s1", itemId: "a" });
  assert.deepEqual(remapped, { subjectId: mapLegacyId("s1"), itemId: mapLegacyId("a") });
  assert.equal(remapResumePreference(documented, { subjectId: "s1", itemId: "missing" }), null);
  assert.equal(remapResumePreference(documented, { subjectId: "missing", itemId: "a" }), null);

  const plan = planFor(context);
  assert.deepEqual(plan.resumePreference, remapped);
  const outcome = await runLocalConversion(context.adapter, plan, {
    confirmed: true,
    fingerprint: plan.fingerprint
  });
  assert.equal(outcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  assert.equal(outcome.preferenceWritten, true);
  assert.deepEqual(context.calls.preferences, [remapped]);
  assert.deepEqual(parseResumePreference(context.storage.getItem(RESUME_KEY)), remapped);
  assert.ok(resumeView(recordsToDocument(context.store.snapshot()), remapped));
  assert.equal(JSON.stringify(context.store.snapshot()).includes(RESUME_KEY), false);
  assert.equal(JSON.stringify(exportDocument(context.store.snapshot())).includes(RESUME_KEY), false);

  const untouched = harness({ resume: JSON.stringify({ subjectId: "s2", itemId: "nope" }) });
  const untouchedPlan = planFor(untouched);
  assert.equal(untouchedPlan.resumePreference, null);
  const untouchedOutcome = await runLocalConversion(untouched.adapter, untouchedPlan, {
    confirmed: true,
    fingerprint: untouchedPlan.fingerprint
  });
  assert.equal(untouchedOutcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  assert.equal(untouchedOutcome.preferenceWritten, false);
  assert.equal(untouched.calls.preferences.length, 0);
  assert.equal(untouched.storage.getItem(RESUME_KEY), JSON.stringify({ subjectId: "s2", itemId: "nope" }));
});

test("3.1 consent, stale source and stale target each refuse to write", async () => {
  const refused = harness();
  const refusedPlan = planFor(refused);
  const refusedOutcome = await runLocalConversion(refused.adapter, refusedPlan, { confirmed: false });
  assert.equal(refusedOutcome.status, LOCAL_MIGRATION_STATUS.REFUSED);
  assert.equal(refused.calls.commits, 0);
  assert.equal(refused.calls.provenance.length, 0);
  assert.deepEqual(refused.store.snapshot(), emptyRecords());

  const mismatch = harness();
  const mismatchPlan = planFor(mismatch);
  const mismatchOutcome = await runLocalConversion(mismatch.adapter, mismatchPlan, {
    confirmed: true,
    fingerprint: "other-plan"
  });
  assert.equal(mismatchOutcome.status, LOCAL_MIGRATION_STATUS.CONSENT_MISMATCH);
  assert.equal(mismatch.calls.commits, 0);

  const staleSource = harness();
  const staleSourcePlan = planFor(staleSource);
  staleSource.storage.setItem(STORAGE_KEY, JSON.stringify(staleSource.document || fixture()) + " ");
  const staleSourceOutcome = await runLocalConversion(staleSource.adapter, staleSourcePlan, {
    confirmed: true,
    fingerprint: staleSourcePlan.fingerprint
  });
  assert.equal(staleSourceOutcome.status, LOCAL_MIGRATION_STATUS.STALE_SOURCE);
  assert.equal(staleSource.calls.commits, 0);
  assert.equal(staleSource.calls.provenance.length, 0);
  assert.deepEqual(staleSource.store.snapshot(), emptyRecords());

  const staleTarget = harness();
  const staleTargetPlan = planFor(staleTarget);
  await staleTarget.store.commit([{
    type: "put",
    store: SUBJECTS_STORE,
    value: { id: "other", title: "Autre", order: 0 }
  }]);
  const staleTargetOutcome = await runLocalConversion(staleTarget.adapter, staleTargetPlan, {
    confirmed: true,
    fingerprint: staleTargetPlan.fingerprint
  });
  assert.equal(staleTargetOutcome.status, LOCAL_MIGRATION_STATUS.STALE_PLAN);
  assert.equal(staleTarget.calls.commits, 0);
  assert.equal(staleTarget.calls.provenance.length, 0);
  assert.equal(staleTarget.store.snapshot().items.length, 0);
});

test("3.2 a failed transaction leaves target, provenance, preference and source intact", async () => {
  const store = createMemoryStore({ failCommit: true });
  const context = harness({
    store,
    resume: JSON.stringify({ subjectId: "s1", itemId: "a" })
  });
  const plan = planFor(context);
  const outcome = await runLocalConversion(context.adapter, plan, {
    confirmed: true,
    fingerprint: plan.fingerprint
  });
  assert.equal(outcome.status, LOCAL_MIGRATION_STATUS.FAILED);
  assert.equal(context.calls.commits, 1);
  assert.deepEqual(context.store.snapshot(), emptyRecords());
  assert.equal(context.calls.provenance.length, 0);
  assert.equal(context.calls.preferences.length, 0);
  assert.equal(readLocalProvenance(context.storage), null);
  assert.equal(context.storage.getItem(STORAGE_KEY), context.raw);
  assert.equal(availableLocalBackup(context.storage).json, context.raw);
});

test("3.3 provenance is stable local metadata with no business content", async () => {
  const context = harness();
  const plan = planFor(context);
  const outcome = await runLocalConversion(context.adapter, plan, {
    confirmed: true,
    fingerprint: plan.fingerprint
  });
  assert.equal(outcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  assert.equal(context.calls.provenance.length, 1);

  const provenance = readLocalProvenance(context.storage);
  assert.deepEqual(provenance, {
    version: 1,
    sourceKey: STORAGE_KEY,
    sourceFingerprint: plan.sourceFingerprint,
    mappingVersion: MAPPING_VERSION,
    target: LOCAL_TARGET,
    status: LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE,
    subjects: 2,
    items: 5
  });
  assert.equal(isLocalCompletion(provenance), true);
  assert.notEqual(provenance.status, "synced");
  assert.equal(JSON.stringify(provenance).includes("Projet"), false);
  assert.equal(JSON.stringify(provenance).includes("Note A"), false);
  assert.equal(JSON.stringify(exportDocument(context.store.snapshot())).includes(LOCAL_MIGRATION_KEY), false);
  assert.equal(JSON.stringify(provenance).includes("dexie.cloud"), false);

  const raw = context.storage.getItem(LOCAL_MIGRATION_KEY);
  assert.deepEqual(parseLocalProvenance(raw), provenance);
  assert.deepEqual(readLocalProvenance(context.storage), provenance);
  assert.deepEqual(buildLocalProvenance(plan), context.calls.provenance[0]);
  assert.equal(parseLocalProvenance("{broken"), null);
});

test("3.3 reload state distinguishes not-started, complete and uncertain", async () => {
  const context = harness();
  assert.deepEqual(localConversionState(context.storage, emptyRecords()), {
    status: "not-started",
    provenance: null
  });
  const plan = planFor(context);
  await runLocalConversion(context.adapter, plan, {
    confirmed: true,
    fingerprint: plan.fingerprint
  });
  const state = localConversionState(context.storage, context.store.snapshot());
  assert.equal(state.status, "complete");
  assert.deepEqual(state.provenance, readLocalProvenance(context.storage));

  const unmarked = harness();
  await unmarked.store.commit(plan.operations);
  const uncertain = localConversionState(unmarked.storage, unmarked.store.snapshot());
  assert.equal(uncertain.status, "uncertain");
  assert.equal(uncertain.provenance, null);
});

test("3.4 repeat, partial target and collision are non-destructive and idempotent", async () => {
  const context = harness();
  const firstPlan = planFor(context);
  await runLocalConversion(context.adapter, firstPlan, { confirmed: true, fingerprint: firstPlan.fingerprint });
  const afterFirst = context.store.snapshot();

  const secondPlan = planFor(context);
  assert.equal(secondPlan.status, LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED);
  assert.equal(secondPlan.operations.length, 0);
  const secondOutcome = await runLocalConversion(context.adapter, secondPlan, {
    confirmed: true,
    fingerprint: secondPlan.fingerprint
  });
  assert.equal(secondOutcome.status, LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED);
  assert.equal(context.calls.commits, 1);
  assert.deepEqual(context.store.snapshot(), afterFirst);

  const partial = harness();
  const projected = projectLocalRecords(detectLocalSource(partial.storage).document);
  const existingSubject = { ...projected.subjects[0] };
  const unrelated = { id: "own", title: "Propre", order: 0 };
  await partial.store.commit([
    { type: "put", store: SUBJECTS_STORE, value: existingSubject },
    { type: "put", store: SUBJECTS_STORE, value: unrelated }
  ]);
  const partialPlan = planFor(partial);
  assert.equal(partialPlan.status, LOCAL_MIGRATION_STATUS.POPULATED);
  const expectedMissing = projected.subjects.length + projected.items.length - 1;
  assert.equal(partialPlan.operations.length, expectedMissing);
  const partialOutcome = await runLocalConversion(partial.adapter, partialPlan, {
    confirmed: true,
    fingerprint: partialPlan.fingerprint
  });
  assert.equal(partialOutcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  assert.deepEqual(partial.store.snapshot().subjects.find((record) => record.id === "own"), unrelated);
  assert.deepEqual(partial.store.snapshot().subjects.find((record) => record.id === existingSubject.id), existingSubject);

  const collision = harness();
  const collisionPlan = planFor(collision);
  const collisionRecord = projectLocalRecords(detectLocalSource(collision.storage).document)
    .items.find((record) => record.id === mapLegacyId("a"));
  const conflicting = { ...collisionRecord, title: "Contenu local différent" };
  await collision.store.commit([{ type: "put", store: ITEMS_STORE, value: conflicting }]);
  const collisionRerun = planFor(collision);
  assert.equal(collisionRerun.status, LOCAL_MIGRATION_STATUS.COLLISION);
  assert.equal(collisionPlan.operations.length > 0, true);
  const collisionOutcome = await runLocalConversion(collision.adapter, collisionRerun, {
    confirmed: true,
    fingerprint: collisionRerun.fingerprint
  });
  assert.equal(collisionOutcome.status, LOCAL_MIGRATION_STATUS.COLLISION);
  assert.equal(collision.calls.commits, 0);
  assert.deepEqual(collision.store.snapshot().items.find((record) => record.id === mapLegacyId("a")), conflicting);
});

test("4.1 index and app expose an accessible consent-gated review surface", () => {
  const html = read("site/index.html");
  for (const id of [
    "local-convert-legacy",
    "local-conversion",
    "local-conversion-title",
    "local-conversion-source",
    "local-conversion-target",
    "local-conversion-plan",
    "local-conversion-fingerprint",
    "local-conversion-consent",
    "local-conversion-confirm",
    "local-conversion-refuse",
    "local-conversion-status"
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /aria-labelledby="local-conversion-title"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Je confirme la conversion locale/);
  assert.match(html, /Sans configuration Cloud|sans configuration Cloud/);

  const app = read("site/app.js");
  assert.match(app, /let localConversionContext = null;/);
  for (const name of ["renderLocalConversion", "openLocalConversion", "confirmLocalConversion"]) {
    assert.doesNotMatch(functionSource(app, name), /innerHTML/);
  }
  assert.match(functionSource(app, "renderLocalConversion"), /textContent/);
  const styles = read("site/styles.css");
  assert.match(styles, /\.local-conversion\{/);
  assert.match(styles, /\.local-conversion-consent/);
});

test("4.2 local confirmation uses the local store and no Cloud or network path", () => {
  const app = read("site/app.js");
  const open = functionSource(app, "openLocalConversion");
  assert.match(open, /businessStore\.read\(\)/);
  assert.match(open, /planLocalConversion\(/);
  const confirm = functionSource(app, "confirmLocalConversion");
  assert.match(confirm, /runLocalConversion\(localConversionAdapter\(\)/);
  assert.match(confirm, /refreshLocalDocument\(\)/);
  const adapter = functionSource(app, "localConversionAdapter");
  assert.match(adapter, /businessStore\.read\(\)/);
  assert.match(adapter, /businessStore\.commit\(operations\)/);
  const region = open + confirm + adapter;
  for (const forbidden of [
    /bootstrapSyncedDatabase/,
    /readAttestedTarget/,
    /db\.cloud/,
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/,
    /writeCloudConfig/,
    /bootstrapLocalDatabase/
  ]) {
    assert.doesNotMatch(region, forbidden);
  }
});

test("4.3 every outcome preserves the historical source and its export", async () => {
  const document = fixture();
  const outcomes = [];

  const refused = harness({ document });
  const refusedPlan = planFor(refused);
  outcomes.push([refused, refusedPlan, await runLocalConversion(refused.adapter, refusedPlan, { confirmed: false })]);

  const stale = harness({ document });
  const stalePlan = planFor(stale);
  stale.storage.setItem(STORAGE_KEY, JSON.stringify(document, null, 2));
  outcomes.push([stale, stalePlan, await runLocalConversion(stale.adapter, stalePlan, {
    confirmed: true,
    fingerprint: stalePlan.fingerprint
  })]);

  const collisionContext = harness({ document });
  const collisionPlan = planFor(collisionContext);
  const record = projectLocalRecords(document).items[0];
  await collisionContext.store.commit([{
    type: "put",
    store: ITEMS_STORE,
    value: { ...record, title: "Conflit" }
  }]);
  const collisionRerun = planFor(collisionContext);
  outcomes.push([collisionContext, collisionRerun, await runLocalConversion(collisionContext.adapter, collisionRerun, {
    confirmed: true,
    fingerprint: collisionRerun.fingerprint
  })]);

  const failing = harness({ document, store: createMemoryStore({ failCommit: true }) });
  const failingPlan = planFor(failing);
  outcomes.push([failing, failingPlan, await runLocalConversion(failing.adapter, failingPlan, {
    confirmed: true,
    fingerprint: failingPlan.fingerprint
  })]);

  const success = harness({ document });
  const successPlan = planFor(success);
  outcomes.push([success, successPlan, await runLocalConversion(success.adapter, successPlan, {
    confirmed: true,
    fingerprint: successPlan.fingerprint
  })]);

  for (const [context, plan, outcome] of outcomes) {
    const stored = context.storage.getItem(STORAGE_KEY);
    assert.equal(availableLocalBackup(context.storage).json, stored);
    if (context !== stale) assert.equal(stored, context.raw);
    if (outcome.status === LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE) {
      assert.equal(exportDocument(context.store.snapshot()).subjects.length, 2);
    } else {
      assert.equal(exportDocument(context.store.snapshot()).subjects.length, 0);
      assert.equal(typeof plan.sourceFingerprint, "string");
    }
  }

  const app = read("site/app.js");
  assert.match(app, /Conversion locale terminée/);
  assert.match(app, /Aucune synchronisation Cloud/);
  assert.match(app, /ne constitue pas une synchronisation Cloud/);
});

test("5.1 product documentation describes the explicit local conversion boundaries", () => {
  const guide = read("docs/product/developer-guide.md");
  assert.match(guide, /site\/local-migration\.js/);
  assert.match(guide, /conversion locale explicite/i);
  assert.match(guide, /5 sujets/);
  assert.match(guide, /18 étapes/);
  assert.match(guide, /non destructi/i);
  assert.match(guide, /TS-037/);

  for (const relative of [
    "docs/product/mvp.md",
    "docs/product/dexie-cloud-rollout.md",
    "docs/product/acceptance-checklist.md"
  ]) {
    const text = read(relative);
    assert.match(text, /TS-033/);
    assert.match(text, /5 sujets/);
    assert.match(text, /18 étapes/);
    assert.match(text, /non destructi/i);
    assert.match(text, /TS-037/);
    assert.match(text, /conversion locale/i);
  }
});

test("5.2 local conversion module and path contain no Cloud, OTP or network API", () => {
  const source = read("site/local-migration.js");
  for (const forbidden of [
    /from\s+["']\.\/dexie-foundation\.js["']/,
    /from\s+["']\.\/migration-reconciliation\.js["']/,
    /from\s+["']\.\/vendor\//,
    /bootstrapSyncedDatabase/,
    /readAttestedTarget/,
    /db\.cloud/,
    /dexieCloud/,
    /writeCloudConfig/,
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/,
    /WebSocket/,
    /navigator\./,
    /\botp\b/i,
    /transferQueue|pendingTransfers|syncQueue|enqueueTransfer/
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
  assert.doesNotMatch(source, /removeItem\(/);
  assert.doesNotMatch(source, /deleteDatabase/);

  const app = read("site/app.js");
  const region = functionSource(app, "localConversionAdapter") +
    functionSource(app, "confirmLocalConversion");
  for (const forbidden of [
    /bootstrapSyncedDatabase/,
    /readAttestedTarget/,
    /db\.cloud/,
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/
  ]) {
    assert.doesNotMatch(region, forbidden);
  }
});
