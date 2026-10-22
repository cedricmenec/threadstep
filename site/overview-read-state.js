// Pure presentation model for the "Mes projets" overview.
// It receives already-observed session, binding, read and timing signals and
// never reads the DOM, storage, network or native synchronization state.
import {
  BINDING_DIAGNOSTIC_STATE,
  LOCAL_WRITE_STATE,
  SESSION_STATE
} from "./sync-diagnostics.js";

export const OVERVIEW_PRESENTATION_STATE = Object.freeze({
  INITIALIZING: "initializing",
  AWAITING_READ: "awaiting-read",
  AVAILABLE: "available",
  ACTION_REQUIRED: "action-required"
});

export const OVERVIEW_LOADER_DELAY_MS = 250;
export const OVERVIEW_DURABLE_WAIT_MS = 8000;

export const OVERVIEW_LOADER_TEXT = "Chargement de vos projets…";

export const OVERVIEW_ACTION_REASONS = Object.freeze({
  READ_ERROR: "read-error",
  WRITE_ERROR: "write-error",
  SESSION: "session",
  SIGNED_OUT: "signed-out",
  BINDING: "binding",
  DURABLE_WAIT: "durable-wait"
});

const ACTION_SUMMARIES = Object.freeze({
  [OVERVIEW_ACTION_REASONS.READ_ERROR]:
    "Lecture de vos projets interrompue. Ouvrez Paramètres > Synchronisation pour vérifier la lecture et la prochaine action sûre.",
  [OVERVIEW_ACTION_REASONS.WRITE_ERROR]:
    "Enregistrement local interrompu. Ouvrez Paramètres > Synchronisation avant de continuer.",
  [OVERVIEW_ACTION_REASONS.SESSION]:
    "Votre session doit être reconnectée. Ouvrez Paramètres > Synchronisation pour reprendre une session sûre.",
  [OVERVIEW_ACTION_REASONS.SIGNED_OUT]:
    "Aucune session active. Ouvrez Paramètres > Synchronisation pour vous connecter.",
  [OVERVIEW_ACTION_REASONS.BINDING]:
    "La liaison de compte doit être vérifiée. Consultez Paramètres > Synchronisation ; aucune donnée n'est affichée sans vérification.",
  [OVERVIEW_ACTION_REASONS.DURABLE_WAIT]:
    "Le chargement de vos projets se prolonge. Consultez Paramètres > Synchronisation pour vérifier la lecture en cours."
});

const SESSION_VALUES = new Set(Object.values(SESSION_STATE));
const BINDING_VALUES = new Set(Object.values(BINDING_DIAGNOSTIC_STATE));
const BLOCKED_BINDINGS = new Set([
  BINDING_DIAGNOSTIC_STATE.UNVERIFIED,
  BINDING_DIAGNOSTIC_STATE.MISMATCH,
  BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH
]);
const AUTHORIZED_BINDINGS = new Set([
  BINDING_DIAGNOSTIC_STATE.BOUND,
  BINDING_DIAGNOSTIC_STATE.UNBOUND
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeElapsed(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function buildOverviewReadPresentation(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const configured = source.configured === true;
  const session = SESSION_VALUES.has(source.session)
    ? source.session
    : SESSION_STATE.INDETERMINATE;
  const binding = BINDING_VALUES.has(source.binding)
    ? source.binding
    : BINDING_DIAGNOSTIC_STATE.INDETERMINATE;
  const documentLoaded = source.documentLoaded === true;
  const readError = source.readError === true;
  const writeError = source.writeError === true ||
    source.localWrites === LOCAL_WRITE_STATE.ERROR;
  const baseMismatch = configured && source.baseMismatch === true;
  const elapsedMs = safeElapsed(source.elapsedMs);
  const durableWait = elapsedMs >= OVERVIEW_DURABLE_WAIT_MS;
  const blockedBinding = configured && BLOCKED_BINDINGS.has(binding);
  const authorized = !configured ||
    (session === SESSION_STATE.AUTHENTICATED && AUTHORIZED_BINDINGS.has(binding));

  let state = OVERVIEW_PRESENTATION_STATE.INITIALIZING;
  let reason = null;

  if (readError) {
    state = OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
    reason = OVERVIEW_ACTION_REASONS.READ_ERROR;
  } else if (writeError) {
    state = OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
    reason = OVERVIEW_ACTION_REASONS.WRITE_ERROR;
  } else if (baseMismatch || blockedBinding) {
    state = OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
    reason = OVERVIEW_ACTION_REASONS.BINDING;
  } else if (configured &&
    (session === SESSION_STATE.EXPIRED || session === SESSION_STATE.REFUSED)) {
    state = OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
    reason = OVERVIEW_ACTION_REASONS.SESSION;
  } else if (configured && session === SESSION_STATE.SIGNED_OUT) {
    state = OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
    reason = OVERVIEW_ACTION_REASONS.SIGNED_OUT;
  } else if (documentLoaded && authorized) {
    state = OVERVIEW_PRESENTATION_STATE.AVAILABLE;
  } else if (authorized) {
    state = durableWait
      ? OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED
      : OVERVIEW_PRESENTATION_STATE.AWAITING_READ;
    if (durableWait) reason = OVERVIEW_ACTION_REASONS.DURABLE_WAIT;
  } else if (durableWait) {
    state = OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
    reason = OVERVIEW_ACTION_REASONS.DURABLE_WAIT;
  }

  const actionRequired = state === OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED;
  const loaderVisible = state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ &&
    elapsedMs >= OVERVIEW_LOADER_DELAY_MS;
  const summaryText = actionRequired ? ACTION_SUMMARIES[reason] : "";
  const announcementState = loaderVisible
    ? "loader"
    : actionRequired
      ? "action:" + reason
      : state;

  return {
    state,
    reason,
    actionRequired,
    loaderVisible,
    summaryVisible: actionRequired,
    summaryText,
    summaryKey: actionRequired ? reason + ":" + summaryText : "",
    announcementKey: announcementState,
    projectsAvailable: authorized && documentLoaded && !baseMismatch && !blockedBinding,
    authorized,
    elapsedMs
  };
}

export function overviewLoaderText() {
  return OVERVIEW_LOADER_TEXT;
}
