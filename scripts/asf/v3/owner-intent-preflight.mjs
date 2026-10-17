/**
 * ASF-V3-009: read-only owner intent reconciliation, prior to ANY issuer.
 *
 * This module NEVER signs, dispatches, writes Git or authorizes OpenRouter.
 * It checks data consistency, NOT origin authentication of ownerContext.
 * The ownerContext and its event inputs MUST be captured directly by a
 * separately reviewed, trusted owner-dispatched workflow on protected main.
 * Passing arbitrary JSON (including a model-supplied context) is not a proof.
 */
import { contentSha256 } from "../waves/hash.mjs";
import { MODEL_ALLOWLIST } from "../waves/manifest.mjs";

export const V3_OWNER_ISSUER_WORKFLOW =
  ".github/workflows/backlog-orchestrator-v3.yml";
export const V3_OWNER_REPOSITORY = "cedricmenec/threadstep";
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const TASK = /^TS-\d{3}$/;
const RUN = /^[1-9]\d{0,17}$/;
const BASE = "repos/" + V3_OWNER_REPOSITORY + "/actions/runs/";
const plain = x => x !== null && typeof x === "object" && !Array.isArray(x);
const exact = (x, keys) => plain(x) && Object.keys(x).length === keys.length &&
  keys.every(k => Object.hasOwn(x, k));
const fields = Object.freeze({
  manifest: ["schemaVersion", "policyVersion", "waveId", "repository",
    "backlogCommit", "model", "autoMerge", "limits", "candidateTasks",
    "authorization"],
  limits: ["maxTaskStarts", "maxConcurrentTasks", "maxPaidRetries"],
  authorization: ["runId", "actor", "workflowRef", "sourceSha"],
  candidate: ["id", "sha256"],
  context: ["repository", "runId", "runAttempt", "actor",
    "workflowRef", "eventName", "ref", "sha", "inputs"],
  inputs: ["wave_id", "model", "max_task_starts", "auto_merge",
    "backlog_commit", "candidate_set_sha256"]
});
const outcome = (status, reason, evidence = null) => Object.freeze({
  status, reason,
  // This flag is NEVER upgraded here, even on a matching owner observation.
  authorized: false, canSign: false, canDispatch: false, canSpend: false,
  evidence: evidence === null ? null : Object.freeze(evidence)
});
const refuse = code => outcome("rejected", code);
const unknown = code => outcome("uncertain", code);

function validManifest(m) {
  if (!exact(m, fields.manifest) || m.schemaVersion !== 2 ||
      m.policyVersion !== "asf-orch-v3" ||
      m.repository !== V3_OWNER_REPOSITORY ||
      !WAVE.test(m.waveId ?? "") || !SHA.test(m.backlogCommit ?? "") ||
      !MODEL_ALLOWLIST.includes(m.model) ||
      typeof m.autoMerge !== "boolean" ||
      !exact(m.limits, fields.limits) ||
      !Number.isInteger(m.limits.maxTaskStarts) ||
      m.limits.maxTaskStarts < 1 || m.limits.maxTaskStarts > 10 ||
      m.limits.maxConcurrentTasks !== 1 ||
      m.limits.maxPaidRetries !== 0 ||
      !exact(m.authorization, fields.authorization) ||
      !RUN.test(m.authorization.runId ?? "") ||
      m.authorization.actor !== "cedricmenec" ||
      m.authorization.workflowRef !== V3_OWNER_REPOSITORY + "/" +
        V3_OWNER_ISSUER_WORKFLOW + "@refs/heads/main" ||
      m.authorization.sourceSha !== m.backlogCommit ||
      !Array.isArray(m.candidateTasks) ||
      m.candidateTasks.length < 1 || m.candidateTasks.length > 1000)
    return false;
  const used = new Set();
  for (const task of m.candidateTasks) {
    if (!exact(task, fields.candidate) || !TASK.test(task.id ?? "") ||
        !HASH.test(task.sha256 ?? "") || used.has(task.id)) return false;
    used.add(task.id);
  }
  return true;
}
function validOwnerContext(m, c) {
  if (!exact(c, fields.context) ||
      c.repository !== V3_OWNER_REPOSITORY ||
      c.runId !== m.authorization.runId ||
      c.runAttempt !== 1 || c.actor !== "cedricmenec" ||
      c.workflowRef !== m.authorization.workflowRef ||
      c.eventName !== "workflow_dispatch" ||
      c.ref !== "refs/heads/main" || c.sha !== m.backlogCommit ||
      !exact(c.inputs, fields.inputs))
    return false;
  const x = c.inputs;
  return x.wave_id === m.waveId &&
    x.model === m.model &&
    x.max_task_starts === String(m.limits.maxTaskStarts) &&
    x.auto_merge === String(m.autoMerge) &&
    x.backlog_commit === m.backlogCommit &&
    x.candidate_set_sha256 === contentSha256(m.candidateTasks);
}
function matchesGitHubRun(m, run) {
  const phase = run?.status;
  const allowed = phase === "queued" || phase === "in_progress" ||
    phase === "waiting" || phase === "pending" ||
    (phase === "completed" && run.conclusion === "success");
  return plain(run) && RUN.test(String(run.id ?? "")) &&
    String(run.id) === m.authorization.runId &&
    run.repository?.full_name === V3_OWNER_REPOSITORY &&
    run.actor?.login === "cedricmenec" &&
    run.path === V3_OWNER_ISSUER_WORKFLOW &&
    run.event === "workflow_dispatch" &&
    run.head_branch === "main" &&
    run.head_sha === m.backlogCommit &&
    run.run_attempt === 1 && allowed;
}

/**
 * Runtime adapter must construct ownerContext only from the immutable
 * GitHub runner event, not from API caller JSON or repo content.
 *
 * The GitHub Actions run API is independently consulted at EXACT run ID.
 * It does not prove the inputs or a signed owner mandate on its own.
 *
 * On a complete match the result is STILL non-authorizing, with a
 * non-sensitive hash that a future externally pinned issuer can inspect.
 */
export async function inspectV3OwnerIntent({
  manifest, ownerContext, readClient
} = {}) {
  try {
    if (!validManifest(manifest)) return refuse("manifest_contract_invalid");
    if (!validOwnerContext(manifest, ownerContext))
      return refuse("owner_inputs_not_bound_to_manifest");
  } catch { return refuse("owner_intent_contract_invalid"); }
  if (typeof readClient?.get !== "function")
    return unknown("trusted_github_reader_missing");
  let response;
  try {
    response = await readClient.get(BASE + manifest.authorization.runId);
  } catch { return unknown("owner_run_observation_failed"); }
  if (!response?.ok || !plain(response.data))
    return unknown("owner_run_observation_failed");
  if (!matchesGitHubRun(manifest, response.data))
    return refuse("owner_run_metadata_mismatch");
  return outcome("consistent_not_authorized",
    "requires_independent_owner_issuer_and_pinned_key", {
      repository: V3_OWNER_REPOSITORY,
      waveId: manifest.waveId,
      ownerRunId: manifest.authorization.runId,
      manifestHash: contentSha256(manifest),
      candidateSetHash: contentSha256(manifest.candidateTasks),
      sourceSha: manifest.backlogCommit
    });
}
