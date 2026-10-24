import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const primitiveFiles = [
  "site/ui/Button.jsx",
  "site/ui/PriorityControl.jsx",
  "site/ui/TextField.jsx",
  "site/ui/priority-options.js"
];

let compiled = null;

async function compilePrimitives() {
  if (compiled) return compiled;
  const cacheRoot = resolve(root, "node_modules", ".cache");
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(join(cacheRoot, "ts061-ui-"));
  const entry = resolve(directory, "entry.jsx");
  const outfile = resolve(directory, "entry.mjs");
  const contents = `
    export { Button } from ${JSON.stringify(resolve(root, "site/ui/Button.jsx"))};
    export { PriorityControl } from ${JSON.stringify(resolve(root, "site/ui/PriorityControl.jsx"))};
    export { TextField } from ${JSON.stringify(resolve(root, "site/ui/TextField.jsx"))};
    export { PRIORITY_LABELS, PRIORITY_VALUES } from ${JSON.stringify(resolve(root, "site/ui/priority-options.js"))};
  `;
  try {
    await import("node:fs").then(({ writeFileSync }) => writeFileSync(entry, contents));
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      jsxImportSource: "react",
      external: ["react", "react/jsx-runtime"],
      logLevel: "silent"
    });
    compiled = await import(pathToFileURL(outfile).href + "?ts061=" + Date.now());
    return compiled;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://threadstep.test/threadstep/",
    pretendToBeVisual: true
  });
  const keys = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent"];
  const previous = new Map();
  for (const key of keys) {
    if (!(key in dom.window)) continue;
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  }
  previous.set("IS_REACT_ACT_ENVIRONMENT", Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"));
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true });
  return {
    dom,
    document: dom.window.document,
    cleanup() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      dom.window.close();
    }
  };
}

async function loadReact() {
  const React = await import("react");
  return {
    React,
    utils: { h: React.createElement }
  };
}

async function render(element) {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(element);
  });
  return {
    container,
    async rerender(next) {
      await React.act(async () => {
        root.render(next);
      });
    },
    async unmount() {
      await React.act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };
}

test("TS-061 primitives are presentation-only and free of business imports", () => {
  for (const file of primitiveFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /\bDexie\b|indexedDB|dexie-cloud|\bOTP\b|authentication\.js/, file);
    assert.doesNotMatch(source, /\bpersist\s*\(|from\s+["'][^"']*app\.js["']/, file);
    assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|WebSocket|location\.hash/, file);
    assert.doesNotMatch(source, /createStore|useReducer|Provider/, file);
  }
  const options = read("site/ui/priority-options.js");
  assert.match(options, /import \{ PRIORITIES \} from "\.\.\/core\.js";/);
  assert.match(options, /urgent: "Urgent"/);
  assert.match(options, /normal: "Normal"/);
  assert.match(options, /later: "Plus tard"/);
});

test("TS-061 Button exposes variants, caller classes, type, ARIA and one callback", async () => {
  const dom = installDom();
  try {
    const { Button } = await compilePrimitives();
    for (const variant of ["primary", "secondary", "subtle", "danger"]) {
      const { utils } = await loadReact();
    const fixture = await render(utils.h(Button, { variant }, "Libellé"));
      const buttons = fixture.container.querySelectorAll("button");
      assert.equal(buttons.length, 1);
      assert.equal(fixture.container.children.length, 1);
      assert.equal(buttons[0].className, variant);
      await fixture.unmount();
    }

    const { utils } = await loadReact();
    let calls = 0;
    const fixture = await render(
      utils.h(Button, {
        variant: "subtle",
        className: "task-menu-command task-menu-edit",
        type: "submit",
        "aria-label": "Actions pour Tâche",
        onClick: () => { calls += 1; }
      }, "Modifier")
    );
    const button = fixture.container.querySelector("button");
    assert.equal(button.className, "subtle task-menu-command task-menu-edit");
    assert.equal(button.type, "submit");
    assert.equal(button.getAttribute("aria-label"), "Actions pour Tâche");
    button.click();
    assert.equal(calls, 1);

    let disabledCalls = 0;
    await fixture.rerender(
      utils.h(Button, {
        variant: "primary",
        type: "button",
        disabled: true,
        onClick: () => { disabledCalls += 1; }
      }, "Désactivé")
    );
    const disabled = fixture.container.querySelector("button");
    assert.equal(disabled.disabled, true);
    disabled.click();
    assert.equal(disabledCalls, 0);
    await fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-061 PriorityControl preserves badge and field variants, options and one intention", async () => {
  const dom = installDom();
  try {
    const { PriorityControl, PRIORITY_LABELS, PRIORITY_VALUES } = await compilePrimitives();
    assert.deepEqual(PRIORITY_VALUES, ["urgent", "normal", "later"]);
    assert.deepEqual(PRIORITY_LABELS, { urgent: "Urgent", normal: "Normal", later: "Plus tard" });

    const { utils } = await loadReact();
    const calls = [];
    const fixture = await render(
      utils.h(PriorityControl, {
        variant: "badge",
        ariaLabel: "Priorité de « Tâche » : Urgent",
        value: "urgent",
        onChange: (value) => calls.push(value)
      })
    );
    const badge = fixture.container.querySelector("select");
    assert.equal(fixture.container.children.length, 1);
    assert.equal(fixture.container.querySelectorAll("select").length, 1);
    assert.equal(badge.className, "priority priority-urgent priority-control");
    assert.equal(badge.getAttribute("aria-label"), "Priorité de « Tâche » : Urgent");
    assert.deepEqual([...badge.options].map((option) => option.value), ["urgent", "normal", "later"]);
    assert.deepEqual([...badge.options].map((option) => option.textContent), ["Urgent", "Normal", "Plus tard"]);
    assert.equal(badge.value, "urgent");

    await fixture.rerender(
      utils.h(PriorityControl, {
        variant: "field",
        className: "task-edit-priority",
        ariaLabel: "Priorité de l'étape Tâche",
        value: "normal",
        onChange: (value) => calls.push(value)
      })
    );
    const field = fixture.container.querySelector("select");
    assert.equal(field.className, "task-edit-priority");
    assert.equal(field.value, "normal");
    field.value = "later";
    field.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
    assert.deepEqual(calls, ["later"]);
    await fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-061 TextField renders one input or textarea and announces errors literally", async () => {
  const dom = installDom();
  try {
    const { TextField } = await compilePrimitives();
    const { utils } = await loadReact();
    let changes = 0;
    const fixture = await render(
      utils.h(TextField, {
        className: "task-edit-title",
        type: "text",
        required: true,
        maxLength: 300,
        placeholder: "Titre",
        ariaLabel: "Titre de l'étape Tâche",
        value: "Titre courant",
        onChange: () => { changes += 1; }
      })
    );
    const input = fixture.container.querySelector("input");
    assert.equal(fixture.container.children.length, 1);
    assert.equal(fixture.container.querySelectorAll("input, textarea").length, 1);
    assert.equal(input.className, "task-edit-title");
    assert.equal(input.required, true);
    assert.equal(input.maxLength, 300);
    assert.equal(input.placeholder, "Titre");
    assert.equal(input.getAttribute("aria-label"), "Titre de l'étape Tâche");
    assert.equal(input.value, "Titre courant");

    await fixture.rerender(
      utils.h(TextField, {
        as: "textarea",
        className: "task-edit-note",
        rows: 3,
        maxLength: 2000,
        ariaLabel: "Note (facultative) de l'étape Tâche",
        value: "ligne 1\nligne 2",
        ariaInvalid: true,
        errorId: "note-error",
        onChange: () => { changes += 1; }
      })
    );
    const textarea = fixture.container.querySelector("textarea");
    assert.equal(fixture.container.querySelectorAll("input, textarea").length, 1);
    assert.equal(textarea.rows, 3);
    assert.equal(textarea.maxLength, 2000);
    assert.equal(textarea.value, "ligne 1\nligne 2");
    assert.equal(textarea.getAttribute("aria-invalid"), "true");
    assert.equal(textarea.getAttribute("aria-describedby"), "note-error");
    assert.equal(textarea.querySelector("*"), null, "value stays plain text");
    await fixture.unmount();
  } finally {
    dom.cleanup();
  }
});
