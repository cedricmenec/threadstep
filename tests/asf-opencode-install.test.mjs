import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const VERSION = "1.19.0";
const install = `npm install --global opencode-ai@${VERSION}`;
const versionCheck = `[[ "$installed_version" != "${VERSION}" ]]`;
const workflows = [
  [".github/workflows/agent-openspec.yml", "Agent OpenSpec"],
  [".github/workflows/agent.yml", "Agent direct"],
  [".github/workflows/agent-asf.yml", "Agent ASF manuel"]
];

test("ASF-OPENCODE-001 all agent workflows pin exactly the same CLI and verify the executable", () => {
  for (const [path, name] of workflows) {
    const yaml = read(path);
    const installPos = yaml.indexOf(install);
    assert.notEqual(installPos, -1, `${name}: installation must be pinned`);
    assert.equal(yaml.split(install).length - 1, 1, `${name}: exactly one pinned installation`);
    assert.match(yaml, /installed_version="\$\(opencode --version\)"/, `${name}: capture actual CLI version`);
    assert.ok(yaml.includes(versionCheck), `${name}: require exact CLI version`);
    assert.match(yaml, /::error::OpenCode version mismatch/, `${name}: fail closed with actionable diagnostic`);
    const firstCall = yaml.indexOf("opencode run --auto --model");
    assert.ok(firstCall > installPos, `${name}: install before paid call`);
    assert.ok(yaml.indexOf(versionCheck) < firstCall, `${name}: version gate before paid call`);
    assert.doesNotMatch(yaml, /opencode-ai@(latest|next|\^|~|\*)/i, `${name}: no floating install`);
  }
});

test("ASF-OPENCODE-001 independent CI proves npm Linux binary install without OpenRouter", () => {
  const yaml = read(".github/workflows/ci.yml");
  assert.match(yaml, /runs-on: ubuntu-latest/);
  const start = yaml.indexOf("Smoke test pinned OpenCode Linux CLI (no model calls)");
  assert.ok(start > 0);
  const end = yaml.indexOf("      - name:", start + 6);
  const step = yaml.slice(start, end < 0 ? undefined : end);
  assert.ok(step.includes(install), "CI installs same exact OpenCode release");
  assert.ok(step.includes('installed_version="$(opencode --version)"'), "CI invokes installed binary");
  assert.ok(step.includes(versionCheck), "CI fails if version differs");
  assert.doesNotMatch(step, /OPENROUTER_API_KEY|opencode run|--model|retry|@latest/,
    "smoke test must not call any model, expose secrets or float versions");
});

test("ASF-OPENCODE-001 documentation identifies the incident and approved recovery", () => {
  const guide = read("docs/factory/developer-guide.md");
  const task = read("docs/factory/tasks/ASF-OPENCODE-001.md");
  assert.match(guide, /39783720926/);
  assert.match(guide, /opencode-ai@1\.19\.0/);
  assert.match(task, /TS-052/);
  assert.match(task, /phase=auto/);
});
