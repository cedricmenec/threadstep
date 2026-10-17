/**
 * ASF V3-025 — child CLAIM_CHILD observer and isolated CAS, no paid authority.
 *
 * The child runner EVENT is an immutable local GitHub Actions file in a
 * future protected workflow. An injected event in tests is NOT proof.
 * Neither a successful ACK nor CLAIM authorizes OpenRouter or bypasses the
 * global paid-development mutex. No real write transport is created here.
 */
import { observeV3GithubRulesetPolicy } from "./github-native-control.mjs";
import { createV3WaveReadPort,loadV3TrustedSnapshot }
 from "./trusted-snapshot.mjs";
import { assertV3Manifest,reconstructV3Journal,advanceV3 }
 from "./lifecycle.mjs";
import { replayAdmissionRegistry,ADMISSION_REGISTRY_REF }
 from "./global-admission.mjs";
import { commitV3JournalCAS } from "./git-cas.mjs";
import { canonicalize,contentSha256 } from "../waves/hash.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const BOT="threadstep-software-factory[bot]";
const PATH=".github/workflows/agent-openspec-v3.yml";
const WF=REPO+"/"+PATH+"@refs/heads/main";
const GREF=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const MREF=BASE+"/git/ref/heads/main";
const SHA=/^[a-f0-9]{40}$/,RUN=/^[1-9]\d{0,17}$/;
const WAVE=/^[a-z0-9][a-z0-9._-]{2,63}$/,TASK=/^TS-[0-9]{3}$/;
const MAX=512*1024;
const gate=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canClaim:false,canAck:false,
 canWrite:false,canDispatch:false,canSpend:false,canRetry:false,
 evidence:evidence===null?null:Object.freeze(evidence)
});
const reject=c=>gate("rejected",c),unknown=c=>gate("uncertain",c);
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,ks)=>object(x)&&Object.keys(x).length===ks.length&&
 ks.every(k=>Object.hasOwn(x,k));
const ref=(res,name)=>res?.ok===true&&res.data?.ref===name&&
 res.data.object?.type==="commit"&&SHA.test(res.data.object.sha??"")?
 res.data.object.sha:null;
const validators=Object.freeze({
 verifyManifest(m){assertV3Manifest(m);return m.repository===REPO;},
 replayJournal:reconstructV3Journal
});
function decodeGlobal(r){
 const d=r?.data;
 if(!r?.ok||d?.type!=="file"||d.path!=="registry.json"||
   d.encoding!=="base64"||typeof d.content!=="string"||
   !Number.isSafeInteger(d.size)||d.size<2||d.size>MAX)
  throw Error("invalid_global_metadata");
 const encoded=d.content.replace(/\s/g,"");
 if(encoded.length>Math.ceil(MAX*4/3)+4||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
  throw Error("invalid_global_encoding");
 const buf=Buffer.from(encoded,"base64");
 if(buf.length!==d.size||buf.toString("base64")!==encoded)
  throw Error("invalid_global_bytes");
 return replayAdmissionRegistry(JSON.parse(
  new TextDecoder("utf-8",{fatal:true}).decode(buf)));
}
function nativeContext(r,e){
 if(!object(r)||!object(e)||!exact(e.inputs,[
  "wave_id","task_id","reservation_sha"
 ])||r.repository!==REPO||r.actor!==BOT||
 r.eventName!=="workflow_dispatch"||r.runAttempt!==1||
 r.workflowRef!==WF||r.ref!=="refs/heads/main"||
 !RUN.test(r.runId??"")||!SHA.test(r.sha??"")||
 e.repository?.full_name!==REPO||e.sender?.login!==BOT||
 !["main","refs/heads/main"].includes(e.ref)||
 !WAVE.test(e.inputs.wave_id??"")||
 !TASK.test(e.inputs.task_id??"")||
 !SHA.test(e.inputs.reservation_sha??""))return false;
 return true;
}
function runMatches(r,d){
 return object(d)&&String(d.id)===r.runId&&
 d.repository?.full_name===REPO&&d.actor?.login===BOT&&
 d.path===PATH&&d.event==="workflow_dispatch"&&
 d.head_branch==="main"&&d.head_sha===r.sha&&d.run_attempt===1&&
 (["queued","in_progress","waiting","pending"].includes(d.status)||
  (d.status==="completed"&&d.conclusion==="success"));
}
/**
 * The child must observe that the pinned ACK commit has exactly one parent:
 * the immutable reservation SHA passed to the original dispatch. This binds
 * the ACK to one physical Git chain instead of trusting a mere ID match.
 */
export async function observeV3GithubChildClaimReadiness({
 runner,event,readClient
}={}) {
 if(!nativeContext(runner,event))return reject("invalid_native_child_claim");
 if(typeof readClient?.get!=="function")
  return unknown("github_reader_unavailable");
 const {wave_id:waveId,task_id:taskId,
  reservation_sha:reservationSha}=event.inputs;
 let run;
 try{run=await readClient.get(BASE+"/actions/runs/"+runner.runId);}
 catch{return unknown("child_run_api_unavailable");}
 if(!run?.ok)return unknown("child_run_api_unavailable");
 if(!runMatches(runner,run.data))
  return reject("child_run_identity_mismatch");
 let policy;
 try{policy=await observeV3GithubRulesetPolicy(readClient);}
 catch{return unknown("global_ruleset_unavailable");}
 if(policy.status!=="structurally_consistent")
  return gate(policy.status==="rejected"?"rejected":"uncertain",
   "global_ruleset_not_verified");
 let refs,shot;
 try{
  [refs,shot]=await Promise.all([
   Promise.all([readClient.get(GREF),readClient.get(MREF)]),
   loadV3TrustedSnapshot(createV3WaveReadPort(readClient,REPO),
    waveId,validators)
  ]);
 }catch{return unknown("pinned_claim_snapshot_unavailable");}
 const globalSha=ref(refs[0],ADMISSION_REGISTRY_REF);
 if(!globalSha||ref(refs[1],"refs/heads/main")!==runner.sha||
    shot?.status!=="verified_snapshot")
  return unknown("pinned_claim_snapshot_unavailable");
 if(shot.headSha===reservationSha)
  return reject("ack_commit_not_persisted");
 const {manifest,journal}=shot,ack=journal.events.at(-1);
 if(journal.status!=="CHILD_ACKNOWLEDGED"||
   ack?.type!=="ACK_CHILD"||ack.taskId!==taskId||
   String(ack.childRunId)!==runner.runId||
   ack.workflowRef!==WF||ack.runAttempt!==1||
   journal.active?.taskId!==taskId||
   journal.active?.childRunId!==runner.runId)
  return reject("ack_does_not_bind_current_child");
 let global,commit;
 try{
  [global,commit]=await Promise.all([
   readClient.get(BASE+"/contents/registry.json?ref="+globalSha),
   readClient.get(BASE+"/git/commits/"+shot.headSha)
  ]);
 }catch{return unknown("global_or_ack_commit_unavailable");}
 let reg;
 try{reg=decodeGlobal(global);}
 catch{return reject("global_registry_replay_invalid");}
 const mh=contentSha256(manifest);
 if(reg.state!=="ACTIVE"||reg.active?.waveId!==waveId||
   reg.active.manifestHash!==mh||
   reg.active.ownerRunId!==manifest.authorization.runId||
   reg.active.originSha!==manifest.backlogCommit||
   !reg.history.includes(waveId))
  return reject("wave_not_owner_admitted");
 if(commit?.ok!==true||commit.data?.sha!==shot.headSha||
   !Array.isArray(commit.data.parents)||
   commit.data.parents.length!==1||
   commit.data.parents[0]?.sha!==reservationSha||
   !SHA.test(commit.data.tree?.sha??""))
  return reject("ack_parent_not_original_reservation");
 const wRef="refs/heads/asf/waves/"+waveId;
 let end;
 try{end=await Promise.all([
  readClient.get(GREF),
  readClient.get(BASE+"/git/ref/heads/asf/waves/"+waveId),
  readClient.get(MREF)
 ]);}
 catch{return unknown("claim_ref_recheck_unavailable");}
 if(ref(end[0],ADMISSION_REGISTRY_REF)!==globalSha||
   ref(end[1],wRef)!==shot.headSha||
   ref(end[2],"refs/heads/main")!==runner.sha)
  return unknown("claim_refs_changed");
 return gate("child_claim_candidate_not_authorized",
  "paid_mutex_and_owner_scoped_cas_still_required",{
   waveId,taskId,childRunId:runner.runId,
   reservationSha,ackHeadSha:shot.headSha,
   journalHash:contentSha256(journal),
   manifestHash:mh,globalHeadSha:globalSha,
   globalRegistryHash:contentSha256(reg),
   proposedClaimEvent:{type:"CLAIM_CHILD",taskId,
    childRunId:runner.runId,runAttempt:1,workflowRef:WF}
  });
}
function candidate(v){
 return v?.status==="child_claim_candidate_not_authorized"&&
  v.authorized===false&&v.canClaim===false&&v.canSpend===false&&
  v.canRetry===false&&v.evidence&&
  SHA.test(v.evidence.ackHeadSha??"");
}
function matched(a,b){
 return ["waveId","taskId","childRunId","reservationSha","ackHeadSha",
 "journalHash","manifestHash","globalHeadSha","globalRegistryHash"]
  .every(k=>a[k]===b[k])&&
  canonicalize(a.proposedClaimEvent)===canonicalize(b.proposedClaimEvent);
}
/** CAS only through a separately audited wave-write port. NEVER paid. */
export async function attemptV3GithubChildClaimCAS({
 runner,event,readClient,waveGitPort
}={}) {
 if(typeof readClient?.get!=="function"||!waveGitPort)
  return reject("child_claim_ports_missing");
 let first;
 try{first=await observeV3GithubChildClaimReadiness({
  runner,event,readClient
 });}catch{return unknown("child_claim_initial_observation_failed");}
 if(!candidate(first))
  return gate(first?.status==="rejected"?"rejected":"uncertain",
   "claim_not_verified");
 const a=first.evidence;
 let shot;
 try{shot=await loadV3TrustedSnapshot(
  createV3WaveReadPort(readClient,REPO),a.waveId,validators);
 }catch{return unknown("claim_snapshot_unavailable");}
 if(shot.status!=="verified_snapshot"||
  shot.headSha!==a.ackHeadSha||
  contentSha256(shot.journal)!==a.journalHash||
  contentSha256(shot.manifest)!==a.manifestHash)
  return unknown("claim_snapshot_changed");
 let next;
 try{next=advanceV3(shot.manifest,shot.journal,
   a.proposedClaimEvent,shot.journal.revision);
 }catch{return reject("claim_transition_refused");}
 if(next.status!=="EXECUTING"||
   next.active?.childRunId!==a.childRunId)
  return reject("claim_transition_mismatch");
 let again;
 try{again=await observeV3GithubChildClaimReadiness({
  runner,event,readClient
 });}catch{return unknown("claim_second_observation_failed");}
 if(!candidate(again)||!matched(a,again.evidence))
  return unknown("claim_proofs_changed");
 let saved;
 try{saved=await commitV3JournalCAS(waveGitPort,{
  waveId:a.waveId,expectedHeadSha:a.ackHeadSha,journal:next,
  validateJournal:j=>{
   try{return canonicalize(reconstructV3Journal(shot.manifest,j))===
    canonicalize(next);}
   catch{return false;}
  }
 });}catch{return unknown("claim_git_result_ambiguous");}
 if(saved?.status!=="persisted")
  return gate(saved?.status==="rejected"?"rejected":
   saved?.status==="conflict"?"conflict":"uncertain",
   "claim_git_cas_not_confirmed");
 let readback;
 try{readback=await loadV3TrustedSnapshot(
  createV3WaveReadPort(readClient,REPO),a.waveId,validators);
 }catch{return unknown("claim_readback_failed");}
 if(readback.status!=="verified_snapshot"||
   readback.headSha!==saved.newHeadSha||
   contentSha256(readback.journal)!==contentSha256(next)||
   contentSha256(readback.manifest)!==a.manifestHash||
   readback.journal.status!=="EXECUTING")
  return unknown("claim_readback_unconfirmed");
 return gate("persisted","claim_persisted_without_any_paid_authority",{
  waveId:a.waveId,taskId:a.taskId,childRunId:a.childRunId,
  ackHeadSha:a.ackHeadSha,newWaveSha:saved.newHeadSha,
  journalHash:contentSha256(next)
 });
}
