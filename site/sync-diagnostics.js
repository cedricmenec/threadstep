// Pure, injectable diagnostic model for native Dexie Cloud synchronization.
// No DOM, network, IndexedDB or secret access: browser signals are injected by
// `site/app.js`, and every output is an allowlisted, redacted representation.
import { describeAttestationReason, evaluateSyncAttestation } from "./migration-reconciliation.js";

export const SESSION_STATE = Object.freeze({
  AUTHENTICATED: "authenticated",
  LOADING: "loading",
  SIGNED_OUT: "signed-out",
  EXPIRED: "expired",
  REFUSED: "refused",
  INDETERMINATE: "indeterminate"
});

export const CONNECTION_STATE = Object.freeze({
  NOT_CONFIGURED: "not-configured",
  CONNECTED: "connected",
  CONNECTING: "connecting",
  DISCONNECTED: "disconnected",
  OFFLINE: "offline",
  ERROR: "error",
  INDETERMINATE: "indeterminate"
});

export const SYNC_PHASE = Object.freeze({
  INITIAL: "initial",
  NOT_IN_SYNC: "not-in-sync",
  PULLING: "pulling",
  PUSHING: "pushing",
  IN_SYNC: "in-sync",
  ERROR: "error",
  OFFLINE: "offline",
  INDETERMINATE: "indeterminate"
});

export const INITIAL_PULL = Object.freeze({
  NOT_CONFIGURED: "not-configured",
  PENDING: "pending",
  IN_PROGRESS: "in-progress",
  COMPLETE: "complete",
  FAILED: "failed",
  INDETERMINATE: "indeterminate"
});

export const LOCAL_WRITE_STATE = Object.freeze({
  NOT_APPLICABLE: "not-applicable",
  NONE: "none",
  LOCAL: "local",
  PENDING: "pending",
  SYNCED: "synced",
  ERROR: "error",
  INDETERMINATE: "indeterminate"
});

export const REMOTE_EVIDENCE = Object.freeze({
  NOT_CONFIGURED: "not-configured",
  UNKNOWN: "unknown",
  BLOCKED: "blocked",
  AVAILABLE: "available"
});

export const DIAGNOSTIC_ERROR = Object.freeze({
  NETWORK: "network",
  OFFLINE: "offline",
  PERMISSION: "permission",
  ORIGIN: "origin",
  SESSION: "session",
  SYNC: "sync",
  STORAGE: "storage",
  READ: "read",
  UNCATEGORIZED: "uncategorized"
});

export const WORKSPACE_DIAGNOSTIC_TYPE = Object.freeze({
  LOCAL: "local",
  SYNCHRONIZED: "synchronized"
});

export const BINDING_DIAGNOSTIC_STATE = Object.freeze({
  BOUND: "bound",
  UNBOUND: "unbound",
  UNVERIFIED: "unverified",
  MISMATCH: "mismatch",
  UNAUTHENTICATED: "unauthenticated",
  INDETERMINATE: "indeterminate"
});

export const WORKSPACE_TYPE_LABELS = Object.freeze({
  [WORKSPACE_DIAGNOSTIC_TYPE.LOCAL]: "Local autonome",
  [WORKSPACE_DIAGNOSTIC_TYPE.SYNCHRONIZED]: "Synchronisé"
});

export const BINDING_DIAGNOSTIC_LABELS = Object.freeze({
  [BINDING_DIAGNOSTIC_STATE.BOUND]: "Compte lié à cet espace",
  [BINDING_DIAGNOSTIC_STATE.UNBOUND]: "Espace lié au compte courant (cache vide)",
  [BINDING_DIAGNOSTIC_STATE.UNVERIFIED]: "Cache local non vérifié : déconnexion ou purge explicite requise",
  [BINDING_DIAGNOSTIC_STATE.MISMATCH]: "Compte différent de la liaison : données métier masquées",
  [BINDING_DIAGNOSTIC_STATE.UNAUTHENTICATED]: "Aucune session authentifiée",
  [BINDING_DIAGNOSTIC_STATE.INDETERMINATE]: "Liaison de compte indéterminée"
});

const WORKSPACE_TYPE_VALUES = new Set(Object.values(WORKSPACE_DIAGNOSTIC_TYPE));
const BINDING_VALUES = new Set(Object.values(BINDING_DIAGNOSTIC_STATE));

const SESSION_VALUES = new Set(Object.values(SESSION_STATE));
const CONNECTION_VALUES = new Set(Object.values(CONNECTION_STATE));
const PHASE_VALUES = new Set(Object.values(SYNC_PHASE));
const INITIAL_PULL_VALUES = new Set(Object.values(INITIAL_PULL));
const LOCAL_WRITE_VALUES = new Set(Object.values(LOCAL_WRITE_STATE));

const STATUS_MAP = Object.freeze({
  "not-started": CONNECTION_STATE.CONNECTING,
  connecting: CONNECTION_STATE.CONNECTING,
  connected: CONNECTION_STATE.CONNECTED,
  disconnected: CONNECTION_STATE.DISCONNECTED,
  error: CONNECTION_STATE.ERROR,
  offline: CONNECTION_STATE.OFFLINE
});

const PHASE_MAP = Object.freeze({
  initial: SYNC_PHASE.INITIAL,
  "not-in-sync": SYNC_PHASE.NOT_IN_SYNC,
  pulling: SYNC_PHASE.PULLING,
  pushing: SYNC_PHASE.PUSHING,
  "in-sync": SYNC_PHASE.IN_SYNC,
  error: SYNC_PHASE.ERROR,
  offline: SYNC_PHASE.OFFLINE
});

export const SESSION_LABELS = Object.freeze({
  [SESSION_STATE.AUTHENTICATED]: "Session authentifiée",
  [SESSION_STATE.LOADING]: "Session en cours de restauration",
  [SESSION_STATE.SIGNED_OUT]: "Aucune session",
  [SESSION_STATE.EXPIRED]: "Session expirée",
  [SESSION_STATE.REFUSED]: "Session refusée par le service",
  [SESSION_STATE.INDETERMINATE]: "Session indéterminée"
});

export const CONNECTION_LABELS = Object.freeze({
  [CONNECTION_STATE.NOT_CONFIGURED]: "Synchronisation Cloud non activée",
  [CONNECTION_STATE.CONNECTED]: "Connecté",
  [CONNECTION_STATE.CONNECTING]: "Connexion en cours",
  [CONNECTION_STATE.DISCONNECTED]: "Déconnecté",
  [CONNECTION_STATE.OFFLINE]: "Hors ligne",
  [CONNECTION_STATE.ERROR]: "Erreur de connexion",
  [CONNECTION_STATE.INDETERMINATE]: "Connexion indéterminée"
});

export const PHASE_LABELS = Object.freeze({
  [SYNC_PHASE.INITIAL]: "Synchronisation initiale",
  [SYNC_PHASE.NOT_IN_SYNC]: "Pas encore synchronisé",
  [SYNC_PHASE.PULLING]: "Lecture distante en cours",
  [SYNC_PHASE.PUSHING]: "Envoi local en cours",
  [SYNC_PHASE.IN_SYNC]: "Synchronisé",
  [SYNC_PHASE.ERROR]: "Erreur de synchronisation",
  [SYNC_PHASE.OFFLINE]: "Synchronisation hors ligne",
  [SYNC_PHASE.INDETERMINATE]: "Phase indéterminée"
});

export const INITIAL_PULL_LABELS = Object.freeze({
  [INITIAL_PULL.NOT_CONFIGURED]: "Pull initial non applicable",
  [INITIAL_PULL.PENDING]: "Pull initial en attente",
  [INITIAL_PULL.IN_PROGRESS]: "Pull initial en cours",
  [INITIAL_PULL.COMPLETE]: "Pull initial terminé",
  [INITIAL_PULL.FAILED]: "Pull initial en échec",
  [INITIAL_PULL.INDETERMINATE]: "Pull initial indéterminé"
});

export const LOCAL_WRITE_LABELS = Object.freeze({
  [LOCAL_WRITE_STATE.NOT_APPLICABLE]: "Sans objet (Cloud non activé)",
  [LOCAL_WRITE_STATE.NONE]: "Aucune écriture locale récente",
  [LOCAL_WRITE_STATE.LOCAL]: "Enregistré localement",
  [LOCAL_WRITE_STATE.PENDING]: "En attente de synchronisation",
  [LOCAL_WRITE_STATE.SYNCED]: "Synchronisé",
  [LOCAL_WRITE_STATE.ERROR]: "Erreur d'écriture locale",
  [LOCAL_WRITE_STATE.INDETERMINATE]: "Statut d'écriture indéterminé"
});

export const REMOTE_EVIDENCE_LABELS = Object.freeze({
  [REMOTE_EVIDENCE.NOT_CONFIGURED]: "Synchronisation Cloud non activée",
  [REMOTE_EVIDENCE.UNKNOWN]: "État distant non déterminé",
  [REMOTE_EVIDENCE.BLOCKED]: "Lecture distante bloquée",
  [REMOTE_EVIDENCE.AVAILABLE]: "Synchronisation initiale attestée"
});

export const ERROR_MESSAGES = Object.freeze({
  [DIAGNOSTIC_ERROR.NETWORK]: "Erreur réseau : Dexie Cloud est injoignable. Le Cloud n'est pas considéré comme vide.",
  [DIAGNOSTIC_ERROR.OFFLINE]: "Hors ligne : aucune lecture distante n'est possible pour le moment.",
  [DIAGNOSTIC_ERROR.PERMISSION]: "Droit refusé par Dexie Cloud : cette session ne peut pas lire cette base.",
  [DIAGNOSTIC_ERROR.ORIGIN]: "Origine non autorisée par l'instance Dexie Cloud.",
  [DIAGNOSTIC_ERROR.SESSION]: "Session expirée ou non autorisée : reconnectez-vous par OTP.",
  [DIAGNOSTIC_ERROR.SYNC]: "Erreur de synchronisation Dexie Cloud. Le Cloud n'est pas considéré comme vide.",
  [DIAGNOSTIC_ERROR.STORAGE]: "Stockage local IndexedDB indisponible ou saturé.",
  [DIAGNOSTIC_ERROR.READ]: "Lecture distante impossible. Le Cloud n'est pas considéré comme vide.",
  [DIAGNOSTIC_ERROR.UNCATEGORIZED]: "Erreur technique non catégorisée. Le Cloud n'est pas considéré comme vide."
});

export const RETRY_REASON_LABELS = Object.freeze({
  "not-configured": "Synchronisation Cloud non activée.",
  unauthenticated: "Connectez-vous pour relancer la lecture distante.",
  offline: "La relance nécessite une connexion réseau.",
  "already-synced": "Le pull initial est déjà terminé.",
  "in-progress": "Une synchronisation est déjà en cours.",
  refused: "La relance est indisponible : droit ou origine refusé.",
  indeterminate: "L'état de synchronisation est indéterminé : relance non proposée."
});

const REMOTE_NOT_EMPTY = "Le Cloud n'est pas considéré comme vide.";
const REMOTE_AVAILABLE_MESSAGE =
  "La synchronisation initiale est attestée par les signaux natifs ; aucun enregistrement métier n'est lu par ce diagnostic.";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function retryReasonLabel(reason) {
  return RETRY_REASON_LABELS[reason] || RETRY_REASON_LABELS.indeterminate;
}

export function normalizeCloudBaseUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function normalizeSyncState(native) {
  const state = isPlainObject(native) ? native : {};
  const status = STATUS_MAP[typeof state.status === "string" ? state.status : ""] ||
    CONNECTION_STATE.INDETERMINATE;
  const phase = PHASE_MAP[typeof state.phase === "string" ? state.phase : ""] ||
    SYNC_PHASE.INDETERMINATE;
  return { status, phase };
}

export function normalizeUser(native, options = {}) {
  const settings = isPlainObject(options) ? options : {};
  const refusal = typeof settings.refusal === "string" ? settings.refusal : null;
  if (refusal === "origin-refusal") return SESSION_STATE.REFUSED;
  if (refusal === "permission-refusal") return SESSION_STATE.REFUSED;
  if (settings.expired === true) return SESSION_STATE.EXPIRED;
  const user = isPlainObject(native) ? native : null;
  if (user && (user.expired === true || user.credentialsExpired === true)) {
    return SESSION_STATE.EXPIRED;
  }
  if (user && user.isLoading === true) return SESSION_STATE.LOADING;
  if (settings.loading === true) return SESSION_STATE.LOADING;
  if (user && user.isLoggedIn === true && typeof user.userId === "string") {
    return SESSION_STATE.AUTHENTICATED;
  }
  if (user && user.isLoggedIn === true) return SESSION_STATE.AUTHENTICATED;
  if (refusal) return SESSION_STATE.INDETERMINATE;
  return SESSION_STATE.SIGNED_OUT;
}

function safeField(value) {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function categoryCode(category, value) {
  const combined = [
    safeField(value && value.name),
    safeField(value && value.code),
    safeField(value && value.messageCode)
  ].join(" ");
  if (category === DIAGNOSTIC_ERROR.NETWORK && /timeout|timed/.test(combined)) {
    return "network-timeout";
  }
  if (category === DIAGNOSTIC_ERROR.SYNC && /conflict/.test(combined)) {
    return "sync-conflict";
  }
  if (category === DIAGNOSTIC_ERROR.STORAGE && /quota/.test(combined)) {
    return "quota-exceeded";
  }
  switch (category) {
    case DIAGNOSTIC_ERROR.OFFLINE: return "offline";
    case DIAGNOSTIC_ERROR.PERMISSION: return "permission-denied";
    case DIAGNOSTIC_ERROR.ORIGIN: return "origin-refused";
    case DIAGNOSTIC_ERROR.SESSION: return "session-expired";
    case DIAGNOSTIC_ERROR.READ: return "read-error";
    case DIAGNOSTIC_ERROR.SYNC: return "sync-error";
    case DIAGNOSTIC_ERROR.STORAGE: return "storage-error";
    case DIAGNOSTIC_ERROR.NETWORK: return "network-error";
    default: return "uncategorized";
  }
}

// Inspects only stable, non-content fields. Raw messages, stacks, emails, OTPs,
// tokens, titles and notes are never read or returned.
export function classifySyncError(value) {
  if (value === null || value === undefined) return null;
  const source = isPlainObject(value) ? value : { name: String(value) };
  const name = safeField(source.name);
  const code = safeField(source.code);
  const messageCode = safeField(source.messageCode);
  const status = safeField(source.status);
  const licenseStatus = safeField(source.license && source.license.status);
  const httpStatus = typeof source.httpStatus === "number" ? source.httpStatus : null;
  const combined = [name, code, messageCode, status, licenseStatus].join(" ");

  let category = DIAGNOSTIC_ERROR.UNCATEGORIZED;
  if (/securityerror|origin|not-allowed/.test(combined)) {
    category = DIAGNOSTIC_ERROR.ORIGIN;
  } else if (httpStatus === 403 || /permission|forbidden|denied/.test(combined)) {
    category = DIAGNOSTIC_ERROR.PERMISSION;
  } else if (httpStatus === 401 || /unauthor|expired|session|authentication/.test(combined)) {
    category = DIAGNOSTIC_ERROR.SESSION;
  } else if (/offline|no-network/.test(combined)) {
    category = DIAGNOSTIC_ERROR.OFFLINE;
  } else if (name === "typeerror" || name === "networkerror" ||
    (httpStatus !== null && (httpStatus >= 500 || httpStatus === 408 || httpStatus === 429)) ||
    /network|fetch|timeout|timed/.test(combined)) {
    category = DIAGNOSTIC_ERROR.NETWORK;
  } else if (/quotaexceeded|databaseclosed|invalidstateerror|quota|storage|indexeddb|database/.test(combined)) {
    category = DIAGNOSTIC_ERROR.STORAGE;
  } else if (name === "readerror" || /read/.test(combined)) {
    category = DIAGNOSTIC_ERROR.READ;
  } else if (/syncerror|sync|conflict|consistency/.test(combined)) {
    category = DIAGNOSTIC_ERROR.SYNC;
  }
  return { category, code: categoryCode(category, source) };
}

function normalizeCategory(value) {
  if (typeof value === "string" && Object.values(DIAGNOSTIC_ERROR).includes(value)) {
    return { category: value, code: categoryCode(value, null) };
  }
  return DIAGNOSTIC_ERROR.UNCATEGORIZED;
}

function addError(list, classified) {
  if (!classified || !classified.category) return;
  if (list.some((entry) => entry.category === classified.category)) return;
  list.push({ category: classified.category, code: classified.code });
}

export function reduceLocalWriteStatus(previous, event = {}) {
  const state = LOCAL_WRITE_VALUES.has(previous) ? previous : LOCAL_WRITE_STATE.INDETERMINATE;
  const changes = isPlainObject(event) ? event : {};
  switch (changes.type) {
    case "not-applicable":
      return LOCAL_WRITE_STATE.NOT_APPLICABLE;
    case "reset":
      return LOCAL_WRITE_STATE.NONE;
    case "commit-local":
      return LOCAL_WRITE_STATE.LOCAL;
    case "commit-error":
    case "read-error":
      return LOCAL_WRITE_STATE.ERROR;
    case "sync-error":
      return state;
    case "sync-state": {
      const phase = changes.phase;
      if (phase === SYNC_PHASE.PULLING || phase === SYNC_PHASE.PUSHING) {
        return state === LOCAL_WRITE_STATE.LOCAL || state === LOCAL_WRITE_STATE.PENDING
          ? LOCAL_WRITE_STATE.PENDING
          : state;
      }
      if (phase === SYNC_PHASE.IN_SYNC &&
        (state === LOCAL_WRITE_STATE.LOCAL || state === LOCAL_WRITE_STATE.PENDING)) {
        return changes.initiallySynced === true
          ? LOCAL_WRITE_STATE.SYNCED
          : LOCAL_WRITE_STATE.INDETERMINATE;
      }
      return state;
    }
    case "sync-complete":
      if ((state === LOCAL_WRITE_STATE.LOCAL || state === LOCAL_WRITE_STATE.PENDING) &&
        changes.attested === true) {
        return LOCAL_WRITE_STATE.SYNCED;
      }
      return state;
    case "indeterminate":
      return LOCAL_WRITE_STATE.INDETERMINATE;
    default:
      return state;
  }
}

function deriveInitialPull({ configured, syncState, persistedSyncState, retryError }) {
  if (!configured) return INITIAL_PULL.NOT_CONFIGURED;
  const persisted = isPlainObject(persistedSyncState) ? persistedSyncState : null;
  const persistedFailed = !!persisted && persisted.error !== undefined && persisted.error !== null &&
    persisted.error !== "";
  if (persistedFailed || syncState.status === CONNECTION_STATE.ERROR ||
    syncState.phase === SYNC_PHASE.ERROR) {
    return INITIAL_PULL.FAILED;
  }
  if (persisted && persisted.initiallySynced === true) {
    if (persisted.serverRevision !== undefined && persisted.serverRevision !== null) {
      return INITIAL_PULL.COMPLETE;
    }
    return INITIAL_PULL.INDETERMINATE;
  }
  if (retryError) return INITIAL_PULL.FAILED;
  if (syncState.phase === SYNC_PHASE.PULLING) return INITIAL_PULL.IN_PROGRESS;
  if (!persisted) {
    return syncState.phase === SYNC_PHASE.INDETERMINATE &&
      syncState.status === CONNECTION_STATE.INDETERMINATE
      ? INITIAL_PULL.INDETERMINATE
      : INITIAL_PULL.PENDING;
  }
  if (syncState.phase === SYNC_PHASE.INDETERMINATE &&
    syncState.status === CONNECTION_STATE.INDETERMINATE) {
    return INITIAL_PULL.INDETERMINATE;
  }
  return INITIAL_PULL.PENDING;
}

function deriveBase(source, persisted) {
  const url = normalizeCloudBaseUrl(source.databaseUrl);
  const persistedUrl = persisted ? normalizeCloudBaseUrl(persisted.databaseUrl) : null;
  const remoteDbId = persisted && typeof persisted.remoteDbId === "string"
    ? persisted.remoteDbId
    : (typeof source.remoteDbId === "string" ? source.remoteDbId : null);
  let mismatch = false;
  if (persistedUrl && url && persistedUrl !== url) mismatch = true;
  if (typeof source.remoteDbId === "string" && persisted &&
    typeof persisted.remoteDbId === "string" && source.remoteDbId !== persisted.remoteDbId) {
    mismatch = true;
  }
  return {
    configured: source.configured === true && !!url,
    url,
    remoteDbId,
    mismatch
  };
}

function deriveRemoteEvidence({ configured, base, input, readError, initialPull }) {
  if (!configured) {
    return {
      state: REMOTE_EVIDENCE.NOT_CONFIGURED,
      reason: "destination-missing",
      message: "Synchronisation Cloud non activée : aucun état distant n'est interrogé.",
      notEmpty: true
    };
  }
  if (readError || input.retryError) {
    return {
      state: REMOTE_EVIDENCE.UNKNOWN,
      reason: "read-error",
      message: "Lecture distante impossible. " + REMOTE_NOT_EMPTY,
      notEmpty: true
    };
  }
  if (initialPull === INITIAL_PULL.FAILED) {
    return {
      state: REMOTE_EVIDENCE.BLOCKED,
      reason: "sync-error",
      message: "La dernière synchronisation a échoué. " + REMOTE_NOT_EMPTY,
      notEmpty: true
    };
  }
  const attestation = evaluateSyncAttestation({
    online: input.online !== false,
    user: input.user,
    syncState: input.syncState,
    persistedSyncState: input.persistedSyncState,
    databaseUrl: base.url,
    remoteDbId: typeof input.remoteDbId === "string" ? input.remoteDbId : null
  });
  if (attestation.attested) {
    return {
      state: REMOTE_EVIDENCE.AVAILABLE,
      reason: null,
      message: REMOTE_AVAILABLE_MESSAGE,
      notEmpty: true
    };
  }
  const reason = attestation.reason || "indeterminate";
  const explained = describeAttestationReason(reason) || REMOTE_NOT_EMPTY;
  const message = /considéré comme vide/.test(explained)
    ? explained
    : explained + " " + REMOTE_NOT_EMPTY;
  return {
    state: reason === "indeterminate" ? REMOTE_EVIDENCE.UNKNOWN : REMOTE_EVIDENCE.BLOCKED,
    reason,
    message,
    notEmpty: true
  };
}

function sanitizeWorkspaceDiagnostic(value) {
  if (!isPlainObject(value)) return null;
  const type = WORKSPACE_TYPE_VALUES.has(value.type)
    ? value.type
    : WORKSPACE_DIAGNOSTIC_TYPE.LOCAL;
  const effectiveBase = safeDiagnosticString(value.effectiveBase);
  const url = type === WORKSPACE_DIAGNOSTIC_TYPE.SYNCHRONIZED
    ? safeDiagnosticString(value.url)
    : null;
  const remoteDbId = safeDiagnosticString(value.remoteDbId);
  return {
    type,
    effectiveBase: effectiveBase || "indisponible",
    url,
    remoteDbId
  };
}

function safeDiagnosticString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    ? value
    : null;
}

export function buildSyncDiagnostic(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const configured = source.configured === true;
  const persisted = isPlainObject(source.persistedSyncState) ? source.persistedSyncState : null;
  const syncState = normalizeSyncState(source.syncState);
  const session = normalizeUser(source.user, {
    refusal: source.authRefusal,
    expired: source.authExpired,
    loading: source.authLoading
  });
  const connection = configured ? syncState.status : CONNECTION_STATE.NOT_CONFIGURED;
  const phase = configured ? syncState.phase : SYNC_PHASE.INDETERMINATE;
  const initialPull = deriveInitialPull({
    configured,
    syncState,
    persistedSyncState: persisted,
    retryError: source.retryError
  });
  const base = deriveBase({ ...source, configured }, persisted);
  const localWrites = LOCAL_WRITE_VALUES.has(source.localWrites)
    ? source.localWrites
    : (configured ? LOCAL_WRITE_STATE.NONE : LOCAL_WRITE_STATE.NOT_APPLICABLE);

  const errors = [];
  if (configured) {
    addError(errors, classifySyncError(source.syncState && source.syncState.error));
    addError(errors, classifySyncError(persisted && persisted.error));
    addError(errors, classifySyncError(source.retryError));
  }
  addError(errors, classifySyncError(source.readError));
  if (source.authRefusal === "origin-refusal" || source.authRefusal === "permission-refusal") {
    addError(errors, classifySyncError({ code: source.authRefusal }));
  }
  if (!errors.some((entry) => entry.category === DIAGNOSTIC_ERROR.SYNC) &&
    configured && (connection === CONNECTION_STATE.ERROR || phase === SYNC_PHASE.ERROR)) {
    addError(errors, { category: DIAGNOSTIC_ERROR.SYNC, code: "sync-error" });
  }

  const remoteEvidence = deriveRemoteEvidence({
    configured,
    base,
    input: source,
    readError: source.readError,
    initialPull
  });

  return {
    configured,
    online: source.online !== false,
    session,
    connection,
    phase,
    initialPull,
    base,
    errors,
    localWrites,
    remoteEvidence,
    workspace: sanitizeWorkspaceDiagnostic(source.workspace),
    binding: BINDING_VALUES.has(source.binding)
      ? source.binding
      : BINDING_DIAGNOSTIC_STATE.INDETERMINATE
  };
}

export function canRetryInitialPull(diagnostic) {
  const state = isPlainObject(diagnostic) ? diagnostic : {};
  const blocked = (reason) => ({ allowed: false, reason });
  if (state.configured !== true || !state.base || state.base.configured !== true) {
    return blocked("not-configured");
  }
  if (state.session === SESSION_STATE.REFUSED) return blocked("refused");
  if (state.session !== SESSION_STATE.AUTHENTICATED) return blocked("unauthenticated");
  if (state.online === false || state.connection === CONNECTION_STATE.OFFLINE) {
    return blocked("offline");
  }
  if (state.base.mismatch === true) return blocked("indeterminate");
  if (state.initialPull === INITIAL_PULL.COMPLETE) return blocked("already-synced");
  if (state.initialPull === INITIAL_PULL.IN_PROGRESS ||
    state.phase === SYNC_PHASE.PULLING || state.phase === SYNC_PHASE.PUSHING) {
    return blocked("in-progress");
  }
  const categories = (Array.isArray(state.errors) ? state.errors : [])
    .map((entry) => entry && entry.category);
  if (categories.includes(DIAGNOSTIC_ERROR.PERMISSION) ||
    categories.includes(DIAGNOSTIC_ERROR.ORIGIN)) {
    return blocked("refused");
  }
  if (state.initialPull === INITIAL_PULL.INDETERMINATE &&
    state.connection === CONNECTION_STATE.INDETERMINATE) {
    return blocked("indeterminate");
  }
  return { allowed: true, reason: null };
}

export async function retryInitialPull(adapter, options = {}) {
  const settings = isPlainObject(options) ? options : {};
  let decision = settings.isAllowed;
  if (typeof decision === "function") decision = decision();
  if (!decision || decision.allowed !== true) {
    return { status: "blocked", reason: decision && decision.reason ? decision.reason : "indeterminate" };
  }
  if (!adapter || typeof adapter.syncPull !== "function") {
    return { status: "blocked", reason: "indeterminate" };
  }
  try {
    await adapter.syncPull();
    return { status: "completed" };
  } catch (error) {
    return {
      status: "failed",
      error: classifySyncError(error) || { category: DIAGNOSTIC_ERROR.UNCATEGORIZED, code: "uncategorized" }
    };
  }
}

export function createSyncDiagnosticsController(options = {}) {
  const settings = isPlainObject(options) ? options : {};
  const readInput = typeof settings.readInput === "function" ? settings.readInput : () => ({});
  const syncPull = typeof settings.syncPull === "function" ? settings.syncPull : null;
  const onChange = typeof settings.onChange === "function" ? settings.onChange : () => {};
  let current = null;
  let busy = false;
  let lastRetryError = null;

  function build() {
    const rawInput = readInput();
    const input = isPlainObject(rawInput) ? { ...rawInput } : {};
    if (lastRetryError) {
      const persisted = isPlainObject(input.persistedSyncState) ? input.persistedSyncState : null;
      if (persisted && persisted.initiallySynced === true) lastRetryError = null;
      else input.retryError = lastRetryError;
    }
    current = buildSyncDiagnostic(input);
    return current;
  }

  function refresh() {
    current = build();
    onChange(current, { retrying: busy });
    return current;
  }

  async function retry() {
    if (busy) return { status: "blocked", reason: "in-progress" };
    const diagnostic = build();
    const decision = canRetryInitialPull(diagnostic);
    if (!decision.allowed) return { status: "blocked", reason: decision.reason };
    if (!syncPull) return { status: "blocked", reason: "indeterminate" };
    busy = true;
    lastRetryError = null;
    onChange(diagnostic, { retrying: true });
    let result;
    try {
      await syncPull();
      result = { status: "completed" };
    } catch (error) {
      lastRetryError = classifySyncError(error) ||
        { category: DIAGNOSTIC_ERROR.UNCATEGORIZED, code: "uncategorized" };
      result = { status: "failed", error: lastRetryError };
    } finally {
      busy = false;
    }
    const diagnosticAfter = refresh();
    return { ...result, diagnostic: diagnosticAfter };
  }

  return {
    refresh,
    retry,
    getDiagnostic: () => current,
    isBusy: () => busy
  };
}

function safeValue(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

const LOCAL_ERROR_CATEGORIES = new Set([
  DIAGNOSTIC_ERROR.READ,
  DIAGNOSTIC_ERROR.STORAGE
]);

export function buildDiagnosticSummary(diagnostic) {
  const state = isPlainObject(diagnostic) ? diagnostic : {};
  const view = buildDiagnosticView(state);
  if (state.configured !== true || !isPlainObject(state.base) || state.base.configured !== true) {
    const localError = view.errors.some((entry) => LOCAL_ERROR_CATEGORIES.has(entry.category)) ||
      state.localWrites === LOCAL_WRITE_STATE.ERROR;
    if (localError) {
      return {
        needsAttention: true,
        text: "Cloud non configuré : local uniquement. Erreur locale de lecture ou d'écriture, sans état distant."
      };
    }
    return {
      needsAttention: false,
      text: "Cloud non configuré : local uniquement, aucune synchronisation Cloud active."
    };
  }

  const sessionNeedsAttention = state.session !== SESSION_STATE.AUTHENTICATED;
  const connectionNeedsAttention = state.connection !== CONNECTION_STATE.CONNECTED;
  const phaseNeedsAttention = state.phase !== SYNC_PHASE.IN_SYNC;
  const pullNeedsAttention = state.initialPull !== INITIAL_PULL.COMPLETE;
  const writesNeedAttention = state.localWrites !== LOCAL_WRITE_STATE.NONE &&
    state.localWrites !== LOCAL_WRITE_STATE.SYNCED;
  const baseMismatch = state.base.mismatch === true;
  const needsAttention = sessionNeedsAttention || connectionNeedsAttention ||
    phaseNeedsAttention || pullNeedsAttention || writesNeedAttention ||
    baseMismatch || view.errors.length > 0;

  const parts = [
    "Session : " + view.sessionLabel,
    "Connexion : " + view.connectionLabel,
    "Phase native : " + view.phaseLabel,
    "Preuve distante : " + view.remoteEvidenceLabel
  ];
  if (pullNeedsAttention) parts.push("Pull initial : " + view.initialPullLabel);
  if (writesNeedAttention) parts.push("Écritures locales : " + view.localWritesLabel);
  if (baseMismatch) parts.push("Base configurée incohérente avec la base persistée");
  const remoteState = isPlainObject(state.remoteEvidence) ? state.remoteEvidence.state : null;
  if (needsAttention && remoteState !== REMOTE_EVIDENCE.AVAILABLE) {
    parts.push(view.remoteEvidenceMessage);
  }
  if (view.errors.length > 0) parts.push(view.errors[0].message);
  const text = needsAttention
    ? parts.join(" · ")
    : "Synchronisation en phase · " + parts.join(" · ");

  return { needsAttention, text };
}

export function buildDiagnosticView(diagnostic, options = {}) {
  const state = isPlainObject(diagnostic) ? diagnostic : {};
  const settings = isPlainObject(options) ? options : {};
  const session = SESSION_VALUES.has(state.session) ? state.session : SESSION_STATE.INDETERMINATE;
  const connection = CONNECTION_VALUES.has(state.connection)
    ? state.connection : CONNECTION_STATE.INDETERMINATE;
  const phase = PHASE_VALUES.has(state.phase) ? state.phase : SYNC_PHASE.INDETERMINATE;
  const initialPull = INITIAL_PULL_VALUES.has(state.initialPull)
    ? state.initialPull : INITIAL_PULL.INDETERMINATE;
  const localWrites = LOCAL_WRITE_VALUES.has(state.localWrites)
    ? state.localWrites : LOCAL_WRITE_STATE.INDETERMINATE;
  const remote = isPlainObject(state.remoteEvidence) ? state.remoteEvidence : {
    state: REMOTE_EVIDENCE.UNKNOWN,
    message: REMOTE_NOT_EMPTY,
    notEmpty: true
  };
  const remoteState = Object.values(REMOTE_EVIDENCE).includes(remote.state)
    ? remote.state : REMOTE_EVIDENCE.UNKNOWN;
  const base = isPlainObject(state.base) ? state.base : { configured: false, url: null, remoteDbId: null, mismatch: false };
  const baseValue = base.configured
    ? safeValue(base.url, "URL configurée indisponible") + (base.mismatch ? " (incohérence avec la base persistée)" : "")
    : "Aucune base Cloud configurée";

  const errors = (Array.isArray(state.errors) ? state.errors : []).map((entry) => {
    const normalized = normalizeCategory(entry && entry.category);
    return {
      category: normalized.category,
      code: entry && typeof entry.code === "string" ? entry.code : normalized.code,
      message: ERROR_MESSAGES[normalized.category]
    };
  });

  const decision = canRetryInitialPull(state);
  const autoDisabled = decision.allowed !== true;
  const busy = settings.busy === true;
  const workspace = isPlainObject(state.workspace) ? state.workspace : null;
  const binding = BINDING_VALUES.has(state.binding)
    ? state.binding
    : BINDING_DIAGNOSTIC_STATE.INDETERMINATE;
  const rows = [
    { key: "session", label: "Session", value: SESSION_LABELS[session] },
    { key: "connection", label: "Connexion", value: CONNECTION_LABELS[connection] },
    { key: "phase", label: "Phase native", value: PHASE_LABELS[phase] },
    { key: "initial-pull", label: "Pull initial", value: INITIAL_PULL_LABELS[initialPull] },
    { key: "base", label: "Base configurée", value: baseValue },
    { key: "local-writes", label: "Écritures locales", value: LOCAL_WRITE_LABELS[localWrites] },
    { key: "remote-evidence", label: "Preuve distante", value: REMOTE_EVIDENCE_LABELS[remoteState] }
  ];
  if (base.configured && typeof base.remoteDbId === "string" && base.remoteDbId.length > 0) {
    rows.splice(5, 0, { key: "remote-db", label: "Identifiant distant", value: base.remoteDbId });
  }
  if (workspace) {
    const workspaceType = WORKSPACE_TYPE_VALUES.has(workspace.type)
      ? workspace.type
      : WORKSPACE_DIAGNOSTIC_TYPE.LOCAL;
    const workspaceRows = [
      { key: "workspace-type", label: "Espace de travail", value: WORKSPACE_TYPE_LABELS[workspaceType] },
      { key: "workspace-base", label: "Base locale effective", value: safeValue(workspace.effectiveBase, "indisponible") }
    ];
    if (workspaceType === WORKSPACE_DIAGNOSTIC_TYPE.SYNCHRONIZED) {
      workspaceRows.push({
        key: "workspace-url",
        label: "URL normalisée",
        value: safeValue(workspace.url, "URL indisponible")
      });
      if (safeValue(workspace.remoteDbId, null)) {
        workspaceRows.push({
          key: "workspace-remote-db",
          label: "Identifiant distant",
          value: workspace.remoteDbId
        });
      }
    }
    workspaceRows.push({
      key: "workspace-binding",
      label: "Liaison de compte",
      value: BINDING_DIAGNOSTIC_LABELS[binding]
    });
    rows.splice(1, 0, ...workspaceRows);
  }
  rows.push({ key: "remote-message", label: "État du Cloud", value: safeValue(remote.message, REMOTE_NOT_EMPTY) });

  const statusMessage = errors.length > 0
    ? errors[0].message
    : safeValue(remote.message, CONNECTION_LABELS[connection]);

  return {
    title: "Diagnostic de synchronisation",
    readonly: "Vue en lecture seule : aucun enregistrement métier, OTP, email ou secret n'est affiché ni modifié.",
    rows,
    errors,
    sessionLabel: SESSION_LABELS[session],
    connectionLabel: CONNECTION_LABELS[connection],
    phaseLabel: PHASE_LABELS[phase],
    initialPullLabel: INITIAL_PULL_LABELS[initialPull],
    localWritesLabel: LOCAL_WRITE_LABELS[localWrites],
    workspaceTypeLabel: workspace ? WORKSPACE_TYPE_LABELS[workspace.type] : null,
    bindingLabel: workspace ? BINDING_DIAGNOSTIC_LABELS[binding] : null,
    remoteEvidenceLabel: REMOTE_EVIDENCE_LABELS[remoteState],
    remoteEvidenceMessage: safeValue(remote.message, REMOTE_NOT_EMPTY),
    remoteNotEmpty: true,
    retry: {
      label: "Relancer la lecture distante",
      disabled: autoDisabled || busy,
      allowed: decision.allowed === true,
      reason: decision.reason,
      reasonLabel: decision.allowed === true
        ? "La relance native est disponible sans écriture métier."
        : retryReasonLabel(decision.reason)
    },
    statusMessage
  };
}
