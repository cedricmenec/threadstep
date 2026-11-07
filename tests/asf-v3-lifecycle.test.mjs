import test from "node:test";
import assert from "node:assert/strict";
import {
  V3_SCHEMA, V3_MAX_TASKS, V3_CONTROLLER_WORKFLOW, V3_CHILD_WORKFLOW,
  parseV3MaxTasks, createV3Manifest, createV3Journal, advanceV3,
  reconstructV3Journal, v3NextAction, v3JournalHash
} from "../scripts/asf/v3/lifecycle.mjs";
import { createWaveManifest } from "../scripts/asf/waves/manifest.mjs";

const hex = ch => ch.repeat(40);
const digest = ch => ch.repeat(64);
const repo = "cedricmenec/threadstep";
const controllerPath = repo + "/" + V3_CONTROLLER_WORKFLOW;
const childPath = repo + "/" + V3_CHILD_WORKFLOW;

function manifest(maxTaskStarts = 10, count = 12) {
  return createV3Manifest({
    waveId: "wave-v3-123", repository: repo, backlogCommit: hex("a"),
    model: "openrouter/deepseek/deepseek-v4.1-flash", autoMerge: true,
    maxTaskStarts,
    candidateTasks: Array.from({ length: count }, (_, i) => ({
      id: "TS-" + String(i + 1).padStart(3, "0"),
      sha256: digest(((i % 6) + 1).toString(16))
    })),
    authorization: { runId: "100", actor: "cedricmenec",
      workflowRef: controllerPath, sourceSha: hex("a") }
  });
}
const event = (m, j, e, revision = j.revision) => advanceV3(m, j, e, revision);
const mustReject = (fn, code) => assert.throws(fn, e => e?.code === code, code);

function originalEvidence() {
  return { runId: "100", actor: "cedricmenec", workflowRef: controllerPath,
    sourceSha: hex("a"), event: "workflow_dispatch", attempt: 1, headBranch: "main" };
}
function attach(m, j, id) {
  return event(m, j, {
    type: "ATTACH_CONTROLLER", controllerRunId: String(id),
    checkpointRevision: j.revision, checkpointHash: v3JournalHash(j),
    origin: originalEvidence(),
    controller: { runId: String(id), workflowRef: controllerPath,
      repository: repo, event: "repository_dispatch", headBranch: "main" }
  });
}
function toClaimed(m, j, id = "TS-001", childId = "200") {
  j = event(m, j, { type: "RESERVE", taskId: id });
  assert.equal(j.active.reservationId, m.waveId + ":" + j.reserved);
  j = event(m, j, { type: "DISPATCH_INTENT", taskId: id });
  assert.equal(v3NextAction(j), "RECONCILE_DISPATCH_NO_RETRY");
  j = event(m, j, { type: "ACK_CHILD", taskId: id,
    childRunId: childId, runAttempt: 1, workflowRef: childPath });
  j = event(m, j, { type: "CLAIM_CHILD", taskId: id,
    childRunId: childId, runAttempt: 1, workflowRef: childPath });
  return j;
}
function toDelivered(m, j, id = "TS-001", childId = "200", n = 1) {
  j = toClaimed(m, j, id, childId);
  j = event(m, j, { type: "PR_PUBLISHED", taskId: id, childRunId: childId,
    prNumber: 500 + n, headSha: hex("b") });
  const mergeSha = hex("c");
  j = event(m, j, { type: "DELIVERED", taskId: id, proof: {
    prNumber: 500 + n, headSha: hex("b"), mergeSha,
    merged: true, branchProtected: true,
    requiredCheck: { sha: hex("b"), conclusion: "success" },
    mainCheck: { sha: mergeSha, conclusion: "success" },
    pages: { sha: mergeSha, conclusion: "success" }
  } });
  assert.equal(j.status, "DELIVERED");
  assert.equal(v3NextAction(j), "PERSIST_CHECKPOINT");
  return event(m, j, { type: "CHECKPOINT", taskId: id });
}

test("1..10 is a strict integer input; no coerced, missing or oversized values", () => {
  assert.equal(V3_MAX_TASKS, 10);
  for (const n of [1, 2, 3, 5, 10]) {
    assert.equal(parseV3MaxTasks(n), n);
    assert.equal(parseV3MaxTasks(String(n)), n);
  }
  for (const n of [0, 11, 15, -1, 1.5, NaN, null, undefined, "", "01", " 1", "1.0", "1e1", "abc"]) {
    mustReject(() => parseV3MaxTasks(n), "invalid_max_tasks");
  }
});

test("manifest is versioned, frozen, and rejects unrecognized origin or candidates", () => {
  const m = manifest(10);
  assert.equal(m.schemaVersion, V3_SCHEMA);
  assert.equal(m.limits.maxConcurrentTasks, 1);
  assert.equal(m.limits.maxPaidRetries, 0);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.candidateTasks[0]));
  assert.throws(() => { m.limits.maxTaskStarts = 100; }, TypeError);
});
test("model origin and V3 quota cannot be silently widened", () => {
  const m = manifest();
  for (const max of [0, 11]) {
    mustReject(() => createV3Manifest({
      waveId: m.waveId, repository: m.repository, backlogCommit: m.backlogCommit,
      model: m.model, autoMerge: true, maxTaskStarts: max,
      authorization: m.authorization, candidateTasks: m.candidateTasks
    }), "invalid_max_tasks");
  }
  mustReject(() => createV3Manifest({
    waveId: m.waveId, repository: m.repository, backlogCommit: m.backlogCommit,
    model: m.model, autoMerge: true, maxTaskStarts: 10,
    authorization: { ...m.authorization, actor: "not-owner" },
    candidateTasks: m.candidateTasks
  }), "invalid_origin_authorization");
  mustReject(() => createV3Manifest({
    waveId: m.waveId, repository: m.repository, backlogCommit: m.backlogCommit,
    model: m.model, autoMerge: true, maxTaskStarts: 10,
    authorization: m.authorization, candidateTasks: [m.candidateTasks[0], m.candidateTasks[0]]
  }), "invalid_candidate");
});

test("no dispatch before reservation; intent is never automatically re-sent", () => {
  const m = manifest(), j = createV3Journal(m);
  assert.equal(v3NextAction(j), "SELECT_NEXT");
  mustReject(() => event(m, j, { type: "DISPATCH_INTENT", taskId: "TS-001" }),
    "wrong_phase_or_task");
  const reserved = event(m, j, { type: "RESERVE", taskId: "TS-001" });
  assert.equal(reserved.reserved, 1);
  assert.equal(v3NextAction(reserved), "PERSIST_DISPATCH_INTENT");
  mustReject(() => event(m, reserved, { type: "RESERVE", taskId: "TS-002" }),
    "wave_not_ready");
  const intent = event(m, reserved, { type: "DISPATCH_INTENT", taskId: "TS-001" });
  mustReject(() => event(m, intent, { type: "DISPATCH_INTENT", taskId: "TS-001" }),
    "wrong_phase_or_task");
  assert.equal(v3NextAction(intent), "RECONCILE_DISPATCH_NO_RETRY");
  assert.equal(reconstructV3Journal(m, JSON.parse(JSON.stringify(intent))).revision, 2);
});

test("only acknowledged child run attempt 1 can claim before a paid call", () => {
  const m = manifest();
  let j = event(m, createV3Journal(m), { type: "RESERVE", taskId: "TS-001" });
  j = event(m, j, { type: "DISPATCH_INTENT", taskId: "TS-001" });
  mustReject(() => event(m, j, { type: "CLAIM_CHILD", taskId: "TS-001",
    childRunId: "200", runAttempt: 1, workflowRef: childPath }), "wrong_phase_or_task");
  mustReject(() => event(m, j, { type: "ACK_CHILD", taskId: "TS-001",
    childRunId: "200", runAttempt: 2, workflowRef: childPath }), "untrusted_child_ack");
  j = event(m, j, { type: "ACK_CHILD", taskId: "TS-001",
    childRunId: "200", runAttempt: 1, workflowRef: childPath });
  for (const props of [
    { childRunId: "201", runAttempt: 1, workflowRef: childPath },
    { childRunId: "200", runAttempt: 2, workflowRef: childPath },
    { childRunId: "200", runAttempt: 1, workflowRef: "other" }
  ]) mustReject(() => event(m, j, { type: "CLAIM_CHILD", taskId: "TS-001", ...props }),
    "child_replay_or_wrong_run");
  j = event(m, j, { type: "CLAIM_CHILD", taskId: "TS-001",
    childRunId: "200", runAttempt: 1, workflowRef: childPath });
  mustReject(() => event(m, j, { type: "CLAIM_CHILD", taskId: "TS-001",
    childRunId: "200", runAttempt: 1, workflowRef: childPath }), "wrong_phase_or_task");
  assert.equal(v3NextAction(j), "AWAIT_EXECUTOR");
});

test("cannot deliver with red CI, stale head SHA, failed Pages or wrong merge SHA", () => {
  const m = manifest();
  let j = toClaimed(m, createV3Journal(m));
  j = event(m, j, { type: "PR_PUBLISHED", taskId: "TS-001",
    childRunId: "200", prNumber: 501, headSha: hex("b") });
  const p = { prNumber: 501, headSha: hex("b"), mergeSha: hex("c"),
    merged: true, branchProtected: true,
    requiredCheck: { sha: hex("b"), conclusion: "success" },
    mainCheck: { sha: hex("c"), conclusion: "success" },
    pages: { sha: hex("c"), conclusion: "success" } };
  for (const changed of [
    { ...p, requiredCheck: { ...p.requiredCheck, conclusion: "failure" } },
    { ...p, requiredCheck: { ...p.requiredCheck, sha: hex("d") } },
    { ...p, mainCheck: { ...p.mainCheck, sha: hex("a") } },
    { ...p, pages: { ...p.pages, conclusion: "failure" } },
    { ...p, merged: false },
    { ...p, branchProtected: false }
  ]) mustReject(() => event(m, j, { type: "DELIVERED", taskId: "TS-001", proof: changed }),
    "delivery_not_independently_verified");
  const delivered = event(m, j, { type: "DELIVERED", taskId: "TS-001", proof: p });
  assert.equal(delivered.delivered, 1);
  mustReject(() => event(m, delivered, { type: "RESERVE", taskId: "TS-002" }),
    "wave_not_ready");
});

test("after one delivery a new controller requires matching checkpoint and original mandate", () => {
  const m = manifest(3);
  const j = toDelivered(m, createV3Journal(m));
  assert.equal(j.status, "READY");
  assert.equal(v3NextAction(j), "VERIFY_CONTINUATION");
  mustReject(() => event(m, j, { type: "RESERVE", taskId: "TS-002" }),
    "wave_not_ready");
  const attachBase = { type: "ATTACH_CONTROLLER", controllerRunId: "300",
    checkpointRevision: j.revision, checkpointHash: v3JournalHash(j),
    origin: originalEvidence(),
    controller: { runId: "300", workflowRef: controllerPath, repository: repo,
      event: "repository_dispatch", headBranch: "main" } };
  for (const change of [
    { checkpointRevision: j.revision - 1 },
    { checkpointHash: digest("e") },
    { origin: { ...originalEvidence(), actor: "attacker" } },
    { origin: { ...originalEvidence(), attempt: 2 } },
    { controller: { ...attachBase.controller, event: "workflow_dispatch" } },
    { controller: { ...attachBase.controller, repository: "someone/other" } }
  ]) {
    const e = { ...attachBase, ...change };
    mustReject(() => event(m, j, e), Object.hasOwn(change, "checkpointRevision") ||
      Object.hasOwn(change, "checkpointHash") ? "checkpoint_mismatch" :
      Object.hasOwn(change, "origin") ? "unverified_original_owner_mandate" : "untrusted_continuation");
  }
  const attached = event(m, j, attachBase);
  assert.equal(attached.awaitingController, false);
  assert.equal(v3NextAction(attached), "SELECT_NEXT");
  mustReject(() => event(m, attached, attachBase), "no_nominal_checkpoint");
  assert.equal(event(m, attached, { type: "RESERVE", taskId: "TS-002" }).reserved, 2);
});

test("ten tasks and ten verified deliveries complete without an eleventh launch", () => {
  const m = manifest(10, 12);
  let j = createV3Journal(m);
  for (let n = 1; n <= 10; n++) {
    if (n > 1) j = attach(m, j, String(300 + n));
    const id = "TS-" + String(n).padStart(3, "0");
    j = toDelivered(m, j, id, String(200 + n), n);
    assert.equal(j.reserved, n);
    assert.equal(j.delivered, n);
    assert.equal(reconstructV3Journal(m, JSON.parse(JSON.stringify(j))).revision, j.revision);
  }
  assert.equal(j.status, "COMPLETED_QUOTA");
  assert.equal(v3NextAction(j), "STOP");
  mustReject(() => event(m, j, { type: "RESERVE", taskId: "TS-011" }), "wave_is_terminal");
});

test("stop is terminal, quota remains consumed and reconciliation never restarts payment", () => {
  const m = manifest(10);
  let j = event(m, createV3Journal(m), { type: "RESERVE", taskId: "TS-001" });
  j = event(m, j, { type: "DISPATCH_INTENT", taskId: "TS-001" });
  j = event(m, j, { type: "STOP_UNCERTAIN", reason: "dispatch_response_lost" });
  assert.equal(j.reserved, 1);
  assert.equal(j.delivered, 0);
  mustReject(() => event(m, j, { type: "ACK_CHILD", taskId: "TS-001",
    childRunId: "201", runAttempt: 1, workflowRef: childPath }), "wave_is_terminal");
  const note = event(m, j, { type: "RECONCILE_NOTE", reason: "github_run_verified_no_paid_replay" });
  assert.equal(note.reserved, 1);
  assert.equal(note.status, "STOP_UNCERTAIN");
  mustReject(() => event(m, note, { type: "RESERVE", taskId: "TS-002" }), "wave_is_terminal");
});

test("CAS revision and replay reject conflicts, quota tampering and forged journal state", () => {
  const m = manifest(10);
  const j = createV3Journal(m);
  const one = event(m, j, { type: "RESERVE", taskId: "TS-001" });
  mustReject(() => event(m, one, { type: "DISPATCH_INTENT", taskId: "TS-001" }, 0),
    "revision_conflict");
  mustReject(() => reconstructV3Journal(m, { ...one, reserved: 0 }), "journal_replay_divergence");
  mustReject(() => reconstructV3Journal(m, { ...one, events: [{ ...one.events[0], seq: 5 }] }),
    "broken_event_sequence");
  mustReject(() => reconstructV3Journal(m, { ...one, manifestHash: digest("b") }),
    "invalid_persisted_journal");
  assert.equal(one.reserved, 1);
  assert.equal(j.reserved, 0);
});

test("no-work close requires an idle wave; compatibility keeps V1 max 2", () => {
  const m = manifest(10);
  let j = createV3Journal(m);
  j = event(m, j, { type: "COMPLETE_NO_WORK" });
  assert.equal(j.status, "COMPLETED_NO_WORK");
  mustReject(() => event(m, j, { type: "RESERVE", taskId: "TS-001" }), "wave_is_terminal");
  const v1 = createWaveManifest({
    schemaVersion: 1, waveId: "wave-v1-001", repository: repo,
    authorizedBy: "repository_owner", backlogCommit: hex("a"),
    policyVersion: "asf-orch-v1", mode: "execute", executor: "openspec", phase: "auto",
    model: "openrouter/deepseek/deepseek-v4.1-flash", autoMerge: true,
    limits: { maxTaskStarts: 10, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    candidateTasks: [{ id: "TS-001", sha256: digest("1") }],
    authorization: { parentRunId: 100, reference: "test" }
  });
  assert.equal(v1.ok, false, "V1 must reject a ten-task manifest");
});

test("forged manifest policy and event payloads cannot be reinterpreted as authority", () => {
  const m = manifest(10);
  const journal = createV3Journal(m);
  mustReject(() => createV3Journal({
    ...m, limits: { ...m.limits, maxPaidRetries: 1 }
  }), "invalid_manifest_policy");
  mustReject(() => createV3Journal({
    ...m, model: "openrouter/attacker/unknown-model"
  }), "invalid_model");
  mustReject(() => event(m, journal, {
    type: "RESERVE", taskId: "TS-001", proof: { token: "not-allowed" }
  }), "invalid_or_unknown_fields");
  mustReject(() => event(m, journal, {
    type: "RESERVE", taskId: "TS-001", reason: "hiding_data"
  }), "invalid_or_unknown_fields");
});
