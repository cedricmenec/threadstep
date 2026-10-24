import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactBoundary, reactBoundaryKey } from "../site/react-boundary.js";
import { createReactAdapter, REACT_ADAPTER_COMMAND_NAMES } from "../site/react-adapter.js";
import {
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const appSource = read("site/app.js");

function documentFixture() {
  return {
    version: 1,
    subjects: [{
      id: "p1",
      title: "Projet",
      items: [
        { id: "i1", title: "Urgent", priority: "urgent", done: false, parentId: null },
        { id: "i2", title: "Enfant", priority: "normal", done: false, parentId: "i1" }
      ]
    }, {
      id: "p2",
      title: "Autre",
      items: []
    }]
  };
}

function makeAdapter(overrides = {}) {
  const state = {
    document: documentFixture(),
    route: { view: "subject", subjectId: "p1" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null
    },
    ...overrides
  };
  const calls = [];
  const handlers = {};
  for (const name of REACT_ADAPTER_COMMAND_NAMES) {
    handlers[name] = (...args) => { calls.push([name, args]); return true; };
  }
  const adapter = createReactAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => state.identity,
    isBusinessAllowed: () => state.allowed,
    isLoadingBlocked: () => state.blocked,
    commands: handlers
  });
  return { adapter, state, calls };
}

test("TS-059 app.js wires a single React branch for the subject route only", () => {
  assert.match(appSource, /from "\.\/project-detail\/ProjectDetailSurface\.jsx"/);
  assert.match(appSource, /from "\.\/project-detail\/surface-decision\.js"/);
  assert.equal((appSource.match(/createProjectDetailSurface\(/g) || []).length, 1);
  assert.match(appSource, /import \{ createRoot \} from "react-dom\/client"/);
  assert.equal((appSource.match(/createRoot,/g) || []).length, 1);
  assert.match(appSource, /if \(route\.view === "subject"\)/);
  assert.match(appSource, /decideProjectDetailSurface\(\{/);
  assert.match(appSource, /reactBoundary\.mount\(\{/);
  assert.match(appSource, /captureUxContinuity/);
  assert.match(appSource, /finishUxRender/);
  assert.match(appSource, /applyFocus/);
  assert.match(appSource, /releaseProjectDetailSurface\("route-overview"\)/);
  assert.match(appSource, /releaseProjectDetailSurface\("route-settings"\)/);
  const overviewRender = appSource.slice(
    appSource.indexOf("renderSuggestion();"),
    appSource.indexOf("replaceSubjectsInCurrentView(nextSubjects, uxSnapshot);")
  );
  assert.doesNotMatch(overviewRender, /ProjectDetailSurface|createRoot/);
});

test("TS-059 repeated route and identity cycles keep a single React owner", async () => {
  const dom = installDeterministicDom();
  const boundary = createReactBoundary();
  try {
    for (let cycle = 0; cycle < 5; cycle += 1) {
      const { adapter } = makeAdapter();
      const fixture = await createSurfaceFixture(adapter);
      const key = reactBoundaryKey({
        view: "subject",
        subjectId: cycle % 2 === 0 ? "p1" : "p2",
        identity: "local"
      });
      const mounted = boundary.mount({
        key,
        container: fixture.container,
        unmount: () => fixture.surface.unmount()
      });
      assert.equal(mounted.status, "mounted");
      assert.equal(boundary.activeCount(), 1);
      assert.equal(boundary.canWriteVanilla(fixture.container), false);
      assert.equal(fixture.container.querySelectorAll('[data-react-surface="project-detail"]').length, 1);
      assert.equal(adapter.listenerCount(), 1);

      const refused = boundary.mount({
        key: key + "|other",
        container: fixture.container,
        unmount() { throw new Error("second owner must be refused"); }
      });
      assert.equal(refused.status, "refused");
      assert.equal(boundary.activeCount(), 1);

      boundary.invalidate("route-change");
      assert.equal(boundary.activeCount(), 0);
      assert.equal(fixture.container.querySelectorAll("*").length, 0);
      assert.equal(adapter.listenerCount(), 0);
      assert.equal(boundary.canWriteVanilla(fixture.container), true);
      fixture.container.remove();
    }
  } finally {
    dom.cleanup();
  }
});

test("TS-059 another project or a vanished project leaves no residual content", async () => {
  const dom = installDeterministicDom();
  try {
    const first = makeAdapter();
    const fixture = await createSurfaceFixture(first.adapter);
    assert.match(fixture.container.textContent, /Projet/);
    first.state.route = { view: "subject", subjectId: "p2" };
    await fixture.act(async () => { first.adapter.refresh(); });
    assert.doesNotMatch(fixture.container.textContent, /Urgent/);
    first.state.identity = { type: "synchronized", databaseName: "db", userDigest: "other" };
    await fixture.act(async () => { first.adapter.refresh(); });
    assert.equal(fixture.container.textContent, "");
    fixture.unmount();

    const second = makeAdapter();
    const other = await createSurfaceFixture(second.adapter);
    second.state.document.subjects = second.state.document.subjects.filter((entry) => entry.id !== "p1");
    await other.act(async () => { second.adapter.refresh(); });
    assert.equal(other.container.textContent, "");
    other.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-059 mount, refresh, local presentation and unmount emit no write or request", async () => {
  const dom = installDeterministicDom();
  const writes = [];
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const originalWindowIndexedDb = Object.getOwnPropertyDescriptor(dom.window, "indexedDB");
  const originalGlobalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = {
    getItem: () => null,
    setItem: (...args) => { writes.push(["localStorage", args]); },
    removeItem: () => {},
    clear: () => {}
  };
  globalThis.fetch = (...args) => {
    requests.push(args[0]);
    throw new Error("network forbidden");
  };
  globalThis.WebSocket = class {
    constructor(url) { requests.push(url); }
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    writable: true,
    value: {
      open() { writes.push(["indexedDB.open"]); throw new Error("storage forbidden"); }
    }
  });
  Object.defineProperty(dom.window, "indexedDB", {
    configurable: true,
    writable: true,
    value: globalThis.indexedDB
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage
  });
  try {
    const { adapter, state, calls } = makeAdapter();
    const fixture = await createSurfaceFixture(adapter);
    await fixture.act(async () => { adapter.refresh(); });
    state.transient.openMenuId = "i1";
    await fixture.act(async () => { adapter.refresh(); });
    assert.ok(fixture.container.querySelector(".task-menu"));
    fixture.unmount();
    assert.deepEqual(writes, []);
    assert.deepEqual(requests, []);
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    if (originalIndexedDb) Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
    else delete globalThis.indexedDB;
    if (originalWindowIndexedDb) Object.defineProperty(dom.window, "indexedDB", originalWindowIndexedDb);
    if (originalGlobalStorage) Object.defineProperty(globalThis, "localStorage", originalGlobalStorage);
    else delete globalThis.localStorage;
    dom.cleanup();
  }
});

test("TS-059 applyFocus returns focus to a connected control after save, cancel, move and removal", async () => {
  const dom = installDeterministicDom();
  try {
    dom.document.body.innerHTML = `
      <div id="subjects">
        <section class="subject detail" data-subject="p1" tabindex="-1">
          <div class="subject-controls">
            <button class="subtle subject-rename">Renommer</button>
          </div>
          <ul class="tasks">
            <li class="task task-parent" data-item="i1">
              <form class="task-edit-form"><input class="task-edit-title"></form>
              <div class="task-row"><input class="task-check"></div>
              <button class="subtle task-toggle"></button>
              <button class="subtle task-menu-button"></button>
              <button class="task-handle"></button>
            </li>
          </ul>
        </section>
      </div>`;
    const subjectsEl = dom.document.querySelector("#subjects");
    const applyFocusCode = appSource.slice(
      appSource.indexOf("function applyFocus()"),
      appSource.indexOf("function renderSuggestion()")
    );
    const state = {
      subjectsEl,
      pendingNavigationFocus: null,
      editingItemId: null,
      renamingSubject: false,
      focusDetailHeading: false,
      focusOpenSubjectId: null,
      focusRenameControl: false,
      focusSubjectId: null,
      focusItemId: null,
      pendingCollapseFocus: null,
      pendingPriorityFocus: null,
      pendingMenuFocus: null,
      pendingMoveFocus: null
    };
    const context = { ...state, document: dom.document, Number, Math };
    const run = (patch) => {
      Object.assign(context, patch);
      runInNewContext(applyFocusCode + "\napplyFocus();", context);
    };

    run({ editingItemId: "i1" });
    assert.equal(dom.document.activeElement.classList.contains("task-edit-title"), true);

    run({ editingItemId: null, focusItemId: "i1" });
    assert.equal(dom.document.activeElement.isConnected, true);
    assert.equal(dom.document.activeElement.closest('[data-item="i1"]') !== null, true);

    run({ focusItemId: null, pendingMoveFocus: { itemId: "i1", direction: "up" } });
    assert.equal(dom.document.activeElement.classList.contains("task-handle"), true);

    run({ pendingMoveFocus: null, pendingCollapseFocus: "i1" });
    assert.equal(dom.document.activeElement.classList.contains("task-toggle"), true);

    run({ pendingCollapseFocus: null, pendingMenuFocus: "i1" });
    assert.equal(dom.document.activeElement.classList.contains("task-menu-button"), true);

    run({ pendingMenuFocus: null, focusSubjectId: "p1" });
    assert.equal(dom.document.activeElement.classList.contains("detail"), true);
    assert.equal(dom.document.activeElement.isConnected, true);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
