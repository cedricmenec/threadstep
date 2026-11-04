/**
 * ASF-V3-007: pure, append-only inter-wave admission ledger.
 *
 * This is a policy MODEL, not a remote lock or an authorized live writer.
 * A future trusted adapter must persist the whole registry by atomic Git
 * fast-forward CAS on a protected GLOBAL ref, not on a per-wave branch.
 * No network, token, workflow dispatch, payment, timer or automatic recovery.
 */
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
import { findSecretPaths } from "../waves/secrets.mjs";

export const ADMISSION_SCHEMA = 1;
export const ADMISSION_REGISTRY_REF = "refs/heads/asf/control/active-wave-v3";
export const ADMISSION_OUTCOME = Object.freeze({
  AVAILABLE: "AVAILABLE", ACTIVE: "ACTIVE", QUARANTINED: "QUARANTINED"
});
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const RUN_ID = /^[1-9]\d{0,17}$/;
const WAVE_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const DONE = new Set(["COMPLETED_QUOTA", "COMPLETED_NO_WORK"]);
const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
function insist(ok, code) {
  if (!ok) throw Object.assign(new Error("ASF V3 admission: " + code), { code });
}
function fields(x, required) {
  insist(isObject(x) && Object.keys(x).length === required.length &&
    required.every(name => Object.hasOwn(x, name)), "invalid_fields");
}
function frozen(x) {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    for (const v of Object.values(x)) frozen(v);
    Object.freeze(x);
  }
  return x;
}
const claimFields = ["waveId", "manifestHash", "ownerRunId", "originSha"];
function verifyClaim(claim) {
  fields(claim, claimFields);
  insist(WAVE_ID.test(claim.waveId) && HEX64.test(claim.manifestHash) &&
    RUN_ID.test(String(claim.ownerRunId)) && HEX40.test(claim.originSha),
    "invalid_wave_claim");
  insist(String(claim.ownerRunId) === claim.ownerRunId, "noncanonical_owner_run_id");
}

/** Empty genesis. Creating this ref remains privileged and UNIMPLEMENTED. */
export function createAdmissionRegistry() {
  return frozen({
    schemaVersion: ADMISSION_SCHEMA, revision: 0,
    state: "AVAILABLE", active: null, history: [], events: []
  });
}
export function admissionRegistryHash(registry) {
  return contentSha256(registry);
}
function transition(current, event) {
  insist(isObject(event) && typeof event.type === "string", "invalid_event");
  const next = {
    ...current, history: [...current.history],
    events: [...current.events],
    active: current.active === null ? null : { ...current.active }
  };
  switch (event.type) {
    case "ADMIT": {
      fields(event, ["type", "claim"]);
      insist(current.state === "AVAILABLE" && current.active === null,
        "wave_admission_blocked");
      verifyClaim(event.claim);
      insist(!current.history.includes(event.claim.waveId), "wave_id_reused");
      next.active = structuredClone(event.claim);
      next.history.push(event.claim.waveId);
      next.state = "ACTIVE";
      break;
    }
    case "RELEASE": {
      fields(event, ["type", "waveId", "manifestHash", "terminal"]);
      insist(current.state === "ACTIVE" && current.active?.waveId === event.waveId &&
        current.active.manifestHash === event.manifestHash, "wrong_release_target");
      const t = event.terminal;
      fields(t, ["status", "journalHash", "reserved", "delivered", "maxTaskStarts",
        "waveId", "manifestHash"]);
      insist(DONE.has(t.status) && t.waveId === event.waveId &&
        t.manifestHash === current.active.manifestHash &&
        HEX64.test(t.journalHash) &&
        Number.isInteger(t.maxTaskStarts) && t.maxTaskStarts >= 1 &&
        t.maxTaskStarts <= 10 &&
        Number.isInteger(t.reserved) && t.reserved >= 0 &&
        t.reserved <= t.maxTaskStarts &&
        Number.isInteger(t.delivered) && t.delivered >= 0 &&
        t.delivered <= t.reserved &&
        (t.status !== "COMPLETED_QUOTA" ||
          t.reserved === t.maxTaskStarts), "invalid_terminal_evidence");
      // The caller must get "terminal" from independently replayed,
      // authentically stored wave history. JSON fields alone prove NOTHING.
      next.active = null;
      next.state = "AVAILABLE";
      break;
    }
    case "QUARANTINE": {
      fields(event, ["type", "waveId", "reason"]);
      insist(current.state === "ACTIVE" &&
        current.active?.waveId === event.waveId, "wrong_quarantine_target");
      insist(typeof event.reason === "string" &&
        /^[a-z][a-z0-9_]{2,79}$/.test(event.reason), "invalid_quarantine_reason");
      next.state = "QUARANTINED";
      break;
    }
    case "DIAGNOSTIC_NOTE": {
      fields(event, ["type", "waveId", "reason"]);
      insist(current.state === "QUARANTINED" &&
        current.active?.waveId === event.waveId &&
        typeof event.reason === "string" &&
        /^[a-z][a-z0-9_]{2,79}$/.test(event.reason), "invalid_diagnostic_note");
      break;
    }
    default: insist(false, "unknown_event");
  }
  insist(findSecretPaths(event).length === 0, "secret_in_admission");
  next.revision = current.revision + 1;
  next.events.push(frozen({ seq: next.revision, ...structuredClone(event) }));
  return frozen(next);
}
/** Full replay detects forged counters, duplicate events and history editing. */
export function replayAdmissionRegistry(value) {
  insist(isObject(value) && Array.isArray(value.events) &&
    value.schemaVersion === ADMISSION_SCHEMA, "invalid_registry");
  let state = createAdmissionRegistry();
  for (const e of value.events) {
    insist(isObject(e) && e.seq === state.revision + 1,
      "event_sequence_corrupted");
    const { seq, ...event } = e;
    state = transition(state, event);
  }
  insist(canonicalize(state) === canonicalize(value),
    "registry_replay_divergence");
  return state;
}
/** Local compare revision is NOT a distributed lease: remote SHA CAS required. */
export function advanceAdmissionRegistry(registry, event, expectedRevision) {
  const verified = replayAdmissionRegistry(registry);
  insist(Number.isInteger(expectedRevision) &&
    verified.revision === expectedRevision, "revision_conflict");
  return transition(verified, event);
}
export function decideV3WaveAdmission(registry) {
  const r = replayAdmissionRegistry(registry);
  return r.state === "AVAILABLE" ? "REQUIRE_TRUSTED_OWNER_GENESIS_AND_GLOBAL_CAS" :
    r.state === "ACTIVE" ? "BLOCK_ANOTHER_WAVE" :
    "BLOCK_UNTIL_OWNER_DIAGNOSIS";
}
