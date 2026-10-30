import test from "node:test";
import assert from "node:assert/strict";
import { createV3Manifest,createV3Journal,advanceV3 }
 from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { observeV3GithubTerminalReadiness }
 from "../scripts/asf/v3/github-native-terminal-readiness.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO, S=c=>c.repeat(40);
const RUN="41277",CHILD="51277",WAVE_ID="wave-delivered-terminal-021";
const HEAD=S("a"),MERGE=S("b"),MAIN=S("c"),
 GLOBAL=S("1"),WAVE=S("2"),ORIGIN=S("d");
const PR=423,PAGES_RUN=781;
const G_REF=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const W_REF=BASE+"/git/ref/heads/asf/waves/"+WAVE_ID;
const checksPath=sha=>BASE+"/commits/"+sha+"/check-runs?per_page=100";
const pagesPath=BASE+"/actions/runs?head_sha="+MERGE+"&per_page=100";
const jobsPath=BASE+"/actions/runs/"+PAGES_RUN+"/jobs?per_page=100";
function rule(id,ref,types,bypass=[]){
 return {id,source:REPO,target:"branch",enforcement:"active",
  conditions:{ref_name:{include:[ref],exclude:[]}},
  rules:types.map(type=>type==="required_status_checks"?
   {type,parameters:{required_status_checks:[{context:"check"}]}}:{type}),
  bypass_actors:bypass};
}
const policies=()=>[
 rule(1,"refs/heads/main",["pull_request","required_status_checks",
  "deletion","non_fast_forward"]),
 rule(2,ADMISSION_REGISTRY_REF,["creation","update"],
  [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]),
 rule(3,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"]),
 rule(4,"refs/heads/asf/waves/*",["creation","update"],
  [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]),
 rule(5,"refs/heads/asf/waves/*",["deletion","non_fast_forward"])
];
const proof=()=>({
 prNumber:PR,headSha:HEAD,mergeSha:MERGE,merged:true,branchProtected:true,
 requiredCheck:{sha:HEAD,conclusion:"success"},
 mainCheck:{sha:MERGE,conclusion:"success"},
 pages:{sha:MERGE,conclusion:"success"}
});
function buildManifest(){
 return createV3Manifest({
  waveId:WAVE_ID,repository:REPO,backlogCommit:ORIGIN,
  model:"openrouter/deepseek/deepseek-v4.1-flash",autoMerge:false,
  maxTaskStarts:1,candidateTasks:[{id:"TS-012",sha256:"e".repeat(64)}],
  authorization:{runId:RUN,actor:"cedricmenec",sourceSha:ORIGIN,
   workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main"}
 });
}
function deliveredJournal(m,deliveredProof=proof()){
 let j=createV3Journal(m);
 const childRef=REPO+"/.github/workflows/agent-openspec-v3.yml@refs/heads/main";
 for(const event of [
  {type:"RESERVE",taskId:"TS-012"},
  {type:"DISPATCH_INTENT",taskId:"TS-012"},
  {type:"ACK_CHILD",taskId:"TS-012",childRunId:CHILD,
   runAttempt:1,workflowRef:childRef},
  {type:"CLAIM_CHILD",taskId:"TS-012",childRunId:CHILD,
   runAttempt:1,workflowRef:childRef},
  {type:"PR_PUBLISHED",taskId:"TS-012",childRunId:CHILD,
   prNumber:PR,headSha:HEAD},
  {type:"DELIVERED",taskId:"TS-012",proof:deliveredProof},
  {type:"CHECKPOINT",taskId:"TS-012"}
 ])j=advanceV3(m,j,event,j.revision);
 assert.equal(j.status,"COMPLETED_QUOTA");
 assert.equal(j.reserved,1);
 assert.equal(j.delivered,1);
 return j;
}
const check=sha=>({
 total_count:1,check_runs:[{
  name:"check",head_sha:sha,app:{slug:"github-actions"},
  status:"completed",conclusion:"success"
 }]
});
const runPages=()=>({
 id:PAGES_RUN,repository:{full_name:REPO},path:".github/workflows/pages.yml",
 event:"push",head_branch:"main",head_sha:MERGE,
 run_attempt:1,status:"completed",conclusion:"success"
});
const file=(path,value)=>{
 const bytes=Buffer.from(JSON.stringify(value));
 return {ok:true,data:{type:"file",path,encoding:"base64",
  size:bytes.length,content:bytes.toString("base64")}};
};
function fixture({prProof=proof(),patch={},globalRace=false,waveRace=false,
 mainRace=false,fail=null}={}){
 const m=buildManifest(),j=deliveredJournal(m,prProof);
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),
  {type:"ADMIT",claim:{waveId:WAVE_ID,manifestHash:contentSha256(m),
   ownerRunId:RUN,originSha:ORIGIN}},0);
 const policiesList=policies(),paths=[];
 const data={
  [BASE+"/rulesets"]:{ok:true,data:policiesList.map(x=>({id:x.id}))},
  [BASE+"/compare/"+MERGE+"..."+MAIN]:{ok:true,data:{
   base_commit:{sha:MERGE},status:"ahead",ahead_by:2,behind_by:0
  }},
  [checksPath(HEAD)]:{ok:true,data:check(HEAD)},
  [checksPath(MERGE)]:{ok:true,data:check(MERGE)},
  [pagesPath]:{ok:true,data:{total_count:1,workflow_runs:[runPages()]}},
  [jobsPath]:{ok:true,data:{total_count:1,jobs:[{
   name:"deploy",head_sha:MERGE,status:"completed",conclusion:"success"
  }]}},
  [BASE+"/pulls/"+PR]:{ok:true,data:{
   number:PR,state:"closed",merged:true,merged_at:"2026-10-17T20:00:00Z",
   base:{ref:"main",repo:{full_name:REPO}},
   head:{sha:HEAD,repo:{full_name:REPO}},merge_commit_sha:MERGE
  }},
  [BASE+"/contents/manifest.json?ref="+WAVE]:file("manifest.json",m),
  [BASE+"/contents/journal.json?ref="+WAVE]:file("journal.json",j),
  [BASE+"/contents/registry.json?ref="+GLOBAL]:file("registry.json",registry)
 };
 for(const [path,value] of Object.entries(patch))data[path]=value;
 const get=async path=>{
  paths.push(path);
  if(path===fail)return {ok:false,status:503};
  if(path.startsWith(BASE+"/rulesets/")){
   const id=Number(path.split("/").at(-1));
   const r=policiesList.find(x=>x.id===id);
   return r?{ok:true,data:r}:{ok:false,status:404};
  }
  if(path===G_REF)return {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
   object:{type:"commit",sha:globalRace&&
    paths.filter(x=>x===G_REF).length>1?S("e"):GLOBAL}}};
  if(path===W_REF)return {ok:true,data:{
   ref:"refs/heads/asf/waves/"+WAVE_ID,
   object:{type:"commit",sha:waveRace&&
    paths.filter(x=>x===W_REF).length>1?S("f"):WAVE}
  }};
  if(path===BASE+"/git/ref/heads/main")
   return {ok:true,data:{ref:"refs/heads/main",object:{
    type:"commit",sha:mainRace&&paths.filter(x=>x===path).length>1?
      S("e"):MAIN
   }}};
  return data[path]??{ok:false,status:404};
 };
 return {manifest:m,journal:j,registry,paths,readClient:{get},
  waveId:WAVE_ID,kind:"RELEASE"};
}
const noRights=r=>{
 for(const k of ["authorized","canRelease","canQuarantine",
  "canWrite","canDispatch","canSpend","canRetry"])
  assert.equal(r[k],false,k);
};
test("delivered PR HEAD, merge/main CI, Pages deploy and journal complete => ONLY terminal proposal",async()=>{
 const f=fixture();
 const r=await observeV3GithubTerminalReadiness(f);
 assert.equal(r.status,"terminal_reconciled_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.kind,"RELEASE");
 assert.equal(r.evidence.proposedEvent.type,"RELEASE");
 assert.equal(r.evidence.proposedEvent.terminal.status,"COMPLETED_QUOTA");
 assert.equal(r.evidence.proposedEvent.terminal.reserved,1);
 assert.equal(r.evidence.proposedEvent.terminal.delivered,1);
 assert.equal(r.evidence.globalHeadSha,GLOBAL);
 assert.equal(r.evidence.waveHeadSha,WAVE);
 assert.match(r.evidence.deliveryEvidenceHash,/^[a-f0-9]{64}$/);
 assert.equal(f.paths.filter(x=>x===G_REF).length,2);
 assert.equal(f.paths.filter(x=>x===W_REF).length,2);
 assert.equal(f.paths.includes(BASE+"/pulls/"+PR),true);
 assert.equal(f.paths.includes(checksPath(HEAD)),true);
 assert.equal(f.paths.includes(checksPath(MERGE)),true);
 assert.equal(f.paths.includes(pagesPath),true);
 assert.equal(f.paths.includes(jobsPath),true);
 noRights(r);
});
test("self-reported successful delivery never substitutes for independent checks",async()=>{
 for(const key of [checksPath(HEAD),checksPath(MERGE)]){
  const f=fixture({patch:{[key]:{ok:true,data:{
   total_count:1,check_runs:[{name:"check",head_sha:key===checksPath(HEAD)?HEAD:MERGE,
    app:{slug:"github-actions"},status:"completed",conclusion:"failure"}]
  }}}});
  const r=await observeV3GithubTerminalReadiness(f);
  assert.equal(r.status,"rejected");noRights(r);
 }
});
test("Pages job missing, failed, wrong SHA or duplicate runs block RELEASE",async()=>{
 const failures=[
  {[jobsPath]:{ok:true,data:{total_count:0,jobs:[]}}},
  {[jobsPath]:{ok:true,data:{total_count:1,jobs:[{
   name:"deploy",head_sha:HEAD,status:"completed",conclusion:"success"
  }]}}},
  {[jobsPath]:{ok:true,data:{total_count:1,jobs:[{
   name:"deploy",head_sha:MERGE,status:"completed",conclusion:"failure"
  }]}}},
  {[pagesPath]:{ok:true,data:{total_count:2,workflow_runs:[
    runPages(),{...runPages(),id:782}
  ]}}}
 ];
 for(const patch of failures){
  const r=await observeV3GithubTerminalReadiness(fixture({patch}));
  assert.equal(r.status,"rejected");
  noRights(r);
 }
});
test("GitHub PR not merged, wrong repo and missing merge ancestry block RELEASE",async()=>{
 for(const part of [
  {merged:false},{base:{ref:"main",repo:{full_name:"attacker/fork"}}},
  {head:{sha:S("e"),repo:{full_name:REPO}}}
 ]){
  const f=fixture();
  const existing={
   number:PR,state:"closed",merged:true,merged_at:"2026-10-17T20:00:00Z",
   base:{ref:"main",repo:{full_name:REPO}},
   head:{sha:HEAD,repo:{full_name:REPO}},merge_commit_sha:MERGE
  };
  const r=await observeV3GithubTerminalReadiness(fixture({
   patch:{[BASE+"/pulls/"+PR]:{ok:true,data:{...existing,...part}}}
  }));
  assert.equal(r.status,"rejected");
  noRights(r);
  assert.equal(f.journal.status,"COMPLETED_QUOTA");
 }
 const compare=BASE+"/compare/"+MERGE+"..."+MAIN;
 const r=await observeV3GithubTerminalReadiness(fixture({
  patch:{[compare]:{ok:true,data:{base_commit:{sha:MERGE},
   status:"diverged",behind_by:1,ahead_by:3}}}
 }));
 assert.equal(r.status,"rejected");noRights(r);
});
test("locally valid but forged DELIVERED proof is rejected by the external GitHub observer",async()=>{
 const f=fixture({prProof:{...proof(),mergeSha:S("e"),
  mainCheck:{sha:S("e"),conclusion:"success"},
  pages:{sha:S("e"),conclusion:"success"}}});
 const r=await observeV3GithubTerminalReadiness(f);
 assert.equal(f.journal.status,"COMPLETED_QUOTA");
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"pinned_journal_delivery_not_independently_verified");
 noRights(r);
});
test("global, wave or main moving during delivery observation prevents terminal proposal",async()=>{
 for(const options of [{globalRace:true},{waveRace:true},{mainRace:true}]){
  const r=await observeV3GithubTerminalReadiness(fixture(options));
  assert.notEqual(r.status,"terminal_reconciled_not_authorized");
  noRights(r);
 }
});
test("network failures at a required Pages or CI proof stop without RELEASE",async()=>{
 for(const fail of [BASE+"/pulls/"+PR,checksPath(HEAD),jobsPath]){
  const r=await observeV3GithubTerminalReadiness(fixture({fail}));
  assert.notEqual(r.status,"terminal_reconciled_not_authorized");
  noRights(r);
 }
});
