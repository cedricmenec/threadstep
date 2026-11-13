import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const styles = read("site/styles.css");
const reactEditor = read("site/project-detail/TaskEditor.jsx");
const vanillaEditor = read("site/app.js");
const tokens = read("site/styles/tokens.css");

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped + "\\{([^}]*)\\}").exec(styles);
  assert.ok(match, "missing style rule " + selector);
  return match[1];
}

test("inline action editor uses a distinct token-based surface", () => {
  const editor = ruleBody(".task-edit-form");

  assert.match(editor, /background:var\(--color-surface-muted\)/);
  assert.match(editor, /border:1px solid var\(--color-border-subtle\)/);
  assert.match(editor, /border-radius:var\(--radius-panel\)/);
  assert.match(editor, /padding:var\(--space-5\)/);
  assert.match(editor, /box-sizing:border-box/);

  for (const token of [
    "--color-surface-muted",
    "--color-border-subtle",
    "--radius-panel",
    "--space-5"
  ]) {
    assert.match(tokens, new RegExp(token.replaceAll("-", "\\-") + "\\s*:"));
  }
});

test("both inline editor render paths keep the shared responsive form class", () => {
  const editor = ruleBody(".task-edit-form");

  assert.match(editor, /display:flex/);
  assert.match(editor, /flex-wrap:wrap/);
  assert.match(editor, /max-width:100%/);
  assert.match(editor, /min-width:0/);
  assert.match(reactEditor, /className="task-edit-form"/);
  assert.match(vanillaEditor, /el\("form",\s*"task-edit-form"\)/);
});
