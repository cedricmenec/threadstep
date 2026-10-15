#!/usr/bin/env node
/**
 * Normalize workflow_dispatch task input to the canonical TS-NNN identifier.
 * Keep one stable branch, change path and backlog filename per task.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function normalizeTaskId(input) {
  if (typeof input !== "string") throw new TypeError("task_id must be text");
  const value = input.trim();
  if (/^TS-(?!000)[0-9]{3}$/.test(value)) return value;
  if (/^[0-9]{1,3}$/.test(value) && /[1-9]/.test(value)) {
    return "TS-" + value.padStart(3, "0");
  }
  throw new Error("Invalid task_id: enter 1-999 (such as 9 or 009) or TS-NNN (such as TS-009)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error("Expected exactly one task_id argument");
    process.stdout.write(normalizeTaskId(process.argv[2]) + "\n");
  } catch (error) {
    console.error("::error::" + error.message);
    process.exitCode = 1;
  }
}
