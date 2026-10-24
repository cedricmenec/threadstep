import test from "node:test";
import assert from "node:assert/strict";
import {
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";

function snapshot(overrides = {}) {
  const items = overrides.items || [
    { id: "a", title: "Parent", priority: "urgent", done: false, parentId: null },
    { id: "b", title: "Enfant", priority: "normal", done: false, parentId: "a" },
    { id: "c", title: "Terminée", priority: "later", done: true, parentId: null }
  ];
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: true,
    project: {
      id: "p1",
      title: "Projet",
      pendingCount: overrides.pendingCount === undefined ? 2 : overrides.pendingCount,
      metrics: { total: items.length },
      totalTaskCount: 2,
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

test("TS-059 an unsaved draft survives an authorized refresh and a data update", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { editingItemId: "a" } }),
      commandNames: ["updateItem"]
    });
    const fixture = await createSurfaceFixture(adapter);
    const input = fixture.container.querySelector(".task-edit-title");
    await fixture.act(async () => {
      setValue(input, "Brouillon non enregistré");
    });
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: [
          { id: "a", title: "Parent renommé", priority: "urgent", done: false, parentId: null },
          { id: "b", title: "Enfant", priority: "normal", done: false, parentId: "a" }
        ],
        transient: { editingItemId: "a" }
      }));
    });
    assert.equal(fixture.container.querySelector(".task-edit-title").value, "Brouillon non enregistré");
    assert.deepEqual(adapter.calls, []);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-059 expanded parents survive refresh and the completed filter stays transparent", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { expandedParents: ["a"] } })
    });
    const fixture = await createSurfaceFixture(adapter);
    assert.ok(fixture.container.querySelector("#substeps-a"));
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ transient: { expandedParents: ["a"] } }));
    });
    assert.ok(fixture.container.querySelector("#substeps-a"));
    assert.equal(fixture.container.querySelector("#substeps-a").children.length, 1);

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ transient: { expandedParents: ["a"], hideCompleted: true } }));
    });
    assert.equal(fixture.container.querySelector('[data-item="c"]'), null);
    assert.ok(fixture.container.querySelector('[data-item="b"]'));

    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: [
          { id: "a", title: "Parent", priority: "urgent", done: false, parentId: null },
          { id: "b", title: "Enfant terminé", priority: "normal", done: true, parentId: "a" }
        ],
        transient: { expandedParents: ["a"], hideCompleted: true }
      }));
    });
    assert.equal(fixture.container.querySelector("#substeps-a"), null);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-059 keyboard focus stays on a connected control across refresh and reorder", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot({ transient: { expandedParents: ["a"] } }) });
    const fixture = await createSurfaceFixture(adapter);
    const check = fixture.container.querySelector('[data-item="a"] .task-check');
    check.focus();
    assert.equal(dom.document.activeElement, check);
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: [
          { id: "b", title: "Enfant", priority: "normal", done: false, parentId: "a" },
          { id: "a", title: "Parent", priority: "urgent", done: false, parentId: null }
        ],
        transient: { expandedParents: ["a"] }
      }));
    });
    assert.equal(dom.document.activeElement.isConnected, true);
    assert.equal(dom.document.activeElement.closest('[data-item="a"]') !== null, true);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-059 a long list keeps stable keys, no artificial height and a bounded removal", async () => {
  const dom = installDeterministicDom();
  try {
    const longItems = Array.from({ length: 120 }, (_, index) => ({
      id: "i" + index,
      title: "Étape " + index,
      priority: "normal",
      done: false,
      parentId: null
    }));
    const adapter = createStaticAdapter({ snapshot: snapshot({ items: longItems, pendingCount: 120 }) });
    const fixture = await createSurfaceFixture(adapter);
    assert.equal(fixture.container.querySelectorAll(".task").length, 120);
    assert.equal(fixture.container.style.minHeight, "");
    const node = fixture.container.querySelector('[data-item="i50"]');
    assert.ok(node);
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({
        items: longItems.map((item) => item.id === "i50" ? { ...item, title: "Étape modifiée" } : item),
        pendingCount: 120
      }));
    });
    assert.equal(fixture.container.querySelector('[data-item="i50"]'), node);
    assert.equal(dom.document.documentElement.style.minHeight, "");
    await fixture.act(async () => {
      adapter.setSnapshot(snapshot({ items: longItems.filter((item) => item.id !== "i50"), pendingCount: 119 }));
    });
    assert.equal(fixture.container.querySelector('[data-item="i50"]'), null);
    assert.equal(fixture.container.querySelectorAll(".task").length, 119);
    assert.equal(fixture.container.style.minHeight, "");
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-059 navigation unmounts drafts, menus and expansion without writing", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { editingItemId: "a", openMenuId: "c", expandedParents: ["a"] } })
    });
    const fixture = await createSurfaceFixture(adapter);
    assert.ok(fixture.container.querySelector(".task-edit-form"));
    assert.ok(fixture.container.querySelector(".task-menu"));
    fixture.unmount();
    assert.equal(fixture.container.querySelectorAll("*").length, 0);
    assert.deepEqual(adapter.calls, []);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
