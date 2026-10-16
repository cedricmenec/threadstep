#!/usr/bin/env node
/**
 * Deterministic end-to-end recette for the orchestrator (ASF-V2-011).
 *
 * A factory wave cannot be authorized to spend OpenRouter budget before its
 * security and control behaviors have been demonstrated. This module runs the
 * whole V1 orchestration chain **in memory** against the pure modules already
 * delivered by ASF-V2-004..010 and reports, per scenario, whether the required
 * property holds:
 *
 *   - empty backlog          -> NO_WORK, zero paid start
 *   - dependency unblocking  -> dynamic recomputation inside one frozen wave
 *   - crash windows          -> fail closed, never a second automatic dispatch
 *   - simulated red CI       -> delivery is not verified, no forced merge
 *   - two-task wave          -> at most two reservations, no third
 *   - concurrent access      -> one paid development at a time
 *
 * Nothing here reads GitHub, OpenRouter, a clock or the network, and nothing is
 * dispatched, reserved or written. Timestamps are injected constants. Every
 * scenario is a *simulation*: it proves the deterministic control logic, not a
 * real paid delivery. The paid pilot and two-task wave described in the task
 * remain explicitly unauthorized until a separate owner authorization.
 *
 * Normative references:
 *   - docs/factory/specs/orchestrator-v1.md §7, §8, §11, §12
 *   - docs/factory/specs/scheduler-v1.md §2, §4, §5, §7
 */
import { createHash } from "node:crypto";
import {
  buildWaveCandidates, selectNextTask, explainWave, DECISION
} from "../scheduler/index.mjs";
import {
  MANIFEST_SCHEMA_VERSION, ORCHESTRATOR_POLICY_VERSION, MODEL_ALLOWLIST,
  WAVE_EVENT, STOP_CODE, DISPATCH_DECISION,
  createWaveManifest, createJournal, beginDispatch, applyEvent,
  planDispatch, decideResume, toSchedulerExecutionState, validateJournal,
  createMemoryWaveStore, loadJournal
} from "../waves/index.mjs";
import {
  DELIVERY_REASON, DELIVERY_STATUS,
  createOpenspecDeliveryConfig, verifyDelivery, toSchedulerEvidence
} from "../delivery/index.mjs";

/** Injected constants: the recette never reads a clock or a network. */
export const FIXED_AT = "2026-10-16T00:00:00Z";
const HEAD_SHA = "b".repeat(40);
const MERGE_SHA = "c".repeat(40);
const REPOSITORY = "cedricmenec/threadstep";
const AUTHOR = "threadstep-software-factory[bot]";

function sha(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function card(id, overrides = {}) {
  return {
    id,
    path: "backlog/tasks/" + id + ".md",
    type: "product",
    status: "ready",
    priority: "normal",
    automation: "allowed",
    risk: "low",
    depends_on: [],
    created_at: "2026-10-16",
    content_sha256: sha(id),
    ...overrides
  };
}

function snapshot(active = [], archive = []) {
  return { active, archive, legacy: [], diagnostics: [] };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function check(name, passed, detail) {
  return { name, passed: passed === true, detail: detail === undefined ? null : String(detail) };
}

function scenario(id, title, checks, evidence = {}) {
  const passed = checks.every(entry => entry.passed);
  return deepFreeze({ id, title, passed, checks, evidence });
}

/** Build a frozen manifest whose candidate hashes match the snapshot cards. */
function buildManifest(snapshotInput, maxTaskStarts, waveId) {
  const choice = buildWaveCandidates(snapshotInput);
  if (!choice.ok) throw new Error("invalid snapshot: " + JSON.stringify(choice.errors));
  const created = createWaveManifest({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    waveId,
    repository: REPOSITORY,
    authorizedBy: "repository_owner",
    backlogCommit: "a".repeat(40),
    policyVersion: ORCHESTRATOR_POLICY_VERSION,
    mode: "execute",
    executor: "openspec",
    phase: "auto",
    model: MODEL_ALLOWLIST[0],
    limits: { maxTaskStarts, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    autoMerge: true,
    candidateTasks: choice.candidateTasks,
    authorization: { parentRunId: 123, reference: "e2e-simulation:no-paid-call" }
  });
  if (!created.ok) throw new Error("invalid manifest: " + JSON.stringify(created.errors));
  return created.manifest;
}

/** Replay a successful delivery into an injected journal (no I/O). */
function deliver(journal, taskId, runId = 555, prNumber = 99) {
  let step = beginDispatch(journal, taskId, FIXED_AT);
  if (!step.ok) return step;
  journal = step.journal;
  const stream = [
    [WAVE_EVENT.DISPATCH_CONFIRMED, {
      workflowRunId: runId,
      workflowRunUrl: "https://github.com/" + REPOSITORY + "/actions/runs/" + runId
    }],
    [WAVE_EVENT.PR_PUBLISHED, {
      prNumber,
      prUrl: "https://github.com/" + REPOSITORY + "/pull/" + prNumber,
      headSha: HEAD_SHA
    }],
    [WAVE_EVENT.CI_PENDING, {}],
    [WAVE_EVENT.MERGE_PENDING, {}],
    [WAVE_EVENT.DELIVERED, { mergeCommit: MERGE_SHA }]
  ];
  for (const [type, payload] of stream) {
    step = applyEvent(journal, { type, taskId, at: FIXED_AT, ...payload });
    if (!step.ok) return step;
    journal = step.journal;
  }
  return { ok: true, journal };
}

function verifiedDelivery(taskId) {
  return { deliveries: { [taskId]: { status: "verified", proof: { pr: 99, mergeSha: MERGE_SHA } } } };
}

/**
 * Models the workflow-level paid-development concurrency group
 * (`threadstep-paid-development-v1`). Only one owner — manual or orchestrated —
 * may hold it. Pure and side-effect free: used to prove that a concurrent
 * manual launch cannot start a second paid development.
 */
function createPaidDevelopmentLock() {
  let holder = null;
  return {
    acquire(owner) {
      if (!owner) return { ok: false, holder };
      if (holder) return { ok: false, holder };
      holder = owner;
      return { ok: true, holder };
    },
    release(owner) {
      if (holder !== owner) return { ok: false, holder };
      holder = null;
      return { ok: true, holder: null };
    },
    current() {
      return holder;
    }
  };
}

/** 1. Empty backlog: no candidate, no reservation, no dispatch. */
export function scenarioEmptyBacklog() {
  const snap = snapshot([]);
  const manifest = buildManifest(snap, 2, "wave-e2e-empty");
  const journal = createJournal(manifest);
  const decision = selectNextTask(manifest, snap, {}, toSchedulerExecutionState(journal));
  const dispatch = planDispatch(journal, manifest, "TS-011");
  return scenario("empty-backlog", "Backlog vide ⇒ NO_WORK, zéro déclenchement payant", [
    check("candidate_set_empty", buildWaveCandidates(snap).candidateTasks.length === 0,
      buildWaveCandidates(snap).candidateTasks.length),
    check("decision_no_work", decision.decision === DECISION.NO_WORK, decision.decision),
    check("no_reservation", journal.quota.taskStartsReserved === 0, journal.quota.taskStartsReserved),
    check("unknown_task_refused", dispatch.decision === DISPATCH_DECISION.NOT_IN_WAVE, dispatch.decision)
  ]);
}

/** 2. A verified dependency unblocks its dependent inside the same frozen wave. */
export function scenarioDependencyUnblocks() {
  const dependency = card("TS-011");
  const dependent = card("TS-012", { priority: "critical", depends_on: ["TS-011"] });
  const snap = snapshot([dependency, dependent]);
  const manifest = buildManifest(snap, 2, "wave-e2e-deps");
  let journal = createJournal(manifest);

  const first = selectNextTask(manifest, snap, {}, toSchedulerExecutionState(journal));
  const afterFirst = deliver(journal, first.taskId);
  journal = afterFirst.journal;
  const evidence = verifiedDelivery(first.taskId);
  const second = selectNextTask(manifest, snap, evidence, toSchedulerExecutionState(journal));
  const secondExplanation = explainWave(manifest, snap, evidence, toSchedulerExecutionState(journal));
  const reserveSecond = beginDispatch(journal, second.taskId ?? "TS-012", FIXED_AT);

  return scenario("dependency-unblocks", "Dépendance livrée ⇒ recalcul dynamique dans la même vague", [
    check("first_is_dependency", first.taskId === "TS-011", first.taskId),
    check("journal_after_first_valid", afterFirst.ok === true && validateJournal(journal, manifest).ok,
      validateJournal(journal, manifest).errors.length),
    check("second_is_dependent", second.taskId === "TS-012", second.taskId),
    check("dependency_reason", second.reason.includes("dependencies_delivered"),
      second.reason.join(",")),
    check("dependent_eligible_after_delivery",
      secondExplanation.order.some(entry => entry.id === "TS-012"),
      secondExplanation.order.map(entry => entry.id).join(",")),
    check("second_reservation_ok", reserveSecond.ok === true && reserveSecond.journal.quota.taskStartsReserved === 2,
      reserveSecond.journal?.quota?.taskStartsReserved ?? "refused")
  ], { first: first.taskId, second: second.taskId });
}

/** 3. Crash windows: fail closed, never a second automatic dispatch. */
export function scenarioCrashWindows() {
  const snap = snapshot([card("TS-011")]);
  const manifest = buildManifest(snap, 2, "wave-e2e-crash");

  const before = createJournal(manifest);
  const beforeResume = decideResume(before, "TS-011");
  const beforeDispatch = planDispatch(before, manifest, "TS-011");

  const during = beginDispatch(before, "TS-011", FIXED_AT).journal;
  const duringResume = decideResume(during, "TS-011");
  const duringDispatch = planDispatch(during, manifest, "TS-011");

  const confirmed = applyEvent(during, {
    type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId: "TS-011", workflowRunId: 555, at: FIXED_AT
  });
  const after = confirmed.journal;
  const afterResume = decideResume(after, "TS-011");
  const afterDispatch = planDispatch(after, manifest, "TS-011");

  return scenario("crash-windows", "Fenêtres de crash ⇒ arrêt fermé, jamais de second dispatch", [
    check("before_not_started", beforeResume.outcome === "NOT_STARTED", beforeResume.outcome),
    check("before_safe_to_dispatch", beforeDispatch.decision === DISPATCH_DECISION.DISPATCH,
      beforeDispatch.decision),
    check("during_uncertain", duringResume.outcome === "UNCERTAIN", duringResume.outcome),
    check("during_stop_uncertain", duringDispatch.decision === DISPATCH_DECISION.STOP_UNCERTAIN,
      duringDispatch.decision),
    check("during_journal_valid", validateJournal(during, manifest).ok,
      validateJournal(during, manifest).errors.length),
    check("after_in_flight", afterResume.outcome === "IN_FLIGHT", afterResume.outcome),
    check("after_no_redispatch", afterDispatch.decision === DISPATCH_DECISION.IN_FLIGHT,
      afterDispatch.decision),
    check("single_reservation_only", after.quota.taskStartsReserved === 1,
      after.quota.taskStartsReserved)
  ], { quotaAfterCrash: during.quota.taskStartsReserved });
}

/** 4. Simulated red CI: never verified, never a forced merge, wave stops. */
export function scenarioRedCi() {
  const taskId = "TS-011";
  const config = createOpenspecDeliveryConfig({ taskId, repository: REPOSITORY });
  const observation = {
    observedAt: FIXED_AT,
    pullRequests: [{
      number: 42,
      title: "OpenSpec: " + taskId,
      body: "Phase apply",
      merged: true,
      state: "closed",
      merged_at: FIXED_AT,
      base: { ref: "main" },
      head: { ref: "agent/openspec/" + taskId, sha: HEAD_SHA, repo: { full_name: REPOSITORY } },
      user: { login: AUTHOR },
      merge_commit_sha: MERGE_SHA,
      draft: false
    }],
    run: {
      id: 123,
      head_branch: "agent/openspec/" + taskId,
      path: ".github/workflows/agent-openspec.yml",
      event: "workflow_dispatch",
      actor: { login: "cedricmenec" },
      status: "completed",
      conclusion: "success",
      head_sha: HEAD_SHA
    },
    headChecks: [{
      name: "check",
      head_sha: HEAD_SHA,
      app: { slug: "github-actions", id: 15368 },
      status: "completed",
      conclusion: "failure"
    }],
    mainChecks: [],
    comparison: { status: "ahead" },
    mainRuns: []
  };
  const verdict = verifyDelivery(config, observation);

  const snap = snapshot([card(taskId)]);
  const manifest = buildManifest(snap, 2, "wave-e2e-redci");
  let journal = beginDispatch(createJournal(manifest), taskId, FIXED_AT).journal;
  journal = applyEvent(journal, {
    type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId, workflowRunId: 123, at: FIXED_AT
  }).journal;
  journal = applyEvent(journal, {
    type: WAVE_EVENT.FAILED, taskId, reason: "ci_or_pages_failed", at: FIXED_AT
  }).journal;
  const afterFailure = planDispatch(journal, manifest, taskId);

  return scenario("red-ci", "CI rouge simulée ⇒ livraison non vérifiée, aucune fusion forcée", [
    check("verdict_not_verified", verdict.status !== DELIVERY_STATUS.VERIFIED, verdict.status),
    check("verdict_pending", verdict.status === DELIVERY_STATUS.PENDING, verdict.status),
    check("reason_check_failed", verdict.reasons.includes(DELIVERY_REASON.CHECK_FAILED),
      verdict.reasons.join(",")),
    check("no_scheduler_evidence", toSchedulerEvidence(verdict) === null,
      JSON.stringify(toSchedulerEvidence(verdict))),
    check("journal_stop_failed", journal.stop?.code === STOP_CODE.STOP_FAILED, journal.stop?.code ?? "none"),
    check("journal_valid_after_stop", validateJournal(journal, manifest).ok,
      validateJournal(journal, manifest).errors.length),
    check("no_dispatch_after_failure", afterFailure.decision === STOP_CODE.STOP_FAILED,
      afterFailure.decision)
  ], { verdict: verdict.status, reasons: verdict.reasons });
}

/** 5. Two-task wave: exactly two reservations, dynamic recalc, no third. */
export function scenarioTwoTaskWave() {
  const cards = [
    card("TS-011", { priority: "critical" }),
    card("TS-012", { priority: "high" }),
    card("TS-013", { priority: "normal" })
  ];
  const snap = snapshot(cards);
  const manifest = buildManifest(snap, 2, "wave-e2e-two");
  let journal = createJournal(manifest);
  const evidence = { deliveries: {} };

  const first = selectNextTask(manifest, snap, evidence, toSchedulerExecutionState(journal));
  journal = deliver(journal, first.taskId).journal;
  evidence.deliveries[first.taskId] = { status: "verified", proof: { pr: 99, mergeSha: MERGE_SHA } };

  const second = selectNextTask(manifest, snap, evidence, toSchedulerExecutionState(journal));
  journal = deliver(journal, second.taskId).journal;
  evidence.deliveries[second.taskId] = { status: "verified", proof: { pr: 100, mergeSha: MERGE_SHA } };

  const thirdDecision = selectNextTask(manifest, snap, evidence, toSchedulerExecutionState(journal));
  const thirdAttempt = beginDispatch(journal, "TS-013", FIXED_AT);
  const reservedKeys = journal.entries
    .filter(entry => entry.event === WAVE_EVENT.RESERVE_DISPATCH)
    .map(entry => entry.taskId);

  return scenario("two-task-wave", "Vague à deux tâches ⇒ deux réservations maximum, aucun troisième", [
    check("first_selected", first.taskId === "TS-011", first.taskId),
    check("second_selected_after_recalc", second.taskId === "TS-012", second.taskId),
    check("third_quota_reached", thirdDecision.decision === DECISION.QUOTA_REACHED,
      thirdDecision.decision),
    check("third_dispatch_refused", thirdAttempt.ok === false, thirdAttempt.code ?? "unexpected"),
    check("exactly_two_reservations", journal.quota.taskStartsReserved === 2,
      journal.quota.taskStartsReserved),
    check("no_third_key", reservedKeys.length === 2 && !reservedKeys.includes("TS-013"),
      reservedKeys.join(",")),
    check("journal_valid", validateJournal(journal, manifest).ok,
      validateJournal(journal, manifest).errors.length)
  ], { reserved: reservedKeys });
}

/** 6. Concurrent access: one paid development at a time; journal CAS conflicts. */
export function scenarioConcurrentAccess() {
  const snap = snapshot([card("TS-011")]);
  const manifest = buildManifest(snap, 2, "wave-e2e-concurrent");
  const store = createMemoryWaveStore();
  const loaded = loadJournal(store, manifest);
  const selected = applyEvent(loaded.journal, {
    type: WAVE_EVENT.SELECT, taskId: "TS-011", at: FIXED_AT
  });
  const firstCommit = store.commit(manifest.waveId, loaded.sha256, selected.journal);
  const staleCommit = store.commit(manifest.waveId, null, selected.journal);

  const lock = createPaidDevelopmentLock();
  const waveAcquire = lock.acquire("wave:run-1");
  const manualAcquire = lock.acquire("manual:run-2");
  lock.release("wave:run-1");
  const manualAfterRelease = lock.acquire("manual:run-2");

  return scenario("concurrent-access", "Accès concurrent ⇒ un seul développement payant, CAS refusé", [
    check("first_commit_ok", firstCommit.ok === true, firstCommit.sha256),
    check("stale_commit_conflict", staleCommit.ok === false && staleCommit.conflict === true,
      staleCommit.conflict === true ? "conflict" : "no_conflict"),
    check("wave_lock_acquired", waveAcquire.ok === true, waveAcquire.holder),
    check("manual_blocked_while_held", manualAcquire.ok === false,
      manualAcquire.holder ?? "none"),
    check("manual_after_release_ok", manualAfterRelease.ok === true, manualAfterRelease.holder)
  ], { conflict: staleCommit.conflict === true });
}

export const SCENARIO_BUILDERS = Object.freeze({
  "empty-backlog": scenarioEmptyBacklog,
  "dependency-unblocks": scenarioDependencyUnblocks,
  "crash-windows": scenarioCrashWindows,
  "red-ci": scenarioRedCi,
  "two-task-wave": scenarioTwoTaskWave,
  "concurrent-access": scenarioConcurrentAccess
});

export const SCENARIO_NAMES = Object.freeze(Object.keys(SCENARIO_BUILDERS));

/**
 * Run the full deterministic recette. Pure: no OpenRouter, GitHub, network,
 * clock, file write or dispatch. Returns a frozen, secret-free report where
 * `paidCalls` and `dispatches` are always `0`.
 */
export function runE2eValidation() {
  const scenarios = SCENARIO_NAMES.map(name => SCENARIO_BUILDERS[name]());
  const failed = scenarios.filter(entry => !entry.passed).map(entry => entry.id);
  return deepFreeze({
    schemaVersion: 1,
    mode: "recette-simulee",
    generatedAt: null,
    paidCalls: 0,
    dispatches: 0,
    scenarioCount: scenarios.length,
    ok: failed.length === 0,
    failed,
    scenarios
  });
}

/** Render the recette as a short French summary. */
export function formatE2eReport(report) {
  const lines = [];
  lines.push("ThreadStep ASF — recette E2E simulée (ASF-V2-011)");
  lines.push("Appels OpenRouter : " + report.paidCalls +
    "   Dispatches : " + report.dispatches);
  lines.push("Scénarios : " + report.scenarioCount +
    "   Résultat : " + (report.ok ? "OK" : "ÉCHEC"));
  lines.push("");
  for (const scenarioEntry of report.scenarios) {
    lines.push((scenarioEntry.passed ? "  [OK] " : "  [--] ") + scenarioEntry.id +
      " — " + scenarioEntry.title);
    for (const entry of scenarioEntry.checks) {
      lines.push("        " + (entry.passed ? "ok" : "KO") + " " + entry.name +
        (entry.detail === null ? "" : " (" + entry.detail + ")"));
    }
  }
  if (!report.ok) {
    lines.push("");
    lines.push("Échecs : " + report.failed.join(", "));
  }
  return lines.join("\n") + "\n";
}

function runCli() {
  const report = runE2eValidation();
  process.stdout.write(formatE2eReport(report));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  runCli();
}
