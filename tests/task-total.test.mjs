import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const projectCard = readFileSync(new URL("../site/overview/ProjectCard.jsx", import.meta.url), "utf8");
const overviewAdapter = readFileSync(new URL("../site/overview/overview-adapter.js", import.meta.url), "utf8");

test("the overview card header renders the total from the subject items", () => {
  assert.match(app, /titleBox\.append\(el\("p", "small subject-total", totalTaskCountLabel\(totalTaskCount\(subject\.items\)\)\)\)/);
});

test("renderSubject and renderDetailHead both show the total line", () => {
  const calls = app.match(/small subject-total", totalTaskCountLabel\(totalTaskCount\(subject\.items\)\)/g) || [];
  assert.equal(calls.length, 2);
  assert.match(app, /function renderSubject\(subject\) \{[\s\S]*?subject-total[\s\S]*?\n\}/);
  assert.match(app, /function renderDetailHead\(subject\) \{[\s\S]*?subject-total[\s\S]*?\n\}/);
});

test("the pending counter wording is untouched and still appears twice", () => {
  const pendingLines = app.match(/pending \+ " \u00e9tape" \+ \(pending > 1 \? "s" : ""\) \+ " en attente"/g) || [];
  assert.equal(pendingLines.length, 2);
});

test("the total label is built as a text node with el() and no innerHTML is used", () => {
  assert.match(app, /function el\(tag, cls, text\) \{[\s\S]*?node\.textContent = text;/);
  assert.doesNotMatch(app, /\.innerHTML/);
});

test("the .subject-total style wraps in narrow headers without colour-only signalling", () => {
  assert.match(styles, /\.subject-total\{[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(styles, /\.subject-total\{[^}]*animation/);
});

test("the React Overview card and adapter keep the same total line without duplicating pending steps", () => {
  assert.match(projectCard, /className="small subject-total">\{project\.totalTaskCountLabel\}/);
  assert.match(overviewAdapter, /totalTaskCountLabel\(topLevelCount\)/);
  assert.doesNotMatch(projectCard, /innerHTML|dangerouslySetInnerHTML/);
});
