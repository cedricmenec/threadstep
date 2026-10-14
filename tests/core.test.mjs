import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument, newSubject, newItem, sortedItems, pendingCount, parseDocument, moveSubject, updateItem } from "../site/core.js";

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
test("moveSubject swaps with the neighbouring subject", () => {
  const subjects = [newSubject("A", "a"), newSubject("B", "b"), newSubject("C", "c")];
  assert.deepEqual(moveSubject(subjects, "c", "up").map((s) => s.id), ["a", "c", "b"]);
  assert.deepEqual(moveSubject(subjects, "a", "down").map((s) => s.id), ["b", "a", "c"]);
});
test("moveSubject is a no-op at the boundaries and leaves input untouched", () => {
  const subjects = [newSubject("A", "a"), newSubject("B", "b"), newSubject("C", "c")];
  assert.equal(moveSubject(subjects, "a", "up"), subjects);
  assert.equal(moveSubject(subjects, "c", "down"), subjects);
  assert.equal(moveSubject(subjects, "missing", "up"), subjects);
  assert.deepEqual(subjects.map((s) => s.id), ["a", "b", "c"]);
});
test("moveSubject preserves subject data and does not mutate the source array", () => {
  const doc = emptyDocument();
  const a = newSubject("A", "a");
  a.items.push(newItem("Task", "urgent", "t1"));
  a.items[0].done = true;
  const b = newSubject("B", "b");
  b.items.push(newItem("Child", "later", "t2", "t3"), newItem("Parent", "normal", "t3"));
  doc.subjects.push(a, b);
  const moved = moveSubject(doc.subjects, "b", "up");
  assert.deepEqual(moved.map((s) => s.id), ["b", "a"]);
  assert.deepEqual(moved[1], a);
  assert.deepEqual(doc.subjects.map((s) => s.id), ["a", "b"]);
  assert.deepEqual(parseDocument(JSON.stringify({ version: 1, subjects: moved })), { version: 1, subjects: moved });
});
test("updateItem renames and reprioritizes while preserving everything else", () => {
  const doc = emptyDocument();
  const a = newSubject("A", "a");
  a.items.push(newItem("Appeler Paul", "normal", "t1"));
  const b = newSubject("B", "b");
  b.items.push(newItem("Autre", "urgent", "t2"));
  doc.subjects.push(a, b);
  const next = updateItem(doc, "a", "t1", { title: "  Relancer Paul  ", priority: "urgent" });
  assert.notEqual(next, doc);
  assert.equal(next.subjects[0].items[0].title, "Relancer Paul");
  assert.equal(next.subjects[0].items[0].priority, "urgent");
  assert.deepEqual(Object.keys(next.subjects[0].items[0]).sort(), ["done", "id", "parentId", "priority", "title"]);
  assert.equal(next.subjects[0].items[0].id, "t1");
  assert.equal(next.subjects[0].items[0].done, false);
  assert.equal(next.subjects[0].items[0].parentId, null);
  assert.notEqual(next.subjects[0], a);
  assert.equal(next.subjects[1], b);
  assert.equal(next.subjects[0].items[0] === doc.subjects[0].items[0], false);
  assert.deepEqual(doc.subjects[0].items[0].title, "Appeler Paul");
  assert.deepEqual(doc.subjects[0].items[0].priority, "normal");
  assert.deepEqual(doc.subjects[1], b);
});

test("updateItem returns the original reference for invalid or no-op edits", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "a");
  subject.items.push(newItem("Titre", "normal", "t1"));
  doc.subjects.push(subject);
  assert.equal(updateItem(doc, "missing", "t1", { title: "X", priority: "urgent" }), doc);
  assert.equal(updateItem(doc, "a", "missing", { title: "X", priority: "urgent" }), doc);
  assert.equal(updateItem(doc, "a", "t1", { title: "", priority: "urgent" }), doc);
  assert.equal(updateItem(doc, "a", "t1", { title: "   ", priority: "urgent" }), doc);
  assert.equal(updateItem(doc, "a", "t1", { title: "a".repeat(301), priority: "urgent" }), doc);
  assert.equal(updateItem(doc, "a", "t1", { title: "  " + "a".repeat(300) + "  ", priority: "urgent" }) === doc, false);
  assert.equal(updateItem(doc, "a", "t1", { title: "Titre", priority: "demain" }), doc);
  assert.equal(updateItem(doc, "a", "t1", { title: "Titre", priority: "normal" }), doc);
  assert.equal(updateItem(doc, "a", "t1", { title: " Titre ", priority: "normal" }), doc);
  assert.equal(updateItem(doc, "a", "t1", {}), doc);
  assert.equal(updateItem(doc, "a", "t1", null), doc);
});

test("updateItem preserves parent and substep hierarchy and round-trips", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "a");
  subject.items.push(newItem("Parent", "normal", "p"), newItem("Enfant", "later", "c", "p"));
  subject.items[0].done = true;
  doc.subjects.push(subject);
  const nextParent = updateItem(doc, "a", "p", { title: "Parent renommé", priority: "urgent" });
  assert.equal(nextParent.subjects[0].items[0].id, "p");
  assert.equal(nextParent.subjects[0].items[0].done, true);
  assert.equal(nextParent.subjects[0].items[0].parentId, null);
  assert.equal(nextParent.subjects[0].items[1].parentId, "p");
  assert.equal(nextParent.subjects[0].items[1].title, "Enfant");
  assert.deepEqual(parseDocument(JSON.stringify(nextParent)), JSON.parse(JSON.stringify(nextParent)));

  const nextChild = updateItem(doc, "a", "c", { title: "Enfant renommé", priority: "urgent" });
  assert.equal(nextChild.subjects[0].items[1].parentId, "p");
  assert.equal(nextChild.subjects[0].items[1].id, "c");
  assert.equal(nextChild.subjects[0].items[0].title, "Parent");
  assert.equal(nextChild.subjects[0].items[0].done, true);
  assert.deepEqual(parseDocument(JSON.stringify(nextChild)), JSON.parse(JSON.stringify(nextChild)));
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
