import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  overviewMetrics,
  overviewSummaryLabel,
  totalTaskCount,
  totalTaskCountLabel,
  subjectMetrics,
  subjectUrgencyLabel,
  subjectProgressLabel
} from "../site/core.js";
import {
  OVERVIEW_PRESENTATION_STATE,
  buildOverviewReadPresentation
} from "../site/overview-read-state.js";
import { SESSION_STATE } from "../site/sync-diagnostics.js";

const root = new URL("..", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), "utf8");
const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

const counterSource = app.slice(
  app.indexOf("function applyOverviewCounter("),
  app.indexOf("function render() {")
);
const subjectSource = app.slice(
  app.indexOf("function renderSubject(subject) {"),
  app.indexOf("function renderSeeMore(")
);

const available = buildOverviewReadPresentation({
  configured: true,
  session: SESSION_STATE.AUTHENTICATED,
  binding: "bound",
  documentLoaded: true,
  elapsedMs: 500
});
const awaiting = buildOverviewReadPresentation({
  configured: true,
  session: SESSION_STATE.AUTHENTICATED,
  binding: "bound",
  documentLoaded: false,
  elapsedMs: 0
});
const actionRequired = buildOverviewReadPresentation({
  configured: true,
  session: SESSION_STATE.AUTHENTICATED,
  binding: "unverified",
  documentLoaded: false,
  elapsedMs: 0
});

const item = (id, priority = "normal", done = false, parentId = null) => ({
  id, title: id, priority, done, parentId
});
const subject = (id, items = []) => ({ id, title: id, items });
const doc = (...subjects) => ({ version: 1, subjects });

function createCounterHarness({ allowed = true, documentState = doc(), presentation = available } = {}) {
  let textWrites = 0;
  let hiddenWrites = 0;
  const counterEl = {
    _text: "",
    _hidden: true,
    get textContent() { return this._text; },
    set textContent(value) {
      textWrites += 1;
      this._text = value;
    },
    get hidden() { return this._hidden; },
    set hidden(value) {
      if (this._hidden !== value) hiddenWrites += 1;
      this._hidden = value;
    }
  };
  const context = {
    OVERVIEW_PRESENTATION_STATE,
    businessAllowed: () => allowed,
    documentState,
    overviewMetrics,
    overviewSummaryLabel,
    counterEl
  };
  runInNewContext(counterSource, context);
  return {
    context,
    counterEl,
    apply(nextPresentation = presentation) {
      context.applyOverviewCounter(nextPresentation);
    },
    textWrites: () => textWrites,
    hiddenWrites: () => hiddenWrites
  };
}

test("TS-053 the initial counter markup is neutral and hidden", () => {
  assert.match(html, /<div class="counter" id="counter" aria-live="polite" hidden><\/div>/);
  assert.equal(html.split('id="counter"').length - 1, 1);
  assert.doesNotMatch(html, /0 prochaine étape/);
});

test("TS-053 CSS wraps the counter and card labels without horizontal overflow", () => {
  assert.match(css, /\.section-top\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.counter\{[^}]*min-width:0[^}]*max-width:100%[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.counter\[hidden\]\{display:none\}/);
  assert.match(css, /\.subject-urgency,\.subject-progress\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(css, /overflow-x\s*:/);
});

test("TS-053 the synthesis is the only pending-step number and unchanged text is not rewritten", () => {
  const harness = createCounterHarness({
    documentState: doc(
      subject("s1", [item("a", "urgent", false)]),
      subject("s2", [item("b", "normal", true)])
    )
  });
  harness.apply();
  assert.equal(harness.counterEl.textContent, "1 projet actif · 1 étape en attente · 1 urgence en attente");
  assert.equal(harness.counterEl.hidden, false);
  assert.equal(harness.hiddenWrites(), 1);

  harness.apply();
  harness.apply();
  assert.equal(harness.textWrites(), 1, "identical aria-live text must not be rewritten");
  assert.equal(harness.hiddenWrites(), 1);

  harness.context.documentState = doc(
    subject("s1", [item("a", "urgent", false)]),
    subject("s2", [item("b", "normal", true), item("c", "normal", false)])
  );
  harness.apply();
  assert.equal(harness.counterEl.textContent, "2 projets actifs · 2 étapes en attente · 1 urgence en attente");
  assert.equal(harness.textWrites(), 2);

  assert.equal(app.match(/counterEl\.textContent\s*=/g).length, 1);
  assert.doesNotMatch(app, /overview-summary|overviewSummary(?!Label|Key|Snapshot)/);
});

test("TS-053 awaiting and blocked presentations expose no fabricated number", () => {
  const harness = createCounterHarness({ documentState: doc(subject("s1", [item("a", "urgent")])) });
  harness.apply(awaiting);
  assert.equal(harness.counterEl.textContent, "");
  assert.equal(harness.counterEl.hidden, true);

  harness.apply(actionRequired);
  assert.equal(harness.counterEl.textContent, "");
  assert.equal(harness.counterEl.hidden, true);
});

test("TS-053 account switch and late A events never expose A metrics under B", () => {
  const harness = createCounterHarness({
    documentState: doc(subject("a", [item("a1", "urgent", false)]))
  });
  harness.apply(available);
  assert.match(harness.counterEl.textContent, /1 projet actif/);

  harness.context.documentState = doc(subject("b", [item("b1", "normal", true)]));
  harness.context.businessAllowed = () => false;
  harness.apply(available);
  assert.equal(harness.counterEl.textContent, "");
  assert.equal(harness.counterEl.hidden, true);

  harness.apply(available);
  assert.equal(harness.counterEl.textContent, "", "a late A event cannot restore metrics");
});

function createRenderHarness(subjectEntry) {
  const texts = [];
  const makeNode = (tag, cls, text) => {
    const node = {
      tag,
      cls,
      text: text === undefined ? undefined : String(text),
      children: [],
      dataset: {},
      style: {},
      attributes: {},
      hidden: false,
      append(...children) { this.children.push(...children); },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener() {}
    };
    if (cls) texts.push({ tag, cls, text: node.text });
    return node;
  };
  const context = {
    documentState: { subjects: [subjectEntry] },
    el: makeNode,
    totalTaskCount,
    totalTaskCountLabel,
    subjectMetrics,
    subjectUrgencyLabel,
    subjectProgressLabel,
    renderTaskArea: () => ({ tag: "div", cls: "task-area" }),
    Math
  };
  runInNewContext(subjectSource, context);
  const card = context.renderSubject(subjectEntry);
  return { card, texts };
}

function cardLabel(texts, cls) {
  const found = texts.find((entry) => entry.cls && entry.cls.split(" ").includes(cls));
  return found ? found.text : null;
}

test("TS-053 renderSubject adds both indicators and leaves the detail header untouched", () => {
  assert.match(subjectSource, /"small subject-urgency", subjectUrgencyLabel\(metrics\.urgentPending\)/);
  assert.match(subjectSource, /"small subject-progress", subjectProgressLabel\(subject\.items\)/);
  const detailHead = between(app, "function renderDetailHead(subject) {", "\n}\nfunction renderRenameForm(");
  assert.doesNotMatch(detailHead, /subject-urgency|subject-progress/);
  assert.doesNotMatch(app, /\.innerHTML/);
});

test("TS-053 card simulations display progress, urgency and the no-step case", () => {
  const empty = createRenderHarness(subject("empty"));
  assert.equal(cardLabel(empty.texts, "subject-urgency"), "0 urgence restante");
  assert.equal(cardLabel(empty.texts, "subject-progress"), "Aucune étape");
  assert.doesNotMatch(cardLabel(empty.texts, "subject-progress"), /%/);

  const twoThirds = createRenderHarness(subject("p", [
    item("p1", "normal", true),
    item("p2", "normal", false),
    item("c1", "normal", true, "p1")
  ]));
  assert.equal(cardLabel(twoThirds.texts, "subject-progress"), "2 / 3 étapes terminées (67 %)");
  assert.equal(cardLabel(twoThirds.texts, "subject-urgency"), "0 urgence restante");

  const urgentChild = createRenderHarness(subject("u", [
    item("p1", "normal", true),
    item("c1", "urgent", false, "p1")
  ]));
  assert.equal(cardLabel(urgentChild.texts, "subject-urgency"), "1 urgence restante");
  assert.equal(cardLabel(urgentChild.texts, "subject-progress"), "1 / 2 étapes terminées (50 %)");

  const doneUrgent = createRenderHarness(subject("d", [
    item("u1", "urgent", true),
    item("n1", "normal", false)
  ]));
  assert.equal(cardLabel(doneUrgent.texts, "subject-urgency"), "0 urgence restante");
  assert.equal(cardLabel(doneUrgent.texts, "subject-progress"), "1 / 2 étapes terminées (50 %)");
});

test("TS-053 card indicators add no control, live region or storage/network access", () => {
  const indicatorLines = subjectSource.split("\n").filter((line) => /subject-urgency|subject-progress/.test(line));
  assert.equal(indicatorLines.length, 2);
  for (const line of indicatorLines) {
    assert.doesNotMatch(line, /button|aria-live|tabIndex|tabindex|addEventListener/);
  }
  assert.doesNotMatch(subjectSource, /aria-live/);
  assert.doesNotMatch(subjectSource, /localStorage|indexedDB|Dexie|fetch\s*\(|\.open\s*\(|\.subscribe\s*\(/);
  assert.doesNotMatch(counterSource, /localStorage|indexedDB|Dexie|fetch\s*\(|\.open\s*\(|\.subscribe\s*\(|setTimeout|setInterval/);
  assert.match(app, /function render\(\)[\s\S]*?replaceSubjectsInCurrentView\(nextSubjects, uxSnapshot\)/);
});

test("TS-053 refresh paths recompute from the assigned documentState without new reads", () => {
  const local = between(app, "async function refreshLocalDocument() {", "function startLocalWorkspace(");
  assert.match(local, /documentState = recordsToDocument\(records\)/);
  assert.match(local, /render\(\)/);
  const synced = between(app, "async function refreshSyncedDocument() {", "function ensureChangeChannel(");
  assert.match(synced, /documentState = nextDocument/);
  assert.match(synced, /render\(\)/);
  assert.match(app, /channel\.addEventListener\("message", \(\) => \{ load\(\); \}\)/);
  const render = between(app, "function render() {", "\nfunction navigate(");
  assert.match(render, /applyOverviewCounter\(presentation\)/);
  assert.match(counterSource, /overviewSummaryLabel\(overviewMetrics\(documentState\)\)/);
});

test("TS-053 the synthesis text is produced from authorized document state only", () => {
  const metrics = overviewMetrics(doc(
    subject("s1", [item("a", "urgent", false), item("b", "normal", true)]),
    subject("s2")
  ));
  assert.equal(overviewSummaryLabel(metrics), "1 projet actif · 1 étape en attente · 1 urgence en attente");
  assert.doesNotMatch(counterSource, /in-sync|phase|syncComplete|session/);
});
