import test from "node:test";
import assert from "node:assert/strict";
import {
 inspectV3OwnerGenesisReadiness
} from "../scripts/asf/v3/owner-run-capture.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const SHA=c=>c.repeat(40),MAIN=SHA("a"),REG=SHA("b"),RUN="17241";
const GLOBAL=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const MAIN_REF=BASE+"/git/ref/heads/main";
const WAVE="refs/heads/asf/waves/*";
const items=()=>[
 {id:"TS-013",path:"backlog/tasks/TS-013.md",type:"product",
  status:"ready",automation:"allowed",risk:"low",depends_on:[],
  content_sha256:"b".repeat(64)},
 {id:"TS-012",path:"backlog/tasks/TS-012.md",type:"product",
  status:"ready",automation:"allowed",risk:"low",depends_on:[],
  content_sha256:"a".repeat(64)}
];
const selected=[{id:"TS-012",sha256:"a".repeat(64)},
 {id:"TS-013",sha256:"b".repeat(64)}];
const mkrule=(id,ref,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 rules:types.map(type=>type==="required_status_checks"?
 {type,parameters:{required_status_checks:[{context:"check"}]}}:{type}),
 bypass_actors:bypass
});
const policy=()=>[
 mkrule(1,"refs/heads/main",[
  "pull_request","required_status_checks","deletion","non_fast_forward"]),
 mkrule(2,ADMISSION_REGISTRY_REF,["creation","update"],
  [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]),
 mkrule(3,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"]),
 mkrule(4,WAVE,["creation","update"],
  [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]),
 mkrule(5,WAVE,["deletion","non_fast_forward"])
];
const runContext=()=>({
 repository:REPO,runId:RUN,runAttempt:1,actor:"cedricmenec",
 workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
 eventName:"workflow_dispatch",ref:"refs/heads/main",sha:MAIN
});
const ghEvent=()=>({
 repository:{full_name:REPO},sender:{login:"cedricmenec"},ref:"refs/heads/main",
 inputs:{wave_id:"wave-owner-genesis-019",model:"openrouter/deepseek/deepseek-v4.1-flash",
  max_task_starts:"1",auto_merge:"false",backlog_commit:MAIN,
  candidate_set_sha256:contentSha256(selected)}
});
function f({exists=false,registry=createAdmissionRegistry(),badRule=false,
 refRace=false,mainRace=false,wrongStatus=null,invalidRun=false,
 missingWaves=false,badWaveWriter=false,badWaveImmutable=false}={}){
 const paths=[],rules=policy();
 if(missingWaves)rules.splice(3);
 if(badWaveWriter)rules[3].bypass_actors=[{
  actor_type:"Integration",actor_id:5321746,bypass_mode:"always"}];
 if(badWaveImmutable)rules[4].bypass_actors=[{
  actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}];
 if(badRule)rules[1].conditions.ref_name.include=[
  "refs/heads/refs/heads/asf/control/active-wave-v3"];
 const get=async path=>{
  paths.push(path);
  if(path===BASE+"/actions/runs/"+RUN)return {ok:true,data:{
    id:Number(RUN),repository:{full_name:REPO},actor:{login:"cedricmenec"},
    path:".github/workflows/backlog-orchestrator-v3.yml",
    event:"workflow_dispatch",head_branch:"main",head_sha:invalidRun?SHA("f"):MAIN,
    run_attempt:1,status:"in_progress"
   }};
  if(path===BASE+"/rulesets")return {ok:true,data:rules.map(r=>({id:r.id}))};
  const rule=rules.find(r=>path===BASE+"/rulesets/"+r.id);
  if(rule)return {ok:true,data:rule};
  if(path===MAIN_REF)return {ok:true,data:{
   ref:"refs/heads/main",object:{type:"commit",
    sha:mainRace&&paths.filter(x=>x===MAIN_REF).length>=2?
      SHA("e"):MAIN}
  }};
  if(path===GLOBAL){
   const flipped=refRace&&paths.filter(x=>x===GLOBAL).length>=2;
   return exists||flipped?
    {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
     object:{type:"commit",sha:REG}}}:
    {ok:false,data:null,error:{code:"transport_error",status:wrongStatus??404}};
  }
  if(path===BASE+"/contents/registry.json?ref="+REG){
   const b=Buffer.from(JSON.stringify(registry));
   return {ok:true,data:{type:"file",path:"registry.json",
     encoding:"base64",size:b.length,content:b.toString("base64")}};
  }
  return {ok:false,error:{status:404}};
 };
 return {runner:runContext(),event:ghEvent(),index:items(),
  readClient:{get},environmentAppId:"5361227",paths};
}
const mustNotGrant=r=>{
 for(const key of ["authorized","canCreate","canWrite",
  "canDispatch","canSpend","canRetry"])
  assert.equal(r[key],false,key);
};
test("owner V3 genesis absence is a double-read observation, never authority",async()=>{
 const x=f(),r=await inspectV3OwnerGenesisReadiness(x);
 assert.equal(r.status,"genesis_absent_observed_no_authority",JSON.stringify(r));
 assert.equal(r.evidence.globalRef,ADMISSION_REGISTRY_REF);
 assert.equal(r.evidence.originSha,MAIN);
 assert.equal(r.evidence.ownerRunId,RUN);
 assert.equal(r.evidence.initialRegistryHash,contentSha256(createAdmissionRegistry()));
 assert.equal(x.paths.filter(p=>p===MAIN_REF).length,2);
 assert.equal(x.paths.filter(p=>p===GLOBAL).length,2);
 assert.equal(x.paths.some(p=>/\/git\/refs$|\/git\/trees$/.test(p)),false);
 mustNotGrant(r);
});
test("existing pristine genesis is NOT a recreate or overwrite",async()=>{
 const r=await inspectV3OwnerGenesisReadiness(f({exists:true}));
 assert.equal(r.status,"genesis_exists_do_not_recreate",JSON.stringify(r));
 assert.equal(r.evidence.globalHeadSha,REG);
 mustNotGrant(r);
});
test("active global registry history blocks a second genesis entirely",async()=>{
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),{
  type:"ADMIT",claim:{
   waveId:"wave-other-already-active",manifestHash:"f".repeat(64),
   ownerRunId:RUN,originSha:MAIN
  }
 },0);
 const r=await inspectV3OwnerGenesisReadiness(f({exists:true,registry}));
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"global_registry_has_history_do_not_recreate");
 mustNotGrant(r);
});
test("ruleset wrong pattern or owner run mismatch blocks before reading globals",async()=>{
 for(const args of [{badRule:true},{invalidRun:true}]){
  const x=f(args),r=await inspectV3OwnerGenesisReadiness(x);
  assert.equal(r.status,"rejected",JSON.stringify(args));
  assert.equal(x.paths.includes(GLOBAL),false);
  mustNotGrant(r);
 }
});
test("C4/G1 wave protections are required BEFORE genesis ref reads",async()=>{
 for(const option of [{missingWaves:true},{badWaveWriter:true},
  {badWaveImmutable:true}]){
  const x=f(option),r=await inspectV3OwnerGenesisReadiness(x);
  assert.equal(r.status,"rejected",JSON.stringify(option));
  assert.equal(r.reason,"wave_rulesets_missing_or_unverified");
  assert.equal(x.paths.includes(GLOBAL),false,
   "global ref should not be consulted with broken wave security");
  mustNotGrant(r);
 }
});
test("even valid global and wave rulesets do not authorize write or payment",async()=>{
 const x=f(),r=await inspectV3OwnerGenesisReadiness(x);
 assert.equal(r.status,"genesis_absent_observed_no_authority");
 assert.equal(x.paths.includes(BASE+"/rulesets/4"),true);
 assert.equal(x.paths.includes(BASE+"/rulesets/5"),true);
 mustNotGrant(r);
});
test("wrong or missing environment App ID never even reads GitHub",async()=>{
 for(const invalid of ["5321746","5361228",null,""," 5361227 "]){
  const x=f(),r=await inspectV3OwnerGenesisReadiness({
   ...x,environmentAppId:invalid
  });
  assert.equal(r.status,"rejected");
  assert.equal(x.paths.length,0);
  mustNotGrant(r);
 }
});
test("404 masked by status 403/503/422 and moving refs fail closed",async()=>{
 for(const args of [{wrongStatus:403},{wrongStatus:503},
  {wrongStatus:422},{refRace:true},{mainRace:true}]){
  const r=await inspectV3OwnerGenesisReadiness(f(args));
  assert.equal(r.status,"uncertain",JSON.stringify(args));
  mustNotGrant(r);
 }
});
test("malformed persisted global registry cannot be reset",async()=>{
 const r=await inspectV3OwnerGenesisReadiness(f({
  exists:true,registry:{...createAdmissionRegistry(),revision:999}
 }));
 assert.equal(r.status,"rejected");mustNotGrant(r);
});
test("untrusted owner input or broken API is never enough to create",async()=>{
 const x=f();x.event.inputs.candidate_set_sha256="f".repeat(64);
 const r=await inspectV3OwnerGenesisReadiness(x);
 assert.equal(r.status,"rejected");
 assert.equal(x.paths.length,0);
 mustNotGrant(r);
 const y=f();
 const z=await inspectV3OwnerGenesisReadiness({...y,readClient:null});
 assert.equal(z.status,"uncertain");mustNotGrant(z);
});
