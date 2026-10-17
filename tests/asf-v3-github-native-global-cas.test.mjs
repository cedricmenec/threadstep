import test from "node:test";
import assert from "node:assert/strict";
import { createV3Manifest } from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry, ADMISSION_REGISTRY_REF }
 from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { attemptV3GithubNativeAdmission }
 from "../scripts/asf/v3/github-native-global-cas.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const REF=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const PATCH=BASE+"/git/refs/heads/asf/control/active-wave-v3";
const SHA=c=>c.repeat(40);
const ROOT=SHA("1"),TREE=SHA("2"),NEXTTREE=SHA("3"),NEXT=SHA("4");
const manifest=()=>createV3Manifest({
 waveId:"wave-native-cas",repository:REPO,backlogCommit:SHA("a"),
 model:"openrouter/deepseek/deepseek-v4.1-flash",autoMerge:false,
 maxTaskStarts:3,candidateTasks:[{id:"TS-001",sha256:"b".repeat(64)}],
 authorization:{runId:"70001",actor:"cedricmenec",
  workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
  sourceSha:SHA("a")}
});
const rule=(id,ref,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,
 rules:types.map(type=>type==="required_status_checks"?
 {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
});
function fixture({lostPatch=false,concurrent=false,malformed=false}={}){
 const m=manifest(),calls=[];
 const state={head:ROOT,docs:new Map([[ROOT,createAdmissionRegistry()]])};
 const context={
  repository:REPO,runId:"70001",runAttempt:1,actor:"cedricmenec",
  workflowRef:m.authorization.workflowRef,eventName:"workflow_dispatch",
  ref:"refs/heads/main",sha:SHA("a"),
  inputs:{wave_id:m.waveId,model:m.model,max_task_starts:"3",
   auto_merge:"false",backlog_commit:SHA("a"),
   candidate_set_sha256:contentSha256(m.candidateTasks)}
 };
 const reader={get:async path=>{
  calls.push("GET "+path);
  if(path===BASE+"/actions/runs/70001")return {ok:true,data:{
   id:70001,repository:{full_name:REPO},actor:{login:"cedricmenec"},
   event:"workflow_dispatch",path:".github/workflows/backlog-orchestrator-v3.yml",
   head_branch:"main",head_sha:SHA("a"),run_attempt:1,status:"in_progress"}};
  if(path===BASE+"/rulesets")return {ok:true,data:[{id:1},{id:2},{id:3}]};
  if(path===BASE+"/rulesets/1")return {ok:true,data:rule(1,"refs/heads/main",
   ["pull_request","required_status_checks","deletion","non_fast_forward"])};
  if(path===BASE+"/rulesets/2")return {ok:true,data:rule(2,ADMISSION_REGISTRY_REF,
   ["creation","update"],
   [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}])};
  if(path===BASE+"/rulesets/3")return {ok:true,data:rule(3,ADMISSION_REGISTRY_REF,
   ["deletion","non_fast_forward"])};
  if(path===REF)return {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
   object:{type:"commit",sha:state.head}}};
  if(path===BASE+"/git/commits/"+ROOT)return {ok:true,data:{
   sha:ROOT,tree:{sha:TREE},parents:[{sha:SHA("a")}] }};
  const prefix=BASE+"/contents/registry.json?ref=";
  if(path.startsWith(prefix)){
   const value=state.docs.get(path.slice(prefix.length));
   if(!value)return {ok:false};
   const buf=Buffer.from(JSON.stringify(value));
   return {ok:true,data:{type:"file",path:"registry.json",
    encoding:"base64",size:buf.length,content:buf.toString("base64")}};
  }
  return {ok:false};
 }};
 const writer=async({method,path,body})=>{
  calls.push(method+" "+path);
  if(method==="POST"&&path===BASE+"/git/trees"){
   assert.equal(body.base_tree,TREE);
   assert.equal(body.tree.length,1);
   assert.equal(body.tree[0].path,"registry.json");
   assert.equal(body.tree[0].mode,"100644");
   const written=JSON.parse(body.tree[0].content);
   if(malformed)written.revision=999;
   state.docs.set(NEXT,written);
   return {sha:NEXTTREE};
  }
  if(method==="POST"&&path===BASE+"/git/commits"){
   assert.deepEqual(body.parents,[ROOT]);
   assert.equal(body.tree,NEXTTREE);
   return {sha:NEXT,tree:{sha:NEXTTREE},parents:[{sha:ROOT}]};
  }
  if(method==="PATCH"&&path===PATCH){
   assert.deepEqual(body,{sha:NEXT,force:false});
   if(concurrent)state.head=SHA("f");
   else state.head=NEXT;
   if(lostPatch)throw Error("network-response-lost");
   if(concurrent)throw Error("non-fast-forward");
   return {ref:ADMISSION_REGISTRY_REF,
    object:{type:"commit",sha:NEXT}};
  }
  throw Error("unexpected-write");
 };
 return {manifest:m,ownerContext:context,readClient:reader,
  writeTransport:writer,calls,state};
}
function noSpend(result){
 for(const k of ["authorized","canSpend","canDispatch","canRetry"])
  assert.equal(result[k],false);
}
test("one protected owner ADMIT uses one fast-forward CAS; even persisted is not permission",async()=>{
 const f=fixture();
 const r=await attemptV3GithubNativeAdmission(f);
 assert.equal(r.status,"persisted",JSON.stringify(r));
 assert.equal(r.revision,1);
 assert.equal(r.headSha,NEXT);
 assert.equal(f.state.head,NEXT);
 assert.equal(f.state.docs.get(NEXT).active.waveId,f.manifest.waveId);
 assert.equal(f.calls.filter(x=>x.startsWith("PATCH ")).length,1);
 noSpend(r);
});
test("lost PATCH response or racing sibling cannot trigger a retry or paid step",async()=>{
 for(const scenario of [{lostPatch:true},{concurrent:true}]){
  const f=fixture(scenario);
  const r=await attemptV3GithubNativeAdmission(f);
  assert.equal(r.status,"uncertain");
  assert.match(r.code,/global_git_response_uncertain_at_patch/);
  assert.equal(f.calls.filter(x=>x.startsWith("PATCH ")).length,1);
  noSpend(r);
 }
});
test("replay rejects corrupted ref content before a writer is invoked",async()=>{
 const f=fixture();
 f.state.docs.set(ROOT,{...createAdmissionRegistry(),revision:100});
 const r=await attemptV3GithubNativeAdmission(f);
 assert.notEqual(r.status,"persisted");
 assert.equal(f.calls.some(x=>x.startsWith("POST ")||x.startsWith("PATCH ")),false);
 noSpend(r);
});
test("fake run identity must not reach any Git mutation",async()=>{
 const f=fixture();
 f.ownerContext.actor="some-other-account";
 const r=await attemptV3GithubNativeAdmission(f);
 assert.equal(r.status,"rejected");
 assert.equal(f.calls.some(x=>x.startsWith("POST ")||x.startsWith("PATCH ")),false);
 noSpend(r);
});
test("missing write transport fails before any GitHub observation",async()=>{
 const f=fixture();
 const r=await attemptV3GithubNativeAdmission({...f,writeTransport:null});
 assert.equal(r.status,"rejected");
 assert.equal(f.calls.length,0);
 noSpend(r);
});
