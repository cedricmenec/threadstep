#!/usr/bin/env node
/**
 * Read-only delivery verification adapter (ASF-V2-007).
 *
 * The orchestrator must never treat a successful child run as a delivered task.
 * This module turns a structured GitHub observation into one of three explicit
 * verdicts and never guesses in between:
 *
 *   - `verified`  : one merged final PR at the expected branch/head SHA, the
 *                   expected independent `check` on head and merge commits,
 *                   the merge commit present in `main`, and the profile's
 *                   post-merge runs (for ThreadStep: `CI` and `Pages`) green;
 *   - `pending`   : a definitive "not delivered yet" — open/draft PR, merged but
 *                   missing run/check, or waiting post-merge runs. Resolvable,
 *                   but it never unblocks anything;
 *   - `unknown`   : incomplete or contradictory evidence — API/transport error,
 *                   pagination ceiling, ambiguous or concurrent PRs, wrong base,
 *                   branch, author or SHA, a missing or unproven check, or a
 *                   merge commit absent from `main`. Fail closed.
 *
 * The verification is pure: it reads an injected observation, never the network,
 * a clock or a mutable global. Archive state is recorded but never gates the
 * verdict: a verified delivery that is not archived still satisfies a dependency
 * (`docs/factory/specs/scheduler-v1.md` §4).
 *
 * Normative reference:
 *   - docs/factory/specs/orchestrator-v1.md §7, §8
 */

export const DELIVERY_STATUS = Object.freeze({
  VERIFIED: "verified",
  PENDING: "pending",
  UNKNOWN: "unknown"
});

export const DELIVERY_REASON = Object.freeze({
  VERIFIED: "verified",
  INVALID_CONFIG: "invalid_config",
  MISSING_OBSERVATION: "missing_observation",
  API_ERROR: "api_error",
  PAGINATION_LIMIT: "pagination_limit",
  NO_MERGED_PULL_REQUEST: "no_merged_pull_request",
  PULL_REQUEST_OPEN: "pull_request_open",
  PLAN_PULL_REQUEST: "plan_pull_request",
  DRAFT_PULL_REQUEST: "draft_pull_request",
  AMBIGUOUS_PULL_REQUEST: "ambiguous_pull_request",
  CONCURRENT_PULL_REQUEST: "concurrent_pull_request",
  PR_NOT_MERGED: "pr_not_merged",
  UNEXPECTED_BASE: "unexpected_base",
  UNEXPECTED_BRANCH: "unexpected_branch",
  FOREIGN_HEAD: "foreign_head",
  UNEXPECTED_AUTHOR: "unexpected_author",
  INVALID_HEAD_SHA: "invalid_head_sha",
  INVALID_MERGE_SHA: "invalid_merge_sha",
  RUN_MISSING: "run_missing",
  RUN_MISMATCH: "run_mismatch",
  RUN_PENDING: "run_pending",
  RUN_FAILED: "run_failed",
  RUN_PROVENANCE: "run_provenance",
  RUN_SHA_MISMATCH: "run_sha_mismatch",
  CHECK_MISSING: "check_missing",
  CHECK_PENDING: "check_pending",
  CHECK_FAILED: "check_failed",
  CHECK_PROVENANCE: "check_provenance",
  CHECK_UNKNOWN: "check_unknown",
  MERGE_NOT_IN_MAIN: "merge_not_in_main",
  POST_MERGE_MISSING: "post_merge_missing",
  POST_MERGE_PENDING: "post_merge_pending",
  POST_MERGE_FAILED: "post_merge_failed"
});

export const RUN_CORRELATION = Object.freeze({
  BRANCH_RUN_ID: "branch-run-id",
  HEAD_BRANCH: "head-branch"
});

const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ID_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]{1,4}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const FAILED_CONCLUSIONS = Object.freeze([
  "failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"
]);

function result(taskId, status, reasons, proof = null, observedAt = null) {
  return Object.freeze({
    taskId,
    status,
    reasons: Object.freeze(reasons),
    proof: proof ? Object.freeze(proof) : null,
    observedAt
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build the expected branch pattern for an ASF task: `agent/asf/<id>-run-<id>`. */
export function asfBranchPattern(taskId) {
  return new RegExp("^agent/asf/" + escapeRegExp(taskId) + "-run-([0-9]{1,20})$");
}

/** Build the expected branch pattern for an OpenSpec task: `agent/openspec/<id>`. */
export function openspecBranchPattern(taskId) {
  return new RegExp("^agent/openspec/" + escapeRegExp(taskId) + "$");
}

/** Known ASF delivery profile, aligned with `agent-asf.yml`. */
export function createAsfDeliveryConfig({ taskId, repository, base = "main" }) {
  return {
    taskId,
    repository,
    base,
    profileId: "asf",
    prTitle: "Agent ASF: " + taskId,
    branchPattern: asfBranchPattern(taskId),
    runCorrelation: RUN_CORRELATION.BRANCH_RUN_ID,
    runPath: ".github/workflows/agent-asf.yml",
    expectedAuthor: "threadstep-software-factory[bot]",
    check: { name: "check", appSlug: "github-actions", appId: 15368 },
    postMergeRuns: ["CI", "Pages"]
  };
}

/** Known OpenSpec delivery profile, aligned with `agent-openspec.yml`. */
export function createOpenspecDeliveryConfig({ taskId, repository, base = "main" }) {
  return {
    taskId,
    repository,
    base,
    profileId: "openspec",
    prTitle: "OpenSpec: " + taskId,
    branchPattern: openspecBranchPattern(taskId),
    runCorrelation: RUN_CORRELATION.HEAD_BRANCH,
    runPath: ".github/workflows/agent-openspec.yml",
    expectedAuthor: "threadstep-software-factory[bot]",
    check: { name: "check", appSlug: "github-actions", appId: 15368 },
    postMergeRuns: ["CI", "Pages"],
    rejectBodyPattern: /Phase plan:/
  };
}

function unknown(taskId, reason, observedAt) {
  return result(taskId, DELIVERY_STATUS.UNKNOWN, [reason], null, observedAt);
}

function pending(taskId, reason, observedAt) {
  return result(taskId, DELIVERY_STATUS.PENDING, [reason], null, observedAt);
}

function hasErrors(observation) {
  return Array.isArray(observation.errors) && observation.errors.length > 0;
}

function errorReasons(observation) {
  const reasons = [DELIVERY_REASON.API_ERROR];
  for (const entry of observation.errors) {
    const stage = entry && typeof entry.stage === "string" ? entry.stage : "unknown";
    const code = entry && typeof entry.code === "string" ? entry.code : "transport_error";
    reasons.push(stage + ":" + code);
  }
  return reasons;
}

function evaluateCheck(checks, sha, check) {
  const named = checks.filter(entry =>
    entry && entry.name === check.name && entry.head_sha === sha);
  if (!named.length) return DELIVERY_REASON.CHECK_MISSING;
  const owned = named.filter(entry =>
    entry.app && entry.app.slug === check.appSlug && entry.app.id === check.appId);
  if (!owned.length) return DELIVERY_REASON.CHECK_PROVENANCE;
  if (owned.some(entry => entry.status === "completed" && entry.conclusion === "success")) return null;
  if (owned.some(entry => entry.status !== "completed")) return DELIVERY_REASON.CHECK_PENDING;
  if (owned.some(entry => FAILED_CONCLUSIONS.includes(entry.conclusion))) return DELIVERY_REASON.CHECK_FAILED;
  return DELIVERY_REASON.CHECK_UNKNOWN;
}

function evaluatePostMerge(mainRuns, name, mergeSha, mergedAt) {
  const candidates = mainRuns.filter(entry =>
    entry && entry.name === name && entry.head_sha === mergeSha && entry.event === "push");
  if (!candidates.length) return DELIVERY_REASON.POST_MERGE_MISSING;
  const green = candidates.some(entry =>
    entry.status === "completed" && entry.conclusion === "success" &&
    typeof entry.created_at === "string" && entry.created_at >= mergedAt);
  if (green) return null;
  if (candidates.some(entry => entry.status !== "completed")) return DELIVERY_REASON.POST_MERGE_PENDING;
  if (candidates.some(entry => entry.conclusion !== "success")) return DELIVERY_REASON.POST_MERGE_FAILED;
  return DELIVERY_REASON.POST_MERGE_PENDING;
}

/**
 * Pure delivery verdict. `config` is the expected identity (task, repository,
 * base, PR title, branch, run correlation, check provenance and profile runs).
 * `observation` is the injected GitHub evidence. Returns a frozen verdict:
 * `verified`, `pending` or `unknown`, with explicit reasons and, only when
 * verified, a secret-free proof.
 */
export function verifyDelivery(config, observation) {
  const observedAt = observation && typeof observation.observedAt === "string"
    ? observation.observedAt : null;
  const taskId = config && typeof config.taskId === "string" ? config.taskId : null;

  const configError = !config || typeof config !== "object" ||
    typeof config.taskId !== "string" || !ID_PATTERN.test(config.taskId) ||
    typeof config.repository !== "string" || !REPOSITORY_PATTERN.test(config.repository) ||
    typeof config.base !== "string" || !config.base ||
    typeof config.prTitle !== "string" || !config.prTitle ||
    !(config.branchPattern instanceof RegExp) ||
    !Object.values(RUN_CORRELATION).includes(config.runCorrelation) ||
    typeof config.runPath !== "string" || !config.runPath ||
    typeof config.expectedAuthor !== "string" || !config.expectedAuthor ||
    !config.check || typeof config.check.name !== "string" ||
    typeof config.check.appSlug !== "string" || !Number.isInteger(config.check.appId) ||
    !Array.isArray(config.postMergeRuns) || config.postMergeRuns.some(name => typeof name !== "string");
  if (configError) return unknown(taskId, DELIVERY_REASON.INVALID_CONFIG, observedAt);

  if (!observation || typeof observation !== "object" ||
      !Array.isArray(observation.pullRequests)) {
    return unknown(config.taskId, DELIVERY_REASON.MISSING_OBSERVATION, observedAt);
  }
  // An API or transport error is never an absence of conflict.
  if (hasErrors(observation)) {
    return result(config.taskId, DELIVERY_STATUS.UNKNOWN, errorReasons(observation), null, observedAt);
  }
  // A truncated page list may hide the real PR: incomplete evidence is unknown.
  if (observation.truncated === true) {
    return unknown(config.taskId, DELIVERY_REASON.PAGINATION_LIMIT, observedAt);
  }

  const titled = observation.pullRequests.filter(entry =>
    entry && entry.title === config.prTitle);
  const merged = titled.filter(entry =>
    entry.merged === true && entry.state === "closed" && typeof entry.merged_at === "string");
  const open = titled.filter(entry => entry.state === "open");

  if (merged.length > 1) {
    return unknown(config.taskId, DELIVERY_REASON.AMBIGUOUS_PULL_REQUEST, observedAt);
  }
  if (merged.length === 0) {
    if (open.length) {
      const reason = open.some(entry => entry.draft === true)
        ? DELIVERY_REASON.DRAFT_PULL_REQUEST
        : DELIVERY_REASON.PULL_REQUEST_OPEN;
      return pending(config.taskId, reason, observedAt);
    }
    return pending(config.taskId, DELIVERY_REASON.NO_MERGED_PULL_REQUEST, observedAt);
  }
  // A merged candidate plus a live PR for the same task is a concurrent attempt.
  if (open.length) {
    return unknown(config.taskId, DELIVERY_REASON.CONCURRENT_PULL_REQUEST, observedAt);
  }

  const pr = merged[0];
  if (config.rejectBodyPattern instanceof RegExp &&
      typeof pr.body === "string" && config.rejectBodyPattern.test(pr.body)) {
    return pending(config.taskId, DELIVERY_REASON.PLAN_PULL_REQUEST, observedAt);
  }
  if (pr.draft === true) return pending(config.taskId, DELIVERY_REASON.DRAFT_PULL_REQUEST, observedAt);
  if (pr.merged !== true || !pr.merged_at) return pending(config.taskId, DELIVERY_REASON.PR_NOT_MERGED, observedAt);

  if (!pr.base || pr.base.ref !== config.base) {
    return unknown(config.taskId, DELIVERY_REASON.UNEXPECTED_BASE, observedAt);
  }
  const branch = pr.head && pr.head.ref;
  const branchMatch = typeof branch === "string" ? config.branchPattern.exec(branch) : null;
  if (!branchMatch) return unknown(config.taskId, DELIVERY_REASON.UNEXPECTED_BRANCH, observedAt);
  if (!pr.head || !pr.head.repo || pr.head.repo.full_name !== config.repository) {
    return unknown(config.taskId, DELIVERY_REASON.FOREIGN_HEAD, observedAt);
  }
  if (!pr.user || pr.user.login !== config.expectedAuthor) {
    return unknown(config.taskId, DELIVERY_REASON.UNEXPECTED_AUTHOR, observedAt);
  }
  const headSha = pr.head.sha;
  const mergeSha = pr.merge_commit_sha;
  if (!SHA_PATTERN.test(headSha ?? "")) return unknown(config.taskId, DELIVERY_REASON.INVALID_HEAD_SHA, observedAt);
  if (!COMMIT_PATTERN.test(mergeSha ?? "")) return unknown(config.taskId, DELIVERY_REASON.INVALID_MERGE_SHA, observedAt);

  const runIdCapture = config.runCorrelation === RUN_CORRELATION.BRANCH_RUN_ID
    ? branchMatch[1] : null;
  if (config.runCorrelation === RUN_CORRELATION.BRANCH_RUN_ID && !runIdCapture) {
    return unknown(config.taskId, DELIVERY_REASON.RUN_MISMATCH, observedAt);
  }

  const run = observation.run;
  if (!run) return pending(config.taskId, DELIVERY_REASON.RUN_MISSING, observedAt);
  if (config.runCorrelation === RUN_CORRELATION.BRANCH_RUN_ID) {
    if (String(run.id) !== runIdCapture) return unknown(config.taskId, DELIVERY_REASON.RUN_MISMATCH, observedAt);
  } else if (run.head_branch !== branch) {
    return unknown(config.taskId, DELIVERY_REASON.RUN_MISMATCH, observedAt);
  }
  if (run.path !== config.runPath || run.event !== "workflow_dispatch" ||
      !run.actor || run.actor.login !== config.repository.split("/")[0]) {
    return unknown(config.taskId, DELIVERY_REASON.RUN_PROVENANCE, observedAt);
  }
  if (run.status !== "completed") return pending(config.taskId, DELIVERY_REASON.RUN_PENDING, observedAt);
  if (run.conclusion !== "success") return pending(config.taskId, DELIVERY_REASON.RUN_FAILED, observedAt);
  if (run.head_sha && run.head_sha !== headSha) {
    return unknown(config.taskId, DELIVERY_REASON.RUN_SHA_MISMATCH, observedAt);
  }

  const headCheck = evaluateCheck(
    Array.isArray(observation.headChecks) ? observation.headChecks : [], headSha, config.check);
  if (headCheck) return result(config.taskId, statusForCheck(headCheck), [headCheck], null, observedAt);
  const mainCheck = evaluateCheck(
    Array.isArray(observation.mainChecks) ? observation.mainChecks : [], mergeSha, config.check);
  if (mainCheck) return result(config.taskId, statusForCheck(mainCheck), [mainCheck], null, observedAt);

  const comparison = observation.comparison;
  if (!comparison || !["ahead", "identical"].includes(comparison.status)) {
    return unknown(config.taskId, DELIVERY_REASON.MERGE_NOT_IN_MAIN, observedAt);
  }

  const mainRuns = Array.isArray(observation.mainRuns) ? observation.mainRuns : [];
  for (const name of config.postMergeRuns) {
    const postMerge = evaluatePostMerge(mainRuns, name, mergeSha, pr.merged_at);
    if (postMerge) return result(config.taskId, statusForCheck(postMerge), [postMerge], null, observedAt);
  }

  return result(config.taskId, DELIVERY_STATUS.VERIFIED, [DELIVERY_REASON.VERIFIED], {
    profile: config.profileId ?? null,
    pr: pr.number,
    headSha,
    mergeSha,
    runId: normalizeRunId(runIdCapture ?? run.id),
    postMergeRuns: config.postMergeRuns,
    archived: observation.archived === true
  }, observedAt);
}

function normalizeRunId(value) {
  if (Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[0-9]{1,20}$/.test(value)) return Number(value);
  return null;
}

function statusForCheck(reason) {
  switch (reason) {
    case DELIVERY_REASON.CHECK_MISSING:
    case DELIVERY_REASON.CHECK_PROVENANCE:
    case DELIVERY_REASON.CHECK_UNKNOWN:
    case DELIVERY_REASON.RUN_MISMATCH:
    case DELIVERY_REASON.RUN_PROVENANCE:
    case DELIVERY_REASON.RUN_SHA_MISMATCH:
      return DELIVERY_STATUS.UNKNOWN;
    default:
      return DELIVERY_STATUS.PENDING;
  }
}

/**
 * Project a verdict into the scheduler's delivery-evidence vocabulary
 * (`verified | unknown`, `docs/factory/specs/scheduler-v1.md` §6). A `pending`
 * delivery is not verified and not uncertain: it is omitted so the scheduler
 * treats the dependency as not delivered (a safe block, never a paid call).
 * Only `verified` and `unknown` are represented; `unknown` yields
 * `STOP_UNCERTAIN` in the scheduler.
 */
export function toSchedulerEvidence(verdict) {
  if (!verdict || typeof verdict !== "object") return null;
  if (verdict.status === DELIVERY_STATUS.VERIFIED) {
    return { status: "verified", proof: verdict.proof };
  }
  if (verdict.status === DELIVERY_STATUS.UNKNOWN) {
    return { status: "unknown", proof: null };
  }
  return null;
}
