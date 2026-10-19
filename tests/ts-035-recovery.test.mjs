import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { documentToRecords, recordsToDocument, applyOperations } from "../site/persistence.js";
import {
  ANOMALY,
  READ_FAILURE,
  buildBusinessExport,
  buildDegradedView,
  buildIntegrityInventory,
  buildRawRecoveryExport,
  buildRestorePlan,
  evaluateBusinessExport,
  readWorkspaceResult,
  verifyRecoverySnapshot
} from "../site/data-integrity-recovery.js";
import { parseIndexedDbBackup, serializeIndexedDbBackup, BACKUP_FORMAT } from "../site/indexeddb-backup.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

function workspace({ orphan = false } = {}) {
  const records = { subjects: [], items: [] };
  for (let subjectIndex = 0; subjectIndex < 5; subjectIndex += 1) {
    const subject = newSubject("Sujet " + subjectIndex, "s" + subjectIndex);
    records.subjects.push({ id: subject.id, title: subject.title, order: subjectIndex });
    const count = subjectIndex === 0 ? 6 : 3;
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      records.items.push({
        id: "i" + subjectIndex + "-" + itemIndex,
        subjectId: subject.id,
        parentId: null,
        title: "Étape " + subjectIndex + "-" + itemIndex,
        priority: itemIndex === 0 ? "urgent" : "normal",
        done: false,
        order: itemIndex,
        note: "Note " + subjectIndex + "-" + itemIndex
      });
    }
  }
  if (orphan) {
    records.items.push({
      id: "orphan", subjectId: "missing", parentId: null,
      title: "Orpheline", priority: "normal", done: false, order: 0
    });
  }
  return records;
}

test("a coherent workspace produces a complete modern business backup", () => {
  const records = workspace();
  const inventory = buildIntegrityInventory(records);
  assert.equal(inventory.hasBlockingAnomaly, false);
  const gate = evaluateBusinessExport(inventory);
  assert.equal(gate.allowed, true);
  const result = buildBusinessExport(records, { inventory });
  assert.equal(result.status, "ready");
  assert.equal(result.document.format, BACKUP_FORMAT);
  assert.deepEqual(result.counts, { subjects: 5, items: 18 });
  assert.deepEqual(parseIndexedDbBackup(result.document).counts, { subjects: 5, items: 18 });
});

test("an integrity anomaly disables the modern business backup and keeps the raw export", () => {
  const raw = workspace({ orphan: true });
  const inventory = buildIntegrityInventory(raw);
  assert.equal(inventory.hasBlockingAnomaly, true);
  assert.equal(inventory.codes[ANOMALY.DANGLING_SUBJECT] >= 1, true);
  const gate = evaluateBusinessExport(inventory);
  assert.equal(gate.allowed, false);
  assert.equal(gate.rawRecoveryRequired, true);
  const business = buildBusinessExport(raw, { inventory });
  assert.equal(business.document, null);
  const rawExport = buildRawRecoveryExport(raw, { workspace: "local" });
  assert.equal(rawExport.status, "ready");
  assert.equal(rawExport.exportKind, "raw-recovery");
  assert.equal(rawExport.counts.items, 19);
  assert.equal(rawExport.records.items.some((record) => record.id === "orphan"), true);
  assert.equal(verifyRecoverySnapshot(rawExport, rawExport).valid, true);
});

test("degraded consultation keeps every subject readable without writing", () => {
  const raw = workspace({ orphan: true });
  const inventory = buildIntegrityInventory(raw);
  const degraded = buildDegradedView(raw, inventory);
  assert.equal(degraded.editable, false);
  assert.equal(degraded.document.subjects.length, 5);
  assert.equal(degraded.accountsForEveryRecord, true);
  assert.equal(degraded.document.version, undefined);
});

test("restore requires a verified backup and rejects an unsupported source", () => {
  const current = workspace();
  const incoming = documentToRecords((() => {
    const value = emptyDocument();
    value.subjects.push(newSubject("Cible", "target"));
    value.subjects[0].items.push(newItem("Tâche", "normal", "target-1"));
    return value;
  })());
  const withoutBackup = buildRestorePlan({ records: incoming, current, backup: null });
  assert.equal(withoutBackup.status, "backup-required");
  const backup = serializeIndexedDbBackup(current).document;
  const ready = buildRestorePlan({
    records: incoming,
    current,
    backup,
    backupExpected: { counts: { subjects: 5, items: 18 } }
  });
  assert.equal(ready.allowed, true);
  assert.equal(ready.replacement, true);
  assert.equal(ready.counts.incoming.subjects, 1);
  const v1 = buildRestorePlan({ records: { version: 1, subjects: [] }, current, backup });
  assert.equal(v1.allowed, false);
  assert.ok(v1.code === "invalid-backup" || v1.code === "invalid-source");
});

test("a modern restore into an empty target reproduces the workspace", () => {
  const records = workspace();
  const parsed = parseIndexedDbBackup(serializeIndexedDbBackup(records).document);
  const restored = applyOperations(
    { subjects: [], items: [] },
    parsed.records.subjects.map((value) => ({ type: "put", store: "subjects", value }))
      .concat(parsed.records.items.map((value) => ({ type: "put", store: "items", value })))
  );
  assert.deepEqual(recordsToDocument(restored), recordsToDocument(records));
});

test("read failures stay typed and never become an empty workspace", async () => {
  const refused = await readWorkspaceResult(() => { throw new Error("permission denied"); });
  assert.equal(refused.code, READ_FAILURE.NOT_VISIBLE_UNAUTHORIZED);
  const unavailable = await readWorkspaceResult(() => { throw new Error("database missing"); });
  assert.equal(unavailable.code, READ_FAILURE.STORAGE_UNAVAILABLE);
  const invalid = await readWorkspaceResult(() => ({ subjects: [], items: [{ id: "x" }] }));
  assert.equal(invalid.code, READ_FAILURE.PROJECTION_INVALID);
});

test("runtime no longer exposes a V1 export gate or historical panel", () => {
  const app = read("site/app.js");
  assert.equal(app.includes("evaluateV1Export"), false);
  assert.equal(app.includes("version: 1"), false);
  assert.equal(app.includes("historical-backup"), false);
  assert.equal(app.includes("Migration bloquée"), false);
  assert.match(app, /evaluateBusinessExport\(inventory\)/);
  assert.match(app, /buildBusinessExport\(lastRecords, \{ inventory, schemaVersion: SCHEMA_VERSION \}\)/);
});
