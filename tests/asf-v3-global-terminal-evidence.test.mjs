import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { createV3Manifest, createV3Journal, advanceV3 }
  from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry, advanceAdmissionRegistry }
  from "../scripts/asf/v3/global-admission.mjs";
import { inspectV3GlobalTerminalCandidate, v3GlobalTerminalSigningBytes,
  verifyV3GlobalTerminalPermit } from "../scripts/asf/v3/global-terminal-evidence.mjs";

const SHA = c => c.repeat(40);
const candidate = () => {
  const manifest = createV3Manifest({
    waveId:"wave-terminal-012",repository:"cedricmenec/threadstep",
    backlogCommit:SHA("a"),model:"openrouter/deepseek/deepseek-v4.1-flash",
    autoMerge:false,maxTaskStarts:3,
    candidateTasks:[{id:"TS-001",sha256:"f".repeat(64)}],
    authorization:{
      runId:"50001",actor:"cedricmenec",
      workflowRef:"cedricmenec/threadstep/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
      sourceSha:SHA("a")
    }
  });
  const registry = advanceAdmissionRegistry(createAdmissionRegistry(),
    {type:"ADMIT",claim:{
      waveId:manifest.waveId,manifestHash:contentSha256(manifest),
      ownerRunId:"50001",originSha:SHA("a")
    }},0);
  const journal = createV3Journal(manifest);
  const keys = generateKeyPairSync("ed25519");
  return {manifest,registry,journal,keys};
};
function signed(state, journal, kind, reason, key = state.keys.privateKey) {
  const payload = {
    version:1,purpose:"asf-v3-single-global-terminal",
    repository:"cedricmenec/threadstep",kind,
    waveId:state.manifest.waveId,manifestHash:contentSha256(state.manifest),
    globalHeadSha:SHA("1"),waveHeadSha:SHA("2"),
    journalHash:contentSha256(journal),observationHash:"3".repeat(64),
    reason
  };
  const permit={payload,signature:
    sign(null,v3GlobalTerminalSigningBytes(payload),key).toString("base64")};
  return {registry:state.registry,manifest:state.manifest,journal,
    globalHeadSha:SHA("1"),waveHeadSha:SHA("2"),
    observationHash:"3".repeat(64),reason,permit,
    verificationKey:state.keys.publicKey};
}
const noRights = res => {
  for(const name of ["authorized","canRelease","canQuarantine","canSpend","canDispatch"])
    assert.equal(res[name],false);
};
test("COMPLETE_NO_WORK can produce signed RELEASE proposal but never authorization",()=>{
  const s=candidate();
  const journal=advanceV3(s.manifest,s.journal,{type:"COMPLETE_NO_WORK"},0);
  const p=signed(s,journal,"RELEASE","nominal_delivery");
  const result=inspectV3GlobalTerminalCandidate(p);
  assert.equal(result.status,"consistent_not_authorized",JSON.stringify(result));
  assert.equal(result.evidence.kind,"RELEASE");
  assert.equal(result.evidence.proposedRevision,2);
  noRights(result);
});
test("stopped uncertain wave can produce signed QUARANTINE proposal, no auto-release",()=>{
  const s=candidate();
  const journal=advanceV3(s.manifest,s.journal,
    {type:"STOP_UNCERTAIN",reason:"ambiguous_dispatch"},0);
  const p=signed(s,journal,"QUARANTINE","owner_diagnostic_required");
  const result=inspectV3GlobalTerminalCandidate(p);
  assert.equal(result.status,"consistent_not_authorized",JSON.stringify(result));
  assert.equal(result.evidence.kind,"QUARANTINE");
  noRights(result);
  const asRelease=inspectV3GlobalTerminalCandidate(
    signed(s,journal,"RELEASE","nominal_delivery"));
  assert.equal(asRelease.status,"rejected");
  noRights(asRelease);
});
test("a terminal record that is not yet stopped cannot QUARANTINE using this path",()=>{
  const s=candidate();
  const r=inspectV3GlobalTerminalCandidate(
    signed(s,s.journal,"QUARANTINE","owner_diagnostic_required"));
  assert.equal(r.code,"quarantine_requires_stopped_wave");
});
test("foreign key, wrong commit, wrong observation hash or mismatched reason is rejected",()=>{
  const s=candidate();
  const j=advanceV3(s.manifest,s.journal,{type:"COMPLETE_NO_WORK"},0);
  const proposal=signed(s,j,"RELEASE","nominal_delivery");
  for(const modified of [
    {...proposal,verificationKey:generateKeyPairSync("ed25519").publicKey},
    {...proposal,globalHeadSha:SHA("4")},
    {...proposal,waveHeadSha:SHA("4")},
    {...proposal,observationHash:"f".repeat(64)},
    {...proposal,reason:"owner_diagnostic_required"},
    {...proposal,permit:{...proposal.permit,signature:"no"}},
    {...proposal,permit:{...proposal.permit,payload:{...proposal.permit.payload,kind:"QUARANTINE"}}}
  ]){
    const r=inspectV3GlobalTerminalCandidate(modified);
    assert.equal(r.status,"rejected");
    noRights(r);
  }
});
test("a forged wave count or fabricated journal is rejected by full replay",()=>{
  const s=candidate();
  const j=advanceV3(s.manifest,s.journal,{type:"COMPLETE_NO_WORK"},0);
  const tampered={...j,delivered:2,reserved:2};
  const r=inspectV3GlobalTerminalCandidate(signed(s,tampered,"RELEASE","nominal_delivery"));
  assert.equal(r.code,"manifest_or_journal_replay_invalid");
  noRights(r);
});
test("quarantine signature is bound to stop reason and fails if forged",()=>{
  const s=candidate();
  const j=advanceV3(s.manifest,s.journal,
    {type:"STOP_FAILED",reason:"cancelled_after_claim"},0);
  const p=signed(s,j,"QUARANTINE","incident_owner_review");
  assert.equal(verifyV3GlobalTerminalPermit({...p.permit,verificationKey:s.keys.publicKey}),true);
  assert.equal(inspectV3GlobalTerminalCandidate(p).status,"consistent_not_authorized");
  assert.equal(inspectV3GlobalTerminalCandidate({...p,reason:"another_reason"}).status,"rejected");
});
test("wrong wave active and unsigned global release cannot pass",()=>{
  const s=candidate();
  const j=advanceV3(s.manifest,s.journal,{type:"COMPLETE_NO_WORK"},0);
  const p=signed(s,j,"RELEASE","nominal_delivery");
  const bad={...s.registry,active:{...s.registry.active,waveId:"different-wave"}};
  const r=inspectV3GlobalTerminalCandidate({...p,registry:bad});
  assert.equal(r.status,"rejected");
  noRights(r);
});
test("a valid signing key and synthetic observer hash NEVER prove independent delivery",()=>{
  const s=candidate();
  const j=advanceV3(s.manifest,s.journal,{type:"COMPLETE_NO_WORK"},0);
  const p=signed(s,j,"RELEASE","nominal_delivery");
  const r=inspectV3GlobalTerminalCandidate(p);
  assert.equal(r.status,"consistent_not_authorized");
  noRights(r);
  assert.equal(Object.hasOwn(r.evidence,"signedIssuerAuthorized"),false);
});
