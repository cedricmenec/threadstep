/**
 * ASF V3 experimental PURE lifecycle kernel. No GitHub, git, IO or paid calls.
 * Each observation in an event MUST originate from a separately trusted adapter.
 * Events are deterministic, replayed and stored via external commit-SHA CAS.
 * The V1 modules and workflows are deliberately unchanged.
 */
import { contentSha256, canonicalize } from "../waves/hash.mjs";

export const V3_SCHEMA = 2;
export const V3_POLICY = "asf-orch-v3";
export const V3_MAX_TASKS = 10;
export const V3_CHILD_WORKFLOW = ".github/workflows/agent-openspec.yml@refs/heads/main";
export const V3_CONTROLLER_WORKFLOW = ".github/workflows/backlog-orchestrator-v3.yml@refs/heads/main";
export const V3_STATES = Object.freeze({
  READY: "READY", RESERVED: "RESERVED", DISPATCH_PENDING: "DISPATCH_PENDING",
  CHILD_ACKNOWLEDGED: "CHILD_ACKNOWLEDGED", EXECUTING: "EXECUTING",
  DELIVERY_PENDING: "DELIVERY_PENDING", DELIVERED: "DELIVERED",
  COMPLETED_QUOTA: "COMPLETED_QUOTA", COMPLETED_NO_WORK: "COMPLETED_NO_WORK",
  STOP_FAILED: "STOP_FAILED", STOP_UNCERTAIN: "STOP_UNCERTAIN"
});
const sha40 = /^[0-9a-f]{40}$/;
const sha256 = /^[0-9a-f]{64}$/;
const runId = /^[1-9][0-9]{0,17}$/;
const taskId = /^TS-[0-9]{3}$/;
const waveId = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const repository = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const terminal = new Set(["COMPLETED_QUOTA", "COMPLETED_NO_WORK", "STOP_FAILED", "STOP_UNCERTAIN"]);
const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
function requireThat(ok, code) { if (!ok) throw Object.assign(new Error("ASF V3: " + code), { code }); }
function keys(value, allowed) {
  requireThat(isObject(value) && Object.keys(value).every(key => allowed.includes(key)),
    "invalid_or_unknown_fields");
}
function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function strRun(value) { return String(value ?? ""); }

/** Deliberately strict; numeric GitHub form input is revalidated in code. */
export function parseV3MaxTasks(value) {
  const raw = typeof value === "number" ? String(value) : value;
  requireThat(typeof raw === "string" && /^(?:[1-9]|10)$/.test(raw), "invalid_max_tasks");
  return Number(raw);
}

export function createV3Manifest(input) {
  keys(input, ["waveId", "repository", "backlogCommit", "model", "autoMerge", "maxTaskStarts",
    "candidateTasks", "authorization"]);
  const auth = input.authorization;
  keys(auth, ["runId", "actor", "workflowRef", "sourceSha"]);
  requireThat(waveId.test(input.waveId) && repository.test(input.repository) &&
    sha40.test(input.backlogCommit), "invalid_identity");
  requireThat(typeof input.model === "string" && input.model.startsWith("openrouter/") &&
    input.model.length < 120 && !/[\s"'<>]/.test(input.model), "invalid_model");
  requireThat(typeof input.autoMerge === "boolean", "invalid_auto_merge");
  requireThat(Number.isInteger(input.maxTaskStarts) && input.maxTaskStarts >= 1 &&
    input.maxTaskStarts <= V3_MAX_TASKS, "invalid_max_tasks");
  requireThat(runId.test(strRun(auth.runId)) && auth.actor === input.repository.split("/")[0] &&
    auth.workflowRef === input.repository + "/" + V3_CONTROLLER_WORKFLOW &&
    auth.sourceSha === input.backlogCommit, "invalid_origin_authorization");
  requireThat(Array.isArray(input.candidateTasks) && input.candidateTasks.length > 0 &&
    input.candidateTasks.length <= 1000, "invalid_candidates");
  const ids = new Set();
  for (const candidate of input.candidateTasks) {
    keys(candidate, ["id", "sha256"]);
    requireThat(taskId.test(candidate.id) && sha256.test(candidate.sha256) &&
      !ids.has(candidate.id), "invalid_candidate");
    ids.add(candidate.id);
  }
  return freezeDeep({
    schemaVersion: V3_SCHEMA, policyVersion: V3_POLICY, waveId: input.waveId,
    repository: input.repository, backlogCommit: input.backlogCommit,
    model: input.model, autoMerge: input.autoMerge,
    limits: { maxTaskStarts: input.maxTaskStarts, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    candidateTasks: input.candidateTasks.map(c => ({ id: c.id, sha256: c.sha256 })),
    authorization: { runId: strRun(auth.runId), actor: auth.actor,
      workflowRef: auth.workflowRef, sourceSha: auth.sourceSha }
  });
}

export function createV3Journal(manifest) {
  requireThat(manifest.schemaVersion === V3_SCHEMA && manifest.policyVersion === V3_POLICY,
    "wrong_manifest_version");
  return freezeDeep({
    schemaVersion: V3_SCHEMA, waveId: manifest.waveId, manifestHash: contentSha256(manifest),
    revision: 0, status: V3_STATES.READY, reserved: 0, delivered: 0,
    awaitingController: false, controllers: [], attempted: [],
    active: null, events: [], stop: null
  });
}
export function v3JournalHash(journal) { return contentSha256(journal); }

function assertEventFields(event) {
  keys(event, ["type", "taskId", "childRunId", "runAttempt", "workflowRef", "prNumber",
    "headSha", "proof", "controllerRunId", "checkpointRevision", "checkpointHash",
    "origin", "controller", "reason"]);
  requireThat(typeof event.type === "string", "invalid_event");
}
function requireActive(journal, event, status) {
  requireThat(journal.status === status && journal.active !== null &&
    journal.active.taskId === event.taskId, "wrong_phase_or_task");
}
function apply(manifest, journal, event) {
  assertEventFields(event);
  requireThat(!terminal.has(journal.status) ||
    (event.type === "RECONCILE_NOTE" && journal.status.startsWith("STOP_")),
    "wave_is_terminal");
  const next = { ...journal, controllers: [...journal.controllers],
    attempted: [...journal.attempted], events: [...journal.events],
    active: journal.active ? { ...journal.active } : null };
  switch (event.type) {
    case "RESERVE": {
      requireThat(journal.status === "READY" && !journal.awaitingController &&
        journal.active === null, "wave_not_ready");
      requireThat(journal.reserved < manifest.limits.maxTaskStarts, "quota_reached");
      requireThat(taskId.test(event.taskId) &&
        manifest.candidateTasks.some(c => c.id === event.taskId) &&
        !journal.attempted.includes(event.taskId), "task_not_authorized_or_attempted");
      next.reserved++;
      next.attempted.push(event.taskId);
      next.active = { taskId: event.taskId,
        reservationId: manifest.waveId + ":" + next.reserved, childRunId: null };
      next.status = "RESERVED";
      break;
    }
    case "DISPATCH_INTENT":
      requireActive(journal, event, "RESERVED");
      next.status = "DISPATCH_PENDING";
      break;
    case "ACK_CHILD":
      requireActive(journal, event, "DISPATCH_PENDING");
      requireThat(runId.test(strRun(event.childRunId)) && event.runAttempt === 1 &&
        event.workflowRef === manifest.repository + "/" + V3_CHILD_WORKFLOW,
        "untrusted_child_ack");
      next.active.childRunId = strRun(event.childRunId);
      next.status = "CHILD_ACKNOWLEDGED";
      break;
    case "CLAIM_CHILD":
      requireActive(journal, event, "CHILD_ACKNOWLEDGED");
      requireThat(strRun(event.childRunId) === journal.active.childRunId &&
        event.runAttempt === 1 && event.workflowRef === manifest.repository + "/" + V3_CHILD_WORKFLOW,
        "child_replay_or_wrong_run");
      // The trusted adapter must verify this live GitHub observation, not user input.
      next.status = "EXECUTING";
      break;
    case "PR_PUBLISHED":
      requireActive(journal, event, "EXECUTING");
      requireThat(strRun(event.childRunId) === journal.active.childRunId &&
        Number.isInteger(event.prNumber) && event.prNumber > 0 &&
        sha40.test(event.headSha), "invalid_pr_proof");
      next.active.prNumber = event.prNumber;
      next.active.headSha = event.headSha;
      next.status = "DELIVERY_PENDING";
      break;
    case "DELIVERED": {
      requireActive(journal, event, "DELIVERY_PENDING");
      const p = event.proof;
      keys(p, ["prNumber", "headSha", "mergeSha", "merged", "branchProtected",
        "requiredCheck", "mainCheck", "pages"]);
      for (const name of ["requiredCheck", "mainCheck", "pages"]) {
        keys(p[name], ["sha", "conclusion"]);
      }
      requireThat(p.prNumber === journal.active.prNumber &&
        p.headSha === journal.active.headSha && sha40.test(p.mergeSha) &&
        p.merged === true && p.branchProtected === true &&
        p.requiredCheck.sha === p.headSha && p.requiredCheck.conclusion === "success" &&
        p.mainCheck.sha === p.mergeSha && p.mainCheck.conclusion === "success" &&
        p.pages.sha === p.mergeSha && p.pages.conclusion === "success",
        "delivery_not_independently_verified");
      next.delivered++;
      next.status = "DELIVERED";
      break;
    }
    case "CHECKPOINT":
      requireActive(journal, event, "DELIVERED");
      next.active = null;
      next.status = next.reserved === manifest.limits.maxTaskStarts ?
        "COMPLETED_QUOTA" : "READY";
      next.awaitingController = next.status === "READY";
      break;
    case "ATTACH_CONTROLLER": {
      requireThat(journal.status === "READY" && journal.awaitingController &&
        journal.active === null && journal.events.at(-1)?.type === "CHECKPOINT",
        "no_nominal_checkpoint");
      requireThat(event.checkpointRevision === journal.revision &&
        event.checkpointHash === v3JournalHash(journal), "checkpoint_mismatch");
      const origin = event.origin, controller = event.controller;
      keys(origin, ["runId", "actor", "workflowRef", "sourceSha", "event", "attempt", "headBranch"]);
      keys(controller, ["runId", "workflowRef", "repository", "event", "headBranch"]);
      requireThat(strRun(origin.runId) === manifest.authorization.runId &&
        origin.actor === manifest.authorization.actor &&
        origin.workflowRef === manifest.authorization.workflowRef &&
        origin.sourceSha === manifest.authorization.sourceSha &&
        origin.event === "workflow_dispatch" && origin.attempt === 1 &&
        origin.headBranch === "main", "unverified_original_owner_mandate");
      requireThat(strRun(event.controllerRunId) === strRun(controller.runId) &&
        runId.test(strRun(controller.runId)) &&
        strRun(controller.runId) !== manifest.authorization.runId &&
        !journal.controllers.includes(strRun(controller.runId)) &&
        controller.workflowRef === manifest.repository + "/" + V3_CONTROLLER_WORKFLOW &&
        controller.repository === manifest.repository &&
        controller.event === "repository_dispatch" && controller.headBranch === "main",
        "untrusted_continuation");
      next.controllers.push(strRun(controller.runId));
      next.awaitingController = false;
      break;
    }
    case "COMPLETE_NO_WORK":
      requireThat(journal.status === "READY" && !journal.awaitingController &&
        journal.active === null, "wave_not_ready");
      next.status = "COMPLETED_NO_WORK";
      break;
    case "STOP_FAILED":
    case "STOP_UNCERTAIN":
      requireThat(!terminal.has(journal.status) &&
        typeof event.reason === "string" && /^[a-z][a-z0-9_]{2,79}$/.test(event.reason),
        "invalid_stop");
      next.status = event.type;
      next.stop = { code: event.type, reason: event.reason };
      break;
    case "RECONCILE_NOTE":
      requireThat(journal.status.startsWith("STOP_") &&
        typeof event.reason === "string" && /^[a-z][a-z0-9_]{2,79}$/.test(event.reason),
        "invalid_reconciliation");
      break;
    default:
      requireThat(false, "unknown_event");
  }
  next.revision++;
  next.events.push(freezeDeep({ seq: next.revision, ...structuredClone(event) }));
  return freezeDeep(next);
}

/** Reconstruct all state from events; detect tampered quota, events and checkpoints. */
export function reconstructV3Journal(manifest, persisted) {
  requireThat(isObject(persisted) && Array.isArray(persisted.events) &&
    persisted.schemaVersion === V3_SCHEMA &&
    persisted.waveId === manifest.waveId &&
    persisted.manifestHash === contentSha256(manifest), "invalid_persisted_journal");
  let state = createV3Journal(manifest);
  for (const entry of persisted.events) {
    requireThat(isObject(entry) && entry.seq === state.revision + 1, "broken_event_sequence");
    const { seq, ...event } = entry;
    state = apply(manifest, state, event);
  }
  requireThat(canonicalize(state) === canonicalize(persisted), "journal_replay_divergence");
  return state;
}

/**
 * Pure CAS transition. A real adapter MUST commit the new document only when
 * the remote branch head SHA still equals the one it read; revision alone is
 * not sufficient across runners.
 */
export function advanceV3(manifest, persisted, event, expectedRevision) {
  const current = reconstructV3Journal(manifest, persisted);
  requireThat(current.revision === expectedRevision, "revision_conflict");
  return apply(manifest, current, event);
}

/** Read-only deterministic decision; NEVER initiate GitHub dispatch here. */
export function v3NextAction(journal) {
  if (terminal.has(journal.status)) return "STOP";
  if (journal.awaitingController) return "VERIFY_CONTINUATION";
  if (journal.status === "READY") return "SELECT_NEXT";
  if (journal.status === "RESERVED") return "PERSIST_DISPATCH_INTENT";
  if (journal.status === "DISPATCH_PENDING") return "RECONCILE_DISPATCH_NO_RETRY";
  if (journal.status === "CHILD_ACKNOWLEDGED") return "AWAIT_CHILD_CLAIM";
  if (journal.status === "EXECUTING") return "AWAIT_EXECUTOR";
  if (journal.status === "DELIVERY_PENDING") return "VERIFY_GITHUB_DELIVERY";
  if (journal.status === "DELIVERED") return "PERSIST_CHECKPOINT";
  return "STOP";
}
