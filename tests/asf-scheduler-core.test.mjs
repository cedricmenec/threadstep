import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DECISION, DEFAULT_POLICY, POLICY_VERSION,
  buildWaveCandidates, classifyEligibility, explainWave, selectNextTask, validateBacklog
} from "../scripts/asf/scheduler/index.mjs";

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

function snapshot(active = [], archive = [], diagnostics = []) {
  return { active, archive, legacy: [], diagnostics };
}

function manifest(cards, { maxTaskStarts = 2, policy } = {}) {
  return {
    schemaVersion: 1,
    waveId: "wave-test-001",
    repository: "example/repo",
    backlogCommit: "0".repeat(40),
    policyVersion: POLICY_VERSION,
    limits: { maxTaskStarts, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    candidateTasks: cards.map(entry => ({ id: entry.id, sha256: entry.content_sha256 })),
    ...(policy ? { policy } : {})
  };
}

function journal({ attempts = [], taskStarts = 0, maxTaskStarts = 2, observedAt } = {}) {
  return {
    attempts,
    quota: { taskStarts, maxTaskStarts },
    ...(observedAt ? { observedAt } : {})
  };
}

function delivered(id) {
  return { [id]: { status: "verified", proof: { pull_request: 7, merge_sha: "a".repeat(40) } } };
}

function evidence({ deliveries = {}, conflicts = {}, ambiguity } = {}) {
  return { deliveries, conflicts, ...(ambiguity === undefined ? {} : { ambiguity }) };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

test("priority is critical > high > normal > low", () => {
  const cards = [
    card("TS-001", { priority: "low" }),
    card("TS-002", { priority: "normal" }),
    card("TS-003", { priority: "high" }),
    card("TS-004", { priority: "critical" })
  ];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence(), journal());
  assert.equal(result.decision, DECISION.SELECT);
  assert.equal(result.taskId, "TS-004");
  assert.ok(result.reason.includes("ready"));
  assert.ok(result.reason.includes("automation_allowed"));
  assert.ok(result.reason.includes("risk_low"));
});

test("equal priority is broken by oldest created_at then canonical id", () => {
  const cards = [
    card("TS-010", { priority: "high", created_at: "2026-10-16" }),
    card("TS-002", { priority: "high", created_at: "2026-10-14" }),
    card("TS-003", { priority: "high", created_at: "2026-10-16" })
  ];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence(), journal());
  assert.equal(result.taskId, "TS-002");
});

test("identical priority and date break by canonical id", () => {
  const cards = [card("TS-020"), card("TS-005")];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence(), journal());
  assert.equal(result.taskId, "TS-005");
});

test("a dependency inside the wave unblocks the dependent after verified delivery", () => {
  const blocker = card("TS-001");
  const dependent = card("TS-002", { priority: "critical", depends_on: ["TS-001"] });
  const cards = [blocker, dependent];
  const frozen = manifest(cards);
  const snap = snapshot(cards);

  const before = selectNextTask(frozen, snap, evidence(), journal());
  assert.equal(before.taskId, "TS-001");

  const after = selectNextTask(frozen, snap, evidence({ deliveries: delivered("TS-001") }),
    journal({ attempts: [{ taskId: "TS-001", status: "succeeded" }] }));
  assert.equal(after.decision, DECISION.SELECT);
  assert.equal(after.taskId, "TS-002");
  assert.ok(after.reason.includes("dependencies_delivered"));
});

test("a delivered dependency outside the wave satisfies the dependent", () => {
  const dependency = card("TS-900");
  const candidate = card("TS-010", { depends_on: ["TS-900"] });
  const snap = snapshot([dependency, candidate]);
  const result = selectNextTask(manifest([candidate]), snap,
    evidence({ deliveries: delivered("TS-900") }), journal());
  assert.equal(result.decision, DECISION.SELECT);
  assert.equal(result.taskId, "TS-010");
  assert.deepEqual(result.references, [{
    dependency: "TS-900",
    delivery: "verified",
    proof: { pull_request: 7, merge_sha: "a".repeat(40) }
  }]);
});

test("an undelivered dependency outside the wave blocks without widening the scope", () => {
  const dependency = card("TS-900");
  const candidate = card("TS-010", { depends_on: ["TS-900"] });
  const snap = snapshot([dependency, candidate]);
  const result = selectNextTask(manifest([candidate]), snap, evidence(), journal());
  assert.equal(result.decision, DECISION.WAITING_DEPENDENCIES);
  assert.equal(result.taskId, undefined);
  assert.deepEqual(result.exclusions, [{ id: "TS-010", reasons: ["dependencies_not_delivered"] }]);
});

test("a delivered task still in backlog/tasks satisfies a dependency without archival", () => {
  const dependency = card("TS-005");
  const candidate = card("TS-010", { depends_on: ["TS-005"] });
  const snap = snapshot([dependency, candidate]);
  assert.equal(snap.archive.length, 0);
  const result = selectNextTask(manifest([candidate]), snap,
    evidence({ deliveries: delivered("TS-005") }), journal());
  assert.equal(result.taskId, "TS-010");
});

test("ordering is stable and reproducible for identical inputs", () => {
  const cards = [card("TS-300"), card("TS-100"), card("TS-200")];
  const frozen = manifest(cards);
  const snap = snapshot(cards);
  const first = selectNextTask(frozen, snap, evidence(), journal());
  const second = selectNextTask(frozen, snap, evidence(), journal());
  assert.deepEqual(first, second);
  assert.equal(first.taskId, "TS-100");
});

test("unknown delivery evidence stops with STOP_UNCERTAIN and no selection", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards), snapshot(cards),
    evidence({ deliveries: { "TS-001": { status: "unknown" } } }), journal());
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
  assert.ok(result.reason.includes("ambiguous_evidence"));
  assert.equal(result.taskId, undefined);
});

test("an aggregate ambiguity flag stops with STOP_UNCERTAIN", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence({ ambiguity: true }), journal());
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
});

test("a divergent content hash stops with STOP_UNCERTAIN", () => {
  const candidate = card("TS-001");
  const frozen = { ...manifest([candidate]), candidateTasks: [{ id: "TS-001", sha256: sha("tampered") }] };
  const result = selectNextTask(frozen, snapshot([candidate]), evidence(), journal());
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
  assert.ok(result.reason.includes("hash_divergence"));
});

test("a missing manifest candidate stops with STOP_UNCERTAIN", () => {
  const candidate = card("TS-001");
  const frozen = { ...manifest([candidate]), candidateTasks: [{ id: "TS-404", sha256: sha("TS-404") }] };
  const result = selectNextTask(frozen, snapshot([candidate]), evidence(), journal());
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
  assert.ok(result.reason.includes("manifest_candidate_missing"));
});

test("an exhausted quota yields QUOTA_REACHED", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards, { maxTaskStarts: 1 }), snapshot(cards), evidence(),
    journal({ taskStarts: 1, maxTaskStarts: 1 }));
  assert.equal(result.decision, DECISION.QUOTA_REACHED);
  assert.ok(result.reason.includes("quota_exhausted"));
});

test("quota is evaluated before attempt failure and evidence ambiguity", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards, { maxTaskStarts: 1 }), snapshot(cards),
    evidence({ ambiguity: true }),
    journal({ taskStarts: 1, maxTaskStarts: 1, attempts: [{ taskId: "TS-001", status: "failed" }] }));
  assert.equal(result.decision, DECISION.QUOTA_REACHED);
});

test("a failed attempt stops the wave", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence(),
    journal({ attempts: [{ taskId: "TS-001", status: "failed" }] }));
  assert.equal(result.decision, DECISION.STOP_FAILED);
  assert.ok(result.reason.includes("attempt_failed"));
});

test("a malformed journal quota fails closed", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence(), {});
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
  assert.ok(result.reason.includes("malformed_quota"));
});

test("malformed evidence fails closed", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards), snapshot(cards),
    evidence({ deliveries: { "TS-001": { status: "maybe" } } }), journal());
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
  assert.ok(result.reason.includes("malformed_evidence"));
});

test("a task added after the snapshot cannot enter the frozen wave", () => {
  const inScope = card("TS-001");
  const newcomer = card("TS-002", { priority: "critical" });
  const result = selectNextTask(manifest([inScope]), snapshot([inScope, newcomer]), evidence(), journal());
  assert.equal(result.taskId, "TS-001");
});

test("an already delivered candidate is not selected again", () => {
  const cards = [card("TS-001")];
  const result = selectNextTask(manifest(cards), snapshot(cards),
    evidence({ deliveries: delivered("TS-001") }), journal());
  assert.equal(result.decision, DECISION.NO_WORK);
  assert.deepEqual(result.exclusions, [{ id: "TS-001", reasons: ["already_delivered"] }]);
});

test("an attempted candidate is not selected again and a conflicting one is blocked", () => {
  const cards = [card("TS-001", { priority: "critical" }), card("TS-002"), card("TS-003")];
  const result = selectNextTask(manifest(cards), snapshot(cards),
    evidence({ conflicts: { "TS-002": { status: "conflict" } } }),
    journal({ attempts: [{ taskId: "TS-001", status: "executing" }] }));
  assert.equal(result.taskId, "TS-003");
  assert.ok(result.exclusions.some(entry => entry.id === "TS-002" && entry.reasons.includes("blocked")));
  assert.ok(result.exclusions.some(entry => entry.id === "TS-001" && entry.reasons.includes("already_attempted")));
});

test("buildWaveCandidates excludes non product, manual, higher risk and not-ready tasks", () => {
  const cards = [
    card("TS-001"),
    card("TS-002", { type: "factory" }),
    card("TS-003", { automation: "manual" }),
    card("TS-004", { risk: "medium" }),
    card("TS-005", { status: "proposed" })
  ];
  const result = buildWaveCandidates(snapshot(cards));
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidateTasks.map(entry => entry.id), ["TS-001"]);
  assert.ok(result.candidateTasks[0].sha256 === sha("TS-001"));
  const reasons = Object.fromEntries(result.excluded.map(entry => [entry.id, entry.reasons]));
  assert.ok(reasons["TS-002"].includes("type_not_product"));
  assert.ok(reasons["TS-003"].includes("manual_only"));
  assert.ok(reasons["TS-004"].includes("risk_medium"));
  assert.ok(reasons["TS-005"].includes("status_proposed"));
});

test("buildWaveCandidates refuses an invalid snapshot instead of guessing", () => {
  const result = buildWaveCandidates(snapshot([card("TS-001", { depends_on: ["TS-999"] })]));
  assert.equal(result.ok, false);
  assert.deepEqual(result.candidateTasks, []);
  assert.ok(result.errors.some(error => error.code === "unknown_dependency"));
});

test("classifyEligibility exposes stable reasons and exclusions", () => {
  const task = card("TS-001", { depends_on: ["TS-900"] });
  const snap = snapshot([task, card("TS-900")]);
  const blocked = classifyEligibility(task, snap, evidence(), DEFAULT_POLICY);
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.exclusions.includes("dependencies_not_delivered"));
  const ready = classifyEligibility(task, snap, evidence({ deliveries: delivered("TS-900") }), DEFAULT_POLICY);
  assert.equal(ready.eligible, true);
  assert.ok(ready.reasons.includes("dependencies_delivered"));
});

test("validateBacklog fails closed on duplicates, unknown refs and cycles", () => {
  const duplicate = validateBacklog(snapshot([card("TS-001"), card("TS-001")]));
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some(error => error.code === "duplicate_id"));

  const unknown = validateBacklog(snapshot([card("TS-001", { depends_on: ["TS-999"] })]));
  assert.ok(unknown.errors.some(error => error.code === "unknown_dependency"));

  const selfDependency = validateBacklog(snapshot([card("TS-001", { depends_on: ["TS-001"] })]));
  assert.ok(selfDependency.errors.some(error => error.code === "self_dependency"));

  const cycle = validateBacklog(snapshot([
    card("TS-001", { depends_on: ["TS-002"] }),
    card("TS-002", { depends_on: ["TS-001"] })
  ]));
  assert.ok(cycle.errors.some(error => error.code === "dependency_cycle"));
});

test("selectNextTask stops when the backlog projection is invalid", () => {
  const cards = [card("TS-001", { depends_on: ["TS-999"] })];
  const result = selectNextTask(manifest(cards), snapshot(cards), evidence(), journal());
  assert.equal(result.decision, DECISION.STOP_UNCERTAIN);
  assert.ok(result.reason.includes("invalid_backlog"));
  assert.ok(result.reason.includes("unknown_dependency"));
});

test("index diagnostics invalidate the snapshot", () => {
  const snap = snapshot([card("TS-001")], [], [{ path: "backlog/x", message: "boom" }]);
  const validation = validateBacklog(snap);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(error => error.code === "index_diagnostic"));
});

test("observedAt is injected by the adapter and never invented", () => {
  const cards = [card("TS-001")];
  const without = selectNextTask(manifest(cards), snapshot(cards), evidence(), journal());
  assert.equal(without.observedAt, null);
  const withTime = selectNextTask(manifest(cards), snapshot(cards), evidence(),
    journal({ observedAt: "2026-10-16T00:00:00Z" }));
  assert.equal(withTime.observedAt, "2026-10-16T00:00:00Z");
});

test("explainWave reports the deterministic order without selecting for execution", () => {
  const cards = [
    card("TS-001", { priority: "normal" }),
    card("TS-002", { priority: "critical" }),
    card("TS-003", { priority: "high" })
  ];
  const result = explainWave(manifest(cards), snapshot(cards), evidence(), journal());
  assert.equal(result.decision, DECISION.SELECT);
  assert.equal(result.selected, "TS-002");
  assert.deepEqual(result.order.map(entry => entry.id), ["TS-002", "TS-003", "TS-001"]);
});

test("pure functions decide on 100 tasks without mutation and deterministically", () => {
  const cards = [];
  for (let index = 1; index <= 100; index++) {
    const id = "TS-" + String(index).padStart(3, "0");
    cards.push(card(id, {
      priority: index % 4 === 0 ? "critical" : "normal",
      created_at: "2026-10-1" + (index % 9)
    }));
  }
  const snap = deepFreeze(snapshot(cards));
  const frozen = deepFreeze(manifest(cards));
  const ev = deepFreeze(evidence());
  const jr = deepFreeze(journal());

  const first = selectNextTask(frozen, snap, ev, jr);
  const second = selectNextTask(frozen, snap, ev, jr);
  assert.deepEqual(first, second);
  assert.equal(first.decision, DECISION.SELECT);

  const exhausted = selectNextTask(frozen, snap, ev,
    journal({ attempts: cards.map(entry => ({ taskId: entry.id, status: "succeeded" })) }));
  assert.equal(exhausted.decision, DECISION.NO_WORK);
});

test("the scheduler core performs no I/O, network or clock access", () => {
  const source = readFileSync(new URL("../scripts/asf/scheduler/core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']node:(fs|child_process|http|https|net|dns|os)["']/);
  assert.doesNotMatch(source, /\brequire\s*\(/);
  assert.doesNotMatch(source, /new Date\b/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
