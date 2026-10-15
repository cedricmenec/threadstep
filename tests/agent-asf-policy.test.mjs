import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAllowedChange, knownTask, preflight, validateChangedPaths } from "../scripts/agent-asf-policy.mjs";

test("only enumerated ASF development tasks are accepted", () => {
  assert.equal(knownTask("ASF-V2-001"), true);
  assert.equal(knownTask("ASF-V2-011"), true);
  for (const value of ["ASF-BOOT-001", "ASF-V2-012", "TS-001", "ASF-V2-001/../../x"]) {
    assert.equal(knownTask(value), false, value);
  }
});

test("factory guard cannot be modified by an agent on any task", () => {
  for (let id = 1; id <= 11; id++) {
    const task = "ASF-V2-" + String(id).padStart(3, "0");
    assert.equal(isAllowedChange(task, "scripts/agent-asf-policy.mjs"), false);
    assert.equal(isAllowedChange(task, ".github/workflows/agent-asf.yml"), false);
    assert.equal(isAllowedChange(task, "docs/factory/specs/backlog-v2.md"), false);
    assert.equal(isAllowedChange(task, "docs/factory/tasks/ASF-BOOT-001.md"), false);
    assert.equal(isAllowedChange(task, "docs/factory/tasks/ASF-V2-011.md"), id === 11);
  }
});

test("task-scoped permissions do not open all workflows", () => {
  assert.equal(isAllowedChange("ASF-V2-001", "AGENTS.md"), true);
  assert.equal(isAllowedChange("ASF-V2-001", "scripts/asf/selector.mjs"), false);
  assert.equal(isAllowedChange("ASF-V2-008", ".github/workflows/agent-openspec.yml"), false);
  assert.equal(isAllowedChange("ASF-V2-009", ".github/workflows/backlog-orchestrator.yml"), false);
  assert.equal(isAllowedChange("ASF-V2-008", ".github/workflows/ci.yml"), false);
  assert.equal(isAllowedChange("ASF-V2-009", ".github/workflows/agent-openspec.yml"), false);
  assert.equal(isAllowedChange("ASF-V2-010", "scripts/request-safe-auto-merge.mjs"), true);
});

test("suspicious paths, traversal, secrets and overlapping tasks are rejected", () => {
  const bad = ["/tmp/file", "a/../AGENTS.md", "tests//test.mjs", "tests/evil\\test.mjs",
    "tests/.env.prod", "tests/private.pem", "tests/id_rsa", "tests/x\nother"];
  for (const path of bad) assert.equal(isAllowedChange("ASF-V2-001", path), false, path);
  assert.throws(() => validateChangedPaths("ASF-V2-001",
    ["backlog/tasks/TEMPLATE.md", ".github/workflows/ci.yml"]), /outside approved/);
  assert.throws(() => validateChangedPaths("ASF-V2-001", []), /did not produce changes/);
});

test("preflight verifies explicit owner-eligible task metadata", () => {
  const path = "docs/factory/tasks/ASF-V2-001.md";
  const content = readFileSync(path, "utf8");
  assert.deepEqual(preflight("ASF-V2-001"), []);
  assert.throws(() => preflight("ASF-V2-001", () => content.replace("Automation: manual", "Automation: allowed")), /not a ready/);
  assert.throws(() => preflight("ASF-V2-001", () => content.replace("Status: ready", "Status: proposed")), /not a ready/);
});

test("preflight requires a separate path for workflow modifications", () => {
  assert.throws(() => preflight("ASF-V2-008"), /separately authorized gated path/);
  assert.throws(() => preflight("ASF-V2-009"), /separately authorized gated path/);
});

test("preflight refuses dependencies not yet verified as delivered", () => {
  assert.throws(() => preflight("ASF-V2-002"), /Dependency not recorded as verified/);
});

test("workflow separates paid development and privileged publication", () => {
  const yaml = readFileSync(".github/workflows/agent-asf.yml", "utf8");
  assert.match(yaml, /github\.actor == github\.repository_owner/);
  assert.match(yaml, /github\.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /- name: Implement selected factory task with OpenRouter/);
  assert.match(yaml, /- name: Apply and validate untrusted patch BEFORE minting publisher token/);
  const develop = yaml.split("\n  develop:")[1]?.split("\n  publish:")[0] ?? "";
  assert.doesNotMatch(develop, /create-github-app-token|permission-contents: write|permission-workflows: write/);
  const publish = yaml.split("\n  publish:")[1] ?? "";
  assert.doesNotMatch(publish, /permission-workflows: write/);
  assert.doesNotMatch(publish, /auto.merge|request-safe-auto-merge/i);
});
