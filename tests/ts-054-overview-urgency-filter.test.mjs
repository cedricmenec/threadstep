import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  OVERVIEW_FILTER_ALL,
  OVERVIEW_FILTER_URGENT,
  OVERVIEW_FILTER_FOLLOWING,
  OVERVIEW_FILTER_COMPLETED,
  emptyDocument,
  newItem,
  newSubject,
  overviewFilteredSubjects,
  overviewMetrics,
  overviewPreview,
  isSubjectVisibleInOverviewFilter,
  subjectHasPendingUrgency,
  setItemPriority
} from "../site/core.js";

const root = new URL("..", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), "utf8");
const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");
const core = read("site/core.js");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

const item = (id, priority = "normal", done = false, parentId = null) => ({
  id, title: id, priority, done, parentId
});
const subject = (id, items = []) => ({ id, title: id, items });
const doc = (...subjects) => ({ version: 1, subjects });

const pureSource = core.slice(
  core.indexOf("export function subjectHasPendingUrgency(subject)"),
  core.indexOf("function overviewUrgencyEntry(")
);
const syncSource = app.slice(
  app.indexOf("function overviewFilterControl("),
  app.indexOf("function setOverviewProjectFilter(")
);
const setSource = app.slice(
  app.indexOf("function setOverviewProjectFilter("),
  app.indexOf("function resetExpandedViewState(")
);
const resetSource = app.slice(
  app.indexOf("function resetExpandedViewState()"),
  app.indexOf("function currentAuthorizedWorkspaceIdentity(")
);
const renderSource = app.slice(
  app.indexOf("function render() {"),
  app.indexOf("function navigate(")
);
const revealSource = app.slice(
  app.indexOf("function revealAction("),
  app.indexOf("function revealSuggestion(")
);
const filterHandlers = between(
  app,
  "if (overviewFilterAllEl) {",
  'document.addEventListener("keydown"'
);

test("TS-054 the pending-urgency predicate reuses TS-053 metrics for every step depth", () => {
  assert.equal(subjectHasPendingUrgency(subject("empty")), false);
  assert.equal(subjectHasPendingUrgency(subject("none", [item("n", "normal", false)])), false);
  assert.equal(subjectHasPendingUrgency(subject("later", [item("l", "later", false)])), false);
  assert.equal(subjectHasPendingUrgency(subject("urgent-parent", [item("u", "urgent", false)])), true);
  assert.equal(subjectHasPendingUrgency(subject("urgent-child", [
    item("p", "normal", true),
    item("c", "urgent", false, "p")
  ])), true);
  assert.equal(subjectHasPendingUrgency(subject("done-urgent", [item("d", "urgent", true)])), false);
  assert.equal(subjectHasPendingUrgency(subject("done-child", [
    item("p", "urgent", true),
    item("c", "urgent", true, "p")
  ])), false);
});

test("TS-054 urgent mode filters ordered subjects without mutating inputs or identities", () => {
  const a = subject("A", [item("a1", "urgent", false)]);
  const b = subject("B", [item("b1", "urgent", true)]);
  const c = subject("C", [item("c1", "urgent", false)]);
  const subjects = [a, b, c];
  const snapshot = JSON.stringify(subjects);

  const filtered = overviewFilteredSubjects(subjects, OVERVIEW_FILTER_URGENT);
  assert.deepEqual(filtered.map((entry) => entry.id), ["A", "C"]);
  assert.equal(filtered[0], a);
  assert.equal(filtered[1], c);
  assert.equal(overviewFilteredSubjects(subjects, OVERVIEW_FILTER_ALL), subjects);
  assert.equal(overviewFilteredSubjects(subjects, "unknown"), subjects);
  assert.equal(overviewFilteredSubjects(null, OVERVIEW_FILTER_URGENT).length, 0);
  assert.equal(JSON.stringify(subjects), snapshot);
  assert.equal(subjects[0], a);
});

test("TS-054 the pure model has no DOM, storage, network, timer or auth access", () => {
  assert.match(pureSource, /subjectMetrics\(subject\)\.urgentPending > 0/);
  assert.doesNotMatch(pureSource, /priority\s*===\s*"urgent"|done\s*===/);
  assert.doesNotMatch(pureSource,
    /document\.|window\.|localStorage|sessionStorage|indexedDB|IndexedDB|Dexie|fetch\(|XMLHttpRequest|WebSocket|setTimeout|setInterval|navigator|authentication|cloud/i);
});

test("TS-054 the static control has exact labels, initial state and DOM order", () => {
  const block = between(html, '<fieldset id="overview-urgency-filter"', "</fieldset>");
  assert.equal((block.match(/type="radio"/g) || []).length, 4);
  assert.equal((block.match(/name="overview-urgency-filter"/g) || []).length, 4);
  assert.equal((block.match(/>Tous les projets</g) || []).length, 1);
  assert.equal((block.match(/>Projets avec urgences</g) || []).length, 1);
  assert.equal((block.match(/>Projets à suivre</g) || []).length, 1);
  assert.equal((block.match(/>Projets terminés</g) || []).length, 1);
  assert.match(block, /id="overview-filter-all"[^>]*checked/);
  assert.equal((block.match(/checked/g) || []).length, 1);
  assert.doesNotMatch(block, /aria-live/);
  assert.equal((html.match(/>Tous les projets</g) || []).length, 1);
  assert.equal((html.match(/>Projets avec urgences</g) || []).length, 1);
  assert.equal((html.match(/>Projets à suivre</g) || []).length, 1);
  assert.equal((html.match(/>Projets terminés</g) || []).length, 1);

  const completed = html.indexOf('id="hide-completed"');
  const filter = html.indexOf('id="overview-urgency-filter"');
  const list = html.indexOf('id="subjects"');
  assert.ok(completed >= 0 && filter > completed && list > filter);
});

test("TS-054 the control wraps and offers a visible 44 by 44 pixel target", () => {
  assert.match(css, /\.overview-urgency-filter\{[^}]*display:flex[^}]*flex-wrap:wrap[^}]*min-width:0/);
  assert.match(css, /\.overview-urgency-filter \.filter-option\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(css, /\.overview-urgency-filter \.filter-option\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /button:focus-visible,input:focus-visible[^{]*\{[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
});

function createSyncHarness(mode, { allChecked = true, urgentChecked = false,
                                   followingChecked = false, completedChecked = false } = {}) {
  const writes = { all: 0, urgent: 0, following: 0, completed: 0 };
  const make = (key, initial) => ({
    _checked: initial,
    get checked() { return this._checked; },
    set checked(value) { writes[key] += 1; this._checked = value; }
  });
  const all = make("all", allChecked);
  const urgent = make("urgent", urgentChecked);
  const following = make("following", followingChecked);
  const completed = make("completed", completedChecked);
  const context = {
    overviewProjectFilter: mode,
    OVERVIEW_FILTER_ALL,
    OVERVIEW_FILTER_URGENT,
    OVERVIEW_FILTER_FOLLOWING,
    OVERVIEW_FILTER_COMPLETED,
    overviewFilterAllEl: all,
    overviewFilterUrgentEl: urgent,
    overviewFilterFollowingEl: following,
    overviewFilterCompletedEl: completed
  };
  runInNewContext(syncSource, context);
  return {
    context, all, urgent, following, completed,
    allWrites: () => writes.all,
    urgentWrites: () => writes.urgent,
    followingWrites: () => writes.following,
    completedWrites: () => writes.completed
  };
}

test("TS-054 synchronization only rewrites a radio whose checked state differs", () => {
  const aligned = createSyncHarness(OVERVIEW_FILTER_ALL);
  aligned.context.syncOverviewFilterControl();
  aligned.context.syncOverviewFilterControl();
  assert.equal(aligned.allWrites(), 0);
  assert.equal(aligned.urgentWrites(), 0);
  assert.equal(aligned.followingWrites(), 0);
  assert.equal(aligned.completedWrites(), 0);

  const stale = createSyncHarness(OVERVIEW_FILTER_URGENT);
  stale.context.syncOverviewFilterControl();
  assert.equal(stale.all.checked, false);
  assert.equal(stale.urgent.checked, true);
  assert.equal(stale.allWrites(), 1);
  assert.equal(stale.urgentWrites(), 1);
  assert.equal(stale.following.checked, false);
  assert.equal(stale.completed.checked, false);
  stale.context.syncOverviewFilterControl();
  assert.equal(stale.allWrites(), 1);
  assert.equal(stale.urgentWrites(), 1);
  assert.equal(stale.followingWrites(), 0);
  assert.equal(stale.completedWrites(), 0);
});

test("TS-054 setting the filter stays in memory and never touches URL, history or storage", () => {
  assert.match(app, /let overviewProjectFilter = OVERVIEW_FILTER_ALL;/);
  assert.match(setSource, /overviewProjectFilter = overviewFilterIsValid\(mode\) \? mode : OVERVIEW_FILTER_ALL/);
  assert.match(setSource, /syncOverviewFilterControl\(\)/);
  assert.match(setSource, /render\(\)/);
  assert.doesNotMatch(setSource, /location|history|localStorage|sessionStorage|persist\(|documentState/);
  assert.match(filterHandlers, /setOverviewProjectFilter\(OVERVIEW_FILTER_ALL\)/);
  assert.match(filterHandlers, /setOverviewProjectFilter\(OVERVIEW_FILTER_URGENT\)/);
  assert.match(filterHandlers, /setOverviewProjectFilter\(OVERVIEW_FILTER_FOLLOWING\)/);
  assert.match(filterHandlers, /setOverviewProjectFilter\(OVERVIEW_FILTER_COMPLETED\)/);
  assert.doesNotMatch(filterHandlers, /location|history|localStorage|sessionStorage|persist\(|documentState/);
});

test("TS-054 the existing view reset also clears the urgency filter", () => {
  let synchronizations = 0;
  const context = {
    expandedParents: new Set(["p1"]),
    pendingCollapseFocus: "p1",
    overviewProjectFilter: OVERVIEW_FILTER_URGENT,
    OVERVIEW_FILTER_ALL,
    syncOverviewFilterControl: () => { synchronizations += 1; }
  };
  runInNewContext(resetSource, context);
  context.resetExpandedViewState();
  assert.equal(context.expandedParents.size, 0);
  assert.equal(context.pendingCollapseFocus, null);
  assert.equal(context.overviewProjectFilter, OVERVIEW_FILTER_ALL);
  assert.equal(synchronizations, 1);
  assert.doesNotMatch(resetSource, /localStorage|persist\(|documentState/);

  const loadBody = between(app, "function load() {", "async function refreshLocalDocument(");
  assert.doesNotMatch(loadBody, /resetExpandedViewState|overviewProjectFilter/);
  const localRefresh = between(app, "async function refreshLocalDocument()", "function startLocalWorkspace(");
  const syncedRefresh = between(app, "async function refreshSyncedDocument()", "function ensureChangeChannel(");
  assert.doesNotMatch(localRefresh, /resetExpandedViewState|overviewProjectFilter = /);
  assert.doesNotMatch(syncedRefresh, /resetExpandedViewState|overviewProjectFilter = /);
  assert.match(app, /if \(isViewEntry\(route, nextRoute\)\) resetExpandedViewState\(\)/);
  const restoreBody = between(app, "async function confirmRestore(", "function recoveryInstanceContext(");
  assert.match(restoreBody, /await businessStore\.commit\(operations\);[\s\S]*?resetExpandedViewState\(\);/);
});

function createRenderHarness({ mode = OVERVIEW_FILTER_ALL, subjects = [], allowed = true,
                              presentation = null } = {}) {
  const subjectsEl = { nodes: [], replaceChildren(next) { this.nodes = next ? next.nodes.slice() : []; } };
  const fragment = () => ({ nodes: [], append(node) { this.nodes.push(node); } });
  const notifications = [];
  const context = {
    route: { view: "overview" },
    documentState: { subjects },
    overviewProjectFilter: mode,
    OVERVIEW_FILTER_ALL,
    OVERVIEW_FILTER_URGENT,
    OVERVIEW_FILTER_FOLLOWING,
    OVERVIEW_FILTER_COMPLETED,
    overviewFilteredSubjects,
    businessAllowed: () => allowed,
    OVERVIEW_PRESENTATION_STATE: { AWAITING_READ: "awaiting-read" },
    overviewPresentationSnapshot: presentation ? { presentation } : null,
    applyExpandedIdentityBoundary: () => {},
    captureUxContinuity: () => null,
    applyBusinessVisibility: () => {},
    applyNavigationMenu: () => {},
    applySyncSummaryVisibility: () => {},
    applyOverviewCounter: () => {},
    expandAncestorForFocus: () => {},
    reorderNoteEl: { hidden: false },
    hideCompleted: false,
    subjectForm: { hidden: false },
    focusSuggestEl: { hidden: false },
    focusCardEl: { hidden: false },
    resumeCardEl: { hidden: false },
    subjectsEl,
    document: { createDocumentFragment: fragment },
    el(tag, cls, text) {
      const node = {
        tag, cls, text, children: [], hidden: false,
        append(...children) { this.children.push(...children); },
        addEventListener(event, listener) { this.listener = listener; }
      };
      return node;
    },
    renderSuggestion: () => notifications.push("suggestion"),
    renderResumeCard: () => notifications.push("resume"),
    renderUrgencyList: () => {},
    hideOverviewUrgencies: () => {},
    renderSubject: (entry) => ({ tag: "section", cls: "subject", subjectId: entry.id }),
    renderDetail: () => {},
    replaceSubjectsInCurrentView: (next) => { subjectsEl.nodes = next.nodes.slice(); },
    applyFocus: () => {},
    finishUxRender: () => {},
    setOverviewProjectFilter: (next) => notifications.push(["set", next]),
    pendingNavigationFocus: null, focusDetailHeading: false, focusOpenSubjectId: null,
    focusItemId: null, revealItemId: null, focusSubjectId: null, focusRenameControl: false,
    pendingCollapseFocus: null, pendingPriorityFocus: null, pendingMenuFocus: null,
    pendingMoveFocus: null, editingItemId: null, renamingSubject: false,
    Math
  };
  runInNewContext(renderSource, context);
  return { context, subjectsEl, notifications };
}

test("TS-054 render draws only matching cards in original order and keeps global surfaces", () => {
  const harness = createRenderHarness({
    mode: OVERVIEW_FILTER_URGENT,
    subjects: [
      subject("A", [item("a1", "urgent", false)]),
      subject("B", [item("b1", "normal", false)]),
      subject("C", [item("c1", "urgent", false, "a1")])
    ]
  });
  harness.context.render();
  assert.deepEqual(harness.subjectsEl.nodes.map((node) => node.subjectId), ["A", "C"]);
  assert.deepEqual(harness.notifications, ["suggestion", "resume"]);
  assert.match(renderSource, /overviewFilteredSubjects\(documentState\.subjects, overviewProjectFilter\)/);
  assert.match(app, /overviewSummaryLabel\(overviewMetrics\(documentState\)\)/);
  assert.doesNotMatch(renderSource, /overviewMetrics\(overviewSubjects\)|overviewMetrics\(overviewFiltered/);
});

test("TS-054 a retained project keeps the existing five-parent preview", () => {
  const items = Array.from({ length: 7 }, (_, index) =>
    newItem("Parent " + index, "normal", "p" + index));
  items.push(newItem("Urgent child", "urgent", "u1", "p0"));
  const retained = subject("retained", items);
  assert.equal(subjectHasPendingUrgency(retained), true);
  const preview = overviewPreview(retained.items);
  assert.equal(preview.shown.length, 5);
  assert.equal(preview.hasMore, true);
  assert.match(app, /card\.append\(renderTaskArea\(subject, \{ preview: true \}\)\)/);
  assert.match(renderSource, /nextSubjects\.append\(renderSubject\(subject\)\)/);
});

test("TS-054 urgent empty state is dedicated and returns to all projects", () => {
  const harness = createRenderHarness({
    mode: OVERVIEW_FILTER_URGENT,
    subjects: [subject("normal", [item("n", "normal", false)])]
  });
  harness.context.render();
  assert.equal(harness.subjectsEl.nodes.length, 1);
  const empty = harness.subjectsEl.nodes[0];
  assert.equal(empty.cls, "empty filtered-empty");
  const message = empty.children.find((node) => node.cls === "filtered-empty-text");
  assert.equal(message.text, "Aucun projet avec urgence en attente");
  const action = empty.children.find((node) =>
    node.cls && node.cls.split(" ").includes("overview-filter-reset"));
  assert.equal(action.text, "Tous les projets");
  action.listener();
  assert.deepEqual(harness.notifications.at(-1), ["set", OVERVIEW_FILTER_ALL]);

  const general = createRenderHarness({ mode: OVERVIEW_FILTER_ALL, subjects: [] });
  general.context.render();
  assert.equal(general.subjectsEl.nodes[0].cls, "empty");
  assert.match(general.subjectsEl.nodes[0].text, /Aucun sujet pour le moment/);

  const urgentEmptyDocument = createRenderHarness({ mode: OVERVIEW_FILTER_URGENT, subjects: [] });
  urgentEmptyDocument.context.render();
  assert.equal(urgentEmptyDocument.subjectsEl.nodes[0].cls, "empty filtered-empty");
});

test("TS-054 no filtered empty state can escape the TS-052 safety branches", () => {
  const blocked = createRenderHarness({ mode: OVERVIEW_FILTER_URGENT, allowed: false, subjects: [] });
  blocked.context.render();
  assert.equal(blocked.subjectsEl.nodes.length, 0);

  const awaiting = createRenderHarness({
    mode: OVERVIEW_FILTER_URGENT,
    subjects: [],
    presentation: { state: "awaiting-read", actionRequired: false, projectsAvailable: false }
  });
  awaiting.context.render();
  assert.equal(awaiting.subjectsEl.nodes.length, 0);

  const actionRequired = createRenderHarness({
    mode: OVERVIEW_FILTER_URGENT,
    subjects: [],
    presentation: { state: "action-required", actionRequired: true, projectsAvailable: false }
  });
  actionRequired.context.render();
  assert.equal(actionRequired.subjectsEl.nodes.length, 0);

  assert.ok(renderSource.indexOf("if (!businessAllowed())") <
    renderSource.indexOf("if (suppressOverview)"));
  assert.ok(renderSource.indexOf("if (suppressOverview)") <
    renderSource.indexOf("overviewFilteredSubjects("));
  assert.ok(renderSource.indexOf("overviewFilteredSubjects(") <
    renderSource.indexOf("Aucun projet avec urgence en attente"));
});

test("TS-054 local mutation, refresh and Undo recalculate from the current document", () => {
  let document = emptyDocument();
  const project = newSubject("Projet", "s1");
  project.items.push(newItem("Urgent", "urgent", "u1"));
  document.subjects.push(project);
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT).map((s) => s.id), ["s1"]);

  const setDone = (nextDocument, done) => ({
    ...nextDocument,
    subjects: nextDocument.subjects.map((entry) =>
      entry.id === "s1"
        ? { ...entry, items: entry.items.map((step) => step.id === "u1" ? { ...step, done } : step) }
        : entry)
  });
  document = setDone(document, true);
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT), []);
  document = setDone(document, false);
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT).map((s) => s.id), ["s1"]);
  document = setItemPriority(document, "s1", "u1", "normal");
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT), []);
  document = setItemPriority(document, "s1", "u1", "urgent");
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT).map((s) => s.id), ["s1"]);

  assert.doesNotMatch(between(app, "function persist()", "function syncOverviewFilterControl("),
    /overviewProjectFilter = |resetExpandedViewState/);
  const undoBody = between(app, "function undoRemoval(", "function move(");
  assert.doesNotMatch(undoBody, /overviewProjectFilter = |resetExpandedViewState/);
});

test("TS-054 global metrics stay identical and include projects hidden by the filter", () => {
  const document = doc(
    subject("A", [item("a1", "urgent", false), item("a2", "normal", true)]),
    subject("B", [item("b1", "normal", false)]),
    subject("C", [item("c1", "urgent", false, "b1")])
  );
  const metrics = overviewMetrics(document);
  assert.deepEqual(metrics, { activeProjects: 3, pendingSteps: 3, urgentSteps: 2 });
  const filtered = overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT);
  assert.deepEqual(filtered.map((entry) => entry.id), ["A", "C"]);
  assert.deepEqual(overviewMetrics(document), metrics);
});

function runReveal({ subjectEntry, mode }) {
  const calls = [];
  const context = {
    revealItemId: null,
    focusItemId: null,
    hideCompleted: false,
    overviewProjectFilter: mode,
    documentState: { subjects: [subjectEntry] },
    findSubject: () => subjectEntry,
    isSubjectVisibleInOverviewFilter,
    isWithinOverviewPreview: () => true,
    subjectRoute: (id) => "#/sujet/" + id,
    navigate: (hash) => calls.push(["navigate", hash]),
    render: () => calls.push(["render"]),
    renamingSubject: true,
    focusDetailHeading: true
  };
  runInNewContext(revealSource, context);
  context.revealAction(subjectEntry.id, "target");
  return { calls, context };
}

test("TS-054 reveal safely opens the detail route for a project hidden by the filter", () => {
  const hidden = runReveal({
    subjectEntry: subject("hidden", [item("n", "normal", false)]),
    mode: OVERVIEW_FILTER_URGENT
  });
  assert.deepEqual(hidden.calls, [["navigate", "#/sujet/hidden"]]);
  assert.equal(hidden.context.renamingSubject, false);
  assert.equal(hidden.context.focusDetailHeading, false);
  assert.equal(hidden.context.revealItemId, "target");
  assert.doesNotMatch(revealSource, /persist\(|setItemPriority|updateItem|completion/);

  const visible = runReveal({
    subjectEntry: subject("visible", [item("u", "urgent", false)]),
    mode: OVERVIEW_FILTER_URGENT
  });
  assert.deepEqual(visible.calls, [["render"]]);

  const all = runReveal({
    subjectEntry: subject("hidden", [item("n", "normal", false)]),
    mode: OVERVIEW_FILTER_ALL
  });
  assert.deepEqual(all.calls, [["render"]]);
});

test("TS-054 toggling the filter leaves card, draft and completion view state independent", () => {
  assert.doesNotMatch(setSource,
    /expandedParents|editingItemId|openMenuId|hideCompleted|hideCompletedEl|aria-live/);
  assert.doesNotMatch(syncSource, /expandedParents|editingItemId|openMenuId|hideCompleted|aria-live/);
  const completionHandler = between(
    app,
    'hideCompletedEl.addEventListener("change"',
    "if (overviewFilterAllEl)"
  );
  assert.match(completionHandler, /hideCompleted = hideCompletedEl\.checked/);
  assert.doesNotMatch(completionHandler, /overviewProjectFilter|setOverviewProjectFilter/);
  assert.ok(html.indexOf('id="overview-urgency-filter"') < html.indexOf('id="subjects"'));
  assert.match(app, /filterControl\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /case OVERVIEW_FILTER_URGENT: return overviewFilterUrgentEl;/);
  assert.match(app, /card\.append\(renderTaskArea\(subject, \{ preview: true \}\)\)/);
});
