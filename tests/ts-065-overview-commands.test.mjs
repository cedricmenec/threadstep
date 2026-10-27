import test from "node:test";
import assert from "node:assert/strict";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import {
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";

function item(id, priority = "normal", done = false, parentId = null, note = null) {
  return { id, title: id, priority, done, parentId, ...(note === null ? {} : { note }) };
}

function readyPresentation() {
  return {
    state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
    actionRequired: false,
    projectsAvailable: true
  };
}

function createHarness({ subjects, transient = {} } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: subjects || [{
        id: "p1",
        title: "Projet A",
        items: [
          item("a", "normal"),
          item("b", "normal"),
          item("c", "urgent"),
          item("parent", "normal"),
          item("child", "normal", false, "parent"),
          item("done", "later", true)
        ]
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
      pendingCollapseFocus: null,
      pendingPriorityFocus: null,
      pendingMenuFocus: null,
      pendingMoveFocus: null,
      pendingTaskCreationFocus: null,
      focusOpenSubjectId: null,
      ...transient
    }
  };
  const context = {
    route: { view: "overview" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    presentation: readyPresentation()
  };
  const counts = {
    persist: 0, render: 0, remove: 0, undo: 0, drag: 0, cancelDrag: 0,
    navigate: 0, saveResume: 0, prompt: 0
  };
  const notices = [];
  let generated = 0;
  const baseCommands = createProjectDetailCommands({
    getDocument: () => state.document,
    setDocument: (next) => { state.document = next; },
    persist: () => { counts.persist += 1; },
    render: () => { counts.render += 1; },
    notify: (message) => notices.push(message),
    getTransient: () => state.transient,
    setTransient: (patch) => Object.assign(state.transient, patch),
    removeAction: () => { counts.remove += 1; return true; },
    undoAction: () => { counts.undo += 1; return true; },
    startDragAction: () => { counts.drag += 1; return true; },
    cancelDragAction: () => { counts.cancelDrag += 1; return true; },
    navigate: () => { counts.navigate += 1; },
    promptText: () => { counts.prompt += 1; return "Sous-étape"; },
    randomId: () => "generated-" + (generated += 1),
    getResumeRef: () => null,
    setResumeRef: () => {},
    saveResumePreference: () => { counts.saveResume += 1; return Promise.resolve(true); }
  });
  const calls = [];
  const commands = {};
  for (const [name, value] of Object.entries(baseCommands)) {
    commands[name] = typeof value === "function"
      ? (...args) => {
        calls.push(name);
        return value(...args);
      }
      : value;
  }
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => context.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => context.identity,
    isBusinessAllowed: () => context.allowed,
    isLoadingBlocked: () => context.blocked,
    getPresentation: () => context.presentation,
    commands
  });
  return { state, context, counts, notices, calls, commands, adapter };
}

function click(node) {
  node.dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
}

function setValue(node, value) {
  const prototype = node.tagName === "SELECT"
    ? globalThis.HTMLSelectElement.prototype
    : node.tagName === "TEXTAREA"
      ? globalThis.HTMLTextAreaElement.prototype
      : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
  node.dispatchEvent(new globalThis.Event(
    node.tagName === "SELECT" ? "change" : "input",
    { bubbles: true }
  ));
}

function submit(form) {
  form.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
}

async function withFixture(harness, run) {
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    await run(fixture);
  } finally {
    fixture.unmount();
  }
}

test("TS-065 valid create, edit, priority and completion each emit one command and at most one write", async () => {
  const dom = installDeterministicDom();
  try {
    let harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector('.subject[data-subject="p1"] .task-form');
      const input = form.querySelector("input");
      await fixture.act(() => setValue(input, "Nouvelle étape"));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls.filter((name) => name === "createItem"), ["createItem"]);
      assert.equal(harness.counts.persist, 1);
      assert.equal(harness.state.document.subjects[0].items.length, 7);
      assert.equal(input.value, "");
    });

    harness = createHarness({ transient: { editingItemId: "b" } });
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-edit-form");
      await fixture.act(() => setValue(form.querySelector(".task-edit-title"), "B modifié"));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls.filter((name) => name === "updateItem"), ["updateItem"]);
      assert.equal(harness.counts.persist, 1);
      assert.equal(harness.state.document.subjects[0].items.find((entry) => entry.id === "b").title, "B modifié");
    });

    harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const select = fixture.container.querySelector('.task[data-item="a"] .priority-control');
      await fixture.act(() => setValue(select, "later"));
      assert.deepEqual(harness.calls.filter((name) => name === "setPriority"), ["setPriority"]);
      assert.equal(harness.counts.persist, 1);
    });

    harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const check = fixture.container.querySelector('.task[data-item="a"] .task-check');
      await fixture.act(() => click(check));
      assert.deepEqual(harness.calls.filter((name) => name === "toggleItem"), ["toggleItem"]);
      assert.equal(harness.counts.persist, 1);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 opening or closing a menu and collapsing a parent write nothing", async () => {
  const dom = installDeterministicDom();
  try {
    let harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const button = fixture.container.querySelector('.task[data-item="a"] .task-menu-button');
      await fixture.act(() => click(button));
      assert.deepEqual(harness.calls, ["openItemMenu"]);
      assert.equal(harness.counts.persist, 0);
    });

    harness = createHarness({ transient: { openMenuId: "a" } });
    await withFixture(harness, async (fixture) => {
      const button = fixture.container.querySelector('.task[data-item="a"] .task-menu-button');
      await fixture.act(() => click(button));
      assert.deepEqual(harness.calls, ["closeItemMenu"]);
      assert.equal(harness.counts.persist, 0);
    });

    harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const toggle = fixture.container.querySelector('.task[data-item="parent"] .task-toggle');
      await fixture.act(() => click(toggle));
      assert.deepEqual(harness.calls, ["toggleSubsteps"]);
      assert.equal(harness.counts.persist, 0);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 menu edit, removal and tracking each delegate exactly one named command without a write", async () => {
  const dom = installDeterministicDom();
  try {
    let harness = createHarness({ transient: { openMenuId: "a" } });
    await withFixture(harness, async (fixture) => {
      await fixture.act(() => click(fixture.container.querySelector(".task-menu-edit")));
      assert.deepEqual(harness.calls, ["runMenuCommand"]);
      assert.equal(harness.counts.persist, 0);
      assert.equal(harness.state.transient.editingItemId, "a");
    });

    harness = createHarness({ transient: { openMenuId: "a" } });
    await withFixture(harness, async (fixture) => {
      await fixture.act(() => click(fixture.container.querySelector(".task-menu-remove")));
      assert.deepEqual(harness.calls, ["runMenuCommand"]);
      assert.equal(harness.counts.remove, 1);
      assert.equal(harness.counts.persist, 0);
    });

    harness = createHarness({ transient: { openMenuId: "a" } });
    await withFixture(harness, async (fixture) => {
      await fixture.act(() => click(fixture.container.querySelector(".task-menu-keep-track")));
      assert.deepEqual(harness.calls, ["runMenuCommand"]);
      assert.equal(harness.counts.saveResume, 1);
      assert.equal(harness.counts.persist, 0);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 undo is a single delegated intention with no persistence in Overview", async () => {
  const dom = installDeterministicDom();
  try {
    const harness = createHarness();
    await withFixture(harness, async () => {
      await harness.adapter.commands.undoRemoval();
      assert.deepEqual(harness.calls, ["undoRemoval"]);
      assert.equal(harness.counts.undo, 1);
      assert.equal(harness.counts.persist, 0);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 commands refused by the controller stay write-free", async () => {
  const dom = installDeterministicDom();
  try {
    const harness = createHarness();
    await withFixture(harness, async () => {
      assert.equal(harness.adapter.commands.updateItem("p1", "missing", {
        title: "Inconnu", priority: "normal"
      }), false);
      assert.equal(harness.adapter.commands.setPriority("p1", "a", "normal"), false);
      assert.equal(harness.adapter.commands.toggleItem("p1", "a", false), false);
      assert.equal(harness.adapter.commands.reorderItem("p1", "a", "a", "before"), false);
      assert.equal(harness.counts.persist, 0);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
