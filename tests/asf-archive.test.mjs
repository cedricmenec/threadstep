import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARCHIVE_SCHEMA_VERSION, ARCHIVE_RESULT, ARCHIVE_BLOCK_REASON,
  ARCHIVE_OUTCOME_REASON, ARCHIVE_BRANCH_PATTERN, DELIVERY_FIELD_ORDER,
  archiveBranchFor, validateDeliveryProof, selectArchivable, renderArchivedTask,
  buildArchivePlan, rewriteBacklogLinks, evaluateArchiveOutcome,
  toExecutionEvidence, summarizeArchivePlan
} from "../scripts/asf/archive/core.mjs";
import { applyArchivePlan } from "../scripts/asf/archive/apply.mjs";
import { extractFrontmatter } from "../scripts/asf/yaml.mjs";
import {
  AGENT_BRANCH_PATTERN, ARCHIVE_BRANCH_PATTERN as MERGE_ARCHIVE_BRANCH_PATTERN,
  isAgentBranch, isArchiveBranch, isAcceptedAutoMergeBranch, applicableMainRule,
  validateAutoMergePrerequisites, validateAutoMergeTarget
} from "../scripts/request-safe-auto-merge.mjs";

const repository = "cedricmenec/threadstep";
const headSha = "a".repeat(40);
const mergeSha = "b".repeat(40);

function verified(taskId, overrides = {}) {
  return {
    taskId, status: "verified",
    proof: { profile: "openspec", pr: 60, headSha, mergeSha, ...overrides }
  };
}

function card(id, content) {
  return { id, path: "backlog/tasks/" + id + ".md", content };
}

const TASK_BODY = [
  "---",
  "schema_version: 2",
  "id: TS-010",
  "type: product",
  "status: on_hold",
  "priority: normal",
  "automation: manual",
  "risk: unknown",
  "depends_on: []",
  "created_at: 2026-10-14",
  "---",
  "",
  "# TS-010 | Annuler le retrait (snackbar)",
  "",
  "## Critères d'acceptation",
  "",
  "- [ ] Un premier critère non coché",
  "- [x] Un critère déjà coché historiquement",
  ""
].join("\n");

// ---------------------------------------------------------------------------
// Single documentary PR; zero delivery => no PR (acceptance criterion 1)
// ---------------------------------------------------------------------------

test("two verified deliveries produce exactly one documentary PR", () => {
  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-010"), verified("TS-011", { pr: 61 })],
    tasks: [card("TS-010", TASK_BODY), card("TS-011", TASK_BODY.replace(/TS-010/g, "TS-011"))]
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.schemaVersion, ARCHIVE_SCHEMA_VERSION);
  assert.equal(plan.pullRequest !== null, true);
  assert.equal(plan.pullRequest.base, "main");
  assert.equal(plan.pullRequest.branch, "asf/archive/wave-123");
  assert.deepEqual(plan.pullRequest.tasks, ["TS-010", "TS-011"]);
  assert.equal(plan.moves.length, 2);
  assert.equal(plan.moves[0].from, "backlog/tasks/TS-010.md");
  assert.equal(plan.moves[0].to, "backlog/archive/TS-010.md");
});

test("zero verified deliveries produce no documentary PR at all", () => {
  const plan = buildArchivePlan({
    scope: "wave-999", repository,
    deliveries: [{ taskId: "TS-010", status: "pending", proof: null }],
    tasks: [card("TS-010", TASK_BODY)]
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.pullRequest, null);
  assert.equal(plan.moves.length, 0);
  assert.deepEqual(plan.blocked[0].reasons, [ARCHIVE_BLOCK_REASON.DELIVERY_PENDING]);
});

// ---------------------------------------------------------------------------
// First delivery archived, later failure excluded (acceptance criterion 2)
// ---------------------------------------------------------------------------

test("first verified delivery is archived even when a later task failed", () => {
  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-010"), { taskId: "TS-011", status: "unknown", proof: null }],
    tasks: [card("TS-010", TASK_BODY), card("TS-011", TASK_BODY.replace(/TS-010/g, "TS-011"))]
  });
  assert.equal(plan.pullRequest.tasks.length, 1);
  assert.equal(plan.moves[0].taskId, "TS-010");
  assert.equal(plan.blocked.some(entry => entry.taskId === "TS-011"), true);

  const outcome = evaluateArchiveOutcome(plan, { status: "merged", mergeSha });
  assert.deepEqual(outcome.results.map(r => [r.taskId, r.status]),
    [["TS-010", ARCHIVE_RESULT.ARCHIVED]]);
  assert.equal(outcome.results.some(r => r.taskId === "TS-011"), false);
});

// ---------------------------------------------------------------------------
// archive_pending never makes a task re-executable (acceptance criterion 3)
// ---------------------------------------------------------------------------

test("an open documentary PR records archive_pending for every move", () => {
  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-010"), verified("TS-011", { pr: 61 })],
    tasks: [card("TS-010", TASK_BODY), card("TS-011", TASK_BODY.replace(/TS-010/g, "TS-011"))]
  });
  const outcome = evaluateArchiveOutcome(plan, { status: "open" });
  assert.equal(outcome.results.every(r => r.status === ARCHIVE_RESULT.ARCHIVE_PENDING), true);
  assert.equal(outcome.results[0].reason, ARCHIVE_OUTCOME_REASON.PULL_REQUEST_OPEN);
});

test("archive_pending never makes a delivered task dispatchable again", () => {
  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-010")],
    tasks: [card("TS-010", TASK_BODY)]
  });
  for (const status of ["open", "failed", "unknown"]) {
    const outcome = evaluateArchiveOutcome(plan, { status });
    assert.equal(outcome.results[0].status, ARCHIVE_RESULT.ARCHIVE_PENDING);
    // The scheduler evidence is derived from the verified delivery, not from the
    // archive outcome: a pending archive is still seen as already delivered.
    const evidence = toExecutionEvidence(plan);
    assert.deepEqual(evidence.deliveries["TS-010"].status, "verified");
    assert.equal(evidence.deliveries["TS-011"], undefined);
  }
});

// ---------------------------------------------------------------------------
// Content preservation: no historical checkbox is ticked
// ---------------------------------------------------------------------------

test("archiving preserves the body and never ticks a historical checkbox", () => {
  const { metadata } = validateDeliveryProof(verified("TS-010"), { repository });
  const rendered = renderArchivedTask(TASK_BODY, metadata);
  const parsed = extractFrontmatter(rendered);
  assert.deepEqual(parsed.delivery ?? parsed.fields.delivery, {
    head_sha: headSha, merge_sha: mergeSha, pull_request: "60",
    pull_request_url: "https://github.com/" + repository + "/pull/60", verified: "true"
  });
  // Body preserved, including the unticked and historically ticked boxes.
  assert.equal(parsed.body, "\n# TS-010 | Annuler le retrait (snackbar)\n\n## Critères d'acceptation\n\n- [ ] Un premier critère non coché\n- [x] Un critère déjà coché historiquement\n");
  assert.equal(rendered.includes("- [ ] Un premier critère non coché"), true);
  assert.equal((rendered.match(/\[x\]/g) ?? []).length, 1);
  assert.equal((rendered.match(/\[ \]/g) ?? []).length, 1);
  // Frontmatter keys are emitted in the documented deterministic order.
  for (const key of DELIVERY_FIELD_ORDER) {
    assert.match(rendered, new RegExp("^  " + key + ": ", "m"));
  }
});

test("re-rendering an archived task is idempotent and does not duplicate delivery", () => {
  const { metadata } = validateDeliveryProof(verified("TS-010"), { repository });
  const once = renderArchivedTask(TASK_BODY, metadata);
  const twice = renderArchivedTask(once, metadata);
  assert.equal(twice, once);
  assert.equal((once.match(/^delivery:/gm) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// Link rewriting and reporting helpers
// ---------------------------------------------------------------------------

test("explicit backlog/tasks links are rewritten to the archive path", () => {
  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-010")],
    tasks: [card("TS-010", TASK_BODY)]
  });
  const text = "Voir backlog/tasks/TS-010.md et backlog/tasks/TS-011.md.";
  const moved = rewriteBacklogLinks(text, plan.moves);
  assert.equal(moved, "Voir backlog/archive/TS-010.md et backlog/tasks/TS-011.md.");
  assert.equal(rewriteBacklogLinks(text, []), text);
});

test("plan summary is secret-free and lists archived, blocked and PR branch", () => {
  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-010"), { taskId: "TS-011", status: "unknown", proof: null }],
    tasks: [card("TS-010", TASK_BODY)]
  });
  const summary = summarizeArchivePlan(plan);
  assert.deepEqual(summary.archived, ["TS-010"]);
  assert.equal(summary.pullRequest, "asf/archive/wave-123");
  assert.deepEqual(summary.blocked, [{ taskId: "TS-011", reasons: ["delivery_unknown"] }]);
  assert.doesNotMatch(JSON.stringify(summary), /token|secret/i);
});

// ---------------------------------------------------------------------------
// Validation and fail-closed inputs
// ---------------------------------------------------------------------------

test("invalid proofs and missing tasks are blocked, never archived", () => {
  const selection = selectArchivable([
    { taskId: "TS-010", status: "verified", proof: { pr: 0, headSha, mergeSha } },
    verified("TS-011"),
    verified("TS-011")
  ], { repository });
  assert.equal(selection.archivable.length, 1);
  const codes = selection.blocked.flatMap(entry => entry.reasons);
  assert.equal(codes.includes(ARCHIVE_BLOCK_REASON.DELIVERY_INVALID), true);
  assert.equal(codes.includes(ARCHIVE_BLOCK_REASON.DUPLICATE_DELIVERY), true);

  const plan = buildArchivePlan({
    scope: "wave-123", repository,
    deliveries: [verified("TS-012")],
    tasks: []
  });
  assert.equal(plan.pullRequest, null);
  assert.deepEqual(plan.blocked, [{ taskId: "TS-012", reasons: [ARCHIVE_BLOCK_REASON.TASK_MISSING] }]);
});

test("malformed scope or repository fails closed with no PR", () => {
  const badScope = buildArchivePlan({ scope: "!!!", repository, deliveries: [verified("TS-010")], tasks: [] });
  assert.equal(badScope.ok, false);
  assert.equal(badScope.pullRequest, null);
  const badRepo = buildArchivePlan({ scope: "wave-1", repository: "", deliveries: [verified("TS-010")], tasks: [] });
  assert.equal(badRepo.ok, false);
  assert.equal(badRepo.pullRequest, null);
  assert.throws(() => archiveBranchFor("!!!"), /slug/);
  assert.equal(archiveBranchFor("Wave 123"), "asf/archive/wave-123");
  assert.equal(ARCHIVE_BRANCH_PATTERN.test("asf/archive/wave-123"), true);
});

// ---------------------------------------------------------------------------
// Native merge guard: archive branches use the same protections, no widening
// ---------------------------------------------------------------------------

const ruleset = (contexts = ["check"]) => ({
  id: 1, target: "branch", enforcement: "active",
  conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
  rules: [
    { type: "pull_request", parameters: { required_approving_review_count: 0 } },
    { type: "required_status_checks",
      parameters: { required_status_checks: contexts.map(context => ({ context })) } }
  ]
});
const repo = { default_branch: "main", allow_auto_merge: true };
const branch = { protected: true };

test("agent and archive branch families stay separate", () => {
  assert.equal(isAgentBranch("agent/TS-010"), true);
  assert.equal(isAgentBranch("agent/openspec/TS-010"), true);
  assert.equal(isAgentBranch("asf/archive/wave-1"), false);
  assert.equal(isArchiveBranch("asf/archive/wave-1"), true);
  assert.equal(isArchiveBranch("agent/TS-010"), false);
  assert.equal(isAcceptedAutoMergeBranch("asf/archive/wave-1"), true);
  assert.equal(isAcceptedAutoMergeBranch("random/branch"), false);
  assert.equal(AGENT_BRANCH_PATTERN.test("asf/archive/wave-1"), false);
  // A branch generated by the archiver must always pass the merge guard.
  const generated = archiveBranchFor("Wave 123");
  assert.equal(MERGE_ARCHIVE_BRANCH_PATTERN.test(generated), true);
  assert.equal(isArchiveBranch(generated), true);
});

test("archive auto-merge still requires Protect Main and the required check", () => {
  assert.equal(validateAutoMergePrerequisites({ repository: repo, branch, rulesets: [ruleset()] }), true);
  // An archive branch cannot bypass the ruleset gate.
  assert.throws(() => validateAutoMergePrerequisites({
    repository: repo, branch, rulesets: [ruleset([])]
  }), /independent CI check/);
  assert.throws(() => validateAutoMergePrerequisites({
    repository: repo, branch: { protected: false }, rulesets: [ruleset()]
  }), /not protected/);
  assert.throws(() => validateAutoMergePrerequisites({
    repository: repo, branch, rulesets: []
  }), /No active main ruleset/);
  assert.equal(applicableMainRule(ruleset()), true);
  const bypass = ruleset(); bypass.conditions.ref_name.exclude = ["refs/heads/main"];
  assert.equal(applicableMainRule(bypass), false);
});

test("archive auto-merge accepts only a precise non-draft main PR at the SHA", () => {
  const expected = { expectedHeadRef: "asf/archive/wave-1", expectedHeadSha: headSha };
  const pr = { number: 77, state: "OPEN", isDraft: false, baseRefName: "main",
    headRefName: "asf/archive/wave-1", headRefOid: headSha };
  assert.equal(validateAutoMergeTarget(pr, expected), 77);
  for (const bad of [{ isDraft: true }, { baseRefName: "develop" },
    { headRefName: "asf/archive/wave-2" }, { headRefOid: mergeSha }]) {
    assert.throws(() => validateAutoMergeTarget({ ...pr, ...bad }, expected), /does not match/);
  }
});

test("auto-merge helper exposes both entries and never uses --admin", () => {
  const helper = readFileSync(new URL("../scripts/request-safe-auto-merge.mjs", import.meta.url), "utf8");
  assert.match(helper, /export function runArchiveAutoMerge\(\)/);
  assert.match(helper, /runArchiveAutoMerge\(\);\s*else runAutoMerge\(\)/);
  assert.match(helper, /"pr", "merge", String\(number\).*"--auto", "--merge"/);
  assert.match(helper, /"--match-head-commit", expectedHeadSha/);
  assert.doesNotMatch(helper, /"--admin"/);
});

// ---------------------------------------------------------------------------
// Filesystem application: move, index regeneration and link rewriting
// ---------------------------------------------------------------------------

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "asf-archive-"));
  mkdirSync(join(root, "backlog", "tasks"), { recursive: true });
  mkdirSync(join(root, "backlog", "archive"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "backlog", "tasks", "TS-010.md"), TASK_BODY);
  writeFileSync(join(root, "backlog", "tasks", "TS-011.md"), TASK_BODY.replace(/TS-010/g, "TS-011"));
  writeFileSync(join(root, "docs", "notes.md"),
    "Voir backlog/tasks/TS-010.md puis backlog/tasks/TS-011.md.\n");
  return root;
}

function activeCards() {
  return [
    card("TS-010", TASK_BODY),
    card("TS-011", TASK_BODY.replace(/TS-010/g, "TS-011"))
  ];
}

test("applyArchivePlan moves only verified tasks and regenerates the index", () => {
  const root = makeRoot();
  try {
    const plan = buildArchivePlan({
      scope: "wave-7", repository,
      deliveries: [verified("TS-010"), { taskId: "TS-011", status: "unknown", proof: null }],
      tasks: activeCards()
    });
    const result = applyArchivePlan({ root, plan, documents: ["docs/notes.md"] });
    assert.deepEqual(result.applied, ["TS-010"]);
    assert.deepEqual(result.documents, ["docs/notes.md"]);
    assert.deepEqual(result.index, { activeCount: 1, archiveCount: 1 });
    assert.equal(existsSync(join(root, "backlog", "tasks", "TS-010.md")), false);
    assert.equal(existsSync(join(root, "backlog", "archive", "TS-010.md")), true);
    // The failed second task stays active and its link is untouched.
    assert.equal(existsSync(join(root, "backlog", "tasks", "TS-011.md")), true);
    const link = readFileSync(join(root, "docs", "notes.md"), "utf8");
    assert.equal(link, "Voir backlog/archive/TS-010.md puis backlog/tasks/TS-011.md.\n");
    // Archived content keeps its historical checkboxes and gains delivery proof.
    const archived = readFileSync(join(root, "backlog", "archive", "TS-010.md"), "utf8");
    assert.equal(archived.includes("- [ ] Un premier critère non coché"), true);
    assert.equal((archived.match(/\[x\]/g) ?? []).length, 1);
    assert.match(archived, /^delivery:$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("applyArchivePlan is a no-op when no task is verified", () => {
  const root = makeRoot();
  try {
    const plan = buildArchivePlan({
      scope: "wave-7", repository,
      deliveries: [{ taskId: "TS-010", status: "pending", proof: null }],
      tasks: activeCards()
    });
    const result = applyArchivePlan({ root, plan, documents: ["docs/notes.md"] });
    assert.deepEqual(result, { applied: [], documents: [], index: null });
    assert.equal(existsSync(join(root, "backlog", "tasks", "TS-010.md")), true);
    assert.equal(existsSync(join(root, "backlog", "archive", "TS-010.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
