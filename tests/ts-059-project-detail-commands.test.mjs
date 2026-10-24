import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import { createReactAdapter, REACT_ADAPTER_COMMAND_NAMES } from "../site/react-adapter.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "site/project-detail/controller-commands.js"), "utf8");
const adapterSource = readFileSync(resolve(root, "site/react-adapter.js"), "utf8");

function baseDocument() {
  return {
    version: 1,
    subjects: [{
      id: "p1",
      title: "Projet",
      items: [
        { id: "a", title: "Urgent A", priority: "urgent", done: false, parentId: null },
        { id: "b", title: "Urgent B", priority: "urgent", done: false, parentId: null },
        { id: "c", title: "Normal C", priority: "normal", done: false, parentId: null },
        { id: "d", title: "Enfant", priority: "normal", done: false, parentId: "a" }
      ]
    }, {
      id: "p2",
      title: "Autre",
      items: []
    }]
  };
}

function harness(overrides = {}) {
  const state = {
    document: baseDocument(),
    expandedParents: new Set(),
    openMenuId: null,
    editingItemId: null,
    renamingSubject: false,
    hideCompleted: false,
    resumeRef: null,
    revealItemId: null,
    focusItemId: null,
    pendingCollapseFocus: null,
    pendingPriorityFocus: null,
    pendingMenuFocus: null,
    pendingMoveFocus: null,
    pendingTaskCreationFocus: null,
    focusRenameControl: false,
    focusOpenSubjectId: null,
    ...(overrides.transient || {})
  };
  const counts = { persist: 0, render: 0, remove: 0, undo: 0, navigate: 0, saveResume: 0, drag: 0, cancelDrag: 0 };
  const notices = [];
  const commands = createProjectDetailCommands({
    getDocument: () => state.document,
    setDocument: (next) => { state.document = next; },
    persist: () => { counts.persist += 1; },
    render: () => { counts.render += 1; },
    notify: (message) => notices.push(message),
    getTransient: () => state,
    setTransient: (patch) => Object.assign(state, patch),
    removeAction: () => { counts.remove += 1; return true; },
    undoAction: () => { counts.undo += 1; return true; },
    startDragAction: () => { counts.drag += 1; return true; },
    cancelDragAction: () => { counts.cancelDrag += 1; return true; },
    navigate: (hash) => { counts.navigate += 1; state.hash = hash; },
    promptText: () => "Sous-étape prompt",
    randomId: () => "generated-" + (++counts.generated || 1),
    getResumeRef: () => state.resumeRef,
    setResumeRef: (ref) => { state.resumeRef = ref; },
    saveResumePreference: () => { counts.saveResume += 1; return Promise.resolve(true); }
  });
  return { commands, state, counts, notices };
}

test("TS-059 commands delegate one callback and never import another store", () => {
  const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(source, /from "\.\.\/core\.js"/);
  assert.doesNotMatch(codeOnly(source), /Dexie|indexedDB|localStorage|fetch\s*\(|authentication|persistence\.js|app\.js/);
  assert.doesNotMatch(codeOnly(adapterSource), /Dexie|indexedDB|localStorage|fetch\s*\(|authentication|persistence\.js|app\.js/);

  const calls = [];
  const handlers = {};
  for (const name of REACT_ADAPTER_COMMAND_NAMES) {
    handlers[name] = (...args) => { calls.push([name, args]); return name; };
  }
  const adapter = createReactAdapter({
    getDocument: baseDocument,
    getRoute: () => ({ view: "subject", subjectId: "p1" }),
    getTransientState: () => ({}),
    getAuthorizedIdentity: () => ({ type: "local" }),
    isBusinessAllowed: () => true,
    isLoadingBlocked: () => false,
    commands: handlers
  });
  const expected = [
    "createSubstep", "setPriority", "undoRemoval", "moveItem", "beginEdit",
    "cancelEdit", "startDrag", "cancelDrag", "runMenuCommand",
    "addSubstepFromPrompt", "startRename", "cancelRename"
  ];
  for (const name of expected) {
    assert.ok(adapter.commandNames.includes(name), name);
    adapter.commands[name]("p1", "a", "x");
  }
  assert.deepEqual(calls.map(([name]) => name), expected);
});

test("TS-059 invalid mutations never persist nor change the document", () => {
  const { commands, state, counts } = harness();
  const before = state.document;
  const tooMany = baseDocument();
  tooMany.subjects[0].items = Array.from({ length: 500 }, (_, index) => ({
    id: "x" + index, title: "T" + index, priority: "normal", done: false, parentId: null
  }));

  assert.equal(commands.createItem("p1", "   ", "normal"), false);
  assert.equal(commands.createItem("p1", "a".repeat(301), "normal"), false);
  assert.equal(commands.createItem("p1", "Titre", "invalid"), false);
  assert.equal(commands.createSubstep("p1", "absent", "Titre"), false);
  assert.equal(commands.updateItem("p1", "a", { title: "", priority: "urgent" }), false);
  assert.equal(commands.updateItem("p1", "a", { title: "a".repeat(301), priority: "urgent" }), false);
  assert.equal(commands.updateItem("p1", "a", {
    title: "Titre", priority: "urgent", note: "n".repeat(2001)
  }), false);
  assert.equal(commands.setPriority("p1", "a", "invalid"), false);
  assert.equal(commands.renameSubject("p1", "n".repeat(101)), false);
  assert.equal(commands.moveItem("p1", "a", "up"), false);

  state.document = tooMany;
  const full = state.document;
  assert.equal(commands.createItem("p1", "Titre", "normal"), false);
  assert.equal(commands.createSubstep("p1", "x0", "Titre"), false);
  assert.equal(state.document, full);
  assert.equal(counts.persist, 0);
});

test("TS-059 nominal commands persist at most once and keep the intended shape", () => {
  const { commands, state, counts, notices } = harness();
  assert.equal(commands.createItem("p1", "  Nouvelle  ", "later"), true);
  assert.equal(state.document.subjects[0].items.at(-1).title, "Nouvelle");
  assert.equal(state.document.subjects[0].items.at(-1).priority, "later");
  assert.equal(state.pendingTaskCreationFocus, "p1");
  assert.equal(counts.persist, 1);

  assert.equal(commands.createSubstep("p1", "a", "Enfant 2"), true);
  assert.equal(state.document.subjects[0].items.at(-1).parentId, "a");
  assert.equal(counts.persist, 2);
  assert.equal(commands.addSubstepFromPrompt("p1", "a"), true);
  assert.equal(counts.persist, 3);

  assert.equal(commands.updateItem("p1", "a", {
    title: "A modifié", priority: "later", note: "Note"
  }), true);
  assert.equal(state.document.subjects[0].items[0].title, "A modifié");
  assert.equal(state.document.subjects[0].items[0].note, "Note");
  assert.equal(counts.persist, 4);
  assert.equal(state.editingItemId, null);

  assert.equal(commands.setPriority("p1", "b", "later"), true);
  assert.equal(state.document.subjects[0].items[1].priority, "later");
  assert.equal(counts.persist, 5);
  assert.equal(commands.setPriority("p1", "b", "later"), false);
  assert.equal(counts.persist, 5);

  assert.equal(commands.toggleItem("p1", "c", true), true);
  assert.equal(state.document.subjects[0].items[2].done, true);
  assert.equal(counts.persist, 6);
  assert.equal(commands.toggleItem("p1", "c", true), false);

  assert.equal(commands.reorderItem("p1", "b", "a", "before"), true);
  assert.equal(counts.persist, 7);
  assert.equal(commands.reorderItem("p1", "a", "d", "after"), false);
  assert.equal(commands.promoteItem("p1", "d"), true);
  assert.equal(state.document.subjects[0].items.find((entry) => entry.id === "d").parentId, null);
  assert.equal(counts.persist, 8);

  assert.equal(commands.removeItem("p1", "a"), true);
  assert.equal(counts.remove, 1);
  assert.equal(commands.undoRemoval(), true);
  assert.equal(counts.undo, 1);

  assert.equal(commands.trackItem("p1", "a"), true);
  assert.deepEqual(state.resumeRef, { subjectId: "p1", itemId: "a" });
  assert.equal(counts.saveResume, 1);

  assert.equal(commands.renameSubject("p1", "Nouveau projet"), true);
  assert.equal(state.document.subjects[0].title, "Nouveau projet");
  assert.equal(counts.persist, 9);
  assert.equal(state.renamingSubject, false);
  assert.equal(state.focusRenameControl, true);

  assert.equal(commands.returnToOverview("p1"), true);
  assert.equal(state.hash, "#/");
  assert.equal(state.focusOpenSubjectId, "p1");
  assert.ok(notices.includes("Priorité mise à jour"));
});

test("TS-059 menus, expansion and edit transitions update presentation without writing", () => {
  const { commands, state, counts } = harness();
  assert.equal(commands.openItemMenu("a"), true);
  assert.equal(state.openMenuId, "a");
  assert.equal(commands.openItemMenu("b"), true);
  assert.equal(state.openMenuId, "b");
  assert.equal(commands.closeItemMenu(true), true);
  assert.equal(state.openMenuId, null);
  assert.equal(state.pendingMenuFocus, "b");

  assert.equal(commands.toggleSubsteps("p1", "a"), true);
  assert.equal(state.expandedParents.has("a"), true);
  assert.equal(state.pendingCollapseFocus, "a");
  assert.equal(commands.toggleSubsteps("p1", "a"), true);
  assert.equal(state.expandedParents.has("a"), false);

  assert.equal(commands.beginEdit("p1", "a"), true);
  assert.equal(state.editingItemId, "a");
  assert.equal(state.openMenuId, null);
  assert.equal(commands.cancelEdit("p1", "a"), true);
  assert.equal(state.editingItemId, null);
  assert.equal(state.focusItemId, "a");
  assert.equal(counts.persist, 0);
  assert.equal(commands.startDrag("p1", "a", {}, {}), true);
  assert.equal(counts.drag, 1);
  assert.equal(commands.cancelDrag(null), true);
  assert.equal(counts.cancelDrag, 1);
});
