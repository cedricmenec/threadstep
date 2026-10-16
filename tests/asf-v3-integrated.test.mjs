import test from "node:test";
import assert from "node:assert/strict";
import { createGithubClient } from "../scripts/asf/github/client.mjs";
import { createV3Manifest, createV3Journal, advanceV3 } from "../scripts/asf/v3/lifecycle.mjs";
import { createIntegratedV3Ports } from "../scripts/asf/v3/integration.mjs";
import { attemptV3ChildClaim, attemptV3ControllerAttach } from "../scripts/asf/v3/transaction-bridge.mjs";

const repo = "cedricmenec/threadstep";
const waveId = "wave-int-001";
const owner = "cedricmenec", bot = "threadstep-software-factory[bot]";
const ctrl = ".github/workflows/backlog-orchestrator-v3.yml";
const child = ".github/workflows/agent-openspec.yml";
const H = c => c.repeat(40);
const manifest = () => createV3Manifest({
  waveId, repository: repo, backlogCommit: H("a"),
  model: "openrouter/deepseek/deepseek-v4.1-flash", autoMerge: true, maxTaskStarts: 10,
  candidateTasks: [{ id: "TS-001", sha256: "f".repeat(64) },
    { id: "TS-002", sha256: "e".repeat(64) }],
  authorization: { runId: "100", actor: owner,
    workflowRef: repo + "/" + ctrl + "@refs/heads/main", sourceSha: H("a") }
});
const step = (m, j, event) => advanceV3(m, j, event, j.revision);
function readyForChild(m) {
  let j = createV3Journal(m);
  j = step(m,j,{type:"RESERVE",taskId:"TS-001"});
  j = step(m,j,{type:"DISPATCH_INTENT",taskId:"TS-001"});
  return step(m,j,{type:"ACK_CHILD",taskId:"TS-001",childRunId:"200",
    runAttempt:1,workflowRef:repo+"/"+child+"@refs/heads/main"});
}
function readyForController(m) {
  let j=readyForChild(m);
  j=step(m,j,{type:"CLAIM_CHILD",taskId:"TS-001",childRunId:"200",
    runAttempt:1,workflowRef:repo+"/"+child+"@refs/heads/main"});
  j=step(m,j,{type:"PR_PUBLISHED",taskId:"TS-001",childRunId:"200",
    prNumber:501,headSha:H("b")});
  const proof = {prNumber:501,headSha:H("b"),mergeSha:H("c"),merged:true,
    branchProtected:true,requiredCheck:{sha:H("b"),conclusion:"success"},
    mainCheck:{sha:H("c"),conclusion:"success"},
    pages:{sha:H("c"),conclusion:"success"}};
  j=step(m,j,{type:"DELIVERED",taskId:"TS-001",proof});
  return step(m,j,{type:"CHECKPOINT",taskId:"TS-001"});
}
const run = (id,path,event,actor,sha) => ({
  id,repository:{full_name:repo},path,event,actor:{login:actor},
  head_branch:"main",head_sha:sha,run_attempt:1,status:"in_progress",conclusion:null
});
const childRuntime = () => ({runId:"200",repository:repo,ref:"refs/heads/main",
  workflowRef:repo+"/"+child+"@refs/heads/main",eventName:"workflow_dispatch",
  actor:bot,runAttempt:1,headSha:H("d")});
const controllerRuntime = () => ({runId:"300",repository:repo,ref:"refs/heads/main",
  workflowRef:repo+"/"+ctrl+"@refs/heads/main",eventName:"repository_dispatch",
  actor:bot,runAttempt:1,headSha:H("d")});

function fixture({initial="child",offline=false,badRun=false}={}) {
  const m=manifest(),j=initial==="checkpoint"?readyForController(m):readyForChild(m);
  const sha0=H("1"), tree0=H("2");
  const commits=new Map([[sha0,{sha:sha0,treeSha:tree0,parents:[],files:{
    "manifest.json":m,"journal.json":j}}]]);
  const trees=new Map();let head=sha0,next=3,writes=0,updates=0;
  const runs = new Map([
    ["100",run(100,ctrl,"workflow_dispatch",owner,H("a"))],
    ["200",run(200,child,"workflow_dispatch",bot,H("d"))],
    ["300",run(300,ctrl,"repository_dispatch",bot,H("d"))]
  ]);
  if(badRun) runs.get("200").actor.login="unknown[bot]";
  const readClient=createGithubClient({transport:async path=>{
    if(offline) throw Error("github_unavailable");
    if(path.endsWith("/git/ref/heads/asf/waves/"+waveId))
      return {ref:"refs/heads/asf/waves/"+waveId,object:{type:"commit",sha:head}};
    const matched=path.match(/\/contents\/(manifest|journal)\.json\?ref=([0-9a-f]{40})$/);
    if(matched){
      const commit=commits.get(matched[2]);
      if(!commit) throw Error("sha_not_available");
      const doc=commit.files[matched[1]+".json"];
      const bytes=Buffer.from(JSON.stringify(doc),"utf8");
      return {type:"file",path:matched[1]+".json",encoding:"base64",
        size:bytes.length,content:bytes.toString("base64")};
    }
    const runId=path.match(/\/actions\/runs\/([0-9]+)$/)?.[1];
    if(runId && runs.has(runId)) return runs.get(runId);
    throw Error("unknown_mock_endpoint");
  }});
  const gitPort={
    async getRef(ref){assert.equal(ref,"refs/heads/asf/waves/"+waveId);return {sha:head};},
    async getCommit(sha){return commits.get(sha)??null;},
    async createTree({baseTreeSha,files}){
      const entry=[...commits.values()].find(c=>c.treeSha===baseTreeSha);
      if(!entry)throw Error("missing_base_tree");
      assert.equal(files.length,1);
      assert.equal(files[0].path,"journal.json");
      const sha=next.toString(16).repeat(40);
      next++;
      trees.set(sha,{...entry.files,"journal.json":JSON.parse(files[0].content)});
      return {sha};
    },
    async createCommit({treeSha,parents,message}){
      assert.equal(parents.length,1);assert.match(message,/journal checkpoint/);
      const sha=next.toString(16).repeat(40);
      next++;
      commits.set(sha,{sha,treeSha,parents,files:trees.get(treeSha)});
      writes++;
      return {sha};
    },
    async updateRef({ref,sha,force}){
      assert.equal(ref,"refs/heads/asf/waves/"+waveId);
      assert.equal(force,false);
      updates++;
      const commit=commits.get(sha);
      if(commit.parents[0]!==head)throw Object.assign(Error("non_fast_forward"),{status:422});
      head=sha;
    }
  };
  const ports=createIntegratedV3Ports({githubReadClient:readClient,gitPort,repository:repo});
  return {ports,m,j,get head(){return head;},get writes(){return writes;},
    get updates(){return updates;},runs,commits};
}

test("real V3 contracts: original GitHub owner + child → exactly one committed claim",async()=>{
  const f=fixture();
  const result=await attemptV3ChildClaim(f.ports,{
    waveId,taskId:"TS-001",runtime:childRuntime()});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.code,"single_run_claim_committed");
  assert.equal(result.journalRevision,4);
  assert.equal(result.reservationId,waveId+":1");
  const verified=await f.ports.loadSnapshot(waveId);
  assert.equal(verified.ok,true);
  assert.equal(verified.journal.status,"EXECUTING");
  assert.equal(verified.journal.reserved,1);
  assert.equal(verified.journal.delivered,0);
  assert.equal(f.updates,1);
  const repeated=await attemptV3ChildClaim(f.ports,{
    waveId,taskId:"TS-001",runtime:childRuntime()});
  assert.equal(repeated.ok,false);
  assert.equal(f.updates,1,"second claim must never update Git ref");
});

test("real V3 contracts: two competing child runs cannot claim twice",async()=>{
  const f=fixture();
  const request={waveId,taskId:"TS-001",runtime:childRuntime()};
  const results=await Promise.all([
    attemptV3ChildClaim(f.ports,request),
    attemptV3ChildClaim(f.ports,request)
  ]);
  assert.equal(results.filter(x=>x.ok).length,1,JSON.stringify(results));
  assert.equal(f.updates,2,"sibling CAS ref updates may race; only one should win");
  assert.equal((await f.ports.loadSnapshot(waveId)).journal.reserved,1);
});

test("real V3 contracts: wrong bot or GitHub API outage never grants claim",async()=>{
  for(const opts of [{badRun:true},{offline:true}]){
    const f=fixture(opts);
    const result=await attemptV3ChildClaim(f.ports,{
      waveId,taskId:"TS-001",runtime:childRuntime()});
    assert.equal(result.ok,false);
    assert.equal(f.updates,0);
  }
});

test("real V3 contracts: original owner and checkpoint gate continuation",async()=>{
  const f=fixture({initial:"checkpoint"});
  const out=await attemptV3ControllerAttach(f.ports,{waveId,runtime:controllerRuntime()});
  assert.equal(out.ok,true,JSON.stringify(out));
  const verified=await f.ports.loadSnapshot(waveId);
  assert.equal(verified.journal.status,"READY");
  assert.equal(verified.journal.awaitingController,false);
  assert.equal(verified.journal.reserved,1);
  assert.equal(verified.journal.delivered,1);
  assert.deepEqual(verified.journal.controllers,["300"]);
  const again=await attemptV3ControllerAttach(f.ports,{waveId,runtime:controllerRuntime()});
  assert.equal(again.ok,false);
});

test("real V3 contracts: continuation without checkpoint cannot succeed",async()=>{
  const f=fixture();
  const result=await attemptV3ControllerAttach(f.ports,{waveId,runtime:controllerRuntime()});
  assert.equal(result.ok,false);
  assert.equal(f.updates,0);
});

test("integrated ports reject incomplete real Git port and foreign repository",async()=>{
  const f=fixture();
  assert.throws(()=>createIntegratedV3Ports({
    githubReadClient:createGithubClient({transport:async()=>({})}),gitPort:{},repository:repo
  }),TypeError);
  const unknown=await f.ports.verifyRun({
    authorization:{repository:"attacker/repo"},
    reservation:{repository:"attacker/repo"},kind:"child"
  });
  assert.equal(unknown.code,"foreign_repository");
});
