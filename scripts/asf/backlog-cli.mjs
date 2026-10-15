#!/usr/bin/env node
/**
 * CLI for the deterministic Backlog V2 index (ASF-V2-002).
 *
 *   generate  Recompute backlog/index.json and backlog/archive-index.json.
 *   check     Fail if validation reports a problem or the committed indexes
 *             diverge from the task files. `check` never writes anything.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { checkBacklogIndex, formatDiagnostics, generateBacklogIndex } from "./backlog-index.mjs";

const DEFAULT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  let root = DEFAULT_ROOT;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--root") {
      const value = args.shift();
      if (!value) throw new Error("--root requires a directory");
      root = resolve(value);
    } else {
      throw new Error("Unknown argument: " + flag);
    }
  }
  if (command !== "generate" && command !== "check") {
    throw new Error("Usage: backlog-cli.mjs <generate|check> [--root <dir>]");
  }
  return { command, root };
}

function run() {
  const { command, root } = parseArgs(process.argv.slice(2));
  if (command === "generate") {
    const result = generateBacklogIndex({ root });
    if (!result.written) {
      process.stderr.write(formatDiagnostics(result.problems));
      process.stderr.write("Refused to write indexes: fix the diagnostics above.\n");
      process.exitCode = 1;
      return;
    }
    process.stdout.write("Generated backlog/index.json (" + result.activeCount +
      " active) and backlog/archive-index.json (" + result.archiveCount + " archived)\n");
    return;
  }
  const result = checkBacklogIndex({ root });
  if (result.problems.length) {
    process.stderr.write(formatDiagnostics(result.problems));
    process.stderr.write("Backlog index check failed.\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Backlog indexes are up to date (" + result.activeCount +
    " active, " + result.archiveCount + " archived)\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    process.stderr.write("backlog index: " + error.message + "\n");
    process.exitCode = 1;
  }
}
