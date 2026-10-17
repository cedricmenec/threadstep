/**
 * ASF-V3-012: signed global RELEASE / QUARANTINE evidence composition.
 *
 * Offline policy only. Does NOT certify owner consent, GitHub delivery, key
 * origin or durable global CAS. No secrets, signer, token, network, Git writes,
 * workflow dispatch or paid calls.
 *
 * A trusted issuer must INDEPENDENTLY observe delivery/diagnosis before signing;
 * an observationHash supplied by a caller is just a hash, not proof.
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
import { assertV3Manifest, reconstructV3Journal } from "./lifecycle.mjs";
import { replayAdmissionRegistry, advanceAdmissionRegistry } from "./global-admission.mjs";

const REPO = "cedricmenec/threadstep";
const DOMAIN = "ThreadStep ASF V3 global terminal v1\n";
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const REASON = /^[a-z][a-z0-9_]{2,79}$/;
const plain = x => x !== null && typeof x === "object" && !Array.isArray(x);
const fields = (x, keys) => plain(x) &&
  Object.keys(x).length === keys.length &&
  keys.every(k => Object.hasOwn(x, k));
const PAYLOAD = ["version", "purpose", "repository", "kind", "waveId",
  "manifestHash", "globalHeadSha", "waveHeadSha", "journalHash",
  "observationHash", "reason"];
const nominal = new Set(["COMPLETED_QUOTA", "COMPLETED_NO_WORK"]);
const failed = new Set(["STOP_FAILED", "STOP_UNCERTAIN"]);
const deny = code => Object.freeze({
  status: "rejected", code, authorized: false, canRelease: false,
  canQuarantine: false, canDispatch: false, canSpend: false, evidence: null
});
const consistent = evidence => Object.freeze({
  status: "consistent_not_authorized",
  code: "requires_trusted_issuer_and_independent_observation",
  authorized: false, canRelease: false, canQuarantine: false,
  canDispatch: false, canSpend: false, evidence: Object.freeze(evidence)
});

export function v3GlobalTerminalSigningBytes(payload) {
  if (!fields(payload, PAYLOAD))
    throw new TypeError("invalid_global_terminal_payload");
  return Buffer.from(DOMAIN + canonicalize(payload), "utf8");
}
function validKey(value) {
  try {
    const k = value?.type === "public" ? value : createPublicKey(value);
    if (k.type !== "public" || k.asymmetricKeyType !== "ed25519") return null;
    return k;
  } catch { return null; }
}
export function verifyV3GlobalTerminalPermit({ payload, signature, verificationKey } = {}) {
  if (!fields(payload, PAYLOAD) ||
      payload.version !== 1 ||
      payload.purpose !== "asf-v3-single-global-terminal" ||
      payload.repository !== REPO ||
      !["RELEASE", "QUARANTINE"].includes(payload.kind) ||
      typeof payload.waveId !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(payload.waveId) ||
      !HASH.test(payload.manifestHash ?? "") ||
      !SHA.test(payload.globalHeadSha ?? "") ||
      !SHA.test(payload.waveHeadSha ?? "") ||
      !HASH.test(payload.journalHash ?? "") ||
      !HASH.test(payload.observationHash ?? "") ||
      (payload.kind === "RELEASE" ? payload.reason !== "nominal_delivery" :
        !REASON.test(payload.reason ?? "")) ||
      typeof signature !== "string" ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
  const key = validKey(verificationKey);
  if (!key) return false;
  try {
    const raw = Buffer.from(signature, "base64");
    return raw.length === 64 &&
      raw.toString("base64") === signature &&
      cryptoVerify(null, v3GlobalTerminalSigningBytes(payload), key, raw);
  } catch { return false; }
}

/**
 * Compose and independently replay the expected global event.
 * Passing arbitrary matching JSON and a self-chosen key can never grant
 * authority. This is NOT a writer; global CAS + witnessed ledger still need
 * separate integration and owner approval.
 */
export function inspectV3GlobalTerminalCandidate({
  registry, manifest, journal, globalHeadSha, waveHeadSha,
  observationHash, reason, permit, verificationKey
} = {}) {
  if (!SHA.test(globalHeadSha ?? "") || !SHA.test(waveHeadSha ?? "") ||
      !HASH.test(observationHash ?? "") || !plain(permit) ||
      !fields(permit, ["payload", "signature"]))
    return deny("invalid_terminal_context");
  let global, wave;
  try {
    assertV3Manifest(manifest);
    global = replayAdmissionRegistry(registry);
    wave = reconstructV3Journal(manifest, journal);
  } catch { return deny("manifest_or_journal_replay_invalid"); }
  const manifestHash = contentSha256(manifest);
  if (manifest.repository !== REPO ||
      global.state !== "ACTIVE" ||
      global.active?.waveId !== manifest.waveId ||
      global.active.manifestHash !== manifestHash ||
      global.active.ownerRunId !== manifest.authorization.runId ||
      global.active.originSha !== manifest.backlogCommit ||
      wave.manifestHash !== manifestHash ||
      wave.waveId !== manifest.waveId ||
      wave.active !== null || wave.awaitingController ||
      wave.reserved > manifest.limits.maxTaskStarts ||
      wave.delivered > wave.reserved)
    return deny("terminal_not_bound_to_active_wave");

  const kind = permit.payload?.kind;
  if (kind !== "RELEASE" && kind !== "QUARANTINE")
    return deny("terminal_kind_not_supported");
  if (kind === "RELEASE") {
    if (!nominal.has(wave.status) ||
        wave.reserved !== wave.delivered ||
        (wave.status === "COMPLETED_QUOTA" &&
          wave.reserved !== manifest.limits.maxTaskStarts) ||
        reason !== "nominal_delivery")
      return deny("unverified_nominal_completion");
  } else if (!failed.has(wave.status) ||
      !REASON.test(reason ?? "")) {
    return deny("quarantine_requires_stopped_wave");
  }
  const payload = {
    version: 1, purpose: "asf-v3-single-global-terminal",
    repository: REPO, kind, waveId: manifest.waveId, manifestHash,
    globalHeadSha, waveHeadSha, journalHash: contentSha256(wave),
    observationHash, reason
  };
  if (canonicalize(payload) !== canonicalize(permit.payload) ||
      !verifyV3GlobalTerminalPermit({
        ...permit, verificationKey
      })) return deny("terminal_signature_not_verified");

  const event = kind === "RELEASE" ?
    { type: "RELEASE", waveId: manifest.waveId, manifestHash,
      terminal: {
        status: wave.status, journalHash: payload.journalHash,
        reserved: wave.reserved, delivered: wave.delivered,
        maxTaskStarts: manifest.limits.maxTaskStarts,
        waveId: manifest.waveId, manifestHash
      } } :
    { type: "QUARANTINE", waveId: manifest.waveId, reason };
  let next;
  try {
    next = advanceAdmissionRegistry(global, event, global.revision);
  } catch { return deny("terminal_transition_refused"); }
  return consistent({
    kind, waveId: manifest.waveId, globalHeadSha, waveHeadSha,
    manifestHash, journalHash: payload.journalHash,
    proposedRevision: next.revision, registryHash: contentSha256(next),
    observationHash, permitHash: contentSha256(permit)
  });
}
