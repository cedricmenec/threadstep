import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decideProjectDetailSurface, SURFACE_REASON } from "../site/project-detail/surface-decision.js";
import {
  compileProjectDetailSurface,
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom,
  projectDetailSourceFiles
} from "./helpers/ts-059-project-detail-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function snapshot(overrides = {}) {
  const items = overrides.items || [
    { id: "later", title: "Plus tard", priority: "later", done: false, parentId: null },
    { id: "urgent", title: "Urgent", priority: "urgent", done: false, parentId: null },
    { id: "child", title: "Sous-étape", priority: "normal", done: false, parentId: "urgent" },
    { id: "normal", title: "Normal", priority: "normal", done: false, parentId: null }
  ];
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: true,
    project: {
      id: "p1",
      title: overrides.title || "Projet pilote",
      pendingCount: overrides.pendingCount === undefined ? 4 : overrides.pendingCount,
      metrics: { total: items.length },
      totalTaskCount: 3,
      totalTaskCountLabel: "3 tâches au total",
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
    : node.tagName === "SELECT"
      ? globalThis.HTMLSelectElement.prototype
      : globalThis.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  setter.call(node, value);
  node.dispatchEvent(new globalThis.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

test("TS-059 the surface decision mounts only a valid, authorized project detail", () => {
  const base = {
    businessAllowed: true,
    isLoadingBlocked: false,
    documentLoaded: true,
    projectExists: true
  };
  assert.deepEqual(
    decideProjectDetailSurface({ ...base, route: { view: "subject", subjectId: "p1" } }),
    { mount: true, fallback: false, reason: SURFACE_REASON.SUBJECT_DETAIL }
  );
  for (const route of [
    { view: "overview" },
    { view: "settings", section: "root" },
    { view: "settings", section: "data" },
    { view: "settings", section: "sync" }
  ]) {
    const decision = decideProjectDetailSurface({ ...base, route });
    assert.equal(decision.mount, false);
    assert.equal(decision.reason, SURFACE_REASON.NOT_DETAIL_ROUTE);
  }
  assert.equal(decideProjectDetailSurface({
    ...base, route: { view: "subject", subjectId: "absent" }, projectExists: false
  }).reason, SURFACE_REASON.PROJECT_MISSING);
  assert.equal(decideProjectDetailSurface({
    ...base, route: { view: "subject", subjectId: "p1" }, businessAllowed: false
  }).reason, SURFACE_REASON.BUSINESS_NOT_ALLOWED);
  assert.equal(decideProjectDetailSurface({
    ...base, route: { view: "invalid" }
  }).reason, SURFACE_REASON.INVALID_ROUTE);
});

test("TS-059 production components compile with the project JSX runtime and stay data-free", async () => {
  const compiled = await compileProjectDetailSurface();
  assert.match(compiled.code, /react\/jsx-runtime/);
  for (const { name, source } of projectDetailSourceFiles()) {
    assert.doesNotMatch(source, /\bDexie\b|indexedDB|\bOTP\b|authentication\.js/, name);
    assert.doesNotMatch(source, /from\s+["'][^"']*app\.js["']|from\s+["'][^"']*persistence\.js["']/, name);
    assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|new\s+Dexie|WebSocket/, name);
  }
  assert.match(compiled.code, /data-react-surface/);
});

test("TS-059 the React detail preserves title, counters, order, hierarchy and classes", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot({ transient: { expandedParents: ["urgent"] } }) });
    const fixture = await createSurfaceFixture(adapter);
    const section = fixture.container.querySelector('[data-react-surface="project-detail"]');
    assert.ok(section);
    assert.equal(section.className, "subject detail");
    assert.equal(section.dataset.subject, "p1");
    assert.equal(section.querySelector(".detail-title").textContent, "Projet pilote");
    assert.equal(section.querySelector(".detail-return").textContent, "Retour à la vue d'ensemble");
    assert.match(section.textContent, /4 étapes en attente/);
    assert.match(section.querySelector(".subject-total").textContent, /3 tâches au total/);
    const topLevel = [...section.querySelectorAll(".task-area > .tasks > .task")].map((node) => node.dataset.item);
    assert.deepEqual(topLevel, ["urgent", "normal", "later"]);
    const childList = section.querySelector("#substeps-urgent");
    assert.ok(childList);
    assert.equal(childList.className, "tasks children");
    assert.deepEqual([...childList.querySelectorAll(".task-substep")].map((node) => node.dataset.item), ["child"]);
    assert.equal(section.querySelector('[data-item="later"]').className, "task task-parent");
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-059 notes are literal text and the empty state matches the vanilla message", async () => {
  const dom = installDeterministicDom();
  try {
    const markup = '<img src=x onerror=alert(1)>';
    const adapter = createStaticAdapter({
      snapshot: snapshot({
        title: markup,
        items: [
          { id: "n", title: markup, priority: "urgent", done: false, parentId: null, note: "ligne 1\nligne 2" }
        ],
        transient: {}
      })
    });
    const fixture = await createSurfaceFixture(adapter);
    assert.equal(fixture.container.querySelectorAll("img").length, 0);
    assert.equal(fixture.container.querySelector(".detail-title").textContent, markup);
    assert.equal(fixture.container.querySelector(".task-title").textContent, markup);
    assert.equal(fixture.container.querySelector(".task-note").textContent, "ligne 1\nligne 2");
    fixture.unmount();

    const emptyAdapter = createStaticAdapter({ snapshot: snapshot({ items: [], pendingCount: 0 }) });
    const empty = await createSurfaceFixture(emptyAdapter);
    assert.equal(
      empty.container.querySelector(".empty").textContent,
      "Aucune étape. Ajoutez la prochaine action à faire."
    );
    empty.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-059 menu labels, aria state and disabled commands follow the existing rules", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { openMenuId: "urgent" } })
    });
    const fixture = await createSurfaceFixture(adapter);
    const buttons = [...fixture.container.querySelectorAll('[data-item="urgent"] .task-menu-command')];
    assert.deepEqual(buttons.map((button) => button.dataset.command), [
      "edit", "remove", "add-substep", "keep-track", "move-up", "move-down"
    ]);
    assert.equal(buttons[0].getAttribute("aria-label"), "Modifier Urgent");
    assert.equal(buttons[2].getAttribute("aria-label"), "Ajouter une sous-tâche à Urgent");
    assert.equal(buttons[4].disabled, true);
    assert.equal(buttons[5].disabled, true);
    assert.equal(
      fixture.container.querySelector('[data-item="urgent"] .task-menu-button').getAttribute("aria-expanded"),
      "true"
    );
    const closeMenu = fixture.container.querySelector('[data-item="normal"] .task-menu-button');
    assert.equal(closeMenu.getAttribute("aria-expanded"), "false");
    assert.equal(fixture.container.querySelectorAll(".task-menu").length, 1);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-059 the inline editor is prefilled, displays errors and delegates save/cancel once", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({
        items: [{ id: "urgent", title: "Titre", priority: "urgent", done: false, parentId: null, note: "Note" }],
        transient: { editingItemId: "urgent" },
        pendingCount: 1
      }),
      commandNames: ["updateItem", "cancelEdit"]
    });
    const fixture = await createSurfaceFixture(adapter);
    const form = fixture.container.querySelector(".task-edit-form");
    assert.ok(form);
    assert.equal(form.querySelector(".task-edit-title").value, "Titre");
    assert.equal(form.querySelector(".task-edit-priority").value, "urgent");
    assert.equal(form.querySelector(".task-edit-note").value, "Note");

    await fixture.act(async () => {
      setValue(form.querySelector(".task-edit-title"), "   ");
      form.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(form.querySelector(".edit-error").textContent, "Le titre doit contenir entre 1 et 300 caractères.");
    assert.deepEqual(adapter.calls, []);

    await fixture.act(async () => {
      form.querySelector(".task-edit-title").value = "";
      setValue(form.querySelector(".task-edit-title"), "Nouveau titre");
      setValue(form.querySelector(".task-edit-note"), "Nouvelle note");
      form.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.deepEqual(adapter.calls, [["updateItem", ["p1", "urgent", {
      title: "Nouveau titre",
      priority: "urgent",
      note: "Nouvelle note"
    }]]]);

    await fixture.act(async () => {
      form.querySelector(".subtle").dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(adapter.calls.at(-1), ["cancelEdit", ["p1", "urgent"]]);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-059 creation, completion, priority and menu interactions emit one command each", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({
      snapshot: snapshot({ transient: { openMenuId: "urgent" } }),
      commandNames: [
        "createItem", "toggleItem", "setPriority", "runMenuCommand",
        "openItemMenu", "closeItemMenu", "returnToOverview"
      ]
    });
    const fixture = await createSurfaceFixture(adapter);
    const form = fixture.container.querySelector(".task-form");
    await fixture.act(async () => {
      setValue(form.querySelector("input"), "Nouvelle");
      setValue(form.querySelector("select"), "urgent");
      form.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.deepEqual(adapter.calls.at(-1), ["createItem", ["p1", "Nouvelle", "urgent"]]);
    await fixture.act(async () => {
      const check = fixture.container.querySelector('[data-item="normal"] .task-check');
      check.click();
    });
    assert.deepEqual(adapter.calls.at(-1), ["toggleItem", ["p1", "normal", true]]);
    await fixture.act(async () => {
      const select = fixture.container.querySelector('[data-item="normal"] .priority-control');
      setValue(select, "later");
    });
    assert.deepEqual(adapter.calls.at(-1), ["setPriority", ["p1", "normal", "later"]]);
    await fixture.act(async () => {
      fixture.container.querySelector('.task-menu-command[data-command="edit"]')
        .dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(adapter.calls.at(-1), ["runMenuCommand", ["p1", "urgent", "edit"]]);
    await fixture.act(async () => {
      fixture.container.querySelector(".detail-return")
        .dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(adapter.calls.at(-1), ["returnToOverview", ["p1"]]);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});
