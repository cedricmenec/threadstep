import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  createAdmissionRegistry, advanceAdmissionRegistry, replayAdmissionRegistry,
  admissionRegistryHash, decideV3WaveAdmission, ADMISSION_REGISTRY_REF
} from "../scripts/asf/v3/global-admission.mjs";
import {
  auditPaidWorkflowMutex, ASF_PAID_MUTEX, evaluateProposedV3PaidJob
} from "../scripts/asf/v3/paid-mutex-audit.mjs";
import { assessV3GenesisCandidate, GENESIS_DECISION }
  from "../scripts/asf/v3/bootstrap-evidence.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";

const D = c => c.repeat(64), S = c => c.repeat(40);
const claim = (id = "wave-001") => ({
  waveId: id, manifestHash: D("a"), ownerRunId: "100", originSha: S("b")
});
const apply = (journal, event, revision = journal.revision) =>
  advanceAdmissionRegistry(journal, event, revision);
const err = (fn, code) => assert.throws(fn, e => e?.code === code);
const terminal = (id = "wave-001", status = "COMPLETED_QUOTA") => ({
  status, journalHash: D("b"), waveId: id,
  manifestHash: D("a"), reserved: 10,
  delivered: 10, maxTaskStarts: 10
});

test("global ref is distinct from per-wave journal; registry starts free", () => {
  const r = createAdmissionRegistry();
  assert.equal(ADMISSION_REGISTRY_REF, "refs/heads/asf/control/active-wave-v3");
  assert.equal(r.revision, 0);
  assert.equal(decideV3WaveAdmission(r), "REQUIRE_TRUSTED_OWNER_GENESIS_AND_GLOBAL_CAS");
  assert.ok(Object.isFrozen(r));
  assert.match(admissionRegistryHash(r), /^[a-f0-9]{64}$/);
});
test("one wave ADMIT globally blocks all other waves and replay is immutable", () => {
  const empty = createAdmissionRegistry();
  const a = apply(empty, { type: "ADMIT", claim: claim() });
  assert.equal(a.state, "ACTIVE");
  assert.equal(a.history.length, 1);
  assert.equal(decideV3WaveAdmission(a), "BLOCK_ANOTHER_WAVE");
  err(() => apply(a, { type: "ADMIT", claim: claim("wave-002") }),
    "wave_admission_blocked");
  err(() => apply(a, { type: "ADMIT", claim: claim() }),
    "wave_admission_blocked");
  assert.equal(empty.state, "AVAILABLE");
  assert.equal(replayAdmissionRegistry(JSON.parse(JSON.stringify(a))).revision, 1);
});
test("only terminal completion can release; no quota inflation or wrong manifest", () => {
  const a = apply(createAdmissionRegistry(), { type: "ADMIT", claim: claim() });
  for (const t of [
    { ...terminal(), status: "STOP_UNCERTAIN" },
    { ...terminal(), status: "STOP_FAILED" },
    { ...terminal(), status: "EXECUTING" },
    { ...terminal(), delivered: 11 },
    { ...terminal(), reserved: 11 },
    { ...terminal(), reserved: 9, delivered: 9 },
    { ...terminal(), manifestHash: D("d") },
    { ...terminal(), journalHash: "not-hex" },
    { ...terminal(), maxTaskStarts: 11 }
  ]) err(() => apply(a, { type: "RELEASE",
    waveId: "wave-001", manifestHash: D("a"), terminal: t }),
    "invalid_terminal_evidence");
  const b = apply(a, { type: "RELEASE",
    waveId: "wave-001", manifestHash: D("a"), terminal: terminal() });
  assert.equal(b.state, "AVAILABLE");
  assert.equal(b.active, null);
  assert.equal(b.history.length, 1);
  err(() => apply(b, { type: "ADMIT", claim: claim() }), "wave_id_reused");
  const c = apply(b, { type: "ADMIT", claim: claim("wave-002") });
  assert.equal(c.active.waveId, "wave-002");
  assert.equal(c.history.length, 2);
  assert.equal(replayAdmissionRegistry(JSON.parse(JSON.stringify(c))).revision, 3);
});
test("quarantine preserves wave identity and blocks all automatic release", () => {
  let j = apply(createAdmissionRegistry(), { type: "ADMIT", claim: claim() });
  j = apply(j, { type: "QUARANTINE",
    waveId: "wave-001", reason: "ambiguous_dispatch_outcome" });
  assert.equal(j.state, "QUARANTINED");
  assert.equal(j.active.waveId, "wave-001");
  assert.equal(decideV3WaveAdmission(j), "BLOCK_UNTIL_OWNER_DIAGNOSIS");
  err(() => apply(j, { type: "RELEASE",
    waveId: "wave-001", manifestHash: D("a"), terminal: terminal() }),
    "wrong_release_target");
  err(() => apply(j, { type: "ADMIT", claim: claim("wave-002") }),
    "wave_admission_blocked");
  const noted = apply(j, { type: "DIAGNOSTIC_NOTE", waveId: "wave-001",
    reason: "owner_review_required" });
  assert.equal(noted.state, "QUARANTINED");
  assert.equal(noted.active.waveId, "wave-001");
});
test("race of two independent clients needs remote CAS in addition to revision", () => {
  const genesis = createAdmissionRegistry();
  const a = apply(genesis, { type: "ADMIT", claim: claim("wave-001") });
  const b = apply(genesis, { type: "ADMIT", claim: claim("wave-002") });
  // Both would pass local revision 0. The only safe persistence is ONE
  // global Git ref with remote commit SHA CAS, not two per-wave refs.
  assert.equal(a.revision, 1);
  assert.equal(b.revision, 1);
  assert.notEqual(admissionRegistryHash(a), admissionRegistryHash(b));
  err(() => apply(a, { type: "DIAGNOSTIC_NOTE", waveId: "wave-001",
    reason: "test" }, 0), "revision_conflict");
});
test("tampering with the registry, sequence, history and secrets fails replay", () => {
  const a = apply(createAdmissionRegistry(), { type: "ADMIT", claim: claim() });
  err(() => replayAdmissionRegistry({ ...a, state: "AVAILABLE" }), "registry_replay_divergence");
  err(() => replayAdmissionRegistry({ ...a, history: [] }), "registry_replay_divergence");
  err(() => replayAdmissionRegistry({
    ...a, events: a.events.map(e => ({ ...e, seq: 2 }))
  }), "event_sequence_corrupted");
  err(() => apply(createAdmissionRegistry(), {
    type: "ADMIT", claim: { ...claim(), diagnostic: "ghp_" + "A".repeat(27) }
  }), "invalid_fields");
  err(() => apply(createAdmissionRegistry(), {
    type: "ADMIT", claim: { ...claim(), manifestHash: "ghp_" + "A".repeat(27) }
  }), "invalid_wave_claim");
});
test("malformed admission target and terminal cannot silently switch wave", () => {
  const a = apply(createAdmissionRegistry(), { type: "ADMIT", claim: claim() });
  err(() => apply(a, { type: "RELEASE",
    waveId: "wave-002", manifestHash: D("a"), terminal: terminal() }),
  "wrong_release_target");
  err(() => apply(a, { type: "RELEASE",
    waveId: "wave-001", manifestHash: D("c"), terminal: terminal() }),
  "wrong_release_target");
  err(() => apply(a, { type: "QUARANTINE",
    waveId: "wave-002", reason: "failed" }), "wrong_quarantine_target");
});

function getWorkflows() {
  const folder = new URL("../.github/workflows/", import.meta.url);
  const names = readdirSync(folder).filter(x => /\.ya?ml$/.test(x));
  const files = {};
  const paths = [];
  for (const name of names) {
    const path = ".github/workflows/" + name;
    files[path] = readFileSync(new URL(name, folder), "utf8");
    paths.push(path);
  }
  return { files, paths };
}
test("audit all checked-in workflows: every V1 paid job shares one exclusive lock", () => {
  const { files, paths } = getWorkflows();
  const res = auditPaidWorkflowMutex(files, paths);
  assert.deepEqual(res.violations, []);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.deepEqual(res.paidJobs, [
    ".github/workflows/agent-asf.yml#develop",
    ".github/workflows/agent-openspec.yml#staged-development",
    ".github/workflows/agent.yml#develop"
  ]);
  assert.equal(res.group, ASF_PAID_MUTEX);
});
test("fail closed when a paid job changes its lock, cancellation or lock indentation", () => {
  const originals = getWorkflows();
  const path = ".github/workflows/agent-openspec.yml";
  const source = originals.files[path];
  for (const changed of [
    source.replace("group: threadstep-paid-development-v1",
      "group: other-paid-v3"),
    source.replace("cancel-in-progress: false", "cancel-in-progress: true"),
    source.replace("    concurrency:\n      group:",
      "    # deleted lock\n    another:\n      group:"),
    source.replace("      group: threadstep-paid-development-v1",
      "        group: threadstep-paid-development-v1")
  ]) {
    const files = { ...originals.files, [path]: changed };
    const a = auditPaidWorkflowMutex(files, originals.paths);
    assert.equal(a.ok, false, JSON.stringify(a));
    assert.ok(a.violations.some(x => x.includes("missing_or_unsafe_paid_mutex")));
  }
});
test("audit refuses incomplete workflow inventory and unknown paid secret outside jobs", () => {
  const w = getWorkflows();
  const subset = { ...w.files };
  delete subset[".github/workflows/agent-asf.yml"];
  assert.equal(auditPaidWorkflowMutex(subset, w.paths).ok, false);
  const bad = { ...w.files, ".github/workflows/extra.yml":
    "name: Bad\nOPENROUTER_API_KEY: fake\njobs:\n  check:\n    runs-on: ubuntu-latest\n" };
  const result = auditPaidWorkflowMutex(bad, [...w.paths, ".github/workflows/extra.yml"]);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(x => x.includes("unscoped_paid_secret")));
});
test("future V3 paid job contract requires existing V1 lock plus paid preflight", () => {
  const ok = { workflow: ".github/workflows/agent-openspec-v3.yml",
    job: "staged-development", mutex: ASF_PAID_MUTEX,
    cancelInProgress: false, prePaidClaim: true,
    runAttemptOne: true, noAutoPaidRetry: true,
    globalWaveAdmission: true };
  const accepted = evaluateProposedV3PaidJob(ok);
  assert.equal(accepted.ok, true);
  assert.match(accepted.decision, /STATIC_CONTRACT_ONLY/);
  for (const changes of [
    { mutex: "other" }, { cancelInProgress: true },
    { prePaidClaim: false }, { runAttemptOne: false },
    { noAutoPaidRetry: false }, { globalWaveAdmission: false },
    { workflow: ".github/workflows/agent-openspec.yml" }
  ]) assert.equal(evaluateProposedV3PaidJob({ ...ok, ...changes }).ok, false);
});

const m = () => ({
  schemaVersion: 2, policyVersion: "asf-orch-v3",
  waveId: "wave-001", repository: "cedricmenec/threadstep",
  backlogCommit: S("a"),
  authorization: { runId: "100", actor: "cedricmenec",
    workflowRef: "cedricmenec/threadstep/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
    sourceSha: S("a") }
});
const origin = () => ({
  id: 100, repository: { full_name: "cedricmenec/threadstep" },
  actor: { login: "cedricmenec" },
  path: ".github/workflows/backlog-orchestrator-v3.yml",
  event: "workflow_dispatch", run_attempt: 1,
  head_branch: "main", head_sha: S("a"), status: "in_progress",
  conclusion: null
});
const genesis = manifest => ({
  sha: S("b"), ref: "refs/heads/asf/waves/wave-001",
  manifestHash: contentSha256(manifest),
  parents: [S("a")], paths: ["manifest.json", "journal.json"]
});
test("matching owner run and genesis files NEVER become a paid authorization", () => {
  const manifest = m();
  const r = assessV3GenesisCandidate({
    manifest, originRun: origin(), genesis: genesis(manifest)
  });
  assert.equal(r.ok, false);
  assert.equal(r.decision, GENESIS_DECISION.CONSISTENT_BUT_UNANCHORED);
  assert.equal(r.next, "REQUIRE_INDEPENDENT_TRUSTED_GENESIS_ANCHOR");
  assert.equal(r.evidence.ownerRunId, "100");
});
test("genesis mismatched run actor, source SHA, rerun or branch is refused", () => {
  const manifest = m();
  for (const mutated of [
    { actor: { login: "attacker" } },
    { head_sha: S("c") },
    { run_attempt: 2 },
    { head_branch: "feature" },
    { status: "completed", conclusion: "failure" }
  ]) {
    const out = assessV3GenesisCandidate({
      manifest, originRun: { ...origin(), ...mutated },
      genesis: genesis(manifest)
    });
    assert.equal(out.decision, "REJECT");
  }
  for (const mutated of [
    { manifestHash: D("c") },
    { ref: "refs/heads/main" },
    { parents: [] },
    { paths: ["manifest.json"] }
  ]) assert.equal(assessV3GenesisCandidate({
    manifest, originRun: origin(), genesis: { ...genesis(manifest), ...mutated }
  }).decision, "REJECT");
});
