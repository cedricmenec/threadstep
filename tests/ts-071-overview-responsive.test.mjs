import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "site/styles.css"), "utf8");
const component = readFileSync(resolve(root, "site/overview/ProjectCard.jsx"), "utf8");
const task = readFileSync(resolve(root, "site/project-detail/TaskItem.jsx"), "utf8");
const actions = readFileSync(resolve(root, "site/project-detail/TaskActionMenu.jsx"), "utf8");
const start = css.indexOf("/* TS-071 Overview project cards */");
const end = css.indexOf("/* End TS-071 */");
const styles = css.slice(start, end);

test("TS-071 responsive cards wrap content and use the shared accessible controls", () => {
  assert.ok(start >= 0 && end > start, "TS-071 CSS section exists");
  assert.match(styles, /@media\(min-width:768px\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /@media\(max-width:320px\)/);
  assert.match(styles, /@media\(max-width:620px\),\(pointer:coarse\)/);
  assert.match(styles, /overflow-wrap:anywhere/);
  assert.match(styles, /\.dashboard \.overview-project-card \.children\{[^}]*padding-left:20px/);
  assert.match(styles, /\.dashboard \.overview-project-card \.task-check-target\{[^}]*width:var\(--control-target-min\);height:var\(--control-target-min\)/);
  assert.match(styles, /\.dashboard \.overview-project-card \.task-menu-button:focus-visible/);
  assert.match(styles, /\.dashboard \.subject-actions>summary\{[^}]*width:var\(--control-target-min\);height:var\(--control-target-min\)/);
  assert.match(styles, /\.dashboard \.subject-actions-panel button\{[^}]*min-height:var\(--control-target-min\)/);
  assert.match(component, /aria-labelledby=\{titleId\}/);
  assert.match(component, /<summary aria-label=\{/);
  assert.match(task, /className=\{\["task-handle"/);
});

test("TS-071 mobile hides drag handles and preserves task menu move commands", () => {
  assert.match(styles, /@media\(max-width:620px\),\(pointer:coarse\)\{\.dashboard \.overview-project-card \.task-handle\{display:none\}\}/);
  assert.match(task, /<TaskActionMenu/);
  assert.match(actions, /canMoveUp: !hideCompleted && canMoveWithinPriority/);
  assert.match(actions, /canMoveDown: !hideCompleted && canMoveWithinPriority/);
  assert.match(actions, /commands\.runMenuCommand\(subjectId, item\.id, command\.id\)/);
});

test("TS-071 card styles consume defined tokens without adding remote assets or tokens", () => {
  const tokenSource = readFileSync(resolve(root, "site/styles/tokens.css"), "utf8");
  const tokens = new Set([...tokenSource.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
  for (const match of styles.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    assert.ok(tokens.has(match[1]), "undefined token " + match[1]);
  }
  assert.doesNotMatch(styles, /--[a-z0-9-]+\s*:/);
  assert.doesNotMatch(styles, /https?:\/\//);
  assert.doesNotMatch(styles, /@font-face|@import/);
});
