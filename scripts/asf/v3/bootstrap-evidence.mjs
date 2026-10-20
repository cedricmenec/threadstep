/**
 * ASF-V3-007: compare candidate wave genesis evidence WITHOUT converting
 * forgeable Git metadata into authorization. All arguments are observations;
 * no API read, signed attestation or paid-call capability is implemented here.
 */
import { contentSha256 } from "../waves/hash.mjs";
const HEX40 = /^[a-f0-9]{40}$/;
const ID = /^[1-9]\d{0,17}$/;
const WORKFLOW = ".github/workflows/backlog-orchestrator-v3.yml";
export const GENESIS_DECISION = Object.freeze({
  REJECT: "REJECT", CONSISTENT_BUT_UNANCHORED: "CONSISTENT_BUT_UNANCHORED"
});
const answer = (decision, reason, evidence = null) => Object.freeze({
  ok: false, decision, reason,
  evidence: evidence ? Object.freeze(evidence) : null,
  next: decision === "CONSISTENT_BUT_UNANCHORED" ?
    "REQUIRE_INDEPENDENT_TRUSTED_GENESIS_ANCHOR" : "STOP"
});
const deny = reason => answer(GENESIS_DECISION.REJECT, reason);
function validRun(run, manifest) {
  return run && String(run.id ?? "") === String(manifest.authorization?.runId) &&
    ID.test(String(run.id ?? "")) &&
    run.repository?.full_name === manifest.repository &&
    run.actor?.login === manifest.authorization.actor &&
    run.actor?.login === manifest.repository.split("/")[0] &&
    run.path === WORKFLOW &&
    run.event === "workflow_dispatch" &&
    run.head_branch === "main" &&
    run.head_sha === manifest.backlogCommit &&
    run.run_attempt === 1 &&
    !(run.status === "completed" && run.conclusion !== "success");
}
/**
 * Even a matching owner run + commit author does NOT bind the genesis of a new
 * Git ref to that workflow. Commit author fields are forgeable; the missing
 * anchored proof must come from a separately trusted writer/immutable log.
 */
export function assessV3GenesisCandidate({ manifest, originRun, genesis } = {}) {
  if (!manifest || manifest.schemaVersion !== 2 ||
    manifest.policyVersion !== "asf-orch-v3" ||
    !HEX40.test(manifest.backlogCommit ?? "") ||
    manifest.authorization?.actor !== manifest.repository?.split("/")[0] ||
    manifest.authorization?.workflowRef !==
      manifest.repository + "/" + WORKFLOW + "@refs/heads/main" ||
    manifest.authorization?.sourceSha !== manifest.backlogCommit)
    return deny("invalid_manifest_mandate");
  if (!validRun(originRun, manifest))
    return deny("original_owner_run_not_observed");
  const manifestHash = contentSha256(manifest);
  if (!genesis || !HEX40.test(genesis.sha ?? "") ||
    genesis.ref !== "refs/heads/asf/waves/" + manifest.waveId ||
    genesis.manifestHash !== manifestHash ||
    !Array.isArray(genesis.parents) ||
    genesis.parents.length !== 1 ||
    genesis.parents[0] !== manifest.backlogCommit ||
    !Array.isArray(genesis.paths) ||
    genesis.paths.length !== 2 ||
    JSON.stringify([...genesis.paths].sort()) !==
      JSON.stringify(["journal.json", "manifest.json"]))
    return deny("genesis_commit_or_files_mismatch");
  return answer(GENESIS_DECISION.CONSISTENT_BUT_UNANCHORED,
    "git_commit_author_is_not_trusted_owner_attestation", {
      waveId: manifest.waveId, manifestHash,
      ownerRunId: String(originRun.id), genesisSha: genesis.sha
    });
}
