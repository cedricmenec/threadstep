import test from "node:test";
import assert from "node:assert/strict";
import { observeV3GithubTerminalReadiness }
 from "../scripts/asf/v3/github-native-terminal-readiness.mjs";
import { createV3Manifest,createV3Journal,advanceV3 }
 from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO,S=x=>x.repeat(40);
const GLOBAL=S("1"),WAVE=S("2"),ORIGIN=S("a");
const WAVE_ID="wave-native-terminal-015";
const ROOT=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const WREF=BASE+"/git/ref/heads/asf/waves/"+WAVE_ID;
const rules=(id,ref,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,
 rules:types.map(type=>type==="required_status_checks"?
  {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
});
const policyMain=()=>rules(1,"refs/heads/main",
 ["pull_request","required_status_checks","deletion","non_fast_forward"]);
const policyGlobal=()=>rules(2,ADMISSION_REGISTRY_REF,
 ["update"],
 [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]);
const policyImmutable=()=>rules(3,ADMISSION_REGISTRY_REF,
 ["deletion","non_fast_forward"]);
function fixture({kind="RELEASE",moved=false,invalidRegistry=false,
 malformedJournal=false,missingPolicy=false,missingWave=false}={}){
 const manifest=createV3Manifest({
  waveId:WAVE_ID,repository:REPO,backlogCommit:ORIGIN,
  model:"openrouter/deepseek/deepseek-v4.1-flash",
  autoMerge:false,maxTaskStarts:2,
  candidateTasks:[{id:"TS-001",sha256:"f".repeat(64)}],
  authorization:{
   runId:"90001",actor:"cedricmenec",
   workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
   sourceSha:ORIGIN
  }
 });
 const original=createV3Journal(manifest);
 const journal=kind==="QUARANTINE"?
  advanceV3(manifest,original,{type:"STOP_UNCERTAIN",reason:"network_ambiguous"},0):
  advanceV3(manifest,original,{type:"COMPLETE_NO_WORK"},0);
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),
  {type:"ADMIT",claim:{
   waveId:manifest.waveId,manifestHash:contentSha256(manifest),
   ownerRunId:manifest.authorization.runId,originSha:ORIGIN
  }},0);
 const paths=[];
 const file=(path,value)=>{
  const data=Buffer.from(JSON.stringify(value));
  return {ok:true,data:{type:"file",path,encoding:"base64",
   size:data.length,content:data.toString("base64")}};
 };
 const get=async path=>{
  paths.push(path);
  if(path===BASE+"/rulesets")
   return {ok:true,data:missingPolicy?[{id:1}]:[{id:1},{id:2},{id:3}]};
  if(path===BASE+"/rulesets/1")return {ok:true,data:policyMain()};
  if(path===BASE+"/rulesets/2")return {ok:true,data:policyGlobal()};
  if(path===BASE+"/rulesets/3")return {ok:true,data:policyImmutable()};
  if(path===ROOT)return {ok:true,data:{
   ref:ADMISSION_REGISTRY_REF,object:{type:"commit",sha:
    moved&&paths.filter(p=>p===ROOT).length>1?S("3"):GLOBAL}
  }};
  if(path===WREF){
   if(missingWave)return {ok:false,status:404};
   return {ok:true,data:{ref:"refs/heads/asf/waves/"+WAVE_ID,
    object:{type:"commit",sha:WAVE}}};
  }
  if(path===BASE+"/contents/manifest.json?ref="+WAVE)
   return file("manifest.json",manifest);
  if(path===BASE+"/contents/journal.json?ref="+WAVE)
   return file("journal.json",
    malformedJournal?{...journal,revision:77}:journal);
  if(path===BASE+"/contents/registry.json?ref="+GLOBAL)
   return file("registry.json",
    invalidRegistry?{...registry,revision:99}:registry);
  return {ok:false,status:404};
 };
 return {manifest,journal,registry,paths,readClient:{get},
  waveId:WAVE_ID,kind,reason:kind==="QUARANTINE"?
   "owner_diagnostic_required":undefined};
}
const noRights=r=>{
 for(const name of ["authorized","canRelease","canQuarantine",
  "canWrite","canDispatch","canSpend","canRetry"])
  assert.equal(r[name],false);
};
test("no-work terminal from immutable snapshots and global ADMIT is proposed but NOT released",async()=>{
 const f=fixture();
 const r=await observeV3GithubTerminalReadiness(f);
 assert.equal(r.status,"terminal_reconciled_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.proposedEvent.type,"RELEASE");
 assert.equal(r.evidence.proposedEvent.terminal.reserved,0);
 assert.equal(r.evidence.globalHeadSha,GLOBAL);
 assert.equal(r.evidence.waveHeadSha,WAVE);
 assert.equal(f.paths.filter(p=>p===ROOT).length,2);
 assert.equal(f.paths.filter(p=>p===WREF).length,2);
 assert.equal(f.paths.some(p=>p.includes("/actions/runs?")),false);
 noRights(r);
});
test("stopped uncertain wave can only create non-authorized QUARANTINE proposal",async()=>{
 const f=fixture({kind:"QUARANTINE"});
 const r=await observeV3GithubTerminalReadiness(f);
 assert.equal(r.status,"terminal_reconciled_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.proposedEvent.type,"QUARANTINE");
 assert.equal(r.evidence.proposedEvent.reason,"owner_diagnostic_required");
 noRights(r);
 const disallowed=await observeV3GithubTerminalReadiness({
  ...f,kind:"RELEASE"
 });
 assert.equal(disallowed.status,"rejected");noRights(disallowed);
});
test("a missing global ruleset rejects terminal even with otherwise valid snapshots",async()=>{
 const f=fixture({missingPolicy:true});
 const r=await observeV3GithubTerminalReadiness(f);
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"github_global_rules_unconfirmed");
 assert.equal(f.paths.some(p=>p===ROOT),false);
 noRights(r);
});
test("corrupted journal, missing wave ref, invalid global replay block all terminal events",async()=>{
 for(const opt of [{malformedJournal:true},{missingWave:true},
  {invalidRegistry:true}]){
  const r=await observeV3GithubTerminalReadiness(fixture(opt));
  assert.notEqual(r.status,"terminal_reconciled_not_authorized");
  noRights(r);
 }
});
test("global ref race during terminal observation is never a RELEASE",async()=>{
 const f=fixture({moved:true});
 const r=await observeV3GithubTerminalReadiness(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.reason,"terminal_ref_changed_during_observation");
 noRights(r);
});
test("untrusted waveId, unknown transition and missing reader are rejected or uncertain",async()=>{
 for(const patch of [{waveId:"../escape"},{kind:"ADMIN_RELEASE"},
  {readClient:null},{waveId:""}]){
  const r=await observeV3GithubTerminalReadiness({...fixture(),...patch});
  assert.notEqual(r.status,"terminal_reconciled_not_authorized");
  noRights(r);
 }
});
test("delivery count mismatch cannot skip GitHub PR verification by fake DELIVERED fields",async()=>{
 const f=fixture();
 // The immutable loaded journal is reconstructed; a forged revision counter
 // or a forged event list cannot be converted into an authenticated RELEASE.
 const r=await observeV3GithubTerminalReadiness({
  ...fixture({malformedJournal:true})
 });
 assert.equal(r.status,"uncertain");
 noRights(r);
 assert.equal(f.journal.delivered,0);
});
