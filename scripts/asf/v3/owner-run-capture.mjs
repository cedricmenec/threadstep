#!/usr/bin/env node
/**
 * ASF-V3-017 — read-only owner workflow_dispatch input capture.
 *
 * The only production caller is the REVIEWED owner workflow on protected main.
 * This module does not grant authority: even a fully matching run and rulesets
 * cannot open a wave, create a Git ref, dispatch or pay. No controller App token.
 *
 * An injected event/runner/index during tests is UNTRUSTED. The CLI sources
 * the event from GITHUB_EVENT_PATH and runner identity from GitHub's env, after
 * validating the index against all checked-out task files.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createV3Manifest, parseV3MaxTasks } from "./lifecycle.mjs";
import { inspectV3OwnerIntent } from "./owner-intent-preflight.mjs";
import { observeV3GithubRulesetPolicy } from "./github-native-control.mjs";
import { contentSha256 } from "../waves/hash.mjs";
import { checkBacklogIndex } from "../backlog-index.mjs";
import { createGithubClient } from "../github/client.mjs";

const REPO="cedricmenec/threadstep";
const PATH=".github/workflows/backlog-orchestrator-v3.yml";
const WORKFLOW=REPO+"/"+PATH+"@refs/heads/main";
const SHA=/^[a-f0-9]{40}$/;
const HASH=/^[a-f0-9]{64}$/;
const ID=/^TS-\d{3}$/;
const RUN=/^[1-9]\d{0,17}$/;
const INPUT_KEYS=Object.freeze(["wave_id","model","max_task_starts",
  "auto_merge","backlog_commit","candidate_set_sha256"]);
const result=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canCreate:false,canWrite:false,
 canDispatch:false,canSpend:false,canRetry:false,
 evidence:evidence===null?null:Object.freeze(evidence)
});
const deny=reason=>result("rejected",reason);
const uncertain=reason=>result("uncertain",reason);
const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
const exactly=(o,keys)=>plain(o)&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

/**
 * Frozen deterministic candidate selection for this non-paying prototype:
 * product + ready + allowed + low + no unresolved dependencies.
 * The full task content is verified by checkBacklogIndex in the CLI before
 * this index can be used; the OWNER still has to independently review IDs.
 */
export function deriveV3OwnerCandidateSet(index) {
 if(!Array.isArray(index)||index.length>1000)throw Error("invalid_index");
 const selected=[],seen=new Set();
 for(const row of index){
  if(!plain(row)||typeof row.id!=="string"||seen.has(row.id))
   throw Error("duplicate_or_invalid_index");
  seen.add(row.id);
  if(row.type!=="product"||row.status!=="ready"||
     row.automation!=="allowed"||row.risk!=="low"||
     !Array.isArray(row.depends_on)||row.depends_on.length!==0)
   continue;
  if(!ID.test(row.id)||
     row.path!=="backlog/tasks/"+row.id+".md"||
     !HASH.test(row.content_sha256??""))
   throw Error("invalid_selected_candidate");
  selected.push({id:row.id,sha256:row.content_sha256});
 }
 selected.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(selected.length===0)throw Error("no_approved_candidates");
 return Object.freeze(selected.map(x=>Object.freeze(x)));
}
function ownerContextFromEvent(runner,event) {
 if(!plain(runner)||!plain(event)||!plain(event.inputs)||
    !exactly(event.inputs,INPUT_KEYS)||event.repository?.full_name!==REPO||
    event.sender?.login!=="cedricmenec"||
    !["main","refs/heads/main"].includes(event.ref)||
    runner.repository!==REPO||runner.actor!=="cedricmenec"||
    runner.ref!=="refs/heads/main"||runner.workflowRef!==WORKFLOW||
    runner.eventName!=="workflow_dispatch"||runner.runAttempt!==1||
    !RUN.test(runner.runId??"")||!SHA.test(runner.sha??""))
   return null;
 const fields={};
 for(const key of INPUT_KEYS){
  const value=event.inputs[key];
  if(typeof value!=="string"&&typeof value!=="boolean")
   return null;
  fields[key]=String(value);
 }
 return {repository:runner.repository,runId:runner.runId,
   runAttempt:runner.runAttempt,actor:runner.actor,
   workflowRef:runner.workflowRef,eventName:runner.eventName,
   ref:runner.ref,sha:runner.sha,inputs:fields};
}
/** No caller-provided manifest or chosen candidate set is accepted. */
export async function inspectV3RunnerOwnerCapture({
 runner,event,index,readClient
}={}) {
 const ctx=ownerContextFromEvent(runner,event);
 if(!ctx)return deny("invalid_protected_owner_event");
 let candidates,manifest;
 try{
  candidates=deriveV3OwnerCandidateSet(index);
  const inputs=ctx.inputs;
  if(inputs.backlog_commit!==runner.sha||
     inputs.candidate_set_sha256!==contentSha256(candidates)||
     !HASH.test(inputs.candidate_set_sha256))
   return deny("owner_backlog_sha_or_candidate_hash_mismatch");
  if(!["true","false"].includes(inputs.auto_merge))
   return deny("bad_explicit_auto_merge");
  manifest=createV3Manifest({
   waveId:inputs.wave_id,repository:REPO,backlogCommit:inputs.backlog_commit,
   model:inputs.model,autoMerge:inputs.auto_merge==="true",
   maxTaskStarts:parseV3MaxTasks(inputs.max_task_starts),
   candidateTasks:candidates,
   authorization:{runId:runner.runId,actor:"cedricmenec",
    workflowRef:WORKFLOW,sourceSha:runner.sha}
  });
 }catch{return deny("invalid_owner_candidate_or_manifest");}
 if(typeof readClient?.get!=="function")return uncertain("readonly_reader_missing");
 let verified;
 try{
  verified=await inspectV3OwnerIntent({
    manifest,ownerContext:ctx,readClient
  });
 }catch{return uncertain("owner_run_read_failed");}
 if(verified.status!=="consistent_not_authorized")
  return result(verified.status==="rejected"?"rejected":"uncertain",
   "owner_run_or_six_inputs_not_verified");
 const policy=await observeV3GithubRulesetPolicy(readClient);
 if(policy.status!=="structurally_consistent")
  return result(policy.status==="rejected"?"rejected":"uncertain",
   "effective_ruleset_structure_missing");
 return result("owner_intent_observed_no_write",
  "owner_review_and_writer_cas_still_required",{
   waveId:manifest.waveId,ownerRunId:runner.runId,
   originSha:runner.sha,candidateCount:candidates.length,
   candidateSetHash:contentSha256(candidates),
   manifestHash:contentSha256(manifest),
   controllerAppId:policy.evidence?.observedControllerAppId
  });
}
const staticFailure=code=>{
 process.stderr.write("ASF V3 owner capture: rejected/"+code+"\n");
 return 1;
};
function safeJson(path,limit){
 const bytes=readFileSync(path);
 if(bytes.length===0||bytes.length>limit)throw Error("oversized_json");
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
function productionReader(token){
 return createGithubClient({transport:async(path,{timeoutMs})=>{
  if(!path.startsWith("repos/"+REPO+"/"))throw Error("foreign_repo");
  if(!/^repos\/cedricmenec\/threadstep\/(?:actions\/runs\/[1-9][0-9]*|rulesets(?:\/[1-9][0-9]*)?)$/.test(path))
   throw Error("read_path_not_allowlisted");
  const response=await fetch("https://api.github.com/"+path,{
   method:"GET",redirect:"error",signal:AbortSignal.timeout(timeoutMs),
   headers:{"accept":"application/vnd.github+json",
    "authorization":"Bearer "+token,"x-github-api-version":"2022-11-28"}
  });
  if(!response.ok)throw Object.assign(Error("github_get_failed"),{
   status:response.status});
  return response.json();
 }});
}
export async function main(argv=process.argv.slice(2),env=process.env){
 if(argv.length!==1||!["verify","preview"].includes(argv[0]))
  return staticFailure("invalid_mode");
 try{
  const root=resolve(process.cwd());
  const index=checkBacklogIndex({root});
  if(index.problems.length)return staticFailure("backlog_index_not_clean");
  const candidateRows=safeJson(resolve(root,"backlog/index.json"),256*1024);
  const candidates=deriveV3OwnerCandidateSet(candidateRows);
  if(argv[0]==="preview"){
   // Preview is never a mandate; owner must inspect the candidate IDs AND
   // validate the SHA of protected main before running a future workflow.
   process.stdout.write(JSON.stringify({status:"preview_not_authorized",
    authorized:false,selected:candidates,
    candidate_set_sha256:contentSha256(candidates)})+"\n");
   return 0;
  }
  if(!env.GITHUB_EVENT_PATH||!env.GH_TOKEN)
   return staticFailure("trusted_runner_or_read_token_missing");
  const event=safeJson(env.GITHUB_EVENT_PATH,128*1024);
  const runner={
   repository:env.GITHUB_REPOSITORY,actor:env.GITHUB_ACTOR,
   runId:String(env.GITHUB_RUN_ID??""),
   runAttempt:Number(env.GITHUB_RUN_ATTEMPT),
   ref:env.GITHUB_REF,sha:env.GITHUB_SHA,
   workflowRef:env.GITHUB_WORKFLOW_REF,eventName:env.GITHUB_EVENT_NAME
  };
  const verdict=await inspectV3RunnerOwnerCapture({
   runner,event,index:candidateRows,
   readClient:productionReader(env.GH_TOKEN)
  });
  process.stdout.write("ASF V3 owner inputs: "+verdict.status+
   "/"+verdict.reason+"\n");
  if(verdict.status==="owner_intent_observed_no_write"){
   process.stdout.write(JSON.stringify(verdict.evidence)+"\n");
   return 0; // The workflow's next permanent DENY step still fails closed.
  }
  return 1;
 }catch{return staticFailure("failed_closed_without_detail");}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().then(code=>{process.exitCode=code;},()=>{
  process.stderr.write("ASF V3 owner capture: uncertain/unhandled\n");
  process.exitCode=1;
 });
}
