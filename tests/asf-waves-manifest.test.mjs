import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  MANIFEST_SCHEMA_VERSION, MODEL_ALLOWLIST, ORCHESTRATOR_POLICY_VERSION,
  createWaveManifest, validateWaveManifest, hashWaveManifest
} from "../scripts/asf/waves/index.mjs";

function sha(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function input(overrides = {}) {
  const base = {
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
    limits: { maxTaskStarts: 2, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    autoMerge: true,
    candidateTasks: [
      { id: "TS-012", sha256: sha("TS-012") },
      { id: "TS-013", sha256: sha("TS-013") }
    ],
    authorization: { parentRunId: 123, reference: "wave-authorization:123" }
  };
  return { ...base, ...overrides };
}

function codes(report) {
  return report.errors.map(error => error.code);
}

test("createWaveManifest freezes the manifest and returns a stable content hash", () => {
  const created = createWaveManifest(input());
  assert.equal(created.ok, true);
  assert.equal(created.errors.length, 0);
  const manifest = created.manifest;
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.limits), true);
  assert.equal(Object.isFrozen(manifest.candidateTasks), true);
  assert.equal(Object.isFrozen(manifest.candidateTasks[0]), true);
  assert.equal(Object.isFrozen(manifest.authorization), true);
  assert.equal(hashWaveManifest(manifest), created.manifestHash);
  assert.throws(() => { manifest.waveId = "wave-other"; }, TypeError);
  assert.throws(() => { manifest.candidateTasks.push({ id: "TS-099", sha256: sha("x") }); }, TypeError);
});

test("key insertion order never changes the manifest hash", () => {
  const base = input();
  const reordered = {
    authorization: base.authorization,
    candidateTasks: base.candidateTasks,
    autoMerge: base.autoMerge,
    limits: base.limits,
    model: base.model,
    phase: base.phase,
    executor: base.executor,
    mode: base.mode,
    policyVersion: base.policyVersion,
    backlogCommit: base.backlogCommit,
    authorizedBy: base.authorizedBy,
    repository: base.repository,
    waveId: base.waveId,
    schemaVersion: base.schemaVersion
  };
  const a = createWaveManifest(base);
  const b = createWaveManifest(reordered);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.manifestHash, b.manifestHash);
});

test("the manifest hash changes when a candidate definition changes", () => {
  const first = createWaveManifest(input());
  const second = createWaveManifest(input({
    candidateTasks: [
      { id: "TS-012", sha256: sha("TS-012-changed") },
      { id: "TS-013", sha256: sha("TS-013") }
    ]
  }));
  assert.notEqual(first.manifestHash, second.manifestHash);
});

test("validateWaveManifest rejects malformed authorization fields", () => {
  const cases = [
    ["unsupported_schema", { schemaVersion: 99 }],
    ["unsafe_wave_id", { waveId: "Wave Test!" }],
    ["invalid_repository", { repository: "threadstep" }],
    ["invalid_source_sha", { backlogCommit: "abc" }],
    ["invalid_mode", { mode: "launch" }],
    ["invalid_executor", { executor: "direct" }],
    ["invalid_phase", { phase: "ship" }],
    ["model_not_allowed", { model: "openrouter/evil/model" }],
    ["invalid_auto_merge", { autoMerge: "yes" }],
    ["invalid_max_tasks", { limits: { maxTaskStarts: 0, maxConcurrentTasks: 1, maxPaidRetries: 0 } }],
    ["invalid_max_tasks", { limits: { maxTaskStarts: 3, maxConcurrentTasks: 1, maxPaidRetries: 0 } }],
    ["invalid_concurrency", { limits: { maxTaskStarts: 2, maxConcurrentTasks: 2, maxPaidRetries: 0 } }],
    ["invalid_retries", { limits: { maxTaskStarts: 2, maxConcurrentTasks: 1, maxPaidRetries: 1 } }],
    ["invalid_parent_run", { authorization: { parentRunId: 0, reference: "run" } }],
    ["missing_reference", { authorization: { parentRunId: 1 } }],
    ["invalid_hash", { candidateTasks: [{ id: "TS-012", sha256: "not-a-hash" }] }],
    ["unsafe_id", { candidateTasks: [{ id: "task-012", sha256: sha("x") }] }]
  ];
  for (const [code, override] of cases) {
    const report = validateWaveManifest(input(override));
    assert.equal(report.ok, false, code);
    assert.ok(codes(report).includes(code), code + " not reported: " + JSON.stringify(codes(report)));
  }
});

test("duplicate candidate ids are rejected", () => {
  const report = validateWaveManifest(input({
    candidateTasks: [
      { id: "TS-012", sha256: sha("a") },
      { id: "TS-012", sha256: sha("b") }
    ]
  }));
  assert.ok(codes(report).includes("duplicate_candidate"));
});

test("unknown manifest, limits, authorization and candidate fields are rejected", () => {
  const withUnknown = validateWaveManifest(input({ extraField: "x" }));
  assert.ok(codes(withUnknown).includes("unknown_field"));

  const unknownLimits = validateWaveManifest(input({
    limits: { maxTaskStarts: 2, maxConcurrentTasks: 1, maxPaidRetries: 0, maxCost: 5 }
  }));
  assert.ok(codes(unknownLimits).includes("unknown_field"));

  const unknownAuth = validateWaveManifest(input({
    authorization: { parentRunId: 1, reference: "run", actor: "someone" }
  }));
  assert.ok(codes(unknownAuth).includes("unknown_field"));

  const unknownCandidate = validateWaveManifest(input({
    candidateTasks: [{ id: "TS-012", sha256: sha("a"), title: "x" }]
  }));
  assert.ok(codes(unknownCandidate).includes("unknown_field"));
});

test("secret-looking authorization references are rejected without echoing the secret", () => {
  const secret = "ghp_" + "a".repeat(30);
  const report = validateWaveManifest(input({
    authorization: { parentRunId: 1, reference: secret }
  }));
  assert.ok(codes(report).includes("secret_detected"));
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(secret), false);
});

test("createWaveManifest never returns a manifest when validation fails", () => {
  const created = createWaveManifest(input({ mode: "launch" }));
  assert.equal(created.ok, false);
  assert.equal(created.manifest, null);
  assert.equal(created.manifestHash, null);
});

test("the manifest module performs no I/O, network access or clock reads", () => {
  const source = readFileSync(new URL("../scripts/asf/waves/manifest.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']node:(fs|child_process|http|https|net|dns|os)["']/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bnew Date\b/);
  assert.doesNotMatch(source, /Math\.random/);
});
