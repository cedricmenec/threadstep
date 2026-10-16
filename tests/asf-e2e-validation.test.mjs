import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SCENARIO_NAMES, SCENARIO_BUILDERS, runE2eValidation, formatE2eReport, FIXED_AT
} from "../scripts/asf/fixtures/e2e.mjs";

const source = readFileSync(new URL("../scripts/asf/fixtures/e2e.mjs", import.meta.url), "utf8");

test("the deterministic recette runs all six scenarios and passes", () => {
  const report = runE2eValidation();
  assert.equal(report.ok, true, "failed scenarios: " + report.failed.join(", "));
  assert.equal(report.scenarioCount, 6);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(
    report.scenarios.map(entry => entry.id),
    ["empty-backlog", "dependency-unblocks", "crash-windows", "red-ci", "two-task-wave", "concurrent-access"]
  );
  for (const entry of report.scenarios) {
    assert.equal(entry.passed, true, entry.id + ": " + JSON.stringify(entry.checks));
    assert.ok(entry.checks.every(single => single.passed), entry.id);
  }
});

test("the recette never spends, dispatches or writes", () => {
  const report = runE2eValidation();
  assert.equal(report.paidCalls, 0);
  assert.equal(report.dispatches, 0);
  assert.equal(report.generatedAt, null);
  assert.equal(report.mode, "recette-simulee");
  assert.equal(Object.isFrozen(report), true);
});

test("empty backlog terminates NO_WORK with no reservation", () => {
  const report = runE2eValidation();
  const scenario = report.scenarios.find(entry => entry.id === "empty-backlog");
  const byName = Object.fromEntries(scenario.checks.map(entry => [entry.name, entry]));
  assert.equal(byName.decision_no_work.detail, "NO_WORK");
  assert.equal(byName.candidate_set_empty.detail, "0");
  assert.equal(byName.no_reservation.detail, "0");
});

test("a verified dependency unblocks its dependent in the same wave", () => {
  const scenario = SCENARIO_BUILDERS["dependency-unblocks"]();
  const byName = Object.fromEntries(scenario.checks.map(entry => [entry.name, entry]));
  assert.equal(byName.first_is_dependency.detail, "TS-011");
  assert.equal(byName.second_is_dependent.detail, "TS-012");
  assert.equal(byName.second_reservation_ok.detail, "2");
});

test("crash windows fail closed and never re-dispatch", () => {
  const scenario = SCENARIO_BUILDERS["crash-windows"]();
  const byName = Object.fromEntries(scenario.checks.map(entry => [entry.name, entry]));
  assert.equal(byName.during_stop_uncertain.detail, "STOP_UNCERTAIN");
  assert.equal(byName.after_no_redispatch.detail, "IN_FLIGHT");
  assert.equal(byName.single_reservation_only.detail, "1");
});

test("a simulated red CI never verifies delivery and stops the wave", () => {
  const scenario = SCENARIO_BUILDERS["red-ci"]();
  const byName = Object.fromEntries(scenario.checks.map(entry => [entry.name, entry]));
  assert.equal(byName.verdict_not_verified.detail, "pending");
  assert.equal(byName.reason_check_failed.detail, "check_failed");
  assert.equal(byName.no_scheduler_evidence.detail, "null");
  assert.equal(byName.no_dispatch_after_failure.detail, "STOP_FAILED");
});

test("the two-task wave reserves exactly two starts and no third", () => {
  const scenario = SCENARIO_BUILDERS["two-task-wave"]();
  const byName = Object.fromEntries(scenario.checks.map(entry => [entry.name, entry]));
  assert.equal(byName.first_selected.detail, "TS-011");
  assert.equal(byName.second_selected_after_recalc.detail, "TS-012");
  assert.equal(byName.third_quota_reached.detail, "QUOTA_REACHED");
  assert.equal(byName.exactly_two_reservations.detail, "2");
  assert.equal(byName.no_third_key.detail, "TS-011,TS-012");
});

test("concurrent access serializes one paid development and refuses a stale commit", () => {
  const scenario = SCENARIO_BUILDERS["concurrent-access"]();
  const byName = Object.fromEntries(scenario.checks.map(entry => [entry.name, entry]));
  assert.equal(byName.stale_commit_conflict.detail, "conflict");
  assert.equal(byName.manual_blocked_while_held.detail, "wave:run-1");
  assert.equal(byName.manual_after_release_ok.passed, true);
});

test("the recette module is pure: no clock, network, process or paid reference", () => {
  assert.doesNotMatch(source, /new Date|Date\.now/);
  assert.doesNotMatch(source, /fetch\(|child_process|execFile|execSync/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /OPENROUTER|OPENAI_API_KEY|OPENROUTER_API_KEY/);
  assert.doesNotMatch(source, /readFileSync|writeFileSync|process\.env/);
  assert.match(source, /paidCalls: 0/);
  assert.match(source, /generatedAt: null/);
  assert.equal(typeof FIXED_AT, "string");
});

test("the human report names every scenario and shows zero spend", () => {
  const text = formatE2eReport(runE2eValidation());
  for (const name of SCENARIO_NAMES) assert.match(text, new RegExp(name));
  assert.match(text, /Appels OpenRouter : 0/);
  assert.match(text, /Dispatches : 0/);
});
