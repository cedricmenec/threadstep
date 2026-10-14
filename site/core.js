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
