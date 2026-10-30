import test from "node:test";
import assert from "node:assert/strict";
import { observeV3GithubDelivery }
 from "../scripts/asf/v3/github-native-delivery-observer.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO,S=n=>n.repeat(40);
const HEAD=S("a"),MERGE=S("b"),MAIN=S("c");
const mainRule={id:1,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:["refs/heads/main"],exclude:[]}},
 bypass_actors:[],rules:[
  {type:"pull_request"},{type:"deletion"},{type:"non_fast_forward"},
  {type:"required_status_checks",parameters:{required_status_checks:[{context:"check"}]}}
 ]};
const globalRule={id:2,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:["refs/heads/asf/control/active-wave-v3"],exclude:[]}},
 bypass_actors:[{actor_type:"Integration",actor_id:5361227,bypass_mode:"always"}],
 rules:[{type:"creation"},{type:"update"}]};
const immutableRule={id:3,source:REPO,target:"branch",enforcement:"active",
 conditions:{ref_name:{include:["refs/heads/asf/control/active-wave-v3"],exclude:[]}},
 bypass_actors:[],rules:[{type:"deletion"},{type:"non_fast_forward"}]};
function f({wrongMain=false,alter={},errorPath=null,fullList=false}={}){
 const calls=[],p={
  number:123,state:"closed",merged:true,merged_at:"2026-10-17T13:00:00Z",
  base:{ref:"main",repo:{full_name:REPO}},
  head:{sha:HEAD,repo:{full_name:REPO}},merge_commit_sha:MERGE,
  ...alter.pr
 };
 const check=sha=>({total_count:1,check_runs:[{
  name:"check",head_sha:sha,app:{slug:"github-actions"},
  status:"completed",conclusion:"success"
 }]});
 const data={
  [BASE+"/rulesets"]:[{id:1},{id:2},{id:3}],
  [BASE+"/rulesets/1"]:mainRule,
  [BASE+"/rulesets/2"]:globalRule,
  [BASE+"/rulesets/3"]:immutableRule,
  [BASE+"/pulls/123"]:p,
  [BASE+"/compare/"+MERGE+"..."+MAIN]:{
   base_commit:{sha:MERGE},status:"ahead",behind_by:0,ahead_by:2
  },
  [BASE+"/commits/"+HEAD+"/check-runs?per_page=100"]:check(HEAD),
  [BASE+"/commits/"+MERGE+"/check-runs?per_page=100"]:check(MERGE),
  [BASE+"/actions/runs?head_sha="+MERGE+"&per_page=100"]:{
   total_count:1,workflow_runs:[{
    id:909,repository:{full_name:REPO},
    path:".github/workflows/pages.yml",event:"push",head_branch:"main",
    head_sha:MERGE,run_attempt:1,status:"completed",conclusion:"success"
   }]
  },
  [BASE+"/actions/runs/909/jobs?per_page=100"]:{
   total_count:3,jobs:[
    {name:"validate",status:"completed",conclusion:"success"},
    {name:"build",status:"completed",conclusion:"success"},
    {name:"deploy",head_sha:MERGE,status:"completed",conclusion:"success"}
   ]
  }
 };
 for(const [k,v] of Object.entries(alter)){
  if(k==="pr")continue;
  data[k]=v;
 }
 const get=async path=>{
  calls.push(path);
  if(path===errorPath)throw Error("token_please_DO_NOT_LOG");
  if(path===BASE+"/git/ref/heads/main")
   return {ok:true,data:{ref:"refs/heads/main",object:{
    type:"commit",sha:wrongMain&&calls.filter(x=>x===path).length>1?
     S("e"):MAIN
   }}};
  if(!Object.hasOwn(data,path))return {ok:false,status:404};
  return {ok:true,data:data[path]};
 };
 return {calls,data,readClient:{get},prNumber:123,expectedHeadSha:HEAD};
}
const noRights=r=>{
 for(const key of ["authorized","canRelease","canQuarantine",
  "canDispatch","canSpend","canRetry"])
  assert.equal(r[key],false);
};
test("independent PR + head check + main check + Pages deploy yields ONLY evidence",async()=>{
 const x=f();const r=await observeV3GithubDelivery(x);
 assert.equal(r.status,"delivery_observed_not_authorized",JSON.stringify(r));
 assert.equal(r.evidence.proof.prNumber,123);
 assert.equal(r.evidence.proof.headSha,HEAD);
 assert.equal(r.evidence.proof.mergeSha,MERGE);
 assert.equal(r.evidence.proof.pages.sha,MERGE);
 assert.equal(r.evidence.proofHash,contentSha256(r.evidence.proof));
 assert.equal(x.calls.filter(y=>y===BASE+"/git/ref/heads/main").length,2);
 noRights(r);
});
test("wrong PR sha, branch, repo, merge and status reject",async()=>{
 for(const pr of [
  {head:{sha:S("d"),repo:{full_name:REPO}}},
  {base:{ref:"develop",repo:{full_name:REPO}}},
  {base:{ref:"main",repo:{full_name:"attacker/repo"}}},
  {merge_commit_sha:"garbage"},
  {merged:false},
  {merged_at:null}
 ]){
  const r=await observeV3GithubDelivery(f({alter:{pr}}));
  assert.equal(r.status,"rejected",JSON.stringify(pr));noRights(r);
 }
});
test("head CI and main CI must each be successful independent exact SHA check",async()=>{
 for(const [path,bad] of [
  [BASE+"/commits/"+HEAD+"/check-runs?per_page=100",{
    total_count:1,check_runs:[{name:"check",head_sha:HEAD,
     app:{slug:"attacker"},status:"completed",conclusion:"success"}]}],
  [BASE+"/commits/"+MERGE+"/check-runs?per_page=100",{
    total_count:1,check_runs:[{name:"check",head_sha:HEAD,
     app:{slug:"github-actions"},status:"completed",conclusion:"success"}]}],
  [BASE+"/commits/"+HEAD+"/check-runs?per_page=100",{
    total_count:2,check_runs:[{name:"check",head_sha:HEAD,
     app:{slug:"github-actions"},status:"completed",conclusion:"success"},
     {name:"check",head_sha:HEAD,app:{slug:"github-actions"},
     status:"completed",conclusion:"success"}]}]
 ]){
  const r=await observeV3GithubDelivery(f({alter:{[path]:bad}}));
  assert.equal(r.reason,"independent_ci_on_exact_shas_missing");noRights(r);
 }
});
test("squashed PR merge must actually be an ancestor of observed main",async()=>{
 const path=BASE+"/compare/"+MERGE+"..."+MAIN;
 for(const bad of [
  {base_commit:{sha:MERGE},status:"diverged",behind_by:1},
  {base_commit:{sha:MERGE},status:"behind",behind_by:2},
  {base_commit:{sha:S("d")},status:"ahead",behind_by:0}
 ]){
  const r=await observeV3GithubDelivery(f({alter:{[path]:bad}}));
  assert.equal(r.reason,"merge_not_ancestor_of_current_main");
  noRights(r);
 }
});
test("Pages must be successful push of exact merge SHA and successful deploy job",async()=>{
 const runs=BASE+"/actions/runs?head_sha="+MERGE+"&per_page=100";
 const jobs=BASE+"/actions/runs/909/jobs?per_page=100";
 for(const bad of [
  {total_count:0,workflow_runs:[]},
  {total_count:1,workflow_runs:[{id:909,path:".github/workflows/pages.yml",
   event:"workflow_dispatch",head_branch:"main",head_sha:MERGE}]},
  {total_count:1,workflow_runs:[{id:909,repository:{full_name:REPO},
   path:".github/workflows/pages.yml",event:"push",head_branch:"main",
   head_sha:MERGE,run_attempt:2,status:"completed",conclusion:"success"}]}
 ]){
  const r=await observeV3GithubDelivery(f({alter:{[runs]:bad}}));
  assert.equal(r.status,"rejected");noRights(r);
 }
 for(const item of [
  {name:"deploy",head_sha:HEAD,status:"completed",conclusion:"success"},
  {name:"deploy",head_sha:MERGE,status:"completed",conclusion:"failure"},
  {name:"deploy",head_sha:MERGE,status:"queued",conclusion:null}
 ]){
  const r=await observeV3GithubDelivery(f({alter:{[jobs]:{
   total_count:1,jobs:[item]
  }}}));
  assert.equal(r.reason,"pages_deploy_job_unverified");noRights(r);
 }
});
test("missing global protection and moving main ref do not qualify",async()=>{
 const g=f({alter:{[BASE+"/rulesets"]:[{id:1}]}});
 const a=await observeV3GithubDelivery(g);
 assert.equal(a.status,"rejected");noRights(a);
 const b=await observeV3GithubDelivery(f({wrongMain:true}));
 assert.equal(b.status,"uncertain");noRights(b);
});
test("missing or paginated data and transport failures never fabricate delivery",async()=>{
 const ci=BASE+"/commits/"+HEAD+"/check-runs?per_page=100";
 const runs=BASE+"/actions/runs?head_sha="+MERGE+"&per_page=100";
 for(const args of [
  {errorPath:ci},
  {errorPath:BASE+"/pulls/123"},
  {alter:{[runs]:{total_count:100,workflow_runs:[]}}},
  {alter:{[ci]:{total_count:100,check_runs:[]}}}
 ]){
  const r=await observeV3GithubDelivery(f(args));
  assert.notEqual(r.status,"delivery_observed_not_authorized");noRights(r);
  assert.doesNotMatch(JSON.stringify(r),/token_please/);
 }
});
test("untrusted caller must supply pinned SHA and PR number, never can spend",async()=>{
 const x=f();
 for(const patch of [{expectedHeadSha:"bad"},{prNumber:0},
  {prNumber:"123"},{readClient:null}]){
  const r=await observeV3GithubDelivery({...x,...patch});
  assert.notEqual(r.status,"delivery_observed_not_authorized");noRights(r);
 }
});
