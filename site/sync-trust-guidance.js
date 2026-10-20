// Pure, DOM-free trust and guidance model for the synchronization page (TS-047).
//
// It turns already-normalized diagnostics into plain-language location,
// evidence, state explanation and intent checklists. It never reads or writes
// browser storage, IndexedDB or the network: any storage handle is injected by
// the caller. Nothing here triggers a Cloud operation, an OTP, a pull or a purge.
import {
  BINDING_DIAGNOSTIC_STATE,
  CONNECTION_STATE,
  DIAGNOSTIC_ERROR,
  INITIAL_PULL,
  LOCAL_WRITE_STATE,
  REMOTE_EVIDENCE,
  SESSION_STATE,
  SYNC_PHASE,
  WORKSPACE_DIAGNOSTIC_TYPE
} from "./sync-diagnostics.js";

export const SYNC_OBSERVATION_STORAGE_KEY = "threadstep.sync-observation.v1";
export const SYNC_OBSERVATION_VERSION = 1;

export const TRUST_LABELS = Object.freeze({
  LOCAL: "Local uniquement, enregistré sur cet appareil",
  SYNCHRONIZED: "Copie locale IndexedDB reliée à Dexie Cloud",
  MASKED: "Données Cloud temporairement masquées, non présumées perdues",
  DATE_UNAVAILABLE: "Date non disponible",
  OTHER_DEVICE: "Vérification sur un autre appareil : non vérifiée",
  LOCAL_SAVE: "Modifications enregistrées sur cet appareil",
  PENDING: "Modifications en attente d'envoi",
  UNKNOWN_UPLOAD: "État d'envoi inconnu",
  CLOUD_OBSERVED: "Synchronisation Cloud observée sur cet appareil",
  CLOUD_NOT_OBSERVED: "Synchronisation Cloud non observée",
  OBSERVATION_SOURCE: "Événement Cloud observé sur cet appareil",
  OBSERVATION_SCOPE:
    "Cette observation ne prouve ni l'intégralité de la copie distante ni la convergence d'un autre appareil."
});

export const TRUST_STATE = Object.freeze({
  NOT_CONFIGURED: "not-configured",
  LOCAL_EMPTY: "local-empty",
  STORAGE_ERROR: "storage-error",
  PERMISSION: "permission",
  SESSION: "session",
  NETWORK_ERROR: "network-error",
  OFFLINE: "offline",
  INITIAL_PULL: "initial-pull",
  SYNC_ERROR: "sync-error",
  PENDING: "pending",
  OTP_REQUIRED: "otp-required",
  ACTIVATION: "activation",
  UNVERIFIED: "unverified",
  MISMATCH: "mismatch",
  DESTINATION_MISMATCH: "destination-mismatch",
  HISTORICAL_CACHE: "historical-cache",
  ISOLATED_RECOVERY: "isolated-recovery",
  OBSERVED: "observed",
  INDETERMINATE: "indeterminate"
});

const MASKED_STATES = new Set([
  TRUST_STATE.UNVERIFIED,
  TRUST_STATE.MISMATCH,
  TRUST_STATE.DESTINATION_MISMATCH,
  TRUST_STATE.HISTORICAL_CACHE
]);

const LOCAL_ERROR_CATEGORIES = new Set([
  DIAGNOSTIC_ERROR.STORAGE,
  DIAGNOSTIC_ERROR.READ
]);

const AUTH_ERROR_CATEGORIES = new Set([
  DIAGNOSTIC_ERROR.PERMISSION,
  DIAGNOSTIC_ERROR.ORIGIN,
  DIAGNOSTIC_ERROR.SESSION
]);

const BLOCKING_BINDING = new Set([
  BINDING_DIAGNOSTIC_STATE.UNVERIFIED,
  BINDING_DIAGNOSTIC_STATE.MISMATCH,
  BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH
]);

const INTENT_LABELS = Object.freeze({
  stayLocal: "Je veux rester en local",
  synchronize: "Je veux synchroniser cet appareil",
  newDevice: "Je veux retrouver mes projets sur un nouvel appareil",
  returnLocal: "Je veux revenir au local",
  fixBlockage: "Je veux corriger un blocage"
});

const SAFE_FORBIDDEN_DEFAULT = Object.freeze([
  "Purger la copie locale avant résolution",
  "Transférer ou fusionner automatiquement des données",
  "Réutiliser un cache lié à un autre compte"
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function errorCategories(diagnostic) {
  const errors = Array.isArray(diagnostic.errors) ? diagnostic.errors : [];
  return new Set(errors.map((entry) => entry && entry.category).filter(Boolean));
}

function onboardingStep(input) {
  const onboarding = isPlainObject(input.onboarding) ? input.onboarding : null;
  if (onboarding && typeof onboarding.step === "string") return onboarding.step;
  return typeof input.onboardingStep === "string" ? input.onboardingStep : null;
}

function bootstrapCause(diagnostic) {
  const bootstrap = isPlainObject(diagnostic.bootstrap) ? diagnostic.bootstrap : null;
  return bootstrap && typeof bootstrap.cause === "string" ? bootstrap.cause : null;
}

function resolveState(input) {
  const diagnostic = isPlainObject(input.diagnostic) ? input.diagnostic : {};
  const categories = errorCategories(diagnostic);
  const binding = diagnostic.binding;
  const configured = diagnostic.configured === true;
  const step = onboardingStep(input);
  const phase = diagnostic.phase;
  const connection = diagnostic.connection;
  const initialPull = diagnostic.initialPull;
  const localWrites = diagnostic.localWrites;
  const cause = bootstrapCause(diagnostic);
  const online = diagnostic.online !== false && connection !== CONNECTION_STATE.OFFLINE;

  if (configured && BLOCKING_BINDING.has(binding)) {
    if (binding === BINDING_DIAGNOSTIC_STATE.MISMATCH) return TRUST_STATE.MISMATCH;
    if (binding === BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH) {
      return TRUST_STATE.DESTINATION_MISMATCH;
    }
    return TRUST_STATE.UNVERIFIED;
  }
  if (configured && cause === "historical-unattested-cache") {
    return TRUST_STATE.HISTORICAL_CACHE;
  }
  if (configured && binding === BINDING_DIAGNOSTIC_STATE.INDETERMINATE &&
    cause === "missing-attestation") {
    return TRUST_STATE.UNVERIFIED;
  }
  if (categories.size > 0 && [...categories].some((c) => LOCAL_ERROR_CATEGORIES.has(c))) {
    return TRUST_STATE.STORAGE_ERROR;
  }
  if (diagnostic.localWrites === LOCAL_WRITE_STATE.ERROR && !configured) {
    return TRUST_STATE.STORAGE_ERROR;
  }
  if (!configured) {
    if (input.localEmpty === true) return TRUST_STATE.LOCAL_EMPTY;
    return TRUST_STATE.NOT_CONFIGURED;
  }
  if ([...categories].some((c) => AUTH_ERROR_CATEGORIES.has(c))) {
    if (categories.has(DIAGNOSTIC_ERROR.PERMISSION)) return TRUST_STATE.PERMISSION;
    if (categories.has(DIAGNOSTIC_ERROR.ORIGIN)) return TRUST_STATE.PERMISSION;
    return TRUST_STATE.SESSION;
  }
  if (categories.has(DIAGNOSTIC_ERROR.NETWORK)) return TRUST_STATE.NETWORK_ERROR;
  if (!online || phase === SYNC_PHASE.OFFLINE) return TRUST_STATE.OFFLINE;
  if (initialPull === INITIAL_PULL.PENDING || initialPull === INITIAL_PULL.IN_PROGRESS) {
    return TRUST_STATE.INITIAL_PULL;
  }
  if (initialPull === INITIAL_PULL.FAILED) {
    return categories.size > 0 ? TRUST_STATE.SYNC_ERROR : TRUST_STATE.INITIAL_PULL;
  }
  if (diagnostic.session !== SESSION_STATE.AUTHENTICATED) {
    return step === "otp" ? TRUST_STATE.OTP_REQUIRED : TRUST_STATE.SESSION;
  }
  if (diagnostic.localWrites === LOCAL_WRITE_STATE.PENDING) return TRUST_STATE.PENDING;
  if (diagnostic.localWrites === LOCAL_WRITE_STATE.INDETERMINATE) return TRUST_STATE.PENDING;
  if (step === "activation" || step === "configuration") return TRUST_STATE.ACTIVATION;
  if (categories.size > 0) return TRUST_STATE.SYNC_ERROR;
  if (input.isolatedRecovery === true || cause === "recovered-prior-attestation") {
    return TRUST_STATE.ISOLATED_RECOVERY;
  }
  if (phase === SYNC_PHASE.IN_SYNC &&
    (diagnostic.remoteEvidence && diagnostic.remoteEvidence.state === REMOTE_EVIDENCE.AVAILABLE)) {
    return TRUST_STATE.OBSERVED;
  }
  if (phase === SYNC_PHASE.IN_SYNC && isPlainObject(input.observedSync) &&
    input.observedSync.available === true) {
    return TRUST_STATE.OBSERVED;
  }
  return TRUST_STATE.INDETERMINATE;
}

const STATE_CATALOGUE = Object.freeze({
  [TRUST_STATE.NOT_CONFIGURED]: Object.freeze({
    label: "Synchronisation Cloud non configurée",
    meaning: "Aucune instance Dexie Cloud n'est reliée à cet appareil. Vos projets vivent dans la base IndexedDB locale nommée ci-dessus.",
    accessibleData: "Les projets et tâches de la base locale restent consultables et exportables sur cet appareil.",
    maskedData: "Aucune copie Cloud n'est attendue ni affichée.",
    risk: "Perdre les données du navigateur si aucune sauvegarde ou export n'est conservé.",
    safeAction: "Continuer en local ou configurer volontairement une URL HTTPS, sans transfert automatique.",
    forbiddenActions: Object.freeze([
      "Croire qu'une copie Cloud existe déjà",
      "Lancer une synchronisation implicite"
    ])
  }),
  [TRUST_STATE.LOCAL_EMPTY]: Object.freeze({
    label: "Base locale vide sur cet appareil",
    meaning: "La base IndexedDB locale ne contient aucun projet actuellement.",
    accessibleData: "La base locale nommée ci-dessus reste accessible et peut recevoir de nouveaux projets.",
    maskedData: "L'état de la cible Cloud reste inconnu : cette base vide ne prouve rien du Cloud.",
    risk: "Interpréter à tort cette base locale vide comme une cible Cloud vide.",
    safeAction: "Vérifier l'URL et la session avant toute conclusion, puis consulter le diagnostic technique.",
    forbiddenActions: Object.freeze([
      "Conclure que le Cloud est vide",
      "Purger ou réinitialiser une copie distante"
    ])
  }),
  [TRUST_STATE.STORAGE_ERROR]: Object.freeze({
    label: "Erreur de stockage local",
    meaning: "La lecture ou l'écriture dans IndexedDB est indisponible, saturée ou incomplète.",
    accessibleData: "Les données déjà présentes peuvent rester sur l'appareil, sans garantie de lecture immédiate.",
    maskedData: "L'état exact des données locales et distantes est inconnu tant que le stockage échoue.",
    risk: "Croire à une perte locale ou à une synchronisation réussie alors que le stockage a échoué.",
    safeAction: "Libérer de l'espace, recharger, puis exporter une sauvegarde dès que la lecture fonctionne.",
    forbiddenActions: Object.freeze([
      "Purger la copie locale",
      "Déclarer une perte ou une synchronisation confirmée"
    ])
  }),
  [TRUST_STATE.PERMISSION]: Object.freeze({
    label: "Accès refusé par le service Cloud",
    meaning: "La session ou l'origine n'est pas autorisée à lire cette base distante.",
    accessibleData: "Les données locales restent conservées sur cet appareil.",
    maskedData: "Les données Cloud restent masquées et ne sont pas présumées perdues.",
    risk: "Utiliser un compte ou une origine non autorisés et exposer des données au mauvais espace.",
    safeAction: "Vérifier l'URL et le compte, puis se reconnecter avec l'OTP autorisé.",
    forbiddenActions: Object.freeze([
      "Réutiliser le cache d'un autre compte",
      "Purger avant d'avoir résolu l'accès"
    ])
  }),
  [TRUST_STATE.SESSION]: Object.freeze({
    label: "Session Cloud expirée ou absente",
    meaning: "La synchronisation ne peut pas s'authentifier auprès de Dexie Cloud.",
    accessibleData: "Les modifications déjà enregistrées localement restent sur cet appareil.",
    maskedData: "Les données Cloud sont masquées tant que la session n'est pas rétablie.",
    risk: "Confondre expiration de session et perte de données.",
    safeAction: "Se reconnecter par OTP avec le même compte, sans transfert ni purge.",
    forbiddenActions: Object.freeze([
      "Purger la copie locale",
      "Changer de compte pour contourner le blocage"
    ])
  }),
  [TRUST_STATE.OTP_REQUIRED]: Object.freeze({
    label: "Code OTP requis",
    meaning: "Une connexion Dexie Cloud est en cours et attend le code à usage unique reçu par email.",
    accessibleData: "Les données locales restent lisibles selon la liaison de compte en cours.",
    maskedData: "Les données Cloud ne sont pas encore accessibles sur cet appareil.",
    risk: "Saisir un code dans le mauvais contexte ou croire la connexion terminée.",
    safeAction: "Saisir le code reçu, puis attendre la première lecture distante.",
    forbiddenActions: Object.freeze([
      "Considérer la connexion comme un consentement au transfert",
      "Lancer un pull manuel avant l'authentification"
    ])
  }),
  [TRUST_STATE.ACTIVATION]: Object.freeze({
    label: "Activation Cloud non terminée",
    meaning: "Une URL est configurée mais l'activation opt-in, la revue ou le consentement ne sont pas terminés.",
    accessibleData: "La base locale autonome reste intacte, lisible et exportable.",
    maskedData: "Aucune copie Cloud n'est encore attestée pour cet espace.",
    risk: "Croire que le transfert a eu lieu alors que seul le parcours est commencé.",
    safeAction: "Reprendre explicitement l'activation, lire le plan, puis consentir si nécessaire.",
    forbiddenActions: Object.freeze([
      "Transférer implicitement des enregistrements locaux",
      "Interpréter la connexion OTP comme un consentement"
    ])
  }),
  [TRUST_STATE.INITIAL_PULL]: Object.freeze({
    label: "Première lecture distante en attente",
    meaning: "La session est établie mais la première lecture distante n'est pas encore terminée ou attestée.",
    accessibleData: "Les données locales déjà enregistrées restent sur cet appareil.",
    maskedData: "Le contenu distant n'est pas encore affiché ; il n'est pas considéré comme vide.",
    risk: "Conclure qu'aucune donnée n'existe dans le Cloud pendant l'attente.",
    safeAction: "Attendre la lecture native ou utiliser la relance native proposée si elle est autorisée.",
    forbiddenActions: Object.freeze([
      "Purger ou réinitialiser la cible distante",
      "Importer une sauvegarde en remplacement automatique"
    ])
  }),
  [TRUST_STATE.OFFLINE]: Object.freeze({
    label: "Hors ligne",
    meaning: "Le navigateur n'a pas de réseau : la synchronisation Cloud ne peut pas aboutir pour le moment.",
    accessibleData: "Les modifications enregistrées localement restent sur cet appareil.",
    maskedData: "L'envoi Cloud et l'état distant ne sont pas confirmés.",
    risk: "Croire à une perte de données ou à un envoi réussi alors que le réseau est interrompu.",
    safeAction: "Attendre le retour du réseau ; les écritures locales restent disponibles.",
    forbiddenActions: Object.freeze([
      "Purger la copie locale",
      "Déclarer une synchronisation Cloud réussie"
    ])
  }),
  [TRUST_STATE.PENDING]: Object.freeze({
    label: "Modifications en attente d'envoi",
    meaning: "Des modifications sont enregistrées sur cet appareil mais leur transmission Cloud n'est pas confirmée.",
    accessibleData: "Les modifications en attente restent enregistrées localement.",
    maskedData: "L'état exact de l'envoi Cloud est incertain et ne prouve pas la copie distante.",
    risk: "Éteindre l'appareil en croyant les modifications déjà répliquées.",
    safeAction: "Attendre le réseau et la synchronisation native, puis vérifier la date observée si elle existe.",
    forbiddenActions: Object.freeze([
      "Purger avant l'envoi",
      "Affirmer que tout est sauvegardé dans le Cloud"
    ])
  }),
  [TRUST_STATE.SYNC_ERROR]: Object.freeze({
    label: "Erreur de synchronisation",
    meaning: "Un échec réseau, de permission ou de synchronisation empêche la confirmation de la copie distante.",
    accessibleData: "Les données locales conservées restent sur cet appareil.",
    maskedData: "La copie distante reste inconnue et n'est pas présumée vide.",
    risk: "Interpréter l'erreur comme une perte de données ou comme un envoi réussi.",
    safeAction: "Consulter la catégorie d'erreur et l'action native autorisée, sans purge.",
    forbiddenActions: Object.freeze([
      "Purger en réaction à l'erreur",
      "Exposer un message serveur brut comme diagnostic"
    ])
  }),
  [TRUST_STATE.NETWORK_ERROR]: Object.freeze({
    label: "Erreur réseau vers Dexie Cloud",
    meaning: "Le service Cloud est injoignable momentanément.",
    accessibleData: "Les données locales enregistrées restent sur cet appareil.",
    maskedData: "L'état distant n'est pas disponible et n'est pas présumé vide.",
    risk: "Confondre service injoignable et données Cloud absentes.",
    safeAction: "Attendre le réseau puis relancer la lecture native si elle est proposée.",
    forbiddenActions: Object.freeze([
      "Conclure que le Cloud est vide",
      "Purger la copie locale"
    ])
  }),
  [TRUST_STATE.UNVERIFIED]: Object.freeze({
    label: "Cache local non vérifié",
    meaning: "Ce cache local contient des données qui n'ont pas pu être rattachées au compte courant.",
    accessibleData: "Le cache local est conservé sur cet appareil.",
    maskedData: "Les données métier sont masquées tant que la liaison n'est pas vérifiée.",
    risk: "Réutiliser un cache appartenant à un autre compte ou le purger par erreur.",
    safeAction: "Se connecter avec le compte attendu ou utiliser la récupération isolée explicitement proposée.",
    forbiddenActions: Object.freeze([
      "Purger avant vérification",
      "Transférer ce cache vers un autre compte"
    ])
  }),
  [TRUST_STATE.MISMATCH]: Object.freeze({
    label: "Compte différent de la liaison",
    meaning: "Le compte authentifié ne correspond pas au compte associé à ce cache local.",
    accessibleData: "Le cache local est conservé mais ses données métier restent masquées.",
    maskedData: "Les projets de ce cache ne sont pas affichés pour éviter tout mélange de comptes.",
    risk: "Mélanger deux comptes ou supprimer une copie qui appartient à l'autre compte.",
    safeAction: "Se déconnecter ou revenir au compte lié ; la purge reste une action explicite et confirmée.",
    forbiddenActions: Object.freeze([
      "Lire ou transférer les données de l'autre compte",
      "Purger avant d'avoir choisi explicitement"
    ])
  }),
  [TRUST_STATE.DESTINATION_MISMATCH]: Object.freeze({
    label: "Base distante différente de la liaison",
    meaning: "L'URL ou la base distante active ne correspond plus à la destination attestée pour ce cache.",
    accessibleData: "Le cache local est conservé sur cet appareil.",
    maskedData: "Les données métier restent masquées pour éviter d'écrire dans une mauvaise destination.",
    risk: "Écrire dans une autre instance Cloud ou mélanger deux destinations.",
    safeAction: "Vérifier l'URL configurée et revenir à la destination attestée.",
    forbiddenActions: Object.freeze([
      "Transférer le cache vers la nouvelle destination",
      "Purger avant résolution"
    ])
  }),
  [TRUST_STATE.HISTORICAL_CACHE]: Object.freeze({
    label: "Cache historique conservé",
    meaning: "Un cache antérieur non vérifiable est conservé, sans preuve de liaison au compte courant.",
    accessibleData: "Le cache historique reste physiquement conservé sur cet appareil.",
    maskedData: "Ses données métier restent masquées et ne sont pas présumées perdues.",
    risk: "Adopter automatiquement un cache historique au lieu de le vérifier.",
    safeAction: "Vérifier la liaison ou demander explicitement une récupération isolée.",
    forbiddenActions: Object.freeze([
      "Adopter le cache sans vérification",
      "Purger avant décision explicite"
    ])
  }),
  [TRUST_STATE.ISOLATED_RECOVERY]: Object.freeze({
    label: "Récupération isolée",
    meaning: "Une récupération explicitement demandée utilise une nouvelle base isolée, sans copier le cache historique.",
    accessibleData: "La nouvelle base isolée et l'ancienne copie restent distinctes et accessibles selon leur état.",
    maskedData: "La récupération n'est pas une preuve de propagation vers un autre appareil.",
    risk: "Croire que la récupération prouve la convergence distante ou remplace une sauvegarde.",
    safeAction: "Vérifier la nouvelle base, conserver l'ancienne copie et exporter si nécessaire.",
    forbiddenActions: Object.freeze([
      "Conclure à une propagation Cloud prouvée",
      "Purger l'ancienne copie sans confirmation"
    ])
  }),
  [TRUST_STATE.OBSERVED]: Object.freeze({
    label: "Synchronisation observée sur cet appareil",
    meaning: "Un événement natif de réussite a été observé pour l'espace courant.",
    accessibleData: "Les données locales et la synchronisation observée sont disponibles sur cet appareil.",
    maskedData: "La complétude de la copie distante et la convergence d'un autre appareil restent non vérifiées.",
    risk: "Prendre une observation locale pour une preuve de sauvegarde complète dans le Cloud.",
    safeAction: "Conserver la sauvegarde habituelle et vérifier sur un autre appareil si nécessaire.",
    forbiddenActions: Object.freeze([
      "Affirmer que tout est sauvegardé dans le Cloud",
      "Déduire la présence de toutes les données distantes du seul état in-sync"
    ])
  }),
  [TRUST_STATE.INDETERMINATE]: Object.freeze({
    label: "État indéterminé",
    meaning: "Les signaux disponibles ne permettent pas de conclure sur l'état de synchronisation.",
    accessibleData: "Les données déjà enregistrées localement restent sur cet appareil.",
    maskedData: "L'état distant et l'envoi en attente restent inconnus, sans conclusion de perte.",
    risk: "Inventer une base vide, une perte ou une synchronisation réussie.",
    safeAction: "Consulter le diagnostic technique et attendre un signal natif fiable.",
    forbiddenActions: Object.freeze([
      "Purger sans preuve",
      "Déclarer une cible Cloud vide"
    ])
  })
});

function normalizeObservedSync(value) {
  const source = isPlainObject(value) ? value : {};
  if (source.available !== true) {
    return Object.freeze({
      available: false,
      label: TRUST_LABELS.DATE_UNAVAILABLE,
      dateLabel: null,
      observedAt: null,
      provenance: TRUST_LABELS.OBSERVATION_SOURCE,
      scope: TRUST_LABELS.OBSERVATION_SCOPE
    });
  }
  return Object.freeze({
    available: true,
    label: text(source.label, TRUST_LABELS.DATE_UNAVAILABLE),
    dateLabel: text(source.dateLabel, null),
    observedAt: text(source.observedAt, null),
    provenance: TRUST_LABELS.OBSERVATION_SOURCE,
    scope: TRUST_LABELS.OBSERVATION_SCOPE
  });
}

const MASKED_LOCATION_STATES = new Set([
  ...MASKED_STATES,
  TRUST_STATE.SESSION,
  TRUST_STATE.OTP_REQUIRED,
  TRUST_STATE.PERMISSION,
  TRUST_STATE.STORAGE_ERROR,
  TRUST_STATE.NETWORK_ERROR,
  TRUST_STATE.SYNC_ERROR,
  TRUST_STATE.OFFLINE,
  TRUST_STATE.INITIAL_PULL,
  TRUST_STATE.ACTIVATION
]);

function locationLabel(state, diagnostic, observed) {
  if (diagnostic.configured !== true) return TRUST_LABELS.LOCAL;
  if (MASKED_LOCATION_STATES.has(state)) return TRUST_LABELS.MASKED;
  const remote = isPlainObject(diagnostic.remoteEvidence) ? diagnostic.remoteEvidence : null;
  const remoteAvailable = !!remote && remote.state === REMOTE_EVIDENCE.AVAILABLE;
  if (!remoteAvailable && !(observed && observed.available === true)) {
    return TRUST_LABELS.MASKED;
  }
  return TRUST_LABELS.SYNCHRONIZED;
}

function evidenceLevels(diagnostic, observed, state) {
  const writes = diagnostic.localWrites;
  let local;
  if (writes === LOCAL_WRITE_STATE.LOCAL) local = TRUST_LABELS.LOCAL_SAVE;
  else if (writes === LOCAL_WRITE_STATE.SYNCED) {
    local = TRUST_LABELS.LOCAL_SAVE + " (confiées au flux natif)";
  } else if (writes === LOCAL_WRITE_STATE.PENDING) {
    local = TRUST_LABELS.LOCAL_SAVE + " ; envoi non confirmé";
  } else if (writes === LOCAL_WRITE_STATE.ERROR) local = "Erreur d'écriture locale";
  else if (writes === LOCAL_WRITE_STATE.NOT_APPLICABLE) local = "Sans objet (Cloud non activé)";
  else local = "Aucune modification locale récente identifiée";

  let pending;
  if (writes === LOCAL_WRITE_STATE.PENDING) pending = TRUST_LABELS.PENDING;
  else if (writes === LOCAL_WRITE_STATE.INDETERMINATE) pending = TRUST_LABELS.UNKNOWN_UPLOAD;
  else if (writes === LOCAL_WRITE_STATE.LOCAL) pending = "Envoi Cloud non observé";
  else if (writes === LOCAL_WRITE_STATE.SYNCED) {
    pending = "Aucune attente locale signalée ; la propagation Cloud reste une observation distincte";
  } else if (writes === LOCAL_WRITE_STATE.NOT_APPLICABLE) pending = "Sans objet (Cloud non activé)";
  else pending = "Aucune modification en attente";

  const remote = isPlainObject(diagnostic.remoteEvidence) ? diagnostic.remoteEvidence : null;
  const remoteAvailable = !!remote && remote.state === REMOTE_EVIDENCE.AVAILABLE;
  let cloud;
  if (MASKED_LOCATION_STATES.has(state)) cloud = TRUST_LABELS.CLOUD_NOT_OBSERVED;
  else if (observed.available === true) cloud = TRUST_LABELS.CLOUD_OBSERVED;
  else if (remoteAvailable) {
    cloud = TRUST_LABELS.CLOUD_OBSERVED + " (preuve native de la lecture initiale)";
  } else cloud = TRUST_LABELS.CLOUD_NOT_OBSERVED;

  return Object.freeze({
    local: Object.freeze({ key: "local", label: local }),
    pending: Object.freeze({ key: "pending", label: pending }),
    cloud: Object.freeze({ key: "cloud", label: cloud, scope: TRUST_LABELS.OBSERVATION_SCOPE }),
    otherDevice: Object.freeze({ key: "other-device", label: TRUST_LABELS.OTHER_DEVICE })
  });
}

function isSynchronized(diagnostic) {
  return diagnostic.configured === true;
}

function intent(id, label, available, steps) {
  return Object.freeze({
    id,
    label: INTENT_LABELS[id],
    available,
    steps: Object.freeze(steps.filter((step) => step && typeof step.text === "string"))
  });
}

function intentDescriptors(input, state, diagnostic) {
  const configured = isSynchronized(diagnostic);
  const syncStep = (target, stepText) => ({ text: stepText, control: target });
  const stayLocal = intent("stayLocal", INTENT_LABELS.stayLocal, true, [
    syncStep("sync-trust-location", "Vos données restent dans la base IndexedDB locale nommée ci-dessus."),
    { text: "Exporter ou sauvegarder vos données sans envoi vers le Cloud." },
    !configured ? syncStep("cloud-config-form", "Aucune activation Cloud n'est proposée automatiquement ; la configuration reste volontaire.") : null
  ]);
  const synchronize = intent("synchronize", INTENT_LABELS.synchronize, true,
    configured
      ? [
          syncStep("auth-form", "Vérifier l'URL HTTPS configurée puis suivre l'OTP natif si la session manque."),
          syncStep("cloud-activation-review", "Relire le plan de rapprochement et le consentement avant toute confirmation."),
          syncStep("sync-diagnostic", "Attendre la première lecture distante et consulter le diagnostic technique si besoin.")
        ]
      : [
          syncStep("cloud-config-form", "Configurer explicitement l'URL HTTPS de votre instance Dexie Cloud."),
          syncStep("cloud-activation-start", "Démarrer l'activation opt-in, sans copie automatique."),
          syncStep("auth-form", "Se connecter par OTP puis lire le plan et consentir explicitement."),
          syncStep("cloud-activation-review", "Revue du plan et consentement avant le transfert affiché.")
        ]);
  const newDevice = intent("newDevice", INTENT_LABELS.newDevice, true, [
    syncStep("cloud-config-form", "Ouvrir la même URL Dexie Cloud sur le nouvel appareil."),
    syncStep("auth-form", "S'authentifier avec le même compte par OTP."),
    syncStep("sync-diagnostic", "Attendre la première lecture distante : aucune copie automatique entre appareils n'est prouvée.")
  ]);
  const returnLocal = intent("returnLocal", INTENT_LABELS.returnLocal, true, [
    syncStep("workspace-suspend", "Suspendre Cloud conserve la copie locale et cesse la réplication."),
    syncStep("workspace-logout", "Se déconnecter ferme la session sans supprimer les données."),
    syncStep("workspace-purge", "Purger ne concerne que la seule copie locale identifiée, après sauvegarde et confirmation.")
  ]);
  const fixBlockage = intent("fixBlockage", INTENT_LABELS.fixBlockage, true, [
    { text: "Cause compréhensible : " + STATE_CATALOGUE[state].label + "." },
    { text: "Action sûre : " + STATE_CATALOGUE[state].safeAction },
    { text: "Actions interdites : " + STATE_CATALOGUE[state].forbiddenActions.join(" ; ") + "." },
    state === TRUST_STATE.UNVERIFIED
      ? syncStep("workspace-recover", "Récupération isolée : seule une action explicite peut ouvrir un nouveau cache lié au compte.")
      : null,
    state === TRUST_STATE.MISMATCH || state === TRUST_STATE.DESTINATION_MISMATCH
      ? syncStep("workspace-select", "Choisir explicitement l'espace attendu ou se déconnecter, sans purger avant décision.")
      : null,
    { text: "Consulter le guide de persistance et de synchronisation pour les cas avancés." },
    syncStep("sync-technical-info", "Ouvrir « Informations techniques » pour les cas avancés, sans relance implicite.")
  ]);
  return Object.freeze([stayLocal, synchronize, newDevice, returnLocal, fixBlockage]);
}

export function buildTrustGuidance(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const diagnostic = isPlainObject(source.diagnostic) ? source.diagnostic : {};
  const workspace = isPlainObject(source.workspace)
    ? source.workspace
    : (isPlainObject(diagnostic.workspace) ? diagnostic.workspace : null);
  const observed = normalizeObservedSync(source.observedSync);
  const state = resolveState(source);
  const catalogue = STATE_CATALOGUE[state] || STATE_CATALOGUE[TRUST_STATE.INDETERMINATE];
  const databaseName = text(
    workspace && workspace.effectiveBase,
    text(diagnostic.base && diagnostic.base.effectiveBase, "indisponible")
  );
  const synchronized = workspace
    ? workspace.type === WORKSPACE_DIAGNOSTIC_TYPE.SYNCHRONIZED
    : diagnostic.configured === true;
  const destinationUrl = synchronized
    ? text(source.url, text(workspace && workspace.url, text(diagnostic.base && diagnostic.base.url, null)))
    : null;
  const remoteDbId = synchronized
    ? text(source.remoteDbId,
      text(workspace && workspace.remoteDbId, text(diagnostic.base && diagnostic.base.remoteDbId, null)))
    : null;
  return Object.freeze({
    state: Object.freeze({
      key: state,
      label: catalogue.label,
      meaning: catalogue.meaning,
      accessibleData: catalogue.accessibleData,
      maskedData: catalogue.maskedData,
      risk: catalogue.risk,
      safeAction: catalogue.safeAction,
      forbiddenActions: catalogue.forbiddenActions
    }),
    mode: synchronized ? "synchronized" : "local",
    locationLabel: locationLabel(state, diagnostic, observed),
    databaseName,
    destination: synchronized
      ? Object.freeze({ url: destinationUrl, remoteDbId })
      : null,
    sessionLabel: text(diagnostic.sessionLabel, sessionText(diagnostic.session)),
    connectionLabel: text(diagnostic.connectionLabel, connectionText(diagnostic.connection)),
    phaseLabel: text(diagnostic.phaseLabel, phaseText(diagnostic.phase)),
    pendingLabel: evidenceLevels(diagnostic, observed, state).pending.label,
    evidence: evidenceLevels(diagnostic, observed, state),
    observation: observed,
    cloudEvidence: Object.freeze({
      observed: observed.available === true ||
        !!(diagnostic.remoteEvidence && diagnostic.remoteEvidence.state === REMOTE_EVIDENCE.AVAILABLE),
      inSync: diagnostic.phase === SYNC_PHASE.IN_SYNC
    }),
    intents: intentDescriptors(source, state, diagnostic)
  });
}

function sessionText(value) {
  switch (value) {
    case SESSION_STATE.AUTHENTICATED: return "Session authentifiée";
    case SESSION_STATE.LOADING: return "Session en cours de restauration";
    case SESSION_STATE.EXPIRED: return "Session expirée";
    case SESSION_STATE.REFUSED: return "Session refusée par le service";
    case SESSION_STATE.SIGNED_OUT: return "Aucune session";
    default: return "Session indéterminée";
  }
}

function connectionText(value) {
  switch (value) {
    case CONNECTION_STATE.NOT_CONFIGURED: return "Synchronisation Cloud non activée";
    case CONNECTION_STATE.CONNECTED: return "Connecté";
    case CONNECTION_STATE.CONNECTING: return "Connexion en cours";
    case CONNECTION_STATE.DISCONNECTED: return "Déconnecté";
    case CONNECTION_STATE.OFFLINE: return "Hors ligne";
    case CONNECTION_STATE.ERROR: return "Erreur de connexion";
    default: return "Connexion indéterminée";
  }
}

function phaseText(value) {
  switch (value) {
    case SYNC_PHASE.IN_SYNC: return "Synchronisé";
    case SYNC_PHASE.PULLING: return "Lecture distante en cours";
    case SYNC_PHASE.PUSHING: return "Envoi local en cours";
    case SYNC_PHASE.OFFLINE: return "Synchronisation hors ligne";
    case SYNC_PHASE.ERROR: return "Erreur de synchronisation";
    case SYNC_PHASE.INITIAL: return "Synchronisation initiale";
    case SYNC_PHASE.NOT_IN_SYNC: return "Pas encore synchronisé";
    default: return "Phase indéterminée";
  }
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function observedContext(input) {
  const source = isPlainObject(input) ? input : {};
  const event = isPlainObject(source.event) ? source.event : null;
  const current = isPlainObject(source.current) ? source.current : null;
  const context = current || source;
  const workspace = isPlainObject(source.workspace)
    ? source.workspace
    : (isPlainObject(context.workspace) ? context.workspace : null);
  const eventContext = event || source.eventContext || source;
  const nativePhase = isPlainObject(context.syncState) && typeof context.syncState.phase === "string"
    ? context.syncState.phase
    : null;
  return {
    eventReceived: source.eventReceived === true || source.event === "sync-complete" ||
      !!(event && event.type === "sync-complete"),
    authenticated: context.session === SESSION_STATE.AUTHENTICATED ||
      context.authenticated === true ||
      !!(isPlainObject(context.user) && context.user.isLoggedIn === true),
    binding: context.binding || (workspace && workspace.binding),
    url: nonEmpty(context.url) || nonEmpty(workspace && workspace.url),
    databaseName: nonEmpty(context.databaseName) ||
      nonEmpty(workspace && workspace.effectiveBase),
    remoteDbId: nonEmpty(context.remoteDbId) || nonEmpty(workspace && workspace.remoteDbId),
    userDigest: nonEmpty(context.userDigest) || nonEmpty(workspace && workspace.userDigest),
    eventUrl: nonEmpty(source.eventUrl) || nonEmpty(eventContext.url),
    eventDatabaseName: nonEmpty(source.eventDatabaseName) || nonEmpty(eventContext.databaseName),
    eventRemoteDbId: nonEmpty(source.eventRemoteDbId) || nonEmpty(eventContext.remoteDbId),
    eventUserDigest: nonEmpty(source.eventUserDigest) || nonEmpty(eventContext.userDigest),
    phase: context.phase || nativePhase,
    persisted: isPlainObject(context.persistedSyncState)
      ? context.persistedSyncState
      : (isPlainObject(source.persistedSyncState) ? source.persistedSyncState : null)
  };
}

export function shouldRecordSyncObservation(input = {}) {
  const context = observedContext(input);
  if (context.eventReceived !== true) return false;
  if (context.authenticated !== true) return false;
  if (context.binding !== BINDING_DIAGNOSTIC_STATE.BOUND) return false;
  if (!context.url || !context.databaseName || !context.remoteDbId || !context.userDigest) {
    return false;
  }
  if (context.eventUrl && context.eventUrl !== context.url) return false;
  if (context.eventDatabaseName && context.eventDatabaseName !== context.databaseName) return false;
  if (context.eventRemoteDbId && context.eventRemoteDbId !== context.remoteDbId) return false;
  if (context.eventUserDigest && context.eventUserDigest !== context.userDigest) return false;
  if (context.phase !== SYNC_PHASE.IN_SYNC) return false;
  const persisted = context.persisted;
  if (!persisted || persisted.initiallySynced !== true) return false;
  if (persisted.serverRevision === undefined || persisted.serverRevision === null) return false;
  return true;
}

export function buildSyncObservationRecord(input = {}, now = Date.now()) {
  if (!shouldRecordSyncObservation(input)) return null;
  const context = observedContext(input);
  const instant = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  return Object.freeze({
    version: SYNC_OBSERVATION_VERSION,
    url: context.url,
    databaseName: context.databaseName,
    remoteDbId: context.remoteDbId,
    userDigest: context.userDigest,
    observedAt: new Date(instant).toISOString(),
    source: "sync-complete"
  });
}

export function readSyncObservation(storage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  let raw;
  try {
    raw = storage.getItem(SYNC_OBSERVATION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed) || parsed.version !== SYNC_OBSERVATION_VERSION) return null;
  if (!nonEmpty(parsed.url) || !nonEmpty(parsed.databaseName) ||
    !nonEmpty(parsed.remoteDbId) || !nonEmpty(parsed.userDigest) ||
    !nonEmpty(parsed.observedAt) || !nonEmpty(parsed.source)) {
    return null;
  }
  return Object.freeze({
    version: SYNC_OBSERVATION_VERSION,
    url: parsed.url,
    databaseName: parsed.databaseName,
    remoteDbId: parsed.remoteDbId,
    userDigest: parsed.userDigest,
    observedAt: parsed.observedAt,
    source: parsed.source
  });
}

export function writeSyncObservation(storage, record) {
  if (!storage || typeof storage.setItem !== "function") return { ok: false, reason: "unavailable" };
  if (!isPlainObject(record) || record.version !== SYNC_OBSERVATION_VERSION) {
    return { ok: false, reason: "invalid" };
  }
  try {
    storage.setItem(SYNC_OBSERVATION_STORAGE_KEY, JSON.stringify(record));
    return { ok: true, reason: null };
  } catch {
    return { ok: false, reason: "write-failed" };
  }
}

function formatObservedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return iso.slice(0, 10) + " à " + iso.slice(11, 16) + " UTC";
}

export function resolveObservedSync(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const unavailable = Object.freeze({
    available: false,
    label: TRUST_LABELS.DATE_UNAVAILABLE,
    dateLabel: null,
    observedAt: null,
    provenance: TRUST_LABELS.OBSERVATION_SOURCE,
    scope: TRUST_LABELS.OBSERVATION_SCOPE
  });
  const record = isPlainObject(source.observation)
    ? source.observation
    : readSyncObservation(source.storage);
  if (!isPlainObject(record) || record.version !== SYNC_OBSERVATION_VERSION) return unavailable;
  const workspace = isPlainObject(source.workspace) ? source.workspace : null;
  const binding = source.binding || (workspace && workspace.binding);
  if (binding !== BINDING_DIAGNOSTIC_STATE.BOUND) return unavailable;
  const url = nonEmpty(source.url) || nonEmpty(workspace && workspace.url);
  const databaseName = nonEmpty(source.databaseName) ||
    nonEmpty(workspace && workspace.effectiveBase);
  const remoteDbId = nonEmpty(source.remoteDbId) || nonEmpty(workspace && workspace.remoteDbId);
  const userDigest = nonEmpty(source.userDigest) || nonEmpty(workspace && workspace.userDigest);
  if (!url || !databaseName || !remoteDbId || !userDigest) return unavailable;
  if (record.url !== url) return unavailable;
  if (record.databaseName !== databaseName) return unavailable;
  if (record.remoteDbId !== remoteDbId) return unavailable;
  if (record.userDigest !== userDigest) return unavailable;
  const dateLabel = formatObservedAt(record.observedAt);
  if (!dateLabel) return unavailable;
  return Object.freeze({
    available: true,
    label: "Dernière synchronisation observée sur cet appareil le " + dateLabel,
    dateLabel,
    observedAt: record.observedAt,
    provenance: TRUST_LABELS.OBSERVATION_SOURCE,
    scope: TRUST_LABELS.OBSERVATION_SCOPE
  });
}
