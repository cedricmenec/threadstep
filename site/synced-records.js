// Dexie Cloud read boundary. A failed read must never become "empty database":
// callers must not migrate, import or render an empty dashboard on error.
import { normalizedRecords } from "./persistence.js";

export function normalizedSyncedRecords(raw) {
  return normalizedRecords(raw);
}

export async function readSyncedRecords(db) {
  if (!db || typeof db.transaction !== "function" ||
      !db.subjects || !db.items) {
    throw new TypeError("Dexie database is not initialized");
  }
  const raw = await db.transaction("r", db.subjects, db.items, async () => ({
    subjects: await db.subjects.toArray(),
    items: await db.items.toArray()
  }));
  return normalizedSyncedRecords(raw);
}
