/**
 * ASF-V3-010 | Read-only audit of global-registry GENESIS and linear history.
 *
 * The ASF V3 prototype supports just one signed ADMIT, no RELEASE. This audit
 * therefore accepts EXACTLY two permitted histories: trusted empty genesis,
 * or ONE direct signed ADMIT child of that genesis.
 *
 * A supplied anchor is NOT trusted just because it matches Git. Production
 * must independently pin anchor fields (including public key fingerprint)
 * in owner-approved, protected config outside model/repo/dispatch inputs.
 *
 * NO network transport, Git writes, signing, new keys, dispatch or paid calls.
 */
import { createHash, createPublicKey } from "node:crypto";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
import { createAdmissionRegistry, replayAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "./global-admission.mjs";
import { observeGlobalAdmissionSnapshot } from "./signed-global-admission.mjs";

export const V3_REGISTRY_ANCHOR_SCHEMA = 1;
export const V3_REGISTRY_REPOSITORY = "cedricmenec/threadstep";
const BASE = "repos/" + V3_REGISTRY_REPOSITORY;
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const REQUIRED = ["version", "repository", "ref", "genesisSha",
  "sourceSha", "checkpointSha", "checkpointRegistryHash",
  "verificationKeyFingerprint"];
const outcome = (status, reason, evidence = null) => Object.freeze({
  status, reason,
  // Read-only structural/cryptographic evidence is NOT an owner mandate.
  authorized: false, canSign: false, canDispatch: false, canSpend: false,
  evidence: evidence === null ? null : Object.freeze(evidence)
});
const reject = reason => outcome("rejected", reason);
const unknown = reason => outcome("uncertain", reason);
const valid = x => x !== null && typeof x === "object" &&
  !Array.isArray(x);
const exact = (x, keys) => valid(x) &&
  Object.keys(x).length === keys.length &&
  keys.every(k => Object.hasOwn(x, k));

/** Calculate SPKI DER SHA256 from a PUBLIC Ed25519 key only. */
export function v3PublicKeyFingerprint(verificationKey) {
  try {
    if (typeof verificationKey !== "string" &&
        verificationKey?.type !== "public") return null;
    if (typeof verificationKey === "string" &&
        !verificationKey.trimStart().startsWith("-----BEGIN PUBLIC KEY-----"))
      return null;
    const key = verificationKey?.type === "public" ?
      verificationKey : createPublicKey(verificationKey);
    if (key.asymmetricKeyType !== "ed25519" || key.type !== "public")
      return null;
    return createHash("sha256").update(key.export({
      type: "spki", format: "der"
    })).digest("hex");
  } catch { return null; }
}
function validAnchor(anchor, key) {
  return exact(anchor, REQUIRED) &&
    anchor.version === V3_REGISTRY_ANCHOR_SCHEMA &&
    anchor.repository === V3_REGISTRY_REPOSITORY &&
    anchor.ref === ADMISSION_REGISTRY_REF &&
    SHA.test(anchor.genesisSha ?? "") &&
    SHA.test(anchor.sourceSha ?? "") &&
    SHA.test(anchor.checkpointSha ?? "") &&
    HASH.test(anchor.checkpointRegistryHash ?? "") &&
    anchor.genesisSha !== anchor.sourceSha &&
    anchor.checkpointSha !== anchor.sourceSha &&
    HASH.test(anchor.verificationKeyFingerprint ?? "") &&
    v3PublicKeyFingerprint(key) === anchor.verificationKeyFingerprint;
}
async function checkedCommit(readClient, sha) {
  let res;
  try { res = await readClient.get(BASE + "/git/commits/" + sha); }
  catch { return { kind: "unknown" }; }
  if (!res?.ok) return { kind: "unknown" };
  const commit = res.data;
  if (commit?.sha !== sha ||
      !SHA.test(commit.tree?.sha ?? "") ||
      !Array.isArray(commit.parents) ||
      commit.parents.length !== 1 ||
      !SHA.test(commit.parents[0]?.sha ?? ""))
    return { kind: "rejected" };
  return { kind: "ok", sha, parent: commit.parents[0].sha,
    treeSha: commit.tree.sha };
}
async function checkedPinnedRegistry(readClient, sha) {
  const path = BASE + "/contents/registry.json?ref=" + sha;
  let response;
  try { response = await readClient.get(path); }
  catch { return { kind: "unknown" }; }
  if (!response?.ok) return { kind: "unknown" };
  const d = response.data;
  if (d?.type !== "file" || d?.path !== "registry.json" ||
      d?.encoding !== "base64" || typeof d.content !== "string" ||
      !Number.isSafeInteger(d.size) || d.size < 2 || d.size > 512 * 1024)
    return { kind: "rejected" };
  try {
    const encoded = d.content.replace(/\s/g, "");
    if (encoded.length > 699056 ||
        !/^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(encoded))
      return { kind: "rejected" };
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== d.size || bytes.toString("base64") !== encoded)
      return { kind: "rejected" };
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal:true })
      .decode(bytes));
    return { kind: "ok", registry: replayAdmissionRegistry(parsed) };
  } catch { return { kind: "rejected" }; }
}

/**
 * The anchor MUST originate outside this call's untrusted inputs.
 * This function cannot authenticate that provenance. Its only success status
 * is consistent_untrusted_anchor (never authorized).
 *
 * Checks: pinned signer key, root parent/source SHA, empty initial registry,
 * direct-child admission commit, immutable external checkpoint lower bound,
 * signed witnesses from the same HEAD and a final stable ref readback.
 */
export async function auditV3AnchoredGlobalRegistry({
  readClient, verificationKey, trustedAnchor
} = {}) {
  if (!validAnchor(trustedAnchor, verificationKey))
    return reject("missing_or_untrusted_anchor_contract");
  if (typeof readClient?.get !== "function")
    return unknown("readonly_github_client_missing");

  let snapshot;
  try {
    snapshot = await observeGlobalAdmissionSnapshot(readClient, verificationKey);
  } catch { return unknown("global_snapshot_observation_failed"); }
  if (snapshot?.status !== "snapshot_verified" ||
      !SHA.test(snapshot.headSha ?? ""))
    return outcome(snapshot?.status === "rejected" ? "rejected" : "uncertain",
      "signed_registry_snapshot_unavailable");

  const head = snapshot.headSha;
  const root = await checkedCommit(readClient, trustedAnchor.genesisSha);
  if (root.kind !== "ok")
    return root.kind === "unknown" ?
      unknown("genesis_commit_not_observed") : reject("genesis_commit_malformed");
  if (root.parent !== trustedAnchor.sourceSha)
    return reject("genesis_parent_source_diverged");

  const rootRegistry = await checkedPinnedRegistry(
    readClient, trustedAnchor.genesisSha);
  if (rootRegistry.kind !== "ok")
    return rootRegistry.kind === "unknown" ?
      unknown("genesis_registry_unavailable") : reject("genesis_registry_invalid");
  if (canonicalize(rootRegistry.registry) !==
      canonicalize(createAdmissionRegistry()))
    return reject("genesis_must_be_empty");

  let expectedCheckpointRegistry = null;
  if (head === trustedAnchor.genesisSha) {
    if (trustedAnchor.checkpointSha !== trustedAnchor.genesisSha)
      return reject("current_ref_rolled_back_before_checkpoint");
    if (canonicalize(snapshot.registry) !==
        canonicalize(rootRegistry.registry))
      return reject("current_genesis_registry_diverged");
    expectedCheckpointRegistry = rootRegistry.registry;
  } else {
    const commit = await checkedCommit(readClient, head);
    if (commit.kind !== "ok")
      return commit.kind === "unknown" ?
        unknown("head_commit_not_observed") : reject("head_commit_malformed");
    // ADMIT-only protocol: NO intermediates, merges or extra commits.
    if (commit.parent !== trustedAnchor.genesisSha)
      return reject("global_history_not_single_signed_admit");
    if (snapshot.registry.revision !== 1 ||
        snapshot.registry.events.length !== 1 ||
        snapshot.registry.events[0]?.type !== "ADMIT" ||
        snapshot.registry.state !== "ACTIVE")
      return reject("head_registry_not_single_admit");
    if (trustedAnchor.checkpointSha === head)
      expectedCheckpointRegistry = snapshot.registry;
    else if (trustedAnchor.checkpointSha === trustedAnchor.genesisSha)
      expectedCheckpointRegistry = rootRegistry.registry;
    else
      return reject("checkpoint_not_on_verified_history");
  }

  if (contentSha256(expectedCheckpointRegistry) !==
      trustedAnchor.checkpointRegistryHash)
    return reject("checkpoint_registry_hash_mismatch");

  let readback;
  try { readback = await readClient.get(
    BASE + "/git/ref/heads/asf/control/active-wave-v3"); }
  catch { return unknown("global_ref_readback_unavailable"); }
  if (!readback?.ok || readback.data?.ref !== ADMISSION_REGISTRY_REF ||
      readback.data.object?.type !== "commit" ||
      readback.data.object.sha !== head)
    return unknown("global_ref_changed_during_audit");

  return outcome("consistent_untrusted_anchor",
    "requires_independent_owner_pinned_anchor_and_issuer", {
      headSha: head, genesisSha: trustedAnchor.genesisSha,
      checkpointSha: trustedAnchor.checkpointSha,
      registryRevision: snapshot.registry.revision,
      registryHash: contentSha256(snapshot.registry),
      keyFingerprint: trustedAnchor.verificationKeyFingerprint
    });
}
