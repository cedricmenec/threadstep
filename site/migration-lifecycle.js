// Pure, DOM-free lifecycle rules for the historical migration offer.
//
// The module only holds decisions and opaque metadata. It never reads business
// content, never touches IndexedDB or Dexie and never mutates
// `threadstep.document.v1`; the browser storage adapter stays in `site/app.js`.
import { sha256Hex } from "./fingerprint.js";

export const DISMISSAL_STORAGE_KEY = "threadstep.migration.dismissals.v1";
export const DISMISSAL_VERSION = 1;

export const OFFER_ACTION = Object.freeze({
  CLOSED: "closed",
  BLOCKED: "blocked",
  PREVIEW: "preview",
  ALREADY_RECONCILED: "already-reconciled",
  DISMISSED: "dismissed"
});

const DISMISSAL_KEY_PATTERN = /^[a-f0-9]{64}$/;

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

function normalizeDestination(destination) {
  if (typeof destination === "string") {
    return { url: destination, remoteDbId: null };
  }
  if (!isPlainObject(destination)) return { url: null, remoteDbId: null };
  return {
    url: typeof destination.url === "string" ? destination.url : null,
    remoteDbId: typeof destination.remoteDbId === "string" ? destination.remoteDbId : null
  };
}

function userDigest(userId) {
  return sha256Hex(canonicalJson({ userId: userId === undefined ? null : userId }));
}

// Dismissal identity: exact historical source, normalized destination URL,
// remote database and a hashed user identity. No raw identity is stored.
export function computeDismissalKey(input = {}) {
  const destination = normalizeDestination(input.destination);
  return sha256Hex(canonicalJson({
    version: DISMISSAL_VERSION,
    sourceFingerprint: typeof input.sourceFingerprint === "string" ? input.sourceFingerprint : "",
    url: destination.url,
    remoteDbId: destination.remoteDbId,
    user: userDigest(input.userId)
  }));
}

function emptyDismissalStore() {
  return { version: DISMISSAL_VERSION, keys: [] };
}

function validKeys(values) {
  const keys = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value === "string" && DISMISSAL_KEY_PATTERN.test(value)) keys.add(value);
  }
  return [...keys].sort();
}

// Accepts either serialized text or an already parsed record. Anything
// unreadable degrades to an empty, versioned record: no false persistence and
// no implicit migration.
export function parseDismissalStore(value) {
  if (typeof value === "string") {
    if (!value.trim()) return emptyDismissalStore();
    try {
      return parseDismissalStore(JSON.parse(value));
    } catch {
      return emptyDismissalStore();
    }
  }
  if (!isPlainObject(value) || value.version !== DISMISSAL_VERSION) {
    return emptyDismissalStore();
  }
  return { version: DISMISSAL_VERSION, keys: validKeys(value.keys) };
}

export function addDismissal(store, key) {
  const current = parseDismissalStore(store);
  if (typeof key !== "string" || !DISMISSAL_KEY_PATTERN.test(key)) return current;
  return { version: DISMISSAL_VERSION, keys: validKeys([...current.keys, key]) };
}

export function isDismissed(store, key) {
  if (typeof key !== "string") return false;
  return parseDismissalStore(store).keys.includes(key);
}

// Best-effort origin-local storage. An unavailable or refusing storage returns
// an empty record (read) or false (write), never an implicit migration.
export function readDismissalStore(storage) {
  if (!storage || typeof storage.getItem !== "function") return emptyDismissalStore();
  try {
    return parseDismissalStore(storage.getItem(DISMISSAL_STORAGE_KEY));
  } catch {
    return emptyDismissalStore();
  }
}

export function rememberDismissal(storage, key) {
  const next = addDismissal(readDismissalStore(storage), key);
  if (!storage || typeof storage.setItem !== "function") return false;
  if (!next.keys.includes(key)) return false;
  try {
    storage.setItem(DISMISSAL_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// Pure offer decision. Only the latest caller may render this result; the
// generation guard lives in `createGenerationGuard`.
export function decideHistoricalOffer(input = {}) {
  const sourcePresent = input.sourcePresent === true || input.sourceStatus === "present";
  if (!sourcePresent) return { action: OFFER_ACTION.CLOSED, reason: "source-absent" };
  if (input.configured === false) return { action: OFFER_ACTION.CLOSED, reason: "destination-missing" };
  if (input.authenticated === false) return { action: OFFER_ACTION.CLOSED, reason: "unauthenticated" };
  if (input.explicitRequest !== true && input.dismissed === true) {
    return { action: OFFER_ACTION.DISMISSED, reason: "dismissed" };
  }
  if (input.targetStatus === "read-error") {
    return { action: OFFER_ACTION.BLOCKED, reason: "read-error" };
  }
  if (input.attestation && input.attestation.attested !== true) {
    return {
      action: OFFER_ACTION.BLOCKED,
      reason: input.attestation.reason || "indeterminate"
    };
  }
  if (input.targetStatus !== undefined && input.targetStatus !== "ready") {
    return { action: OFFER_ACTION.BLOCKED, reason: input.reason || "indeterminate" };
  }
  const plan = input.plan;
  if (!plan) return { action: OFFER_ACTION.BLOCKED, reason: "indeterminate" };
  if (plan.status === "empty-source") {
    return { action: OFFER_ACTION.CLOSED, reason: "empty-source" };
  }
  const operations = Array.isArray(plan.operations) ? plan.operations : [];
  const blocked = Array.isArray(plan.blocked) ? plan.blocked : [];
  if (plan.status === "ambiguous-provenance") {
    return { action: OFFER_ACTION.PREVIEW, reason: "ambiguous-provenance" };
  }
  if (plan.status === "already-migrated" && operations.length === 0 && blocked.length === 0) {
    return { action: OFFER_ACTION.ALREADY_RECONCILED, reason: "already-migrated" };
  }
  if (operations.length > 0 || blocked.length > 0) {
    return { action: OFFER_ACTION.PREVIEW, reason: plan.status };
  }
  if (plan.status === "blocked") {
    return { action: OFFER_ACTION.PREVIEW, reason: "blocked" };
  }
  return { action: OFFER_ACTION.ALREADY_RECONCILED, reason: plan.status || "already-migrated" };
}

// Fixed, migration-owned messages. They never claim a remote synchronization;
// native synchronization claims stay in the sync diagnostic/status reducers.
export function describeHistoricalOffer(decision = {}) {
  switch (decision.action) {
    case OFFER_ACTION.BLOCKED:
      return "Migration temporairement bloquée : l'état distant courant n'est pas attesté. Aucune écriture.";
    case OFFER_ACTION.PREVIEW:
      return "Plan de migration à relire : aucune insertion n'est effectuée avant votre confirmation explicite.";
    case OFFER_ACTION.ALREADY_RECONCILED:
      return "Sauvegarde historique déjà réconciliée : aucune nouvelle insertion nécessaire.";
    case OFFER_ACTION.DISMISSED:
      return "Migration écartée pour cette source et cette destination. La sauvegarde historique reste exportable.";
    case OFFER_ACTION.CLOSED:
    default:
      return "";
  }
}

// Monotonic in-memory sequence. Every new evaluation starts a newer generation;
// a result may render only while its captured generation is still current.
export function createGenerationGuard() {
  let current = 0;
  return {
    begin() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
      return current;
    },
    current() {
      return current;
    },
    isCurrent(generation) {
      return generation === current;
    }
  };
}

export function initialFooterStatus() {
  return { owner: null, message: "", generation: 0, revision: 0 };
}

// Footer ownership/order reducer. Ordinary notices and real errors take
// ownership; a migration message cannot overwrite a real error. A
// migration-owned message can only be cleared by the current generation.
export function reduceFooterStatus(current, event = {}) {
  const state = current && typeof current === "object" ? current : initialFooterStatus();
  const owner = typeof state.owner === "string" ? state.owner : null;
  const message = typeof state.message === "string" ? state.message : "";
  const generation = Number.isFinite(state.generation) ? state.generation : 0;
  const revision = Number.isFinite(state.revision) ? state.revision : 0;
  const eventGeneration = Number.isFinite(event.generation) ? event.generation : generation;
  switch (event.type) {
    case "notice":
      return { owner: "notice", message: typeof event.message === "string" ? event.message : "", generation, revision: revision + 1 };
    case "error":
      return { owner: "error", message: typeof event.message === "string" ? event.message : "", generation, revision: revision + 1 };
    case "migration":
      if (owner === "error") return { owner, message, generation, revision };
      if (eventGeneration < generation) return { owner, message, generation, revision };
      return {
        owner: "migration",
        message: typeof event.message === "string" ? event.message : "",
        generation: eventGeneration,
        revision: revision + 1
      };
    case "migration-clear":
      if (owner !== "migration") return { owner, message, generation, revision };
      if (eventGeneration < generation) return { owner, message, generation, revision };
      return { owner: null, message: "", generation, revision: revision + 1 };
    default:
      return { owner, message, generation, revision };
  }
}

export function footerMessage(state) {
  return state && typeof state.message === "string" ? state.message : "";
}
