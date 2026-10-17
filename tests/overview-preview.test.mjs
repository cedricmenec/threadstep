import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");

test("the overview preview option defaults to unlimited rendering", () => {
  assert.match(app, /function renderTaskArea\(subject, \{ preview = false \} = \{\}\)/);
});

test("the overview enables the preview exactly once and its detail view stays unlimited", () => {
  const previewCalls = app.match(/\{ preview: true \}/g) || [];
  assert.equal(previewCalls.length, 1);
  assert.match(app, /card\.append\(renderTaskArea\(subject, \{ preview: true \}\)\)/);
  assert.match(app, /card\.append\(renderTaskArea\(subject\)\)/);
});

test("exactly one « Voir plus » control opens the existing detail route", () => {
  const controls = app.match(/overview-see-more/g) || [];
  assert.equal(controls.length, 1);
  assert.match(app, /"Voir plus"/);
  assert.match(app, /"Voir plus de tâches pour le projet " \+ subject\.title/);
  assert.match(app, /control\.addEventListener\("click", \(\) => openSubject\(subject\)\)/);
});

test("the reveal shortcut navigates to the detail route when the target is beyond the preview", () => {
  assert.match(app, /isWithinOverviewPreview\(subject\.items, itemId, hideCompleted\)/);
  assert.match(app, /renamingSubject = false;\s*\n\s*focusDetailHeading = false;\s*\n\s*navigate\(subjectRoute\(subject\.id\)\)/);
  assert.match(app, /function revealSuggestion\(suggestion\) \{\s*\n\s*revealAction\(suggestion\.subjectId, suggestion\.itemId\)/);
  assert.match(app, /function revealResume\(view\) \{\s*\n\s*revealAction\(view\.subjectId, view\.itemId\)/);
});

test("the « Voir plus » control offers a 44 × 44 px touch target", () => {
  assert.match(styles, /\.overview-see-more\{[^}]*min-height:44px/);
  assert.match(styles, /\.overview-see-more\{[^}]*min-width:44px/);
});

test("the existing focus-visible outline still covers the new control", () => {
  assert.match(styles, /button:focus-visible[^{]*\{[^}]*outline:3px solid/);
});
