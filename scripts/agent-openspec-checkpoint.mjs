#!/usr/bin/env node
/**
 * ASF-OPSX-06: checkpoint/publication guard for coding agents.
 *
 * Plan is intentionally limited to a single OpenSpec change. Apply and
 * publication use a DENYLIST of protected paths, not a list of product
 * files. New product tooling or assets must not require an ASF policy PR.
 *
 * This guard is always loaded from trusted origin/main by the workflow.
 * Gitignore is useful hygiene, but tracked files and git add -f bypass it.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PROTECTED_PREFIXES = Object.freeze([
  ".github/", ".agents/", ".opencode/", "scripts/",
  "backlog/", "docs/factory/",
]);

const PROTECTED_FILES = new Set([
  "AGENTS.md", "ChatGPT.md", "opencode.json", "openspec/config.yaml",
  ".gitmodules", ".gitattributes", ".gitconfig", ".npmrc", ".netrc",
]);

const UNTRACKED_OUTPUT_PARTS = new Set([
  ".git", ".cache", ".venv", "node_modules", "coverage", "__pycache__",
]);

function safePath(path) {
  return typeof path === "string" && path.length > 0 &&
    !path.startsWith("/") && !path.endsWith("/") &&
    !path.includes("\\") && !/[\u0000-\u001f\u007f]/.test(path) &&
    path.split("/").every(part => part && part !== "." && part !== "..");
}

function sensitiveFile(path) {
  const basename = path.split("/").at(-1).toLowerCase();
  return basename === ".env" || basename === ".envrc" ||
    (basename.startsWith(".env.") && basename !== ".env.example") ||
    basename === ".npmrc" || basename === ".netrc" ||
    basename === "dexie-cloud.json" || basename === "dexie-cloud.key" ||
    /\.(?:pem|p12|pfx|key|log)$/.test(basename) ||
    /^(?:id_rsa|id_ed25519)(?:\.pub)?$/.test(basename);
}

export function allowedCheckpointPath(phase, changeId, path) {
  if (!/^ts-[0-9]{3}$/.test(changeId) || !safePath(path)) return false;
  const plan = `openspec/changes/${changeId}/`;
  if (phase !== "plan" && phase !== "apply" && phase !== "publish") return false;

  // Sensitive files are always forbidden, including when hidden inside
  // an otherwise legitimate OpenSpec plan directory.
  if (path.split("/").some(part => UNTRACKED_OUTPUT_PARTS.has(part)) ||
      sensitiveFile(path)) return false;
  if (phase === "plan") return path.startsWith(plan);

  // Entries are checked *before* git add -A and again after staging.
  // The tree may include arbitrary new product code, build tools and
  // dependency metadata, but not protected factory inputs or secrets.
  if (PROTECTED_FILES.has(path) ||
      PROTECTED_PREFIXES.some(prefix => path.startsWith(prefix)) ||
      path.split("/").some(part => UNTRACKED_OUTPUT_PARTS.has(part))) return false;

  if (path.startsWith("openspec/")) {
    // During paid implementation neither canonical specs nor other
    // tasks' plans may change. Sync/archive are separate workflow steps.
    if (path.startsWith(plan)) return true;
    if (phase === "apply") return false;

    // Publication may include only canonical specs + THIS change's archive.
    if (path.startsWith("openspec/specs/")) return true;
    const archive = path.match(/^openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-(ts-\d{3})\//);
    return archive?.[1] === changeId;
  }
  return true;
}

export function checkCheckpointPaths(phase, changeId, paths) {
  if (!["plan", "apply", "publish"].includes(phase)) throw Error("Unknown checkpoint phase");
  if (!/^ts-[0-9]{3}$/.test(changeId)) throw Error("Invalid OpenSpec change ID");
  const entries = [...new Set(paths.filter(Boolean))];
  if (!entries.length) throw Error("Empty checkpoint: no changes to commit");
  const forbidden = entries.filter(path => !allowedCheckpointPath(phase, changeId, path));
  if (forbidden.length) throw Error("Checkpoint has forbidden paths: " + forbidden.join(", "));
  return entries.length;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function changedCheckpointPaths() {
  return [
    git("diff", "--no-renames", "--name-only", "origin/main...HEAD"),
    git("diff", "--no-renames", "--name-only"),
    git("diff", "--cached", "--no-renames", "--name-only"),
    git("ls-files", "--others", "--exclude-standard"),
  ].flatMap(output => output ? output.split("\n") : []);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , phase, changeId] = process.argv;
    if (process.argv.length !== 4) throw Error("Usage: agent-openspec-checkpoint.mjs <plan|apply|publish> <ts-nnn>");
    const count = checkCheckpointPaths(phase, changeId, changedCheckpointPaths());
    console.log(`OpenSpec ${phase} checkpoint scope verified: ${count} paths`);
  } catch (error) {
    console.error("::error::OpenSpec checkpoint refused: " + error.message);
    process.exitCode = 1;
  }
}
