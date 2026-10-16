#!/usr/bin/env node
/** Fail-closed authentication for owner-authorized reusable OpenSpec jobs. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateWaveManifest, hashWaveManifest, validateJournal,
  currentState, WAVE_STATE, ORCHESTRATOR_POLICY_VERSION } from "./index.mjs";

const HEX40 = /^[a-f0-9]{40}$/;
const WAVE_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const TASK_ID = /^TS-[0-9]{3}$/;
const PARENT_WORKFLOW = ".github/workflows/backlog-orchestrator.yml";
const check = (predicate, why) => { if (!predicate) throw Error("ASF authorization denied: " + why); };
const number = value => (/^[1-9][0-9]{0,17}$/.test(String(value ?? "")) ? String(value) : null);

/** Pure verification; the Git adapter supplies observed facts, never decisions. */
export function verifyExecutorAuthorization({request,context,manifest,journal,parent,taskBytes}) {
  check(context.repository === manifest?.repository, "wrong repository");
  check(context.actor === context.repositoryOwner &&
    context.workflowRef === context.repository + "/" + PARENT_WORKFLOW + "@refs/heads/main" &&
    context.ref === "refs/heads/main" && context.eventName === "workflow_dispatch",
    "caller is not the owner-dispatched, reviewed main workflow");
  check(number(context.runId) && number(context.runId) === number(request.parentRunId) &&
    context.runAttempt === "1", "parent run or rerun mismatch");
  check(WAVE_ID.test(request.waveId ?? "") && HEX40.test(request.reservationSha ?? "") &&
    TASK_ID.test(request.taskId ?? ""), "unsafe wave/task/reservation identifiers");
  check(request.phase === "auto" && typeof request.autoMerge === "boolean",
    "orchestrated V1 requires the authorized auto phase");
  check(validateWaveManifest(manifest).ok &&
    manifest.policyVersion === ORCHESTRATOR_POLICY_VERSION &&
    manifest.waveId === request.waveId && manifest.mode === "execute" &&
    manifest.executor === "openspec" && manifest.phase === "auto" &&
    manifest.model === request.model && manifest.autoMerge === request.autoMerge &&
    manifest.authorizedBy === "repository_owner" &&
    number(manifest.authorization.parentRunId) === number(context.runId),
    "manifest is invalid or not authorized for this task");
  check(parent?.id && number(parent.id) === number(context.runId) &&
    parent.path === PARENT_WORKFLOW && parent.event === "workflow_dispatch" &&
    parent.actor?.login === context.repositoryOwner && parent.head_branch === "main" &&
    parent.head_sha === manifest.backlogCommit && parent.status === "in_progress" &&
    parent.run_attempt === 1, "owner parent run not independently confirmed");
  check(manifest.limits.maxConcurrentTasks === 1 &&
    manifest.limits.maxPaidRetries === 0 && manifest.limits.maxTaskStarts <= 2,
    "unsafe wave limits");
  const candidates = manifest.candidateTasks.filter(c => c.id === request.taskId);
  check(candidates.length === 1 && Buffer.isBuffer(taskBytes) &&
    createHash("sha256").update(taskBytes).digest("hex") === candidates[0].sha256,
    "task missing or definition differs from authorized snapshot");
  check(validateJournal(journal,manifest).ok && journal.stop === null &&
    journal.waveId === manifest.waveId &&
    journal.manifestHash === hashWaveManifest(manifest), "invalid/stopped journal");
  check(journal.quota.taskStartsReserved >= 1 &&
    journal.quota.taskStartsReserved <= manifest.limits.maxTaskStarts &&
    currentState(journal, request.taskId) === WAVE_STATE.DISPATCH_RESERVED &&
    journal.entries.filter(e => e.taskId === request.taskId &&
      e.event === "RESERVE_DISPATCH").length === 1,
    "one durable paid reservation is required");
  for (const taskId of new Set(journal.entries.map(e => e.taskId))) {
    if (taskId === request.taskId) continue;
    check(!["SELECTED","DISPATCH_RESERVED","EXECUTING","PR_PUBLISHED",
      "CI_PENDING","MERGE_PENDING"].includes(currentState(journal, taskId)),
      "another unfinished task in the wave");
  }
  return Object.freeze({waveId:manifest.waveId,taskId:request.taskId,
    reservationSha:request.reservationSha});
}

function git(...args) {
  return execFileSync("git",args,{encoding:"utf8",timeout:20000,
    stdio:["ignore","pipe","pipe"],maxBuffer:4*1024*1024}).trim();
}
function gh(path) {
  return JSON.parse(execFileSync("gh",["api",path],{encoding:"utf8",
    timeout:20000,stdio:["ignore","pipe","pipe"],maxBuffer:4*1024*1024}));
}
function fromCommit(commit,path) {
  const text=git("show",commit+":"+path);
  check(text.length > 0 && text.length < 1000000,"empty or oversized journal/manifest");
  return JSON.parse(text);
}
function main() {
  const request={waveId:process.env.ASF_WAVE_ID,reservationSha:process.env.ASF_RESERVATION_SHA,
    parentRunId:process.env.ASF_PARENT_RUN_ID,taskId:process.env.TASK_ID,
    phase:process.env.PHASE,model:process.env.OPENCODE_MODEL,
    autoMerge:process.env.ASF_AUTO_MERGE === "true"};
  const context={repository:process.env.GITHUB_REPOSITORY,
    repositoryOwner:process.env.GITHUB_REPOSITORY_OWNER,actor:process.env.GITHUB_ACTOR,
    ref:process.env.GITHUB_REF,eventName:process.env.GITHUB_EVENT_NAME,
    workflowRef:process.env.GITHUB_WORKFLOW_REF,runId:process.env.GITHUB_RUN_ID,
    runAttempt:process.env.GITHUB_RUN_ATTEMPT};
  check(WAVE_ID.test(request.waveId ?? "") && HEX40.test(request.reservationSha ?? "") &&
    number(request.parentRunId) && TASK_ID.test(request.taskId ?? ""), "unsafe inputs");
  check(context.workflowRef === context.repository + "/" + PARENT_WORKFLOW +
    "@refs/heads/main" && context.actor === context.repositoryOwner &&
    context.ref === "refs/heads/main", "untrusted caller");
  git("fetch","--no-tags","origin","refs/heads/asf/waves/"+request.waveId);
  const tip=git("rev-parse","FETCH_HEAD");
  check(tip === request.reservationSha,"reservation branch moved; halt for reconciliation");
  const manifest=fromCommit(tip,"manifest.json");
  const journal=fromCommit(tip,"journal.json");
  check(HEX40.test(manifest?.backlogCommit ?? ""),"bad frozen source SHA");
  git("fetch","--no-tags","origin",manifest.backlogCommit);
  const bytes=execFileSync("git",
    ["show",manifest.backlogCommit+":backlog/tasks/"+request.taskId+".md"],
    {stdio:["ignore","pipe","pipe"],timeout:20000,maxBuffer:1000000});
  const parent=gh("repos/"+context.repository+"/actions/runs/"+request.parentRunId);
  const ok=verifyExecutorAuthorization({request,context,manifest,journal,parent,taskBytes:bytes});
  process.stdout.write("Authorized wave "+ok.waveId+" task "+ok.taskId+"\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch(e) {
    process.stderr.write((e.message?.startsWith("ASF authorization denied:")
      ? e.message:"ASF authorization denied: evidence unavailable")+"\n");
    process.exitCode=1;
  }
}
