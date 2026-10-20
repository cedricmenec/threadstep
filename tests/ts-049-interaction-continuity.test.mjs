import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  selectReadingAnchor, resolveReadingAnchor, readingScrollDelta,
  shouldRestoreInteraction
} from "../site/interaction-continuity.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const originalView = { view: "overview", subjectId: null, generation: 2, allowed: true };

test("TS-049 preserves the first visible reading anchor and its original offset", () => {
  const items = [
    { key: "task:s1:a", top: -130, bottom: -45 },
    { key: "task:s1:b", top: -22, bottom: 28 },
    { key: "task:s1:c", top: 29, bottom: 80 }
  ];
  const anchor = selectReadingAnchor(items, 600);
  assert.equal(anchor.key, "task:s1:b");
  assert.deepEqual(resolveReadingAnchor(items, anchor.key, [
    "task:s1:a", "task:s1:b", "task:s1:c"
  ]), items[1]);
  assert.equal(readingScrollDelta(anchor.top, 105, 600), 127);
});

test("TS-049 an already removed anchor falls back to a neighbouring task", () => {
  const before = [
    { key: "task:s1:a", top: 30 },
    { key: "task:s1:b", top: 70 },
    { key: "task:s1:c", top: 110 }
  ];
  assert.deepEqual(resolveReadingAnchor(before, "task:s1:b", ["task:s1:a", "task:s1:c"]), before[2]);
  assert.deepEqual(resolveReadingAnchor(before, "task:s1:b", ["task:s1:a"]), before[0]);
  assert.equal(resolveReadingAnchor(before, "task:s1:b", []), null);
  assert.equal(resolveReadingAnchor(before, "task:s1:unknown", ["task:s1:a"]), null);
});

test("TS-049 no anchor means no forced scroll and verified anchors allow large offsets", () => {
  assert.equal(selectReadingAnchor([], 640), null);
  assert.equal(selectReadingAnchor([{ key: "x", top: 700, bottom: 760 }], 640), null);
  assert.equal(selectReadingAnchor([{ key: "x", top: 2, bottom: 20 }], 0), null);
  assert.equal(readingScrollDelta(NaN, 20, 600), null);
  assert.equal(readingScrollDelta(20, 5000, 600), 4980);
  assert.equal(readingScrollDelta(20, 20, 600), 0);
});

test("TS-049 a route, subject, generation or blocked binding invalidates captured UI", () => {
  assert.equal(shouldRestoreInteraction(originalView, { ...originalView }), true);
  assert.equal(shouldRestoreInteraction(originalView, { ...originalView, view: "settings" }), false);
  assert.equal(shouldRestoreInteraction(originalView, { ...originalView, subjectId: "s1" }), false);
  assert.equal(shouldRestoreInteraction(originalView, { ...originalView, generation: 3 }), false);
  assert.equal(shouldRestoreInteraction(originalView, { ...originalView, allowed: false }), false);
  assert.equal(shouldRestoreInteraction(null, originalView), false);
});

test("TS-049 restoration is connected to render before the DOM is replaced", () => {
  const render = app.slice(app.indexOf("function render() {"), app.indexOf("function navigate("));
  assert.match(render, /captureUxContinuity\(\)/);
  assert.match(render, /focusItemId === revealItemId/);
  assert.match(render, /expandAncestorForFocus\\(\\)/);
  assert.match(render, /document\\.createDocumentFragment\\(\\)/);
  assert.match(render, /replaceSubjectsInCurrentView\\(nextSubjects, uxSnapshot\\)/);
  assert.doesNotMatch(render, /subjectsEl\\.replaceChildren\\(\\);\\s*\\n\\s*expandAncestorForFocus\\(\\)/);
  assert.match(render, /finishUxRender\(uxSnapshot, explicitUxFocus\)/);
  assert.match(app, /shouldRestoreInteraction\(snapshot\.context, context\)/);
  assert.match(app, /window\.scrollTo\(\{ top: target, left: 0, behavior: "instant" \}\)/);
  assert.doesNotMatch(app.slice(app.indexOf("function finishUxRender("), app.indexOf("function render() {")), /scrollIntoView|localStorage|IndexedDB|\.commit\(/);
});

test("TS-049 successive submissions use the new mounted creation input", () => {
  const renderTask = app.slice(app.indexOf("function renderTaskArea("), app.indexOf("function substepListId("));
  assert.match(renderTask, /pendingTaskCreationFocus = subject\.id;\s*\n\s*persist\(\);/);
  assert.doesNotMatch(renderTask, /input\.focus\(\)/);
  assert.match(app, /subject\.querySelector\("\.task-form input"\)/);
  assert.match(app, /field\.focus\(\{ preventScroll: true \}\)/);
  assert.match(renderTask, /form\.dataset\.subject = subject\.id/);
});

test("TS-049 pure continuity helpers do not touch storage or Cloud", () => {
  const source = readFileSync(new URL("../site/interaction-continuity.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /window|document|localStorage|IndexedDB|Dexie|fetch\(|storage|cloudWrite|setTimeout/);
  assert.match(app, /const records = documentToRecords\(documentState\);\s*\n\s*render\(\);\s*\n\s*return commitOperations\(records\);/);
});

const scrollAdapter = app.slice(
  app.indexOf("function restoreUxScroll("), app.indexOf("function finishUxRender(")
);
function runScrollFixture({ previousY = 9300, anchorTop = 48, currentAbsolute = 9348,
                            after = { ...originalView }, present = true } = {}) {
  const scrollCalls = [];
  const win = {
    scrollY: 0, innerHeight: 640,
    scrollTo({ top, behavior }) {
      assert.equal(behavior, "instant");
      this.scrollY = top;
      scrollCalls.push(top);
    }
  };
  const oldKey = "task:s1:i90";
  const snapshot = {
    context: originalView,
    scrollY: previousY,
    anchors: [{ key: oldKey, top: anchorTop }],
    anchorKey: oldKey
  };
  const context = {
    snapshot, window: win,
    uxContext: () => after,
    shouldRestoreInteraction,
    uxVisibleAnchors: () => present
      ? [{ key: oldKey, top: currentAbsolute - win.scrollY, bottom: currentAbsolute + 48 - win.scrollY }]
      : [],
    resolveReadingAnchor, readingScrollDelta
  };
  runInNewContext(scrollAdapter + "\nrestoreUxScroll(snapshot);", context);
  return { win, scrollCalls };
}

test("TS-049 real adapter restores 9300px after the browser clamps scrollY to zero", () => {
  const { win, scrollCalls } = runScrollFixture();
  assert.equal(win.scrollY, 9300);
  assert.deepEqual(scrollCalls, [9300]);
});

test("TS-049 real adapter keeps the same anchor if a new row shifts it", () => {
  const { win } = runScrollFixture({ previousY: 9300, currentAbsolute: 9510 });
  assert.equal(win.scrollY, 9462);
});

test("TS-049 real adapter uses absolute previous scroll for an anchor removed by a filter", () => {
  const { win } = runScrollFixture({ present: false });
  assert.equal(win.scrollY, 9300);
});

test("TS-049 scroll never restores past identity or view boundaries", () => {
  for (const after of [
    { ...originalView, allowed: false },
    { ...originalView, view: "detail", subjectId: "s2" },
    { ...originalView, generation: 3 }
  ]) {
    const { win, scrollCalls } = runScrollFixture({ after });
    assert.equal(win.scrollY, 0);
    assert.deepEqual(scrollCalls, []);
  }
});

test("TS-049 the next animation frame repairs an anchoring reset without stale navigation", () => {
  const block = app.slice(app.indexOf("function finishUxRender("), app.indexOf("function render() {"));
  const frames = [];
  let nextVersion = 0;
  const snapshot = { context: originalView, anchors: [{ key: "task:s1:i90", top: 40 }], anchorKey: "task:s1:i90", scrollY: 9200, focus: null };
  const win = {
    scrollY: 0, innerHeight: 700,
    scrollTo({ top }) { this.scrollY = top; },
    requestAnimationFrame(fn) { frames.push(fn); }
  };
  const ctx = {
    snapshot,
    window: win,
    uxContext: () => originalView,
    shouldRestoreInteraction,
    uxVisibleAnchors: () => [{ key: "task:s1:i90", top: 9240 - win.scrollY, bottom: 9280 - win.scrollY }],
    resolveReadingAnchor, readingScrollDelta,
    uxFindFocus: () => null,
    uxSubject: () => null,
    pendingTaskCreationFocus: null,
    document: { activeElement: null, body: {} },
    uxRenderVersion: nextVersion,
    lastRenderedUxContext: null,
    restoreUxScroll: undefined
  };
  // Evaluate both functions in the same realm as their declared globals.
  runInNewContext(scrollAdapter + "\n" + block + "\nfinishUxRender(snapshot);", ctx);
  assert.equal(win.scrollY, 9200);
  assert.equal(frames.length, 1);
  win.scrollY = 0; // emulate deferred native anchoring after the DOM swap
  frames[0]();
  assert.equal(win.scrollY, 9200);
});
