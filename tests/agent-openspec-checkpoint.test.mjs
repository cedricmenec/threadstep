import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedCheckpointPath,
  checkCheckpointPaths
} from "../scripts/agent-openspec-checkpoint.mjs";

const CHANGE = "ts-039";
const PRODUCT = "scripts/product/e2e-matrix.mjs";

test("ASF-OPSX-07: reviewed plan cannot modify even product scripts", () => {
  assert.equal(allowedCheckpointPath("plan", CHANGE, PRODUCT), false);
  assert.equal(allowedCheckpointPath("plan", CHANGE, "openspec/changes/ts-039/tasks.md"), true);
  assert.equal(allowedCheckpointPath("plan", CHANGE, "openspec/changes/ts-038/tasks.md"), false);
  assert.throws(
    () => checkCheckpointPaths("plan", CHANGE, ["openspec/changes/ts-039/tasks.md", PRODUCT]),
    /Checkpoint has forbidden paths: scripts\/product\/e2e-matrix\.mjs/
  );
});

test("ASF-OPSX-07: apply/publish allow only product subtree of scripts", () => {
  for (const phase of ["apply", "publish"]) {
    for (const path of [
      PRODUCT,
      "scripts/product/nested/future-matrix.mjs",
      "scripts/product/fixtures/synthetic.json",
      "tests/product-e2e-matrix.test.mjs",
      "docs/product/e2e-certification.md",
      "package.json"
    ]) {
      assert.equal(allowedCheckpointPath(phase, CHANGE, path), true, phase + ": " + path);
    }
    assert.equal(
      checkCheckpointPaths(phase, CHANGE, [PRODUCT, "tests/product-e2e-matrix.test.mjs", PRODUCT]),
      2
    );
  }
});

test("ASF-OPSX-07: factory scripts and protected files stay forbidden", () => {
  const forbidden = [
    "scripts/agent-openspec-checkpoint.mjs",
    "scripts/sync-guard.mjs",
    "scripts/check-openspec-task-phases.mjs",
    "scripts/asf/scheduler/run.mjs",
    "scripts/product-old/e2e-matrix.mjs",
    "scripts/products/e2e-matrix.mjs",
    "scripts/product",
    "scripts/PRODUCT/e2e-matrix.mjs",
    ".github/workflows/ci.yml",
    ".agents/skills/guard.md",
    ".opencode/commands/opsx-sync.md",
    "backlog/tasks/TS-039.md",
    "docs/factory/validation-and-recovery.md",
    "AGENTS.md",
    "ChatGPT.md",
    "opencode.json",
    "openspec/config.yaml",
    ".npmrc",
    "scripts/product/.env",
    "scripts/product/.env.production",
    "scripts/product/dexie-cloud.key",
    "scripts/product/token.pem",
    "scripts/product/node_modules/transitive.mjs",
    "scripts/product/coverage/secret.mjs",
    "scripts/product/.git/hooks/pre-commit",
    "scripts/product/../sync-guard.mjs",
    "scripts/product\\..\\sync-guard.mjs",
    "/scripts/product/e2e-matrix.mjs",
    "scripts/product//e2e-matrix.mjs"
  ];
  for (const phase of ["apply", "publish"]) {
    for (const path of forbidden) {
      assert.equal(allowedCheckpointPath(phase, CHANGE, path), false, phase + ": " + path);
    }
    assert.throws(
      () => checkCheckpointPaths(phase, CHANGE, [PRODUCT, "scripts/sync-guard.mjs"]),
      /Checkpoint has forbidden paths: scripts\/sync-guard\.mjs/
    );
  }
});

test("ASF-OPSX-07: OpenSpec spec and archive scopes are unchanged", () => {
  const spec = "openspec/specs/e2e-certification/spec.md";
  const ownArchive = "openspec/changes/archive/2026-10-19-ts-039/tasks.md";
  const foreignArchive = "openspec/changes/archive/2026-10-19-ts-038/tasks.md";
  assert.equal(allowedCheckpointPath("apply", CHANGE, spec), false);
  assert.equal(allowedCheckpointPath("publish", CHANGE, spec), true);
  assert.equal(allowedCheckpointPath("apply", CHANGE, ownArchive), false);
  assert.equal(allowedCheckpointPath("publish", CHANGE, ownArchive), true);
  assert.equal(allowedCheckpointPath("publish", CHANGE, foreignArchive), false);
  assert.equal(allowedCheckpointPath("publish", CHANGE, "openspec/changes/ts-038/tasks.md"), false);
  assert.throws(() => checkCheckpointPaths("apply", CHANGE, []), /Empty checkpoint/);
  assert.throws(() => checkCheckpointPaths("apply", "invalid", [PRODUCT]), /Invalid OpenSpec/);
});
