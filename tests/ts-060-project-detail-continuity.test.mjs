import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  readingScrollDelta,
  resolveReadingAnchor,
  selectReadingAnchor,
  shouldRestoreInteraction
} from "../site/interaction-continuity.js";
import {
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";

const appSource = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const applyFocusCode = appSource.slice(
  appSource.indexOf("function applyFocus()"),
  appSource.indexOf("function renderSuggestion()")
);
const findFocusCode = appSource.slice(
  appSource.indexOf("function uxContext()"),
  appSource.indexOf("function captureUxContinuity()")
);
const finishRenderCode = appSource.slice(
  appSource.indexOf("function finishUxRender("),
  appSource.indexOf("function replaceSubjectsInCurrentView(")
);
const scrollCode = appSource.slice(
  appSource.indexOf("function restoreUxScroll("),
  appSource.indexOf("function finishUxRender(")
);

function snapshot(overrides = {}) {
  const items = overrides.items || [
    { id: "a", title: "Parent", priority: "urgent", done: false, parentId: null },
    { id: "b", title: "Enfant", priority: "normal", done: false, parentId: "a" },
    { id: "c", title: "Enfant 2", priority: "later", done: false, parentId: "a" },
    { id: "d", title: "Terminée", priority: "later", done: true, parentId: null }
  ];
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: true,
    project: {
      id: "p1",
      title: "Projet",
      pendingCount: overrides.pendingCount === undefined ? items.filter((item) => !item.done).length : overrides.pendingCount,
      metrics: { total: items.length },
      totalTaskCount: items.filter((item) => item.parentId === null).length,
      totalTaskCountLabel: "2 tâches au total",
      urgencyLabel: "",
      progressLabel: ""
    },
    items,
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      ...(overrides.transient || {})
    }
  };
}

function setValue(node, value) {
  const prototype = node.tagName === "TEXTAREA"
    ? globalThis.HTMLTextAreaElement.prototype
    : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
  node.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
}

function focusContext(container, patch = {}) {
  return {
    subjectsEl: container,
    pendingNavigationFocus: null,
    editingItemId: null,
    renamingSubject: false,
    focusDetailHeading: false,
    focusOpenSubjectId: null,
    focusRenameControl: false,
    focusSubjectId: null,
    focusItemId: null,
    pendingCollapseFocus: null,
    pendingPriorityFocus: null,
    pendingMenuFocus: null,
    pendingMoveFocus: null,
    ...patch
  };
}

test("TS-060 an unsaved draft and expanded parents survive a simulated cross-tab refresh", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { editingItemId: "a", expandedParents: ["a"] } }),
      commandNames: ["updateItem", "toggleSubsteps"]
    });
    const fixture = await createSurfaceFixture(adapter);
    const input = fixture.container.querySelector(".task-edit-title");
    await fixture.act(async () => { setValue(input, "Brouillon local non enregistré"); });
    const expanded = fixture.container.querySelector("#substeps-a");
    assert.ok(expanded);
    assert.equal(expanded.children.length, 2);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: [
          { id: "a", title: "Parent rafraîchi", priority: "urgent", done: false, parentId: null },
          { id: "b", title: "Enfant", priority: "normal", done: false, parentId: "a" },
          { id: "c", title: "Enfant 2", priority: "later", done: false, parentId: "a" }
        ],
        transient: { editingItemId: "a", expandedParents: ["a"] }
      }));
    });
    assert.equal(adapter.calls.length, 0);
    assert.equal(fixture.container.querySelector(".task-edit-title").value, "Brouillon local non enregistré");
    assert.equal(fixture.container.querySelector("#substeps-a"), expanded);
    assert.equal(expanded.children.length, 2);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        transient: {
          editingItemId: "a",
          expandedParents: ["a"],
          observingMenu: true,
          hideCompleted: true
        }
      }));
    });
    assert.equal(fixture.container.querySelector(".task-edit-title").value, "Brouillon local non enregistré");
    assert.ok(fixture.container.querySelector("#substeps-a"));
    assert.deepEqual(adapter.calls, []);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-060 focus after save, cancel and move lands on a connected relevant control without writing", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { editingItemId: "a" } }),
      commandNames: ["updateItem", "cancelEdit"]
    });
    const fixture = await createSurfaceFixture(adapter);
    const editor = fixture.container.querySelector(".task-edit-title");
    editor.focus();
    assert.equal(dom.document.activeElement, editor);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ transient: { editingItemId: null, focusItemId: "a" } }));
    });
    const context = focusContext(fixture.container, { focusItemId: "a" });
    runInNewContext(applyFocusCode + "\napplyFocus();", context);
    assert.equal(dom.document.activeElement.isConnected, true);
    assert.ok(dom.document.activeElement.closest('[data-item="a"]'));
    assert.equal(context.focusItemId, null);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: [
          { id: "a", title: "Parent", priority: "urgent", done: false, parentId: null },
          { id: "b", title: "Enfant déplacé", priority: "normal", done: false, parentId: "a" },
          { id: "c", title: "Enfant 2", priority: "later", done: false, parentId: "a" }
        ],
        transient: { edition: "cancel", focusItemId: "a" }
      }));
    });
    const cancelContext = focusContext(fixture.container, { focusItemId: "a" });
    runInNewContext(applyFocusCode + "\napplyFocus();", cancelContext);
    assert.equal(dom.document.activeElement.isConnected, true);
    assert.ok(dom.document.activeElement.closest('[data-item="a"]'));

    const moveContext = focusContext(fixture.container, {
      pendingMoveFocus: { itemId: "a", direction: "up" }
    });
    runInNewContext(applyFocusCode + "\napplyFocus();", moveContext);
    assert.equal(dom.document.activeElement.classList.contains("task-handle"), true);
    assert.ok(dom.document.activeElement.closest('[data-item="a"]'));
    assert.deepEqual(adapter.calls, []);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-060 a removed anchor falls back to a connected neighbour and never to a detached node", () => {
  const dom = installDeterministicDom();
  try {
    dom.document.body.innerHTML = `
      <div id="subjects">
        <section class="subject detail" data-subject="p1" tabindex="-1">
          <form class="task-form" data-subject="p1"><input></form>
          <ul class="tasks">
            <li class="task" data-item="a"><input class="task-check"></li>
          </ul>
        </section>
      </div>`;
    const container = dom.document.querySelector("#subjects");
    const detached = container.querySelector('[data-item="a"] .task-check');
    detached.focus();
    container.querySelector('[data-item="a"]').remove();
    assert.equal(detached.isConnected, false);

    const context = {
      subjectsEl: container,
      route: { view: "subject", subjectId: "p1" },
      bindingGeneration: 1,
      businessAllowed: () => true
    };
    const target = runInNewContext(
      findFocusCode + "\nuxFindFocus({ kind: 'task', subjectId: 'p1', itemId: 'a', control: '.task-check' });",
      context
    );
    assert.ok(target);
    target.focus();
    assert.equal(target.isConnected, true);
    assert.equal(dom.document.activeElement.isConnected, true);
    assert.equal(dom.document.activeElement.classList.contains("task-check"), false);
  } finally {
    dom.cleanup();
  }
});

test("TS-060 a virtual-keyboard creation intent is applied after commit without a write", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot(),
      commandNames: ["createItem"]
    });
    const fixture = await createSurfaceFixture(adapter);
    const field = fixture.container.querySelector(".task-form input");
    assert.ok(field);
    const context = {
      uxRenderVersion: 0,
      pendingTaskCreationFocus: "p1",
      route: { view: "subject", subjectId: "p1" },
      lastRenderedUxContext: null,
      uxContext: () => ({ view: "subject", subjectId: "p1", generation: 1, allowed: true }),
      uxSubject: (id) => [...fixture.container.querySelectorAll(".subject")]
        .find((node) => node.dataset.subject === id) || null
    };
    runInNewContext(finishRenderCode + "\nfinishUxRender(null, false);", context);
    assert.equal(context.pendingTaskCreationFocus, null);
    assert.equal(dom.document.activeElement, field);
    assert.equal(dom.document.activeElement.isConnected, true);
    assert.deepEqual(adapter.calls, []);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-060 a long scrolled list keeps keys, an anchor neighbour and no artificial height", async () => {
  const dom = installDeterministicDom();
  try {
    const longItems = Array.from({ length: 120 }, (_, index) => ({
      id: "i" + index,
      title: "Étape " + index,
      priority: "normal",
      done: false,
      parentId: null
    }));
    const adapter = createStaticAdapter({
      snapshot: snapshot({ items: longItems, pendingCount: 120 }),
      commandNames: []
    });
    const fixture = await createSurfaceFixture(adapter);
    assert.equal(fixture.container.querySelectorAll(".task").length, 120);
    assert.equal(fixture.container.style.minHeight, "");
    const node = fixture.container.querySelector('[data-item="i50"]');
    assert.ok(node);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ items: longItems, pendingCount: 120 }));
    });
    assert.equal(fixture.container.querySelector('[data-item="i50"]'), node);
    assert.equal(fixture.container.style.minHeight, "");
    assert.equal(dom.document.documentElement.style.minHeight, "");

    const before = [
      { key: "task:p1:i49", top: -60, bottom: -10 },
      { key: "task:p1:i50", top: 10, bottom: 60 },
      { key: "task:p1:i51", top: 110, bottom: 160 }
    ];
    const selected = selectReadingAnchor(before, 640);
    assert.equal(selected.key, "task:p1:i50");
    const remaining = ["task:p1:i49", "task:p1:i51"];
    assert.equal(resolveReadingAnchor(before, "task:p1:i50", remaining).key, "task:p1:i51");

    const scrollCalls = [];
    const win = {
      scrollY: 0,
      innerHeight: 640,
      scrollTo({ top, left, behavior }) {
        assert.equal(left, 0);
        assert.equal(behavior, "instant");
        this.scrollY = top;
        scrollCalls.push(top);
      }
    };
    const context = {
      snapshot: {
        context: { view: "subject", subjectId: "p1", generation: 1, allowed: true },
        scrollY: 9300,
        anchors: [{ key: "task:p1:i50", top: 48 }],
        anchorKey: "task:p1:i50"
      },
      window: win,
      uxContext: () => ({ view: "subject", subjectId: "p1", generation: 1, allowed: true }),
      shouldRestoreInteraction,
      uxVisibleAnchors: () => [],
      resolveReadingAnchor,
      readingScrollDelta
    };
    runInNewContext(scrollCode + "\nrestoreUxScroll(snapshot);", context);
    assert.equal(scrollCalls.length, 1);
    assert.equal(scrollCalls[0], 9300);
    assert.notEqual(scrollCalls[0], 0);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: longItems.filter((item) => item.id !== "i50"),
        pendingCount: 119
      }));
    });
    assert.equal(fixture.container.querySelector('[data-item="i50"]'), null);
    assert.equal(fixture.container.querySelectorAll(".task").length, 119);
    assert.equal(fixture.container.style.minHeight, "");
    assert.deepEqual(adapter.calls, []);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
