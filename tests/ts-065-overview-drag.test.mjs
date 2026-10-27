import test from "node:test";
import assert from "node:assert/strict";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import {
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";
import {
  createStaticAdapter as createDetailAdapter,
  createSurfaceFixture,
  installDeterministicDom as installDetailDom
} from "./helpers/ts-059-project-detail-harness.mjs";

function item(id, priority = "normal", done = false, parentId = null) {
  return { id, title: id, priority, done, parentId };
}

function createHarness({ transient = {} } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: [
        {
          id: "p1",
          title: "Projet A",
          items: [
            item("a"),
            item("b"),
            item("c"),
            item("urgent", "urgent"),
            item("parent"),
            item("child", "normal", false, "parent")
          ]
        },
        { id: "p2", title: "Projet B", items: [item("j")] }
      ]
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
      pendingMoveFocus: null,
      ...transient
    }
  };
  const counts = { persist: 0, render: 0, drag: 0, cancelDrag: 0, saveResume: 0 };
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
    startDragAction: () => { counts.drag += 1; return true; },
    cancelDragAction: () => { counts.cancelDrag += 1; return true; },
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

function pointer(dom, type, { x = 0, y = 0, pointerId = 1, button = 0 } = {}) {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button
  });
  Object.defineProperty(event, "pointerId", { configurable: true, value: pointerId });
  return event;
}

function rowRect(node) {
  const row = node.querySelector(".task-row") || node;
  row.getBoundingClientRect = () => ({
    top: 100, height: 40, bottom: 140, left: 0, right: 320, width: 320
  });
  return row;
}

async function start(fixture, dom, itemId = "a") {
  const handle = fixture.container.querySelector('.task[data-item="' + itemId + '"] .task-handle');
  assert.ok(handle, "handle for " + itemId);
  await fixture.act(() => {
    handle.dispatchEvent(pointer(dom, "pointerdown", { x: 10, y: 110 }));
  });
  return handle;
}

async function moveTo(fixture, dom, itemId, { y = 110, subject = "p1" } = {}) {
  const target = fixture.container.querySelector(
    '.subject[data-subject="' + subject + '"] .task[data-item="' + itemId + '"]'
  );
  assert.ok(target, "target task " + itemId);
  rowRect(target);
  await fixture.act(() => {
    target.dispatchEvent(pointer(dom, "pointermove", { x: 20, y }));
  });
  return target;
}

test("TS-065 React-owned drag shows visual classes, reorders once and clears the indicator", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness();
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const handle = await start(fixture, dom);
    const dragged = fixture.container.querySelector('.task[data-item="a"]');
    assert.match(handle.className, /dragging-handle/);
    assert.match(dragged.className, /\bdragging\b/);
    assert.match(handle.getAttribute("aria-grabbed") || "", /true/);
    assert.equal(harness.counts.drag, 0);
    assert.deepEqual(harness.calls, []);

    const target = await moveTo(fixture, dom, "c", { y: 110 });
    assert.match(target.className, /drop-before/);
    assert.doesNotMatch(target.className, /drop-after/);

    await fixture.act(() => {
      target.dispatchEvent(pointer(dom, "pointerup", { x: 20, y: 110 }));
    });
    assert.deepEqual(harness.calls, ["reorderItem"]);
    assert.equal(harness.counts.persist, 1);
    assert.equal(harness.counts.drag, 0);
    assert.doesNotMatch(handle.className, /dragging-handle/);
    assert.doesNotMatch(dragged.className, /\bdragging\b/);
    assert.doesNotMatch(target.className, /drop-before|drop-after/);
    assert.equal(handle.getAttribute("aria-grabbed"), null);

    fixture.rerender();
    assert.deepEqual(
      [...fixture.container.querySelectorAll('.subject[data-subject="p1"] .task-area > .tasks > .task')]
        .map((node) => node.dataset.item),
      ["urgent", "b", "a", "c", "parent"]
    );
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 drag after-indicator follows the pointer half of the target row", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness();
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    await start(fixture, dom);
    const target = await moveTo(fixture, dom, "c", { y: 130 });
    assert.match(target.className, /drop-after/);
    await fixture.act(() => {
      target.dispatchEvent(pointer(dom, "pointerup", { x: 20, y: 130 }));
    });
    assert.deepEqual(harness.calls, ["reorderItem"]);
    assert.equal(harness.counts.persist, 1);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 other subject, other priority, substep and empty targets reorder and write nothing", async () => {
  const dom = installDeterministicDom();
  const scenarios = [
    { label: "other subject", itemId: "j", subject: "p2", y: 110 },
    { label: "other priority", itemId: "urgent", subject: "p1", y: 110 },
    { label: "substep", itemId: "child", subject: "p1", y: 110 }
  ];
  try {
    for (const scenario of scenarios) {
      const harness = createHarness();
      const fixture = await createOverviewFixture(harness.adapter);
      try {
        await start(fixture, dom);
        const target = await moveTo(fixture, dom, scenario.itemId, {
          subject: scenario.subject, y: scenario.y
        });
        assert.doesNotMatch(target.className, /drop-before|drop-after/, scenario.label);
        await fixture.act(() => {
          target.dispatchEvent(pointer(dom, "pointerup", {
            x: 20, y: scenario.y, pointerId: 1
          }));
        });
        assert.deepEqual(harness.calls, [], scenario.label);
        assert.equal(harness.counts.persist, 0, scenario.label);
      } finally {
        fixture.unmount();
      }
    }

    const harness = createHarness();
    const fixture = await createOverviewFixture(harness.adapter);
    try {
      await start(fixture, dom);
      await fixture.act(() => {
        dom.document.body.dispatchEvent(pointer(dom, "pointerup", { x: 20, y: 110 }));
      });
      assert.deepEqual(harness.calls, []);
      assert.equal(harness.counts.persist, 0);
    } finally {
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 Escape and pointercancel cancel the drag with no command, write or residual class", async () => {
  const dom = installDeterministicDom();
  try {
    for (const mode of ["escape", "pointercancel"]) {
      const harness = createHarness();
      const fixture = await createOverviewFixture(harness.adapter);
      try {
        const handle = await start(fixture, dom);
        const target = await moveTo(fixture, dom, "c");
        assert.match(target.className, /drop-before/);
        if (mode === "escape") {
          await fixture.act(() => {
            dom.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
              key: "Escape", bubbles: true, cancelable: true
            }));
          });
        } else {
          await fixture.act(() => {
            target.dispatchEvent(pointer(dom, "pointercancel", { x: 20, y: 110 }));
          });
        }
        assert.deepEqual(harness.calls, [], mode);
        assert.equal(harness.counts.persist, 0, mode);
        assert.doesNotMatch(target.className, /drop-before|drop-after/, mode);
        assert.doesNotMatch(handle.className, /dragging-handle/, mode);
      } finally {
        fixture.unmount();
      }
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 unmount removes the drag listeners and ignores late pointer events", async () => {
  const dom = installDeterministicDom();
  const harness = createHarness();
  const added = new Set();
  const removed = new Set();
  const originalAdd = dom.window.addEventListener.bind(dom.window);
  const originalRemove = dom.window.removeEventListener.bind(dom.window);
  dom.window.addEventListener = (type, listener, options) => {
    if (type.startsWith("pointer")) added.add(listener);
    return originalAdd(type, listener, options);
  };
  dom.window.removeEventListener = (type, listener, options) => {
    if (type.startsWith("pointer")) removed.add(listener);
    return originalRemove(type, listener, options);
  };
  let fixture;
  try {
    fixture = await createOverviewFixture(harness.adapter);
    await start(fixture, dom);
    assert.ok(added.size >= 3);
    fixture.unmount();
    for (const listener of added) {
      assert.ok(removed.has(listener), "pointer listener removed");
    }
    await fixture.act(() => {
      dom.window.dispatchEvent(pointer(dom, "pointermove", { x: 20, y: 110 }));
      dom.window.dispatchEvent(pointer(dom, "pointerup", { x: 20, y: 110 }));
    });
    assert.deepEqual(harness.calls, []);
    assert.equal(harness.counts.persist, 0);
  } finally {
    if (fixture) fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-065 the detail drag path still calls startDrag exactly once when no session is supplied", async () => {
  const dom = installDetailDom();
  try {
    const adapter = createDetailAdapter({
      snapshot: {
        view: "subject",
        subjectId: "p1",
        readOnly: true,
        project: {
          id: "p1",
          title: "Projet",
          pendingCount: 1,
          metrics: { total: 1 },
          totalTaskCount: 1,
          totalTaskCountLabel: "1 tâche au total",
          urgencyLabel: "",
          progressLabel: ""
        },
        items: [item("a")],
        transient: {
          expandedParents: [],
          openMenuId: null,
          editingItemId: null,
          renamingSubject: false,
          hideCompleted: false,
          trackedItemId: null,
          revealItemId: null
        }
      },
      commandNames: ["startDrag", "cancelDrag"]
    });
    const fixture = await createSurfaceFixture(adapter);
    try {
      const handle = fixture.container.querySelector(".task-handle");
      await fixture.act(() => {
        handle.dispatchEvent(pointer(dom, "pointerdown", { x: 10, y: 110 }));
      });
      assert.equal(adapter.calls.length, 1);
      assert.equal(adapter.calls[0][0], "startDrag");
      assert.equal(adapter.calls[0][1][0], "p1");
      assert.equal(adapter.calls[0][1][1], "a");
    } finally {
      fixture.unmount();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
