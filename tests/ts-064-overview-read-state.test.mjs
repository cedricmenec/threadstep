import test from "node:test";
import assert from "node:assert/strict";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import {
  OVERVIEW_PRESENTATION_STATE,
  buildOverviewReadPresentation
} from "../site/overview-read-state.js";
import { SESSION_STATE } from "../site/sync-diagnostics.js";
import {
  OVERVIEW_TEST_COMMANDS,
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";

function item(id, priority = "normal", done = false, parentId = null) {
  return { id, title: id, priority, done, parentId };
}

function makeAdapter({ presentation = null } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: [{ id: "p1", title: "Projet A", items: [item("i1", "urgent"), item("i2")] }]
    },
    route: { view: "overview" },
    identity: { type: "synchronized", databaseName: "db-a", userDigest: "digest-a" },
    allowed: true,
    blocked: false,
    presentation: presentation || {
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
      projectFilter: "all"
    }
  };
  const handlers = {};
  for (const name of OVERVIEW_TEST_COMMANDS) {
    handlers[name] = () => true;
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
  return { adapter, state };
}

function assertNoCards(container) {
  assert.equal(container.querySelectorAll(".subject").length, 0);
  assert.equal(container.querySelectorAll(".subject-urgency").length, 0);
  assert.equal(container.querySelectorAll(".subject-progress").length, 0);
  assert.doesNotMatch(container.textContent, /%/);
  assert.doesNotMatch(container.textContent, /urgence restante/);
}

test("TS-064 awaiting and action-required reads render no card, counter or percentage", async () => {
  const dom = installDeterministicDom();
  try {
    const awaiting = buildOverviewReadPresentation({
      configured: true,
      session: SESSION_STATE.AUTHENTICATED,
      binding: "bound",
      documentLoaded: false,
      elapsedMs: 0
    });
    const actionRequired = buildOverviewReadPresentation({
      configured: true,
      session: SESSION_STATE.AUTHENTICATED,
      binding: "unverified",
      documentLoaded: false,
      elapsedMs: 0
    });
    for (const [presentation, reason] of [
      [awaiting, "read-unavailable"],
      [actionRequired, "read-unavailable"]
    ]) {
      const { adapter } = makeAdapter({ presentation });
      const fixture = await createOverviewFixture(adapter);
      assertNoCards(fixture.container);
      assert.equal(adapter.invalidationReason(), reason);
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 a blocked read empties an already displayed list without a fake zero", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    assert.ok(fixture.container.querySelector(".subject"));
    state.blocked = true;
    fixture.rerender();
    assertNoCards(fixture.container);
    assert.equal(adapter.invalidationReason(), "loading-blocked");
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 background updates keep the same cards mounted and add no loading state", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector('.subject[data-subject="p1"]');
    assert.ok(card);
    state.document = {
      version: 1,
      subjects: [{
        id: "p1",
        title: "Projet A actualisé",
        items: [item("i1", "urgent"), item("i2"), item("i3", "normal", true)]
      }]
    };
    fixture.rerender();
    assert.equal(fixture.container.querySelector('.subject[data-subject="p1"]'), card);
    assert.match(fixture.container.textContent, /Projet A actualisé/);
    assert.equal(fixture.container.querySelectorAll(".subject").length, 1);
    assert.equal(fixture.container.querySelector('[role="status"]'), null);
    assert.equal(adapter.isInvalidated(), false);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 a late event from workspace A never restores cards under workspace B", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    assert.match(fixture.container.textContent, /Projet A/);

    state.identity = { type: "synchronized", databaseName: "db-b", userDigest: "digest-b" };
    fixture.rerender();
    assert.equal(fixture.container.textContent, "");
    assert.equal(adapter.invalidationReason(), "context-changed");

    state.identity = { type: "synchronized", databaseName: "db-a", userDigest: "digest-a" };
    state.document = {
      version: 1,
      subjects: [{ id: "a-late", title: "Projet A tardif", items: [item("late")] }]
    };
    fixture.rerender();
    assert.equal(fixture.container.textContent, "");
    assert.equal(fixture.container.querySelectorAll(".subject").length, 0);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
