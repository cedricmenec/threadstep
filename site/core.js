// Pure domain functions. No API calls, frameworks or backend.
export const STORAGE_KEY = "threadstep.document.v1";
export const RESUME_KEY = "threadstep.resume.v1";
export const PRIORITIES = ["urgent", "normal", "later"];
export const OVERVIEW_TASK_LIMIT = 5;
export const OVERVIEW_FILTER_ALL = "all";
export const OVERVIEW_FILTER_URGENT = "urgent";
export const OVERVIEW_FILTER_FOLLOWING = "following";
export const OVERVIEW_FILTER_COMPLETED = "completed";
export const NOTE_MAX_LENGTH = 2000;
const priorityIndex = (priority) => PRIORITIES.indexOf(priority);
export const emptyDocument = () => ({ version: 1, subjects: [] });
export const newSubject = (title, id) => ({ id, title: title.trim(), items: [] });
export const newItem = (title, priority, id, parentId = null) => ({
  id, title: title.trim(), priority, done: false, parentId
});
export function subjectRoute(subjectId) {
  if (!validId(subjectId)) return null;
  return "#/sujet/" + encodeURIComponent(subjectId);
}
export const NAV_MENU_ENTRIES = Object.freeze([
  Object.freeze({ label: "Mes projets", fragment: "#/", headingId: "dashboard-title" }),
  Object.freeze({ label: "Paramètres", fragment: "#/parametres", headingId: "settings-title" }),
  Object.freeze({ label: "Imports / Exports", fragment: "#/parametres/donnees", headingId: "settings-data-title" }),
  Object.freeze({ label: "Synchronisation Dexie Cloud", fragment: "#/parametres/synchronisation", headingId: "settings-sync-title" })
]);
const SETTINGS_ROUTES = Object.freeze({
  "/parametres": "root",
  "/parametres/donnees": "data",
  "/parametres/synchronisation": "sync"
});
export function routeHeadingId(route) {
  if (!route || typeof route !== "object") return null;
  if (route.view === "overview") return "dashboard-title";
  if (route.view !== "settings") return null;
  if (route.section === "root") return "settings-title";
  if (route.section === "data") return "settings-data-title";
  if (route.section === "sync") return "settings-sync-title";
  return null;
}
export function navigationMenuState(state, action) {
  const open = !!(state && state.open === true);
  switch (action) {
    case "toggle":
      return { open: !open, restoreFocus: false };
    case "escape":
      return { open: false, restoreFocus: open };
    case "outside":
    case "navigate":
    case "route-change":
      return { open: false, restoreFocus: false };
    default:
      return { open, restoreFocus: false };
  }
}
export function parseRoute(hash) {
  if (typeof hash !== "string") return { view: "overview" };
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (fragment === "" || fragment === "/") return { view: "overview" };
  if (Object.prototype.hasOwnProperty.call(SETTINGS_ROUTES, fragment)) {
    return { view: "settings", section: SETTINGS_ROUTES[fragment] };
  }
  if (fragment === "/sujet") return { view: "invalid" };
  if (!fragment.startsWith("/sujet/")) return { view: "overview" };
  const rawId = fragment.slice("/sujet/".length);
  if (rawId === "") return { view: "invalid" };
  let subjectId;
  try {
    subjectId = decodeURIComponent(rawId);
  } catch {
    return { view: "invalid" };
  }
  if (!validId(subjectId)) return { view: "invalid" };
  return { view: "subject", subjectId };
}
export function findSubject(document, subjectId) {
  if (!document || !Array.isArray(document.subjects)) return null;
  return document.subjects.find((entry) => entry.id === subjectId) || null;
}
export function moveSubject(subjects, subjectId, direction) {
  const from = subjects.findIndex((subject) => subject.id === subjectId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= subjects.length) return subjects;
  const next = subjects.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
export function updateItem(document, subjectId, itemId, patch) {
  const subject = document.subjects.find((entry) => entry.id === subjectId);
  if (!subject) return document;
  const item = subject.items.find((entry) => entry.id === itemId);
  if (!item) return document;
  if (!patch || typeof patch.title !== "string") return document;
  const title = patch.title.trim();
  if (title.length === 0 || title.length > 300) return document;
  if (!PRIORITIES.includes(patch.priority)) return document;
  const hasNote = Object.prototype.hasOwnProperty.call(patch, "note");
  if (hasNote && (typeof patch.note !== "string" || patch.note.length > NOTE_MAX_LENGTH)) {
    return document;
  }
  const currentNote = normalizeNote(item.note);
  const nextNote = hasNote ? normalizeNote(patch.note) : currentNote;
  if (title === item.title && patch.priority === item.priority && nextNote === currentNote) {
    return document;
  }
  const rebuilt = { ...item, title, priority: patch.priority };
  if (nextNote === null) delete rebuilt.note;
  else rebuilt.note = nextNote;
  const items = subject.items.map((entry) =>
    entry.id === itemId ? rebuilt : entry);
  const subjects = document.subjects.map((entry) =>
    entry.id === subjectId ? { ...entry, items } : entry);
  return { ...document, subjects };
}
export function renameSubject(document, subjectId, title) {
  if (!document || !Array.isArray(document.subjects)) return document;
  if (typeof title !== "string") return document;
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return document;
  const subject = document.subjects.find((entry) => entry.id === subjectId);
  if (!subject) return document;
  if (trimmed === subject.title) return document;
  const subjects = document.subjects.map((entry) =>
    entry.id === subjectId ? { ...entry, title: trimmed } : entry);
  return { ...document, subjects };
}
export function setItemPriority(document, subjectId, itemId, priority) {
  if (!document || !Array.isArray(document.subjects)) return document;
  const subject = document.subjects.find((entry) => entry.id === subjectId);
  if (!subject || !Array.isArray(subject.items)) return document;
  const item = subject.items.find((entry) => entry.id === itemId);
  if (!item) return document;
  if (!PRIORITIES.includes(priority)) return document;
  if (priority === item.priority) return document;
  const items = subject.items.map((entry) =>
    entry.id === itemId ? { ...entry, priority } : entry);
  const subjects = document.subjects.map((entry) =>
    entry.id === subjectId ? { ...entry, items } : entry);
  return { ...document, subjects };
}
export function sortedItems(items, parentId = null) {
  return items.filter((item) => item.parentId === parentId)
    .sort((a, b) => priorityIndex(a.priority) - priorityIndex(b.priority));
}
export function isItemVisible(item, items, hideCompleted) {
  if (!hideCompleted || !item.done) return true;
  return items.some((child) => child.parentId === item.id && !child.done);
}
export function visibleItems(items, parentId = null, hideCompleted = false) {
  return sortedItems(items, parentId).filter((item) => isItemVisible(item, items, hideCompleted));
}
export function overviewPreview(items, hideCompleted = false, limit = OVERVIEW_TASK_LIMIT) {
  const visible = visibleItems(items, null, hideCompleted);
  const safeLimit = Number.isInteger(limit) && limit >= 0 ? limit : OVERVIEW_TASK_LIMIT;
  const shown = visible.slice(0, safeLimit);
  return { shown, hasMore: visible.length > shown.length };
}
export function isWithinOverviewPreview(items, itemId, hideCompleted = false) {
  return overviewPreview(items, hideCompleted).shown.some((item) => item.id === itemId);
}
export function substepView(items, parentId, hideCompleted, expandedIds) {
  if (parentId === null || parentId === undefined) {
    return { children: [], hasVisibleSubsteps: false, collapsed: false, renderChildren: false };
  }
  const children = visibleItems(items, parentId, hideCompleted);
  const hasVisibleSubsteps = children.length > 0;
  const expanded = expandedIds instanceof Set && expandedIds.has(parentId);
  const collapsed = hasVisibleSubsteps && !expanded;
  return { children, hasVisibleSubsteps, collapsed, renderChildren: hasVisibleSubsteps && !collapsed };
}
export function substepToggleLabel(visibleCount, collapsed) {
  if (!collapsed) return "Masquer les sous-tâches";
  const count = Number(visibleCount);
  if (count === 1) return "Voir 1 sous-tâche";
  if (Number.isFinite(count) && count > 1) return "Voir " + count + " sous-tâches";
  return "Masquer les sous-tâches";
}
export function toggleExpandedParent(expandedIds, parentId) {
  const next = expandedIds instanceof Set ? new Set(expandedIds) : new Set();
  if (next.has(parentId)) next.delete(parentId);
  else next.add(parentId);
  return next;
}
export function substepAncestorId(items, itemId) {
  if (!Array.isArray(items)) return null;
  const item = items.find((entry) => entry && entry.id === itemId);
  if (!item || item.parentId === null || item.parentId === undefined) return null;
  return item.parentId;
}
export function isViewEntry(previousRoute, nextRoute) {
  return viewKey(previousRoute) !== viewKey(nextRoute);
}
function viewKey(route) {
  if (!route || typeof route !== "object") return "";
  const view = typeof route.view === "string" ? route.view : "";
  if (view === "subject" && typeof route.subjectId === "string") {
    return "subject:" + route.subjectId;
  }
  if (view === "settings") {
    const section = typeof route.section === "string" ? route.section : "";
    return "settings:" + section;
  }
  return view;
}
export function reorderWithinPriority(items, itemId, targetId, position) {
  if (!Array.isArray(items)) return items;
  if (position !== "before" && position !== "after") return items;
  if (itemId === targetId) return items;
  const source = items.find((item) => item && item.id === itemId);
  const target = items.find((item) => item && item.id === targetId);
  if (!source || !target) return items;
  if (source.parentId !== target.parentId) return items;
  if (source.priority !== target.priority) return items;
  const parentId = source.parentId;
  const priority = source.priority;
  const slots = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.parentId === parentId && item.priority === priority) slots.push(index);
  }
  const group = slots.map((slot) => items[slot]);
  const from = group.indexOf(source);
  if (from === -1) return items;
  const ordered = group.slice();
  ordered.splice(from, 1);
  const to = ordered.indexOf(target);
  if (to === -1) return items;
  ordered.splice(position === "before" ? to : to + 1, 0, source);
  if (ordered.every((item, index) => item === group[index])) return items;
  const next = items.slice();
  slots.forEach((slot, index) => { next[slot] = ordered[index]; });
  return next;
}
export function moveWithinPriority(items, itemId, direction) {
  if (!Array.isArray(items)) return items;
  if (direction !== "up" && direction !== "down") return items;
  const source = items.find((item) => item && item.id === itemId);
  if (!source) return items;
  const group = items.filter((item) =>
    item.parentId === source.parentId && item.priority === source.priority);
  const index = group.indexOf(source);
  if (index === -1) return items;
  const neighbour = direction === "up" ? group[index - 1] : group[index + 1];
  if (!neighbour) return items;
  return reorderWithinPriority(items, itemId, neighbour.id, direction === "up" ? "before" : "after");
}
export function canReorderWithinPriority(items, itemId, targetId, position) {
  return reorderWithinPriority(items, itemId, targetId, position) !== items;
}
export function canMoveWithinPriority(items, itemId, direction) {
  return moveWithinPriority(items, itemId, direction) !== items;
}
const menuLabels = {
  edit: "Modifier",
  remove: "Retirer",
  "add-substep": "Ajouter une sous-tâche",
  promote: "Promouvoir en tâche principale",
  "keep-track": "Garder le fil",
  tracked: "Action suivie",
  "move-up": "Monter",
  "move-down": "Descendre"
};
export function itemMenuCommands(item, options = {}) {
  if (!item || typeof item !== "object") return [];
  const settings = options && typeof options === "object" ? options : {};
  const tracked = settings.tracked === true;
  const canMoveUp = settings.canMoveUp === true;
  const canMoveDown = settings.canMoveDown === true;
  const isSubstep = item.parentId !== null && item.parentId !== undefined;
  const commands = [
    { id: "edit", label: menuLabels.edit, disabled: false },
    { id: "remove", label: menuLabels.remove, disabled: false }
  ];
  if (isSubstep) {
    commands.push({ id: "promote", label: menuLabels.promote, disabled: false });
  } else {
    commands.push({ id: "add-substep", label: menuLabels["add-substep"], disabled: false });
    if (item.done !== true) {
      commands.push({
        id: "keep-track",
        label: tracked ? menuLabels.tracked : menuLabels["keep-track"],
        disabled: tracked
      });
    }
  }
  commands.push({ id: "move-up", label: menuLabels["move-up"], disabled: !canMoveUp });
  commands.push({ id: "move-down", label: menuLabels["move-down"], disabled: !canMoveDown });
  return commands;
}
function promotionTarget(document, subjectId, itemId) {
  if (!document || !Array.isArray(document.subjects)) return null;
  const subject = document.subjects.find((entry) => entry && entry.id === subjectId);
  if (!subject || !Array.isArray(subject.items)) return null;
  const item = subject.items.find((entry) => entry && entry.id === itemId);
  if (!item || item.parentId === null || item.parentId === undefined) return null;
  const parent = subject.items.find((entry) => entry && entry.id === item.parentId);
  if (!parent || parent.parentId !== null || parent.id === item.id) return null;
  return { subject, item, parent };
}
export function canPromoteItemToTopLevel(document, subjectId, itemId) {
  return promotionTarget(document, subjectId, itemId) !== null;
}
export function promoteItemToTopLevel(document, subjectId, itemId) {
  const target = promotionTarget(document, subjectId, itemId);
  if (!target) return document;
  const { subject, item, parent } = target;
  const promoted = { ...item, parentId: null };
  const remaining = subject.items.filter((entry) => entry.id !== itemId);
  const parentIndex = remaining.findIndex((entry) => entry.id === parent.id);
  if (parentIndex === -1) return document;
  const items = remaining.slice();
  items.splice(parentIndex + 1, 0, promoted);
  const subjects = document.subjects.map((entry) =>
    entry.id === subjectId ? { ...entry, items } : entry);
  return { ...document, subjects };
}
export function pendingCount(document) {
  return document.subjects.reduce((count, subject) =>
    count + subject.items.filter((item) => !item.done).length, 0);
}
export function totalTaskCount(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => item && item.parentId === null).length;
}
export function totalTaskCountLabel(count) {
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return normalized + " tâche" + (normalized > 1 ? "s" : "") + " au total";
}
function countItemMetrics(items) {
  const list = Array.isArray(items) ? items : [];
  let total = 0;
  let done = 0;
  let pending = 0;
  let urgentPending = 0;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    total += 1;
    if (item.done === true) {
      done += 1;
    } else {
      pending += 1;
      if (item.priority === "urgent") urgentPending += 1;
    }
  }
  return { total, done, pending, urgentPending, active: pending > 0 };
}
export function subjectMetrics(subject) {
  if (!subject || typeof subject !== "object") return countItemMetrics([]);
  return countItemMetrics(subject.items);
}
export function overviewMetrics(document) {
  const subjects = document && Array.isArray(document.subjects) ? document.subjects : [];
  let activeProjects = 0;
  let pendingSteps = 0;
  let urgentSteps = 0;
  for (const subject of subjects) {
    const metrics = subjectMetrics(subject);
    if (metrics.active) activeProjects += 1;
    pendingSteps += metrics.pending;
    urgentSteps += metrics.urgentPending;
  }
  return { activeProjects, pendingSteps, urgentSteps };
}
export function subjectHasPendingUrgency(subject) {
  return subjectMetrics(subject).urgentPending > 0;
}
export function overviewSubjectStatus(subject) {
  const metrics = subjectMetrics(subject);
  if (metrics.pending > 0) return "following";
  if (metrics.total > 0) return "completed";
  return "empty";
}
export function isSubjectVisibleInOverviewFilter(subject, mode) {
  if (mode === OVERVIEW_FILTER_URGENT) return subjectHasPendingUrgency(subject);
  if (mode === OVERVIEW_FILTER_FOLLOWING || mode === OVERVIEW_FILTER_COMPLETED) {
    return overviewSubjectStatus(subject) === mode;
  }
  return true;
}
export function overviewFilteredSubjects(subjects, mode) {
  if (!Array.isArray(subjects)) return [];
  if (mode !== OVERVIEW_FILTER_URGENT && mode !== OVERVIEW_FILTER_FOLLOWING &&
      mode !== OVERVIEW_FILTER_COMPLETED) {
    return subjects;
  }
  return subjects.filter((subject) => isSubjectVisibleInOverviewFilter(subject, mode));
}
function countLabel(count, singular, plural) {
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return normalized + " " + (normalized > 1 ? plural : singular);
}
export function overviewSummaryLabel(metrics) {
  const activeProjects = metrics && Number.isFinite(metrics.activeProjects) ? metrics.activeProjects : 0;
  const pendingSteps = metrics && Number.isFinite(metrics.pendingSteps) ? metrics.pendingSteps : 0;
  const urgentSteps = metrics && Number.isFinite(metrics.urgentSteps) ? metrics.urgentSteps : 0;
  return [
    countLabel(activeProjects, "projet actif", "projets actifs"),
    countLabel(pendingSteps, "étape en attente", "étapes en attente"),
    countLabel(urgentSteps, "urgence en attente", "urgences en attente")
  ].join(" · ");
}
export function subjectUrgencyLabel(count) {
  return countLabel(count, "urgence restante", "urgences restantes");
}
export function subjectProgressLabel(items) {
  const metrics = countItemMetrics(items);
  if (metrics.total === 0) return "Aucune étape";
  const percent = Math.round(100 * metrics.done / metrics.total);
  const steps = metrics.total > 1 ? "étapes terminées" : "étape terminée";
  return metrics.done + " / " + metrics.total + " " + steps + " (" + percent + " %)";
}
export function nextActionSuggestion(document) {
  let best = null;
  let bestRank = null;
  document.subjects.forEach((subject, subjectIndex) => {
    subject.items.forEach((item, itemIndex) => {
      if (item.parentId !== null || item.done) return;
      const rank = [priorityIndex(item.priority), subjectIndex, itemIndex];
      if (best && !isBetterRank(rank, bestRank)) return;
      best = {
        subjectId: subject.id,
        subjectTitle: subject.title,
        itemId: item.id,
        itemTitle: item.title,
        priority: item.priority
      };
      bestRank = rank;
    });
  });
  return best;
}
function isBetterRank(rank, bestRank) {
  if (rank[0] !== bestRank[0]) return rank[0] < bestRank[0];
  if (rank[1] !== bestRank[1]) return rank[1] < bestRank[1];
  return rank[2] < bestRank[2];
}
const reasonLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };
export function suggestionReason(priority) {
  if (!PRIORITIES.includes(priority)) return null;
  const label = reasonLabels[priority];
  if (!label) return null;
  return "Choisie selon sa priorité « " + label +
    " » ; en cas d'égalité, l'ordre des sujets puis des actions décide.";
}
export function parseResumePreference(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  return validResumeRef(value) ? { subjectId: value.subjectId, itemId: value.itemId } : null;
}
export function serializeResumePreference(ref) {
  if (!validResumeRef(ref)) return null;
  return JSON.stringify({ subjectId: ref.subjectId, itemId: ref.itemId });
}
function validResumeRef(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    validId(value.subjectId) && validId(value.itemId);
}
export function resumeView(document, ref) {
  if (!validResumeRef(ref)) return null;
  const subject = document.subjects.find((entry) => entry.id === ref.subjectId);
  if (!subject) return null;
  const item = subject.items.find((entry) => entry.id === ref.itemId);
  if (!item || item.parentId !== null || item.done) return null;
  return {
    subjectId: subject.id,
    subjectTitle: subject.title,
    itemId: item.id,
    itemTitle: item.title,
    priority: item.priority
  };
}
export function planRemoval(document, subjectId, itemId) {
  const subject = document.subjects.find((entry) => entry.id === subjectId);
  if (!subject) return { document, removal: null };
  const item = subject.items.find((entry) => entry.id === itemId);
  if (!item) return { document, removal: null };
  const removeChildren = item.parentId === null;
  const entries = [];
  subject.items.forEach((entry, index) => {
    if (entry.id === itemId || (removeChildren && entry.parentId === itemId)) {
      entries.push({ index, item: { ...entry } });
    }
  });
  const items = subject.items.filter((entry) =>
    entry.id !== itemId && !(removeChildren && entry.parentId === itemId));
  const subjects = document.subjects.map((entry) =>
    entry.id === subjectId ? { ...entry, items } : entry);
  const removal = { subjectId, rootId: itemId, entries };
  return { document: { ...document, subjects }, removal };
}
export function restoreRemoval(document, removal) {
  if (!removal || !Array.isArray(removal.entries) || removal.entries.length === 0) return document;
  const subject = document.subjects.find((entry) => entry.id === removal.subjectId);
  if (!subject) return document;
  const present = new Set(subject.items.map((entry) => entry.id));
  const items = subject.items.slice();
  let inserted = false;
  const ordered = removal.entries.slice().sort((a, b) => a.index - b.index);
  for (const entry of ordered) {
    if (!entry || !entry.item || present.has(entry.item.id)) continue;
    const at = Math.min(Math.max(entry.index, 0), items.length);
    items.splice(at, 0, { ...entry.item });
    present.add(entry.item.id);
    inserted = true;
  }
  if (!inserted) return document;
  const subjects = document.subjects.map((entry) =>
    entry.id === removal.subjectId ? { ...entry, items } : entry);
  return { ...document, subjects };
}
export function removalContainsItem(removal, itemId) {
  if (!removal || !Array.isArray(removal.entries)) return false;
  return removal.entries.some((entry) => entry && entry.item && entry.item.id === itemId);
}
export function restorableTrackingRef(document, trackedRef) {
  if (!resumeView(document, trackedRef)) return null;
  return { subjectId: trackedRef.subjectId, itemId: trackedRef.itemId };
}
export function parseDocument(source) {
  const doc = JSON.parse(source);
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || doc.version !== 1 ||
      !Array.isArray(doc.subjects) || doc.subjects.length > 40) {
    throw new Error("Format ThreadStep incompatible.");
  }
  const subjectIds = new Set();
  for (const subject of doc.subjects) {
    if (!validId(subject.id) || subjectIds.has(subject.id) ||
        !validTitle(subject.title, 100) || !Array.isArray(subject.items) ||
        subject.items.length > 500) {
      throw new Error("Sujet invalide dans le fichier.");
    }
    subjectIds.add(subject.id);
    const ids = new Set();
    for (const item of subject.items) {
      if (!validId(item.id) || ids.has(item.id) ||
          !validTitle(item.title, 300) || !PRIORITIES.includes(item.priority) ||
          typeof item.done !== "boolean" ||
          !(item.parentId === null || validId(item.parentId)) ||
          (item.note !== undefined &&
            (typeof item.note !== "string" || item.note.length > NOTE_MAX_LENGTH))) {
        throw new Error("Étape invalide dans le fichier.");
      }
      ids.add(item.id);
    }
    for (const item of subject.items) {
      if (item.parentId !== null) {
        const parent = subject.items.find((other) => other.id === item.parentId);
        if (!parent || parent.parentId !== null || parent.id === item.id) {
          throw new Error("Hiérarchie d'étapes invalide.");
        }
      }
    }
  }
  return doc;
}
function normalizeNote(value) {
  if (typeof value !== "string") return null;
  return value.trim().length > 0 ? value : null;
}
function validId(value) { return typeof value === "string" && value.length > 0 && value.length <= 100; }
function validTitle(value, length) { return typeof value === "string" && value.trim().length > 0 && value.length <= length; }
