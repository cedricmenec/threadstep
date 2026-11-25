import test from "node:test";
import assert from "node:assert/strict";
import {LAB_RULES,evaluateV3LabRulesets,auditV3LabRulePolicy}
 from "../scripts/asf/v3/g2-lab-ruleset-policy.mjs";
const REPO="cedricmenec/asf-v3-ruleset-lab";
const ROOT="repos/"+REPO;
function fixture(){
 return LAB_RULES.map((c,i)=>({
  id:100+i,name:c.name,target:"branch",source_type:"Repository",
  source:REPO,enforcement:"active",
  conditions:{ref_name:{include:[c.target],exclude:[]}},
  rules:c.types.map(type=>({type})),
  bypass_actors:c.controllerBypass?[
   {actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}
  ]:[]
 }));
}
function noAuthority(x){
 for(const key of ["authorized","permissionsProven","tokenIdentityProven",
  "realServerDenyTestsProven","canConfigure","canWrite","canDispatch",
  "canSpend","canRetry"])assert.equal(x[key],false,key);
}
test("empty new lab reports not configured, never G2/G3 pass",()=>{
 const x=evaluateV3LabRulesets({repository:REPO,rulesets:[]});
 assert.equal(x.status,"not_configured");noAuthority(x);
});
test("exact four independent lab rules are structure-only evidence",()=>{
 const x=evaluateV3LabRulesets({repository:REPO,rulesets:fixture()});
 assert.equal(x.status,"structure_observed_not_authorized");noAuthority(x);
});
test("every unsafe writer bypass or missing history rule fails closed",()=>{
 const variations=[
  rules=>rules[0].bypass_actors[0].actor_id=5321746,
  rules=>rules[0].bypass_actors[0].bypass_mode="pull_request",
  rules=>rules[0].bypass_actors.push({
   actor_type:"RepositoryRole",actor_id:5,bypass_mode:"always"
  }),
  rules=>rules[1].bypass_actors.push({
   actor_type:"Integration",actor_id:5361227,bypass_mode:"always"
  }),
  rules=>rules[2].rules.push({type:"deletion"}),
  rules=>rules[3].rules=rules[3].rules.filter(x=>x.type!=="non_fast_forward"),
  rules=>rules[1].conditions.ref_name.exclude.push("refs/heads/main"),
  rules=>rules[3].conditions.ref_name.include=["refs/heads/asf/waves/*"],
  rules=>rules[0].enforcement="evaluate",
  rules=>rules[0].source="cedricmenec/threadstep",
  rules=>rules[0].target="tag"
 ];
 for(const edit of variations){
  const rules=fixture();edit(rules);
  const result=evaluateV3LabRulesets({repository:REPO,rulesets:rules});
  assert.notEqual(result.status,"structure_observed_not_authorized");
  noAuthority(result);
 }
});
test("duplicates, extra unreviewed rules and non-dedicated repo are denied",()=>{
 for(const rules of [fixture().slice(0,3),
  [...fixture(),{...fixture()[0],id:999}],
  fixture().map((x,i)=>({...x,id:i===1?100:x.id}))]){
  const result=evaluateV3LabRulesets({repository:REPO,rulesets:rules});
  assert.equal(result.status,"uncertain");noAuthority(result);
 }
 const unsafe=evaluateV3LabRulesets({
  repository:"cedricmenec/threadstep",rulesets:fixture()
 });
 assert.equal(unsafe.status,"rejected");noAuthority(unsafe);
});
function reader(rules){
 const paths=[];
 const get=async path=>{
  paths.push(path);
  if(path===ROOT)return {ok:true,data:{
   full_name:REPO,visibility:"public",archived:false
  }};
  if(path===ROOT+"/rulesets?per_page=100&page=1")
   return {ok:true,data:rules.map(x=>({id:x.id,name:x.name}))};
  if(path.startsWith(ROOT+"/rulesets/")){
   const id=Number(path.slice((ROOT+"/rulesets/").length));
   const rule=rules.find(x=>x.id===id);
   return {ok:!!rule,data:rule};
  }
  throw Error("unexpected_path");
 };
 return {readClient:{get},paths};
}
test("audit reads exact lab metadata, collection and four details",async()=>{
 const r=reader(fixture());
 const result=await auditV3LabRulePolicy({repository:REPO,
  readClient:r.readClient});
 assert.equal(result.status,"structure_observed_not_authorized");
 assert.equal(r.paths.length,7);
 assert.deepEqual(r.paths.slice(0,3),[ROOT,
  ROOT+"/rulesets?per_page=100&page=1",
  ROOT+"/rulesets?per_page=100&page=1"]);
 noAuthority(result);
});
test("real empty repo produces not_configured and no detail reads",async()=>{
 const r=reader([]);
 const result=await auditV3LabRulePolicy({repository:REPO,
  readClient:r.readClient});
 assert.equal(result.status,"not_configured");
 assert.equal(r.paths.length,2);noAuthority(result);
});
test("plan 403, altered list, changed detail and network errors fail closed",async()=>{
 const fail=reader(fixture());
 const f=fail.readClient.get;
 fail.readClient.get=async path=>path.includes("rulesets?")?
  {ok:false,error:{status:403}}:f(path);
 const a=await auditV3LabRulePolicy({repository:REPO,readClient:fail.readClient});
 assert.equal(a.status,"uncertain");noAuthority(a);
 const changed=reader(fixture());
 let count=0;const g=changed.readClient.get;
 changed.readClient.get=async path=>{
  if(path.includes("rulesets?")&&++count===2)
   return {ok:true,data:[]};
  return g(path);
 };
 const b=await auditV3LabRulePolicy({repository:REPO,
  readClient:changed.readClient});
 assert.equal(b.status,"uncertain");noAuthority(b);
 const mismatch=reader(fixture());
 const h=mismatch.readClient.get;
 mismatch.readClient.get=async path=>{
  const x=await h(path);
  if(path.endsWith("/rulesets/100"))return {ok:true,
   data:{...x.data,id:999}};
  return x;
 };
 const c=await auditV3LabRulePolicy({repository:REPO,
  readClient:mismatch.readClient});
 assert.equal(c.status,"uncertain");noAuthority(c);
});
