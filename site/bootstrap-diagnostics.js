// Pure, DOM-free bootstrap diagnostic core (TS-045).
//
// It owns a bounded, allowlisted bootstrap trace and the deterministic
// classification of an unverified workspace. Every value is a code, category,
// counter, boolean or relative timestamp: no email, OTP, token, raw user id,
// URL, title, note or raw error string can enter the serialized trace.
export const BOOTSTRAP_TRACE_VERSION = 1;
export const BOOTSTRAP_TRACE_STORAGE_KEY = "threadstep.bootstrap.trace.v1";
export const BOOTSTRAP_TRACE_MAX_EVENTS = 32;

export const BOOTSTRAP_EVENT = Object.freeze({
  CONFIGURATION: "configuration",
  REGISTRY_READ: "registry-read",
  BASE_OPEN: "base-open",
  SESSION_RESTORED: "session-restored",
  IDENTITY_OBSERVED: "identity-observed",
  BINDING_EVALUATED: "binding-evaluated",
  CACHE_READ: "cache-read",
  INITIAL_PULL: "initial-pull",
  REMOTE_EVIDENCE: "remote-evidence",
  BUSINESS_READ: "business-read"
});

export const BOOTSTRAP_CAUSE = Object.freeze({
  HISTORICAL_UNATTESTED_CACHE: "historical-unattested-cache",
  FIRST_PULL_BEFORE_BINDING: "first-pull-before-binding",
  RECOVERED_PRIOR_ATTESTATION: "recovered-prior-attestation",
  BINDING_WRITE_FAILURE: "binding-write-failure",
  DELAYED_IDENTITY: "delayed-identity",
  ACCOUNT_CHANGE: "account-change",
  DESTINATION_CHANGE: "destination-change",
  MISSING_ATTESTATION: "missing-attestation",
  INDETERMINATE: "indeterminate"
});

export const BOOTSTRAP_ORIGIN = Object.freeze({
  HISTORICAL: "historical-unverified",
  REGRESSION: "bootstrap-regression",
  IDENTITY: "identity-or-destination-change",
  INDETERMINATE: "indeterminate"
});

const EVENT_CODES = new Set(Object.values(BOOTSTRAP_EVENT));
const CAUSES = new Set(Object.values(BOOTSTRAP_CAUSE));
const ORIGINS = new Set(Object.values(BOOTSTRAP_ORIGIN));

// Only these scalar keys may accompany an event, and only with these types.
const EVENT_FIELDS = Object.freeze({
  ok: "boolean",
  present: "boolean",
  hasRecords: "boolean",
  attested: "boolean",
  authenticated: "boolean",
  pullCompleted: "boolean",
  identityObserved: "boolean",
  count: "count",
  generation: "count"
});

export const BOOTSTRAP_CAUSE_LABELS = Object.freeze({
  [BOOTSTRAP_CAUSE.HISTORICAL_UNATTESTED_CACHE]:
    "Cache historique sans attestation antérieure : données masquées",
  [BOOTSTRAP_CAUSE.FIRST_PULL_BEFORE_BINDING]:
    "Premier pull antérieur à la liaison : aucune adoption automatique",
  [BOOTSTRAP_CAUSE.RECOVERED_PRIOR_ATTESTATION]:
    "Attestation antérieure cohérente restaurée sans copie de données",
  [BOOTSTRAP_CAUSE.BINDING_WRITE_FAILURE]:
    "Échec de persistance de la liaison : données métier masquées",
  [BOOTSTRAP_CAUSE.DELAYED_IDENTITY]:
    "Identité native retardée : évaluation transitoire",
  [BOOTSTRAP_CAUSE.ACCOUNT_CHANGE]:
    "Compte différent de la liaison : données métier masquées",
  [BOOTSTRAP_CAUSE.DESTINATION_CHANGE]:
    "Base distante différente de la liaison : données métier masquées",
  [BOOTSTRAP_CAUSE.MISSING_ATTESTATION]:
    "Attestation de liaison manquante : données métier masquées",
  [BOOTSTRAP_CAUSE.INDETERMINATE]:
    "Cause indéterminée : données masquées, aucune cause inventée"
});

export const BOOTSTRAP_ORIGIN_LABELS = Object.freeze({
  [BOOTSTRAP_ORIGIN.HISTORICAL]: "État historique non vérifiable",
  [BOOTSTRAP_ORIGIN.REGRESSION]: "Régression de reprise du bootstrap",
  [BOOTSTRAP_ORIGIN.IDENTITY]: "Changement de compte ou de destination",
  [BOOTSTRAP_ORIGIN.INDETERMINATE]: "Indéterminé"
});

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isRelativeTimestamp(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeEventData(raw) {
  if (!isPlainObject(raw)) return null;
  const data = {};
  for (const [key, value] of Object.entries(raw)) {
    const type = EVENT_FIELDS[key];
    if (!type) return null;
    if (type === "boolean") {
      if (typeof value !== "boolean") return null;
      data[key] = value;
    } else {
      if (!Number.isInteger(value) || value < 0) return null;
      data[key] = value;
    }
  }
  return data;
}

export function isBootstrapEventCode(value) {
  return typeof value === "string" && EVENT_CODES.has(value);
}

export function createBootstrapTrace(options = {}) {
  const settings = isPlainObject(options) ? options : {};
  const clock = typeof settings.now === "function" ? settings.now : Date.now;
  const start = Number.isFinite(clock()) ? clock() : 0;
  const events = [];
  let sequence = 0;

  function add(raw) {
    if (!isPlainObject(raw) || !isBootstrapEventCode(raw.code)) return false;
    const { code, ...fields } = raw;
    const data = normalizeEventData(fields);
    if (!data) return false;
    if (events.length >= BOOTSTRAP_TRACE_MAX_EVENTS) {
      // Bounded ring: the oldest entry is dropped, never the newest proof.
      events.shift();
    }
    const now = clock();
    const at = Number.isFinite(now) ? Math.max(0, Math.round(now - start)) : 0;
    sequence += 1;
    events.push({ seq: sequence, code, at, ...data });
    return true;
  }

  function snapshot() {
    return {
      version: BOOTSTRAP_TRACE_VERSION,
      events: events.map((event) => ({ ...event }))
    };
  }

  return {
    add,
    snapshot,
    size: () => events.length
  };
}

export function emptyBootstrapTrace() {
  return { version: BOOTSTRAP_TRACE_VERSION, events: [] };
}

export function parseBootstrapTrace(value) {
  if (typeof value === "string") {
    if (!value.trim()) return emptyBootstrapTrace();
    try {
      return parseBootstrapTrace(JSON.parse(value));
    } catch {
      return emptyBootstrapTrace();
    }
  }
  if (!isPlainObject(value)) return emptyBootstrapTrace();
  if (value.version !== BOOTSTRAP_TRACE_VERSION) return emptyBootstrapTrace();
  if (!Array.isArray(value.events)) return emptyBootstrapTrace();
  const events = [];
  for (const raw of value.events.slice(-BOOTSTRAP_TRACE_MAX_EVENTS)) {
    if (!isPlainObject(raw)) return emptyBootstrapTrace();
    if (!isBootstrapEventCode(raw.code)) return emptyBootstrapTrace();
    if (!Number.isInteger(raw.seq) || raw.seq < 0 || !isRelativeTimestamp(raw.at)) {
      return emptyBootstrapTrace();
    }
    const data = normalizeEventData(Object.fromEntries(
      Object.entries(raw).filter(([key]) => key !== "seq" && key !== "code" && key !== "at")
    ));
    if (!data) return emptyBootstrapTrace();
    events.push({ seq: raw.seq, code: raw.code, at: raw.at, ...data });
  }
  return { version: BOOTSTRAP_TRACE_VERSION, events };
}

export function serializeBootstrapTrace(trace) {
  const parsed = parseBootstrapTrace(trace);
  return JSON.stringify(parsed);
}

export function readBootstrapTrace(storage) {
  const store = storage || (typeof globalThis !== "undefined" ? globalThis.localStorage : undefined);
  if (!store || typeof store.getItem !== "function") return emptyBootstrapTrace();
  try {
    return parseBootstrapTrace(store.getItem(BOOTSTRAP_TRACE_STORAGE_KEY));
  } catch {
    return emptyBootstrapTrace();
  }
}

export function writeBootstrapTrace(storage, trace) {
  const store = storage || (typeof globalThis !== "undefined" ? globalThis.localStorage : undefined);
  if (!store || typeof store.setItem !== "function") return false;
  try {
    store.setItem(BOOTSTRAP_TRACE_STORAGE_KEY, serializeBootstrapTrace(trace));
    return true;
  } catch {
    return false;
  }
}

function classification(cause, origin) {
  return {
    cause,
    origin,
    label: BOOTSTRAP_CAUSE_LABELS[cause],
    originLabel: BOOTSTRAP_ORIGIN_LABELS[origin]
  };
}

// Pure classifier. Precedence is deterministic and fails closed: an
// insufficient or contradictory evidence set yields `indeterminate` rather
// than inventing a root cause.
export function classifyBootstrapCause(input = {}) {
  const source = isPlainObject(input) ? input : {};
  if (source.destinationChanged === true) {
    return classification(BOOTSTRAP_CAUSE.DESTINATION_CHANGE, BOOTSTRAP_ORIGIN.IDENTITY);
  }
  if (source.accountChanged === true) {
    return classification(BOOTSTRAP_CAUSE.ACCOUNT_CHANGE, BOOTSTRAP_ORIGIN.IDENTITY);
  }
  if (source.bindingWriteFailed === true) {
    return classification(BOOTSTRAP_CAUSE.BINDING_WRITE_FAILURE, BOOTSTRAP_ORIGIN.REGRESSION);
  }
  if (source.identityPending === true) {
    return classification(BOOTSTRAP_CAUSE.DELAYED_IDENTITY, BOOTSTRAP_ORIGIN.REGRESSION);
  }
  if (source.recovered === true || source.attestedPrior === true) {
    return classification(BOOTSTRAP_CAUSE.RECOVERED_PRIOR_ATTESTATION, BOOTSTRAP_ORIGIN.REGRESSION);
  }
  if (source.firstPullCompleted === true) {
    return classification(BOOTSTRAP_CAUSE.FIRST_PULL_BEFORE_BINDING, BOOTSTRAP_ORIGIN.HISTORICAL);
  }
  if (source.cacheHasRecords === true && source.attestationPresent !== true) {
    return classification(BOOTSTRAP_CAUSE.HISTORICAL_UNATTESTED_CACHE, BOOTSTRAP_ORIGIN.HISTORICAL);
  }
  if (source.attestationPresent !== true && source.cacheHasRecords === false) {
    return classification(BOOTSTRAP_CAUSE.MISSING_ATTESTATION, BOOTSTRAP_ORIGIN.HISTORICAL);
  }
  return classification(BOOTSTRAP_CAUSE.INDETERMINATE, BOOTSTRAP_ORIGIN.INDETERMINATE);
}

export function isBootstrapCause(value) {
  return typeof value === "string" && CAUSES.has(value);
}

export function isBootstrapOrigin(value) {
  return typeof value === "string" && ORIGINS.has(value);
}

export function describeBootstrapCause(value) {
  return isBootstrapCause(value)
    ? BOOTSTRAP_CAUSE_LABELS[value]
    : BOOTSTRAP_CAUSE_LABELS[BOOTSTRAP_CAUSE.INDETERMINATE];
}
