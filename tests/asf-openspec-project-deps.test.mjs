import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
const staged = workflow.slice(workflow.indexOf("  staged-development:"));

function step(name) {
  const marker = "      - name: " + name + "\n";
  const start = staged.indexOf(marker);
  assert.notEqual(start, -1, "Missing workflow step: " + name);
  const next = staged.indexOf("      - name: ", start + marker.length);
  return staged.slice(start, next < 0 ? undefined : next);
}

test("OpenSpec agent installs pinned project dependencies before every check and paid phase", () => {
  assert.ok(staged.length > 0, "staged-development job missing");
  const setup = step("Set up Node for project checks");
  const install = step("Install project dependencies before agent phases");
  assert.match(setup, /uses: actions\/setup-node@v4/);
  assert.match(setup, /node-version: [\x27\x22]22[\x27\x22]/);
  assert.match(install, /^\s+run: npm ci$/m);
  assert.doesNotMatch(install, /^\s+if:/m, "dependency install must run for all phases");
  assert.equal([...staged.matchAll(/^\s+run: npm ci$/gm)].length, 1);
  const installAt = staged.indexOf("      - name: Install project dependencies before agent phases");
  for (const name of [
    "Create GitHub App installation token",
    "Explore and propose, no product code changes",
    "Validate the produced plan",
    "Apply the reviewed plan with OpenCode",
    "Verify, semantic sync and archive OpenSpec"
  ]) {
    assert.ok(staged.indexOf("      - name: " + name) > installAt, name + " runs before npm ci");
  }
  for (const check of staged.matchAll(/^\s+npm run check$/gm)) {
    assert.ok(check.index > installAt, "npm run check must be preceded by npm ci");
  }
});
