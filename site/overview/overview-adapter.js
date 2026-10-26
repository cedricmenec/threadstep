/**
 * Read-only presentation adapter for the bounded Overview project-card
 * surface. It derives everything from the current controller document through
 * site/core.js and never reads or writes Dexie, IndexedDB, localStorage, the
 * network or the OTP flow. Every user intention is delegated to an explicitly
 * named controller callback.
 */
import {
  OVERVIEW_FILTER_ALL,
  overviewFilteredSubjects,
  subjectMetrics,
  totalTaskCount,
  totalTaskCountLabel,
  subjectUrgencyLabel,
  subjectProgressLabel
} from "../core.js";
import { authorizedWorkspaceIdentityKey } from "../interaction-continuity.js";
import { OVERVIEW_PRESENTATION_STATE } from "../overview-read-state.js";

export const OVERVIEW_COMMAND_NAMES = Object.freeze([
  "openProject",
  "seeMore",
  "moveProject",
  "removeProject",
  "resetFilter",
  "renameSubject",
  "createItem",
  "updateItem",
  "toggleItem",
  "removeItem",
  "reorderItem",
  "promoteItem",
  "toggleSubsteps",
  "openItemMenu",
  "closeItemMenu",
  "trackItem",
  "returnToOverview",
  "createSubstep",
  "setPriority",
  "undoRemoval",
  "moveItem",
  "beginEdit",
  "cancelEdit",
  "startDrag",
  "cancelDrag",
  "startRename",
  "cancelRename",
  "addSubstepFromPrompt",
  "runMenuCommand"
]);

const EMPTY_FILTERED_MESSAGES = Object.freeze({
  urgent: "Aucun projet avec urgence en attente",
  following: "Aucun projet à suivre",
  completed: "Aucun projet terminé"
});

function detach(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    for (const entry of value) copy.push(detach(entry, seen));
    return Object.freeze(copy);
  }
  if (value instanceof Set) {
    return detach([...value], seen);
  }
  if (value instanceof Map) {
    return detach(Object.fromEntries(value), seen);
  }
  const copy = {};
  seen.set(value, copy);
  for (const [key, entry] of Object.entries(value)) {
    copy[key] = detach(entry, seen);
  }
  return Object.freeze(copy);
}

function normalizeRoute(route) {
  if (!route || typeof route !== "object") return { view: "overview" };
  return route;
}

function itemSnapshot(item) {
  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    done: item.done === true,
    parentId: item.parentId === undefined ? null : item.parentId,
    note: item.note === undefined ? null : item.note
  };
}

function projectSnapshot(project, index, totalProjects) {
  const sourceItems = Array.isArray(project.items) ? project.items : [];
  const metrics = subjectMetrics(project);
  const topLevelCount = totalTaskCount(sourceItems);
  return {
    id: project.id,
    title: project.title,
    pendingCount: metrics.pending,
    metrics,
    totalTaskCount: topLevelCount,
    totalTaskCountLabel: totalTaskCountLabel(topLevelCount),
    urgencyLabel: subjectUrgencyLabel(metrics.urgentPending),
    progressLabel: subjectProgressLabel(sourceItems),
    index,
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < totalProjects - 1,
    items: sourceItems.map(itemSnapshot)
  };
}

function transientSnapshot(transient, filter) {
  const source = transient && typeof transient === "object" ? transient : {};
  const expandedParents = source.expandedParents instanceof Set
    ? [...source.expandedParents]
    : Array.isArray(source.expandedParents)
      ? source.expandedParents
      : [];
  return {
    expandedParents,
    openMenuId: source.openMenuId === undefined ? null : source.openMenuId,
    editingItemId: source.editingItemId === undefined ? null : source.editingItemId,
    hideCompleted: source.hideCompleted === true,
    trackedItemId: source.trackedItemId === undefined ? null : source.trackedItemId,
    revealItemId: source.revealItemId === undefined ? null : source.revealItemId,
    projectFilter: filter
  };
}

function emptyState(filter) {
  if (filter === OVERVIEW_FILTER_ALL) {
    return {
      kind: "all",
      message: "Aucun sujet pour le moment. Ajoutez un premier fil de travail ci-dessus.",
      resetLabel: null
    };
  }
  return {
    kind: "filtered",
    message: EMPTY_FILTERED_MESSAGES[filter] || EMPTY_FILTERED_MESSAGES.urgent,
    resetLabel: "Tous les projets"
  };
}

function snapshotFor(evaluation) {
  const { document, transient } = evaluation;
  const filter = transient.projectFilter || OVERVIEW_FILTER_ALL;
  const subjects = Array.isArray(document.subjects) ? document.subjects : [];
  const filtered = overviewFilteredSubjects(subjects, filter);
  const projects = filtered.map((project) =>
    projectSnapshot(project, subjects.indexOf(project), subjects.length));
  return detach({
    view: "overview",
    readOnly: true,
    filter,
    projects,
    empty: projects.length === 0 ? emptyState(filter) : null,
    transient: transientSnapshot(transient, filter)
  });
}

function readPresentation(input) {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object") return null;
  return input;
}

export function createOverviewAdapter(dependencies = {}) {
  const {
    getDocument,
    getRoute,
    getTransientState,
    getAuthorizedIdentity,
    isBusinessAllowed,
    isLoadingBlocked,
    getPresentation,
    commands: handlers = {}
  } = dependencies;

  for (const [name, dependency] of Object.entries({
    getDocument,
    getRoute,
    isBusinessAllowed,
    isLoadingBlocked
  })) {
    if (typeof dependency !== "function") {
      throw new TypeError("overview adapter requires " + name);
    }
  }

  let invalidated = false;
  let invalidatedReason = null;
  let contextKey = null;
  const listeners = new Set();

  function notify(snapshot, metadata) {
    for (const listener of [...listeners]) {
      listener(snapshot, metadata);
    }
  }

  function invalidate(reason = "invalidate") {
    if (invalidated) return false;
    invalidated = true;
    invalidatedReason = typeof reason === "string" && reason.length > 0
      ? reason
      : "invalidate";
    notify(null, { invalidated: true, reason: invalidatedReason });
    return true;
  }

  function evaluate() {
    if (invalidated) return { ok: false, reason: invalidatedReason };
    if (isBusinessAllowed() !== true) {
      return { ok: false, reason: "business-not-allowed" };
    }
    if (isLoadingBlocked() === true) {
      return { ok: false, reason: "loading-blocked" };
    }
    const route = normalizeRoute(getRoute());
    if (route.view !== "overview") {
      return { ok: false, reason: "route-not-overview" };
    }
    const identity = typeof getAuthorizedIdentity === "function"
      ? getAuthorizedIdentity()
      : null;
    const identityKey = authorizedWorkspaceIdentityKey(identity);
    if (identityKey === null) {
      return { ok: false, reason: "identity-unavailable" };
    }
    const document = getDocument();
    if (!document || !Array.isArray(document.subjects)) {
      return { ok: false, reason: "document-unavailable" };
    }
    const presentation = typeof getPresentation === "function"
      ? readPresentation(getPresentation())
      : null;
    if (presentation && (presentation.state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ ||
        (presentation.actionRequired === true && presentation.projectsAvailable !== true))) {
      return { ok: false, reason: "read-unavailable" };
    }
    const nextKey = [
      "overview",
      identityKey,
      presentation && presentation.actionRequired ? "blocked" : "allowed"
    ].join("|");
    if (contextKey !== null && contextKey !== nextKey) {
      return { ok: false, reason: "context-changed" };
    }
    const transient = typeof getTransientState === "function"
      ? getTransientState()
      : {};
    return {
      ok: true,
      document,
      transient: transient && typeof transient === "object" ? transient : {},
      key: nextKey
    };
  }

  function ensure() {
    const evaluation = evaluate();
    if (!evaluation.ok) {
      invalidate(evaluation.reason);
      return evaluation;
    }
    if (contextKey === null) contextKey = evaluation.key;
    return evaluation;
  }

  function getSnapshot() {
    const evaluation = ensure();
    return evaluation.ok ? snapshotFor(evaluation) : null;
  }

  function refresh() {
    const evaluation = ensure();
    if (!evaluation.ok) return null;
    const snapshot = snapshotFor(evaluation);
    notify(snapshot, { invalidated: false, reason: "refresh" });
    return snapshot;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("overview adapter subscribe requires a listener");
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  const commands = {};
  for (const name of OVERVIEW_COMMAND_NAMES) {
    commands[name] = (...args) => {
      const handler = handlers[name];
      if (typeof handler !== "function") {
        throw new TypeError("overview adapter command is not configured: " + name);
      }
      return handler(...args);
    };
  }

  return Object.freeze({
    getSnapshot,
    refresh,
    subscribe,
    invalidate,
    isInvalidated: () => invalidated,
    invalidationReason: () => invalidatedReason,
    listenerCount: () => listeners.size,
    commands: Object.freeze(commands),
    commandNames: OVERVIEW_COMMAND_NAMES
  });
}
