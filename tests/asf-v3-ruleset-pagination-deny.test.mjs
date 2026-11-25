/**
 * ASF-V3-041: a GitHub ruleset collection at its default 30-item limit
 * cannot establish the absence of additional, unseen protection rules.
 * All observations are synthetic and strictly read-only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {observeV3GithubRulesetPolicy}
 from "../scripts/asf/v3/github-native-control.mjs";
import {observeV3GithubWaveRulesetPolicy}
 from "../scripts/asf/v3/github-native-wave-ruleset.mjs";

const COLLECTION="repos/cedricmenec/threadstep/rulesets";
function fixture(size){
 const paths=[];
 const readClient={get:async path=>{
  paths.push(path);
  if(path===COLLECTION)
   return {ok:true,data:Array.from({length:size},
    (_,i)=>({id:900000+i}))};
  throw Error("details_should_not_be_requested_for_full_page");
 }};
 return {readClient,paths};
}
test("global ruleset observer stops before details at GitHub default page boundary",async()=>{
 const f=fixture(30);
 const r=await observeV3GithubRulesetPolicy(f.readClient);
 assert.equal(r.status,"uncertain");
 assert.equal(r.reason,"rulesets_pagination_unconfirmed");
 assert.equal(r.authorized,false);
 assert.equal(r.canSpend,false);
 assert.deepEqual(f.paths,[COLLECTION]);
});
test("wave ruleset observer stops before details at GitHub default page boundary",async()=>{
 const f=fixture(30);
 const r=await observeV3GithubWaveRulesetPolicy(f.readClient);
 assert.equal(r.status,"uncertain");
 assert.equal(r.reason,"wave_ruleset_pagination_unconfirmed");
 assert.equal(r.canCreate,false);
 assert.equal(r.canWrite,false);
 assert.equal(r.canSpend,false);
 assert.deepEqual(f.paths,[COLLECTION]);
});
test("underfull collection remains inspectable rather than falsely claiming pagination",async()=>{
 const f=fixture(29);
 const global=await observeV3GithubRulesetPolicy(f.readClient);
 const wave=await observeV3GithubWaveRulesetPolicy(f.readClient);
 assert.equal(global.status,"uncertain");
 assert.equal(global.reason,"ruleset_detail_unavailable");
 assert.equal(wave.status,"uncertain");
 assert.equal(wave.reason,"wave_ruleset_details_unavailable");
 assert.equal(f.paths.filter(p=>p===COLLECTION).length,2);
});
