import test from "node:test";
import assert from "node:assert/strict";
import {attemptV3GithubChildWaveCAS}
 from "../scripts/asf/v3/github-native-child-wave-cas.mjs";
import {observeV3GithubChildClaimReadiness}
 from "../scripts/asf/v3/child-ack-readiness.mjs";
import {createAsfV3GitDataPort}
 from "../scripts/asf/v3/github-git-data-port.mjs";
import {createV3Manifest,createV3Journal,advanceV3}
 from "../scripts/asf/v3/lifecycle.mjs";
import {createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF} from "../scripts/asf/v3/global-admission.mjs";
import {contentSha256} from "../scripts/asf/waves/hash.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const S=c=>c.repeat(40),ORIGIN=S("a"),GLOBAL=S("1");
const RESERVATION=S("2"),ACK=S("3"),CLAIM=S("4"),RACE=S("f");
const WAVE="wave-ack-claim-cas-024",TASK="TS-018",RUN="91827";
const OWNER="81271",BOT="threadstep-software-factory[bot]";
const WF=".github/workflows/agent-openspec-v3.yml";
const REF="refs/heads/asf/waves/"+WAVE,REST_W=BASE+"/git/ref/heads/asf/waves/"+WAVE;
const G=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const M=BASE+"/git/ref/heads/main";
const context=()=>({repository:REPO,actor:BOT,eventName:"workflow_dispatch",
 runAttempt:1,workflowRef:REPO+"/"+WF+"@refs/heads/main",
 ref:"refs/heads/main",runId:RUN,sha:ORIGIN});
const event=()=>({repository:{full_name:REPO},sender:{login:BOT},
 ref:"refs/heads/main",inputs:{wave_id:WAVE,task_id:TASK,
 reservation_sha:RESERVATION}});
const rule=(id,ref,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,rules:types.map(type=>type==="required_status_checks"?
 {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
});
function fixture({wrongApp=false,wrongRun=false,corruptGlobal=false,
 patchLost=false,patchConflict=false,spoofPatch=false,
 driftAfterSecond=false,corruptReadback=false,
 wrongAckParent=false,ackMultipleParents=false,wrongGitCommit=false,
 missingWaveRules=false,wrongWaveApp=false,immutableWaveBypass=false,
 waveRulesChangeDuringCheck=false}={}){
 const manifest=createV3Manifest({
  waveId:WAVE,repository:REPO,backlogCommit:ORIGIN,
  model:"openrouter/deepseek/deepseek-v4.1-flash",
  autoMerge:false,maxTaskStarts:1,candidateTasks:[
   {id:TASK,sha256:"b".repeat(64)}],
  authorization:{runId:OWNER,actor:"cedricmenec",
   workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
   sourceSha:ORIGIN}
 });
 let j=createV3Journal(manifest);
 j=advanceV3(manifest,j,{type:"RESERVE",taskId:TASK},0);
 j=advanceV3(manifest,j,{type:"DISPATCH_INTENT",taskId:TASK},1);
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),{
  type:"ADMIT",claim:{waveId:WAVE,manifestHash:contentSha256(manifest),
   ownerRunId:OWNER,originSha:ORIGIN}
 },0);
 const policies=[
  rule(1,"refs/heads/main",["pull_request","required_status_checks",
   "deletion","non_fast_forward"]),
  rule(2,ADMISSION_REGISTRY_REF,["creation","update"],[{
   actor_type:"Integration",actor_id:wrongApp?5321746:5361227,
   bypass_mode:"always"}]),
  rule(3,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"]),
  ...(!missingWaveRules?[
   rule(4,"refs/heads/asf/waves/*",["creation","update"],[{
    actor_type:"Integration",actor_id:wrongWaveApp?5321746:5361227,
    bypass_mode:"always"
   }]),
   rule(5,"refs/heads/asf/waves/*",["deletion","non_fast_forward"],
    immutableWaveBypass?[{actor_type:"Integration",actor_id:5361227,
     bypass_mode:"always"}]:[])
  ]:[])
 ];
 const state={tip:RESERVATION,manifest,
  journals:new Map([[RESERVATION,j]]),
  commits:new Map([[RESERVATION,{sha:RESERVATION,
   tree:{sha:S("5")},parents:[{sha:ORIGIN}]}]]),
  pending:null,writes:[],patches:0,paths:[],stage:0,
  missingReadback:false,global:GLOBAL,waveGetCount:0,
  rulesetListReads:0};
 const file=(path,obj)=>{
  const bytes=Buffer.from(JSON.stringify(obj));
  return {ok:true,data:{type:"file",path,encoding:"base64",
   size:bytes.length,content:bytes.toString("base64")}};
 };
 const get=async path=>{
  state.paths.push(path);
  if(path===BASE+"/actions/runs/"+RUN||
     (state.foreignRunId&&path===BASE+"/actions/runs/"+state.foreignRunId))
   return {ok:true,data:{
   id:Number(path.split("/").at(-1)),repository:{full_name:REPO},
   actor:{login:wrongRun?"intruder":BOT},path:WF,
   event:"workflow_dispatch",head_branch:"main",head_sha:ORIGIN,
   run_attempt:1,status:"in_progress"
  }};
  if(path===BASE+"/rulesets"){
   state.rulesetListReads++;
   return {ok:true,data:policies.map(p=>({id:p.id}))};
  }
  for(const p of policies)if(path===BASE+"/rulesets/"+p.id)
   return {ok:true,data:
    waveRulesChangeDuringCheck&&p.id===4&&state.rulesetListReads>=4?
    {...p,bypass_actors:[{
     actor_type:"Integration",actor_id:5321746,bypass_mode:"always"
    }]}:p};
  if(path===REST_W)return {ok:true,data:{
   ref:REF,object:{type:"commit",sha:state.tip}}};
  if(path===G)return {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
   object:{type:"commit",sha:state.global}}};
  if(path===M)return {ok:true,data:{ref:"refs/heads/main",
   object:{type:"commit",sha:ORIGIN}}};
  if(path.startsWith(BASE+"/contents/manifest.json?ref="))
   return file("manifest.json",manifest);
  if(path.startsWith(BASE+"/contents/journal.json?ref=")){
   const sha=path.split("=").at(-1);
   const journal=state.journals.get(sha);
   if(!journal)return {ok:false,status:404};
   return file("journal.json",corruptReadback&&sha!==RESERVATION?
    {...journal,revision:999}:journal);
  }
  if(path===BASE+"/contents/registry.json?ref="+GLOBAL)
   return file("registry.json",corruptGlobal?
    {...registry,revision:999}:registry);
  if(path.startsWith(BASE+"/git/commits/")){
   const sha=path.split("/").at(-1);
   const d=state.commits.get(sha);
   return d?{ok:true,data:sha===ACK&&ackMultipleParents?
    {...d,parents:[{sha:RESERVATION},{sha:RACE}]}:
    wrongAckParent&&sha===ACK?
    {...d,parents:[{sha:RACE}]}:d}:{ok:false,status:404};
  }
  return {ok:false,status:404};
 };
 const transport=async ({method,path,body})=>{
  if(method==="GET"){
   if(path===REST_W){
    state.waveGetCount++;
    if(driftAfterSecond&&state.waveGetCount>=7)
     state.tip=RACE;
    return {ref:REF,object:{type:"commit",sha:state.tip}};
   }
   if(path.startsWith(BASE+"/git/commits/")){
    const sha=path.split("/").at(-1);
    if(!state.commits.has(sha))throw Error("no_commit");
    return state.commits.get(sha);
   }
  }
  state.writes.push({method,path,body});
  if(method==="POST"&&path===BASE+"/git/trees"){
   assert.equal(body.tree.length,1);
   assert.equal(body.tree[0].path,"journal.json");
   state.pending=JSON.parse(body.tree[0].content);
   return {sha:state.tip===RESERVATION?S("6"):S("7")};
  }
  if(method==="POST"&&path===BASE+"/git/commits"){
   const sha=body.parents[0]===RESERVATION?ACK:CLAIM;
   if(wrongGitCommit)return {sha,tree:{sha:body.tree},parents:[{sha:RACE}]};
   state.commits.set(sha,{sha,tree:{sha:body.tree},
    parents:[{sha:body.parents[0]}]});
   state.journals.set(sha,state.pending);
   return {sha,tree:{sha:body.tree},parents:[{sha:body.parents[0]}]};
  }
  if(method==="PATCH"&&path===BASE+"/git/refs/heads/asf/waves/"+WAVE){
   state.patches++;
   assert.deepEqual(body,{sha:state.tip===RESERVATION?ACK:CLAIM,force:false});
   if(patchConflict){state.tip=RACE;throw Object.assign(Error("conflict"),{status:422});}
   if(!spoofPatch)state.tip=body.sha;
   if(patchLost)throw Error("timeout");
   return {ref:REF,object:{type:"commit",sha:body.sha}};
  }
  throw Error("unapproved_operation");
 };
 return {runner:context(),event:event(),readClient:{get},
  gitPort:createAsfV3GitDataPort({waveId:WAVE,transport}),
  state,manifest,registry};
}
function noRights(r){
 for(const field of ["authorized","canAck","canClaim","canWrite",
  "canDispatch","canSpend","canRetry"])
  assert.equal(r[field],false,field);
}
test("ACK CAS then CLAIM CAS advance journal with two exact Git commits and no payment",async()=>{
 const f=fixture();
 const ack=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(ack.status,"persisted_simulation",JSON.stringify(ack));
 assert.equal(ack.evidence.newWaveSha,ACK);
 assert.equal(f.state.tip,ACK);
 assert.equal(f.state.journals.get(ACK).status,"CHILD_ACKNOWLEDGED");
 assert.equal(f.state.journals.get(ACK).events.at(-1).type,"ACK_CHILD");
 assert.deepEqual(f.state.commits.get(ACK).parents,[{sha:RESERVATION}]);
 assert.equal(f.state.patches,1);
 noRights(ack);
 const claimObserver=await observeV3GithubChildClaimReadiness(f);
 assert.equal(claimObserver.status,"child_claim_candidate_not_authorized",
  JSON.stringify(claimObserver));
 noRights(claimObserver);
 const claim=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.equal(claim.status,"persisted_simulation",JSON.stringify(claim));
 assert.equal(claim.evidence.newWaveSha,CLAIM);
 assert.equal(f.state.tip,CLAIM);
 assert.equal(f.state.journals.get(CLAIM).status,"EXECUTING");
 assert.equal(f.state.journals.get(CLAIM).events.at(-1).type,"CLAIM_CHILD");
 assert.deepEqual(f.state.commits.get(CLAIM).parents,[{sha:ACK}]);
 assert.equal(f.state.patches,2);
 noRights(claim);
 assert.equal(f.state.writes.filter(x=>x.method==="PATCH").length,2);
 assert.ok(f.state.writes.every(x=>x.path.startsWith(BASE+"/git/")));
});
test("CLAIM cannot precede persisted ACK even with valid child native context",async()=>{
 const f=fixture();
 const obs=await observeV3GithubChildClaimReadiness(f);
 assert.equal(obs.status,"rejected");noRights(obs);
 const out=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.equal(out.status,"rejected");
 assert.equal(f.state.writes.length,0);noRights(out);
});
test("ACK cannot be replayed after it is persisted, nor can CLAIM repeat",async()=>{
 const f=fixture();
 assert.equal((await attemptV3GithubChildWaveCAS({phase:"ACK",...f})).status,
  "persisted_simulation");
 const again=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(again.status,"rejected");noRights(again);
 assert.equal(f.state.patches,1);
 assert.equal((await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f})).status,
  "persisted_simulation");
 const twice=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.notEqual(twice.status,"persisted_simulation");noRights(twice);
 assert.equal(f.state.patches,2);
});
test("a different executor child runner cannot steal a persisted ACK",async()=>{
 const f=fixture();
 await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 // A second, genuine-looking REST run must not claim the FIRST run's ACK.
 f.state.foreignRunId="91828";
 f.runner.runId="91828";
 const r=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.equal(r.status,"rejected");noRights(r);
 assert.equal(f.state.patches,1);
});
test("wrong commit parent invalidates CLAIM origin even with apparently correct journal",async()=>{
 const f=fixture({wrongAckParent:true});
 await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 const r=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.equal(r.status,"rejected");noRights(r);
 assert.equal(f.state.patches,1);
});
test("lost PATCH after successful branch update => uncertain, one PATCH, zero retry",async()=>{
 const f=fixture({patchLost:true});
 const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(r.status,"uncertain");
 assert.equal(f.state.tip,ACK);
 assert.equal(f.state.patches,1);noRights(r);
});
test("sibling PATCH conflict never overwrites other journal",async()=>{
 const f=fixture({patchConflict:true});
 const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(r.status,"conflict");
 assert.equal(f.state.tip,RACE);
 assert.equal(f.state.patches,1);noRights(r);
});
test("a fake ref-update success without actual write cannot pass CAS readback",async()=>{
 const f=fixture({spoofPatch:true});
 const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(r.status,"uncertain");
 assert.equal(f.state.tip,RESERVATION);
 assert.equal(f.state.patches,1);noRights(r);
});
test("saved journal corruption after PATCH blocks claim of confirmed persistence",async()=>{
 const f=fixture({corruptReadback:true});
 const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(r.status,"uncertain");noRights(r);
 assert.equal(f.state.patches,1);
});
test("malicious rulesets, corrupted global registry, forged child run stop before mutation",async()=>{
 for(const opts of [{wrongApp:true},{wrongRun:true},{corruptGlobal:true}]){
  const f=fixture(opts);
  const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
  assert.notEqual(r.status,"persisted_simulation");
  assert.equal(f.state.writes.length,0);noRights(r);
 }
});
test("wave ref must have TWO separate controller-only, immutable GitHub rulesets",async()=>{
 for(const opts of [{missingWaveRules:true},{wrongWaveApp:true},
  {immutableWaveBypass:true}]){
  const f=fixture(opts);
  const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
  assert.equal(r.status,"rejected",JSON.stringify(opts));
  assert.equal(r.code,"wave_creation_update_or_immutability_not_verified");
  assert.equal(f.state.writes.length,0);
  noRights(r);
 }
});
test("wave ruleset changed after proofs: fail closed before first git write",async()=>{
 const f=fixture({waveRulesChangeDuringCheck:true});
 const r=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"wave_protection_changed_before_write");
 assert.equal(f.state.writes.length,0);
 noRights(r);
});
test("unsafe phase, missing ports and forged reservation stop before any writer",async()=>{
 const f=fixture();
 for(const patch of [{phase:"PAY"},{gitPort:null},{readClient:null},
  {event:{...f.event,inputs:{...f.event.inputs,reservation_sha:RACE}}}]){
  const r=await attemptV3GithubChildWaveCAS({
   phase:"ACK",...f,...patch
  });
  assert.notEqual(r.status,"persisted_simulation");
  assert.equal(f.state.writes.length,0);noRights(r);
 }
});

test("CLAIM rejects an ACK merge commit even with the correct reservation as first parent",async()=>{
 const f=fixture({ackMultipleParents:true});
 const ack=await attemptV3GithubChildWaveCAS({phase:"ACK",...f});
 assert.equal(ack.status,"persisted_simulation");
 const claim=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.equal(claim.status,"rejected");
 assert.equal(f.state.patches,1);
 assert.equal(f.state.tip,ACK);
 noRights(claim);
});
test("CLAIM rechecks ACK ancestry and refuses Git proof drift before any second PATCH",async()=>{
 const f=fixture();
 assert.equal((await attemptV3GithubChildWaveCAS({phase:"ACK",...f})).status,
  "persisted_simulation");
 const original=f.readClient.get;
 let parentReads=0;
 f.readClient.get=async path=>{
  const reply=await original(path);
  if(path===BASE+"/git/commits/"+ACK&&++parentReads>=2)
   return {...reply,data:{...reply.data,parents:[{sha:RACE}]}};
  return reply;
 };
 const claim=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.notEqual(claim.status,"persisted_simulation");
 assert.equal(parentReads,2);
 assert.equal(f.state.patches,1);
 noRights(claim);
});
test("CLAIM refuses protection removal after a persisted ACK",async()=>{
 const f=fixture();
 assert.equal((await attemptV3GithubChildWaveCAS({phase:"ACK",...f})).status,
  "persisted_simulation");
 const original=f.readClient.get;
 f.readClient.get=async path=>path===BASE+"/rulesets/4"?
  {ok:false,status:404}:original(path);
 const claim=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.equal(claim.status,"rejected");
 assert.equal(claim.code,"wave_creation_update_or_immutability_not_verified");
 assert.equal(f.state.patches,1);
 noRights(claim);
});
test("CLAIM refuses a wave App bypass mutation after its second journal proof",async()=>{
 const f=fixture();
 assert.equal((await attemptV3GithubChildWaveCAS({phase:"ACK",...f})).status,
  "persisted_simulation");
 const before=f.state.rulesetListReads;
 const original=f.readClient.get;
 f.readClient.get=async path=>{
  const reply=await original(path);
  if(path===BASE+"/rulesets/4"&&
     f.state.rulesetListReads>=before+3)
   return {...reply,data:{...reply.data,bypass_actors:[
    {actor_type:"Integration",actor_id:5321746,bypass_mode:"always"}
   ]}};
  return reply;
 };
 const claim=await attemptV3GithubChildWaveCAS({phase:"CLAIM",...f});
 assert.notEqual(claim.status,"persisted_simulation");
 assert.equal(f.state.patches,1);
 assert.equal(f.state.tip,ACK);
 noRights(claim);
});
