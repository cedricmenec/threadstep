import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKUP_FORMAT } from "../site/indexeddb-backup.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const docs = {
  target: read("docs/product/specs/dexie-data-lifecycle-target-v1.md"),
  developer: read("docs/product/developer-guide.md"),
  guide: read("docs/product/guide-utilisation.md"),
  mvp: read("docs/product/mvp.md"),
  acceptance: read("docs/product/acceptance-checklist.md")
};

test("the lifecycle target records the modern format and the V1 retirement", () => {
  assert.match(docs.target, new RegExp(BACKUP_FORMAT.replace(/\./g, "\\.")));
  assert.match(docs.target, /plus pris en charge/i);
  assert.match(docs.target, /nettoyage volontaire|nettoyage est facultatif|volontaire/i);
  assert.match(docs.target, /unsyncedTables/);
});

test("current product documentation describes IndexedDB-only storage and modern backups", () => {
  for (const [name, source] of Object.entries(docs)) {
    assert.match(source, /IndexedDB/, name);
  }
  assert.match(docs.developer, new RegExp(BACKUP_FORMAT.replace(/\./g, "\\.")));
  assert.match(docs.guide, new RegExp(BACKUP_FORMAT.replace(/\./g, "\\.")));
  assert.match(docs.mvp, new RegExp(BACKUP_FORMAT.replace(/\./g, "\\.")));
  assert.match(docs.acceptance, new RegExp(BACKUP_FORMAT.replace(/\./g, "\\.")));
  assert.match(docs.guide, /Ne rien effacer/);
});

test("no current guidance instructs importing or restoring V1 backups", () => {
  const current = [docs.developer, docs.guide, docs.mvp, docs.acceptance].join("\n");
  assert.doesNotMatch(current, /exports? V1 existants? restent importables?/i);
  assert.doesNotMatch(current, /compatible avec les anciennes sauvegardes/i);
  assert.doesNotMatch(current, /importer (un|le) (fichier|document|backup|sauvegarde) V1/i);
  assert.doesNotMatch(current, /restaurer (un|le) (fichier|document|backup|sauvegarde) V1/i);
  assert.doesNotMatch(current, /conversion locale V1 sans Cloud \(TS-033\)/i);
  assert.match(docs.developer, /fichier `version: 1`.*refusé|refuse.*`version: 1`/is);
});
