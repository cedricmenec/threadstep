/**
 * ASF-V3-008 defense-in-depth: audit durable signed admission witnesses.
 *
 * Validates EVERY ADMIT in the global Git registry against an Ed25519-signed
 * permit stored IN THE SAME PINNED GIT COMMIT TREE.
 *
 * This is cryptographic INTEGRITY only, NOT owner approval. The issuer's
 * public key must be pinned independently by an approved trusted runtime,
 * never supplied via workflow input, untrusted repo file or agent.
 * No network or secrets: all reads occur through injected read-only client.
 */
import { canonicalize } from "../waves/hash.mjs";
import { replayAdmissionRegistry } from "./global-admission.mjs";
import { verifyV3SignedAdmissionPermit } from "./signed-global-admission.mjs";

const REPO = "cedricmenec/threadstep";
const HEX40 = /^[a-f0-9]{40}$/;
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX_WITNESS_BYTES = 4096;
const MAX_ADMISSIONS = 100;

const report = (status, reason, details = {}) => Object.freeze({
  // Deliberately never an authorization to pay or dispatch.
  authorized: false, status, reason, ...details
});
const deny = reason => report("rejected", reason);
const uncertain = reason => report("uncertain", reason);

export function v3AdmissionWitnessPath(waveId) {
  if (!WAVE.test(waveId ?? "")) throw new TypeError("invalid_wave_id");
  return "admission-evidence/" + waveId + ".json";
}

function decodeWitness(data, path) {
  if (data?.type !== "file" || data.path !== path ||
    data.encoding !== "base64" || typeof data.content !== "string" ||
    !Number.isSafeInteger(data.size) || data.size < 10 ||
    data.size > MAX_WITNESS_BYTES)
    throw new Error("invalid_witness_metadata");
  const base64 = data.content.replace(/\s/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64) ||
    base64.length > Math.ceil(MAX_WITNESS_BYTES * 4 / 3) + 4)
    throw new Error("invalid_witness_encoding");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length !== data.size || buffer.toString("base64") !== base64)
    throw new Error("invalid_witness_encoding");
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== "payload,signature")
    throw new Error("invalid_witness_shape");
  return value;
}

/**
 * Source registry and all witnesses MUST come from the same commit sha.
 * Return status "signature_chain_verified" is NOT an owner mandate.
 *
 * An empty registry only has replay/shape checks, not trusted genesis:
 * the ref's creation and history remain subject to external controls.
 */
export async function auditV3AdmissionWitnessChain({
  registry, headSha, readClient, verificationKey
} = {}) {
  if (!HEX40.test(headSha ?? "") ||
      typeof readClient?.get !== "function" || !verificationKey)
    return deny("missing_pinned_audit_context");
  let replayed;
  try { replayed = replayAdmissionRegistry(registry); }
  catch { return deny("registry_replay_invalid"); }
  const admits = replayed.events.filter(e => e.type === "ADMIT");
  if (admits.length > MAX_ADMISSIONS) return deny("witness_audit_limit_reached");
  for (const event of admits) {
    const claim = event.claim;
    if (!claim || !WAVE.test(claim.waveId ?? ""))
      return deny("invalid_admitted_claim");
    const path = v3AdmissionWitnessPath(claim.waveId);
    let res;
    try {
      res = await readClient.get("repos/" + REPO +
        "/contents/" + path + "?ref=" + headSha);
    } catch { return uncertain("witness_read_error"); }
    if (!res?.ok) return uncertain("witness_unavailable");
    let witness;
    try { witness = decodeWitness(res.data, path); }
    catch { return deny("invalid_witness_file"); }
    if (!verifyV3SignedAdmissionPermit({
      claim, permit: witness, verificationKey
    })) return deny("witness_signature_or_claim_mismatch");
  }
  return report("signature_chain_verified", "all_admits_have_pinned_commit_witnesses", {
    // informational only; never a paid or dispatch capability
    admissions: admits.length,
    registryRevision: replayed.revision,
    registryHash: canonicalize(replayed).length
  });
}
