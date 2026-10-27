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

function createHarness({ transient = {} } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: [{
        id: "p1",
        title: "Projet A",
        items: [
          item("a", "normal", false, null, "Note A"),
          item("b", "normal"),
          item("c", "urgent"),
          item("parent", "normal"),
          item("child", "normal", false, "parent")
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
      ...transient
    }
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
  return { state, counts, calls, adapter };
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

function click(node) {
  node.dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
}

function refreshedDocument(state) {
  const subject = state.document.subjects[0];
  return {
    version: 1,
    subjects: [{
      ...subject,
      items: [...subject.items, item("late", "normal")]
    }]
  };
}

test("TS-065 a focused editor keeps its node, unsaved title and note across a same-context refresh", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness({ transient: { editingItemId: "a" } });
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const title = fixture.container.querySelector(".task-edit-title");
    const note = fixture.container.querySelector(".task-edit-note");
    title.focus();
    await fixture.act(() => setValue(title, "Titre brouillon"));
    await fixture.act(() => setValue(note, "Note brouillon"));

    harness.state.document = refreshedDocument(harness.state);
    fixture.rerender();

    assert.equal(fixture.container.querySelector(".task-edit-title"), title);
    assert.equal(fixture.container.querySelector(".task-edit-note"), note);
    assert.equal(title.isConnected, true);
    assert.equal(note.isConnected, true);
    assert.equal(title.value, "Titre brouillon");
    assert.equal(note.value, "Note brouillon");
    assert.equal(dom.document.activeElement, title);
    assert.equal(harness.counts.persist, 0);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 a create-form draft survives a same-context refresh without a write", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness();
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const input = fixture.container.querySelector(".task-form input");
    const select = fixture.container.querySelector(".task-form select");
    input.focus();
    await fixture.act(() => setValue(input, "Brouillon de création"));
    await fixture.act(() => setValue(select, "later"));

    harness.state.document = refreshedDocument(harness.state);
    fixture.rerender();

    assert.equal(fixture.container.querySelector(".task-form input"), input);
    assert.equal(input.value, "Brouillon de création");
    assert.equal(select.value, "later");
    assert.equal(dom.document.activeElement, input);
    assert.equal(harness.counts.persist, 0);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 an open menu, expanded parent, focused command and scroll anchor survive an update", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness({ transient: { openMenuId: "a", expandedParents: new Set(["parent"]) } });
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const card = fixture.container.querySelector('.subject[data-subject="p1"]');
    const menu = fixture.container.querySelector("#task-menu-a");
    const childList = fixture.container.querySelector("#substeps-parent");
    const edit = menu.querySelector(".task-menu-edit");
    edit.focus();
    dom.window.scrollY = 640;
    card.getBoundingClientRect = () => ({ top: -120, bottom: 480, height: 600 });

    harness.state.document = refreshedDocument(harness.state);
    fixture.rerender();

    assert.equal(fixture.container.querySelector("#task-menu-a"), menu);
    assert.equal(menu.isConnected, true);
    assert.equal(fixture.container.querySelector("#substeps-parent"), childList);
    assert.equal(childList.isConnected, true);
    assert.equal(dom.document.activeElement, edit);
    assert.equal(edit.isConnected, true);
    assert.equal(dom.window.scrollY, 640);
    assert.equal(harness.counts.persist, 0);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 completion, priority and collapse keep focus on a connected control without writing", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness();
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const check = fixture.container.querySelector('.task[data-item="a"] .task-check');
    check.focus();
    await fixture.act(() => click(check));
    fixture.rerender();
    assert.equal(dom.document.activeElement, check);
    assert.equal(check.isConnected, true);

    const select = fixture.container.querySelector('.task[data-item="c"] .priority-control');
    select.focus();
    await fixture.act(() => setValue(select, "later"));
    fixture.rerender();
    assert.equal(dom.document.activeElement, select);
    assert.equal(select.isConnected, true);

    const toggle = fixture.container.querySelector('.task[data-item="parent"] .task-toggle');
    toggle.focus();
    await fixture.act(() => click(toggle));
    fixture.rerender();
    assert.equal(dom.document.activeElement, toggle);
    assert.equal(toggle.isConnected, true);
    assert.equal(harness.counts.persist, 2);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 cancel and reorder expose a present focus target without an extra write", async () => {
  const dom = installDeterministicDom();
  try {
    let harness = createHarness({ transient: { editingItemId: "a" } });
    let fixture = await createOverviewFixture(harness.adapter);
    try {
      const form = fixture.container.querySelector(".task-edit-form");
      const cancel = [...form.querySelectorAll("button")].find((node) => node.textContent === "Annuler");
      await fixture.act(() => click(cancel));
      fixture.rerender();
      assert.equal(harness.state.transient.focusItemId, "a");
      const row = fixture.container.querySelector('.task[data-item="a"]');
      assert.ok(row);
      assert.ok(row.querySelector(".task-check").isConnected);
      assert.equal(harness.counts.persist, 0);
    } finally {
      fixture.unmount();
    }

    harness = createHarness();
    fixture = await createOverviewFixture(harness.adapter);
    try {
      await harness.adapter.commands.reorderItem("p1", "b", "a", "before");
      fixture.rerender();
      assert.deepEqual(harness.state.transient.pendingMoveFocus, { itemId: "b", direction: null });
      const handle = fixture.container.querySelector('.task[data-item="b"] .task-handle');
      assert.ok(handle);
      assert.equal(handle.isConnected, true);
      assert.equal(harness.counts.persist, 1);
    } finally {
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
