import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom,
  projectDetailSourceFiles
} from "./helpers/ts-059-project-detail-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const detailFiles = [
  "site/project-detail/ProjectDetail.jsx",
  "site/project-detail/TaskItem.jsx",
  "site/project-detail/TaskActionMenu.jsx",
  "site/project-detail/TaskEditor.jsx"
];

const items = [
  { id: "urgent", title: "Tâche urgente", priority: "urgent", done: false, parentId: null },
  { id: "child", title: "Sous-étape", priority: "normal", done: false, parentId: "urgent" },
  { id: "later", title: "Tâche plus tard", priority: "later", done: false, parentId: null, note: "Note brute" }
];

function snapshot(transient = {}) {
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: true,
    project: {
      id: "p1",
      title: "Projet pilote",
      pendingCount: 3,
      metrics: { total: items.length },
      totalTaskCount: 3,
      totalTaskCountLabel: "3 tâches au total",
      urgencyLabel: "",
      progressLabel: ""
    },
    items,
    transient: {
      expandedParents: ["urgent"],
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      ...transient
    }
  };
}

const commandNames = [
  "returnToOverview", "startRename", "cancelRename", "renameSubject",
  "createItem", "setPriority", "toggleItem", "toggleSubsteps",
  "startDrag", "openItemMenu", "closeItemMenu", "runMenuCommand",
  "cancelEdit"
];

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

test("TS-061 the detail imports and actually renders at least two distinct primitives", async () => {
  const imported = new Map();
  for (const file of detailFiles) {
    const source = read(file);
    for (const match of source.matchAll(/import \{ (\w+) \} from "\.\.\/ui\/(\w+)\.jsx";/g)) {
      imported.set(match[2], match[1]);
    }
  }
  assert.ok(imported.size >= 2, "expected at least two primitives");
  for (const [module, name] of imported) {
    const consumers = detailFiles.filter((file) => {
      const source = read(file);
      return source.includes("<" + name);
    });
    assert.ok(consumers.length >= 1, "unused primitive " + module);
  }
  for (const expected of ["Button", "PriorityControl", "TextField"]) {
    assert.ok(imported.has(expected), "missing primitive " + expected);
  }

  const uiSources = ["Button.jsx", "PriorityControl.jsx", "TextField.jsx", "priority-options.js"]
    .map((name) => read("site/ui/" + name)).join("\n");
  assert.doesNotMatch(uiSources, /commands\.|addEventListener|useState|useReducer/);

  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot() });
    const fixture = await createSurfaceFixture(adapter);
    assert.equal(fixture.container.querySelectorAll("form").length, 1);
    assert.equal(fixture.container.querySelector(".task-row > select.priority"), fixture.container.querySelector(".task-row select"));
    const menuButton = fixture.container.querySelector(".task-menu-button");
    assert.equal(menuButton.parentElement.className, "task-menu-wrap");
    assert.equal(menuButton.parentElement.children.length, 1);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-061 detail classes, labels, accessible names and reading order are unchanged", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot({ openMenuId: "urgent" }) });
    const fixture = await createSurfaceFixture(adapter);
    const section = fixture.container.querySelector('[data-react-surface="project-detail"]');

    const returnButton = section.querySelector(".detail-return");
    assert.equal(returnButton.className, "secondary detail-return");
    assert.equal(returnButton.type, "button");
    assert.equal(returnButton.getAttribute("aria-label"), "Retour à la vue d'ensemble depuis Projet pilote");
    assert.equal(returnButton.textContent, "Retour à la vue d'ensemble");

    const rename = section.querySelector(".subject-rename");
    assert.equal(rename.className, "subtle subject-rename");
    assert.equal(rename.getAttribute("aria-label"), "Renommer le projet Projet pilote");

    const form = section.querySelector(".task-form");
    assert.equal(form.dataset.subject, "p1");
    assert.equal(form.children[0].tagName, "INPUT");
    assert.equal(form.children[0].getAttribute("aria-label"), "Nouvelle étape pour Projet pilote");
    assert.equal(form.children[0].placeholder, "Quelle est la prochaine action ?");
    assert.equal(form.children[0].maxLength, 300);
    assert.equal(form.children[1].tagName, "SELECT");
    assert.equal(form.children[1].className, "");
    assert.equal(form.children[1].getAttribute("aria-label"), "Priorité de la nouvelle étape");
    assert.equal(form.children[2].className, "primary");
    assert.equal(form.children[2].textContent, "+ Étape");

    const badge = section.querySelector(".task-row select.priority");
    assert.equal(badge.className, "priority priority-urgent priority-control");
    assert.equal(badge.getAttribute("aria-label"), "Priorité de « Tâche urgente » : Urgent");
    assert.deepEqual([...badge.options].map((option) => option.textContent), ["Urgent", "Normal", "Plus tard"]);

    const topLevel = [...section.querySelectorAll(".task-area > .tasks > .task")].map((node) => node.dataset.item);
    assert.deepEqual(topLevel, ["urgent", "later"]);
    const child = section.querySelector('[data-item="child"]');
    assert.ok(child);

    const menuButton = section.querySelector(".task-menu-button");
    assert.equal(menuButton.className, "subtle task-menu-button");
    assert.equal(menuButton.getAttribute("aria-label"), "Actions pour Tâche urgente");
    assert.equal(menuButton.getAttribute("aria-expanded"), "true");
    const commands = [...section.querySelectorAll(".task-menu-command")];
    assert.deepEqual(commands.map((node) => node.dataset.command), [
      "edit", "remove", "add-substep", "keep-track", "move-up", "move-down"
    ]);
    assert.deepEqual(commands.map((node) => node.className), [
      "subtle task-menu-command task-menu-edit",
      "subtle task-menu-command task-menu-remove",
      "subtle task-menu-command task-menu-add-substep",
      "subtle task-menu-command task-menu-keep-track",
      "subtle task-menu-command task-menu-move-up",
      "subtle task-menu-command task-menu-move-down"
    ]);
    assert.deepEqual(commands.map((node) => node.textContent), [
      "Modifier", "Retirer", "Ajouter une sous-tâche", "Garder le fil", "Monter", "Descendre"
    ]);
    assert.equal(commands[0].getAttribute("aria-label"), "Modifier Tâche urgente");
    assert.equal(commands[3].disabled, false);

    const toggle = section.querySelector(".task-toggle");
    assert.equal(toggle.className, "subtle task-toggle");
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(section.querySelector(".task-handle").className, "task-handle");
    assert.equal(section.querySelector(".task-check").className, "task-check");

    const controls = [...section.querySelectorAll("button, input, select, textarea")]
      .map((node) => node.className || node.tagName.toLowerCase());
    const returnIndex = controls.indexOf("secondary detail-return");
    const titleIndex = controls.indexOf("subtle subject-rename");
    assert.ok(returnIndex >= 0 && titleIndex > returnIndex, "reading order starts with return then rename");

    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-061 rename and editor forms keep labels, order and invalid announcement", async () => {
  const dom = installDeterministicDom();
  try {
    const renameAdapter = createStaticAdapter({ snapshot: snapshot({ renamingSubject: true }), commandNames });
    const renameFixture = await createSurfaceFixture(renameAdapter);
    const renameForm = renameFixture.container.querySelector(".subject-rename-form");
    assert.ok(renameForm);
    assert.deepEqual([...renameForm.children].map((node) => node.tagName), ["INPUT", "BUTTON", "BUTTON"]);
    const renameInput = renameForm.querySelector(".subject-rename-input");
    assert.equal(renameInput.getAttribute("aria-label"), "Nouveau nom du projet Projet pilote");
    assert.equal(renameInput.maxLength, 100);
    assert.equal(renameInput.required, true);
    assert.equal(renameForm.querySelector(".primary").textContent, "Enregistrer");
    assert.equal(renameForm.querySelector(".subject-rename-cancel").className, "subtle subject-rename-cancel");
    await renameFixture.act(async () => {
      setValue(renameInput, "   ");
      renameForm.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
    });
    const renameError = renameForm.querySelector(".rename-error");
    assert.equal(renameError.id, "subject-rename-error");
    assert.equal(renameError.textContent, "Le nom doit contenir entre 1 et 100 caractères.");
    assert.equal(renameError.querySelector("*"), null);
    assert.equal(renameInput.getAttribute("aria-invalid"), "true");
    assert.equal(renameInput.getAttribute("aria-describedby"), "subject-rename-error");
    assert.deepEqual(renameAdapter.calls, []);
    renameFixture.unmount();

    const editAdapter = createStaticAdapter({ snapshot: snapshot({ editingItemId: "later" }), commandNames });
    const editFixture = await createSurfaceFixture(editAdapter);
    const editForm = editFixture.container.querySelector(".task-edit-form");
    assert.ok(editForm);
    const title = editForm.querySelector(".task-edit-title");
    const priority = editForm.querySelector(".task-edit-priority");
    const note = editForm.querySelector(".task-edit-note");
    assert.equal(title.getAttribute("aria-label"), "Titre de l'étape Tâche plus tard");
    assert.equal(title.maxLength, 300);
    assert.equal(priority.className, "task-edit-priority");
    assert.deepEqual([...priority.options].map((option) => option.value), ["urgent", "normal", "later"]);
    assert.equal(priority.value, "later");
    assert.equal(note.tagName, "TEXTAREA");
    assert.equal(note.rows, 3);
    assert.equal(note.maxLength, 2000);
    assert.equal(note.getAttribute("aria-label"), "Note (facultative) de l'étape Tâche plus tard");
    assert.match(editForm.querySelector("label").textContent, /Note \(facultative\)/);
    assert.deepEqual([...editForm.children].map((node) => node.tagName), ["INPUT", "SELECT", "LABEL", "BUTTON", "BUTTON"]);

    await editFixture.act(async () => {
      setValue(title, "");
      editForm.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
    });
    const editError = editForm.querySelector(".edit-error");
    assert.equal(editError.id, "task-edit-error");
    assert.equal(editError.textContent, "Le titre doit contenir entre 1 et 300 caractères.");
    assert.equal(editError.querySelector("*"), null);
    assert.equal(title.getAttribute("aria-invalid"), "true");
    assert.equal(title.getAttribute("aria-describedby"), "task-edit-error");
    assert.equal(note.getAttribute("aria-invalid"), null);
    assert.deepEqual(editAdapter.calls, []);
    editFixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-061 interactions emit exactly one command and no parallel write", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot(), commandNames });
    const fixture = await createSurfaceFixture(adapter);
    const section = fixture.container.querySelector('[data-react-surface="project-detail"]');

    await fixture.act(async () => {
      section.querySelector(".detail-return").click();
    });
    await fixture.act(async () => {
      section.querySelector(".subject-rename").click();
    });
    const form = section.querySelector(".task-form");
    await fixture.act(async () => {
      setValue(form.children[0], "Nouvelle action");
      setValue(form.children[1], "urgent");
    });
    await fixture.act(async () => {
      form.dispatchEvent(new globalThis.Event("submit", { bubbles: true, cancelable: true }));
    });

    const badge = section.querySelector(".task-row select.priority");
    await fixture.act(async () => {
      setValue(badge, "later");
    });
    await fixture.act(async () => {
      section.querySelector(".task-check").click();
    });
    await fixture.act(async () => {
      section.querySelector(".task-toggle").click();
    });
    await fixture.act(async () => {
      section.querySelector(".task-menu-button").click();
    });

    assert.deepEqual(adapter.calls, [
      ["returnToOverview", ["p1"]],
      ["startRename", []],
      ["createItem", ["p1", "Nouvelle action", "urgent"]],
      ["setPriority", ["p1", "urgent", "later"]],
      ["toggleItem", ["p1", "urgent", true]],
      ["toggleSubsteps", ["p1", "urgent"]],
      ["openItemMenu", ["urgent"]]
    ]);
    fixture.unmount();

    const menuAdapter = createStaticAdapter({ snapshot: snapshot({ openMenuId: "urgent" }), commandNames });
    const menuFixture = await createSurfaceFixture(menuAdapter);
    await menuFixture.act(async () => {
      menuFixture.container.querySelector('[data-command="remove"]').click();
    });
    await menuFixture.act(async () => {
      menuFixture.container.querySelector(".task-menu-button").click();
    });
    assert.deepEqual(menuAdapter.calls, [
      ["runMenuCommand", ["p1", "urgent", "remove"]],
      ["closeItemMenu", [true]]
    ]);
    menuFixture.unmount();

    const cancelAdapter = createStaticAdapter({ snapshot: snapshot({ editingItemId: "later" }), commandNames });
    const cancelFixture = await createSurfaceFixture(cancelAdapter);
    const cancelForm = cancelFixture.container.querySelector(".task-edit-form");
    await cancelFixture.act(async () => {
      cancelForm.querySelector(".subtle").click();
    });
    assert.deepEqual(cancelAdapter.calls, [["cancelEdit", ["p1", "later"]]]);
    cancelFixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-061 detail components add no wrapper or duplicated handler", () => {
  const sources = projectDetailSourceFiles();
  assert.ok(sources.length >= 7);
  for (const { name, source } of sources) {
    assert.doesNotMatch(source, /addEventListener|commands\.\w+\s*\(\s*commands\./, name);
  }
  const combined = detailFiles.map((file) => read(file)).join("\n");
  const imports = [...combined.matchAll(/import \{ (\w+) \} from "\.\.\/ui\/(\w+)\.jsx";/g)];
  assert.ok(new Set(imports.map((match) => match[2])).size >= 2);
  for (const match of imports) {
    assert.match(combined, new RegExp("<" + match[1] + "(?=[\\s/>])"), "imported but unused " + match[1]);
  }
});
