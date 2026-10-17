// Dexie Cloud read boundary. A failed read must never become "empty database":
// callers must not migrate, import or render an empty dashboard on error.
import { parseDocument } from "./core.js";
import { documentToRecords, recordsToDocument } from "./persistence.js";

export function normalizedSyncedRecords(raw) {
  if (!raw || !Array.isArray(raw.subjects) || !Array.isArray(raw.items)) {
    throw new TypeError("Dexie returned invalid tables");
  }
  const document = parseDocument(JSON.stringify(recordsToDocument(raw)));
  const records = documentToRecords(document);
  if (records.subjects.length !== raw.subjects.length ||
      records.items.length !== raw.items.length) {
    throw new Error("Dangling subject references in IndexedDB");
  }
  return records;
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
