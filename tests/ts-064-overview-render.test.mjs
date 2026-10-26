import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import {
  OVERVIEW_TEST_COMMANDS,
  compileOverviewSurface,
  createOverviewFixture,
  installDeterministicDom,
  overviewSourceFiles
} from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

function item(id, priority = "normal", done = false, parentId = null, note = null) {
  return { id, title: id, priority, done, parentId, ...(note ? { note } : {}) };
}

function subject(id, items = []) {
  return { id, title: id, items };
}

function documentFixture(subjects) {
  return { version: 1, subjects };
}

function readyPresentation(overrides = {}) {
  return {
    state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
    actionRequired: false,
    projectsAvailable: true,
    ...overrides
  };
}

function makeAdapter({
  document: doc = documentFixture([subject("p1", [item("i1", "urgent")])]),
  route = { view: "overview" },
  identity = { type: "local" },
  allowed = true,
  blocked = false,
  presentation = readyPresentation(),
  transient = {}
} = {}) {
  const state = {
    document: doc,
    route,
    identity,
    allowed,
    blocked,
    presentation,
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

function text(node) {
  return node ? node.textContent : null;
}

test("TS-064 the harness compiles the Overview surface and mounts empty cards", async () => {
  const compiled = await compileOverviewSurface();
  assert.match(compiled.code, /react\/jsx-runtime/);
  assert.equal(typeof compiled.module.createOverviewSurface, "function");
  for (const { name, source } of overviewSourceFiles()) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /\bDexie\b|indexedDB|\bOTP\b|authentication\.js/, name);
    assert.doesNotMatch(code, /from\s+["'][^"']*app\.js["']|from\s+["'][^"']*persistence\.js["']/, name);
    assert.doesNotMatch(code, /\bfetch\s*\(|localStorage|new\s+Dexie|WebSocket/, name);
  }
  const dom = installDeterministicDom();
  try {
    const { adapter } = makeAdapter({ document: documentFixture([]) });
    const fixture = await createOverviewFixture(adapter);
    assert.match(text(fixture.container), /Aucun sujet pour le moment/);
    fixture.unmount();
    assert.equal(fixture.container.childNodes.length, 0);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 the adapter returns frozen detached data, exact labels and no mutation", () => {
  const doc = documentFixture([
    subject("p1", [
      item("done", "normal", true),
      item("urgent", "urgent"),
      item("child", "normal", false, "urgent", "note")
    ]),
    subject("p2", [])
  ]);
  const before = JSON.stringify(doc);
  const { adapter } = makeAdapter({ document: doc });
  const snapshot = adapter.getSnapshot();
  assert.equal(JSON.stringify(doc), before);
  assert.ok(Object.isFrozen(snapshot));
  assert.equal(snapshot.filter, "all");
  assert.deepEqual(snapshot.projects.map((project) => project.id), ["p1", "p2"]);
  assert.equal(snapshot.projects[0].title, "p1");
  assert.equal(snapshot.projects[0].pendingCount, 2);
  assert.equal(snapshot.projects[0].totalTaskCountLabel, "2 tâches au total");
  assert.equal(snapshot.projects[0].urgencyLabel, "1 urgence restante");
  assert.equal(snapshot.projects[0].progressLabel, "1 / 3 étapes terminées (33 %)");
  assert.equal(snapshot.projects[0].canMoveUp, false);
  assert.equal(snapshot.projects[0].canMoveDown, true);
  assert.equal(snapshot.projects[1].canMoveUp, true);
  assert.equal(snapshot.projects[1].canMoveDown, false);
  assert.equal(snapshot.projects[0].items[2].note, "note");
  assert.equal(snapshot.projects[1].progressLabel, "Aucune étape");
  assert.equal(snapshot.projects[1].urgencyLabel, "0 urgence restante");
});

test("TS-064 the adapter applies the project filter while preserving stored order", () => {
  const doc = documentFixture([
    subject("following", [item("plain", "normal")]),
    subject("urgent", [item("urgent", "urgent")]),
    subject("completed", [item("done", "normal", true)]),
    subject("empty", [])
  ]);
  const { adapter, state } = makeAdapter({ document: doc });
  state.transient.projectFilter = "urgent";
  assert.deepEqual(adapter.getSnapshot().projects.map((project) => project.id), ["urgent"]);
  state.transient.projectFilter = "following";
  assert.deepEqual(adapter.getSnapshot().projects.map((project) => project.id), ["following", "urgent"]);
  state.transient.projectFilter = "completed";
  assert.deepEqual(adapter.getSnapshot().projects.map((project) => project.id), ["completed"]);
  state.transient.projectFilter = "all";
  assert.deepEqual(adapter.getSnapshot().projects.map((project) => project.id), [
    "following", "urgent", "completed", "empty"
  ]);
});

test("TS-064 the adapter refuses unavailable contexts without mutating the document", () => {
  const base = documentFixture([subject("p1", [item("i1")])]);
  const before = JSON.stringify(base);
  const scenarios = [
    { options: { allowed: false }, reason: "business-not-allowed" },
    { options: { blocked: true }, reason: "loading-blocked" },
    { options: { identity: null }, reason: "identity-unavailable" },
    { options: { route: { view: "subject", subjectId: "p1" } }, reason: "route-not-overview" },
    {
      options: { presentation: { state: OVERVIEW_PRESENTATION_STATE.AWAITING_READ, actionRequired: false, projectsAvailable: false } },
      reason: "read-unavailable"
    },
    {
      options: { presentation: { state: OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED, actionRequired: true, projectsAvailable: false } },
      reason: "read-unavailable"
    }
  ];
  for (const scenario of scenarios) {
    const { adapter } = makeAdapter({ document: base, ...scenario.options });
    assert.equal(adapter.getSnapshot(), null);
    assert.equal(adapter.isInvalidated(), true);
    assert.equal(adapter.invalidationReason(), scenario.reason);
    assert.equal(JSON.stringify(base), before);
  }
});

test("TS-064 cards keep markup, order, counters and accessible names", async () => {
  const dom = installDeterministicDom();
  try {
    const doc = documentFixture([
      subject("p1", [
        item("later", "later"),
        item("urgent", "urgent"),
        item("child", "normal", false, "urgent"),
        item("normal", "normal")
      ]),
      subject("p2", [])
    ]);
    const { adapter } = makeAdapter({ document: doc });
    const fixture = await createOverviewFixture(adapter);
    const cards = [...fixture.container.querySelectorAll(".subject")];
    assert.equal(cards.length, 2);
    assert.equal(fixture.container.querySelectorAll('[data-react-surface="overview-card"]').length, 2);
    assert.equal(cards[0].dataset.subject, "p1");
    assert.equal(cards[0].getAttribute("aria-label"), "p1");
    assert.equal(cards[0].getAttribute("tabindex"), "-1");
    assert.equal(text(cards[0].querySelector("h3")), "p1");
    const labels = [...cards[0].querySelectorAll(".subject-head > div:first-child > p")].map(text);
    assert.deepEqual(labels, [
      "4 étapes en attente",
      "3 tâches au total",
      "1 urgence restante",
      "0 / 4 étapes terminées (0 %)"
    ]);
    const controls = [...cards[0].querySelectorAll(".subject-controls button")];
    assert.deepEqual(controls.map((node) => node.className), [
      "secondary subject-open",
      "subtle subject-move",
      "subtle subject-move",
      "danger"
    ]);
    assert.deepEqual(controls.map((node) => node.getAttribute("aria-label")), [
      "Ouvrir le projet p1",
      "Monter le sujet p1",
      "Descendre le sujet p1",
      "Supprimer le sujet p1"
    ]);
    const topLevel = [...cards[0].querySelectorAll(".task-area > .tasks > .task")]
      .map((node) => node.dataset.item);
    assert.deepEqual(topLevel, ["urgent", "normal", "later"]);
    assert.equal(cards[0].querySelector(".task-form").dataset.subject, "p1");
    assert.equal(cards[0].querySelector(".task-check").getAttribute("aria-label"), "Terminer urgent");
    assert.equal(
      cards[0].querySelector(".priority-control").getAttribute("aria-label"),
      "Priorité de « urgent » : Urgent"
    );
    assert.match(text(cards[1].querySelector(".empty")), /Aucune étape/);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

function projectWithParents(count, options = {}) {
  const items = [];
  for (const id of options.doneIds || []) {
    items.push(item(id, "normal", true));
  }
  for (let index = 0; index < count; index += 1) {
    items.push(item((options.prefix || "p") + index, "normal", false));
  }
  return subject(options.id || "project", items);
}

test("TS-064 0, 1, 5 and 6 visible parents follow the five-entry quota", async () => {
  const dom = installDeterministicDom();
  try {
    for (const [count, shown, hasMore] of [[0, 0, false], [1, 1, false], [5, 5, false], [6, 5, true]]) {
      const { adapter } = makeAdapter({ document: documentFixture([projectWithParents(count)]) });
      const fixture = await createOverviewFixture(adapter);
      assert.equal(fixture.container.querySelectorAll(".task-area > .tasks > .task").length, shown);
      assert.equal(fixture.container.querySelectorAll(".overview-see-more").length, hasMore ? 1 : 0);
      if (hasMore) {
        assert.equal(
          fixture.container.querySelector(".overview-see-more").getAttribute("aria-label"),
          "Voir plus de tâches pour le projet project"
        );
      }
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 filtering precedes the quota and subtasks never consume a slot", async () => {
  const dom = installDeterministicDom();
  try {
    const doc = documentFixture([
      subject("filtered", [...projectWithParents(6, { doneIds: ["d1", "d2", "d3"] }).items]),
      subject("with-children", [
        item("parent", "normal"),
        item("child1", "normal", false, "parent"),
        item("child2", "normal", false, "parent"),
        item("other1"),
        item("other2"),
        item("other3"),
        item("other4")
      ])
    ]);
    const { adapter, state } = makeAdapter({ document: doc, transient: { hideCompleted: true } });
    let fixture = await createOverviewFixture(adapter);
    const filteredCard = [...fixture.container.querySelectorAll(".subject")]
      .find((node) => node.dataset.subject === "filtered");
    assert.deepEqual(
      [...filteredCard.querySelectorAll(".task-area > .tasks > .task")].map((node) => node.dataset.item),
      ["p0", "p1", "p2", "p3", "p4"]
    );
    assert.equal(filteredCard.querySelectorAll(".overview-see-more").length, 1);
    fixture.unmount();

    const { adapter: childAdapter, state: childState } = makeAdapter({ document: doc });
    fixture = await createOverviewFixture(childAdapter);
    const childCard = [...fixture.container.querySelectorAll(".subject")]
      .find((node) => node.dataset.subject === "with-children");
    assert.equal(childCard.querySelectorAll(".task-area > .tasks > .task").length, 5);
    assert.equal(childCard.querySelectorAll(".overview-see-more").length, 0);
    assert.equal(childCard.querySelectorAll(".task-substep").length, 0);
    childState.transient.expandedParents = ["parent"];
    fixture.rerender();
    assert.equal(childCard.querySelectorAll(".task-substep").length, 2);
    assert.equal(childCard.querySelectorAll(".task-area > .tasks > .task").length, 5);
    assert.equal(childCard.querySelectorAll(".overview-see-more").length, 0);
    fixture.unmount();

    const { adapter: independentAdapter } = makeAdapter({
      document: documentFixture([projectWithParents(6, { id: "long" }), projectWithParents(2, { id: "short" })])
    });
    fixture = await createOverviewFixture(independentAdapter);
    assert.equal(fixture.container.querySelectorAll(".overview-see-more").length, 1);
    assert.equal(
      fixture.container.querySelector(".overview-see-more").getAttribute("aria-label"),
      "Voir plus de tâches pour le projet long"
    );
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 authorized empty and filtered-empty states keep their existing controls", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter } = makeAdapter({ document: documentFixture([]) });
    let fixture = await createOverviewFixture(adapter);
    assert.equal(
      text(fixture.container.querySelector(".empty")),
      "Aucun sujet pour le moment. Ajoutez un premier fil de travail ci-dessus."
    );
    assert.equal(fixture.container.querySelector(".overview-filter-reset"), null);
    fixture.unmount();

    const filtered = makeAdapter({
      document: documentFixture([subject("p1", [item("i1", "normal")])]),
      transient: { projectFilter: "urgent" }
    });
    fixture = await createOverviewFixture(filtered.adapter);
    assert.equal(
      text(fixture.container.querySelector(".filtered-empty-text")),
      "Aucun projet avec urgence en attente"
    );
    const reset = fixture.container.querySelector(".overview-filter-reset");
    assert.equal(text(reset), "Tous les projets");
    reset.dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(filtered.calls, [["resetFilter", []]]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 user markup stays literal text", async () => {
  const dom = installDeterministicDom();
  try {
    const markup = '<img src=x onerror=alert(1)>';
    const doc = documentFixture([{
      id: "p1",
      title: markup,
      items: [item("i1", "urgent", false, null, markup)]
    }]);
    doc.subjects[0].items[0].title = markup;
    const { adapter } = makeAdapter({ document: doc });
    const fixture = await createOverviewFixture(adapter);
    assert.equal(fixture.container.querySelectorAll("img").length, 0);
    assert.equal(text(fixture.container.querySelector("h3")), markup);
    assert.equal(text(fixture.container.querySelector(".task-title")), markup);
    assert.equal(text(fixture.container.querySelector(".task-note")), markup);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 mount, update and unmount leave no tree, listener or duplicate ID", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeAdapter({
      document: documentFixture([subject("p1", [item("i1"), item("i2")])])
    });
    const container = dom.document.createElement("div");
    dom.document.body.append(container);
    let fixture = await createOverviewFixture(adapter, { container });
    assert.equal(adapter.listenerCount(), 1);
    assert.equal(container.querySelectorAll(".subject").length, 1);
    state.document = documentFixture([subject("p1", [item("i1")])]);
    fixture.rerender();
    assert.equal(container.querySelectorAll(".subject").length, 1);
    assert.equal(container.querySelectorAll('.subject[data-subject="p1"]').length, 1);
    fixture.unmount();
    assert.equal(container.childNodes.length, 0);
    assert.equal(adapter.listenerCount(), 0);
    container.remove();

    fixture = await createOverviewFixture(adapter);
    assert.equal(fixture.container.querySelectorAll(".subject").length, 1);
    assert.equal(fixture.container.querySelectorAll(".subject-open").length, 1);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
