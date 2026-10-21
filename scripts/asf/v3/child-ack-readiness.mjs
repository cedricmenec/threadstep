#!/usr/bin/env node
/**
 * ASF-V3-023 — protected child workflow_dispatch ACK readiness, READ ONLY.
 *
 * The installed executor App V1 (5321746) can open child workflow runs but
 * CANNOT be the global registry writer App (5361227). Never allow child inputs
 * or a model to authorize a task start. This code cannot write a journal,
 * claim a task, dispatch or invoke a paid model.
 *
 * The runtime must capture the event from GITHUB_EVENT_PATH on protected main.
 * Injected runner/event/readClient values in tests are not authentication.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGithubClient } from "../github/client.mjs";
import { observeV3GithubRulesetPolicy } from "./github-native-control.mjs";
import { createV3WaveReadPort, loadV3TrustedSnapshot }
 from "./trusted-snapshot.mjs";
import { assertV3Manifest, reconstructV3Journal }
 from "./lifecycle.mjs";
import { replayAdmissionRegistry, ADMISSION_REGISTRY_REF }
 from "./global-admission.mjs";
import { contentSha256 } from "../waves/hash.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const PATH=".github/workflows/agent-openspec-v3.yml";
const WORKFLOW=REPO+"/"+PATH+"@refs/heads/main";
const BOT="threadstep-software-factory[bot]";
const SHA=/^[a-f0-9]{40}$/,WAVE=/^[a-z0-9][a-z0-9._-]{2,63}$/;
const TASK=/^TS-[0-9]{3}$/,RUN=/^[1-9]\d{0,17}$/;
const G_REF=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const MAIN=BASE+"/git/ref/heads/main";
const MAX_BYTES=512*1024;
const INPUTS=Object.freeze(["wave_id","task_id","reservation_sha"]);
const gate=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canAck:false,canClaim:false,
 canWrite:false,canDispatch:false,canSpend:false,canRetry:false,
 evidence:evidence===null?null:Object.freeze(evidence)
});
const reject=c=>gate("rejected",c),unknown=c=>gate("uncertain",c);
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const refSha=(res,ref)=>res?.ok===true&&res.data?.ref===ref&&
 res.data.object?.type==="commit"&&SHA.test(res.data.object.sha??"")?
 res.data.object.sha:null;
const validators=Object.freeze({
 verifyManifest(manifest){
  assertV3Manifest(manifest);
  return manifest.repository===REPO;
 },
 replayJournal:reconstructV3Journal
});
function registryFromFile(res){
 const d=res?.data;
 if(res?.ok!==true||d?.type!=="file"||d.path!=="registry.json"||
   d.encoding!=="base64"||typeof d.content!=="string"||
   !Number.isSafeInteger(d.size)||d.size<2||d.size>MAX_BYTES)
  throw Error("bad_registry_metadata");
 const enc=d.content.replace(/\s/g,"");
 if(enc.length>Math.ceil(MAX_BYTES*4/3)+4||
  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(enc))
  throw Error("bad_registry_base64");
 const b=Buffer.from(enc,"base64");
 if(b.length!==d.size||b.toString("base64")!==enc)
  throw Error("bad_registry_bytes");
 return replayAdmissionRegistry(JSON.parse(
  new TextDecoder("utf-8",{fatal:true}).decode(b)));
}
function validContext(runner,event){
 if(!plain(runner)||!plain(event)||!exact(event.inputs,INPUTS)||
    runner.repository!==REPO||runner.actor!==BOT||
    runner.eventName!=="workflow_dispatch"||runner.runAttempt!==1||
    runner.workflowRef!==WORKFLOW||runner.ref!=="refs/heads/main"||
    !RUN.test(runner.runId??"")||!SHA.test(runner.sha??"")||
    event.repository?.full_name!==REPO||event.sender?.login!==BOT||
    !["main","refs/heads/main"].includes(event.ref))
  return false;
 const i=event.inputs;
 return WAVE.test(i.wave_id??"")&&TASK.test(i.task_id??"")&&
  SHA.test(i.reservation_sha??"");
}
function observedRunMatches(runner,run){
 return plain(run)&&String(run.id)===runner.runId&&
  run.repository?.full_name===REPO&&run.actor?.login===BOT&&
  run.path===PATH&&run.event==="workflow_dispatch"&&
  run.head_branch==="main"&&run.head_sha===runner.sha&&
  run.run_attempt===1&&
  (["queued","in_progress","waiting","pending"].includes(run.status)||
   (run.status==="completed"&&run.conclusion==="success"));
}
/**
 * ACK is only a prospective journal EVENT, not an accepted claim. The
 * controller must separately persist ACK_CHILD by wave Git CAS and verify it;
 * then the child must independently CLAIM_CHILD via another Git CAS, with
 * the paid mutex held and budget approved. Nothing here advances the wave.
 */
export async function observeV3GithubChildAckReadiness(input={}) {
 return observeV3GithubChildTransitionReadiness({...input,phase:"ACK"});
}
/** A CLAIM is only a proposed journal transition, never permission to pay. */
export async function observeV3GithubChildClaimReadiness(input={}) {
 return observeV3GithubChildTransitionReadiness({...input,phase:"CLAIM"});
}
async function observeV3GithubChildTransitionReadiness({
 runner,event,readClient,phase
}={}) {
 if(!["ACK","CLAIM"].includes(phase))
  return reject("invalid_child_transition_phase");
 if(!validContext(runner,event))
  return reject("child_native_event_invalid");
 if(typeof readClient?.get!=="function")
  return unknown("child_github_read_only_client_missing");
 const inputs=event.inputs;
 let run;
 try{run=await readClient.get(BASE+"/actions/runs/"+runner.runId);}
 catch{return unknown("child_run_rest_unavailable");}
 if(run?.ok!==true||!plain(run.data))
  return unknown("child_run_rest_unavailable");
 if(!observedRunMatches(runner,run.data))
  return reject("child_run_rest_identity_mismatch");

 const policy=await observeV3GithubRulesetPolicy(readClient);
 if(policy.status!=="structurally_consistent")
  return gate(policy.status==="rejected"?"rejected":"uncertain",
   "child_global_rules_unconfirmed");
 let beforeGlobal,beforeMain,wave;
 try{
  [beforeGlobal,beforeMain,wave]=await Promise.all([
   readClient.get(G_REF),readClient.get(MAIN),
   loadV3TrustedSnapshot(
    createV3WaveReadPort(readClient,REPO),inputs.wave_id,validators)
  ]);
 }catch{return unknown("child_pinned_git_snapshot_unavailable");}
 const globalSha=refSha(beforeGlobal,ADMISSION_REGISTRY_REF);
 const mainSha=refSha(beforeMain,"refs/heads/main");
 if(!globalSha||mainSha!==runner.sha||
    wave?.status!=="verified_snapshot")
  return unknown("child_pinned_git_snapshot_unavailable");
 if(phase==="ACK"&&wave.headSha!==inputs.reservation_sha)
  return reject("child_reservation_sha_does_not_match_wave_tip");
 // CLAIM must follow exactly ONE successful ACK commit, whose sole parent is
 // the ORIGINAL dispatch reservation SHA. A journal-provided ACK alone cannot
 // prove the original reservation or the Git branch's lineage.
 if(phase==="CLAIM"){
  if(wave.headSha===inputs.reservation_sha)
   return reject("child_ack_commit_not_persisted");
  let proof;
  try{
   proof=await readClient.get(BASE+"/git/commits/"+wave.headSha);
  }catch{return unknown("child_ack_git_parent_unavailable");}
  if(proof?.ok!==true||proof.data?.sha!==wave.headSha||
     !Array.isArray(proof.data.parents)||proof.data.parents.length!==1||
     proof.data.parents[0]?.sha!==inputs.reservation_sha||
     !SHA.test(proof.data.tree?.sha??""))
   return reject("child_ack_git_parent_not_original_reservation");
 }

 let global;
 try{
  global=registryFromFile(await readClient.get(
   BASE+"/contents/registry.json?ref="+globalSha));
 }catch{return reject("child_global_registry_invalid");}
 const {manifest,journal}=wave,manifestHash=contentSha256(manifest);
 if(global.state!=="ACTIVE"||global.active?.waveId!==inputs.wave_id||
    global.active.manifestHash!==manifestHash||
    global.active.ownerRunId!==manifest.authorization.runId||
    global.active.originSha!==manifest.backlogCommit||
    !global.history.includes(inputs.wave_id))
  return reject("child_wave_not_active_under_owner_admission");

 const last=journal.events.at(-1);
 const common=journal.active!==null&&
    journal.active.taskId===inputs.task_id&&
    journal.reserved>=1&&
    journal.reserved<=manifest.limits.maxTaskStarts&&
    journal.delivered<=journal.reserved&&
    journal.attempted.includes(inputs.task_id)&&
    manifest.candidateTasks.some(x=>x.id===inputs.task_id);
 if(!common)return reject("child_task_not_reserved_or_dispatch_intent_missing");
 if(phase==="ACK"&&(
    journal.status!=="DISPATCH_PENDING"||
    journal.active.childRunId!==null||
    last?.type!=="DISPATCH_INTENT"||last.taskId!==inputs.task_id))
  return reject("child_task_not_reserved_or_dispatch_intent_missing");
 if(phase==="CLAIM"&&(
    journal.status!=="CHILD_ACKNOWLEDGED"||
    journal.active.childRunId!==runner.runId||
    last?.type!=="ACK_CHILD"||last.taskId!==inputs.task_id||
    String(last.childRunId)!==runner.runId||last.runAttempt!==1||
    last.workflowRef!==WORKFLOW))
  return reject("child_ack_not_exactly_persisted_for_child_run");

 // Re-read all three refs; neither a moved original source nor a sibling
 // dispatcher may be treated as an ACK for the stale reservation.
 const waveRef="refs/heads/asf/waves/"+inputs.wave_id;
 let after;
 try{
  after=await Promise.all([
   readClient.get(G_REF),
   readClient.get(BASE+"/git/ref/heads/asf/waves/"+inputs.wave_id),
   readClient.get(MAIN)
  ]);
 }catch{return unknown("child_refs_unavailable_after_read");}
 if(refSha(after[0],ADMISSION_REGISTRY_REF)!==globalSha||
    refSha(after[1],waveRef)!==wave.headSha||
    refSha(after[2],"refs/heads/main")!==runner.sha)
  return unknown("child_refs_changed_during_ack_observation");

 const proposedEvent={
  type:phase==="ACK"?"ACK_CHILD":"CLAIM_CHILD",
  taskId:inputs.task_id,childRunId:runner.runId,
  runAttempt:1,workflowRef:WORKFLOW
 };
 return gate(phase==="ACK"?"child_ack_candidate_not_authorized":
    "child_claim_candidate_not_authorized",
  phase==="ACK"?
    "requires_controller_persisted_ack_child_claim_and_paid_mutex":
    "requires_atomic_claim_journal_cas_and_shared_paid_mutex",{
   waveId:inputs.wave_id,taskId:inputs.task_id,
   reservationSha:inputs.reservation_sha,
   waveHeadSha:wave.headSha,
   journalHash:contentSha256(journal),
   globalHeadSha:globalSha,globalRegistryHash:contentSha256(global),
   manifestHash,childRunId:runner.runId,
   proposedEvent,
   ...(phase==="ACK"?{proposedAckEvent:proposedEvent}:{
    proposedClaimEvent:proposedEvent
   })
  });
}
function safeEvent(path) {
 const bytes=readFileSync(path);
 if(bytes.length<2||bytes.length>128*1024)throw Error("unsafe_event_file");
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
function createProductionReader(token){
 return createGithubClient({transport:async(path,{timeoutMs})=>{
  if(!/^repos\/cedricmenec\/threadstep\/(?:actions\/runs\/[1-9][0-9]*|rulesets(?:\/[1-9][0-9]*)?|git\/ref\/heads\/(?:main|asf\/control\/active-wave-v3|asf\/waves\/[a-z0-9][a-z0-9._-]{2,63})|contents\/(?:registry|manifest|journal)\.json\?ref=[a-f0-9]{40})$/.test(path))
   throw Error("read_path_not_allowlisted");
  const response=await fetch("https://api.github.com/"+path,{
   method:"GET",redirect:"error",signal:AbortSignal.timeout(timeoutMs),
   headers:{"accept":"application/vnd.github+json",
    "authorization":"Bearer "+token,"x-github-api-version":"2022-11-28"}
  });
  if(!response.ok)throw Object.assign(Error("read_unavailable"),{
   status:response.status});
  return response.json();
 }});
}
export async function main(argv=process.argv.slice(2),env=process.env) {
 if(argv.length!==1||argv[0]!=="verify")return 1;
 try{
  if(!env.GITHUB_EVENT_PATH||!env.GH_TOKEN)return 1;
  const event=safeEvent(env.GITHUB_EVENT_PATH);
  const runner={
   repository:env.GITHUB_REPOSITORY,actor:env.GITHUB_ACTOR,
   eventName:env.GITHUB_EVENT_NAME,runAttempt:Number(env.GITHUB_RUN_ATTEMPT),
   workflowRef:env.GITHUB_WORKFLOW_REF,
   ref:env.GITHUB_REF,runId:String(env.GITHUB_RUN_ID??""),
   sha:env.GITHUB_SHA
  };
  const verdict=await observeV3GithubChildAckReadiness({
   runner,event,readClient:createProductionReader(env.GH_TOKEN)
  });
  process.stdout.write("ASF V3 child ACK: "+
   verdict.status+"/"+verdict.reason+"\n");
  if(verdict.status==="child_ack_candidate_not_authorized"){
   process.stdout.write(JSON.stringify(verdict.evidence)+"\n");
   return 0; // ALWAYS followed by the workflow's unconditional DENY step.
  }
  return 1;
 }catch{
  process.stderr.write("ASF V3 child ACK: uncertain/fail_closed\n");
  return 1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().then(code=>{process.exitCode=code;},()=>{
  process.stderr.write("ASF V3 child ACK: uncertain/unhandled\n");
  process.exitCode=1;
 });
}
