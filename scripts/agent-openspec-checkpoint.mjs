#!/usr/bin/env node
/**
 * ASF-OPSX-03: fail-closed checkpoint scope before publishing intermediate
 * OpenSpec commits. Keep credentials and generated runner instructions out.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function allowedCheckpointPath(phase, changeId, path) {
  if (!/^(?:ts-[0-9]{3})$/.test(changeId) || !path || path.startsWith("/") ||
      path.split("/").includes("..") || path.includes("\\") || path.includes("\n")) return false;
  const plan = `openspec/changes/${changeId}/`;
  if (phase === "plan") return path.startsWith(plan);
  if (phase === "apply") return (
    path.startsWith(plan) ||
    path.startsWith("site/") ||
    path.startsWith("tests/") ||
    path.startsWith("docs/product/")
  );
  return false;
}

export function checkCheckpointPaths(phase, changeId, paths) {
  if (phase !== "plan" && phase !== "apply") throw Error("Unknown checkpoint phase");
  if (!/^(?:ts-[0-9]{3})$/.test(changeId)) throw Error("Invalid OpenSpec change ID");
  const entries = [...new Set(paths.filter(Boolean))];
  if (!entries.length) throw Error("Empty checkpoint: no changes to commit");
  const forbidden = entries.filter(p => !allowedCheckpointPath(phase, changeId, p));
  if (forbidden.length) throw Error("Checkpoint has forbidden paths: " + forbidden.join(", "));
  return entries.length;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function changedCheckpointPaths() {
  return [
    git("diff", "--name-only", "origin/main...HEAD"),
    git("diff", "--name-only"),
    git("diff", "--cached", "--name-only"),
    git("ls-files", "--others", "--exclude-standard"),
  ].flatMap(output => output ? output.split("\n") : []);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , phase, changeId] = process.argv;
    if (process.argv.length !== 4) throw Error("Usage: agent-openspec-checkpoint.mjs <plan|apply> <ts-nnn>");
    const count = checkCheckpointPaths(phase, changeId, changedCheckpointPaths());
    console.log(`OpenSpec ${phase} checkpoint scope verified: ${count} paths`);
  } catch (error) {
    console.error("::error::OpenSpec checkpoint refused: " + error.message);
    process.exitCode = 1;
  }
}
