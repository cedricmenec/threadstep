import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DECISION, DEFAULT_POLICY, POLICY_VERSION, buildWaveCandidates, selectNextTask
} from "../scripts/asf/scheduler/index.mjs";
import { FIXTURE_NAMES, loadFixture } from "../scripts/asf/scheduler/fixtures.mjs";
import {
  DEFAULT_MAX_TASKS, MAX_TASKS_LIMIT, buildDryRunReport, formatHumanReport, loadScenario, parseArgs
} from "../scripts/asf/scheduler/dry-run.mjs";

const CLI = fileURLToPath(new URL("../scripts/asf/scheduler/dry-run.mjs", import.meta.url));

function coreDecision(scenario, maxTasks = DEFAULT_MAX_TASKS) {
  const candidates = buildWaveCandidates(scenario.snapshot, DEFAULT_POLICY);
  const manifest = {
    schemaVersion: 1,
    waveId: "dry-run-test",
    policyVersion: POLICY_VERSION,
    limits: { maxTaskStarts: maxTasks, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    candidateTasks: candidates.candidateTasks,
    policy: DEFAULT_POLICY
  };
  const journal = {
    attempts: scenario.journal?.attempts ?? [],
    quota: { taskStarts: 0, maxTaskStarts: maxTasks },
    ...(scenario.observedAt ? { observedAt: scenario.observedAt } : {})
  };
  return selectNextTask(manifest, scenario.snapshot, scenario.evidence ?? {}, journal);
}

test("an empty backlog ends with NO_WORK and zero dispatch", () => {
  const report = buildDryRunReport(loadFixture("empty"));
  assert.equal(report.decision.decision, DECISION.NO_WORK);
  assert.equal(report.dispatchCount, 0);
  assert.equal(report.writesJournal, false);
  assert.deepEqual(report.candidates, []);
  assert.deepEqual(report.order, []);
  assert.equal(report.projection, null);
});

test("every fixture explains the same decision as the scheduler core", () => {
  for (const name of FIXTURE_NAMES) {
    const scenario = loadFixture(name);
    const report = buildDryRunReport(scenario);
    const expected = coreDecision(scenario);
    assert.equal(report.decision.decision, expected.decision, name);
    assert.equal(report.decision.taskId, expected.taskId ?? null, name);
    assert.equal(report.dispatchCount, 0, name);
    assert.equal(report.writesJournal, false, name);
  }
});

test("priority fixture selects the critical candidate and lists the order", () => {
  const report = buildDryRunReport(loadFixture("priority"));
  assert.equal(report.decision.decision, DECISION.SELECT);
  assert.equal(report.decision.taskId, "TS-004");
  assert.deepEqual(report.order.map(entry => entry.id), ["TS-004", "TS-003", "TS-002", "TS-001"]);
  assert.deepEqual(report.candidates.map(candidate => candidate.priority),
    ["low", "normal", "high", "critical"]);
});

test("a verified dependency delivery is distinguished from an unobserved one", () => {
  const report = buildDryRunReport(loadFixture("dependency-verified"));
  assert.equal(report.decision.decision, DECISION.SELECT);
  assert.equal(report.decision.taskId, "TS-002");
  assert.deepEqual(report.evidence.verified, ["TS-001"]);
  const dependent = report.candidates.find(candidate => candidate.id === "TS-002");
  assert.deepEqual(dependent.dependencies, [{
    id: "TS-001", delivery: "verified", hypothetical_delivery: false
  }]);
  assert.ok(report.decision.reason.includes("dependencies_delivered"));
});

test("an unavailable GitHub delivery state is uncertain, never presumed free", () => {
  const report = buildDryRunReport(loadFixture("dependency-unknown"));
  assert.equal(report.decision.decision, DECISION.STOP_UNCERTAIN);
  assert.equal(report.decision.taskId, null);
  assert.ok(report.decision.reason.includes("ambiguous_evidence"));
  assert.deepEqual(report.evidence.unknown, ["TS-001"]);
});

test("backlog mode without evidence fails closed for actionable candidates", () => {
  const scenario = loadFixture("dependency-verified");
  const report = buildDryRunReport({ ...scenario, evidence: {}, evidenceAvailable: false, source: "backlog" });
  assert.equal(report.decision.decision, DECISION.STOP_UNCERTAIN);
  assert.equal(report.dispatchCount, 0);
  assert.ok(report.notes.some(note => note.includes("GitHub indisponible")));
});

test("a hypothetical assumption produces a separate projection, not a proof", () => {
  const report = buildDryRunReport(loadFixture("dependency-pending"));
  assert.equal(report.decision.decision, DECISION.WAITING_DEPENDENCIES);
  assert.equal(report.projection.hypothetical, true);
  assert.deepEqual(report.projection.assumptions, ["TS-001"]);
  assert.equal(report.projection.decision, DECISION.SELECT);
  assert.equal(report.projection.selected, "TS-002");
  const dependent = report.candidates.find(candidate => candidate.id === "TS-002");
  assert.equal(dependent.dependencies[0].hypothetical_delivery, true);
  assert.ok(report.notes.some(note => note.includes("n'est pas une preuve")));
});

test("a delivery confirmed while the file stays active satisfies the dependency", () => {
  const report = buildDryRunReport(loadFixture("delivered-not-archived"));
  assert.equal(report.decision.decision, DECISION.SELECT);
  assert.equal(report.decision.taskId, "TS-010");
});

test("reports are deterministic and deep-frozen", () => {
  const scenario = loadFixture("dependency-pending");
  const first = buildDryRunReport(scenario);
  const second = buildDryRunReport(scenario);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.candidates[0].eligibility), true);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("max-tasks bounds the wave limit and rejects out-of-range values", () => {
  assert.equal(MAX_TASKS_LIMIT, 2);
  assert.equal(parseArgs(["dry-run"]).maxTasks, DEFAULT_MAX_TASKS);
  assert.equal(parseArgs(["dry-run", "--max-tasks", "2"]).maxTasks, 2);
  assert.throws(() => parseArgs(["dry-run", "--max-tasks", "0"]), /between 1 and 2/);
  assert.throws(() => parseArgs(["dry-run", "--max-tasks", "3"]), /between 1 and 2/);
  assert.throws(() => parseArgs(["dry-run", "--max-tasks", "x"]), /between 1 and 2/);
});

test("parseArgs rejects unknown flags and conflicting sources", () => {
  assert.throws(() => parseArgs(["execute"]), /Usage/);
  assert.throws(() => parseArgs(["dry-run", "--nope"]), /Unknown argument/);
  assert.throws(() => parseArgs(["dry-run", "--fixture", "empty", "--backlog", "."]), /not both/);
  assert.throws(() => parseArgs(["dry-run", "--format", "yaml"]), /json or human/);
});

test("loadScenario resolves built-in fixtures with explicit evidence", () => {
  const scenario = loadScenario(parseArgs(["dry-run", "--fixture", "dependency-verified"]));
  assert.equal(scenario.source, "fixture:dependency-verified");
  assert.equal(scenario.evidenceAvailable, true);
  assert.equal(scenario.snapshot.active.length, 2);
  assert.equal(scenario.evidence.deliveries["TS-001"].status, "verified");
});

test("the human report exposes decision, candidates and the projection warning", () => {
  const scenario = loadFixture("dependency-pending");
  const text = formatHumanReport(buildDryRunReport(scenario));
  assert.match(text, /Décision : WAITING_DEPENDENCIES/);
  assert.match(text, /Dispatch : 0/);
  assert.match(text, /TS-002/);
  assert.match(text, /Projection hypothétique/);
  assert.match(text, /NON une preuve de livraison/);
});

test("the CLI emits parseable JSON and never dispatches", () => {
  const output = execFileSync("node", [CLI, "dry-run", "--fixture", "empty", "--format", "json"],
    { encoding: "utf8" });
  const report = JSON.parse(output);
  assert.equal(report.decision.decision, "NO_WORK");
  assert.equal(report.dispatchCount, 0);
  assert.equal(report.writesJournal, false);
});

test("the CLI refuses an out-of-range task limit", () => {
  const result = spawnSync("node", [CLI, "dry-run", "--max-tasks", "9"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /max-tasks must be an integer between 1 and 2/);
});

test("the dry-run and fixtures modules perform no write, paid call or network access", () => {
  for (const file of ["dry-run.mjs", "fixtures.mjs"]) {
    const source = readFileSync(new URL("../scripts/asf/scheduler/" + file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /writeFileSync|appendFileSync|createWriteStream|rmSync|unlinkSync/, file);
    assert.doesNotMatch(source, /from\s+["']node:(child_process|http|https|net|dns)["']/, file);
    assert.doesNotMatch(source, /\bfetch\s*\(/, file);
    assert.doesNotMatch(source, /openrouter|OPENROUTER/, file);
    assert.doesNotMatch(source, /Math\.random/, file);
    assert.doesNotMatch(source, /new Date\b/, file);
  }
});
