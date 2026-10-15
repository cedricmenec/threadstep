import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = relative => readFileSync(new URL(relative, root), "utf8");

function frontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  assert.ok(match, "task template must start with a closed YAML frontmatter block");
  const fields = {};
  for (const raw of match[1].split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf(":");
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

const REQUIRED_FIELDS = ["schema_version", "id", "type", "status", "priority",
  "automation", "risk", "depends_on", "created_at"];

test("V2 template declares exactly the required frontmatter contract", () => {
  const fields = frontmatter(read("backlog/tasks/TEMPLATE.md"));
  assert.deepEqual(Object.keys(fields).sort(), [...REQUIRED_FIELDS].sort());
  assert.equal(fields.schema_version, "2");
});

test("V2 template encodes the fail-safe generation defaults", () => {
  const fields = frontmatter(read("backlog/tasks/TEMPLATE.md"));
  assert.equal(fields.type, "product");
  assert.equal(fields.status, "proposed");
  assert.equal(fields.automation, "allowed");
  assert.equal(fields.risk, "unknown");
  assert.equal(fields.depends_on, "[]");
});

test("contract documents every enum value", () => {
  const doc = read("docs/factory/backlog-v2-task-contract.md");
  for (const value of ["product", "factory", "proposed", "ready", "on_hold",
    "canceled", "critical", "high", "normal", "low", "allowed", "manual",
    "medium", "unknown"]) {
    assert.ok(doc.includes("`" + value + "`"), "enum value missing: " + value);
  }
});

test("contract separates declarative state from operational GitHub state", () => {
  const doc = read("docs/factory/backlog-v2-task-contract.md");
  assert.match(doc, /[ÉE]tat déclaratif/i);
  assert.match(doc, /GitHub/);
  assert.match(doc, /sans seconde promotion/i);
});

test("AGENTS.md and ChatGPT.md carry the generation directives", () => {
  for (const file of ["AGENTS.md", "ChatGPT.md"]) {
    const text = read(file);
    for (const directive of ["schema_version: 2", "automation: allowed",
      "status: ready", "risk: unknown", "type: factory", "Automation: manual",
      "TS-NNN", "ASF-*"]) {
      assert.ok(text.includes(directive), file + " missing directive: " + directive);
    }
  }
});

test("factory V2 task descriptions are explicitly manual", () => {
  const dir = new URL("docs/factory/tasks/", root);
  const files = readdirSync(dir).filter(name => /^ASF-V2-\d{3}\.md$/.test(name));
  assert.ok(files.length >= 11, "expected the eleven ASF-V2 task files");
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), "utf8");
    assert.match(text, /^Automation:\s*manual\s*$/im, file);
    assert.doesNotMatch(text, /^Automation:\s*allowed\s*$/im, file);
  }
});

test("historical backlog tasks never claim automatic eligibility", () => {
  const dir = new URL("backlog/tasks/", root);
  const files = readdirSync(dir).filter(name => /^TS-\d{3}\.md$/.test(name));
  assert.ok(files.length > 0, "expected existing historical tasks");
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(text, /^automation:\s*allowed\s*$/im, file);
  }
});
