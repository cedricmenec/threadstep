import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { overviewAccessLinkVisible } from "../site/cloud-settings.js";
import {
  BINDING_DIAGNOSTIC_STATE,
  SESSION_STATE
} from "../site/sync-diagnostics.js";
import {
  OVERVIEW_DURABLE_WAIT_MS,
  OVERVIEW_LOADER_DELAY_MS,
  OVERVIEW_LOADER_TEXT,
  OVERVIEW_PRESENTATION_STATE,
  buildOverviewReadPresentation
} from "../site/overview-read-state.js";

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

const constants = {
  OVERVIEW_LOADER_TEXT,
  OVERVIEW_LOADER_DELAY_MS,
  OVERVIEW_DURABLE_WAIT_MS,
  OVERVIEW_PRESENTATION_STATE
};

function transientInput(overrides = {}) {
  return {
    configured: true,
    session: SESSION_STATE.AUTHENTICATED,
    binding: BINDING_DIAGNOSTIC_STATE.BOUND,
    documentLoaded: false,
    elapsedMs: 0,
    ...overrides
  };
}

test("TS-052 the loading region is hidden, accessible and immediately before the list", () => {
  const loader = /<div id="projects-loading" class="projects-loading" role="status" aria-live="polite" aria-busy="true" hidden>Chargement de vos projets…<\/div>/;
  assert.match(html, loader);
  assert.equal(html.split('id="projects-loading"').length - 1, 1);
  const dashboard = between(html, '<section class="dashboard" id="dashboard"', "</section>");
  assert.ok(dashboard.indexOf('id="projects-loading"') < dashboard.indexOf('id="subjects"'));
  assert.ok(dashboard.indexOf('id="projects-loading"') > dashboard.indexOf('id="subject-form"'));
  assert.doesNotMatch(dashboard.slice(dashboard.indexOf('id="projects-loading"'), dashboard.indexOf('id="subjects"')), /<button|<a\b|tabindex/i);
});

test("TS-052 CSS keeps compact stable dimensions, hidden state and reduced motion", () => {
  assert.match(css, /\.projects-loading\{[^}]*min-height:72px[^}]*max-width:100%[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.projects-loading\[hidden\]\{display:none\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.projects-loading\{animation:none;transition:none\}\}/);
  assert.doesNotMatch(css, /overflow-x\s*:/);
  assert.doesNotMatch(css.slice(css.indexOf(".projects-loading{"), css.indexOf(".projects-loading[hidden]")), /animation:/);
});

const adapterSource = app.slice(
  app.indexOf("function overviewPresentationBoundaryKey()"),
  app.indexOf("function overviewPresentationSignals(")
);

function createAdapter() {
  let now = 0;
  let nextId = 1;
  let renders = 0;
  const timers = new Map();
  const context = {
    ...constants,
    route: { view: "overview", subjectId: null },
    accountBinding: { state: "bound", userDigest: "a".repeat(64) },
    syncedDatabase: { name: "threadstep-ws-a" },
    overviewPresentationTimer: null,
    overviewPresentationTimerGeneration: 0,
    overviewPendingSince: null,
    overviewPresentationBoundary: null,
    render: () => { renders += 1; },
    setTimeout(fn, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    Date: { now: () => now }
  };
  runInNewContext(adapterSource, context);
  return {
    context,
    renderCount: () => renders,
    advance(ms) { now += ms; },
    timerCount: () => timers.size,
    nextTimer() {
      return [...timers.entries()][0] || null;
    },
    fire(id) {
      const timer = timers.get(id);
      if (!timer) return;
      timers.delete(id);
      timer.fn();
    }
  };
}

const awaiting = buildOverviewReadPresentation(transientInput({ elapsedMs: 0 }));
const awaitingVisible = buildOverviewReadPresentation(transientInput({ elapsedMs: OVERVIEW_LOADER_DELAY_MS }));
const available = buildOverviewReadPresentation(transientInput({ documentLoaded: true }));
const confirmedError = buildOverviewReadPresentation(transientInput({ readError: true, elapsedMs: 0 }));

test("TS-052 the adapter schedules one cancellable presentation timer", () => {
  const adapter = createAdapter();
  const boundary = adapter.context.overviewPresentationBoundaryKey();
  const elapsed = adapter.context.overviewPresentationElapsed(boundary);
  adapter.context.observeOverviewPresentation(awaiting, boundary);
  assert.equal(elapsed, 0);
  assert.equal(adapter.timerCount(), 1);
  const [id, timer] = adapter.nextTimer();
  assert.equal(timer.delay, OVERVIEW_LOADER_DELAY_MS);
  adapter.advance(OVERVIEW_LOADER_DELAY_MS);
  adapter.fire(id);
  assert.equal(adapter.renderCount(), 1);
  adapter.context.observeOverviewPresentation(awaitingVisible, boundary);
  const [nextId, nextTimer] = adapter.nextTimer();
  assert.equal(nextTimer.delay, OVERVIEW_DURABLE_WAIT_MS - OVERVIEW_LOADER_DELAY_MS);
  adapter.fire(nextId);
  assert.equal(adapter.renderCount(), 2);
});

test("TS-052 resolution and confirmed errors cancel the presentation timer immediately", () => {
  const adapter = createAdapter();
  const boundary = adapter.context.overviewPresentationBoundaryKey();
  adapter.context.observeOverviewPresentation(awaiting, boundary);
  assert.equal(adapter.timerCount(), 1);
  adapter.context.observeOverviewPresentation(available, boundary);
  assert.equal(adapter.timerCount(), 0);
  const stale = adapter.nextTimer();
  assert.equal(stale, null);

  adapter.context.observeOverviewPresentation(awaiting, boundary);
  assert.equal(adapter.timerCount(), 1);
  const [id] = adapter.nextTimer();
  adapter.context.observeOverviewPresentation(confirmedError, boundary);
  assert.equal(adapter.timerCount(), 0);
  adapter.fire(id);
  assert.equal(adapter.renderCount(), 0);
});

test("TS-052 a late callback after a route or account change cannot touch the new view", () => {
  const adapter = createAdapter();
  const boundary = adapter.context.overviewPresentationBoundaryKey();
  adapter.context.observeOverviewPresentation(awaiting, boundary);
  const [id, timer] = adapter.nextTimer();
  adapter.context.route = { view: "settings", subjectId: null };
  adapter.advance(timer.delay);
  adapter.fire(id);
  assert.equal(adapter.renderCount(), 0);

  const second = createAdapter();
  const firstBoundary = second.context.overviewPresentationBoundaryKey();
  second.context.observeOverviewPresentation(awaiting, firstBoundary);
  const [secondId, secondTimer] = second.nextTimer();
  second.context.accountBinding = { state: "mismatch", userDigest: "b".repeat(64) };
  second.context.syncedDatabase = { name: "threadstep-ws-b" };
  second.advance(secondTimer.delay);
  second.fire(secondId);
  assert.equal(second.renderCount(), 0);
});

test("TS-052 durable wait replaces the loader only after its threshold", () => {
  const before = buildOverviewReadPresentation(transientInput({
    elapsedMs: OVERVIEW_DURABLE_WAIT_MS - 1
  }));
  const after = buildOverviewReadPresentation(transientInput({
    elapsedMs: OVERVIEW_DURABLE_WAIT_MS
  }));
  assert.equal(before.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(before.loaderVisible, true);
  assert.equal(after.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED);
  assert.equal(after.loaderVisible, false);
  assert.equal(after.reason, "durable-wait");
});

test("TS-052 ordinary native states never expose the overview summary or link", () => {
  const ordinary = [
    { session: SESSION_STATE.LOADING, documentLoaded: false, elapsedMs: 0 },
    { session: SESSION_STATE.AUTHENTICATED, documentLoaded: false, elapsedMs: 0 },
    { session: SESSION_STATE.AUTHENTICATED, documentLoaded: false, elapsedMs: 249 },
    { session: SESSION_STATE.AUTHENTICATED, documentLoaded: true, elapsedMs: 500 }
  ];
  for (const input of ordinary) {
    const view = buildOverviewReadPresentation(transientInput(input));
    assert.equal(view.actionRequired, false);
    assert.equal(view.summaryVisible, false);
    assert.equal(overviewAccessLinkVisible({
      configured: true,
      needsAttention: view.actionRequired
    }), false);
  }
  for (const phase of ["initial", "pulling", "pushing", "not-in-sync", "in-sync"]) {
    const view = buildOverviewReadPresentation(transientInput({
      phase,
      initialPull: "pending",
      online: false
    }));
    assert.equal(view.actionRequired, false, phase);
  }
});

test("TS-052 confirmed errors, sessions, binding blocks and durable waits expose summary and link", () => {
  const cases = [
    { readError: true },
    { session: SESSION_STATE.EXPIRED },
    { session: SESSION_STATE.REFUSED },
    { binding: BINDING_DIAGNOSTIC_STATE.UNVERIFIED },
    { binding: BINDING_DIAGNOSTIC_STATE.MISMATCH },
    { binding: BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH },
    { elapsedMs: OVERVIEW_DURABLE_WAIT_MS }
  ];
  for (const input of cases) {
    const view = buildOverviewReadPresentation(transientInput(input));
    assert.equal(view.actionRequired, true, JSON.stringify(input));
    assert.equal(view.summaryVisible, true);
    assert.match(view.summaryText, /Paramètres > Synchronisation/);
    assert.equal(overviewAccessLinkVisible({
      configured: true,
      needsAttention: view.actionRequired
    }), true);
  }
});

test("TS-052 the overview decision uses the new model while the page keeps its summary", () => {
  const visibility = between(app, "function applySyncSummaryVisibility(", "\n}\n");
  assert.match(visibility, /applyOverviewSurfaces\(refreshOverviewPresentation\(\)\)/);
  assert.doesNotMatch(visibility, /buildDiagnosticSummary/);
  assert.match(app, /function paintSyncDiagnostic\([\s\S]*?buildDiagnosticSummary\(diagnostic\)/);
  assert.match(app, /overviewAccessLinkVisible\(\{[\s\S]*?needsAttention: presentation\.actionRequired/);
  assert.match(app, /function applyBusinessVisibility\([\s\S]*?refreshOverviewPresentation\(\)/);
  assert.match(app, /presentation\.state === OVERVIEW_PRESENTATION_STATE\.AWAITING_READ/);
});

test("TS-052 waiting suppresses the list, counter, suggestion, resume card and add form", () => {
  const render = between(app, "function render() {", "\nfunction navigate(");
  assert.match(render, /applyBusinessVisibility\(\)/);
  assert.match(render, /applySyncSummaryVisibility\(\)/);
  assert.match(render, /presentation\.state === OVERVIEW_PRESENTATION_STATE\.AWAITING_READ/);
  assert.match(render, /presentation\.actionRequired && !presentation\.projectsAvailable/);
  assert.match(render, /applyOverviewCounter\(presentation\)/);
  assert.match(app, /function applyOverviewCounter\(presentation\)[\s\S]*?const text = suppressed \? "" : overviewSummaryLabel\(overviewMetrics\(documentState\)\)[\s\S]*?counterEl\.hidden = suppressed/);
  assert.match(render, /subjectForm\.hidden = true/);
  assert.match(render, /focusSuggestEl\.hidden = true/);
  assert.match(render, /resumeCardEl\.hidden = true/);
  assert.match(render, /replaceSubjectsInCurrentView\(document\.createDocumentFragment\(\), uxSnapshot\)/);
  assert.match(render, /replaceSubjectsInCurrentView\(nextSubjects, uxSnapshot\)/);
});

const loaderUpdaterSource = app.slice(
  app.indexOf("function updateOverviewLoader("),
  app.indexOf("function applyOverviewSurfaces(")
);

test("TS-052 repeated identical updates do not rewrite status content or move focus or scroll", () => {
  let textWrites = 0;
  let busyWrites = 0;
  let hiddenWrites = 0;
  let focusCalls = 0;
  let scrollCalls = 0;
  const element = {
    _text: OVERVIEW_LOADER_TEXT,
    get textContent() { return this._text; },
    set textContent(value) { textWrites += 1; this._text = value; },
    hidden: true,
    _busy: "true",
    getAttribute(name) { return name === "aria-busy" ? this._busy : null; },
    setAttribute(name, value) {
      if (name === "aria-busy" && value !== this._busy) {
        busyWrites += 1;
        this._busy = value;
      }
    },
    focus() { focusCalls += 1; },
    scrollIntoView() { scrollCalls += 1; }
  };
  const context = {
    ...constants,
    route: { view: "overview" },
    projectsLoadingEl: element,
    overviewLoaderBusy: "true"
  };
  Object.defineProperty(element, "hidden", {
    get() { return this._hidden === true; },
    set(value) {
      if (this._hidden !== value) hiddenWrites += 1;
      this._hidden = value;
    }
  });
  element._hidden = true;
  runInNewContext(loaderUpdaterSource, context);
  const active = buildOverviewReadPresentation(transientInput({ elapsedMs: OVERVIEW_LOADER_DELAY_MS }));
  context.updateOverviewLoader(active);
  context.updateOverviewLoader(active);
  context.updateOverviewLoader(active);
  assert.equal(element.hidden, false);
  assert.equal(element.getAttribute("aria-busy"), "true");
  assert.equal(textWrites, 0);
  assert.equal(busyWrites, 0);
  assert.equal(hiddenWrites, 1);
  assert.equal(focusCalls, 0);
  assert.equal(scrollCalls, 0);
  assert.equal(active.announcementKey, "loader");

  const quiet = buildOverviewReadPresentation(transientInput({ documentLoaded: true }));
  context.updateOverviewLoader(quiet);
  context.updateOverviewLoader(quiet);
  assert.equal(element.hidden, true);
  assert.equal(element.getAttribute("aria-busy"), "false");
  assert.equal(textWrites, 0);
  assert.equal(hiddenWrites, 2);
  assert.equal(busyWrites, 1);
  assert.equal(focusCalls, 0);
});

test("TS-052 account and base switch keeps presentation isolated and restrictions intact", () => {
  const fromA = buildOverviewReadPresentation(transientInput({ documentLoaded: true }));
  assert.equal(fromA.projectsAvailable, true);
  for (const switched of [
    { documentLoaded: false, session: SESSION_STATE.LOADING },
    { documentLoaded: false, binding: BINDING_DIAGNOSTIC_STATE.INDETERMINATE },
    { documentLoaded: true, binding: BINDING_DIAGNOSTIC_STATE.UNVERIFIED },
    { documentLoaded: true, binding: BINDING_DIAGNOSTIC_STATE.MISMATCH },
    { documentLoaded: true, baseMismatch: true }
  ]) {
    const view = buildOverviewReadPresentation(transientInput(switched));
    assert.equal(view.projectsAvailable, false, JSON.stringify(switched));
    assert.notEqual(view.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE);
  }
  assert.match(app, /function clearBusinessForBindingBlock\(\)[\s\S]*?documentState = emptyDocument\(\)/);
  assert.match(app, /function clearBusinessForBindingBlock\(\)[\s\S]*?documentLoaded = false/);
  assert.match(app, /dashboardEl\.hidden = Boolean\(settingsSection\) \|\|\s*\(configured && \(!authenticated \|\| bindingBlocked \|\| !documentLoaded\)\)/);
});

test("TS-052 offline return with loaded projects keeps the same available view", () => {
  const offline = buildOverviewReadPresentation(transientInput({
    documentLoaded: true,
    online: false,
    phase: "offline",
    initialPull: "failed"
  }));
  const online = buildOverviewReadPresentation(transientInput({
    documentLoaded: true,
    online: true,
    phase: "in-sync",
    initialPull: "complete"
  }));
  assert.equal(offline.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE);
  assert.equal(online.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE);
  assert.equal(offline.loaderVisible, false);
  assert.equal(online.loaderVisible, false);
});

test("TS-052 presentation wiring adds no synchronization, storage or network side effect", () => {
  const block = between(app, "function overviewPresentationBoundaryKey()", "function applyBusinessVisibility()");
  for (const forbidden of [
    /\.subscribe\s*\(/, /syncPull/, /retryInitialPull/, /fetch\s*\(/,
    /\.open\s*\(/, /\.commit\s*\(/, /localStorage/, /indexedDB/i,
    /startAuthentication/, /purge/i, /logout/i
  ]) {
    assert.doesNotMatch(block, forbidden, String(forbidden));
  }
  assert.match(block, /setTimeout\(/, "only the presentation timer is allowed");
  assert.doesNotMatch(block, /\.sync\s*\(|syncComplete|requestSubmit/);
});

test("TS-052 the detailed diagnostic, sharing surface and retry handler are unchanged", () => {
  assert.equal(html.split('id="sync-diagnostic"').length - 1, 1);
  assert.match(html, /<section id="sync-diagnostic" class="sync-diagnostic" aria-labelledby="sync-diagnostic-title" hidden><\/section>/);
  assert.match(app, /retry\.addEventListener\("click", \(\) => \{ void retrySyncInitialPull\(\); \}\)/);
  assert.match(app, /function buildSyncSharingPanel\(/);
  assert.match(app, /createDiagnosticSharingController\(/);
  assert.match(app, /title\.id = "sync-diagnostic-title"/);
});

test("TS-052 action and loader texts never expose a secret or claim an unproven Cloud state", () => {
  const texts = ["read-error", "write-error", "session", "signed-out", "binding", "durable-wait"]
    .map((reason) => {
      const overrides = {
        "read-error": { readError: true },
        "write-error": { writeError: true },
        session: { session: SESSION_STATE.EXPIRED },
        "signed-out": { session: SESSION_STATE.SIGNED_OUT },
        binding: { binding: BINDING_DIAGNOSTIC_STATE.UNVERIFIED },
        "durable-wait": { elapsedMs: OVERVIEW_DURABLE_WAIT_MS }
      }[reason];
      return buildOverviewReadPresentation(transientInput(overrides)).summaryText;
    });
  assert.doesNotMatch(OVERVIEW_LOADER_TEXT, /@|985412|tok_|secret|email|otp|token/i);
  assert.doesNotMatch(OVERVIEW_LOADER_TEXT, /\bvide\b|synchronisé/i);
  for (const text of texts) {
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /@|985412|tok_|secret|email|otp|token/i);
    assert.doesNotMatch(text, /\bvide\b|synchronisé/i);
    assert.match(text, /Paramètres > Synchronisation/);
  }
  for (const fixture of [transientInput(), transientInput({ readError: true })]) {
    assert.doesNotMatch(JSON.stringify(fixture), /@|985412|tok_|secret/i);
  }
});
