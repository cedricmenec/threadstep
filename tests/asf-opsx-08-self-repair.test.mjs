import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
const section = workflow.slice(
  workflow.indexOf("      - name: Apply the reviewed plan with OpenCode"),
  workflow.indexOf("      # ASF-OPSX-03: commit and push implementation")
);

test("ASF-OPSX-08 apply repairs ordinary errors and reruns tests within one invocation", () => {
  assert.match(section, /repair the implementation or the test harness/);
  assert.match(section, /including missing mocks/);
  assert.match(section, /rerun targeted tests, then rerun npm run check/);
  assert.match(section, /SAME apply invocation/);
  assert.match(section, /do not stop merely because an initial test run failed/);
  assert.doesNotMatch(section, /If requirements are ambiguous or tests fail, stop/);
  assert.equal((section.match(/opencode run --auto/g) || []).length, 1);
});

test("ASF-OPSX-08 preserves fail-closed checks, boundaries and non-retry", () => {
  assert.match(section, /genuinely ambiguous/);
  assert.match(section, /disallowed files or unsafe changes/);
  assert.match(section, /insufficient to implement AND verify safely/);
  assert.match(section, /Do not claim success or/);
  assert.match(section, /Never bypass failing tests/);
  assert.match(section, /new paid model invocation or workflow retry/);
  assert.match(workflow, /Unchecked tasks remain; refusing checkpoint/);
  assert.match(workflow, /npm run check\s*\n\s*openspec validate/);
  assert.match(workflow, /agent-openspec-checkpoint\.mjs" apply/);
});

test("ASF-OPSX-08 retains owner-only workflow and original safety limits", () => {
  assert.match(workflow, /github\.actor == github\.repository_owner/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 60/);
  assert.match(workflow, /if: inputs\.auto_merge == true/);
});
