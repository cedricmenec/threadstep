import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applicableMainRule, validateAutoMergePrerequisites,
  validateAutoMergeTarget
} from "../scripts/request-safe-auto-merge.mjs";

const ruleset = (contexts = ["check"]) => ({
  id: 25163425, target: "branch", enforcement: "active",
  conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
  rules: [
    { type: "pull_request", parameters: { required_approving_review_count: 0 } },
    { type: "required_status_checks",
      parameters: { required_status_checks: contexts.map(context => ({ context })) } }
  ]
});
const repository = { default_branch: "main", allow_auto_merge: true };
const branch = { protected: true };
const sha = "a".repeat(40);
const pr = { number: 42, state: "OPEN", isDraft: false, baseRefName: "main",
  headRefName: "agent/openspec/TS-010", headRefOid: sha };

test("rejects current protection: check list is empty (fails closed)", () => {
  assert.throws(() => validateAutoMergePrerequisites({
    repository, branch, rulesets: [ruleset([])]
  }), /independent CI check/);
});

test("requires protection, native auto-merge and a main PR+check ruleset", () => {
  assert.equal(validateAutoMergePrerequisites({ repository, branch, rulesets: [ruleset()] }), true);
  assert.throws(() => validateAutoMergePrerequisites({
    repository: { ...repository, allow_auto_merge: false }, branch, rulesets: [ruleset()]
  }), /Allow auto-merge/);
  assert.throws(() => validateAutoMergePrerequisites({
    repository, branch: { protected: false }, rulesets: [ruleset()]
  }), /not protected/);
  assert.throws(() => validateAutoMergePrerequisites({
    repository, branch, rulesets: []
  }), /No active main ruleset/);
  assert.throws(() => validateAutoMergePrerequisites({
    repository, branch, rulesets: [ruleset(["some-other-job"])]
  }), /No active main ruleset/);
  const inactive = ruleset(); inactive.enforcement = "disabled";
  assert.equal(applicableMainRule(inactive), false);
  const wrong = ruleset(); wrong.conditions.ref_name.include = ["refs/heads/develop"];
  assert.equal(applicableMainRule(wrong), false);
  const bypass = ruleset(); bypass.conditions.ref_name.exclude = ["refs/heads/main"];
  assert.equal(applicableMainRule(bypass), false);
  const wildcardBypass = ruleset(); wildcardBypass.conditions.ref_name.exclude = ["refs/heads/m*"];
  assert.equal(applicableMainRule(wildcardBypass), false);
  const noPR = ruleset(); noPR.rules = noPR.rules.filter(x => x.type !== "pull_request");
  assert.throws(() => validateAutoMergePrerequisites({
    repository, branch, rulesets: [noPR]
  }), /No active main ruleset/);
});

test("requires a precise open non-draft PR targeting main at the pushed SHA", () => {
  const expected = { expectedHeadRef: pr.headRefName, expectedHeadSha: sha };
  assert.equal(validateAutoMergeTarget(pr, expected), 42);
  for (const bad of [
    { state: "MERGED" }, { isDraft: true }, { baseRefName: "develop" },
    { headRefName: "agent/openspec/TS-011" }, { headRefOid: "b".repeat(40) },
    { number: 0 }
  ]) {
    assert.throws(() => validateAutoMergeTarget({ ...pr, ...bad }, expected), /does not match/);
  }
});

test("both manual workflows default auto_merge true, while plan never merges", () => {
  const manual = readFileSync(new URL("../.github/workflows/agent.yml", import.meta.url), "utf8");
  const openspec = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
  for (const [name, workflow] of [["manual",manual],["openspec",openspec]]) {
    assert.match(workflow, /auto_merge:\n\s+description:.*\n\s+required: true\n\s+type: boolean\n\s+default: true/);
    assert.match(workflow, /node scripts\/request-safe-auto-merge\.mjs/);
    assert.match(workflow, /inputs\.auto_merge == true/);
    assert.match(workflow, /env\.PR_PUBLISHED == 'true'/);
    assert.match(workflow, /echo "PR_PUBLISHED=true" >> "\$GITHUB_ENV"/);
    assert.match(workflow, /GH_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/);
    assert.doesNotMatch(workflow, /gh pr merge .*--admin/);
    assert.match(workflow, /if: github\.actor == github\.repository_owner/);
  }
  assert.match(openspec, /inputs\.phase != 'plan'/);
  assert.match(openspec, /gh pr create --draft/);
  assert.match(manual, /\^scripts\/|scripts\/.*protected/);
});

test("native auto-merge command is SHA-pinned and no unguarded merge", () => {
  const helper = readFileSync(new URL("../scripts/request-safe-auto-merge.mjs", import.meta.url), "utf8");
  assert.match(helper, /validateAutoMergePrerequisites\(\{ repository, branch, rulesets \}\)/);
  assert.match(helper, /validateAutoMergeTarget\(pr, \{ expectedHeadRef, expectedHeadSha \}\)/);
  assert.match(helper, /"pr", "merge", String\(number\).*"--auto", "--merge"/);
  assert.match(helper, /"--match-head-commit", expectedHeadSha/);
  assert.doesNotMatch(helper, /"--admin"/);
});
