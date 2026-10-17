import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ASF_V3_SHARED_PAID_MUTEX,inspectV3SharedPaidMutexLayout,
 observeV3GithubSharedPaidMutex}
 from "../scripts/asf/v3/github-native-paid-mutex-readiness.mjs";
const BASE="repos/cedricmenec/threadstep";
const SHA="a".repeat(40),MOVED="b".repeat(40);
const files=[".github/workflows/agent-openspec.yml",
 ".github/workflows/agent-asf.yml",".github/workflows/agent.yml"];
const baseline=()=>({
 v1:Object.fromEntries(files.map(p=>[p,
  readFileSync(new URL("../"+p,import.meta.url),"utf8")])),
 v3:readFileSync(new URL(
  "../.github/workflows/agent-openspec-v3.yml",import.meta.url),"utf8")
});
const futureJob=[
"  paid-development:",
"    needs: child-preflight",
"    concurrency:",
"      group: threadstep-paid-development-v1",
"      cancel-in-progress: false",
"    runs-on: ubuntu-latest",
"    steps:",
"      - run: exit 1"
].join("\n");
const noRights=r=>{
 for(const field of ["authorized","canStartPaid","canPay","canWrite",
 "canDispatch","canSpend","canRetry"])
  assert.equal(r[field],false,field);
};
test("three V1 paid develop jobs share the exact job-level GitHub lock",()=>{
 const r=inspectV3SharedPaidMutexLayout(baseline());
 assert.equal(r.status,"v1_lock_confirmed_v3_paid_job_absent");
 assert.equal(r.evidence.group,ASF_V3_SHARED_PAID_MUTEX);
 assert.equal(r.evidence.v1PaidJobs,3);
 assert.equal(r.evidence.v3PaidJobDeclared,false);
 noRights(r);
});
test("synthetic future V3 paid job must match the V1 group, still no authority",()=>{
 const b=baseline();
 const r=inspectV3SharedPaidMutexLayout({...b,v3:b.v3+"\n"+futureJob});
 assert.equal(r.status,"source_layout_observed_not_authorized");
 assert.equal(r.evidence.v3PaidJobDeclared,true);
 noRights(r);
});
test("future paid job with altered lock, cancel flag or missing block is rejected",()=>{
 const b=baseline();
 for(const text of [
 futureJob.replace(ASF_V3_SHARED_PAID_MUTEX,"v3-another-lock"),
 futureJob.replace("cancel-in-progress: false","cancel-in-progress: true"),
 futureJob.replace("    concurrency:","    locks:"),
 futureJob.replace("      group: threadstep-paid-development-v1",""),
 futureJob.replace("      cancel-in-progress: false",""),
 futureJob.replace("      cancel-in-progress: false",
  "      cancel-in-progress: false\n      queue: max")
 ]){
  const r=inspectV3SharedPaidMutexLayout({...b,v3:b.v3+"\n"+text});
  assert.equal(r.status,"rejected",text);noRights(r);
 }
});
test("any V1 job dropping/changing the paid mutex prevents a V3 readiness claim",()=>{
 const b=baseline();
 for(const path of files){
  for(const [from,to] of [
   ["threadstep-paid-development-v1","other-paid-lock"],
   ["      cancel-in-progress: false","      cancel-in-progress: true"],
   ["      group: threadstep-paid-development-v1",""],
   ["    concurrency:","    locks:"]
  ]){
   const r=inspectV3SharedPaidMutexLayout({
    v1:{...b.v1,[path]:b.v1[path].replace(from,to)},v3:b.v3
   });
   assert.equal(r.status,"rejected",path+" "+from);
   noRights(r);
  }
 }
});
test("read-only child-preflight must never occupy the paid V1 mutex",()=>{
 const b=baseline(),v3=b.v3.replace("  child-preflight:\n",
 "  child-preflight:\n    concurrency:\n"+
 "      group: threadstep-paid-development-v1\n"+
 "      cancel-in-progress: false\n");
 const r=inspectV3SharedPaidMutexLayout({...b,v3});
 assert.equal(r.status,"rejected");
 assert.equal(r.reason,"v3_nonpaid_preflight_holds_paid_lock");
 noRights(r);
});
test("a workflow-level group cannot compensate for missing V3 paid-job lock",()=>{
 const b=baseline(),future=futureJob.replace(
 "    concurrency:\n      group: threadstep-paid-development-v1\n"+
 "      cancel-in-progress: false\n","");
 const v3="concurrency:\n  group: threadstep-paid-development-v1\n"+
 "  cancel-in-progress: false\n"+b.v3+"\n"+future;
 const r=inspectV3SharedPaidMutexLayout({...b,v3});
 assert.equal(r.status,"rejected");noRights(r);
});
test("duplicate or malformed YAML job section fails safely",()=>{
 const b=baseline();
 for(const v3 of ["","jobs:\n",b.v3+"\njobs:\n",
  b.v3+"\tbad: true",b.v3+"\n  child-preflight:\n    runs-on: ubuntu-latest"]){
  const r=inspectV3SharedPaidMutexLayout({...b,v3});
  assert.equal(r.status,"rejected");noRights(r);
 }
});
function f({move=false,badFile=null,forgedPath=false,fail=null}={}){
 const b=baseline(),seen=[],state={n:0};
 const get=async path=>{
  seen.push(path);
  if(path===fail)return {ok:false,error:{status:403}};
  if(path===BASE+"/git/ref/heads/main"){
   state.n++;
   return {ok:true,data:{ref:"refs/heads/main",object:{
    type:"commit",sha:move&&state.n>=2?MOVED:SHA
   }}};
  }
  for(const p of files)if(path===BASE+"/contents/"+p+"?ref="+SHA){
   const bytes=Buffer.from(badFile===p?"not a valid workflow":b.v1[p]);
   return {ok:true,data:{type:"file",encoding:"base64",
    path:forgedPath?"fake.yml":p,size:bytes.length,
    content:bytes.toString("base64")}};
  }
  return {ok:false,error:{status:404}};
 };
 return {...b,readClient:{get},seen};
}
test("GitHub V1 paid mutex is read at exact main SHA and verified twice",async()=>{
 const x=f();
 const r=await observeV3GithubSharedPaidMutex({
  readClient:x.readClient,expectedMainSha:SHA,v3Workflow:x.v3
 });
 assert.equal(r.status,"v1_lock_confirmed_v3_paid_job_absent");
 assert.equal(r.evidence.observedMainSha,SHA);
 assert.deepEqual(r.evidence.sourcePaths,files);
 assert.equal(x.seen.filter(p=>p===BASE+"/git/ref/heads/main").length,2);
 for(const p of files)
  assert.equal(x.seen.includes(BASE+"/contents/"+p+"?ref="+SHA),true);
 noRights(r);
});
test("moving main, forged GitHub file or broken V1 lock stops the observation",async()=>{
 for(const opts of [{move:true},{forgedPath:true},{badFile:files[0]},
  {fail:BASE+"/contents/"+files[1]+"?ref="+SHA}]){
  const x=f(opts);
  const r=await observeV3GithubSharedPaidMutex({
   readClient:x.readClient,expectedMainSha:SHA,v3Workflow:x.v3
  });
  assert.notEqual(r.status,"v1_lock_confirmed_v3_paid_job_absent");
  noRights(r);
 }
});
test("invalid SHA, reader or candidate cannot authorize spend",async()=>{
 const x=f();
 for(const patch of [{expectedMainSha:"bad"},{readClient:null},
  {v3Workflow:null}]){
  const r=await observeV3GithubSharedPaidMutex({
   readClient:x.readClient,expectedMainSha:SHA,v3Workflow:x.v3,...patch
  });
  assert.notEqual(r.status,"v1_lock_confirmed_v3_paid_job_absent");
  noRights(r);
 }
});
test("V1 controller parent has its own lock and never occupies paid group",()=>{
 const parent=readFileSync(new URL(
  "../.github/workflows/backlog-orchestrator.yml",import.meta.url),"utf8");
 assert.match(parent,/group: threadstep-asf-parent-wave-v1/);
 assert.doesNotMatch(parent,/group: threadstep-paid-development-v1/);
});
