#!/usr/bin/env node
/**
 * Fail-closed, read-only GitHub evidence verifier for ASF dependencies.
 * Run with a read-only GH_TOKEN in the owner's workflow preflight, before OpenRouter.
 * Never trust task status or a PR title on their own as delivery evidence.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { preflight } from "./agent-asf-policy.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const APP_LOGIN = "threadstep-software-factory[bot]";

export function validateAsfDelivery(dep, repository, evidence) {
  if (!/^ASF-V2-0(?:0[1-9]|1[01])$/.test(dep) ||
      !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid dependency or repository");
  const { pullRequests, run, headChecks, mainChecks, mainRuns, comparison } = evidence;
  if (!Array.isArray(pullRequests) || !Array.isArray(headChecks) ||
      !Array.isArray(mainChecks) || !Array.isArray(mainRuns) || !comparison) {
    throw new Error("Incomplete GitHub evidence");
  }
  const owner = repository.split("/")[0];
  const expectedRef = new RegExp("^agent/asf/" + dep + "-run-([0-9]+)$");
  const candidates = pullRequests.filter(pr =>
    pr?.title === "Agent ASF: " + dep &&
    pr?.merged_at && pr?.state === "closed" && pr?.base?.ref === "main" &&
    pr?.head?.repo?.full_name === repository &&
    pr?.user?.login === APP_LOGIN &&
    expectedRef.test(pr?.head?.ref ?? ""));
  if (candidates.length !== 1) throw new Error("Expected exactly one merged ASF PR: " + dep);
  const pr = candidates[0], runId = Number(expectedRef.exec(pr.head.ref)[1]);
  const headSha = pr.head?.sha, mergeSha = pr.merge_commit_sha;
  if (!Number.isSafeInteger(runId) || runId <= 0 || !SHA.test(headSha ?? "") ||
      !SHA.test(mergeSha ?? "") || !pr.number || pr.merged !== true) {
    throw new Error("Merged PR identity or SHA is not verifiable: " + dep);
  }
  if (!run || run.id !== runId || run.status !== "completed" ||
      run.conclusion !== "success" || run.event !== "workflow_dispatch" ||
      run.actor?.login !== owner ||
      run.path !== ".github/workflows/agent-asf.yml") {
    throw new Error("Owner-authorized ASF run is missing or not successful: " + dep);
  }
  const successfulCheck = (checks, sha) => checks.some(c =>
    c?.name === "check" && c?.head_sha === sha &&
    c?.status === "completed" && c?.conclusion === "success" &&
    c?.app?.slug === "github-actions" && c?.app?.id === 15368);
  if (!successfulCheck(headChecks, headSha) ||
      !successfulCheck(mainChecks, mergeSha)) {
    throw new Error("Required independent check not verified on PR and merge commit: " + dep);
  }
  if (!["ahead", "identical"].includes(comparison.status)) {
    throw new Error("Merge commit is not confirmed in current main history: " + dep);
  }
  for (const name of ["CI", "Pages"]) {
    if (!mainRuns.some(w =>
      w?.name === name && w?.head_sha === mergeSha && w?.event === "push" &&
      w?.status === "completed" && w?.conclusion === "success" &&
      w?.created_at >= pr.merged_at)) {
      throw new Error("Successful post-merge " + name + " run not verified for " + dep);
    }
  }
  return Object.freeze({task:dep,pr:pr.number,headSha,mergeSha,runId});
}

function api(path) {
  const out = execFileSync("gh", ["api", path], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000,
    maxBuffer: 8 * 1024 * 1024
  });
  return JSON.parse(out);
}

function findMergedAsfPr(dep, repo) {
  const matches = [];
  const expected = "Agent ASF: " + dep;
  // Hard bound: an old dependency outside the inspected pages stops safely.
  for (let page = 1; page <= 10; page++) {
    const prs = api("repos/" + repo + "/pulls?state=closed&per_page=100&page=" + page);
    if (!Array.isArray(prs)) throw new Error("GitHub returned an invalid PR collection");
    matches.push(...prs.filter(pr => pr.title === expected && pr.merged_at));
    if (prs.length < 100) break;
    if (page === 10) throw new Error("PR pagination safety limit reached");
  }
  if (matches.length !== 1) throw new Error("Dependency requires one unambiguous merged agent PR: " + dep);
  // A full GET supplies all head/base fields for identity validation.
  return api("repos/" + repo + "/pulls/" + matches[0].number);
}

function checks(repo, sha) {
  const data = api("repos/" + repo + "/commits/" + sha + "/check-runs?per_page=100");
  if (!Array.isArray(data.check_runs) || data.total_count > 100) {
    throw new Error("Incomplete check-run response");
  }
  return data.check_runs;
}

export function verifyFromGithub(dep, repo) {
  const pr = findMergedAsfPr(dep, repo);
  const ref = /^agent\/asf\/ASF-V2-0(?:0[1-9]|1[01])-run-(\d+)$/.exec(pr.head?.ref ?? "");
  if (!ref || !SHA.test(pr.head?.sha ?? "") || !SHA.test(pr.merge_commit_sha ?? "")) {
    throw new Error("Unrecognized ASF merged PR identity: " + dep);
  }
  const run = api("repos/" + repo + "/actions/runs/" + ref[1]);
  const main = api("repos/" + repo + "/actions/runs?head_sha=" + pr.merge_commit_sha +
    "&event=push&per_page=100");
  if (!Array.isArray(main.workflow_runs) || main.total_count > 100) {
    throw new Error("Incomplete post-merge workflow evidence");
  }
  return validateAsfDelivery(dep, repo, {
    pullRequests:[pr], run,
    headChecks:checks(repo, pr.head.sha),
    mainChecks:checks(repo, pr.merge_commit_sha),
    mainRuns:main.workflow_runs,
    comparison:api("repos/" + repo + "/compare/" + pr.merge_commit_sha + "...main")
  });
}

function main() {
  const taskId = process.argv[2], repo = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? "") || !process.env.GH_TOKEN) {
    throw new Error("GITHUB_REPOSITORY and read-only GH_TOKEN are required");
  }
  const deps = preflight(taskId);
  for (const dep of deps) {
    const proof = verifyFromGithub(dep, repo);
    process.stdout.write("Verified dependency " + dep + " via PR #" + proof.pr +
      ", merged SHA " + proof.mergeSha + "\n");
  }
  process.stdout.write("All dependencies verified for " + taskId + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (error) {
    process.stderr.write("ASF delivery preflight: " + error.message + "\n");
    process.exitCode = 1;
  }
}
