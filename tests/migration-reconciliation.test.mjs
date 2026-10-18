import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { emptyRecords } from "../site/persistence.js";
import {
  CATEGORY,
  QUOTAS,
  RECONCILIATION_STATUS,
  RESOLUTION,
  buildInventory,
  buildReconciliationView,
  computeDestinationFingerprint,
  computePlanFingerprint,
  computeSourceFingerprint,
  computeTargetFingerprint,
  computeUserFingerprint,
  describeAttestationReason,
  evaluateSyncAttestation,
  initialReconciliationStatus,
  mapSourceDocument,
  planReconciliation,
  reduceReconciliationStatus,
  runReconciliation,
  sha256Hex,
  withAttestedTarget
} from "../site/migration-reconciliation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const destination = { url: "https://demo.dexie.cloud", remoteDbId: "remote-1" };
const userId = "user-1";

function fixture5x18() {
  const document = emptyDocument();
  const counts = [4, 4, 3, 4, 3];
  counts.forEach((count, subjectIndex) => {
    const id = "s" + (subjectIndex + 1);
    const subject = newSubject("Sujet " + (subjectIndex + 1), id);
    for (let itemIndex = 1; itemIndex <= count; itemIndex += 1) {
      const item = newItem("Étape " + id + "-" + itemIndex, "normal", id + "-i" + itemIndex);
      if (itemIndex === 2) item.note = "Note " + id;
      if (itemIndex === 3) item.done = true;
      if (itemIndex === 1 && count >= 4) item.priority = "urgent";
      subject.items.push(item);
    }
    document.subjects.push(subject);
  });
  return document;
}

function mappedTarget(document, { metadata = true } = {}) {
  const target = clone(mapSourceDocument(document));
  if (metadata) {
    for (const record of [...target.subjects, ...target.items]) {
      record.owner = "private-owner";
      record.realmId = "private-realm";
      record.$ts = 123456;
      record.unknownMetadata = "ignored";
    }
  }
  return target;
}

function attested(overrides = {}) {
  const base = {
    online: true,
    user: { isLoggedIn: true, userId },
    syncState: { phase: "in-sync", status: "connected" },
    persistedSyncState: {
      initiallySynced: true,
      remoteDbId: "remote-1",
      serverRevision: 42,
      realms: [userId]
    },
    databaseUrl: destination.url
  };
  return {
    ...base,
    ...overrides,
    user: overrides.user === undefined ? base.user : overrides.user,
    syncState: overrides.syncState === undefined ? base.syncState : overrides.syncState,
    persistedSyncState: overrides.persistedSyncState === undefined ? base.persistedSyncState : overrides.persistedSyncState
  };
}

function plan(document, target, extra = {}) {
  return planReconciliation({
    document,
    target,
    destination,
    userId,
    resolutions: {},
    provenance: { exportKind: "v1-raw" },
    ...extra
  });
}

function targetWithOperations(target, operations) {
  const next = clone(target);
  for (const operation of operations) {
    const list = operation.store === "subjects" ? next.subjects : next.items;
    if (list.some((record) => record.id === operation.value.id)) throw new Error("collision");
    list.push(clone(operation.value));
  }
  return next;
}

function itemById(planValue, id) {
  return planValue.operations.find((operation) => operation.value.id === id);
}

test("1.1 the new module is checked by npm run check and parses", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /node --check site\/migration-reconciliation\.js/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", resolve(root, "site/migration-reconciliation.js")]));
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("1.2 metadata is ignored while every real business change is reported", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b"));
  subject.items[0].note = "Note A";
  document.subjects.push(subject, newSubject("Second", "s2"));
  const source = mapSourceDocument(document);
  const target = mappedTarget(document);
  const inventory = buildInventory(source, target);
  assert.equal(inventory.counts.subjects[CATEGORY.IDENTICAL], 2);
  assert.equal(inventory.counts.items[CATEGORY.IDENTICAL], 2);

  const subjectTarget = clone(target);
  subjectTarget.subjects[0].title = "Projet modifié";
  let result = buildInventory(source, subjectTarget);
  assert.equal(result.index.subjects.get("legacy:s1").category, CATEGORY.CONFLICT);
  assert.deepEqual(result.index.subjects.get("legacy:s1").fields, ["title"]);

  const itemChanges = [
    ["title", (record) => { record.title = "A cloud"; }],
    ["note", (record) => { record.note = "Note Cloud"; }],
    ["priority", (record) => { record.priority = "later"; }],
    ["done", (record) => { record.done = true; }],
    ["subjectId", (record) => { record.subjectId = "legacy:s2"; }],
    ["parentId", (record) => { record.parentId = "legacy:b"; }],
    ["order", (record) => { record.order = 9; }]
  ];
  for (const [field, mutate] of itemChanges) {
    const changed = clone(target);
    mutate(changed.items.find((record) => record.id === "legacy:a"));
    const changedInventory = buildInventory(source, changed);
    const entry = changedInventory.index.items.get("legacy:a");
    assert.equal(entry.category, CATEGORY.CONFLICT, field);
    assert.ok(entry.fields.includes(field), field + " must be reported: " + entry.fields.join(","));
  }

  const emptyNoteDocument = emptyDocument();
  const noNote = newSubject("Sans note", "s2");
  noNote.items.push(newItem("C", "normal", "c"));
  emptyNoteDocument.subjects.push(noNote);
  const noNoteSource = mapSourceDocument(emptyNoteDocument);
  const noNoteTarget = clone(noNoteSource);
  noNoteTarget.items[0].note = "";
  const noteInventory = buildInventory(noNoteSource, noNoteTarget);
  assert.ok(noteInventory.index.items.get("legacy:c").fields.includes("note"));
});

test("1.3 inventories are store-separated and classify the five categories", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "shared"), newItem("B", "normal", "b"));
  document.subjects.push(subject);
  const source = mapSourceDocument(document);
  const target = {
    subjects: [
      { id: "legacy:shared", title: "Sujet Cloud homonyme", order: 0 },
      { id: "cloud-subject", title: "Propriétaire Cloud", order: 1 }
    ],
    items: [{ id: "cloud-item", subjectId: "cloud-subject", parentId: null, title: "Cloud", priority: "normal", done: false, order: 0 }]
  };
  const inventory = buildInventory(source, target);
  assert.equal(inventory.index.items.get("legacy:shared").category, CATEGORY.ABSENT);
  assert.equal(inventory.index.subjects.get("legacy:shared").category, CATEGORY.CLOUD_ONLY);
  assert.equal(inventory.counts.subjects[CATEGORY.CLOUD_ONLY] >= 2, true);
  assert.equal(inventory.counts.items[CATEGORY.CLOUD_ONLY], 1);

  const duplicated = emptyDocument();
  duplicated.subjects.push(newSubject("Un", "dup"), newSubject("Deux", "dup"));
  const duplicateInventory = buildInventory(mapSourceDocument(duplicated), emptyRecords());
  assert.ok(duplicateInventory.counts.subjects[CATEGORY.INVALID] >= 1);
  const duplicatePlan = plan(duplicated, emptyRecords());
  assert.equal(duplicatePlan.indeterminate, true);
  assert.equal(duplicatePlan.operations.some((operation) => operation.value.id === "legacy:dup"), false);

  const danglingTarget = {
    subjects: [{ id: "legacy:s1", title: "Projet", order: 0 }],
    items: [{ id: "legacy:b", subjectId: "missing", parentId: null, title: "B", priority: "normal", done: false, order: 0 }]
  };
  const danglingInventory = buildInventory(source, danglingTarget);
  assert.equal(danglingInventory.counts.items[CATEGORY.INVALID], 1);
  const danglingPlan = plan(document, danglingTarget);
  assert.equal(danglingPlan.indeterminate, true);
});

test("1.4 relative order ignores Cloud-only interleaving but detects real reversals and places inserts", () => {
  const document = emptyDocument();
  document.subjects.push(newSubject("Un", "s1"), newSubject("Deux", "s2"), newSubject("Trois", "s3"));
  const source = mapSourceDocument(document);
  const reversed = {
    subjects: [
      { id: "legacy:s1", title: "Un", order: 0 },
      { id: "legacy:s3", title: "Trois", order: 1 },
      { id: "legacy:s2", title: "Deux", order: 2 }
    ],
    items: []
  };
  const reversedInventory = buildInventory(source, reversed);
  assert.equal(reversedInventory.index.subjects.get("legacy:s2").category, CATEGORY.CONFLICT);
  assert.ok(reversedInventory.index.subjects.get("legacy:s2").fields.includes("order"));

  const interleaved = {
    subjects: [
      { id: "legacy:s1", title: "Un", order: 0 },
      { id: "cloud-only", title: "Cloud", order: 1 },
      { id: "legacy:s2", title: "Deux", order: 2 },
      { id: "legacy:s3", title: "Trois", order: 3 }
    ],
    items: []
  };
  const interleavedInventory = buildInventory(source, interleaved);
  assert.equal(interleavedInventory.counts.subjects[CATEGORY.CONFLICT], 0);

  const onlySecond = {
    subjects: [{ id: "legacy:s2", title: "Deux", order: 5 }],
    items: []
  };
  const placed = plan(document, onlySecond);
  assert.equal(placed.status, "ready");
  const first = placed.operations.find((operation) => operation.value.id === "legacy:s1");
  const third = placed.operations.find((operation) => operation.value.id === "legacy:s3");
  assert.ok(first.value.order < 5);
  assert.ok(third.value.order > 5);

  const itemDocument = emptyDocument();
  const subject = newSubject("Projet", "p1");
  subject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b"));
  itemDocument.subjects.push(subject);
  const itemSource = mapSourceDocument(itemDocument);
  const itemTarget = clone(itemSource);
  itemTarget.items.find((record) => record.id === "legacy:a").order = 1;
  itemTarget.items.find((record) => record.id === "legacy:b").order = 0;
  const itemInventory = buildInventory(itemSource, itemTarget);
  assert.ok(itemInventory.index.items.get("legacy:a").fields.includes("order"));
  assert.ok(itemInventory.index.items.get("legacy:b").fields.includes("order"));
});

test("1.5 planning is deterministic and side-effect free", () => {
  const document = fixture5x18();
  const target = mappedTarget(document);
  target.items = target.items.slice(0, 5);
  const beforeDocument = JSON.stringify(document);
  const beforeTarget = JSON.stringify(target);
  const first = plan(document, target);
  const second = plan(document, target);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(document), beforeDocument);
  assert.equal(JSON.stringify(target), beforeTarget);
  const moduleSource = read("site/migration-reconciliation.js");
  assert.doesNotMatch(moduleSource, /\bfetch\s*\(|XMLHttpRequest|indexedDB|localStorage|document\.createElement|\bwindow\b/);
});

test("2.1 the native attestation is conservative and typed", () => {
  assert.deepEqual(evaluateSyncAttestation(attested()).attested, true);
  assert.equal(evaluateSyncAttestation(attested({ online: false })).reason, "offline");
  assert.equal(evaluateSyncAttestation(attested({ user: { isLoggedIn: false, userId } })).reason, "unauthenticated");
  assert.equal(evaluateSyncAttestation(attested({ user: null })).reason, "unauthenticated");
  assert.equal(evaluateSyncAttestation(attested({ databaseUrl: null })).reason, "destination-missing");
  assert.equal(evaluateSyncAttestation(attested({ syncState: { phase: "in-sync", status: "error" } })).reason, "sync-error");
  assert.equal(evaluateSyncAttestation(attested({ syncState: { phase: "in-sync", status: "disconnected" } })).reason, "sync-offline");
  assert.equal(evaluateSyncAttestation(attested({ syncState: { phase: "connecting", status: "connected" } })).reason, "initial-sync-pending");
  assert.equal(evaluateSyncAttestation(attested({
    persistedSyncState: { initiallySynced: false, remoteDbId: "remote-1", serverRevision: 1, realms: [userId] }
  })).reason, "initial-sync-pending");
  assert.equal(evaluateSyncAttestation(attested({
    persistedSyncState: { initiallySynced: true, serverRevision: 1, realms: [userId] }
  })).reason, "indeterminate");
  assert.equal(evaluateSyncAttestation(attested({
    persistedSyncState: { initiallySynced: true, remoteDbId: "remote-1", realms: [userId] }
  })).reason, "indeterminate");
  assert.equal(evaluateSyncAttestation(attested({
    persistedSyncState: { initiallySynced: true, remoteDbId: "remote-1", serverRevision: 1, realms: ["someone-else"] }
  })).reason, "session-mismatch");
  assert.equal(evaluateSyncAttestation(attested({ persistedSyncState: null })).reason, "indeterminate");
  assert.equal(evaluateSyncAttestation(attested({ syncState: null })).reason, "indeterminate");
  assert.equal(typeof describeAttestationReason("offline"), "string");
  assert.match(describeAttestationReason("offline"), /intact/i);
});

test("2.2 the target reader is called only after a successful attestation", async () => {
  let reads = 0;
  const reader = async () => { reads += 1; return emptyRecords(); };
  const blocked = await withAttestedTarget(attested({ online: false }), reader);
  assert.equal(blocked.status, "blocked");
  assert.equal(reads, 0);
  const ready = await withAttestedTarget(attested(), reader);
  assert.equal(ready.status, "ready");
  assert.equal(reads, 1);
});

test("2.3 a pending attestation or failed read never becomes an empty Cloud base", async () => {
  let reads = 0;
  const reader = async () => { reads += 1; return emptyRecords(); };
  const pending = await withAttestedTarget(attested({
    persistedSyncState: { initiallySynced: false, remoteDbId: "remote-1", serverRevision: 1, realms: [userId] }
  }), reader);
  assert.equal(pending.status, "blocked");
  assert.equal(pending.records, null);
  assert.equal(reads, 0);

  const failed = await withAttestedTarget(attested(), async () => {
    throw new Error("IDB read refused");
  });
  assert.equal(failed.status, "read-error");
  assert.equal(failed.records, null);
  assert.ok(failed.error);

  const document = fixture5x18();
  const wanted = [];
  const blockedPlan = await withAttestedTarget(attested({ online: false }), async () => {
    wanted.push(plan(document, emptyRecords()));
    return emptyRecords();
  });
  assert.equal(blockedPlan.records, null);
  assert.equal(wanted.length, 0);
});

test("3.1 a 5-subject / 18-step source inserts only absent independent branches", () => {
  const document = fixture5x18();
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [clone(mapped.subjects[0]), { ...clone(mapped.subjects[1]), title: "Sujet 2 modifié" }],
    items: mapped.items.filter((record) => record.subjectId === mapped.subjects[0].id).map((record) => clone(record))
  };
  const result = plan(document, target);
  assert.equal(result.operations.every((operation) => operation.type === "add"), true);
  assert.equal(result.operations.some((operation) => operation.value.id === "legacy:s2"), false);
  assert.equal(result.operations.some((operation) => operation.value.id === "legacy:s1"), false);
  for (const subjectId of ["legacy:s3", "legacy:s4", "legacy:s5"]) {
    assert.ok(result.operations.some((operation) => operation.value.id === subjectId), subjectId);
  }
  const insertedItems = result.operations.filter((operation) => operation.store === "items").length;
  assert.equal(insertedItems, 3 + 4 + 3);
  assert.equal(result.inventory.counts.subjects[CATEGORY.IDENTICAL], 1);
  assert.equal(result.inventory.counts.subjects[CATEGORY.CONFLICT], 1);
  assert.equal(result.inventory.counts.items[CATEGORY.IDENTICAL], 4);
  const targetBefore = JSON.stringify(target);
  assert.equal(JSON.stringify(target), targetBefore);
});

test("3.2 an unresolved step blocks only its dependent branch and quota blocks only its branch", () => {
  const document = emptyDocument();
  const first = newSubject("Projet", "s1");
  first.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b"), newItem("B1", "normal", "b1", "b"));
  const second = newSubject("Autre", "s2");
  second.items.push(newItem("C", "normal", "c"));
  document.subjects.push(first, second);
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [clone(mapped.subjects[0])],
    items: [
      clone(mapped.items.find((record) => record.id === "legacy:a")),
      { ...clone(mapped.items.find((record) => record.id === "legacy:b")), title: "B cloud" }
    ]
  };
  const result = plan(document, target);
  const ids = result.operations.map((operation) => operation.value.id);
  assert.ok(ids.includes("legacy:s2"));
  assert.ok(ids.includes("legacy:c"));
  assert.equal(ids.includes("legacy:s1"), false);
  assert.ok(result.blocked.some((entry) => entry.id === "legacy:b" && entry.reason === "unresolved-conflict"));
  assert.ok(result.blocked.some((entry) => entry.id === "legacy:b1" && entry.reason === "parent-blocked"));

  const quotaDocument = emptyDocument();
  const presentSubject = newSubject("Présent", "present");
  presentSubject.items.push(newItem("X", "normal", "x"));
  quotaDocument.subjects.push(presentSubject, newSubject("Nouveau", "new"));
  const quotaSource = mapSourceDocument(quotaDocument);
  const fillers = [];
  for (let index = 0; index < QUOTAS.subjects - 1; index += 1) {
    fillers.push({ id: "cloud-" + index, title: "Cloud " + index, order: index + 1 });
  }
  const quotaTarget = {
    subjects: [clone(quotaSource.subjects[0]), ...fillers],
    items: []
  };
  const quotaPlan = plan(quotaDocument, quotaTarget);
  assert.equal(quotaPlan.operations.some((operation) => operation.value.id === "legacy:present"), false);
  assert.ok(quotaPlan.operations.some((operation) => operation.value.id === "legacy:x"));
  assert.equal(quotaPlan.operations.some((operation) => operation.value.id === "legacy:new"), false);
  assert.ok(quotaPlan.blocked.some((entry) => entry.id === "legacy:new" && entry.reason === "quota"));

  const itemDocument = emptyDocument();
  const full = newSubject("Plein", "s1");
  full.items.push(newItem("Extra", "normal", "extra"));
  const independent = newSubject("Indépendant", "s2");
  independent.items.push(newItem("C", "normal", "c"));
  itemDocument.subjects.push(full, independent);
  const itemSource = mapSourceDocument(itemDocument);
  const fullItems = [];
  for (let index = 0; index < QUOTAS.itemsPerSubject; index += 1) {
    fullItems.push({ id: "cloud-item-" + index, subjectId: "legacy:s1", parentId: null,
      title: "Cloud " + index, priority: "normal", done: false, order: index });
  }
  const itemTarget = { subjects: [clone(itemSource.subjects[0])], items: fullItems };
  const itemPlan = plan(itemDocument, itemTarget);
  assert.equal(itemPlan.operations.some((operation) => operation.value.id === "legacy:extra"), false);
  assert.ok(itemPlan.blocked.some((entry) => entry.id === "legacy:extra" && entry.reason === "quota"));
  assert.ok(itemPlan.operations.some((operation) => operation.value.id === "legacy:s2"));
  assert.ok(itemPlan.operations.some((operation) => operation.value.id === "legacy:c"));
});

test("3.3 identical and Cloud-only records get no operation and relations stay coherent", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b"), newItem("B1", "normal", "b1", "b"));
  document.subjects.push(subject);
  const target = mappedTarget(document);
  target.items = target.items.filter((record) => record.id !== "legacy:b1");
  target.subjects.push({ id: "cloud-subject", title: "Cloud", order: 1, owner: "o" });
  target.items.push({ id: "cloud-item", subjectId: "cloud-subject", parentId: null,
    title: "Cloud", priority: "normal", done: false, order: 0 });
  const result = plan(document, target);
  assert.equal(result.operations.length, 1);
  const inserted = result.operations[0];
  assert.equal(inserted.value.id, "legacy:b1");
  assert.equal(inserted.value.subjectId, "legacy:s1");
  assert.equal(inserted.value.parentId, "legacy:b");
  assert.deepEqual(result.operations.map((operation) => operation.type), ["add"]);
  assert.equal(result.operations.some((operation) => operation.type === "put" || operation.type === "delete"), false);
});

test("4.1 keeping Cloud changes neither side and unresolved conflicts are excluded by default", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"));
  document.subjects.push(subject);
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [{ ...clone(mapped.subjects[0]), title: "Version Cloud" }],
    items: [{ ...clone(mapped.items[0]), title: "Étape Cloud" }]
  };
  const beforeDocument = JSON.stringify(document);
  const beforeTarget = JSON.stringify(target);
  const defaultPlan = plan(document, target);
  assert.equal(defaultPlan.operations.length, 0);
  assert.ok(defaultPlan.blocked.some((entry) => entry.reason === "unresolved-conflict"));

  const kept = plan(document, target, {
    resolutions: {
      "subjects:legacy:s1": RESOLUTION.KEEP_CLOUD,
      "items:legacy:a": RESOLUTION.KEEP_CLOUD
    }
  });
  assert.equal(kept.operations.length, 0);
  assert.ok(kept.blocked.some((entry) => entry.id === "legacy:s1" && entry.reason === "kept-cloud"));
  assert.equal(JSON.stringify(document), beforeDocument);
  assert.equal(JSON.stringify(target), beforeTarget);
  assert.equal(read("site/migration-reconciliation.js").includes("put"), true);
  assert.doesNotMatch(read("site/migration-reconciliation.js"), /operation\.type\s*===\s*"put"/);
});

test("4.2 copy identifiers are deterministic, destination-bound and remap hierarchy", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b", "a"));
  document.subjects.push(subject);
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [{ ...clone(mapped.subjects[0]), title: "Projet Cloud" }],
    items: [clone(mapped.items[0]), clone(mapped.items[1])]
  };
  const resolutions = { "subjects:legacy:s1": RESOLUTION.IMPORT_COPY };
  const first = plan(document, target, { resolutions });
  const second = plan(document, target, { resolutions });
  assert.deepEqual(first.operations, second.operations);
  const copySubject = first.operations.find((operation) => operation.store === "subjects").value;
  const copyItems = first.operations.filter((operation) => operation.store === "items").map((operation) => operation.value);
  assert.notEqual(copySubject.id, "legacy:s1");
  assert.equal(copyItems[0].subjectId, copySubject.id);
  assert.equal(copyItems[1].subjectId, copySubject.id);
  assert.equal(copyItems[1].parentId, copyItems[0].id);
  assert.equal(JSON.stringify(target).includes(copySubject.id), false);

  const otherDestination = plan(document, target, {
    resolutions,
    destination: { url: "https://other.dexie.cloud", remoteDbId: "remote-2" }
  });
  const otherSubject = otherDestination.operations.find((operation) => operation.store === "subjects").value;
  assert.notEqual(otherSubject.id, copySubject.id);

  const itemDocument = emptyDocument();
  const itemSubject = newSubject("Projet", "p1");
  itemSubject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b"), newItem("B1", "normal", "b1", "b"));
  itemDocument.subjects.push(itemSubject);
  const itemMapped = mapSourceDocument(itemDocument);
  const itemTarget = {
    subjects: [clone(itemMapped.subjects[0])],
    items: [
      clone(itemMapped.items.find((record) => record.id === "legacy:a")),
      { ...clone(itemMapped.items.find((record) => record.id === "legacy:b")), title: "B cloud" }
    ]
  };
  const itemPlan = plan(itemDocument, itemTarget, { resolutions: { "items:legacy:b": RESOLUTION.IMPORT_COPY } });
  const copiedB = itemPlan.operations.find((operation) => operation.value.title === "B").value;
  const copiedB1 = itemPlan.operations.find((operation) => operation.value.id !== copiedB.id &&
    operation.store === "items" && operation.value.title === "B1").value;
  assert.equal(copiedB1.parentId, copiedB.id);
  assert.equal(copiedB1.subjectId, "legacy:p1");
});

test("4.3 copies are idempotent and a conflicting copy id blocks only its branch", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b", "a"));
  const independent = newSubject("Indépendant", "s2");
  independent.items.push(newItem("C", "normal", "c"));
  document.subjects.push(subject, independent);
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [{ ...clone(mapped.subjects[0]), title: "Projet Cloud" }],
    items: [clone(mapped.items[0]), clone(mapped.items[1])]
  };
  const resolutions = { "subjects:legacy:s1": RESOLUTION.IMPORT_COPY };
  const first = plan(document, target, { resolutions });
  const committed = targetWithOperations(target, first.operations);
  const rerun = plan(document, committed, { resolutions });
  assert.equal(rerun.status, "already-migrated");
  assert.equal(rerun.operations.length, 0);

  const copySubject = first.operations.find((operation) => operation.store === "subjects").value;
  const collided = clone(target);
  collided.subjects.push({ ...copySubject, title: "Collision de copie" });
  const collidedPlan = plan(document, collided, { resolutions });
  assert.ok(collidedPlan.blocked.some((entry) => entry.reason === "copy-collision"));
  const ids = collidedPlan.operations.map((operation) => operation.value.id);
  assert.ok(ids.includes("legacy:s2"));
  assert.ok(ids.includes("legacy:c"));
  assert.equal(ids.includes(copySubject.id), false);
});

test("5.1 fingerprints cover source, destination, remote database, user, target and resolutions", () => {
  const document = fixture5x18();
  const target = mappedTarget(document);
  target.items = target.items.slice(0, 3);
  const base = computePlanFingerprint({ document, target, destination, userId, resolutions: {} });
  assert.equal(base.plan, computePlanFingerprint({ document, target, destination, userId, resolutions: {} }).plan);
  assert.notEqual(base.source, computeSourceFingerprint(clone(document).subjects.length));
  const changedSource = clone(document);
  changedSource.subjects[0].title = "Titre modifié";
  assert.notEqual(computePlanFingerprint({ document: changedSource, target, destination, userId, resolutions: {} }).plan, base.plan);
  assert.notEqual(computePlanFingerprint({ document, target, destination: { ...destination, url: "https://other.dexie.cloud" }, userId, resolutions: {} }).plan, base.plan);
  assert.notEqual(computePlanFingerprint({ document, target, destination: { ...destination, remoteDbId: "remote-2" }, userId, resolutions: {} }).plan, base.plan);
  assert.notEqual(computePlanFingerprint({ document, target, destination, userId: "user-2", resolutions: {} }).plan, base.plan);
  const changedTarget = clone(target);
  changedTarget.items[0].title = "Cloud";
  assert.notEqual(computePlanFingerprint({ document, target: changedTarget, destination, userId, resolutions: {} }).plan, base.plan);
  assert.notEqual(computePlanFingerprint({ document, target, destination, userId,
    resolutions: { "items:legacy:s1-i1": RESOLUTION.KEEP_CLOUD } }).plan, base.plan);
  assert.notEqual(computeDestinationFingerprint(destination), computeDestinationFingerprint({ ...destination, remoteDbId: "remote-2" }));
  assert.notEqual(computeUserFingerprint(userId), computeUserFingerprint("user-2"));
  assert.notEqual(computeTargetFingerprint(target), computeTargetFingerprint(changedTarget));
});

test("5.2 the migration layer rejects stale or unconsented plans before the adapter", async () => {
  const document = fixture5x18();
  const target = mappedTarget(document);
  target.items = target.items.slice(0, 2);
  const built = plan(document, target);
  const calls = [];
  const adapter = { commit(operations) { calls.push(operations); return { status: "recorded" }; } };
  const fresh = { attestation: evaluateSyncAttestation(attested()), document, target, destination, userId };

  assert.equal((await runReconciliation(adapter, built, undefined, async () => fresh)).status, "refused");
  assert.equal((await runReconciliation(adapter, built, { confirmed: false, fingerprint: built.fingerprint }, async () => fresh)).status, "refused");
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: "wrong" }, async () => fresh)).status, "consent-mismatch");
  assert.equal(calls.length, 0);

  const changedDocument = clone(document);
  changedDocument.subjects[0].title = "Modifié";
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => ({ ...fresh, document: changedDocument }))).status, "stale-plan");
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => ({ ...fresh, destination: { ...destination, url: "https://other.dexie.cloud" } }))).status, "stale-plan");
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => ({ ...fresh, destination: { ...destination, remoteDbId: "remote-2" } }))).status, "stale-plan");
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => ({ ...fresh, userId: "user-2" }))).status, "stale-plan");
  const changedTarget = clone(target);
  changedTarget.items[0].title = "Nouveau conflit";
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => ({ ...fresh, target: changedTarget }))).status, "stale-plan");
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => ({ ...fresh, attestation: evaluateSyncAttestation(attested({ online: false })) }))).status, "sync-blocked");
  assert.equal((await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint },
    async () => { throw new Error("read failed"); })).status, "read-error");
  assert.equal(calls.length, 0);

  const accepted = await runReconciliation(adapter, built, { confirmed: true, fingerprint: built.fingerprint }, async () => fresh);
  assert.equal(accepted.status, "local-written");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], built.operations);
});

test("5.3 the atomic add-only adapter never overwrites, rolls back half groups or lies", async () => {
  const document = fixture5x18();
  const empty = emptyRecords();
  const built = plan(document, empty);
  const fresh = { attestation: evaluateSyncAttestation(attested()), document, target: empty, destination, userId };
  const consent = { confirmed: true, fingerprint: built.fingerprint };

  const stateful = (initial, options = {}) => {
    let state = clone(initial);
    return {
      snapshot: () => clone(state),
      async commit(operations) {
        const next = clone(state);
        for (let index = 0; index < operations.length; index += 1) {
          const operation = operations[index];
          if (operation.type !== "add") throw new Error("not add");
          const list = operation.store === "subjects" ? next.subjects : next.items;
          if (list.some((record) => record.id === operation.value.id)) throw new Error("collision");
          list.push(clone(operation.value));
          if (options.failAt === index) throw new Error("transaction interrupted");
        }
        state = next;
        return { status: "recorded", operations };
      },
      seed(records) { state = clone(records); }
    };
  };

  const conflicting = stateful(empty);
  const firstOperation = built.operations[0];
  conflicting.seed(firstOperation.store === "subjects"
    ? { subjects: [clone(firstOperation.value)], items: [] }
    : { subjects: [], items: [clone(firstOperation.value)] });
  const seedBefore = conflicting.snapshot();
  const collision = await runReconciliation(conflicting, built, consent, async () => fresh);
  assert.equal(collision.status, "failed");
  assert.deepEqual(conflicting.snapshot(), seedBefore);

  const failing = stateful(empty, { failAt: 1 });
  const failed = await runReconciliation(failing, built, consent, async () => fresh);
  assert.equal(failed.status, "failed");
  assert.deepEqual(failing.snapshot(), empty);

  const healthy = stateful(empty);
  const written = await runReconciliation(healthy, built, consent, async () => fresh);
  assert.equal(written.status, "local-written");
  assert.equal(written.confirmation.status, "recorded");
  const reloaded = plan(document, healthy.snapshot());
  assert.equal(reloaded.status, "already-migrated");
  assert.equal(reloaded.operations.length, 0);
  const again = await runReconciliation(healthy, reloaded, { confirmed: true, fingerprint: reloaded.fingerprint },
    async () => ({ ...fresh, target: healthy.snapshot() }));
  assert.equal(again.status, "already-migrated");
  assert.equal(healthy.snapshot().subjects.length, 5);
});

test("6.1 the status reducer is truthful about local writes and synchronization", () => {
  let status = initialReconciliationStatus();
  assert.equal(status.status, RECONCILIATION_STATUS.IDLE);
  status = reduceReconciliationStatus(status, { type: "committed", online: true });
  assert.equal(status.status, RECONCILIATION_STATUS.SYNC_PENDING);
  assert.equal(status.localWritten, true);
  assert.notEqual(status.status, RECONCILIATION_STATUS.SYNCED);

  const weakly = reduceReconciliationStatus(status, { type: "sync-complete", attested: false });
  assert.equal(weakly.status, RECONCILIATION_STATUS.SYNC_PENDING);
  const synced = reduceReconciliationStatus(status, { type: "sync-complete", attested: true });
  assert.equal(synced.status, RECONCILIATION_STATUS.SYNCED);
  const error = reduceReconciliationStatus(status, { type: "sync-error", error: "later failure" });
  assert.equal(error.status, RECONCILIATION_STATUS.SYNC_ERROR);
  assert.equal(error.localWritten, true);
  assert.equal(error.syncError, "later failure");

  const offline = reduceReconciliationStatus(initialReconciliationStatus(), { type: "committed", online: false });
  assert.equal(offline.status, RECONCILIATION_STATUS.OFFLINE_PENDING);
  const localOnly = reduceReconciliationStatus(initialReconciliationStatus(), { type: "local-written" });
  assert.equal(localOnly.status, RECONCILIATION_STATUS.LOCAL_WRITTEN);
  const failed = reduceReconciliationStatus(status, { type: "transaction-error" });
  assert.equal(failed.status, RECONCILIATION_STATUS.ERROR);
  assert.equal(failed.localWritten, false);
});

test("7.1 the view model and renderer expose categories, conflicts and accessible controls", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"));
  document.subjects.push(subject);
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [{ ...clone(mapped.subjects[0]), title: "Cloud" }],
    items: [{ ...clone(mapped.items[0]), title: "Étape Cloud" }]
  };
  const built = plan(document, target, { resolutions: { "items:legacy:a": RESOLUTION.KEEP_CLOUD } });
  const view = buildReconciliationView(built);
  assert.equal(view.destination.url, destination.url);
  assert.equal(view.counts.subjects[CATEGORY.CONFLICT], 1);
  assert.ok(view.conflicts.some((conflict) => conflict.key === "subjects:legacy:s1" && conflict.fields.includes("title")));
  assert.ok(view.conflicts.every((conflict) => conflict.options.includes(RESOLUTION.KEEP_CLOUD) &&
    conflict.options.includes(RESOLUTION.IMPORT_COPY)));
  assert.ok(view.blocked.some((entry) => entry.id === "legacy:s1"));
  assert.equal(typeof view.operationCount, "number");

  const app = read("site/app.js");
  assert.match(app, /document\.createElement/);
  assert.match(app, /textContent/);
  assert.match(app, /el\("fieldset"/);
  assert.match(app, /input\.type = "radio"/);
  assert.match(app, /accept\.type = "button"/);
  assert.match(app, /"aria-live", "polite"/);
  assert.match(app, /title\.focus\(\)/);
  assert.match(app, /migration-consent/);
  assert.doesNotMatch(app, /innerHTML/);
  assert.doesNotMatch(app, /console\.(?:log|info|warn|error)/);
  assert.doesNotMatch(read("site/migration-reconciliation.js"), /console\.(?:log|info|warn|error)/);
});

test("7.2 historical and JSON imports share the attested plan and explicit consent; local import is unchanged", () => {
  const app = read("site/app.js");
  assert.match(app, /from "\.\/migration-reconciliation\.js"/);
  assert.match(app, /withAttestedTarget\(/);
  assert.match(app, /readAttestedTarget\(/);
  assert.match(app, /planReconciliation\(/);
  assert.match(app, /runReconciliation\(/);
  assert.match(app, /reviewDisplayedPlan\(displayed, fresh\)/);
  assert.match(app, /fingerprint: displayed\.fingerprint/);
  assert.match(app, /offerJsonReconciliation\(incoming\)/);
  assert.match(app, /offerHistoricalMigration\(\)/);
  assert.match(app, /reconciliationAdapter\(\)/);
  assert.match(app, /operation\.type !== "add"/);
  assert.match(app, /La connexion OTP seule ne vaut pas consentement/);
  assert.match(app, /Remplacer toutes les données locales par cet import \?/);
  assert.doesNotMatch(app, /La base cible doit être vide/);
  const historicalCall = app.indexOf("offerHistoricalMigration()");
  const attestationCall = app.indexOf("readAttestedTarget()");
  assert.notEqual(historicalCall, -1);
  assert.notEqual(attestationCall, -1);
  assert.ok(attestationCall < app.indexOf("const plan = result.status === \"ready\"", historicalCall));
});

test("7.3 the product documentation records the TS-031 reconciliation guarantees", () => {
  const guide = read("docs/product/developer-guide.md");
  const rollout = read("docs/product/dexie-cloud-rollout.md");
  for (const source of [guide, rollout]) {
    assert.match(source, /attest|attestation|synchronisation initiale/i);
    assert.match(source, /réconciliation|reconciliation/i);
    assert.match(source, /copie|copy/i);
    assert.match(source, /conserver la version Cloud|keep-cloud/i);
    assert.match(source, /écrit localement|written locally/i);
  }
  assert.match(guide, /site\/migration-reconciliation\.js/);
  assert.match(guide, /threadstep\.document\.v1/);
  assert.match(rollout, /isolée|isolated/i);
});

test("2.1 a 5-subject / 18-step source merges into a populated target without touching Cloud-only data", () => {
  const document = fixture5x18();
  const mapped = mapSourceDocument(document);
  const sourceItems = new Map();
  for (const record of mapped.items) {
    if (!sourceItems.has(record.subjectId)) sourceItems.set(record.subjectId, []);
    sourceItems.get(record.subjectId).push(record);
  }
  const s3Items = sourceItems.get("legacy:s3").slice().sort((left, right) => left.order - right.order);
  const missingS3Item = s3Items[2];
  const target = {
    subjects: [
      clone(mapped.subjects[0]),
      clone(mapped.subjects[1]),
      clone(mapped.subjects[2]),
      clone(mapped.subjects[3]),
      { id: "cloud-subject", title: "Propriétaire Cloud", order: 90 }
    ],
    items: [
      ...sourceItems.get("legacy:s1").map(clone),
      ...sourceItems.get("legacy:s2").map(clone),
      ...s3Items.slice(0, 2).map(clone),
      ...sourceItems.get("legacy:s4").map(clone),
      { id: "cloud-item", subjectId: "cloud-subject", parentId: null,
        title: "Étape Cloud", priority: "normal", done: false, order: 0 }
    ]
  };
  const before = JSON.stringify(target);
  const result = plan(document, target);
  assert.equal(result.status, "ready");
  assert.equal(result.operations.every((operation) => operation.type === "add"), true);
  assert.equal(result.operations.length, 5);
  const ids = result.operations.map((operation) => operation.value.id);
  assert.ok(ids.includes("legacy:s5"));
  assert.ok(ids.includes(missingS3Item.id));
  assert.equal(ids.filter((id) => id !== missingS3Item.id && id.startsWith("legacy:s5")).length, 4);
  assert.equal(result.operations.filter((operation) => operation.store === "items" &&
    String(operation.value.id).startsWith("legacy:s5")).length, 3);
  assert.equal(result.operations.some((operation) => operation.value.id === "legacy:s1"), false);
  assert.equal(result.operations.some((operation) => operation.value.id === "legacy:s2"), false);
  assert.equal(result.operations.some((operation) => operation.value.id === "legacy:s4"), false);
  assert.equal(result.operations.some((operation) => String(operation.value.id).startsWith("copy:")), false);
  assert.equal(result.inventory.counts.subjects[CATEGORY.CLOUD_ONLY], 1);
  assert.equal(result.inventory.counts.items[CATEGORY.CLOUD_ONLY], 1);
  assert.equal(JSON.stringify(target), before);

  const committed = targetWithOperations(target, result.operations);
  const rerun = plan(document, committed);
  assert.equal(rerun.status, "already-migrated");
  assert.equal(rerun.operations.length, 0);
  assert.equal(committed.subjects.length, 6);
  assert.equal(committed.items.length, target.items.length + 4);
});

test("2.2 subject and sub-step conflicts, order changes, late collisions, divergence and quotas stay deterministic", async () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"), newItem("B", "normal", "b"), newItem("B1", "normal", "b1", "b"));
  const independent = newSubject("Indépendant", "s2");
  independent.items.push(newItem("C", "normal", "c"));
  document.subjects.push(subject, independent);
  const mapped = mapSourceDocument(document);
  const target = {
    subjects: [clone(mapped.subjects[0])],
    items: [
      clone(mapped.items.find((record) => record.id === "legacy:a")),
      { ...clone(mapped.items.find((record) => record.id === "legacy:b")), title: "B cloud" }
    ]
  };

  const defaultPlan = plan(document, target);
  assert.ok(defaultPlan.blocked.some((entry) => entry.id === "legacy:b" && entry.reason === "unresolved-conflict"));
  assert.ok(defaultPlan.blocked.some((entry) => entry.id === "legacy:b1" && entry.reason === "parent-blocked"));
  assert.ok(defaultPlan.operations.some((operation) => operation.value.id === "legacy:s2"));
  assert.ok(defaultPlan.operations.some((operation) => operation.value.id === "legacy:c"));

  const copied = plan(document, target, { resolutions: { "items:legacy:b": RESOLUTION.IMPORT_COPY } });
  const copiedB = copied.operations.find((operation) => operation.value.title === "B").value;
  const copiedB1 = copied.operations.find((operation) => operation.value.title === "B1").value;
  assert.equal(copiedB1.parentId, copiedB.id);
  assert.equal(copiedB1.subjectId, "legacy:s1");

  const subjectConflictTarget = {
    subjects: [{ ...clone(mapped.subjects[0]), title: "Projet Cloud" }],
    items: [clone(mapped.items.find((record) => record.id === "legacy:a"))]
  };
  const subjectKept = plan(document, subjectConflictTarget);
  assert.ok(subjectKept.blocked.some((entry) => entry.id === "legacy:s1" && entry.reason === "unresolved-conflict"));
  assert.ok(subjectKept.operations.some((operation) => operation.value.id === "legacy:s2"));
  const subjectCopied = plan(document, subjectConflictTarget, {
    resolutions: { "subjects:legacy:s1": RESOLUTION.IMPORT_COPY }
  });
  const copySubject = subjectCopied.operations.find((operation) => operation.store === "subjects").value;
  assert.notEqual(copySubject.id, "legacy:s1");
  assert.ok(subjectCopied.operations.some((operation) => operation.value.subjectId === copySubject.id));

  const reversed = {
    subjects: [clone(mapped.subjects[0])],
    items: [
      { ...clone(mapped.items.find((record) => record.id === "legacy:b")), order: 0 },
      { ...clone(mapped.items.find((record) => record.id === "legacy:a")), order: 1 }
    ]
  };
  const reversedInventory = buildInventory(mapped, reversed);
  assert.ok(reversedInventory.index.items.get("legacy:a").fields.includes("order"));
  assert.ok(reversedInventory.index.items.get("legacy:b").fields.includes("order"));

  const divergentSource = clone(document);
  divergentSource.subjects[0].title = "Projet source modifié";
  const divergentTarget = {
    subjects: [{ ...clone(mapped.subjects[0]), title: "Projet cible modifié" }],
    items: []
  };
  const divergent = plan(divergentSource, divergentTarget);
  assert.ok(divergent.blocked.some((entry) => entry.id === "legacy:s1" && entry.reason === "unresolved-conflict"));

  const latePlan = plan(document, target);
  const lateTarget = clone(target);
  const lateOperation = latePlan.operations.find((operation) => operation.store === "subjects") ||
    latePlan.operations[0];
  if (lateOperation.store === "subjects") {
    lateTarget.subjects.push({ ...clone(lateOperation.value), title: "Collision tardive" });
  } else {
    lateTarget.items.push({ ...clone(lateOperation.value), title: "Collision tardive" });
  }
  const lateFresh = plan(document, lateTarget);
  const lateCalls = [];
  const lateAdapter = { commit(operations) { lateCalls.push(operations); return { status: "recorded" }; } };
  const lateOutcome = await runReconciliation(lateAdapter, latePlan,
    { confirmed: true, fingerprint: latePlan.fingerprint },
    async () => ({ attestation: evaluateSyncAttestation(attested()), document, target: lateTarget, destination, userId, plan: lateFresh }));
  assert.equal(lateOutcome.status, "stale-plan");
  assert.equal(lateCalls.length, 0);

  const quotaDocument = emptyDocument();
  const present = newSubject("Présent", "present");
  present.items.push(newItem("X", "normal", "x"));
  quotaDocument.subjects.push(present, newSubject("Nouveau", "new"));
  const quotaSource = mapSourceDocument(quotaDocument);
  const fillers = [];
  for (let index = 0; index < QUOTAS.subjects - 1; index += 1) {
    fillers.push({ id: "cloud-" + index, title: "Cloud " + index, order: index + 1 });
  }
  const quotaPlan = plan(quotaDocument, { subjects: [clone(quotaSource.subjects[0]), ...fillers], items: [] });
  assert.ok(quotaPlan.blocked.some((entry) => entry.id === "legacy:new" && entry.reason === "quota"));
  assert.ok(quotaPlan.operations.some((operation) => operation.value.id === "legacy:x"));
  assert.equal(quotaPlan.operations.some((operation) => operation.value.id === "legacy:new"), false);
});
