import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyDocument, newSubject, newItem, promoteItemToTopLevel, totalTaskCount, pendingCount, nextActionSuggestion, planRemoval, parseDocument, updateItem, setItemPriority, reorderWithinPriority, substepView } from "../site/core.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const promoteBody = app.slice(
  app.indexOf('case "promote": {'),
  app.indexOf('case "keep-track":', app.indexOf('case "promote": {')),
);

function fixture({ childPriority = "normal" } = {}) {
  const doc = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(
    newItem("Parent", "normal", "p1"),
    newItem("Enfant un", childPriority, "c1", "p1"),
    newItem("Enfant deux", "normal", "c2", "p1"),
    newItem("Autre", "normal", "t1"),
  );
  subject.items[1].note = "Note de l'enfant\nligne deux";
  doc.subjects.push(subject);
  return doc;
}

test("the per-item menu renders the French promotion command for direct substeps only", () => {
  assert.match(app, /const commands = itemMenuCommands\(item, \{/);
  assert.match(app, /case "promote":/);
  assert.match(app, /"Promouvoir en tâche principale : " \+ item\.title/);
  assert.match(promoteBody, /promoteItemToTopLevel\(documentState, subject\.id, item\.id\)/);
});

test("the promotion control reuses the core operation and never duplicates domain logic", () => {
  assert.match(promoteBody, /promoteItemToTopLevel\(documentState, subject\.id, item\.id\)/);
  assert.doesNotMatch(promoteBody, /parentId\s*=/);
  assert.doesNotMatch(promoteBody, /\.splice\(/);
  assert.doesNotMatch(promoteBody, /\.filter\(/);
});

test("a successful promotion persists exactly once and a refusal writes nothing", () => {
  assert.match(promoteBody, /const next = promoteItemToTopLevel\(documentState, subject\.id, item\.id\)/);
  assert.match(promoteBody, /if \(next === documentState\) \{ if \(wasOpen\) render\(\); return; \}/);
  const persistCalls = promoteBody.match(/persist\(\)/g) || [];
  assert.equal(persistCalls.length, 1);
  const guardIndex = promoteBody.indexOf("if (next === documentState)");
  const persistIndex = promoteBody.indexOf("persist()");
  assert.ok(guardIndex !== -1 && guardIndex < persistIndex);
});

test("a successful promotion routes through revealAction for accessible focus", () => {
  assert.match(promoteBody, /documentState = next;/);
  assert.match(promoteBody, /revealAction\(subject\.id, item\.id\)/);
});

test("the promotion control never uses innerHTML and names the substep as text", () => {
  assert.doesNotMatch(app, /\.innerHTML/);
  assert.match(app, /function el\(tag, cls, text\) \{[\s\S]*?node\.textContent = text;/);
});

test("the promotion command keeps a 44 × 44 px touch target and the visible focus outline", () => {
  assert.match(styles, /\.task-menu-command\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(styles, /button:focus-visible[^{]*\{[^}]*outline:3px solid/);
});

test("promotion increases the top-level total by one while the pending counter is unchanged", () => {
  const doc = fixture();
  const promoted = promoteItemToTopLevel(doc, "s1", "c1");
  const beforeTotal = totalTaskCount(doc.subjects[0].items);
  const afterTotal = totalTaskCount(promoted.subjects[0].items);
  assert.equal(afterTotal, beforeTotal + 1);
  assert.equal(pendingCount(promoted), pendingCount(doc));
});

test("an unfinished promoted task becomes eligible for the deterministic suggestion", () => {
  const doc = fixture({ childPriority: "urgent" });
  assert.deepEqual(
    { itemId: nextActionSuggestion(doc).itemId },
    { itemId: "p1" },
  );
  const promoted = promoteItemToTopLevel(doc, "s1", "c1");
  const suggestion = nextActionSuggestion(promoted);
  assert.equal(suggestion.itemId, "c1");
  assert.equal(suggestion.subjectId, "s1");
});

test("removing the former parent keeps the promoted task", () => {
  const doc = fixture();
  const promoted = promoteItemToTopLevel(doc, "s1", "c1");
  const { document: removed, removal } = planRemoval(promoted, "s1", "p1");
  assert.ok(removal);
  assert.equal(removed.subjects[0].items.some((entry) => entry.id === "c1"), true);
  assert.equal(removed.subjects[0].items.some((entry) => entry.id === "p1"), false);
  assert.equal(removed.subjects[0].items.find((entry) => entry.id === "c1").parentId, null);
});

test("export and import round-trip keeps version 1 and the promoted parentId:null", () => {
  const promoted = promoteItemToTopLevel(fixture(), "s1", "c1");
  const parsed = parseDocument(JSON.stringify(promoted));
  assert.equal(parsed.version, 1);
  const item = parsed.subjects[0].items.find((entry) => entry.id === "c1");
  assert.equal(item.parentId, null);
  assert.equal(item.note, "Note de l'enfant\nligne deux");
  assert.deepEqual(parseDocument(JSON.stringify(parsed)), promoted);
});

test("editing, priority change and reorder keep the promoted task top-level and its note", () => {
  const promoted = promoteItemToTopLevel(fixture(), "s1", "c1");
  const edited = updateItem(promoted, "s1", "c1", { title: "Enfant un", priority: "later", note: "Note de l'enfant\nligne deux" });
  assert.equal(edited.subjects[0].items.find((entry) => entry.id === "c1").parentId, null);
  assert.equal(edited.subjects[0].items.find((entry) => entry.id === "c1").note, "Note de l'enfant\nligne deux");

  const reprioritized = setItemPriority(promoted, "s1", "c1", "urgent");
  assert.equal(reprioritized.subjects[0].items.find((entry) => entry.id === "c1").parentId, null);

  const reordered = reorderWithinPriority(promoted.subjects[0].items, "c1", "t1", "after");
  const moved = reordered.find((entry) => entry.id === "c1");
  assert.equal(moved.parentId, null);
  assert.equal(moved.note, "Note de l'enfant\nligne deux");
  assert.notEqual(reordered, promoted.subjects[0].items);
});

test("a former parent with no remaining visible substep yields no disclosure control", () => {
  const doc = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(
    newItem("Parent", "normal", "p1"),
    newItem("Unique enfant", "normal", "c1", "p1"),
  );
  doc.subjects.push(subject);
  assert.equal(substepView(doc.subjects[0].items, "p1", false, new Set(["p1"])).hasVisibleSubsteps, true);
  const promoted = promoteItemToTopLevel(doc, "s1", "c1");
  const view = substepView(promoted.subjects[0].items, "p1", false, new Set(["p1"]));
  assert.equal(view.hasVisibleSubsteps, false);
  assert.equal(view.renderChildren, false);
  assert.equal(view.collapsed, false);
});
