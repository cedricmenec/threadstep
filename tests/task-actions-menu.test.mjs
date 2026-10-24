import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyDocument, newSubject, newItem, pendingCount, totalTaskCount, nextActionSuggestion,
  serializeResumePreference, resumeView, planRemoval, restoreRemoval, reorderWithinPriority,
  promoteItemToTopLevel, parseDocument, itemMenuCommands
} from "../site/core.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const core = readFileSync(new URL("../site/core.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const mvp = readFileSync(new URL("../docs/product/mvp.md", import.meta.url), "utf8");
const guide = readFileSync(new URL("../docs/product/guide-utilisation.md", import.meta.url), "utf8");

const renderActionsBody = app.slice(app.indexOf("function renderActions("), app.indexOf("function menuPanelId("));
const renderRowBody = app.slice(app.indexOf("function renderRow("), app.indexOf("function renderNote("));
const menuButtonBody = app.slice(app.indexOf("function renderItemMenu("), app.indexOf("function toggleItemMenu("));
const toggleBody = app.slice(app.indexOf("function toggleItemMenu("), app.indexOf("function runMenuCommand("));
const menuPanelBody = app.slice(app.indexOf("function renderMenuPanel("), app.indexOf("function renderItemMenu("));
const runMenuBody = app.slice(app.indexOf("function runMenuCommand("), app.indexOf("function renderEditor("));
const keydownBody = app.slice(app.indexOf('document.addEventListener("keydown"'), app.indexOf('document.addEventListener("click"'));
const outsideBody = app.slice(app.indexOf('document.addEventListener("click"'), app.indexOf('window.addEventListener("pointermove"'));
const hashchangeBody = app.slice(app.indexOf('window.addEventListener("hashchange"'), app.indexOf("snackbarEl.addEventListener"));
const menuModelBody = core.slice(core.indexOf("export function itemMenuCommands("), core.indexOf("function promotionTarget("));

test("renderActions keeps the primary controls and drops the inline secondary commands", () => {
  assert.match(renderActionsBody, /renderDragHandle\(subject, item\)/);
  assert.match(renderActionsBody, /renderSubstepToggle\(item, view\)/);
  assert.match(renderActionsBody, /renderItemMenu\(subject, item\)/);
  assert.doesNotMatch(renderActionsBody, /task-move-up|task-move-down|task-reorder/);
  assert.doesNotMatch(renderActionsBody, /"Modifier"|"Retirer"|"\+ Sous-étape"|"Garder le fil"|"Promouvoir en tâche principale"/);
});

test("the row keeps the completion checkbox, title and priority control", () => {
  assert.match(renderRowBody, /"task-check"/);
  assert.match(renderRowBody, /"task-title"/);
  assert.match(renderRowBody, /priority-control/);
});

test("the menu button is a native labelled disclosure with a 44 × 44 px target", () => {
  assert.match(app, /el\("button", "subtle task-menu-button", "⋮"\)/);
  assert.match(menuButtonBody, /button\.type = "button"/);
  assert.match(menuButtonBody, /"Actions pour " \+ item\.title/);
  assert.match(menuButtonBody, /"aria-expanded", open \? "true" : "false"/);
  assert.match(menuButtonBody, /"aria-controls", menuPanelId\(item\.id\)/);
  assert.match(styles, /\.task-menu-button\{[^}]*min-width:44px[^}]*min-height:44px/);
});

test("the open panel renders exactly the commands from itemMenuCommands", () => {
  assert.match(menuPanelBody, /const commands = itemMenuCommands\(item, \{/);
  assert.match(menuPanelBody, /tracked,/);
  assert.match(menuPanelBody, /canMoveUp: !hideCompleted && canMoveWithinPriority\(subject\.items, item\.id, "up"\)/);
  assert.match(menuPanelBody, /canMoveDown: !hideCompleted && canMoveWithinPriority\(subject\.items, item\.id, "down"\)/);
  assert.match(menuPanelBody, /for \(const command of commands\) panel\.append\(renderMenuCommand\(subject, item, command\)\)/);
  assert.match(app, /button\.disabled = command\.disabled === true;/);
});

test("every menu command reuses the existing handlers without duplicating domain logic", () => {
  assert.match(runMenuBody, /editingItemId = item\.id;/);
  assert.match(runMenuBody, /retirerAction\(subject, item\)/);
  assert.match(runMenuBody, /newItem\(title, "normal", crypto\.randomUUID\(\), item\.id\)/);
  assert.match(runMenuBody, /promoteItemToTopLevel\(documentState, subject\.id, item\.id\)/);
  assert.match(runMenuBody, /saveResumePreference\(resumeRef\)/);
  assert.match(runMenuBody, /moveItem\(subject, item, "up"\)/);
  assert.match(runMenuBody, /moveItem\(subject, item, "down"\)/);
  assert.doesNotMatch(runMenuBody, /\.splice\(/);
  assert.doesNotMatch(runMenuBody, /parentId\s*=/);
});

test("itemMenuCommands stays a pure model and core.js gains no mutation path", () => {
  assert.match(core, /export function itemMenuCommands\(item, options = \{\}\) \{/);
  assert.doesNotMatch(menuModelBody, /documentState|localStorage|persist\(|\.splice\(/);
  const item = newItem("Parent", "normal", "p1");
  const snapshot = JSON.stringify(item);
  itemMenuCommands(item, { tracked: true, canMoveUp: true, canMoveDown: true });
  assert.equal(JSON.stringify(item), snapshot);
});

test("one open menu is tracked by openMenuId without a storage write or a drag", () => {
  assert.match(app, /let openMenuId = null;/);
  assert.match(toggleBody, /openMenuId === itemId/);
  assert.match(toggleBody, /openMenuId = itemId/);
  assert.match(toggleBody, /openMenuId = null/);
  assert.match(toggleBody, /pendingMenuFocus = itemId/);
  assert.doesNotMatch(toggleBody, /persist\(/);
  assert.doesNotMatch(toggleBody, /dragState|startDrag/);
});

test("Escape closes the open menu and returns focus to its button", () => {
  assert.match(keydownBody, /if \(event\.key === "Escape" && openMenuId\)/);
  assert.match(keydownBody, /pendingMenuFocus = openMenuId/);
  assert.match(keydownBody, /openMenuId = null/);
  assert.match(app, /if \(pendingMenuFocus\) \{[\s\S]*?querySelector\("\.task-menu-button"\)/);
});

test("an outside click closes the open menu", () => {
  assert.match(outsideBody, /document\.addEventListener\("click"/);
  assert.match(outsideBody, /target\.closest\("\.task-menu"\)/);
  assert.match(outsideBody, /target\.closest\("\.task-menu-button"\)/);
  assert.match(outsideBody, /openMenuId = null/);
});

test("a view change, a load and a successful import reset the open menu", () => {
  assert.match(hashchangeBody, /openMenuId = null/);
  assert.match(app, /function load\(\) \{[\s\S]*?openMenuId = null;/);
  assert.match(app, /resetExpandedViewState\(\);\s*\n\s*openMenuId = null;/);
});

test("the app never interpolates untrusted strings with innerHTML", () => {
  assert.doesNotMatch(app, /\.innerHTML/);
  assert.match(app, /function el\(tag, cls, text\) \{[\s\S]*?node\.textContent = text;/);
});

test("compact rows preserve hierarchy cues, notes, touch targets, focus and reduced motion", () => {
  assert.match(styles, /\.task\{[^}]*padding:7px 0 0[^}]*margin-top:7px/);
  assert.match(styles, /\.task-parent\{[^}]*margin-top:10px/);
  assert.match(styles, /\.children \.task\{[^}]*margin-top:3px[^}]*padding-top:6px/);
  assert.match(styles, /\.children\{[^}]*padding-left:26px[^}]*border-left:/);
  assert.match(styles, /\.task-substep>\.task-row \.task-title\{[^}]*font-size:/);
  assert.match(styles, /\.task-parent>\.task-row \.task-title\{[^}]*font-weight:700/);
  assert.match(styles, /\.task-note\{[^}]*white-space:pre-wrap/);
  assert.match(styles, /\.task-note\{[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /\.task-menu-command\{[^}]*min-width:(?:44px|var\(--control-target-min\))[^}]*min-height:(?:44px|var\(--control-target-min\))/);
  assert.match(styles, /\.priority-control\{[^}]*min-height:(?:44px|var\(--control-target-min\))[^}]*min-width:(?:44px|var\(--control-target-min\))/);
  assert.match(styles, /\.task-handle\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(styles, /button:focus-visible[^{]*\{[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
  assert.match(styles, /@media\(prefers-reduced-motion:no-preference\)\{\.task-menu/);
  assert.match(styles, /\.task-menu\{[^}]*max-width:min\(260px,calc\(100vw - 32px\)\)/);
});

test("the product documentation describes the compact menu and drops the inline wording", () => {
  assert.match(mvp, /FR-24/);
  assert.match(mvp, /menu « ⋮ »/);
  assert.doesNotMatch(mvp, /\*\*TS-023\*\* : densifier/);
  assert.match(guide, /menu d'actions « ⋮ »/);
  assert.match(guide, /« Actions pour/);
  assert.match(guide, /ouvrir le menu \*\*« ⋮ »\*\* de l'action/);
  assert.match(guide, /ouvrir le menu \*\*« ⋮ »\*\* de la sous-étape/);
  assert.doesNotMatch(guide, /à côté de l'action/);
  assert.doesNotMatch(guide, /à côté de la sous-étape/);
});

test("counters, suggestion, tracking, promotion, ordering, notes, undo and export are unchanged", () => {
  const doc = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("Parent", "urgent", "p1"));
  subject.items[0].note = "Note\nligne deux";
  subject.items.push(newItem("Enfant", "normal", "c1", "p1"));
  subject.items.push(newItem("Autre", "urgent", "p2"));
  doc.subjects.push(subject);

  assert.equal(pendingCount(doc), 3);
  assert.equal(totalTaskCount(subject.items), 2);
  assert.equal(nextActionSuggestion(doc).itemId, "p1");

  const ref = { subjectId: "s1", itemId: "p1" };
  assert.equal(serializeResumePreference(ref), JSON.stringify(ref));
  assert.equal(resumeView(doc, ref).itemId, "p1");

  const promoted = promoteItemToTopLevel(doc, "s1", "c1");
  assert.equal(totalTaskCount(promoted.subjects[0].items), 3);
  assert.equal(pendingCount(promoted), 3);
  assert.equal(promoted.subjects[0].items.find((entry) => entry.id === "p1").note, "Note\nligne deux");

  const reordered = reorderWithinPriority(promoted.subjects[0].items, "p2", "p1", "before");
  assert.notEqual(reordered, promoted.subjects[0].items);
  assert.equal(reordered.find((entry) => entry.id === "c1").parentId, null);

  const { document: removed, removal } = planRemoval(promoted, "s1", "p1");
  assert.equal(removal !== null, true);
  assert.equal(removed.subjects[0].items.some((entry) => entry.id === "p1"), false);
  const restored = restoreRemoval(removed, removal);
  assert.equal(restored.subjects[0].items.some((entry) => entry.id === "p1"), true);

  assert.deepEqual(parseDocument(JSON.stringify(restored)), restored);
});

test("itemMenuCommands exposes the applicable commands for parent and substep", () => {
  const parent = itemMenuCommands(newItem("Parent", "normal", "p1"));
  assert.deepEqual(parent.map((command) => command.id), ["edit", "remove", "add-substep", "keep-track", "move-up", "move-down"]);
  const substep = itemMenuCommands(newItem("Enfant", "normal", "c1", "p1"));
  assert.deepEqual(substep.map((command) => command.id), ["edit", "remove", "promote", "move-up", "move-down"]);
});
