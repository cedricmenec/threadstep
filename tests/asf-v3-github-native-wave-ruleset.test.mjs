import test from "node:test";
import assert from "node:assert/strict";
import {
 ASF_V3_WAVE_REF_PATTERN,inspectV3GithubWaveRulesets,
 observeV3GithubWaveRulesetPolicy
} from "../scripts/asf/v3/github-native-wave-ruleset.mjs";
const BASE="repos/cedricmenec/threadstep",REPO="cedricmenec/threadstep";
const rule=(id,types,bypass=[])=>({
 id,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:[ASF_V3_WAVE_REF_PATTERN],exclude:[]}},
 bypass_actors:bypass,rules:types.map(type=>({type}))
});
const writer=()=>rule(8,["creation","update"],[{
 actor_type:"Integration",actor_id:5361227,bypass_mode:"always"
}]);
const immutable=()=>rule(9,["deletion","non_fast_forward"]);
const noRights=r=>{
 for(const x of ["authorized","canCreate","canWrite","canAck",
  "canClaim","canDispatch","canSpend","canRetry"])
  assert.equal(r[x],false,x);
};
test("writer and immutable wave rulesets stay independent, with App ID pinned",()=>{
 const r=inspectV3GithubWaveRulesets({
  writer:writer(),immutable:immutable()
 });
 assert.equal(r.status,"wave_rule_structure_observed_not_authorized");
 assert.equal(r.evidence.waveRefPattern,"refs/heads/asf/waves/*");
 assert.equal(r.evidence.writerId,8);
 assert.equal(r.evidence.immutableId,9);
 assert.equal(r.evidence.controllerAppId,5361227);
 noRights(r);
});
test("no V1 bot, owner, alternative App or cancelled bypass may write waves",()=>{
 for(const actor of [
  {actor_type:"Integration",actor_id:5321746,bypass_mode:"always"},
  {actor_type:"Integration",actor_id:5361228,bypass_mode:"always"},
  {actor_type:"User",actor_id:5361227,bypass_mode:"always"},
  {actor_type:"Integration",actor_id:5361227,bypass_mode:"pull_request"}
 ]){
  const r=inspectV3GithubWaveRulesets({
   writer:{...writer(),bypass_actors:[actor]},immutable:immutable()
  });
  assert.equal(r.status,"rejected");noRights(r);
 }
});
test("immutable history must forbid deletion and non-FF without bypass",()=>{
 for(const mutated of [
  {...immutable(),bypass_actors:[{
   actor_type:"Integration",actor_id:5361227,bypass_mode:"always"
  }]},
  rule(9,["deletion"]),
  rule(9,["non_fast_forward"]),
  rule(8,["deletion","non_fast_forward"]),
  rule(9,["deletion","non_fast_forward","update"])
 ]){
  const r=inspectV3GithubWaveRulesets({
   writer:writer(),immutable:mutated
  });
  assert.equal(r.status,"rejected");
  noRights(r);
 }
});
test("wrong branch pattern, inactive enforcement or duplicate rules deny",()=>{
 for(const change of [
  {enforcement:"disabled"},
  {conditions:{ref_name:{include:["refs/heads/asf/control/active-wave-v3"],
   exclude:[]}}},
  {conditions:{ref_name:{include:["refs/heads/asf/waves/*"],
   exclude:["refs/heads/asf/waves/some-id"]}}},
  {rules:[{type:"update"},{type:"update"}]},
  {rules:[{type:"creation"},{type:"update"},{type:"deletion"}]}
 ]){
  const r=inspectV3GithubWaveRulesets({
   writer:{...writer(),...change},immutable:immutable()
  });
  assert.equal(r.status,"rejected");noRights(r);
 }
});
function fixture({missing=false,combined=false,brokenId=false,fail=false}={}){
 const arr=missing?[]:combined?[{
  ...writer(),rules:[{type:"creation"},{type:"update"},
   {type:"deletion"},{type:"non_fast_forward"}]
 }]:[writer(),immutable()];
 const get=async path=>{
  if(fail&&path===BASE+"/rulesets/8")return {ok:false,error:{status:403}};
  if(path===BASE+"/rulesets")
   return {ok:true,data:arr.map(x=>({id:x.id}))};
  for(const obj of arr)
   if(path===BASE+"/rulesets/"+obj.id)
    return {ok:true,data:brokenId?{...obj,id:999}:obj};
  return {ok:false,error:{status:404}};
 };
 return {get};
}
test("GitHub observer reads every live rule detail and refuses absent wave protection",async()=>{
 const r=await observeV3GithubWaveRulesetPolicy(fixture());
 assert.equal(r.status,"wave_rule_structure_observed_not_authorized");
 noRights(r);
 for(const args of [{missing:true},{combined:true},{brokenId:true},{fail:true}]){
  const out=await observeV3GithubWaveRulesetPolicy(fixture(args));
  assert.notEqual(out.status,"wave_rule_structure_observed_not_authorized");
  noRights(out);
 }
});
test("unknown/missing reader or duplicate IDs cannot prove GitHub wave protection",async()=>{
 const r=await observeV3GithubWaveRulesetPolicy(null);
 assert.equal(r.status,"uncertain");noRights(r);
 const duplicate={get:async path=>path===BASE+"/rulesets"?
  {ok:true,data:[{id:8},{id:8}]}:
  path===BASE+"/rulesets/8"?{ok:true,data:writer()}:
  {ok:false,error:{status:404}}};
 const out=await observeV3GithubWaveRulesetPolicy(duplicate);
 assert.equal(out.status,"rejected");noRights(out);
});
