/**
 * ASF-V3-037: strictly offline, *synthetic* durable-intent simulation.
 * The shared store below is a fake revision-CAS implementation, NOT GitHub.
 * No token, REST call, Git ref, workflow dispatch, App scope or paid API.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
 GENESIS_STAGE,createV3GenesisAttemptPlan,advanceV3GenesisAttempt,
 replayV3GenesisAttempt,inspectV3GenesisAttempt
} from "../scripts/asf/v3/genesis-one-shot-protocol.mjs";
import {createAdmissionRegistry,ADMISSION_REGISTRY_REF}
 from "../scripts/asf/v3/global-admission.mjs";
import {contentSha256} from "../scripts/asf/waves/hash.mjs";

const SHA=c=>c.repeat(40),ORIGIN=SHA("a"),TREE=SHA("b"),COMMIT=SHA("c");
const OWNER_RUN="88312";
const emptyHash=contentSha256(createAdmissionRegistry());
const intent=()=>({type:"BEGIN_CREATE_ATTEMPT",
 commitSha:COMMIT,globalRef:ADMISSION_REGISTRY_REF,ownerRunId:OWNER_RUN});
const noAuthority=x=>{
 for(const key of ["authorized","canCreate","canWrite","canDispatch",
  "canSpend","canRetry"])assert.equal(x[key],false,key);
};
/**
 * A shared, persistent store mimics transactional compare-and-swap.
 * It intentionally cannot prove GitHub ref protection, atomicity or scope.
 */
function fakeDurableStore(){
 let disk=JSON.stringify(createV3GenesisAttemptPlan({
  ownerRunId:OWNER_RUN,originSha:ORIGIN
 }));
 return {
  read:()=>JSON.parse(disk),
  transition:(event,expectedRevision)=>{
   const current=replayV3GenesisAttempt(JSON.parse(disk));
   if(current.revision!==expectedRevision)
    throw Object.assign(Error("fake_durable_revision_conflict"),{
     code:"revision_conflict"
    });
   const next=advanceV3GenesisAttempt(current,event,expectedRevision);
   disk=JSON.stringify(next);
   return JSON.parse(disk);
  },
  corrupt:value=>{disk=JSON.stringify(value);}
 };
}
function stageCommit(store){
 let r=store.read();
 r=store.transition({type:"TREE_STAGED",treeSha:TREE},r.revision);
 r=store.transition({type:"COMMIT_STAGED",commitSha:COMMIT,
  treeSha:TREE,parentSha:ORIGIN},r.revision);
 return r;
}
test("persist BEGIN_CREATE_ATTEMPT before synthetic network request",()=>{
 const store=fakeDurableStore(),prepared=stageCommit(store);
 const recorded=store.transition(intent(),prepared.revision);
 assert.equal(recorded.stage,GENESIS_STAGE.CREATE_ATTEMPT_RECORDED);
 assert.equal(recorded.createAttemptCount,1);
 assert.equal(replayV3GenesisAttempt(store.read()).revision,3);
 // A second process sees the recorded intent, never an unattempted plan.
 assert.throws(()=>store.transition(intent(),store.read().revision),{
  code:"one_shot_create_guard_refused"
 });
 noAuthority(inspectV3GenesisAttempt(store.read()));
});
test("lost CREATE response, process restart and second mandate cannot replay CREATE",()=>{
 const store=fakeDurableStore();stageCommit(store);
 const sent=[];
 const firstRunner=store.read();
 store.transition(intent(),firstRunner.revision); // DURABLE before network
 sent.push({method:"SIMULATED_CREATE",commitSha:COMMIT});
 // The fake network response is lost after the simulated request was sent.
 const nextProcess=store.read();
 assert.equal(nextProcess.stage,GENESIS_STAGE.CREATE_ATTEMPT_RECORDED);
 assert.throws(()=>store.transition(intent(),nextProcess.revision),{
  code:"one_shot_create_guard_refused"
 });
 const quarantined=store.transition({type:"MARK_UNKNOWN",
  reason:"lost_response"},nextProcess.revision);
 assert.equal(quarantined.stage,GENESIS_STAGE.QUARANTINED);
 assert.equal(quarantined.createAttemptCount,1);
 assert.equal(sent.length,1);
 assert.throws(()=>store.transition(intent(),quarantined.revision),{
  code:"one_shot_create_guard_refused"
 });
 noAuthority(inspectV3GenesisAttempt(store.read()));
});
test("two stale runner snapshots competing for same intent: only one durable CAS",async()=>{
 const store=fakeDurableStore();stageCommit(store);
 const [runnerA,runnerB]=[store.read(),store.read()];
 const won=[];
 // Deliberately schedule two independent actors on the same old revision.
 const [a,b]=await Promise.allSettled([
  Promise.resolve().then(()=>store.transition(intent(),runnerA.revision)),
  Promise.resolve().then(()=>store.transition(intent(),runnerB.revision))
 ]);
 for(const r of [a,b])if(r.status==="fulfilled")won.push(r.value);
 assert.equal(won.length,1);
 assert.equal([a,b].filter(x=>x.status==="rejected" &&
  x.reason?.code==="revision_conflict").length,1);
 assert.equal(store.read().createAttemptCount,1);
 noAuthority(inspectV3GenesisAttempt(store.read()));
});
test("ack and readback cannot override one-shot persistence or authorize payment",()=>{
 const store=fakeDurableStore();stageCommit(store);
 let s=store.transition(intent(),store.read().revision);
 s=store.transition({type:"CREATE_ACK",commitSha:COMMIT,
  globalRef:ADMISSION_REGISTRY_REF},s.revision);
 s=store.transition({type:"READBACK_MATCH",commitSha:COMMIT,
  globalRef:ADMISSION_REGISTRY_REF,originSha:ORIGIN,
  registryHash:emptyHash},s.revision);
 assert.equal(s.stage,GENESIS_STAGE.VERIFIED_OBSERVED);
 assert.equal(s.createAttemptCount,1);
 assert.throws(()=>store.transition(intent(),s.revision),{
  code:"one_shot_create_guard_refused"
 });
 const observation=inspectV3GenesisAttempt(store.read());
 assert.equal(observation.reason,"simulated_readback_observed_not_authorized");
 noAuthority(observation);
});
test("tampered persisted counters or event history require manual investigation",()=>{
 const store=fakeDurableStore();stageCommit(store);
 store.transition(intent(),store.read().revision);
 const good=store.read();
 for(const corrupted of [
  {...good,createAttemptCount:0},
  {...good,revision:99},
  {...good,events:good.events.slice(1)},
  {...good,ownerRunId:"88313"}
 ]){
  store.corrupt(corrupted);
  assert.throws(()=>replayV3GenesisAttempt(store.read()));
  const observation=inspectV3GenesisAttempt(store.read());
  assert.equal(observation.status,"rejected");
  noAuthority(observation);
 }
});
