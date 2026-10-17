#!/usr/bin/env node
/**
 * ASF-V3-013 — V3 workflow entrypoint. SAFE / INERT by design.
 *
 * Never reads a GitHub write token or model key, dispatches a workflow,
 * claims a wave, merges a PR or makes a network request.
 * The only production trust root is disabled until separately approved.
 * A "green" local observation MUST NOT turn into paid authorization.
 */
import { pathToFileURL } from "node:url";
import { auditConfiguredV3ProductionTrustRoot } from "./production-trust-root.mjs";

const REPO = "cedricmenec/threadstep";
const CONTROLLER = REPO + "/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main";
const CHILD = REPO + "/.github/workflows/agent-openspec-v3.yml@refs/heads/main";
const ACTOR_BOT = "threadstep-software-factory[bot]";
const R = /^[1-9]\d{0,17}$/;
const SH = /^[0-9a-f]{40}$/;
const outcome = (status, reason) => Object.freeze({
  status, reason, authorized: false, canSign: false, canDispatch: false,
  canClaim: false, canSpend: false, canRetry: false
});
export function inspectV3WorkflowRuntimeContext({ mode, context } = {}) {
  if (!["controller", "child"].includes(mode)) return outcome("rejected", "bad_v3_mode");
  if (!context || typeof context !== "object" ||
      context.repository !== REPO ||
      !R.test(String(context.runId ?? "")) ||
      !SH.test(context.sha ?? "") ||
      context.ref !== "refs/heads/main" ||
      context.runAttempt !== 1)
    return outcome("rejected", "untrusted_github_runtime");
  if (mode === "controller") {
    if (context.actor !== "cedricmenec" ||
        context.eventName !== "workflow_dispatch" ||
        context.workflowRef !== CONTROLLER)
      return outcome("rejected", "invalid_owner_dispatch");
  } else {
    if (context.actor !== ACTOR_BOT ||
        context.eventName !== "workflow_dispatch" ||
        context.workflowRef !== CHILD)
      return outcome("rejected", "invalid_app_child_run");
  }
  return outcome("context_only", "still_requires_owner_pin_global_cas_and_child_claim");
}

/**
 * No success path until a separate signed and reviewed runtime integration.
 * A root configured and checked in another PR would STILL not prove a trusted
 * manifest, bound dispatch ACK, global lease, paid mutex or independent checks.
 */
export async function inspectV3PaidPreflight({ mode, context } = {}) {
  const ctx = inspectV3WorkflowRuntimeContext({ mode, context });
  if (ctx.status !== "context_only") return ctx;
  const root = await auditConfiguredV3ProductionTrustRoot({});
  if (root.status !== "consistent_untrusted_anchor")
    return outcome("disabled", "owner_pinned_root_not_active");
  return outcome("disabled", "global_admission_child_claim_and_delivery_not_wired");
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const mode = args.length === 1 ? args[0] : "";
  const context = {
    repository: env.GITHUB_REPOSITORY,
    runId: String(env.GITHUB_RUN_ID ?? ""),
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    sha: env.GITHUB_SHA,
    ref: env.GITHUB_REF,
    actor: env.GITHUB_ACTOR,
    eventName: env.GITHUB_EVENT_NAME,
    workflowRef: env.GITHUB_WORKFLOW_REF
  };
  const decision = await inspectV3PaidPreflight({mode, context});
  // Never leak tokens, input values or an untrusted exception into the logs.
  process.stderr.write("ASF V3 inactive: " + decision.status +
    "/" + decision.reason + "\n");
  return 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; },
    () => { process.stderr.write("ASF V3: fail_closed_exception\n"); process.exitCode = 1; });
}
