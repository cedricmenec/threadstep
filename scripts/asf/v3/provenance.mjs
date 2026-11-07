/**
 * ASF V3 read-only provenance verification, deliberately NOT a paid-call gate.
 * API results are observed via the existing read-only GitHub client, never
 * accepted from workflow inputs. Claim uniqueness and journal authorization
 * require a separate remote-CAS integration before this is usable at runtime.
 */
import { contentSha256 } from "../waves/hash.mjs";

const SHA = /^[a-f0-9]{40}$/;
const ID = /^[1-9][0-9]{0,17}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PARENT_PATH = ".github/workflows/backlog-orchestrator-v3.yml";
const CHILD_PATH = ".github/workflows/agent-openspec-v3.yml";
const BOT = "threadstep-software-factory[bot]";
const ACTIVE = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);

export const V3_PROOF_STATUS = Object.freeze({
  VERIFIED_OBSERVATION: "verified_observation",
  REJECTED: "rejected",
  UNCERTAIN: "uncertain"
});
const result = (status, code, evidence = null) =>
  Object.freeze({ ok: status === V3_PROOF_STATUS.VERIFIED_OBSERVATION, status, code,
    evidence: evidence === null ? null : Object.freeze(evidence) });
const rejected = code => result(V3_PROOF_STATUS.REJECTED, code);
const uncertain = code => result(V3_PROOF_STATUS.UNCERTAIN, code);
const id = value => String(value ?? "");
function matchRun(run, { repository, runId, path, event, actor, sha, mode }) {
  if (!run || String(run.id ?? "") !== id(runId) ||
    run.repository?.full_name !== repository ||
    run.path !== path || run.event !== event ||
    run.actor?.login !== actor || run.head_branch !== "main" ||
    run.head_sha !== sha || run.run_attempt !== 1) return false;
  if (mode === "owner" && run.status === "completed" && run.conclusion !== "success") return false;
  if (mode === "child" && !ACTIVE.has(run.status)) return false;
  if (mode === "continuation" && !ACTIVE.has(run.status)) return false;
  return true;
}

/**
 * Prove independently fetched parent and child/continuation run metadata
 * match a trusted, immutable authorization and current workflow context.
 * The reservation MUST be loaded from a CAS-verified trusted journal, not
 * from the requester. This function alone NEVER authorizes a paid step.
 *
 * client: createGithubClient({ transport: createGhTransport() }) or test stub;
 * no writes, no network retries, no lookup by mutable "latest run" labels.
 */
export async function observeV3RunProvenance(client, { authorization, reservation, context, kind }) {
  if (kind !== "child" && kind !== "continuation") return rejected("invalid_kind");
  if (!authorization || !reservation || !context) return rejected("missing_contract");
  const repository = authorization.repository;
  const owner = typeof repository === "string" ? repository.split("/")[0] : "";
  if (!REPO.test(repository ?? "") || !SHA.test(authorization.sourceSha ?? "") ||
    !ID.test(id(authorization.ownerRunId)) || authorization.owner !== owner ||
    authorization.ownerWorkflowRef !== repository + "/" + PARENT_PATH + "@refs/heads/main") {
    return rejected("invalid_origin_contract");
  }
  const expectedPath = kind === "child" ? CHILD_PATH : PARENT_PATH;
  const expectedEvent = kind === "child" ? "workflow_dispatch" : "repository_dispatch";
  if (!ID.test(id(reservation.runId)) || !SHA.test(reservation.headSha ?? "") ||
    reservation.repository !== repository || reservation.kind !== kind ||
    !ID.test(id(context.runId)) || id(context.runId) !== id(reservation.runId) ||
    context.repository !== repository || context.ref !== "refs/heads/main" ||
    context.workflowRef !== repository + "/" + expectedPath + "@refs/heads/main" ||
    context.eventName !== expectedEvent || context.actor !== BOT ||
    context.runAttempt !== 1 || id(context.runId) === id(authorization.ownerRunId)) {
    return rejected("untrusted_workflow_context");
  }
  if (!client || typeof client.get !== "function") return rejected("missing_readonly_client");
  const prefix = "repos/" + repository + "/actions/runs/";
  const parent = await client.get(prefix + id(authorization.ownerRunId));
  if (!parent?.ok || !parent.data || typeof parent.data !== "object")
    return uncertain("original_run_unavailable");
  if (!matchRun(parent.data, {
    repository, runId: authorization.ownerRunId, path: PARENT_PATH,
    event: "workflow_dispatch", actor: owner, sha: authorization.sourceSha, mode: "owner"
  })) return rejected("owner_origin_not_verified");

  const observed = await client.get(prefix + id(reservation.runId));
  if (!observed?.ok || !observed.data || typeof observed.data !== "object")
    return uncertain("child_or_controller_run_unavailable");
  if (!matchRun(observed.data, {
    repository, runId: reservation.runId, path: expectedPath,
    event: expectedEvent, actor: BOT, sha: reservation.headSha, mode: kind
  })) return rejected("run_provenance_mismatch");

  const evidence = {
    repository, kind, originalRunId: id(authorization.ownerRunId),
    verifiedRunId: id(reservation.runId), originalHeadSha: authorization.sourceSha,
    verifiedHeadSha: reservation.headSha,
    workflowPath: expectedPath, workflowEvent: expectedEvent
  };
  return result(V3_PROOF_STATUS.VERIFIED_OBSERVATION, "observed_github_run_metadata",
    { ...evidence, observationHash: contentSha256(evidence) });
}
