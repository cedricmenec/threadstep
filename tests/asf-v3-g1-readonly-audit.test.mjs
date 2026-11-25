import test from "node:test";
import assert from "node:assert/strict";
import {auditV3G1ReadOnly,createV3G1ReadOnlyClient}
 from "../scripts/asf/v3/g1-readonly-audit.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const SHA="e".repeat(40),GLOBAL="refs/heads/asf/control/active-wave-v3";
const WAVE="refs/heads/asf/waves/*";
const bypass=[{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}];
function rule(id,ref,types,bypassActors=[]){
 return {id,source:REPO,target:"branch",enforcement:"active",
  conditions:{ref_name:{include:[ref],exclude:[]}},
  rules:types.map(type=>type==="required_status_checks"?
   {type,parameters:{required_status_checks:[{context:"check"}]}}:{type}),
  bypass_actors:bypassActors};
}
function rules({misconfigured=true}={}){
 return [
  rule(25163425,"refs/heads/main",
   ["deletion","non_fast_forward","pull_request","required_status_checks"]),
  rule(25316890,GLOBAL,["creation","update"],bypass),
  rule(25316926,GLOBAL,["deletion","non_fast_forward"]),
  rule(25747770,WAVE,misconfigured?
   ["deletion","non_fast_forward","creation","update"]:
   ["creation","update"],bypass),
  rule(25747923,WAVE,["deletion","non_fast_forward"])
 ];
}
function fixture({misconfigured=true,mainMoves=false,readFails=false,
 missingImmutable=false}={}){
 const data=rules({misconfigured}).filter(r=>!missingImmutable||
  r.id!==25747923);
 const calls=[];
 const get=async path=>{
  calls.push(path);
  if(path===BASE+"/git/ref/heads/main")
   return {ok:true,data:{ref:"refs/heads/main",object:{type:"commit",
    sha:mainMoves&&calls.filter(x=>x===path).length>1?
     "f".repeat(40):SHA}}};
  if(path===BASE+"/git/ref/heads/asf/control/active-wave-v3")
   return {ok:false,error:{status:404}};
  if(path===BASE+"/rulesets")
   return {ok:true,data:data.map(x=>({id:x.id}))};
  const found=data.find(r=>path===BASE+"/rulesets/"+r.id);
  if(found)return readFails&&found.id===25747770?
   {ok:false,error:{status:403}}:{ok:true,data:found};
  return {ok:false,error:{status:404}};
 };
 return {readClient:{get},calls};
}
function neverAuthorizing(v){
 for(const key of ["authorized","canCreateRef","canWrite","canDispatch",
  "canSpend","canRetry","actualAppPermissionsProven",
  "realAppDenyTestsCompleted"])
  assert.equal(v[key],false,key);
}
test("five actual October ruleset shapes are blocked: wave writer has extra history types",async()=>{
 const f=fixture();
 const d=await auditV3G1ReadOnly({readClient:f.readClient,
  expectedMainSha:SHA});
 assert.equal(d.status,"blocked",JSON.stringify(d));
 assert.equal(d.reason,"wave_rulesets_missing_or_unverified");
 assert.equal(d.waveRulesetReason,
  "wave_creation_and_updates_not_controller_only");
 assert.equal(d.globalRulesetStatus,"structurally_consistent");
 assert.equal(d.globalRefState,
  "absent_observed_not_authorizing_bootstrap");
 assert.equal(d.structurallyObserved,false);
 assert.equal(d.controllerAppId,5361227);
 assert.equal(d.executorAppId,5321746);
 assert.ok(f.calls.includes(BASE+"/rulesets/25747770"));
 assert.ok(f.calls.includes(BASE+"/rulesets/25747923"));
 neverAuthorizing(d);
});
test("corrected writer types yield structural observation, NEVER App or payment approval",async()=>{
 const f=fixture({misconfigured:false});
 const d=await auditV3G1ReadOnly({readClient:f.readClient,
  expectedMainSha:SHA});
 assert.equal(d.status,"structurally_observed_not_authorized",JSON.stringify(d));
 assert.equal(d.waveRulesetStatus,"wave_rule_structure_observed_not_authorized");
 assert.equal(d.structurallyObserved,true);
 assert.equal(d.globalRefState,"absent_observed_not_authorizing_bootstrap");
 neverAuthorizing(d);
});
test("missing immutable protection, unreadable details or moving main SHA fail closed",async()=>{
 for(const options of [{missingImmutable:true},{readFails:true},
  {mainMoves:true}]){
  const f=fixture(options);
  const d=await auditV3G1ReadOnly({
   readClient:f.readClient,expectedMainSha:SHA});
  assert.equal(d.structurallyObserved,false,JSON.stringify(options));
  neverAuthorizing(d);
 }
 const x=await auditV3G1ReadOnly({readClient:null,expectedMainSha:SHA});
 assert.equal(x.status,"uncertain");neverAuthorizing(x);
});
test("transport supports only GET for rulesets/main/global refs, not API write paths",async()=>{
 const paths=[],token="read-only-test-token";
 const client=createV3G1ReadOnlyClient({token,fetchImpl:async(url,opts)=>{
  paths.push({url,opts});
  return {ok:true,json:async()=>[]};
 }});
 for(const path of [BASE+"/git/refs/heads/asf/control/active-wave-v3",
  BASE+"/git/trees",BASE+"/actions/workflows/dispatches",
  "repos/other/repo/rulesets",BASE+"/rulesets/0",
  BASE+"/rulesets/123/other",
  "https://api.github.com/"+BASE+"/rulesets"]){
  const r=await client.get(path);
  assert.equal(r.ok,false);
 }
 assert.equal(paths.length,0,"invalid paths cannot hit HTTP");
 for(const path of [BASE+"/rulesets",BASE+"/rulesets/25747770",
  BASE+"/git/ref/heads/main",
  BASE+"/git/ref/heads/asf/control/active-wave-v3"]){
  assert.equal((await client.get(path)).ok,true);
 }
 assert.equal(paths.length,4);
 for(const {url,opts} of paths){
  assert.match(url,/^https:\/\/api\.github\.com\/repos\/cedricmenec\/threadstep\//);
  assert.equal(opts.method,"GET");
  assert.equal(opts.redirect,"error");
  assert.equal(opts.headers.authorization,"Bearer "+token);
 }
});
test("transport masks raw credential-bearing error, including read-only 403",async()=>{
 const client=createV3G1ReadOnlyClient({token:"shh",fetchImpl:async()=>({
  ok:false,status:403
 })});
 const d=await client.get(BASE+"/rulesets");
 assert.equal(d.ok,false);
 assert.equal(d.error.status,403);
 assert.equal(JSON.stringify(d).includes("shh"),false);
});
