import test from "node:test";
import assert from "node:assert/strict";
import {
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";
import { REACT_ADAPTER_COMMAND_NAMES } from "../site/react-adapter.js";

function snapshot(overrides = {}) {
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: true,
    project: {
      id: "p1",
      title: "Projet",
      pendingCount: 2,
      metrics: { total: 3 },
      totalTaskCount: 2,
      totalTaskCountLabel: "2 tâches au total",
      urgencyLabel: "",
      progressLabel: ""
    },
    items: [
      { id: "a", title: "Parent", priority: "urgent", done: false, parentId: null },
      { id: "b", title: "Enfant", priority: "normal", done: false, parentId: "a" },
      { id: "c", title: "Terminée", priority: "later", done: true, parentId: null }
    ],
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      ...(overrides.transient || {})
    }
  };
}

test("TS-060 a full mount, render, refresh, presentation and unmount cycle has no business effect", async () => {
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
    removeItem: (...args) => { writes.push(["localStorage.remove", args]); },
    clear: () => { writes.push(["localStorage.clear"]); }
  };
  globalThis.fetch = (...args) => {
    requests.push(["fetch", args[0]]);
    throw new Error("network forbidden");
  };
  globalThis.WebSocket = class {
    constructor(url) { requests.push(["websocket", url]); }
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    writable: true,
    value: {
      open() { writes.push(["indexedDB.open"]); throw new Error("storage forbidden"); },
      deleteDatabase() { writes.push(["indexedDB.deleteDatabase"]); throw new Error("storage forbidden"); }
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
    const adapter = createStaticAdapter({
      snapshot: snapshot(),
      commandNames: [...REACT_ADAPTER_COMMAND_NAMES]
    });
    const fixture = await createSurfaceFixture(adapter);
    assert.equal(fixture.container.querySelectorAll('[data-react-surface="project-detail"]').length, 1);
    assert.equal(adapter.listenerCount(), 1);

    await fixture.act(async () => { adapter.refresh(); });
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ transient: { openMenuId: "a", expandedParents: ["a"] } }));
    });
    assert.ok(fixture.container.querySelector(".task-menu"));
    assert.ok(fixture.container.querySelector("#substeps-a"));

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        transient: { hideCompleted: true, expandedParents: ["a"] }
      }));
    });
    assert.equal(fixture.container.querySelector('[data-item="c"]'), null);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        transient: { editingItemId: "a", renamingSubject: true }
      }));
    });
    assert.ok(fixture.container.querySelector(".task-edit-form"));

    fixture.unmount();
    assert.equal(fixture.container.querySelectorAll("*").length, 0);
    assert.equal(adapter.listenerCount(), 0);
    assert.deepEqual(writes, []);
    assert.deepEqual(requests, []);
    assert.deepEqual(adapter.calls, []);

    const remounted = await createSurfaceFixture(adapter);
    assert.equal(remounted.container.querySelectorAll('[data-react-surface="project-detail"]').length, 1);
    assert.equal(adapter.listenerCount(), 1);
    remounted.unmount();
    assert.deepEqual(writes, []);
    assert.deepEqual(requests, []);
    assert.deepEqual(adapter.calls, []);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    if (originalIndexedDb) Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
    else delete globalThis.indexedDB;
    if (originalWindowIndexedDb) Object.defineProperty(dom.window, "indexedDB", originalWindowIndexedDb);
    if (originalGlobalStorage) Object.defineProperty(globalThis, "localStorage", originalGlobalStorage);
    else delete globalThis.localStorage;
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-060 presentation-only interactions never persist a transient preference", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot(),
      commandNames: [...REACT_ADAPTER_COMMAND_NAMES]
    });
    const fixture = await createSurfaceFixture(adapter);
    const check = fixture.container.querySelector('[data-item="a"] .task-check');
    await fixture.act(async () => { check.click(); });
    await fixture.act(async () => {
      fixture.container.querySelector('[data-item="a"] .task-menu-button').click();
    });
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ transient: { openMenuId: "a" } }));
    });
    assert.ok(fixture.container.querySelector(".task-menu"));
    await fixture.act(async () => {
      fixture.container.querySelector('[data-item="a"] .task-menu-button').click();
    });
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ transient: { openMenuId: null } }));
    });
    assert.equal(fixture.container.querySelector(".task-menu"), null);
    assert.deepEqual(adapter.calls.map(([name]) => name), ["toggleItem", "openItemMenu", "closeItemMenu"]);
    const stored = adapter.getSnapshot();
    assert.equal(stored.view, "subject");
    assert.equal(stored.transient.openMenuId, null);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
