import test from "node:test";
import assert from "node:assert/strict";
import {
 GENESIS_STAGE,createV3GenesisAttemptPlan,
 advanceV3GenesisAttempt,replayV3GenesisAttempt,inspectV3GenesisAttempt
} from "../scripts/asf/v3/genesis-one-shot-protocol.mjs";
import { createAdmissionRegistry,ADMISSION_REGISTRY_REF }
 from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
const S=c=>c.repeat(40),ORIGIN=S("a"),TREE=S("b"),COMMIT=S("c");
const plan=()=>createV3GenesisAttemptPlan({
 ownerRunId:"88312",originSha:ORIGIN
});
const add=(s,event)=>advanceV3GenesisAttempt(s,event,s.revision);
function prepared(){
 let s=plan();
 s=add(s,{type:"TREE_STAGED",treeSha:TREE});
 s=add(s,{type:"COMMIT_STAGED",commitSha:COMMIT,
  treeSha:TREE,parentSha:ORIGIN});
 return s;
}
const begin=s=>add(s,{type:"BEGIN_CREATE_ATTEMPT",
 commitSha:COMMIT,globalRef:ADMISSION_REGISTRY_REF});
const ack=s=>add(s,{type:"CREATE_ACK",commitSha:COMMIT,
 globalRef:ADMISSION_REGISTRY_REF});
const match=s=>add(s,{type:"READBACK_MATCH",commitSha:COMMIT,
 globalRef:ADMISSION_REGISTRY_REF,originSha:ORIGIN,
 registryHash:contentSha256(createAdmissionRegistry())});
const rejectCreate=(s)=>assert.throws(()=>begin(s),{
 code:"one_shot_create_guard_refused"
});
const noRights=r=>{
 for(const key of ["authorized","canCreate","canWrite",
  "canDispatch","canSpend","canRetry"])
  assert.equal(r[key],false,key);
};
test("genesis stages tree/commit with pinned source, records exactly one attempt",()=>{
 let s=prepared();
 assert.equal(s.stage,GENESIS_STAGE.COMMIT_STAGED);
 assert.equal(s.createAttemptCount,0);
 s=begin(s);
 assert.equal(s.stage,GENESIS_STAGE.CREATE_ATTEMPT_RECORDED);
 assert.equal(s.createAttemptCount,1);
 assert.equal(s.revision,3);
 rejectCreate(s);
 noRights(inspectV3GenesisAttempt(s));
});
test("acknowledged creation plus independently verified readback remains nonauthorizing",()=>{
 const s=match(ack(begin(prepared())));
 assert.equal(s.stage,GENESIS_STAGE.VERIFIED_OBSERVED);
 assert.equal(s.createAttemptCount,1);
 assert.equal(s.events.length,5);
 assert.deepEqual(replayV3GenesisAttempt(JSON.parse(JSON.stringify(s))),s);
 const result=inspectV3GenesisAttempt(s);
 assert.equal(result.status,GENESIS_STAGE.VERIFIED_OBSERVED);
 assert.equal(result.reason,"simulated_readback_observed_not_authorized");
 assert.equal(result.evidence.stagedCommitSha,COMMIT);
 noRights(result);
 rejectCreate(s);
});
test("lost response after first creation intent quarantines without retry",()=>{
 for(const reason of ["lost_response","timeout","transport_error",
 "conflict","unexpected_response"]){
  let s=begin(prepared());
  s=add(s,{type:"MARK_UNKNOWN",reason});
  assert.equal(s.stage,GENESIS_STAGE.QUARANTINED);
  assert.equal(s.createAttemptCount,1);
  assert.equal(inspectV3GenesisAttempt(s).reason,"manual_diagnosis_no_retry");
  rejectCreate(s);
  assert.throws(()=>ack(s),{code:"create_ack_unverified"});
  assert.throws(()=>add(s,{type:"ABORT_BEFORE_CREATE",
   reason:"operator_stop"}),{code:"abort_after_create_not_allowed"});
  noRights(inspectV3GenesisAttempt(s));
 }
});
test("post-ACK readback can quarantine but not restart or recreate",()=>{
 let s=ack(begin(prepared()));
 s=add(s,{type:"MARK_UNKNOWN",reason:"readback_mismatch"});
 assert.equal(s.stage,GENESIS_STAGE.QUARANTINED);
 assert.equal(s.createAttemptCount,1);
 rejectCreate(s);
 assert.throws(()=>match(s),{code:"readback_not_identical"});
 noRights(inspectV3GenesisAttempt(s));
});
test("abort before create may stop and never be resumed",()=>{
 for(const stage of [plan(),add(plan(),{type:"TREE_STAGED",
  treeSha:TREE}),prepared()]){
  const s=add(stage,{type:"ABORT_BEFORE_CREATE",
   reason:"rules_unverified"});
  assert.equal(s.stage,GENESIS_STAGE.STOPPED);
  assert.equal(s.createAttemptCount,0);
  assert.throws(()=>add(s,{type:"TREE_STAGED",treeSha:TREE}));
  rejectCreate(s);
  noRights(inspectV3GenesisAttempt(s));
 }
});
test("bad origin, ref or registry hash fails to form an attempt plan",()=>{
 for(const patch of [
  {ownerRunId:"0"},{ownerRunId:"-1"},{originSha:S("f").slice(1)},
  {globalRef:"refs/heads/main"},
  {globalRef:"refs/heads/asf/waves/attacker"},
  {initialRegistryHash:"0".repeat(64)}
 ]){
  assert.throws(()=>createV3GenesisAttemptPlan({
   ownerRunId:"88312",originSha:ORIGIN,...patch
  }),{code:"invalid_pinned_genesis_plan"});
 }
});
test("commit must bind exact first staged tree and source parent",()=>{
 for(const e of [
  {type:"COMMIT_STAGED",commitSha:COMMIT,treeSha:S("e"),parentSha:ORIGIN},
  {type:"COMMIT_STAGED",commitSha:COMMIT,treeSha:TREE,parentSha:S("e")},
  {type:"COMMIT_STAGED",commitSha:"oops",treeSha:TREE,parentSha:ORIGIN},
  {type:"COMMIT_STAGED",commitSha:COMMIT,treeSha:TREE,
   parentSha:ORIGIN,foreign:true}
 ]){
  const s=add(plan(),{type:"TREE_STAGED",treeSha:TREE});
  assert.throws(()=>add(s,e),{code:"commit_stage_refused"});
 }
});
test("readback cannot claim another registry, global ref, origin or commit",()=>{
 for(const patch of [
  {registryHash:"f".repeat(64)},
  {globalRef:"refs/heads/main"},
  {originSha:S("d")},
  {commitSha:S("e")}
 ]){
  const s=ack(begin(prepared()));
  assert.throws(()=>add(s,{type:"READBACK_MATCH",
   commitSha:COMMIT,globalRef:ADMISSION_REGISTRY_REF,
   originSha:ORIGIN,registryHash:contentSha256(createAdmissionRegistry()),
   ...patch
  }),{code:"readback_not_identical"});
 }
});
test("replay detects hidden duplicate writes, counters, seq and historical edits",()=>{
 const s=match(ack(begin(prepared())));
 for(const bad of [
  {...s,createAttemptCount:0},
  {...s,revision:999},
  {...s,stage:GENESIS_STAGE.PLAN},
  {...s,commitSha:S("e")},
  {...s,events:s.events.map((e,i)=>i===2?{...e,seq:2}:e)},
  {...s,events:s.events.slice(1)},
  {...s,ownerRunId:"88313"}
 ]){
  assert.throws(()=>replayV3GenesisAttempt(bad));
  noRights(inspectV3GenesisAttempt(bad));
  assert.equal(inspectV3GenesisAttempt(bad).status,"rejected");
 }
});
test("local revision compare refuses sibling or stale transition snapshots",()=>{
 const s=prepared();
 assert.throws(()=>advanceV3GenesisAttempt(s,{
  type:"BEGIN_CREATE_ATTEMPT",commitSha:COMMIT,
  globalRef:ADMISSION_REGISTRY_REF},s.revision-1),{
  code:"revision_conflict"
 });
 const t=begin(s);
 assert.equal(t.createAttemptCount,1);
 assert.equal(s.createAttemptCount,0);
 assert.ok(Object.isFrozen(s));
 assert.ok(Object.isFrozen(t));
 assert.ok(Object.isFrozen(t.events)&&t.events.every(Object.isFrozen));
});
test("unknown event, invalid secret fields and extra event keys are always refused",()=>{
 const s=prepared();
 for(const event of [
  {type:"CREATE_REF_AGAIN"},
  {type:"BEGIN_CREATE_ATTEMPT",commitSha:COMMIT,
   globalRef:ADMISSION_REGISTRY_REF,token:"github_pat_should_not_be_here"},
  {type:"BEGIN_CREATE_ATTEMPT",commitSha:COMMIT,
   globalRef:ADMISSION_REGISTRY_REF,unauthorized:true},
  {type:"MARK_UNKNOWN",reason:"timeout"},
  {type:"READBACK_MATCH",commitSha:COMMIT}
 ]){
  assert.throws(()=>add(s,event));
 }
 noRights(inspectV3GenesisAttempt(s));
});
