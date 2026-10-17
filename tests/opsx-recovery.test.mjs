import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedCheckpointPath, checkCheckpointPaths } from "../scripts/agent-openspec-checkpoint.mjs";

const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
const orchestrator = readFileSync(new URL("../.github/workflows/backlog-orchestrator.yml", import.meta.url), "utf8");

test("plan checkpoint is restricted to the specific change", () => {
  assert.equal(allowedCheckpointPath("plan", "ts-023", "openspec/changes/ts-023/tasks.md"), true);
  for (const path of ["site/app.js","openspec/changes/ts-022/tasks.md",".github/workflows/ci.yml",".opencode/commands/opsx-sync.md","backlog/tasks/TS-023.md","../x",".env"]) {
    assert.equal(allowedCheckpointPath("plan", "ts-023", path), false, path);
  }
  assert.equal(checkCheckpointPaths("plan","ts-023",["openspec/changes/ts-023/tasks.md"]), 1);
});

test("apply checkpoint permits product changes but not factory files or canonical specs", () => {
  for (const path of ["site/core.js","site/app.js","tests/core.test.mjs","docs/product/mvp.md","openspec/changes/ts-023/tasks.md"]) {
    assert.equal(allowedCheckpointPath("apply","ts-023",path),true,path);
  }
  for (const path of ["openspec/specs/action-editing/spec.md","openspec/changes/ts-022/specs/x/spec.md","scripts/agent-openspec-checkpoint.mjs","AGENTS.md",".github/workflows/ci.yml",".agents/skills/x","opencode.json","package.json.backup",".env",".npmrc","tools/unsafe.mjs","tools/vendor-dexie.mjs.old","tools/vendor-dexie.js","openspec/config.yaml","dexie-cloud.key"]) {
    assert.equal(allowedCheckpointPath("apply","ts-023",path),false,path);
  }
  for (const path of ["package.json","package-lock.json",".gitignore","tools/vendor-dexie.mjs"]) {
    assert.equal(allowedCheckpointPath("apply","ts-024",path),true,path);
    assert.equal(allowedCheckpointPath("plan","ts-024",path),false,path);
  }
  assert.equal(checkCheckpointPaths("apply","ts-024",[
    "site/app.js", ".gitignore", "package.json", "package-lock.json", "tools/vendor-dexie.mjs"
  ]),5);
  assert.throws(()=>checkCheckpointPaths("apply","ts-023",["site/app.js","scripts/rogue.mjs"]),/forbidden paths/);
  assert.throws(()=>checkCheckpointPaths("apply","ts-024",["site/app.js","tools/rogue.mjs"]),/forbidden paths/);
  assert.throws(()=>checkCheckpointPaths("apply","ts-023",[]),/Empty checkpoint/);
  assert.throws(()=>checkCheckpointPaths("finalize","ts-023",["site/app.js"]),/Unknown checkpoint/);
  assert.throws(()=>checkCheckpointPaths("plan","TS-023",["site/app.js"]),/Invalid OpenSpec/);
});

test("durable plan and apply checkpoints precede paid sync and survive later failures", () => {
  const plan=workflow.indexOf("- name: Checkpoint validated OpenSpec plan");
  const apply=workflow.indexOf("- name: Checkpoint verified implementation before OPSX sync");
  const sync=workflow.indexOf("- name: Verify, semantic sync and archive OpenSpec");
  const publish=workflow.indexOf("- name: Guard scope, commit and publish PR");
  assert.ok(plan>0 && apply>plan && sync>apply && publish>sync);
  assert.match(workflow,/Checkpoint validated OpenSpec plan[\s\S]*?agent-openspec-checkpoint\.mjs plan "[\$]CHANGE_ID"[\s\S]*?git commit[\s\S]*?push -u origin "HEAD:[\$]AGENT_BRANCH"/);
  assert.match(workflow,/Checkpoint verified implementation before OPSX sync[\s\S]*?npm run check[\s\S]*?openspec validate "[\$]CHANGE_ID" --strict --no-interactive[\s\S]*?agent-openspec-checkpoint\.mjs apply "[\$]CHANGE_ID"[\s\S]*?git commit[\s\S]*?push -u origin "HEAD:[\$]AGENT_BRANCH"/);
  assert.ok(workflow.includes("Existing OpenSpec plan on $AGENT_BRANCH; use phase=apply"));
  // A persistent branch created before a factory fix must not supply the
  // executable scope policy during the resume run.
  assert.match(workflow,/git show origin\/main:scripts\/agent-openspec-checkpoint\.mjs > "\$RUNNER_TEMP\/agent-openspec-checkpoint\.mjs"/);
  assert.match(workflow,/node "\$RUNNER_TEMP\/agent-openspec-checkpoint\.mjs" plan "\$CHANGE_ID"/);
  assert.match(workflow,/node "\$RUNNER_TEMP\/agent-openspec-checkpoint\.mjs" apply "\$CHANGE_ID"/);
  assert.doesNotMatch(workflow,/node scripts\/agent-openspec-checkpoint\.mjs (?:plan|apply)/);
  assert.ok(workflow.indexOf("- name: Load checkpoint verifier from trusted main") <
    workflow.indexOf("- name: Apply the reviewed plan with OpenCode"));
  assert.ok(workflow.includes('last_message="$(git log -1 --format=%s)"'));
  assert.ok(workflow.includes('LAST_DURABLE_PHASE=apply'));
  assert.ok(workflow.includes('CHECKPOINT_SHA=$(git rev-parse HEAD)'));
  assert.ok(workflow.includes('git diff --no-renames --name-only origin/main...HEAD'));
  assert.ok(workflow.includes("No automatic paid retry was started"));
  assert.ok(workflow.includes('if: failure()'));
});

test("strict canonical validation precedes archive; native OPSX command receives runner-only quality instructions", () => {
  const sync=workflow.indexOf('opencode run --auto --model "$OPENCODE_MODEL" --command opsx-sync "$CHANGE_ID"');
  const gate=workflow.indexOf('openspec validate --all --strict --no-interactive',sync);
  const archive=workflow.indexOf('openspec archive "$CHANGE_ID" --yes --skip-specs',sync);
  assert.ok(sync>0 && gate>sync && archive>gate);
  assert.match(workflow,/cat docs\/factory\/opsx-sync-quality\.md >> \.opencode\/commands\/opsx-sync\.md/);
  assert.match(workflow,/node scripts\/sync-guard\.mjs verify/);
  assert.match(workflow,/openspec validate --archived --strict --no-interactive/);
});

test("bounded orchestrator inherits the same checkpoints without paid retries", () => {
  assert.equal((orchestrator.match(/uses: \.\/\.github\/workflows\/agent-openspec\.yml/g)||[]).length,2);
  assert.equal((orchestrator.match(/phase: auto/g)||[]).length,2);
  assert.match(orchestrator,/needs: \[prepare, first\]/);
  assert.match(orchestrator,/needs: \[prepare, after_first\]/);
});
