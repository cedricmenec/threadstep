#!/usr/bin/env node
/**
 * ASF-V2-009: bounded owner-authorized wave controller.
 * - No LLM selects tasks; the pure scheduler chooses from a frozen snapshot.
 * - Exactly two static reusable workflow slots, at most two reserved paid starts.
 * - Reservation is committed to a durable Git branch BEFORE a reusable job.
 * - A failed/uncertain delivery stops the wave; never automatically retry.
 * - Read-only GitHub evidence is required before selecting another task.
 * - CLI never triggers a workflow or OpenRouter itself.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildBacklogIndex } from "../backlog-index.mjs";
import { buildWaveCandidates, selectNextTask, DECISION } from "../scheduler/index.mjs";
import {
  createWaveManifest, validateWaveManifest, hashWaveManifest, createJournal,
  validateJournal, beginDispatch, applyEvent, WAVE_EVENT, currentState,
  toSchedulerExecutionState, MODEL_ALLOWLIST, ORCHESTRATOR_POLICY_VERSION
} from "./index.mjs";

const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const SHA = /^[a-f0-9]{40}$/;
const ID = /^TS-[0-9]{3}$/;
const WAVE = /^wave-[1-9][0-9]{0,17}$/;
const MAX_PR_PAGES = 10;
const APP = "threadstep-software-factory[bot]";
const ROOT = resolve(fileURLToPath(new URL("../../../",import.meta.url)));

function fail(why){throw Error("ASF wave stopped: "+why);}
function demand(ok,why){if(!ok)fail(why);}
function invoke(command,args,{binary=false}={}){
 return execFileSync(command,args,{
  encoding:binary?null:"utf8",timeout:30000,maxBuffer:8*1024*1024,
  stdio:["ignore","pipe","pipe"]
 });
}
function git(...args){return invoke("git",args).trim();}
function gitIdentity(){
 git("config","user.name","threadstep-software-factory[bot]");
 git("config","user.email","threadstep-software-factory[bot]@users.noreply.github.com");
}
function api(path){demand(process.env.GH_TOKEN,"read-only GH_TOKEN required");return JSON.parse(invoke("gh",["api",path]));}
function push(branch,expectedSha=null){
 const token=process.env.ASF_GIT_TOKEN;
 demand(typeof token==="string" && token.length>10,"publisher installation token unavailable");
 const header="AUTHORIZATION: basic "+Buffer.from("x-access-token:"+token).toString("base64");
 const ref="refs/heads/"+branch;
 const args=["-c","http.extraheader="+header,"push","origin"];
 if(expectedSha)args.push("--force-with-lease="+ref+":"+expectedSha);
 args.push("HEAD:"+ref);
 invoke("git",args);
}
function renderOutputs(obj){
 const file=process.env.GITHUB_OUTPUT;
 demand(file,"GITHUB_OUTPUT absent");
 const fields=["wave_id","task_id","reservation_sha","decision"];
 const existing=existsSync(file)?readFileSync(file,"utf8"):"";
 writeFileSync(file,existing+fields.map(key=>key+"="+String(obj[key]??"")+"\n").join(""));
}
function summary(label,data){
 const safe={phase:label,wave_id:data.wave_id??null,task_id:data.task_id??null,
  decision:data.decision??null,reservations:data.reservations??null,details:data.details??null};
 if(process.env.GITHUB_STEP_SUMMARY){
  const f=process.env.GITHUB_STEP_SUMMARY;
  const previous=existsSync(f)?readFileSync(f,"utf8"):"";
  writeFileSync(f,previous+"\n### ASF "+label+"\n\n\`\`\`json\n"+JSON.stringify(safe,null,2)+"\n\`\`\`\n");
 }
 process.stdout.write(JSON.stringify(safe)+"\n");
}
function ownerPreflight(){
 const e=process.env;
 demand(e.GITHUB_REPOSITORY && REPO.test(e.GITHUB_REPOSITORY),"invalid repository");
 demand(e.GITHUB_ACTOR===e.GITHUB_REPOSITORY_OWNER,"repository owner required");
 demand(e.GITHUB_REF==="refs/heads/main" && e.GITHUB_EVENT_NAME==="workflow_dispatch",
  "only manual dispatch on main is accepted");
 demand(e.GITHUB_RUN_ATTEMPT==="1","GitHub reruns are prohibited; initiate a separately authorized wave");
 demand(/^[1-9][0-9]{0,17}$/.test(e.GITHUB_RUN_ID??""),"invalid parent run ID");
 demand(SHA.test(e.GITHUB_SHA??""),"unknown source SHA");
 return {repository:e.GITHUB_REPOSITORY,source:e.GITHUB_SHA,
  waveId:"wave-"+e.GITHUB_RUN_ID};
}
function snapshotAtSource(){
 const result=buildBacklogIndex({root:ROOT});
 demand(!result.diagnostics.length && !result.legacy.length,"invalid/unmigrated backlog");
 return result;
}
function frozenDefinition(snapshot,id){
 const entry=snapshot.active.find(x=>x.id===id);
 demand(entry&&ID.test(id),"no active task in frozen snapshot");
 return entry;
}
function allowedTasks(snapshot){
 const choice=buildWaveCandidates(snapshot);
 demand(choice.ok,"backlog is not scheduler-valid");
 // Constrain the current V1/OpenSpec executor to TS-NNN only.
 demand(choice.candidateTasks.every(c=>ID.test(c.id)),"unsupported automated task ID");
 return choice.candidateTasks;
}
function classifyPR(pr,id){
 return pr?.title==="OpenSpec: "+id || pr?.head?.ref==="agent/openspec/"+id ||
   pr?.title==="Agent: "+id || pr?.head?.ref==="agent/"+id;
}
function listAllPrs(){
 const output=[];
 for(const state of ["open","closed"]){
  for(let page=1;page<=MAX_PR_PAGES;page++){
   const items=api("repos/"+process.env.GITHUB_REPOSITORY+"/pulls?state="+state+
     "&per_page=100&page="+page);
   demand(Array.isArray(items),"GitHub PR API response is invalid");
   output.push(...items);
   if(items.length<100)break;
   demand(page<MAX_PR_PAGES,"GitHub PR pagination is incomplete");
  }
 }
 return output;
}
function checkRuns(sha){
 demand(SHA.test(sha),"invalid check SHA");
 const result=api("repos/"+process.env.GITHUB_REPOSITORY+"/commits/"+sha+"/check-runs?per_page=100");
 demand(Array.isArray(result.check_runs) && result.total_count<=100,"check evidence incomplete");
 return result.check_runs;
}
function checkStatus(sha){
 const checks=checkRuns(sha).filter(c=>c?.name==="check"&&c.head_sha===sha&&
   c.app?.id===15368&&c.app?.slug==="github-actions");
 if(checks.some(c=>c.status==="completed" && c.conclusion==="success"))return "verified";
 if(checks.some(c=>c.status!=="completed"))return "pending";
 if(checks.length && checks.some(c=>c.status==="completed"))return "failed";
 return "unknown";
}
function mergeDelivery(pr,id){
 demand(pr && pr.number && SHA.test(pr.merge_commit_sha??""),"merge commit missing");
 const full=api("repos/"+process.env.GITHUB_REPOSITORY+"/pulls/"+pr.number);
 demand(full?.merged===true && full.state==="closed" && full.base?.ref==="main" &&
   full.head?.repo?.full_name===process.env.GITHUB_REPOSITORY &&
   full.user?.login===APP &&
   ((full.title==="OpenSpec: "+id && full.head?.ref==="agent/openspec/"+id) ||
    (full.title==="Agent: "+id && full.head?.ref==="agent/"+id)) &&
   SHA.test(full.head?.sha??"") &&
   typeof full.merged_at==="string","merged PR identity is not trustworthy");
 // Both checks must have the expected GitHub Actions provenance.
 const head=checkStatus(full.head.sha),main=checkStatus(full.merge_commit_sha);
 if(head==="failed"||main==="failed")return {status:"failed",pr:full};
 if(head!=="verified"||main!=="verified")return {status:"pending",pr:full};
 const compare=api("repos/"+process.env.GITHUB_REPOSITORY+"/compare/"+
   full.merge_commit_sha+"...main");
 demand(["ahead","identical"].includes(compare.status),"merge not reachable from main");
 const runs=api("repos/"+process.env.GITHUB_REPOSITORY+"/actions/runs?head_sha="+
   full.merge_commit_sha+"&event=push&per_page=100");
 demand(Array.isArray(runs.workflow_runs) && runs.total_count<=100,"post-merge runs incomplete");
 for(const name of ["CI","Pages"]){
  const all=runs.workflow_runs.filter(r=>r.name===name &&
    r.head_sha===full.merge_commit_sha && r.event==="push" &&
    r.created_at>=full.merged_at);
  if(all.some(r=>r.status==="completed"&&r.conclusion==="success"))continue;
  if(all.some(r=>r.status==="completed"&&r.conclusion!=="success"))
   return {status:"failed",pr:full};
  return {status:"pending",pr:full};
 }
 return {status:"verified",pr:full};
}
/** Every unknown/error is a stop; only verified historical facts become evidence. */
export function assessTask(id,prs){
 const matching=prs.filter(pr=>classifyPR(pr,id));
 const opened=matching.filter(pr=>pr.state==="open");
 if(opened.length)return {status:"conflict"};
 const merged=matching.filter(pr=>pr.merged_at&&pr.state==="closed");
 const unmerged=matching.filter(pr=>pr.state==="closed"&&!pr.merged_at);
 if(merged.length>1||unmerged.length)return {status:"unknown"};
 if(!merged.length)return {status:"clear"};
 const proof=mergeDelivery(merged[0],id);
 return proof.status==="verified"
   ? {status:"verified",proof:{pr:proof.pr.number,mergeSha:proof.pr.merge_commit_sha}}
   : {status:proof.status};
}
function gatherEvidence(snapshot,candidates,journal){
 const prs=listAllPrs();
 // There may be only one active PR repo-wide during a wave. Other PRs
 // cannot be silently treated as absent engineering conflicts.
 demand(!prs.some(pr=>pr.state==="open"),"open PR exists; explicit reconciliation required");
 const ids=new Set(candidates.map(x=>x.id));
 for(const id of [...ids]){
  const card=snapshot.active.find(x=>x.id===id);
  for(const dep of card.depends_on)ids.add(dep);
 }
 const deliveries={},conflicts={};
 for(const id of [...ids].sort()){
  const status=assessTask(id,prs);
  if(status.status==="verified")deliveries[id]={status:"verified",proof:status.proof};
  else if(status.status==="clear")conflicts[id]={status:"clear"};
  else if(status.status==="conflict")conflicts[id]={status:"conflict"};
  else if(status.status==="pending") {
   // A non-delivered dependency blocks selection. A candidate's pending
   // PR/checks cannot be mistaken for absence of concurrent work.
   conflicts[id]={status:"unknown"};
  } else conflicts[id]={status:"unknown"};
 }
 return {deliveries,conflicts};
}
function schedulerView(manifest,snapshot,journal){
 const evidence=gatherEvidence(snapshot,manifest.candidateTasks,journal);
 const sched=selectNextTask(
  {...manifest,policyVersion:"asf-sched-v1"},
  snapshot,evidence,toSchedulerExecutionState(journal));
 return sched;
}
function createManifest(context,candidates,options){
 const created=createWaveManifest({
  schemaVersion:1,waveId:context.waveId,repository:context.repository,
  authorizedBy:"repository_owner",backlogCommit:context.source,
  policyVersion:ORCHESTRATOR_POLICY_VERSION,
  mode:options.mode,executor:"openspec",phase:"auto",
  model:options.model,autoMerge:options.autoMerge,
  limits:{maxTaskStarts:options.maxTasks,maxConcurrentTasks:1,maxPaidRetries:0},
  candidateTasks:candidates,authorization:{
   parentRunId:Number(process.env.GITHUB_RUN_ID),
   reference:"workflow_dispatch:"+process.env.GITHUB_RUN_ID
  }
 });
 demand(created.ok,"immutable manifest invalid");
 return created.manifest;
}
function record(journal,type,taskId,fields={}){
 const result=applyEvent(journal,{type,taskId,at:new Date().toISOString(),...fields});
 demand(result.ok,"cannot append "+type+" to the wave journal");
 return result.journal;
}
function reserve(manifest,snapshot,journal){
 const next=schedulerView(manifest,snapshot,journal);
 if(next.decision!==DECISION.SELECT)return {journal,decision:next.decision,taskId:""};
 const updated=beginDispatch(journal,next.taskId,new Date().toISOString());
 demand(updated.ok,"quota could not be reserved before paid execution");
 return {journal:updated.journal,decision:next.decision,taskId:next.taskId};
}
function waveBranch(waveId){demand(WAVE.test(waveId),"invalid wave id");return "asf/waves/"+waveId;}
function saveInitial(manifest,journal){
 gitIdentity();
 const branch=waveBranch(manifest.waveId);
 git("checkout","-b",branch);
 writeFileSync("manifest.json",JSON.stringify(manifest,null,2)+"\n");
 writeFileSync("journal.json",JSON.stringify(journal,null,2)+"\n");
 git("add","manifest.json","journal.json");
 git("commit","-m","chore(asf): authorize bounded wave "+manifest.waveId);
 push(branch);
 return git("rev-parse","HEAD");
}
function loadCommitted(context){
 const branch=waveBranch(context.waveId);
 const origin="refs/heads/"+branch;
 git("fetch","--no-tags","origin",origin);
 const sha=git("rev-parse","FETCH_HEAD");
 demand(SHA.test(sha),"unknown wave journal commit");
 const manifest=JSON.parse(git("show",sha+":manifest.json"));
 const journal=JSON.parse(git("show",sha+":journal.json"));
 demand(validateWaveManifest(manifest).ok && validateJournal(journal,manifest).ok &&
   manifest.waveId===context.waveId && manifest.backlogCommit===context.source &&
   String(manifest.authorization.parentRunId)===process.env.GITHUB_RUN_ID &&
   manifest.mode==="execute" && !journal.stop,"wave journal not authorized for this run");
 git("checkout","-B",branch,sha);
 return {branch,sha,manifest,journal};
}
function saveUpdate(state,journal){
 gitIdentity();
 writeFileSync("journal.json",JSON.stringify(journal,null,2)+"\n");
 git("add","journal.json");
 git("commit","-m","chore(asf): checkpoint "+state.manifest.waveId+" revision "+journal.revision);
 push(state.branch,state.sha);
 return git("rev-parse","HEAD");
}
function readInputs(){
 const e=process.env;
 const mode=e.ASF_MODE,model=e.ASF_MODEL,raw=e.ASF_MAX_TASKS;
 demand(["dry-run","execute"].includes(mode),"mode must be dry-run or execute");
 demand(MODEL_ALLOWLIST.includes(model),"model not in approved allowlist");
 demand(["1","2"].includes(raw),"max_tasks must be 1 or 2");
 demand(["true","false"].includes(e.ASF_AUTO_MERGE),"auto_merge must be explicit");
 return {mode,model,maxTasks:Number(raw),autoMerge:e.ASF_AUTO_MERGE==="true"};
}
function prepare(){
 const ctx=ownerPreflight(),options=readInputs();
 const snapshot=snapshotAtSource(),candidates=allowedTasks(snapshot);
 const manifest=createManifest(ctx,candidates,options);
 const empty=createJournal(manifest);
 const chosen=reserve(manifest,snapshot,empty);
 if(options.mode==="dry-run"){
  const data={wave_id:ctx.waveId,decision:chosen.decision,task_id:chosen.taskId,
    details:"Preview only: no wave branch, no reservation persisted and no paid call"};
  // Preview computations must never be mistaken for a real reservation.
  renderOutputs({wave_id:ctx.waveId,decision:"DRY_RUN"});
  summary("dry-run",data);
  return;
 }
 if(chosen.decision!==DECISION.SELECT){
  renderOutputs({wave_id:ctx.waveId,decision:chosen.decision});
  summary("no-dispatch",{wave_id:ctx.waveId,decision:chosen.decision,details:"No eligible task; no reservation written"});
  if(chosen.decision===DECISION.STOP_UNCERTAIN)fail("GitHub/backlog evidence insufficient");
  return;
 }
 const sha=saveInitial(manifest,chosen.journal);
 renderOutputs({wave_id:ctx.waveId,task_id:chosen.taskId,reservation_sha:sha,decision:"SELECT"});
 summary("reserved-1",{wave_id:ctx.waveId,task_id:chosen.taskId,decision:"SELECT",reservations:1});
}
async function settle(taskId,result){
 const ctx=ownerPreflight(),state=loadCommitted(ctx);
 demand(currentState(state.journal,taskId)==="DISPATCH_RESERVED","unexpected task/repeated delivery step");
 let journal=state.journal;
 if(result!=="success"){
  journal=record(journal,WAVE_EVENT.UNKNOWN,taskId,{reason:"reusable_job_"+result});
  saveUpdate(state,journal);
  fail("child job not successful; wave stopped with no replacement");
 }
 journal=record(journal,WAVE_EVENT.DISPATCH_CONFIRMED,taskId,{
  workflowRunId:process.env.GITHUB_RUN_ID,
  workflowRunUrl:"https://github.com/"+ctx.repository+"/actions/runs/"+process.env.GITHUB_RUN_ID
 });
 let delivery=null;
 const deadline=Date.now()+7*60*1000;
 while(Date.now()<deadline){
  const prs=listAllPrs();
  const matching=prs.filter(pr=>classifyPR(pr,taskId));
  const merged=matching.filter(pr=>pr.merged_at&&pr.state==="closed");
  if(merged.length>1 || matching.some(pr=>pr.state==="open"&&pr.draft===true)){
   journal=record(journal,WAVE_EVENT.UNKNOWN,taskId,{reason:"ambiguous_or_plan_pr"});
   saveUpdate(state,journal);
   fail("ambiguous or incomplete OpenSpec PR");
  }
  if(merged.length===1){
   const outcome=mergeDelivery(merged[0],taskId);
   if(outcome.status==="verified"){delivery=outcome.pr;break;}
   if(outcome.status==="failed"){
    journal=record(journal,WAVE_EVENT.FAILED,taskId,{reason:"ci_or_pages_failed"});
    saveUpdate(state,journal);
    fail("CI or Pages failed after OpenSpec run");
   }
  }
  await new Promise(resolve=>setTimeout(resolve,15000));
 }
 if(!delivery){
  journal=record(journal,WAVE_EVENT.UNKNOWN,taskId,{reason:"delivery_not_confirmed_within_time_limit"});
  saveUpdate(state,journal);
  fail("no verified PR + CI + main + Pages delivery within timeout");
 }
 journal=record(journal,WAVE_EVENT.PR_PUBLISHED,taskId,{
  prNumber:delivery.number,prUrl:delivery.html_url,headSha:delivery.head.sha
 });
 journal=record(journal,WAVE_EVENT.CI_PENDING,taskId);
 journal=record(journal,WAVE_EVENT.MERGE_PENDING,taskId);
 journal=record(journal,WAVE_EVENT.DELIVERED,taskId,{mergeCommit:delivery.merge_commit_sha});
 if(process.env.ASF_SLOT==="2"||journal.quota.taskStartsReserved>=journal.quota.maxTaskStarts){
  saveUpdate(state,journal);
  renderOutputs({wave_id:ctx.waveId,decision:"COMPLETED"});
  summary("delivered",{wave_id:ctx.waveId,task_id:taskId,decision:"COMPLETED",
    reservations:journal.quota.taskStartsReserved,details:"PR #"+delivery.number+" verified"});
  return;
 }
 // A second task is selected only after GitHub confirms true delivery,
 // from the SAME frozen initial snapshot and manifest candidate hashes.
 const snapshot=snapshotAtSource();
 const second=reserve(state.manifest,snapshot,journal);
 journal=second.journal;
 const sha=saveUpdate(state,journal);
 renderOutputs({wave_id:ctx.waveId,task_id:second.taskId,
  reservation_sha:second.taskId?sha:"",decision:second.decision});
 summary("select-next",{wave_id:ctx.waveId,task_id:second.taskId,
  decision:second.decision,reservations:journal.quota.taskStartsReserved});
 if(second.decision===DECISION.STOP_UNCERTAIN)fail("uncertain after first delivery");
}
async function main(){
 const mode=process.argv[2];
 if(mode==="prepare")return prepare();
 if(mode==="settle"){
  demand(["1","2"].includes(process.env.ASF_SLOT),"invalid wave slot");
  demand(ID.test(process.env.ASF_TASK_ID??""),"invalid delivered task");
  demand(["success","failure","cancelled","skipped"].includes(process.env.ASF_CHILD_RESULT),
    "child job result missing");
  return settle(process.env.ASF_TASK_ID,process.env.ASF_CHILD_RESULT);
 }
 fail("usage: orchestrate.mjs <prepare|settle>");
}
if (process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 main().catch(e=>{process.stderr.write(
  e.message?.startsWith("ASF wave stopped:")?e.message+"\n":"ASF wave stopped: GitHub or persistence state unknown\n"
 );process.exitCode=1;});
}
