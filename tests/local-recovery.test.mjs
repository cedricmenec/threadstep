import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { availableLocalBackup } from "../site/local-recovery.js";
import { STORAGE_KEY, emptyDocument } from "../site/core.js";

const legacy = JSON.stringify({
  version: 1,
  subjects: [{
    id: "subject-1", title: "Mon projet", items: [{
      id: "item-1", title: "Tâche historique", priority: "normal",
      done: false, parentId: null, note: "Préserver cette note"
    }]
  }]
});
const storage = (raw, throwOnRead = false) => ({
  getItem(key) {
    assert.equal(key, STORAGE_KEY);
    if (throwOnRead) throw Error("Storage access refused");
    return raw;
  },
  setItem() { throw Error("Recovery must be read-only"); },
  removeItem() { throw Error("Recovery must be read-only"); }
});

test("historical backup returns the exact unchanged V1 JSON and correct totals", () => {
  const backup = availableLocalBackup(storage(legacy));
  assert.equal(backup.json, legacy);
  assert.equal(backup.subjects, 1);
  assert.equal(backup.items, 1);
  assert.ok(backup.json.includes("Préserver cette note"));
  assert.ok(Object.isFrozen(backup));
});

test("missing, inaccessible or malformed localStorage is never converted to an empty export", () => {
  assert.equal(availableLocalBackup(null), null);
  assert.equal(availableLocalBackup(storage(null)), null);
  assert.equal(availableLocalBackup(storage("")), null);
  assert.equal(availableLocalBackup(storage("{broken")), null);
  assert.equal(availableLocalBackup(storage(legacy, true)), null);
});

test("an empty but valid historic document remains exportable", () => {
  const json = JSON.stringify(emptyDocument());
  const backup = availableLocalBackup(storage(json));
  assert.equal(backup?.json, json);
  assert.equal(backup?.subjects, 0);
  assert.equal(backup?.items, 0);
});

test("the recovery UI does not import, clear, migrate or modify stored records", () => {
  const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../site/local-recovery.js", import.meta.url), "utf8");
  assert.match(app, /function exportLegacyBackup\(\)/);
  assert.match(app, /backup\.json, "threadstep-historique-v1-sauvegarde\.json"/);
  assert.match(html, /id="auth-export-legacy"/);
  assert.doesNotMatch(source, /\.setItem\(|\.removeItem\(|\.delete\(|\.clear\(|\.put\(|\.add\(/);
  assert.doesNotMatch(source, /cloud\.login|cloud\.sync|\.transaction\(/);
});
