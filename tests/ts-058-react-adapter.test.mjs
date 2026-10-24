import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createReactAdapter,
  REACT_ADAPTER_COMMAND_NAMES
} from "../site/react-adapter.js";
import { parseRoute, subjectRoute, updateItem } from "../site/core.js";
import {
  createReactFixture,
  installDeterministicDom
} from "./helpers/ts-058-react-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const adapterSource = read("site/react-adapter.js");
const boundarySource = read("site/react-boundary.js");

function syntheticDocument() {
  return {
    version: 1,
    subjects: [
      {
        id: "p1",
        title: "Projet synthétique",
        items: [
          { id: "i1", title: "Étape urgente", priority: "urgent", done: false, parentId: null },
          { id: "i2", title: "Sous-étape", priority: "normal", done: false, parentId: "i1" },
          { id: "i3", title: "Étape terminée", priority: "later", done: true, parentId: null }
        ]
      },
      {
        id: "p2",
        title: "Autre projet",
        items: [{ id: "j1", title: "Autre étape", priority: "normal", done: false, parentId: null }]
      }
    ]
  };
}

function adapterHarness(overrides = {}) {
  const state = {
    document: syntheticDocument(),
    route: { view: "subject", subjectId: "p1" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    transient: {
      editor: { itemId: "i1", draftTitle: "Brouillon" },
      openMenuId: "i1",
      expandedParents: new Set(["i1"]),
      filter: "all"
    },
    ...overrides
  };
  const commandCalls = [];
  const handlers = {};
  for (const name of REACT_ADAPTER_COMMAND_NAMES) {
    handlers[name] = (...args) => {
      commandCalls.push([name, args]);
      return name;
    };
  }
  const notifications = [];
  const adapter = createReactAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => state.identity,
    isBusinessAllowed: () => state.allowed,
    isLoadingBlocked: () => state.blocked,
    commands: handlers
  });
  const unsubscribe = adapter.subscribe((snapshot, metadata) => {
    notifications.push({ snapshot, metadata });
  });
  return { adapter, state, commandCalls, notifications, unsubscribe };
}

test("TS-058 the adapter snapshot is detached, frozen and derived from core", () => {
  const { adapter, state } = adapterHarness();
  const snapshot = adapter.getSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.view, "subject");
  assert.equal(snapshot.subjectId, "p1");
  assert.equal(snapshot.project.id, "p1");
  assert.equal(snapshot.project.title, "Projet synthétique");
  assert.equal(snapshot.project.pendingCount, 2);
  assert.equal(snapshot.project.metrics.total, 3);
  assert.deepEqual(snapshot.items.map((item) => item.id), ["i1", "i2", "i3"]);
  assert.equal(snapshot.project.totalTaskCountLabel, "2 tâches au total");

  assert.throws(() => { snapshot.project.title = "Mutation"; }, TypeError);
  assert.throws(() => { snapshot.items.push({ id: "x" }); }, TypeError);
  assert.throws(() => { snapshot.transient.openMenuId = "i2"; }, TypeError);
  assert.equal(state.document.subjects[0].title, "Projet synthétique");
  assert.equal(state.document.subjects[0].items.length, 3);

  const fresh = adapter.getSnapshot();
  assert.notEqual(fresh, snapshot);
  assert.equal(fresh.project.id, snapshot.project.id);
});

test("TS-058 transient UI state stays separate and survives an authorized refresh", () => {
  const { adapter, state, notifications } = adapterHarness();
  const first = adapter.getSnapshot();
  assert.deepEqual(first.transient.expandedParents, ["i1"]);
  assert.equal(first.transient.openMenuId, "i1");
  assert.equal(first.transient.editor.draftTitle, "Brouillon");
  assert.equal("transient" in first.project, false);

  state.document = updateItem(state.document, "p1", "i1", {
    title: "Étape renommée",
    priority: "urgent"
  });
  const refreshed = adapter.refresh();
  assert.ok(refreshed);
  assert.equal(refreshed.items.find((item) => item.id === "i1").title, "Étape renommée");
  assert.deepEqual(refreshed.items.map((item) => item.id), first.items.map((item) => item.id));
  assert.deepEqual(refreshed.transient, first.transient);
  assert.equal(adapter.isInvalidated(), false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].metadata.reason, "refresh");
  assert.equal(notifications[0].metadata.invalidated, false);
});

test("TS-058 item identifiers are stable across refresh and only the controller mutates them", () => {
  const { adapter, state } = adapterHarness();
  const before = adapter.getSnapshot();
  const ids = before.items.map((item) => item.id);
  state.document = updateItem(state.document, "p1", "i2", {
    title: "Sous-étape modifiée",
    priority: "later"
  });
  const after = adapter.refresh();
  assert.deepEqual(after.items.map((item) => item.id), ids);
  assert.equal(after.items.find((item) => item.id === "i2").title, "Sous-étape modifiée");
  assert.equal(after.project.id, "p1");
});

test("TS-058 every named command delegates to the controller callback", () => {
  const { adapter, commandCalls } = adapterHarness();
  assert.deepEqual(adapter.commandNames, REACT_ADAPTER_COMMAND_NAMES);
  assert.equal(Object.isFrozen(adapter.commands), true);
  const calls = [
    ["renameSubject", ["p1", "Nouveau nom"]],
    ["createItem", ["p1", "Titre", "urgent"]],
    ["updateItem", ["p1", "i1", { title: "Titre" }]],
    ["toggleItem", ["p1", "i1"]],
    ["removeItem", ["p1", "i1"]],
    ["reorderItem", ["p1", "i1", "i2", "before"]],
    ["promoteItem", ["p1", "i2"]],
    ["toggleSubsteps", ["p1", "i1"]],
    ["openItemMenu", ["i1"]],
    ["closeItemMenu", []],
    ["trackItem", ["p1", "i1"]],
    ["returnToOverview", ["p1"]]
  ];
  for (const [name, args] of calls) {
    assert.equal(adapter.commands[name](...args), name);
  }
  assert.deepEqual(commandCalls, calls);
  assert.equal(commandCalls.some(([name]) => name === "unknown"), false);
});

test("TS-058 the adapter never duplicates business validation", () => {
  const { adapter, commandCalls } = adapterHarness();
  adapter.commands.renameSubject("p1", "");
  adapter.commands.updateItem("p1", "i1", { title: "", priority: "invalid" });
  assert.deepEqual(commandCalls.map(([name]) => name), ["renameSubject", "updateItem"]);
  assert.doesNotMatch(adapterSource, /\bfrom\s+["'][^"']*(?:app\.js|dexie|authentication|cloud|persistence)/i);
  assert.doesNotMatch(adapterSource, /\bnew\s+Dexie\b|\bindexedDB\b|\blocalStorage\b|\bfetch\s*\(|\bXMLHttpRequest\b/);
  assert.match(adapterSource, /from "\.\/core\.js"/);
  assert.doesNotMatch(boundarySource, /\bfrom\s+["'](?:react|dexie)/i);
  assert.doesNotMatch(boundarySource, /\bnew\s+Dexie\b|\bindexedDB\b|\bfetch\s*\(/);
});

test("TS-058 invalidation hides the previous context on route, identity and availability changes", () => {
  const routeHarness = adapterHarness();
  assert.ok(routeHarness.adapter.getSnapshot());
  routeHarness.state.route = { view: "overview" };
  assert.equal(routeHarness.adapter.getSnapshot(), null);
  assert.equal(routeHarness.adapter.isInvalidated(), true);
  assert.equal(routeHarness.adapter.invalidationReason(), "route-not-detail");
  assert.equal(routeHarness.notifications.at(-1).snapshot, null);

  const projectHarness = adapterHarness();
  assert.ok(projectHarness.adapter.getSnapshot());
  projectHarness.state.route = { view: "subject", subjectId: "absent" };
  assert.equal(projectHarness.adapter.getSnapshot(), null);
  assert.equal(projectHarness.adapter.invalidationReason(), "project-missing");

  const identityHarness = adapterHarness();
  assert.ok(identityHarness.adapter.getSnapshot());
  identityHarness.state.identity = { type: "synchronized", databaseName: "threadstep", userDigest: "digest" };
  assert.equal(identityHarness.adapter.getSnapshot(), null);
  assert.equal(identityHarness.adapter.invalidationReason(), "context-changed");

  const allowedHarness = adapterHarness();
  assert.ok(allowedHarness.adapter.getSnapshot());
  allowedHarness.state.allowed = false;
  assert.equal(allowedHarness.adapter.getSnapshot(), null);
  assert.equal(allowedHarness.adapter.invalidationReason(), "business-not-allowed");

  const blockedHarness = adapterHarness();
  assert.ok(blockedHarness.adapter.getSnapshot());
  blockedHarness.state.blocked = true;
  assert.equal(blockedHarness.adapter.getSnapshot(), null);
  assert.equal(blockedHarness.adapter.invalidationReason(), "loading-blocked");

  const vanishedHarness = adapterHarness();
  assert.ok(vanishedHarness.adapter.getSnapshot());
  vanishedHarness.state.document = { version: 1, subjects: [] };
  assert.equal(vanishedHarness.adapter.getSnapshot(), null);
  assert.equal(vanishedHarness.adapter.invalidationReason(), "project-missing");
});

test("TS-058 authorized refresh is not treated as navigation and explicit invalidate is final", () => {
  const { adapter, state, notifications } = adapterHarness();
  assert.ok(adapter.getSnapshot());
  state.transient = { ...state.transient, openMenuId: null };
  const refreshed = adapter.refresh();
  assert.ok(refreshed);
  assert.equal(refreshed.transient.openMenuId, null);
  assert.equal(adapter.isInvalidated(), false);
  assert.equal(notifications.length, 1);

  assert.equal(adapter.invalidate("unmount"), true);
  assert.equal(adapter.invalidate("again"), false);
  assert.equal(adapter.getSnapshot(), null);
  assert.equal(adapter.refresh(), null);
  assert.equal(adapter.listenerCount(), 1);
});

test("TS-058 mounting, rendering, a visual preference and unmounting cause no write or request", async () => {
  const dom = installDeterministicDom();
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const originalIndexedDb = globalThis.indexedDB;
  const originalWindowIndexedDb = dom.window.indexedDB;
  const writes = [];
  globalThis.fetch = (...args) => {
    writes.push(["fetch", args[0]]);
    throw new Error("network is forbidden in TS-058 tests");
  };
  globalThis.WebSocket = class ForbiddenWebSocket {
    constructor(url) {
      writes.push(["websocket", url]);
      throw new Error("WebSocket is forbidden in TS-058 tests");
    }
  };
  const indexedDbSpy = {
    open(...args) { writes.push(["indexedDB.open", args]); },
    deleteDatabase(...args) { writes.push(["indexedDB.deleteDatabase", args]); }
  };
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: indexedDbSpy });
  Object.defineProperty(dom.window, "indexedDB", { configurable: true, writable: true, value: indexedDbSpy });
  const localStorageWrites = [];
  const storage = dom.window.localStorage;
  for (const method of ["setItem", "removeItem", "clear"]) {
    const original = storage[method].bind(storage);
    storage[method] = (...args) => {
      localStorageWrites.push([method, args]);
      return original(...args);
    };
  }
  const { adapter, notifications } = adapterHarness();
  const fixture = await createReactFixture(adapter);
  try {
    assert.equal(fixture.listenerStats().activeListeners, 1);
    assert.equal(adapter.listenerCount(), 2);
    assert.equal(fixture.container.querySelectorAll("[data-react-surface]").length, 1);
    const preference = fixture.container.querySelector('[data-fixture="preference"]');
    assert.equal(preference.dataset.preference, "comfortable");
    await fixture.act(async () => {
      preference.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(preference.dataset.preference, "compact");
    await fixture.act(async () => {
      adapter.refresh();
    });
    assert.equal(fixture.listenerStats().activeListeners, 1);
    assert.equal(adapter.listenerCount(), 2);
    assert.ok(notifications.length >= 1);
  } finally {
    await fixture.act(async () => {
      fixture.root.unmount();
    });
    fixture.container.remove();
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: originalIndexedDb });
    Object.defineProperty(dom.window, "indexedDB", { configurable: true, writable: true, value: originalWindowIndexedDb });
    dom.cleanup();
  }
  assert.equal(fixture.listenerStats().activeListeners, 0);
  assert.equal(adapter.listenerCount(), 1);
  assert.deepEqual(writes, []);
  assert.deepEqual(localStorageWrites, []);
});

test("TS-058 existing hash routes and item identities are not changed by the adapter", () => {
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.equal(subjectRoute("p1"), "#/sujet/p1");
  assert.deepEqual(parseRoute(subjectRoute("p1")), { view: "subject", subjectId: "p1" });
  assert.doesNotMatch(adapterSource, /location\.hash\s*=|localStorage\.setItem/);
});
