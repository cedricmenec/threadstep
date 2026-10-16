#!/usr/bin/env node
/**
 * ASF deterministic archiver core.
 *
 * This module is intentionally pure and side-effect free: it turns a set of
 * *verified* delivery proofs plus the matching backlog cards into a single,
 * reproducible archive plan. The plan is the only artifact the privileged
 * publication path is allowed to turn into a documentary PR.
 *
 * Guarantees enforced here:
 *   - only tasks with a `verified` delivery are ever moved;
 *   - historical checkboxes are never ticked and the task body is preserved;
 *   - zero verified deliveries yield *no* PR (never an empty PR);
 *   - inputs are validated and fail closed, with no secret material emitted;
 *   - the plan is deterministic: same inputs, byte-identical outputs.
 *
 * See docs/factory/agent-asf-archive.md for the operational contract and the
 * matching specs under docs/factory/specs/.
 */

export const ARCHIVE_SCHEMA_VERSION = 1;

export const ARCHIVE_RESULT = Object.freeze({
  ARCHIVED: "archived",
  ARCHIVE_PENDING: "archive_pending"
});

export const ARCHIVE_OUTCOME_REASON = Object.freeze({
  PULL_REQUEST_OPEN: "pull_request_open",
  PULL_REQUEST_FAILED: "pull_request_failed",
  PULL_REQUEST_UNKNOWN: "pull_request_unknown"
});

export const ARCHIVE_BLOCK_REASON = Object.freeze({
  DELIVERY_PENDING: "delivery_pending",
  DELIVERY_UNKNOWN: "delivery_unknown",
  DELIVERY_FAILED: "delivery_failed",
  DELIVERY_INVALID: "delivery_invalid",
  DELIVERY_MISSING: "delivery_missing",
  DUPLICATE_DELIVERY: "duplicate_delivery",
  TASK_MISSING: "task_missing"
});

export const ARCHIVE_BRANCH_PREFIX = "asf/archive/";
export const ARCHIVE_BRANCH_PATTERN = /^asf\/archive\/[a-z0-9][a-z0-9-]*$/;

/** Documented child order of the nested `delivery:` mapping. */
export const DELIVERY_FIELD_ORDER = Object.freeze([
  "head_sha", "merge_sha", "pull_request", "pull_request_url", "verified"
]);

const REPOSITORY_PATTERN = /^[-\w.]+\/[-\w.]+$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

const VERIFIED_STATUS = "verified";
const PENDING_STATUSES = new Set(["pending", "running", "reserved"]);

/** Lower-case, filesystem/Git-safe slug for an archive scope. */
export function slugifyScope(scope) {
  if (typeof scope !== "string") throw new TypeError("Archive scope must be text");
  const slug = scope.trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!SLUG_PATTERN.test(slug)) throw new Error("Archive scope does not yield a valid branch slug");
  return slug;
}

/** Deterministic documentary branch name for a scope. */
export function archiveBranchFor(scope) {
  return ARCHIVE_BRANCH_PREFIX + slugifyScope(scope);
}

/**
 * Validate a single delivery proof. Returns the normalized `metadata` mapping
 * (string values only) or throws; callers translate failures into blocked
 * reasons instead of archiving.
 */
export function validateDeliveryProof(delivery, { repository } = {}) {
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    throw new Error(ARCHIVE_BLOCK_REASON.DELIVERY_INVALID);
  }
  const proof = delivery.proof;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    throw new Error(ARCHIVE_BLOCK_REASON.DELIVERY_MISSING);
  }
  if (!REPOSITORY_PATTERN.test(repository ?? "")) {
    throw new Error("A well-formed owner/repo repository is required");
  }
  const pr = proof.pr;
  if (!Number.isInteger(pr) || pr <= 0) {
    throw new Error(ARCHIVE_BLOCK_REASON.DELIVERY_INVALID);
  }
  if (!SHA_PATTERN.test(proof.headSha ?? "") || !SHA_PATTERN.test(proof.mergeSha ?? "")) {
    throw new Error(ARCHIVE_BLOCK_REASON.DELIVERY_INVALID);
  }
  const metadata = {
    head_sha: proof.headSha,
    merge_sha: proof.mergeSha,
    pull_request: String(pr),
    pull_request_url: "https://github.com/" + repository + "/pull/" + pr,
    verified: "true"
  };
  return { taskId: delivery.taskId, metadata };
}

/**
 * Partition deliveries into `archivable` and `blocked`. A delivery is archivable
 * only when its status is exactly `verified` and its proof is valid and unique.
 */
export function selectArchivable(deliveries, { repository } = {}) {
  const archivable = [];
  const blocked = [];
  const seen = new Set();
  const list = Array.isArray(deliveries) ? deliveries : [];
  for (const delivery of list) {
    const taskId = delivery && typeof delivery === "object" ? delivery.taskId : undefined;
    if (typeof taskId !== "string" || !taskId) {
      blocked.push({ taskId: String(taskId ?? "unknown"), reasons: [ARCHIVE_BLOCK_REASON.DELIVERY_INVALID] });
      continue;
    }
    if (seen.has(taskId)) {
      blocked.push({ taskId, reasons: [ARCHIVE_BLOCK_REASON.DUPLICATE_DELIVERY] });
      continue;
    }
    seen.add(taskId);
    if (delivery.status !== VERIFIED_STATUS) {
      const reason = PENDING_STATUSES.has(delivery.status)
        ? ARCHIVE_BLOCK_REASON.DELIVERY_PENDING
        : delivery.status === "failed"
          ? ARCHIVE_BLOCK_REASON.DELIVERY_FAILED
          : ARCHIVE_BLOCK_REASON.DELIVERY_UNKNOWN;
      blocked.push({ taskId, reasons: [reason] });
      continue;
    }
    try {
      archivable.push(validateDeliveryProof(delivery, { repository }));
    } catch {
      blocked.push({ taskId, reasons: [ARCHIVE_BLOCK_REASON.DELIVERY_INVALID] });
    }
  }
  return { archivable, blocked };
}

/** Scheduler-facing evidence: a `verified` delivery means already delivered. */
export function toExecutionEvidence(plan) {
  const deliveries = {};
  for (const move of plan?.moves ?? []) {
    deliveries[move.taskId] = { status: VERIFIED_STATUS, proof: { ...move.delivery } };
  }
  return { deliveries };
}

/** Rewrite explicit `backlog/tasks/<id>.md` references to their archive path. */
export function rewriteBacklogLinks(text, moves) {
  if (typeof text !== "string") return text;
  let result = text;
  for (const move of moves ?? []) {
    const from = move.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(from, "g"), move.to);
  }
  return result;
}

/**
 * Render an archived task: keep the original body verbatim and insert a nested
 * `delivery:` block at the end of the existing frontmatter. Historical
 * checkboxes are preserved as-is.
 */
export function renderArchivedTask(content, metadata) {
  if (typeof content !== "string" || content.split("\n")[0] !== "---") {
    throw new Error("Archived task must start with a `---` frontmatter fence");
  }
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const close = lines.indexOf("---", 1);
  if (close === -1) throw new Error("Archived task has an unclosed frontmatter block");
  if (lines.some((line, index) => index >= 1 && index < close && line === "delivery:")) {
    return content; // idempotent: already archived
  }
  const frontmatter = lines.slice(1, close);
  while (frontmatter.length && frontmatter[frontmatter.length - 1].trim() === "") frontmatter.pop();
  const block = ["delivery:"];
  for (const key of DELIVERY_FIELD_ORDER) {
    if (!(key in metadata)) throw new Error("Missing delivery field " + key);
    block.push("  " + key + ": " + metadata[key]);
  }
  const body = lines.slice(close + 1);
  return ["---", ...frontmatter, ...block, "---", ...body].join("\n");
}

/**
 * Build the complete archive plan. `tasks` are the backlog cards that may be
 * moved. Deterministic order: `moves` sorted by task id.
 */
export function buildArchivePlan({ scope, repository, deliveries, tasks } = {}) {
  let branch;
  try {
    branch = archiveBranchFor(scope);
  } catch (error) {
    return { ok: false, schemaVersion: ARCHIVE_SCHEMA_VERSION, branch: null,
      pullRequest: null, moves: [], blocked: [{ taskId: "unknown", reasons: [error.message] }] };
  }
  if (!REPOSITORY_PATTERN.test(repository ?? "")) {
    return { ok: false, schemaVersion: ARCHIVE_SCHEMA_VERSION, branch: null,
      pullRequest: null, moves: [], blocked: [{ taskId: "unknown", reasons: ["repository_invalid"] }] };
  }

  const { archivable, blocked } = selectArchivable(deliveries, { repository });
  const byId = new Map();
  for (const task of tasks ?? []) {
    if (task && typeof task.id === "string") byId.set(task.id, task);
  }

  const moves = [];
  const finalBlocked = [...blocked];
  for (const candidate of archivable) {
    const task = byId.get(candidate.taskId);
    if (!task || typeof task.content !== "string") {
      finalBlocked.push({ taskId: candidate.taskId, reasons: [ARCHIVE_BLOCK_REASON.TASK_MISSING] });
      continue;
    }
    moves.push({
      taskId: candidate.taskId,
      from: task.path,
      to: "backlog/archive/" + candidate.taskId + ".md",
      delivery: candidate.metadata,
      content: renderArchivedTask(task.content, candidate.metadata)
    });
  }
  moves.sort((a, b) => a.taskId.localeCompare(b.taskId));
  finalBlocked.sort((a, b) => a.taskId.localeCompare(b.taskId));

  const pullRequest = moves.length
    ? { base: "main", branch, title: "chore(asf): archive delivered " + moves.length + " task(s) [" + scope + "]",
        body: "Automated documentary archive for scope " + scope + ".\n"
          + "Archived: " + moves.map(m => m.taskId).join(", ") + ".",
        tasks: moves.map(m => m.taskId) }
    : null;

  return { ok: true, schemaVersion: ARCHIVE_SCHEMA_VERSION, scope, repository, branch, moves, blocked: finalBlocked, pullRequest };
}

/**
 * Decide the per-task outcome from the PR state. A merged PR archives the moved
 * tasks; anything else records `archive_pending` and never re-enables the task.
 */
export function evaluateArchiveOutcome(plan, { status, mergeSha } = {}) {
  const results = [];
  if (status === "merged" && SHA_PATTERN.test(mergeSha ?? "")) {
    for (const move of plan?.moves ?? []) {
      results.push({ taskId: move.taskId, status: ARCHIVE_RESULT.ARCHIVED, mergeSha, reason: null });
    }
    return { status: "merged", results };
  }
  const reason = status === "failed"
    ? ARCHIVE_OUTCOME_REASON.PULL_REQUEST_FAILED
    : status === "open"
      ? ARCHIVE_OUTCOME_REASON.PULL_REQUEST_OPEN
      : ARCHIVE_OUTCOME_REASON.PULL_REQUEST_UNKNOWN;
  for (const move of plan?.moves ?? []) {
    results.push({ taskId: move.taskId, status: ARCHIVE_RESULT.ARCHIVE_PENDING, mergeSha: null, reason });
  }
  return { status: "pending", results };
}

/** Secret-free human summary used by logs and the PR description. */
export function summarizeArchivePlan(plan) {
  return {
    schemaVersion: plan?.schemaVersion,
    archived: (plan?.moves ?? []).map(move => move.taskId),
    blocked: (plan?.blocked ?? []).map(entry => ({ taskId: entry.taskId, reasons: entry.reasons })),
    pullRequest: plan?.pullRequest ? plan.pullRequest.branch : null
  };
}
