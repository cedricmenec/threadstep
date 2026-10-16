// Pure domain functions. No API calls, frameworks or backend.
export const STORAGE_KEY = "threadstep.document.v1";
export const RESUME_KEY = "threadstep.resume.v1";
export const PRIORITIES = ["urgent", "normal", "later"];
const priorityIndex = (priority) => PRIORITIES.indexOf(priority);
export const emptyDocument = () => ({ version: 1, subjects: [] });
export const newSubject = (title, id) => ({ id, title: title.trim(), items: [] });
export const newItem = (title, priority, id, parentId = null) => ({
  id, title: title.trim(), priority, done: false, parentId
});
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
  if (title === item.title && patch.priority === item.priority) return document;
  const items = subject.items.map((entry) =>
    entry.id === itemId ? { ...entry, title, priority: patch.priority } : entry);
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
export function substepView(items, parentId, hideCompleted, collapsedIds) {
  if (parentId === null || parentId === undefined) {
    return { children: [], hasVisibleSubsteps: false, collapsed: false, renderChildren: false };
  }
  const children = visibleItems(items, parentId, hideCompleted);
  const hasVisibleSubsteps = children.length > 0;
  const collapsed = hasVisibleSubsteps && collapsedIds instanceof Set && collapsedIds.has(parentId);
  return { children, hasVisibleSubsteps, collapsed, renderChildren: hasVisibleSubsteps && !collapsed };
}
export function substepToggleLabel(visibleCount, collapsed) {
  if (!collapsed) return "Masquer les sous-tâches";
  const count = Number(visibleCount);
  if (count === 1) return "Voir 1 sous-tâche";
  if (Number.isFinite(count) && count > 1) return "Voir " + count + " sous-tâches";
  return "Masquer les sous-tâches";
}
export function toggleCollapsedParent(collapsedIds, parentId) {
  const next = collapsedIds instanceof Set ? new Set(collapsedIds) : new Set();
  if (next.has(parentId)) next.delete(parentId);
  else next.add(parentId);
  return next;
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
export function pendingCount(document) {
  return document.subjects.reduce((count, subject) =>
    count + subject.items.filter((item) => !item.done).length, 0);
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
          !(item.parentId === null || validId(item.parentId))) {
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
function validId(value) { return typeof value === "string" && value.length > 0 && value.length <= 100; }
function validTitle(value, length) { return typeof value === "string" && value.trim().length > 0 && value.length <= length; }
