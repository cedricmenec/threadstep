import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeTaskId } from "../scripts/normalize-task-id.mjs";
const cli = fileURLToPath(new URL("../scripts/normalize-task-id.mjs", import.meta.url));

test("numeric task input pads to TS-NNN", () => {
  for (const value of ["9", "09", "009"]) assert.equal(normalizeTaskId(value), "TS-009");
  assert.equal(normalizeTaskId("1"), "TS-001");
  assert.equal(normalizeTaskId("10"), "TS-010");
  assert.equal(normalizeTaskId("100"), "TS-100");
  assert.equal(normalizeTaskId("999"), "TS-999");
});

test("canonical TS-NNN stays unchanged", () => {
  assert.equal(normalizeTaskId("TS-009"), "TS-009");
  assert.equal(normalizeTaskId("TS-120"), "TS-120");
  assert.equal(normalizeTaskId("  TS-009  "), "TS-009");
  assert.equal(normalizeTaskId(" 9 "), "TS-009");
});

test("reject invalid identifiers before any paid OpenCode invocation", () => {
  for (const value of ["", "0", "00", "000", "1000", "TS-000", "TS-9", "ts-009", "9.0", "+9", "9foo", "TS-9999", "../9", "-1", " ", "NaN"]) {
    assert.throws(() => normalizeTaskId(value), /Invalid task_id/);
  }
  assert.throws(() => normalizeTaskId(undefined), /task_id must be text/);
});

test("CLI prints canonical value and fails closed on malformed input", () => {
  const ok = spawnSync(process.execPath, [cli, "009"], { encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, "TS-009\n");
  const bad = spawnSync(process.execPath, [cli, "1000"], { encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Invalid task_id/);
});
