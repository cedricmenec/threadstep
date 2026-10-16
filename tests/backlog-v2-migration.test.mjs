import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildBacklogIndex, contentSha256 } from "../scripts/asf/backlog-index.mjs";
import { extractFrontmatter } from "../scripts/asf/yaml.mjs";

const root = new URL("../", import.meta.url);
const tasksDir = new URL("backlog/tasks/", root);
const read = url => readFileSync(url, "utf8");

const HISTORICAL = readdirSync(tasksDir)
  .filter(name => /^TS-\d{3}\.md$/.test(name))
  .sort();

const EXPECTED_IDS = ["TS-001", "TS-002", "TS-003", "TS-004", "TS-005", "TS-006",
  "TS-007", "TS-008", "TS-009", "TS-010", "TS-011"];

// The migration uses the Git first-add date as a reproducible proxy; it is
// never an invented authoring date.
const PROXY_DATES = { "2026-10-14": ["TS-001", "TS-002", "TS-003", "TS-004",
  "TS-005", "TS-006", "TS-007"], "2026-10-15": ["TS-008", "TS-009", "TS-010", "TS-011"] };

const DEPENDENCIES = {
  "TS-001": [], "TS-002": [], "TS-003": [], "TS-004": ["TS-001"],
  "TS-005": ["TS-001"], "TS-006": ["TS-001"], "TS-007": ["TS-001"],
  "TS-008": ["TS-007"], "TS-009": ["TS-007"], "TS-010": ["TS-005", "TS-008"],
  "TS-011": ["TS-001", "TS-004", "TS-007", "TS-005"]
};

// One original, unchecked acceptance line per task that declared checkboxes.
// The migration must not alter these historical criteria.
const PRESERVED_CHECKBOXES = {
  "TS-004": "- [ ] With three subjects A, B, C, move C up once: the visible order becomes A, C, B.",
  "TS-005": "- [ ] An existing action shows an accessible « Modifier » button; activating it",
  "TS-006": "- [ ] The default view shows completed and unfinished actions as before.",
  "TS-007": "- [ ] With urgent, normal and later unfinished top-level actions across subjects,",
  "TS-008": "- [ ] Choisir une action A affiche une seule carte « Je reprends ici » ; choisir B remplace A.",
  "TS-009": "- [ ] La carte conserve son unique action, son sujet, son titre, sa priorité",
  "TS-010": "- [ ] Un clic/tap sur « Retirer » enlève immédiatement l'étape,",
  "TS-011": "- [ ] Dans un sujet contenant A (urgent), B (normal), C (normal)"
};

function frontmatterOf(id) {
  const text = read(new URL(id + ".md", tasksDir));
  const parsed = extractFrontmatter(text);
  assert.ok(parsed, id + " must start with a closed V2 frontmatter block");
  return { text, fields: parsed.fields, body: parsed.body };
}

function sha256(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

test("every historical task is migrated to the complete V2 frontmatter", () => {
  assert.deepEqual(HISTORICAL, EXPECTED_IDS.map(id => id + ".md"));
  for (const id of EXPECTED_IDS) {
    const { fields, body } = frontmatterOf(id);
    assert.equal(fields.schema_version, "2", id);
    assert.equal(fields.id, id, id);
    assert.deepEqual(Object.keys(fields).sort(), ["automation", "created_at",
      "depends_on", "id", "priority", "risk", "schema_version", "status", "type"], id);
    assert.ok(["product", "factory"].includes(fields.type), id);
    assert.ok(["proposed", "ready", "on_hold", "canceled"].includes(fields.status), id);
    assert.ok(["critical", "high", "normal", "low"].includes(fields.priority), id);
    assert.ok(["low", "medium", "high", "unknown"].includes(fields.risk), id);
    assert.equal(fields.automation, "manual", id);
    assert.deepEqual(fields.depends_on, DEPENDENCIES[id], id);
    assert.match(body, new RegExp("(^|\\n)# " + id + " \\| "), id + " must keep its original H1 title");
  }
});

test("created_at uses the documented Git-add proxy, never an invented date", () => {
  for (const [date, ids] of Object.entries(PROXY_DATES)) {
    for (const id of ids) {
      assert.equal(frontmatterOf(id).fields.created_at, date, id);
    }
  }
});

test("no migrated task is automatically selectable by default", () => {
  for (const id of EXPECTED_IDS) {
    const { fields } = frontmatterOf(id);
    assert.notEqual(fields.automation, "allowed", id);
    assert.equal(fields.risk, "unknown", id);
    assert.equal(fields.status, "on_hold", id);
    const autoEligible = fields.type === "product" && fields.status === "ready" &&
      fields.automation === "allowed" && fields.risk === "low";
    assert.equal(autoEligible, false, id + " must never be auto-eligible");
  }
});

test("TS-003 is classified as factory debt outside product eligibility", () => {
  const { fields, body } = frontmatterOf("TS-003");
  assert.equal(fields.type, "factory");
  assert.equal(fields.automation, "manual");
  assert.match(body, /Safe autonomous waves/);
});

test("historical criteria and unchecked checkboxes are preserved verbatim", () => {
  for (const [id, line] of Object.entries(PRESERVED_CHECKBOXES)) {
    assert.ok(frontmatterOf(id).body.includes(line), id + " lost its historical criterion");
  }
  for (const id of EXPECTED_IDS) {
    const text = read(new URL(id + ".md", tasksDir));
    assert.doesNotMatch(text, /^automation:\s*allowed\s*$/im, id);
  }
});

test("the generated index matches the migrated tasks byte for byte", () => {
  const entries = JSON.parse(read(new URL("backlog/index.json", root)));
  assert.deepEqual(entries.map(entry => entry.id), EXPECTED_IDS);
  for (const entry of entries) {
    const text = read(new URL(entry.path, root));
    assert.equal(entry.content_sha256, contentSha256(Buffer.from(text, "utf8")), entry.id);
    assert.equal(entry.content_sha256, sha256(text), entry.id);
    const { fields } = frontmatterOf(entry.id);
    assert.equal(entry.type, fields.type, entry.id);
    assert.equal(entry.automation, fields.automation, entry.id);
    assert.equal(entry.risk, fields.risk, entry.id);
    assert.equal(entry.status, fields.status, entry.id);
    assert.deepEqual(entry.depends_on, fields.depends_on, entry.id);
    assert.equal(entry.created_at, fields.created_at, entry.id);
  }
  assert.deepEqual(JSON.parse(read(new URL("backlog/archive-index.json", root))), []);
});

test("the builder indexes all migrated tasks without diagnostics or archive inference", () => {
  const report = buildBacklogIndex({ root: fileURLToPath(root) });
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(report.legacy, []);
  assert.equal(report.active.length, 11);
  assert.equal(report.archive.length, 0);
});
