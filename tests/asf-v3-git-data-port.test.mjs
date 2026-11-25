import test from "node:test";
import assert from "node:assert/strict";
import { createAsfV3GitDataPort, ASF_V3_REPOSITORY }
  from "../scripts/asf/v3/github-git-data-port.mjs";

const H = char => char.repeat(40);
const WAVE = "wave-test-006";
const REF = "refs/heads/asf/waves/" + WAVE;
const HEAD = H("a");
const TREE = H("b");
const pathPrefix = "repos/cedricmenec/threadstep";
const journal = (revision = 1) => JSON.stringify({
  schemaVersion: 2, waveId: WAVE, revision,
  status: "RESERVED", reserved: 1, delivered: 0,
  events: [{ seq: 1, type: "RESERVE", taskId: "TS-001" }]
}) + "\n";

function simulator({ lostRefResponse = false, responseMutation = null,
  apiFailure = null } = {}) {
  let head = HEAD, commitCount = 0;
  const requests = [];
  const commits = new Map([[HEAD, {
    sha: HEAD, tree: { sha: TREE }, parents: []
  }]]);
  const trees = new Map();
  const transport = async request => {
    requests.push(structuredClone(request));
    if (apiFailure?.(request)) {
      const error = new Error("ghp_" + "A".repeat(30));
      error.status = 503;
      throw error;
    }
    const { method, path, body } = request;
    let response;
    if (method === "GET" && path === pathPrefix + "/git/ref/heads/asf/waves/" + WAVE) {
      response = { ref: REF, object: { type: "commit", sha: head } };
    } else if (method === "GET" && path.startsWith(pathPrefix + "/git/commits/")) {
      response = commits.get(path.slice((pathPrefix + "/git/commits/").length));
      if (!response) throw Object.assign(new Error("missing commit"), { status: 404 });
    } else if (method === "POST" && path === pathPrefix + "/git/trees") {
      assert.deepEqual(Object.keys(body).sort(), ["base_tree", "tree"]);
      assert.equal(body.tree.length, 1);
      const treeSha = H("c");
      trees.set(treeSha, body);
      response = { sha: treeSha };
    } else if (method === "POST" && path === pathPrefix + "/git/commits") {
      assert.ok(trees.has(body.tree));
      const newSha = H(String.fromCharCode(100 + commitCount++));
      commits.set(newSha, {
        sha: newSha, tree: { sha: body.tree },
        parents: body.parents.map(sha => ({ sha }))
      });
      response = commits.get(newSha);
    } else if (method === "PATCH" &&
      path === pathPrefix + "/git/refs/heads/asf/waves/" + WAVE) {
      assert.equal(body.force, false);
      const next = commits.get(body.sha);
      if (!next || next.parents.length !== 1 ||
        next.parents[0].sha !== head) {
        throw Object.assign(new Error("not fast forward"), { status: 422 });
      }
      head = body.sha;
      if (lostRefResponse) throw Object.assign(new Error("lost after write"), { status: 503 });
      response = { ref: REF, object: { type: "commit", sha: head } };
    } else throw new Error("unexpected HTTP method or path");
    return responseMutation?.(request, response) ?? response;
  };
  const port = createAsfV3GitDataPort({ waveId: WAVE, transport });
  const prepare = async () => {
    const { sha: parent } = await port.getRef(REF);
    const commit = await port.getCommit(parent);
    const tree = await port.createTree({
      baseTreeSha: commit.treeSha,
      files: [{ path: "journal.json", mode: "100644", type: "blob",
        content: journal() }]
    });
    const created = await port.createCommit({
      treeSha: tree.sha, parents: [parent],
      message: "chore(asf): V3 journal checkpoint revision 1"
    });
    return { parent, ...created };
  };
  return { port, prepare, requests,
    get head() { return head; },
    get commits() { return commits; }
  };
}

test("real GitHub endpoints: read exact ref and canonical commit shape", async () => {
  const s = simulator();
  const ref = await s.port.getRef(REF);
  assert.equal(ref.sha, HEAD);
  const commit = await s.port.getCommit(HEAD);
  assert.deepEqual(commit, { sha: HEAD, treeSha: TREE, parents: [] });
  assert.deepEqual(s.requests.map(x => [x.method, x.path]), [
    ["GET", pathPrefix + "/git/ref/heads/asf/waves/" + WAVE],
    ["GET", pathPrefix + "/git/commits/" + HEAD]
  ]);
  assert.ok(Object.isFrozen(ref) && Object.isFrozen(commit));
});

test("adapter uses only journal.json with base_tree; exact single-parent commit", async () => {
  const s = simulator();
  const created = await s.prepare();
  assert.notEqual(created.sha, HEAD);
  const posts = s.requests.filter(x => x.method === "POST");
  assert.deepEqual(posts.map(x => x.path), [
    pathPrefix + "/git/trees", pathPrefix + "/git/commits"
  ]);
  assert.deepEqual(posts[0].body, {
    base_tree: TREE,
    tree: [{ path: "journal.json", mode: "100644", type: "blob",
      content: journal() }]
  });
  assert.deepEqual(posts[1].body.parents, [HEAD]);
  assert.equal(s.head, HEAD, "detached commit does not update the branch");
});

test("only PATCH force:false advances a matching operational wave ref", async () => {
  const s = simulator();
  const created = await s.prepare();
  await s.port.updateRef({ ref: REF, sha: created.sha, force: false });
  assert.equal(s.head, created.sha);
  const patch = s.requests.at(-1);
  assert.deepEqual(patch, { method: "PATCH",
    path: pathPrefix + "/git/refs/heads/asf/waves/" + WAVE,
    body: { sha: created.sha, force: false } });
});

test("two sibling commits cannot both fast-forward even when they race", async () => {
  const s = simulator();
  const [a, b] = await Promise.all([s.prepare(), s.prepare()]);
  assert.notEqual(a.sha, b.sha);
  assert.equal(a.parent, HEAD);
  assert.equal(b.parent, HEAD);
  const out = await Promise.allSettled([
    s.port.updateRef({ ref: REF, sha: a.sha, force: false }),
    s.port.updateRef({ ref: REF, sha: b.sha, force: false })
  ]);
  assert.equal(out.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(out.filter(x => x.status === "rejected").length, 1);
  assert.ok([a.sha, b.sha].includes(s.head));
  const rejected = out.find(x => x.status === "rejected");
  assert.equal(rejected.reason.code, "git_transport_unavailable");
  assert.equal(rejected.reason.status, 422);
  assert.equal(s.requests.filter(x => x.method === "PATCH").length, 2);
});

test("response lost AFTER successful PATCH stays unknown, with no automatic retry", async () => {
  const s = simulator({ lostRefResponse: true });
  const c = await s.prepare();
  await assert.rejects(s.port.updateRef({
    ref: REF, sha: c.sha, force: false
  }), e => e.code === "git_transport_unavailable" && e.status === 503);
  assert.equal(s.head, c.sha, "remote write MAY have succeeded despite response loss");
  assert.equal(s.requests.filter(x => x.method === "PATCH").length, 1);
});

test("unsafe wave id, extra paths, missing parent, force:true or arbitrary repository fail closed", async () => {
  assert.equal(ASF_V3_REPOSITORY, "cedricmenec/threadstep");
  const tx = async () => ({});
  for (const waveId of ["", "../other", "wave/other", "wave%2fmain", "Uppercase",
    "a".repeat(70)]) {
    assert.throws(() => createAsfV3GitDataPort({ waveId, transport: tx }),
      e => e.code === "git_contract_violation");
  }
  const s = simulator();
  await assert.rejects(s.port.getRef("refs/heads/main"), e => e.code === "git_contract_violation");
  await assert.rejects(s.port.getCommit("HEAD"), e => e.code === "git_contract_violation");
  for (const file of [
    { path: ".github/workflows/ci.yml", mode: "100644", type: "blob", content: journal() },
    { path: "manifest.json", mode: "100644", type: "blob", content: journal() },
    { path: "journal.json", mode: "100755", type: "blob", content: journal() },
    { path: "journal.json", mode: "100644", type: "blob", content: journal(), extra: true }
  ]) {
    await assert.rejects(s.port.createTree({ baseTreeSha: TREE, files: [file] }),
      e => e.code === "git_contract_violation");
  }
  await assert.rejects(s.port.createCommit({
    treeSha: TREE, parents: [HEAD, HEAD], message: "chore(asf): V3 journal checkpoint revision 1"
  }), e => e.code === "git_contract_violation");
  await assert.rejects(s.port.updateRef({ ref: REF, sha: H("c"), force: true }),
    e => e.code === "git_contract_violation");
  assert.equal(s.requests.length, 0, "unsafe requests must never call transport");
});

test("journal bytes, wave identity, secret and schema validated BEFORE sending POST", async () => {
  const s = simulator();
  const write = content => s.port.createTree({
    baseTreeSha: TREE,
    files: [{ path: "journal.json", mode: "100644", type: "blob", content }]
  });
  for (const text of ["", "undefined", "{", "{}", JSON.stringify({
    schemaVersion: 1, waveId: WAVE, revision: 1
  }), JSON.stringify({
    schemaVersion: 2, waveId: "other-wave", revision: 1
  }), JSON.stringify({
    schemaVersion: 2, waveId: WAVE, revision: 1,
    token: "ghp_" + "A".repeat(25)
  })]) {
    await assert.rejects(write(text));
  }
  await assert.rejects(write(JSON.stringify({ schemaVersion: 2, waveId: WAVE,
    revision: 1, text: "x".repeat(530000) })), e => e.code === "git_payload_too_large");
  assert.equal(s.requests.length, 0);
});

test("malformed GitHub response is denied, not converted to proof", async () => {
  const s = simulator({ responseMutation: (request, response) =>
    request.path.includes("/git/ref/") ?
      { ...response, ref: "refs/heads/main" } : response });
  await assert.rejects(s.port.getRef(REF), e => e.code === "git_api_response_invalid");
  const c = simulator({ responseMutation: (request, response) =>
    request.method === "POST" && request.path.endsWith("/git/commits") ?
      { ...response, parents: [] } : response });
  await c.port.getRef(REF);
  const t = await c.port.createTree({
    baseTreeSha: TREE, files: [{ path: "journal.json", mode: "100644",
      type: "blob", content: journal() }]
  });
  await assert.rejects(c.port.createCommit({ treeSha: t.sha, parents: [HEAD],
    message: "chore(asf): V3 journal checkpoint revision 1"
  }), e => e.code === "git_api_response_invalid");
});

test("transport errors never include raw token, API is not retried", async () => {
  const s = simulator({ apiFailure: request => request.method === "GET" });
  await assert.rejects(s.port.getRef(REF), e => {
    assert.equal(e.code, "git_transport_unavailable");
    assert.equal(e.status, 503);
    assert.doesNotMatch(e.message, /ghp_/);
    return true;
  });
  assert.equal(s.requests.length, 1);
});
