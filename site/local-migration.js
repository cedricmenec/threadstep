// Pure local import/merge planner for the modern IndexedDB backup format.
// No DOM, storage, network or framework access: callers supply the parsed
// records and receive insert-only operations or a blocking collision.
import { planLocalMerge } from "./persistence.js";
import { parseIndexedDbBackup, validateBackupRecords } from "./indexeddb-backup.js";

export { planLocalMerge };

export const LOCAL_MERGE_STATUS = Object.freeze({
  READY: "ready",
  EMPTY_SOURCE: "empty-source",
  ALREADY_PRESENT: "already-present",
  COLLISION: "collision",
  INVALID: "invalid"
});

export const LOCAL_MERGE_CODE = Object.freeze({
  READY: "merge-ready",
  ALREADY_PRESENT: "already-present",
  COLLISION: "collision",
  INVALID: "invalid-backup",
  COLLISION_BLOCKED: "collision-blocked"
});

// Parses a user-supplied modern backup and plans a local merge. A V1 file or
// any unknown format is rejected before an operation list exists.
export function planModernRecordsMerge(targetRecords, records) {
  const validation = validateBackupRecords({ subjects: records.subjects, items: records.items });
  if (!validation.ok) {
    return {
      status: LOCAL_MERGE_STATUS.INVALID,
      code: validation.code,
      message: validation.message,
      operations: [],
      collisions: [],
      counts: { subjects: 0, items: 0 }
    };
  }
  const plan = planLocalMerge(targetRecords, validation.records);
  return {
    ...plan,
    code: plan.status === LOCAL_MERGE_STATUS.COLLISION
      ? LOCAL_MERGE_CODE.COLLISION_BLOCKED
      : plan.code,
    records: validation.records
  };
}

export function planModernLocalImport(targetRecords, source) {
  const parsed = parseIndexedDbBackup(source);
  if (!parsed.ok) {
    return {
      status: LOCAL_MERGE_STATUS.INVALID,
      code: parsed.code,
      message: parsed.message,
      operations: [],
      collisions: [],
      counts: { subjects: 0, items: 0 }
    };
  }
  return {
    ...planModernRecordsMerge(targetRecords, parsed.records),
    sourceChecksum: parsed.checksum,
    sourceCounts: parsed.counts
  };
}
