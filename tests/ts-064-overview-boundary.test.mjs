import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactBoundary, reactBoundaryKey } from "../site/react-boundary.js";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { decideOverviewSurface, OVERVIEW_SURFACE_REASON } from "../site/overview/surface-decision.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import {
  OVERVIEW_TEST_COMMANDS,
  compileOverviewSurface,
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";
import {
  compileProjectDetailSurface,
  createStaticAdapter as createDetailAdapter
} from "./helpers/ts-059-project-detail-harness.mjs";
import { createShellFixture } from "./helpers/ts-063-app-shell-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "site/app.js"), "utf8");

function item(id, priority = "normal", done = false, parentId = null) {
  return { id, title: id, priority, done, parentId };
}

function makeOverviewAdapter({ transient = {} } = {}) {
  const state = {
    document: { version: 1, subjects: [{ id: "p1", title: "Projet A", items: [item("i1")] }] },
    route: { view: "overview" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    presentation: {
      state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
      actionRequired: false,
      projectsAvailable: true
    },
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      projectFilter: "all",
      ...transient
    }
  };
  const calls = [];
  const handlers = {};
  for (const name of OVERVIEW_TEST_COMMANDS) {
    handlers[name] = (...args) => {
      calls.push([name, args]);
      return true;
    };
  }
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => state.identity,
    isBusinessAllowed: () => state.allowed,
    isLoadingBlocked: () => state.blocked,
    getPresentation: () => state.presentation,
    commands: handlers
  });
  return { adapter, state, calls };
}

function detailSnapshot() {
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: true,
    project: {
      id: "p1",
      title: "Projet détail",
      pendingCount: 1,
      metrics: { total: 1 },
      totalTaskCount: 1,
      totalTaskCountLabel: "1 tâche au total",
      urgencyLabel: "",
      progressLabel: ""
    },
    items: [item("d1", "normal")],
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null
    }
  };
}

async function mountDetailSurface(container) {
  const compiled = await compileProjectDetailSurface();
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const adapter = createDetailAdapter({
    snapshot: detailSnapshot(),
    commandNames: ["removeItem", "undoRemoval", "updateItem"]
  });
  return {
    adapter,
    surface: compiled.module.createProjectDetailSurface({
      adapter,
      container,
      createRoot,
      flushSync
    })
  };
}

test("TS-064 one shared #subjects boundary never has two content owners", async () => {
  const dom = installDeterministicDom();
  try {
    const boundary = createReactBoundary();
    const container = dom.document.createElement("div");
    dom.document.body.append(container);
    const overview = makeOverviewAdapter();
    const overviewFixture = await createOverviewFixture(overview.adapter, { container });
    const overviewKey = reactBoundaryKey({ view: "overview", subjectId: "", identity: "local" }) + "|ready";
    const mounted = boundary.mount({
      key: overviewKey,
      container,
      unmount: () => overviewFixture.surface.unmount()
    });
    assert.equal(mounted.status, "mounted");
    assert.equal(boundary.activeCount(), 1);
    assert.equal(boundary.canWriteVanilla(container), false);
    assert.equal(overview.adapter.listenerCount(), 1);
    assert.equal(container.querySelectorAll('[data-react-surface="overview-card"]').length, 1);

    const refused = boundary.mount({
      key: "subject|p1|local",
      container,
      unmount() { throw new Error("second owner must be refused"); }
    });
    assert.equal(refused.status, "refused");
    assert.equal(boundary.activeCount(), 1);

    mounted.invalidate("route-subject");
    assert.equal(boundary.canWriteVanilla(container), true);
    assert.equal(container.childNodes.length, 0);
    assert.equal(overview.adapter.listenerCount(), 0);

    const detail = await mountDetailSurface(container);
    const detailKey = reactBoundaryKey({ view: "subject", subjectId: "p1", identity: "local" });
    const detailMounted = boundary.mount({
      key: detailKey,
      container,
      unmount: () => detail.surface.unmount()
    });
    assert.equal(detailMounted.status, "mounted");
    assert.equal(boundary.activeCount(), 1);
    assert.match(container.textContent, /Projet détail/);
    assert.doesNotMatch(container.textContent, /Ouvrir le projet/);
    detailMounted.invalidate("route-overview");
    assert.equal(container.childNodes.length, 0);
    assert.equal(detail.adapter.listenerCount(), 0);

    const again = await createOverviewFixture(overview.adapter, { container });
    const againMounted = boundary.mount({
      key: overviewKey,
      container,
      unmount: () => again.surface.unmount()
    });
    assert.equal(againMounted.status, "mounted");
    assert.equal(boundary.activeCount(), 1);
    assert.equal(container.querySelectorAll(".overview-see-more").length, 0);
    againMounted.release("cleanup");
    container.remove();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 repeated mixed cycles keep the shell host independent and bounded", async () => {
  const dom = installDeterministicDom();
  try {
    const contentBoundary = createReactBoundary();
    const shellBoundary = createReactBoundary();
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const container = dom.document.createElement("div");
      dom.document.body.append(container);
      const shell = await createShellFixture();
      const shellMounted = shellBoundary.mount({
        key: "shell|overview|local",
        container: shell.container,
        unmount: () => shell.surface.unmount()
      });
      assert.equal(shellMounted.status, "mounted");

      const overview = makeOverviewAdapter();
      const overviewFixture = await createOverviewFixture(overview.adapter, { container });
      const mounted = contentBoundary.mount({
        key: "overview|local|ready",
        container,
        unmount: () => overviewFixture.surface.unmount()
      });
      assert.equal(mounted.status, "mounted");
      assert.equal(contentBoundary.activeCount() + shellBoundary.activeCount(), 2);
      assert.notEqual(container, shell.container);
      assert.equal(contentBoundary.owns(shell.container), false);
      assert.equal(shellBoundary.owns(container), false);

      if (cycle % 2 === 0) {
        mounted.invalidate("navigation");
        assert.equal(contentBoundary.activeCount(), 0);
        assert.equal(shellBoundary.activeCount(), 1);
        shellMounted.invalidate("navigation");
      } else {
        shellMounted.invalidate("navigation");
        mounted.invalidate("navigation");
      }
      assert.equal(contentBoundary.activeCount() + shellBoundary.activeCount(), 0);
      assert.equal(overview.adapter.listenerCount(), 0);
      assert.equal(container.childNodes.length, 0);
      container.remove();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 the Overview surface decision releases before read states", () => {
  const base = {
    route: { view: "overview" },
    businessAllowed: true,
    documentLoaded: true,
    presentation: {
      state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
      actionRequired: false,
      projectsAvailable: true
    }
  };
  assert.deepEqual(decideOverviewSurface(base), {
    mount: true,
    reason: OVERVIEW_SURFACE_REASON.OVERVIEW
  });
  assert.equal(decideOverviewSurface({ ...base, route: { view: "subject", subjectId: "p1" } }).reason,
    OVERVIEW_SURFACE_REASON.NOT_OVERVIEW_ROUTE);
  assert.equal(decideOverviewSurface({ ...base, businessAllowed: false }).reason,
    OVERVIEW_SURFACE_REASON.BUSINESS_NOT_ALLOWED);
  assert.equal(decideOverviewSurface({ ...base, documentLoaded: false }).reason,
    OVERVIEW_SURFACE_REASON.LOADING_BLOCKED);
  assert.equal(decideOverviewSurface({ ...base, presentation: null }).reason,
    OVERVIEW_SURFACE_REASON.PRESENTATION_MISSING);
  assert.equal(decideOverviewSurface({
    ...base,
    presentation: { state: OVERVIEW_PRESENTATION_STATE.AWAITING_READ, actionRequired: false, projectsAvailable: false }
  }).reason, OVERVIEW_SURFACE_REASON.AWAITING_READ);
  assert.equal(decideOverviewSurface({
    ...base,
    presentation: { state: OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED, actionRequired: true, projectsAvailable: false }
  }).reason, OVERVIEW_SURFACE_REASON.ACTION_REQUIRED);
  assert.equal(decideOverviewSurface({
    ...base,
    presentation: { state: OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED, actionRequired: true, projectsAvailable: true }
  }).mount, true);

  assert.match(app, /function overviewSurfaceCanMount\(\) \{\s*\n\s*return decideOverviewSurface\(\{/);
  assert.match(app, /releaseOverviewSurface\("overview-suppressed"\)/);
  assert.match(app, /releaseOverviewSurface\("route-settings"\)/);
  assert.match(app, /releaseOverviewSurface\("route-invalid"\)/);
});

test("TS-064 read states, identity and vanished projects never keep previous cards", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeOverviewAdapter();
    const fixture = await createOverviewFixture(adapter);
    assert.match(fixture.container.textContent, /Projet A/);

    state.presentation = {
      state: OVERVIEW_PRESENTATION_STATE.AWAITING_READ,
      actionRequired: false,
      projectsAvailable: false
    };
    fixture.rerender();
    assert.equal(fixture.container.textContent, "");
    assert.equal(adapter.isInvalidated(), true);
    assert.equal(adapter.invalidationReason(), "read-unavailable");
    fixture.unmount();

    const second = makeOverviewAdapter();
    const secondFixture = await createOverviewFixture(second.adapter);
    assert.match(secondFixture.container.textContent, /Projet A/);
    second.state.identity = { type: "synchronized", databaseName: "db", userDigest: "digest-b" };
    secondFixture.rerender();
    assert.equal(secondFixture.container.textContent, "");
    assert.equal(second.adapter.invalidationReason(), "context-changed");
    second.state.identity = { type: "local" };
    secondFixture.rerender();
    assert.equal(secondFixture.container.textContent, "", "a late event from the old identity cannot restore cards");
    secondFixture.unmount();

    const third = makeOverviewAdapter();
    const thirdFixture = await createOverviewFixture(third.adapter);
    assert.match(thirdFixture.container.textContent, /Projet A/);
    third.state.document = { version: 1, subjects: [{ id: "p2", title: "Projet B", items: [] }] };
    thirdFixture.rerender();
    assert.doesNotMatch(thirdFixture.container.textContent, /Projet A/);
    assert.match(thirdFixture.container.textContent, /Projet B/);
    thirdFixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 authorized empty reads mount the existing empty state, not fabricated metrics", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeOverviewAdapter();
    state.document = { version: 1, subjects: [] };
    const fixture = await createOverviewFixture(adapter);
    assert.equal(fixture.container.querySelectorAll(".subject").length, 0);
    assert.match(fixture.container.textContent, /Aucun sujet pour le moment/);
    assert.doesNotMatch(fixture.container.textContent, /%/);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
