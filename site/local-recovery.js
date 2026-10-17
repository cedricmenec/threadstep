// Read-only recovery of the historical V1 document while Dexie Cloud login is
// unavailable. Do not initialize IndexedDB, authenticate, sync or migrate here.
import { STORAGE_KEY, parseDocument } from "./core.js";

export function availableLocalBackup(storage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const document = parseDocument(raw);
    if (!document || !Array.isArray(document.subjects)) return null;
    return Object.freeze({
      json: raw, // byte-for-byte V1 JSON; never serialize an empty UI snapshot
      subjects: document.subjects.length,
      items: document.subjects.reduce((count, subject) =>
        count + (Array.isArray(subject.items) ? subject.items.length : 0), 0)
    });
  } catch {
    // Malformed or inaccessible localStorage is never silently overwritten.
    return null;
  }
}
