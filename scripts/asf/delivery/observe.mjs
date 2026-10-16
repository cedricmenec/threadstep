#!/usr/bin/env node
/**
 * Read-only observation collector for the delivery adapter (ASF-V2-007).
 *
 * `collectDeliveryObservation` performs the read-only GitHub reads needed by
 * `verifyDelivery` and assembles them into one plain observation document. It
 * never writes, requests a merge or mutates the client. Every failed read is
 * recorded as an error entry and every bound that is reached is flagged, so the
 * verifier can distinguish `pending` from fail-closed `unknown`.
 *
 * Decision logic lives entirely in ./verify.mjs; this module only observes.
 *
 * Normative reference:
 *   - docs/factory/specs/orchestrator-v1.md §7
 */
import { RUN_CORRELATION, asfBranchPattern, openspecBranchPattern } from "./verify.mjs";

const PER_PAGE = 100;
const SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;

function isMerged(pr) {
  return pr?.merged === true && pr?.state === "closed" && typeof pr?.merged_at === "string";
}

function hasList(items, field) {
  return items && Array.isArray(items[field]);
}

/**
 * Read a GitHub endpoint that returns `{ total_count, <field>: [...] }`. A
 * `total_count` above the single-page bound is reported as truncated.
 */
async function readBoundedList(client, path, field, errors, stage) {
  const response = await client.get(path);
  if (!response.ok) {
    errors.push({ stage, code: response.error.code });
    return { items: [], truncated: false };
  }
  if (!hasList(response.data, field)) {
    errors.push({ stage, code: "invalid_response" });
    return { items: [], truncated: false };
  }
  const truncated = Number.isInteger(response.data.total_count) &&
    response.data.total_count > PER_PAGE;
  return { items: response.data[field], truncated };
}

async function resolveRun(client, config, titled, errors) {
  if (!titled.length) return null;
  if (config.runCorrelation === RUN_CORRELATION.BRANCH_RUN_ID) {
    for (const pr of titled) {
      const match = typeof pr?.head?.ref === "string" ? config.branchPattern.exec(pr.head.ref) : null;
      if (!match) continue;
      const response = await client.get("repos/" + config.repository + "/actions/runs/" + match[1]);
      if (!response.ok) {
        errors.push({ stage: "run", code: response.error.code });
        return null;
      }
      return response.data;
    }
    return null;
  }
  const pr = titled.find(entry => typeof entry?.head?.ref === "string" &&
    config.branchPattern.test(entry.head.ref));
  if (!pr) return null;
  const path = "repos/" + config.repository + "/actions/runs?head_branch=" +
    encodeURIComponent(pr.head.ref) + "&event=workflow_dispatch";
  const runs = await readBoundedList(client, path, "workflow_runs", errors, "run");
  if (runs.truncated) {
    errors.push({ stage: "run", code: "pagination_limit" });
    return null;
  }
  return runs.items.length === 1 ? runs.items[0] : null;
}

/**
 * Observe a task's delivery through a read-only client. Returns a plain
 * observation document consumed by `verifyDelivery`. `options.observedAt` and
 * `options.archived` are injected by the caller; the collector never reads a
 * clock or decides archive state on its own.
 */
export async function collectDeliveryObservation(client, config, options = {}) {
  const errors = [];
  let truncated = false;
  const observation = {
    pullRequests: [],
    run: null,
    headChecks: [],
    mainChecks: [],
    mainRuns: [],
    comparison: null,
    errors,
    truncated: false,
    observedAt: typeof options.observedAt === "string" ? options.observedAt : null,
    archived: options.archived === true
  };

  const listOptions = { maxPages: options.maxPages };
  const closed = await client.paginate("repos/" + config.repository + "/pulls?state=closed", listOptions);
  if (!closed.ok) errors.push({ stage: "pull_requests_closed", code: closed.error.code });
  if (closed.truncated) truncated = true;
  const open = await client.paginate("repos/" + config.repository + "/pulls?state=open", listOptions);
  if (!open.ok) errors.push({ stage: "pull_requests_open", code: open.error.code });
  if (open.truncated) truncated = true;

  observation.pullRequests = [...(closed.items ?? []), ...(open.items ?? [])];
  observation.truncated = truncated;

  const titled = observation.pullRequests.filter(pr => pr?.title === config.prTitle);
  const merged = titled.filter(isMerged);
  observation.run = await resolveRun(client, config, titled, errors);

  if (errors.length || truncated || merged.length !== 1) return observation;

  const prNumber = merged[0].number;
  const full = await client.get("repos/" + config.repository + "/pulls/" + prNumber);
  let pr = merged[0];
  if (full.ok && full.data && typeof full.data === "object") {
    pr = full.data;
    observation.pullRequests = observation.pullRequests
      .map(entry => entry.number === prNumber ? pr : entry);
  } else if (!full.ok) {
    errors.push({ stage: "pull_request", code: full.error.code });
    return observation;
  }

  const headSha = pr.head?.sha;
  const mergeSha = pr.merge_commit_sha;
  if (SHA_PATTERN.test(headSha ?? "")) {
    const head = await readBoundedList(client, "repos/" + config.repository + "/commits/" +
      headSha + "/check-runs", "check_runs", errors, "head_checks");
    observation.headChecks = head.items;
    if (head.truncated) observation.truncated = true;
  }
  if (SHA_PATTERN.test(mergeSha ?? "")) {
    const mainChecks = await readBoundedList(client, "repos/" + config.repository + "/commits/" +
      mergeSha + "/check-runs", "check_runs", errors, "main_checks");
    observation.mainChecks = mainChecks.items;
    if (mainChecks.truncated) observation.truncated = true;
    const mainRuns = await readBoundedList(client, "repos/" + config.repository + "/actions/runs?head_sha=" +
      mergeSha + "&event=push", "workflow_runs", errors, "main_runs");
    observation.mainRuns = mainRuns.items;
    if (mainRuns.truncated) observation.truncated = true;

    const compare = await client.get("repos/" + config.repository + "/compare/" + mergeSha + "...main");
    if (compare.ok && compare.data && typeof compare.data === "object") {
      observation.comparison = { status: compare.data.status };
    } else if (!compare.ok) {
      errors.push({ stage: "comparison", code: compare.error.code });
    }
  }
  return observation;
}

export { asfBranchPattern, openspecBranchPattern };
