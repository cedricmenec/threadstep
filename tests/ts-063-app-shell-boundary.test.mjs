import test from "node:test";
import assert from "node:assert/strict";
import { createReactBoundary, reactBoundaryKey } from "../site/react-boundary.js";
import {
  createShellFixture,
  installDeterministicDom
} from "./helpers/ts-063-app-shell-harness.mjs";
import {
  createStaticAdapter,
  createSurfaceFixture
} from "./helpers/ts-059-project-detail-harness.mjs";

function detailSnapshot(overrides = {}) {
  const items = overrides.items || [
    { id: "a", title: "Tâche visible", priority: "urgent", done: false, parentId: null }
  ];
  return {
    view: "subject",
    subjectId: overrides.subjectId || "p1",
    readOnly: true,
    project: {
      id: overrides.subjectId || "p1",
      title: overrides.title || "Projet courant",
      pendingCount: items.filter((item) => !item.done).length,
      metrics: { total: items.length },
      totalTaskCount: items.length,
      totalTaskCountLabel: items.length + " tâches au total",
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

function detailKey({ subjectId = "p1", identity = "local", blocked = false } = {}) {
  return reactBoundaryKey({
    view: "subject",
    subjectId,
    identity: identity + (blocked ? "|blocked" : "")
  });
}

function shellKey({ view = "overview", section = "", subjectId = "", identity = "local", blocked = false } = {}) {
  return [view, section, subjectId, identity, blocked ? "blocked" : "allowed"].join("|");
}

async function mountDetail(boundary, adapter) {
  const fixture = await createSurfaceFixture(adapter);
  const key = detailKey({ subjectId: adapter.getSnapshot().subjectId });
  const mounted = boundary.mount({
    key,
    container: fixture.container,
    unmount: () => fixture.surface.unmount()
  });
  assert.equal(mounted.status, "mounted");
  return { fixture, key, mounted };
}

async function mountShell(boundary, key, initialState = {}) {
  const fixture = await createShellFixture({
    initialState: { open: false, route: { view: "overview" }, ...initialState }
  });
  const mounted = boundary.mount({
    key,
    container: fixture.container,
    unmount: () => fixture.surface.unmount()
  });
  assert.equal(mounted.status, "mounted");
  return { fixture, key, mounted };
}

test("TS-063 shell and detail own two distinct containers with one owner each", async () => {
  const dom = installDeterministicDom();
  try {
    const shellBoundary = createReactBoundary();
    const detailBoundary = createReactBoundary();
    const adapter = createStaticAdapter({
      snapshot: detailSnapshot(),
      commandNames: ["removeItem", "undoRemoval", "updateItem"]
    });
    const detail = await mountDetail(detailBoundary, adapter);
    const shell = await mountShell(shellBoundary, shellKey());

    assert.notEqual(shell.fixture.container, detail.fixture.container);
    assert.equal(shellBoundary.activeCount() + detailBoundary.activeCount(), 2);
    assert.equal(shellBoundary.owns(shell.fixture.container), true);
    assert.equal(detailBoundary.owns(detail.fixture.container), true);
    assert.equal(shellBoundary.owns(detail.fixture.container), false);
    assert.equal(detailBoundary.owns(shell.fixture.container), false);
    assert.equal(shellBoundary.canWriteVanilla(shell.fixture.container), false);
    assert.equal(detailBoundary.canWriteVanilla(detail.fixture.container), false);
    assert.equal(detail.fixture.container.querySelectorAll('[data-react-surface="project-detail"]').length, 1);
    assert.equal(adapter.listenerCount(), 1);
    assert.equal(shell.fixture.container.querySelectorAll("#nav-menu-button").length, 1);

    detail.fixture.unmount();
    shell.fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-063 repeated route and identity cycles never accumulate owners or listeners", async () => {
  const dom = installDeterministicDom();
  try {
    const shellBoundary = createReactBoundary();
    const detailBoundary = createReactBoundary();
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const adapter = createStaticAdapter({
        snapshot: detailSnapshot({ subjectId: "p" + cycle, title: "Projet " + cycle }),
        commandNames: ["removeItem"]
      });
      const detail = await mountDetail(detailBoundary, adapter);
      const shell = await mountShell(shellBoundary, shellKey({
        view: "subject",
        subjectId: "p" + cycle,
        identity: "local",
        blocked: cycle % 3 === 0
      }));

      assert.ok(shellBoundary.activeCount() <= 1);
      assert.ok(detailBoundary.activeCount() <= 1);
      assert.ok(shellBoundary.activeCount() + detailBoundary.activeCount() <= 2);
      assert.equal(adapter.listenerCount(), 1);

      const refused = shellBoundary.mount({
        key: "other",
        container: detail.fixture.container,
        unmount() { throw new Error("second owner must be refused"); }
      });
      assert.equal(refused.status, "refused");
      assert.equal(shellBoundary.activeCount(), 1);

      if (cycle % 2 === 0) {
        shell.mounted.invalidate("navigation");
        assert.equal(shell.fixture.container.childNodes.length, 0);
        assert.equal(shellBoundary.canWriteVanilla(shell.fixture.container), true);
        assert.equal(detailBoundary.owns(detail.fixture.container), true);
        assert.equal(adapter.listenerCount(), 1);
        detail.mounted.release("detail-navigation");
      } else {
        detail.mounted.release("detail-navigation");
        assert.equal(detail.fixture.container.childNodes.length, 0);
        assert.equal(shellBoundary.owns(shell.fixture.container), true);
        shell.mounted.release("navigation");
      }
      assert.equal(shellBoundary.activeCount() + detailBoundary.activeCount(), 0);
      assert.equal(adapter.listenerCount(), 0);
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-063 identity and blocking boundaries release before vanilla and hide previous content", async () => {
  const dom = installDeterministicDom();
  try {
    const detailBoundary = createReactBoundary();
    const shellBoundary = createReactBoundary();
    const adapter = createStaticAdapter({
      snapshot: detailSnapshot({ subjectId: "secret", title: "Projet confidentiel" }),
      commandNames: ["removeItem"]
    });
    const detail = await mountDetail(detailBoundary, adapter);
    let shell = await mountShell(shellBoundary, shellKey({ view: "subject", subjectId: "secret", identity: "identity-a" }));
    assert.match(detail.fixture.container.textContent, /Projet confidentiel/);

    // Identity change: release both surfaces before the vanilla renderer may
    // rewrite either container.
    detail.mounted.invalidate("identity-change");
    shell.mounted.invalidate("identity-change");
    assert.equal(detailBoundary.canWriteVanilla(detail.fixture.container), true);
    assert.equal(shellBoundary.canWriteVanilla(shell.fixture.container), true);
    detail.fixture.container.replaceChildren();
    shell.fixture.container.replaceChildren();
    assert.equal(detail.fixture.container.textContent.includes("Projet confidentiel"), false);
    assert.equal(shell.fixture.container.textContent.includes("Projet confidentiel"), false);

    const nextAdapter = createStaticAdapter({ snapshot: detailSnapshot({ subjectId: "p2", title: "Projet B" }) });
    const nextDetail = await mountDetail(detailBoundary, nextAdapter);
    shell = await mountShell(shellBoundary, shellKey({ identity: "identity-b", blocked: true }));
    assert.match(nextDetail.fixture.container.textContent, /Projet B/);
    assert.doesNotMatch(nextDetail.fixture.container.textContent, /Projet confidentiel/);
    assert.equal(shell.fixture.container.querySelectorAll("#nav-menu-button").length, 1);

    nextDetail.fixture.unmount();
    shell.fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-063 opening and closing the shell menu leaves the detail intact", async () => {
  const dom = installDeterministicDom();
  try {
    const detailBoundary = createReactBoundary();
    const shellBoundary = createReactBoundary();
    const snapshot = detailSnapshot({
      transient: { editingItemId: "a" }
    });
    const adapter = createStaticAdapter({
      snapshot,
      commandNames: ["removeItem", "undoRemoval", "updateItem"]
    });
    const detail = await mountDetail(detailBoundary, adapter);
    const root = detail.fixture.container.querySelector('[data-react-surface="project-detail"]');
    const input = detail.fixture.container.querySelector(".task-edit-title");
    const setValue = (node, value) => {
      const prototype = node.tagName === "TEXTAREA"
        ? globalThis.HTMLTextAreaElement.prototype
        : globalThis.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
      node.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    };
    await detail.fixture.act(async () => {
      setValue(input, "Brouillon intact");
    });
    input.focus();
    const scrollBefore = dom.document.documentElement.scrollTop;
    const itemsBefore = detail.fixture.container.querySelectorAll(".task-title").length;

    const shell = await mountShell(shellBoundary, shellKey({ view: "subject", subjectId: "p1" }));
    shell.fixture.update({ open: true });
    shell.fixture.update({ open: false });
    shell.fixture.update({ open: true });
    shell.fixture.update({ open: false });

    assert.equal(detail.fixture.container.querySelector('[data-react-surface="project-detail"]'), root);
    assert.equal(detail.fixture.container.querySelector(".task-edit-title").value, "Brouillon intact");
    assert.equal(detail.fixture.container.querySelectorAll(".task-title").length, itemsBefore);
    assert.equal(detailBoundary.owns(detail.fixture.container), true);
    assert.equal(adapter.listenerCount(), 1);
    assert.deepEqual(adapter.calls, []);
    assert.equal(adapter.getSnapshot(), snapshot);
    assert.equal(dom.document.activeElement, detail.fixture.container.querySelector(".task-edit-title"));
    assert.equal(dom.document.documentElement.scrollTop, scrollBefore);
    assert.equal(detail.fixture.container.querySelectorAll("#nav-menu-button").length, 0);
    assert.equal(shell.fixture.container.querySelectorAll('[data-react-surface="project-detail"]').length, 0);

    detail.fixture.unmount();
    shell.fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
