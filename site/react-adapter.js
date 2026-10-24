/**
 * Narrow read-only presentation adapter between the existing controller and a
 * future React surface. It derives data with site/core.js helpers, keeps
 * transient UI state separate and never writes to Dexie, IndexedDB, Dexie
 * Cloud or the OTP flow. Every intention is delegated to an explicitly named
 * controller callback.
 */
import {
  findSubject,
  subjectMetrics,
  totalTaskCount,
  totalTaskCountLabel,
  subjectUrgencyLabel,
  subjectProgressLabel
} from "./core.js";
import { authorizedWorkspaceIdentityKey } from "./interaction-continuity.js";

export const REACT_ADAPTER_COMMAND_NAMES = Object.freeze([
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
  "returnToOverview"
]);

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

function snapshotFor(evaluation) {
  const { project, route, transient } = evaluation;
  const metrics = subjectMetrics(project);
  const topLevelCount = totalTaskCount(project.items);
  const items = (Array.isArray(project.items) ? project.items : []).map((item) => ({
    id: item.id,
    title: item.title,
    priority: item.priority,
    done: item.done === true,
    parentId: item.parentId === undefined ? null : item.parentId,
    note: item.note === undefined ? null : item.note
  }));
  return detach({
    view: route.view,
    subjectId: route.subjectId,
    readOnly: true,
    project: {
      id: project.id,
      title: project.title,
      pendingCount: metrics.pending,
      metrics,
      totalTaskCount: topLevelCount,
      totalTaskCountLabel: totalTaskCountLabel(topLevelCount),
      urgencyLabel: subjectUrgencyLabel(metrics.urgentPending),
      progressLabel: subjectProgressLabel(project.items)
    },
    items,
    transient
  });
}

export function createReactAdapter(dependencies = {}) {
  const {
    getDocument,
    getRoute,
    getTransientState,
    getAuthorizedIdentity,
    isBusinessAllowed,
    isLoadingBlocked,
    commands: handlers = {}
  } = dependencies;

  for (const [name, dependency] of Object.entries({
    getDocument,
    getRoute,
    isBusinessAllowed,
    isLoadingBlocked
  })) {
    if (typeof dependency !== "function") {
      throw new TypeError("react adapter requires " + name);
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
    if (route.view !== "subject" || typeof route.subjectId !== "string") {
      return { ok: false, reason: "route-not-detail" };
    }
    const project = findSubject(document, route.subjectId);
    if (!project) {
      return { ok: false, reason: "project-missing" };
    }
    const nextKey = [route.view, route.subjectId, identityKey].join("|");
    if (contextKey !== null && contextKey !== nextKey) {
      return { ok: false, reason: "context-changed" };
    }
    const transient = typeof getTransientState === "function"
      ? getTransientState()
      : {};
    return {
      ok: true,
      route,
      project,
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
      throw new TypeError("react adapter subscribe requires a listener");
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  const commands = {};
  for (const name of REACT_ADAPTER_COMMAND_NAMES) {
    commands[name] = (...args) => {
      const handler = handlers[name];
      if (typeof handler !== "function") {
        throw new TypeError("react adapter command is not configured: " + name);
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
    commandNames: REACT_ADAPTER_COMMAND_NAMES
  });
}
