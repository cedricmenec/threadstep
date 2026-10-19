import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import {
  applyOperations,
  documentToRecords,
  recordsToDocument,
  planLocalMerge
} from "../site/persistence.js";
import {
  planModernRecordsMerge,
  planModernLocalImport,
  LOCAL_MERGE_STATUS
} from "../site/local-migration.js";
import {
  computeBackupChecksum,
  parseIndexedDbBackup,
  serializeIndexedDbBackup,
  BACKUP_FORMAT
} from "../site/indexeddb-backup.js";
import { buildBusinessExport, buildRestorePlan } from "../site/data-integrity-recovery.js";
import { runPreferencesMigration, METADATA_STATUS } from "../site/local-metadata.js";

function workspace() {
  const document = emptyDocument();
  for (let subjectIndex = 0; subjectIndex < 5; subjectIndex += 1) {
    const subject = newSubject("Sujet " + subjectIndex, "s" + subjectIndex);
    for (let itemIndex = 0; itemIndex < 3; itemIndex += 1) {
      const item = newItem("Étape " + subjectIndex + "-" + itemIndex,
        itemIndex === 0 ? "urgent" : itemIndex === 1 ? "normal" : "later",
        "i" + subjectIndex + "-" + itemIndex);
      item.note = "Note " + subjectIndex + "-" + itemIndex;
      item.done = itemIndex === 2;
      subject.items.push(item);
    }
    if (subjectIndex < 3) {
      subject.items.push(newItem("Sous-étape " + subjectIndex, "normal", "sub" + subjectIndex, "i" + subjectIndex + "-1"));
    }
    document.subjects.push(subject);
  }
  document.subjects[0].items.push(newItem("Tâche supplémentaire", "normal", "extra-1"));
  return documentToRecords(document);
}

function memoryMeta() {
  const values = new Map();
  return {
    values,
    async readMeta(key) { return values.get(key) || null; },
    async writeMeta(record) { values.set(record.key, structuredClone(record)); return record; }
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("the same modern backup merged twice produces zero operation", () => {
  const records = workspace();
  const backup = serializeIndexedDbBackup(records).document;
  const first = planModernLocalImport({ subjects: [], items: [] }, backup);
  assert.equal(first.status, LOCAL_MERGE_STATUS.READY);
  const after = applyOperations({ subjects: [], items: [] }, first.operations);
  const second = planModernLocalImport(after, backup);
  assert.equal(second.status, LOCAL_MERGE_STATUS.ALREADY_PRESENT);
  assert.deepEqual(second.operations, []);
});

test("a different existing identifier is a collision with no operation", () => {
  const records = workspace();
  const target = {
    subjects: [{ ...records.subjects[0], title: "Titre différent" }],
    items: []
  };
  const plan = planLocalMerge(target, records);
  assert.equal(plan.status, "collision");
  assert.ok(plan.collisions.includes(records.subjects[0].id));
  assert.deepEqual(plan.operations, []);
});

test("invalid and V1 files leave the target unchanged", () => {
  const records = workspace();
  const target = { subjects: records.subjects.map((record) => ({ ...record })), items: records.items.map((record) => ({ ...record })) };
  const before = JSON.stringify(target);
  const v1 = planModernLocalImport(target, JSON.stringify({ version: 1, subjects: [] }));
  assert.equal(v1.status, LOCAL_MERGE_STATUS.INVALID);
  assert.equal(v1.code, "unsupported-v1-backup");
  assert.deepEqual(v1.operations, []);
  const unknown = planModernLocalImport(target, JSON.stringify({ hello: "world" }));
  assert.equal(unknown.code, "unknown-format");
  assert.deepEqual(unknown.operations, []);
  assert.equal(JSON.stringify(target), before);
});

test("the modern export preserves 5 subjects, 19 tasks, hierarchy and attributes", () => {
  const records = workspace();
  const result = buildBusinessExport(records);
  assert.equal(result.status, "ready");
  assert.equal(result.document.format, BACKUP_FORMAT);
  assert.equal("version" in result.document, false);
  assert.deepEqual(result.counts, { subjects: 5, items: 19 });
  const parsed = parseIndexedDbBackup(result.document);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.checksum, computeBackupChecksum(records));
  const restored = recordsToDocument(parsed.records);
  assert.equal(restored.subjects.length, 5);
  assert.equal(restored.subjects.reduce((count, subject) => count + subject.items.length, 0), 19);
  const original = recordsToDocument(records);
  assert.deepEqual(restored, original);
  assert.equal(restored.subjects[0].items.find((item) => item.id === "sub0").parentId, "i0-1");
  assert.equal(restored.subjects[0].items.find((item) => item.id === "i0-2").note, "Note 0-2");
});

test("a complete restore into an empty target and a reimport add nothing twice", () => {
  const records = workspace();
  const parsed = parseIndexedDbBackup(serializeIndexedDbBackup(records).document);
  const empty = { subjects: [], items: [] };
  const restore = buildRestorePlan({
    records: parsed.records,
    current: empty,
    backup: { format: BACKUP_FORMAT, ...serializeIndexedDbBackup(empty).document },
    backupExpected: { counts: { subjects: 0, items: 0 } }
  });
  assert.equal(restore.allowed, true);
  const after = applyOperations(empty, records.subjects.map((value) => ({ type: "put", store: "subjects", value }))
    .concat(records.items.map((value) => ({ type: "put", store: "items", value }))));
  const second = planModernLocalImport(after, parsed.document);
  assert.equal(second.status, LOCAL_MERGE_STATUS.ALREADY_PRESENT);
  assert.equal(second.operations.length, 0);
});

test("a stale restore plan is refused before any operation", () => {
  const records = workspace();
  const parsed = parseIndexedDbBackup(serializeIndexedDbBackup(records).document);
  const current = { subjects: [], items: [] };
  const backup = serializeIndexedDbBackup(current).document;
  const plan = buildRestorePlan({
    records: parsed.records,
    current,
    backup,
    backupExpected: { counts: { subjects: 0, items: 0 } }
  });
  const changedCurrent = {
    subjects: [{ id: "local", title: "Nouveau", order: 0 }],
    items: []
  };
  const fresh = buildRestorePlan({
    records: parsed.records,
    current: changedCurrent,
    backup,
    backupExpected: { counts: { subjects: 1, items: 0 } }
  });
  assert.ok(plan.fingerprint);
  assert.notEqual(plan.fingerprint, fresh.fingerprint);
  assert.equal(fresh.backupCheck.valid, false);
});

test("resume preference migrates once into the non-synchronized meta store", async () => {
  const meta = memoryMeta();
  const storage = memoryStorage({
    "threadstep.resume.v1": JSON.stringify({ subjectId: "s0", itemId: "i0-1" })
  });
  const adapter = { ...meta, async readLegacyRaw(key) { return storage.getItem(key); } };
  const first = await runPreferencesMigration(adapter);
  assert.equal(first.migrationComplete, true);
  assert.deepEqual(meta.values.get("resume"), {
    key: "resume", version: 1, subjectId: "s0", itemId: "i0-1"
  });
  assert.notEqual(storage.getItem("threadstep.resume.v1"), null);
  const second = await runPreferencesMigration(adapter);
  assert.equal(second.status, METADATA_STATUS.ALREADY_MIGRATED);
  assert.deepEqual(second.record, { subjectId: "s0", itemId: "i0-1" });
});

test("a populated target is authoritative and a conflict never overwrites it", async () => {
  const meta = memoryMeta();
  meta.values.set("resume", { key: "resume", version: 1, subjectId: "s0", itemId: "i0-0" });
  const storage = memoryStorage({
    "threadstep.resume.v1": JSON.stringify({ subjectId: "s1", itemId: "i1-0" })
  });
  const adapter = { ...meta, async readLegacyRaw(key) { return storage.getItem(key); } };
  const result = await runPreferencesMigration(adapter);
  assert.equal(result.status, METADATA_STATUS.CONFLICT);
  assert.deepEqual(meta.values.get("resume"), { key: "resume", version: 1, subjectId: "s0", itemId: "i0-0" });
  assert.notEqual(storage.getItem("threadstep.resume.v1"), null);
});

test("a failed metadata write keeps the legacy value and never claims durable storage", async () => {
  const meta = memoryMeta();
  const storage = memoryStorage({
    "threadstep.resume.v1": JSON.stringify({ subjectId: "s0", itemId: "i0-1" })
  });
  const adapter = {
    readMeta: meta.readMeta,
    async writeMeta() { throw new Error("quota"); },
    async readLegacyRaw(key) { return storage.getItem(key); }
  };
  const result = await runPreferencesMigration(adapter);
  assert.equal(result.status, METADATA_STATUS.WRITE_ERROR);
  assert.equal(result.migrationComplete, false);
  assert.notEqual(storage.getItem("threadstep.resume.v1"), null);
});

test("a crash before the marker resumes idempotently after reload", async () => {
  const meta = memoryMeta();
  const storage = memoryStorage({
    "threadstep.resume.v1": JSON.stringify({ subjectId: "s0", itemId: "i0-1" })
  });
  // Simulate the preference write succeeding, then the marker write failing.
  let markerWrites = 0;
  const adapter = {
    readMeta: meta.readMeta,
    async writeMeta(record) {
      if (record.key === "preferencesMigration" && markerWrites === 0) {
        markerWrites += 1;
        throw new Error("interrupted");
      }
      return meta.writeMeta(record);
    },
    async readLegacyRaw(key) { return storage.getItem(key); }
  };
  const interrupted = await runPreferencesMigration(adapter);
  assert.equal(interrupted.migrationComplete, false);
  assert.equal(meta.values.get("resume").itemId, "i0-1");
  const resumed = await runPreferencesMigration(adapter);
  assert.equal(resumed.migrationComplete, true);
  assert.equal(meta.values.get("resume").itemId, "i0-1");
});

test("metadata is workspace-scoped and the modern export carries no preference field", () => {
  const first = memoryMeta();
  const second = memoryMeta();
  first.values.set("resume", { key: "resume", version: 1, subjectId: "s0", itemId: "i0-1" });
  assert.equal(second.values.has("resume"), false);
  const records = workspace();
  const document = buildBusinessExport(records).document;
  assert.equal(JSON.stringify(document).includes("preferencesMigration"), false);
  assert.equal(JSON.stringify(document).includes("\"resume\""), false);
  assert.equal(JSON.stringify(document).includes("Note 0-2"), true);
});

test("a synchronized workspace does not adopt a legacy preference for absent records", async () => {
  const meta = memoryMeta();
  const storage = memoryStorage({
    "threadstep.resume.v1": JSON.stringify({ subjectId: "other-workspace", itemId: "other-item" })
  });
  const result = await runPreferencesMigration({
    ...meta,
    async readLegacyRaw(key) { return storage.getItem(key); },
    async isRefAvailable(ref) { return ref.subjectId === "present" && ref.itemId === "present"; }
  });
  assert.equal(result.migrationComplete, true);
  assert.equal(meta.values.has("resume"), false);
  assert.notEqual(storage.getItem("threadstep.resume.v1"), null);
});
