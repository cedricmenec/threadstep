/**
 * ASF-V3-007: READ-ONLY static audit of the shared paid-job mutex.
 * Fail closed: intended as a regression test / proposed rollout guard, not
 * a substitute for GitHub Actions scheduling or runtime paid preflight.
 *
 * Source text is supplied by a trusted complete checkout of workflows;
 * no file I/O or network in this module.
 */
export const ASF_PAID_MUTEX = "threadstep-paid-development-v1";
const EXPECTED_V1_PAID = Object.freeze([
  ".github/workflows/agent.yml#develop",
  ".github/workflows/agent-asf.yml#develop",
  ".github/workflows/agent-openspec.yml#staged-development"
]);
const NONPAY_ERROR = "workflow_scan_incomplete";
function stripComments(text) {
  // Existing repo workflow YAML puts comments on their own lines. This is
  // deliberately conservative and NOT a general YAML parser.
  return text.split(/\r?\n/).map(x => x.trimStart().startsWith("#") ? "" : x);
}
function parsePaidJobs(path, text, violations) {
  if (typeof text !== "string" || /\t/.test(text) || text.length > 300000) {
    violations.push(path + ":invalid_or_oversized_yaml");
    return [];
  }
  const lines = stripComments(text);
  const jobsAt = lines.findIndex(x => /^jobs:\s*$/.test(x));
  if (jobsAt < 0) {
    if (lines.some(x => /\bOPENROUTER_API_KEY\b/.test(x)))
      violations.push(path + ":secret_without_jobs");
    return [];
  }
  if (lines.slice(0, jobsAt).some(x => /\bOPENROUTER_API_KEY\b/.test(x)))
    violations.push(path + ":unscoped_paid_secret");
  const jobs = [];
  for (let i = jobsAt + 1; i < lines.length;) {
    if (lines[i] && /^\S/.test(lines[i])) {
      if (lines.slice(i).some(x => /\bOPENROUTER_API_KEY\b/.test(x)))
        violations.push(path + ":secret_outside_jobs");
      break;
    }
    const header = /^  ([a-zA-Z0-9_-]+):\s*$/.exec(lines[i] ?? "");
    if (!header) {
      if (/\bOPENROUTER_API_KEY\b/.test(lines[i] ?? ""))
        violations.push(path + ":secret_outside_job");
      i++;
      continue;
    }
    const name = header[1];
    const start = ++i;
    while (i < lines.length && !/^\S/.test(lines[i]) &&
      !/^  [a-zA-Z0-9_-]+:\s*$/.test(lines[i])) i++;
    const block = lines.slice(start, i);
    const paid = block.some(x => /\bOPENROUTER_API_KEY\b/.test(x));
    if (!paid) continue;
    // Only a direct job-level concurrency mapping counts.
    const lockAt = block.findIndex(x => /^    concurrency:\s*$/.test(x));
    // Stop at the next job-level mapping or the end of the block.
    const direct = [];
    if (lockAt >= 0) {
      for (let j = lockAt + 1; j < block.length; j++) {
        if (/^    \S/.test(block[j])) break;
        direct.push(block[j]);
      }
    }
    const groups = direct.filter(x => /^      group:\s*/.test(x));
    const cancels = direct.filter(x => /^      cancel-in-progress:\s*/.test(x));
    const valid = groups.length === 1 &&
      groups[0].trim() === "group: " + ASF_PAID_MUTEX &&
      cancels.length === 1 &&
      cancels[0].trim() === "cancel-in-progress: false";
    if (!valid) violations.push(path + "#" + name + ":missing_or_unsafe_paid_mutex");
    jobs.push(path + "#" + name);
  }
  return jobs;
}

/**
 * The list MUST come from a trusted exhaustive directory listing or repo tree.
 * Passing only a cherry-picked set of workflow files is NOT an audit.
 */
export function auditPaidWorkflowMutex(workflowFiles, exhaustiveWorkflowPaths) {
  const violations = [];
  const files = workflowFiles && typeof workflowFiles === "object" &&
    !Array.isArray(workflowFiles) ? workflowFiles : {};
  const paths = Array.isArray(exhaustiveWorkflowPaths) ? exhaustiveWorkflowPaths : [];
  const actual = Object.keys(files).sort();
  const listed = [...new Set(paths)].sort();
  if (!listed.length || listed.length !== paths.length ||
    listed.some(p => !/^\.github\/workflows\/[A-Za-z0-9_-]+\.ya?ml$/.test(p)) ||
    JSON.stringify(actual) !== JSON.stringify(listed))
    violations.push(NONPAY_ERROR);
  const paidJobs = [];
  for (const path of actual) {
    if (!/^\.github\/workflows\/[A-Za-z0-9_-]+\.ya?ml$/.test(path)) {
      violations.push(path + ":invalid_workflow_path");
      continue;
    }
    paidJobs.push(...parsePaidJobs(path, files[path], violations));
  }
  for (const p of EXPECTED_V1_PAID) {
    if (!paidJobs.includes(p)) violations.push(p + ":expected_paid_job_missing");
  }
  return Object.freeze({
    ok: violations.length === 0,
    paidJobs: Object.freeze([...paidJobs].sort()),
    violations: Object.freeze([...violations].sort()),
    group: ASF_PAID_MUTEX
  });
}

/** Review a proposed V3 paid job (still inactive), with same mutex as V1. */
export function evaluateProposedV3PaidJob(spec) {
  const ok = !!spec && spec.workflow ===
    ".github/workflows/agent-openspec-v3.yml" &&
    spec.job === "staged-development" && spec.mutex === ASF_PAID_MUTEX &&
    spec.cancelInProgress === false && spec.prePaidClaim === true &&
    spec.runAttemptOne === true && spec.noAutoPaidRetry === true &&
    spec.globalWaveAdmission === true;
  return Object.freeze({ ok, decision: ok ?
    "STATIC_CONTRACT_ONLY_RUNTIME_VERIFICATION_REQUIRED" :
    "REFUSE_PROPOSED_PAID_JOB" });
}
