import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STORAGE_KEY, emptyDocument, newSubject, newItem, parseDocument } from "../site/core.js";
import { documentToRecords, recordsToDocument, createMemoryStore } from "../site/persistence.js";
import {
  EXPORT_KIND,
  classifyProvenance,
  describeProvenanceInterpretations,
  mapRecords,
  normalizeProvenance,
  unmapRecords
} from "../site/migration.js";
import {
  LOCAL_MIGRATION_STATUS,
  detectLocalSource,
  detectSourceText,
  planLocalConversion,
  projectLocalRecords,
  runLocalConversion,
  writeLocalProvenance
} from "../site/local-migration.js";
import { planReconciliation, mapSourceDocument } from "../site/migration-reconciliation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const raw = (exportKind) => ({ exportKind, idsCanonical: exportKind !== EXPORT_KIND.V1_RAW ? true : false, mappingVersion: 1 });
const clone = (value) => JSON.parse(JSON.stringify(value));

function document5x19() {
  const document = emptyDocument();
  const specs = [
    ["legacy:legacy:s1", 4],
    ["legacy:s2", 4],
    ["legacy:s3", 4],
    ["legacy:s4", 4],
    ["legacy:s5", 2]
  ];
  for (const [id, count] of specs) {
    const subject = newSubject("Sujet " + id, id);
    for (let index = 1; index <= count; index += 1) {
      subject.items.push(newItem("Tâche " + id + "-" + index, "normal", "legacy:" + id + "-i" + index));
    }
    document.subjects.push(subject);
  }
  return document;
}

function fixture5x19() {
  const document = document5x19();
  const records = mapRecords(documentToRecords(document), { provenance: raw(EXPORT_KIND.V1_RAW) });
  records.items.push({
    id: "legacy:orphan",
    subjectId: "legacy:s1",
    parentId: null,
    title: "Tâche Android orpheline",
    note: "Note conservée",
    priority: "urgent",
    done: false,
    order: 99
  });
  return records;
}

test("TS-035 provenance: raw, projected and historical sources are classified explicitly", () => {
  assert.equal(classifyProvenance({}, { provenance: raw(EXPORT_KIND.V1_RAW) }).exportKind, EXPORT_KIND.V1_RAW);
  assert.equal(classifyProvenance({}, { provenance: raw(EXPORT_KIND.INDEXEDDB_EXPORT) }).exportKind,
    EXPORT_KIND.INDEXEDDB_EXPORT);
  assert.equal(classifyProvenance({}, { provenance: raw(EXPORT_KIND.PROJECTED) }).exportKind, EXPORT_KIND.PROJECTED);
  assert.equal(classifyProvenance({}, { provenance: raw(EXPORT_KIND.LEGACY_DOUBLE) }).exportKind,
    EXPORT_KIND.LEGACY_DOUBLE);
  assert.equal(classifyProvenance({}, {}).exportKind, EXPORT_KIND.UNKNOWN);
  assert.equal(classifyProvenance({}, { provenance: { exportKind: "made-up" } }).exportKind, EXPORT_KIND.UNKNOWN);
  assert.equal(classifyProvenance({}, { provenance: { exportKind: "v1-raw", idsCanonical: true } }).exportKind,
    EXPORT_KIND.UNKNOWN);
  assert.equal(normalizeProvenance({ exportKind: "v1-raw", idsCanonical: false }).exportKind, EXPORT_KIND.V1_RAW);
  assert.equal(normalizeProvenance({ exportKind: "v1-raw", idsCanonical: true }), null);
});

test("TS-035 provenance: a raw identifier that literally starts with legacy is prefixed once", () => {
  const document = {
    version: 1,
    subjects: [{
      id: "legacy:s1",
      title: "Brut",
      items: [{ id: "legacy:i1", title: "T", priority: "normal", done: false, parentId: null }]
    }]
  };
  const projected = mapSourceDocument(document, { provenance: raw(EXPORT_KIND.V1_RAW) });
  assert.equal(projected.subjects[0].id, "legacy:legacy:s1");
  assert.equal(projected.items[0].subjectId, "legacy:legacy:s1");
  assert.equal(projected.items[0].id, "legacy:legacy:i1");

  const ambiguous = classifyProvenance(document, {});
  assert.equal(ambiguous.exportKind, EXPORT_KIND.UNKNOWN);
  const interpretations = describeProvenanceInterpretations(document);
  assert.equal(interpretations.find((entry) => entry.exportKind === EXPORT_KIND.V1_RAW).wouldCreateDoublePrefix, 2);
  assert.equal(interpretations.find((entry) => entry.exportKind === EXPORT_KIND.INDEXEDDB_EXPORT).wouldCreateDoublePrefix, 0);
});

test("TS-035 provenance: unmarked sources stay ambiguous whether or not they are prefixed", () => {
  for (const document of [document5x19(), document5x19WithPlainIds()]) {
    assert.equal(classifyProvenance(document, {}).exportKind, EXPORT_KIND.UNKNOWN);
    const plan = planReconciliation({ document, target: { subjects: [], items: [] }, destination: {}, userId: null });
    assert.equal(plan.status, "ambiguous-provenance");
    assert.equal(plan.operations.length, 0);
    assert.equal(plan.ambiguous, true);
    assert.ok(plan.interpretations.length >= 2);
  }
});

function document5x19WithPlainIds() {
  const document = emptyDocument();
  document.subjects.push(newSubject("Projet", "p1"));
  document.subjects[0].items.push(newItem("T", "normal", "t1"));
  return document;
}

test("TS-035 provenance: local and Cloud paths share the same canonical identity result", () => {
  const document = document5x19WithPlainIds();
  const provenance = raw(EXPORT_KIND.V1_RAW);
  const local = projectLocalRecords(document, provenance);
  const cloud = mapSourceDocument(document, { provenance });
  const rerun = projectLocalRecords(document, provenance);
  assert.deepEqual(local, cloud);
  assert.deepEqual(local, rerun);
  assert.equal(JSON.stringify(local).includes("legacy:legacy:legacy:"), false);

  const projectedDocument = {
    version: 1,
    subjects: [{ id: "legacy:s1", title: "Déjà projeté", items: [
      { id: "legacy:i1", title: "T", priority: "normal", done: false, parentId: null }
    ] }]
  };
  const keptLocal = projectLocalRecords(projectedDocument, raw(EXPORT_KIND.PROJECTED));
  const keptCloud = mapSourceDocument(projectedDocument, { provenance: raw(EXPORT_KIND.PROJECTED) });
  assert.deepEqual(keptLocal, keptCloud);
  assert.equal(keptLocal.subjects[0].id, "legacy:s1");
  assert.equal(keptLocal.items[0].subjectId, "legacy:s1");
  assert.equal(JSON.stringify(keptLocal).includes("legacy:legacy:"), false);
});

test("TS-035 provenance: exports with provenance round-trip and stay V1 readable", () => {
  const document = document5x19WithPlainIds();
  const exported = {
    version: 1,
    provenance: {
      exportKind: "indexeddb-export",
      format: "threadstep.v1",
      mappingVersion: 1,
      idsCanonical: true
    },
    ...recordsToDocument(mapRecords(documentToRecords(document), { provenance: raw(EXPORT_KIND.V1_RAW) }))
  };
  const parsed = parseDocument(JSON.stringify(exported));
  assert.equal(parsed.provenance.exportKind, "indexeddb-export");
  assert.equal(JSON.stringify(parsed.provenance).includes("Sujet"), false);
  assert.equal(JSON.stringify(parsed.provenance).includes("Note"), false);
  assert.equal(classifyProvenance(parsed, {}).exportKind, EXPORT_KIND.INDEXEDDB_EXPORT);

  const projected = mapSourceDocument(parsed);
  assert.equal(projected.subjects[0].id, "legacy:p1");
  assert.equal(projected.items[0].subjectId, "legacy:p1");
  assert.equal(JSON.stringify(projected).includes("legacy:legacy:p1"), false);
});

test("TS-035 provenance: local conversion refuses unmarked sources with zero writes", async () => {
  for (const source of [detectSourceText(JSON.stringify(document5x19())),
    detectSourceText(JSON.stringify(document5x19WithPlainIds()))]) {
    const target = createMemoryStore();
    const plan = planLocalConversion({ source, target: target.snapshot() });
    assert.equal(plan.status, LOCAL_MIGRATION_STATUS.AMBIGUOUS_PROVENANCE);
    assert.equal(plan.operations.length, 0);
    assert.equal(plan.fingerprint, null);
    assert.ok(plan.interpretations.length >= 2);
    assert.deepEqual(target.snapshot(), { subjects: [], items: [] });
  }
});

test("TS-035 provenance: historical key supplies a raw context only without prefixed identifiers", async () => {
  const plain = document5x19WithPlainIds();
  const storage = {
    getItem: () => JSON.stringify(plain)
  };
  const source = detectLocalSource(storage);
  assert.equal(source.context, "historical-key");
  const plan = planLocalConversion({
    source,
    target: { subjects: [], items: [] },
    provenance: undefined
  });
  assert.equal(plan.status, LOCAL_MIGRATION_STATUS.READY);
  assert.equal(plan.projected.subjects[0].id, "legacy:p1");
  assert.equal(plan.operations.length, 2);

  const prefixed = { ...plain };
  prefixed.subjects[0].id = "legacy:p1";
  const prefixedPlan = planLocalConversion({
    source: detectLocalSource({ getItem: () => JSON.stringify(prefixed) }),
    target: { subjects: [], items: [] }
  });
  assert.equal(prefixedPlan.status, LOCAL_MIGRATION_STATUS.AMBIGUOUS_PROVENANCE);
  assert.equal(prefixedPlan.operations.length, 0);
});

test("TS-035 provenance: explicit local choice maps once and repeats without duplicate", async () => {
  const document = document5x19WithPlainIds();
  const rawText = JSON.stringify(document);
  const store = createMemoryStore();
  const adapter = {
    readSource: () => rawText,
    readTarget: () => store.snapshot(),
    commit: (operations) => store.commit(operations),
    writeProvenance: () => true
  };
  const source = { ...detectSourceText(rawText), context: "historical-key" };
  const plan = planLocalConversion({
    source,
    target: store.snapshot(),
    provenance: raw(EXPORT_KIND.V1_RAW)
  });
  assert.equal(plan.status, LOCAL_MIGRATION_STATUS.READY);
  const outcome = await runLocalConversion(adapter, plan, {
    confirmed: true,
    fingerprint: plan.fingerprint
  });
  assert.equal(outcome.status, LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE);
  assert.equal(store.snapshot().subjects[0].id, "legacy:p1");
  const rerun = planLocalConversion({
    source: detectLocalSource({ getItem: () => rawText }),
    target: store.snapshot()
  });
  assert.equal(rerun.status, LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED);
  assert.equal(rerun.operations.length, 0);
});

test("TS-035 provenance: changing the provenance choice invalidates the reviewed fingerprint", () => {
  const document = document5x19WithPlainIds();
  const target = { subjects: [], items: [] };
  const first = planReconciliation({
    document, target, destination: { url: "https://demo.dexie.cloud", remoteDbId: "r1" },
    userId: "u1", provenance: raw(EXPORT_KIND.V1_RAW)
  });
  const second = planReconciliation({
    document, target, destination: { url: "https://demo.dexie.cloud", remoteDbId: "r1" },
    userId: "u1", provenance: raw(EXPORT_KIND.PROJECTED)
  });
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.equal(first.provenance.exportKind, EXPORT_KIND.V1_RAW);
  assert.equal(second.provenance.exportKind, EXPORT_KIND.PROJECTED);
});

test("TS-035 Cloud import reproduces the defect through the shared UI mapping call", () => {
  const document = {
    version: 1,
    subjects: [{
      id: "legacy:s1",
      title: "Projet",
      items: [{
        id: "legacy:i1", title: "T", priority: "normal", done: false, parentId: null
      }, {
        id: "legacy:i2", title: "Sous-tâche", priority: "normal", done: false, parentId: "legacy:i1"
      }]
    }]
  };
  const projectedProvenance = raw(EXPORT_KIND.INDEXEDDB_EXPORT);
  const mapped = mapSourceDocument(document, { provenance: projectedProvenance });
  assert.equal(mapped.subjects[0].id, "legacy:s1");
  assert.equal(mapped.items[0].subjectId, "legacy:s1");
  assert.equal(mapped.items[1].parentId, "legacy:i1");
  assert.equal(JSON.stringify(mapped).includes("legacy:legacy:"), false);

  // The historical defect: mapping the same projected export as raw V1.
  const defect = mapSourceDocument(document, { provenance: raw(EXPORT_KIND.V1_RAW) });
  assert.equal(defect.subjects[0].id, "legacy:legacy:s1");
  assert.equal(defect.items[0].subjectId, "legacy:legacy:s1");

  const target = { subjects: clone(mapped.subjects), items: clone(mapped.items) };
  const plan = planReconciliation({
    document,
    target,
    destination: { url: "https://demo.dexie.cloud", remoteDbId: "r1" },
    userId: "u1",
    provenance: projectedProvenance
  });
  assert.equal(plan.status, "already-migrated");
  assert.equal(plan.operations.length, 0);
  assert.equal(JSON.stringify(plan.operations).includes("legacy:legacy:"), false);

  const again = planReconciliation({
    document,
    target,
    destination: { url: "https://demo.dexie.cloud", remoteDbId: "r1" },
    userId: "u1",
    provenance: projectedProvenance
  });
  assert.equal(again.operations.length, 0);
});

test("TS-035 import matrix: raw, projected, historical, mixed, partial, nested, rights and Cloud-only", () => {
  const plain = document5x19WithPlainIds();
  plain.subjects[0].items.push(newItem("Enfant", "normal", "t2", "t1"));
  const rawProvenance = raw(EXPORT_KIND.V1_RAW);
  const mapped = mapSourceDocument(plain, { provenance: rawProvenance });
  const destination = { url: "https://demo.dexie.cloud", remoteDbId: "r1", rightsAvailable: true, realmsAvailable: true };
  const cloudOnly = {
    subjects: [{ id: "cloud-only", title: "Cloud seulement", order: 9, owner: "o", realmId: "r" }],
    items: [{ id: "cloud-item", subjectId: "cloud-only", parentId: null, title: "Cloud",
      priority: "normal", done: false, order: 0 }]
  };
  const partial = {
    subjects: [clone(mapped.subjects[0]), ...clone(cloudOnly.subjects)],
    items: clone(mapped.items).filter((record) => record.id !== "legacy:t2").concat(clone(cloudOnly.items))
  };
  const partialBefore = JSON.stringify(partial);
  const rawPlan = planReconciliation({
    document: plain, target: partial, destination, userId: "u1", provenance: rawProvenance
  });
  assert.ok(rawPlan.operations.every((operation) => operation.type === "add"));
  assert.equal(rawPlan.operations.some((operation) => operation.store === "subjects" &&
    operation.value.id === "legacy:p1"), false);
  assert.equal(JSON.stringify(partial), partialBefore);

  const nested = rawPlan.operations.find((operation) => operation.value.id === "legacy:t2");
  assert.equal(nested.value.parentId, "legacy:t1");
  assert.equal(nested.value.subjectId, "legacy:p1");

  const projectedDocument = {
    version: 1,
    provenance: { exportKind: "indexeddb-export", idsCanonical: true, mappingVersion: 1 },
    subjects: [{ id: "legacy:s1", title: "Déjà", items: [
      { id: "legacy:i1", title: "T", priority: "normal", done: false, parentId: null }
    ] }]
  };
  const projectedTarget = mapSourceDocument(projectedDocument);
  const projectedPlan = planReconciliation({
    document: projectedDocument,
    target: projectedTarget,
    destination,
    userId: "u1",
    provenance: { exportKind: "indexeddb-export", idsCanonical: true, mappingVersion: 1 }
  });
  assert.equal(projectedPlan.status, "already-migrated");
  assert.equal(projectedPlan.operations.length, 0);
  assert.equal(JSON.stringify(projectedPlan.operations).includes("legacy:legacy:"), false);

  const doubleDocument = {
    version: 1,
    subjects: [{ id: "legacy:legacy:s1", title: "Historique", items: [
      { id: "legacy:legacy:i1", title: "T", priority: "normal", done: false, parentId: null }
    ] }]
  };
  const doubleProvenance = { exportKind: "legacy-double", idsCanonical: true, mappingVersion: 1 };
  const doubleTarget = mapSourceDocument(doubleDocument, { provenance: doubleProvenance });
  const doublePlan = planReconciliation({
    document: doubleDocument,
    target: doubleTarget,
    destination,
    userId: "u1",
    provenance: doubleProvenance
  });
  assert.equal(doublePlan.status, "already-migrated");
  assert.equal(doublePlan.operations.length, 0);
  assert.equal(doubleTarget.subjects[0].id, "legacy:legacy:s1");

  const mixed = {
    version: 1,
    provenance: { exportKind: "indexeddb-export", idsCanonical: true, mappingVersion: 1 },
    subjects: [
      { id: "legacy:s1", title: "Ancien", items: [] },
      { id: "new-subject", title: "Nouveau", items: [] }
    ]
  };
  const mixedTarget = {
    subjects: [
      { id: "legacy:s1", title: "Ancien", order: 0 },
      { id: "legacy:legacy:s1", title: "Variante", order: 1 },
      { id: "cloud-only", title: "Cloud", order: 2 }
    ],
    items: []
  };
  const mixedBefore = JSON.stringify(mixedTarget);
  const mixedPlan = planReconciliation({
    document: mixed,
    target: mixedTarget,
    destination,
    userId: "u1",
    provenance: { exportKind: "indexeddb-export", idsCanonical: true, mappingVersion: 1 }
  });
  assert.deepEqual(mixedPlan.operations.map((operation) => operation.value.id), ["new-subject"]);
  assert.equal(mixedPlan.operations.some((operation) => operation.type !== "add"), false);
  assert.equal(JSON.stringify(mixedTarget), mixedBefore);
  assert.equal(mixedPlan.destination.remoteDbId, "r1");
});
