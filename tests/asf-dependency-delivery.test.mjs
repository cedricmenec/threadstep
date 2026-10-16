import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAsfDelivery, validateTrustedManualDelivery, TRUSTED_MANUAL_DELIVERIES } from "../scripts/verify-asf-dependencies.mjs";

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


function sensitiveEvidence(dep) {
  const pinned = TRUSTED_MANUAL_DELIVERIES[dep];
  return {
    pullRequests: [{
      number: pinned.prNumber,
      title: pinned.title,
      state: "closed", merged: true, merged_at: "2026-10-16T08:07:36Z",
      head: {ref:pinned.branch,sha:pinned.headSha,repo:{full_name:repo}},
      base: {ref:"main",repo:{full_name:repo}},
      merge_commit_sha:pinned.mergeSha,
      user:{login:"cedricmenec"},merged_by:{login:"cedricmenec"}
    }],
    headChecks:[check(pinned.headSha)],
    mainChecks:[check(pinned.mergeSha)],
    mainRuns:["CI","Pages"].map(name=>({
      name,head_sha:pinned.mergeSha,event:"push",
      status:"completed",conclusion:"success",
      created_at:"2026-10-16T08:07:39Z"
    })),
    comparison:{status:"ahead"}
  };
}
test("only explicitly pinned sensitive factory PRs 49 and 50 are recognized", () => {
  assert.deepEqual(Object.keys(TRUSTED_MANUAL_DELIVERIES).sort(),
    ["ASF-V2-008","ASF-V2-009"]);
  for(const dep of ["ASF-V2-008","ASF-V2-009"]) {
    const result=validateTrustedManualDelivery(dep,repo,sensitiveEvidence(dep));
    assert.deepEqual(result,{
      task:dep,pr:TRUSTED_MANUAL_DELIVERIES[dep].prNumber,
      headSha:TRUSTED_MANUAL_DELIVERIES[dep].headSha,
      mergeSha:TRUSTED_MANUAL_DELIVERIES[dep].mergeSha,
      mode:"trusted_manual_review"
    });
  }
  assert.throws(()=>validateTrustedManualDelivery("ASF-V2-010",repo,sensitiveEvidence("ASF-V2-009")),
    /not explicitly approved/);
  assert.throws(()=>validateTrustedManualDelivery("ASF-V2-009","other/repository",
    sensitiveEvidence("ASF-V2-009")),/not explicitly approved/);
});
test("sensitive delivery cannot be spoofed by another PR, actor, SHA, branch or false merge", () => {
  const corruptions=[
    e=>{e.pullRequests[0].number=51},
    e=>{e.pullRequests[0].title="Agent ASF: ASF-V2-009"},
    e=>{e.pullRequests[0].head.ref="agent/asf/ASF-V2-009-run-123"},
    e=>{e.pullRequests[0].head.sha="f".repeat(40)},
    e=>{e.pullRequests[0].head.repo.full_name="fork/other"},
    e=>{e.pullRequests[0].base.repo.full_name="fork/other"},
    e=>{e.pullRequests[0].merge_commit_sha="e".repeat(40)},
    e=>{e.pullRequests[0].merged=false},
    e=>{e.pullRequests[0].merged_at=null},
    e=>{e.pullRequests[0].user.login="someone"},
    e=>{e.pullRequests[0].merged_by.login="someone"},
    e=>{e.pullRequests.push(structuredClone(e.pullRequests[0]))}
  ];
  for(const dep of ["ASF-V2-008","ASF-V2-009"]) for(const change of corruptions) {
    const proof=sensitiveEvidence(dep); change(proof);
    assert.throws(()=>validateTrustedManualDelivery(dep,repo,proof),dep);
  }
});
test("sensitive delivery still requires verified checks on both SHAs and main/Pages evidence", () => {
  const corruptions=[
    e=>{e.headChecks=[]},
    e=>{e.headChecks[0].app.id=7},
    e=>{e.headChecks[0].head_sha="e".repeat(40)},
    e=>{e.mainChecks[0].conclusion="failure"},
    e=>{e.mainChecks=[]},
    e=>{e.mainRuns=e.mainRuns.filter(r=>r.name!=="Pages")},
    e=>{e.mainRuns[0].conclusion="failure"},
    e=>{e.mainRuns[1].created_at="2026-10-16T07:00:00Z"},
    e=>{e.comparison.status="diverged"},
    e=>{delete e.comparison}
  ];
  for(const dep of ["ASF-V2-008","ASF-V2-009"]) for(const change of corruptions) {
    const proof=sensitiveEvidence(dep); change(proof);
    assert.throws(()=>validateTrustedManualDelivery(dep,repo,proof),dep);
  }
});
test("the production preflight chooses trusted manual lookup before legacy agent-only lookup", () => {
  const src=readFileSync("scripts/verify-asf-dependencies.mjs","utf8");
  assert.match(src,/Object\.hasOwn\(TRUSTED_MANUAL_DELIVERIES, dep\)/);
  assert.ok(src.indexOf("return verifyTrustedManualFromGithub(dep, repo);") <
    src.indexOf("const pr = findMergedAsfPr(dep, repo);"));
  const wf=readFileSync(".github/workflows/agent-asf.yml","utf8");
  const pre=wf.split("\n  preflight:")[1]?.split("\n  develop:")[0]??"";
  assert.match(pre,/node scripts\/verify-asf-dependencies\.mjs "\$TASK_ID"/);
  assert.match(pre,/checks: read/);
  assert.match(pre,/actions: read/);
});
