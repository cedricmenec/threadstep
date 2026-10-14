import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument, newSubject, newItem, sortedItems, pendingCount, parseDocument } from "../site/core.js";

test("new document is empty and versioned", () => {
  assert.deepEqual(emptyDocument(), { version: 1, subjects: [] });
});
test("subjects and items are normalized", () => {
  assert.equal(newSubject(" Projet ", "id").title, "Projet");
  assert.equal(newItem(" Étape ", "urgent", "i").title, "Étape");
});
test("items sort by priority and parent", () => {
  const items = [
    newItem("later", "later", "1"),
    newItem("urgent", "urgent", "2"),
    newItem("child", "normal", "3", "2"),
  ];
  assert.deepEqual(sortedItems(items).map((x) => x.id), ["2", "1"]);
  assert.deepEqual(sortedItems(items, "2").map((x) => x.id), ["3"]);
});
test("pending count covers every subject", () => {
  const doc = emptyDocument();
  const subject = newSubject("Work", "s1");
  subject.items.push(newItem("One", "normal", "t1"), newItem("Two", "normal", "t2"));
  subject.items[1].done = true;
  doc.subjects.push(subject);
  assert.equal(pendingCount(doc), 1);
});
test("export/import roundtrips valid data", () => {
  const doc = emptyDocument();
  const subject = newSubject("Work", "s1");
  subject.items.push(newItem("One", "normal", "t1"));
  doc.subjects.push(subject);
  assert.deepEqual(parseDocument(JSON.stringify(doc)), doc);
});
test("import rejects invalid hierarchy, IDs and versions", () => {
  assert.throws(() => parseDocument('{"version":3,"subjects":[]}'));
  const doc = emptyDocument();
  const subject = newSubject("Work", "s1");
  subject.items.push(newItem("Orphan", "normal", "t1", "missing"));
  doc.subjects.push(subject);
  assert.throws(() => parseDocument(JSON.stringify(doc)));
  const dup = emptyDocument();
  dup.subjects.push(newSubject("One", "s"), newSubject("Two", "s"));
  assert.throws(() => parseDocument(JSON.stringify(dup)));
});
