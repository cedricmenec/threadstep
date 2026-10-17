import test from "node:test";
import assert from "node:assert/strict";
import { attemptV3GithubChildAckCAS }
 from "../scripts/asf/v3/child-ack-cas.mjs";
import { createV3Manifest,createV3Journal,advanceV3 }
 from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";

const R="cedricmenec/threadstep",B="repos/"+R,S=c=>c.repeat(40);
const G=S("1"),W=S("2"),NEW=S("3"),MAIN=S("a"),TREE=S("4");
const WAVE="wave-child-ack-cas-024",TASK="TS-015",OWNER="9001",CHILD="9002";
const BOT="threadstep-software-factory[bot]";
const WF=R+"/.github/workflows/agent-openspec-v3.yml@refs/heads/main";
const WR="refs/heads/asf/waves/"+WAVE,GR=ADMISSION_REGISTRY_REF;
const GPATH=B+"/git/ref/heads/asf/control/active-wave-v3";
const WPATH=B+"/git/ref/heads/asf/waves/"+WAVE;
const M_PATH=B+"/git/ref/heads/main";
const rules=(id,ref,types,bypass=[])=>({id,source:R,target:"branch",
 enforcement:"active",conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,rules:types.map(type=>
 type==="required_status_checks"?
 {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})});
const file=(path,obj)=>{const b=Buffer.from(JSON.stringify(obj));return {
 ok:true,data:{type:"file",path,encoding:"base64",
 size:b.length,content:b.toString("base64")}
};};
function fixture({lostPatch=false,sibling=false,stale=false,
 forgedJournal=false,wrongApp=false,afterCorrupt=false,
 wrongActor=false,wrongGlobal=false}={}){
 const m=createV3Manifest({waveId:WAVE,repository:R,
 backlogCommit:MAIN,model:"openrouter/deepseek/deepseek-v4.1-flash",
 autoMerge:false,maxTaskStarts:1,
 candidateTasks:[{id:TASK,sha256:"f".repeat(64)}],
 authorization:{runId:OWNER,actor:"cedricmenec",
 workflowRef:R+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
 sourceSha:MAIN}});
 let j=createV3Journal(m);
 j=advanceV3(m,j,{type:"RESERVE",taskId:TASK},0);
 j=advanceV3(m,j,{type:"DISPATCH_INTENT",taskId:TASK},1);
 const global=wrongGlobal?createAdmissionRegistry():
 advanceAdmissionRegistry(createAdmissionRegistry(),{
  type:"ADMIT",claim:{waveId:WAVE,manifestHash:contentSha256(m),
   ownerRunId:OWNER,originSha:MAIN}},0);
 const state={head:W,journal:j,commit:null,calls:[],patches:0,reads:[],
  staged:null};
 const p=[
  rules(1,"refs/heads/main",["pull_request","required_status_checks",
   "deletion","non_fast_forward"]),
  rules(2,GR,["creation","update"],[{actor_type:"Integration",
   actor_id:wrongApp?5321746:5361227,bypass_mode:"always"}]),
  rules(3,GR,["deletion","non_fast_forward"])
 ];
 const get=async path=>{
  state.reads.push(path);
  if(path===B+"/actions/runs/"+CHILD)return {ok:true,data:{
   id:Number(CHILD),repository:{full_name:R},
   actor:{login:wrongActor?"other":BOT},
   path:".github/workflows/agent-openspec-v3.yml",
   event:"workflow_dispatch",head_branch:"main",head_sha:MAIN,
   run_attempt:1,status:"in_progress"
  }};
  if(path===B+"/rulesets")return {ok:true,data:p.map(x=>({id:x.id}))};
  for(const x of p)if(path===B+"/rulesets/"+x.id)return {ok:true,data:x};
  if(path===GPATH)return {ok:true,data:{
   ref:GR,object:{type:"commit",sha:G}}};
  if(path===M_PATH)return {ok:true,data:{
   ref:"refs/heads/main",object:{type:"commit",sha:MAIN}}};
  if(path===WPATH)return {ok:true,data:{ref:WR,
   object:{type:"commit",sha:state.head}}};
  if(path===B+"/contents/manifest.json?ref="+state.head)
   return file("manifest.json",m);
  if(path.startsWith(B+"/contents/manifest.json?ref="))
   return file("manifest.json",m);
  if(path===B+"/contents/journal.json?ref="+W){
   if(forgedJournal)return file("journal.json",{...j,revision:99});
   return file("journal.json",j);
  }
  if(path===B+"/contents/journal.json?ref="+NEW)
   return file("journal.json",afterCorrupt?
    {...state.staged,revision:99}:state.staged);
  if(path===B+"/contents/registry.json?ref="+G)
   return file("registry.json",global);
  return {ok:false,status:404};
 };
 const port={
  async getRef(ref){
   state.calls.push("getRef");
   assert.equal(ref,WR);
   return {sha:state.head};
  },
  async getCommit(sha){
   state.calls.push("getCommit");
   if(sha===W)return {sha,treeSha:TREE,parents:[MAIN]};
   if(sha===NEW)return {sha,treeSha:S("5"),parents:[W]};
   return null;
  },
  async createTree({baseTreeSha,files}){
   state.calls.push("createTree");
   assert.equal(baseTreeSha,TREE);
   assert.equal(files.length,1);
   assert.equal(files[0].path,"journal.json");
   state.staged=JSON.parse(files[0].content);
   return {sha:S("5")};
  },
  async createCommit({treeSha,parents}){
   state.calls.push("createCommit");
   assert.equal(treeSha,S("5"));
   assert.deepEqual(parents,[W]);
   return {sha:NEW};
  },
  async updateRef({ref,sha,force}){
   state.calls.push("updateRef");
   state.patches++;
   assert.equal(ref,WR);assert.equal(sha,NEW);
   assert.equal(force,false);
   if(sibling){state.head=S("e");throw Error("fast-forward conflict");}
   state.head=NEW;
   if(lostPatch)throw Error("PATCH response lost");
  }
 };
 const runner={repository:R,actor:BOT,eventName:"workflow_dispatch",
  runAttempt:1,workflowRef:WF,ref:"refs/heads/main",runId:CHILD,sha:MAIN};
 const event={repository:{full_name:R},sender:{login:BOT},
  ref:"refs/heads/main",inputs:{
   wave_id:WAVE,task_id:TASK,reservation_sha:stale?S("e"):W
  }};
 return {runner,event,readClient:{get},waveGitPort:port,state};
}
const noRights=r=>{
 for(const key of ["authorized","canAck","canClaim","canWrite",
 "canDispatch","canSpend","canRetry"])assert.equal(r[key],false,key);
};
test("ACK persisted by one wave-only CAS, exact snapshot after readback",async()=>{
 const f=fixture();
 const r=await attemptV3GithubChildAckCAS(f);
 assert.equal(r.status,"persisted",JSON.stringify({r,calls:f.state.calls}));
 assert.equal(r.previousWaveSha,W);
 assert.equal(r.newWaveSha,NEW);
 assert.equal(f.state.staged.status,"CHILD_ACKNOWLEDGED");
 assert.equal(f.state.staged.active.childRunId,CHILD);
 assert.equal(f.state.staged.events.at(-1).type,"ACK_CHILD");
 assert.equal(f.state.patches,1);assert.equal(f.state.head,NEW);
 assert.equal(f.state.calls.filter(x=>x==="updateRef").length,1);
 noRights(r);
});
test("lost PATCH response must stop even when ref changed successfully",async()=>{
 const f=fixture({lostPatch:true});
 const r=await attemptV3GithubChildAckCAS(f);
 assert.equal(r.status,"uncertain");assert.equal(f.state.head,NEW);
 assert.equal(f.state.patches,1);noRights(r);
});
test("concurrent sibling wave update prevents ACK and no auto-retry",async()=>{
 const f=fixture({sibling:true});
 const r=await attemptV3GithubChildAckCAS(f);
 assert.notEqual(r.status,"persisted");
 assert.equal(f.state.patches,1);assert.equal(f.state.head,S("e"));
 noRights(r);
});
test("invalid metadata, wrong App, wrong actor, existing global not active, tampered journal => no writes",async()=>{
 for(const opt of [{stale:true},{wrongApp:true},{wrongActor:true},
  {wrongGlobal:true},{forgedJournal:true}]){
  const f=fixture(opt);
  const r=await attemptV3GithubChildAckCAS(f);
  assert.notEqual(r.status,"persisted",JSON.stringify(opt));
  assert.equal(f.state.patches,0);
  assert.equal(f.state.calls.length,0);
  noRights(r);
 }
});
test("corrupt contents after confirmed PATCH are UNCERTAIN, never paid or retried",async()=>{
 const f=fixture({afterCorrupt:true});
 const r=await attemptV3GithubChildAckCAS(f);
 assert.equal(r.status,"uncertain",JSON.stringify(r));
 assert.equal(f.state.patches,1);
 noRights(r);
});
test("missing port rejects before any Git mutation",async()=>{
 const f=fixture();
 const r=await attemptV3GithubChildAckCAS({...f,waveGitPort:null});
 assert.equal(r.status,"rejected");noRights(r);
 assert.equal(f.state.calls.length,0);
});
test("a second ACK on the already updated wave ref is refused before another write",async()=>{
 const f=fixture();
 const first=await attemptV3GithubChildAckCAS(f);
 assert.equal(first.status,"persisted");
 const second=await attemptV3GithubChildAckCAS(f);
 assert.notEqual(second.status,"persisted");
 assert.equal(f.state.patches,1);
 noRights(second);
});
