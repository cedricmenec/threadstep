import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  MANIFEST_SCHEMA_VERSION, MODEL_ALLOWLIST, ORCHESTRATOR_POLICY_VERSION,
  WAVE_EVENT, WAVE_STATE, STOP_CODE, DISPATCH_DECISION, RESUME_OUTCOME,
  createWaveManifest, createJournal, currentState, applyEvent, selectTask,
  beginDispatch, reserveDispatch, decideResume, planDispatch, canDispatch,
  validateJournal, serializeJournal, reconstructJournal, summarizeJournal,
  toSchedulerExecutionState, createMemoryWaveStore, loadJournal, commitEvent,
  isSecretFree
} from "../scripts/asf/waves/index.mjs";
import { DECISION, selectNextTask } from "../scripts/asf/scheduler/index.mjs";

function sha(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function makeManifest({ maxTaskStarts = 2, candidateIds } = {}) {
  const ids = candidateIds ?? ["TS-012", "TS-013", "TS-014"];
  const created = createWaveManifest({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    waveId: "wave-test-001",
    repository: "cedricmenec/threadstep",
    authorizedBy: "repository_owner",
    backlogCommit: "a".repeat(40),
    policyVersion: ORCHESTRATOR_POLICY_VERSION,
    mode: "execute",
    executor: "openspec",
    phase: "auto",
    model: MODEL_ALLOWLIST[0],
    limits: { maxTaskStarts, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    autoMerge: true,
    candidateTasks: ids.map(id => ({ id, sha256: sha(id) })),
    authorization: { parentRunId: 123, reference: "wave-authorization:123" }
  });
  assert.equal(created.ok, true, JSON.stringify(created.errors));
  return created.manifest;
}

function deliverTask(journal, taskId, overrides = {}) {
  const runId = overrides.runId ?? 555;
  const prNumber = overrides.prNumber ?? 99;
  const headSha = overrides.headSha ?? "b".repeat(40);
  const mergeCommit = overrides.mergeCommit ?? "c".repeat(40);
  const at = overrides.at ?? "2026-10-16T00:00:00Z";
  let step;
  let state = currentState(journal, taskId);
  if (state === null || state === WAVE_STATE.SELECTED) {
    step = beginDispatch(journal, taskId, at);
    assert.equal(step.ok, true, "beginDispatch " + taskId + ": " + JSON.stringify(step.errors));
    journal = step.journal;
    state = WAVE_STATE.DISPATCH_RESERVED;
  }
  if (state === WAVE_STATE.DISPATCH_RESERVED) {
    step = applyEvent(journal, {
      type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId, workflowRunId: runId,
      workflowRunUrl: "https://github.com/cedricmenec/threadstep/actions/runs/" + runId, at
    });
    assert.equal(step.ok, true);
    journal = step.journal;
  }
  step = applyEvent(journal, {
    type: WAVE_EVENT.PR_PUBLISHED, taskId, prNumber,
    prUrl: "https://github.com/cedricmenec/threadstep/pull/" + prNumber, headSha, at
  });
  assert.equal(step.ok, true);
  journal = step.journal;
  step = applyEvent(journal, { type: WAVE_EVENT.CI_PENDING, taskId, at });
  assert.equal(step.ok, true);
  journal = step.journal;
  step = applyEvent(journal, { type: WAVE_EVENT.MERGE_PENDING, taskId, at });
  assert.equal(step.ok, true);
  journal = step.journal;
  step = applyEvent(journal, { type: WAVE_EVENT.DELIVERED, taskId, mergeCommit, at });
  assert.equal(step.ok, true);
  return step.journal;
}

function card(id) {
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
    content_sha256: sha(id)
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("createJournal binds an empty journal to its manifest", () => {
  const manifest = makeManifest();
  const journal = createJournal(manifest);
  assert.equal(journal.quota.taskStartsReserved, 0);
  assert.equal(journal.quota.maxTaskStarts, 2);
  assert.deepEqual(journal.entries, []);
  assert.equal(journal.stop, null);
  assert.equal(Object.isFrozen(journal), true);
  assert.equal(validateJournal(journal, manifest).ok, true);
  assert.equal(reconstructJournal(manifest, null).ok, true);
});

test("a full delivery records decisions, SHAs and links without secrets", () => {
  const manifest = makeManifest();
  const journal = deliverTask(createJournal(manifest), "TS-012");
  assert.equal(validateJournal(journal, manifest).ok, true);

  const summary = summarizeJournal(journal);
  const task = summary.tasks.find(entry => entry.taskId === "TS-012");
  assert.equal(task.state, WAVE_STATE.DELIVERED);
  assert.equal(task.headSha, "b".repeat(40));
  assert.equal(task.mergeCommit, "c".repeat(40));
  assert.equal(task.prNumber, 99);
  assert.match(task.prUrl, /pull\/99$/);
  assert.match(task.workflowRunUrl, /runs\/555$/);
  assert.deepEqual(task.history.map(step => step.state), [
    WAVE_STATE.SELECTED, WAVE_STATE.DISPATCH_RESERVED, WAVE_STATE.EXECUTING,
    WAVE_STATE.PR_PUBLISHED, WAVE_STATE.CI_PENDING, WAVE_STATE.MERGE_PENDING,
    WAVE_STATE.DELIVERED
  ]);
  assert.equal(isSecretFree(summary), true);

  const reconstructed = reconstructJournal(manifest, serializeJournal(journal));
  assert.equal(reconstructed.ok, true);
  assert.deepEqual(summarizeJournal(reconstructed.journal), summary);
});

test("three paid starts are impossible with max_tasks=2, including after a resume", () => {
  const manifest = makeManifest({ maxTaskStarts: 2 });
  let journal = deliverTask(createJournal(manifest), "TS-012");
  assert.equal(journal.quota.taskStartsReserved, 1);

  let step = beginDispatch(journal, "TS-013", "2026-10-16T01:00:00Z");
  assert.equal(step.ok, true);
  journal = step.journal;
  assert.equal(journal.quota.taskStartsReserved, 2);
  step = applyEvent(journal, {
    type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId: "TS-013", workflowRunId: 556
  });
  assert.equal(step.ok, true);
  journal = step.journal;

  assert.equal(planDispatch(journal, manifest, "TS-014").decision, DISPATCH_DECISION.QUOTA_REACHED);
  const third = beginDispatch(journal, "TS-014", "2026-10-16T02:00:00Z");
  assert.equal(third.ok, false);
  assert.equal(third.code, "quota_reached");
  assert.deepEqual(third.journal, journal);

  const resumed = reconstructJournal(manifest, serializeJournal(journal));
  assert.equal(resumed.ok, true);
  assert.equal(resumed.journal.quota.taskStartsReserved, 2);
  assert.equal(planDispatch(resumed.journal, manifest, "TS-014").decision, DISPATCH_DECISION.QUOTA_REACHED);
});

test("an uncertain dispatch stops the wave and never dispatches again", () => {
  const manifest = makeManifest();
  let journal = createJournal(manifest);
  let step = beginDispatch(journal, "TS-012", "2026-10-16T00:00:00Z");
  assert.equal(step.ok, true);
  journal = step.journal;
  step = applyEvent(journal, {
    type: WAVE_EVENT.DISPATCH_UNCERTAIN, taskId: "TS-012", at: "2026-10-16T00:05:00Z"
  });
  assert.equal(step.ok, true);
  journal = step.journal;
  assert.equal(journal.stop.code, STOP_CODE.STOP_UNCERTAIN);
  assert.equal(planDispatch(journal, manifest, "TS-013").decision, DISPATCH_DECISION.STOP_UNCERTAIN);
  assert.equal(planDispatch(journal, manifest, "TS-012").decision, DISPATCH_DECISION.STOP_UNCERTAIN);

  const second = applyEvent(journal, { type: WAVE_EVENT.RESERVE_DISPATCH, taskId: "TS-013" });
  assert.equal(second.ok, false);
  assert.equal(second.code, "wave_stopped");

  const resumed = reconstructJournal(manifest, serializeJournal(journal));
  assert.equal(resumed.ok, true);
  assert.equal(planDispatch(resumed.journal, manifest, "TS-013").decision, DISPATCH_DECISION.STOP_UNCERTAIN);
});

test("a crash between reservation and run id stops the whole wave as uncertain", () => {
  const manifest = makeManifest();
  let journal = createJournal(manifest);
  const step = beginDispatch(journal, "TS-012", "t");
  journal = step.journal;
  assert.equal(currentState(journal, "TS-012"), WAVE_STATE.DISPATCH_RESERVED);
  assert.equal(decideResume(journal, "TS-012").outcome, RESUME_OUTCOME.UNCERTAIN);
  assert.equal(planDispatch(journal, manifest, "TS-012").decision, DISPATCH_DECISION.STOP_UNCERTAIN);
  assert.equal(planDispatch(journal, manifest, "TS-013").decision, DISPATCH_DECISION.STOP_UNCERTAIN);
  assert.equal(canDispatch(journal, manifest, "TS-013"), false);

  const resumed = reconstructJournal(manifest, serializeJournal(journal));
  assert.equal(resumed.ok, true);
  assert.equal(planDispatch(resumed.journal, manifest, "TS-013").decision, DISPATCH_DECISION.STOP_UNCERTAIN);
});

test("a crash before dispatch is safe to resume and consumes no quota", () => {
  const manifest = makeManifest();
  let journal = selectTask(createJournal(manifest), "TS-012", "t").journal;
  assert.equal(decideResume(journal, "TS-012").outcome, RESUME_OUTCOME.SELECTED_NOT_DISPATCHED);
  assert.equal(journal.quota.taskStartsReserved, 0);
  assert.equal(planDispatch(journal, manifest, "TS-012").decision, DISPATCH_DECISION.DISPATCH);
  assert.equal(beginDispatch(journal, "TS-012", "t2").ok, true);
});

test("a crash after dispatch resumes as in flight and blocks concurrency", () => {
  const manifest = makeManifest();
  let journal = createJournal(manifest);
  let step = beginDispatch(journal, "TS-012", "t");
  journal = step.journal;
  step = applyEvent(journal, { type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId: "TS-012", workflowRunId: 7 });
  journal = step.journal;
  assert.equal(decideResume(journal, "TS-012").outcome, RESUME_OUTCOME.IN_FLIGHT);
  assert.equal(planDispatch(journal, manifest, "TS-012").decision, DISPATCH_DECISION.IN_FLIGHT);
  assert.equal(planDispatch(journal, manifest, "TS-013").decision, DISPATCH_DECISION.IN_FLIGHT);

  journal = deliverTask(journal, "TS-012");
  assert.equal(planDispatch(journal, manifest, "TS-013").decision, DISPATCH_DECISION.DISPATCH);
});

test("the first failure stops the wave", () => {
  const manifest = makeManifest();
  let journal = createJournal(manifest);
  let step = beginDispatch(journal, "TS-012", "t");
  journal = step.journal;
  step = applyEvent(journal, { type: WAVE_EVENT.FAILED, taskId: "TS-012", reason: "ci_red" });
  assert.equal(step.ok, true);
  journal = step.journal;
  assert.equal(journal.stop.code, STOP_CODE.STOP_FAILED);
  assert.equal(planDispatch(journal, manifest, "TS-013").decision, DISPATCH_DECISION.STOP_FAILED);
  assert.equal(applyEvent(journal, { type: WAVE_EVENT.SELECT, taskId: "TS-013" }).code, "wave_stopped");
});

test("planDispatch fails closed outside the wave and for a delivered task", () => {
  const manifest = makeManifest();
  let journal = createJournal(manifest);
  assert.equal(planDispatch(journal, manifest, "TS-999").decision, DISPATCH_DECISION.NOT_IN_WAVE);
  journal = deliverTask(journal, "TS-012");
  assert.equal(planDispatch(journal, manifest, "TS-012").decision, DISPATCH_DECISION.ALREADY_DELIVERED);
});

test("required payload fields are validated before an entry is appended", () => {
  const manifest = makeManifest();
  let journal = beginDispatch(createJournal(manifest), "TS-012", "t").journal;
  const missingRun = applyEvent(journal, { type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId: "TS-012" });
  assert.equal(missingRun.ok, false);
  assert.ok(missingRun.errors.some(error => error.code === "missing_payload"));

  const confirmed = applyEvent(journal, { type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId: "TS-012", workflowRunId: 1 });
  assert.equal(confirmed.ok, true);
  journal = confirmed.journal;
  const badSha = applyEvent(journal, {
    type: WAVE_EVENT.PR_PUBLISHED, taskId: "TS-012", prNumber: 1, headSha: "nope"
  });
  assert.equal(badSha.ok, false);
  assert.ok(badSha.errors.some(error => error.code === "invalid_head_sha"));
  assert.equal(journal.entries.length, 3);
});

test("secret-looking payloads are rejected and never persisted", () => {
  const manifest = makeManifest();
  const journal = beginDispatch(createJournal(manifest), "TS-012", "t").journal;
  const secret = "ghp_" + "a".repeat(30);
  const attempt = applyEvent(journal, {
    type: WAVE_EVENT.DISPATCH_CONFIRMED, taskId: "TS-012", workflowRunId: 1,
    workflowRunUrl: "https://x/" + secret
  });
  assert.equal(attempt.ok, false);
  assert.ok(attempt.errors.some(error => error.code === "secret_detected"));
  assert.deepEqual(attempt.journal, journal);
  assert.equal(serializeJournal(journal).includes(secret), false);
});

test("applyEvent is append-only, deterministic and never mutates its input", () => {
  const manifest = makeManifest();
  const base = createJournal(manifest);
  const before = serializeJournal(base);
  const first = beginDispatch(base, "TS-012", "t");
  const second = beginDispatch(base, "TS-012", "t");
  assert.equal(serializeJournal(base), before);
  assert.equal(first.ok, true);
  assert.equal(base.entries.length, 0);
  assert.equal(first.journal.entries.length, 2);
  assert.equal(serializeJournal(first.journal), serializeJournal(second.journal));
  assert.equal(reconstructJournal(manifest, serializeJournal(first.journal)).ok, true);
});

test("validateJournal fails closed on tampered durable state", () => {
  const manifest = makeManifest();
  const good = deliverTask(createJournal(manifest), "TS-012");

  const hashTamper = clone(good);
  hashTamper.manifestHash = "0".repeat(64);
  assert.ok(validateJournal(hashTamper, manifest).errors.some(error => error.code === "manifest_mismatch"));

  const quotaDrift = clone(good);
  quotaDrift.quota.taskStartsReserved += 1;
  assert.ok(validateJournal(quotaDrift, manifest).errors.some(error => error.code === "quota_drift"));

  const seqGap = clone(good);
  seqGap.entries[2].seq = 42;
  assert.ok(validateJournal(seqGap, manifest).errors.some(error => error.code === "invalid_sequence"));

  const revisionDrift = clone(good);
  revisionDrift.revision += 1;
  assert.ok(validateJournal(revisionDrift, manifest).errors.some(error => error.code === "revision_mismatch"));

  const unknownField = clone(good);
  unknownField.extra = "x";
  assert.ok(validateJournal(unknownField, manifest).errors.some(error => error.code === "unknown_field"));

  const failed = applyEvent(beginDispatch(createJournal(manifest), "TS-012", "t").journal,
    { type: WAVE_EVENT.FAILED, taskId: "TS-012", reason: "boom" }).journal;
  const afterStop = clone(failed);
  afterStop.entries.push({ seq: afterStop.entries.length + 1, taskId: "TS-013", state: WAVE_STATE.SELECTED, event: WAVE_EVENT.SELECT });
  afterStop.revision = afterStop.entries.length;
  assert.ok(validateJournal(afterStop, manifest).errors.some(error => error.code === "entry_after_stop"));
});

test("compare-and-swap rejects a stale write and never retries", () => {
  const manifest = makeManifest();
  const store = createMemoryWaveStore();
  const first = commitEvent(store, manifest, { type: WAVE_EVENT.SELECT, taskId: "TS-012", at: "t" });
  assert.equal(first.ok, true);
  const staleSha = store.read(manifest.waveId).sha256;

  const second = commitEvent(store, manifest, { type: WAVE_EVENT.RESERVE_DISPATCH, taskId: "TS-012", at: "t" });
  assert.equal(second.ok, true);
  assert.notEqual(store.read(manifest.waveId).sha256, staleSha);

  const replica = createMemoryWaveStore(store.records());
  const staleWrite = replica.commit(manifest.waveId, staleSha, loadJournal(replica, manifest).journal);
  assert.equal(staleWrite.ok, false);
  assert.equal(staleWrite.conflict, true);
  assert.equal(staleWrite.actualSha, store.read(manifest.waveId).sha256);

  const forced = commitEvent({
    read: () => ({ serialized: serializeJournal(createJournal(manifest)), sha256: "stale", revision: 0 }),
    commit: () => ({ ok: false, conflict: true, actualSha: "other", revision: 1 })
  }, manifest, { type: WAVE_EVENT.SELECT, taskId: "TS-012", at: "t" });
  assert.equal(forced.ok, false);
  assert.equal(forced.code, "conflict");
});

test("commitEvent persists, reloads and blocks a third start after max_tasks=2", () => {
  const manifest = makeManifest({ maxTaskStarts: 2 });
  const store = createMemoryWaveStore();
  for (const event of [
    { type: WAVE_EVENT.SELECT, taskId: "TS-012", at: "t" },
    { type: WAVE_EVENT.RESERVE_DISPATCH, taskId: "TS-012", at: "t" },
    { type: WAVE_EVENT.SELECT, taskId: "TS-013", at: "t" },
    { type: WAVE_EVENT.RESERVE_DISPATCH, taskId: "TS-013", at: "t" }
  ]) {
    const result = commitEvent(store, manifest, event);
    assert.equal(result.ok, true, event.type + " " + JSON.stringify(result.errors));
  }

  const reloaded = loadJournal(store, manifest);
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.journal.quota.taskStartsReserved, 2);

  const third = commitEvent(store, manifest, { type: WAVE_EVENT.RESERVE_DISPATCH, taskId: "TS-014", at: "t" });
  assert.equal(third.ok, false);
  assert.equal(third.code, "quota_reached");
  assert.equal(store.read(manifest.waveId).revision, 4);
});

test("loadJournal fails closed on a corrupt or mismatched record", () => {
  const manifest = makeManifest();
  const store = createMemoryWaveStore();
  commitEvent(store, manifest, { type: WAVE_EVENT.SELECT, taskId: "TS-012", at: "t" });
  const record = store.read(manifest.waveId);
  const corrupt = createMemoryWaveStore([{ waveId: manifest.waveId, serialized: record.serialized, revision: record.revision }]);
  const tampered = JSON.parse(record.serialized);
  tampered.manifestHash = "0".repeat(64);
  const other = createMemoryWaveStore([{ waveId: manifest.waveId, serialized: JSON.stringify(tampered), revision: tampered.revision }]);
  assert.equal(loadJournal(corrupt, manifest).ok, true);
  const mismatch = loadJournal(other, manifest);
  assert.equal(mismatch.ok, false);
  assert.ok(mismatch.errors.some(error => error.code === "manifest_mismatch"));
});

test("toSchedulerExecutionState integrates with the pure scheduler core", () => {
  const manifest = makeManifest({ candidateIds: ["TS-012", "TS-013"] });
  const snapshot = { active: [card("TS-012"), card("TS-013")], archive: [], legacy: [], diagnostics: [] };
  const schedulerManifest = { candidateTasks: manifest.candidateTasks };

  const delivered = deliverTask(createJournal(manifest), "TS-012");
  const first = selectNextTask(schedulerManifest, snapshot, {}, toSchedulerExecutionState(delivered));
  assert.equal(first.decision, DECISION.SELECT);
  assert.equal(first.taskId, "TS-013");

  const bothReserved = beginDispatch(delivered, "TS-013", "t").journal;
  const second = selectNextTask(schedulerManifest, snapshot, {}, toSchedulerExecutionState(bothReserved));
  assert.equal(second.decision, DECISION.QUOTA_REACHED);
});

test("the wave modules perform no I/O, network access or clock reads", () => {
  for (const file of ["hash.mjs", "secrets.mjs", "manifest.mjs", "journal.mjs", "store.mjs", "index.mjs"]) {
    const source = readFileSync(new URL("../scripts/asf/waves/" + file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["']node:(fs|child_process|http|https|net|dns|os)["']/, file);
    assert.doesNotMatch(source, /writeFileSync|appendFileSync|createWriteStream|rmSync|unlinkSync/, file);
    assert.doesNotMatch(source, /\bfetch\s*\(/, file);
    assert.doesNotMatch(source, /\bnew Date\b/, file);
    assert.doesNotMatch(source, /Math\.random/, file);
  }
});
