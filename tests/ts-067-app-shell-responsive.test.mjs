import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAV_MENU_ENTRIES } from "../site/core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const css = read("site/styles.css");
const html = read("site/index.html");
const tokens = read("site/styles/tokens.css");
const packageJson = JSON.parse(read("package.json"));
const widths = [320, 390, 430, 768, 1280];

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped + "\\{([^}]*)\\}").exec(source);
  assert.ok(match, "missing rule " + selector);
  return match[1];
}

const desktop = /@media\(min-width:1024px\)\{([\s\S]*?)\n\/\* End TS-067 \*\//.exec(css);

test("TS-067 documents a local 1024px breakpoint and the two approved layouts", () => {
  assert.match(css, /\/\* TS-067 \| Shell responsive[\s\S]*?1024px[\s\S]*?media query[\s\S]*?\*\//);
  assert.ok(desktop, "desktop media query is delimited");
  const body = desktop[1];
  assert.match(body, /\.shell\{display:grid;grid-template-columns:208px minmax\(0,var\(--content-max-width\)\);column-gap:24px;max-width:calc\(var\(--content-max-width\) \+ 232px\);align-items:start\}/);
  assert.match(body, /\.shell>#app-shell-root\{grid-column:1;min-width:0;max-width:100%\}/);
  assert.match(body, /\.shell>#app-shell-root\{align-self:stretch\}/);
  assert.match(body, /\.shell>\*:not\(#app-shell-root\)\{grid-column:2;min-width:0;max-width:100%\}/);
  assert.match(body, /\.header-nav\{position:sticky;top:24px;margin-top:0\}/);
  assert.match(body, /\.nav-menu-button\{display:none\}/);
  assert.match(body, /\.nav-menu-panel\{position:static;top:auto;left:auto;width:auto;max-width:100%;background:transparent;border:0;box-shadow:none;padding:0\}/);
  assert.match(body, /\.nav-menu-panel\[data-open="false"\]\{display:block\}/);
  assert.match(css, /@media\(max-width:620px\)\{[^}]*\.nav-menu-panel\{left:0;right:auto;width:min\(280px,calc\(100vw - 30px\)\)\}/);
});

test("TS-067 compact panel stays bounded at 320/390/430/768/1280 px", () => {
  const panel = ruleBody(css, ".nav-menu-panel");
  assert.match(panel, /width:min\(280px,calc\(100vw - 32px\)\)/);
  assert.match(panel, /max-width:calc\(100vw - 16px\)/);
  for (const width of widths) {
    const available = width - 32;
    assert.ok(Math.min(280, available) <= width, width + "px panel is bounded");
  }
  assert.doesNotMatch(css, /overflow-x\s*:/);
  const navBlocks = [
    ruleBody(css, ".header-nav"),
    ruleBody(css, ".nav-menu-panel"),
    ruleBody(css, ".nav-menu"),
    ruleBody(css, ".nav-menu a")
  ];
  for (const block of navBlocks) {
    assert.doesNotMatch(block, /position:fixed|off-canvas/i);
    for (const match of block.matchAll(/(?<![-\w])width:(\d+)px/g)) {
      assert.ok(Number(match[1]) < 320, "fixed width " + match[1] + "px exceeds a 320px viewport");
    }
  }
});

test("TS-067 active destination and focus styles reuse tokens with a non-colour cue", () => {
  const active = ruleBody(css, '.nav-menu a[aria-current="page"]');
  assert.match(active, /background:var\(--color-surface-muted\)/);
  assert.match(active, /color:var\(--color-action\)/);
  assert.match(active, /font-weight:var\(--font-weight-bold\)/);
  assert.match(active, /box-shadow:inset 3px 0 0 var\(--color-action\)/);

  const button = ruleBody(css, ".nav-menu-button");
  const link = ruleBody(css, ".nav-menu a");
  for (const block of [button, link]) {
    assert.match(block, /min-width:44px/);
    assert.match(block, /min-height:44px/);
  }
  assert.match(css, /\.nav-menu-button:focus-visible[^{]*\{[^}]*outline:var\(--focus-outline\)/);
  assert.match(css, /\.nav-menu-panel\[data-open="false"\]\{display:none\}/);
  assert.match(tokens, /--control-target-min: 44px/);
  assert.match(tokens, /--focus-outline: var\(--focus-outline-width\) solid var\(--color-focus\)/);
});

test("TS-067 tokens, CSP, dependencies and remote assets stay unchanged", () => {
  assert.equal(
    createHash("sha256").update(tokens).digest("hex"),
    "19500fecc96a4ca460ea29970fb960c1f5edc25973f377acf6b37dd24af6d2ef",
    "site/styles/tokens.css values changed"
  );
  assert.equal((css.match(/--[a-z0-9-]+\s*:/g) || []).length, 0, "no new CSS token is introduced");
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
    "dexie",
    "dexie-cloud-addon",
    "react",
    "react-dom"
  ]);
  assert.deepEqual(packageJson.devDependencies, {
    esbuild: "0.25.10",
    jsdom: "30.1.3",
    vite: "7.3.7"
  });
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.ok(csp);
  assert.equal(
    csp[1],
    "default-src 'self'; connect-src https://*.dexie.cloud wss://*.dexie.cloud; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
  );
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
  const withoutSvgNamespace = css.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, "");
  assert.doesNotMatch(withoutSvgNamespace, /https?:\/\//);
  assert.doesNotMatch(css, /@font-face|fonts\.googleapis|cdn\.|unpkg|jsdelivr|tailwind/i);
});

test("TS-067 keeps TS-066 Overview composition, classes and reading order untouched", () => {
  const startMarker = "/* TS-066 Overview presentation */";
  const endMarker = "/* End TS-066 */";
  const overviewCss = css.slice(css.indexOf(startMarker), css.indexOf(endMarker) + endMarker.length);
  assert.equal(
    createHash("sha256").update(overviewCss).digest("hex"),
    "ff18aa8fdb506e2ce4c701c82898258f85a37abf590e61e862ecfd6acb5ee61e",
    "TS-066 presentation block changed"
  );
  assert.equal((css.match(/TS-066 Overview presentation/g) || []).length, 1);
  for (const marker of [
    ".dashboard .subject",
    ".dashboard>.section-top",
    ".dashboard .task-form",
    ".dashboard .task-title",
    ".dashboard .overview-see-more",
    ".dashboard .overview-urgency-filter",
    ".overview-see-more:focus-visible",
    ".dashboard .task.done>.task-row .task-title"
  ]) {
    assert.ok(overviewCss.includes(marker), marker);
  }
  const interactionSource = [
    read("site/overview/ProjectCard.jsx"),
    read("site/overview/OverviewTaskList.jsx"),
    read("site/project-detail/TaskItem.jsx"),
    read("site/ui/PriorityControl.jsx"),
    html
  ].join("\n");
  for (const marker of ["subject-open", "overview-see-more", "task-check", "priority-control", "task-toggle", "task-handle"]) {
    assert.match(interactionSource, new RegExp(marker), marker);
  }
  assert.ok(
    html.indexOf('id="resume-card"') < html.indexOf('id="dashboard-title"')
    && html.indexOf('id="dashboard-title"') < html.indexOf('id="focus-suggest"')
    && html.indexOf('id="focus-suggest"') < html.indexOf('id="overview-urgencies"')
    && html.indexOf('id="overview-urgencies"') < html.indexOf('id="subject-form"')
    && html.indexOf('id="subject-form"') < html.indexOf('id="overview-urgency-filter"')
    && html.indexOf('id="overview-urgency-filter"') < html.indexOf('id="projects-loading"')
    && html.indexOf('id="projects-loading"') < html.indexOf('id="subjects"'),
    "Overview reading order changed"
  );
  assert.equal(NAV_MENU_ENTRIES.length, 4);
});
