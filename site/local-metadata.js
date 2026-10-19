// Versioned, non-synchronized IndexedDB metadata. Only identifiers, versions,
// fingerprints and statuses are stored here: never titles, notes, emails,
// tokens or business content.
import { parseResumePreference } from "./core.js";
import { sha256Hex } from "./fingerprint.js";

export const META_STORE = "meta";
export const METADATA_VERSION = 1;
export const RESUME_STORAGE_KEY = "threadstep.resume.v1";
export const META_RESUME_KEY = "resume";
export const META_PREFERENCES_MIGRATION_KEY = "preferencesMigration";

export const METADATA_STATUS = Object.freeze({
  COMPLETE: "complete",
  ALREADY_MIGRATED: "already-migrated",
  CONFLICT: "conflict",
  ABSENT: "absent",
  UNAVAILABLE: "unavailable",
  READ_ERROR: "read-error",
  WRITE_ERROR: "write-error",
  MARKER_ERROR: "marker-error"
});

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 100;
}

function validRef(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    validId(value.subjectId) && validId(value.itemId);
}

function sameRef(left, right) {
  return validRef(left) && validRef(right) &&
    left.subjectId === right.subjectId && left.itemId === right.itemId;
}

export function resumeRefFromMeta(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  if (record.key !== META_RESUME_KEY || record.version !== METADATA_VERSION) return null;
  return validRef(record) ? { subjectId: record.subjectId, itemId: record.itemId } : null;
}

export function buildResumeMetaRecord(ref) {
  if (!validRef(ref)) return null;
  return {
    key: META_RESUME_KEY,
    version: METADATA_VERSION,
    subjectId: ref.subjectId,
    itemId: ref.itemId
  };
}

export function buildPreferencesMigrationRecord({ status, legacyRaw, legacyRef, targetRef, conflict }) {
  const raw = typeof legacyRaw === "string" ? legacyRaw : "";
  return {
    key: META_PREFERENCES_MIGRATION_KEY,
    version: METADATA_VERSION,
    status: status === "conflict" ? "conflict" : "complete",
    sourceKey: RESUME_STORAGE_KEY,
    sourceFingerprint: sha256Hex(raw),
    hadLegacyPreference: !!validRef(legacyRef),
    targetPopulated: !!validRef(targetRef),
    conflict: conflict === true
  };
}

function writeMarker(adapter, details) {
  const marker = buildPreferencesMigrationRecord(details);
  if (!adapter || typeof adapter.writeMeta !== "function") {
    return { status: METADATA_STATUS.MARKER_ERROR, migrationComplete: false, marker, record: null };
  }
  try {
    const result = adapter.writeMeta(marker);
    return Promise.resolve(result).then(() => ({
      status: details.conflict ? METADATA_STATUS.CONFLICT : METADATA_STATUS.COMPLETE,
      migrationComplete: true,
      marker,
      record: details.targetRef || null
    })).catch(() => ({
      status: METADATA_STATUS.MARKER_ERROR,
      migrationComplete: false,
      marker,
      record: details.targetRef || null
    }));
  } catch {
    return Promise.resolve({
      status: METADATA_STATUS.MARKER_ERROR,
      migrationComplete: false,
      marker,
      record: details.targetRef || null
    });
  }
}

// Idempotent migration from `threadstep.resume.v1` to the workspace `meta`
// store. The target is authoritative: an existing different value is reported
// as a conflict and never overwritten. A failed write keeps the legacy value
// and never claims durable storage.
export async function runPreferencesMigration(adapter) {
  if (!adapter || typeof adapter.readMeta !== "function") {
    return { status: METADATA_STATUS.UNAVAILABLE, migrationComplete: false, record: null };
  }
  let existing;
  let marker;
  try {
    existing = await adapter.readMeta(META_RESUME_KEY);
    marker = await adapter.readMeta(META_PREFERENCES_MIGRATION_KEY);
  } catch {
    return { status: METADATA_STATUS.READ_ERROR, migrationComplete: false, record: null };
  }
  const targetRef = resumeRefFromMeta(existing);
  if (marker && marker.status === "complete" && marker.version === METADATA_VERSION) {
    return {
      status: METADATA_STATUS.ALREADY_MIGRATED,
      migrationComplete: true,
      record: targetRef,
      marker
    };
  }
  let legacyRaw = null;
  if (typeof adapter.readLegacyRaw === "function") {
    try {
      legacyRaw = await adapter.readLegacyRaw(RESUME_STORAGE_KEY);
    } catch {
      return { status: METADATA_STATUS.READ_ERROR, migrationComplete: false, record: targetRef };
    }
  }
  const legacyRef = parseResumePreference(legacyRaw);
  if (targetRef) {
    const conflict = !!legacyRef && !sameRef(legacyRef, targetRef);
    return writeMarker(adapter, { status: conflict ? "conflict" : "complete", legacyRaw, legacyRef, targetRef, conflict });
  }
  if (!legacyRef) {
    return writeMarker(adapter, { status: "complete", legacyRaw, legacyRef: null, targetRef: null });
  }
  if (typeof adapter.isRefAvailable === "function") {
    let available = false;
    try {
      available = await adapter.isRefAvailable(legacyRef);
    } catch {
      return { status: METADATA_STATUS.READ_ERROR, migrationComplete: false, record: null };
    }
    if (!available) {
      return writeMarker(adapter, {
        status: "complete",
        legacyRaw,
        legacyRef,
        targetRef: null,
        conflict: false,
        skipped: true
      });
    }
  }
  if (typeof adapter.writeMeta !== "function") {
    return { status: METADATA_STATUS.UNAVAILABLE, migrationComplete: false, record: null };
  }
  const record = buildResumeMetaRecord(legacyRef);
  try {
    await adapter.writeMeta(record);
  } catch {
    return { status: METADATA_STATUS.WRITE_ERROR, migrationComplete: false, record: null };
  }
  let verify;
  try {
    verify = await adapter.readMeta(META_RESUME_KEY);
  } catch {
    return { status: METADATA_STATUS.WRITE_ERROR, migrationComplete: false, record: null };
  }
  const storedRef = resumeRefFromMeta(verify);
  if (!sameRef(storedRef, legacyRef)) {
    return { status: METADATA_STATUS.WRITE_ERROR, migrationComplete: false, record: storedRef };
  }
  return writeMarker(adapter, { status: "complete", legacyRaw, legacyRef, targetRef: storedRef, conflict: false });
}

function createStorageAdapter(db, storage) {
  const table = () => {
    if (!db || !db.meta) throw new Error("Le store de métadonnées IndexedDB est indisponible.");
    return db.meta;
  };
  return {
    async readMeta(key) {
      const record = await table().get(key);
      return record || null;
    },
    async writeMeta(record) {
      await table().put(record);
      return record;
    },
    async removeMeta(key) {
      await table().delete(key);
    },
    async readLegacyRaw(key) {
      if (!storage || typeof storage.getItem !== "function") return null;
      return storage.getItem(key);
    }
  };
}

// Browser adapter over the workspace's own Dexie database. The `meta` table is
// declared unsynchronized, so preferences never leave this device.
export function createDexieMetadataStore(db, storage, options = {}) {
  const adapter = createStorageAdapter(db, storage);
  if (options && typeof options.isRefAvailable === "function") {
    adapter.isRefAvailable = options.isRefAvailable;
  }
  return {
    async migratePreferences() {
      return runPreferencesMigration(adapter);
    },
    async readResume() {
      try {
        return resumeRefFromMeta(await adapter.readMeta(META_RESUME_KEY));
      } catch {
        return null;
      }
    },
    async writeResume(ref) {
      const record = buildResumeMetaRecord(ref);
      if (!record) throw new Error("Préférence de reprise invalide.");
      await adapter.writeMeta(record);
      return { ...ref };
    },
    async removeResume() {
      await adapter.removeMeta(META_RESUME_KEY);
    },
    async readMigrationMarker() {
      try {
        const marker = await adapter.readMeta(META_PREFERENCES_MIGRATION_KEY);
        return marker && marker.version === METADATA_VERSION ? marker : null;
      } catch {
        return null;
      }
    }
  };
}
