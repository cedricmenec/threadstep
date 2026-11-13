import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");

test("TS-070 Overview exposes one labelled select with the four existing project modes", () => {
  const document = new JSDOM(html).window.document;
  const filter = document.querySelector("#overview-urgency-filter");
  const select = document.querySelector("#overview-filter-select");

  assert.ok(filter);
  assert.ok(select);
  assert.equal(select.labels.length, 1);
  assert.equal(select.labels[0].textContent.trim(), "Filtrer les projets");
  assert.equal(select.value, "all");
  assert.deepEqual([...select.options].map((option) => [option.value, option.textContent]), [
    ["all", "Tous les projets"],
    ["urgent", "Projets avec urgences"],
    ["following", "Projets à suivre"],
    ["completed", "Projets terminés"]
  ]);
  assert.equal(filter.querySelectorAll("input[type=radio]").length, 0);
  assert.ok(filter.compareDocumentPosition(document.querySelector("#subjects")) & 4);
});

test("TS-070 filter control uses a compact responsive row and existing design tokens", () => {
  assert.match(css, /\.overview-urgency-filter\{display:grid;grid-template-columns:auto minmax\(0,1fr\)/);
  assert.match(css, /\.overview-urgency-filter select\{[^}]*min-width:0[^}]*min-height:var\(--control-target-min\)/);
  assert.match(css, /\.overview-urgency-filter select\{[^}]*border-radius:var\(--radius-control\)/);
  assert.match(css, /\.overview-urgency-filter select\{[^}]*text-overflow:ellipsis/);
  assert.match(css, /button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible[^{}]*\{outline:var\(--focus-outline\)/);
  assert.match(css, /\.dashboard \.overview-urgency-filter\{grid-template-columns:auto minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /\.overview-urgency-filter \.filter-option/);
});

test("TS-070 the existing transient filter state drives and resynchronizes the select", () => {
  const synchronization = app.slice(
    app.indexOf("function syncOverviewFilterControl()"),
    app.indexOf("function setOverviewProjectFilter(")
  );
  const handlers = app.slice(
    app.indexOf("if (overviewFilterSelectEl) {"),
    app.indexOf('document.addEventListener("keydown"')
  );

  assert.match(app, /const overviewFilterSelectEl = document\.querySelector\("#overview-filter-select"\)/);
  assert.match(synchronization, /overviewFilterSelectEl\.value !== value/);
  assert.match(synchronization, /overviewFilterSelectEl\.value = value/);
  assert.match(handlers, /overviewFilterSelectEl\.addEventListener\("change"/);
  assert.match(handlers, /setOverviewProjectFilter\(overviewFilterSelectEl\.value\)/);
  assert.doesNotMatch(handlers, /location|history|localStorage|sessionStorage|persist\(/);

  let changeHandler;
  let selectedMode;
  const context = {
    overviewFilterSelectEl: {
      value: "following",
      addEventListener(event, listener) {
        if (event === "change") changeHandler = listener;
      }
    },
    setOverviewProjectFilter(value) { selectedMode = value; }
  };
  runInNewContext(handlers, context);
  changeHandler();
  assert.equal(selectedMode, "following");
});
