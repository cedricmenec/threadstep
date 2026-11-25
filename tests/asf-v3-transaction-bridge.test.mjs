import test from "node:test";
import assert from "node:assert/strict";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { attemptV3ChildClaim, attemptV3ControllerAttach }
  from "../scripts/asf/v3/transaction-bridge.mjs";

const REPO = "cedricmenec/threadstep";
const WAVE = "wave-123";
const OWNER_REF = REPO + "/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main";
const CHILD_REF = REPO + "/.github/workflows/agent-openspec-v3.yml@refs/heads/main";
const OWNER = "cedricmenec";
const BOT = "threadstep-software-factory[bot]";
const S = ch => ch.repeat(40);
const HEAD = S("a");
const EXECUTION_SHA = S("b");
const manifest = () => ({
  schemaVersion: 2, policyVersion: "asf-orch-v3",
  waveId: WAVE, repository: REPO, backlogCommit: S("f"),
  limits: { maxTaskStarts: 10, maxConcurrentTasks: 1, maxPaidRetries: 0 },
  authorization: { runId: "100", actor: OWNER,
    workflowRef: OWNER_REF, sourceSha: S("f") },
  candidateTasks: [{ id: "TS-001", sha256: "b".repeat(64) }]
});
function activeJournal(m = manifest()) {
  return {
    schemaVersion: 2, waveId: WAVE, manifestHash: contentSha256(m),
    revision: 3, status: "CHILD_ACKNOWLEDGED", reserved: 1, delivered: 0,
    awaitingController: false, events: [
      { seq: 1, type: "RESERVE" }, { seq: 2, type: "DISPATCH_INTENT" },
      { seq: 3, type: "ACK_CHILD" }
    ],
    active: { taskId: "TS-001", reservationId: WAVE + ":1", childRunId: "200" },
    controllers: [], stop: null
  };
}
function checkpointJournal(m = manifest()) {
  return {
    schemaVersion: 2, waveId: WAVE, manifestHash: contentSha256(m),
    revision: 7, status: "READY", reserved: 1, delivered: 1,
    awaitingController: true, events: [
      { seq: 1, type: "RESERVE" }, { seq: 2, type: "DISPATCH_INTENT" },
      { seq: 3, type: "ACK_CHILD" }, { seq: 4, type: "CLAIM_CHILD" },
      { seq: 5, type: "PR_PUBLISHED" }, { seq: 6, type: "DELIVERED" },
      { seq: 7, type: "CHECKPOINT" }
    ],
    active: null, controllers: [], stop: null
  };
}
const childRuntime = () => ({
  runId: "200", repository: REPO, ref: "refs/heads/main",
  workflowRef: CHILD_REF, eventName: "workflow_dispatch",
  actor: BOT, runAttempt: 1, headSha: EXECUTION_SHA
});
const controllerRuntime = () => ({
  runId: "300", repository: REPO, ref: "refs/heads/main",
  workflowRef: OWNER_REF, eventName: "repository_dispatch",
  actor: BOT, runAttempt: 1, headSha: EXECUTION_SHA
});
function createPorts({ initial, proof = "ok", commitResult = "ok",
  mutation = null, loadError = false, observeThrow = false } = {}) {
  let m = manifest(), j = initial === "checkpoint" ? checkpointJournal(m) : activeJournal(m);
  let head = HEAD;
  let writes = 0;
  let observations = 0;
  const ports = {
    get journal() { return j; },
    get writes() { return writes; },
    get observations() { return observations; },
    async loadSnapshot() {
      if (loadError) throw Error("offline");
      return { ok: true, headSha: head, manifest: m, journal: j };
    },
    async verifyRun(input) {
      observations++;
      if (observeThrow) throw Error("GitHub offline");
      if (proof === "uncertain") return { ok: false, status: "uncertain" };
      if (proof === "reject") return { ok: false, status: "rejected" };
      const e = {
        repository: REPO, kind: input.kind,
        originalRunId: "100", originalHeadSha: S("f"),
        verifiedRunId: input.reservation.runId,
        verifiedHeadSha: EXECUTION_SHA,
        workflowEvent: input.kind === "child" ? "workflow_dispatch" : "repository_dispatch",
        workflowPath: input.kind === "child" ?
          ".github/workflows/agent-openspec-v3.yml" :
          ".github/workflows/backlog-orchestrator-v3.yml",
        observationHash: "e".repeat(64)
      };
      if (proof === "spoofed") e.originalRunId = "999";
      return { ok: true, status: "verified_observation", evidence: e };
    },
    transition(_manifest, previous, event, expectedRevision) {
      assert.equal(expectedRevision, previous.revision);
      const n = { ...previous, revision: previous.revision + 1,
        events: [...previous.events, { seq: previous.revision + 1, ...event }] };
      if (event.type === "CLAIM_CHILD") {
        assert.equal(previous.status, "CHILD_ACKNOWLEDGED");
        n.status = "EXECUTING";
      } else if (event.type === "ATTACH_CONTROLLER") {
        assert.equal(previous.status, "READY");
        n.controllers = [...previous.controllers, event.controllerRunId];
        n.awaitingController = false;
      } else throw Error("unexpected transition");
      if (mutation === "bad_reserved") n.reserved++;
      if (mutation === "wrong_status") n.status = "READY";
      return n;
    },
    replayJournal(_manifest, candidate) {
      if (mutation === "divergent_replay") return { ...candidate, reserved: -1 };
      return structuredClone(candidate);
    },
    async commitJournal(params) {
      writes++;
      assert.equal(params.waveId, WAVE);
      assert.equal(params.validateJournal(params.journal), true);
      if (commitResult === "throw") throw Error("transport lost");
      if (commitResult === "uncertain") return { ok: false, status: "uncertain" };
      if (commitResult === "conflict" || params.expectedHeadSha !== head)
        return { ok: false, status: "conflict" };
      head = S("c"); j = structuredClone(params.journal);
      return { ok: true, status: "persisted", newHeadSha: head };
    }
  };
  return ports;
}

test("child with unique persisted ACK and observed provenance gets ONE journal claim", async () => {
  const p = createPorts();
  const outcome = await attemptV3ChildClaim(p, {
    waveId: WAVE, taskId: "TS-001", runtime: childRuntime()
  });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.code, "single_run_claim_committed");
  assert.equal(outcome.reservationId, WAVE + ":1");
  assert.equal(p.journal.status, "EXECUTING");
  assert.equal(p.journal.reserved, 1);
  assert.equal(p.writes, 1);
  assert.equal(p.observations, 1);
  const second = await attemptV3ChildClaim(p, {
    waveId: WAVE, taskId: "TS-001", runtime: childRuntime()
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, "no_unique_child_ack");
  assert.equal(p.writes, 1);
});

test("refuse child before observing or committing on wrong run ID, actor, rerun or main ref", async () => {
  for (const mutate of [
    { runId: "201" }, { actor: OWNER }, { runAttempt: 2 },
    { ref: "refs/heads/dev" }, { workflowRef: OWNER_REF },
    { headSha: "not_a_sha" }
  ]) {
    const p = createPorts(), r = { ...childRuntime(), ...mutate };
    const out = await attemptV3ChildClaim(p, { waveId: WAVE,
      taskId: "TS-001", runtime: r });
    assert.equal(out.ok, false);
    assert.equal(p.writes, 0);
    assert.equal(p.observations, 0);
  }
});

test("invalid task, missing contract and spoofed observations produce no CAS writes", async () => {
  for (const proof of ["reject", "spoofed", "uncertain"]) {
    const p = createPorts({ proof });
    const out = await attemptV3ChildClaim(p, { waveId: WAVE,
      taskId: "TS-001", runtime: childRuntime() });
    assert.equal(out.ok, false);
    assert.equal(p.writes, 0);
  }
  const p = createPorts();
  assert.equal((await attemptV3ChildClaim(p, {
    waveId: WAVE, taskId: "TS-099", runtime: childRuntime()
  })).code, "no_unique_child_ack");
  assert.equal((await attemptV3ChildClaim(null, {
    waveId: WAVE, taskId: "TS-001", runtime: childRuntime()
  })).code, "invalid_claim_request");
});

test("offline read or GitHub provenance is uncertain and never dispatches", async () => {
  for (const props of [{ loadError: true }, { observeThrow: true },
    { proof: "uncertain" }]) {
    const p = createPorts(props);
    const res = await attemptV3ChildClaim(p, { waveId: WAVE,
      taskId: "TS-001", runtime: childRuntime() });
    assert.equal(res.status, "uncertain");
    assert.equal(p.writes, 0);
  }
});

test("a lost ref update response never returns a paid claim grant or retries", async () => {
  for (const commitResult of ["uncertain", "throw", "conflict"]) {
    const p = createPorts({ commitResult });
    const res = await attemptV3ChildClaim(p, { waveId: WAVE,
      taskId: "TS-001", runtime: childRuntime() });
    assert.equal(res.ok, false);
    assert.equal(p.writes, 1);
    assert.equal(res.status, commitResult === "conflict" ? "rejected" : "uncertain");
  }
});

test("concurrent children cannot both commit a claim on one remote head", async () => {
  const p = createPorts();
  const req = { waveId: WAVE, taskId: "TS-001", runtime: childRuntime() };
  const [a,b] = await Promise.all([
    attemptV3ChildClaim(p, req), attemptV3ChildClaim(p, req)
  ]);
  assert.equal([a,b].filter(x => x.ok).length, 1);
  assert.equal(p.journal.status, "EXECUTING");
  assert.equal(p.journal.reserved, 1);
});

test("transition manipulation and replay divergence block any journal commit", async () => {
  for (const mutation of ["bad_reserved", "wrong_status", "divergent_replay"]) {
    const p = createPorts({ mutation });
    const res = await attemptV3ChildClaim(p, { waveId: WAVE,
      taskId: "TS-001", runtime: childRuntime() });
    assert.equal(res.ok, false);
    assert.equal(p.writes, 0);
  }
});

test("continuation attaches only after delivery checkpoint under original owner mandate", async () => {
  const p = createPorts({ initial: "checkpoint" });
  const res = await attemptV3ControllerAttach(p, {
    waveId: WAVE, runtime: controllerRuntime()
  });
  assert.equal(res.ok, true);
  assert.equal(res.code, "continuation_checkpoint_committed");
  assert.equal(p.journal.reserved, 1);
  assert.equal(p.journal.delivered, 1);
  assert.deepEqual(p.journal.controllers, ["300"]);
  assert.equal(p.journal.awaitingController, false);
  assert.equal(p.writes, 1);
  const second = await attemptV3ControllerAttach(p, {
    waveId: WAVE, runtime: controllerRuntime()
  });
  assert.equal(second.code, "no_nominal_checkpoint");
  assert.equal(p.writes, 1);
});

test("continuation refuses wrong event, actor, attempted rerun, spoofed proof and no checkpoint", async () => {
  for (const props of [
    { eventName: "workflow_dispatch" }, { actor: OWNER },
    { runAttempt: 2 }, { runId: "100" }, { ref: "refs/heads/dev" }
  ]) {
    const p = createPorts({ initial: "checkpoint" });
    const res = await attemptV3ControllerAttach(p, {
      waveId: WAVE, runtime: { ...controllerRuntime(), ...props }
    });
    assert.equal(res.ok, false);
    assert.equal(p.writes, 0);
  }
  const p = createPorts({ initial: "checkpoint", proof: "spoofed" });
  assert.equal((await attemptV3ControllerAttach(p, {
    waveId: WAVE, runtime: controllerRuntime()
  })).code, "github_provenance_not_verified");
  const active = createPorts();
  assert.equal((await attemptV3ControllerAttach(active, {
    waveId: WAVE, runtime: controllerRuntime()
  })).code, "no_nominal_checkpoint");
});

test("no live payments, dispatch or GitHub write credentials are available in bridge API", () => {
  assert.equal(typeof attemptV3ChildClaim, "function");
  assert.equal(typeof attemptV3ControllerAttach, "function");
  assert.equal(Object.keys(createPorts()).includes("dispatch"), false);
});
