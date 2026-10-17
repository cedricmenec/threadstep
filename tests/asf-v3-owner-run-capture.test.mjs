import test from "node:test";
import assert from "node:assert/strict";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import {
 deriveV3OwnerCandidateSet,inspectV3RunnerOwnerCapture
} from "../scripts/asf/v3/owner-run-capture.mjs";
import { ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";

const REPO="cedricmenec/threadstep", BASE="repos/"+REPO;
const WORKFLOW=REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main";
const SOURCE="a".repeat(40), RUN_ID="80321";
const exampleIndex=()=>[
 {id:"TS-017",path:"backlog/tasks/TS-017.md",type:"product",
  status:"ready",automation:"allowed",risk:"low",depends_on:[],
  content_sha256:"c".repeat(64)},
 {id:"TS-016",path:"backlog/tasks/TS-016.md",type:"product",
  status:"on_hold",automation:"manual",risk:"unknown",depends_on:[],
  content_sha256:"b".repeat(64)},
 {id:"TS-015",path:"backlog/tasks/TS-015.md",type:"product",
  status:"ready",automation:"allowed",risk:"low",depends_on:[],
  content_sha256:"a".repeat(64)}
];
const expected=[{id:"TS-015",sha256:"a".repeat(64)},
 {id:"TS-017",sha256:"c".repeat(64)}];
function runner(){
 return {repository:REPO,actor:"cedricmenec",runId:RUN_ID,
  runAttempt:1,ref:"refs/heads/main",sha:SOURCE,
  workflowRef:WORKFLOW,eventName:"workflow_dispatch"};
}
function event(){
 return {repository:{full_name:REPO},sender:{login:"cedricmenec"},
  ref:"refs/heads/main",inputs:{
   wave_id:"wave-owner-017",model:"openrouter/deepseek/deepseek-v4.1-flash",
   max_task_starts:"1",auto_merge:"false",backlog_commit:SOURCE,
   candidate_set_sha256:contentSha256(expected)
  }};
}
function rule(id,ref,types,bypass=[]){
 return {id,source:REPO,target:"branch",enforcement:"active",
  conditions:{ref_name:{include:[ref],exclude:[]}},bypass_actors:bypass,
  rules:types.map(type=>type==="required_status_checks"?{
   type,parameters:{required_status_checks:[{context:"check"}]}
  }:{type})};
}
const fullMain=()=>rule(1,"refs/heads/main",[
 "pull_request","required_status_checks","deletion","non_fast_forward"]);
const writer=(id=5361227,ref=ADMISSION_REGISTRY_REF)=>rule(
 2,ref,["update"],[{actor_type:"Integration",actor_id:id,bypass_mode:"always"}]);
const immutable=(ref=ADMISSION_REGISTRY_REF)=>rule(
 3,ref,["deletion","non_fast_forward"]);
function mockReader({appId=5361227,fail=null,customRules=null}={}){
 const rules=customRules||[fullMain(),writer(appId),immutable()];
 const calls=[];
 const get=async path=>{
  calls.push(path);
  if(path===fail)return {ok:false};
  if(path===BASE+"/actions/runs/"+RUN_ID)return {ok:true,data:{
   id:Number(RUN_ID),repository:{full_name:REPO},
   actor:{login:"cedricmenec"},
   path:".github/workflows/backlog-orchestrator-v3.yml",
   event:"workflow_dispatch",head_branch:"main",head_sha:SOURCE,
   run_attempt:1,status:"in_progress",conclusion:null
  }};
  if(path===BASE+"/rulesets")return {ok:true,data:rules.map(r=>({id:r.id}))};
  for(const r of rules){
   if(path===BASE+"/rulesets/"+r.id)return {ok:true,data:r};
  }
  return {ok:false};
 };
 return {get,calls};
}
function fixture(patch={}){
 const reader=mockReader(patch.reader||{});
 return {runner:runner(),event:event(),index:exampleIndex(),
   readClient:reader,reader};
}
const noRights=r=>{
 for(const name of ["authorized","canCreate","canWrite","canDispatch",
  "canSpend","canRetry"])assert.equal(r[name],false,name);
};
test("canonical candidate hashes are ordered, independent of backlog index entry order",()=>{
 const c=deriveV3OwnerCandidateSet(exampleIndex());
 assert.deepEqual(c,expected);
 assert.equal(contentSha256(c),contentSha256(expected));
 assert.deepEqual(deriveV3OwnerCandidateSet(exampleIndex().reverse()),expected);
 assert.ok(Object.isFrozen(c)&&c.every(Object.isFrozen));
});
test("actual owner GitHub run, protected rulesets and all inputs are ONLY evidence",async()=>{
 const f=fixture();
 const r=await inspectV3RunnerOwnerCapture(f);
 assert.equal(r.status,"owner_intent_observed_no_write",JSON.stringify(r));
 assert.equal(r.evidence.controllerAppId,5361227);
 assert.equal(r.evidence.candidateCount,2);
 assert.equal(r.evidence.originSha,SOURCE);
 assert.equal(r.evidence.candidateSetHash,contentSha256(expected));
 assert.equal(r.evidence.ownerRunId,RUN_ID);
 assert.deepEqual(f.reader.calls,[BASE+"/actions/runs/"+RUN_ID,
   BASE+"/rulesets",BASE+"/rulesets/1",BASE+"/rulesets/2",BASE+"/rulesets/3"]);
 noRights(r);
 assert.equal(Object.hasOwn(r,"permit"),false);
});
test("all six owner inputs are independently checked, never authorize bad parameters",async()=>{
 const variants=[
  {wave_id:"../unsafe"},{model:"openrouter/model/unknown"},
  {max_task_starts:"11"},{max_task_starts:"01"},
  {auto_merge:"false-ish"},{backlog_commit:"b".repeat(40)},
  {candidate_set_sha256:"f".repeat(64)},
  {extra:"oops"}
 ];
 for(const input of variants){
  const f=fixture();
  f.event.inputs={...f.event.inputs,...input};
  const r=await inspectV3RunnerOwnerCapture(f);
  assert.equal(r.status,"rejected",JSON.stringify(input));
  assert.deepEqual(f.reader.calls,[],JSON.stringify(input));
  noRights(r);
 }
});
test("owner can choose a different VALID wave, approved model, quota and merge boolean",async()=>{
 const f=fixture();
 f.event.inputs={
  ...f.event.inputs,wave_id:"wave-owner-unique-2026",
  model:"openrouter/z-ai/glm-5.3-flash",
  max_task_starts:"10",auto_merge:"true"
 };
 const r=await inspectV3RunnerOwnerCapture(f);
 assert.equal(r.status,"owner_intent_observed_no_write",JSON.stringify(r));
 assert.equal(r.evidence.waveId,"wave-owner-unique-2026");
 noRights(r);
});
test("context must come from owner workflow_dispatch in protected main, first attempt",async()=>{
 const variants=[
  {runner:{actor:"attacker"}},{runner:{runAttempt:2}},
  {runner:{ref:"refs/heads/feature"}},{runner:{sha:"b".repeat(40)}},
  {runner:{workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/feat"}},
  {runner:{eventName:"repository_dispatch"}},{runner:{repository:"another/repo"}},
  {runner:{runId:"0"}},{event:{sender:{login:"attacker"}}},
  {event:{repository:{full_name:"another/repo"}}},
  {event:{ref:"refs/heads/feature"}}
 ];
 for(const item of variants){
  const f=fixture();
  for(const key of Object.keys(item))
   f[key]={...f[key],...item[key]};
  const r=await inspectV3RunnerOwnerCapture(f);
  assert.equal(r.status,"rejected",JSON.stringify(item));
  assert.equal(f.reader.calls.length,0);
  noRights(r);
 }
});
test("even matching event inputs fail if candidate selection or hash can differ",async()=>{
 const variants=[
  [...exampleIndex(),exampleIndex()[0]],
  exampleIndex().map((r,i)=>i===2?{...r,status:"on_hold"}:r),
  exampleIndex().map((r,i)=>i===0?{...r,content_sha256:"d".repeat(64)}:r),
  exampleIndex().map((r,i)=>i===0?{...r,depends_on:["TS-001"]}:r)
 ];
 for(const index of variants){
  const f=fixture();
  const r=await inspectV3RunnerOwnerCapture({...f,index});
  assert.equal(r.status,"rejected");
  assert.equal(f.reader.calls.length,0);
  noRights(r);
 }
 assert.throws(()=>deriveV3OwnerCandidateSet([]));
 assert.throws(()=>deriveV3OwnerCandidateSet([
  {...exampleIndex()[0],path:"attacker/readme.md"}
 ]));
});
test("controller ruleset must pin to 5361227, never V1 executor 5321746",async()=>{
 for(const appId of [5321746,5361228,42]){
  const f=fixture({reader:{appId}});
  const r=await inspectV3RunnerOwnerCapture(f);
  assert.equal(r.status,"rejected");
  assert.equal(r.reason,"effective_ruleset_structure_missing");
  noRights(r);
 }
});
test("misconfigured rulesets from live observations fail closed",async()=>{
 for(const customRules of [
  [fullMain(),writer(5361227,"refs/heads/refs/heads/asf/control/active-wave-v3"),immutable()],
  [fullMain(),writer(),immutable("refs/heads/refs/heads/asf/control/active-wave-v3,")],
  [fullMain(),writer(),{...immutable(),bypass_actors:[
   {actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]}],
  [fullMain(),writer()]
 ]){
  const f=fixture({reader:{customRules}});
  const r=await inspectV3RunnerOwnerCapture(f);
  assert.equal(r.status,"rejected");
  noRights(r);
 }
});
test("read permissions missing and GitHub API uncertainty remain NON-authorizing",async()=>{
 const f=fixture({reader:{fail:BASE+"/actions/runs/"+RUN_ID}});
 const a=await inspectV3RunnerOwnerCapture(f);
 assert.equal(a.status,"uncertain");noRights(a);
 const g=fixture({reader:{fail:BASE+"/rulesets/2"}});
 const b=await inspectV3RunnerOwnerCapture(g);
 assert.equal(b.status,"uncertain");noRights(b);
 const c=await inspectV3RunnerOwnerCapture({...g,readClient:null});
 assert.equal(c.status,"uncertain");noRights(c);
});
test("runner may accept normalized GH event ref 'main' but never an uncontrolled branch",async()=>{
 const f=fixture();
 f.event.ref="main";
 const r=await inspectV3RunnerOwnerCapture(f);
 assert.equal(r.status,"owner_intent_observed_no_write");
 noRights(r);
});
