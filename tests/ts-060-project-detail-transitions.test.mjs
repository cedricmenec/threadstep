import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactBoundary, reactBoundaryKey } from "../site/react-boundary.js";
import { createReactAdapter, REACT_ADAPTER_COMMAND_NAMES } from "../site/react-adapter.js";
import {
  decideProjectDetailSurface,
  SURFACE_REASON
} from "../site/project-detail/surface-decision.js";
import {
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readFileSync(resolve(root, "site/app.js"), "utf8");

function documentFixture() {
  return {
    version: 1,
    subjects: [{
      id: "p1",
      title: "Projet A",
      items: [
        { id: "i1", title: "Tâche A confidentielle", priority: "urgent", done: false, parentId: null, note: "note A" },
        { id: "i2", title: "Enfant A", priority: "normal", done: false, parentId: "i1" }
      ]
    }, {
      id: "p2",
      title: "Projet B",
      items: [
        { id: "j1", title: "Tâche B", priority: "normal", done: false, parentId: null }
      ]
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

function mountSurface(boundary, fixture, key) {
  const mounted = boundary.mount({
    key,
    container: fixture.container,
    unmount: () => fixture.surface.unmount()
  });
  assert.equal(mounted.status, "mounted");
  assert.equal(boundary.activeCount(), 1);
  assert.equal(boundary.canWriteVanilla(fixture.container), false);
  return mounted;
}

test("TS-060 route, project, identity, space, blocked read and vanished project invalidate without residue", async () => {
  const dom = installDeterministicDom();
  try {
    const scenarios = [
      {
        name: "route-overview",
        mutate(state) { state.route = { view: "overview" }; }
      },
      {
        name: "route-settings",
        mutate(state) { state.route = { view: "settings", section: "data" }; }
      },
      {
        name: "other-project",
        mutate(state) { state.route = { view: "subject", subjectId: "p2" }; }
      },
      {
        name: "identity",
        mutate(state) { state.identity = { type: "synchronized", databaseName: "db", userDigest: "digest-b" }; }
      },
      {
        name: "space",
        mutate(state) { state.identity = { type: "synchronized", databaseName: "db-other", userDigest: "digest-a" }; }
      },
      {
        name: "blocked-read",
        mutate(state) { state.blocked = true; }
      },
      {
        name: "vanished-project",
        mutate(state) { state.document.subjects = state.document.subjects.filter((entry) => entry.id !== "p1"); }
      }
    ];
    for (const scenario of scenarios) {
      const { adapter, state } = makeAdapter();
      const fixture = await createSurfaceFixture(adapter);
      assert.match(fixture.container.textContent, /Projet A/);
      assert.match(fixture.container.textContent, /Tâche A confidentielle/);
      const boundary = createReactBoundary();
      mountSurface(boundary, fixture, reactBoundaryKey({
        view: "subject",
        subjectId: "p1",
        identity: "local"
      }));
      assert.equal(fixture.container.querySelector('[data-react-surface="project-detail"]'), fixture.container.firstElementChild);

      scenario.mutate(state);
      await fixture.act(async () => { adapter.refresh(); });

      assert.equal(fixture.container.textContent, "", scenario.name);
      assert.equal(fixture.container.querySelectorAll("*").length, 0, scenario.name);
      assert.equal(adapter.isInvalidated(), true, scenario.name);
      boundary.invalidate(scenario.name);
      assert.equal(boundary.activeCount(), 0, scenario.name);
      assert.equal(boundary.canWriteVanilla(fixture.container), true, scenario.name);
      fixture.container.replaceChildren();
      fixture.container.textContent = "vanilla " + scenario.name;
      assert.match(fixture.container.textContent, /vanilla/, scenario.name);
      fixture.unmount();
      fixture.container.remove();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-060 repeated transition cycles keep one owner and emit no additional write or request", async () => {
  const dom = installDeterministicDom();
  const writes = [];
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const originalWindowIndexedDb = Object.getOwnPropertyDescriptor(dom.window, "indexedDB");
  globalThis.fetch = (...args) => { requests.push(args[0]); throw new Error("network forbidden"); };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    writable: true,
    value: { open() { writes.push("open"); throw new Error("storage forbidden"); } }
  });
  Object.defineProperty(dom.window, "indexedDB", {
    configurable: true,
    writable: true,
    value: globalThis.indexedDB
  });
  try {
    const boundary = createReactBoundary();
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const { adapter, state, calls } = makeAdapter();
      const fixture = await createSurfaceFixture(adapter);
      mountSurface(boundary, fixture, reactBoundaryKey({
        view: "subject",
        subjectId: "p1",
        identity: "local"
      }));
      if (cycle % 2 === 0) {
        state.identity = { type: "synchronized", databaseName: "db", userDigest: "digest-" + cycle };
      } else {
        state.route = { view: "subject", subjectId: "p2" };
      }
      await fixture.act(async () => { adapter.refresh(); });
      assert.equal(fixture.container.querySelectorAll("*").length, 0, "cycle " + cycle);
      assert.equal(adapter.listenerCount(), 1);
      assert.equal(boundary.activeCount(), 1);
      boundary.invalidate("context-change");
      assert.equal(boundary.activeCount(), 0);
      assert.equal(adapter.listenerCount(), 0);
      assert.deepEqual(calls, []);
      fixture.container.remove();
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(requests, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalIndexedDb) Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
    else delete globalThis.indexedDB;
    if (originalWindowIndexedDb) Object.defineProperty(dom.window, "indexedDB", originalWindowIndexedDb);
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-060 invalidation precedes every vanilla return and the boundary guards the container", () => {
  const render = appSource.slice(
    appSource.indexOf("function render() {"),
    appSource.indexOf("function navigate(")
  );
  const settingsRelease = render.indexOf('releaseProjectDetailSurface("route-settings")');
  const settingsWrite = render.indexOf("if (reactBoundary.canWriteVanilla(subjectsEl)) subjectsEl.replaceChildren();");
  assert.ok(settingsRelease >= 0 && settingsWrite > settingsRelease);

  const overviewRelease = render.indexOf('releaseProjectDetailSurface("route-overview")');
  const overviewRender = render.indexOf("renderSuggestion()");
  assert.ok(overviewRelease >= 0 && overviewRender > overviewRelease);

  const detailRelease = render.indexOf('releaseProjectDetailSurface(decision.reason || "surface-unavailable")');
  const detailRender = render.indexOf("renderDetail(nextSubjects)");
  assert.ok(detailRelease >= 0 && detailRender > detailRelease);

  assert.match(render, /if \(reactBoundary\.canWriteVanilla\(subjectsEl\)\)/);
  assert.match(appSource, /function replaceSubjectsInCurrentView\(nextSubjects, snapshot\) \{\n  if \(!reactBoundary\.canWriteVanilla\(subjectsEl\)\) return false;/);
  assert.match(appSource, /function renderDetail\(target = subjectsEl\) \{[\s\S]*?reactBoundary\.invalidate\("route-invalid"\)/);
  assert.match(appSource, /function renderDetail\(target = subjectsEl\) \{[\s\S]*?reactBoundary\.invalidate\("subject-missing"\)/);

  const mount = appSource.slice(
    appSource.indexOf("function renderProjectDetailSurface("),
    appSource.indexOf("function applyExpandedIdentityBoundary(")
  );
  assert.ok(mount.indexOf('reactBoundary.invalidate("context-change")') <
    mount.indexOf("createProjectDetailSurface({"));
  assert.match(mount, /container: subjectsEl/);
  assert.match(mount, /reactBoundary\.mount\(\{/);
});

test("TS-060 the pure decision refuses every non-mountable context", () => {
  const base = {
    route: { view: "subject", subjectId: "p1" },
    businessAllowed: true,
    isLoadingBlocked: false,
    documentLoaded: true,
    projectExists: true
  };
  assert.equal(decideProjectDetailSurface(base).mount, true);
  const cases = [
    [{ route: null }, SURFACE_REASON.INVALID_ROUTE],
    [{ route: { view: "invalid" } }, SURFACE_REASON.INVALID_ROUTE],
    [{ route: { view: "settings" } }, SURFACE_REASON.NOT_DETAIL_ROUTE],
    [{ route: { view: "overview" } }, SURFACE_REASON.NOT_DETAIL_ROUTE],
    [{ route: { view: "subject", subjectId: "" } }, SURFACE_REASON.NOT_DETAIL_ROUTE],
    [{ businessAllowed: false }, SURFACE_REASON.BUSINESS_NOT_ALLOWED],
    [{ isLoadingBlocked: true }, SURFACE_REASON.LOADING_BLOCKED],
    [{ documentLoaded: false }, SURFACE_REASON.LOADING_BLOCKED],
    [{ projectExists: false }, SURFACE_REASON.PROJECT_MISSING]
  ];
  for (const [overrides, reason] of cases) {
    const decision = decideProjectDetailSurface({ ...base, ...overrides });
    assert.equal(decision.mount, false, reason);
    assert.equal(decision.reason, reason);
    assert.equal(decision.fallback, reason !== SURFACE_REASON.NOT_DETAIL_ROUTE);
  }
  assert.deepEqual(decideProjectDetailSurface({
    route: { view: "overview" },
    businessAllowed: true,
    isLoadingBlocked: false,
    documentLoaded: true,
    projectExists: false
  }), { mount: false, fallback: false, reason: SURFACE_REASON.NOT_DETAIL_ROUTE });
});
