// Pure, DOM-free Cloud activation core (TS-037).
//
// The module owns the activation stages, the non-synchronized activation
// marker, the attested target classification, the isolation predicates and the
// first-sync evidence reducer. It never touches IndexedDB, Dexie Cloud, the DOM
// or the network: `site/app.js` injects native signals and storage adapters.
import {
  CLOUD_HOST_SUFFIX,
  DATABASE_NAME,
  LOCAL_DATABASE_NAME,
  validateCloudUrl
} from "./dexie-foundation.js";
import { evaluateSyncAttestation } from "./migration-reconciliation.js";
import { sha256Hex } from "./fingerprint.js";

export const ACTIVATION_STORAGE_KEY = "threadstep.cloud.activation.v1";
export const ACTIVATION_VERSION = 1;

export const ACTIVATION_STATUS = Object.freeze({
  ACTIVATING: "activating",
  CANCELLED: "cancelled",
  ACTIVE: "active"
});

export const ACTIVATION_STAGE = Object.freeze({
  LOCAL: "local",
  PREPARING: "preparing",
  CONNECTING: "connecting",
  DISCOVERING: "discovering",
  REVIEW: "review",
  TRANSFER_PENDING: "transfer-pending",
  ACTIVE: "active",
  FAILED: "failed",
  CANCELLED: "cancelled"
});

export const TARGET_CLASSIFICATION = Object.freeze({
  VERIFIED_EMPTY: "verified-empty",
  POPULATED: "populated",
  DIVERGENT: "divergent",
  UNAVAILABLE: "unavailable",
  IDENTITY_MISMATCH: "identity-mismatch"
});

export const FIRST_SYNC = Object.freeze({
  IDLE: "idle",
  LOCAL_WRITTEN: "local-written",
  PENDING: "pending",
  REMOTE_COMPLETE: "remote-complete",
  ERROR: "error",
  INDETERMINATE: "indeterminate"
});

const STAGE_VALUES = new Set(Object.values(ACTIVATION_STAGE));
const STATUS_VALUES = new Set(Object.values(ACTIVATION_STATUS));

const PRE_CONSENT_STAGES = new Set([
  ACTIVATION_STAGE.LOCAL,
  ACTIVATION_STAGE.PREPARING,
  ACTIVATION_STAGE.CONNECTING,
  ACTIVATION_STAGE.DISCOVERING,
  ACTIVATION_STAGE.REVIEW
]);

// Only these events may move a stage. Anything else is refused without
// mutating the current state.
const ALLOWED_EVENTS = Object.freeze({
  [ACTIVATION_STAGE.LOCAL]: ["start"],
  [ACTIVATION_STAGE.PREPARING]: ["configured", "cancel", "fail"],
  [ACTIVATION_STAGE.CONNECTING]: ["authenticated", "cancel", "fail"],
  [ACTIVATION_STAGE.DISCOVERING]: ["discovered", "cancel", "fail"],
  [ACTIVATION_STAGE.REVIEW]: ["consent", "cancel", "fail"],
  [ACTIVATION_STAGE.TRANSFER_PENDING]: ["complete", "fail", "cancel"],
  [ACTIVATION_STAGE.FAILED]: ["retry", "cancel"],
  [ACTIVATION_STAGE.ACTIVE]: [],
  [ACTIVATION_STAGE.CANCELLED]: ["restart"]
});

const RESUMABLE_STAGES = new Set([
  ACTIVATION_STAGE.PREPARING,
  ACTIVATION_STAGE.CONNECTING,
  ACTIVATION_STAGE.DISCOVERING,
  ACTIVATION_STAGE.REVIEW,
  ACTIVATION_STAGE.TRANSFER_PENDING
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value) {
  return JSON.stringify(value, (key, item) => {
    if (isPlainObject(item)) {
      return Object.keys(item).sort().reduce((sorted, name) => {
        sorted[name] = item[name];
        return sorted;
      }, {});
    }
    return item;
  });
}

function normalizeStage(value) {
  return STAGE_VALUES.has(value) ? value : ACTIVATION_STAGE.LOCAL;
}

export function isPreConsentStage(stage) {
  return PRE_CONSENT_STAGES.has(stage);
}

export function initialActivationState() {
  return {
    stage: ACTIVATION_STAGE.LOCAL,
    resumeStage: null,
    error: null,
    transferCommitted: false,
    postConsentCancellation: false
  };
}

function nextStageFor(current, type, event) {
  switch (type) {
    case "start":
    case "restart":
      return ACTIVATION_STAGE.PREPARING;
    case "configured":
      return ACTIVATION_STAGE.CONNECTING;
    case "authenticated":
      return ACTIVATION_STAGE.DISCOVERING;
    case "discovered":
      return ACTIVATION_STAGE.REVIEW;
    case "consent":
      return ACTIVATION_STAGE.TRANSFER_PENDING;
    case "complete":
      return ACTIVATION_STAGE.ACTIVE;
    case "cancel":
      return isPreConsentStage(current.stage)
        ? ACTIVATION_STAGE.CANCELLED
        : ACTIVATION_STAGE.TRANSFER_PENDING;
    case "fail":
      return ACTIVATION_STAGE.FAILED;
    case "retry": {
      const requested = event && STAGE_VALUES.has(event.stage) ? event.stage : current.resumeStage;
      return RESUMABLE_STAGES.has(requested) ? requested : ACTIVATION_STAGE.PREPARING;
    }
    default:
      return current.stage;
  }
}

// Applies one activation event. An invalid transition is refused and returns
// the unchanged state: no stage is ever announced without its evidence.
export function transitionActivation(state, event = {}) {
  const current = isPlainObject(state) && STAGE_VALUES.has(state.stage)
    ? state
    : initialActivationState();
  const type = isPlainObject(event) ? event.type : null;
  const allowed = ALLOWED_EVENTS[current.stage] || [];
  if (typeof type !== "string" || !allowed.includes(type)) {
    return { ok: false, reason: "invalid-transition", state: current };
  }
  const stage = nextStageFor(current, type, event);
  const next = {
    ...current,
    stage,
    error: null,
    postConsentCancellation: false
  };
  if (type === "fail") {
    next.resumeStage = RESUMABLE_STAGES.has(current.stage) ? current.stage : null;
    next.error = typeof event.reason === "string" ? event.reason : "activation-failed";
  } else if (type === "retry" || type === "restart" || type === "start") {
    next.resumeStage = null;
  } else if (type === "consent") {
    next.transferCommitted = false;
  } else if (type === "complete") {
    next.transferCommitted = true;
  } else if (type === "cancel" && stage === ACTIVATION_STAGE.TRANSFER_PENDING) {
    next.transferCommitted = true;
    next.postConsentCancellation = true;
  }
  return { ok: true, reason: null, state: next };
}

// Non-synchronized activation marker -------------------------------------------------

export function hashActivationUser(userId) {
  return sha256Hex(canonicalJson({
    version: ACTIVATION_VERSION,
    scope: "cloud-activation-user",
    userId: typeof userId === "string" && userId.length > 0 ? userId : null
  }));
}

export function createActivationRecord(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const url = validateCloudUrl(source.url);
  if (!url.valid) return null;
  const status = STATUS_VALUES.has(source.status) ? source.status : ACTIVATION_STATUS.ACTIVATING;
  const record = { version: ACTIVATION_VERSION, status, url: url.url };
  if (typeof source.remoteDbId === "string" && source.remoteDbId.length > 0) {
    record.remoteDbId = source.remoteDbId;
  }
  if (typeof source.sourceFingerprint === "string" && /^[a-f0-9]{64}$/.test(source.sourceFingerprint)) {
    record.sourceFingerprint = source.sourceFingerprint;
  }
  if (typeof source.userId === "string" && source.userId.length > 0) {
    record.userDigest = hashActivationUser(source.userId);
  } else if (typeof source.userDigest === "string" && /^[a-f0-9]{64}$/.test(source.userDigest)) {
    record.userDigest = source.userDigest;
  }
  return record;
}

// Accepts serialized text or a parsed object. Only the allowlisted keys are
// kept; unknown versions, malformed URLs and invalid statuses degrade to null.
export function parseActivationRecord(value) {
  if (typeof value === "string") {
    if (!value.trim()) return null;
    try {
      return parseActivationRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!isPlainObject(value) || value.version !== ACTIVATION_VERSION) return null;
  if (!STATUS_VALUES.has(value.status)) return null;
  const url = validateCloudUrl(value.url);
  if (!url.valid) return null;
  const record = { version: ACTIVATION_VERSION, status: value.status, url: url.url };
  if (typeof value.remoteDbId === "string" && value.remoteDbId.length > 0) {
    record.remoteDbId = value.remoteDbId;
  }
  if (typeof value.sourceFingerprint === "string" && /^[a-f0-9]{64}$/.test(value.sourceFingerprint)) {
    record.sourceFingerprint = value.sourceFingerprint;
  }
  if (typeof value.userDigest === "string" && /^[a-f0-9]{64}$/.test(value.userDigest)) {
    record.userDigest = value.userDigest;
  }
  return record;
}

export function readActivationRecord(storage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    return parseActivationRecord(storage.getItem(ACTIVATION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeActivationRecord(storage, record) {
  if (!storage || typeof storage.setItem !== "function") return false;
  const parsed = parseActivationRecord(record);
  if (!parsed) return false;
  try {
    storage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

export function clearActivationRecord(storage) {
  if (!storage || typeof storage.removeItem !== "function") return;
  try {
    storage.removeItem(ACTIVATION_STORAGE_KEY);
  } catch {
    // Unavailable storage leaves nothing to clean.
  }
}

// Startup routing: a missing marker with a valid legacy configuration stays
// active, a cancelled or absent marker opens the autonomous local workspace.
export function resolveStartupWorkspace(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const config = isPlainObject(source.config) ? source.config : null;
  const configured = !!config && validateCloudUrl(config.databaseUrl).valid;
  if (!configured) {
    return { workspace: "local", reason: "not-configured", legacy: false };
  }
  const record = parseActivationRecord(source.record);
  if (!record) {
    return { workspace: "synced", reason: "legacy-configuration", legacy: true };
  }
  if (record.status === ACTIVATION_STATUS.ACTIVATING ||
      record.status === ACTIVATION_STATUS.ACTIVE) {
    return { workspace: "synced", reason: record.status, legacy: false };
  }
  return { workspace: "local", reason: record.status, legacy: false };
}

// Attested target classification -----------------------------------------------------

function targetCount(records, store) {
  return records && Array.isArray(records[store]) ? records[store].length : 0;
}

function planHasDivergence(plan) {
  if (!isPlainObject(plan)) return false;
  if (plan.indeterminate === true) return true;
  if (Array.isArray(plan.blocked) && plan.blocked.length > 0) return true;
  const inventory = plan.inventory;
  if (!inventory || !isPlainObject(inventory.counts)) return false;
  const conflict = inventory.counts.subjects && inventory.counts.subjects.conflict;
  const conflictItems = inventory.counts.items && inventory.counts.items.conflict;
  const invalid = inventory.counts.subjects && inventory.counts.subjects.invalid;
  const invalidItems = inventory.counts.items && inventory.counts.items.invalid;
  return (conflict || 0) > 0 || (conflictItems || 0) > 0 ||
    (invalid || 0) > 0 || (invalidItems || 0) > 0;
}

function identityMismatch(attestation, expected) {
  const identity = attestation && isPlainObject(attestation.identity) ? attestation.identity : {};
  if (!isPlainObject(expected)) return null;
  if (expected.url && expected.url !== identity.url) return "destination-url";
  if (expected.remoteDbId && expected.remoteDbId !== identity.remoteDbId) return "remote-db-id";
  if (expected.userId && expected.userId !== identity.userId) return "session-user";
  return null;
}

// Fail-closed target classifier: only an attested read with real native
// evidence can produce `verified-empty`.
export function classifyTarget(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const attestation = isPlainObject(source.attestation) ? source.attestation : null;
  if (!attestation || attestation.attested !== true) {
    const reason = attestation && typeof attestation.reason === "string"
      ? attestation.reason
      : "missing-attestation";
    if (reason === "session-mismatch") {
      return { classification: TARGET_CLASSIFICATION.IDENTITY_MISMATCH, reason, blocked: true };
    }
    return { classification: TARGET_CLASSIFICATION.UNAVAILABLE, reason, blocked: true };
  }
  const mismatch = identityMismatch(attestation, source.expected);
  if (mismatch) {
    return { classification: TARGET_CLASSIFICATION.IDENTITY_MISMATCH, reason: mismatch, blocked: true };
  }
  if (source.targetStatus !== undefined && source.targetStatus !== "ready") {
    return {
      classification: TARGET_CLASSIFICATION.UNAVAILABLE,
      reason: typeof source.reason === "string" ? source.reason : "read-error",
      blocked: true
    };
  }
  const records = source.records;
  if (!records || !Array.isArray(records.subjects) || !Array.isArray(records.items)) {
    return { classification: TARGET_CLASSIFICATION.UNAVAILABLE, reason: "malformed-target", blocked: true };
  }
  if (source.plan !== undefined && planHasDivergence(source.plan)) {
    return { classification: TARGET_CLASSIFICATION.DIVERGENT, reason: "divergent-inventory", blocked: false };
  }
  if (targetCount(records, "subjects") === 0 && targetCount(records, "items") === 0) {
    return { classification: TARGET_CLASSIFICATION.VERIFIED_EMPTY, reason: null, blocked: false };
  }
  return { classification: TARGET_CLASSIFICATION.POPULATED, reason: null, blocked: false };
}

// First-sync evidence reducer ---------------------------------------------------------

export function initialFirstSyncState() {
  return { status: FIRST_SYNC.IDLE, localWritten: false, remoteComplete: false, reason: null };
}

function deriveNativeFirstSync(input) {
  const source = isPlainObject(input) ? input : {};
  if (source.online === false) return { status: FIRST_SYNC.PENDING, reason: "offline" };
  const persisted = isPlainObject(source.persistedSyncState) ? source.persistedSyncState : null;
  const syncState = isPlainObject(source.syncState) ? source.syncState : null;
  const persistedFailed = !!persisted && persisted.error !== undefined &&
    persisted.error !== null && persisted.error !== "";
  if (persistedFailed || (syncState && (syncState.status === "error" || syncState.phase === "error"))) {
    return { status: FIRST_SYNC.ERROR, reason: "sync-error" };
  }
  if (!syncState) return { status: FIRST_SYNC.INDETERMINATE, reason: "indeterminate" };
  if (syncState.phase === "pulling" || syncState.phase === "pushing") {
    return { status: FIRST_SYNC.PENDING, reason: null };
  }
  const attestation = evaluateSyncAttestation({
    online: true,
    user: source.user,
    syncState,
    persistedSyncState: persisted,
    databaseUrl: source.databaseUrl,
    remoteDbId: source.remoteDbId
  });
  if (attestation.attested === true) {
    return { status: FIRST_SYNC.REMOTE_COMPLETE, reason: null };
  }
  return { status: FIRST_SYNC.INDETERMINATE, reason: attestation.reason || "indeterminate" };
}

// A local commit can never become remote completion without native evidence.
export function reduceFirstSync(current, event = {}) {
  const state = isPlainObject(current) && FIRST_SYNC_VALUES.has(current.status)
    ? current
    : initialFirstSyncState();
  const changes = isPlainObject(event) ? event : {};
  switch (changes.type) {
    case "reset":
      return initialFirstSyncState();
    case "local-written":
      return { ...state, status: FIRST_SYNC.LOCAL_WRITTEN, localWritten: true, remoteComplete: false, reason: null };
    case "local-error":
      return { ...state, status: FIRST_SYNC.ERROR, localWritten: false, remoteComplete: false, reason: "transaction-error" };
    case "error":
      return {
        ...state,
        status: FIRST_SYNC.ERROR,
        remoteComplete: false,
        reason: typeof changes.reason === "string" ? changes.reason : "sync-error"
      };
    case "indeterminate":
      return { ...state, status: FIRST_SYNC.INDETERMINATE, remoteComplete: false, reason: changes.reason || null };
    case "native": {
      if (!state.localWritten) return state;
      const evidence = deriveNativeFirstSync(changes);
      return {
        ...state,
        status: evidence.status,
        remoteComplete: evidence.status === FIRST_SYNC.REMOTE_COMPLETE,
        reason: evidence.reason
      };
    }
    default:
      return state;
  }
}

const FIRST_SYNC_VALUES = new Set(Object.values(FIRST_SYNC));

// Isolation predicates ---------------------------------------------------------------

export function isSyncedStore(store) {
  return store === "subjects" || store === "items";
}

export function workspaceNamesAreDistinct(sourceDatabaseName, targetDatabaseName) {
  return typeof sourceDatabaseName === "string" &&
    typeof targetDatabaseName === "string" &&
    sourceDatabaseName.length > 0 &&
    sourceDatabaseName !== targetDatabaseName;
}

function collectSnapshotIds(snapshot) {
  const ids = new Set();
  const source = isPlainObject(snapshot) ? snapshot : {};
  const subjects = Array.isArray(source.subjects) ? source.subjects : [];
  const items = Array.isArray(source.items) ? source.items : [];
  for (const record of subjects) {
    if (record && typeof record.id === "string") ids.add("subjects:" + record.id);
  }
  for (const record of items) {
    if (record && typeof record.id === "string") ids.add("items:" + record.id);
  }
  // A projected document keeps the same identifiers nested under subjects.
  for (const subject of subjects) {
    if (!Array.isArray(subject && subject.items)) continue;
    for (const item of subject.items) {
      if (item && typeof item.id === "string") ids.add("items:" + item.id);
    }
  }
  return ids;
}

// A source record is any operation value whose identifier belongs to the local
// snapshot. Before consent such a write must never target a replicated store.
export function findPreConsentSourceWrites(input = {}) {
  const source = isPlainObject(input) ? input : {};
  if (source.consented === true) return [];
  const ids = collectSnapshotIds(source.sourceSnapshot);
  const operations = Array.isArray(source.operations) ? source.operations : [];
  return operations.filter((operation) => {
    if (!isPlainObject(operation) || !isSyncedStore(operation.store)) return false;
    const value = isPlainObject(operation.value) ? operation.value : null;
    return !!value && ids.has(operation.store + ":" + value.id);
  });
}

export function evaluateActivationIsolation(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const sourceDatabaseName = typeof source.sourceDatabaseName === "string"
    ? source.sourceDatabaseName : LOCAL_DATABASE_NAME;
  const targetDatabaseName = typeof source.targetDatabaseName === "string"
    ? source.targetDatabaseName : DATABASE_NAME;
  const distinct = workspaceNamesAreDistinct(sourceDatabaseName, targetDatabaseName);
  const ids = collectSnapshotIds(source.sourceSnapshot);
  const target = isPlainObject(source.targetRecords) ? source.targetRecords : null;
  let targetContainsSource = false;
  if (target) {
    const records = [...(Array.isArray(target.subjects) ? target.subjects : []),
      ...(Array.isArray(target.items) ? target.items : [])];
    targetContainsSource = records.some((record) =>
      record && (
        ids.has("subjects:" + record.id) || ids.has("items:" + record.id)
      ));
  }
  const preConsentSourceWrites = findPreConsentSourceWrites({
    sourceSnapshot: source.sourceSnapshot,
    operations: source.operations,
    consented: source.consented
  });
  return {
    isolated: distinct && !targetContainsSource && preConsentSourceWrites.length === 0,
    distinct,
    targetContainsSource,
    preConsentSourceWrites
  };
}

// Redacted, allowlisted descriptions used by the assistant status regions.
export function describeTargetClassification(classification) {
  switch (classification) {
    case TARGET_CLASSIFICATION.VERIFIED_EMPTY:
      return "Cible vérifiée vide après une lecture distante attestée. Le consentement reste requis.";
    case TARGET_CLASSIFICATION.POPULATED:
      return "Cible attestée déjà peuplée : seules les insertions absentes et sûres sont proposées, sans écrasement.";
    case TARGET_CLASSIFICATION.DIVERGENT:
      return "Cible attestée divergente : les conflits et groupes bloqués restent exclus de toute écriture.";
    case TARGET_CLASSIFICATION.IDENTITY_MISMATCH:
      return "Destination, base ou compte différents de l'activation attendue : aucun transfert n'est proposé.";
    case TARGET_CLASSIFICATION.UNAVAILABLE:
    default:
      return "Cible indisponible ou indéterminée : le Cloud n'est jamais considéré comme vide et aucun transfert n'est proposé.";
  }
}

export function describeActivationStage(stage) {
  switch (normalizeStage(stage)) {
    case ACTIVATION_STAGE.PREPARING:
      return "Préparation : vérification de l'URL Dexie Cloud, sans lecture des données métier.";
    case ACTIVATION_STAGE.CONNECTING:
      return "Connexion : authentification OTP native en cours. La connexion ne vaut pas consentement.";
    case ACTIVATION_STAGE.DISCOVERING:
      return "Première lecture distante attestée en cours, puis inventaire de la cible.";
    case ACTIVATION_STAGE.REVIEW:
      return "Revue : le plan affiché et sa destination doivent être confirmés explicitement.";
    case ACTIVATION_STAGE.TRANSFER_PENDING:
      return "Écrit localement dans la base synchronisée ; synchronisation distante en attente ou indéterminée.";
    case ACTIVATION_STAGE.ACTIVE:
      return "Activation terminée : la première synchronisation est attestée sur cet appareil.";
    case ACTIVATION_STAGE.FAILED:
      return "Activation interrompue et récupérable : la source locale reste intacte.";
    case ACTIVATION_STAGE.CANCELLED:
      return "Activation annulée avant consentement : la source locale et la cible restent inchangées.";
    case ACTIVATION_STAGE.LOCAL:
    default:
      return "Espace local actif : aucune configuration, authentification ou réplication Cloud n'est tentée.";
  }
}

export function cloudHostSuffix() {
  return CLOUD_HOST_SUFFIX;
}
