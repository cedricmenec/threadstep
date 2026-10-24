/**
 * Command factory for the project-detail pilot.
 *
 * It owns no document and no persistent state: every read and write goes
 * through injected dependencies supplied by the existing controller. Business
 * rules are borrowed from site/core.js; presentation never mutates the
 * document directly.
 */
import {
  PRIORITIES,
  NOTE_MAX_LENGTH,
  findSubject,
  newItem,
  updateItem,
  renameSubject,
  setItemPriority,
  toggleExpandedParent,
  reorderWithinPriority,
  moveWithinPriority,
  promoteItemToTopLevel
} from "../core.js";

const MAX_ITEMS = 500;
const MAX_TITLE = 300;
const MAX_SUBJECT_TITLE = 100;

function normalizedTitle(value) {
  return typeof value === "string" ? value.trim() : "";
}

function itemsOf(document, subjectId) {
  const subject = findSubject(document, subjectId);
  return subject && Array.isArray(subject.items) ? { subject, items: subject.items } : null;
}

function withItems(document, subjectId, items) {
  return {
    ...document,
    subjects: document.subjects.map((entry) =>
      entry.id === subjectId ? { ...entry, items } : entry)
  };
}

function itemById(subject, itemId) {
  return subject.items.find((entry) => entry.id === itemId) || null;
}

export function createProjectDetailCommands(dependencies = {}) {
  const {
    getDocument,
    setDocument,
    persist,
    render,
    notify = () => {},
    getTransient = () => ({}),
    setTransient = () => {},
    removeAction,
    undoAction,
    startDragAction,
    cancelDragAction,
    navigate,
    promptText = (message) => (typeof globalThis.prompt === "function"
      ? globalThis.prompt(message)
      : null),
    randomId = () => globalThis.crypto.randomUUID(),
    getResumeRef = () => null,
    setResumeRef = () => {},
    saveResumePreference = async () => false
  } = dependencies;

  for (const [name, dependency] of Object.entries({
    getDocument,
    setDocument,
    persist,
    render
  })) {
    if (typeof dependency !== "function") {
      throw new TypeError("project detail commands require " + name);
    }
  }

  function currentDocument() {
    const document = getDocument();
    return document && Array.isArray(document.subjects)
      ? document
      : { version: 1, subjects: [] };
  }

  function createItem(subjectId, title, priority = "normal") {
    const document = currentDocument();
    const found = itemsOf(document, subjectId);
    const trimmed = normalizedTitle(title);
    if (!found || found.items.length >= MAX_ITEMS) return false;
    if (trimmed.length === 0 || trimmed.length > MAX_TITLE) return false;
    if (!PRIORITIES.includes(priority)) return false;
    const item = newItem(trimmed, priority, randomId());
    setDocument(withItems(document, subjectId, [...found.items, item]));
    setTransient({ pendingTaskCreationFocus: subjectId });
    persist();
    return true;
  }

  function createSubstep(subjectId, parentId, title) {
    const document = currentDocument();
    const found = itemsOf(document, subjectId);
    const trimmed = normalizedTitle(title);
    if (!found || found.items.length >= MAX_ITEMS) return false;
    if (!itemById(found.subject, parentId)) return false;
    if (trimmed.length === 0 || trimmed.length > MAX_TITLE) return false;
    const item = newItem(trimmed, "normal", randomId(), parentId);
    setDocument(withItems(document, subjectId, [...found.items, item]));
    persist();
    return true;
  }

  function addSubstepFromPrompt(subjectId, parentId) {
    const title = promptText("Nom de la sous-étape :");
    if (typeof title !== "string" || title.trim().length === 0) return false;
    return createSubstep(subjectId, parentId, title);
  }

  function updateItemCommand(subjectId, itemId, patch = {}) {
    const document = currentDocument();
    const found = itemsOf(document, subjectId);
    if (!found) return false;
    const item = itemById(found.subject, itemId);
    if (!item) return false;
    if (!patch || typeof patch.title !== "string") return false;
    const trimmed = patch.title.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TITLE) return false;
    if (!PRIORITIES.includes(patch.priority)) return false;
    if (Object.prototype.hasOwnProperty.call(patch, "note") &&
        (typeof patch.note !== "string" || patch.note.length > NOTE_MAX_LENGTH)) {
      return false;
    }
    const note = patch.note === undefined ? item.note : patch.note;
    const next = updateItem(document, subjectId, itemId, {
      title: patch.title,
      priority: patch.priority,
      ...(typeof note === "string" ? { note } : {})
    });
    setTransient({ editingItemId: null, focusItemId: itemId });
    if (next === document) {
      render();
      return false;
    }
    setDocument(next);
    persist();
    return true;
  }

  function setPriority(subjectId, itemId, priority) {
    const document = currentDocument();
    const next = setItemPriority(document, subjectId, itemId, priority);
    if (next === document) return false;
    setDocument(next);
    setTransient({ pendingPriorityFocus: itemId });
    persist();
    notify("Priorité mise à jour");
    return true;
  }

  function toggleItem(subjectId, itemId, done) {
    const document = currentDocument();
    const found = itemsOf(document, subjectId);
    if (!found) return false;
    const item = itemById(found.subject, itemId);
    if (!item) return false;
    const nextDone = done === undefined ? !item.done : done === true;
    if (nextDone === item.done) return false;
    const items = found.items.map((entry) =>
      entry.id === itemId ? { ...entry, done: nextDone } : entry);
    setDocument(withItems(document, subjectId, items));
    persist();
    return true;
  }

  function removeItem(subjectId, itemId) {
    if (typeof removeAction !== "function") return false;
    return removeAction(subjectId, itemId) === true;
  }

  function undoRemoval() {
    if (typeof undoAction !== "function") return false;
    return undoAction() === true;
  }

  function reorderItem(subjectId, itemId, targetId, position) {
    const document = currentDocument();
    const found = itemsOf(document, subjectId);
    if (!found) return false;
    const items = reorderWithinPriority(found.items, itemId, targetId, position);
    if (items === found.items) return false;
    setDocument(withItems(document, subjectId, items));
    setTransient({ pendingMoveFocus: { itemId, direction: null } });
    persist();
    notify("Étape déplacée");
    return true;
  }

  function moveItem(subjectId, itemId, direction) {
    const document = currentDocument();
    const found = itemsOf(document, subjectId);
    if (!found) return false;
    const items = moveWithinPriority(found.items, itemId, direction);
    if (items === found.items) return false;
    setDocument(withItems(document, subjectId, items));
    setTransient({ pendingMoveFocus: { itemId, direction } });
    persist();
    notify(direction === "up" ? "Étape montée" : "Étape descendue");
    return true;
  }

  function promoteItem(subjectId, itemId) {
    const document = currentDocument();
    const next = promoteItemToTopLevel(document, subjectId, itemId);
    if (next === document) return false;
    setDocument(next);
    setTransient({ revealItemId: itemId, focusItemId: itemId });
    persist();
    return true;
  }

  function toggleSubsteps(subjectId, parentId) {
    const transient = getTransient();
    const expandedParents = toggleExpandedParent(transient.expandedParents, parentId);
    setTransient({ expandedParents, pendingCollapseFocus: parentId });
    render();
    return true;
  }

  function openItemMenu(itemId) {
    setTransient({ openMenuId: itemId, pendingMenuFocus: null });
    render();
    return true;
  }

  function closeItemMenu(restoreFocus = false) {
    const transient = getTransient();
    const openedId = transient.openMenuId;
    setTransient({
      openMenuId: null,
      pendingMenuFocus: restoreFocus ? openedId : null
    });
    render();
    return openedId !== null && openedId !== undefined;
  }

  function beginEdit(subjectId, itemId) {
    const found = itemsOf(currentDocument(), subjectId);
    if (!found || !itemById(found.subject, itemId)) return false;
    setTransient({ editingItemId: itemId, focusItemId: null, openMenuId: null });
    render();
    return true;
  }

  function cancelEdit(subjectId, itemId) {
    setTransient({ editingItemId: null, focusItemId: itemId });
    render();
    return true;
  }

  function trackItem(subjectId, itemId) {
    const found = itemsOf(currentDocument(), subjectId);
    if (!found) return false;
    const item = itemById(found.subject, itemId);
    if (!item || item.done === true) return false;
    const ref = { subjectId, itemId };
    setResumeRef(ref);
    void saveResumePreference(ref);
    setTransient({ trackedItemId: itemId, revealItemId: itemId });
    render();
    return true;
  }

  function renameSubjectCommand(subjectId, title) {
    const document = currentDocument();
    const trimmed = normalizedTitle(title);
    if (trimmed.length === 0 || trimmed.length > MAX_SUBJECT_TITLE) return false;
    const next = renameSubject(document, subjectId, title);
    setTransient({ renamingSubject: false, focusRenameControl: true });
    if (next === document) {
      render();
      return false;
    }
    setDocument(next);
    persist();
    return true;
  }

  function startRename() {
    setTransient({ renamingSubject: true, editingItemId: null, openMenuId: null });
    render();
    return true;
  }

  function cancelRename() {
    setTransient({ renamingSubject: false, focusRenameControl: true });
    render();
    return true;
  }

  function runMenuCommand(subjectId, itemId, commandId) {
    const transient = getTransient();
    if (transient.openMenuId === itemId) setTransient({ openMenuId: null });
    switch (commandId) {
      case "edit": return beginEdit(subjectId, itemId);
      case "remove": return removeItem(subjectId, itemId);
      case "add-substep": return addSubstepFromPrompt(subjectId, itemId);
      case "promote": return promoteItem(subjectId, itemId);
      case "keep-track": return trackItem(subjectId, itemId);
      case "move-up": return moveItem(subjectId, itemId, "up");
      case "move-down": return moveItem(subjectId, itemId, "down");
      default: return false;
    }
  }

  function returnToOverview(subjectId) {
    setTransient({ renamingSubject: false, focusOpenSubjectId: subjectId });
    navigate("#/");
    return true;
  }

  function startDrag(subjectId, itemId, nativeEvent, handle) {
    if (typeof startDragAction !== "function") return false;
    const found = itemsOf(currentDocument(), subjectId);
    if (!found) return false;
    const item = itemById(found.subject, itemId);
    if (!item) return false;
    return startDragAction(nativeEvent, found.subject, item, handle) === true;
  }

  function cancelDrag(nativeEvent) {
    if (typeof cancelDragAction !== "function") return false;
    return cancelDragAction(nativeEvent) === true;
  }

  const commands = {
    createItem,
    createSubstep,
    addSubstepFromPrompt,
    updateItem: updateItemCommand,
    setPriority,
    toggleItem,
    removeItem,
    undoRemoval,
    reorderItem,
    moveItem,
    promoteItem,
    toggleSubsteps,
    openItemMenu,
    closeItemMenu,
    beginEdit,
    cancelEdit,
    trackItem,
    renameSubject: renameSubjectCommand,
    startRename,
    cancelRename,
    runMenuCommand,
    returnToOverview,
    startDrag,
    cancelDrag
  };

  return Object.freeze({
    ...commands,
    commandNames: Object.freeze(Object.keys(commands)),
    getResumeRef
  });
}
