import test from "node:test";
import assert from "node:assert/strict";
import { createGithubClient } from "../scripts/asf/github/client.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { inspectV3OwnerIntent } from "../scripts/asf/v3/owner-intent-preflight.mjs";

const REPO = "cedricmenec/threadstep";
const WORKFLOW = ".github/workflows/backlog-orchestrator-v3.yml";
const H = c => c.repeat(40);
const tasks = () => [
  { id: "TS-015", sha256: "a".repeat(64) },
  { id: "TS-016", sha256: "b".repeat(64) }
];
function manifest() {
  return {
    schemaVersion: 2, policyVersion: "asf-orch-v3",
    waveId: "wave-owner-009", repository: REPO,
    backlogCommit: H("c"),
    model: "openrouter/deepseek/deepseek-v4.1-flash",
    autoMerge: false,
    limits: { maxTaskStarts: 2, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    candidateTasks: tasks(),
    authorization: {
      runId: "42001", actor: "cedricmenec",
      workflowRef: REPO + "/" + WORKFLOW + "@refs/heads/main",
      sourceSha: H("c")
    }
  };
}
function context(m) {
  return {
    repository: REPO, runId: "42001", runAttempt: 1,
    actor: "cedricmenec", workflowRef: REPO + "/" + WORKFLOW + "@refs/heads/main",
    eventName: "workflow_dispatch", ref: "refs/heads/main",
    sha: H("c"),
    inputs: {
      wave_id: m.waveId,
      model: m.model,
      max_task_starts: String(m.limits.maxTaskStarts),
      auto_merge: String(m.autoMerge),
      backlog_commit: m.backlogCommit,
      candidate_set_sha256: contentSha256(m.candidateTasks)
    }
  };
}
function run() {
  return {
    id: 42001, repository: { full_name: REPO },
    actor: { login: "cedricmenec" },
    path: WORKFLOW, event: "workflow_dispatch",
    head_branch: "main", head_sha: H("c"),
    run_attempt: 1, status: "in_progress", conclusion: null
  };
}
function mockReader(observed = run(), failure = null) {
  const calls = [];
  const transport = async path => {
    calls.push(path);
    if (failure) throw Object.assign(new Error("ghp_" + "x".repeat(30)),
      { status: failure });
    assert.equal(path, "repos/cedricmenec/threadstep/actions/runs/42001");
    return observed;
  };
  return { calls, client: createGithubClient({ transport }) };
}
async function assess(m = manifest(), ctx = null, observed = run()) {
  const io = mockReader(observed);
  const outcome = await inspectV3OwnerIntent({
    manifest: m, ownerContext: ctx ?? context(m), readClient: io.client
  });
  return { outcome, calls: io.calls };
}

test("a matching owner context + independent GitHub run is only consistency, never permission", async () => {
  const { outcome, calls } = await assess();
  assert.equal(outcome.status, "consistent_not_authorized");
  assert.equal(outcome.authorized, false);
  assert.equal(outcome.canSign, false);
  assert.equal(outcome.canSpend, false);
  assert.equal(outcome.canDispatch, false);
  assert.equal(outcome.evidence.ownerRunId, "42001");
  assert.equal(outcome.evidence.manifestHash, contentSha256(manifest()));
  assert.equal(outcome.evidence.candidateSetHash, contentSha256(tasks()));
  assert.deepEqual(calls, ["repos/cedricmenec/threadstep/actions/runs/42001"]);
  assert.ok(Object.isFrozen(outcome));
  assert.ok(Object.isFrozen(outcome.evidence));
  assert.doesNotMatch(JSON.stringify(outcome), /signature|privateKey|OPENROUTER_API_KEY/);
});

test("the six explicitly dispatched intent fields must match the frozen manifest", async () => {
  const m = manifest(), original = context(m);
  const altered = [
    { wave_id: "wave-unrelated" },
    { model: "openrouter/unknown/model" },
    { max_task_starts: "3" },
    { max_task_starts: "02" },
    { auto_merge: "true" },
    { backlog_commit: H("d") },
    { candidate_set_sha256: "f".repeat(64) },
    { injected_secret: "example" }
  ];
  for (const change of altered) {
    const io = mockReader();
    const result = await inspectV3OwnerIntent({
      manifest: m, ownerContext: {
        ...original, inputs: { ...original.inputs, ...change }
      }, readClient: io.client
    });
    assert.equal(result.status, "rejected", JSON.stringify(change));
    assert.equal(result.reason, "owner_inputs_not_bound_to_manifest");
    assert.equal(io.calls.length, 0, "bad inputs never request GitHub");
  }
});

test("owner runner identity, original attempt, main branch and workflow ref must match", async () => {
  const m = manifest(), original = context(m);
  const variants = [
    { actor: "attacker" }, { runId: "42002" },
    { runAttempt: 2 }, { ref: "refs/heads/feature" },
    { sha: H("d") }, { eventName: "repository_dispatch" },
    { workflowRef: REPO + "/" + WORKFLOW + "@refs/heads/feature" },
    { repository: "attacker/repo" },
    { extra: true }
  ];
  for (const update of variants) {
    const io = mockReader();
    const result = await inspectV3OwnerIntent({
      manifest: m, ownerContext: { ...original, ...update }, readClient: io.client
    });
    assert.equal(result.status, "rejected", JSON.stringify(update));
    assert.equal(io.calls.length, 0);
  }
});

test("manifest policy, candidate hashes, owner actor and run authorization must be strict", async () => {
  const m = manifest();
  const invalid = [
    { limits: { ...m.limits, maxTaskStarts: 11 } },
    { limits: { ...m.limits, maxPaidRetries: 1 } },
    { limits: { ...m.limits, maxConcurrentTasks: 2 } },
    { model: "openrouter/any/other" },
    { candidateTasks: [m.candidateTasks[0], m.candidateTasks[0]] },
    { candidateTasks: [{ id: "TS-015", sha256: "bad" }] },
    { authorization: { ...m.authorization, actor: "attacker" } },
    { authorization: { ...m.authorization, sourceSha: H("e") } },
    { authorization: { ...m.authorization, runId: "0042001" } },
    { repository: "different/repo" },
    { schemaVersion: 1 },
    { injected: "foo" }
  ];
  for (const patch of invalid) {
    const bad = { ...m, ...patch };
    const io = mockReader();
    const result = await inspectV3OwnerIntent({
      manifest: bad, ownerContext: context(m), readClient: io.client
    });
    assert.equal(result.status, "rejected", JSON.stringify(patch));
    assert.equal(result.reason, "manifest_contract_invalid");
    assert.deepEqual(io.calls, []);
  }
});

test("GitHub run must be independently observed at exact run ID, first attempt", async () => {
  const m = manifest(), expected = run();
  const variants = [
    { id: 42002 },
    { actor: { login: "attacker" } },
    { repository: { full_name: "attacker/repo" } },
    { head_sha: H("d") }, { head_branch: "feature" },
    { run_attempt: 2 }, { event: "repository_dispatch" },
    { path: ".github/workflows/agent-openspec.yml" },
    { status: "completed", conclusion: "failure" },
    { status: "cancelled", conclusion: "cancelled" }
  ];
  for (const patch of variants) {
    const { outcome, calls } = await assess(m, context(m), {
      ...expected, ...patch
    });
    assert.equal(outcome.status, "rejected", JSON.stringify(patch));
    assert.equal(outcome.reason, "owner_run_metadata_mismatch");
    assert.equal(calls.length, 1);
  }
});
test("successful completion still only means metadata consistent", async () => {
  const m = manifest();
  const { outcome } = await assess(m, context(m), {
    ...run(), status: "completed", conclusion: "success"
  });
  assert.equal(outcome.status, "consistent_not_authorized");
  assert.equal(outcome.authorized, false);
});
test("GitHub missing, ambiguous or read permission denied fails closed", async () => {
  const m = manifest();
  const out = await inspectV3OwnerIntent({
    manifest: m, ownerContext: context(m), readClient: null
  });
  assert.equal(out.status, "uncertain");
  const io = mockReader(run(), 403);
  const result = await inspectV3OwnerIntent({
    manifest: m, ownerContext: context(m), readClient: io.client
  });
  assert.equal(result.status, "uncertain");
  assert.equal(result.authorized, false);
  assert.doesNotMatch(JSON.stringify(result), /ghp_/);
  assert.equal(io.calls.length, 1, "no automatic retry on permission denied");
});
test("untrusted inputs without an owner runner context are not evidence", async () => {
  const m = manifest();
  const result = await inspectV3OwnerIntent({
    manifest: m, ownerContext: {
      ...context(m), inputs: null
    }, readClient: mockReader().client
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.canSign, false);
});
test("any readable JSON supplied by caller alone never gives a signed permit", async () => {
  const m = manifest();
  const { outcome } = await assess(m, context(m), run());
  assert.equal(Object.hasOwn(outcome, "permit"), false);
  assert.equal(Object.hasOwn(outcome, "verificationKey"), false);
  assert.equal(Object.hasOwn(outcome, "authorized"), true);
  assert.equal(outcome.authorized, false);
});
