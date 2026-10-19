// Pure, DOM-free Cloud settings presentation helpers (TS-044).
//
// The module derives the contextual onboarding step, the synchronization page
// section visibility and the overview access-link visibility from signals that
// already exist elsewhere. It never reads or writes IndexedDB, localStorage or
// the network, and it never starts an activation, an OTP, a pull or a purge.
import {
  ACTIVATION_STAGE,
  ACTIVATION_STATUS,
  FIRST_SYNC,
  TARGET_CLASSIFICATION
} from "./cloud-activation.js";
import { AUTH_STATUS } from "./authentication.js";
import {
  CONNECTION_STATE,
  INITIAL_PULL,
  LOCAL_WRITE_STATE
} from "./sync-diagnostics.js";

export const ONBOARDING_STEP = Object.freeze({
  LOCAL: "local",
  CONFIGURATION: "configuration",
  ACTIVATION: "activation",
  OTP: "otp",
  FIRST_PULL: "first-pull",
  REVIEW: "review",
  TRANSFER: "transfer",
  ACTIVE: "active",
  ERROR: "error"
});

export const SYNC_SECTION = Object.freeze({
  ONBOARDING: "onboarding",
  CONFIGURATION: "configuration",
  ACTIVATION: "activation",
  CONNECTION: "connection",
  WORKSPACES: "workspaces",
  DIAGNOSTIC: "diagnostic"
});

const STAGE_VALUES = new Set(Object.values(ACTIVATION_STAGE));
const STATUS_VALUES = new Set(Object.values(ACTIVATION_STATUS));
const FIRST_SYNC_VALUES = new Set(Object.values(FIRST_SYNC));

const STEP_DEFINITIONS = Object.freeze({
  [ONBOARDING_STEP.LOCAL]: Object.freeze({
    title: "Mode local autonome",
    message: "Aucune URL Dexie Cloud n'est configurée. Vos données restent lisibles et exportables dans ce navigateur.",
    nextAction: "Configurer une URL HTTPS pour préparer une synchronisation volontaire.",
    section: SYNC_SECTION.CONFIGURATION
  }),
  [ONBOARDING_STEP.CONFIGURATION]: Object.freeze({
    title: "Configuration HTTPS",
    message: "Une URL Dexie Cloud valide est enregistrée. Aucune donnée métier n'a encore été copiée.",
    nextAction: "Démarrer explicitement l'activation opt-in pour ouvrir la connexion.",
    section: SYNC_SECTION.ACTIVATION
  }),
  [ONBOARDING_STEP.ACTIVATION]: Object.freeze({
    title: "Activation opt-in",
    message: "L'activation a été demandée explicitement. La source locale reste intacte pendant la préparation.",
    nextAction: "Se connecter avec l'OTP natif ; cette connexion ne vaut pas consentement au transfert.",
    section: SYNC_SECTION.CONNECTION
  }),
  [ONBOARDING_STEP.OTP]: Object.freeze({
    title: "Connexion OTP",
    message: "La session Dexie Cloud n'est pas encore authentifiée.",
    nextAction: "Saisir le code reçu par email, puis attendre la première lecture distante.",
    section: SYNC_SECTION.CONNECTION
  }),
  [ONBOARDING_STEP.FIRST_PULL]: Object.freeze({
    title: "Première lecture distante",
    message: "La session est authentifiée mais aucune lecture distante attestée n'est encore disponible.",
    nextAction: "Laisser la lecture native aboutir ; une cible non vérifiée n'est jamais considérée comme vide.",
    section: SYNC_SECTION.ACTIVATION
  }),
  [ONBOARDING_STEP.REVIEW]: Object.freeze({
    title: "Revue et consentement",
    message: "Un plan de rapprochement est affiché avec sa destination et ses compteurs.",
    nextAction: "Examiner le plan puis cocher explicitement le consentement avant toute confirmation.",
    section: SYNC_SECTION.ACTIVATION
  }),
  [ONBOARDING_STEP.TRANSFER]: Object.freeze({
    title: "Transfert",
    message: "Le consentement explicite a été donné ou un transfert local est en attente.",
    nextAction: "Suivre la synchronisation native sans conclure à un succès distant non attesté.",
    section: SYNC_SECTION.ACTIVATION
  }),
  [ONBOARDING_STEP.ACTIVE]: Object.freeze({
    title: "Synchronisation active",
    message: "L'activation et la première synchronisation sont attestées sur cet appareil.",
    nextAction: "Consulter le diagnostic et les espaces de travail pour les opérations courantes.",
    section: SYNC_SECTION.WORKSPACES
  }),
  [ONBOARDING_STEP.ERROR]: Object.freeze({
    title: "Erreur récupérable",
    message: "L'état courant est dégradé, hors ligne ou non attesté. La source locale reste intacte.",
    nextAction: "Consulter le diagnostic, puis relancer ou réessayer uniquement par une action explicite.",
    section: SYNC_SECTION.DIAGNOSTIC
  })
});

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sourceInput(input) {
  return isPlainObject(input) ? input : {};
}

function normalizeStage(value) {
  return STAGE_VALUES.has(value) ? value : null;
}

function normalizeStatus(value) {
  return STATUS_VALUES.has(value) ? value : null;
}

function normalizeFirstSync(value) {
  return FIRST_SYNC_VALUES.has(value) ? value : null;
}

function isAuthenticated(source) {
  if (source.authenticated === true) return true;
  return source.authStatus === AUTH_STATUS.AUTHENTICATED;
}

function activationStarted(stage, status) {
  if (stage) {
    return stage !== ACTIVATION_STAGE.LOCAL && stage !== ACTIVATION_STAGE.CANCELLED;
  }
  return status === ACTIVATION_STATUS.ACTIVATING;
}

function isActive(source, stage, status, firstSync) {
  return stage === ACTIVATION_STAGE.ACTIVE ||
    status === ACTIVATION_STATUS.ACTIVE ||
    firstSync === FIRST_SYNC.REMOTE_COMPLETE;
}

function isDegraded(source, stage, firstSync, diagnostic) {
  if (source.online === false) return true;
  if (stage === ACTIVATION_STAGE.FAILED) return true;
  if (firstSync === FIRST_SYNC.ERROR) return true;
  if (source.classification === TARGET_CLASSIFICATION.UNAVAILABLE ||
      source.classification === TARGET_CLASSIFICATION.IDENTITY_MISMATCH) {
    return true;
  }
  if (!diagnostic) return false;
  if (diagnostic.online === false) return true;
  if (diagnostic.connection === CONNECTION_STATE.OFFLINE ||
      diagnostic.connection === CONNECTION_STATE.ERROR) {
    return true;
  }
  if (diagnostic.localWrites === LOCAL_WRITE_STATE.ERROR) return true;
  return Array.isArray(diagnostic.errors) && diagnostic.errors.length > 0;
}

function isTransferInProgress(firstSync) {
  return firstSync === FIRST_SYNC.LOCAL_WRITTEN ||
    firstSync === FIRST_SYNC.PENDING ||
    firstSync === FIRST_SYNC.INDETERMINATE;
}

export function onboardingReachedSteps(input = {}) {
  const source = sourceInput(input);
  const stage = normalizeStage(source.activationStage);
  const status = normalizeStatus(source.activationStatus);
  const firstSync = normalizeFirstSync(source.firstSync);
  const authenticated = isAuthenticated(source);
  const remoteAttested = source.remoteAttested === true ||
    (isPlainObject(source.diagnostic) && source.diagnostic.initialPull === INITIAL_PULL.COMPLETE);
  const planReady = source.planReady === true;
  const consentGiven = source.consentGiven === true;

  const steps = [ONBOARDING_STEP.LOCAL];
  if (source.configured !== true) return steps;
  steps.push(ONBOARDING_STEP.CONFIGURATION);
  if (activationStarted(stage, status)) steps.push(ONBOARDING_STEP.ACTIVATION);
  if (authenticated) steps.push(ONBOARDING_STEP.OTP);
  if (remoteAttested) steps.push(ONBOARDING_STEP.FIRST_PULL);
  if (planReady) steps.push(ONBOARDING_STEP.REVIEW);
  if (consentGiven || stage === ACTIVATION_STAGE.TRANSFER_PENDING || isTransferInProgress(firstSync)) {
    steps.push(ONBOARDING_STEP.TRANSFER);
  }
  if (isActive(source, stage, status, firstSync)) steps.push(ONBOARDING_STEP.ACTIVE);
  return steps;
}

export function resolveOnboardingStep(input = {}) {
  const source = sourceInput(input);
  if (source.configured !== true) return ONBOARDING_STEP.LOCAL;

  const stage = normalizeStage(source.activationStage);
  const status = normalizeStatus(source.activationStatus);
  const firstSync = normalizeFirstSync(source.firstSync);
  const diagnostic = isPlainObject(source.diagnostic) ? source.diagnostic : null;
  const authenticated = isAuthenticated(source);
  const otpPending = source.otpPending === true;
  const remoteAttested = source.remoteAttested === true ||
    (diagnostic && diagnostic.initialPull === INITIAL_PULL.COMPLETE);
  const planReady = source.planReady === true;
  const consentGiven = source.consentGiven === true;

  if (isDegraded(source, stage, firstSync, diagnostic)) return ONBOARDING_STEP.ERROR;
  if (isActive(source, stage, status, firstSync)) return ONBOARDING_STEP.ACTIVE;
  if (consentGiven || stage === ACTIVATION_STAGE.TRANSFER_PENDING || isTransferInProgress(firstSync)) {
    return ONBOARDING_STEP.TRANSFER;
  }
  if (planReady) return ONBOARDING_STEP.REVIEW;
  if (authenticated || remoteAttested) return ONBOARDING_STEP.FIRST_PULL;
  if (otpPending || stage === ACTIVATION_STAGE.CONNECTING) return ONBOARDING_STEP.OTP;
  if (stage === ACTIVATION_STAGE.PREPARING) return ONBOARDING_STEP.ACTIVATION;
  if (stage === ACTIVATION_STAGE.DISCOVERING) return ONBOARDING_STEP.OTP;
  return ONBOARDING_STEP.CONFIGURATION;
}

export function onboardingView(input = {}) {
  const source = sourceInput(input);
  const step = resolveOnboardingStep(source);
  const definition = STEP_DEFINITIONS[step];
  const reached = Object.freeze(onboardingReachedSteps(source));
  return Object.freeze({
    step,
    title: definition.title,
    message: definition.message,
    nextAction: definition.nextAction,
    section: definition.section,
    isReached: reached.includes(step),
    reached
  });
}

export function syncSectionVisibility(input = {}) {
  const source = sourceInput(input);
  const authenticated = isAuthenticated(source);
  const configured = source.configured === true;
  const view = onboardingView(source);
  return Object.freeze({
    onboarding: true,
    configuration: configured !== true,
    activation: source.activationVisible !== false,
    connection: configured && !authenticated,
    workspaces: true,
    diagnostic: true,
    current: view.section
  });
}

export function overviewAccessLinkVisible(input = {}) {
  const source = sourceInput(input);
  if (source.configured === true) {
    return source.needsAttention === true || source.activationNeedsResume === true;
  }
  return source.localError === true;
}

export function localDiagnosticError(diagnostic) {
  if (!isPlainObject(diagnostic)) return false;
  if (diagnostic.configured === true) return false;
  if (diagnostic.localWrites === LOCAL_WRITE_STATE.ERROR) return true;
  return Array.isArray(diagnostic.errors) && diagnostic.errors.length > 0;
}
