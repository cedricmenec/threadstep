// Voluntary, origin-scoped inventory and cleanup of retired V1 keys. Values
// are never parsed into business records and nothing is removed without an
// explicit confirmation bound to a verified modern backup.

export const RETIRED_V1_KEYS = Object.freeze([
  "threadstep.document.v1",
  "threadstep.migration.v1",
  "threadstep.resume.v1",
  "threadstep.migration.dismissals.v1"
]);

export const CLEANUP_CODE = Object.freeze({
  READY: "cleanup-ready",
  EMPTY: "cleanup-empty",
  BACKUP_REQUIRED: "cleanup-backup-required",
  MIGRATION_REQUIRED: "cleanup-migration-required",
  CONSENT_REQUIRED: "cleanup-consent-required",
  CANCELLED: "cleanup-cancelled",
  PARTIAL: "cleanup-partial",
  FAILED: "cleanup-failed"
});

function storageAvailable(storage) {
  return !!storage && typeof storage.getItem === "function" &&
    typeof storage.removeItem === "function";
}

// Lists only retired keys that are actually present on this origin. The stored
// value is read solely to establish presence; it is never parsed or exported.
export function buildCleanupInventory(storage) {
  if (!storageAvailable(storage)) {
    return { status: "unavailable", keys: [], scope: "current-origin" };
  }
  const keys = [];
  for (const key of RETIRED_V1_KEYS) {
    let value = null;
    try {
      value = storage.getItem(key);
    } catch {
      return { status: "unreadable", keys: [], scope: "current-origin" };
    }
    if (typeof value === "string") keys.push(key);
  }
  return { status: keys.length > 0 ? "present" : "empty", keys, scope: "current-origin" };
}

// Defaults to "delete nothing". Every guard is required before the targeted
// removal path can even be proposed.
export function evaluateCleanup(input = {}) {
  const inventory = input.inventory && Array.isArray(input.inventory.keys)
    ? input.inventory
    : { status: "empty", keys: [], scope: "current-origin" };
  if (inventory.status !== "present" || inventory.keys.length === 0) {
    return {
      allowed: false,
      defaultChoice: "keep",
      code: CLEANUP_CODE.EMPTY,
      keys: [],
      scope: inventory.scope || "current-origin"
    };
  }
  if (input.backupVerified !== true) {
    return {
      allowed: false,
      defaultChoice: "keep",
      code: CLEANUP_CODE.BACKUP_REQUIRED,
      keys: inventory.keys.slice(),
      scope: inventory.scope || "current-origin"
    };
  }
  if (input.metadataMigrationComplete !== true) {
    return {
      allowed: false,
      defaultChoice: "keep",
      code: CLEANUP_CODE.MIGRATION_REQUIRED,
      keys: inventory.keys.slice(),
      scope: inventory.scope || "current-origin"
    };
  }
  if (input.confirmed !== true) {
    return {
      allowed: false,
      defaultChoice: "keep",
      code: CLEANUP_CODE.CONSENT_REQUIRED,
      keys: inventory.keys.slice(),
      scope: inventory.scope || "current-origin"
    };
  }
  return {
    allowed: true,
    defaultChoice: "keep",
    code: CLEANUP_CODE.READY,
    keys: inventory.keys.slice(),
    scope: inventory.scope || "current-origin"
  };
}

// Removes only the listed, present retired keys with targeted `removeItem`
// calls. A cancellation, refusal or error leaves every remaining value intact
// and reports precisely what was and was not removed.
export function runCleanup(storage, inventory, consent = {}) {
  const decision = evaluateCleanup({
    inventory,
    backupVerified: consent.backupVerified,
    metadataMigrationComplete: consent.metadataMigrationComplete,
    confirmed: consent.confirmed
  });
  if (!decision.allowed || consent.confirmed !== true) {
    return {
      status: decision.code === CLEANUP_CODE.CONSENT_REQUIRED ? CLEANUP_CODE.CANCELLED : decision.code,
      code: decision.code,
      removed: [],
      remaining: Array.isArray(inventory && inventory.keys) ? inventory.keys.slice() : []
    };
  }
  if (!storageAvailable(storage)) {
    return {
      status: CLEANUP_CODE.FAILED,
      code: CLEANUP_CODE.FAILED,
      removed: [],
      remaining: decision.keys.slice()
    };
  }
  const removed = [];
  const remaining = [];
  let failed = false;
  for (const key of decision.keys) {
    try {
      storage.removeItem(key);
      if (storage.getItem(key) === null) removed.push(key);
      else remaining.push(key);
    } catch {
      failed = true;
      remaining.push(key);
    }
  }
  return {
    status: failed ? CLEANUP_CODE.PARTIAL : (remaining.length > 0 ? CLEANUP_CODE.PARTIAL : CLEANUP_CODE.READY),
    code: failed ? CLEANUP_CODE.FAILED : CLEANUP_CODE.READY,
    removed,
    remaining
  };
}
