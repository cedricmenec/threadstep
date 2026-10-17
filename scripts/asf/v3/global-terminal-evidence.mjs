/**
 * ASF V3 GitHub-native RELEASE / QUARANTINE proposal.
 *
 * No Ed25519, no issuer and no extra external checkpoint. The control-plane
 * writer MUST separately re-read the pinned wave commit and independently
 * verify PR/merge/check/main/Pages delivery before atomic global ref CAS.
 *
 * This PURE function does not authenticate a caller-supplied journal or
 * proof hash; it never releases a live registry or authorizes a paid step.
 */
import { contentSha256 } from "../waves/hash.mjs";
import { assertV3Manifest, reconstructV3Journal } from "./lifecycle.mjs";
import { replayAdmissionRegistry, advanceAdmissionRegistry } from "./global-admission.mjs";

const REPO = "cedricmenec/threadstep";
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const REASON = /^[a-z][a-z0-9_]{2,79}$/;
const DONE = new Set(["COMPLETED_QUOTA", "COMPLETED_NO_WORK"]);
const STOPPED = new Set(["STOP_FAILED", "STOP_UNCERTAIN"]);
const result = (status, reason, evidence = null) => Object.freeze({
  status, reason, authorized: false, canRelease: false,
  canQuarantine: false, canDispatch: false, canSpend: false,
  evidence: evidence === null ? null : Object.freeze(evidence)
});
const deny = code => result("rejected", code);

/**
 * Offline proposal ONLY. A fake journal/proof hash may produce a plausible
 * proposal but never an authorization; the trusted writer must re-read both
 * wave snapshot and independent GitHub delivery evidence at pinned SHAs.
 */
export function inspectV3GithubTerminalCandidate({
  registry, manifest, journal, globalHeadSha, waveHeadSha,
  kind, reason, deliveryEvidenceHash
} = {}) {
  if (!SHA.test(globalHeadSha ?? "") || !SHA.test(waveHeadSha ?? "") ||
      !["RELEASE", "QUARANTINE"].includes(kind))
    return deny("invalid_terminal_context");
  let global, wave;
  try {
    assertV3Manifest(manifest);
    global = replayAdmissionRegistry(registry);
    wave = reconstructV3Journal(manifest, journal);
  } catch { return deny("manifest_or_journal_replay_invalid"); }
  const manifestHash = contentSha256(manifest);
  if (manifest.repository !== REPO || global.state !== "ACTIVE" ||
      global.active?.waveId !== manifest.waveId ||
      global.active.manifestHash !== manifestHash ||
      global.active.ownerRunId !== manifest.authorization.runId ||
      global.active.originSha !== manifest.backlogCommit ||
      wave.manifestHash !== manifestHash || wave.waveId !== manifest.waveId ||
      wave.active !== null || wave.awaitingController ||
      wave.reserved > manifest.limits.maxTaskStarts ||
      wave.delivered > wave.reserved)
    return deny("terminal_not_bound_to_active_wave");
  if (kind === "RELEASE") {
    if (!DONE.has(wave.status) ||
        (wave.status === "COMPLETED_QUOTA" &&
          wave.reserved !== manifest.limits.maxTaskStarts) ||
        wave.reserved !== wave.delivered ||
        reason !== "nominal_delivery" ||
        !HASH.test(deliveryEvidenceHash ?? ""))
      return deny("independently_verified_delivery_required");
  } else if (!STOPPED.has(wave.status) || !REASON.test(reason ?? ""))
    return deny("quarantine_requires_stopped_wave");

  const event = kind === "RELEASE" ? {
    type: "RELEASE", waveId: manifest.waveId, manifestHash,
    terminal: {
      status: wave.status, journalHash: contentSha256(wave),
      reserved: wave.reserved, delivered: wave.delivered,
      maxTaskStarts: manifest.limits.maxTaskStarts,
      waveId: manifest.waveId, manifestHash
    }
  } : { type: "QUARANTINE", waveId: manifest.waveId, reason };
  let next;
  try { next = advanceAdmissionRegistry(global, event, global.revision); }
  catch { return deny("global_terminal_transition_refused"); }
  return result("consistent_not_authorized",
    "requires_trusted_github_delivery_observer_and_global_cas", {
      kind, globalHeadSha, waveHeadSha, waveId: manifest.waveId,
      journalHash: contentSha256(wave),
      deliveryEvidenceHash: kind === "RELEASE" ? deliveryEvidenceHash : null,
      proposedRevision: next.revision,
      proposedRegistryHash: contentSha256(next),
      proposedEvent: event
    });
}
