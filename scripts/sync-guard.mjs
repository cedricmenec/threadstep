#!/usr/bin/env node
/**
 * Fail closed when a semantic OpenSpec sync touches anything outside
 * openspec/specs/. Uses real file bytes (including already-dirty files), not
 * only git status/name lists. Intended for an isolated GitHub Actions checkout.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";

const SPECS_PREFIX = "openspec/specs/";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function allPaths() {
  const raw = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  return [...new Set(raw.toString("utf8").split("\0").filter(Boolean))].sort();
}

function digest(path) {
  if (!existsSync(path)) return "deleted";
  const stat = lstatSync(path);
  const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(path)) : readFileSync(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  return [stat.mode.toString(8), stat.isSymbolicLink() ? "link" : "file", hash].join(":");
}

function inventory() {
  const outside = {};
  const specs = {};
  for (const path of allPaths()) {
    (path.startsWith(SPECS_PREFIX) ? specs : outside)[path] = digest(path);
  }
  return { version: 1, head: git("rev-parse", "HEAD"), outside, specs };
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function check(before, after) {
  if (before.version !== 1 || !before.outside || !before.specs) {
    throw new Error("Invalid guard snapshot");
  }
  if (before.head !== after.head) throw new Error("Semantic sync changed HEAD");
  if (!same(before.outside, after.outside)) {
    const paths = new Set([...Object.keys(before.outside), ...Object.keys(after.outside)]);
    const changed = [...paths].filter(p => before.outside[p] !== after.outside[p]);
    throw new Error("Semantic sync changed files outside canonical specs: " + changed.join(", "));
  }
  if (same(before.specs, after.specs)) {
    throw new Error("Semantic sync made no changes to canonical specs");
  }
}

try {
  const [mode, snapshotPath] = process.argv.slice(2);
  if (!snapshotPath || !["snapshot", "verify"].includes(mode)) {
    throw new Error("Usage: node scripts/sync-guard.mjs snapshot|verify <snapshot-path>");
  }
  if (mode === "snapshot") {
    writeFileSync(snapshotPath, JSON.stringify(inventory()));
  } else {
    check(JSON.parse(readFileSync(snapshotPath, "utf8")), inventory());
    console.log("Semantic sync scope verified: only openspec/specs/ changed");
  }
} catch (error) {
  console.error("::error::" + error.message);
  process.exitCode = 1;
}
