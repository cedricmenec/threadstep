import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBacklogIndex } from "../scripts/asf/backlog-index.mjs";
import { buildWaveCandidates, selectNextTask, DECISION } from "../scripts/asf/scheduler/index.mjs";
import { createWaveManifest, createJournal, beginDispatch, applyEvent, WAVE_EVENT,
  toSchedulerExecutionState } from "../scripts/asf/waves/index.mjs";
import { assessTask } from "../scripts/asf/waves/orchestrate.mjs";

const root = new URL("../", import.meta.url);
const yaml = readFileSync(new URL("../.github/workflows/backlog-orchestrator.yml",import.meta.url),"utf8");
const script = readFileSync(new URL("../scripts/asf/waves/orchestrate.mjs",import.meta.url),"utf8");
const child = readFileSync(new URL("../.github/workflows/agent-openspec.yml",import.meta.url),"utf8");

test("the parent cannot run on push, lacks any third paid slot and never has the child mutex",()=>{
 assert.match(yaml,/workflow_dispatch:/);
 assert.doesNotMatch(yaml,/^\s+(?:push|pull_request|schedule):\s*$/m);
 assert.match(yaml,/github\.actor == github\.repository_owner/);
 assert.match(yaml,/github\.run_attempt == 1/);
 assert.match(yaml,/group: threadstep-asf-parent-wave-v1/);
 assert.doesNotMatch(yaml,/group: threadstep-paid-development-v1/);
 assert.equal((yaml.match(/uses: \.\/\.github\/workflows\/agent-openspec\.yml/g)??[]).length,2);
 assert.match(yaml,/\n  first:\n/);
 assert.match(yaml,/\n  second:\n/);
 assert.doesNotMatch(yaml,/\n  third:\n/);
 assert.match(yaml,/needs\.after_first\.outputs\.decision == 'SELECT'/);
 assert.match(yaml,/needs\.prepare\.outputs\.decision == 'SELECT'/);
 assert.match(yaml,/needs\.second\.result/);
});
test("dry-run requires no App write token and has no paid job",()=>{
 assert.match(yaml,/if: inputs\.mode == 'execute'/);
 assert.match(yaml,/if: inputs\.mode == 'execute' && needs\.prepare\.outputs\.decision == 'SELECT'/);
 assert.match(script,/if\(options\.mode==="dry-run"\)/);
 assert.match(script,/Preview only: no wave branch, no reservation persisted and no paid call/);
 assert.ok(script.indexOf('if(options.mode==="dry-run")') < script.indexOf("saveInitial(manifest,chosen.journal)"));
});
test("GitHub evidence is never a synthetic delivery or assumed clean when unavailable",()=>{
 assert.deepEqual(assessTask("TS-012",[]),{status:"clear"});
 assert.deepEqual(assessTask("TS-012",[{state:"open",title:"OpenSpec: TS-012"}]),{status:"conflict"});
 assert.deepEqual(assessTask("TS-012",[{state:"closed",title:"OpenSpec: TS-012"}]),{status:"unknown"});
 assert.match(script,/demand\(!prs\.some\(pr=>pr\.state==="open"\)/);
 assert.match(script,/checkStatus\(full\.head\.sha\),main=checkStatus\(full\.merge_commit_sha\)/);
 assert.match(script,/for\(const name of \["CI","Pages"\]\)/);
 assert.match(script,/merged\.length>1/);
 assert.match(script,/throw Error\("ASF wave stopped:/);
});
test("quota counts reserved task starts before delivery and cannot exceed two",()=>{
 const cards = buildBacklogIndex({root:new URL("../",import.meta.url).pathname});
 const selected=buildWaveCandidates(cards);
 assert.equal(selected.ok,true,JSON.stringify(selected.errors));
 const input={
  schemaVersion:1,waveId:"wave-test-009",repository:"cedricmenec/threadstep",
  authorizedBy:"repository_owner",backlogCommit:"a".repeat(40),
  policyVersion:"asf-orch-v1",mode:"execute",executor:"openspec",phase:"auto",
  model:"openrouter/deepseek/deepseek-v4.1-flash",autoMerge:true,
  limits:{maxTaskStarts:2,maxConcurrentTasks:1,maxPaidRetries:0},
  candidateTasks:[
   {id:"TS-012",sha256:"a".repeat(64)},
   {id:"TS-013",sha256:"b".repeat(64)},
   {id:"TS-014",sha256:"c".repeat(64)}
  ],authorization:{parentRunId:123,reference:"test-authorization"}
 };
 const built=createWaveManifest(input);
 assert.equal(built.ok,true);
 let journal=createJournal(built.manifest);
 journal=beginDispatch(journal,"TS-012","t").journal;
 assert.equal(journal.quota.taskStartsReserved,1);
 journal=applyEvent(journal,{type:WAVE_EVENT.DISPATCH_CONFIRMED,taskId:"TS-012",workflowRunId:123}).journal;
 journal=applyEvent(journal,{type:WAVE_EVENT.PR_PUBLISHED,taskId:"TS-012",prNumber:42,headSha:"a".repeat(40)}).journal;
 journal=applyEvent(journal,{type:WAVE_EVENT.CI_PENDING,taskId:"TS-012"}).journal;
 journal=applyEvent(journal,{type:WAVE_EVENT.MERGE_PENDING,taskId:"TS-012"}).journal;
 journal=applyEvent(journal,{type:WAVE_EVENT.DELIVERED,taskId:"TS-012",mergeCommit:"b".repeat(40)}).journal;
 journal=beginDispatch(journal,"TS-013","t").journal;
 assert.equal(journal.quota.taskStartsReserved,2);
 assert.equal(beginDispatch(journal,"TS-014","t").ok,false);
 const state=toSchedulerExecutionState(journal);
 assert.equal(state.quota.taskStarts,2);
});
test("child starts later wave tasks on latest main but insists on the original task hash",()=>{
 assert.match(child,/if \[\[ -n "\$\{ASF_WAVE_ID:-\}" \]\]; then/);
 assert.match(child,/git checkout --detach origin\/main/);
 assert.match(child,/Authorized task brief changed since wave opening/);
 assert.match(child,/node scripts\/asf\/waves\/authenticate-executor\.mjs/);
 assert.match(child,/group: threadstep-paid-development-v1/);
});
test("uncertain results stop and consume the slot; no dispatch or paid retries from orchestrator CLI",()=>{
 assert.match(script,/WAVE_EVENT\.UNKNOWN,taskId,\{reason:"reusable_job_"/);
 assert.match(script,/WAVE_EVENT\.DELIVERED,taskId,\{mergeCommit/);
 assert.match(script,/if\(!delivery\)/);
 assert.match(script,/no verified PR \+ CI \+ main \+ Pages delivery within timeout/);
 assert.doesNotMatch(script,/gh workflow run|workflow_dispatch\\b|opencode run|OPENROUTER_API_KEY/);
});
