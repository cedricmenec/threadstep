import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import {
  createOverviewFixture,
  installDeterministicDom,
  overviewSourceFiles
} from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

function item(id, priority = "normal", done = false, parentId = null, note = null) {
  return { id, title: id, priority, done, parentId, ...(note === null ? {} : { note }) };
}

function createHarness({ transient = {}, context = {} } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: [{
        id: "p1",
        title: "Projet A",
        items: [item("a", "normal", false, null, "Note A"), item("b"), item("parent"), item("child", "normal", false, "parent")]
      }]
    },
    transient: {
      expandedParents: new Set(["parent"]),
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      projectFilter: "all",
      focusItemId: null,
      ...transient
    }
  };
  const env = {
    route: { view: "overview" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    presentation: {
      state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
      actionRequired: false,
      projectsAvailable: true
    },
    ...context
  };
  const counts = { persist: 0, render: 0, saveResume: 0 };
  const calls = [];
  let generated = 0;
  const base = createProjectDetailCommands({
    getDocument: () => state.document,
    setDocument: (next) => { state.document = next; },
    persist: () => { counts.persist += 1; },
    render: () => { counts.render += 1; },
    notify: () => {},
    getTransient: () => state.transient,
    setTransient: (patch) => Object.assign(state.transient, patch),
    removeAction: () => true,
    undoAction: () => true,
    startDragAction: () => true,
    cancelDragAction: () => true,
    navigate: () => {},
    promptText: () => "Sous-étape",
    randomId: () => "generated-" + (generated += 1),
    getResumeRef: () => null,
    setResumeRef: () => {},
    saveResumePreference: () => { counts.saveResume += 1; return Promise.resolve(true); }
  });
  const commands = {};
  for (const [name, value] of Object.entries(base)) {
    commands[name] = typeof value === "function"
      ? (...args) => { calls.push(name); return value(...args); }
      : value;
  }
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => env.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => env.identity,
    isBusinessAllowed: () => env.allowed,
    isLoadingBlocked: () => env.blocked,
    getPresentation: () => env.presentation,
    commands
  });
  return { state, env, counts, calls, adapter };
}

function setValue(node, value) {
  const prototype = node.tagName === "TEXTAREA"
    ? globalThis.HTMLTextAreaElement.prototype
    : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
  node.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
}

function pointer(dom, type, { x = 0, y = 0, pointerId = 1, button = 0 } = {}) {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button
  });
  Object.defineProperty(event, "pointerId", { configurable: true, value: pointerId });
  return event;
}

function assertReleased(fixture, harness) {
  assert.equal(fixture.container.childNodes.length, 0);
  assert.equal(fixture.container.querySelector(".subject"), null);
  assert.equal(fixture.container.querySelector(".task-edit-form"), null);
  assert.equal(fixture.container.querySelector(".task-menu"), null);
  assert.equal(fixture.container.querySelector("[data-item]"), null);
  assert.doesNotMatch(fixture.container.textContent || "", /Brouillon|Note A|Note brouillon/);
  assert.equal(harness.counts.persist, 0);
}

const syncedA = { type: "synced", databaseName: "db-a", userDigest: "user-a" };
const syncedB = { type: "synced", databaseName: "db-b", userDigest: "user-b" };

test("TS-065 an identity change releases an active editor and drag with no exposure or write", async () => {
  const dom = installDeterministicDom();
  let harness = createHarness({ transient: { editingItemId: "a", openMenuId: "b" } });
  let fixture = await createOverviewFixture(harness.adapter);
  try {
    const title = fixture.container.querySelector(".task-edit-title");
    await fixture.act(() => setValue(title, "Brouillon identité"));
    harness.env.identity = syncedA;
    fixture.rerender();
    assertReleased(fixture, harness);

    harness = createHarness();
    fixture = await createOverviewFixture(harness.adapter);
    const handle = fixture.container.querySelector('.task[data-item="a"] .task-handle');
    await fixture.act(() => {
      handle.dispatchEvent(pointer(dom, "pointerdown", { x: 10, y: 110 }));
    });
    assert.match(handle.className, /dragging-handle/);
    harness.env.identity = syncedA;
    fixture.rerender();
    assertReleased(fixture, harness);
    await fixture.act(() => {
      handle.dispatchEvent(pointer(dom, "pointerup", { x: 10, y: 110 }));
    });
    assert.deepEqual(harness.calls, []);
    assert.equal(harness.counts.persist, 0);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 a workspace change releases the surface and ignores a late event from the previous workspace", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness({
    transient: { editingItemId: "a", openMenuId: "b" },
    context: { identity: syncedA }
  });
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const title = fixture.container.querySelector(".task-edit-title");
    await fixture.act(() => setValue(title, "Brouillon espace A"));
    const target = fixture.container.querySelector('.task[data-item="parent"]');
    const handle = fixture.container.querySelector('.task[data-item="b"] .task-handle');
    harness.env.identity = syncedB;
    fixture.rerender();
    assertReleased(fixture, harness);

    await fixture.act(() => {
      handle.dispatchEvent(pointer(dom, "pointerdown", { x: 10, y: 110 }));
      target.dispatchEvent(pointer(dom, "pointerup", { x: 20, y: 110 }));
    });
    assert.deepEqual(harness.calls, []);
    assert.equal(harness.counts.persist, 0);
    assert.equal(fixture.container.childNodes.length, 0);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 a blocked read exposes no editor, menu, card or counter and writes nothing", async () => {
  const dom = installDeterministicDom();
  try {
    const blockedContexts = [
      { allowed: false },
      { blocked: true },
      {
        presentation: {
          state: OVERVIEW_PRESENTATION_STATE.AWAITING_READ,
          actionRequired: false,
          projectsAvailable: false
        }
      },
      {
        presentation: {
          state: OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED,
          actionRequired: true,
          projectsAvailable: false
        }
      }
    ];
    for (const context of blockedContexts) {
      const harness = createHarness({ transient: { editingItemId: "a" }, context });
      const fixture = await createOverviewFixture(harness.adapter);
      try {
        assertReleased(fixture, harness);
        assert.equal(harness.adapter.isInvalidated(), true);
      } finally {
        fixture.unmount();
      }
    }

    const harness = createHarness({ transient: { editingItemId: "a" } });
    const fixture = await createOverviewFixture(harness.adapter);
    try {
      assert.ok(fixture.container.querySelector(".task-edit-form"));
      harness.env.allowed = false;
      fixture.rerender();
      assertReleased(fixture, harness);
    } finally {
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("TS-065 interaction modules add no route, storage, dependency, Dexie, OTP, network, CSP or HTML execution", () => {
  const sources = [
    ...overviewSourceFiles(),
    { name: "use-overview-drag.js", source: read("site/overview/use-overview-drag.js") },
    { name: "TaskItem.jsx", source: read("site/project-detail/TaskItem.jsx") }
  ];
  for (const { name, source } of sources) {
    const code = withoutComments(source);
    assert.doesNotMatch(code, /\bDexie\b|DexieCloud|indexedDB|IndexedDB|\bOTP\b|authentication\.js/, name);
    assert.doesNotMatch(code, /localStorage|sessionStorage|threadstep\.[a-z]+\.v\d/, name);
    assert.doesNotMatch(code, /\bfetch\s*\(|new\s+WebSocket|XMLHttpRequest/, name);
    assert.doesNotMatch(code, /location\.hash|pushState|replaceState|parseRoute|subjectRoute/, name);
    assert.doesNotMatch(code, /dangerouslySetInnerHTML|\.innerHTML\b|insertAdjacentHTML/, name);
    assert.doesNotMatch(code, /Content-Security-Policy|connect-src/, name);
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(
        specifier === "react" ||
        specifier.startsWith("../core.js") ||
        specifier.startsWith("../ui/") ||
        specifier.startsWith("../project-detail/") ||
        specifier.startsWith("../overview-read-state.js") ||
        specifier.startsWith("../interaction-continuity.js") ||
        specifier.startsWith("./"),
        name + " imports " + specifier
      );
    }
  }
  const packageJson = JSON.parse(read("package.json"));
  assert.deepEqual(packageJson.dependencies, {
    dexie: "4.4.6",
    "dexie-cloud-addon": "4.4.15",
    react: "19.3.1",
    "react-dom": "19.3.1"
  });
  const html = read("site/index.html");
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.ok(csp);
  assert.equal(
    csp[1],
    "default-src 'self'; connect-src https://*.dexie.cloud wss://*.dexie.cloud; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
  );
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
});
