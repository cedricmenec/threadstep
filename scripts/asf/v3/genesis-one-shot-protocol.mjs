/**
 * ASF-V3-020 — PURE protocol model for one-shot GitHub global genesis.
 *
 * This module contains no REST transport, file I/O, token, webhook or write
 * capability. Its inputs and acknowledgements are NOT authenticated GitHub
 * evidence. It models which transitions a separately owner-approved and
 * independently authenticated future writer must persist and respect.
 *
 * The begin-create event must be durably recorded by that future writer
 * BEFORE the network request. An in-memory model alone does NOT guarantee
 * exactly-once execution across crashes, new runs, or distributed workers.
 */
import { createAdmissionRegistry, ADMISSION_REGISTRY_REF }
 from "./global-admission.mjs";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
import { findSecretPaths } from "../waves/secrets.mjs";

export const GENESIS_PROTOCOL_SCHEMA=1;
export const GENESIS_STAGE=Object.freeze({
 PLAN:"PLAN",TREE_STAGED:"TREE_STAGED",COMMIT_STAGED:"COMMIT_STAGED",
 CREATE_ATTEMPT_RECORDED:"CREATE_ATTEMPT_RECORDED",
 ACKNOWLEDGED:"ACKNOWLEDGED",VERIFIED_OBSERVED:"VERIFIED_OBSERVED",
 QUARANTINED:"QUARANTINED",STOPPED:"STOPPED"
});
const SHA=/^[a-f0-9]{40}$/,RUN=/^[1-9]\d{0,17}$/,HEX=/^[a-f0-9]{64}$/;
const ALLOWED_STOP=new Set([
 "operator_stop","rules_unverified","owner_run_unverified",
 "origin_moved","registry_exists","invalid_responses"
]);
const ALLOWED_UNKNOWN=new Set([
 "lost_response","timeout","transport_error","conflict",
 "unexpected_response","readback_mismatch","operator_quarantine"
]);
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
function insist(ok,code){
 if(!ok)throw Object.assign(Error("ASF V3 genesis protocol: "+code),{code});
}
function frozen(x){
 if(x&&typeof x==="object"&&!Object.isFrozen(x)){
  for(const v of Object.values(x))frozen(v);
  Object.freeze(x);
 }
 return x;
}
const rootFields=["schemaVersion","ownerRunId","originSha","globalRef",
 "initialRegistryHash","stage","treeSha","commitSha",
 "createAttemptCount","revision","events"];
export function createV3GenesisAttemptPlan({
 ownerRunId,originSha,globalRef=ADMISSION_REGISTRY_REF,
 initialRegistryHash=contentSha256(createAdmissionRegistry())
}={}){
 insist(RUN.test(ownerRunId??"")&&SHA.test(originSha??"")&&
   globalRef===ADMISSION_REGISTRY_REF&&
   HEX.test(initialRegistryHash??"")&&
   initialRegistryHash===contentSha256(createAdmissionRegistry()),
  "invalid_pinned_genesis_plan");
 return frozen({
  schemaVersion:GENESIS_PROTOCOL_SCHEMA,ownerRunId,originSha,globalRef,
  initialRegistryHash,stage:GENESIS_STAGE.PLAN,
  treeSha:null,commitSha:null,createAttemptCount:0,revision:0,
  events:[]
 });
}
function apply(current,event){
 insist(plain(event)&&typeof event.type==="string"&&
  findSecretPaths(event).length===0,"invalid_event");
 insist(current.revision<16,"event_limit_reached");
 const next={...current,revision:current.revision+1,
  events:[...current.events]};
 switch(event.type){
  case "TREE_STAGED":
   insist(exact(event,["type","treeSha"])&&
    current.stage===GENESIS_STAGE.PLAN&&
    SHA.test(event.treeSha??""),"tree_stage_refused");
   next.treeSha=event.treeSha;
   next.stage=GENESIS_STAGE.TREE_STAGED;break;
  case "COMMIT_STAGED":
   insist(exact(event,["type","commitSha","treeSha","parentSha"])&&
    current.stage===GENESIS_STAGE.TREE_STAGED&&
    SHA.test(event.commitSha??"")&&event.treeSha===current.treeSha&&
    event.parentSha===current.originSha,"commit_stage_refused");
   next.commitSha=event.commitSha;
   next.stage=GENESIS_STAGE.COMMIT_STAGED;break;
  case "BEGIN_CREATE_ATTEMPT":
   insist(exact(event,["type","commitSha","globalRef"])&&
    current.stage===GENESIS_STAGE.COMMIT_STAGED&&
    current.createAttemptCount===0&&
    event.commitSha===current.commitSha&&
    event.globalRef===ADMISSION_REGISTRY_REF,
    "one_shot_create_guard_refused");
   next.createAttemptCount=1;
   next.stage=GENESIS_STAGE.CREATE_ATTEMPT_RECORDED;break;
  case "CREATE_ACK":
   insist(exact(event,["type","commitSha","globalRef"])&&
    current.stage===GENESIS_STAGE.CREATE_ATTEMPT_RECORDED&&
    current.createAttemptCount===1&&
    event.commitSha===current.commitSha&&
    event.globalRef===current.globalRef,"create_ack_unverified");
   next.stage=GENESIS_STAGE.ACKNOWLEDGED;break;
  case "READBACK_MATCH":
   insist(exact(event,["type","commitSha","globalRef","registryHash",
    "originSha"])&&current.stage===GENESIS_STAGE.ACKNOWLEDGED&&
    current.createAttemptCount===1&&
    event.commitSha===current.commitSha&&
    event.globalRef===current.globalRef&&
    event.registryHash===current.initialRegistryHash&&
    event.originSha===current.originSha,"readback_not_identical");
   next.stage=GENESIS_STAGE.VERIFIED_OBSERVED;break;
  case "MARK_UNKNOWN":
   insist(exact(event,["type","reason"])&&
    ALLOWED_UNKNOWN.has(event.reason)&&
    [GENESIS_STAGE.CREATE_ATTEMPT_RECORDED,
     GENESIS_STAGE.ACKNOWLEDGED].includes(current.stage),
    "uncertain_create_must_stop");
   next.stage=GENESIS_STAGE.QUARANTINED;break;
  case "ABORT_BEFORE_CREATE":
   insist(exact(event,["type","reason"])&&
    ALLOWED_STOP.has(event.reason)&&
    [GENESIS_STAGE.PLAN,GENESIS_STAGE.TREE_STAGED,
     GENESIS_STAGE.COMMIT_STAGED].includes(current.stage)&&
    current.createAttemptCount===0,
    "abort_after_create_not_allowed");
   next.stage=GENESIS_STAGE.STOPPED;break;
  default:insist(false,"unknown_event");
 }
 next.events.push(frozen({seq:next.revision,...structuredClone(event)}));
 return frozen(next);
}
export function replayV3GenesisAttempt(value){
 insist(plain(value)&&exact(value,rootFields)&&
  value.schemaVersion===GENESIS_PROTOCOL_SCHEMA&&
  Array.isArray(value.events)&&value.events.length<=16,
  "invalid_protocol_snapshot");
 let state=createV3GenesisAttemptPlan(value);
 for(const record of value.events){
  insist(plain(record)&&record.seq===state.revision+1,
   "event_sequence_invalid");
  const {seq,...event}=record;
  state=apply(state,event);
 }
 insist(canonicalize(state)===canonicalize(value),
  "genesis_protocol_replay_mismatch");
 return state;
}
export function advanceV3GenesisAttempt(current,event,expectedRevision){
 const state=replayV3GenesisAttempt(current);
 insist(Number.isSafeInteger(expectedRevision)&&
   state.revision===expectedRevision,"revision_conflict");
 return apply(state,event);
}
/** Structured summary is never authority, even after a claimed readback. */
export function inspectV3GenesisAttempt(value){
 try{
  const state=replayV3GenesisAttempt(value);
  const code=state.stage===GENESIS_STAGE.VERIFIED_OBSERVED?
   "simulated_readback_observed_not_authorized":
   state.stage===GENESIS_STAGE.QUARANTINED?
   "manual_diagnosis_no_retry": "not_live_genesis_or_writer";
  return Object.freeze({
   status:state.stage,reason:code,
   createAttemptCount:state.createAttemptCount,
   authorized:false,canCreate:false,canWrite:false,
   canDispatch:false,canSpend:false,canRetry:false,
   evidence:Object.freeze({ownerRunId:state.ownerRunId,
    originSha:state.originSha,globalRef:state.globalRef,
    initialRegistryHash:state.initialRegistryHash,
    stagedCommitSha:state.commitSha})
  });
 }catch{
  return Object.freeze({status:"rejected",reason:"untrusted_protocol_snapshot",
   authorized:false,canCreate:false,canWrite:false,
   canDispatch:false,canSpend:false,canRetry:false});
 }
}
