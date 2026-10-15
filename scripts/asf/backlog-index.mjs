#!/usr/bin/env node
/**
 * Deterministic Backlog V2 index builder and strict validator (ASF-V2-002).
 *
 * Reads only the Markdown task files under `backlog/tasks/` and
 * `backlog/archive/`, validates their versioned frontmatter and produces
 * compact JSON projections. It uses no network, no model and no third-party
 * dependency. The archive projection never infers `delivered` from the mere
 * presence of a file in `backlog/archive/`: delivery evidence must be explicit.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractFrontmatter, FrontmatterError } from "./yaml.mjs";

export const SCHEMA_VERSION = "2";
export const REQUIRED_FIELDS = Object.freeze(["schema_version", "id", "type", "status",
  "priority", "automation", "risk", "depends_on", "created_at"]);
export const ENUMS = Object.freeze({
  type: ["product", "factory"],
  status: ["proposed", "ready", "on_hold", "canceled"],
  priority: ["critical", "high", "normal", "low"],
  automation: ["allowed", "manual"],
  risk: ["low", "medium", "high", "unknown"]
});
export const ID_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{1,4}$/;
export const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const DELIVERY_FIELDS = Object.freeze(["pull_request", "pull_request_url", "merge_sha",
  "head_sha", "verified"]);
const ACTIVE_FIELDS = new Set(REQUIRED_FIELDS);
const ARCHIVE_FIELDS = new Set([...REQUIRED_FIELDS, "delivery"]);

export function serializeIndex(entries) {
  return JSON.stringify(entries, null, 2) + "\n";
}

export function contentSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function codeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toRepoPath(root, absolute) {
  return relative(root, absolute).split(sep).join("/");
}

export function buildBacklogIndex({ root }) {
  const diagnostics = [];
  const legacy = [];
  const records = [];

  const collect = (directory, location) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => codeUnit(a.name, b.name))) {
      if (entry.name === "TEMPLATE.md" || entry.name.startsWith(".")) continue;
      if (!entry.name.endsWith(".md")) continue;
      const absolute = join(directory, entry.name);
      const stats = lstatSync(absolute);
      if (stats.isSymbolicLink()) {
        diagnostics.push(diagnostic(absolute, "symlinked task files are not supported"));
        continue;
      }
      if (!stats.isFile()) continue;
      const bytes = readFileSync(absolute);
      records.push({ absolute, location, bytes, text: bytes.toString("utf8") });
    }
  };

  collect(join(root, "backlog", "tasks"), "active");
  collect(join(root, "backlog", "archive"), "archive");

  const cards = [];
  for (const record of records) {
    const repoPath = toRepoPath(root, record.absolute);
    let frontmatter;
    try {
      frontmatter = extractFrontmatter(record.text);
    } catch (error) {
      if (error instanceof FrontmatterError) {
        diagnostics.push(diagnostic(repoPath, error.message));
        continue;
      }
      throw error;
    }
    if (!frontmatter) {
      legacy.push(repoPath);
      continue;
    }
    const { card, errors } = normalizeTask(frontmatter.fields, {
      location: record.location, repoPath, sha256: contentSha256(record.bytes)
    });
    for (const message of errors) diagnostics.push(diagnostic(repoPath, message));
    if (card) cards.push(card);
  }

  const byId = new Map();
  for (const card of cards) {
    const existing = byId.get(card.id);
    if (existing) {
      diagnostics.push(diagnostic(card.path, 'duplicate task id "' + card.id +
        '" already defined in ' + existing.path));
      continue;
    }
    byId.set(card.id, card);
  }

  for (const card of cards) {
    const expected = card.path.split("/").pop().replace(/\.md$/, "");
    if (expected !== card.id) {
      diagnostics.push(diagnostic(card.path, 'file name "' + expected +
        '" does not match id "' + card.id + '"'));
    }
  }

  for (const card of cards) {
    for (const dependency of card.depends_on) {
      if (!byId.has(dependency)) {
        diagnostics.push(diagnostic(card.path, 'unknown dependency "' + dependency + '"'));
      }
    }
  }

  for (const cycle of findCycles(byId)) {
    diagnostics.push(diagnostic(byId.get(cycle[0]).path, "dependency cycle: " + cycle.join(" -> ")));
  }

  const active = cards.filter(card => card.path.startsWith("backlog/tasks/")).sort((a, b) => codeUnit(a.id, b.id));
  const archive = cards.filter(card => card.path.startsWith("backlog/archive/")).sort((a, b) => codeUnit(a.id, b.id));
  legacy.sort(codeUnit);
  diagnostics.sort((a, b) => codeUnit(a.path, b.path) || codeUnit(a.message, b.message));
  return { active, archive, legacy, diagnostics };
}

function diagnostic(path, message) {
  return { path, message };
}

function normalizeTask(fields, { location, repoPath, sha256 }) {
  const errors = [];
  const allowed = location === "archive" ? ARCHIVE_FIELDS : ACTIVE_FIELDS;
  for (const key of Object.keys(fields).sort(codeUnit)) {
    if (!allowed.has(key)) errors.push('unknown field "' + key + '"');
  }

  const scalar = key => {
    const value = fields[key];
    if (value === undefined) { errors.push('missing required field "' + key + '"'); return undefined; }
    if (typeof value !== "string") { errors.push('field "' + key + '" must be a scalar value'); return undefined; }
    return value;
  };

  const schemaVersion = scalar("schema_version");
  if (schemaVersion !== undefined && schemaVersion !== SCHEMA_VERSION) {
    errors.push('unsupported schema_version "' + schemaVersion + '" (expected ' + SCHEMA_VERSION + ")");
  }
  const id = scalar("id");
  if (id !== undefined && !ID_PATTERN.test(id)) errors.push('unsafe or malformed id "' + id + '"');
  for (const key of ["type", "status", "priority", "automation", "risk"]) {
    const value = scalar(key);
    if (value !== undefined && !ENUMS[key].includes(value)) {
      errors.push('invalid ' + key + ' "' + value + '"');
    }
  }
  const createdAt = scalar("created_at");
  if (createdAt !== undefined && !isIsoDate(createdAt)) {
    errors.push('created_at "' + createdAt + '" is not an ISO YYYY-MM-DD date');
  }

  const dependsOn = [];
  if (fields.depends_on === undefined) {
    errors.push('missing required field "depends_on"');
  } else if (!Array.isArray(fields.depends_on)) {
    errors.push('field "depends_on" must be a list');
  } else {
    const seen = new Set();
    for (const dependency of fields.depends_on) {
      if (typeof dependency !== "string" || !ID_PATTERN.test(dependency)) {
        errors.push('unsafe dependency "' + String(dependency) + '"');
        continue;
      }
      if (seen.has(dependency)) { errors.push('duplicate dependency "' + dependency + '"'); continue; }
      if (dependency === id) { errors.push("a task cannot depend on itself"); continue; }
      seen.add(dependency);
      dependsOn.push(dependency);
    }
  }

  let delivery;
  if (location === "archive" && fields.delivery !== undefined && fields.delivery !== null) {
    if (typeof fields.delivery !== "object" || Array.isArray(fields.delivery)) {
      errors.push('field "delivery" must be a mapping');
    } else {
      delivery = {};
      for (const key of Object.keys(fields.delivery).sort(codeUnit)) {
        if (!DELIVERY_FIELDS.includes(key)) { errors.push('unknown delivery field "' + key + '"'); continue; }
        const value = fields.delivery[key];
        if (typeof value !== "string") { errors.push('delivery field "' + key + '" must be a scalar value'); continue; }
        if (key === "pull_request" && !/^[1-9][0-9]*$/.test(value)) {
          errors.push('delivery "pull_request" must be a positive integer');
        } else if (key === "pull_request_url" && !/^https:\/\/[^\s]+$/.test(value)) {
          errors.push('delivery "pull_request_url" must be an https URL');
        } else if ((key === "merge_sha" || key === "head_sha") && !GIT_SHA_PATTERN.test(value)) {
          errors.push('delivery "' + key + '" must be a 40-character hex SHA');
        } else if (key === "verified" && !["true", "false"].includes(value)) {
          errors.push('delivery "verified" must be true or false');
        } else {
          delivery[key] = value;
        }
      }
    }
  }

  if (errors.length) return { card: null, errors };
  const card = {
    id,
    path: repoPath,
    type: fields.type,
    status: fields.status,
    priority: fields.priority,
    automation: fields.automation,
    risk: fields.risk,
    depends_on: dependsOn,
    created_at: createdAt,
    content_sha256: sha256
  };
  if (location === "archive") card.delivery = delivery ?? null;
  return { card, errors };
}

function isIsoDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function findCycles(nodes) {
  const cycles = [];
  const seen = new Set();
  const state = new Map();
  const stack = [];
  const visit = id => {
    state.set(id, 1);
    stack.push(id);
    for (const dependency of nodes.get(id).depends_on) {
      if (!nodes.has(dependency)) continue;
      const status = state.get(dependency) ?? 0;
      if (status === 1) {
        const cycle = stack.slice(stack.indexOf(dependency)).concat(dependency);
        const key = [...cycle].sort(codeUnit).join(",");
        if (!seen.has(key)) { seen.add(key); cycles.push(cycle); }
      } else if (status === 0) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of [...nodes.keys()].sort(codeUnit)) {
    if ((state.get(id) ?? 0) === 0) visit(id);
  }
  return cycles;
}

export function formatDiagnostics(diagnostics) {
  return diagnostics.map(({ path, message }) => path + ": " + message + "\n").join("");
}

export function checkBacklogIndex({ root }) {
  const { active, archive, diagnostics } = buildBacklogIndex({ root });
  const problems = [...diagnostics];
  for (const [name, entries] of [["backlog/index.json", active], ["backlog/archive-index.json", archive]]) {
    const expected = serializeIndex(entries);
    const file = join(root, ...name.split("/"));
    if (!existsSync(file)) {
      problems.push(diagnostic(name, 'missing generated index; run "npm run backlog:index"'));
      continue;
    }
    if (readFileSync(file, "utf8") !== expected) {
      problems.push(diagnostic(name, "index is outdated or diverges from task files; run \"npm run backlog:index\""));
    }
  }
  return { activeCount: active.length, archiveCount: archive.length, problems };
}

export function generateBacklogIndex({ root }) {
  const { active, archive, diagnostics } = buildBacklogIndex({ root });
  if (diagnostics.length) return { written: false, activeCount: active.length, archiveCount: archive.length, problems: diagnostics };
  writeFileSync(join(root, "backlog", "index.json"), serializeIndex(active));
  writeFileSync(join(root, "backlog", "archive-index.json"), serializeIndex(archive));
  return { written: true, activeCount: active.length, archiveCount: archive.length, problems: [] };
}
