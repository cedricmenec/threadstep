import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRoute, isViewEntry } from "../site/core.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const mvp = readFileSync(new URL("../docs/product/mvp.md", import.meta.url), "utf8");
const guide = readFileSync(new URL("../docs/product/guide-utilisation.md", import.meta.url), "utf8");
const renderItemBody = app.slice(app.indexOf("function renderItem("), app.indexOf("function renderRow("));
const toggleBody = app.slice(app.indexOf("function renderSubstepToggle("), app.indexOf("function renderActions("));
const renderBody = app.slice(app.indexOf("function render() {"), app.indexOf("function navigate("));
const navigateBody = app.slice(app.indexOf("function navigate("), app.indexOf("function renderDetail("));
const hashchangeBody = app.slice(app.indexOf('window.addEventListener("hashchange"'), app.indexOf('snackbarEl.addEventListener'));
const loadBody = app.slice(app.indexOf("function load() {"), app.indexOf("function readResumePreference("));
const importBody = app.slice(app.indexOf('document.querySelector("#import")'), app.indexOf('window.addEventListener("storage"'));

test("the app keeps a transient expanded-parents set defaulting to empty", () => {
  assert.match(app, /let expandedParents = new Set\(\);/);
  assert.doesNotMatch(app, /collapsedParents/);
  assert.doesNotMatch(app, /toggleCollapsedParent/);
});

test("renderItem passes the expanded set to substepView", () => {
  assert.match(renderItemBody, /const view = substepView\(subject\.items, item\.id, hideCompleted, expandedParents\)/);
});

test("the disclosure control toggles the expanded set without persisting", () => {
  assert.match(toggleBody, /expandedParents = toggleExpandedParent\(expandedParents, item\.id\)/);
  assert.doesNotMatch(toggleBody, /persist\(/);
  assert.match(toggleBody, /toggle\.setAttribute\("aria-expanded", view\.collapsed \? "false" : "true"\)/);
  assert.match(toggleBody, /if \(view\.renderChildren\) toggle\.setAttribute\("aria-controls", substepListId\(item\.id\)\)/);
});

test("render applies any pending focus expansion before building the view", () => {
  assert.match(renderBody, /expandAncestorForFocus\\(\\)/);
  assert.match(renderBody, /replaceSubjectsInCurrentView\\(nextSubjects, uxSnapshot\\)/);
});

test("a change of parsed route resets the expanded parents in the hashchange handler", () => {
  assert.match(hashchangeBody, /const nextRoute = parseRoute\(location\.hash\)/);
  assert.match(hashchangeBody, /if \(isViewEntry\(route, nextRoute\)\) expandedParents = new Set\(\)/);
  assert.match(hashchangeBody, /route = nextRoute/);
});

test("load and a successful import reset the expanded parents", () => {
  assert.match(loadBody, /function load\(\) \{\s*\n\s*expandedParents = new Set\(\);/);
  assert.match(importBody, /expandedParents = new Set\(\);/);
});

test("same-route navigation and ordinary re-renders keep the voluntary expansion", () => {
  assert.doesNotMatch(navigateBody, /expandedParents/);
  assert.doesNotMatch(renderBody, /expandedParents = new Set\(\)/);
});

test("a pending focus or reveal expands its ancestor before rendering", () => {
  const revealBody = app.slice(app.indexOf("function expandAncestorForFocus("), app.indexOf("function render() {"));
  assert.match(revealBody, /substepAncestorId\(subject\.items, focusItemId\)/);
  assert.match(revealBody, /expandedParents = toggleExpandedParent\(expandedParents, ancestorId\)/);
  assert.doesNotMatch(revealBody, /persist\(/);
});

test("the app never interpolates untrusted strings with innerHTML", () => {
  assert.doesNotMatch(app, /\.innerHTML/);
});

test("isViewEntry follows the parsed route transitions used by the hashchange handler", () => {
  assert.equal(isViewEntry(parseRoute("#/"), parseRoute("")), false);
  assert.equal(isViewEntry(parseRoute("#/"), parseRoute("#/")), false);
  assert.equal(isViewEntry(parseRoute("#/"), parseRoute("#/sujet/s1")), true);
  assert.equal(isViewEntry(parseRoute("#/sujet/s1"), parseRoute("#/")), true);
  assert.equal(isViewEntry(parseRoute("#/sujet/s1"), parseRoute("#/sujet/s2")), true);
  assert.equal(isViewEntry(parseRoute("#/sujet/s1"), parseRoute("#/sujet/s1")), false);
  assert.equal(isViewEntry(parseRoute("#/sujet"), parseRoute("#/sujet/")), false);
});

test("the product documentation states the collapsed default and drops the expanded default", () => {
  assert.match(mvp, /starts collapsed at document load/);
  assert.match(mvp, /starts collapsed at load, on a direct detail entry and on every entry into a view/);
  assert.doesNotMatch(mvp, /starts expanded after a reload/);
  assert.doesNotMatch(mvp, /starts expanded after reload/);
  assert.match(guide, /les sous-tâches sont repliées/);
  assert.match(guide, /chaque entrée dans une vue/);
  assert.doesNotMatch(guide, /repartent avec toutes les actions dépliées/);
});
