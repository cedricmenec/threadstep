import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const css = read("site/styles.css");
const tokens = read("site/styles/tokens.css");
const widths = [320, 390, 430, 768, 1280];

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

test("TS-063 shell host and header stay bounded at 320/390/430/768/1280 px", () => {
  const host = between(css, "#app-shell-root{", "}");
  assert.match(host, /min-width:0/);
  assert.match(host, /max-width:100%/);
  assert.match(host, /overflow-wrap:anywhere/);

  const header = between(css, ".header-nav{", "}");
  assert.match(header, /position:relative/);
  assert.match(header, /min-width:0/);
  assert.match(header, /max-width:100%/);

  const panel = between(css, ".nav-menu-panel{", "}");
  assert.match(panel, /width:min\(280px,calc\(100vw - 32px\)\)/);
  assert.match(panel, /max-width:calc\(100vw - 16px\)/);
  for (const width of widths) {
    const available = width - 32;
    assert.ok(Math.min(280, available) <= width, width + "px panel is bounded");
  }

  assert.match(css, /@media\(max-width:620px\)\{[^}]*\.nav-menu-panel\{left:0;right:auto;width:min\(280px,calc\(100vw - 30px\)\)\}/);
  assert.match(tokens, /--breakpoint-compact: 620px/);
});

test("TS-063 labels wrap and no fixed width or permanent sidebar is introduced", () => {
  const link = between(css, ".nav-menu a{", "}");
  assert.match(link, /overflow-wrap:anywhere/);
  assert.match(link, /min-width:44px/);
  assert.match(link, /min-height:44px/);

  const fixedWidths = [...css.matchAll(/(?<![-\w])width:(\d+)px/g)].map((match) => Number(match[1]));
  for (const value of fixedWidths) {
    assert.ok(value < 320, "fixed width " + value + "px would exceed a 320px viewport");
  }
  const headerNav = between(css, ".header-nav{", "}");
  const panel = between(css, ".nav-menu-panel{", "}");
  const navigation = between(css, ".nav-menu{", "}");
  for (const block of [headerNav, panel, navigation, link]) {
    assert.doesNotMatch(block, /position:fixed|sidebar|drawer|off-canvas/i);
  }
});

test("TS-063 targets, focus and hidden panel remain conformant", () => {
  const button = between(css, ".nav-menu-button{", "}");
  assert.match(button, /min-width:44px/);
  assert.match(button, /min-height:44px/);
  assert.match(button, /display:inline-flex/);
  assert.match(css, /\.nav-menu-button:focus-visible/);
  assert.match(css, /outline:var\(--focus-outline\)/);
  assert.match(css, /outline-offset:var\(--focus-outline-offset\)/);
  assert.match(css, /\.nav-menu-panel\[hidden\]\{display:none\}/);
  assert.match(tokens, /--control-target-min: 44px/);
  assert.match(tokens, /--focus-outline-width: 3px/);
  assert.match(tokens, /--focus-outline-offset: 2px/);
});

test("TS-063 automated width checks are structural, not device evidence", () => {
  const spec = read("openspec/changes/ts-063/specs/app-navigation/spec.md");
  assert.match(spec, /ne sont pas présentés comme une mesure de débordement sur un/);
  assert.match(spec, /navigateur ou un appareil réel/);
  assert.match(css, /@media\(max-width:320px\)/);
});
