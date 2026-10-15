#!/usr/bin/env node
/**
 * Trusted publication boundary for owner-dispatched ASF work.
 * This file is never writable by the ASF development agent.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const policies = Object.freeze({
  "ASF-V2-001": ["backlog/tasks/TEMPLATE.md", "AGENTS.md", "ChatGPT.md", "docs/factory/", "tests/"],
  "ASF-V2-002": ["scripts/asf/", "tests/", "backlog/index.json", "backlog/archive-index.json", "package.json", "package-lock.json", "docs/factory/"],
  "ASF-V2-003": ["backlog/tasks/", "backlog/README.md", "backlog/index.json", "backlog/archive-index.json", "docs/factory/", "tests/"],
  "ASF-V2-004": ["scripts/asf/", "tests/", "docs/factory/"],
  "ASF-V2-005": ["scripts/asf/", "tests/", "docs/factory/"],
  "ASF-V2-006": ["scripts/asf/", "tests/", "docs/factory/"],
  "ASF-V2-007": ["scripts/asf/", "tests/", "docs/factory/"],
  "ASF-V2-008": [".github/workflows/agent-openspec.yml", "scripts/asf/", "tests/", "docs/factory/", "AGENTS.md"],
  "ASF-V2-009": [".github/workflows/backlog-orchestrator.yml", "scripts/asf/", "tests/", "docs/factory/"],
  "ASF-V2-010": ["scripts/asf/", "scripts/request-safe-auto-merge.mjs", "backlog/", "tests/", "docs/factory/"],
  "ASF-V2-011": ["scripts/asf/fixtures/", "tests/", "docs/factory/"]
});

export function knownTask(taskId) {
  return Object.hasOwn(policies, taskId) && /^ASF-V2-0(?:0[1-9]|1[01])$/.test(taskId);
}

export function isAllowedChange(taskId, path) {
  if (!knownTask(taskId) || typeof path !== "string" || !path ||
      path.startsWith("/") || path.includes("\\") ||
      path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith(".env")) ||
      /[\x00-\x1f\x7f]/.test(path)) return false;
  // The publisher's guard and its own workflow cannot be rewritten by the agent.
  if (path === "scripts/agent-asf-policy.mjs" || path === ".github/workflows/agent-asf.yml" ||
      path === "docs/factory/tasks/ASF-BOOT-001.md" ||
      path.startsWith("docs/factory/specs/") ||
      (path.startsWith("docs/factory/tasks/") &&
       path !== "docs/factory/tasks/" + taskId + ".md") ||
      /(^|\/)(credentials|id_rsa|\.env(?:\.|$)|.*\.pem$|.*\.key$)/i.test(path)) return false;
  return policies[taskId].some(pattern => pattern.endsWith("/") ? path.startsWith(pattern) : path === pattern);
}

export function preflight(taskId, read = path => readFileSync(path, "utf8")) {
  if (!knownTask(taskId)) throw new Error("Unknown or invalid ASF task ID");
  const content = read("docs/factory/tasks/" + taskId + ".md");
  if (!/^Status:\s*ready\b/im.test(content) ||
      !/^Type:\s*factory\s*$/im.test(content) ||
      !/^Automation:\s*manual\s*$/im.test(content)) {
    throw new Error("Task is not a ready, manually dispatched factory task");
  }
  const depField = /^Dependencies:\s*(.*?)\s*$/im.exec(content);
  if (!depField) throw new Error("Missing task dependencies");
  const deps = depField[1].trim().toLowerCase() === "none" ? [] :
    depField[1].split(",").map(s => s.trim());
  if (new Set(deps).size !== deps.length ||
      deps.some(dep => !knownTask(dep) || dep === taskId)) {
    throw new Error("Invalid task dependencies");
  }
  for (const dep of deps) {
    const text = read("docs/factory/tasks/" + dep + ".md");
    if (!/^Status:\s*(?:completed|delivered)\b/im.test(text) ||
        !/^Delivery proof:\s*https:\/\/github\.com\/[^\s]+\/pull\/\d+\s*$/im.test(text)) {
      throw new Error("Dependency not recorded as verified and delivered: " + dep);
    }
  }
  return deps;
}

export function validateChangedPaths(taskId, changes) {
  if (!knownTask(taskId)) throw new Error("Invalid task ID");
  if (!changes.length) throw new Error("Agent did not produce changes");
  if (changes.length > 90) throw new Error("Too many modified paths");
  const invalid = changes.filter(path => !isAllowedChange(taskId, path));
  if (invalid.length) throw new Error("Changes outside approved task scope: " + invalid.join(", "));
  return changes;
}

function runCli() {
  const [command, taskId] = process.argv.slice(2);
  if (command === "preflight") {
    preflight(taskId);
    process.stdout.write("Preflight passed for " + taskId + "\n");
    return;
  }
  if (command !== "validate") throw new Error("Usage: agent-asf-policy.mjs <preflight|validate> ASF-V2-NNN");
  const changed = execFileSync("git", ["diff", "--cached", "--no-renames", "--name-only", "-z"], {encoding:"utf8"})
    .split("\0").filter(Boolean);
  validateChangedPaths(taskId, changed);
  execFileSync("git", ["diff", "--cached", "--check"], {stdio:"inherit"});
  for (const path of changed) {
    if (!existsSync(path)) continue;
    const staged = execFileSync("git", ["ls-files", "--stage", "-z", "--", path], {encoding:"utf8"});
    for (const entry of staged.split("\0").filter(Boolean)) {
      const match = /^(\d{6})\s+[0-9a-f]{40,64}\s+\d+\t/.exec(entry);
      if (!match || !["100644", "100755"].includes(match[1])) {
        throw new Error("Forbidden git file mode or symlink: " + path);
      }
    }
  }
  if (!existsSync("docs/factory/tasks/" + taskId + ".md")) {
    throw new Error("Selected factory task may not be deleted");
  }
  process.stdout.write("Approved changed paths: " + changed.length + "\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { runCli(); } catch (error) {
    process.stderr.write("ASF policy error: " + error.message + "\n");
    process.exitCode = 1;
  }
}
