/**
 * ASF-V3-008 | Global-wave admission CAS with a signed bootstrap permit.
 *
 * PROTOTYPE, NOT CONNECTED: no token, network, workflow, paid API, dispatch,
 * branch genesis, key or permission is created here. This module can persist
 * only ADMIT; quarantine/release need separate authorization design.
 * A verification key MUST be pinned by a separately owner-approved trusted
 * publisher/config. Accepting a caller-chosen public key is NOT authentication.
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
import { findSecretPaths } from "../waves/secrets.mjs";
import {
  ADMISSION_REGISTRY_REF, advanceAdmissionRegistry, replayAdmissionRegistry
} from "./global-admission.mjs";

export const V3_GLOBAL_REPOSITORY = "cedricmenec/threadstep";
export const V3_GLOBAL_REGISTRY_FILE = "registry.json";
const PREFIX = "repos/" + V3_GLOBAL_REPOSITORY;
const REF_PATH = PREFIX + "/git/ref/heads/asf/control/active-wave-v3";
const CONTENT_PATH = PREFIX + "/contents/registry.json?ref=";
const DOMAIN = "ThreadStep ASF V3 signed admission v1\n";
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const RUN_ID = /^[1-9]\d{0,17}$/;
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX_BYTES = 512 * 1024;
const outcome = (status, code, extra = {}) =>
  Object.freeze({ ok: status === "persisted", status, code, ...extra });
const rejected = code => outcome("rejected", code);
const uncertain = code => outcome("uncertain", code);
const conflict = code => outcome("conflict", code);
const exact = (obj, names) => obj !== null && typeof obj === "object" &&
  !Array.isArray(obj) && Object.keys(obj).length === names.length &&
  names.every(n => Object.hasOwn(obj, n));
const permitFields = ["version", "purpose", "repository", "registryRef",
  "waveId", "manifestHash", "ownerRunId", "originSha"];
const claimFields = ["waveId", "manifestHash", "ownerRunId", "originSha"];

/**
 * The signing authority is responsible for checking actual owner run identity,
 * immutable manifest, global writer rights, and owner approval BEFORE signing.
 * A signature proves possession of a key, not those validations by itself.
 */
export function verifyV3SignedAdmissionPermit({ claim, permit, verificationKey } = {}) {
  if (!exact(claim, claimFields) || !WAVE.test(claim.waveId) ||
      !HASH.test(claim.manifestHash) || !RUN_ID.test(claim.ownerRunId) ||
      !SHA.test(claim.originSha) ||
      !exact(permit, ["payload", "signature"]) ||
      !exact(permit.payload, permitFields) ||
      permit.payload.version !== 1 ||
      permit.payload.purpose !== "asf-v3-admit-one-wave" ||
      permit.payload.repository !== V3_GLOBAL_REPOSITORY ||
      permit.payload.registryRef !== ADMISSION_REGISTRY_REF ||
      permit.payload.waveId !== claim.waveId ||
      permit.payload.manifestHash !== claim.manifestHash ||
      permit.payload.ownerRunId !== claim.ownerRunId ||
      permit.payload.originSha !== claim.originSha ||
      typeof permit.signature !== "string" ||
      !/^[a-zA-Z0-9+/]{86}==$/.test(permit.signature) ||
      !verificationKey) return false;
  try {
    const key = verificationKey?.type === "public" ? verificationKey :
      createPublicKey(verificationKey);
    if (key.asymmetricKeyType !== "ed25519" || key.type !== "public") return false;
    const signature = Buffer.from(permit.signature, "base64");
    if (signature.length !== 64 ||
        signature.toString("base64") !== permit.signature) return false;
    return cryptoVerify(null, Buffer.from(DOMAIN +
      canonicalize(permit.payload), "utf8"), key, signature);
  } catch { return false; }
}
/** Public deterministic signing input for the independent trusted issuer. */
export function v3AdmissionPermitSigningPayload(payload) {
  if (!exact(payload, permitFields)) throw new TypeError("invalid_signed_payload");
  return Buffer.from(DOMAIN + canonicalize(payload), "utf8");
}

async function readSnapshot(readClient) {
  if (!readClient || typeof readClient.get !== "function") return uncertain("missing_read_client");
  const ref = await readClient.get(REF_PATH);
  if (!ref?.ok || ref.data?.ref !== ADMISSION_REGISTRY_REF ||
      ref.data?.object?.type !== "commit" ||
      !SHA.test(ref.data.object.sha ?? ""))
    return uncertain("global_ref_unavailable");
  const headSha = ref.data.object.sha;
  const file = await readClient.get(CONTENT_PATH + headSha);
  const data = file?.data;
  if (!file?.ok || data?.type !== "file" ||
      data?.path !== V3_GLOBAL_REGISTRY_FILE ||
      data?.encoding !== "base64" ||
      !Number.isSafeInteger(data.size) ||
      data.size < 2 || data.size > MAX_BYTES ||
      typeof data.content !== "string")
    return uncertain("global_registry_unavailable");
  const encoded = data.content.replace(/\s/g, "");
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) ||
      encoded.length > Math.ceil(MAX_BYTES * 4 / 3) + 4)
    return uncertain("invalid_registry_encoding");
  try {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== data.size || bytes.toString("base64") !== encoded)
      return uncertain("invalid_registry_encoding");
    const registry = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (findSecretPaths(registry).length)
      return rejected("registry_contains_secret");
    const replayed = replayAdmissionRegistry(registry);
    return outcome("snapshot_verified", "pinned_global_registry_replayed", {
      headSha, registry: replayed
    });
  } catch { return rejected("invalid_global_registry_replay"); }
}
export async function observeGlobalAdmissionSnapshot(readClient) {
  try { return await readSnapshot(readClient); }
  catch { return uncertain("global_read_failure"); }
}

/**
 * Only ADMIT, after signed permit verification and a trusted pinned registry
 * replay. The result is NOT a grant to dispatch or pay: the signed permit's
 * owner-run and manifest assertions still need a real approved issuer.
 *
 * writeTransport({method,path,body}): trusted GitHub Git Data client injected.
 * No auto-retry even if the ref moved or the response was lost after PATCH.
 */
export async function attemptSignedGlobalAdmission({
  claim, permit, verificationKey, readClient, writeTransport
} = {}) {
  if (!verifyV3SignedAdmissionPermit({claim, permit, verificationKey}))
    return rejected("no_valid_trusted_bootstrap_permit");
  if (typeof writeTransport !== "function")
    return rejected("missing_global_git_writer");
  const snapshot = await observeGlobalAdmissionSnapshot(readClient);
  if (snapshot.status !== "snapshot_verified") return snapshot;
  let next;
  try {
    next = advanceAdmissionRegistry(snapshot.registry, { type: "ADMIT", claim },
      snapshot.registry.revision);
    if (next.revision !== snapshot.registry.revision + 1 ||
        next.events.length !== snapshot.registry.events.length + 1 ||
        canonicalize(next.events.slice(0, -1)) !==
          canonicalize(snapshot.registry.events) ||
        next.active?.manifestHash !== claim.manifestHash ||
        next.active?.waveId !== claim.waveId)
      return rejected("admission_transition_invariant_failed");
  } catch { return rejected("wave_admission_blocked"); }
  if (findSecretPaths(next).length) return rejected("registry_contains_secret");
  const body = JSON.stringify(next, null, 2) + "\n";
  if (Buffer.byteLength(body, "utf8") > MAX_BYTES)
    return rejected("registry_size_limit");

  const request = async (method, path, payload) => {
    // Only fixed endpoints. Do not expose arbitrary write path or URL.
    const response = await writeTransport({
      method, path, ...(payload === undefined ? {} : { body: structuredClone(payload) })
    });
    if (!response || typeof response !== "object" || Array.isArray(response))
      throw new Error("invalid_git_response");
    return response;
  };
  const refPatch = PREFIX + "/git/refs/heads/asf/control/active-wave-v3";
  let stage = "read";
  try {
    const before = await readClient.get(REF_PATH);
    if (!before?.ok || before.data?.ref !== ADMISSION_REGISTRY_REF ||
        before.data?.object?.type !== "commit" ||
        before.data.object.sha !== snapshot.headSha)
      return conflict("global_registry_head_changed");

    const parent = await readClient.get(PREFIX + "/git/commits/" + snapshot.headSha);
    if (!parent?.ok || parent.data?.sha !== snapshot.headSha ||
        !SHA.test(parent.data.tree?.sha ?? ""))
      return uncertain("parent_commit_unavailable");

    stage = "tree";
    const tree = await request("POST", PREFIX + "/git/trees", {
      base_tree: parent.data.tree.sha,
      tree: [{ path: V3_GLOBAL_REGISTRY_FILE, mode: "100644",
        type: "blob", content: body }]
    });
    if (!SHA.test(tree.sha ?? "")) return uncertain("new_tree_not_confirmed");

    stage = "commit";
    const commit = await request("POST", PREFIX + "/git/commits", {
      message: "chore(asf): V3 global admission revision " + next.revision,
      tree: tree.sha, parents: [snapshot.headSha]
    });
    if (!SHA.test(commit.sha ?? "") ||
        commit.tree?.sha !== tree.sha || !Array.isArray(commit.parents) ||
        commit.parents.length !== 1 ||
        commit.parents[0]?.sha !== snapshot.headSha)
      return uncertain("new_commit_not_confirmed");

    stage = "update";
    const updated = await request("PATCH", refPatch, {
      sha: commit.sha, force: false
    });
    if (updated.ref !== ADMISSION_REGISTRY_REF ||
        updated.object?.type !== "commit" ||
        updated.object.sha !== commit.sha)
      return uncertain("global_ref_update_unconfirmed");

    stage = "confirm";
    const verified = await observeGlobalAdmissionSnapshot(readClient);
    if (verified.status !== "snapshot_verified" ||
        verified.headSha !== commit.sha ||
        canonicalize(verified.registry) !== canonicalize(next))
      return uncertain("global_ref_readback_diverged");
    const committed = await readClient.get(PREFIX + "/git/commits/" + commit.sha);
    if (!committed?.ok || committed.data?.sha !== commit.sha ||
        committed.data.tree?.sha !== tree.sha ||
        !Array.isArray(committed.data.parents) ||
        committed.data.parents.length !== 1 ||
        committed.data.parents[0]?.sha !== snapshot.headSha)
      return uncertain("global_parentage_unconfirmed");
    return outcome("persisted", "signed_global_admission_committed_not_paid",
      { headSha: commit.sha, revision: next.revision, registryHash: contentSha256(next) });
  } catch (e) {
    // A 409/422 after PATCH commonly signals a sibling non-FF update.
    // Other errors and lost replies are AMBIGUOUS: no automatic retries.
    if (stage === "update" && (e?.status === 409 || e?.status === 422))
      return conflict("global_ref_non_fast_forward");
    return uncertain("global_" + stage + "_failure");
  }
}
