import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  PRIORITIES,
  NOTE_MAX_LENGTH,
  STORAGE_KEY,
  RESUME_KEY,
  OVERVIEW_TASK_LIMIT,
  OVERVIEW_URGENCY_LIMIT,
  itemMenuCommands,
  planRemoval,
  restoreRemoval,
  restorableTrackingRef,
  sortedItems,
  subjectMetrics,
  totalTaskCount,
  visibleItems
} from "../site/core.js";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import { createReactAdapter, REACT_ADAPTER_COMMAND_NAMES } from "../site/react-adapter.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const appSource = read("site/app.js");

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
        { id: "d", title: "Enfant D", priority: "normal", done: false, parentId: "c", note: "note d" },
        { id: "e", title: "Plus tard E", priority: "later", done: true, parentId: null }
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
    document: overrides.document || baseDocument(),
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
    focusOpenSubjectId: null
  };
  const counts = {
    persist: 0, render: 0, remove: 0, undo: 0, navigate: 0,
    saveResume: 0, drag: 0, cancelDrag: 0, prompt: 0
  };
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
    promptText: () => { counts.prompt += 1; return "Sous-étape prompt"; },
    randomId: () => "generated-" + (counts.generated = (counts.generated || 0) + 1),
    getResumeRef: () => state.resumeRef,
    setResumeRef: (ref) => { state.resumeRef = ref; },
    saveResumePreference: () => { counts.saveResume += 1; return Promise.resolve(true); }
  });
  return { commands, state, counts, notices };
}

const matrix = [
  { name: "createItem", run: (c) => c.createItem("p1", "Nouvelle", "normal"), persist: 1 },
  { name: "createSubstep", run: (c) => c.createSubstep("p1", "a", "Sous-étape"), persist: 1 },
  { name: "addSubstepFromPrompt", run: (c) => c.addSubstepFromPrompt("p1", "a"), persist: 1, prompt: 1 },
  { name: "updateItem", run: (c) => c.updateItem("p1", "a", { title: "A modifié", priority: "urgent", note: "Note" }), persist: 1 },
  { name: "setPriority", run: (c) => c.setPriority("p1", "a", "later"), persist: 1 },
  { name: "toggleItem", run: (c) => c.toggleItem("p1", "a", true), persist: 1 },
  { name: "removeItem", run: (c) => c.removeItem("p1", "a"), remove: 1 },
  { name: "undoRemoval", run: (c) => c.undoRemoval(), undo: 1 },
  { name: "reorderItem", run: (c) => c.reorderItem("p1", "b", "a", "before"), persist: 1 },
  { name: "moveItem", run: (c) => c.moveItem("p1", "b", "up"), persist: 1 },
  { name: "promoteItem", run: (c) => c.promoteItem("p1", "d"), persist: 1 },
  { name: "toggleSubsteps", run: (c) => c.toggleSubsteps("p1", "c") },
  { name: "openItemMenu", run: (c) => c.openItemMenu("a") },
  { name: "closeItemMenu", run: (c) => { c.openItemMenu("a"); return c.closeItemMenu(true); } },
  { name: "beginEdit", run: (c) => c.beginEdit("p1", "a") },
  { name: "cancelEdit", run: (c) => c.cancelEdit("p1", "a") },
  { name: "trackItem", run: (c) => c.trackItem("p1", "a"), saveResume: 1 },
  { name: "renameSubject", run: (c) => c.renameSubject("p1", "Projet renommé"), persist: 1 },
  { name: "startRename", run: (c) => c.startRename() },
  { name: "cancelRename", run: (c) => c.cancelRename() },
  { name: "runMenuCommand", run: (c) => c.runMenuCommand("p1", "a", "edit") },
  { name: "returnToOverview", run: (c) => c.returnToOverview("p1"), navigate: 1 },
  { name: "startDrag", run: (c) => c.startDrag("p1", "a", {}, {}), drag: 1 },
  { name: "cancelDrag", run: (c) => c.cancelDrag(null), cancelDrag: 1 }
];

test("TS-060 every detail command is activated once with a single intention and at most one write", () => {
  assert.deepEqual(matrix.map((entry) => entry.name).sort(), [...REACT_ADAPTER_COMMAND_NAMES].sort());
  for (const entry of matrix) {
    const { commands, counts } = harness();
    assert.equal(typeof commands[entry.name], "function", entry.name);
    assert.equal(entry.run(commands), true, entry.name);
    const expectedWrite = entry.persist || 0;
    assert.equal(counts.persist, expectedWrite, entry.name + " persist");
    assert.ok(counts.persist <= 1, entry.name + " emitted more than one write");
    for (const key of ["remove", "undo", "navigate", "saveResume", "drag", "cancelDrag", "prompt"]) {
      assert.equal(counts[key], entry[key] || 0, entry.name + " " + key);
    }
    const delegated = counts.remove + counts.undo + counts.navigate + counts.saveResume +
      counts.drag + counts.cancelDrag;
    assert.ok(delegated <= 1, entry.name + " double callback: " + JSON.stringify(counts));
    if (!expectedWrite) assert.equal(counts.persist, 0, entry.name + " presentation must not persist");
  }
  for (const name of REACT_ADAPTER_COMMAND_NAMES) {
    const { commands } = harness();
    assert.ok(commands.commandNames.includes(name), "command factory is missing " + name);
  }
});

test("TS-060 runMenuCommand routes exactly one delegated command and keeps the menu command list", () => {
  const { commands, counts, state } = harness();
  assert.equal(commands.runMenuCommand("p1", "a", "remove"), true);
  assert.equal(counts.remove, 1);
  assert.equal(counts.persist, 0);
  assert.equal(state.openMenuId, null);

  assert.equal(commands.runMenuCommand("p1", "a", "move-up"), false);
  assert.equal(counts.persist, 0);
  assert.equal(commands.runMenuCommand("p1", "b", "move-up"), true);
  assert.equal(counts.persist, 1);
  assert.equal(commands.runMenuCommand("p1", "a", "unknown"), false);
});

test("TS-060 business rules keep priority order, hierarchy, raw notes, titles and counters", () => {
  const { commands, state } = harness();
  const topLevel = sortedItems(state.document.subjects[0].items, null);
  assert.deepEqual(topLevel.map((item) => item.id), ["a", "b", "c", "e"]);
  assert.deepEqual(visibleItems(state.document.subjects[0].items, "c").map((item) => item.id), ["d"]);

  assert.equal(commands.setPriority("p1", "c", "urgent"), true);
  assert.deepEqual(sortedItems(state.document.subjects[0].items, null).map((item) => item.id), ["a", "b", "c", "e"]);
  assert.equal(state.document.subjects[0].items.find((item) => item.id === "d").parentId, "c");

  assert.equal(commands.updateItem("p1", "d", {
    title: "  Enfant D  ",
    priority: "later",
    note: "  Ligne 1\nLigne 2  "
  }), true);
  const updated = state.document.subjects[0].items.find((item) => item.id === "d");
  assert.equal(updated.title, "Enfant D");
  assert.equal(updated.note, "  Ligne 1\nLigne 2  ");
  assert.equal(updated.parentId, "c");

  assert.equal(commands.toggleItem("p1", "a", true), true);
  const subject = state.document.subjects[0];
  const metrics = subjectMetrics(subject);
  assert.equal(metrics.pending, 3);
  assert.equal(metrics.urgentPending, 2);
  assert.equal(totalTaskCount(subject.items), 4);
  assert.deepEqual(PRIORITIES, ["urgent", "normal", "later"]);
  assert.equal(NOTE_MAX_LENGTH, 2000);
});

test("TS-060 invalid or no-op commands emit no write and keep the document", () => {
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
    title: "Titre", priority: "urgent", note: "n".repeat(NOTE_MAX_LENGTH + 1)
  }), false);
  assert.equal(commands.setPriority("p1", "a", "invalid"), false);
  assert.equal(commands.renameSubject("p1", "n".repeat(101)), false);
  assert.equal(commands.moveItem("p1", "a", "up"), false);

  const same = state.document;
  assert.equal(commands.updateItem("p1", "a", { title: "Urgent A", priority: "urgent" }), false);
  assert.equal(state.document, same);
  assert.equal(commands.renameSubject("p1", "Projet"), false);

  state.document = tooMany;
  assert.equal(commands.createItem("p1", "Titre", "normal"), false);
  assert.equal(commands.createSubstep("p1", "x0", "Titre"), false);
  assert.equal(state.document, tooMany);
  assert.notEqual(before, tooMany);
  assert.equal(counts.persist, 0);
  assert.equal(counts.remove, 0);
  assert.equal(counts.undo, 0);
});

test("TS-060 tracking targets only pending tasks and saves nothing by itself", () => {
  const { commands, state, counts } = harness();
  assert.equal(commands.trackItem("p1", "e"), false);
  assert.equal(counts.saveResume, 0);
  assert.equal(commands.trackItem("p1", "missing"), false);
  assert.equal(counts.saveResume, 0);
  assert.equal(commands.trackItem("p1", "a"), true);
  assert.deepEqual(state.resumeRef, { subjectId: "p1", itemId: "a" });
  assert.equal(counts.saveResume, 1);
  assert.equal(counts.persist, 0);
});

test("TS-060 the adapter stays read-only and every business write keeps the injected persist path", () => {
  const { adapter } = (() => {
    const state = { document: baseDocument(), route: { view: "subject", subjectId: "p1" } };
    const calls = [];
    const handlers = {};
    for (const name of REACT_ADAPTER_COMMAND_NAMES) {
      handlers[name] = (...args) => { calls.push([name, args]); return true; };
    }
    return {
      adapter: createReactAdapter({
        getDocument: () => state.document,
        getRoute: () => state.route,
        getTransientState: () => ({}),
        getAuthorizedIdentity: () => ({ type: "local" }),
        isBusinessAllowed: () => true,
        isLoadingBlocked: () => false,
        commands: handlers
      })
    };
  })();
  const snapshot = adapter.getSnapshot();
  assert.equal(snapshot.readOnly, true);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.project), true);
  assert.equal(Object.isFrozen(snapshot.items), true);
  assert.equal(Object.isFrozen(snapshot.items[0]), true);
  assert.throws(() => { snapshot.project.title = "Mutation directe"; }, TypeError);
  assert.equal(Object.keys(adapter.commands).length, REACT_ADAPTER_COMMAND_NAMES.length);
  assert.deepEqual(Object.keys(adapter.commands).sort(), [...REACT_ADAPTER_COMMAND_NAMES].sort());
  assert.equal(adapter.commandNames, REACT_ADAPTER_COMMAND_NAMES);

  const { commands, state, counts } = harness();
  commands.createItem("p1", "Écriture unique", "normal");
  commands.updateItem("p1", "a", { title: "Titre unique", priority: "urgent" });
  assert.equal(counts.persist, 2);
  assert.ok(state.document.subjects[0].items.some((item) => item.title === "Écriture unique"));
  assert.equal(state.document.subjects[0].items.find((item) => item.id === "a").title, "Titre unique");

  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  assert.deepEqual(PRIORITIES, ["urgent", "normal", "later"]);
  assert.equal(NOTE_MAX_LENGTH, 2000);
  assert.equal(OVERVIEW_TASK_LIMIT, 5);
  assert.equal(OVERVIEW_URGENCY_LIMIT, 5);

  const coreSource = read("site/core.js");
  const adapterSource = read("site/react-adapter.js");
  const commandsSource = read("site/project-detail/controller-commands.js");
  assert.match(coreSource, /export const STORAGE_KEY = "threadstep\.document\.v1";/);
  assert.match(coreSource, /export const NOTE_MAX_LENGTH = 2000;/);
  assert.doesNotMatch(adapterSource, /export function createReactAdapter[\s\S]*?localStorage/);
  assert.doesNotMatch(commandsSource, /new Map\(|new Set\(\s*\[\s*\]\s*\)[\s\S]*documentState/);
  assert.doesNotMatch(commandsSource, /Dexie|indexedDB|\.subscribe\s*\(/);
  const surfaceSource = read("site/project-detail/ProjectDetailSurface.jsx");
  assert.equal((surfaceSource.match(/\.subscribe\(/g) || []).length, 1);
  assert.doesNotMatch(surfaceSource, /Dexie|indexedDB|localStorage|new Map|useReducer/);
});

test("TS-060 removal and Undo restore the exact subtree, order, note and tracking once", () => {
  const document = baseDocument();
  document.subjects[0].items.push(
    { id: "d2", title: "Enfant D2", priority: "normal", done: true, parentId: "c", note: "garde" }
  );
  const planning = planRemoval(document, "p1", "c");
  assert.ok(planning.removal);
  assert.deepEqual(planning.removal.entries.map((entry) => entry.item.id), ["c", "d", "d2"]);
  assert.equal(planning.document.subjects[0].items.some((item) => item.id === "c"), false);

  const restored = restoreRemoval(planning.document, planning.removal);
  assert.deepEqual(restored.subjects[0].items, document.subjects[0].items);
  assert.deepEqual(restorableTrackingRef(restored, { subjectId: "p1", itemId: "c" }), { subjectId: "p1", itemId: "c" });

  const { commands, counts } = harness();
  assert.equal(commands.removeItem("p1", "c"), true);
  assert.equal(counts.remove, 1);
  assert.equal(commands.undoRemoval(), true);
  assert.equal(counts.undo, 1);
  assert.equal(counts.persist, 0);

  assert.match(appSource, /const UNDO_WINDOW_MS = 10000;/);
  assert.match(appSource, /function startRemovalTimer\(delay\) \{[\s\S]*?removalTimer = setTimeout\(expireRemoval, delay\);/);
  assert.match(appSource, /function invalidatePendingRemoval\(\) \{[\s\S]*?clearRemovalTimer\(\);/);
  assert.match(appSource, /"Étape retirée"/);
  assert.match(appSource, /"Annuler"/);
});

test("TS-060 the ten-second Undo timer is deterministic and cancellable", () => {
  const timerSource = appSource.slice(
    appSource.indexOf("function startRemovalTimer("),
    appSource.indexOf("function showSnackbar(")
  );
  const scheduled = [];
  const cleared = [];
  let expired = 0;
  const context = {
    Date: { now: () => 1000 },
    removalTimer: null,
    removalDeadline: 0,
    expireRemoval() { expired += 1; },
    setTimeout(callback, delay) {
      const handle = { callback, delay };
      scheduled.push(handle);
      return handle;
    }
  };
  const timerState = context;
  context.clearRemovalTimer = function clearRemovalTimer() {
    if (timerState.removalTimer !== null) {
      cleared.push(timerState.removalTimer);
      timerState.removalTimer = null;
    }
  };
  runInNewContext("const UNDO_WINDOW_MS = 10000;\n" + timerSource + "\nstartRemovalTimer(UNDO_WINDOW_MS);", context);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 10000);
  assert.equal(context.removalDeadline, 11000);
  scheduled[0].callback();
  assert.equal(expired, 1);

  const suspended = appSource.slice(
    appSource.indexOf("function startRemovalTimer("),
    appSource.indexOf("function showSnackbar(")
  );
  const context2 = {
    Date: { now: () => 3000 },
    removalTimer: { id: "timer" },
    removalDeadline: 9000,
    expireRemoval() {},
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return { callback, delay }; }
  };
  const timerState2 = context2;
  context2.clearRemovalTimer = function clearRemovalTimer() {
    if (timerState2.removalTimer !== null) {
      cleared.push(timerState2.removalTimer);
      timerState2.removalTimer = null;
    }
  };
  runInNewContext(suspended + "\nsuspendRemovalTimer();", context2);
  assert.equal(context2.removalDeadline, 6000);
  assert.deepEqual(cleared.at(-1), { id: "timer" });
});

test("TS-060 menu commands offer a keyboard alternative with impossible moves disabled", () => {
  const items = baseDocument().subjects[0].items;
  const first = itemMenuCommands(items[0], { canMoveUp: false, canMoveDown: true });
  const last = itemMenuCommands(items[3], { canMoveUp: true, canMoveDown: false });
  assert.deepEqual(first.filter((command) => command.id.startsWith("move-"))
    .map((command) => [command.id, command.disabled]), [["move-up", true], ["move-down", false]]);
  assert.deepEqual(last.filter((command) => command.id.startsWith("move-"))
    .map((command) => [command.id, command.disabled]), [["move-up", false], ["move-down", true]]);
  const substep = itemMenuCommands(items[3], { canMoveUp: false, canMoveDown: false });
  assert.ok(substep.some((command) => command.id === "promote" && command.disabled === false));
  assert.ok(substep.some((command) => command.id === "move-up" && command.disabled === true));
  assert.ok(substep.some((command) => command.id === "move-down" && command.disabled === true));
});

test("TS-060 React modules and commands import no store, auth, persistence or app controller", () => {
  const stripComments = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const files = [
    ...readdirSync(resolve(root, "site/project-detail"))
      .filter((name) => name.endsWith(".js") || name.endsWith(".jsx"))
      .map((name) => "site/project-detail/" + name),
    "site/react-adapter.js",
    "site/react-boundary.js"
  ];
  assert.ok(files.length >= 9);
  for (const file of files) {
    const code = stripComments(read(file));
    for (const forbidden of [
      /from\s+["'][^"']*\bdexie/i,
      /indexedDB/,
      /localStorage/,
      /\bfetch\s*\(/,
      /authentication(?:\.js)?["']/,
      /from\s+["'][^"']*app\.js["']/,
      /persistence\.js/,
      /\.cloud\./,
      /new\s+Dexie/
    ]) {
      assert.doesNotMatch(code, forbidden, file + " matches " + forbidden);
    }
  }
  assert.ok(createReactAdapter);
});
