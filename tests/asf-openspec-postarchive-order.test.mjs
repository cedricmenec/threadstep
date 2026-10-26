import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");

function step(name) {
  const marker = "      - name: " + name + "\n";
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, "Missing workflow step: " + name);
  const next = workflow.indexOf("      - name: ", start + marker.length);
  return workflow.slice(start, next < 0 ? undefined : next);
}

test("ASF-OPSX-09: sync and archive validate canonical specs before committing", () => {
  const sync = step("Verify, semantic sync and archive OpenSpec");
  const syncAt = sync.indexOf('opencode run --auto --model "$OPENCODE_MODEL" --command opsx-sync "$CHANGE_ID"');
  const verifyAt = sync.indexOf('node scripts/sync-guard.mjs verify');
  const validateAt = sync.indexOf("openspec validate --all --strict --no-interactive");
  const archiveAt = sync.indexOf('openspec archive "$CHANGE_ID" --yes --skip-specs');
  assert.ok(syncAt >= 0 && verifyAt > syncAt && validateAt > verifyAt && archiveAt > validateAt);
  // The pre-sync check remains, but no full check runs against dirty
  // canonical specs or a newly untracked archive.
  assert.ok(sync.indexOf("npm run check") < syncAt);
  assert.doesNotMatch(sync.slice(archiveAt), /^\s*npm run check$/m);
});

test("ASF-OPSX-09: post-archive check uses committed and scope-guarded tree before push", () => {
  const publish = step("Guard scope, commit and publish PR");
  const at = (snippet) => {
    const index = publish.indexOf(snippet);
    assert.notEqual(index, -1, "Missing protected publish operation: " + snippet);
    return index;
  };
  const stage = at("git add -A");
  const guard = publish.indexOf('node "$RUNNER_TEMP/agent-openspec-checkpoint.mjs" "$guard_phase" "$CHANGE_ID"', stage);
  assert.ok(guard > stage, "missing post-staging scope guard");
  const commit = at('git commit -m "agent($TASK_ID): OpenSpec $PHASE"');
  const cleanBefore = at("Post-archive validation requires a clean committed worktree");
  const check = at("npm run check");
  const cleanAfter = at("Post-archive validation changed the worktree");
  const push = at('git -c http.extraheader=');
  const pr = at('gh pr create --base main');
  assert.ok(stage < guard && guard < commit, "the scope guard must precede the commit");
  assert.ok(commit < cleanBefore && cleanBefore < check && check < cleanAfter);
  assert.ok(cleanAfter < push && push < pr, "tests must finish before remote publication");
  assert.match(publish, /test -z "\$\(git status --porcelain\)"/);
});

test("ASF-OPSX-09: the implementation checkpoint retains its own check", () => {
  const implementation = step("Checkpoint verified implementation before OPSX sync");
  assert.match(implementation, /^\s+npm run check$/m);
  assert.ok(implementation.indexOf("npm run check") <
    implementation.indexOf('git commit -m "agent($TASK_ID): verified implementation checkpoint"'));
});
