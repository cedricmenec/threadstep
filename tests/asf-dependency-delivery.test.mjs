import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAsfDelivery } from "../scripts/verify-asf-dependencies.mjs";

const repo = "cedricmenec/threadstep", dep = "ASF-V2-001";
const headSha = "a".repeat(40), mergeSha = "b".repeat(40), date = "2026-10-15T23:08:14Z";
function valid() {
  return {
    pullRequests:[{
      number:40, state:"closed", merged:true, merged_at:date,
      title:"Agent ASF: ASF-V2-001", base:{ref:"main"},
      head:{ref:"agent/asf/ASF-V2-001-run-38821338274",repo:{full_name:repo},sha:headSha},
      merge_commit_sha:mergeSha, user:{login:"threadstep-software-factory[bot]"}
    }],
    run:{id:38821338274,status:"completed",conclusion:"success",
      actor:{login:"cedricmenec"},event:"workflow_dispatch",
      path:".github/workflows/agent-asf.yml"},
    headChecks:[check(headSha)],mainChecks:[check(mergeSha)],
    mainRuns:["CI","Pages"].map(name=>({name,event:"push",head_sha:mergeSha,
      created_at:"2026-10-15T23:08:16Z",status:"completed",conclusion:"success"})),
    comparison:{status:"ahead"}
  };
}
function check(sha) {
  return {name:"check",head_sha:sha,status:"completed",conclusion:"success",
    app:{slug:"github-actions",id:15368}};
}
test("verified merged PR with matching owner run, both CI checks and Pages unblocks dependency", () => {
  assert.deepEqual(validateAsfDelivery(dep,repo,valid()),
    {task:dep,pr:40,headSha,mergeSha,runId:38821338274});
});
test("a title alone cannot prove delivery", () => {
  for (const mutate of [
    d=>{d.pullRequests[0].merged=false},
    d=>{d.pullRequests[0].merged_at=null},
    d=>{d.pullRequests[0].base.ref="other"},
    d=>{d.pullRequests[0].head.repo.full_name="attacker/fork"},
    d=>{d.pullRequests[0].head.ref="agent/asf/ASF-V2-002-run-38821338274"},
    d=>{d.pullRequests[0].user.login="someone"},
    d=>{d.pullRequests[0].merge_commit_sha=null},
    d=>{d.pullRequests.push(structuredClone(d.pullRequests[0]))}
  ]) {
    const d=valid();mutate(d);
    assert.throws(()=>validateAsfDelivery(dep,repo,d));
  }
});
test("incorrect run, CI, Pages or merge ancestry never authorizes a paid task", () => {
  for(const mutate of [
    d=>{d.run.conclusion="failure"},
    d=>{d.run.actor.login="attacker"},
    d=>{d.run.path=".github/workflows/other.yml"},
    d=>{d.run.id=1},
    d=>{d.headChecks[0].conclusion="failure"},
    d=>{d.headChecks[0].app.id=22},
    d=>{d.mainChecks=[]},
    d=>{d.mainRuns=d.mainRuns.filter(r=>r.name!=="Pages")},
    d=>{d.mainRuns[1].conclusion="failure"},
    d=>{d.mainRuns[0].created_at="2026-10-14T00:00:00Z"},
    d=>{d.comparison.status="diverged"}
  ]) {
    const d=valid();mutate(d);
    assert.throws(()=>validateAsfDelivery(dep,repo,d));
  }
});
test("workflow performs online evidence verification before OpenRouter and has read-only scopes", () => {
  const w=readFileSync(".github/workflows/agent-asf.yml","utf8");
  const pre=w.split("\n  preflight:")[1]?.split("\n  develop:")[0]??"";
  assert.match(pre,/checks: read/);
  assert.match(pre,/actions: read/);
  assert.ok(pre.indexOf("verify-asf-dependencies.mjs")>pre.indexOf("agent-asf-policy.mjs preflight"));
  assert.doesNotMatch(pre,/contents: write|pull-requests: write/);
});
