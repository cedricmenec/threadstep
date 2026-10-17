import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");

test("the inline editor offers a labelled multiline note control", () => {
  assert.match(app, /el\("textarea", "task-edit-note"\)/);
  assert.match(app, /"Note \(facultative\)"/);
  assert.match(app, /noteInput\.maxLength = 2000;/);
  assert.match(app, /noteInput\.setAttribute\("aria-label", "Note \(facultative\) de l'étape " \+ item\.title\)/);
});

test("the editor prefills the existing note or an empty string", () => {
  assert.match(app, /noteInput\.value = typeof item\.note === "string" \? item\.note : "";/);
});

test("the note length is validated through the existing accessible error", () => {
  assert.match(app, /if \(noteInput\.value\.length > 2000\) \{[\s\S]*?error\.textContent = "La note doit contenir au plus 2000 caractères\.";[\s\S]*?error\.hidden = false;[\s\S]*?noteInput\.focus\(\);[\s\S]*?return;/);
  assert.match(app, /error\.setAttribute\("role", "alert"\)/);
});

test("the editor saves title, priority and note together through updateItem", () => {
  assert.match(app, /updateItem\(documentState, subject\.id, item\.id, \{ title: titleInput\.value, priority: select\.value, note: noteInput\.value \}\)/);
});

test("the editor keeps the unchanged-reference short circuit so an identical save writes nothing", () => {
  assert.match(app, /if \(next === documentState\) \{ render\(\); return; \}/);
  const shortCircuits = app.match(/if \(next === documentState\) \{ render\(\); return; \}/g) || [];
  assert.ok(shortCircuits.length >= 2);
});

test("renderItem displays a non-empty note between the row and the actions", () => {
  assert.match(app, /li\.append\(renderRow\(subject, item\)\);\s*\n\s*if \(typeof item\.note === "string" && item\.note\.trim\(\)\.length > 0\) li\.append\(renderNote\(item\)\);\s*\n\s*li\.append\(renderActions\(subject, item, view\)\);/);
});

test("the note is rendered as a plain text node without innerHTML", () => {
  assert.match(app, /function renderNote\(item\) \{\s*\n\s*return el\("p", "task-note", item\.note\);\s*\n\}/);
  assert.doesNotMatch(app, /\.innerHTML/);
});

test("the .task-note style preserves line breaks and wraps on mobile", () => {
  assert.match(styles, /\.task-note\{[^}]*white-space:pre-wrap/);
  assert.match(styles, /\.task-note\{[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(styles, /\.task-note\{[^}]*colour/);
});

test("the note textarea exposes a visible focus style", () => {
  assert.match(styles, /textarea:focus-visible[^{]*\{[^}]*outline:3px solid/);
  assert.match(styles, /\.task-edit-note\{[^}]*white-space:pre-wrap/);
});
