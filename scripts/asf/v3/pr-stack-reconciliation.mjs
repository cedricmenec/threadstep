/**
 * ASF-V3-029 — inspect a proposed PR-stack consolidation. This function
 * NEVER authorizes merging, privileged writes or paid task starts.
 * The alternate ACK/CLAIM code remains unmerged pending explicit wave
 * ruleset enforcement and a dedicated, reviewed integration decision.
 */
export const ASF_V3_CANONICAL_STACK = Object.freeze([109,111,112,113,120,122]);
export const ASF_V3_ALTERNATE_STACK = Object.freeze([109,116,117]);
const expected = Object.freeze({
  109: ["feat/asf-v3-023-child-ack-readonly", "feat/asf-v3-022-terminal-git-cas"],
  111: ["feat/asf-v3-024-child-ack-claim-wave-cas","feat/asf-v3-023-child-ack-readonly"],
  112: ["feat/asf-v3-025-shared-paid-mutex-readiness","feat/asf-v3-024-child-ack-claim-wave-cas"],
  113: ["feat/asf-v3-026-wave-ruleset-preflight","feat/asf-v3-025-shared-paid-mutex-readiness"],
  120: ["docs/asf-v3-027-mutex-concurrency-qualification","feat/asf-v3-026-wave-ruleset-preflight"],
  122: ["test/asf-v3-028-isolated-paid-mutex-lab","docs/asf-v3-027-mutex-concurrency-qualification"],
  116: ["feat/asf-v3-024-ack-child-wave-cas","feat/asf-v3-023-child-ack-readonly"],
  117: ["feat/asf-v3-025-child-claim-cas","feat/asf-v3-024-ack-child-wave-cas"]
});
const sha=/^[a-f0-9]{40}$/;
const no=(status,reason,details=null)=>Object.freeze({
  status,reason,authorized:false,canMerge:false,canWrite:false,
  canActivate:false,canSpend:false,canRetry:false,
  evidence:details===null?null:Object.freeze(details)
});
const reject=reason=>no("rejected",reason);
const unknown=reason=>no("uncertain",reason);
const files=Object.freeze({
  111:"scripts/asf/v3/github-native-child-wave-cas.mjs",
  112:"scripts/asf/v3/github-native-paid-mutex-readiness.mjs",
  113:"scripts/asf/v3/github-native-wave-ruleset.mjs",
  116:"scripts/asf/v3/child-ack-cas.mjs",
  117:"scripts/asf/v3/child-claim-cas.mjs"
});
const sensitiveTasks=["docs/factory/tasks/ASF-V3-024.md",
  "docs/factory/tasks/ASF-V3-025.md"];
export function inspectAsfV3PrStackReconciliation(prs) {
  if(!prs||typeof prs!=="object"||Array.isArray(prs)||
     Object.keys(prs).sort().join(",")!==
       Object.keys(expected).sort().join(","))
    return reject("incomplete_or_unexpected_pr_set");
  for(const [id,[head,base]] of Object.entries(expected)) {
    const p=prs[id];
    if(!p||typeof p!=="object"||Array.isArray(p)||
       p.number!==Number(id)||p.head!==head||p.base!==base||
       !sha.test(p.headSha??"")||p.state!=="open"||p.draft!==true)
      return unknown("pr_snapshot_identity_or_draft_changed_"+id);
    if(!Array.isArray(p.paths)||p.paths.length<1||
       new Set(p.paths).size!==p.paths.length||
       p.paths.some(s=>typeof s!=="string"||s.length>250||
         s.startsWith("/")||s.includes("..")))
      return reject("malformed_changed_file_inventory_"+id);
  }
  for(const [id,file] of Object.entries(files))
    if(!prs[id].paths.includes(file))
      return reject("missing_expected_pr_artifact_"+id);
  const sharedAncestor=109;
  if(prs[116].base!==prs[111].base||
     prs[117].base!==prs[116].head)
    return reject("parallel_branch_ancestry_invalid");
  const duplicatePaths=sensitiveTasks.filter(path=>
    [111,112].some(n=>prs[n].paths.includes(path))&&
    [116,117].some(n=>prs[n].paths.includes(path)));
  if(duplicatePaths.length!==2)
    return reject("task_id_collision_inventory_changed");
  return no("reconciliation_plan_observed_not_authorized",
    "alternate_writer_ports_need_wave_ruleset_guard_and_integration_review",{
      canonicalPrs:Object.freeze([...ASF_V3_CANONICAL_STACK]),
      alternatePrs:Object.freeze([...ASF_V3_ALTERNATE_STACK]),
      commonAncestorPr:sharedAncestor,
      duplicateTaskPaths:Object.freeze(duplicatePaths),
      selectedIntegrationBasePr:122,
      canonicalCasPr:111,
      canonicalWaveProtectionPr:113,
      canonicalPaidMutexPr:112,
      alternateAckPr:116,alternateClaimPr:117,
      alternateApprovedForMerge:false,
      alternateWritersCoveredByWaveRuleset:false,
      permissionsAndLiveCasVerified:false
  });
}
