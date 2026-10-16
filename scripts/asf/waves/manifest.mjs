#!/usr/bin/env node
/**
 * Immutable wave manifest (ASF-V2-006).
 *
 * A wave is an explicitly authorized, bounded set of candidate product tasks.
 * The manifest is the authorization record produced once at wave opening: it
 * freezes the source commit, the candidate IDs and their content hashes, the
 * wave identity, the model allowlist, the `1..2` start limit and the
 * authorization reference. Once created it is deep-frozen and never mutated;
 * the executor may start from a newer `main` while still re-reading a frozen
 * task definition and comparing it to the authorized hash.
 *
 * The real authentication source is the GitHub actor and parent run, not the
 * declarative `authorizedBy` label alone. The manifest carries a reference to
 * that proof so the journal can be correlated without embedding any secret.
 *
 * Normative reference:
 *   - docs/factory/specs/orchestrator-v1.md §3, §4, §5
 */
import { contentSha256 } from "./hash.mjs";
import { findSecretPaths } from "./secrets.mjs";

export const MANIFEST_SCHEMA_VERSION = 1;
export const ORCHESTRATOR_POLICY_VERSION = "asf-orch-v1";

/** Model allowlist kept coherent with the dispatchable executor workflows. */
export const MODEL_ALLOWLIST = Object.freeze([
  "openrouter/deepseek/deepseek-v4.1-flash",
  "openrouter/z-ai/glm-5.3-flash"
]);
export const WAVE_MODES = Object.freeze(["dry-run", "execute"]);
export const EXECUTORS = Object.freeze(["openspec"]);
export const PHASES = Object.freeze(["plan", "apply", "auto", "finalize"]);
export const MAX_TASK_STARTS = Object.freeze([1, 2]);

const ID_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{1,4}$/;
const WAVE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RUN_ID_PATTERN = /^[0-9]{1,20}$/;

const MANIFEST_KEYS = Object.freeze([
  "schemaVersion", "waveId", "repository", "authorizedBy", "backlogCommit",
  "policyVersion", "mode", "executor", "phase", "model", "limits",
  "autoMerge", "candidateTasks", "authorization"
]);
const LIMITS_KEYS = Object.freeze(["maxTaskStarts", "maxConcurrentTasks", "maxPaidRetries"]);
const AUTHORIZATION_KEYS = Object.freeze(["parentRunId", "reference", "authorizedAt"]);
const CANDIDATE_KEYS = Object.freeze(["id", "sha256"]);

function error(code, field, message) {
  return { code, field: field ?? null, message };
}

function codeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function unknownKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).filter(key => !allowed.includes(key));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

/**
 * Strictly validate a manifest-shaped object. Unknown keys are rejected so an
 * accidental token or extra field cannot be smuggled into the authorization
 * record, and secret-looking strings fail closed.
 */
export function validateWaveManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, errors: [error("invalid_manifest", null, "manifest must be an object")] };
  }

  for (const key of unknownKeys(manifest, MANIFEST_KEYS)) {
    errors.push(error("unknown_field", key, 'unknown manifest field "' + key + '"'));
  }
  for (const key of MANIFEST_KEYS) {
    if (manifest[key] === undefined) {
      errors.push(error("missing_field", key, 'manifest field "' + key + '" is required'));
    }
  }

  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    errors.push(error("unsupported_schema", "schemaVersion",
      "schemaVersion must be " + MANIFEST_SCHEMA_VERSION));
  }
  if (typeof manifest.waveId !== "string" || !WAVE_ID_PATTERN.test(manifest.waveId)) {
    errors.push(error("unsafe_wave_id", "waveId", "waveId must be a safe lowercase identifier"));
  }
  if (typeof manifest.repository !== "string" || !REPOSITORY_PATTERN.test(manifest.repository)) {
    errors.push(error("invalid_repository", "repository", "repository must be owner/name"));
  }
  if (typeof manifest.authorizedBy !== "string" || !manifest.authorizedBy.trim()) {
    errors.push(error("missing_authorization", "authorizedBy",
      "authorizedBy must be a non-empty reference label"));
  }
  if (typeof manifest.backlogCommit !== "string" || !COMMIT_PATTERN.test(manifest.backlogCommit)) {
    errors.push(error("invalid_source_sha", "backlogCommit",
      "backlogCommit must be a 40 or 64 hex commit SHA"));
  }
  if (typeof manifest.policyVersion !== "string" || !manifest.policyVersion.trim()) {
    errors.push(error("missing_policy_version", "policyVersion", "policyVersion is required"));
  }
  if (!WAVE_MODES.includes(manifest.mode)) {
    errors.push(error("invalid_mode", "mode", "mode must be one of " + WAVE_MODES.join(", ")));
  }
  if (!EXECUTORS.includes(manifest.executor)) {
    errors.push(error("invalid_executor", "executor", "executor must be openspec"));
  }
  if (!PHASES.includes(manifest.phase)) {
    errors.push(error("invalid_phase", "phase", "phase must be one of " + PHASES.join(", ")));
  }
  if (!MODEL_ALLOWLIST.includes(manifest.model)) {
    errors.push(error("model_not_allowed", "model", "model is not in the allowlist"));
  }
  if (typeof manifest.autoMerge !== "boolean") {
    errors.push(error("invalid_auto_merge", "autoMerge", "autoMerge must be a boolean"));
  }

  errors.push(...validateLimits(manifest.limits));
  errors.push(...validateAuthorization(manifest.authorization));
  errors.push(...validateCandidates(manifest.candidateTasks));

  const secretPaths = findSecretPaths(manifest);
  for (const path of secretPaths) {
    errors.push(error("secret_detected", path, "manifest contains a secret-looking value"));
  }

  errors.sort((a, b) => codeUnit(a.field ?? "", b.field ?? "") ||
    codeUnit(a.code, b.code));
  return { ok: errors.length === 0, errors };
}

function validateLimits(limits) {
  const errors = [];
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) {
    return [error("invalid_limits", "limits", "limits must be an object")];
  }
  for (const key of unknownKeys(limits, LIMITS_KEYS)) {
    errors.push(error("unknown_field", "limits." + key, 'unknown limits field "' + key + '"'));
  }
  if (!Number.isInteger(limits.maxTaskStarts) ||
      !MAX_TASK_STARTS.includes(limits.maxTaskStarts)) {
    errors.push(error("invalid_max_tasks", "limits.maxTaskStarts",
      "maxTaskStarts must be 1 or 2"));
  }
  if (limits.maxConcurrentTasks !== 1) {
    errors.push(error("invalid_concurrency", "limits.maxConcurrentTasks",
      "V1 allows exactly one concurrent paid task"));
  }
  if (limits.maxPaidRetries !== 0) {
    errors.push(error("invalid_retries", "limits.maxPaidRetries",
      "V1 forbids automatic paid retries"));
  }
  return errors;
}

function validateAuthorization(authorization) {
  const errors = [];
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) {
    return [error("invalid_authorization", "authorization", "authorization reference is required")];
  }
  for (const key of unknownKeys(authorization, AUTHORIZATION_KEYS)) {
    errors.push(error("unknown_field", "authorization." + key,
      'unknown authorization field "' + key + '"'));
  }
  const parentRunId = authorization.parentRunId;
  const parentValid = (typeof parentRunId === "string" && RUN_ID_PATTERN.test(parentRunId)) ||
    (Number.isInteger(parentRunId) && parentRunId > 0);
  if (!parentValid) {
    errors.push(error("invalid_parent_run", "authorization.parentRunId",
      "parentRunId must be a positive run id"));
  }
  if (typeof authorization.reference !== "string" || !authorization.reference.trim()) {
    errors.push(error("missing_reference", "authorization.reference",
      "authorization reference must be a non-empty string"));
  }
  if (authorization.authorizedAt !== undefined &&
      typeof authorization.authorizedAt !== "string") {
    errors.push(error("invalid_authorized_at", "authorization.authorizedAt",
      "authorizedAt must be an injected ISO string when present"));
  }
  return errors;
}

function validateCandidates(candidateTasks) {
  const errors = [];
  if (!Array.isArray(candidateTasks)) {
    return [error("invalid_candidates", "candidateTasks", "candidateTasks must be an array")];
  }
  const seen = new Set();
  candidateTasks.forEach((candidate, index) => {
    const prefix = "candidateTasks[" + index + "]";
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      errors.push(error("invalid_candidate", prefix, "candidate must be an object"));
      return;
    }
    for (const key of unknownKeys(candidate, CANDIDATE_KEYS)) {
      errors.push(error("unknown_field", prefix + "." + key,
        'unknown candidate field "' + key + '"'));
    }
    if (typeof candidate.id !== "string" || !ID_PATTERN.test(candidate.id)) {
      errors.push(error("unsafe_id", prefix + ".id", "candidate id is unsafe or missing"));
    } else if (seen.has(candidate.id)) {
      errors.push(error("duplicate_candidate", prefix + ".id",
        'duplicate candidate id "' + candidate.id + '"'));
    } else {
      seen.add(candidate.id);
    }
    if (typeof candidate.sha256 !== "string" || !SHA256_PATTERN.test(candidate.sha256)) {
      errors.push(error("invalid_hash", prefix + ".sha256", "candidate sha256 is invalid"));
    }
  });
  return errors;
}

/**
 * Create the immutable manifest from an explicit authorization input. Returns a
 * report instead of throwing so a malformed authorization never opens a wave.
 * On success the manifest is deep-frozen and accompanied by its content hash.
 */
export function createWaveManifest(input) {
  const validation = validateWaveManifest(input);
  if (!validation.ok) {
    return { ok: false, manifest: null, manifestHash: null, errors: validation.errors };
  }
  const manifest = deepFreeze({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    waveId: input.waveId,
    repository: input.repository,
    authorizedBy: input.authorizedBy,
    backlogCommit: input.backlogCommit,
    policyVersion: input.policyVersion,
    mode: input.mode,
    executor: input.executor,
    phase: input.phase,
    model: input.model,
    limits: {
      maxTaskStarts: input.limits.maxTaskStarts,
      maxConcurrentTasks: input.limits.maxConcurrentTasks,
      maxPaidRetries: input.limits.maxPaidRetries
    },
    autoMerge: input.autoMerge,
    candidateTasks: input.candidateTasks.map(candidate => ({
      id: candidate.id,
      sha256: candidate.sha256
    })),
    authorization: {
      parentRunId: input.authorization.parentRunId,
      reference: input.authorization.reference,
      ...(input.authorization.authorizedAt === undefined
        ? {}
        : { authorizedAt: input.authorization.authorizedAt })
    }
  });
  return { ok: true, manifest, manifestHash: contentSha256(manifest), errors: [] };
}

/**
 * Content hash of an already validated manifest. Two manifests with the same
 * authorization but a different key order hash identically; any semantic change
 * produces a different hash. Used to bind the journal to its authorization.
 */
export function hashWaveManifest(manifest) {
  return contentSha256(manifest);
}
