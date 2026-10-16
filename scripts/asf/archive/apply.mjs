#!/usr/bin/env node
/**
 * Filesystem application of an archive plan (ASF-V2-010).
 *
 * This adapter is the only place that touches the working tree. It is
 * deliberately dumb and deterministic: it moves exactly the planned tasks,
 * rewrites only the explicit links it is handed and regenerates the Backlog V2
 * index from the resulting files. It never performs Git, GitHub or network I/O,
 * never calls a model and never decides delivery on its own.
 *
 * The privileged publication path (a future GitHub App adapter) builds a
 * documentary branch, calls `applyArchivePlan` inside it and opens a single PR.
 * The pure plan remains the security boundary: zero verified deliveries yield no
 * PR and therefore no filesystem change at all.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generateBacklogIndex } from "../backlog-index.mjs";
import { rewriteBacklogLinks } from "./core.mjs";

function repoPath(root, relative) {
  return join(root, ...relative.split("/"));
}

/**
 * Apply a validated archive plan under `root`. `documents` is the explicit list
 * of repository-relative Markdown files whose `backlog/tasks/<id>.md` links must
 * be rewritten. Returns the moved task ids, the rewritten documents and the
 * regenerated index counts. Throws on any inconsistency so the caller fails
 * closed and leaves no partial PR.
 */
export function applyArchivePlan({ root, plan, documents = [] }) {
  if (!plan || plan.ok !== true || plan.schemaVersion === undefined) {
    throw new Error("A valid archive plan is required");
  }
  if (!plan.pullRequest) {
    return { applied: [], documents: [], index: null };
  }
  const applied = [];
  for (const move of plan.moves) {
    const source = repoPath(root, move.from);
    const destination = repoPath(root, move.to);
    if (!existsSync(source)) {
      throw new Error("Active task is missing: " + move.from);
    }
    if (existsSync(destination)) {
      throw new Error("Archive destination already exists: " + move.to);
    }
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, move.content);
    rmSync(source);
    applied.push(move.taskId);
  }

  const rewritten = [];
  for (const relative of Array.isArray(documents) ? documents : []) {
    const file = repoPath(root, relative);
    if (!existsSync(file)) continue;
    const before = readFileSync(file, "utf8");
    const after = rewriteBacklogLinks(before, plan.moves);
    if (after !== before) {
      writeFileSync(file, after);
      rewritten.push(relative);
    }
  }

  const index = generateBacklogIndex({ root });
  if (!index.written) {
    throw new Error('Index regeneration failed: ' + JSON.stringify(index.problems));
  }
  return {
    applied,
    documents: rewritten,
    index: { activeCount: index.activeCount, archiveCount: index.archiveCount }
  };
}
