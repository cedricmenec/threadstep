import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const renderCode = app.slice(app.indexOf("function replaceSubjectsInCurrentView("), app.indexOf("function navigate("));
const detailCode = app.slice(app.indexOf("function renderDetail(target ="), app.indexOf("function renderDetailView("));

function simulateOldTablet({ view = "overview", subjects = [{ id: "s1" }], authorized = true } = {}) {
  const events = [];
  const oldTree = { id: "old-live-subject" };
  const viewport = { scrollY: 7100 };
  const subjectsEl = {
    style: { minHeight: "" },
    nodes: [oldTree],
    getBoundingClientRect() { return { height: 8200 }; },
    replaceChildren(next) {
      events.push(["swap", !!next, this.style.minHeight]);
      if (!next || !this.style.minHeight) viewport.scrollY = 0;
      this.nodes = next ? [...next.nodes] : [];
    },
    append() { throw new Error("live subject DOM must not be filled incrementally"); }
  };
  const document = {
    createDocumentFragment() {
      return { nodes: [], append(node) { this.nodes.push(node); } };
    }
  };
  const flags = {
    subjectsEl, document, route: { view, subjectId: "s1" },
    pendingNavigationFocus: null, focusDetailHeading: false, focusOpenSubjectId: null,
    focusItemId: null, revealItemId: null, focusSubjectId: null, focusRenameControl: false,
    pendingCollapseFocus: null, pendingPriorityFocus: null, pendingMenuFocus: null,
    pendingMoveFocus: null, editingItemId: null, renamingSubject: false,
    reorderNoteEl: { hidden: false }, hideCompleted: false,
    subjectForm: { hidden: false }, focusSuggestEl: { hidden: false },
    focusCardEl: { hidden: false }, resumeCardEl: { hidden: false },
    counterEl: { textContent: "" }, documentState: { subjects },
    captureUxContinuity: () => authorized ? { context: { view }, scrollY: 7100 } : null,
    applyBusinessVisibility: () => {}, applyNavigationMenu: () => {},
    applySyncSummaryVisibility: () => {}, businessAllowed: () => authorized,
    expandAncestorForFocus: () => events.push(["expand"]),
    pendingCount: () => 1,
    renderSuggestion: () => {}, renderResumeCard: () => {},
    renderSubject(subject) {
      assert.equal(subjectsEl.nodes[0], oldTree, "original tree must survive while replacement is built");
      events.push(["build", subject.id]);
      return { id: "new-" + subject.id };
    },
    renderDetail: (target) => {
      assert.equal(subjectsEl.nodes[0], oldTree);
      target.append({ id: "new-detail" });
      events.push(["detail"]);
    },
    el: () => ({ id: "new-empty" }),
    applyFocus: () => events.push(["focus"]),
    finishUxRender: () => events.push(["restore"]),
    Number, Math
  };
  runInNewContext(renderCode + "\nrender();", flags);
  return { events, viewport, subjectsEl, flags };
}

test("TS-049 tablet: creating/checking a task never exposes an empty live grid", () => {
  const { events, viewport, subjectsEl } = simulateOldTablet();
  assert.equal(viewport.scrollY, 7100,
    "an old Android browser clamps scroll when an unguarded grid is cleared");
  assert.deepEqual(events.slice(0, 3), [
    ["expand"], ["build", "s1"], ["swap", true, "8200px"]
  ]);
  assert.equal(events.at(-2)[0], "focus");
  assert.equal(events.at(-1)[0], "restore");
  assert.equal(subjectsEl.style.minHeight, "", "temporary height reservation must be removed");
  assert.deepEqual(subjectsEl.nodes.map(node => node.id), ["new-s1"]);
});

test("TS-049 tablet: replacement of multiple subjects stays atomic", () => {
  const { events, subjectsEl, viewport } = simulateOldTablet({
    subjects: [{ id: "s1" }, { id: "s2" }, { id: "s3" }]
  });
  assert.equal(viewport.scrollY, 7100);
  assert.equal(events.filter(([name]) => name === "swap").length, 1);
  assert.deepEqual(subjectsEl.nodes.map(node => node.id), ["new-s1", "new-s2", "new-s3"]);
});

test("TS-049 tablet: detail list uses the same guarded atomic swap", () => {
  const { viewport, subjectsEl, events } = simulateOldTablet({ view: "detail" });
  assert.equal(viewport.scrollY, 7100);
  assert.deepEqual(subjectsEl.nodes.map(node => node.id), ["new-detail"]);
  assert.ok(events.some(([name]) => name === "detail"));
});

test("TS-049 tablet: deliberate navigation clears live view without retaining height", () => {
  const { viewport, subjectsEl, events } = simulateOldTablet({ view: "settings" });
  assert.equal(viewport.scrollY, 0);
  assert.deepEqual(subjectsEl.nodes, []);
  assert.ok(events.some(([name, hasChildren, height]) => name === "swap" && !hasChildren && height === ""));
});

test("TS-049 tablet: safe UI-blocking path does not access the business list", () => {
  const { events, subjectsEl } = simulateOldTablet({ authorized: false });
  assert.equal(subjectsEl.nodes[0].id, "old-live-subject");
  assert.equal(events.some(([name]) => name === "swap"), false);
});

test("TS-049 tablet: body scroll anchoring is controlled, not fighting JS restoration", () => {
  assert.match(css, /\.subjects\{[^}]*overflow-anchor:none/);
  assert.match(renderCode, /subjectsEl\.style\.minHeight = Math\.ceil\(height\) \+ "px"/);
  assert.match(renderCode, /subjectsEl\.replaceChildren\(nextSubjects\)/);
  assert.match(renderCode, /finally \{\s*if \(guarded\) subjectsEl\.style\.minHeight = oldMinHeight/);
  assert.doesNotMatch(renderCode, /setTimeout|setInterval|localStorage|Dexie|IndexedDB|commitOperations/);
});
