import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { documentToRecords, recordsToDocument, applyOperations } from "../site/persistence.js";
import {
  BACKUP_FORMAT,
  parseIndexedDbBackup,
  serializeIndexedDbBackup
} from "../site/indexeddb-backup.js";
import { planModernLocalImport, planModernRecordsMerge } from "../site/local-migration.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

function document() {
  const value = emptyDocument();
  const subject = newSubject("Sujet", "legacy:s1");
  subject.items.push(newItem("Étape", "urgent", "legacy:i1"));
  subject.items.push(newItem("Sous-étape", "normal", "legacy:i2", "legacy:i1"));
  subject.items[0].note = "Note conservée";
  value.subjects.push(subject);
  return value;
}

test("an IndexedDB backup declares a distinct modern format and canonical provenance", () => {
  const records = documentToRecords(document());
  const result = serializeIndexedDbBackup(records);
  assert.equal(result.ok, true);
  assert.equal(result.document.format, BACKUP_FORMAT);
  assert.equal(result.document.formatVersion, 1);
  assert.equal(result.document.version, undefined);
  assert.deepEqual(result.document.provenance, {
    source: "indexeddb",
    idsCanonical: true,
    mappingVersion: 2,
    schemaVersion: 3
  });
  assert.equal(JSON.stringify(result.document.provenance).includes("Note"), false);
});

test("canonical legacy-prefixed identifiers stay intact without a second prefix", () => {
  const records = documentToRecords(document());
  const parsed = parseIndexedDbBackup(serializeIndexedDbBackup(records).document);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.subjects[0].id, "legacy:s1");
  assert.equal(parsed.records.items[0].subjectId, "legacy:s1");
  assert.equal(parsed.records.items[1].parentId, "legacy:i1");
  const json = JSON.stringify(parsed.records);
  assert.equal(json.includes("legacy:legacy:"), false);
});

test("modern reimport is idempotent and preserves every field", () => {
  const records = documentToRecords(document());
  const backup = serializeIndexedDbBackup(records).document;
  const first = planModernLocalImport({ subjects: [], items: [] }, backup);
  const after = applyOperations({ subjects: [], items: [] }, first.operations);
  const second = planModernLocalImport(after, backup);
  assert.equal(second.operations.length, 0);
  assert.deepEqual(recordsToDocument(after), document());
  assert.equal(recordsToDocument(after).subjects[0].items[0].note, "Note conservée");
});

test("an unmarked or V1 source is refused without a plan", () => {
  const v1 = planModernLocalImport({ subjects: [], items: [] }, JSON.stringify(document()));
  assert.equal(v1.code, "unsupported-v1-backup");
  assert.deepEqual(v1.operations, []);
  const unknown = planModernLocalImport({ subjects: [], items: [] }, JSON.stringify({ format: "other" }));
  assert.equal(unknown.code, "unknown-format");
  assert.deepEqual(unknown.operations, []);
  const target = documentToRecords(document());
  const collision = planModernRecordsMerge(target, documentToRecords(document()));
  assert.equal(collision.status, "already-present");
});

test("runtime import paths never call the V1 parser or a legacy detection helper", () => {
  const app = read("site/app.js");
  assert.equal(app.includes("parseDocument("), false);
  assert.equal(app.includes("detectLocalSource("), false);
  assert.equal(app.includes("detectHistoricalDocument("), false);
  assert.match(app, /parseIndexedDbBackup\(text\)/);
  assert.match(app, /planModernRecordsMerge\(/);
  const persistence = read("site/persistence.js");
  assert.equal(persistence.includes("parseDocument"), false);
  assert.match(persistence, /parseIndexedDbBackup\(source\)/);
});
