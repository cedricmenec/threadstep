import test from "node:test";
import assert from "node:assert/strict";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { createV3Manifest, createV3Journal, advanceV3 }
  from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry, advanceAdmissionRegistry }
  from "../scripts/asf/v3/global-admission.mjs";
import { inspectV3GithubTerminalCandidate }
  from "../scripts/asf/v3/global-terminal-evidence.mjs";

const SHA = c => c.repeat(40);
function fixture() {
 const manifest=createV3Manifest({
  waveId:"wave-terminal-native",repository:"cedricmenec/threadstep",
  backlogCommit:SHA("a"),model:"openrouter/deepseek/deepseek-v4.1-flash",
  autoMerge:false,maxTaskStarts:3,
  candidateTasks:[{id:"TS-001",sha256:"f".repeat(64)}],
  authorization:{runId:"50001",actor:"cedricmenec",
   workflowRef:"cedricmenec/threadstep/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
   sourceSha:SHA("a")}
 });
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),
  {type:"ADMIT",claim:{waveId:manifest.waveId,
   manifestHash:contentSha256(manifest),ownerRunId:"50001",originSha:SHA("a")}},0);
 return {manifest,registry,journal:createV3Journal(manifest)};
}
const check = x => {
 for(const k of ["authorized","canRelease","canQuarantine","canDispatch","canSpend"])
  assert.equal(x[k],false);
};
const req=(f,journal,kind="RELEASE",reason="nominal_delivery")=>({
 registry:f.registry,manifest:f.manifest,journal,
 globalHeadSha:SHA("1"),waveHeadSha:SHA("2"),
 deliveryEvidenceHash:"3".repeat(64),kind,reason
});
test("nominal no-work terminal proposes release but never grants Git writer rights",()=>{
 const f=fixture();
 const j=advanceV3(f.manifest,f.journal,{type:"COMPLETE_NO_WORK"},0);
 const r=inspectV3GithubTerminalCandidate(req(f,j));
 assert.equal(r.status,"consistent_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.kind,"RELEASE");
 assert.equal(r.evidence.proposedRevision,2);
 assert.equal(r.evidence.proposedEvent.type,"RELEASE");
 check(r);
});
test("failed or uncertain wave can only propose quarantine, never reopen register",()=>{
 const f=fixture();
 const j=advanceV3(f.manifest,f.journal,
  {type:"STOP_UNCERTAIN",reason:"ambiguous_dispatch"},0);
 const q=inspectV3GithubTerminalCandidate(req(f,j,
  "QUARANTINE","owner_diagnostic_required"));
 assert.equal(q.status,"consistent_not_authorized",JSON.stringify(q));
 assert.equal(q.evidence.proposedEvent.type,"QUARANTINE");
 check(q);
 const release=inspectV3GithubTerminalCandidate(req(f,j));
 assert.equal(release.status,"rejected");check(release);
});
test("a READY wave cannot release or quarantine",()=>{
 const f=fixture();
 for(const kind of ["RELEASE","QUARANTINE"]){
  const r=inspectV3GithubTerminalCandidate(req(f,f.journal,kind,
   kind==="RELEASE"?"nominal_delivery":"incident_owner_review"));
  assert.equal(r.status,"rejected");check(r);
 }
});
test("stale global head, wave head, or missing evidence hash rejects release",()=>{
 const f=fixture();
 const j=advanceV3(f.manifest,f.journal,{type:"COMPLETE_NO_WORK"},0);
 for(const patch of [
  {globalHeadSha:"bad"},{waveHeadSha:"bad"},
  {deliveryEvidenceHash:"wrong"},{reason:"operator_claim"},
  {kind:"FORCE_RELEASE"}
 ]){
  const r=inspectV3GithubTerminalCandidate({...req(f,j),...patch});
  assert.equal(r.status,"rejected",JSON.stringify(patch));
  check(r);
 }
});
test("tampered journal counters, manifest or registry refuse terminal",()=>{
 const f=fixture();
 const j=advanceV3(f.manifest,f.journal,{type:"COMPLETE_NO_WORK"},0);
 for(const patch of [
  {journal:{...j,delivered:99}},
  {manifest:{...f.manifest,repository:"attacker/repo"}},
  {registry:{...f.registry,revision:77}},
  {registry:{...f.registry,active:{...f.registry.active,waveId:"some-other-wave"}}}
 ]){
  const r=inspectV3GithubTerminalCandidate({...req(f,j),...patch});
  assert.equal(r.status,"rejected",JSON.stringify(patch));
  check(r);
 }
});
test("a caller-controlled hash is NOT trusted independent delivery evidence",()=>{
 const f=fixture();
 const j=advanceV3(f.manifest,f.journal,{type:"COMPLETE_NO_WORK"},0);
 const result=inspectV3GithubTerminalCandidate(req(f,j));
 assert.equal(result.status,"consistent_not_authorized");
 assert.equal(result.reason,"requires_trusted_github_delivery_observer_and_global_cas");
 assert.equal(result.evidence.deliveryEvidenceHash,"3".repeat(64));
 check(result);
});
