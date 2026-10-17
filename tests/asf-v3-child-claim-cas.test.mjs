import test from "node:test";
import assert from "node:assert/strict";
import { observeV3GithubChildClaimReadiness,
 attemptV3GithubChildClaimCAS }
 from "../scripts/asf/v3/child-claim-cas.mjs";
import { createV3Manifest,createV3Journal,advanceV3 }
 from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
const R="cedricmenec/threadstep",B="repos/"+R,S=c=>c.repeat(40);
const G=S("1"),RES=S("2"),ACK=S("3"),NEXT=S("4"),
 MAIN=S("a"),TREE=S("5"),OTHER=S("f");
const WAVE="wave-child-claim-cas-025",TASK="TS-016";
const OWNER="90001",CHILD="90002";
const BOT="threadstep-software-factory[bot]";
const PATH=".github/workflows/agent-openspec-v3.yml";
const WORKFLOW=R+"/"+PATH+"@refs/heads/main";
const WREF="refs/heads/asf/waves/"+WAVE;
const refRule=(id,ref,types,bypass=[])=>({
 id,source:R,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,
 rules:types.map(type=>type==="required_status_checks"?
 {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
});
const asFile=(path,obj)=>{const bytes=Buffer.from(JSON.stringify(obj));
 return {ok:true,data:{type:"file",path,encoding:"base64",
  content:bytes.toString("base64"),size:bytes.length}};};
function fixture({wrongParent=false,wrongActor=false,wrongGlobal=false,
 corruptedAck=false,lostPatch=false,sibling=false,
 forgedClaim=false,stale=false,wrongApp=false,postCorrupt=false}={}){
 const m=createV3Manifest({waveId:WAVE,repository:R,
  backlogCommit:MAIN,model:"openrouter/deepseek/deepseek-v4.1-flash",
  maxTaskStarts:1,autoMerge:false,
  candidateTasks:[{id:TASK,sha256:"e".repeat(64)}],
  authorization:{runId:OWNER,actor:"cedricmenec",
   workflowRef:R+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
   sourceSha:MAIN}});
 let j=createV3Journal(m);
 for(const ev of [
  {type:"RESERVE",taskId:TASK},
  {type:"DISPATCH_INTENT",taskId:TASK},
  {type:"ACK_CHILD",taskId:TASK,childRunId:CHILD,
   workflowRef:WORKFLOW,runAttempt:1}
 ])j=advanceV3(m,j,ev,j.revision);
 const global=wrongGlobal?createAdmissionRegistry():
  advanceAdmissionRegistry(createAdmissionRegistry(),{
   type:"ADMIT",claim:{waveId:WAVE,manifestHash:contentSha256(m),
    ownerRunId:OWNER,originSha:MAIN}},0);
 const rules=[
  refRule(1,"refs/heads/main",["pull_request","required_status_checks",
   "deletion","non_fast_forward"]),
  refRule(2,ADMISSION_REGISTRY_REF,["creation","update"],[
   {actor_type:"Integration",actor_id:wrongApp?5321746:5361227,
    bypass_mode:"always"}
  ]),
  refRule(3,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"])
 ];
 const st={head:ACK,journal:j,next:null,calls:[],patches:0,reads:[]};
 const WPATH=B+"/git/ref/heads/asf/waves/"+WAVE;
 const get=async path=>{
  st.reads.push(path);
  if(path===B+"/actions/runs/"+CHILD)return {ok:true,data:{
   id:Number(CHILD),repository:{full_name:R},
   actor:{login:wrongActor?"not-app":BOT},path:PATH,
   event:"workflow_dispatch",head_branch:"main",head_sha:MAIN,
   run_attempt:1,status:"in_progress"
  }};
  if(path===B+"/rulesets")return {ok:true,data:rules.map(x=>({id:x.id}))};
  for(const x of rules)if(path===B+"/rulesets/"+x.id)
   return {ok:true,data:x};
  if(path===B+"/git/ref/heads/asf/control/active-wave-v3")
   return {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
    object:{type:"commit",sha:G}}};
  if(path===B+"/git/ref/heads/main")return {ok:true,data:{
   ref:"refs/heads/main",object:{type:"commit",sha:MAIN}}};
  if(path===WPATH)return {ok:true,data:{
   ref:WREF,object:{type:"commit",sha:st.head}}};
  if(path===B+"/contents/manifest.json?ref="+ACK||
     path===B+"/contents/manifest.json?ref="+NEXT)
   return asFile("manifest.json",m);
  if(path===B+"/contents/journal.json?ref="+ACK)
   return asFile("journal.json",corruptedAck?{...j,revision:20}:j);
  if(path===B+"/contents/journal.json?ref="+NEXT)
   return asFile("journal.json",postCorrupt?{...st.next,revision:88}:st.next);
  if(path===B+"/contents/registry.json?ref="+G)
   return asFile("registry.json",global);
  if(path===B+"/git/commits/"+ACK)return {ok:true,data:{
   sha:ACK,tree:{sha:TREE},parents:[{sha:wrongParent?OTHER:RES}]
  }};
  return {ok:false,status:404};
 };
 const port={
  async getRef(ref){st.calls.push("getRef");assert.equal(ref,WREF);
   return {sha:st.head};},
  async getCommit(sha){st.calls.push("getCommit");return sha===ACK?
   {sha,treeSha:TREE,parents:[RES]}:
   {sha:NEXT,treeSha:OTHER,parents:[ACK]};},
  async createTree({baseTreeSha,files}){
   st.calls.push("createTree");assert.equal(baseTreeSha,TREE);
   assert.equal(files[0].path,"journal.json");
   st.next=JSON.parse(files[0].content);
   return {sha:OTHER};
  },
  async createCommit({treeSha,parents}){
   st.calls.push("createCommit");
   assert.equal(treeSha,OTHER);assert.deepEqual(parents,[ACK]);
   return {sha:NEXT};
  },
  async updateRef({ref,sha,force}){
   st.calls.push("updateRef");assert.equal(ref,WREF);
   assert.equal(sha,NEXT);assert.equal(force,false);
   st.patches++;
   if(sibling){st.head=OTHER;throw Error("sibling collision");}
   st.head=NEXT;
   if(lostPatch)throw Error("ambiguous PATCH");
  }
 };
 const runner={repository:R,actor:BOT,eventName:"workflow_dispatch",
  runAttempt:1,workflowRef:WORKFLOW,ref:"refs/heads/main",
  runId:CHILD,sha:MAIN};
 const event={repository:{full_name:R},sender:{login:BOT},
  ref:"refs/heads/main",inputs:{
   wave_id:WAVE,task_id:forgedClaim?"TS-017":TASK,
   reservation_sha:stale?OTHER:RES
  }};
 return {runner,event,readClient:{get},waveGitPort:port,st};
}
const noRights=r=>{
 for(const k of ["authorized","canClaim","canAck","canWrite",
  "canDispatch","canSpend","canRetry"])assert.equal(r[k],false,k);
};
test("persisted ACK exact parent and owner root yields only claim candidate",async()=>{
 const f=fixture(),r=await observeV3GithubChildClaimReadiness(f);
 assert.equal(r.status,"child_claim_candidate_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.ackHeadSha,ACK);
 assert.equal(r.evidence.reservationSha,RES);
 assert.equal(r.evidence.proposedClaimEvent.type,"CLAIM_CHILD");
 assert.equal(f.st.reads.includes(B+"/git/commits/"+ACK),true);
 noRights(r);
});
test("valid CLAIM CAS moves journal to EXECUTING with one fast-forward",async()=>{
 const f=fixture(),r=await attemptV3GithubChildClaimCAS(f);
 assert.equal(r.status,"persisted",JSON.stringify({r,st:f.st}));
 assert.equal(f.st.patches,1);
 assert.equal(f.st.head,NEXT);
 assert.equal(f.st.next.status,"EXECUTING");
 assert.equal(f.st.next.active.childRunId,CHILD);
 assert.equal(f.st.next.events.at(-1).type,"CLAIM_CHILD");
 noRights(r);
});
test("wrong ACK parent, wrong App, forged run, false claim, stale reservation and corrupted journal never write",async()=>{
 for(const options of [{wrongParent:true},{wrongApp:true},
  {wrongActor:true},{forgedClaim:true},{stale:true},
  {corruptedAck:true},{wrongGlobal:true}]){
  const f=fixture(options),r=await attemptV3GithubChildClaimCAS(f);
  assert.notEqual(r.status,"persisted",JSON.stringify(options));
  assert.equal(f.st.patches,0);
  assert.equal(f.st.calls.length,0);
  noRights(r);
 }
});
test("lost PATCH response even after ref moved is uncertain with zero retries",async()=>{
 const f=fixture({lostPatch:true}),r=await attemptV3GithubChildClaimCAS(f);
 assert.equal(r.status,"uncertain");assert.equal(f.st.patches,1);
 assert.equal(f.st.head,NEXT);noRights(r);
});
test("sibling writer conflict blocks claim and never retries",async()=>{
 const f=fixture({sibling:true}),r=await attemptV3GithubChildClaimCAS(f);
 assert.notEqual(r.status,"persisted");assert.equal(f.st.patches,1);
 assert.equal(f.st.head,OTHER);noRights(r);
});
test("bad journal readback after ACK CAS never grants paid authority",async()=>{
 const f=fixture({postCorrupt:true}),r=await attemptV3GithubChildClaimCAS(f);
 assert.equal(r.status,"uncertain");assert.equal(f.st.patches,1);
 noRights(r);
});
test("repeated CLAIM on already advanced ref cannot claim twice",async()=>{
 const f=fixture(),a=await attemptV3GithubChildClaimCAS(f);
 assert.equal(a.status,"persisted");
 const b=await attemptV3GithubChildClaimCAS(f);
 assert.notEqual(b.status,"persisted");
 assert.equal(f.st.patches,1);noRights(b);
});
