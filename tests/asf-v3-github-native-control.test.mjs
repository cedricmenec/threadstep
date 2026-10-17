import test from "node:test";
import assert from "node:assert/strict";
import { createV3Manifest } from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry, advanceAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import {
  inspectV3GithubRulesets, observeV3GithubNativeControl, planV3GithubBootstrap
} from "../scripts/asf/v3/github-native-control.mjs";

const REPO = "cedricmenec/threadstep", BASE = "repos/" + REPO;
const SHA = n => n.repeat(40);
const REGHEAD = SHA("3");
const claim = () => {
 const manifest = createV3Manifest({
  waveId:"wave-github-native", repository:REPO,backlogCommit:SHA("a"),
  model:"openrouter/deepseek/deepseek-v4.1-flash",autoMerge:false,
  maxTaskStarts:2,candidateTasks:[{id:"TS-001",sha256:"f".repeat(64)}],
  authorization:{runId:"50001",actor:"cedricmenec",
    workflowRef: REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
    sourceSha: SHA("a")}
 });
 const ownerContext = {
  repository:REPO,runId:"50001",runAttempt:1,actor:"cedricmenec",
  workflowRef:manifest.authorization.workflowRef,eventName:"workflow_dispatch",
  ref:"refs/heads/main",sha:SHA("a"),
  inputs:{
   wave_id:manifest.waveId,model:manifest.model,max_task_starts:"2",
   auto_merge:"false",backlog_commit:SHA("a"),
   candidate_set_sha256:contentSha256(manifest.candidateTasks)
  }
 };
 return {manifest,ownerContext};
};
const rule = (id,name,types,bypass=[])=>({
  id,source:REPO,target:"branch",enforcement:"active",
  conditions:{ref_name:{include:[name],exclude:[]}},
  bypass_actors:bypass,
  rules:types.map(type=>type==="required_status_checks"?
   {type,parameters:{required_status_checks:[{context:"check",integration_id:15368}]}}:
   {type, ...(type==="pull_request"?{
    parameters:{required_approving_review_count:0}}:{})})
});
const mainRule = ()=>rule(1,"refs/heads/main",[
 "pull_request","required_status_checks","deletion","non_fast_forward"]);
const globalRule = ()=>rule(2,ADMISSION_REGISTRY_REF,
 ["deletion","non_fast_forward","update"],
 [{actor_type:"Integration",actor_id:12345}]);
function fixture({registry=createAdmissionRegistry(),global=globalRule(),
 main=mainRule(),ownerRun={},fail=null,changeRef=false}={}) {
 const source=claim(),calls=[];
 const data=Buffer.from(JSON.stringify(registry),"utf8");
 const response = async path=>{
  calls.push(path);
  if(fail===path) return {ok:false};
  if(path===BASE+"/actions/runs/50001") return {ok:true,data:{
   id:50001,repository:{full_name:REPO},actor:{login:"cedricmenec"},
   path:".github/workflows/backlog-orchestrator-v3.yml",
   event:"workflow_dispatch",head_branch:"main",head_sha:SHA("a"),
   run_attempt:1,status:"in_progress",conclusion:null,...ownerRun
  }};
  if(path===BASE+"/rulesets") return {ok:true,data:[{id:1},{id:2}]};
  if(path===BASE+"/rulesets/1") return {ok:true,data:main};
  if(path===BASE+"/rulesets/2") return {ok:true,data:global};
  if(path===BASE+"/git/ref/heads/asf/control/active-wave-v3") return {
   ok:true,data:{ref:ADMISSION_REGISTRY_REF,object:{type:"commit",sha:
    changeRef && calls.filter(x=>x===path).length>1?SHA("4"):REGHEAD}}
  };
  if(path===BASE+"/contents/registry.json?ref="+REGHEAD) return {ok:true,data:{
   type:"file",path:"registry.json",encoding:"base64",size:data.length,
   content:data.toString("base64")
  }};
  return {ok:false};
 };
 return {...source,calls,readClient:{get:response}};
}
const noPay = result => {
 for(const x of ["authorized","canWrite","canDispatch","canSpend","canRetry"])
   assert.equal(result[x],false);
};
test("GitHub owner workflow and protected global ref can only produce non-authorizing observation",async()=>{
 const s=fixture();
 const r=await observeV3GithubNativeControl(s);
 assert.equal(r.status,"consistent_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.headSha,REGHEAD);
 assert.equal(r.evidence.registryRevision,0);
 noPay(r);
 assert.equal(s.calls.filter(x=>x.includes("/actions/runs/")).length,1);
 assert.equal(s.calls.filter(x=>x.includes("/git/ref/")).length,2);
 assert.equal(s.calls.filter(x=>x.includes("/rulesets/")).length,2);
});
test("repository with only real main protection does NOT qualify for live global registry",async()=>{
 const s=fixture({global:undefined});
 // Fixture override cannot omit default; explicit rule with no update.
 const out=await observeV3GithubNativeControl(fixture({
  global:rule(2,ADMISSION_REGISTRY_REF,["non_fast_forward","deletion"])
 }));
 assert.equal(out.status,"rejected");
 assert.equal(out.reason,"global_ref_writer_protection_not_verified");
 noPay(out);
});
test("wrong-owner rerun, different branch SHA or missing owner input prevents control observation",async()=>{
 for(const run of [{actor:{login:"attacker"}},{run_attempt:2},
  {head_sha:SHA("b")},{event:"repository_dispatch"}]){
  const s=fixture({ownerRun:run});
  const result=await observeV3GithubNativeControl(s);
  assert.equal(result.reason,"owner_run_not_reconciled");
  assert.equal(s.calls.length,1,"reject before registry and policy reads");
  noPay(result);
 }
 const s=fixture();
 s.ownerContext.inputs.max_task_starts="10";
 const r=await observeV3GithubNativeControl(s);
 assert.equal(r.status,"rejected");
 assert.equal(s.calls.length,0);
});
test("missing/bypassed/unprotected global writer rule cannot act as trust anchor",()=>{
 for(const bad of [
  rule(2,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"]),
  rule(2,ADMISSION_REGISTRY_REF,["deletion","update"]),
  rule(2,ADMISSION_REGISTRY_REF,["update","non_fast_forward"]),
  {...globalRule(),bypass_actors:[]},
  {...globalRule(),bypass_actors:[{actor_type:"OrganizationAdmin",actor_id:5}]},
  {...globalRule(),enforcement:"evaluate"},
  {...globalRule(),conditions:{ref_name:{include:["refs/heads/main"],exclude:[]}}}
 ]){
  const r=inspectV3GithubRulesets({main:mainRule(),global:bad});
  assert.equal(r.status,"rejected");
  noPay(r);
 }
});
test("main required CI, pull request and non-force-push rules cannot be silently weakened",()=>{
 for(const types of [
  ["pull_request","deletion","non_fast_forward"],
  ["required_status_checks","deletion","non_fast_forward"],
  ["pull_request","required_status_checks","deletion"],
  ["pull_request","required_status_checks","non_fast_forward"]
 ]){
  const r=inspectV3GithubRulesets({main:rule(1,"refs/heads/main",types),
   global:globalRule()});
  assert.equal(r.status,"rejected");
  noPay(r);
 }
});
test("active or quarantined registry cannot grant another wave",async()=>{
 const s=fixture();
 const c={waveId:s.manifest.waveId,manifestHash:contentSha256(s.manifest),
  ownerRunId:"50001",originSha:SHA("a")};
 const occupied=advanceAdmissionRegistry(createAdmissionRegistry(),
  {type:"ADMIT",claim:c},0);
 for(const registry of [occupied,
  advanceAdmissionRegistry(occupied,{type:"QUARANTINE",
   waveId:c.waveId,reason:"incident_needs_owner_review"},1)]){
  const r=await observeV3GithubNativeControl(fixture({registry}));
  assert.equal(r.reason,"wave_already_active_or_used");
  noPay(r);
 }
});
test("invalid replay, missing GitHub ruleset or moved ref fail closed",async()=>{
 const original=fixture();
 const malformed={...createAdmissionRegistry(),revision:100};
 const bad=await observeV3GithubNativeControl(fixture({registry:malformed}));
 assert.equal(bad.status,"rejected");
 noPay(bad);
 const missing=await observeV3GithubNativeControl(fixture({
  fail:BASE+"/rulesets/2"
 }));
 assert.equal(missing.status,"uncertain");
 const moving=await observeV3GithubNativeControl(fixture({changeRef:true}));
 assert.equal(moving.status,"uncertain");
 assert.equal(moving.reason,"global_ref_moved_during_observation");
});
test("bootstrap is once per repository, and never resets a nonempty history",()=>{
 const first=planV3GithubBootstrap(null);
 assert.equal(first.status,"plan_only");noPay(first);
 assert.equal(first.evidence.ref,ADMISSION_REGISTRY_REF);
 const empty=planV3GithubBootstrap(createAdmissionRegistry());
 assert.equal(empty.status,"already_initialized");noPay(empty);
 const s=fixture();
 const occupied=advanceAdmissionRegistry(createAdmissionRegistry(),
  {type:"ADMIT",claim:{waveId:s.manifest.waveId,
   manifestHash:contentSha256(s.manifest),ownerRunId:"50001",originSha:SHA("a")}},0);
 assert.equal(planV3GithubBootstrap(occupied).status,"rejected");
 assert.equal(planV3GithubBootstrap({...occupied,revision:0}).status,"rejected");
});
