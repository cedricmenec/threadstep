import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createWaveManifest, createJournal, applyEvent, WAVE_EVENT } from "../scripts/asf/waves/index.mjs";
import { verifyExecutorAuthorization } from "../scripts/asf/waves/authenticate-executor.mjs";

const taskBytes=Buffer.from("# TS-012\nA ready product task\n");
const hash=createHash("sha256").update(taskBytes).digest("hex");
const sourceSha="a".repeat(40), reserveSha="b".repeat(40);
function fixture(){
 const input={
  schemaVersion:1,waveId:"wave-test-008",repository:"cedricmenec/threadstep",
  authorizedBy:"repository_owner",backlogCommit:sourceSha,policyVersion:"asf-orch-v1",
  mode:"execute",executor:"openspec",phase:"auto",
  model:"openrouter/deepseek/deepseek-v4.1-flash",autoMerge:true,
  limits:{maxTaskStarts:2,maxConcurrentTasks:1,maxPaidRetries:0},
  candidateTasks:[{id:"TS-012",sha256:hash}],
  authorization:{parentRunId:101,reference:"wave-authorization:101"}
 };
 const created=createWaveManifest(input);
 assert.equal(created.ok,true,JSON.stringify(created.errors));
 let journal=createJournal(created.manifest);
 const selected=applyEvent(journal,{type:WAVE_EVENT.SELECT,taskId:"TS-012",at:"2026-10-16T00:00:00Z"});
 assert.equal(selected.ok,true,JSON.stringify(selected.errors));
 journal=selected.journal;
 const reserved=applyEvent(journal,{type:WAVE_EVENT.RESERVE_DISPATCH,taskId:"TS-012",at:"2026-10-16T00:00:01Z"});
 assert.equal(reserved.ok,true,JSON.stringify(reserved.errors));
 journal=reserved.journal;
 return {
   manifest:created.manifest,journal,taskBytes,
   request:{waveId:"wave-test-008",reservationSha:reserveSha,parentRunId:"101",
      taskId:"TS-012",model:input.model,phase:"auto",autoMerge:true},
   context:{repository:"cedricmenec/threadstep",repositoryOwner:"cedricmenec",
      actor:"cedricmenec",ref:"refs/heads/main",eventName:"workflow_dispatch",
      workflowRef:"cedricmenec/threadstep/.github/workflows/backlog-orchestrator.yml@refs/heads/main",
      runId:"101",runAttempt:"1"},
   parent:{id:101,path:".github/workflows/backlog-orchestrator.yml",
      event:"workflow_dispatch",actor:{login:"cedricmenec"},head_branch:"main",
      head_sha:sourceSha,status:"in_progress",run_attempt:1}
 };
}
test("one owner-reserved immutable task can be authenticated without network",()=>{
 const result=verifyExecutorAuthorization(fixture());
 assert.equal(result.taskId,"TS-012");
 assert.equal(result.reservationSha,reserveSha);
});
test("unapproved workflow, actor, ref, parent, rerun are rejected",()=>{
 const mutations=[
  x=>{x.context.actor="attacker"},
  x=>{x.context.workflowRef="cedricmenec/threadstep/.github/workflows/agent.yml@refs/heads/main"},
  x=>{x.context.ref="refs/heads/feature"},
  x=>{x.context.eventName="pull_request"},
  x=>{x.context.runAttempt="2"},
  x=>{x.context.runId="102"},
  x=>{x.parent.path=".github/workflows/unknown.yml"},
  x=>{x.parent.actor.login="attacker"},
  x=>{x.parent.status="completed"},
  x=>{x.parent.head_sha="f".repeat(40)}
 ];
 for(const change of mutations){const f=fixture();change(f);assert.throws(()=>verifyExecutorAuthorization(f),/denied/);}
});
test("tampered manifest, missing task and changed hash fail closed",()=>{
 const changes=[
  f=>{f.request.model="openrouter/unknown"},
  f=>{f.request.phase="plan"},
  f=>{f.request.autoMerge=false},
  f=>{f.request.waveId="wave-other"},
  f=>{f.request.taskId="TS-013"},
  f=>{f.taskBytes=Buffer.from("altered")},
  f=>{f.manifest={...f.manifest,mode:"dry-run"}}
 ];
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>verifyExecutorAuthorization(f),/denied/);}
});
test("journal without one valid reserved start and quota is never trusted",()=>{
 const cases=[
  f=>{f.journal=createJournal(f.manifest)},
  f=>{f.journal={...f.journal,manifestHash:"0".repeat(64)}},
  f=>{f.journal={...f.journal,quota:{maxTaskStarts:2,taskStartsReserved:3}}},
  f=>{f.journal={...f.journal,stop:{code:"STOP_FAILED",reason:"failed",at:"t"}}}
 ];
 for(const change of cases){const f=fixture();change(f);assert.throws(()=>verifyExecutorAuthorization(f),/denied/);}
});
test("one shared JOB mutex is used across all paid agent workflows",()=>{
 for(const name of ["agent.yml","agent-openspec.yml","agent-asf.yml"]){
  const yaml=readFileSync(new URL("../.github/workflows/"+name,import.meta.url),"utf8");
  assert.match(yaml,/group: threadstep-paid-development-v1/);
  assert.match(yaml,/cancel-in-progress: false/);
 }
 const openSpec=readFileSync(new URL("../.github/workflows/agent-openspec.yml",import.meta.url),"utf8");
 assert.match(openSpec,/workflow_call:/);
 assert.match(openSpec,/node scripts\/asf\/waves\/authenticate-executor.mjs/);
 assert.match(openSpec,/if: github.actor == github.repository_owner/);
 assert.match(openSpec,/gh pr create --draft/);
 assert.match(openSpec,/Apply changed a protected path/);
});
