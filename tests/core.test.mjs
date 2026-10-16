import test from "node:test";
import assert from "node:assert/strict";
import { RESUME_KEY, STORAGE_KEY, PRIORITIES, emptyDocument, newSubject, newItem, sortedItems, visibleItems, isItemVisible, pendingCount, parseDocument, subjectRoute, parseRoute, findSubject, renameSubject, moveSubject, updateItem, setItemPriority, reorderWithinPriority, moveWithinPriority, canReorderWithinPriority, canMoveWithinPriority, nextActionSuggestion, suggestionReason, parseResumePreference, serializeResumePreference, resumeView, planRemoval, restoreRemoval, removalContainsItem, restorableTrackingRef, substepView, substepToggleLabel, toggleCollapsedParent } from "../site/core.js";

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

test("visibleItems shows everything when the filter is off", () => {
  const items = [
    newItem("Fait", "normal", "d"),
    newItem("À faire", "urgent", "u"),
  ];
  items[0].done = true;
  assert.deepEqual(visibleItems(items, null, false).map((x) => x.id), ["u", "d"]);
});

test("visibleItems hides completed items and preserves priority order", () => {
  const items = [
    newItem("Fait urgent", "urgent", "du"),
    newItem("À faire plus tard", "later", "ul"),
    newItem("Fait normal", "normal", "dn"),
    newItem("À faire urgent", "urgent", "uu"),
  ];
  items[0].done = true;
  items[2].done = true;
  assert.deepEqual(visibleItems(items, null, true).map((x) => x.id), ["uu", "ul"]);
});

test("visibleItems keeps a completed parent when it has an unfinished child", () => {
  const items = [
    newItem("Parent terminé", "normal", "p"),
    newItem("Enfant à faire", "later", "c1", "p"),
    newItem("Enfant terminé", "urgent", "c2", "p"),
  ];
  items[0].done = true;
  items[2].done = true;
  assert.equal(isItemVisible(items[0], items, true), true);
  assert.deepEqual(visibleItems(items, null, true).map((x) => x.id), ["p"]);
  assert.deepEqual(visibleItems(items, "p", true).map((x) => x.id), ["c1"]);
});

test("visibleItems hides a completed parent whose children are all done", () => {
  const items = [
    newItem("Parent terminé", "normal", "p"),
    newItem("Enfant terminé", "urgent", "c", "p"),
  ];
  items[0].done = true;
  items[1].done = true;
  assert.equal(isItemVisible(items[0], items, true), false);
  assert.deepEqual(visibleItems(items, null, true), []);
});

test("visibleItems does not mutate items and disabling restores full order", () => {
  const items = [
    newItem("Fait", "urgent", "d"),
    newItem("À faire", "normal", "u"),
  ];
  items[0].done = true;
  const snapshot = JSON.parse(JSON.stringify(items));
  assert.deepEqual(visibleItems(items, null, true).map((x) => x.id), ["u"]);
  assert.deepEqual(items, snapshot);
  assert.deepEqual(visibleItems(items, null, false).map((x) => x.id), sortedItems(items).map((x) => x.id));
});

test("substepView offers a control only for a parent with visible substeps", () => {
  const items = [
    newItem("Parent", "normal", "p"),
    newItem("Enfant 1", "later", "c1", "p"),
    newItem("Enfant 2", "urgent", "c2", "p"),
    newItem("Sans enfant", "normal", "alone"),
  ];
  const withChildren = substepView(items, "p", false, new Set());
  assert.deepEqual(withChildren.children.map((x) => x.id), ["c2", "c1"]);
  assert.equal(withChildren.hasVisibleSubsteps, true);
  assert.equal(withChildren.collapsed, false);
  assert.equal(withChildren.renderChildren, true);
  const withoutChildren = substepView(items, "alone", false, new Set());
  assert.deepEqual(withoutChildren.children, []);
  assert.equal(withoutChildren.hasVisibleSubsteps, false);
  assert.equal(withoutChildren.renderChildren, false);
  const substepAsParent = substepView(items, "c1", false, new Set());
  assert.deepEqual(substepAsParent.children, []);
  assert.equal(substepAsParent.hasVisibleSubsteps, false);
  assert.equal(substepAsParent.renderChildren, false);
  const noParent = substepView(items, null, false, new Set());
  assert.equal(noParent.hasVisibleSubsteps, false);
  assert.equal(noParent.collapsed, false);
  assert.equal(noParent.renderChildren, false);
});

test("substepView collapses only the targeted parent and never mutates inputs", () => {
  const items = [
    newItem("A", "normal", "a"),
    newItem("B", "normal", "b"),
    newItem("a1", "normal", "a1", "a"),
    newItem("b1", "normal", "b1", "b"),
  ];
  const snapshot = JSON.parse(JSON.stringify(items));
  const collapsedIds = new Set(["a"]);
  const a = substepView(items, "a", false, collapsedIds);
  assert.equal(a.collapsed, true);
  assert.equal(a.renderChildren, false);
  assert.equal(a.hasVisibleSubsteps, true);
  const b = substepView(items, "b", false, collapsedIds);
  assert.equal(b.collapsed, false);
  assert.equal(b.renderChildren, true);
  assert.deepEqual(b.children.map((x) => x.id), ["b1"]);
  assert.deepEqual(items, snapshot);
  assert.deepEqual([...collapsedIds], ["a"]);
  const collapsed = toggleCollapsedParent(new Set(), "a");
  assert.deepEqual([...collapsed], ["a"]);
  const expanded = toggleCollapsedParent(collapsed, "a");
  assert.deepEqual([...expanded], []);
  const both = toggleCollapsedParent(collapsed, "b");
  assert.deepEqual([...both].sort(), ["a", "b"]);
  assert.deepEqual([...collapsed], ["a"]);
  assert.deepEqual([...toggleCollapsedParent(null, "x")], ["x"]);
});

test("substepView respects the completion filter without revealing hidden substeps", () => {
  const items = [
    newItem("Parent", "normal", "p"),
    newItem("Fait", "normal", "c1", "p"),
    newItem("À faire", "normal", "c2", "p"),
  ];
  items[1].done = true;
  const filtered = substepView(items, "p", true, new Set());
  assert.deepEqual(filtered.children.map((x) => x.id), ["c2"]);
  assert.equal(filtered.hasVisibleSubsteps, true);
  assert.equal(filtered.renderChildren, true);
  const allDone = [
    newItem("Parent", "normal", "p"),
    newItem("Fait 1", "normal", "c1", "p"),
    newItem("Fait 2", "normal", "c2", "p"),
  ];
  allDone[1].done = true;
  allDone[2].done = true;
  const hidden = substepView(allDone, "p", true, new Set(["p"]));
  assert.deepEqual(hidden.children, []);
  assert.equal(hidden.hasVisibleSubsteps, false);
  assert.equal(hidden.collapsed, false);
  assert.equal(hidden.renderChildren, false);
});

test("substepToggleLabel returns the exact expanded, singular and plural labels", () => {
  assert.equal(substepToggleLabel(1, false), "Masquer les sous-tâches");
  assert.equal(substepToggleLabel(3, false), "Masquer les sous-tâches");
  assert.equal(substepToggleLabel(1, true), "Voir 1 sous-tâche");
  assert.equal(substepToggleLabel(2, true), "Voir 2 sous-tâches");
  assert.equal(substepToggleLabel(5, true), "Voir 5 sous-tâches");
  assert.equal(substepToggleLabel(0, true), "Masquer les sous-tâches");
  assert.equal(substepToggleLabel(0, false), "Masquer les sous-tâches");
  assert.equal(substepToggleLabel("abc", true), "Masquer les sous-tâches");
  assert.equal(substepToggleLabel(undefined, true), "Masquer les sous-tâches");
  assert.equal(substepToggleLabel(2, undefined), "Masquer les sous-tâches");
});

test("substepToggleLabel count follows the completion filter and matches substepView", () => {
  const items = [
    newItem("Parent", "normal", "p"),
    newItem("Un", "normal", "c1", "p"),
    newItem("Deux", "normal", "c2", "p"),
    newItem("Trois", "normal", "c3", "p"),
  ];
  items[3].done = true;
  const unfiltered = substepView(items, "p", false, new Set(["p"]));
  assert.equal(unfiltered.children.length, 3);
  assert.equal(substepToggleLabel(unfiltered.children.length, unfiltered.collapsed), "Voir 3 sous-tâches");
  const filtered = substepView(items, "p", true, new Set(["p"]));
  assert.equal(filtered.children.length, 2);
  assert.equal(substepToggleLabel(filtered.children.length, filtered.collapsed), "Voir 2 sous-tâches");
  const allDone = [
    newItem("Parent", "normal", "p"),
    newItem("Fait", "normal", "c1", "p"),
  ];
  allDone[1].done = true;
  const noneVisible = substepView(allDone, "p", true, new Set());
  assert.equal(noneVisible.hasVisibleSubsteps, false);
  assert.deepEqual(noneVisible.children, []);
});

test("substepView and substepToggleLabel never mutate items or the collapsed set", () => {
  const items = [
    newItem("Parent", "normal", "p"),
    newItem("Enfant", "later", "c1", "p"),
  ];
  const snapshot = JSON.parse(JSON.stringify(items));
  const collapsedIds = new Set(["p"]);
  const before = [...collapsedIds];
  const view = substepView(items, "p", false, collapsedIds);
  substepToggleLabel(view.children.length, view.collapsed);
  assert.equal(view.collapsed, true);
  assert.deepEqual(items, snapshot);
  assert.deepEqual([...collapsedIds], before);
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

test("nextActionSuggestion picks the first urgent top-level action across subjects", () => {
  const doc = emptyDocument();
  const a = newSubject("A", "a");
  a.items.push(newItem("Normal A", "normal", "a1"), newItem("Urgent A", "urgent", "a2"), newItem("Later A", "later", "a3"));
  const b = newSubject("B", "b");
  b.items.push(newItem("Urgent B", "urgent", "b1"));
  doc.subjects.push(a, b);
  assert.deepEqual(nextActionSuggestion(doc), {
    subjectId: "a",
    subjectTitle: "A",
    itemId: "a2",
    itemTitle: "Urgent A",
    priority: "urgent",
  });
});

test("nextActionSuggestion lets priority dominate subject order", () => {
  const doc = emptyDocument();
  const first = newSubject("First", "s1");
  first.items.push(newItem("Normal first", "normal", "f1"));
  const second = newSubject("Second", "s2");
  second.items.push(newItem("Urgent later subject", "urgent", "s2i"));
  doc.subjects.push(first, second);
  assert.equal(nextActionSuggestion(doc).itemId, "s2i");
});

test("nextActionSuggestion breaks priority ties by subject order", () => {
  const doc = emptyDocument();
  const a = newSubject("A", "a");
  a.items.push(newItem("A task", "normal", "a1"));
  const b = newSubject("B", "b");
  b.items.push(newItem("B task", "normal", "b1"));
  doc.subjects.push(a, b);
  assert.equal(nextActionSuggestion(doc).itemId, "a1");
});

test("nextActionSuggestion breaks within-subject ties by raw item order", () => {
  const subject = newSubject("A", "a");
  subject.items.push(newItem("Second listed", "urgent", "second-id"), newItem("First listed", "urgent", "first-id"));
  const doc = { version: 1, subjects: [subject] };
  assert.equal(nextActionSuggestion(doc).itemId, "second-id");
});

test("nextActionSuggestion excludes completed top-level actions", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "a");
  const done = newItem("Done urgent", "urgent", "d");
  done.done = true;
  subject.items.push(done, newItem("Todo", "later", "t"));
  doc.subjects.push(subject);
  assert.equal(nextActionSuggestion(doc).itemId, "t");
});

test("nextActionSuggestion never returns a substep even when unfinished", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "a");
  subject.items.push(newItem("Parent", "normal", "p"), newItem("Child", "urgent", "c", "p"));
  doc.subjects.push(subject);
  assert.equal(nextActionSuggestion(doc).itemId, "p");
});

test("nextActionSuggestion excludes a completed parent with an unfinished child", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "a");
  const parent = newItem("Parent", "urgent", "p");
  parent.done = true;
  subject.items.push(parent, newItem("Child", "urgent", "c", "p"));
  doc.subjects.push(subject);
  assert.equal(nextActionSuggestion(doc), null);
});

test("nextActionSuggestion returns null for empty, completed-only and substep-only documents", () => {
  assert.equal(nextActionSuggestion(emptyDocument()), null);
  const completed = emptyDocument();
  const doneSubject = newSubject("A", "a");
  const done = newItem("Done", "normal", "d");
  done.done = true;
  doneSubject.items.push(done);
  completed.subjects.push(doneSubject);
  assert.equal(nextActionSuggestion(completed), null);
  const substepsOnly = emptyDocument();
  const substepSubject = newSubject("B", "b");
  const parent = newItem("Parent done", "normal", "p");
  parent.done = true;
  substepSubject.items.push(parent, newItem("Child", "normal", "c", "p"));
  substepsOnly.subjects.push(substepSubject);
  assert.equal(nextActionSuggestion(substepsOnly), null);
});

test("nextActionSuggestion does not mutate its input and is stable across calls", () => {
  const doc = emptyDocument();
  const a = newSubject("A", "a");
  a.items.push(newItem("A1", "normal", "a1"));
  const b = newSubject("B", "b");
  b.items.push(newItem("B1", "urgent", "b1"), newItem("B2", "urgent", "b2"));
  doc.subjects.push(a, b);
  const snapshot = JSON.parse(JSON.stringify(doc));
  const first = nextActionSuggestion(doc);
  const second = nextActionSuggestion(doc);
  assert.deepEqual(first, second);
  assert.equal(first.itemId, "b1");
  assert.deepEqual(Object.keys(first).sort(), ["itemId", "itemTitle", "priority", "subjectId", "subjectTitle"]);
  assert.deepEqual(doc, snapshot);
});

test("suggestionReason returns the exact explanation for each priority", () => {
  assert.equal(suggestionReason("urgent"), "Choisie selon sa priorité « Urgent » ; en cas d'égalité, l'ordre des sujets puis des actions décide.");
  assert.equal(suggestionReason("normal"), "Choisie selon sa priorité « Normal » ; en cas d'égalité, l'ordre des sujets puis des actions décide.");
  assert.equal(suggestionReason("later"), "Choisie selon sa priorité « Plus tard » ; en cas d'égalité, l'ordre des sujets puis des actions décide.");
});

test("suggestionReason names the effective priority and the tie-break order", () => {
  assert.match(suggestionReason("normal"), /« Normal »/);
  assert.match(suggestionReason("later"), /« Plus tard »/);
  assert.match(suggestionReason("urgent"), /l'ordre des sujets puis des actions/);
});

test("suggestionReason returns null for any invalid priority", () => {
  assert.equal(suggestionReason("demain"), null);
  assert.equal(suggestionReason("toString"), null);
  assert.equal(suggestionReason("constructor"), null);
  assert.equal(suggestionReason("__proto__"), null);
  assert.equal(suggestionReason("Urgent"), null);
  assert.equal(suggestionReason(""), null);
  assert.equal(suggestionReason(null), null);
  assert.equal(suggestionReason(undefined), null);
  assert.equal(suggestionReason(42), null);
  assert.equal(suggestionReason({}), null);
});

test("suggestionReason is deterministic across repeated calls", () => {
  for (const priority of ["urgent", "normal", "later"]) {
    assert.equal(suggestionReason(priority), suggestionReason(priority));
  }
});

test("RESUME_KEY is separate from the document storage key", () => {
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  assert.notEqual(RESUME_KEY, "threadstep.document.v1");
});

test("parseResumePreference accepts a valid stored reference", () => {
  assert.deepEqual(parseResumePreference('{"subjectId":"s1","itemId":"t1"}'), { subjectId: "s1", itemId: "t1" });
});

test("parseResumePreference rejects invalid input without throwing", () => {
  assert.equal(parseResumePreference(null), null);
  assert.equal(parseResumePreference(undefined), null);
  assert.equal(parseResumePreference(42), null);
  assert.equal(parseResumePreference(""), null);
  assert.equal(parseResumePreference("pas du json"), null);
  assert.equal(parseResumePreference("[]"), null);
  assert.equal(parseResumePreference("42"), null);
  assert.equal(parseResumePreference('"texte"'), null);
  assert.equal(parseResumePreference("null"), null);
  assert.equal(parseResumePreference('{"subjectId":"","itemId":"t1"}'), null);
  assert.equal(parseResumePreference('{"subjectId":"s1","itemId":""}'), null);
  assert.equal(parseResumePreference('{"subjectId":"s1"}'), null);
  assert.equal(parseResumePreference('{"itemId":"t1"}'), null);
  assert.equal(parseResumePreference(JSON.stringify({ subjectId: "a".repeat(101), itemId: "t1" })), null);
  assert.equal(parseResumePreference(JSON.stringify({ subjectId: "s1", itemId: "b".repeat(101) })), null);
  assert.equal(parseResumePreference(JSON.stringify({ subjectId: {}, itemId: "t1" })), null);
  assert.equal(parseResumePreference(JSON.stringify({ subjectId: "s1", itemId: 7 })), null);
});

test("serializeResumePreference round-trips through parseResumePreference", () => {
  const ref = { subjectId: "s1", itemId: "t1" };
  const raw = serializeResumePreference(ref);
  assert.equal(typeof raw, "string");
  assert.deepEqual(parseResumePreference(raw), ref);
  assert.deepEqual(parseResumePreference(serializeResumePreference({ subjectId: "s", itemId: "i", extra: "ignored" })), { subjectId: "s", itemId: "i" });
});

test("serializeResumePreference returns null for invalid references", () => {
  assert.equal(serializeResumePreference(null), null);
  assert.equal(serializeResumePreference(undefined), null);
  assert.equal(serializeResumePreference({ subjectId: "", itemId: "t1" }), null);
  assert.equal(serializeResumePreference({ subjectId: "s1", itemId: "" }), null);
  assert.equal(serializeResumePreference({ subjectId: "s1" }), null);
  assert.equal(serializeResumePreference({ subjectId: "a".repeat(101), itemId: "t1" }), null);
  assert.equal(serializeResumePreference("s1"), null);
});

function resumeDocument() {
  const doc = emptyDocument();
  const subject = newSubject("Appels", "s1");
  subject.items.push(newItem("Relancer Paul", "urgent", "t1"));
  doc.subjects.push(subject);
  return doc;
}

test("resumeView resolves an unfinished top-level action with subject, title and priority", () => {
  const doc = resumeDocument();
  assert.deepEqual(resumeView(doc, { subjectId: "s1", itemId: "t1" }), {
    subjectId: "s1",
    subjectTitle: "Appels",
    itemId: "t1",
    itemTitle: "Relancer Paul",
    priority: "urgent"
  });
});

test("resumeView returns null for completed, substep, missing and empty references", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "s1");
  const done = newItem("Terminée", "normal", "d");
  done.done = true;
  subject.items.push(newItem("Parent", "normal", "p"), newItem("Enfant", "urgent", "c", "p"), done);
  doc.subjects.push(subject);
  assert.equal(resumeView(doc, { subjectId: "s1", itemId: "d" }), null);
  assert.equal(resumeView(doc, { subjectId: "s1", itemId: "c" }), null);
  assert.equal(resumeView(doc, { subjectId: "s1", itemId: "absente" }), null);
  assert.equal(resumeView(doc, { subjectId: "absent", itemId: "p" }), null);
  assert.equal(resumeView(doc, null), null);
  assert.equal(resumeView(doc, {}), null);
  assert.equal(resumeView(doc, { subjectId: "", itemId: "p" }), null);
  assert.equal(resumeView(doc, { subjectId: "s1" }), null);
});

test("resumeView never mutates its input document", () => {
  const doc = resumeDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  resumeView(doc, { subjectId: "s1", itemId: "t1" });
  resumeView(doc, { subjectId: "s1", itemId: "missing" });
  resumeView(doc, null);
  assert.deepEqual(doc, snapshot);
});

test("resume selection is unique and a different reference resolves to the other action", () => {
  const doc = emptyDocument();
  const a = newSubject("Alpha", "sa");
  a.items.push(newItem("Action A", "normal", "ia"));
  const b = newSubject("Beta", "sb");
  b.items.push(newItem("Action B", "urgent", "ib"));
  doc.subjects.push(a, b);
  const viewA = resumeView(doc, { subjectId: "sa", itemId: "ia" });
  const viewB = resumeView(doc, { subjectId: "sb", itemId: "ib" });
  assert.equal(viewA.itemId, "ia");
  assert.equal(viewA.subjectId, "sa");
  assert.equal(viewB.itemId, "ib");
  assert.equal(viewB.subjectId, "sb");
  assert.notEqual(viewA.itemId, viewB.itemId);
  assert.deepEqual(parseResumePreference(serializeResumePreference({ subjectId: "sb", itemId: "ib" })), { subjectId: "sb", itemId: "ib" });
  assert.deepEqual(resumeView(doc, parseResumePreference(serializeResumePreference({ subjectId: "sb", itemId: "ib" }))), viewB);
});

test("resume preference survives a reload round-trip", () => {
  const doc = resumeDocument();
  const ref = { subjectId: "s1", itemId: "t1" };
  const raw = serializeResumePreference(ref);
  const restored = parseResumePreference(raw);
  assert.deepEqual(resumeView(doc, restored), resumeView(doc, ref));
});

test("resume tracking survives renaming, reprioritizing and subject reordering", () => {
  const doc = emptyDocument();
  const a = newSubject("Alpha", "sa");
  a.items.push(newItem("Action A", "normal", "ia"));
  const b = newSubject("Beta", "sb");
  b.items.push(newItem("Action B", "urgent", "ib"));
  doc.subjects.push(a, b);
  const ref = { subjectId: "sb", itemId: "ib" };
  const renamed = updateItem(doc, "sb", "ib", { title: "Action B renommée", priority: "later" });
  const reordered = { ...renamed, subjects: moveSubject(renamed.subjects, "sb", "up") };
  const restored = parseResumePreference(serializeResumePreference(ref));
  assert.deepEqual(resumeView(reordered, restored), {
    subjectId: "sb",
    subjectTitle: "Beta",
    itemId: "ib",
    itemTitle: "Action B renommée",
    priority: "later"
  });
  assert.deepEqual(reordered.subjects.map((s) => s.id), ["sb", "sa"]);
});

test("nextActionSuggestion is independent from the resume reference", () => {
  const doc = emptyDocument();
  const a = newSubject("Alpha", "sa");
  a.items.push(newItem("Action A", "normal", "ia"));
  const b = newSubject("Beta", "sb");
  b.items.push(newItem("Action B", "urgent", "ib"));
  doc.subjects.push(a, b);
  const snapshot = JSON.parse(JSON.stringify(doc));
  const before = nextActionSuggestion(doc);
  const ref = parseResumePreference(serializeResumePreference({ subjectId: "sa", itemId: "ia" }));
  resumeView(doc, ref);
  const after = nextActionSuggestion(doc);
  assert.deepEqual(after, before);
  assert.equal(after.itemId, "ib");
  assert.deepEqual(doc, snapshot);
});

function removalDocument() {
  const doc = emptyDocument();
  const subject = newSubject("Fils", "s1");
  subject.items.push(
    newItem("Parent", "normal", "p"),
    newItem("Enfant A", "urgent", "c1", "p"),
    newItem("Autre action", "later", "o1"),
    newItem("Enfant B", "normal", "c2", "p"),
  );
  subject.items[1].done = true;
  doc.subjects.push(subject);
  return doc;
}

test("planRemoval removes a top-level action with all its substeps in order", () => {
  const doc = removalDocument();
  const result = planRemoval(doc, "s1", "p");
  assert.equal(result.removal.subjectId, "s1");
  assert.equal(result.removal.rootId, "p");
  assert.deepEqual(result.removal.entries.map((e) => e.item.id), ["p", "c1", "c2"]);
  assert.deepEqual(result.removal.entries.map((e) => e.index), [0, 1, 3]);
  assert.deepEqual(result.document.subjects[0].items.map((i) => i.id), ["o1"]);
});

test("planRemoval removes a single substep without touching its siblings", () => {
  const doc = removalDocument();
  const result = planRemoval(doc, "s1", "c1");
  assert.deepEqual(result.removal.entries.map((e) => e.item.id), ["c1"]);
  assert.deepEqual(result.removal.entries.map((e) => e.index), [1]);
  assert.deepEqual(result.document.subjects[0].items.map((i) => i.id), ["p", "o1", "c2"]);
});

test("planRemoval is a no-op for a missing subject or item and never mutates the input", () => {
  const doc = removalDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  assert.equal(planRemoval(doc, "absent", "p").document, doc);
  assert.equal(planRemoval(doc, "absent", "p").removal, null);
  assert.equal(planRemoval(doc, "s1", "absent").document, doc);
  assert.equal(planRemoval(doc, "s1", "absent").removal, null);
  assert.deepEqual(doc, snapshot);
});

test("planRemoval returns new structures without sharing the removed references", () => {
  const doc = removalDocument();
  const subject = doc.subjects[0];
  const result = planRemoval(doc, "s1", "p");
  assert.notEqual(result.document, doc);
  assert.notEqual(result.document.subjects, doc.subjects);
  assert.notEqual(result.document.subjects[0], subject);
  assert.notEqual(result.document.subjects[0].items, subject.items);
  assert.notEqual(result.removal.entries[0].item, subject.items[0]);
  assert.equal(result.removal.entries[0].item.parentId, null);
  assert.equal(result.removal.entries[1].item.parentId, "p");
  assert.equal(subject.items.length, 4);
});

test("restoreRemoval rebuilds the exact subtree with identities, order and flags", () => {
  const doc = removalDocument();
  const { document: after, removal } = planRemoval(doc, "s1", "p");
  const restored = restoreRemoval(after, removal);
  assert.notEqual(restored, after);
  assert.deepEqual(restored, doc);
  const items = restored.subjects[0].items;
  assert.deepEqual(items.map((i) => i.id), ["p", "c1", "o1", "c2"]);
  assert.equal(items[1].done, true);
  assert.equal(items[1].parentId, "p");
  assert.equal(items[3].parentId, "p");
});

test("restoreRemoval restores a single substep to its original position", () => {
  const doc = removalDocument();
  const { document: after, removal } = planRemoval(doc, "s1", "c2");
  const restored = restoreRemoval(after, removal);
  assert.deepEqual(restored.subjects[0].items.map((i) => i.id), ["p", "c1", "o1", "c2"]);
  assert.deepEqual(restored, doc);
});

test("restoreRemoval preserves unrelated changes made before the undo", () => {
  const doc = removalDocument();
  const { document: after, removal } = planRemoval(doc, "s1", "p");
  const added = { ...after, subjects: after.subjects.map((s) => ({
    ...s, items: [...s.items, newItem("Nouveau", "urgent", "n1")]
  })) };
  const restored = restoreRemoval(added, removal);
  assert.deepEqual(restored.subjects[0].items.map((i) => i.id), ["p", "c1", "o1", "c2", "n1"]);
  assert.equal(restored.subjects[0].items.find((i) => i.id === "n1").title, "Nouveau");
});

test("restoreRemoval skips ids already present and ignores invalid receipts", () => {
  const doc = removalDocument();
  const { document: after, removal } = planRemoval(doc, "s1", "p");
  const kept = { ...after, subjects: after.subjects.map((s) => ({
    ...s, items: [...s.items, { ...doc.subjects[0].items[0] }]
  })) };
  const restored = restoreRemoval(kept, removal);
  assert.equal(restored.subjects[0].items.filter((i) => i.id === "p").length, 1);
  assert.deepEqual(restored.subjects[0].items.map((i) => i.id).sort(), ["c1", "c2", "o1", "p"]);
  assert.equal(restoreRemoval(doc, null), doc);
  assert.equal(restoreRemoval(doc, { entries: [] }), doc);
  assert.equal(restoreRemoval(doc, { subjectId: "s1", entries: null }), doc);
});

test("restoreRemoval returns the same reference for a missing subject and never recreates it", () => {
  const doc = removalDocument();
  const { removal } = planRemoval(doc, "s1", "p");
  const other = emptyDocument();
  other.subjects.push(newSubject("Autre", "sX"));
  assert.equal(restoreRemoval(other, removal), other);
  assert.equal(other.subjects.length, 1);
  assert.equal(other.subjects[0].id, "sX");
});

test("removalContainsItem matches the target and its substeps only", () => {
  const doc = removalDocument();
  const { removal } = planRemoval(doc, "s1", "p");
  assert.equal(removalContainsItem(removal, "p"), true);
  assert.equal(removalContainsItem(removal, "c1"), true);
  assert.equal(removalContainsItem(removal, "c2"), true);
  assert.equal(removalContainsItem(removal, "o1"), false);
  assert.equal(removalContainsItem(removal, "absent"), false);
  assert.equal(removalContainsItem(null, "p"), false);
  assert.equal(removalContainsItem({}, "p"), false);
});

test("restorableTrackingRef keeps a valid unfinished top-level reference", () => {
  const doc = removalDocument();
  const ref = { subjectId: "s1", itemId: "p" };
  assert.deepEqual(restorableTrackingRef(doc, ref), { subjectId: "s1", itemId: "p" });
});

test("restorableTrackingRef rejects completed, substep, missing and empty references", () => {
  const doc = removalDocument();
  assert.equal(restorableTrackingRef(doc, { subjectId: "s1", itemId: "c1" }), null);
  assert.deepEqual(restorableTrackingRef(doc, { subjectId: "s1", itemId: "o1" }), { subjectId: "s1", itemId: "o1" });
  assert.equal(restorableTrackingRef(doc, { subjectId: "s1", itemId: "absent" }), null);
  assert.equal(restorableTrackingRef(doc, { subjectId: "absent", itemId: "p" }), null);
  assert.equal(restorableTrackingRef(doc, null), null);
  assert.equal(restorableTrackingRef(doc, {}), null);
});

test("restorableTrackingRef returns null for a completed top-level action", () => {
  const doc = emptyDocument();
  const subject = newSubject("A", "s1");
  const done = newItem("Terminée", "normal", "d");
  done.done = true;
  subject.items.push(done);
  doc.subjects.push(subject);
  assert.equal(restorableTrackingRef(doc, { subjectId: "s1", itemId: "d" }), null);
});

test("reorderWithinPriority moves an action before another of the same priority", () => {
  const items = [
    newItem("A", "urgent", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
    newItem("D", "later", "d"),
  ];
  const next = reorderWithinPriority(items, "c", "b", "before");
  assert.notEqual(next, items);
  assert.deepEqual(next.map((i) => i.id), ["a", "c", "b", "d"]);
  assert.deepEqual(sortedItems(next).map((i) => i.id), ["a", "c", "b", "d"]);
  assert.deepEqual(items.map((i) => i.id), ["a", "b", "c", "d"]);
});

test("reorderWithinPriority supports dropping an action after its target", () => {
  const items = [
    newItem("A", "normal", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
  ];
  assert.deepEqual(reorderWithinPriority(items, "a", "c", "after").map((i) => i.id), ["b", "c", "a"]);
});

test("reorderWithinPriority refuses cross-priority, substep, missing, equal and unchanged targets", () => {
  const items = [
    newItem("A", "urgent", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
    newItem("Child", "normal", "child", "b"),
  ];
  assert.equal(reorderWithinPriority(items, "b", "a", "before"), items);
  assert.equal(reorderWithinPriority(items, "b", "child", "before"), items);
  assert.equal(reorderWithinPriority(items, "child", "b", "before"), items);
  assert.equal(reorderWithinPriority(items, "b", "missing", "before"), items);
  assert.equal(reorderWithinPriority(items, "missing", "b", "before"), items);
  assert.equal(reorderWithinPriority(items, "b", "b", "before"), items);
  assert.equal(reorderWithinPriority(items, "b", "c", "before"), items);
  assert.equal(reorderWithinPriority(items, "b", "c", "sideways"), items);
  assert.equal(canReorderWithinPriority(items, "b", "a", "before"), false);
  assert.equal(canReorderWithinPriority(items, "b", "child", "before"), false);
  assert.equal(canReorderWithinPriority(items, "c", "b", "before"), true);
});

test("moveWithinPriority swaps adjacent ranks inside the group only", () => {
  const items = [
    newItem("A", "normal", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
  ];
  assert.deepEqual(moveWithinPriority(items, "c", "up").map((i) => i.id), ["a", "c", "b"]);
  assert.deepEqual(moveWithinPriority(items, "a", "down").map((i) => i.id), ["b", "a", "c"]);
  assert.deepEqual(moveWithinPriority(items, "b", "up").map((i) => i.id), ["b", "a", "c"]);
});

test("moveWithinPriority returns the same reference at group boundaries and for invalid input", () => {
  const items = [
    newItem("A", "normal", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
    newItem("Child", "normal", "child", "b"),
  ];
  assert.equal(moveWithinPriority(items, "a", "up"), items);
  assert.equal(moveWithinPriority(items, "c", "down"), items);
  assert.equal(moveWithinPriority(items, "missing", "up"), items);
  assert.equal(moveWithinPriority(items, "child", "up"), items);
  assert.equal(moveWithinPriority(items, "b", "sideways"), items);
  assert.equal(canMoveWithinPriority(items, "a", "up"), false);
  assert.equal(canMoveWithinPriority(items, "b", "up"), true);
  assert.equal(canMoveWithinPriority(items, "c", "down"), false);
});

test("reorderWithinPriority only reorders the target group in an interleaved array", () => {
  const items = [
    newItem("B", "normal", "b"),
    newItem("U", "urgent", "u"),
    newItem("C", "normal", "c"),
    newItem("D", "later", "d"),
  ];
  const before = JSON.parse(JSON.stringify(items));
  const next = reorderWithinPriority(items, "c", "b", "before");
  assert.deepEqual(next.map((i) => i.id), ["c", "u", "b", "d"]);
  assert.deepEqual(sortedItems(next).map((i) => i.id), ["u", "c", "b", "d"]);
  assert.equal(next[1], items[1]);
  assert.equal(next[3], items[3]);
  assert.deepEqual(items, before);
});

test("reorderWithinPriority never mutates its input and never shares changed references", () => {
  const items = [newItem("A", "normal", "a"), newItem("B", "normal", "b")];
  const snapshot = JSON.parse(JSON.stringify(items));
  const next = reorderWithinPriority(items, "b", "a", "before");
  assert.notEqual(next, items);
  assert.equal(next[0], items[1]);
  assert.equal(next[1], items[0]);
  assert.deepEqual(items, snapshot);
});

test("reorderWithinPriority keeps a moved parent's substeps attached and unchanged", () => {
  const items = [
    newItem("P1", "normal", "p1"),
    newItem("P2", "normal", "p2"),
    newItem("C1", "later", "c1", "p1"),
    newItem("C2", "urgent", "c2", "p1"),
  ];
  const next = reorderWithinPriority(items, "p1", "p2", "after");
  assert.deepEqual(next.map((i) => i.id), ["p2", "p1", "c1", "c2"]);
  const parent = next.find((i) => i.id === "p1");
  assert.equal(parent.parentId, null);
  assert.equal(parent.priority, "normal");
  assert.equal(parent.title, "P1");
  assert.equal(next.find((i) => i.id === "c1").parentId, "p1");
  assert.equal(next.find((i) => i.id === "c2").parentId, "p1");
  assert.equal(next.find((i) => i.id === "c2").priority, "urgent");
});

test("reorderWithinPriority leaves other subjects untouched", () => {
  const other = newSubject("B", "sb");
  other.items.push(newItem("B1", "normal", "b1"));
  const items = [
    newItem("A1", "normal", "a1"),
    newItem("A2", "normal", "a2"),
  ];
  const next = reorderWithinPriority(items, "a2", "a1", "before");
  assert.deepEqual(next.map((i) => i.id), ["a2", "a1"]);
  assert.deepEqual(other.items.map((i) => i.id), ["b1"]);
});

test("nextActionSuggestion follows the new within-subject order after a reorder", () => {
  const subject = newSubject("A", "a");
  subject.items.push(newItem("Second", "urgent", "second"), newItem("First", "urgent", "first"));
  const doc = { version: 1, subjects: [subject] };
  assert.equal(nextActionSuggestion(doc).itemId, "second");
  subject.items = reorderWithinPriority(subject.items, "first", "second", "before");
  assert.equal(nextActionSuggestion(doc).itemId, "first");
});

test("a reordered document round-trips through parseDocument without migration", () => {
  const subject = newSubject("S", "s1");
  subject.items.push(
    newItem("A", "urgent", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
    newItem("D", "later", "d"),
  );
  const doc = { version: 1, subjects: [subject] };
  subject.items = reorderWithinPriority(subject.items, "c", "b", "before");
  const parsed = parseDocument(JSON.stringify(doc));
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(parsed.subjects[0].items.map((i) => i.id), ["a", "c", "b", "d"]);
  assert.equal(parsed.version, 1);
  assert.deepEqual(Object.keys(parsed.subjects[0].items[0]).sort(), ["done", "id", "parentId", "priority", "title"]);
});

test("reorderWithinPriority moves a substep before another substep of the same parent and priority", () => {
  const items = [
    newItem("P", "normal", "p"),
    newItem("A", "normal", "a", "p"),
    newItem("B", "normal", "b", "p"),
    newItem("C", "normal", "c", "p"),
  ];
  const next = reorderWithinPriority(items, "c", "a", "before");
  assert.notEqual(next, items);
  assert.deepEqual(next.map((i) => i.id), ["p", "c", "a", "b"]);
  assert.deepEqual(items.map((i) => i.id), ["p", "a", "b", "c"]);
  assert.deepEqual(visibleItems(next, "p", false).map((i) => i.id), ["c", "a", "b"]);
  assert.equal(next.find((i) => i.id === "c").parentId, "p");
  assert.equal(next.find((i) => i.id === "c").priority, "normal");
});

test("reorderWithinPriority supports dropping a substep after its target", () => {
  const items = [
    newItem("P", "normal", "p"),
    newItem("A", "normal", "a", "p"),
    newItem("B", "normal", "b", "p"),
    newItem("C", "normal", "c", "p"),
  ];
  assert.deepEqual(reorderWithinPriority(items, "a", "c", "after").map((i) => i.id), ["p", "b", "c", "a"]);
});

test("moveWithinPriority moves a substep one rank inside its parent group only", () => {
  const items = [
    newItem("P", "normal", "p"),
    newItem("A", "normal", "a", "p"),
    newItem("B", "normal", "b", "p"),
    newItem("C", "normal", "c", "p"),
  ];
  assert.deepEqual(moveWithinPriority(items, "c", "up").map((i) => i.id), ["p", "a", "c", "b"]);
  assert.deepEqual(moveWithinPriority(items, "a", "down").map((i) => i.id), ["p", "b", "a", "c"]);
  assert.equal(moveWithinPriority(items, "a", "up"), items);
  assert.equal(moveWithinPriority(items, "c", "down"), items);
  assert.equal(canMoveWithinPriority(items, "a", "up"), false);
  assert.equal(canMoveWithinPriority(items, "b", "up"), true);
  assert.equal(canMoveWithinPriority(items, "c", "down"), false);
});

test("reorderWithinPriority refuses substep moves across parent, priority, level and invalid targets", () => {
  const items = [
    newItem("P1", "normal", "p1"),
    newItem("P2", "normal", "p2"),
    newItem("A1", "normal", "a1", "p1"),
    newItem("B1", "normal", "b1", "p1"),
    newItem("C2", "normal", "c2", "p2"),
    newItem("U1", "urgent", "u1", "p1"),
  ];
  const snapshot = JSON.parse(JSON.stringify(items));
  assert.equal(reorderWithinPriority(items, "a1", "c2", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "u1", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "p1", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "p2", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "missing", "before"), items);
  assert.equal(reorderWithinPriority(items, "missing", "a1", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "a1", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "b1", "before"), items);
  assert.equal(reorderWithinPriority(items, "a1", "b1", "sideways"), items);
  assert.equal(canReorderWithinPriority(items, "a1", "c2", "before"), false);
  assert.equal(canReorderWithinPriority(items, "b1", "a1", "before"), true);
  assert.deepEqual(items, snapshot);
});

test("substep reorder keeps mixed priorities grouped and other groups intact", () => {
  const items = [
    newItem("P", "normal", "p"),
    newItem("A", "urgent", "a", "p"),
    newItem("B", "normal", "b", "p"),
    newItem("C", "normal", "c", "p"),
    newItem("D", "normal", "d", "p"),
  ];
  const next = reorderWithinPriority(items, "c", "b", "before");
  assert.deepEqual(next.map((i) => i.id), ["p", "a", "c", "b", "d"]);
  assert.deepEqual(visibleItems(next, "p", false).map((i) => i.id), ["a", "c", "b", "d"]);
  assert.equal(next.find((i) => i.id === "a").priority, "urgent");
});

test("substep reorder only changes the target group in an interleaved array", () => {
  const items = [
    newItem("P1", "normal", "p1"),
    newItem("N1", "normal", "n1", "p1"),
    newItem("P2", "normal", "p2"),
    newItem("N2", "normal", "n2", "p2"),
    newItem("N3", "normal", "n3", "p1"),
    newItem("U1", "urgent", "u1", "p1"),
  ];
  const snapshot = JSON.parse(JSON.stringify(items));
  const next = reorderWithinPriority(items, "n3", "n1", "before");
  assert.deepEqual(next.map((i) => i.id), ["p1", "n3", "p2", "n2", "n1", "u1"]);
  assert.equal(next[2], items[2]);
  assert.equal(next[3], items[3]);
  assert.equal(next[5], items[5]);
  assert.deepEqual(items, snapshot);
});

test("substep reorder never mutates its input and preserves every identity field", () => {
  const items = [
    newItem("P", "normal", "p"),
    newItem("A", "normal", "a", "p"),
    newItem("B", "normal", "b", "p"),
  ];
  const snapshot = JSON.parse(JSON.stringify(items));
  const next = reorderWithinPriority(items, "b", "a", "before");
  assert.notEqual(next, items);
  assert.equal(next[1], items[2]);
  assert.equal(next[2], items[1]);
  assert.deepEqual(items, snapshot);
  assert.equal(next[1].id, "b");
  assert.equal(next[1].parentId, "p");
  assert.equal(next[1].priority, "normal");
  assert.equal(next[1].done, false);
  assert.equal(next[1].title, "B");
  assert.equal(next.every((item) => Object.keys(item).sort().join(",") === "done,id,parentId,priority,title"), true);
});

test("a reordered substep document round-trips through parseDocument without migration", () => {
  const subject = newSubject("S", "s1");
  subject.items.push(
    newItem("P", "normal", "p"),
    newItem("A", "normal", "a", "p"),
    newItem("B", "normal", "b", "p"),
  );
  const doc = { version: 1, subjects: [subject] };
  subject.items = reorderWithinPriority(subject.items, "b", "a", "before");
  const parsed = parseDocument(JSON.stringify(doc));
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(parsed.subjects[0].items.map((i) => i.id), ["p", "b", "a"]);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.subjects[0].items[1].parentId, "p");
  assert.deepEqual(Object.keys(parsed.subjects[0].items[1]).sort(), ["done", "id", "parentId", "priority", "title"]);
});

test("top-level reorder behavior stays identical after the helper is generalised", () => {
  const items = [
    newItem("A", "urgent", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
    newItem("D", "later", "d"),
    newItem("Child", "normal", "child", "b"),
  ];
  assert.deepEqual(reorderWithinPriority(items, "c", "b", "before").map((i) => i.id), ["a", "c", "b", "d", "child"]);
  assert.deepEqual(moveWithinPriority(items, "c", "up").map((i) => i.id), ["a", "c", "b", "d", "child"]);
  assert.equal(reorderWithinPriority(items, "b", "child", "before"), items);
  assert.equal(reorderWithinPriority(items, "child", "b", "before"), items);
});

function priorityDocument() {
  const doc = emptyDocument();
  const subject = newSubject("Appels", "s1");
  subject.items.push(
    newItem("Urgent 1", "urgent", "u1"),
    newItem("Normal 1", "normal", "n1"),
    newItem("Normal 2", "normal", "n2"),
    newItem("Plus tard 1", "later", "l1"),
    newItem("Parent", "normal", "p"),
    newItem("Enfant plus tard", "later", "c1", "p"),
    newItem("Enfant urgent", "urgent", "c2", "p"),
  );
  const other = newSubject("Autre", "s2");
  other.items.push(newItem("Autre étape", "urgent", "o1"));
  doc.subjects.push(subject, other);
  return doc;
}

test("setItemPriority accepts each allowed priority", () => {
  for (const priority of PRIORITIES) {
    const doc = priorityDocument();
    const from = priority === "urgent" ? "later" : "urgent";
    const before = setItemPriority(doc, "s1", "n1", from);
    const next = setItemPriority(before, "s1", "n1", priority);
    assert.notEqual(next, before);
    assert.equal(next.subjects[0].items.find((i) => i.id === "n1").priority, priority);
  }
});

test("setItemPriority rejects any priority outside the allowed values", () => {
  const doc = priorityDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  for (const invalid of ["demain", "Urgent", "URGENT", "later ", "", "normal ", null, undefined, 42, {}, [], true]) {
    assert.equal(setItemPriority(doc, "s1", "n1", invalid), doc);
  }
  assert.deepEqual(doc, snapshot);
});

test("setItemPriority returns the identical reference on every no-op path", () => {
  const doc = priorityDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  assert.equal(setItemPriority(doc, "missing", "n1", "urgent"), doc);
  assert.equal(setItemPriority(doc, "s1", "missing", "urgent"), doc);
  assert.equal(setItemPriority(doc, "s1", "n1", "normal"), doc);
  assert.equal(setItemPriority(doc, "s1", "n1", "demain"), doc);
  assert.equal(setItemPriority(null, "s1", "n1", "urgent"), null);
  assert.equal(setItemPriority(undefined, "s1", "n1", "urgent"), undefined);
  assert.equal(setItemPriority({}, "s1", "n1", "urgent").subjects, undefined);
  assert.deepEqual(doc, snapshot);
});

test("setItemPriority preserves identity, completion, hierarchy and unrelated references", () => {
  const doc = priorityDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  const nextTop = setItemPriority(doc, "s1", "p", "later");
  assert.notEqual(nextTop, doc);
  const parent = nextTop.subjects[0].items.find((i) => i.id === "p");
  assert.equal(parent.id, "p");
  assert.equal(parent.title, "Parent");
  assert.equal(parent.done, false);
  assert.equal(parent.parentId, null);
  assert.equal(parent.priority, "later");
  assert.equal(nextTop.subjects[0].items.find((i) => i.id === "c1").parentId, "p");
  assert.equal(nextTop.subjects[0].items.find((i) => i.id === "c2").parentId, "p");
  assert.equal(nextTop.subjects[0].items.find((i) => i.id === "c1").priority, "later");
  assert.equal(nextTop.subjects[0].items.find((i) => i.id === "n1"), doc.subjects[0].items.find((i) => i.id === "n1"));
  assert.equal(nextTop.subjects[1], doc.subjects[1]);
  assert.deepEqual(doc, snapshot);

  const nextChild = setItemPriority(doc, "s1", "c1", "urgent");
  const child = nextChild.subjects[0].items.find((i) => i.id === "c1");
  assert.equal(child.parentId, "p");
  assert.equal(child.id, "c1");
  assert.equal(child.title, "Enfant plus tard");
  assert.equal(child.done, false);
  assert.equal(child.priority, "urgent");
  assert.equal(nextChild.subjects[0].items.find((i) => i.id === "p"), doc.subjects[0].items.find((i) => i.id === "p"));
  assert.equal(nextChild.subjects[0].items.find((i) => i.id === "c2"), doc.subjects[0].items.find((i) => i.id === "c2"));
  assert.deepEqual(doc, snapshot);
});

test("setItemPriority returns new structures without sharing the changed item", () => {
  const doc = priorityDocument();
  const next = setItemPriority(doc, "s1", "n1", "urgent");
  assert.notEqual(next, doc);
  assert.notEqual(next.subjects, doc.subjects);
  assert.notEqual(next.subjects[0], doc.subjects[0]);
  assert.notEqual(next.subjects[0].items, doc.subjects[0].items);
  assert.notEqual(next.subjects[0].items.find((i) => i.id === "n1"), doc.subjects[0].items.find((i) => i.id === "n1"));
  assert.deepEqual(
    Object.keys(next.subjects[0].items.find((i) => i.id === "n1")).sort(),
    ["done", "id", "parentId", "priority", "title"]);
  assert.equal(next.subjects[0].items.find((i) => i.id === "n1").title, "Normal 1");
  assert.equal(next.subjects[0].items.find((i) => i.id === "n1").done, false);
});

test("setItemPriority regroups a changed action through sortedItems and visibleItems", () => {
  const doc = priorityDocument();
  const before = sortedItems(doc.subjects[0].items).map((i) => i.id);
  assert.deepEqual(before, ["u1", "n1", "n2", "p", "l1"]);
  const next = setItemPriority(doc, "s1", "n1", "later");
  assert.deepEqual(sortedItems(next.subjects[0].items).map((i) => i.id), ["u1", "n2", "p", "n1", "l1"]);
  assert.deepEqual(visibleItems(next.subjects[0].items).map((i) => i.id), ["u1", "n2", "p", "n1", "l1"]);
  const urgent = setItemPriority(doc, "s1", "l1", "urgent");
  assert.deepEqual(sortedItems(urgent.subjects[0].items).map((i) => i.id), ["u1", "l1", "n1", "n2", "p"]);
});

test("setItemPriority regroups a changed substep without touching its parent or siblings", () => {
  const doc = priorityDocument();
  const before = visibleItems(doc.subjects[0].items, "p").map((i) => i.id);
  assert.deepEqual(before, ["c2", "c1"]);
  const next = setItemPriority(doc, "s1", "c1", "urgent");
  assert.deepEqual(visibleItems(next.subjects[0].items, "p").map((i) => i.id), ["c1", "c2"]);
  assert.equal(next.subjects[0].items.find((i) => i.id === "p").priority, "normal");
  assert.equal(next.subjects[0].items.find((i) => i.id === "c1").parentId, "p");
  assert.equal(next.subjects[0].items.find((i) => i.id === "c2").parentId, "p");
  assert.deepEqual(
    visibleItems(next.subjects[0].items, null).map((i) => i.id),
    ["u1", "n1", "n2", "p", "l1"]);
});

test("a changed priority round-trips through parseDocument without migration", () => {
  const doc = priorityDocument();
  const next = setItemPriority(doc, "s1", "n1", "later");
  const stored = JSON.stringify(next);
  const restored = parseDocument(stored);
  assert.deepEqual(restored, JSON.parse(stored));
  assert.equal(restored.version, 1);
  assert.equal(restored.subjects[0].items.find((i) => i.id === "n1").priority, "later");
  assert.deepEqual(
    Object.keys(restored.subjects[0].items.find((i) => i.id === "n1")).sort(),
    ["done", "id", "parentId", "priority", "title"]);
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.deepEqual(PRIORITIES, ["urgent", "normal", "later"]);
});

test("priority changes leave updateItem, reorderWithinPriority and moveWithinPriority behavior unchanged", () => {
  const items = [
    newItem("A", "normal", "a"),
    newItem("B", "normal", "b"),
    newItem("C", "normal", "c"),
  ];
  const doc = { version: 1, subjects: [{ id: "s1", title: "S", items }] };
  const next = setItemPriority(doc, "s1", "a", "urgent");
  assert.deepEqual(reorderWithinPriority(next.subjects[0].items, "c", "b", "before").map((i) => i.id), ["a", "c", "b"]);
  assert.deepEqual(moveWithinPriority(next.subjects[0].items, "c", "up").map((i) => i.id), ["a", "c", "b"]);
  assert.equal(canMoveWithinPriority(next.subjects[0].items, "a", "up"), false);
  const edited = updateItem(next, "s1", "b", { title: "B2", priority: "later" });
  assert.equal(edited.subjects[0].items.find((i) => i.id === "b").title, "B2");
  assert.equal(edited.subjects[0].items.find((i) => i.id === "b").priority, "later");
  assert.equal(edited.subjects[0].items.find((i) => i.id === "a").priority, "urgent");
  assert.equal(doc.subjects[0].items.find((i) => i.id === "a").priority, "normal");
});

function detailDocument() {
  const doc = emptyDocument();
  const alpha = newSubject("Alpha", "s-a");
  alpha.items.push(
    newItem("Urgent top", "urgent", "t1"),
    newItem("Normal top", "normal", "t2"),
    newItem("Child one", "normal", "c1", "t2"),
    newItem("Child two", "urgent", "c2", "t2"),
    newItem("Done top", "later", "t3"),
  );
  alpha.items.find((item) => item.id === "t3").done = true;
  const beta = newSubject("Beta", "s-b");
  beta.items.push(newItem("Beta task", "normal", "b1"));
  doc.subjects.push(alpha, beta);
  return doc;
}

test("subjectRoute builds a canonical fragment only for a valid id", () => {
  assert.equal(subjectRoute("abc"), "#/sujet/abc");
  assert.equal(subjectRoute("a b/c#d"), "#/sujet/" + encodeURIComponent("a b/c#d"));
  assert.equal(subjectRoute(""), null);
  assert.equal(subjectRoute(null), null);
  assert.equal(subjectRoute(undefined), null);
  assert.equal(subjectRoute(42), null);
  assert.equal(subjectRoute("x".repeat(101)), null);
});

test("parseRoute maps fragments deterministically without throwing", () => {
  assert.deepEqual(parseRoute(""), { view: "overview" });
  assert.deepEqual(parseRoute("#"), { view: "overview" });
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/autre"), { view: "overview" });
  assert.deepEqual(parseRoute(null), { view: "overview" });
  assert.deepEqual(parseRoute(undefined), { view: "overview" });
  assert.deepEqual(parseRoute(7), { view: "overview" });
  assert.deepEqual(parseRoute("#/sujet"), { view: "invalid" });
  assert.deepEqual(parseRoute("#/sujet/"), { view: "invalid" });
  assert.deepEqual(parseRoute("#/sujet/%E0%A4%A"), { view: "invalid" });
  assert.deepEqual(parseRoute("#/sujet/" + "x".repeat(101)), { view: "invalid" });
});

test("subjectRoute and parseRoute round-trip a URL-special id", () => {
  const id = "sujet 42/été#1";
  assert.deepEqual(parseRoute(subjectRoute(id)), { view: "subject", subjectId: id });
  assert.deepEqual(parseRoute("#/sujet/plain-id"), { view: "subject", subjectId: "plain-id" });
});

test("findSubject returns the identical reference and never mutates the document", () => {
  const doc = detailDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  assert.equal(findSubject(doc, "s-a"), doc.subjects[0]);
  assert.equal(findSubject(doc, "s-b"), doc.subjects[1]);
  assert.equal(findSubject(doc, "missing"), null);
  assert.equal(findSubject(null, "s-a"), null);
  assert.equal(findSubject({}, "s-a"), null);
  assert.deepEqual(doc, snapshot);
});

test("parseRoute and findSubject never mutate their inputs", () => {
  const doc = detailDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  parseRoute("#/sujet/" + encodeURIComponent(doc.subjects[0].id));
  findSubject(doc, doc.subjects[0].id);
  findSubject(doc, "absent");
  assert.deepEqual(doc, snapshot);
});

test("renameSubject changes only the title and preserves identity, steps and relations", () => {
  const doc = detailDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  const next = renameSubject(doc, "s-a", "  Alpha renommé  ");
  assert.notEqual(next, doc);
  assert.equal(next.subjects[0].title, "Alpha renommé");
  assert.equal(next.subjects[0].id, "s-a");
  assert.deepEqual(next.subjects[0].items, snapshot.subjects[0].items);
  assert.deepEqual(next.subjects[1], snapshot.subjects[1]);
  assert.notEqual(next.subjects[0], doc.subjects[0]);
  assert.deepEqual(
    next.subjects[0].items.map((item) => [item.id, item.parentId, item.priority, item.done]),
    snapshot.subjects[0].items.map((item) => [item.id, item.parentId, item.priority, item.done]));
  assert.deepEqual(doc, snapshot);
});

test("renameSubject returns the same reference for invalid, unknown and unchanged input", () => {
  const doc = detailDocument();
  const snapshot = JSON.parse(JSON.stringify(doc));
  const cases = [
    ["s-a", ""],
    ["s-a", "   "],
    ["s-a", "x".repeat(101)],
    ["missing", "Nouveau"],
    ["s-a", "Alpha"],
    ["s-a", null],
    ["s-a", 5],
  ];
  for (const [id, title] of cases) {
    assert.equal(renameSubject(doc, id, title), doc);
  }
  assert.deepEqual(doc, snapshot);
});

test("renameSubject rejects a trimmed name that is unchanged", () => {
  const doc = detailDocument();
  assert.equal(renameSubject(doc, "s-a", "  Alpha  "), doc);
});

test("a renamed document round-trips through parseDocument without migration", () => {
  const doc = detailDocument();
  const next = renameSubject(doc, "s-a", "Nouveau nom");
  const stored = JSON.stringify(next);
  const restored = parseDocument(stored);
  assert.deepEqual(restored, JSON.parse(stored));
  assert.equal(restored.version, 1);
  assert.equal(restored.subjects[0].title, "Nouveau nom");
  assert.equal(restored.subjects[0].id, "s-a");
  assert.deepEqual(
    Object.keys(restored.subjects[0].items[0]).sort(),
    ["done", "id", "parentId", "priority", "title"]);
  assert.equal(restored.subjects[0].items.find((i) => i.id === "c1").parentId, "t2");
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
});

test("existing task functions behave identically on a renamed and navigated document", () => {
  const doc = detailDocument();
  const next = renameSubject(doc, "s-a", "Renommé");
  const route = subjectRoute(next.subjects[0].id);
  assert.deepEqual(parseRoute(route), { view: "subject", subjectId: "s-a" });
  assert.equal(findSubject(next, "s-a"), next.subjects[0]);
  assert.deepEqual(
    visibleItems(next.subjects[0].items).map((i) => i.id),
    visibleItems(doc.subjects[0].items).map((i) => i.id));
  assert.deepEqual(
    reorderWithinPriority(next.subjects[0].items, "t1", "t2", "after").map((i) => i.id),
    reorderWithinPriority(doc.subjects[0].items, "t1", "t2", "after").map((i) => i.id));
  assert.deepEqual(
    planRemoval(next, "s-a", "t2").document.subjects[0].items.map((i) => i.id),
    planRemoval(doc, "s-a", "t2").document.subjects[0].items.map((i) => i.id));
  const before = nextActionSuggestion(doc);
  const after = nextActionSuggestion(next);
  assert.equal(after.subjectId, before.subjectId);
  assert.equal(after.itemId, before.itemId);
  assert.equal(after.priority, before.priority);
  assert.equal(after.subjectTitle, "Renommé");
});

