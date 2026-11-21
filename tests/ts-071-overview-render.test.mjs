import test from "node:test";
import assert from "node:assert/strict";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import {
  OVERVIEW_TEST_COMMANDS,
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";

function item(id, { done = false, parentId = null, priority = "normal", note = null } = {}) {
  return { id, title: id, done, parentId, priority, ...(note === null ? {} : { note }) };
}

function model(items, { hideCompleted = false, expandedParents = [] } = {}) {
  const state = {
    document: { version: 1, subjects: [
      { id: "project-1", title: "Projet réel", items },
      { id: "project-2", title: "Projet voisin", items: [] }
    ] },
    transient: { hideCompleted, expandedParents, openMenuId: null, editingItemId: null, trackedItemId: null, revealItemId: null, projectFilter: "all" }
  };
  const calls = [];
  const commands = Object.fromEntries(OVERVIEW_TEST_COMMANDS.map((name) => [name, (...args) => {
    calls.push([name, args]);
    return true;
  }]));
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => ({ view: "overview" }),
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => ({ type: "local" }),
    isBusinessAllowed: () => true,
    isLoadingBlocked: () => false,
    getPresentation: () => ({
      state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
      actionRequired: false,
      projectsAvailable: true
    }),
    commands
  });
  return { state, calls, adapter };
}

test("TS-071 card renders real metrics, one open command and no illustrative metadata", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = model([
      item("Urgent", { priority: "urgent", note: "<script>alert(1)</script>" }),
      item("Child", { parentId: "Urgent" })
    ], { expandedParents: ["Urgent"] });
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector(".overview-project-card");
    assert.equal(card.getAttribute("aria-labelledby"), card.querySelector("h3").id);
    assert.equal(card.querySelector("h3").textContent, "Projet réel");
    assert.deepEqual([...card.querySelectorAll(".project-metrics li")].map((node) => node.textContent), [
      "2 étapes en attente", "1 tâche au total", "1 urgence restante", "0 / 2 étapes terminées (0 %)"
    ]);
    assert.equal(card.querySelectorAll(".subject-open").length, 1);
    assert.equal(card.querySelector(".project-stitch-metadata"), null);
    assert.equal(card.querySelector("[aria-label='Partage, indisponible']"), null);
    assert.equal(card.querySelector("[aria-label='Archivage, indisponible']"), null);
    assert.equal(card.querySelector("script"), null);
    assert.equal(card.querySelector(".task-note").textContent, "<script>alert(1)</script>");
    fixture.act(() => card.querySelector(".subject-open").click());
    assert.deepEqual(calls, [["openProject", ["project-1"]]]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-071 project action details keep move and removal controls unique", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = model([item("A"), item("B")]);
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector(".overview-project-card");
    const summary = card.querySelector(".subject-actions > summary");
    assert.equal(summary.getAttribute("aria-label"), "Actions du projet Projet réel");
    fixture.act(() => summary.click());
    assert.equal(card.querySelectorAll('[aria-label="Monter le projet Projet réel"]').length, 1);
    assert.equal(card.querySelectorAll('[aria-label="Descendre le projet Projet réel"]').length, 1);
    assert.equal(card.querySelectorAll('[aria-label="Supprimer le projet Projet réel"]').length, 1);
    fixture.act(() => card.querySelector('[aria-label="Descendre le projet Projet réel"]').click());
    fixture.act(() => card.querySelector('[aria-label="Supprimer le projet Projet réel"]').click());
    assert.deepEqual(calls, [
      ["moveProject", ["project-1", "down"]],
      ["removeProject", ["project-1"]]
    ]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-071 empty project exposes its creation form", async () => {
  const dom = installDeterministicDom();
  try {
    const empty = model([]);
    const emptyFixture = await createOverviewFixture(empty.adapter);
    assert.equal(emptyFixture.container.querySelector(".overview-project-empty")?.textContent,
      "Aucune tâche dans ce projet.");
    assert.equal(emptyFixture.container.querySelector(".overview-project-filtered-empty"), null);
    assert.ok(emptyFixture.container.querySelector(".overview-project-footer .task-form"));
    emptyFixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-071 filter-hidden task state is not presented as an empty project", async () => {
  const dom = installDeterministicDom();
  try {
    const filtered = model([item("Terminé", { done: true })], { hideCompleted: true });
    const fixture = await createOverviewFixture(filtered.adapter);
    const card = fixture.container.querySelector(".overview-project-card");
    assert.equal(card.querySelector(".overview-project-empty"), null);
    assert.match(card.querySelector(".overview-project-filtered-empty")?.textContent,
      /masquées par le filtre/);
    assert.equal(card.querySelector(".task-parent"), null);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-071 preview and subtask rules remain 0/1/5/6 parents, with one See More", async () => {
  const dom = installDeterministicDom();
  try {
    for (const count of [0, 1, 5, 6]) {
      const items = Array.from({ length: count }, (_, index) => item("task-" + index));
      if (count >= 1) items.push(item("child", { parentId: "task-0" }));
      const fixture = await createOverviewFixture(model(items, { expandedParents: count ? ["task-0"] : [] }).adapter);
      const card = fixture.container.querySelector(".overview-project-card");
      assert.equal(card.querySelectorAll(".task-parent").length, Math.min(count, 5), String(count));
      assert.equal(card.querySelectorAll(".task-substep").length, count ? 1 : 0, String(count));
      assert.equal(card.querySelectorAll(".overview-see-more").length, count > 5 ? 1 : 0, String(count));
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
