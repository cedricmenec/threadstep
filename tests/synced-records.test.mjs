import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizedSyncedRecords, readSyncedRecords } from "../site/synced-records.js";
import { recordsToDocument, documentToRecords } from "../site/persistence.js";
import { parseDocument } from "../site/core.js";

const source = {
  subjects: [{ id: "legacy:s1", title: "Projet", order: 0, owner: "private-owner", realmId: "private-realm" }],
  items: [{ id: "legacy:i1", subjectId: "legacy:s1", parentId: null,
    title: "Une tâche", order: 0, priority: "urgent", done: false,
    note: "Notes intactes", owner: "private-owner", realmId: "private-realm" }]
};
function fakeDb(value, fail) {
  return {
    subjects: { toArray: async () => {
      if (fail) throw Error("IDB read refused");
      return structuredClone(value.subjects);
    } },
    items: { toArray: async () => structuredClone(value.items) },
    async transaction(mode, a, b, callback) {
      assert.equal(mode, "r");
      assert.equal(a, this.subjects);
      assert.equal(b, this.items);
      return callback();
    }
  };
}
test("readSyncedRecords loads both IndexedDB tables atomically and preserves V1 notes and IDs", async () => {
  const result = await readSyncedRecords(fakeDb(source));
  assert.equal(result.subjects[0].id, "legacy:s1");
  assert.equal(result.items[0].note, "Notes intactes");
  assert.equal(result.items[0].subjectId, "legacy:s1");
  assert.deepEqual(recordsToDocument(result).subjects[0].items[0].parentId, null);
  assert.doesNotMatch(JSON.stringify(result), /private-owner|private-realm/);
});
test("a failed IndexedDB read throws; it can never look like an empty target", async () => {
  await assert.rejects(readSyncedRecords(fakeDb(source, true)), /IDB read refused/);
  await assert.rejects(readSyncedRecords(null), /not initialized/);
});
test("orphan records fail closed instead of disappearing from the rendered view", () => {
  assert.throws(() => normalizedSyncedRecords({
    subjects: [], items: [source.items[0]]
  }), /Dangling subject references/);
});
test("empty IndexedDB is valid but unrelated legacy localStorage is not read by the Cloud adapter", async () => {
  assert.deepEqual(await readSyncedRecords(fakeDb({subjects:[],items:[]})), {subjects:[],items:[]});
  const module = readFileSync(new URL("../site/synced-records.js", import.meta.url), "utf8");
  assert.doesNotMatch(module, /localStorage|fetch\s*\(/);
});
test("a projected native record roundtrips and stays valid with a legacy ID", () => {
  const projected = normalizedSyncedRecords(source);
  const document = recordsToDocument(projected);
  assert.deepEqual(parseDocument(JSON.stringify(document)), document);
  assert.deepEqual(documentToRecords(document), projected);
});
test("browser wiring initializes native session before displaying the business view", () => {
  const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
  assert.match(app, /syncedDatabase\.open\(\)/);
  assert.match(app, /dashboardEl\.hidden = Boolean\(settingsSection\) \|\|\s*\(configured && \(!authenticated \|\| bindingBlocked \|\| !documentLoaded\)\)/);
  assert.match(app, /refreshSyncedDocument\(\)/);
  assert.match(app, /readSyncedRecords\(syncedDatabase\)/);
  assert.match(app, /await businessStore\.commit\(operations\);[\s\S]*?lastRecords = records/);
  assert.match(app, /reconciliationAdapter\(\)/);
  assert.match(app, /operation\.type !== "add"/);
  assert.match(app, /await pendingCloudWrites/);
  assert.doesNotMatch(app, /return emptyRecords\(\);\s*\}\s*catch/);
});
