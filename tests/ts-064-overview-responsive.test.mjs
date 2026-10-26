import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { overviewSourceFiles } from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "site/styles.css"), "utf8");

function ruleBody(selectorPattern) {
  const match = css.match(selectorPattern);
  assert.ok(match, String(selectorPattern));
  return match[0];
}

test("TS-064 the card grid stays fluid and wraps at every expected width", () => {
  const subjects = ruleBody(/\.subjects\{[^}]*\}/);
  assert.match(subjects, /display:grid/);
  assert.match(subjects, /gap:/);
  assert.doesNotMatch(subjects, /overflow-x\s*:/);
  assert.doesNotMatch(subjects, /(?:^|[;{])\s*width\s*:\s*\d+px/);
  assert.match(css, /\.subject\{padding:17px\}/);
  assert.match(css, /@media\(max-width:620px\)\{\.shell\{padding:22px 15px\}/);
  assert.match(css, /@media\(max-width:320px\)\{\.sync-trust-block/);

  const subject = ruleBody(/\.subject\{[^}]*\}/);
  assert.doesNotMatch(subject, /overflow-x\s*:/);
  assert.doesNotMatch(subject, /(?:^|[;{])\s*width\s*:\s*(?:3[3-9]\d|[4-9]\d\d|\d{4,})px/);
  assert.match(ruleBody(/\.subject h3\{[^}]*\}/), /overflow-wrap:anywhere/);
  assert.match(ruleBody(/\.subject-urgency,\.subject-progress\{[^}]*\}/), /overflow-wrap:anywhere/);
  assert.match(ruleBody(/\.subject-total\{[^}]*\}/), /overflow-wrap:anywhere/);
});

test("TS-064 mobile rules keep the form and header from overflowing", () => {
  assert.match(css, /\.subject-head\{flex-wrap:wrap\}/);
  assert.match(css, /\.subject-controls\{flex-wrap:wrap/);
  assert.match(css, /\.task-form\{flex-wrap:wrap\}/);
  assert.match(css, /\.task-form input\{flex-basis:100%\}/);
  assert.match(ruleBody(/\.task-form\{[^}]*\}/), /max-width:100%/);
  assert.match(ruleBody(/\.task-form\{[^}]*\}/), /min-width:0/);
  assert.match(ruleBody(/\.task-form input[^}]*\}/), /min-width:0/);
  assert.match(ruleBody(/\.task-title\{[^}]*\}/), /overflow-wrap:anywhere/);
  assert.doesNotMatch(css, /overflow-x\s*:/);
});

test("TS-064 interactive targets stay at least 44 by 44 px", () => {
  assert.match(ruleBody(/\.subject-open\{[^}]*\}/), /min-height:44px/);
  assert.match(ruleBody(/\.subject-open\{[^}]*\}/), /min-width:44px/);
  assert.match(ruleBody(/\.overview-see-more\{[^}]*\}/), /min-height:44px/);
  assert.match(ruleBody(/\.overview-see-more\{[^}]*\}/), /min-width:44px/);
  assert.match(ruleBody(/\.task-menu-button\{[^}]*\}/), /min-height:44px/);
  assert.match(ruleBody(/\.task-menu-button\{[^}]*\}/), /min-width:44px/);
  assert.match(ruleBody(/\.task-menu-command\{[^}]*\}/), /min-height:44px/);
  assert.match(ruleBody(/\.task-menu-command\{[^}]*\}/), /min-width:44px/);
  assert.match(ruleBody(/\.task-toggle\{[^}]*\}/), /min-height:44px/);
  assert.match(ruleBody(/\.task-handle\{[^}]*\}/), /min-height:44px/);
  assert.match(ruleBody(/\.priority-control\{[^}]*\}/), /min-height:var\(--control-target-min\)/);
  assert.match(ruleBody(/\.subject-move\{[^}]*\}/), /padding:7px 11px/);
});

test("TS-064 the existing focus ring and menu containment still cover the cards", () => {
  assert.match(css, /button:focus-visible[^{]*\{[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
  assert.match(css, /input:focus-visible[^{]*\{[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
  assert.match(ruleBody(/\.task-menu\{[^}]*\}/), /max-width:min\(260px,calc\(100vw - 32px\)\)/);
  assert.doesNotMatch(css, /(?:^|[;{])\s*overflow-x\s*:\s*(?:auto|scroll)/);
});

test("TS-064 the Overview modules add no sidebar or fixed desktop layout", () => {
  const source = overviewSourceFiles().map((entry) => entry.source).join("\n");
  assert.doesNotMatch(source, /sidebar|drawer|grid-template-columns|style=\{\{|width:\s*\d+px|minWidth/);
  assert.match(source, /className="subjects"|className="subject"|className="subject-head"/);
  assert.match(source, /className="subject-controls"/);
  assert.match(source, /className="task-area"/);
  assert.match(source, /className="overview-see-more"/);
  assert.doesNotMatch(source, /<style|dangerouslySetInnerHTML|innerHTML/);
});
