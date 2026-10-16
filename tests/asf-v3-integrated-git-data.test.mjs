import test from "node:test";
import assert from "node:assert/strict";
import { createGithubClient } from "../scripts/asf/github/client.mjs";
import {
  createV3Manifest, createV3Journal, advanceV3
} from "../scripts/asf/v3/lifecycle.mjs";
import { createAsfV3GitDataPort } from "../scripts/asf/v3/github-git-data-port.mjs";
import { createIntegratedV3Ports } from "../scripts/asf/v3/integration.mjs";
import { attemptV3ChildClaim } from "../scripts/asf/v3/transaction-bridge.mjs";

const repo = "cedricmenec/threadstep";
const waveId = "wave-int-rest-001";
const ref = "refs/heads/asf/waves/" + waveId;
const prefix = "repos/" + repo;
const H = x => x.repeat(40);
const WORKFLOW_OWNER = ".github/workflows/backlog-orchestrator-v3.yml";
const WORKFLOW_CHILD = ".github/workflows/agent-openspec.yml";
const owner = "cedricmenec";
const bot = "threadstep-software-factory[bot]";

function admittedJournal(m) {
  let j = createV3Journal(m);
  for (const event of [
    { type: "RESERVE", taskId: "TS-001" },
    { type: "DISPATCH_INTENT", taskId: "TS-001" },
    { type: "ACK_CHILD", taskId: "TS-001", childRunId: "200",
      runAttempt: 1, workflowRef: repo + "/" + WORKFLOW_CHILD + "@refs/heads/main" }
  ]) j = advanceV3(m, j, event, j.revision);
  return j;
}

function run(id, path, actor, sha) {
  return { id, repository: { full_name: repo }, path,
    event: "workflow_dispatch", actor: { login: actor },
    head_branch: "main", head_sha: sha,
    run_attempt: 1, status: "in_progress", conclusion: null };
}
const runtime = () => ({
  runId: "200", repository: repo, ref: "refs/heads/main",
  workflowRef: repo + "/" + WORKFLOW_CHILD + "@refs/heads/main",
  eventName: "workflow_dispatch", actor: bot, runAttempt: 1,
  headSha: H("d")
});

function fixture({ lostPatch = false, foreignActor = false } = {}) {
  const manifest = createV3Manifest({
    waveId, repository: repo, backlogCommit: H("a"),
    model: "openrouter/deepseek/deepseek-v4.1-flash",
    autoMerge: true, maxTaskStarts: 10,
    candidateTasks: [{ id: "TS-001", sha256: "f".repeat(64) }],
    authorization: { runId: "100", actor: owner,
      workflowRef: repo + "/" + WORKFLOW_OWNER + "@refs/heads/main",
      sourceSha: H("a") }
  });
  const initialJournal = admittedJournal(manifest);
  const initialHead = H("1");
  const trees = new Map([[H("2"), {
    "manifest.json": manifest, "journal.json": initialJournal
  }]]);
  const commits = new Map([[initialHead, {
    sha: initialHead, tree: { sha: H("2") }, parents: []
  }]]);
  const calls = [];
  let head = initialHead, next = 3;

  async function api({ method, path, body }) {
    calls.push({ method, path, body: body ?? null });
    if (method === "GET" && path === prefix + "/git/ref/heads/asf/waves/" + waveId) {
      return { ref, object: { type: "commit", sha: head } };
    }
    if (method === "GET" && path.startsWith(prefix + "/git/commits/")) {
      const found = commits.get(path.slice((prefix + "/git/commits/").length));
      if (!found) throw Object.assign(new Error("missing commit"), { status: 404 });
      return found;
    }
    if (method === "GET" && path.startsWith(prefix + "/contents/")) {
      const m = path.match(/\/contents\/(manifest|journal)\.json\?ref=([a-f0-9]{40})$/);
      if (!m) throw new Error("unsupported content path");
      const commit = commits.get(m[2]);
      if (!commit) throw new Error("unpinned sha");
      const doc = trees.get(commit.tree.sha)[m[1] + ".json"];
      const bytes = Buffer.from(JSON.stringify(doc), "utf8");
      return {
        type: "file", path: m[1] + ".json", encoding: "base64",
        size: bytes.length, content: bytes.toString("base64")
      };
    }
    if (method === "GET" && path === prefix + "/actions/runs/100") {
      return run(100, WORKFLOW_OWNER, owner, H("a"));
    }
    if (method === "GET" && path === prefix + "/actions/runs/200") {
      return run(200, WORKFLOW_CHILD,
        foreignActor ? "intruder[bot]" : bot, H("d"));
    }
    if (method === "POST" && path === prefix + "/git/trees") {
      assert.equal(body.tree.length, 1);
      assert.equal(body.tree[0].path, "journal.json");
      const original = trees.get(body.base_tree);
      assert.ok(original, "original tree must come from pinned parent");
      const newTree = next.toString(16).repeat(40); next++;
      trees.set(newTree, {
        ...original, "journal.json": JSON.parse(body.tree[0].content)
      });
      return { sha: newTree };
    }
    if (method === "POST" && path === prefix + "/git/commits") {
      assert.equal(body.parents.length, 1);
      const sha = next.toString(16).repeat(40); next++;
      commits.set(sha, {
        sha, tree: { sha: body.tree },
        parents: [{ sha: body.parents[0] }]
      });
      return commits.get(sha);
    }
    if (method === "PATCH" &&
      path === prefix + "/git/refs/heads/asf/waves/" + waveId) {
      assert.equal(body.force, false);
      const candidate = commits.get(body.sha);
      if (!candidate || candidate.parents.length !== 1 ||
          candidate.parents[0].sha !== head)
        throw Object.assign(new Error("stale sibling CAS"), { status: 422 });
      head = body.sha;
      if (lostPatch) throw Object.assign(new Error("ambiguous network response"), { status: 503 });
      return { ref, object: { type: "commit", sha: head } };
    }
    throw new Error("unexpected mocked HTTP route " + method + " " + path);
  }

  const githubReadClient = createGithubClient({
    transport: path => api({ method: "GET", path })
  });
  const gitPort = createAsfV3GitDataPort({
    waveId, transport: request => api(request)
  });
  const ports = createIntegratedV3Ports({ githubReadClient, gitPort, repository: repo });
  return {
    ports, calls, initialHead, get head() { return head; },
    get journal() { return trees.get(commits.get(head).tree.sha)["journal.json"]; }
  };
}

test("all real modules including Git Data REST port commit one child claim", async () => {
  const f = fixture();
  const result = await attemptV3ChildClaim(f.ports, {
    waveId, taskId: "TS-001", runtime: runtime()
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.code, "single_run_claim_committed");
  assert.equal(f.journal.revision, 4);
  assert.equal(f.journal.status, "EXECUTING");
  assert.equal(f.journal.reserved, 1);
  assert.notEqual(f.head, f.initialHead);
  assert.equal(f.calls.filter(c => c.method === "PATCH").length, 1);
  const verified = await f.ports.loadSnapshot(waveId);
  assert.equal(verified.ok, true);
  assert.equal(verified.journal.status, "EXECUTING");
  const second = await attemptV3ChildClaim(f.ports, {
    waveId, taskId: "TS-001", runtime: runtime()
  });
  assert.equal(second.ok, false);
  assert.equal(f.calls.filter(c => c.method === "PATCH").length, 1);
});

test("two runners sharing real Git Data adapter cannot both fast-forward the journal", async () => {
  const f = fixture();
  const args = { waveId, taskId: "TS-001", runtime: runtime() };
  const [a,b] = await Promise.all([
    attemptV3ChildClaim(f.ports, args),
    attemptV3ChildClaim(f.ports, args)
  ]);
  assert.equal([a,b].filter(x => x.ok).length, 1, JSON.stringify([a,b]));
  assert.equal(f.journal.status, "EXECUTING");
  assert.equal(f.journal.reserved, 1);
  assert.equal(f.calls.filter(c => c.method === "PATCH").length, 2);
});

test("lost PATCH response after remote success remains uncertain; no CAS retry", async () => {
  const f = fixture({ lostPatch: true });
  const result = await attemptV3ChildClaim(f.ports, {
    waveId, taskId: "TS-001", runtime: runtime()
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "uncertain");
  assert.equal(f.journal.status, "EXECUTING", "remote may have committed");
  assert.equal(f.calls.filter(c => c.method === "PATCH").length, 1);
});

test("foreign GitHub App actor fails before any POST or PATCH", async () => {
  const f = fixture({ foreignActor: true });
  const result = await attemptV3ChildClaim(f.ports, {
    waveId, taskId: "TS-001", runtime: runtime()
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "github_provenance_not_verified");
  assert.equal(f.calls.filter(c => c.method !== "GET").length, 0);
});

test("integrated Git Data port cannot mutate main or another wave", async () => {
  const f = fixture();
  // A distinct injection of a Git data port cannot bypass its pinned wave ID.
  assert.equal(typeof f.ports.commitJournal, "function");
  const result = await f.ports.commitJournal({
    waveId: "wave-unrelated", expectedHeadSha: f.initialHead,
    journal: { schemaVersion: 2, waveId: "wave-unrelated", revision: 1 }
  });
  assert.equal(result.ok, false);
  assert.equal(f.calls.filter(c => c.method !== "GET").length, 0);
});
