#!/usr/bin/env node
/**
 * Enable GitHub native auto-merge only when an active main ruleset requires
 * the independent CI job. Never call "gh pr merge --auto" without this guard:
 * GitHub can otherwise merge immediately when no checks are required.
 *
 * Operates after a PR was pushed using the short-lived GitHub App token.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_CHECK = "check";
const TARGET_REF = "refs/heads/main";

/**
 * Branch families allowed to REQUEST native auto-merge. They are deliberately
 * separate: a development agent keeps exactly its `agent/...` branches, and the
 * ASF-V2-010 archiver uses only the documentary `asf/archive/...` family. Naming
 * a branch never widens permission — the merge is still gated below by the
 * active `Protect Main` ruleset, its required `check`, the pushed head SHA and
 * the absence of `--admin`.
 */
export const AGENT_BRANCH_PATTERN = /^agent\/(?:openspec\/)?TS-[0-9]{3}$/;
export const ARCHIVE_BRANCH_PATTERN = /^asf\/archive\/[a-z0-9][a-z0-9-]{0,63}$/;

export function isAgentBranch(branch) {
  return typeof branch === "string" && AGENT_BRANCH_PATTERN.test(branch);
}

export function isArchiveBranch(branch) {
  return typeof branch === "string" && ARCHIVE_BRANCH_PATTERN.test(branch);
}

export function isAcceptedAutoMergeBranch(branch) {
  return isAgentBranch(branch) || isArchiveBranch(branch);
}

export function applicableMainRule(rule) {
  const refs = rule?.conditions?.ref_name;
  return rule?.enforcement === "active" &&
    rule?.target === "branch" &&
    Array.isArray(refs?.include) &&
    (refs.include.includes(TARGET_REF) || refs.include.includes("~DEFAULT_BRANCH")) &&
    // Fail closed if any exclusion patterns exist, including wildcards which
    // could exclude main despite an apparently applicable inclusion rule.
    Array.isArray(refs.exclude) && refs.exclude.length === 0;
}

export function validateAutoMergePrerequisites({ repository, branch, rulesets }) {
  if (repository?.default_branch !== "main" || repository?.allow_auto_merge !== true) {
    throw new Error("Repository must use main and have Allow auto-merge enabled");
  }
  if (branch?.protected !== true) {
    throw new Error("main is not protected; refusing auto-merge");
  }
  const eligible = Array.isArray(rulesets) && rulesets.some(rule => {
    if (!applicableMainRule(rule)) return false;
    const rules = rule?.rules ?? [];
    const pr = rules.find(item => item.type === "pull_request");
    const checks = rules.find(item => item.type === "required_status_checks");
    return Boolean(pr && Array.isArray(checks?.parameters?.required_status_checks) &&
      checks.parameters.required_status_checks.some(c => c.context === REQUIRED_CHECK));
  });
  if (!eligible) {
    throw new Error("No active main ruleset requires PRs and the independent CI check; add the 'check' status to Protect Main first");
  }
  return true;
}

export function validateAutoMergeTarget(pr, { expectedHeadRef, expectedHeadSha }) {
  if (!pr || pr.state !== "OPEN" || pr.isDraft || pr.baseRefName !== "main" ||
      pr.headRefName !== expectedHeadRef || pr.headRefOid !== expectedHeadSha ||
      !Number.isInteger(pr.number) || pr.number <= 0) {
    throw new Error("PR state, draft flag, main base, branch or head SHA does not match; refusing auto-merge");
  }
  return pr.number;
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function api(path) {
  return JSON.parse(gh(["api", path]));
}

function requestAutoMerge(expectedHeadRef, label) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!/^[-\w.]+\/[-\w.]+$/.test(repo ?? "") || !process.env.GH_TOKEN) {
    throw new Error("Expected GITHUB_REPOSITORY and GH_TOKEN are required");
  }
  const repository = api(`repos/${repo}`);
  const branch = api(`repos/${repo}/branches/main`);
  const summaries = api(`repos/${repo}/rulesets?includes_parents=true&per_page=100`);
  if (!Array.isArray(summaries)) throw new Error("Unable to enumerate GitHub rulesets");
  const rulesets = summaries.filter(rule => rule.enforcement === "active").map(rule =>
    api(`repos/${repo}/rulesets/${rule.id}`));
  validateAutoMergePrerequisites({ repository, branch, rulesets });

  const expectedHeadSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const pr = JSON.parse(gh(["pr", "view", expectedHeadRef, "--repo", repo,
    "--json", "number,state,isDraft,baseRefName,headRefName,headRefOid,url"]));
  const number = validateAutoMergeTarget(pr, { expectedHeadRef, expectedHeadSha });
  console.log(`Enabling native auto-merge for ${label} PR #${number}; only after required CI ${REQUIRED_CHECK} passes.`);
  gh(["pr", "merge", String(number), "--repo", repo, "--auto", "--merge",
    "--match-head-commit", expectedHeadSha]);
  console.log(`GitHub accepted auto-merge for PR #${number}.`);
  return number;
}

export function runAutoMerge() {
  const expectedHeadRef = process.env.AGENT_BRANCH;
  if (!isAgentBranch(expectedHeadRef ?? "")) {
    throw new Error("Expected GITHUB_REPOSITORY, AGENT_BRANCH and GH_TOKEN are required");
  }
  return requestAutoMerge(expectedHeadRef, "agent");
}

/**
 * Dedicated archive entry point. It accepts only the documentary
 * `asf/archive/<slug>` family and applies the exact same prerequisites and
 * target checks as the agent path; it never uses `--admin`.
 */
export function runArchiveAutoMerge() {
  const expectedHeadRef = process.env.ASF_ARCHIVE_BRANCH;
  if (!isArchiveBranch(expectedHeadRef ?? "")) {
    throw new Error("Expected GITHUB_REPOSITORY, ASF_ARCHIVE_BRANCH and GH_TOKEN are required");
  }
  return requestAutoMerge(expectedHeadRef, "archive");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "archive") runArchiveAutoMerge();
    else runAutoMerge();
  } catch (error) {
    // Fail closed; the PR remains open for correction/manual review.
    console.error("::error::Safe auto-merge not enabled: " + error.message);
    process.exitCode = 1;
  }
}
