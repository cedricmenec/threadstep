import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

function step(name) {
  const marker = "      - name: " + name + "\n";
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, "Missing workflow step: " + name);
  const next = workflow.indexOf("      - name: ", start + marker.length);
  return workflow.slice(start, next < 0 ? undefined : next);
}

test("ASF-QA-01: strict OPSX sync and archive guards remain independent of product tests", () => {
  const sync = step("Verify, semantic sync and archive OpenSpec");
  const syncAt = sync.indexOf('opencode run --auto --model "$OPENCODE_MODEL" --command opsx-sync "$CHANGE_ID"');
  const snapshotAt = sync.indexOf('node scripts/sync-guard.mjs snapshot');
  const verifyAt = sync.indexOf('node scripts/sync-guard.mjs verify');
  const validateAt = sync.indexOf("openspec validate --all --strict --no-interactive");
  const archiveAt = sync.indexOf('openspec archive "$CHANGE_ID" --yes --skip-specs');
  const archivedValidation = sync.indexOf("openspec validate --archived --strict --no-interactive");
  assert.ok(snapshotAt >= 0 && syncAt > snapshotAt && verifyAt > syncAt);
  assert.ok(validateAt > verifyAt && archiveAt > validateAt && archivedValidation > archiveAt);
  assert.match(sync, /if \[\[ "\$PHASE" == finalize \]\]; then\s+npm run check\s+fi/);
  assert.ok(sync.indexOf("npm run check") < syncAt, "finalize must test before the paid sync");
  assert.doesNotMatch(sync.slice(syncAt), /^\s*npm run check$/m);
});

test("ASF-QA-01: scope checked before final commit, published tree checked independently", () => {
  const publish = step("Guard scope, commit and publish PR");
  const at = (snippet) => {
    const i = publish.indexOf(snippet);
    assert.notEqual(i, -1, "Missing publication safety step: " + snippet);
    return i;
  };
  const stage = at("git add -A");
  const guard = publish.indexOf('node "$RUNNER_TEMP/agent-openspec-checkpoint.mjs" "$guard_phase" "$CHANGE_ID"', stage);
  const commit = at('git commit -m "agent($TASK_ID): OpenSpec $PHASE"');
  const clean = at("Publication requires a clean committed worktree");
  const push = at('git -c http.extraheader=');
  const pr = at('gh pr create --base main');
  assert.ok(guard > stage && commit > guard && clean > commit);
  assert.ok(push > clean && pr > push);
  assert.doesNotMatch(publish, /^\s+npm run check$/m);
  assert.match(publish, /test -z "\$\(git status --porcelain\)"/);

  // A failed post-archive test can now produce a RED PR, but never a merge:
  // GitHub's protected independent CI remains the mandatory release gate.
  assert.match(ci, /^  pull_request:/m);
  assert.match(ci, /npm run check 2>&1 \| tee/);
  assert.match(ci, /set -o pipefail/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
});

test("ASF-QA-01: one full pre-sync checkpoint check, no repeated plan check", () => {
  const plan = step("Validate the produced plan");
  const implementation = step("Checkpoint verified implementation before OPSX sync");
  assert.doesNotMatch(plan, /^\s+npm run check$/m);
  assert.match(implementation, /^\s+npm run check$/m);
  assert.ok(implementation.indexOf("npm run check") <
    implementation.indexOf('git commit -m "agent($TASK_ID): verified implementation checkpoint"'));
});
