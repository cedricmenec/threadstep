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
  assert.equal(allowedCheckpointPath("plan","ts-023","openspec/changes/ts-023/private.key"),false);
  assert.equal(allowedCheckpointPath("apply","ts-023","site/.env.example"),true);
});

test("apply checkpoint uses protected-path denylist, not a product allowlist", () => {
  const productPaths = [
    "site/core.js", "tests/core.test.mjs", "docs/product/mvp.md",
    "openspec/changes/ts-024/tasks.md", "package.json", "package-lock.json",
    ".gitignore", "tools/build-vendor.mjs",
    "tools/vendor/entry-dexie-cloud-addon.mjs", "tools/vendor/entry-dexie.mjs",
    "assets/new-image.svg", "docs/research/notes.md",
  ];
  for (const path of productPaths) {
    assert.equal(allowedCheckpointPath("apply", "ts-024", path), true, path);
    assert.equal(allowedCheckpointPath("plan", "ts-024", path),
      path.startsWith("openspec/changes/ts-024/"), path);
  }
  assert.equal(checkCheckpointPaths("apply", "ts-024", productPaths), productPaths.length);

  const forbidden = [
    "AGENTS.md", "ChatGPT.md", "opencode.json", "openspec/config.yaml",
    ".github/workflows/ci.yml", ".agents/skills/x", ".opencode/run.md",
    "backlog/tasks/TS-024.md", "scripts/agent-openspec-checkpoint.mjs",
    "docs/factory/tasks/ASF-OPSX-06.md", "openspec/specs/example/spec.md",
    "openspec/changes/ts-023/tasks.md",
    "openspec/changes/archive/2026-10-17-ts-024/tasks.md",
    ".npmrc", ".netrc", ".gitattributes", ".gitmodules",
    ".env", ".env.production", "site/.env.local", "site/secrets.pem",
    "tools/signing.key", "site/dexie-cloud.json", "site/dexie-cloud.key",
    "node_modules/dependency/index.js", "site/node_modules/evil.js",
    "coverage/report.html", "build/cache/.cache/data",
    "../outside", "docs/../AGENTS.md", "site//index.html",
    "site\\\\other.js", "/etc/passwd", "site/evil\\nname", "tools/local/.npmrc", "site/.envrc",
    "openspec/changes/ts-024/credentials.pem",
  ];
  for (const path of forbidden) {
    assert.equal(allowedCheckpointPath("apply", "ts-024", path), false, path);
  }
  assert.throws(() => checkCheckpointPaths("apply", "ts-024", [
    "site/app.js", "tools/build-vendor.mjs", "scripts/rogue.mjs",
  ]), /forbidden paths: scripts\/rogue\.mjs/);
  assert.throws(() => checkCheckpointPaths("apply", "ts-024", []), /Empty checkpoint/);
  assert.throws(() => checkCheckpointPaths("finalize", "ts-024", ["site/app.js"]), /Unknown checkpoint/);
  assert.throws(() => checkCheckpointPaths("plan", "TS-024", ["site/app.js"]), /Invalid OpenSpec/);
});

test("publication blocks protected paths but permits only the task archive and synced specs", () => {
  for (const path of [
    "site/app.js", "tools/vendor/entry-dexie.mjs",
    "openspec/specs/dexie-cloud-configuration/spec.md",
    "openspec/changes/archive/2026-10-17-ts-024/tasks.md",
    "openspec/changes/ts-024/tasks.md",
  ]) assert.equal(allowedCheckpointPath("publish","ts-024",path),true,path);
  for (const path of [
    ".github/workflows/agent-openspec.yml", "docs/factory/README.md",
    "openspec/config.yaml", "openspec/changes/ts-025/tasks.md",
    "openspec/changes/archive/2026-10-17-ts-023/tasks.md",
    "tools/vendor/.env", "secrets/private.pem",
  ]) assert.equal(allowedCheckpointPath("publish","ts-024",path),false,path);
});
test("durable plan and apply checkpoints precede paid sync and survive later failures", () => {
  const plan=workflow.indexOf("- name: Checkpoint validated OpenSpec plan");
  const apply=workflow.indexOf("- name: Checkpoint verified implementation before OPSX sync");
  const sync=workflow.indexOf("- name: Verify, semantic sync and archive OpenSpec");
  const publish=workflow.indexOf("- name: Guard scope, commit and publish PR");
  assert.ok(plan>0 && apply>plan && sync>apply && publish>sync);
  assert.match(workflow,/Checkpoint validated OpenSpec plan[\s\S]*?agent-openspec-checkpoint\.mjs" plan "[\$]CHANGE_ID"[\s\S]*?git commit[\s\S]*?push -u origin "HEAD:[\$]AGENT_BRANCH"/);
  assert.match(workflow,/Checkpoint verified implementation before OPSX sync[\s\S]*?npm run check[\s\S]*?openspec validate "[\$]CHANGE_ID" --strict --no-interactive[\s\S]*?agent-openspec-checkpoint\.mjs" apply "[\$]CHANGE_ID"[\s\S]*?git commit[\s\S]*?push -u origin "HEAD:[\$]AGENT_BRANCH"/);
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
  assert.match(workflow,/guard_phase=publish[\s\S]*?if \[\[ "\$PHASE" == plan \]\]; then guard_phase=plan/);
  assert.match(workflow,/node "\$RUNNER_TEMP\/agent-openspec-checkpoint\.mjs" "\$guard_phase" "\$CHANGE_ID"/);
  assert.match(workflow,/git add -A[\s\S]*?node "\$RUNNER_TEMP\/agent-openspec-checkpoint\.mjs" apply "\$CHANGE_ID"/);
  assert.match(workflow,/git add -A[\s\S]*?node "\$RUNNER_TEMP\/agent-openspec-checkpoint\.mjs" "\$guard_phase" "\$CHANGE_ID"/);
  assert.doesNotMatch(workflow,/case "\$path" in/);
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
