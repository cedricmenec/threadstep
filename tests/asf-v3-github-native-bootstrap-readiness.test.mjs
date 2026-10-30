import test from "node:test";
import assert from "node:assert/strict";
import { observeV3GithubBootstrapReadiness }
  from "../scripts/asf/v3/github-native-bootstrap-readiness.mjs";
import { createAdmissionRegistry, advanceAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const MAIN=BASE+"/git/ref/heads/main";
const GLOBAL=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const SHA=n=>n.repeat(40), MAIN_SHA=SHA("a"), ROOT=SHA("b");
const rule=(id,ref,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ref],exclude:[]}},
 bypass_actors:bypass,
 rules:types.map(type=>type==="required_status_checks"?
  {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
});
const main=()=>rule(1,"refs/heads/main",[
 "pull_request","required_status_checks","deletion","non_fast_forward"]);
const global=()=>rule(2,ADMISSION_REGISTRY_REF,
 ["creation","update"],
 [{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}]);
const immutable=()=>rule(3,ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"]);
function fixture({exists=false,registry=createAdmissionRegistry(),
 policyMissing=false,refMoves=false,mainMoves=false,
 fail=null,ref404Status=404,normalized404=false,conflicting404=false}={}) {
 const paths=[];
 const get=async path=>{
  paths.push(path);
  if(path===fail)return {ok:false,status:503};
  if(path===BASE+"/rulesets")
   return {ok:true,data:policyMissing?[{id:1}]:[{id:1},{id:2},{id:3}]};
  if(path===BASE+"/rulesets/1")return {ok:true,data:main()};
  if(path===BASE+"/rulesets/2")return {ok:true,data:global()};
  if(path===BASE+"/rulesets/3")return {ok:true,data:immutable()};
  if(path===MAIN)return {ok:true,data:{
   ref:"refs/heads/main",object:{type:"commit",sha:
    mainMoves && paths.filter(x=>x===MAIN).length>1?SHA("f"):MAIN_SHA}
  }};
  if(path===GLOBAL) {
   const moved=refMoves && paths.filter(x=>x===GLOBAL).length>1;
   return exists || moved ?
    {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
     object:{type:"commit",sha:ROOT}}} :
    conflicting404 ? {ok:false,status:404,error:{status:403}} :
    normalized404 ? {ok:false,data:null,error:{code:"transport_error",status:ref404Status}} :
    {ok:false,status:ref404Status};
  }
  if(path===BASE+"/contents/registry.json?ref="+ROOT){
   const buffer=Buffer.from(JSON.stringify(registry));
   return {ok:true,data:{type:"file",path:"registry.json",
    encoding:"base64",size:buffer.length,content:buffer.toString("base64")}};
  }
  return {ok:false,status:404};
 };
 return {paths,readClient:{get},expectedMainSha:MAIN_SHA};
}
const noRights = r => {
 for(const name of ["authorized","canCreate","canWrite","canDispatch",
  "canSpend","canRetry"])assert.equal(r[name],false);
};
test("protected and absent is observation only: never creation authority",async()=>{
 const f=fixture(),result=await observeV3GithubBootstrapReadiness(f);
 assert.equal(result.status,"absent_observed_untrusted",JSON.stringify(result));
 assert.equal(result.evidence.mainSha,MAIN_SHA);
 assert.equal(f.paths.filter(x=>x===MAIN).length,2);
 assert.equal(f.paths.filter(x=>x===GLOBAL).length,2);
 noRights(result);
 assert.ok(f.paths.every(x=>x.startsWith(BASE+"/")));
});
test("existing pristine registry is never recreated or overwritten",async()=>{
 const f=fixture({exists:true});
 const r=await observeV3GithubBootstrapReadiness(f);
 assert.equal(r.status,"already_initialized_untrusted",JSON.stringify(r));
 assert.equal(r.evidence.globalHeadSha,ROOT);
 noRights(r);
});
test("existing ACTIVE registry is a hard non-reset condition",async()=>{
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),{
  type:"ADMIT",claim:{waveId:"wave-live-control",manifestHash:"f".repeat(64),
   ownerRunId:"90001",originSha:MAIN_SHA}
 },0);
 const r=await observeV3GithubBootstrapReadiness(fixture({exists:true,registry}));
 assert.equal(r.status,"existing_history_stop");
 assert.equal(r.evidence.revision,1);
 noRights(r);
});
test("missing global ruleset blocks even a 404 ref from qualifying",async()=>{
 const r=await observeV3GithubBootstrapReadiness(fixture({policyMissing:true}));
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"protected_global_rules_unconfirmed");
 noRights(r);
});
test("a 404 can mask access: never confuse 403 or 503 with missing",async()=>{
 for(const status of [403,503,422]){
  const r=await observeV3GithubBootstrapReadiness(fixture({ref404Status:status}));
  assert.equal(r.status,"uncertain");noRights(r);
 }
});
test("normalized GitHub client 404 is only nonauthorizing absence; conflicts remain uncertain",async()=>{
 const good=await observeV3GithubBootstrapReadiness(fixture({normalized404:true}));
 assert.equal(good.status,"absent_observed_untrusted");noRights(good);
 for(const options of [{normalized404:true,ref404Status:403},
  {normalized404:true,ref404Status:503},{conflicting404:true}]){
  const r=await observeV3GithubBootstrapReadiness(fixture(options));
  assert.equal(r.status,"uncertain");noRights(r);
 }
});
test("moving global ref, changed main or wrong trusted SHA fails closed",async()=>{
 for(const option of [{refMoves:true},{mainMoves:true}]){
  const r=await observeV3GithubBootstrapReadiness(fixture(option));
  assert.equal(r.status,"uncertain");noRights(r);
 }
 const r=await observeV3GithubBootstrapReadiness({
  ...fixture(),expectedMainSha:SHA("8")
 });
 assert.equal(r.status,"rejected");noRights(r);
});
test("invalid existing JSON blocks bootstrap; missing transport is uncertain",async()=>{
 const r=await observeV3GithubBootstrapReadiness(
  fixture({exists:true,registry:{revision:100}}));
 assert.equal(r.status,"rejected");noRights(r);
 const out=await observeV3GithubBootstrapReadiness({
  expectedMainSha:MAIN_SHA,readClient:null
 });
 assert.equal(out.status,"uncertain");noRights(out);
});
test("ruleset fetch, existing registry and unstable readback fail closed",async()=>{
 for(const f of [fixture({fail:BASE+"/rulesets/2"}),
  fixture({exists:true,fail:BASE+"/contents/registry.json?ref="+ROOT}),
  fixture({fail:MAIN})]){
  const r=await observeV3GithubBootstrapReadiness(f);
  assert.notEqual(r.status,"absent_observed_untrusted");
  assert.notEqual(r.status,"already_initialized_untrusted");
  noRights(r);
 }
});
