// Dexie Cloud read boundary. A failed read must never become "empty database":
// callers must not migrate, import or render an empty dashboard on error.
import { normalizedRecords } from "./persistence.js";
import {
  READ_FAILURE,
  classifyReadError,
  readWorkspaceResult,
  typedReadError
} from "./data-integrity-recovery.js";

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

// Raw read of both tables inside one `r` transaction. Callers that need the
// read-only inventory or the raw recovery export must use this function: it
// never projects or throws a business validation error.
export async function readSyncedRaw(db) {
  if (!db || typeof db.transaction !== "function" ||
      !db.subjects || !db.items) {
    throw typedReadError(READ_FAILURE.STORAGE_UNAVAILABLE);
  }
  try {
    return await db.transaction("r", db.subjects, db.items, async () => ({
      subjects: await db.subjects.toArray(),
      items: await db.items.toArray()
    }));
  } catch (error) {
    throw typedReadError(classifyReadError(error), error);
  }
}

// Typed read boundary: projection-invalid keeps the raw tables so the caller
// can enter the read-only degraded consultation.
export async function readSyncedWorkspace(db) {
  return readWorkspaceResult(() => readSyncedRaw(db));
}
