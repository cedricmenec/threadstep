import test from "node:test";
import assert from "node:assert/strict";
import { createGithubClient } from "../scripts/asf/github/client.mjs";
import { observeV3RunProvenance } from "../scripts/asf/v3/provenance.mjs";
import { commitV3JournalCAS } from "../scripts/asf/v3/git-cas.mjs";

const REPO = "cedricmenec/threadstep";
const PARENT = ".github/workflows/backlog-orchestrator-v3.yml";
const CHILD = ".github/workflows/agent-openspec-v3.yml";
const OWNER = "cedricmenec";
const BOT = "threadstep-software-factory[bot]";
const A = "a".repeat(40), B = "b".repeat(40);
const authorization = Object.freeze({
  repository: REPO, owner: OWNER, ownerRunId: "100", sourceSha: A,
  ownerWorkflowRef: REPO + "/" + PARENT + "@refs/heads/main"
});
const fixture = (n, path, event, actor, sha) => ({
  id: n, repository: { full_name: REPO }, path, event,
  actor: { login: actor }, head_branch: "main", head_sha: sha,
  run_attempt: 1, status: "in_progress", conclusion: null
});
const origin = () => fixture(100, PARENT, "workflow_dispatch", OWNER, A);
const child = () => fixture(200, CHILD, "workflow_dispatch", BOT, B);
const continuation = () => fixture(300, PARENT, "repository_dispatch", BOT, B);
function client(runs = { "100": origin(), "200": child(), "300": continuation() }, failures = {}) {
  return createGithubClient({ transport: async path => {
    const which = path.split("/").at(-1);
    if (failures[which]) throw Object.assign(new Error("offline"), { status: 503 });
    if (!(which in runs)) throw Object.assign(new Error("missing"), { status: 404 });
    return runs[which];
  } });
}
const request = (kind = "child") => {
  const childMode = kind === "child", runId = childMode ? "200" : "300";
  const path = childMode ? CHILD : PARENT;
  const eventName = childMode ? "workflow_dispatch" : "repository_dispatch";
  return {
    kind, authorization,
    reservation: { kind, runId, headSha: B, repository: REPO },
    context: { repository: REPO, ref: "refs/heads/main",
      eventName, actor: BOT, runAttempt: 1, runId,
      workflowRef: REPO + "/" + path + "@refs/heads/main" }
  };
};
test("independently reads original owner run and active child run by exact IDs", async () => {
  const out = await observeV3RunProvenance(client(), request());
  assert.equal(out.ok, true);
  assert.equal(out.evidence.originalRunId, "100");
  assert.equal(out.evidence.verifiedRunId, "200");
  assert.match(out.evidence.observationHash, /^[a-f0-9]{64}$/);
  assert.equal(out.status, "verified_observation");
});
test("continuation controller uses repository_dispatch and same original owner mandate", async () => {
  const out = await observeV3RunProvenance(client(), request("continuation"));
  assert.equal(out.ok, true);
  assert.equal(out.evidence.workflowEvent, "repository_dispatch");
});
test("spoofed caller: wrong actor, event, ref, rerun and child run ID fail before API", async () => {
  for (const patch of [
    { actor: OWNER }, { eventName: "workflow_dispatch", runId: "300" },
    { ref: "refs/heads/feature" }, { runAttempt: 2 }, { runId: "201" },
    { workflowRef: REPO + "/" + PARENT + "@refs/heads/main" }
  ]) {
    const q = request();
    q.context = { ...q.context, ...patch };
    const res = await observeV3RunProvenance(client(), q);
    assert.equal(res.ok, false);
    assert.equal(res.code, "untrusted_workflow_context");
  }
});
test("API observed owner identity / SHA / event / path / attempt must match", async () => {
  const originals = [
    { actor: { login: "attacker" } }, { head_sha: B },
    { event: "schedule" }, { path: CHILD }, { run_attempt: 2 },
    { head_branch: "feature" }, { status: "completed", conclusion: "failure" }
  ];
  for (const altered of originals) {
    const p = { ...origin(), ...altered };
    const res = await observeV3RunProvenance(client({ "100": p, "200": child() }), request());
    assert.equal(res.code, "owner_origin_not_verified");
  }
});
test("API observed child identity / SHA / actor / event / path / retry / completion fail", async () => {
  for (const altered of [
    { id: 201 }, { head_sha: A }, { actor: { login: OWNER } },
    { event: "pull_request" }, { path: PARENT }, { run_attempt: 2 },
    { status: "completed", conclusion: "success" },
    { repository: { full_name: "attacker/repo" } }
  ]) {
    const p = { ...child(), ...altered };
    const res = await observeV3RunProvenance(client({ "100": origin(), "200": p }), request());
    assert.equal(res.code, "run_provenance_mismatch");
  }
});
test("unavailable GitHub evidence is uncertain, not permission to proceed", async () => {
  const a = await observeV3RunProvenance(client({}, { "100": true }), request());
  assert.equal(a.ok, false); assert.equal(a.status, "uncertain");
  const b = await observeV3RunProvenance(client({}, { "200": true,
    "100": false }), request());
  assert.equal(b.ok, false); assert.equal(b.status, "uncertain");
  assert.equal((await observeV3RunProvenance(null, request())).code, "missing_readonly_client");
});
test("provenance does not accept malformed contract or arbitrary workflow kind", async () => {
  const q = request(); q.authorization = { ...authorization, owner: "other" };
  assert.equal((await observeV3RunProvenance(client(), q)).code, "invalid_origin_contract");
  assert.equal((await observeV3RunProvenance(client(), { ...request(), kind: "unknown" })).code,
    "invalid_kind");
});

function makeFakePort(options = {}) {
  const commits = new Map([[A, { sha: A, treeSha: B, parents: [] }]]);
  let head = A;
  let count = 0;
  const writes = [];
  const port = {
    writes,
    get head() { return head; },
    getRef: async ref => ({ sha: head, ref }),
    getCommit: async sha => commits.get(sha) ?? null,
    createTree: async input => {
      writes.push({ action: "tree", ...input });
      return { sha: "c".repeat(40) };
    },
    createCommit: async input => {
      const sha = String.fromCharCode(100 + count++).repeat(40);
      commits.set(sha, { sha, treeSha: input.treeSha, parents: input.parents });
      writes.push({ action: "commit", ...input, sha });
      return { sha };
    },
    updateRef: async input => {
      writes.push({ action: "update", ...input });
      const commit = commits.get(input.sha);
      if (input.force !== false || commit.parents.length !== 1 ||
        commit.parents[0] !== head) {
        throw Object.assign(new Error("non-fast-forward"), { status: 422 });
      }
      head = input.sha;
      if (options.dropResponse) throw Object.assign(new Error("timeout"), { status: 503 });
      return { sha: head };
    },
    moveHead: sha => { head = sha; }
  };
  return port;
}
const journal = () => ({
  schemaVersion: 2, waveId: "wave-123", revision: 1, status: "RESERVED",
  reserved: 1, delivered: 0, events: [{ seq: 1, type: "RESERVE", taskId: "TS-001" }]
});
const commit = (port, doc = journal(), expectedHeadSha = A, validateJournal = () => true) =>
  commitV3JournalCAS(port, {
    waveId: "wave-123", expectedHeadSha, journal: doc, validateJournal
  });
test("persist one journal update only by commit with expected parent and nonforced ref CAS", async () => {
  const p = makeFakePort();
  const res = await commit(p);
  assert.equal(res.ok, true);
  assert.equal(res.status, "persisted");
  assert.notEqual(res.newHeadSha, A);
  assert.equal(p.writes.filter(x => x.action === "update").length, 1);
  assert.equal(p.writes.find(x => x.action === "update").force, false);
  assert.equal(p.writes.find(x => x.action === "tree").files[0].path, "journal.json");
  assert.deepEqual(p.writes.find(x => x.action === "commit").parents, [A]);
  assert.equal(res.ref, "refs/heads/asf/waves/wave-123");
});
test("stale expected branch SHA is a conflict and cannot start a write", async () => {
  const p = makeFakePort();
  p.moveHead(B);
  const res = await commit(p);
  assert.equal(res.status, "conflict");
  assert.equal(p.writes.length, 0);
});
test("concurrent sibling commits from the same head cannot both fast-forward", async () => {
  const p = makeFakePort();
  const [x,y] = await Promise.all([commit(p), commit(p)]);
  assert.equal([x,y].filter(o => o.status === "persisted").length, 1);
  assert.equal([x,y].filter(o => o.status === "conflict").length, 1);
  assert.equal(p.writes.filter(o => o.action === "update").length, 2);
});
test("lost response AFTER a successful ref update is uncertain and never retried", async () => {
  const p = makeFakePort({ dropResponse: true });
  const out = await commit(p);
  assert.equal(out.ok, false);
  assert.equal(out.status, "uncertain");
  assert.notEqual(p.head, A);
  assert.equal(p.writes.filter(x => x.action === "update").length, 1);
  const retry = await commit(p);
  assert.equal(retry.status, "conflict");
  assert.equal(p.writes.filter(x => x.action === "update").length, 1);
});
test("invalid journal, validator failure, secret and oversized payload are rejected before Git writes", async () => {
  const p = makeFakePort();
  assert.equal((await commit(p, { ...journal(), schemaVersion: 1 })).status, "rejected");
  assert.equal((await commit(p, journal(), A, () => false)).status, "rejected");
  assert.equal((await commit(p, { ...journal(), diagnostic: "ghp_" + "A".repeat(24) })).code,
    "journal_contains_secret");
  assert.equal((await commit(p, { ...journal(), diagnostic: "x".repeat(600000) })).code,
    "journal_size_limit");
  assert.equal(p.writes.length, 0);
});
test("a CAS error is never a dispatch retry, and unavailable ref is uncertain", async () => {
  const p = makeFakePort();
  p.getRef = async () => { throw Object.assign(new Error("API offline"), { status: 503 }); };
  assert.equal((await commit(p)).status, "uncertain");
  assert.equal(p.writes.length, 0);
  assert.equal((await commitV3JournalCAS(p, { waveId: "../escape",
    expectedHeadSha: A, journal: journal(), validateJournal: () => true })).status, "rejected");
});
