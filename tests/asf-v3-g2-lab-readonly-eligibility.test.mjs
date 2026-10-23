import test from "node:test";
import assert from "node:assert/strict";
import {auditV3LabEligibility,createV3LabReadOnlyClient}
 from "../scripts/asf/v3/g2-lab-readonly-eligibility.mjs";

const REPO="cedricmenec/asf-v3-mutex-lab";
const ROOT="repos/"+REPO;
function fixture({visibility="private",archived=false,code=200,
 pages=[[]],metadata=true}={}){
 const paths=[];
 const readClient={get:async path=>{
  paths.push(path);
  if(path===ROOT)return {ok:true,data:metadata?{
   full_name:REPO,visibility,archived
  }:{full_name:"attacker/different",visibility,archived}};
  const match=path.match(/\/rulesets\?per_page=100&page=(\d+)$/);
  if(match){
   if(code!==200)return {ok:false,error:{status:code}};
   return {ok:true,data:pages[Number(match[1])-1]??[]};
  }
  throw Error("unexpected_path");
 }};
 return {readClient,paths};
}
function noAuthority(result){
 for(const name of ["authorized","canCreate","canWrite",
  "canModifyRulesets","canUseAppToken","canDispatch","canSpend","canRetry",
  "actualAppPermissionsProven","realAppDenyTestsCompleted"])
  assert.equal(result[name],false,name);
}
test("a private repo with GitHub 403 is blocked, without inferring token cause",async()=>{
 const f=fixture({code:403});
 const r=await auditV3LabEligibility({repository:REPO,readClient:f.readClient});
 assert.equal(r.status,"blocked");
 assert.equal(r.httpStatus,403);
 assert.equal(r.reason,"rulesets_endpoint_forbidden_scope_or_plan");
 assert.deepEqual(f.paths,[ROOT,ROOT+"/rulesets?per_page=100&page=1"]);
 noAuthority(r);
});
test("a readable public repo is ONLY a candidate, even when rulesets exist",async()=>{
 const f=fixture({visibility:"public",pages:[[{id:20001}]]});
 const r=await auditV3LabEligibility({repository:REPO,readClient:f.readClient});
 assert.equal(r.status,"candidate_only");
 assert.equal(r.rulesetCount,1);
 assert.equal(r.rulesetsEnumerationComplete,true);
 assert.equal(r.separateControllerExecutorAppsVerified,false);
 noAuthority(r);
});
test("an empty list is not a validated lab or an App authorization",async()=>{
 const f=fixture({visibility:"public"});
 const r=await auditV3LabEligibility({repository:REPO,readClient:f.readClient});
 assert.equal(r.status,"candidate_only");
 assert.equal(r.hasRulesets,false);
 noAuthority(r);
});
test("a full API page requires reading the next page before counting",async()=>{
 const first=Array.from({length:100},(_,i)=>({id:1000+i}));
 const f=fixture({visibility:"public",pages:[first,[{id:2000}]]});
 const r=await auditV3LabEligibility({repository:REPO,readClient:f.readClient});
 assert.equal(r.status,"candidate_only");
 assert.equal(r.rulesetCount,101);
 assert.equal(f.paths.length,3);
 noAuthority(r);
});
test("three full pages or duplicate ruleset IDs fail closed",async()=>{
 const first=Array.from({length:100},(_,i)=>({id:1000+i}));
 const exhausted=fixture({pages:[first,
  first.map(x=>({id:x.id+100})),first.map(x=>({id:x.id+200}))]});
 const r=await auditV3LabEligibility({repository:REPO,readClient:exhausted.readClient});
 assert.equal(r.status,"uncertain");
 assert.equal(r.reason,"rulesets_pagination_limit");
 noAuthority(r);
 const duplicated=fixture({pages:[[{id:1},{id:1}]]});
 const d=await auditV3LabEligibility({repository:REPO,readClient:duplicated.readClient});
 assert.equal(d.reason,"rulesets_duplicate_or_invalid");
 noAuthority(d);
});
test("identity mismatch, archived repo and real production target are refused",async()=>{
 const bad=fixture({metadata:false});
 const archived=fixture({archived:true});
 const a=await auditV3LabEligibility({repository:REPO,readClient:bad.readClient});
 const b=await auditV3LabEligibility({repository:REPO,readClient:archived.readClient});
 const c=await auditV3LabEligibility({repository:"cedricmenec/threadstep",
  readClient:archived.readClient});
 assert.equal(a.status,"uncertain");
 assert.equal(b.status,"blocked");
 assert.equal(c.status,"rejected");
 noAuthority(a);noAuthority(b);noAuthority(c);
});
test("transport uses GET only and masks token in errors",async()=>{
 const calls=[];
 const client=createV3LabReadOnlyClient({repository:REPO,token:"do-not-print",
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   return {ok:false,status:403};
  }});
 for(const path of [
  ROOT+"/rulesets?per_page=100&page=4",ROOT+"/rulesets",
  ROOT+"/git/refs/heads/main",
  "repos/cedricmenec/threadstep/rulesets?per_page=100&page=1"
 ]){
  const r=await client.get(path);
  assert.equal(r.ok,false);
 }
 assert.equal(calls.length,0);
 const r=await client.get(ROOT+"/rulesets?per_page=100&page=1");
 assert.equal(r.ok,false);
 assert.equal(r.error.status,403);
 assert.equal(JSON.stringify(r).includes("do-not-print"),false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.method,"GET");
 assert.equal(calls[0].opts.redirect,"error");
});
