import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import {
  OVERVIEW_TEST_COMMANDS,
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const app = read("site/app.js");

function item(id, priority = "normal", done = false, parentId = null) {
  return { id, title: id, priority, done, parentId };
}

function makeAdapter({ transient = {} } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: [
        {
          id: "p1",
          title: "Projet A",
          items: [
            item("i1", "urgent"),
            item("i2", "normal"),
            item("child", "normal", false, "i1"),
            item("i3", "normal"),
            item("i4", "normal"),
            item("i5", "normal"),
            item("i6", "normal")
          ]
        },
        { id: "p2", title: "Projet B", items: [item("j1")] }
      ]
    },
    route: { view: "overview" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    presentation: {
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

function click(node) {
  node.dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
}

function setValue(node, value) {
  const prototype = node.tagName === "SELECT"
    ? globalThis.HTMLSelectElement.prototype
    : globalThis.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  setter.call(node, value);
  node.dispatchEvent(new globalThis.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

test("TS-064 app.js exposes card commands through the existing controller intents", () => {
  const block = app.slice(
    app.indexOf("const overviewCommands = Object.freeze({"),
    app.indexOf("function createProjectDetailAdapter()")
  );
  assert.match(block, /openProject\(subjectId\)/);
  assert.match(block, /openSubject\(subject\)/);
  assert.match(block, /seeMore\(subjectId\)/);
  assert.match(block, /moveProject\(subjectId, direction\)/);
  assert.match(block, /move\(subject, direction\)/);
  assert.match(block, /removeProject\(subjectId\)/);
  assert.match(block, /confirm\("Supprimer ce sujet et toutes ses étapes \?"\)/);
  assert.match(block, /invalidatePendingRemoval\(\)/);
  assert.match(block, /persist\(\)/);
  assert.match(block, /resetFilter\(\)[\s\S]*setOverviewProjectFilter\(OVERVIEW_FILTER_ALL, true\)/);
  assert.match(app, /function openSubject\(subject\) \{\s*\n\s*const target = subjectRoute\(subject\.id\);/);
  assert.match(app, /commands: overviewCommands/);
});

test("TS-064 opening a card or Voir plus emits exactly one delegated intention", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector('.subject[data-subject="p1"]');
    click(card.querySelector(".subject-open"));
    assert.deepEqual(calls, [["openProject", ["p1"]]]);
    calls.length = 0;
    click(card.querySelector(".overview-see-more"));
    assert.deepEqual(calls, [["seeMore", ["p1"]]]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 a see-more click after an update never doubles the command", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    const first = fixture.container.querySelectorAll(".overview-see-more");
    assert.equal(first.length, 1);
    click(first[0]);
    fixture.rerender();
    const second = fixture.container.querySelectorAll(".overview-see-more");
    assert.equal(second.length, 1);
    click(second[0]);
    assert.deepEqual(calls, [["seeMore", ["p1"]], ["seeMore", ["p1"]]]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 card ordering uses the existing move intent within document bounds", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    const p1 = fixture.container.querySelector('.subject[data-subject="p1"]');
    const p2 = fixture.container.querySelector('.subject[data-subject="p2"]');
    assert.equal(p1.querySelector('[data-direction="up"]').disabled, true);
    assert.equal(p1.querySelector('[data-direction="down"]').disabled, false);
    assert.equal(p2.querySelector('[data-direction="up"]').disabled, false);
    assert.equal(p2.querySelector('[data-direction="down"]').disabled, true);
    click(p1.querySelector('[data-direction="down"]'));
    click(p2.querySelector('[data-direction="up"]'));
    assert.deepEqual(calls, [
      ["moveProject", ["p1", "down"]],
      ["moveProject", ["p2", "up"]]
    ]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 project removal delegates one confirmed intention", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = makeAdapter();
    const fixture = await createOverviewFixture(adapter);
    click(fixture.container.querySelector('.subject[data-subject="p1"] .danger'));
    assert.deepEqual(calls, [["removeProject", ["p1"]]]);
    assert.match(app, /if \(!confirm\("Supprimer ce sujet et toutes ses étapes \?"\)\) return false;/);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 completion, priority, menu and edit each emit one item intention", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, calls } = makeAdapter({ transient: { openMenuId: "i2" } });
    const fixture = await createOverviewFixture(adapter);
    const task = fixture.container.querySelector('.task[data-item="i2"]');
    const check = task.querySelector(".task-check");
    click(check);
    assert.deepEqual(calls, [["toggleItem", ["p1", "i2", true]]]);

    calls.length = 0;
    setValue(task.querySelector(".priority-control"), "later");
    assert.deepEqual(calls, [["setPriority", ["p1", "i2", "later"]]]);

    calls.length = 0;
    click(task.querySelector(".task-menu-edit"));
    assert.deepEqual(calls, [["runMenuCommand", ["p1", "i2", "edit"]]]);

    calls.length = 0;
    click(task.querySelector(".task-menu-button"));
    assert.deepEqual(calls, [["closeItemMenu", [true]]]);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
