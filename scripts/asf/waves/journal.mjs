#!/usr/bin/env node
/**
 * Append-only wave journal, quota and dispatch decisions (ASF-V2-006).
 *
 * The journal is the durable, secret-free record of an authorized wave. It is
 * persisted separately from the immutable manifest (candidate strategy: a
 * dedicated `asf/waves/<wave-id>` branch) and is never rewritten: every event
 * appends one entry and every derived value is recomputed by replaying the log.
 *
 * Guarantees:
 *   - the paid quota is reserved (and consumed) BEFORE any dispatch, so a
 *     reservation survives a crash and cannot be silently returned;
 *   - at most one automatic attempt per `waveId/taskId` key — an uncertain
 *     dispatch outcome stops the wave with STOP_UNCERTAIN and never re-dispatches;
 *   - the first failure stops the wave;
 *   - reconstructed journals keep decisions, SHAs and links, never secrets.
 *
 * The module performs no I/O, reads no clock and mutates no input. Timestamps
 * and content hashes are injected by the adapter; the durable store lives in
 * ./store.mjs.
 *
 * Normative reference:
 *   - docs/factory/specs/orchestrator-v1.md §5, §7, §8
 */
import { canonicalize } from "./hash.mjs";
import { findSecretPaths } from "./secrets.mjs";
import { hashWaveManifest, validateWaveManifest } from "./manifest.mjs";

export const JOURNAL_SCHEMA_VERSION = 1;

export const WAVE_STATE = Object.freeze({
  SELECTED: "SELECTED",
  DISPATCH_RESERVED: "DISPATCH_RESERVED",
  EXECUTING: "EXECUTING",
  PR_PUBLISHED: "PR_PUBLISHED",
  CI_PENDING: "CI_PENDING",
  MERGE_PENDING: "MERGE_PENDING",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN"
});

export const WAVE_EVENT = Object.freeze({
  SELECT: "SELECT",
  RESERVE_DISPATCH: "RESERVE_DISPATCH",
  DISPATCH_CONFIRMED: "DISPATCH_CONFIRMED",
  DISPATCH_UNCERTAIN: "DISPATCH_UNCERTAIN",
  PR_PUBLISHED: "PR_PUBLISHED",
  CI_PENDING: "CI_PENDING",
  MERGE_PENDING: "MERGE_PENDING",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN"
});

export const STOP_CODE = Object.freeze({
  STOP_FAILED: "STOP_FAILED",
  STOP_UNCERTAIN: "STOP_UNCERTAIN"
});

export const DISPATCH_DECISION = Object.freeze({
  DISPATCH: "DISPATCH",
  QUOTA_REACHED: "QUOTA_REACHED",
  IN_FLIGHT: "IN_FLIGHT",
  ALREADY_DELIVERED: "ALREADY_DELIVERED",
  NOT_IN_WAVE: "NOT_IN_WAVE",
  STOP_FAILED: "STOP_FAILED",
  STOP_UNCERTAIN: "STOP_UNCERTAIN"
});

export const RESUME_OUTCOME = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  SELECTED_NOT_DISPATCHED: "SELECTED_NOT_DISPATCHED",
  UNCERTAIN: "UNCERTAIN",
  IN_FLIGHT: "IN_FLIGHT",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED"
});

const ID_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{1,4}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const RUN_ID_PATTERN = /^[0-9]{1,20}$/;

const PAYLOAD_KEYS = Object.freeze([
  "workflowRunId", "workflowRunUrl", "prNumber", "prUrl", "headSha",
  "mergeCommit", "ciRunId", "ciUrl", "ciVerdict", "reason"
]);
const ENTRY_KEYS = Object.freeze(["seq", "taskId", "state", "event", "at", ...PAYLOAD_KEYS]);
const QUOTA_KEYS = Object.freeze(["maxTaskStarts", "taskStartsReserved"]);
const JOURNAL_KEYS = Object.freeze([
  "schemaVersion", "waveId", "manifestHash", "revision", "quota", "entries", "stop"
]);
const STOP_KEYS = Object.freeze(["code", "reason", "at"]);

const ACTIVE_STATES = Object.freeze([
  WAVE_STATE.SELECTED, WAVE_STATE.DISPATCH_RESERVED, WAVE_STATE.EXECUTING,
  WAVE_STATE.PR_PUBLISHED, WAVE_STATE.CI_PENDING, WAVE_STATE.MERGE_PENDING
]);
const IN_FLIGHT_STATES = Object.freeze([
  WAVE_STATE.DISPATCH_RESERVED, WAVE_STATE.EXECUTING, WAVE_STATE.PR_PUBLISHED,
  WAVE_STATE.CI_PENDING, WAVE_STATE.MERGE_PENDING
]);

const TRANSITIONS = Object.freeze({
  [WAVE_EVENT.SELECT]: { from: [null], to: WAVE_STATE.SELECTED, requires: [] },
  [WAVE_EVENT.RESERVE_DISPATCH]: {
    from: [WAVE_STATE.SELECTED], to: WAVE_STATE.DISPATCH_RESERVED, requires: []
  },
  [WAVE_EVENT.DISPATCH_CONFIRMED]: {
    from: [WAVE_STATE.DISPATCH_RESERVED], to: WAVE_STATE.EXECUTING, requires: ["workflowRunId"]
  },
  [WAVE_EVENT.DISPATCH_UNCERTAIN]: {
    from: [WAVE_STATE.DISPATCH_RESERVED], to: WAVE_STATE.UNKNOWN, requires: []
  },
  [WAVE_EVENT.PR_PUBLISHED]: {
    from: [WAVE_STATE.EXECUTING], to: WAVE_STATE.PR_PUBLISHED, requires: ["prNumber", "headSha"]
  },
  [WAVE_EVENT.CI_PENDING]: {
    from: [WAVE_STATE.PR_PUBLISHED], to: WAVE_STATE.CI_PENDING, requires: []
  },
  [WAVE_EVENT.MERGE_PENDING]: {
    from: [WAVE_STATE.CI_PENDING], to: WAVE_STATE.MERGE_PENDING, requires: []
  },
  [WAVE_EVENT.DELIVERED]: {
    from: [WAVE_STATE.MERGE_PENDING], to: WAVE_STATE.DELIVERED, requires: ["mergeCommit"]
  },
  [WAVE_EVENT.FAILED]: {
    from: ACTIVE_STATES, to: WAVE_STATE.FAILED, requires: ["reason"]
  },
  [WAVE_EVENT.UNKNOWN]: {
    from: ACTIVE_STATES, to: WAVE_STATE.UNKNOWN, requires: ["reason"]
  }
});

const STOP_FOR_EVENT = Object.freeze({
  [WAVE_EVENT.FAILED]: STOP_CODE.STOP_FAILED,
  [WAVE_EVENT.UNKNOWN]: STOP_CODE.STOP_UNCERTAIN,
  [WAVE_EVENT.DISPATCH_UNCERTAIN]: STOP_CODE.STOP_UNCERTAIN
});

function error(code, field, message) {
  return { code, field: field ?? null, message };
}

function codeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function checkString(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function normalizeRunId(value) {
  if (Number.isInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && RUN_ID_PATTERN.test(value)) return value;
  return null;
}

function normalizePositiveInt(value) {
  if (Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[0-9]{1,20}$/.test(value)) return Number(value);
  return null;
}

/** Create an empty, frozen journal bound to a validated manifest. */
export function createJournal(manifest, manifestHash = hashWaveManifest(manifest)) {
  const validation = validateWaveManifest(manifest);
  if (!validation.ok) {
    throw new Error("Cannot open a journal for an invalid manifest");
  }
  return deepFreeze({
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    waveId: manifest.waveId,
    manifestHash,
    revision: 0,
    quota: {
      maxTaskStarts: manifest.limits.maxTaskStarts,
      taskStartsReserved: 0
    },
    entries: [],
    stop: null
  });
}

function entriesFor(journal, taskId) {
  return journal.entries.filter(entry => entry.taskId === taskId);
}

/** Last observed state of a task, or null when it never entered the journal. */
export function currentState(journal, taskId) {
  const entries = entriesFor(journal, taskId);
  return entries.length ? entries[entries.length - 1].state : null;
}

function activeTask(journal, excludeTaskId = null) {
  const lastState = new Map();
  for (const entry of journal.entries) lastState.set(entry.taskId, entry.state);
  for (const [taskId, state] of lastState) {
    if (taskId === excludeTaskId) continue;
    if (IN_FLIGHT_STATES.includes(state)) return taskId;
  }
  return null;
}

/**
 * A task left in DISPATCH_RESERVED without a confirmed outcome is the crash
 * window between the durable reservation and the persisted run id. Its paid
 * start is already consumed but no run can be correlated, so the whole wave
 * must stop until a human reconciles GitHub — never a second automatic dispatch.
 */
function pendingUncertainty(journal) {
  const lastState = new Map();
  for (const entry of journal.entries) lastState.set(entry.taskId, entry.state);
  for (const [taskId, state] of lastState) {
    if (state === WAVE_STATE.DISPATCH_RESERVED) return taskId;
  }
  return null;
}

function validatePayload(event, transition) {
  const errors = [];
  const payload = {};
  for (const key of Object.keys(event)) {
    if (["type", "taskId", "at"].includes(key)) continue;
    if (!PAYLOAD_KEYS.includes(key)) {
      errors.push(error("unknown_payload_field", key, 'unknown event field "' + key + '"'));
      continue;
    }
    payload[key] = event[key];
  }
  const at = event.at;
  if (at !== undefined && typeof at !== "string") {
    errors.push(error("invalid_timestamp", "at", "at must be an injected string when present"));
  }
  for (const key of transition.requires) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      errors.push(error("missing_payload", key, 'event requires field "' + key + '"'));
    }
  }
  if (payload.workflowRunId !== undefined && !normalizeRunId(payload.workflowRunId)) {
    errors.push(error("invalid_run_id", "workflowRunId", "workflowRunId must be a positive run id"));
  }
  if (payload.prNumber !== undefined && !normalizePositiveInt(payload.prNumber)) {
    errors.push(error("invalid_pr_number", "prNumber", "prNumber must be a positive integer"));
  }
  if (payload.headSha !== undefined && !checkString(payload.headSha, COMMIT_PATTERN)) {
    errors.push(error("invalid_head_sha", "headSha", "headSha must be a commit SHA"));
  }
  if (payload.mergeCommit !== undefined && !checkString(payload.mergeCommit, COMMIT_PATTERN)) {
    errors.push(error("invalid_merge_commit", "mergeCommit", "mergeCommit must be a commit SHA"));
  }
  const secretPaths = findSecretPaths(payload);
  for (const path of secretPaths) {
    errors.push(error("secret_detected", path, "event payload contains a secret-looking value"));
  }
  return { errors, payload };
}

/**
 * Append one event to the journal, returning a new frozen journal. The current
 * journal is never mutated. Fail-closed: a stopped wave, a missing quota slot,
 * an already-attempted key, an invalid transition or a secret-looking payload
 * is rejected and returns the original journal unchanged.
 */
export function applyEvent(journal, event) {
  if (!journal || typeof journal !== "object" || !Array.isArray(journal.entries)) {
    return { ok: false, code: "invalid_journal", errors: [error("invalid_journal", null, "journal is invalid")], journal };
  }
  if (journal.stop) {
    return { ok: false, code: "wave_stopped", errors: [error("wave_stopped", null, "wave already stopped")], journal };
  }
  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    return { ok: false, code: "invalid_event", errors: [error("invalid_event", null, "event type is required")], journal };
  }
  const transition = TRANSITIONS[event.type];
  if (!transition) {
    return { ok: false, code: "unknown_event", errors: [error("unknown_event", "type", "unknown event type")], journal };
  }
  if (typeof event.taskId !== "string" || !ID_PATTERN.test(event.taskId)) {
    return { ok: false, code: "unsafe_task_id", errors: [error("unsafe_task_id", "taskId", "unsafe or missing task id")], journal };
  }

  if (event.type === WAVE_EVENT.RESERVE_DISPATCH) {
    if (journal.quota.taskStartsReserved >= journal.quota.maxTaskStarts) {
      return { ok: false, code: "quota_reached", errors: [error("quota_reached", null, "no paid start left")], journal };
    }
    if (entriesFor(journal, event.taskId)
      .some(entry => entry.event === WAVE_EVENT.RESERVE_DISPATCH)) {
      return { ok: false, code: "already_attempted", errors: [error("already_attempted", "taskId", "task already reserved a paid start")], journal };
    }
  }

  const from = currentState(journal, event.taskId);
  if (!transition.from.includes(from)) {
    return {
      ok: false, code: "invalid_transition",
      errors: [error("invalid_transition", "type",
        event.type + " is not allowed from " + (from ?? "nothing"))],
      journal
    };
  }

  const { errors, payload } = validatePayload(event, transition);
  if (errors.length) {
    return { ok: false, code: errors[0].code, errors, journal };
  }

  const entry = {
    seq: journal.entries.length + 1,
    taskId: event.taskId,
    state: transition.to,
    event: event.type,
    ...(typeof event.at === "string" ? { at: event.at } : {}),
    ...payload
  };
  const stopCode = STOP_FOR_EVENT[event.type];
  const next = {
    ...journal,
    revision: journal.revision + 1,
    quota: {
      maxTaskStarts: journal.quota.maxTaskStarts,
      taskStartsReserved: journal.quota.taskStartsReserved +
        (event.type === WAVE_EVENT.RESERVE_DISPATCH ? 1 : 0)
    },
    entries: [...journal.entries, entry],
    stop: stopCode
      ? { code: stopCode, reason: payload.reason ?? event.type, ...(typeof event.at === "string" ? { at: event.at } : {}) }
      : journal.stop
  };
  return { ok: true, code: "appended", entry: deepFreeze(entry), journal: deepFreeze(next), errors: [] };
}

/** Mark a task selected (no quota consumed). Convenience around applyEvent. */
export function selectTask(journal, taskId, at) {
  return applyEvent(journal, { type: WAVE_EVENT.SELECT, taskId, ...(at ? { at } : {}) });
}

/**
 * Reserve one paid start for `taskId` before dispatch. Increments
 * `taskStartsReserved` durably and appends DISPATCH_RESERVED. Refuses once the
 * quota is exhausted or the key was already attempted.
 */
export function reserveDispatch(journal, taskId, at) {
  return applyEvent(journal, { type: WAVE_EVENT.RESERVE_DISPATCH, taskId, ...(at ? { at } : {}) });
}

/**
 * Perform the mandatory pre-dispatch procedure: select the task if needed, then
 * reserve its paid start. If the reservation is refused (quota, stopped wave,
 * already attempted) the original journal is returned unchanged so a dangling
 * SELECT is never persisted by mistake.
 */
export function beginDispatch(journal, taskId, at) {
  let working = journal;
  if (currentState(working, taskId) === null) {
    const selected = selectTask(working, taskId, at);
    if (!selected.ok) return selected;
    working = selected.journal;
  }
  const reserved = reserveDispatch(working, taskId, at);
  if (!reserved.ok) return { ...reserved, journal };
  return reserved;
}

/** Reconstruct the resume outcome for a single task key. */
export function decideResume(journal, taskId) {
  const state = currentState(journal, taskId);
  if (state === null) return { outcome: RESUME_OUTCOME.NOT_STARTED, state: null };
  if (state === WAVE_STATE.SELECTED) return { outcome: RESUME_OUTCOME.SELECTED_NOT_DISPATCHED, state };
  if (state === WAVE_STATE.DISPATCH_RESERVED) {
    return { outcome: RESUME_OUTCOME.UNCERTAIN, state, reason: "dispatch_outcome_unknown" };
  }
  if (state === WAVE_STATE.DELIVERED) return { outcome: RESUME_OUTCOME.DELIVERED, state };
  if (state === WAVE_STATE.FAILED) return { outcome: RESUME_OUTCOME.FAILED, state };
  if (state === WAVE_STATE.UNKNOWN) {
    return { outcome: RESUME_OUTCOME.UNCERTAIN, state, reason: "dispatch_outcome_unknown" };
  }
  return { outcome: RESUME_OUTCOME.IN_FLIGHT, state };
}

/**
 * Decide whether the wave may dispatch `taskId` right now. Never dispatches. An
 * uncertain outcome, an in-flight task, an exhausted quota or a stopped wave
 * all fail closed.
 */
export function planDispatch(journal, manifest, taskId) {
  if (journal.stop) {
    return { decision: journal.stop.code, reason: journal.stop.reason ?? null, taskId: null };
  }
  const pending = pendingUncertainty(journal);
  if (pending) {
    return {
      decision: DISPATCH_DECISION.STOP_UNCERTAIN,
      reason: "dispatch_outcome_unknown", taskId: pending
    };
  }
  if (journal.quota.taskStartsReserved >= journal.quota.maxTaskStarts) {
    return { decision: DISPATCH_DECISION.QUOTA_REACHED, reason: "quota_exhausted", taskId: null };
  }
  const candidates = Array.isArray(manifest?.candidateTasks)
    ? manifest.candidateTasks.map(candidate => candidate.id)
    : [];
  if (!candidates.includes(taskId)) {
    return { decision: DISPATCH_DECISION.NOT_IN_WAVE, reason: "task_not_in_manifest", taskId: null };
  }
  const active = activeTask(journal, taskId);
  if (active) {
    return { decision: DISPATCH_DECISION.IN_FLIGHT, reason: "concurrency_limit", taskId: active };
  }
  const resume = decideResume(journal, taskId);
  switch (resume.outcome) {
    case RESUME_OUTCOME.NOT_STARTED:
    case RESUME_OUTCOME.SELECTED_NOT_DISPATCHED:
      return { decision: DISPATCH_DECISION.DISPATCH, reason: "safe_to_dispatch", taskId };
    case RESUME_OUTCOME.UNCERTAIN:
      return { decision: DISPATCH_DECISION.STOP_UNCERTAIN, reason: resume.reason ?? "uncertain", taskId };
    case RESUME_OUTCOME.IN_FLIGHT:
      return { decision: DISPATCH_DECISION.IN_FLIGHT, reason: "already_in_flight", taskId };
    case RESUME_OUTCOME.DELIVERED:
      return { decision: DISPATCH_DECISION.ALREADY_DELIVERED, reason: "already_delivered", taskId };
    default:
      return { decision: DISPATCH_DECISION.STOP_FAILED, reason: "already_failed", taskId };
  }
}

/** True only when planDispatch would authorize exactly one new paid start. */
export function canDispatch(journal, manifest, taskId) {
  return planDispatch(journal, manifest, taskId).decision === DISPATCH_DECISION.DISPATCH;
}

function validateEntry(entry, expectedSeq, taskStates) {
  const errors = [];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { errors: [error("invalid_entry", "entries[" + (expectedSeq - 1) + "]", "entry must be an object")] };
  }
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.includes(key)) {
      errors.push(error("unknown_field", key, 'unknown entry field "' + key + '"'));
    }
  }
  if (entry.seq !== expectedSeq) {
    errors.push(error("invalid_sequence", "seq", "entry seq must be " + expectedSeq));
  }
  if (typeof entry.taskId !== "string" || !ID_PATTERN.test(entry.taskId)) {
    errors.push(error("unsafe_task_id", "taskId", "unsafe or missing task id"));
  }
  const transition = TRANSITIONS[entry.event];
  if (!transition || entry.state !== transition.to) {
    errors.push(error("invalid_state", "state", "entry state does not match its event"));
    return { errors };
  }
  const from = taskStates.get(entry.taskId) ?? null;
  if (!transition.from.includes(from)) {
    errors.push(error("invalid_transition", "event",
      entry.event + " is not allowed from " + (from ?? "nothing")));
  }
  if (entry.at !== undefined && typeof entry.at !== "string") {
    errors.push(error("invalid_timestamp", "at", "at must be a string when present"));
  }
  if (findSecretPaths(entry).length) {
    errors.push(error("secret_detected", "entries[" + (expectedSeq - 1) + "]", "entry contains a secret-looking value"));
  }
  return { errors };
}

/**
 * Validate an injected journal object against its manifest. Returns a report;
 * never throws. Structural errors, sequence gaps, invalid transitions,
 * manifest mismatch, quota drift and residual entries after a stop all fail
 * closed.
 */
export function validateJournal(journal, manifest) {
  if (!journal || typeof journal !== "object" || Array.isArray(journal)) {
    return { ok: false, errors: [error("invalid_journal", null, "journal must be an object")] };
  }
  const errors = [];
  for (const key of Object.keys(journal)) {
    if (!JOURNAL_KEYS.includes(key)) {
      errors.push(error("unknown_field", key, 'unknown journal field "' + key + '"'));
    }
  }
  if (journal.schemaVersion !== JOURNAL_SCHEMA_VERSION) {
    errors.push(error("unsupported_schema", "schemaVersion", "unsupported journal schema"));
  }
  if (typeof journal.waveId !== "string") {
    errors.push(error("invalid_wave_id", "waveId", "waveId is required"));
  }
  if (!checkString(journal.manifestHash ?? "", SHA256_PATTERN)) {
    errors.push(error("invalid_manifest_hash", "manifestHash", "manifestHash must be a sha256"));
  }
  if (!Number.isInteger(journal.revision) || journal.revision < 0) {
    errors.push(error("invalid_revision", "revision", "revision must be a non-negative integer"));
  }
  if (!journal.quota || typeof journal.quota !== "object") {
    errors.push(error("invalid_quota", "quota", "quota is required"));
  } else {
    for (const key of Object.keys(journal.quota)) {
      if (!QUOTA_KEYS.includes(key)) {
        errors.push(error("unknown_field", "quota." + key, 'unknown quota field "' + key + '"'));
      }
    }
    if (!Number.isInteger(journal.quota.maxTaskStarts) ||
        !Number.isInteger(journal.quota.taskStartsReserved) ||
        journal.quota.taskStartsReserved < 0) {
      errors.push(error("invalid_quota", "quota", "quota counters must be integers"));
    }
  }
  if (!Array.isArray(journal.entries)) {
    errors.push(error("invalid_entries", "entries", "entries must be an array"));
    return { ok: false, errors };
  }

  const taskStates = new Map();
  const reserved = [];
  let stop = null;
  let stoppedAt = null;
  journal.entries.forEach((entry, index) => {
    const result = validateEntry(entry, index + 1, taskStates);
    errors.push(...result.errors);
    if (!result.errors.length) {
      taskStates.set(entry.taskId, entry.state);
      if (entry.event === WAVE_EVENT.RESERVE_DISPATCH) reserved.push(entry.taskId);
      const stopCode = STOP_FOR_EVENT[entry.event];
      if (stopCode) {
        stop = { code: stopCode, reason: entry.reason ?? entry.event, ...(entry.at ? { at: entry.at } : {}) };
        stoppedAt = index;
      }
    }
    if (stoppedAt !== null && index > stoppedAt) {
      errors.push(error("entry_after_stop", "entries[" + index + "]", "no entry is allowed after a stop"));
    }
  });

  if (new Set(reserved).size !== reserved.length) {
    errors.push(error("duplicate_reservation", "quota", "a task key was reserved more than once"));
  }
  if (journal.quota) {
    if (reserved.length !== journal.quota.taskStartsReserved) {
      errors.push(error("quota_drift", "quota.taskStartsReserved", "reserved counter does not match entries"));
    }
    if (journal.quota.maxTaskStarts !== manifest?.limits?.maxTaskStarts) {
      errors.push(error("quota_mismatch", "quota.maxTaskStarts", "maxTaskStarts disagrees with the manifest"));
    }
  }
  if (journal.waveId !== manifest?.waveId) {
    errors.push(error("wave_mismatch", "waveId", "journal waveId disagrees with the manifest"));
  }
  const expectedManifestHash = manifest ? hashWaveManifest(manifest) : null;
  if (expectedManifestHash === null || journal.manifestHash !== expectedManifestHash) {
    errors.push(error("manifest_mismatch", "manifestHash", "journal is not bound to this manifest"));
  }
  if (journal.revision !== journal.entries.length) {
    errors.push(error("revision_mismatch", "revision", "revision must equal the entry count"));
  }
  if (journal.stop) {
    for (const key of Object.keys(journal.stop)) {
      if (!STOP_KEYS.includes(key)) {
        errors.push(error("unknown_field", "stop." + key, 'unknown stop field "' + key + '"'));
      }
    }
    if (!stop || journal.stop.code !== stop.code) {
      errors.push(error("stop_mismatch", "stop", "stop record disagrees with the entries"));
    }
  } else if (stop) {
    errors.push(error("stop_mismatch", "stop", "a stopping entry requires a stop record"));
  }

  errors.sort((a, b) => codeUnit(a.field ?? "", b.field ?? "") || codeUnit(a.code, b.code));
  return { ok: errors.length === 0, errors };
}

/** Deterministic durable serialization of a journal. */
export function serializeJournal(journal) {
  return canonicalize(journal);
}

/**
 * Reconstruct a journal from durable storage. `serialized` may be null (empty
 * journal), a canonical string or an already-parsed object. A mismatch with the
 * manifest or a structural error fails closed instead of guessing.
 */
export function reconstructJournal(manifest, serialized) {
  if (serialized === null || serialized === undefined) {
    return { ok: true, journal: createJournal(manifest), errors: [] };
  }
  let parsed = serialized;
  if (typeof serialized === "string") {
    try {
      parsed = JSON.parse(serialized);
    } catch {
      return { ok: false, journal: null, errors: [error("invalid_json", null, "journal is not valid JSON")] };
    }
  }
  const validation = validateJournal(parsed, manifest);
  if (!validation.ok) {
    return { ok: false, journal: null, errors: validation.errors };
  }
  return { ok: true, journal: deepFreeze(parsed), errors: [] };
}

/**
 * Build a secret-free summary of a journal for reports: decisions, SHAs and
 * links only, picked from an explicit whitelist so no unvetted field can leak.
 */
export function summarizeJournal(journal) {
  const tasks = new Map();
  for (const entry of journal.entries) {
    const task = tasks.get(entry.taskId) ?? {
      taskId: entry.taskId, state: null, history: [], workflowRunId: null,
      workflowRunUrl: null, prNumber: null, prUrl: null, headSha: null,
      mergeCommit: null, ciVerdict: null
    };
    task.state = entry.state;
    task.history.push({ seq: entry.seq, state: entry.state, event: entry.event, at: entry.at ?? null });
    for (const key of ["workflowRunId", "workflowRunUrl", "prNumber", "prUrl", "headSha", "mergeCommit", "ciVerdict"]) {
      if (entry[key] !== undefined) task[key] = entry[key];
    }
    tasks.set(entry.taskId, task);
  }
  return {
    waveId: journal.waveId,
    manifestHash: journal.manifestHash,
    revision: journal.revision,
    quota: { ...journal.quota },
    stop: journal.stop ? { ...journal.stop } : null,
    tasks: [...tasks.values()].map(task => ({
      taskId: task.taskId,
      state: task.state,
      history: task.history,
      workflowRunId: task.workflowRunId,
      workflowRunUrl: task.workflowRunUrl,
      prNumber: task.prNumber,
      prUrl: task.prUrl,
      headSha: task.headSha,
      mergeCommit: task.mergeCommit,
      ciVerdict: task.ciVerdict
    }))
  };
}

/**
 * Adapt the durable journal to the pure scheduler's `executionState` input
 * (`{ attempts, quota, observedAt }`). Only reserved-or-later keys become
 * attempts so a task that crashed before dispatch can still be selected again.
 * An UNKNOWN key is reported as `executing` so it is never re-selected while
 * the wave-level stop signals STOP_UNCERTAIN.
 */
export function toSchedulerExecutionState(journal) {
  const lastEntry = new Map();
  for (const entry of journal.entries) lastEntry.set(entry.taskId, entry);
  const attempts = [];
  for (const entry of lastEntry.values()) {
    if (entry.state === WAVE_STATE.SELECTED) continue;
    const status = entry.state === WAVE_STATE.DELIVERED
      ? "succeeded"
      : entry.state === WAVE_STATE.FAILED ? "failed" : "executing";
    attempts.push({ taskId: entry.taskId, status });
  }
  return {
    attempts,
    quota: {
      taskStarts: journal.quota.taskStartsReserved,
      maxTaskStarts: journal.quota.maxTaskStarts
    },
    observedAt: journal.stop?.at ?? null
  };
}
