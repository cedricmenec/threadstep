/**
 * ASF V3 — GitHub-native control-plane observation, NO cryptographic issuer.
 *
 * OWNER authority is an actual protected GitHub Actions workflow_dispatch;
 * the global registry must be created once by a trusted owner-controlled job
 * and protected from agent writes, force-push and deletion.
 *
 * Read-only evidence: no token, network transport, signature, dispatch,
 * git mutation or paid permission is available in this module.
 * A mock client can reproduce the happy path, but never proves real App scope.
 */
import { inspectV3OwnerIntent } from "./owner-intent-preflight.mjs";
import { replayAdmissionRegistry, createAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "./global-admission.mjs";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";

const REPO = "cedricmenec/threadstep";
// Owner-pinned GitHub App ID, distinct from the V1 executor App 5321746.
// Matching a ruleset actor ID is only a structural check; effective scopes and
// permissions still require independent live tests and protected workflow.
export const V3_CONTROLLER_APP_ID = 5361227;
const BASE = "repos/" + REPO;
const REF = BASE + "/git/ref/heads/asf/control/active-wave-v3";
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[1-9]\d{0,17}$/;
const FILE_LIMIT = 512 * 1024;
const status = (kind, reason, evidence = null) => Object.freeze({
  status: kind, reason, authorized: false, canSpend: false,
  canDispatch: false, canWrite: false, canRetry: false,
  evidence: evidence === null ? null : Object.freeze(evidence)
});
const refuse = reason => status("rejected", reason);
const uncertain = reason => status("uncertain", reason);
const plain = x => !!x && typeof x === "object" && !Array.isArray(x);

function matchingRuleset(rule, name) {
  const refs = rule?.conditions?.ref_name;
  return !!rule && rule.source === REPO && rule.target === "branch" &&
    rule.enforcement === "active" &&
    Array.isArray(refs?.include) && refs.include.length === 1 &&
    refs.include[0] === name &&
    Array.isArray(refs.exclude) && refs.exclude.length === 0 &&
    Array.isArray(rule.rules) && Array.isArray(rule.bypass_actors);
}
function rulesPresent(rule, names) {
  const kinds = new Set(rule.rules.map(r => r.type));
  return names.every(x => kinds.has(x));
}
/**
 * A GitHub ruleset bypass is identity-wide, NOT specific to one operation.
 * If the controller App bypasses a combined update/non_fast_forward/deletion
 * ruleset, that same token can bypass force-push and deletion protection.
 *
 * Require TWO SEPARATE rulesets on the exact global ref:
 *   - writer: "update", ONLY one controller Integration with bypass=always
 *   - immutable: "deletion" + "non_fast_forward", NO bypass whatsoever
 *
 * These observations only prove STRUCTURE. A trusted owner must separately
 * compare App ID, actual App installation, token permissions and effective
 * GitHub denial tests, before any real global ref write.
 */
export function inspectV3GithubRulesets({ main, global, immutable } = {}) {
  if (!matchingRuleset(main, "refs/heads/main") ||
      !rulesPresent(main, ["pull_request", "required_status_checks",
        "deletion", "non_fast_forward"]) ||
      main.bypass_actors.length !== 0 ||
      !main.rules.find(x => x.type === "required_status_checks")
        ?.parameters?.required_status_checks?.some(x => x.context === "check"))
    return refuse("main_protection_not_verified");
  if (!matchingRuleset(global, ADMISSION_REGISTRY_REF) ||
      global.rules.length !== 2 ||
      !rulesPresent(global, ["creation", "update"]))
    return refuse("global_ref_writer_protection_not_verified");
  if (global.bypass_actors.length !== 1 ||
      global.bypass_actors[0]?.actor_type !== "Integration" ||
      !Number.isSafeInteger(global.bypass_actors[0]?.actor_id) ||
      global.bypass_actors[0].actor_id !== V3_CONTROLLER_APP_ID ||
      global.bypass_actors[0].bypass_mode !== "always")
    return refuse("global_writer_identity_not_constrained");
  if (!matchingRuleset(immutable, ADMISSION_REGISTRY_REF) ||
      immutable.rules.length !== 2 ||
      !rulesPresent(immutable, ["deletion", "non_fast_forward"]) ||
      immutable.bypass_actors.length !== 0 ||
      immutable.id === global.id)
    return refuse("global_immutable_history_not_verified");

  return status("structurally_consistent",
    "requires_owner_pinned_app_id_real_scopes_and_deny_tests", {
      observedControllerAppId: global.bypass_actors[0].actor_id,
      // A numeric actor from GitHub ruleset metadata isn't an OWNER APPROVAL.
      globalWriterRulesetId: global.id,
      immutableRulesetId: immutable.id
    });
}

export async function observeV3GithubRulesetPolicy(readClient) {
  let collection;
  try { collection = await readClient.get(BASE + "/rulesets"); }
  catch { return uncertain("rulesets_unavailable"); }
  if (!collection?.ok || !Array.isArray(collection.data) ||
      collection.data.length > 64) return uncertain("rulesets_unavailable");
  const full = [];
  const seen = new Set();
  for (const item of collection.data) {
    if (!ID.test(String(item?.id ?? "")) || seen.has(item.id))
      return refuse("ruleset_list_invalid");
    seen.add(item.id);
    let response;
    try { response = await readClient.get(BASE + "/rulesets/" + item.id); }
    catch { return uncertain("ruleset_detail_unavailable"); }
    if (!response?.ok || response.data?.id !== item.id)
      return uncertain("ruleset_detail_unavailable");
    full.push(response.data);
  }
  const mains = full.filter(r => matchingRuleset(r, "refs/heads/main"));
  const globals = full.filter(r => matchingRuleset(r, ADMISSION_REGISTRY_REF));
  if (mains.length !== 1 || globals.length !== 2)
    return refuse("missing_or_ambiguous_repository_rulesets");
  const writers = globals.filter(r => r.rules.some(x => x.type === "update"));
  const immutables = globals.filter(r => r.rules.some(x =>
    x.type === "deletion" || x.type === "non_fast_forward"));
  if (writers.length !== 1 || immutables.length !== 1 ||
      writers[0].id === immutables[0].id)
    return refuse("insecure_combined_bypass_or_ambiguous_global_rules");
  return inspectV3GithubRulesets({
    main:mains[0],global:writers[0],immutable:immutables[0]
  });
}

async function readRegistry(readClient) {
  let head, res;
  try {
    head = await readClient.get(REF);
  } catch { return uncertain("global_ref_unavailable"); }
  if (!head?.ok || head.data?.ref !== ADMISSION_REGISTRY_REF ||
      head.data.object?.type !== "commit" ||
      !SHA.test(head.data.object.sha ?? ""))
    return uncertain("global_ref_unavailable");
  const sha = head.data.object.sha;
  try {
    res = await readClient.get(BASE + "/contents/registry.json?ref=" + sha);
  } catch { return uncertain("global_registry_unavailable"); }
  const d = res?.data;
  if (!res?.ok || d?.path !== "registry.json" || d?.type !== "file" ||
      d?.encoding !== "base64" || !Number.isSafeInteger(d.size) ||
      d.size < 2 || d.size > FILE_LIMIT || typeof d.content !== "string")
    return uncertain("global_registry_unavailable");
  let registry;
  try {
    const data = d.content.replace(/\s/g, "");
    if (data.length > Math.ceil(FILE_LIMIT * 4 / 3) + 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
      return refuse("registry_encoding_invalid");
    const bytes = Buffer.from(data, "base64");
    if (bytes.length !== d.size || bytes.toString("base64") !== data)
      return refuse("registry_encoding_invalid");
    registry = replayAdmissionRegistry(JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch { return refuse("registry_replay_invalid"); }
  return {status: "replayed", headSha: sha, registry};
}

/**
 * Called only by the future trusted controller with ownerContext captured
 * DIRECTLY from its GitHub runner event, not from untrusted JSON. Runtime API
 * permissions and actual global-writer App identity remain out-of-band P0.
 */
export async function observeV3GithubNativeControl({
  manifest, ownerContext, readClient
} = {}) {
  if (typeof readClient?.get !== "function")
    return uncertain("github_read_client_missing");
  let owner;
  try {
    owner = await inspectV3OwnerIntent({manifest, ownerContext, readClient});
  } catch { return uncertain("owner_intent_unavailable"); }
  if (owner.status !== "consistent_not_authorized")
    return status(owner.status === "rejected" ? "rejected" : "uncertain",
      "owner_run_not_reconciled");
  const rules = await observeV3GithubRulesetPolicy(readClient);
  if (rules.status !== "structurally_consistent") return rules;
  const snapshot = await readRegistry(readClient);
  if (snapshot.status !== "replayed") return snapshot;

  // An initial owner run may only propose the first ADMIT while the
  // registry is empty. A wave already active (or quarantined) cannot be
  // re-issued by replaying a plausible owner request.
  if (snapshot.registry.state !== "AVAILABLE" ||
      snapshot.registry.active !== null ||
      snapshot.registry.history.includes(manifest.waveId))
    return refuse("wave_already_active_or_used");

  let check;
  try { check = await readClient.get(REF); }
  catch { return uncertain("global_ref_readback_unavailable"); }
  if (!check?.ok || check.data?.ref !== ADMISSION_REGISTRY_REF ||
      check.data.object?.sha !== snapshot.headSha)
    return uncertain("global_ref_moved_during_observation");

  return status("consistent_not_authorized",
    "requires_owner_scoped_writer_and_atomic_global_cas", {
      ownerRunId: owner.evidence.ownerRunId,
      manifestHash: owner.evidence.manifestHash,
      headSha: snapshot.headSha,
      registryRevision: snapshot.registry.revision,
      registryHash: contentSha256(snapshot.registry)
    });
}

/**
 * One-time project bootstrap instruction, not a writer. Existing control
 * history is NEVER overwritten, even if it is blocked or quarantined.
 */
export function planV3GithubBootstrap(registry) {
  if (registry === null) return status("plan_only",
    "trusted_owner_writer_must_create_ref_once", {
      ref: ADMISSION_REGISTRY_REF,
      initialRegistryHash: contentSha256(createAdmissionRegistry())
    });
  try {
    const verified = replayAdmissionRegistry(registry);
    if (canonicalize(verified) === canonicalize(createAdmissionRegistry()))
      return status("already_initialized", "do_not_recreate_global_ref");
    return refuse("existing_history_must_never_be_reset");
  } catch { return refuse("existing_registry_invalid_stop"); }
}
