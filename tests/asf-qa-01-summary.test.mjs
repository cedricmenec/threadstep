import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const script = new URL("../scripts/asf/ci-failure-summary.sh", import.meta.url).pathname;

function summarize(log) {
  const temp = mkdtempSync(join(tmpdir(), "asf-qa-01-"));
  try {
    const path = join(temp, "run.log");
    if (log !== null) writeFileSync(path, log);
    const result = spawnSync("bash", [script, path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("ASF-QA-01: failing TAP highlights the failing test, cause and counts", () => {
  const summary = summarize([
    "ok 1 - a successful test",
    "not ok 2 - TS-065 asynchronous React teardown",
    "  ---",
    "  error: 'ReferenceError: window is not defined'",
    "  ...",
    "# tests 1292",
    "# pass 1291",
    "# fail 1"
  ].join("\n"));
  assert.match(summary, /TS-065 asynchronous React teardown/);
  assert.match(summary, /ReferenceError: window is not defined/);
  assert.match(summary, /# pass 1291/);
  assert.match(summary, /# fail 1/);
  assert.doesNotMatch(summary, /ok 1 - a successful test/);
});

test("ASF-QA-01: non-TAP failures and missing log have actionable diagnostics", () => {
  const cli = summarize("npm run backlog:check\nError: backlog/index.json out of date");
  assert.match(cli, /backlog\/index\.json out of date/);
  const missing = summarize(null);
  assert.match(missing, /Les tests n'ont pas produit de journal/);
});

test("ASF-QA-01: independent CI keeps failures blocking despite log capture", () => {
  const ci = (await import("node:fs")).readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"
  );
  assert.match(ci, /set -o pipefail\s+npm run check 2>&1 \| tee/);
  assert.match(ci, /- name: Summarize a failed CI check\s+if: failure\(\)/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
});
