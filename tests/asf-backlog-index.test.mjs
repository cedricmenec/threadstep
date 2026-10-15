import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENUMS, ID_PATTERN, buildBacklogIndex, checkBacklogIndex, generateBacklogIndex,
  serializeIndex
} from "../scripts/asf/backlog-index.mjs";
import { extractFrontmatter } from "../scripts/asf/yaml.mjs";

const cli = fileURLToPath(new URL("../scripts/asf/backlog-cli.mjs", import.meta.url));

function taskMarkdown({ id, type = "product", status = "ready", priority = "normal",
  automation = "allowed", risk = "low", dependsOn = [], createdAt = "2026-10-16",
  delivery = null, body = "Unique body for " + id } = {}) {
  const lines = ["---", "schema_version: 2", "id: " + id, "type: " + type,
    "status: " + status, "priority: " + priority, "automation: " + automation,
    "risk: " + risk];
  if (dependsOn.length) {
    lines.push("depends_on:");
    for (const dependency of dependsOn) lines.push("  - " + dependency);
  } else {
    lines.push("depends_on: []");
  }
  lines.push("created_at: " + createdAt);
  if (delivery) {
    lines.push("delivery:");
    for (const [key, value] of Object.entries(delivery)) lines.push("  " + key + ": " + value);
  }
  lines.push("---", "", "# " + id + " | Title", "", body, "");
  return lines.join("\n");
}

function repo(t, { tasks = {}, archive = {}, legacy = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "asf-backlog-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  mkdirSync(join(root, "backlog", "archive"), { recursive: true });
  for (const [name, content] of Object.entries(tasks)) {
    writeFileSync(join(root, "backlog", "tasks", name), content);
  }
  for (const [name, content] of Object.entries(archive)) {
    writeFileSync(join(root, "backlog", "archive", name), content);
  }
  for (const [name, content] of Object.entries(legacy)) {
    writeFileSync(join(root, "backlog", "tasks", name), content);
  }
  return root;
}

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function messages(diagnostics) {
  return diagnostics.map(entry => entry.path + ": " + entry.message).join("\n");
}

test("parses the required frontmatter contract into typed nodes", () => {
  const { fields } = extractFrontmatter(taskMarkdown({ id: "TS-001", dependsOn: ["TS-000"] }));
  assert.equal(fields.schema_version, "2");
  assert.deepEqual(fields.depends_on, ["TS-000"]);
  assert.equal(fields.created_at, "2026-10-16");
});

test("100 fictional tasks yield a byte-identical index without network or body text", (t) => {
  const tasks = {};
  for (let index = 1; index <= 100; index++) {
    const id = "TS-" + String(index).padStart(3, "0");
    const previous = index > 1 ? ["TS-" + String(index - 1).padStart(3, "0")] : [];
    tasks[id + ".md"] = taskMarkdown({ id, dependsOn: previous, body: "Secret body " + id });
  }
  const root = repo(t, { tasks });
  const first = buildBacklogIndex({ root });
  const second = buildBacklogIndex({ root });
  assert.deepEqual(first.diagnostics, []);
  assert.equal(first.active.length, 100);
  const serialized = serializeIndex(first.active);
  assert.equal(serialized, serializeIndex(second.active));
  const cards = JSON.parse(serialized);
  assert.equal(cards.length, 100);
  assert.deepEqual(cards.map(card => card.id), [...cards.map(card => card.id)].sort());
  for (const card of cards) {
    assert.match(card.content_sha256, /^[a-f0-9]{64}$/);
    assert.equal(typeof card.path, "string");
    assert.ok(!serialized.includes("Secret body"), "Markdown body must never enter the index");
  }
});

test("a duplicate key fails with a diagnostic", (t) => {
  const broken = "---\nschema_version: 2\nid: TS-001\nid: TS-002\n" +
    "type: product\nstatus: ready\npriority: normal\nautomation: allowed\n" +
    "risk: low\ndepends_on: []\ncreated_at: 2026-10-16\n---\n\n# x\n";
  const root = repo(t, { tasks: { "TS-001.md": broken } });
  const { diagnostics } = buildBacklogIndex({ root });
  assert.match(messages(diagnostics), /Duplicate key "id"/);
  assert.equal(generateBacklogIndex({ root }).written, false);
});

test("a dependency cycle fails with a diagnostic", (t) => {
  const root = repo(t, { tasks: {
    "TS-001.md": taskMarkdown({ id: "TS-001", dependsOn: ["TS-002"] }),
    "TS-002.md": taskMarkdown({ id: "TS-002", dependsOn: ["TS-001"] })
  } });
  const { diagnostics } = buildBacklogIndex({ root });
  assert.match(messages(diagnostics), /dependency cycle/);
});

test("a duplicated id across active and archive fails with a diagnostic", (t) => {
  const root = repo(t, {
    tasks: { "TS-001.md": taskMarkdown({ id: "TS-001" }) },
    archive: { "TS-001.md": taskMarkdown({ id: "TS-001" }) }
  });
  const { diagnostics } = buildBacklogIndex({ root });
  assert.match(messages(diagnostics), /duplicate task id "TS-001"/);
});

test("an outdated or missing index fails in check mode without writing", (t) => {
  const root = repo(t, { tasks: { "TS-001.md": taskMarkdown({ id: "TS-001" }) } });
  const missing = run(["check", "--root", root]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /missing generated index/);

  const generated = run(["generate", "--root", root]);
  assert.equal(generated.status, 0, generated.stderr);
  const indexFile = join(root, "backlog", "index.json");
  const before = readFileSync(indexFile, "utf8");
  assert.doesNotMatch(before, /Unique body/);

  writeFileSync(join(root, "backlog", "tasks", "TS-001.md"),
    taskMarkdown({ id: "TS-001", body: "Changed body" }));
  const stale = run(["check", "--root", root]);
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /outdated or diverges/);
  assert.equal(readFileSync(indexFile, "utf8"), before, "check must not rewrite the index");

  assert.equal(run(["generate", "--root", root]).status, 0);
  assert.equal(run(["check", "--root", root]).status, 0);
});

test("a valid archived dependency is accepted and never inferred as delivered", (t) => {
  const root = repo(t, {
    tasks: { "TS-010.md": taskMarkdown({ id: "TS-010", dependsOn: ["TS-005"] }) },
    archive: { "TS-005.md": taskMarkdown({ id: "TS-005" }) }
  });
  const { active, archive, diagnostics } = buildBacklogIndex({ root });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(active[0].depends_on, ["TS-005"]);
  assert.equal(archive[0].delivery, null, "presence in archive must not prove delivery");
  assert.ok(!serializeIndex(archive).includes("verified"));
});

test("explicit archive delivery evidence is kept separate from location", (t) => {
  const root = repo(t, {
    archive: { "TS-005.md": taskMarkdown({ id: "TS-005", delivery: {
      pull_request: "26", merge_sha: "a".repeat(40), head_sha: "b".repeat(40), verified: "true"
    } }) }
  });
  const { archive, diagnostics } = buildBacklogIndex({ root });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(archive[0].delivery, {
    pull_request: "26", merge_sha: "a".repeat(40), head_sha: "b".repeat(40), verified: "true"
  });
});

test("unknown dependencies, self references and unsafe values fail closed", (t) => {
  const root = repo(t, { tasks: {
    "TS-001.md": taskMarkdown({ id: "TS-001", dependsOn: ["TS-999"] }),
    "TS-002.md": taskMarkdown({ id: "TS-002", dependsOn: ["TS-002"] }),
    "TS-003.md": taskMarkdown({ id: "TS-003", risk: "unknownish" }),
    "TS-004.md": taskMarkdown({ id: "TS-004", status: "merged" })
  } });
  const { diagnostics } = buildBacklogIndex({ root });
  const text = messages(diagnostics);
  assert.match(text, /unknown dependency "TS-999"/);
  assert.match(text, /cannot depend on itself/);
  assert.match(text, /invalid risk "unknownish"/);
  assert.match(text, /invalid status "merged"/);
});

test("missing required fields and file/id mismatches are reported", (t) => {
  const missing = "---\nschema_version: 2\nid: TS-001\ntype: product\nstatus: ready\n" +
    "priority: normal\nautomation: allowed\nrisk: low\ncreated_at: 2026-10-16\n---\n\n# x\n";
  const root = repo(t, { tasks: {
    "TS-001.md": missing,
    "TS-002.md": taskMarkdown({ id: "TS-009" })
  } });
  const { diagnostics } = buildBacklogIndex({ root });
  const text = messages(diagnostics);
  assert.match(text, /missing required field "depends_on"/);
  assert.match(text, /does not match id/);
});

test("legacy Markdown without V2 frontmatter is excluded, not an error", (t) => {
  const root = repo(t, { legacy: {
    "TS-001.md": "# TS-001 | Old task\n\nStatus: implemented\n"
  } });
  const { active, diagnostics, legacy } = buildBacklogIndex({ root });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(active, []);
  assert.deepEqual(legacy, ["backlog/tasks/TS-001.md"]);
});

test("schema, id pattern and enum definitions match the published contract", () => {
  assert.ok(ID_PATTERN.test("TS-001"));
  assert.ok(ID_PATTERN.test("TS-1000"));
  assert.ok(!ID_PATTERN.test("ts-001"));
  assert.ok(!ID_PATTERN.test("../TS-001"));
  assert.deepEqual(ENUMS.type, ["product", "factory"]);
  assert.deepEqual(ENUMS.status, ["proposed", "ready", "on_hold", "canceled"]);
  assert.ok(ENUMS.risk.includes("unknown"));
});

test("check reports missing archives directory as empty without failing the CLI contract", (t) => {
  const root = repo(t, { tasks: { "TS-001.md": taskMarkdown({ id: "TS-001" }) } });
  rmSync(join(root, "backlog", "archive"), { recursive: true, force: true });
  assert.equal(run(["generate", "--root", root]).status, 0);
  assert.equal(readFileSync(join(root, "backlog", "archive-index.json"), "utf8"), "[]\n");
  assert.equal(run(["check", "--root", root]).status, 0);
});

test("checkBacklogIndex is read-only and reports divergence as data", (t) => {
  const root = repo(t, { tasks: { "TS-001.md": taskMarkdown({ id: "TS-001" }) } });
  const report = checkBacklogIndex({ root });
  assert.equal(report.activeCount, 1);
  assert.equal(report.problems.length, 2);
  assert.ok(!existsSync(join(root, "backlog", "index.json")));
});
