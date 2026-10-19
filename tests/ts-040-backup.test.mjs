import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { documentToRecords, recordsToDocument } from "../site/persistence.js";
import {
  BACKUP_ERROR,
  BACKUP_FORMAT,
  computeBackupChecksum,
  parseIndexedDbBackup,
  serializeIndexedDbBackup,
  validateBackupRecords
} from "../site/indexeddb-backup.js";
import { buildBusinessExport, buildIntegrityInventory } from "../site/data-integrity-recovery.js";
import { planReconciliation } from "../site/migration-reconciliation.js";

function fixture() {
  const document = emptyDocument();
  const subject = newSubject("Sujet", "s1");
  subject.items.push(newItem("Étape", "normal", "i1"));
  document.subjects.push(subject);
  return documentToRecords(document);
}

function validBackup() {
  return serializeIndexedDbBackup(fixture()).document;
}

test("parser rejects malformed structure, format and version with stable codes", () => {
  for (const [input, code] of [
    ["not json", BACKUP_ERROR.INVALID],
    [{}, BACKUP_ERROR.UNKNOWN_FORMAT],
    [{ format: "other", formatVersion: 1 }, BACKUP_ERROR.UNKNOWN_FORMAT],
    [{ format: BACKUP_FORMAT, formatVersion: 2 }, BACKUP_ERROR.UNKNOWN_FORMAT],
    [{ format: BACKUP_FORMAT, formatVersion: 1 }, BACKUP_ERROR.INVALID],
    [{ version: 1, subjects: [] }, BACKUP_ERROR.UNSUPPORTED_V1]
  ]) {
    const result = parseIndexedDbBackup(input);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(result.code, code, JSON.stringify(input));
    assert.equal(result.writes, undefined);
  }
});

test("parser rejects duplicate identifiers and dangling references", () => {
  const duplicateSubjects = validBackup();
  duplicateSubjects.records.subjects.push({ ...duplicateSubjects.records.subjects[0] });
  duplicateSubjects.counts.subjects += 1;
  duplicateSubjects.checksum = computeBackupChecksum(duplicateSubjects.records);
  assert.equal(parseIndexedDbBackup(duplicateSubjects).code, BACKUP_ERROR.DUPLICATE_ID);

  const duplicateItems = validBackup();
  duplicateItems.records.items.push({ ...duplicateItems.records.items[0] });
  duplicateItems.counts.items += 1;
  duplicateItems.checksum = computeBackupChecksum(duplicateItems.records);
  assert.equal(parseIndexedDbBackup(duplicateItems).code, BACKUP_ERROR.DUPLICATE_ID);

  const danglingSubject = validBackup();
  danglingSubject.records.items[0].subjectId = "missing";
  danglingSubject.checksum = computeBackupChecksum(danglingSubject.records);
  assert.equal(parseIndexedDbBackup(danglingSubject).code, BACKUP_ERROR.DANGLING_REFERENCE);

  const danglingParent = validBackup();
  danglingParent.records.items[0].parentId = "missing";
  danglingParent.checksum = computeBackupChecksum(danglingParent.records);
  assert.equal(parseIndexedDbBackup(danglingParent).code, BACKUP_ERROR.DANGLING_REFERENCE);
});

test("parser rejects quota overflow, count mismatch and checksum mismatch", () => {
  const tooManySubjects = {
    subjects: Array.from({ length: 41 }, (_, index) => ({ id: "s" + index, title: "S", order: index })),
    items: []
  };
  assert.equal(validateBackupRecords(tooManySubjects).code, BACKUP_ERROR.QUOTA_EXCEEDED);

  const tooManyItems = {
    subjects: [{ id: "s", title: "S", order: 0 }],
    items: Array.from({ length: 501 }, (_, index) => ({
      id: "i" + index, subjectId: "s", parentId: null, title: "I",
      priority: "normal", done: false, order: index
    }))
  };
  assert.equal(validateBackupRecords(tooManyItems).code, BACKUP_ERROR.QUOTA_EXCEEDED);

  const countMismatch = validBackup();
  countMismatch.counts.items = 2;
  assert.equal(parseIndexedDbBackup(countMismatch).code, BACKUP_ERROR.COUNT_MISMATCH);

  const checksumMismatch = validBackup();
  checksumMismatch.checksum = "0".repeat(64);
  assert.equal(parseIndexedDbBackup(checksumMismatch).code, BACKUP_ERROR.CHECKSUM_MISMATCH);
});

test("Cloud reconciliation uses the same canonical records and preserves Cloud-only rows", () => {
  const records = fixture();
  const cloudOnly = {
    subjects: [{ id: "cloud-owner", title: "Propriétaire Cloud", order: 9 }],
    items: [{ id: "cloud-item", subjectId: "cloud-owner", parentId: null, title: "Cloud", priority: "normal", done: false, order: 0 }]
  };
  const plan = planReconciliation({
    records,
    target: cloudOnly,
    destination: { url: "https://demo.dexie.cloud" },
    userId: "user"
  });
  assert.equal(plan.status, "ready");
  const touched = new Set(plan.operations.map((operation) => operation.value.id));
  assert.equal(touched.has("cloud-owner"), false);
  assert.equal(touched.has("cloud-item"), false);
  assert.equal(plan.operations.every((operation) => operation.type === "add"), true);
  const second = planReconciliation({
    records,
    target: { subjects: [...cloudOnly.subjects, ...records.subjects], items: [...cloudOnly.items, ...records.items] },
    destination: { url: "https://demo.dexie.cloud" },
    userId: "user"
  });
  assert.equal(second.operations.length, 0);
});

test("business export is gated during an integrity anomaly and marks no partial file", () => {
  const records = fixture();
  records.items.push({ id: "orphan", subjectId: "missing", parentId: null, title: "Orpheline", priority: "normal", done: false, order: 0 });
  const inventory = buildIntegrityInventory(records);
  assert.equal(inventory.hasBlockingAnomaly, true);
  const result = buildBusinessExport(records, { inventory });
  assert.equal(result.status, "disabled");
  assert.equal(result.document, null);
  assert.equal(result.records, null);
  assert.equal(recordsToDocument(fixture()).subjects.length, 1);
});
