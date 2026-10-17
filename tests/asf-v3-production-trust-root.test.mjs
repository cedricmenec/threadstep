import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  auditConfiguredV3ProductionTrustRoot,
  inspectV3PinnedRootCandidate, inspectV3MainTrustRuleset
} from "../scripts/asf/v3/production-trust-root.mjs";
import { v3PublicKeyFingerprint } from
  "../scripts/asf/v3/registry-ancestry-audit.mjs";
import { ADMISSION_REGISTRY_REF } from
  "../scripts/asf/v3/global-admission.mjs";

const SRC = "a".repeat(40);
const ROOT = "b".repeat(40);
const HASH = "c".repeat(64);
const REPO = "cedricmenec/threadstep";
const trustedCandidate = publicKeyPem => ({
  version: 1, repository: REPO, ref: ADMISSION_REGISTRY_REF,
  publicKeyPem,
  anchor: {
    version: 1, repository: REPO, ref: ADMISSION_REGISTRY_REF,
    genesisSha: ROOT, sourceSha: SRC, checkpointSha: ROOT,
    checkpointRegistryHash: HASH,
    verificationKeyFingerprint: v3PublicKeyFingerprint(publicKeyPem)
  }
});
const ruleset = () => ({
  source: REPO, target: "branch", enforcement: "active",
  conditions: { ref_name: {
    include: ["refs/heads/main"], exclude: []
  }},
  bypass_actors: [],
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "pull_request", parameters: {
      required_approving_review_count: 0
    }},
    { type: "required_status_checks", parameters: {
      required_status_checks: [{ context: "check", integration_id: 15368 }]
    }}
  ]
});
const noPowers = value => {
  assert.equal(value.authorized, false);
  assert.equal(value.canSign, false);
  assert.equal(value.canDispatch, false);
  assert.equal(value.canSpend, false);
  assert.equal(value.trustRootActive, false);
};

test("production root MUST be disabled, even if caller supplies a fake key and GitHub client", async () => {
  const calls = [];
  const result = await auditConfiguredV3ProductionTrustRoot({
    readClient: { get: async path => {
      calls.push(path);
      throw new Error("should never read GitHub");
    }},
    verificationKey: generateKeyPairSync("ed25519").publicKey,
    trustedAnchor: { genesisSha: ROOT }
  });
  assert.equal(result.status, "disabled");
  assert.equal(result.code, "owner_pinned_root_not_configured");
  noPowers(result);
  assert.deepEqual(calls, []);
  assert.ok(Object.isFrozen(result));
});

test("no context, model argument, policy JSON or environment can unlock production entry point", async () => {
  for (const payload of [
    {},
    { trustRootActive: true, authorized: true },
    { actor: "cedricmenec", runAttempt: 1 },
    { policy: "override", ownerApproved: true },
    { readClient: { get: async () => ({ ok: true }) } }
  ]) {
    const result = await auditConfiguredV3ProductionTrustRoot(payload);
    assert.equal(result.status, "disabled");
    noPowers(result);
  }
});

test("well-formed ED25519 public key plus self-declared anchor is NEVER owner-approved", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ format: "pem", type: "spki" });
  const candidate = trustedCandidate(pem);
  const report = inspectV3PinnedRootCandidate(candidate);
  assert.equal(report.status, "well_formed_untrusted_candidate");
  assert.equal(report.code, "not_approved_without_independent_owner_pin");
  noPowers(report);
  assert.equal(v3PublicKeyFingerprint(privateKey), null);
});

test("wrong key, malformed hashes, unapproved repo/ref, or extra fields fail candidate validation", () => {
  const first = generateKeyPairSync("ed25519");
  const second = generateKeyPairSync("ed25519");
  const candidate = trustedCandidate(first.publicKey.export({
    format: "pem", type: "spki"
  }));
  const rejectedCases = [
    { ...candidate, publicKeyPem: second.publicKey.export({
      format:"pem", type:"spki"
    }) },
    { ...candidate, publicKeyPem: "pem-injection" },
    { ...candidate, repository: "other/repo" },
    { ...candidate, ref: "refs/heads/main" },
    { ...candidate, version: 2 },
    { ...candidate, authorizesOpenRouter: true },
    { ...candidate, anchor: {
      ...candidate.anchor, verificationKeyFingerprint: "f".repeat(64)
    }},
    { ...candidate, anchor: { ...candidate.anchor,
      genesisSha: candidate.anchor.sourceSha
    }},
    { ...candidate, anchor: {
      ...candidate.anchor, checkpointRegistryHash: "deadbeef"
    }}
  ];
  for (const item of rejectedCases) {
    const result = inspectV3PinnedRootCandidate(item);
    assert.equal(result.status, "rejected");
    noPowers(result);
  }
});

test("observed main ruleset with 0 required reviews is NOT a strong trust-root approval control", () => {
  const out = inspectV3MainTrustRuleset(ruleset());
  assert.equal(out.status, "owner_review_required");
  assert.equal(out.code, "main_ruleset_has_no_mandatory_review");
  assert.equal(out.evidence.requiredApprovals, 0);
  assert.equal(out.evidence.mandatoryCheck, "check");
  noPowers(out);
});

test("structurally stronger ruleset still needs independent owner root pin", () => {
  const rule = ruleset();
  rule.rules[2].parameters.required_approving_review_count = 1;
  const out = inspectV3MainTrustRuleset(rule);
  assert.equal(out.status, "structurally_protected_untrusted");
  assert.equal(out.code, "owner_approval_and_signer_root_still_required");
  noPowers(out);
});

test("bypass, non-fast-forward, missing check, non-main scope and disabled rulesets fail", () => {
  const cases = [
    { bypass_actors: [{actor_type:"Integration",actor_id:101}] },
    { enforcement: "evaluate" },
    { conditions: {ref_name:{include:["refs/heads/other"],exclude:[]}} },
    { source: "other/repo" },
    { rules: ruleset().rules.filter(x => x.type !== "non_fast_forward") },
    { rules: ruleset().rules.filter(x => x.type !== "deletion") },
    { rules: ruleset().rules.filter(x => x.type !== "required_status_checks") },
    { rules: ruleset().rules.map(x =>
      x.type === "required_status_checks" ?
      {type:x.type,parameters:{required_status_checks:[]}} : x) }
  ];
  for (const patch of cases) {
    const out = inspectV3MainTrustRuleset({...ruleset(),...patch});
    assert.equal(out.status,"rejected",JSON.stringify(patch));
    noPowers(out);
  }
});
