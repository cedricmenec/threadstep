import test from "node:test";
import assert from "node:assert/strict";
import { NOTE_MAX_LENGTH } from "../site/core.js";
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

function createHarness({ subjects, transient = {} } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: subjects || [{
        id: "p1",
        title: "Projet A",
        items: [
          item("a", "urgent", false, null, "Note A"),
          item("b", "normal"),
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
      ...transient
    }
  };
  const counts = { persist: 0, render: 0, remove: 0, undo: 0, saveResume: 0 };
  let generated = 0;
  const calls = [];
  const base = createProjectDetailCommands({
    getDocument: () => state.document,
    setDocument: (next) => { state.document = next; },
    persist: () => { counts.persist += 1; },
    render: () => { counts.render += 1; },
    notify: () => {},
    getTransient: () => state.transient,
    setTransient: (patch) => Object.assign(state.transient, patch),
    removeAction: () => { counts.remove += 1; return true; },
    undoAction: () => { counts.undo += 1; return true; },
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

test("TS-065 a valid Overview create writes once, resets the fields and keeps the command singular", async () => {
  const dom = installDeterministicDom();
  try {
    const harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-form");
      const input = form.querySelector("input");
      const select = form.querySelector("select");
      await fixture.act(() => setValue(input, "Nouvelle étape"));
      await fixture.act(() => setValue(select, "urgent"));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, ["createItem"]);
      assert.equal(harness.counts.persist, 1);
      assert.equal(harness.state.document.subjects[0].items.length, 5);
      const created = harness.state.document.subjects[0].items[4];
      assert.equal(created.title, "Nouvelle étape");
      assert.equal(created.priority, "urgent");
      assert.equal(input.value, "");
      assert.equal(select.value, "normal");
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 blank or too-long create titles and the 500-item limit write nothing", async () => {
  const dom = installDeterministicDom();
  try {
    let harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-form");
      const input = form.querySelector("input");
      await fixture.act(() => setValue(input, "   "));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, []);
      assert.equal(harness.counts.persist, 0);
      assert.equal(input.value, "   ");
    });

    harness = createHarness();
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-form");
      const input = form.querySelector("input");
      input.removeAttribute("maxlength");
      await fixture.act(() => setValue(input, "x".repeat(301)));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, ["createItem"]);
      assert.equal(harness.counts.persist, 0);
      assert.equal(harness.state.document.subjects[0].items.length, 4);
    });

    const full = Array.from({ length: 500 }, (_, index) =>
      item("full-" + index, "normal"));
    harness = createHarness({ subjects: [{ id: "p1", title: "Complet", items: full }] });
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-form");
      const input = form.querySelector("input");
      await fixture.act(() => setValue(input, "Une étape de trop"));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, []);
      assert.equal(harness.counts.persist, 0);
      assert.equal(harness.state.document.subjects[0].items.length, 500);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 the inline editor prefills title, priority and note and saves once", async () => {
  const dom = installDeterministicDom();
  try {
    const harness = createHarness({ transient: { editingItemId: "a" } });
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-edit-form");
      const title = form.querySelector(".task-edit-title");
      const priority = form.querySelector(".task-edit-priority");
      const note = form.querySelector(".task-edit-note");
      assert.equal(title.value, "a");
      assert.equal(priority.value, "urgent");
      assert.equal(note.value, "Note A");

      await fixture.act(() => setValue(title, "  A modifié  "));
      await fixture.act(() => setValue(priority, "later"));
      await fixture.act(() => setValue(note, "Nouvelle note"));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, ["updateItem"]);
      assert.equal(harness.counts.persist, 1);
      const updated = harness.state.document.subjects[0].items.find((entry) => entry.id === "a");
      assert.equal(updated.title, "A modifié");
      assert.equal(updated.priority, "later");
      assert.equal(updated.note, "Nouvelle note");
      assert.equal(harness.state.transient.editingItemId, null);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 invalid note or title in the editor writes nothing and shows the French message", async () => {
  const dom = installDeterministicDom();
  try {
    let harness = createHarness({ transient: { editingItemId: "a" } });
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-edit-form");
      const note = form.querySelector(".task-edit-note");
      await fixture.act(() => setValue(note, "n".repeat(NOTE_MAX_LENGTH + 1)));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, []);
      assert.equal(harness.counts.persist, 0);
      assert.match(fixture.container.querySelector(".edit-error").textContent, /La note doit contenir au plus 2000 caractères/);
      assert.equal(harness.state.document.subjects[0].items[0].note, "Note A");
    });

    harness = createHarness({ transient: { editingItemId: "a" } });
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-edit-form");
      const title = form.querySelector(".task-edit-title");
      await fixture.act(() => setValue(title, "   "));
      await fixture.act(() => submit(form));
      assert.deepEqual(harness.calls, []);
      assert.equal(harness.counts.persist, 0);
      assert.match(fixture.container.querySelector(".edit-error").textContent, /Le titre doit contenir entre 1 et 300 caractères/);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 cancelling an edit discards the draft, writes nothing and exposes a focus target", async () => {
  const dom = installDeterministicDom();
  try {
    const harness = createHarness({ transient: { editingItemId: "a" } });
    await withFixture(harness, async (fixture) => {
      const form = fixture.container.querySelector(".task-edit-form");
      const title = form.querySelector(".task-edit-title");
      await fixture.act(() => setValue(title, "Brouillon abandonné"));
      const cancel = [...form.querySelectorAll("button")].find((node) => node.textContent === "Annuler");
      await fixture.act(() => click(cancel));
      assert.deepEqual(harness.calls, ["cancelEdit"]);
      assert.equal(harness.counts.persist, 0);
      assert.equal(harness.state.transient.editingItemId, null);
      assert.equal(harness.state.transient.focusItemId, "a");
      assert.equal(harness.state.document.subjects[0].items[0].title, "a");
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
