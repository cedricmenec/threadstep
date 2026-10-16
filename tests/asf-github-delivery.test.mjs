import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  GITHUB_CLIENT_DEFAULTS, GITHUB_ERROR, createGithubClient, normalizeGithubError
} from "../scripts/asf/github/client.mjs";
import {
  DELIVERY_STATUS, DELIVERY_REASON, RUN_CORRELATION,
  createAsfDeliveryConfig, createOpenspecDeliveryConfig,
  verifyDelivery, toSchedulerEvidence
} from "../scripts/asf/delivery/verify.mjs";
import { collectDeliveryObservation } from "../scripts/asf/delivery/observe.mjs";

const repository = "cedricmenec/threadstep";
const taskId = "ASF-V2-007";
const runId = 38821338274;
const headSha = "a".repeat(40);
const mergeSha = "b".repeat(40);
const mergedAt = "2026-10-16T10:00:00Z";
const observedAt = "2026-10-16T10:05:00Z";
const bot = "threadstep-software-factory[bot]";

function check(sha, overrides = {}) {
  return {
    name: "check", head_sha: sha, status: "completed", conclusion: "success",
    app: { slug: "github-actions", id: 15368 }, ...overrides
  };
}

function asfConfig(overrides = {}) {
  return { ...createAsfDeliveryConfig({ taskId, repository }), ...overrides };
}

function mergedPull(overrides = {}) {
  return {
    number: 52, state: "closed", merged: true, merged_at: mergedAt,
    title: "Agent ASF: " + taskId, base: { ref: "main" },
    head: { ref: "agent/asf/" + taskId + "-run-" + runId, repo: { full_name: repository }, sha: headSha },
    merge_commit_sha: mergeSha, user: { login: bot }, draft: false,
    ...overrides
  };
}

function greenRun(overrides = {}) {
  return {
    id: runId, status: "completed", conclusion: "success", event: "workflow_dispatch",
    actor: { login: "cedricmenec" }, path: ".github/workflows/agent-asf.yml",
    head_sha: headSha, head_branch: "main",
    ...overrides
  };
}

function postMerge(overrides = {}) {
  return ["CI", "Pages"].map(name => ({
    name, event: "push", head_sha: mergeSha, created_at: "2026-10-16T10:00:05Z",
    status: "completed", conclusion: "success", ...overrides
  }));
}

function observation(overrides = {}) {
  return {
    pullRequests: [mergedPull()],
    run: greenRun(),
    headChecks: [check(headSha)],
    mainChecks: [check(mergeSha)],
    mainRuns: postMerge(),
    comparison: { status: "ahead" },
    errors: [], truncated: false, archived: false, observedAt,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Bounded, read-only client
// ---------------------------------------------------------------------------

test("client paginates a JSON array with correct page parameters", async () => {
  const seen = [];
  const client = createGithubClient({
    transport: async path => {
      seen.push(path);
      const page = Number(new URL("https://x/" + path).searchParams.get("page"));
      return page === 1 ? Array.from({ length: 100 }, (_, i) => i) : [100];
    }
  });
  const result = await client.paginate("repos/o/r/pulls");
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 101);
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, false);
  assert.match(seen[0], /per_page=100&page=1$/);
  assert.match(seen[1], /page=2$/);
});

test("client flags truncation when the page ceiling is reached with full pages", async () => {
  const client = createGithubClient({
    transport: async () => Array.from({ length: 100 }, (_, i) => i)
  });
  const result = await client.paginate("repos/o/r/pulls", { maxPages: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
  assert.equal(result.pages, 3);
  assert.equal(result.items.length, 300);
});

test("client never converts a transport error into data", async () => {
  const client = createGithubClient({
    transport: async () => { const error = new Error("boom"); error.code = "forbidden"; error.status = 403; throw error; }
  });
  const single = await client.get("repos/o/r/pulls/1");
  assert.equal(single.ok, false);
  assert.equal(single.data, null);
  assert.deepEqual(single.error, { code: "forbidden", status: 403 });
  const paged = await client.paginate("repos/o/r/pulls");
  assert.equal(paged.ok, false);
  assert.deepEqual(paged.items, []);
  assert.equal(paged.error.code, "forbidden");
});

test("client bounds a hanging transport with a timeout", async () => {
  const client = createGithubClient({ transport: () => new Promise(() => {}) });
  const result = await client.get("repos/o/r/pulls/1", { timeoutMs: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, GITHUB_ERROR.TIMEOUT);
  assert.equal(result.data, null);
});

test("client rejects an invalid or absolute path without calling the transport", async () => {
  let called = false;
  const client = createGithubClient({ transport: async () => { called = true; return []; } });
  for (const path of ["/repos/o/r", "https://api.github.com/repos/o/r", "", null]) {
    const result = await client.get(path);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, GITHUB_ERROR.INVALID_PATH);
  }
  assert.equal(called, false);
});

test("normalizeGithubError maps aborts and unknowns without leaking a message", () => {
  const abort = new Error("secret ghp_" + "a".repeat(30));
  abort.name = "AbortError";
  assert.deepEqual(normalizeGithubError(abort), { code: GITHUB_ERROR.TIMEOUT, status: null });
  const unknown = normalizeGithubError(new Error("x"));
  assert.deepEqual(unknown, { code: GITHUB_ERROR.TRANSPORT, status: null });
  assert.equal(JSON.stringify(unknown).includes("ghp_"), false);
  assert.deepEqual(GITHUB_CLIENT_DEFAULTS, { maxPages: 10, perPage: 100, timeoutMs: 15000 });
});

// ---------------------------------------------------------------------------
// Delivery verdict: verified / pending / unknown
// ---------------------------------------------------------------------------

test("a merged, fully checked delivery with green post-merge runs is verified", () => {
  const verdict = verifyDelivery(asfConfig(), observation());
  assert.equal(verdict.status, DELIVERY_STATUS.VERIFIED);
  assert.deepEqual(verdict.reasons, [DELIVERY_REASON.VERIFIED]);
  assert.deepEqual(verdict.proof, {
    profile: "asf", pr: 52, headSha, mergeSha, runId,
    postMergeRuns: ["CI", "Pages"], archived: false
  });
  assert.equal(Object.isFrozen(verdict), true);
  assert.equal(Object.isFrozen(verdict.proof), true);
});

test("a verified delivery satisfies a dependency even when not archived (AC3)", () => {
  const archived = verifyDelivery(asfConfig(), observation({ archived: true }));
  const unarchived = verifyDelivery(asfConfig(), observation({ archived: false }));
  assert.equal(archived.status, DELIVERY_STATUS.VERIFIED);
  assert.equal(unarchived.status, DELIVERY_STATUS.VERIFIED);
  assert.equal(archived.proof.archived, true);
  assert.equal(unarchived.proof.archived, false);
});

test("a successful run without a merged PR unblocks nothing (AC1)", () => {
  const verdict = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull({ merged: false, state: "open", merged_at: undefined })],
    run: greenRun()
  }));
  assert.equal(verdict.status, DELIVERY_STATUS.PENDING);
  assert.equal(verdict.reasons[0], DELIVERY_REASON.PULL_REQUEST_OPEN);
  assert.equal(verdict.proof, null);

  const none = verifyDelivery(asfConfig(), observation({ pullRequests: [], run: greenRun() }));
  assert.equal(none.status, DELIVERY_STATUS.PENDING);
  assert.equal(none.reasons[0], DELIVERY_REASON.NO_MERGED_PULL_REQUEST);
  assert.equal(none.proof, null);
});

test("a draft plan PR never becomes delivered (AC2)", () => {
  const verdict = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull({ merged: false, state: "open", draft: true, merged_at: undefined })]
  }));
  assert.equal(verdict.status, DELIVERY_STATUS.PENDING);
  assert.equal(verdict.reasons[0], DELIVERY_REASON.DRAFT_PULL_REQUEST);
  assert.equal(verdict.proof, null);
});

test("an OpenSpec plan body is rejected as a plan PR", () => {
  const config = createOpenspecDeliveryConfig({ taskId, repository });
  const branch = "agent/openspec/" + taskId;
  const verdict = verifyDelivery(config, observation({
    pullRequests: [mergedPull({
      title: "OpenSpec: " + taskId, body: "Phase plan: review the proposed change",
      head: { ref: branch, repo: { full_name: repository }, sha: headSha }
    })],
    run: greenRun({
      id: 1, head_branch: branch,
      path: ".github/workflows/agent-openspec.yml"
    })
  }));
  assert.equal(verdict.status, DELIVERY_STATUS.PENDING);
  assert.equal(verdict.reasons[0], DELIVERY_REASON.PLAN_PULL_REQUEST);
});

test("a wrong head SHA or run SHA mismatch never verifies (AC2)", () => {
  const wrongHead = "c".repeat(40);
  const mismatch = verifyDelivery(asfConfig(), observation({
    run: greenRun({ head_sha: wrongHead })
  }));
  assert.equal(mismatch.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(mismatch.reasons[0], DELIVERY_REASON.RUN_SHA_MISMATCH);

  const badHead = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull({ head: { ref: "agent/asf/" + taskId + "-run-" + runId, repo: { full_name: repository }, sha: "nope" } })]
  }));
  assert.equal(badHead.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(badHead.reasons[0], DELIVERY_REASON.INVALID_HEAD_SHA);
});

test("a red CI check is never delivered; an unknown check is fail-closed (AC2)", () => {
  const red = verifyDelivery(asfConfig(), observation({
    headChecks: [check(headSha, { conclusion: "failure" })]
  }));
  assert.equal(red.status, DELIVERY_STATUS.PENDING);
  assert.equal(red.reasons[0], DELIVERY_REASON.CHECK_FAILED);
  assert.equal(red.proof, null);

  const missing = verifyDelivery(asfConfig(), observation({ headChecks: [] }));
  assert.equal(missing.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(missing.reasons[0], DELIVERY_REASON.CHECK_MISSING);

  const unproven = verifyDelivery(asfConfig(), observation({
    headChecks: [check(headSha, { app: { slug: "other", id: 22 } })]
  }));
  assert.equal(unproven.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(unproven.reasons[0], DELIVERY_REASON.CHECK_PROVENANCE);

  const unknownConclusion = verifyDelivery(asfConfig(), observation({
    headChecks: [check(headSha, { conclusion: "neutral" })]
  }));
  assert.equal(unknownConclusion.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(unknownConclusion.reasons[0], DELIVERY_REASON.CHECK_UNKNOWN);
});

test("ambiguous or concurrent PRs never verify", () => {
  const duplicate = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull(), mergedPull({ number: 53 })]
  }));
  assert.equal(duplicate.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(duplicate.reasons[0], DELIVERY_REASON.AMBIGUOUS_PULL_REQUEST);

  const concurrent = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull(), mergedPull({ number: 54, state: "open", merged: false, merged_at: undefined })]
  }));
  assert.equal(concurrent.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(concurrent.reasons[0], DELIVERY_REASON.CONCURRENT_PULL_REQUEST);
});

test("an API error or truncated pagination is never read as an absence of conflict", () => {
  const apiError = verifyDelivery(asfConfig(), observation({
    errors: [{ stage: "main_runs", code: "timeout" }]
  }));
  assert.equal(apiError.status, DELIVERY_STATUS.UNKNOWN);
  assert.deepEqual(apiError.reasons, [DELIVERY_REASON.API_ERROR, "main_runs:timeout"]);
  assert.equal(apiError.proof, null);

  const truncated = verifyDelivery(asfConfig(), observation({ truncated: true }));
  assert.equal(truncated.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(truncated.reasons[0], DELIVERY_REASON.PAGINATION_LIMIT);
});

test("identity mismatches (base, branch, author) fail closed", () => {
  const base = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull({ base: { ref: "release" } })]
  }));
  assert.equal(base.reasons[0], DELIVERY_REASON.UNEXPECTED_BASE);

  const branch = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull({ head: { ref: "agent/asf/ASF-V2-008-run-1", repo: { full_name: repository }, sha: headSha } })]
  }));
  assert.equal(branch.reasons[0], DELIVERY_REASON.UNEXPECTED_BRANCH);

  const author = verifyDelivery(asfConfig(), observation({
    pullRequests: [mergedPull({ user: { login: "someone" } })]
  }));
  assert.equal(author.reasons[0], DELIVERY_REASON.UNEXPECTED_AUTHOR);

  for (const verdict of [base, branch, author]) assert.equal(verdict.status, DELIVERY_STATUS.UNKNOWN);
});

test("a merge commit absent from main and a missing post-merge run block delivery", () => {
  const diverged = verifyDelivery(asfConfig(), observation({ comparison: { status: "diverged" } }));
  assert.equal(diverged.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(diverged.reasons[0], DELIVERY_REASON.MERGE_NOT_IN_MAIN);

  const missingPage = verifyDelivery(asfConfig(), observation({
    mainRuns: postMerge().filter(run => run.name !== "Pages")
  }));
  assert.equal(missingPage.status, DELIVERY_STATUS.PENDING);
  assert.equal(missingPage.reasons[0], DELIVERY_REASON.POST_MERGE_MISSING);

  const pendingPage = verifyDelivery(asfConfig(), observation({
    mainRuns: postMerge().map(run => run.name === "Pages" ? { ...run, status: "in_progress", conclusion: null } : run)
  }));
  assert.equal(pendingPage.status, DELIVERY_STATUS.PENDING);
  assert.equal(pendingPage.reasons[0], DELIVERY_REASON.POST_MERGE_PENDING);
});

test("an invalid config or a missing observation fails closed", () => {
  assert.equal(verifyDelivery(null, observation()).status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(verifyDelivery({}, observation()).reasons[0], DELIVERY_REASON.INVALID_CONFIG);
  const missing = verifyDelivery(asfConfig(), null);
  assert.equal(missing.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(missing.reasons[0], DELIVERY_REASON.MISSING_OBSERVATION);
});

test("a pending delivery is omitted from scheduler evidence while unknown stops the wave", () => {
  const verified = toSchedulerEvidence(verifyDelivery(asfConfig(), observation()));
  assert.equal(verified.status, "verified");
  assert.equal(verified.proof.mergeSha, mergeSha);

  const pending = toSchedulerEvidence(verifyDelivery(asfConfig(), observation({ pullRequests: [] })));
  assert.equal(pending, null);

  const unknown = toSchedulerEvidence(verifyDelivery(asfConfig(), observation({ truncated: true })));
  assert.deepEqual(unknown, { status: "unknown", proof: null });
});

// ---------------------------------------------------------------------------
// Read-only observation collector
// ---------------------------------------------------------------------------

function fakeClient(script) {
  const calls = [];
  return {
    calls,
    async paginate(path) {
      calls.push(path);
      const key = path.includes("state=closed") ? "closed" : "open";
      return { ok: true, items: script[key] ?? [], pages: 1, truncated: false, error: null };
    },
    async get(path) {
      calls.push(path);
      const failed = script.fail && path.includes(script.fail);
      if (failed) return { ok: false, data: null, error: { code: "timeout", status: null } };
      if (path.includes("/check-runs")) {
        const isHead = path.includes(headSha);
        return { ok: true, data: { total_count: (isHead ? script.headChecks : script.mainChecks).length,
          check_runs: isHead ? script.headChecks : script.mainChecks }, error: null };
      }
      if (path.includes("/actions/runs/")) return { ok: true, data: script.run, error: null };
      if (path.includes("head_sha=")) return { ok: true, data: { total_count: script.mainRuns.length, workflow_runs: script.mainRuns }, error: null };
      if (path.includes("/pulls/")) return { ok: true, data: script.pull, error: null };
      if (path.includes("/compare/")) return { ok: true, data: script.comparison, error: null };
      return { ok: true, data: null, error: null };
    }
  };
}

test("the collector observes GitHub read-only and yields a verified verdict", async () => {
  const client = fakeClient({
    closed: [mergedPull()], open: [], pull: mergedPull(),
    run: greenRun(), headChecks: [check(headSha)], mainChecks: [check(mergeSha)],
    mainRuns: postMerge(), comparison: { status: "ahead" }
  });
  const config = asfConfig();
  const collected = await collectDeliveryObservation(client, config, { observedAt, archived: false });
  assert.equal(collected.errors.length, 0);
  assert.equal(collected.comparison.status, "ahead");
  const verdict = verifyDelivery(config, collected);
  assert.equal(verdict.status, DELIVERY_STATUS.VERIFIED);
  assert.equal(client.calls.some(path => /method=PUT|method=POST|method=DELETE/.test(path)), false);
});

test("a failed read becomes an API error and the verdict is unknown, not clear", async () => {
  const client = fakeClient({
    closed: [mergedPull()], open: [], pull: mergedPull(),
    run: greenRun(), headChecks: [check(headSha)], mainChecks: [check(mergeSha)],
    mainRuns: postMerge(), comparison: { status: "ahead" },
    fail: "/compare/"
  });
  const config = asfConfig();
  const collected = await collectDeliveryObservation(client, config, { observedAt });
  assert.ok(collected.errors.some(entry => entry.stage === "comparison" && entry.code === "timeout"));
  const verdict = verifyDelivery(config, collected);
  assert.equal(verdict.status, DELIVERY_STATUS.UNKNOWN);
  assert.equal(verdict.reasons[0], DELIVERY_REASON.API_ERROR);
});

// ---------------------------------------------------------------------------
// Purity guards
// ---------------------------------------------------------------------------

test("the client and delivery modules perform no I/O, network or clock reads", () => {
  for (const relative of [
    "../scripts/asf/github/client.mjs",
    "../scripts/asf/delivery/verify.mjs",
    "../scripts/asf/delivery/observe.mjs"
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["']node:(fs|child_process|http|https|net|dns|os)["']/, relative);
    assert.doesNotMatch(source, /\bfetch\s*\(/, relative);
    assert.doesNotMatch(source, /\bnew Date\b/, relative);
    assert.doesNotMatch(source, /Math\.random/, relative);
  }
});

test("only the transport file binds to a process", () => {
  const dir = new URL("../scripts/asf/github/", import.meta.url);
  const processFiles = readdirSync(dir)
    .filter(name => name.endsWith(".mjs") &&
      /from\s+["']node:child_process["']/.test(readFileSync(new URL(name, dir), "utf8")));
  assert.deepEqual(processFiles, ["transport.mjs"]);
  assert.equal(RUN_CORRELATION.HEAD_BRANCH, "head-branch");
});
