import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newItem, visibleItems, overviewPreview, substepView, toggleCollapsedParent } from "../site/core.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const renderItemBody = app.slice(app.indexOf("function renderItem("), app.indexOf("function renderRow("));

function items() {
  return [
    newItem("Parent", "normal", "p1"),
    newItem("First child", "normal", "c1", "p1"),
    newItem("Second child", "normal", "c2", "p1"),
    newItem("Third child", "normal", "c3", "p1"),
    newItem("Other parent", "urgent", "p2"),
  ];
}

test("renderItem derives the level class from item.parentId === null", () => {
  assert.match(renderItemBody, /const level = item\.parentId === null \? "task-parent" : "task-substep"/);
  assert.match(renderItemBody, /"task-parent"/);
  assert.match(renderItemBody, /"task-substep"/);
});

test("renderItem keeps the done and reveal class composition", () => {
  assert.match(renderItemBody, /\(item\.done \? " done" : ""\)/);
  assert.match(renderItemBody, /\(revealItemId === item\.id \? " reveal" : ""\)/);
});

test("renderItem keeps the semantic child list, substepView call and in-order children iteration", () => {
  assert.match(renderItemBody, /const view = substepView\(subject\.items, item\.id, hideCompleted, collapsedParents\)/);
  assert.match(renderItemBody, /const list = el\("ul", "tasks children"\)/);
  assert.match(renderItemBody, /for \(const child of view\.children\) list\.append\(renderItem\(subject, child\)\)/);
  assert.doesNotMatch(renderItemBody, /\.sort\(/);
});

test("renderItem builds titles as text nodes and never uses innerHTML", () => {
  assert.doesNotMatch(app, /\.innerHTML/);
  assert.match(app, /function el\(tag, cls, text\) \{[\s\S]*?node\.textContent = text;/);
});

test("substeps carry indentation, spacing and a structural non-interactive guide", () => {
  assert.match(styles, /\.children\{[^}]*padding-left:\d+px/);
  assert.match(styles, /\.children\{[^}]*border-left:/);
  assert.match(styles, /\.task-substep\{[^}]*padding-left:\d+px/);
  assert.match(styles, /\.children \.task\{[^}]*margin-top:\d+px/);
});

test("a typographic scale cue distinguishes substeps from top-level tasks", () => {
  assert.match(styles, /\.task-substep>\.task-row \.task-title\{[^}]*font-size:/);
  assert.match(styles, /\.task-parent>\.task-row \.task-title\{[^}]*font-weight:700/);
});

test("top-level tasks get extra vertical separation", () => {
  assert.match(styles, /\.task-parent\{[^}]*margin-top:\d+px/);
});

test("the existing mobile query adapts the hierarchy without a new media query", () => {
  assert.match(styles, /@media\(max-width:620px\)\{[^\n]*\.children\{padding-left:16px\}/);
  assert.match(styles, /@media\(max-width:620px\)\{[^\n]*\.task-substep\{padding-left:8px\}/);
});

test("focus, 44 × 44 px targets and reduced-motion rules are still present", () => {
  assert.match(styles, /button:focus-visible[^{]*\{[^}]*outline:3px solid/);
  assert.match(styles, /\.priority-control\{[^}]*min-height:44px[^}]*min-width:44px/);
  assert.match(styles, /@media\(prefers-reduced-motion:no-preference\)/);
});

test("the done, filtered and collapsed render path is unchanged", () => {
  assert.match(renderItemBody, /if \(view\.renderChildren\) \{/);
  assert.match(app, /list\.id = substepListId\(item\.id\)/);
  assert.match(app, /toggle\.setAttribute\("aria-controls", substepListId\(item\.id\)\)/);
});

test("a parent keeps its direct substeps in stored order under the default path", () => {
  const source = items();
  assert.deepEqual(substepView(source, "p1", false, new Set()).children.map((item) => item.id), ["c1", "c2", "c3"]);
  assert.deepEqual(visibleItems(source, "p1", false).map((item) => item.id), ["c1", "c2", "c3"]);
});

test("a parent keeps its direct substeps in stored order under the completed filter", () => {
  const source = items();
  source[2].done = true;
  const view = substepView(source, "p1", true, new Set());
  assert.deepEqual(view.children.map((item) => item.id), ["c1", "c3"]);
  assert.equal(view.renderChildren, true);
});

test("a collapsed parent still lists its visible substeps in stored order but renders none", () => {
  const source = items();
  const view = substepView(source, "p1", false, new Set(["p1"]));
  assert.deepEqual(view.children.map((item) => item.id), ["c1", "c2", "c3"]);
  assert.equal(view.collapsed, true);
  assert.equal(view.renderChildren, false);
});

test("a completed parent with an unfinished substep stays visible when completed steps are hidden", () => {
  const source = items();
  source[0].done = true;
  assert.deepEqual(visibleItems(source, null, true).map((item) => item.id), ["p2", "p1"]);
  assert.deepEqual(overviewPreview(source, true).shown.map((item) => item.id), ["p2", "p1"]);
});

test("the helpers leave the input item array and the collapse set unmutated", () => {
  const source = items();
  const before = JSON.stringify(source);
  const collapsed = new Set(["p1"]);
  const collapsedBefore = JSON.stringify([...collapsed]);
  substepView(source, "p1", true, collapsed);
  visibleItems(source, "p1", true);
  overviewPreview(source, true);
  toggleCollapsedParent(collapsed, "p1");
  assert.equal(JSON.stringify(source), before);
  assert.equal(JSON.stringify([...collapsed]), collapsedBefore);
});

test("toggleCollapsedParent returns a new set and does not mutate its argument", () => {
  const collapsed = new Set(["p1"]);
  const next = toggleCollapsedParent(collapsed, "p2");
  assert.notEqual(next, collapsed);
  assert.deepEqual([...collapsed], ["p1"]);
  assert.deepEqual([...next], ["p1", "p2"]);
});
