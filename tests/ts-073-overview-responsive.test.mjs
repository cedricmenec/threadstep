import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "site/styles.css"), "utf8");
const component = readFileSync(resolve(root, "site/overview/ProjectCard.jsx"), "utf8");
const html = readFileSync(resolve(root, "site/index.html"), "utf8");
const start = css.indexOf("/* TS-073: keep Overview focused on the project list. */");
const styles = css.slice(start);

test("TS-073 project cards show their title, two counts and project-open control", () => {
  assert.ok(start >= 0, "TS-073 CSS section exists");
  assert.ok(styles.includes(".dashboard .overview-project-card .task-area,.dashboard .overview-project-card .subject-actions,"));
  assert.ok(styles.includes(".dashboard .overview-project-card .overview-create{display:none!important}"));
  assert.ok(styles.includes(".dashboard .overview-project-card .project-metrics li:first-child,"));
  assert.ok(styles.includes(".dashboard .overview-project-card .project-metrics li:last-child{display:none!important}"));
  assert.match(component, /className="subject overview-project-card"/);
  assert.match(component, /aria-label=\{"Ouvrir le projet " \+ project\.title\}/);
  assert.match(component, /onClick=\{\(\) => commands\.openProject\(project\.id\)\}/);
  assert.match(styles, /\.overview-project-card \.subject-open\{position:absolute;inset:0;z-index:1/);
  assert.match(styles, /\.subject-open:focus-visible/);
  assert.match(styles, /\.dashboard \.overview-project-card:focus-visible\{outline:var\(--focus-outline\)/);
  assert.match(styles, /overflow-wrap:anywhere/);
  assert.match(styles, /@media\(min-width:768px\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
});

test("TS-073 hides global Overview panels and project filters", () => {
  for (const snippet of [
    ".dashboard #resume-card,.dashboard #counter,.dashboard .focus-bar,\n.dashboard #overview-urgencies,.dashboard .filter-toggle,\n.dashboard #reorder-note,.dashboard #overview-urgency-filter{display:none!important}"
  ]) assert.ok(styles.includes(snippet), "missing hidden Overview selector: " + snippet);
  assert.match(html, /<h2 id="dashboard-title">Mes projets<\/h2>/);
  assert.match(html, /id="subject-form"/);
  const tokenSource = readFileSync(resolve(root, "site/styles/tokens.css"), "utf8");
  const tokens = new Set([...tokenSource.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
  for (const match of styles.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    assert.ok(tokens.has(match[1]), "undefined token " + match[1]);
  }
  assert.doesNotMatch(styles, /--[a-z0-9-]+\s*:/);
  assert.doesNotMatch(styles, /https?:\/\/|@font-face|@import/);
});
