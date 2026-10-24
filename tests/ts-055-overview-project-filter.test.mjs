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
  overviewSubjectStatus,
  subjectMetrics,
  setItemPriority,
  planRemoval,
  restoreRemoval
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

const pureSource = [
  core.slice(
    core.indexOf("export function subjectHasPendingUrgency(subject)"),
    core.indexOf("function overviewUrgencyEntry(")
  ),
  core.slice(
    core.indexOf("export function overviewSubjectStatus(subject)"),
    core.indexOf("function countLabel(")
  )
].join("\n");
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
const finishFocusSource = app.slice(
  app.indexOf("function finishUxRender("),
  app.indexOf("function replaceSubjectsInCurrentView(")
);
const filterHandlers = between(
  app,
  "if (overviewFilterAllEl) {",
  'document.addEventListener("keydown"'
);

const modes = [
  OVERVIEW_FILTER_ALL,
  OVERVIEW_FILTER_URGENT,
  OVERVIEW_FILTER_FOLLOWING,
  OVERVIEW_FILTER_COMPLETED
];

const followingSubject = subject("following", [
  item("parent-done", "normal", true),
  item("child-pending", "normal", false, "parent-done")
]);
const completedSubject = subject("completed", [
  item("parent-done", "normal", true),
  item("child-done", "normal", true, "parent-done")
]);
const pendingSubject = subject("pending", [item("plain", "normal", false)]);
const emptySubject = subject("empty");
const completedUrgentSubject = subject("completed-urgent", [
  item("urgent-done", "urgent", true)
]);
const urgentSubject = subject("urgent", [item("urgent-pending", "urgent", false)]);

test("TS-055 classification derives following, completed and empty from subject metrics", () => {
  assert.equal(overviewSubjectStatus(followingSubject), "following");
  assert.equal(overviewSubjectStatus(pendingSubject), "following");
  assert.equal(overviewSubjectStatus(completedSubject), "completed");
  assert.equal(overviewSubjectStatus(completedUrgentSubject), "completed");
  assert.equal(overviewSubjectStatus(emptySubject), "empty");

  assert.equal(subjectMetrics(followingSubject).pending, 1);
  assert.equal(isSubjectVisibleInOverviewFilter(followingSubject, OVERVIEW_FILTER_FOLLOWING), true);
  assert.equal(isSubjectVisibleInOverviewFilter(followingSubject, OVERVIEW_FILTER_COMPLETED), false);
  assert.equal(isSubjectVisibleInOverviewFilter(completedSubject, OVERVIEW_FILTER_FOLLOWING), false);
  assert.equal(isSubjectVisibleInOverviewFilter(completedSubject, OVERVIEW_FILTER_COMPLETED), true);
  assert.equal(isSubjectVisibleInOverviewFilter(emptySubject, OVERVIEW_FILTER_FOLLOWING), false);
  assert.equal(isSubjectVisibleInOverviewFilter(emptySubject, OVERVIEW_FILTER_COMPLETED), false);
  assert.equal(isSubjectVisibleInOverviewFilter(emptySubject, OVERVIEW_FILTER_ALL), true);
});

test("TS-055 the three filtered modes are distinct and urgency stays TS-054 compatible", () => {
  const subjects = [
    followingSubject,
    completedSubject,
    urgentSubject,
    completedUrgentSubject,
    emptySubject
  ];
  const following = overviewFilteredSubjects(subjects, OVERVIEW_FILTER_FOLLOWING);
  const completed = overviewFilteredSubjects(subjects, OVERVIEW_FILTER_COMPLETED);
  const urgent = overviewFilteredSubjects(subjects, OVERVIEW_FILTER_URGENT);

  assert.deepEqual(following.map((entry) => entry.id), ["following", "urgent"]);
  assert.deepEqual(completed.map((entry) => entry.id), ["completed", "completed-urgent"]);
  assert.deepEqual(urgent.map((entry) => entry.id), ["urgent"]);
  assert.equal(following.includes(completedSubject), false);
  assert.equal(completed.includes(followingSubject), false);
  assert.equal(urgent.includes(completedUrgentSubject), false);
  assert.equal(overviewFilteredSubjects(subjects, OVERVIEW_FILTER_ALL), subjects);
  assert.equal(overviewFilteredSubjects(subjects, "unknown"), subjects);
  assert.equal(overviewFilteredSubjects(null, OVERVIEW_FILTER_FOLLOWING).length, 0);
});

test("TS-055 valid modes preserve stored order and never mutate inputs or identities", () => {
  const subjects = [
    subject("A", [item("a1", "normal", false)]),
    subject("B", [item("b1", "normal", true)]),
    subject("C", [item("c1", "normal", false)])
  ];
  const snapshot = JSON.stringify(subjects);
  const following = overviewFilteredSubjects(subjects, OVERVIEW_FILTER_FOLLOWING);
  const completed = overviewFilteredSubjects(subjects, OVERVIEW_FILTER_COMPLETED);
  assert.deepEqual(following.map((entry) => entry.id), ["A", "C"]);
  assert.deepEqual(completed.map((entry) => entry.id), ["B"]);
  assert.equal(following[0], subjects[0]);
  assert.equal(completed[0], subjects[1]);
  assert.equal(JSON.stringify(subjects), snapshot);
  assert.equal(subjects.length, 3);
});

test("TS-055 the pure model has no DOM, storage, network, timer or auth access", () => {
  assert.match(pureSource, /subjectMetrics\(subject\)/);
  assert.match(pureSource, /metrics\.pending > 0/);
  assert.match(pureSource, /metrics\.total > 0/);
  assert.doesNotMatch(pureSource, /priority\s*===\s*"urgent"|done\s*===/);
  assert.doesNotMatch(pureSource,
    /document\.|window\.|localStorage|sessionStorage|indexedDB|IndexedDB|Dexie|fetch\(|XMLHttpRequest|WebSocket|setTimeout|setInterval|navigator|authentication|cloud/i);
});

test("TS-055 the static selector exposes four unique modes before the list", () => {
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

  const labels = [...block.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(labels, [
    "Tous les projets",
    "Projets avec urgences",
    "Projets à suivre",
    "Projets terminés"
  ]);
  for (const label of labels) {
    assert.equal((html.match(new RegExp(">" + label + "<", "g")) || []).length, 1);
  }

  const completed = html.indexOf('id="hide-completed"');
  const filter = html.indexOf('id="overview-urgency-filter"');
  const list = html.indexOf('id="subjects"');
  assert.ok(completed >= 0 && filter > completed && list > filter);
});

test("TS-055 the selector wraps and keeps a visible 44 by 44 pixel target", () => {
  assert.match(css, /\.overview-urgency-filter\{[^}]*display:flex[^}]*flex-wrap:wrap[^}]*min-width:0/);
  assert.match(css, /\.overview-urgency-filter \.filter-option\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(css, /\.overview-urgency-filter \.filter-option\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.overview-urgency-filter \.filter-option span\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /button:focus-visible,input:focus-visible[^{]*\{[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
});

function createFilterHarness(mode) {
  const writes = { all: 0, urgent: 0, following: 0, completed: 0 };
  const makeControl = (key) => ({
    _checked: false,
    _focused: 0,
    get checked() { return this._checked; },
    set checked(value) { writes[key] += 1; this._checked = value; },
    focus() { this._focused += 1; }
  });
  const controls = {
    overviewFilterAllEl: makeControl("all"),
    overviewFilterUrgentEl: makeControl("urgent"),
    overviewFilterFollowingEl: makeControl("following"),
    overviewFilterCompletedEl: makeControl("completed")
  };
  let renders = 0;
  const context = {
    overviewProjectFilter: mode,
    OVERVIEW_FILTER_ALL,
    OVERVIEW_FILTER_URGENT,
    OVERVIEW_FILTER_FOLLOWING,
    OVERVIEW_FILTER_COMPLETED,
    ...controls,
    render: () => { renders += 1; }
  };
  const initial = {
    [OVERVIEW_FILTER_ALL]: controls.overviewFilterAllEl,
    [OVERVIEW_FILTER_URGENT]: controls.overviewFilterUrgentEl,
    [OVERVIEW_FILTER_FOLLOWING]: controls.overviewFilterFollowingEl,
    [OVERVIEW_FILTER_COMPLETED]: controls.overviewFilterCompletedEl
  };
  initial[mode]._checked = true;
  runInNewContext(syncSource + setSource, context);
  return {
    context,
    controls,
    writes: () => ({ ...writes }),
    totalWrites: () => Object.values(writes).reduce((sum, count) => sum + count, 0),
    renders: () => renders,
    checkedModes: () => modes.filter((entry) => initial[entry].checked)
  };
}

test("TS-055 synchronization keeps exactly one mode checked and rewrites only stale radios", () => {
  const harness = createFilterHarness(OVERVIEW_FILTER_FOLLOWING);
  harness.context.syncOverviewFilterControl();
  harness.context.syncOverviewFilterControl();
  assert.equal(harness.totalWrites(), 0);
  assert.deepEqual(harness.checkedModes(), [OVERVIEW_FILTER_FOLLOWING]);

  const stale = createFilterHarness(OVERVIEW_FILTER_COMPLETED);
  stale.controls.overviewFilterCompletedEl._checked = false;
  stale.controls.overviewFilterAllEl._checked = true;
  stale.context.overviewProjectFilter = OVERVIEW_FILTER_COMPLETED;
  stale.context.syncOverviewFilterControl();
  assert.deepEqual(stale.checkedModes(), [OVERVIEW_FILTER_COMPLETED]);
  assert.equal(stale.controls.overviewFilterAllEl.checked, false);
  assert.equal(stale.controls.overviewFilterCompletedEl.checked, true);
  const writesAfterFirst = stale.totalWrites();
  stale.context.syncOverviewFilterControl();
  assert.equal(stale.totalWrites(), writesAfterFirst);
});

test("TS-055 setting a mode normalizes unknown values and stays in memory", () => {
  const harness = createFilterHarness(OVERVIEW_FILTER_ALL);
  for (const mode of [OVERVIEW_FILTER_URGENT, OVERVIEW_FILTER_FOLLOWING, OVERVIEW_FILTER_COMPLETED]) {
    harness.context.setOverviewProjectFilter(mode);
    assert.equal(harness.context.overviewProjectFilter, mode);
    assert.deepEqual(harness.checkedModes(), [mode]);
  }
  harness.context.setOverviewProjectFilter("unknown");
  assert.equal(harness.context.overviewProjectFilter, OVERVIEW_FILTER_ALL);
  assert.deepEqual(harness.checkedModes(), [OVERVIEW_FILTER_ALL]);
  assert.equal(harness.renders(), 4);

  assert.doesNotMatch(setSource, /location|history|localStorage|sessionStorage|persist\(|documentState/);
  assert.doesNotMatch(syncSource, /location|history|localStorage|sessionStorage|persist\(|documentState/);
  for (const mode of [OVERVIEW_FILTER_ALL, OVERVIEW_FILTER_URGENT,
    OVERVIEW_FILTER_FOLLOWING, OVERVIEW_FILTER_COMPLETED]) {
    assert.match(filterHandlers,
      new RegExp("setOverviewProjectFilter\\(OVERVIEW_FILTER_" +
        mode.toUpperCase() + "\\)"));
  }
  assert.doesNotMatch(filterHandlers,
    /location|history|localStorage|sessionStorage|persist\(|documentState/);
});

test("TS-055 empty-state reset focuses the static all-projects radio once", () => {
  const harness = createFilterHarness(OVERVIEW_FILTER_COMPLETED);
  harness.context.setOverviewProjectFilter(OVERVIEW_FILTER_ALL, true);
  assert.equal(harness.context.overviewProjectFilter, OVERVIEW_FILTER_ALL);
  assert.deepEqual(harness.checkedModes(), [OVERVIEW_FILTER_ALL]);
  assert.equal(harness.controls.overviewFilterAllEl._focused, 1);
  assert.equal(harness.controls.overviewFilterCompletedEl._focused, 0);
});

test("TS-055 the existing view reset clears the project mode while refreshes preserve it", () => {
  let synchronizations = 0;
  const context = {
    expandedParents: new Set(["p1"]),
    pendingCollapseFocus: "p1",
    overviewProjectFilter: OVERVIEW_FILTER_FOLLOWING,
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
  assert.match(app, /channel\.addEventListener\("message", \(\) => \{ load\(\); \}\)/);
  assert.match(app, /if \(isViewEntry\(route, nextRoute\)\) resetExpandedViewState\(\)/);

  const boundaryBody = between(app, "function applyExpandedIdentityBoundary() {", "function load() {");
  assert.match(boundaryBody, /shouldResetExpandedParents\(expandedParentIdentityKey, identity\)/);
  assert.match(boundaryBody, /resetExpandedViewState\(\)/);
  const localConfirmBody = between(app, "async function confirmLocalImport(", "function renderAuthPanel(");
  assert.match(localConfirmBody, /await businessStore\.commit\(plan\.operations\);[\s\S]*?resetExpandedViewState\(\);/);
  const reconciliationBody = between(app, "async function confirmReconciliation(", "const workspaceLegacyConfig = readCloudConfig();");
  assert.match(reconciliationBody, /if \(outcome\.status === "local-written"\) \{\s*resetExpandedViewState\(\);/);
  assert.match(reconciliationBody, /outcome\.status === "already-migrated" \|\| outcome\.status === "up-to-date"/);
  const restoreBody = between(app, "async function confirmRestore(", "function recoveryInstanceContext(");
  assert.match(restoreBody, /await businessStore\.commit\(operations\);[\s\S]*?resetExpandedViewState\(\);/);
  const persistBody = between(app, "function persist()", "function overviewFilterControl(");
  assert.doesNotMatch(persistBody, /resetExpandedViewState|overviewProjectFilter = /);
  const undoBody = between(app, "function undoRemoval(", "function move(");
  assert.doesNotMatch(undoBody, /overviewProjectFilter = |resetExpandedViewState/);
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
    applyOverviewCounter: (value) => notifications.push(["counter", value]),
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
    setOverviewProjectFilter: (next, focusControl) => {
      context.overviewProjectFilter = next;
      notifications.push(["set", next, focusControl]);
    },
    pendingNavigationFocus: null, focusDetailHeading: false, focusOpenSubjectId: null,
    focusItemId: null, revealItemId: null, focusSubjectId: null, focusRenameControl: false,
    pendingCollapseFocus: null, pendingPriorityFocus: null, pendingMenuFocus: null,
    pendingMoveFocus: null, editingItemId: null, renamingSubject: false,
    Math
  };
  runInNewContext(renderSource, context);
  return { context, subjectsEl, notifications };
}

test("TS-055 render draws only matching cards in original order for every mode", () => {
  const subjects = [
    followingSubject, completedSubject, pendingSubject, emptySubject,
    completedUrgentSubject, urgentSubject
  ];
  const expected = {
    [OVERVIEW_FILTER_ALL]: ["following", "completed", "pending", "empty",
      "completed-urgent", "urgent"],
    [OVERVIEW_FILTER_URGENT]: ["urgent"],
    [OVERVIEW_FILTER_FOLLOWING]: ["following", "pending", "urgent"],
    [OVERVIEW_FILTER_COMPLETED]: ["completed", "completed-urgent"]
  };
  for (const mode of modes) {
    const harness = createRenderHarness({ mode, subjects });
    harness.context.render();
    assert.deepEqual(harness.subjectsEl.nodes.map((node) => node.subjectId), expected[mode], mode);
    assert.deepEqual(harness.notifications.filter((entry) => entry === "suggestion"), ["suggestion"]);
    assert.deepEqual(harness.notifications.filter((entry) => entry === "resume"), ["resume"]);
  }
  assert.match(renderSource, /overviewFilteredSubjects\(documentState\.subjects, overviewProjectFilter\)/);
  assert.match(app, /overviewSummaryLabel\(overviewMetrics\(documentState\)\)/);
  assert.doesNotMatch(renderSource, /overviewMetrics\(overviewSubjects\)|overviewMetrics\(overviewFiltered/);
  assert.doesNotMatch(renderSource, /renderTaskArea\([^)]*overviewProjectFilter/);
});

test("TS-055 a retained project keeps the unchanged five-parent preview", () => {
  const items = Array.from({ length: 7 }, (_, index) =>
    newItem("Parent " + index, "normal", "p" + index));
  const retained = subject("retained", items);
  const preview = overviewPreview(retained.items);
  assert.equal(preview.shown.length, 5);
  assert.equal(preview.hasMore, true);
  assert.equal(overviewSubjectStatus(retained), "following");
  assert.match(app, /card\.append\(renderTaskArea\(subject, \{ preview: true \}\)\)/);
  assert.match(renderSource, /nextSubjects\.append\(renderSubject\(subject\)\)/);
});

test("TS-055 filtered empty states are exact, dedicated and return to all projects", () => {
  const cases = [
    [OVERVIEW_FILTER_URGENT, "Aucun projet avec urgence en attente", pendingSubject],
    [OVERVIEW_FILTER_FOLLOWING, "Aucun projet à suivre", completedSubject],
    [OVERVIEW_FILTER_COMPLETED, "Aucun projet terminé", pendingSubject]
  ];
  for (const [mode, message, entry] of cases) {
    const harness = createRenderHarness({ mode, subjects: [entry] });
    harness.context.render();
    assert.equal(harness.subjectsEl.nodes.length, 1);
    const empty = harness.subjectsEl.nodes[0];
    assert.equal(empty.cls, "empty filtered-empty");
    const text = empty.children.find((node) => node.cls === "filtered-empty-text");
    assert.equal(text.text, message);
    assert.notEqual(text.text, "Aucun sujet pour le moment");
    const action = empty.children.find((node) =>
      node.cls && node.cls.split(" ").includes("overview-filter-reset"));
    assert.equal(action.text, "Tous les projets");
    action.listener();
    assert.deepEqual(harness.notifications.at(-1), ["set", OVERVIEW_FILTER_ALL, true]);
  }

  for (const mode of [OVERVIEW_FILTER_URGENT, OVERVIEW_FILTER_FOLLOWING, OVERVIEW_FILTER_COMPLETED]) {
    const emptyDocumentHarness = createRenderHarness({ mode, subjects: [] });
    emptyDocumentHarness.context.render();
    assert.equal(emptyDocumentHarness.subjectsEl.nodes[0].cls, "empty filtered-empty");
    assert.equal(emptyDocumentHarness.subjectsEl.nodes[0].children[0].cls, "filtered-empty-text");
  }

  const general = createRenderHarness({ mode: OVERVIEW_FILTER_ALL, subjects: [] });
  general.context.render();
  assert.equal(general.subjectsEl.nodes[0].cls, "empty");
  assert.match(general.subjectsEl.nodes[0].text, /Aucun sujet pour le moment/);

  assert.doesNotMatch(renderSource, /persist\(|documentState\s*=|localStorage/);
});

test("TS-055 no filtered empty state escapes the safety branches", () => {
  const blocked = createRenderHarness({ mode: OVERVIEW_FILTER_FOLLOWING, allowed: false, subjects: [] });
  blocked.context.render();
  assert.equal(blocked.subjectsEl.nodes.length, 0);

  const awaiting = createRenderHarness({
    mode: OVERVIEW_FILTER_COMPLETED,
    subjects: [],
    presentation: { state: "awaiting-read", actionRequired: false, projectsAvailable: false }
  });
  awaiting.context.render();
  assert.equal(awaiting.subjectsEl.nodes.length, 0);

  const actionRequired = createRenderHarness({
    mode: OVERVIEW_FILTER_FOLLOWING,
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
  assert.match(app, /function clearBusinessForBindingBlock\(\)[\s\S]*?documentState = emptyDocument\(\)/);
});

function withDone(document, subjectId, itemId, done) {
  return {
    ...document,
    subjects: document.subjects.map((entry) =>
      entry.id === subjectId
        ? {
          ...entry,
          items: entry.items.map((step) =>
            step.id === itemId ? { ...step, done } : step)
        }
        : entry)
  };
}

test("TS-055 completion, creation, removal, Undo and refresh recalculate membership", () => {
  let document = emptyDocument();
  document.subjects.push(subject("s1", [
    item("parent", "normal", true),
    item("child", "normal", false, "parent")
  ]));
  const followingIds = () => overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_FOLLOWING).map((entry) => entry.id);
  const completedIds = () => overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_COMPLETED).map((entry) => entry.id);

  assert.deepEqual(followingIds(), ["s1"]);
  assert.deepEqual(completedIds(), []);

  document = withDone(document, "s1", "child", true);
  assert.deepEqual(followingIds(), []);
  assert.deepEqual(completedIds(), ["s1"]);

  const created = { ...document, subjects: document.subjects.map((entry) =>
    entry.id === "s1"
      ? { ...entry, items: entry.items.concat(item("new", "normal", false)) }
      : entry) };
  document = created;
  assert.deepEqual(followingIds(), ["s1"]);
  assert.deepEqual(completedIds(), []);

  const plan = planRemoval(document, "s1", "new");
  document = plan.document;
  assert.deepEqual(followingIds(), []);
  assert.deepEqual(completedIds(), ["s1"]);
  document = restoreRemoval(document, plan.removal);
  assert.deepEqual(followingIds(), ["s1"]);

  document = withDone(document, "s1", "new", true);
  assert.deepEqual(completedIds(), ["s1"]);
  assert.deepEqual(followingIds(), []);

  const refreshed = { ...document };
  assert.notEqual(refreshed, document);
  assert.deepEqual(overviewFilteredSubjects(refreshed.subjects, OVERVIEW_FILTER_COMPLETED).map((entry) => entry.id), ["s1"]);
  assert.deepEqual(overviewFilteredSubjects(refreshed.subjects, OVERVIEW_FILTER_FOLLOWING), []);
  assert.match(app, /channel\.addEventListener\("message", \(\) => \{ load\(\); \}\)/);
});

test("TS-055 priority changes recalculate urgency without changing completion membership", () => {
  let document = emptyDocument();
  document.subjects.push(subject("s1", [item("step", "normal", false)]));
  const urgentIds = () => overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_URGENT).map((entry) => entry.id);
  const followingIds = () => overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_FOLLOWING).map((entry) => entry.id);
  assert.deepEqual(urgentIds(), []);
  assert.deepEqual(followingIds(), ["s1"]);

  document = setItemPriority(document, "s1", "step", "urgent");
  assert.deepEqual(urgentIds(), ["s1"]);
  assert.deepEqual(followingIds(), ["s1"]);

  document = setItemPriority(document, "s1", "step", "later");
  assert.deepEqual(urgentIds(), []);
  assert.deepEqual(followingIds(), ["s1"]);
  assert.match(app, /let overviewProjectFilter = OVERVIEW_FILTER_ALL;/);
  assert.doesNotMatch(between(app, "function persist()", "function overviewFilterControl("),
    /overviewProjectFilter = |resetExpandedViewState/);
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

test("TS-055 hidden targets open the detail route under every filtered mode", () => {
  const hiddenCases = [
    [subject("completed", [item("done", "normal", true)]), OVERVIEW_FILTER_FOLLOWING],
    [subject("following", [item("pending", "normal", false)]), OVERVIEW_FILTER_COMPLETED],
    [subject("plain", [item("normal", "normal", false)]), OVERVIEW_FILTER_URGENT],
    [subject("done-urgent", [item("urgent", "urgent", true)]), OVERVIEW_FILTER_URGENT]
  ];
  for (const [entry, mode] of hiddenCases) {
    const result = runReveal({ subjectEntry: entry, mode });
    assert.deepEqual(result.calls, [["navigate", "#/sujet/" + entry.id]], mode);
    assert.equal(result.context.renamingSubject, false);
    assert.equal(result.context.focusDetailHeading, false);
    assert.equal(result.context.revealItemId, "target");
  }

  const visibleCases = [
    [subject("following", [item("pending", "normal", false)]), OVERVIEW_FILTER_FOLLOWING],
    [subject("completed", [item("done", "normal", true)]), OVERVIEW_FILTER_COMPLETED],
    [subject("urgent", [item("pending", "urgent", false)]), OVERVIEW_FILTER_URGENT],
    [subject("empty"), OVERVIEW_FILTER_ALL]
  ];
  for (const [entry, mode] of visibleCases) {
    const result = runReveal({ subjectEntry: entry, mode });
    assert.deepEqual(result.calls, [["render"]], mode);
  }
  assert.doesNotMatch(revealSource, /persist\(|setItemPriority|updateItem|resumeRef/);
});

function createFocusHarness(mode) {
  const control = { _focused: 0, focus() { this._focused += 1; } };
  const controls = {
    [OVERVIEW_FILTER_ALL]: { _focused: 0, focus() { this._focused += 1; } },
    [OVERVIEW_FILTER_URGENT]: { _focused: 0, focus() { this._focused += 1; } },
    [OVERVIEW_FILTER_FOLLOWING]: { _focused: 0, focus() { this._focused += 1; } },
    [OVERVIEW_FILTER_COMPLETED]: { _focused: 0, focus() { this._focused += 1; } }
  };
  controls[mode] = control;
  const body = {};
  const context = {
    route: { view: "overview" },
    overviewProjectFilter: mode,
    OVERVIEW_FILTER_ALL,
    OVERVIEW_FILTER_URGENT,
    OVERVIEW_FILTER_FOLLOWING,
    OVERVIEW_FILTER_COMPLETED,
    overviewFilterControl: (value) => controls[value],
    overviewFilterAllEl: controls[OVERVIEW_FILTER_ALL],
    overviewFilterUrgentEl: controls[OVERVIEW_FILTER_URGENT],
    overviewFilterFollowingEl: controls[OVERVIEW_FILTER_FOLLOWING],
    overviewFilterCompletedEl: controls[OVERVIEW_FILTER_COMPLETED],
    pendingTaskCreationFocus: null,
    uxSubject: () => null,
    uxFindFocus: () => null,
    uxContext: () => ({ allowed: true }),
    lastRenderedUxContext: null,
    uxRenderVersion: 0,
    document: { activeElement: body, body },
    shouldRestoreInteraction: () => false,
    restoreUxScroll: () => {},
    window: {},
    Number, Math
  };
  runInNewContext(finishFocusSource, context);
  const snapshot = {
    focus: { key: "task:s1:removed" },
    focusedNode: { isConnected: false },
    context: { allowed: true }
  };
  context.finishUxRender(snapshot);
  return { context, controls };
}

test("TS-055 focus falls back to the selected filtered radio when its project leaves", () => {
  for (const mode of [OVERVIEW_FILTER_URGENT, OVERVIEW_FILTER_FOLLOWING,
    OVERVIEW_FILTER_COMPLETED]) {
    const { controls } = createFocusHarness(mode);
    assert.equal(controls[mode]._focused, 1, mode);
  }
  const all = createFocusHarness(OVERVIEW_FILTER_ALL);
  assert.equal(all.controls[OVERVIEW_FILTER_ALL]._focused, 0);
  assert.match(finishFocusSource,
    /overviewProjectFilter !== OVERVIEW_FILTER_ALL/);
  assert.match(finishFocusSource,
    /overviewFilterControl\(overviewProjectFilter\)/);
});

test("TS-055 switching modes preserves card, draft and completion view state", () => {
  assert.doesNotMatch(syncSource,
    /expandedParents|editingItemId|openMenuId|hideCompleted|hideCompletedEl|aria-live/);
  assert.doesNotMatch(setSource,
    /expandedParents|editingItemId|openMenuId|hideCompleted|hideCompletedEl|aria-live/);
  const completionHandler = between(
    app,
    'hideCompletedEl.addEventListener("change"',
    "if (overviewFilterAllEl)"
  );
  assert.match(completionHandler, /hideCompleted = hideCompletedEl\.checked/);
  assert.doesNotMatch(completionHandler, /overviewProjectFilter|setOverviewProjectFilter/);
  assert.ok(html.indexOf('id="overview-urgency-filter"') < html.indexOf('id="subjects"'));
  assert.match(app, /card\.append\(renderTaskArea\(subject, \{ preview: true \}\)\)/);
  assert.match(app, /if \(hideCompleted\)|visibleItems\(subject\.items, hideCompleted\)/);
});

test("TS-055 global metrics and completion filtering remain independent of the mode", () => {
  const document = doc(
    subject("A", [item("a1", "urgent", false), item("a2", "normal", true)]),
    subject("B", [item("b1", "normal", false)]),
    subject("C", [item("c1", "urgent", true)]),
    subject("D")
  );
  const metrics = overviewMetrics(document);
  assert.deepEqual(metrics, { activeProjects: 2, pendingSteps: 2, urgentSteps: 1 });
  for (const mode of modes) {
    const filtered = overviewFilteredSubjects(document.subjects, mode);
    assert.deepEqual(overviewMetrics(document), metrics, mode);
    for (const entry of filtered) {
      assert.deepEqual(subjectMetrics(entry), subjectMetrics(entry));
    }
  }
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_COMPLETED)
    .map((entry) => entry.id), ["C"]);
  assert.deepEqual(overviewFilteredSubjects(document.subjects, OVERVIEW_FILTER_FOLLOWING)
    .map((entry) => entry.id), ["A", "B"]);
});
