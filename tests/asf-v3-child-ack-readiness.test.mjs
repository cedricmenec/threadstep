import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { observeV3GithubChildAckReadiness }
 from "../scripts/asf/v3/child-ack-readiness.mjs";
import { createV3Manifest,createV3Journal,advanceV3 }
 from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF }
 from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const S=c=>c.repeat(40),G=S("1"),W=S("2"),MAIN=S("a"),DIFFERENT=S("f");
const WAVE="wave-child-ack-023",TASK="TS-014",RUN="45013",OWNER="41009";
const BOT="threadstep-software-factory[bot]";
const PATH=".github/workflows/agent-openspec-v3.yml";
const WORKFLOW=REPO+"/"+PATH+"@refs/heads/main";
const G_REF=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const W_REF=BASE+"/git/ref/heads/asf/waves/"+WAVE;
const M_REF=BASE+"/git/ref/heads/main";
const run=()=>({
 repository:REPO,actor:BOT,eventName:"workflow_dispatch",
 runAttempt:1,workflowRef:WORKFLOW,ref:"refs/heads/main",
 runId:RUN,sha:MAIN
});
const evt=()=>({
 repository:{full_name:REPO},sender:{login:BOT},ref:"refs/heads/main",
 inputs:{wave_id:WAVE,task_id:TASK,reservation_sha:W}
});
const rule=(id,ref,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,
 rules:types.map(type=>type==="required_status_checks"?
 {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
});
function fixture({
 status="DISPATCH_PENDING",invalidRules=false,wrongGlobal=false,
 movedGlobal=false,movedWave=false,movedMain=false,
 wrongRun=false,malformedJournal=false,corruptRegistry=false,
 fail=null,wrongTask=false
}={}) {
 const manifest=createV3Manifest({
  waveId:WAVE,repository:REPO,backlogCommit:MAIN,
  model:"openrouter/deepseek/deepseek-v4.1-flash",autoMerge:false,
  maxTaskStarts:1,candidateTasks:[{
   id:TASK,sha256:"b".repeat(64)
  }],
  authorization:{runId:OWNER,actor:"cedricmenec",
   workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
   sourceSha:MAIN}
 });
 let journal=createV3Journal(manifest);
 journal=advanceV3(manifest,journal,{type:"RESERVE",taskId:TASK},0);
 if(status!=="RESERVED")
  journal=advanceV3(manifest,journal,{type:"DISPATCH_INTENT",taskId:TASK},1);
 const registry=wrongGlobal?createAdmissionRegistry():
  advanceAdmissionRegistry(createAdmissionRegistry(),{
   type:"ADMIT",claim:{waveId:WAVE,manifestHash:contentSha256(manifest),
    ownerRunId:OWNER,originSha:MAIN}
  },0);
 const policies=[
  rule(1,"refs/heads/main",
   ["pull_request","required_status_checks","deletion","non_fast_forward"]),
  rule(2,invalidRules?"refs/heads/asf/control/unprotected":
   ADMISSION_REGISTRY_REF,["creation","update"],[{
   actor_type:"Integration",actor_id:5361227,bypass_mode:"always"
  }]),
  rule(3,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"])
 ];
 const calls=[],makeFile=(path,data)=>{
  const buf=Buffer.from(JSON.stringify(data));
  return {ok:true,data:{type:"file",path,encoding:"base64",
   size:buf.length,content:buf.toString("base64")}};
 };
 const get=async path=>{
  calls.push(path);
  if(path===fail)return {ok:false,status:503};
  if(path===BASE+"/actions/runs/"+RUN)return {ok:true,data:{
   id:Number(RUN),repository:{full_name:REPO},actor:{login:wrongRun?
    "some-user":BOT},path:PATH,event:"workflow_dispatch",
   head_branch:"main",head_sha:MAIN,run_attempt:1,
   status:"in_progress",conclusion:null
  }};
  if(path===BASE+"/rulesets")return {ok:true,data:policies.map(p=>({id:p.id}))};
  for(const p of policies)if(path===BASE+"/rulesets/"+p.id)
   return {ok:true,data:p};
  if(path===G_REF)return {ok:true,data:{
   ref:ADMISSION_REGISTRY_REF,object:{type:"commit",
    sha:movedGlobal&&calls.filter(x=>x===G_REF).length>1?DIFFERENT:G}
  }};
  if(path===W_REF)return {ok:true,data:{
   ref:"refs/heads/asf/waves/"+WAVE,object:{type:"commit",
    sha:movedWave&&calls.filter(x=>x===W_REF).length>1?DIFFERENT:W}
  }};
  if(path===M_REF)return {ok:true,data:{
   ref:"refs/heads/main",object:{type:"commit",
    sha:movedMain&&calls.filter(x=>x===M_REF).length>1?DIFFERENT:MAIN}
  }};
  if(path===BASE+"/contents/manifest.json?ref="+W)
   return makeFile("manifest.json",manifest);
  if(path===BASE+"/contents/journal.json?ref="+W)
   return makeFile("journal.json",malformedJournal?
    {...journal,revision:99}:journal);
  if(path===BASE+"/contents/registry.json?ref="+G)
   return makeFile("registry.json",corruptRegistry?
    {...registry,revision:99}:registry);
  return {ok:false,status:404};
 };
 const event=evt();
 if(wrongTask)event.inputs.task_id="TS-099";
 return {runner:run(),event,readClient:{get},calls,
  manifest,journal,registry};
}
const denied=r=>{
 for(const name of ["authorized","canAck","canClaim","canWrite",
  "canDispatch","canSpend","canRetry"])
  assert.equal(r[name],false,name);
};
test("child App run and globally admitted exact DISPATCH_PENDING wave => ACK proposal only",async()=>{
 const f=fixture();
 const r=await observeV3GithubChildAckReadiness(f);
 assert.equal(r.status,"child_ack_candidate_not_authorized",JSON.stringify({result:r,calls:f.calls,registry:f.registry}));
 assert.deepEqual(r.evidence.proposedAckEvent,{
  type:"ACK_CHILD",taskId:TASK,childRunId:RUN,runAttempt:1,
  workflowRef:WORKFLOW
 });
 assert.equal(r.evidence.reservationSha,W);
 assert.equal(r.evidence.waveId,WAVE);
 assert.equal(r.evidence.taskId,TASK);
 assert.equal(r.evidence.globalHeadSha,G);
 assert.equal(r.evidence.manifestHash,contentSha256(f.manifest));
 assert.equal(f.calls.filter(p=>p===G_REF).length,2);
 assert.equal(f.calls.filter(p=>p===W_REF).length,2);
 assert.equal(f.calls.filter(p=>p===M_REF).length,2);
 assert.ok(f.calls.every(p=>p.startsWith(BASE+"/")));
 denied(r);
});
test("inert child workflow invokes readonly ACK observer but ALWAYS ends in DENY",()=>{
 const s=readFileSync(
  new URL("../.github/workflows/agent-openspec-v3.yml",import.meta.url),"utf8");
 assert.match(s,/node scripts\/asf\/v3\/child-ack-readiness\.mjs verify/);
 assert.match(s,/node scripts\/asf\/v3\/workflow-runtime-preflight\.mjs child/);
 assert.match(s,/GH_TOKEN: \$\{\{ github\.token \}\}/);
 assert.match(s,/contents: read/);
 assert.match(s,/actions: read/);
 assert.doesNotMatch(s,/secrets\.|create-github-app-token|contents: write|OPENROUTER_API_KEY/);
});
test("child runtime data and sender must be native executor App and source main",async()=>{
 const cases=[
  {runner:{actor:"cedricmenec"}},{runner:{runAttempt:2}},
  {runner:{ref:"refs/heads/topic"}},{runner:{sha:"bad"}},
  {runner:{repository:"some/other"}},
  {runner:{workflowRef:REPO+"/.github/workflows/agent-openspec-v1.yml@refs/heads/main"}},
  {runner:{eventName:"repository_dispatch"}},{runner:{runId:"0"}},
  {event:{sender:{login:"cedricmenec"}}},
  {event:{repository:{full_name:"different/repo"}}},
  {event:{ref:"refs/heads/topic"}}
 ];
 for(const item of cases){
  const f=fixture();
  for(const key of Object.keys(item))f[key]={...f[key],...item[key]};
  const result=await observeV3GithubChildAckReadiness(f);
  assert.equal(result.status,"rejected",JSON.stringify(item));
  assert.equal(f.calls.length,0);
  denied(result);
 }
});
test("invalid reservation SHA, wave and task IDs stop without any REST request",async()=>{
 for(const [name,value] of [
  ["reservation_sha","x".repeat(40)],["reservation_sha",".."],
  ["wave_id","../main"],["task_id","../../etc/passwd"]
 ]){
  const f=fixture();f.event.inputs[name]=value;
  const r=await observeV3GithubChildAckReadiness(f);
  if(value==="x".repeat(40))
   assert.equal(r.status,"rejected");
  else assert.equal(r.status,"rejected");
  assert.equal(f.calls.length,0);denied(r);
 }
 const f=fixture();
 f.event.inputs.extra="malicious";
 const r=await observeV3GithubChildAckReadiness(f);
 assert.equal(r.status,"rejected");denied(r);
});
test("stale but well-formed reservation SHA is rejected after pinned wave read",async()=>{
 const f=fixture();
 f.event.inputs.reservation_sha=DIFFERENT;
 const r=await observeV3GithubChildAckReadiness(f);
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"child_reservation_sha_does_not_match_wave_tip");
 assert.equal(f.calls.includes(W_REF),true);denied(r);
});
test("a forged child REST run with wrong actor blocks before global registry access",async()=>{
 const f=fixture({wrongRun:true});
 const r=await observeV3GithubChildAckReadiness(f);
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"child_run_rest_identity_mismatch");
 assert.equal(f.calls.includes(G_REF),false);denied(r);
});
test("wrong ruleset or quarantined/unadmitted global root never ACKs an executor",async()=>{
 for(const options of [{invalidRules:true},{wrongGlobal:true},
  {corruptRegistry:true}]){
  const f=fixture(options);
  const r=await observeV3GithubChildAckReadiness(f);
  assert.notEqual(r.status,"child_ack_candidate_not_authorized");
  denied(r);
 }
});
test("reserved-but-not-dispatched or corrupt journal never ACKs",async()=>{
 for(const options of [{status:"RESERVED"},{malformedJournal:true},
  {wrongTask:true}]){
  const f=fixture(options);
  const r=await observeV3GithubChildAckReadiness(f);
  assert.notEqual(r.status,"child_ack_candidate_not_authorized");
  denied(r);
 }
});
test("a reference moving between reads cannot provide an ACK, nor can transport error",async()=>{
 for(const options of [{movedGlobal:true},{movedWave:true},
  {movedMain:true},{fail:BASE+"/rulesets/2"},
  {fail:BASE+"/contents/registry.json?ref="+G}]){
  const f=fixture(options);
  const r=await observeV3GithubChildAckReadiness(f);
  assert.notEqual(r.status,"child_ack_candidate_not_authorized");
  denied(r);
 }
});
test("there is never an ACK/CLAIM authority even with a valid mock",async()=>{
 const f=fixture();
 const r=await observeV3GithubChildAckReadiness(f);
 assert.equal(r.status,"child_ack_candidate_not_authorized");
 denied(r);
 const none=await observeV3GithubChildAckReadiness({
  ...f,readClient:null
 });
 assert.equal(none.status,"uncertain");denied(none);
});
