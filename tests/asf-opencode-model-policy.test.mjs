import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  APPROVED_OPENCODE_MODELS,
  buildOpenCodeModelPolicy,
  modelPolicyEnvironmentLine
} from "../scripts/asf/opencode-model-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const script = resolve(root, "scripts/asf/opencode-model-policy.mjs");
const openspec = read(".github/workflows/agent-openspec.yml");
const direct = read(".github/workflows/agent.yml");
const orchestrator = read(".github/workflows/backlog-orchestrator.yml");

test("ASF-MODEL-001 title generation is disabled and small model never drifts", () => {
  assert.equal(APPROVED_OPENCODE_MODELS.length, 3);
  assert.equal(new Set(APPROVED_OPENCODE_MODELS).size, 3);
  for (const model of APPROVED_OPENCODE_MODELS) {
    const config = buildOpenCodeModelPolicy(model);
    assert.deepEqual(config, {
      model,
      small_model: model,
      agent: { title: { disable: true } }
    });
    assert.deepEqual(JSON.parse(modelPolicyEnvironmentLine(model).split("=", 2)[1]), config);
    assert.equal(JSON.stringify(config).includes("nano-banana"), false);
  }
});

test("ASF-MODEL-001 rejects unapproved, unspecified or injected model IDs", () => {
  for (const model of [
    undefined, "", null,
    "openrouter/google/gemini-nano-banana-2.1",
    "openrouter/deepseek/deepseek-v4.1-flash\nFOO=bar",
    "openrouter/unknown/another", "deepseek/deepseek-v4.1-flash"
  ]) {
    assert.throws(() => buildOpenCodeModelPolicy(model), /allowlist/);
  }
});

test("ASF-MODEL-001 CLI writes only nonsecret approved config and fails closed", () => {
  const temp = mkdtempSync(join(tmpdir(), "threadstep-opencode-model-"));
  try {
    const envPath = join(temp, "github-env");
    writeFileSync(envPath, "BASE=unchanged\n");
    const env = { ...process.env, GITHUB_ENV: envPath, OPENCODE_MODEL: APPROVED_OPENCODE_MODELS[0] };
    const ok = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    const lines = readFileSync(envPath, "utf8").trimEnd().split("\n");
    assert.equal(lines[0], "BASE=unchanged");
    assert.equal(lines.length, 2);
    assert.deepEqual(
      JSON.parse(lines[1].slice("OPENCODE_CONFIG_CONTENT=".length)),
      buildOpenCodeModelPolicy(APPROVED_OPENCODE_MODELS[0])
    );
    for (const value of ["API_KEY", "SECRET", "TOKEN"]) {
      assert.doesNotMatch(lines[1], new RegExp(value));
    }
    const before = readFileSync(envPath, "utf8");
    const denied = spawnSync(process.execPath, [script], {
      env: { ...env, OPENCODE_MODEL: "openrouter/google/gemini-nano-banana-2.1" },
      encoding: "utf8"
    });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /allowlist/);
    assert.equal(readFileSync(envPath, "utf8"), before);
    const noEnv = spawnSync(process.execPath, [script], {
      env: { OPENCODE_MODEL: APPROVED_OPENCODE_MODELS[0] },
      encoding: "utf8"
    });
    assert.notEqual(noEnv.status, 0);
    assert.match(noEnv.stderr, /GITHUB_ENV/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("ASF-MODEL-001 both paid workflows load trusted main policy before OpenRouter", () => {
  for (const [name, workflow] of [
    ["Agent OpenSpec", openspec],
    ["Agent direct", direct]
  ]) {
    const scriptLoad = workflow.indexOf('git show origin/main:scripts/asf/opencode-model-policy.mjs');
    const install = workflow.indexOf('npm install --global opencode-ai@latest');
    const firstCall = workflow.indexOf('opencode run --auto --model "$OPENCODE_MODEL"');
    assert.ok(scriptLoad > 0, name + " loads trusted main");
    assert.ok(scriptLoad < firstCall, name + " protects before paid call");
    assert.ok(install < firstCall, name + " installs before paid call");
    assert.match(workflow, /node "\$RUNNER_TEMP\/opencode-model-policy\.mjs"/);
    assert.doesNotMatch(workflow, /node scripts\/asf\/opencode-model-policy\.mjs/, "do not execute stale agent branch policy");
    assert.equal(workflow.includes("opencode run --auto --model"), true);
  }
  assert.ok(openspec.indexOf("Enforce trusted OpenCode model policy") <
    openspec.indexOf("Explore and propose, no product code changes"));
  assert.ok(openspec.indexOf("Enforce trusted OpenCode model policy") <
    openspec.indexOf("Apply the reviewed plan with OpenCode"));
  assert.ok(openspec.indexOf("Enforce trusted OpenCode model policy") <
    openspec.indexOf('opencode run --auto --model "$OPENCODE_MODEL" --command opsx-sync'));
  assert.match(direct, /git fetch origin main\n\s+git show origin\/main:scripts\/asf\/opencode-model-policy\.mjs/);
  assert.match(orchestrator, /uses: \.\/\.github\/workflows\/agent-openspec\.yml/);
});

test("ASF-MODEL-001 allowed models match all workflow entry-point choices", () => {
  const expected = new Set(APPROVED_OPENCODE_MODELS);
  for (const [name, workflow] of [
    ["manual", direct], ["openspec", openspec], ["orchestrator", orchestrator]
  ]) {
    const selections = [...workflow.matchAll(/- ['"](openrouter\/[a-z0-9-]+\/[a-z0-9.-]+)['"]/g)]
      .map((match) => match[1]);
    assert.ok(selections.length > 0, name + " exposes model options");
    for (const model of selections) {
      assert.ok(expected.has(model), name + " model not authorized: " + model);
    }
  }
});
