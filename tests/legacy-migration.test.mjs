import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { documentToRecords, recordsToDocument } from "../site/persistence.js";
import {
  BACKUP_FORMAT,
  parseIndexedDbBackup,
  serializeIndexedDbBackup,
  transitionNotice,
  unsupportedV1Refusal
} from "../site/indexeddb-backup.js";
import { planModernRecordsMerge } from "../site/local-migration.js";
import { buildBusinessExport } from "../site/data-integrity-recovery.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

function referenceDocument() {
  const document = emptyDocument();
  for (let subjectIndex = 0; subjectIndex < 5; subjectIndex += 1) {
    const subject = newSubject("Sujet " + subjectIndex, "s" + subjectIndex);
    for (let itemIndex = 0; itemIndex < 3; itemIndex += 1) {
      const item = newItem("Étape " + subjectIndex + "-" + itemIndex,
        itemIndex === 0 ? "urgent" : itemIndex === 1 ? "normal" : "later",
        "i" + subjectIndex + "-" + itemIndex);
      if (itemIndex === 2) {
        item.note = "Note " + subjectIndex;
        item.done = subjectIndex % 2 === 0;
      }
      subject.items.push(item);
    }
    if (subjectIndex < 3) {
      subject.items.push(newItem("Sous-étape " + subjectIndex, "normal", "sub" + subjectIndex, "i" + subjectIndex + "-1"));
    }
    document.subjects.push(subject);
  }
  document.subjects[0].items.push(newItem("Tâche supplémentaire", "normal", "extra-1"));
  return document;
}

test("legacy V1 document is inert and never feeds the business records", () => {
  const legacy = referenceDocument();
  const records = documentToRecords(legacy);
  const modern = serializeIndexedDbBackup(records).document;
  const merged = planModernRecordsMerge({ subjects: [], items: [] }, modern.records);
  assert.equal(merged.status, "ready");
  assert.equal(merged.counts.subjects, 5);
  assert.equal(merged.counts.items, 19);
  assert.equal(JSON.stringify(merged.records).includes("version"), false);
});

test("a V1 file is rejected without any operation", () => {
  const v1 = JSON.stringify(referenceDocument());
  const parsed = parseIndexedDbBackup(v1);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, "unsupported-v1-backup");
  const merge = planModernRecordsMerge({ subjects: [], items: [] }, { subjects: [], items: [] });
  assert.equal(merge.status, "empty-source");
  assert.deepEqual(merge.operations, []);
  const refusal = unsupportedV1Refusal(parsed.code);
  assert.equal(refusal.code, "unsupported-v1-backup");
  assert.equal(refusal.writes, false);
  assert.equal(refusal.conversionPath, null);
  assert.match(refusal.message, new RegExp(BACKUP_FORMAT.replace(/\./g, "\\.")));
});

test("the transition notice invites a modern backup without deleting data", () => {
  const notice = transitionNotice();
  assert.equal(notice.invitesModernBackup, true);
  assert.equal(notice.deletesData, false);
  assert.match(notice.message, /threadstep\.indexeddb-backup/);
  assert.match(notice.message, /Aucune donnée n'est supprimée/);
});

test("the runtime contains no V1 detection, offer or conversion symbol", () => {
  const app = read("site/app.js");
  for (const symbol of [
    "detectHistoricalDocument",
    "availableLocalBackup",
    "offerHistoricalMigration",
    "decideHistoricalOffer",
    "compatibilityGuard",
    "historicalGuard",
    "exportLegacyBackup",
    "renderHistoricalBackup",
    "parseDocument("
  ]) {
    assert.equal(app.includes(symbol), false, "app.js must not contain " + symbol);
  }
  assert.equal(app.includes('addEventListener("storage"'), false);
  const persistence = read("site/persistence.js");
  assert.equal(persistence.includes("compatibilityGuard"), false);
  assert.equal(persistence.includes("readHistoricalDocument"), false);
  const migration = read("site/migration.js");
  assert.equal(migration.includes("detectHistoricalDocument"), false);
  assert.equal(migration.includes("localStorage"), false);
  const lifecycle = read("site/migration-lifecycle.js");
  assert.equal(lifecycle.includes("dismissals"), false);
  assert.equal(lifecycle.includes("localStorage"), false);
});

test("no runtime source calls localStorage.clear or indexedDB.deleteDatabase", () => {
  for (const file of ["site/app.js", "site/local-recovery.js", "site/local-migration.js", "site/local-metadata.js", "site/persistence.js"]) {
    const source = read(file);
    assert.equal(/localStorage\.clear\s*\(/.test(source), false, file);
    assert.equal(/indexedDB\.deleteDatabase\s*\(/.test(source), false, file);
  }
});

test("a legacy key does not appear in a modern export", () => {
  const records = documentToRecords(referenceDocument());
  const exportResult = buildBusinessExport(records);
  assert.equal(exportResult.status, "ready");
  const json = JSON.stringify(exportResult.document);
  assert.equal(json.includes("threadstep.document.v1"), false);
  assert.equal(json.includes("version\":1"), false);
  assert.deepEqual(recordsToDocument(parseIndexedDbBackup(json).records), recordsToDocument(records));
});
