import test from "node:test";
import assert from "node:assert/strict";
import {observeAsfV3AppPermissionsReadiness}
 from "../scripts/asf/v3/github-app-permission-readiness.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO,SH="a".repeat(40),NEW="b".repeat(40);
const REF="refs/heads/asf/control/active-wave-v3";
const rule=(id,pattern,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[pattern],exclude:[]}},
 rules:types.map(type=>type==="required_status_checks"?{
  type,parameters:{required_status_checks:[{context:"check",integration_id:15368}]}
 }:{type}),bypass_actors:bypass
});
const controller=()=>[{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}];
const set=(waves=false)=>[
 rule(25163425,"refs/heads/main",["deletion","non_fast_forward","pull_request","required_status_checks"]),
 rule(25316890,REF,["creation","update"],controller()),
 rule(25316926,REF,["deletion","non_fast_forward"]),
 ...(waves?[
  rule(25400001,"refs/heads/asf/waves/*",["creation","update"],controller()),
  rule(25400002,"refs/heads/asf/waves/*",["deletion","non_fast_forward"])
 ]:[])
];
function fixture({waves=false,move=false,refStatus=404,ruleMutate=null,badRead=false}={}){
 let rules=set(waves),mainReads=0;
 if(ruleMutate)rules=rules.map(r=>r.id===ruleMutate.id?{...r,...ruleMutate}:r);
 const calls=[];
 const get=async path=>{
  calls.push(path);
  if(path===BASE+"/git/ref/heads/main"){
   mainReads++;
   return {ok:true,data:{ref:"refs/heads/main",object:{type:"commit",
    sha:move&&mainReads>=2?NEW:SH}}};
  }
  if(path===BASE+"/rulesets")
   return {ok:true,data:rules.map(x=>({id:x.id}))};
  for(const rule of rules)
   if(path===BASE+"/rulesets/"+rule.id)
    return badRead&&rule.id===25316890?{ok:false,error:{status:403}}:
     {ok:true,data:rule};
  if(path===BASE+"/git/ref/heads/asf/control/active-wave-v3")
   return refStatus===200?{ok:true,data:{ref:REF,
    object:{type:"commit",sha:SH}}}:{ok:false,error:{status:refStatus}};
  return {ok:false,error:{status:404}};
 };
 return {readClient:{get},calls};
}
const deny=r=>{
 for(const k of ["authorized","canWrite","canCreateRef","canUseAppToken",
 "canStartPaid","canSpend","canRetry"])
  assert.equal(r[k],false,k);
};
test("actual global policy but missing wave rulesets blocks any App launch",async()=>{
 const f=fixture(),r=await observeAsfV3AppPermissionsReadiness({
  readClient:f.readClient,expectedMainSha:SH});
 assert.equal(r.status,"blocked");
 assert.equal(r.reason,"wave_rulesets_missing_or_unverified");
 assert.equal(r.evidence.controllerAppId,5361227);
 assert.equal(r.evidence.executorAppId,5321746);
 assert.equal(r.evidence.globalRefState,"absent_observed_not_authorizing_bootstrap");
 assert.equal(r.evidence.actualAppPermissionsProven,false);
 assert.equal(f.calls.filter(x=>x===BASE+"/git/ref/heads/main").length,2);
 deny(r);
});
test("even all five structural rulesets never certify a real GitHub App",async()=>{
 const f=fixture({waves:true,refStatus:200});
 const r=await observeAsfV3AppPermissionsReadiness({
  readClient:f.readClient,expectedMainSha:SH});
 assert.equal(r.status,"structurally_observed_not_authorized");
 assert.equal(r.evidence.globalRefState,"present_do_not_recreate");
 assert.equal(r.evidence.actualAppPermissionsProven,false);
 assert.equal(r.evidence.realAppDenyTestsCompleted,false);
 deny(r);
});
test("wrong controller bypass, missing API permission or ambiguous global ref denies",async()=>{
 for(const opts of [
  {ruleMutate:{id:25316890,bypass_actors:[{
   actor_type:"Integration",actor_id:5321746,bypass_mode:"always"}]}},
  {badRead:true},{refStatus:403}
 ]){
  const f=fixture(opts),r=await observeAsfV3AppPermissionsReadiness({
   readClient:f.readClient,expectedMainSha:SH});
  assert.notEqual(r.status,"structurally_observed_not_authorized");
  deny(r);
 }
});
test("SHA race or invalid runner reader cannot produce an audit approval",async()=>{
 const f=fixture({waves:true,move:true});
 for(const data of [
  {expectedMainSha:"bad",readClient:f.readClient},
  {expectedMainSha:SH,readClient:null},
  {expectedMainSha:SH,readClient:f.readClient}
 ]){
  const r=await observeAsfV3AppPermissionsReadiness(data);
  assert.notEqual(r.status,"structurally_observed_not_authorized");
  deny(r);
 }
});
