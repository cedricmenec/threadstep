import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  OVERVIEW_URGENCY_LIMIT,
  OVERVIEW_FILTER_ALL,
  OVERVIEW_FILTER_URGENT,
  OVERVIEW_FILTER_FOLLOWING,
  OVERVIEW_FILTER_COMPLETED,
  emptyDocument,
  newItem,
  newSubject,
  isPendingUrgentItem,
  overviewUrgencyEntries,
  overviewUrgencyView,
  findOverviewUrgency,
  overviewMetrics,
  subjectMetrics,
  nextActionSuggestion,
  resumeView,
  updateItem,
  setItemPriority,
  planRemoval,
  restoreRemoval,
  isSubjectVisibleInOverviewFilter,
  isWithinOverviewPreview,
  findSubject,
  substepAncestorId,
  toggleExpandedParent
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

const item = (id, priority = "normal", done = false, parentId = null, title = id) => ({
  id, title, priority, done, parentId
});
const subject = (id, items = [], title = id) => ({ id, title, items });
const doc = (...subjects) => ({ version: 1, subjects });

const modelSource = between(
  core,
  "export function isPendingUrgentItem(item)",
  "export function overviewSubjectStatus(subject)"
);
const urgencyRenderSource = app.slice(
  app.indexOf("function hideOverviewUrgencies("),
  app.indexOf("function render() {")
);
const resetSource = app.slice(
  app.indexOf("function resetExpandedViewState()"),
  app.indexOf("function currentAuthorizedWorkspaceIdentity(")
);
const revealSource = app.slice(
  app.indexOf("function revealAction("),
  app.indexOf("function revealSuggestion(")
);
const focusSource = app.slice(
  app.indexOf("function applyFocus()"),
  app.indexOf("function renderSuggestion(")
);
const renderSource = app.slice(
  app.indexOf("function render() {"),
  app.indexOf("function navigate(")
);

function ids(entries) {
  return entries.map((entry) => entry.subjectId + "/" + entry.itemId);
}

test("TS-056 the pending-urgency predicate is the single TS-053 definition", () => {
  assert.equal(isPendingUrgentItem(item("u", "urgent", false)), true);
  assert.equal(isPendingUrgentItem(item("u", "urgent", true)), false);
  assert.equal(isPendingUrgentItem(item("n", "normal", false)), false);
  assert.equal(isPendingUrgentItem(item("l", "later", false)), false);
  assert.equal(isPendingUrgentItem(null), false);
  assert.match(core, /if \(isPendingUrgentItem\(item\)\) urgentPending \+= 1;/);
  assert.doesNotMatch(
    between(core, "function countItemMetrics(items)", "export function subjectMetrics"),
    /item\.priority === "urgent"/
  );
});

test("TS-056 projection covers empty, 1, 5, 6 and 8 urgencies", () => {
  const makeDocument = (count) => {
    const project = subject("p", Array.from({ length: count }, (_, index) =>
      item("u" + index, "urgent", false, null, "Urgence " + index)));
    return doc(project);
  };
  assert.equal(overviewUrgencyEntries(emptyDocument()).length, 0);
  for (const count of [1, 5, 6, 8]) {
    const view = overviewUrgencyView(makeDocument(count), false);
    assert.equal(view.entries.length, count);
    assert.equal(view.total, count);
    assert.equal(view.shown.length, Math.min(count, OVERVIEW_URGENCY_LIMIT));
    assert.equal(view.hiddenCount, Math.max(0, count - OVERVIEW_URGENCY_LIMIT));
    assert.equal(view.hasMore, count > OVERVIEW_URGENCY_LIMIT);
  }
  const six = overviewUrgencyView(makeDocument(6), false);
  assert.equal(six.hiddenCount, 1);
  const eight = overviewUrgencyView(makeDocument(8), false);
  assert.equal(eight.hiddenCount, 3);
  assert.equal(overviewUrgencyView(makeDocument(8), true).shown.length, 8);
  assert.equal(overviewUrgencyView(makeDocument(8), true).hiddenCount, 0);
});

test("TS-056 urgent parent and urgent child are distinct, including under a completed parent", () => {
  const project = subject("A", [
    item("parent", "urgent", false, null, "Parent urgent"),
    item("child", "urgent", false, "parent", "Enfant urgent"),
    item("finished", "urgent", true, null, "Parent terminé"),
    item("orphan", "urgent", false, "finished", "Enfant encore urgent")
  ], "Projet A");
  const entries = overviewUrgencyEntries(doc(project));
  assert.deepEqual(ids(entries), ["A/parent", "A/child", "A/orphan"]);
  assert.equal(entries[0].isSubstep, false);
  assert.equal(entries[0].parentTitle, null);
  assert.equal(entries[1].isSubstep, true);
  assert.equal(entries[1].parentId, "parent");
  assert.equal(entries[1].parentTitle, "Parent urgent");
  assert.equal(entries[2].parentTitle, "Parent terminé");
  assert.equal(entries[2].isSubstep, true);
  assert.equal(entries[2].subjectTitle, "Projet A");
});

test("TS-056 completed and non-urgent steps are excluded without mutation", () => {
  const a = subject("A", [
    item("u", "urgent", false),
    item("d", "urgent", true),
    item("n", "normal", false),
    item("l", "later", false)
  ]);
  const b = subject("B", [item("u2", "urgent", false)]);
  const document = doc(a, b);
  const snapshot = JSON.stringify(document);
  const entries = overviewUrgencyEntries(document);
  assert.deepEqual(ids(entries), ["A/u", "B/u2"]);
  assert.equal(JSON.stringify(document), snapshot);
  assert.equal(document.subjects[0], a);
  assert.equal(a.items[0].title, "u");
  assert.equal(a.items[0].priority, "urgent");
  assert.equal(a.items[0].done, false);
  assert.equal(a.items[0].parentId, null);
});

test("TS-056 stored project, item and sub-step order is preserved without priority sorting", () => {
  const project = subject("A", [
    item("later-parent", "later", false, null, "Plus tard"),
    item("urgent-late", "urgent", false, null, "Urgent tardif"),
    item("normal-child", "normal", false, "later-parent", "Enfant normal"),
    item("urgent-first-child", "urgent", false, "later-parent", "Premier enfant urgent"),
    item("urgent-second-child", "urgent", false, "later-parent", "Second enfant urgent"),
    item("urgent-parent", "urgent", false, null, "Urgent tôt")
  ]);
  const other = subject("B", [item("b-urgent", "urgent", false)]);
  const entries = overviewUrgencyEntries(doc(project, other));
  assert.deepEqual(ids(entries), [
    "A/urgent-first-child",
    "A/urgent-second-child",
    "A/urgent-late",
    "A/urgent-parent",
    "B/b-urgent"
  ]);
  assert.deepEqual(entries.map((entry) => entry.itemTitle), [
    "Premier enfant urgent", "Second enfant urgent",
    "Urgent tardif", "Urgent tôt", "b-urgent"
  ]);
});

test("TS-056 homonymous titles stay distinct through stable subject and item IDs", () => {
  const a = subject("A", [item("a-u", "urgent", false, null, "Même titre")], "Projet identique");
  const b = subject("B", [item("b-u", "urgent", false, null, "Même titre")], "Projet identique");
  const entries = overviewUrgencyEntries(doc(a, b));
  assert.equal(entries.length, 2);
  assert.deepEqual(ids(entries), ["A/a-u", "B/b-u"]);
  assert.equal(entries[0].itemTitle, entries[1].itemTitle);
  assert.notEqual(entries[0].subjectId, entries[1].subjectId);
  assert.notEqual(entries[0].itemId, entries[1].itemId);
});

test("TS-056 findOverviewUrgency returns the current target or null after removal", () => {
  const a = subject("A", [item("u", "urgent", false)]);
  const document = doc(a);
  const found = findOverviewUrgency(document, "A", "u");
  assert.equal(found.subjectId, "A");
  assert.equal(found.itemId, "u");
  assert.equal(findOverviewUrgency(document, "A", "missing"), null);
  assert.equal(findOverviewUrgency(document, "missing", "u"), null);
  assert.equal(findOverviewUrgency(document, null, null), null);
  const next = { ...document, subjects: [{ ...a, items: [] }] };
  assert.equal(findOverviewUrgency(next, "A", "u"), null);
});

test("TS-056 the pure model has no DOM, storage, network, timer or auth access", () => {
  assert.doesNotMatch(modelSource,
    /window\.|localStorage|sessionStorage|indexedDB|IndexedDB|Dexie|fetch\s*\(|XMLHttpRequest|WebSocket|setTimeout|setInterval|navigator|authentication|cloud/i);
  assert.doesNotMatch(modelSource,
    /document\.(createElement|querySelector|querySelectorAll|getElementById|addEventListener|body|activeElement)/);
  assert.doesNotMatch(modelSource, /\.pushState|\.replaceState|history\./);
});

test("TS-056 subjectMetrics and overviewMetrics keep the same urgentPending values", () => {
  const a = subject("A", [
    item("u", "urgent", false),
    item("d", "urgent", true),
    item("c", "urgent", false, "d"),
    item("n", "normal", false)
  ]);
  const b = subject("B", [item("later", "later", false)]);
  const document = doc(a, b);
  assert.equal(subjectMetrics(a).urgentPending, 2);
  assert.equal(subjectMetrics(b).urgentPending, 0);
  assert.equal(overviewMetrics(document).urgentSteps, 2);
  assert.equal(
    overviewUrgencyEntries(document).filter((entry) => entry.subjectId === "A").length,
    subjectMetrics(a).urgentPending
  );
  assert.equal(
    overviewUrgencyEntries(document).length,
    overviewMetrics(document).urgentSteps
  );
});

test("TS-056 static section, labels, hidden state and accessible markup are unique", () => {
  const sectionCount = html.split('id="overview-urgencies"').length - 1;
  assert.equal(sectionCount, 1);
  const block = between(html, '<section id="overview-urgencies"', "</section>");
  assert.match(block, /<h3 id="overview-urgencies-title"[^>]*>Urgences à traiter<\/h3>/);
  assert.equal((block.match(/>Urgences à traiter</g) || []).length, 1);
  assert.equal((block.match(/>Aucune urgence en attente</g) || []).length, 1);
  assert.equal((block.match(/>Voir toutes les urgences</g) || []).length, 1);
  assert.equal((block.match(/>Réduire</g) || []).length, 1);
  assert.match(block, /<ul id="overview-urgencies-list"[^>]*hidden><\/ul>/);
  assert.match(block, /<p id="overview-urgencies-count"[^>]*hidden><\/p>/);
  assert.match(block, /id="overview-urgencies-more"[^>]*hidden/);
  assert.match(block, /id="overview-urgencies-reduce"[^>]*hidden/);
  assert.doesNotMatch(block, /aria-live/);
  assert.equal((html.match(/>Voir toutes les urgences</g) || []).length, 1);
  assert.equal((html.match(/>Réduire</g) || []).length, 1);
  assert.equal((html.match(/>Aucune urgence en attente</g) || []).length, 1);

  const focusBar = html.indexOf('class="focus-bar"');
  const section = html.indexOf('id="overview-urgencies"');
  const form = html.indexOf('id="subject-form"');
  assert.ok(focusBar >= 0 && section > focusBar && form > section);
});

test("TS-056 CSS stays compact, wraps, targets 44 by 44 and shows focus", () => {
  assert.match(css, /\.overview-urgencies\{[^}]*max-width:100%[^}]*min-width:0/);
  assert.match(css, /\.overview-urgencies\[hidden\]\{display:none\}/);
  assert.match(css, /\.overview-urgencies-list\{[^}]*max-width:100%[^}]*min-width:0/);
  assert.match(css, /\.overview-urgency\{[^}]*flex-wrap:wrap[^}]*min-width:0/);
  assert.match(css, /\.overview-urgency-open\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(css, /\.overview-urgency-open\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.overview-urgencies-toggle\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(css, /button:focus-visible[^{]*\{[^}]*outline:3px solid/);
  assert.doesNotMatch(css, /overflow-x\s*:/);
  assert.match(css, /@media\(max-width:620px\)\{[^}]*\.overview-urgencies/);
});

function classTokens(node) {
  return (node.className || "").split(/\s+/).filter(Boolean);
}
function matches(node, selector) {
  if (selector.startsWith(".")) return classTokens(node).includes(selector.slice(1));
  return node.tag === selector;
}
function walk(node, visit) {
  for (const child of node.children || []) {
    visit(child);
    walk(child, visit);
  }
}
function findAll(node, selector) {
  const found = [];
  walk(node, (child) => { if (matches(child, selector)) found.push(child); });
  return found;
}
function findFirst(node, selector) {
  let found = null;
  walk(node, (child) => { if (!found && matches(child, selector)) found = child; });
  return found;
}

function createUrgencyHarness({ subjects = [], expanded = false, allowed = true,
                                route = { view: "overview" } } = {}) {
  const harness = { active: null, renders: 0, opens: [] };
  const makeNode = (tag, cls, text) => {
    const node = {
      tag,
      className: cls || "",
      textContent: text === undefined ? "" : String(text),
      children: [],
      dataset: {},
      attributes: {},
      hidden: false,
      parentNode: null,
      append(...children) {
        for (const child of children) {
          child.parentNode = node;
          node.children.push(child);
        }
      },
      replaceChildren(...children) {
        node.children = [];
        node.append(...children);
      },
      setAttribute(name, value) { node.attributes[name] = String(value); },
      getAttribute(name) { return node.attributes[name]; },
      addEventListener(event, listener) { node.listeners = node.listeners || {}; node.listeners[event] = listener; },
      focus() { harness.active = node; },
      contains(other) {
        let current = other;
        while (current) {
          if (current === node) return true;
          current = current.parentNode;
        }
        return false;
      },
      closest(selector) {
        let current = node;
        while (current) {
          if (matches(current, selector)) return current;
          current = current.parentNode;
        }
        return null;
      },
      querySelector(selector) { return findFirst(node, selector); },
      querySelectorAll(selector) { return findAll(node, selector); }
    };
    return node;
  };
  const section = makeNode("section", "overview-urgencies");
  section.hidden = true;
  const title = makeNode("h3", "overview-urgencies-title", "Urgences à traiter");
  const empty = makeNode("p", "overview-urgencies-empty", "Aucune urgence en attente");
  empty.hidden = true;
  const list = makeNode("ul", "overview-urgencies-list");
  list.hidden = true;
  const count = makeNode("p", "overview-urgencies-count");
  count.hidden = true;
  const more = makeNode("button", "overview-urgencies-toggle", "Voir toutes les urgences");
  more.hidden = true;
  const reduce = makeNode("button", "overview-urgencies-toggle", "Réduire");
  reduce.hidden = true;
  section.append(title, empty, list, count, more, reduce);
  const context = {
    document: {
      createElement: (tag) => makeNode(tag),
      get activeElement() { return harness.active; }
    },
    el: makeNode,
    route,
    documentState: { subjects },
    businessAllowed: () => allowed,
    overviewUrgenciesExpanded: expanded,
    overviewUrgenciesRenderKey: null,
    overviewUrgenciesEl: section,
    overviewUrgenciesTitleEl: title,
    overviewUrgenciesEmptyEl: empty,
    overviewUrgenciesListEl: list,
    overviewUrgenciesCountEl: count,
    overviewUrgenciesMoreEl: more,
    overviewUrgenciesReduceEl: reduce,
    overviewUrgencyView,
    findOverviewUrgency,
    openUrgencyEntry: (entry) => harness.opens.push(entry),
    OVERVIEW_URGENCY_LIMIT,
    render: () => { harness.renders += 1; },
    JSON,
    Math
  };
  runInNewContext(urgencyRenderSource, context);
  return {
    context, harness, section, title, empty, list, count, more, reduce, makeNode,
    render() { context.renderUrgencyList(); return this; },
    rows() { return list.children.filter((node) => classTokens(node).includes("overview-urgency")); },
    setActive(node) { harness.active = node; }
  };
}

function eightUrgencies() {
  const items = Array.from({ length: 8 }, (_, index) =>
    item("u" + index, "urgent", false, null, "Urgence " + index));
  return [subject("p", items, "Projet")];
}

test("TS-056 render shows the empty state only when the authorized read has no urgency", () => {
  const harness = createUrgencyHarness({ subjects: [subject("p")] }).render();
  assert.equal(harness.section.hidden, false);
  assert.equal(harness.empty.hidden, false);
  assert.equal(harness.list.hidden, true);
  assert.equal(harness.rows().length, 0);
  assert.equal(harness.count.hidden, true);
  assert.equal(harness.more.hidden, true);
  assert.equal(harness.reduce.hidden, true);
});

test("TS-056 render displays 1, 5, 6 and 8 rows with exact counters and labels", () => {
  const one = createUrgencyHarness({
    subjects: [subject("p", [item("u", "urgent", false, null, "Seule urgence")])]
  }).render();
  assert.equal(one.rows().length, 1);
  assert.equal(one.empty.hidden, true);
  assert.equal(one.count.hidden, true);
  assert.equal(one.more.hidden, true);

  const fiveItems = Array.from({ length: 5 }, (_, index) =>
    item("u" + index, "urgent", false, null, "U" + index));
  const five = createUrgencyHarness({ subjects: [subject("p", fiveItems)] }).render();
  assert.equal(five.rows().length, 5);
  assert.equal(five.count.hidden, true);
  assert.equal(five.more.hidden, true);
  assert.equal(five.reduce.hidden, true);

  const six = createUrgencyHarness({ subjects: eightUrgencies().map((entry) => ({
    ...entry, items: entry.items.slice(0, 6)
  })) }).render();
  assert.equal(six.rows().length, 5);
  assert.equal(six.count.hidden, false);
  assert.equal(six.count.textContent, "1 urgence non affichée");
  assert.equal(six.more.hidden, false);
  assert.equal(six.more.textContent, "Voir toutes les urgences");
  assert.equal(six.reduce.hidden, true);

  const eight = createUrgencyHarness({ subjects: eightUrgencies() }).render();
  assert.equal(eight.rows().length, 5);
  assert.equal(eight.count.textContent, "3 urgences non affichées");
  assert.equal(eight.more.hidden, false);
  assert.equal(eight.reduce.hidden, true);
});

test("TS-056 parent and child rows carry text content, IDs and an explicit accessible name", () => {
  const project = subject("project-a", [
    item("parent-id", "urgent", false, null, "Parent <img src=x onerror=alert(1)>"),
    item("child-id", "urgent", false, "parent-id", "Enfant <b>gras</b>")
  ], "Projet <script>alert(1)</script>");
  const harness = createUrgencyHarness({ subjects: [project] }).render();
  const rows = harness.rows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dataset.subject, "project-a");
  assert.equal(rows[0].dataset.item, "parent-id");
  assert.equal(rows[1].dataset.subject, "project-a");
  assert.equal(rows[1].dataset.item, "child-id");
  const parentBody = findFirst(rows[0], ".overview-urgency-body");
  const parentTexts = findAll(parentBody, ".overview-urgency-title")
    .concat(findAll(parentBody, ".overview-urgency-project"))
    .map((node) => node.textContent);
  assert.ok(parentTexts.includes("Parent <img src=x onerror=alert(1)>"));
  assert.ok(parentTexts.includes("Projet <script>alert(1)</script>"));
  assert.equal(findAll(parentBody, "img").length, 0);
  assert.equal(findAll(parentBody, "script").length, 0);
  assert.equal(findAll(parentBody, "b").length, 0);
  assert.equal(findFirst(rows[0], ".overview-urgency-parent"), null);

  const childRows = findAll(rows[1], ".overview-urgency-parent");
  assert.equal(childRows.length, 1);
  assert.equal(childRows[0].textContent, "Sous-tâche de Parent <img src=x onerror=alert(1)>");
  assert.equal(findAll(rows[1], "img").length, 0);
  assert.equal(findAll(rows[1], "b").length, 0);

  const parentOpen = findFirst(rows[0], ".overview-urgency-open");
  const childOpen = findFirst(rows[1], ".overview-urgency-open");
  assert.equal(parentOpen.textContent, "Ouvrir dans le projet");
  assert.match(parentOpen.getAttribute("aria-label"), /Projet <script>alert\(1\)<\/script>/);
  assert.match(parentOpen.getAttribute("aria-label"), /Parent <img src=x onerror=alert\(1\)>/);
  assert.match(childOpen.getAttribute("aria-label"), /Enfant <b>gras<\/b>/);
  assert.match(childOpen.getAttribute("aria-label"), /sous-tâche de Parent <img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(urgencyRenderSource, /innerHTML|insertAdjacentHTML|outerHTML/);
});

test("TS-056 opening a row forwards its stable entry to openUrgencyEntry", () => {
  const harness = createUrgencyHarness({ subjects: eightUrgencies() }).render();
  const open = findFirst(harness.rows()[2], ".overview-urgency-open");
  assert.equal(typeof open.listeners.click, "function");
  open.listeners.click();
  assert.equal(harness.harness.opens.length, 1);
  assert.equal(harness.harness.opens[0].subjectId, "p");
  assert.equal(harness.harness.opens[0].itemId, "u2");
});

test("TS-056 expansion is memory-only, shows every entry and reduction restores five", () => {
  const harness = createUrgencyHarness({ subjects: eightUrgencies(), expanded: true }).render();
  assert.equal(harness.rows().length, 8);
  assert.equal(harness.count.hidden, true);
  assert.equal(harness.more.hidden, true);
  assert.equal(harness.reduce.hidden, false);
  assert.equal(harness.reduce.textContent, "Réduire");
  assert.doesNotMatch(urgencyRenderSource,
    /localStorage|sessionStorage|indexedDB|Dexie|fetch\s*\(|history\.|pushState|replaceState|location\./);

  harness.context.overviewUrgenciesExpanded = false;
  harness.render();
  assert.equal(harness.rows().length, 5);
  assert.equal(harness.count.hidden, false);
  assert.equal(harness.count.textContent, "3 urgences non affichées");
  assert.equal(harness.more.hidden, false);
  assert.equal(harness.reduce.hidden, true);
});

test("TS-056 reset returns the expanded list to collapsed without touching storage", () => {
  const context = {
    expandedParents: new Set(["p"]),
    pendingCollapseFocus: "p",
    overviewProjectFilter: OVERVIEW_FILTER_URGENT,
    overviewUrgenciesExpanded: true,
    overviewUrgenciesRenderKey: "expanded:[]",
    OVERVIEW_FILTER_ALL,
    syncOverviewFilterControl: () => {}
  };
  runInNewContext(resetSource, context);
  context.resetExpandedViewState();
  assert.equal(context.overviewUrgenciesExpanded, false);
  assert.equal(context.overviewUrgenciesRenderKey, null);
  assert.doesNotMatch(resetSource, /localStorage|persist\(|documentState|history\.|location\./);
  assert.match(app, /if \(isViewEntry\(route, nextRoute\)\) resetExpandedViewState\(\)/);
});

test("TS-056 true view entry, reload, identity change and successful import reset the state", () => {
  assert.match(app, /let overviewUrgenciesExpanded = false;/);
  assert.match(app, /overviewUrgenciesExpanded = false;\s*\n\s*overviewUrgenciesRenderKey = null;/);
  assert.match(between(app, "function load() {", "async function refreshLocalDocument("),
    /openMenuId = null/);
  assert.doesNotMatch(between(app, "function load() {", "async function refreshLocalDocument("),
    /overviewUrgenciesExpanded = /);
  assert.match(between(app, "function applyExpandedIdentityBoundary() {", "function load() {"),
    /resetExpandedViewState\(\)/);
  assert.match(between(app, "async function confirmRestore(", "function recoveryInstanceContext("),
    /await businessStore\.commit\(operations\);[\s\S]*?resetExpandedViewState\(\);/);
  assert.match(between(app, "async function confirmLocalImport(", "function renderAuthPanel("),
    /resetExpandedViewState\(\)/);
});

test("TS-056 development handlers flip only in-memory state and preserve focus", () => {
  const harness = createUrgencyHarness({ subjects: eightUrgencies() }).render();
  const setSource = app.slice(
    app.indexOf("function setOverviewUrgenciesExpanded("),
    app.indexOf("function render() {")
  );
  const context = {
    overviewUrgenciesExpanded: false,
    overviewUrgenciesMoreEl: harness.more,
    overviewUrgenciesReduceEl: harness.reduce,
    overviewUrgenciesListEl: harness.list,
    overviewUrgenciesTitleEl: harness.title,
    setOverviewUrgenciesExpanded: undefined,
    render: () => {},
    harness
  };
  runInNewContext(setSource, context);
  context.render = () => {
    harness.context.overviewUrgenciesExpanded = context.overviewUrgenciesExpanded;
    harness.render();
  };
  context.setOverviewUrgenciesExpanded(true);
  assert.equal(context.overviewUrgenciesExpanded, true);
  assert.equal(harness.context.overviewUrgenciesExpanded, true);
  assert.equal(harness.rows().length, 8);
  assert.equal(harness.harness.active, harness.reduce);
  assert.doesNotMatch(setSource, /localStorage|history\.|location\.|persist\(/);
});

test("TS-056 focus is restored for a remaining row and falls back when the row disappears", () => {
  const harness = createUrgencyHarness({ subjects: eightUrgencies() }).render();
  const first = harness.rows()[0];
  const open = findFirst(first, ".overview-urgency-open");
  harness.setActive(open);
  harness.context.documentState = {
    subjects: [subject("p", [item("u0", "urgent", false, null, "Urgence 0 renommée")])]
  };
  harness.render();
  assert.equal(harness.rows().length, 1);
  assert.equal(findFirst(harness.rows()[0], ".overview-urgency-open"), harness.harness.active);

  const secondHarness = createUrgencyHarness({ subjects: eightUrgencies() }).render();
  const row = secondHarness.rows()[0];
  secondHarness.setActive(findFirst(row, ".overview-urgency-open"));
  secondHarness.context.documentState = {
    subjects: [subject("p", [item("other", "urgent", false, null, "Autre")])]
  };
  secondHarness.render();
  assert.equal(secondHarness.harness.active, secondHarness.title);
});

test("TS-056 an identical rerender does not rewrite rows, counter or labels", () => {
  const harness = createUrgencyHarness({ subjects: eightUrgencies() }).render();
  const children = harness.list.children.slice();
  const countText = harness.count.textContent;
  harness.render();
  harness.render();
  assert.deepEqual(harness.list.children, children);
  assert.equal(harness.count.textContent, countText);
  assert.equal(harness.more.textContent, "Voir toutes les urgences");
  assert.equal(harness.reduce.textContent, "Réduire");
  assert.doesNotMatch(urgencyRenderSource, /aria-live/);
});

function runOpen({ subjects, entry, mode = OVERVIEW_FILTER_ALL }) {
  const calls = [];
  const context = {
    revealItemId: null,
    focusItemId: null,
    hideCompleted: false,
    overviewProjectFilter: mode,
    documentState: { subjects },
    findSubject,
    isSubjectVisibleInOverviewFilter,
    isWithinOverviewPreview,
    subjectRoute: (id) => "#/sujet/" + id,
    navigate: (hash) => calls.push(["navigate", hash]),
    render: () => calls.push(["render"]),
    renamingSubject: true,
    focusDetailHeading: true,
    findOverviewUrgency
  };
  runInNewContext(revealSource, context);
  context.openUrgencyEntry(entry);
  return { calls, context };
}

test("TS-056 opening uses detail mode and reveals the exact step under filters and collapse", () => {
  const visibleProject = subject("A", [item("u", "urgent", false, null, "Urgent")]);
  const visible = runOpen({ subjects: [visibleProject], entry: { subjectId: "A", itemId: "u" } });
  assert.deepEqual(visible.calls, [["navigate", "#/sujet/A"]]);
  assert.equal(visible.context.revealItemId, "u");
  assert.equal(visible.context.focusItemId, "u");
  assert.equal(visible.context.renamingSubject, false);
  assert.equal(visible.context.focusDetailHeading, false);

  const hiddenProject = subject("A", [item("u", "urgent", false, null, "Urgent")]);
  const hidden = runOpen({
    subjects: [hiddenProject],
    entry: { subjectId: "A", itemId: "u" },
    mode: OVERVIEW_FILTER_COMPLETED
  });
  assert.deepEqual(hidden.calls, [["navigate", "#/sujet/A"]]);
  assert.equal(hidden.context.revealItemId, "u");
});

test("TS-056 a child beyond the five-parent preview still opens the exact detail target", () => {
  const items = Array.from({ length: 7 }, (_, index) =>
    item("p" + index, "normal", false, null, "Parent " + index));
  items.push(item("child", "urgent", false, "p6", "Enfant hors aperçu"));
  const project = subject("A", items);
  assert.equal(isWithinOverviewPreview(project.items, "child"), false);
  const result = runOpen({
    subjects: [project],
    entry: { subjectId: "A", itemId: "child" }
  });
  assert.deepEqual(result.calls, [["navigate", "#/sujet/A"]]);
  assert.equal(result.context.revealItemId, "child");
  assert.equal(result.context.focusItemId, "child");

  const expanded = new Set();
  const ancestor = substepAncestorId(project.items, "child");
  assert.equal(ancestor, "p6");
  const next = toggleExpandedParent(expanded, ancestor);
  assert.equal(next.has("p6"), true);
  assert.equal(expanded.has("p6"), false);
});

test("TS-056 default suggestion and resume reveal behavior stays unchanged", () => {
  const project = subject("A", [item("u", "urgent", false, null, "Urgent")]);
  const result = runOpen({
    subjects: [project],
    entry: { subjectId: "A", itemId: "u" }
  });
  assert.deepEqual(result.calls, [["navigate", "#/sujet/A"]]);

  const defaultContext = {
    revealItemId: null,
    focusItemId: null,
    hideCompleted: false,
    overviewProjectFilter: OVERVIEW_FILTER_ALL,
    documentState: { subjects: [project] },
    findSubject,
    isSubjectVisibleInOverviewFilter,
    isWithinOverviewPreview,
    subjectRoute: (id) => "#/sujet/" + id,
    navigate: () => assert.fail("default reveal must not navigate"),
    render: () => {},
    renamingSubject: false,
    focusDetailHeading: false
  };
  runInNewContext(revealSource, defaultContext);
  defaultContext.revealAction("A", "u");
  assert.equal(defaultContext.revealItemId, "u");
  assert.equal(defaultContext.focusItemId, "u");
});

test("TS-056 a target removed between render and click cancels without navigation or writes", () => {
  const project = subject("A", [item("u", "urgent", false)]);
  const calls = [];
  const context = {
    revealItemId: "old",
    focusItemId: "old",
    documentState: { subjects: [project] },
    findOverviewUrgency: () => null,
    revealAction: () => calls.push(["reveal"]),
    render: () => calls.push(["render"])
  };
  const source = app.slice(
    app.indexOf("function openUrgencyEntry("),
    app.indexOf("function revealSuggestion(")
  );
  runInNewContext(source, context);
  context.openUrgencyEntry({ subjectId: "A", itemId: "removed" });
  assert.deepEqual(calls, [["render"]]);
  assert.equal(context.revealItemId, null);
  assert.equal(context.focusItemId, null);
  assert.doesNotMatch(source, /persist\(|setItemPriority|updateItem|navigate\(|location\./);
});

test("TS-056 opening never mutates business data, tracking or suggestion", () => {
  const before = doc(
    subject("A", [item("u", "urgent", false), item("n", "normal", false)]),
    subject("B", [item("b", "urgent", false)])
  );
  const snapshot = JSON.stringify(before);
  const suggestion = nextActionSuggestion(before);
  const resume = resumeView(before, { subjectId: "A", itemId: "n" });
  const result = runOpen({ subjects: before.subjects, entry: { subjectId: "B", itemId: "b" } });
  assert.deepEqual(result.calls, [["navigate", "#/sujet/B"]]);
  assert.equal(JSON.stringify(before), snapshot);
  assert.deepEqual(nextActionSuggestion(before), suggestion);
  assert.deepEqual(resumeView(before, { subjectId: "A", itemId: "n" }), resume);
  assert.doesNotMatch(revealSource, /persist\(|setItemPriority|updateItem|saveResumePreference|planRemoval/);
});

function runApplyFocus({ nodes, focusItemId, editingItemId = null }) {
  const subjectsEl = {
    querySelector: () => null,
    querySelectorAll: (selector) => selector === ".task" ? nodes : []
  };
  const context = {
    pendingNavigationFocus: null,
    editingItemId,
    renamingSubject: false,
    focusDetailHeading: false,
    focusOpenSubjectId: null,
    focusRenameControl: false,
    focusSubjectId: null,
    focusItemId,
    pendingCollapseFocus: null,
    pendingPriorityFocus: null,
    pendingMenuFocus: null,
    pendingMoveFocus: null,
    subjectsEl
  };
  runInNewContext(focusSource, context);
  context.applyFocus();
  return { context };
}

test("TS-056 applyFocus reveals task-edit, then task-check or task-menu-button", () => {
  const makeControl = (name) => ({
    name, focused: false,
    focus() { this.focused = true; },
    scrollIntoView() {}
  });
  const edit = makeControl("edit");
  const check = makeControl("check");
  const menu = makeControl("menu");
  const card = {
    dataset: { item: "target" },
    querySelector(selector) {
      if (selector === ".task-edit") return null;
      if (selector === ".task-check") return check;
      if (selector === ".task-menu-button") return menu;
      return null;
    }
  };
  const result = runApplyFocus({ nodes: [card], focusItemId: "target" });
  assert.equal(check.focused, true);
  assert.equal(result.context.focusItemId, null);

  const editCard = {
    dataset: { item: "target" },
    querySelector(selector) {
      if (selector === ".task-edit") return edit;
      return null;
    }
  };
  runApplyFocus({ nodes: [editCard], focusItemId: "target" });
  assert.equal(edit.focused, true);

  const menuCard = {
    dataset: { item: "target" },
    querySelector(selector) {
      if (selector === ".task-menu-button") return menu;
      return null;
    }
  };
  runApplyFocus({ nodes: [menuCard], focusItemId: "target" });
  assert.equal(menu.focused, true);
  assert.match(focusSource, /card\.querySelector\("\.task-edit"\)[\s\S]*card\.querySelector\("\.task-check"\)[\s\S]*card\.querySelector\("\.task-menu-button"\)/);
});

test("TS-056 the section is unreachable without an authorized, resolved Overview read", () => {
  const blocked = createUrgencyHarness({ subjects: eightUrgencies(), allowed: false }).render();
  assert.equal(blocked.section.hidden, true);
  const settings = createUrgencyHarness({
    subjects: eightUrgencies(), route: { view: "settings", section: "root" }
  }).render();
  assert.equal(settings.section.hidden, true);
  const detail = createUrgencyHarness({
    subjects: eightUrgencies(), route: { view: "subject", subjectId: "p" }
  }).render();
  assert.equal(detail.section.hidden, true);

  assert.match(renderSource, /if \(!businessAllowed\(\)\) \{[\s\S]*?hideOverviewUrgencies\(\);/);
  assert.match(renderSource, /if \(route\.view === "settings"\) \{[\s\S]*?hideOverviewUrgencies\(\);/);
  assert.match(renderSource, /if \(suppressOverview\) \{[\s\S]*?hideOverviewUrgencies\(\);/);
  assert.ok(renderSource.indexOf("renderUrgencyList();") > renderSource.indexOf("if (suppressOverview)"));
  assert.ok(renderSource.indexOf("renderUrgencyList();") > renderSource.indexOf("renderResumeCard();"));
  assert.match(renderSource, /const detail = route\.view !== "overview";[\s\S]*hideOverviewUrgencies\(\);[\s\S]*renderDetail/);
});

test("TS-056 an A-to-B identity change clears A and a late A event cannot restore it", () => {
  const a = createUrgencyHarness({
    subjects: [subject("A", [item("a1", "urgent", false, null, "Urgence A")])]
  }).render();
  assert.deepEqual(a.rows().map((row) => row.dataset.subject), ["A"]);

  a.context.documentState = {
    subjects: [subject("B", [item("b1", "urgent", false, null, "Urgence B")])]
  };
  a.context.overviewUrgenciesExpanded = false;
  a.render();
  assert.deepEqual(a.rows().map((row) => row.dataset.subject), ["B"]);
  assert.doesNotMatch(a.list.children.map((node) =>
    findAll(node, ".overview-urgency-title").map((title) => title.textContent).join(" ")).join(" "), /Urgence A/);

  a.context.documentState = {
    subjects: [subject("A", [item("a1", "urgent", false, null, "Urgence A")])]
  };
  a.context.businessAllowed = () => false;
  a.render();
  assert.equal(a.section.hidden, true);

  a.context.businessAllowed = () => true;
  a.render();
  assert.deepEqual(a.rows().map((row) => row.dataset.subject), ["A"]);
  assert.equal(renderSource.indexOf("applyExpandedIdentityBoundary();") <
    renderSource.indexOf("renderUrgencyList();"), true);
});

test("TS-056 the list recomputes after completion, priority, removal/undo, addition and import", () => {
  let document = doc(subject("A", [
    item("u1", "urgent", false, null, "U1"),
    item("u2", "urgent", false, null, "U2")
  ]));
  assert.deepEqual(ids(overviewUrgencyEntries(document)), ["A/u1", "A/u2"]);

  document = {
    ...document,
    subjects: document.subjects.map((entry) => ({
      ...entry,
      items: entry.items.map((step) => step.id === "u1" ? { ...step, done: true } : step)
    }))
  };
  assert.deepEqual(ids(overviewUrgencyEntries(document)), ["A/u2"]);

  document = setItemPriority(document, "A", "u2", "normal");
  assert.deepEqual(ids(overviewUrgencyEntries(document)), []);
  document = setItemPriority(document, "A", "u2", "urgent");
  assert.deepEqual(ids(overviewUrgencyEntries(document)), ["A/u2"]);

  const planned = planRemoval(document, "A", "u2");
  assert.deepEqual(ids(overviewUrgencyEntries(planned.document)), []);
  const restored = restoreRemoval(planned.document, planned.removal);
  assert.deepEqual(ids(overviewUrgencyEntries(restored)), ["A/u2"]);

  const added = {
    ...restored,
    subjects: restored.subjects.map((entry) => ({
      ...entry,
      items: entry.items.concat(item("u3", "urgent", false, null, "U3"))
    }))
  };
  assert.deepEqual(ids(overviewUrgencyEntries(added)), ["A/u2", "A/u3"]);

  const imported = doc(subject("B", [item("b1", "urgent", false)]));
  assert.deepEqual(ids(overviewUrgencyEntries(imported)), ["B/b1"]);

  const renamed = updateItem(added, "A", "u2", { title: "U2 renommée", priority: "urgent" });
  assert.equal(overviewUrgencyEntries(renamed)[0].itemTitle, "U2 renommée");

  assert.doesNotMatch(urgencyRenderSource,
    /persist\(|commit\(|documentToRecords|\.subscribe\(|fetch\s*\(|new Dexie|indexedDB|localStorage/);
  assert.doesNotMatch(urgencyRenderSource, /documentState\s*=[^=]/);
});

test("TS-056 global metrics, suggestion, resume and cards are independent and not duplicated", () => {
  const document = doc(
    subject("A", [item("a1", "urgent", false), item("a2", "normal", false)]),
    subject("B", [item("b1", "normal", false)]),
    subject("C", [item("c1", "urgent", false, "b1")])
  );
  const metrics = overviewMetrics(document);
  const suggestion = nextActionSuggestion(document);
  const resume = resumeView(document, { subjectId: "B", itemId: "b1" });
  for (const mode of [
    OVERVIEW_FILTER_ALL, OVERVIEW_FILTER_URGENT, OVERVIEW_FILTER_FOLLOWING,
    OVERVIEW_FILTER_COMPLETED, "unknown"
  ]) {
    assert.deepEqual(ids(overviewUrgencyEntries(document)), ["A/a1", "C/c1"]);
  }
  const view = overviewUrgencyView(document, true);
  assert.deepEqual(view.shown.map((entry) => entry.itemId), ["a1", "c1"]);
  assert.deepEqual(overviewMetrics(document), metrics);
  assert.deepEqual(nextActionSuggestion(document), suggestion);
  assert.deepEqual(resumeView(document, { subjectId: "B", itemId: "b1" }), resume);
  assert.doesNotMatch(urgencyRenderSource, /overviewProjectFilter|hideCompleted|nextActionSuggestion|resumeView|overviewMetrics/);
  assert.equal((html.match(/id="subjects"/g) || []).length, 1);
  assert.equal((html.match(/id="overview-urgencies"/g) || []).length, 1);
  assert.doesNotMatch(between(html, '<section id="overview-urgencies"', "</section>"), /class="subject"|task-check|task-menu-button/);
});

test("TS-056 no extra persistence, listener, fetch, auth, history or export field is added", () => {
  assert.doesNotMatch(urgencyRenderSource,
    /localStorage|sessionStorage|indexedDB|IndexedDB|Dexie|fetch\s*\(|XMLHttpRequest|WebSocket|history\.|pushState|replaceState|location\.|navigator|authentication|cloud/i);
  assert.doesNotMatch(urgencyRenderSource, /\.subscribe\(|\.open\(|commitOperations|documentToRecords|buildBusinessExport|parseDocument/);
  assert.doesNotMatch(revealSource, /localStorage|sessionStorage|indexedDB|Dexie|fetch\s*\(|history\.|pushState|replaceState|location\.|navigator|authentication|cloud/i);
  assert.doesNotMatch(resetSource, /localStorage|sessionStorage|indexedDB|Dexie|fetch\s*\(|history\.|pushState|replaceState|location\./);
  assert.doesNotMatch(modelSource, /\.subscribe\(|commitOperations|documentToRecords|buildBusinessExport|parseDocument/);
  assert.match(html, /<section id="overview-urgencies"/);
});
