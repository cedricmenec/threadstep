/**
 * ASF-V3-010 | Sealed production trust-root gate — DISABLED by default.
 *
 * This is the ONLY intended production entry point for anchored-registry
 * observation. It has NO caller arguments for public key, anchor or issuer:
 * accepting caller-selected trust settings would make self-signed mandates
 * indistinguishable from genuine owner approvals.
 *
 * Before future activation, a separately owner-approved, code-reviewed change
 * on protected main must pin an Ed25519 PUBLIC key and genesis/checkpoint
 * hashes in this file. The actual issuer is NOT implemented here.
 *
 * Never sign, dispatch, write Git refs, or authorize payment.
 */
import { auditV3AnchoredGlobalRegistry, v3PublicKeyFingerprint }
  from "./registry-ancestry-audit.mjs";
import { ADMISSION_REGISTRY_REF } from "./global-admission.mjs";

const REPO = "cedricmenec/threadstep";
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const GIT_REF = "refs/heads/asf/control/active-wave-v3";
const POLICY_FIELDS = ["version", "repository", "ref", "publicKeyPem", "anchor"];
const ANCHOR_FIELDS = ["version", "repository", "ref", "genesisSha",
  "sourceSha", "checkpointSha", "checkpointRegistryHash",
  "verificationKeyFingerprint"];
const exact = (o, names) => o !== null && typeof o === "object" &&
  !Array.isArray(o) && Object.keys(o).length === names.length &&
  names.every(n => Object.hasOwn(o, n));
const report = (status, code, evidence = null) => Object.freeze({
  status, code, trustRootActive: false,
  authorized: false, canSign: false, canDispatch: false, canSpend: false,
  evidence: evidence === null ? null : Object.freeze(evidence)
});

/**
 * UNSPECIFIED intentionally: there is no owner-approved issuer/manifest,
 * genesis ref or out-of-band checkpoint to anchor today.
 *
 * The approved replacement MUST be a literal, static, owner-reviewed source
 * value on protected main. Do NOT read policy from env, workflow_dispatch,
 * github.event, agent output, wave branches, PR files or remote repo content.
 *
 * Sample SHAPE only (NEVER use synthetic values here):
 *
 * const PINNED_PRODUCTION_ROOT = Object.freeze({
 *   version: 1, repository: "cedricmenec/threadstep",
 *   ref: "refs/heads/asf/control/active-wave-v3",
 *   publicKeyPem: "<approved Ed25519 SPKI PEM PUBLIC key>",
 *   anchor: {
 *     version: 1, repository: "...", ref: "...",
 *     genesisSha: "<approved-commit-sha>",
 *     sourceSha: "<approved-main-sha>",
 *     checkpointSha: "<approved-checkpoint-sha>",
 *     checkpointRegistryHash: "<approved-canonical-sha256>",
 *     verificationKeyFingerprint: "<approved-spki-der-sha256>"
 *   }
 * });
 */
const PINNED_PRODUCTION_ROOT = null;

export function inspectV3PinnedRootCandidate(candidate) {
  // Pure preliminary schema validation, NEVER an authenticity attestation.
  if (!exact(candidate, POLICY_FIELDS) ||
      candidate.version !== 1 ||
      candidate.repository !== REPO || candidate.ref !== GIT_REF ||
      typeof candidate.publicKeyPem !== "string" ||
      !exact(candidate.anchor, ANCHOR_FIELDS) ||
      candidate.anchor.version !== 1 ||
      candidate.anchor.repository !== REPO ||
      candidate.anchor.ref !== ADMISSION_REGISTRY_REF ||
      !SHA.test(candidate.anchor.genesisSha ?? "") ||
      !SHA.test(candidate.anchor.sourceSha ?? "") ||
      !SHA.test(candidate.anchor.checkpointSha ?? "") ||
      !HASH.test(candidate.anchor.checkpointRegistryHash ?? "") ||
      !HASH.test(candidate.anchor.verificationKeyFingerprint ?? "") ||
      candidate.anchor.genesisSha === candidate.anchor.sourceSha ||
      candidate.anchor.checkpointSha === candidate.anchor.sourceSha ||
      v3PublicKeyFingerprint(candidate.publicKeyPem) !==
        candidate.anchor.verificationKeyFingerprint)
    return report("rejected", "pinned_root_contract_invalid");
  return report("well_formed_untrusted_candidate",
    "not_approved_without_independent_owner_pin", {
      genesisSha: candidate.anchor.genesisSha,
      checkpointSha: candidate.anchor.checkpointSha,
      keyFingerprint: candidate.anchor.verificationKeyFingerprint
    });
}

/**
 * NO dynamic trust-anchor input. Compiling this on a feature branch or calling
 * it with a forged readClient does not prove real GitHub App protection.
 */
export async function auditConfiguredV3ProductionTrustRoot({ readClient } = {}) {
  if (PINNED_PRODUCTION_ROOT === null)
    return report("disabled", "owner_pinned_root_not_configured");
  const assessment = inspectV3PinnedRootCandidate(PINNED_PRODUCTION_ROOT);
  if (assessment.status !== "well_formed_untrusted_candidate")
    return report("rejected", "configured_root_contract_invalid");
  if (typeof readClient?.get !== "function")
    return report("uncertain", "github_readonly_client_missing");
  const result = await auditV3AnchoredGlobalRegistry({
    readClient,
    // Only this compiled-in, owner-reviewed value may influence trust.
    verificationKey: PINNED_PRODUCTION_ROOT.publicKeyPem,
    trustedAnchor: PINNED_PRODUCTION_ROOT.anchor
  });
  return report(result.status, "non_authorizing_" + result.reason,
    result.evidence);
}

/**
 * Read-only policy check for the actual GitHub main ruleset response. No
 * write-permission or protection mutation. This is NOT a replacement for the
 * independent owner approval of the pinned values.
 */
export function inspectV3MainTrustRuleset(ruleset) {
  if (!ruleset || ruleset.source !== REPO ||
      ruleset.target !== "branch" || ruleset.enforcement !== "active" ||
      !Array.isArray(ruleset.conditions?.ref_name?.include) ||
      !ruleset.conditions.ref_name.include.includes("refs/heads/main") ||
      !Array.isArray(ruleset.rules) ||
      !Array.isArray(ruleset.bypass_actors) ||
      ruleset.bypass_actors.length !== 0)
    return report("rejected", "main_ruleset_not_enforced");
  const types = new Set(ruleset.rules.map(x => x.type));
  if (!["deletion", "non_fast_forward", "pull_request",
    "required_status_checks"].every(x => types.has(x)))
    return report("rejected", "missing_critical_main_protection");
  const approvals = ruleset.rules.find(x => x.type === "pull_request")
    ?.parameters?.required_approving_review_count;
  const statusChecks = ruleset.rules.find(x => x.type ===
    "required_status_checks")?.parameters?.required_status_checks;
  if (!Array.isArray(statusChecks) ||
      !statusChecks.some(x => x.context === "check"))
    return report("rejected", "main_required_check_missing");
  if (!Number.isInteger(approvals) || approvals < 1)
    return report("owner_review_required",
      "main_ruleset_has_no_mandatory_review", {
        requiredApprovals: approvals ?? null, mandatoryCheck: "check"
      });
  return report("structurally_protected_untrusted",
    "owner_approval_and_signer_root_still_required", {
      requiredApprovals: approvals, mandatoryCheck: "check"
    });
}
