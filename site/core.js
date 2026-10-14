// Pure domain functions. No API calls, frameworks or backend.
export const STORAGE_KEY = "threadstep.document.v1";
export const PRIORITIES = ["urgent", "normal", "later"];
const priorityIndex = (priority) => PRIORITIES.indexOf(priority);
export const emptyDocument = () => ({ version: 1, subjects: [] });
export const newSubject = (title, id) => ({ id, title: title.trim(), items: [] });
export const newItem = (title, priority, id, parentId = null) => ({
  id, title: title.trim(), priority, done: false, parentId
});
export function sortedItems(items, parentId = null) {
  return items.filter((item) => item.parentId === parentId)
    .sort((a, b) => priorityIndex(a.priority) - priorityIndex(b.priority));
}
export function pendingCount(document) {
  return document.subjects.reduce((count, subject) =>
    count + subject.items.filter((item) => !item.done).length, 0);
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
