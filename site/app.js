import { STORAGE_KEY, RESUME_KEY, PRIORITIES, emptyDocument, newSubject, newItem, subjectRoute, parseRoute, findSubject, renameSubject, visibleItems, overviewPreview, isWithinOverviewPreview, substepView, substepToggleLabel, toggleExpandedParent, substepAncestorId, isViewEntry, pendingCount, totalTaskCount, totalTaskCountLabel, parseDocument, moveSubject, updateItem, setItemPriority, reorderWithinPriority, moveWithinPriority, canMoveWithinPriority, canReorderWithinPriority, itemMenuCommands, promoteItemToTopLevel, nextActionSuggestion, suggestionReason, parseResumePreference, serializeResumePreference, resumeView, planRemoval, restoreRemoval, removalContainsItem, restorableTrackingRef } from "./core.js";
import { readCloudConfig, writeCloudConfig, validateCloudUrl, shouldOpenSyncedDatabase, cloudConfigureOptions, dexieSchema, openLocalDatabase } from "./dexie-foundation.js";
import { documentToRecords, recordsToDocument, diffRecords, emptyRecords, compatibilityGuard, isLocalError, createDexieStore } from "./persistence.js";
import { detectHistoricalDocument } from "./migration.js";
import {
  CATEGORY,
  RECONCILIATION_STATUS,
  RESOLUTION,
  buildReconciliationView,
  describeAttestationReason,
  evaluateSyncAttestation,
  initialReconciliationStatus,
  planReconciliation,
  reduceReconciliationStatus,
  runReconciliation,
  withAttestedTarget
} from "./migration-reconciliation.js";
import { AUTH_STATUS, authMessage, canAccessBusiness, classifyPermissionFailure, createAuthController, signInMethods } from "./authentication.js";
import { availableLocalBackup } from "./local-recovery.js";
import { LOCAL_MIGRATION_STATUS, detectLocalSource, isLocalCompletion, planLocalConversion, readLocalProvenance, runLocalConversion, writeLocalProvenance } from "./local-migration.js";
import { readSyncedRecords } from "./synced-records.js";
import { Dexie, dexieCloud } from "./vendor/dexie-cloud.mjs";

const subjectsEl = document.querySelector("#subjects");
const counterEl = document.querySelector("#counter");
const statusEl = document.querySelector("#status");
const subjectForm = document.querySelector("#subject-form");
const hideCompletedEl = document.querySelector("#hide-completed");
const reorderNoteEl = document.querySelector("#reorder-note");
const focusSuggestEl = document.querySelector("#focus-suggest");
const focusCardEl = document.querySelector("#focus-card");
const resumeCardEl = document.querySelector("#resume-card");
const snackbarEl = document.querySelector("#snackbar");
const cloudConfigEl = document.querySelector("#cloud-config");
const cloudConfigFormEl = document.querySelector("#cloud-config-form");
const cloudUrlEl = document.querySelector("#cloud-url");
const cloudConfigErrorEl = document.querySelector("#cloud-config-error");
const businessToolsEl = document.querySelector("#business-tools");
const dashboardEl = document.querySelector("#dashboard");
const authPanelEl = document.querySelector("#auth-panel");
const authFormEl = document.querySelector("#auth-form");
const authStatusEl = document.querySelector("#auth-status");
const authErrorEl = document.querySelector("#auth-error");
const authEmailFieldEl = document.querySelector("#auth-email-field");
const authOtpFieldEl = document.querySelector("#auth-otp-field");
const authEmailEl = document.querySelector("#auth-email");
const authOtpEl = document.querySelector("#auth-otp");
const authSubmitEl = document.querySelector("#auth-submit");
const authResendEl = document.querySelector("#auth-resend");
const authCancelEl = document.querySelector("#auth-cancel");
const authOfflineEl = document.querySelector("#auth-offline");
const authLocalDataEl = document.querySelector("#auth-local-data");
const authLegacyExportEl = document.querySelector("#auth-export-legacy");
const localPanelEl = document.querySelector("#local-panel");
const localStatusEl = document.querySelector("#local-status");
const localLegacyNoticeEl = document.querySelector("#local-legacy-notice");
const localExportLegacyEl = document.querySelector("#local-export-legacy");
const localConvertLegacyEl = document.querySelector("#local-convert-legacy");
const localConversionEl = document.querySelector("#local-conversion");
const localConversionSourceEl = document.querySelector("#local-conversion-source");
const localConversionTargetEl = document.querySelector("#local-conversion-target");
const localConversionPlanEl = document.querySelector("#local-conversion-plan");
const localConversionFingerprintEl = document.querySelector("#local-conversion-fingerprint");
const localConversionStateEl = document.querySelector("#local-conversion-state");
const localConversionConsentEl = document.querySelector("#local-conversion-consent");
const localConversionConfirmEl = document.querySelector("#local-conversion-confirm");
const localConversionRefuseEl = document.querySelector("#local-conversion-refuse");
const localConversionStatusEl = document.querySelector("#local-conversion-status");
const localStorageErrorEl = document.querySelector("#local-storage-error");
let syncedDatabase = null;
let localDatabase = null;
let authController = null;
let authState = { status: AUTH_STATUS.LOADING, kind: null, message: "" };
let authInteraction = null;
let authSubmitting = false;
let businessStarted = false;
let changesSubscribed = false;
let documentState = emptyDocument();
let editingItemId = null;
let focusItemId = null;
let focusSubjectId = null;
let revealItemId = null;
let suggestionVisible = false;
let hideCompleted = false;
let resumeRef = null;
let documentLoaded = false;
let pendingMoveFocus = null;
let pendingCollapseFocus = null;
let pendingPriorityFocus = null;
let expandedParents = new Set();
let dragState = null;
let route = parseRoute(location.hash);
let renamingSubject = false;
let focusDetailHeading = false;
let focusOpenSubjectId = null;
let focusRenameControl = false;
let openMenuId = null;
let pendingMenuFocus = null;

const CHANGE_CHANNEL = "threadstep.changes.v1";
let businessStore = null;
let changeChannel = null;
let lastRecords = emptyRecords();
let pendingCloudWrites = Promise.resolve();
let cloudWriteBlocked = false;
let cloudReadPending = null;
let localReadPending = null;
let localReadFailed = false;
let localWriteBlocked = false;
let historicalGuard = null;
let localConversionContext = null;

const UNDO_WINDOW_MS = 10000;
let pendingRemoval = null;
let removalTimer = null;
let removalDeadline = 0;

const priorityLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };
function notify(message) { statusEl.textContent = message; }
function requiresAuthentication() {
  return !!syncedDatabase;
}
function businessAllowed() {
  return !requiresAuthentication() || canAccessBusiness(authState);
}
function bootstrapSyncedDatabase() {
  const config = readCloudConfig();
  if (!shouldOpenSyncedDatabase(config)) return null;
  const schema = dexieSchema();
  const options = cloudConfigureOptions(config.databaseUrl);
  const db = new Dexie(schema.name, { addons: [dexieCloud] });
  db.version(schema.version).stores(schema.stores).upgrade(schema.upgrade);
  db.cloud.configure(options);
  return db;
}
// Autonomous workspace: a plain Dexie database with no Cloud addon, no
// configuration, no OTP and no network. It is a distinct stable database so
// local records can never be attached by merely entering a Cloud URL later.
function bootstrapLocalDatabase() {
  return openLocalDatabase(Dexie);
}
function showCloudConfigError(message) {
  if (!cloudConfigErrorEl) return;
  cloudConfigErrorEl.textContent = message;
  cloudConfigErrorEl.hidden = false;
}
function hideCloudConfigError() {
  if (!cloudConfigErrorEl) return;
  cloudConfigErrorEl.textContent = "";
  cloudConfigErrorEl.hidden = true;
}
function renderCloudConfig() {
  const config = readCloudConfig();
  const open = shouldOpenSyncedDatabase(config);
  if (cloudConfigEl) cloudConfigEl.hidden = open;
  if (open && cloudUrlEl) cloudUrlEl.value = config.databaseUrl;
  return open;
}
function createCloudAuthAdapter(db) {
  return {
    login(options) {
      return db.cloud.login({ ...options, grant_type: "otp" });
    },
    subscribeUser(listener) {
      return db.cloud.currentUser.subscribe(listener);
    },
    subscribeInteraction(listener) {
      return db.cloud.userInteraction.subscribe(listener);
    },
    getProviders() {
      return { providers: [], otpEnabled: true };
    }
  };
}
function applyBusinessVisibility() {
  const configured = requiresAuthentication();
  const authenticated = canAccessBusiness(authState);
  if (businessToolsEl) businessToolsEl.hidden = configured && !authenticated;
  // Do not display an empty dashboard while IndexedDB is still loading.
  if (dashboardEl) dashboardEl.hidden = configured && (!authenticated || !documentLoaded);
  // In local mode the dashboard may load visibly, but a failed read must never
  // be presented as an authoritative empty workspace.
  if (dashboardEl && !configured) dashboardEl.hidden = localReadFailed;
}
function setLocalStatus(message) {
  if (localStatusEl) localStatusEl.textContent = typeof message === "string" ? message : "";
}
function setLocalError(message) {
  if (!localStorageErrorEl) return;
  localStorageErrorEl.textContent = typeof message === "string" ? message : "";
  localStorageErrorEl.hidden = !localStorageErrorEl.textContent;
}
function renderLocalWorkspace() {
  if (!localPanelEl) return;
  const local = !requiresAuthentication();
  localPanelEl.hidden = !local;
  if (!local) {
    if (localConversionEl) localConversionEl.hidden = true;
    return;
  }
  const backup = availableLocalBackup(localStorage);
  const provenance = readLocalProvenance(localStorage);
  const converted = isLocalCompletion(provenance);
  if (localLegacyNoticeEl) {
    localLegacyNoticeEl.hidden = !backup;
    localLegacyNoticeEl.textContent = backup
      ? `Un document historique threadstep.document.v1 est conservé dans ce navigateur (${backup.subjects} sujets et ${backup.items} étapes). Il reste lisible et exportable ci-dessous ; aucune conversion ni transmission Cloud n'est lancée automatiquement.` +
        (converted
          ? ` Conversion locale terminée dans IndexedDB (${provenance.subjects} sujets et ${provenance.items} étapes) ; elle ne constitue pas une synchronisation Cloud.`
          : " Une conversion locale explicite reste disponible ci-dessous, avec revue et consentement.")
      : "";
  }
  if (localExportLegacyEl) localExportLegacyEl.hidden = !backup;
  if (localConvertLegacyEl) localConvertLegacyEl.hidden = !backup;
  if (!backup && localConversionEl) localConversionEl.hidden = true;
}
function setAuthStatus(message) {
  if (authStatusEl) authStatusEl.textContent = typeof message === "string" ? message : "";
}
function setAuthError(message) {
  if (!authErrorEl) return;
  authErrorEl.textContent = typeof message === "string" ? message : "";
  authErrorEl.hidden = !authErrorEl.textContent;
}
function renderLocalRecovery() {
  const backup = availableLocalBackup(localStorage);
  if (authLegacyExportEl) authLegacyExportEl.hidden = !backup;
  if (authLocalDataEl) {
    authLocalDataEl.textContent = backup
      ? `Une sauvegarde locale historique est présente dans ce navigateur (${backup.subjects} sujets et ${backup.items} étapes). L'espace de travail est masqué avant authentification ; ces données ne sont ni effacées ni envoyées au cloud automatiquement. Vous pouvez les exporter sans vous connecter.`
      : "L'espace de travail est masqué avant authentification. Aucune sauvegarde historique V1 lisible n'a été trouvée sur cette origine ; ne réinitialisez pas ce navigateur ni votre base.";
  }
}
function downloadJsonText(json, filename) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const link = el("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
function exportLegacyBackup() {
  const backup = availableLocalBackup(localStorage);
  if (!backup) {
    if (requiresAuthentication()) setAuthError("Aucune sauvegarde historique locale lisible à exporter.");
    else setLocalError("Aucune sauvegarde historique locale lisible à exporter.");
    return;
  }
  downloadJsonText(backup.json, "threadstep-historique-v1-sauvegarde.json");
  if (requiresAuthentication()) {
    setAuthStatus("Sauvegarde JSON historique téléchargée. Aucune donnée n'a été modifiée.");
  } else {
    setLocalError("");
    setLocalStatus("Sauvegarde JSON historique téléchargée. Aucune donnée n'a été modifiée.");
  }
}
function hideLocalConversion() {
  localConversionContext = null;
  if (localConversionEl) localConversionEl.hidden = true;
  if (localConversionConsentEl) localConversionConsentEl.checked = false;
  if (localConversionConfirmEl) localConversionConfirmEl.disabled = true;
  setLocalConversionStatus("");
}
function setLocalConversionStatus(message) {
  if (localConversionStatusEl) {
    localConversionStatusEl.textContent = typeof message === "string" ? message : "";
  }
}
function renderLocalConversion(plan) {
  if (!localConversionEl) return;
  const source = plan.source || {};
  const target = plan.targetCounts || { subjects: 0, items: 0 };
  if (localConversionSourceEl) {
    localConversionSourceEl.textContent = source.status === LOCAL_MIGRATION_STATUS.PRESENT
      ? `Source : ${plan.counts.subjects} sujet(s) et ${plan.counts.items} étape(s) dans threadstep.document.v1, conservée telle quelle.`
      : "Source : aucun document historique convertible.";
  }
  if (localConversionTargetEl) {
    localConversionTargetEl.textContent =
      `Destination : base locale IndexedDB threadstep-local, sur cet appareil, sans configuration Cloud. ` +
      `Cible actuelle : ${target.subjects} sujet(s) et ${target.items} étape(s).`;
  }
  if (localConversionPlanEl) {
    const insertions = plan.operations.length;
    if (plan.status === LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED) {
      localConversionPlanEl.textContent =
        "Les enregistrements source sont déjà présents à l'identique : aucune insertion n'est nécessaire.";
    } else if (plan.status === LOCAL_MIGRATION_STATUS.COLLISION) {
      localConversionPlanEl.textContent =
        `Collision sur ${plan.collisions.length} identifiant(s) local(aux) au contenu différent : ` +
        "aucune écriture ne sera effectuée et les enregistrements existants restent inchangés.";
    } else {
      localConversionPlanEl.textContent =
        `Insertions prévues : ${insertions} enregistrement(s) absent(s), sans écrasement des données locales existantes.`;
    }
  }
  if (localConversionFingerprintEl) {
    localConversionFingerprintEl.textContent = plan.sourceFingerprint
      ? `Empreinte SHA-256 de la source examinée : ${plan.sourceFingerprint}.`
      : "";
  }
  if (localConversionStateEl) {
    localConversionStateEl.textContent = plan.status === LOCAL_MIGRATION_STATUS.POPULATED
      ? "La cible locale contient déjà des données : seuls les enregistrements absents seront insérés après consentement."
      : plan.status === LOCAL_MIGRATION_STATUS.COLLISION
        ? "Conversion bloquée par une collision : aucune écriture, aucune donnée écrasée."
        : plan.status === LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED
          ? "Conversion locale déjà effectuée pour cette source."
          : "Rien n'est écrit avant votre confirmation explicite.";
  }
  const writable = plan.operations.length > 0 &&
    plan.status !== LOCAL_MIGRATION_STATUS.COLLISION &&
    plan.status !== LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED;
  if (localConversionConsentEl) {
    localConversionConsentEl.checked = false;
    localConversionConsentEl.disabled = !writable;
  }
  if (localConversionConfirmEl) {
    localConversionConfirmEl.disabled = !writable;
  }
  setLocalConversionStatus("Prévisualisation locale prête : aucune donnée n'a encore été écrite.");
  localConversionEl.hidden = false;
}
async function openLocalConversion() {
  if (requiresAuthentication()) return;
  if (!businessStore) {
    setLocalError("Conversion locale indisponible : stockage IndexedDB non initialisé.");
    return;
  }
  const detected = detectLocalSource(localStorage);
  if (detected.status !== LOCAL_MIGRATION_STATUS.PRESENT) {
    hideLocalConversion();
    setLocalError(detected.message || "Document historique non convertible.");
    return;
  }
  let target;
  try {
    target = await businessStore.read();
  } catch {
    setLocalError("Lecture de la cible locale impossible : conversion non proposée.");
    return;
  }
  const plan = planLocalConversion({
    source: detected,
    target,
    resumePreference: readResumePreference()
  });
  localConversionContext = { plan };
  setLocalError("");
  renderLocalConversion(plan);
  const title = localConversionEl ? localConversionEl.querySelector("#local-conversion-title") : null;
  if (title) title.focus();
}
function localConversionAdapter() {
  return {
    readSource() {
      return detectLocalSource(localStorage).raw;
    },
    readTarget() {
      return businessStore.read();
    },
    commit(operations) {
      return businessStore.commit(operations);
    },
    writeProvenance(record) {
      return writeLocalProvenance(localStorage, record);
    },
    writeResumePreference(value) {
      const serialized = serializeResumePreference(value);
      if (serialized === null) throw new Error("Préférence de reprise invalide.");
      localStorage.setItem(RESUME_KEY, serialized);
    }
  };
}
async function confirmLocalConversion() {
  const context = localConversionContext;
  if (!context) return;
  if (requiresAuthentication() || !businessStore) {
    setLocalConversionStatus("Conversion locale indisponible dans cet espace.");
    return;
  }
  if (!localConversionConsentEl || !localConversionConsentEl.checked) {
    setLocalConversionStatus("Consentement explicite requis avant toute écriture locale.");
    return;
  }
  await pendingCloudWrites;
  const outcome = await runLocalConversion(localConversionAdapter(), context.plan, {
    confirmed: true,
    fingerprint: context.plan.fingerprint
  });
  if (outcome.status === LOCAL_MIGRATION_STATUS.LOCAL_COMPLETE) {
    hideLocalConversion();
    await refreshLocalDocument();
    setLocalError("");
    setLocalStatus(
      `Conversion locale terminée : ${outcome.counts.subjects} sujet(s) et ${outcome.counts.items} étape(s) sont dans IndexedDB sur cet appareil. ` +
      "La sauvegarde historique et son export restent disponibles. Aucune synchronisation Cloud n'a été configurée ni déclenchée."
    );
    notify("Conversion locale terminée dans IndexedDB. Aucune synchronisation Cloud n'a été effectuée.");
    return;
  }
  const messages = {
    [LOCAL_MIGRATION_STATUS.REFUSED]: "Conversion refusée : la source et la cible locale restent inchangées.",
    [LOCAL_MIGRATION_STATUS.CONSENT_MISMATCH]: "Consentement lié à un autre plan : aucune écriture. Rouvrez la prévisualisation.",
    [LOCAL_MIGRATION_STATUS.STALE_SOURCE]: "Document historique modifié depuis la prévisualisation : aucune écriture. Rouvrez la prévisualisation.",
    [LOCAL_MIGRATION_STATUS.STALE_PLAN]: "Cible locale modifiée depuis la prévisualisation : aucune écriture. Rouvrez la prévisualisation.",
    [LOCAL_MIGRATION_STATUS.COLLISION]: "Collision d'identifiant : aucune écriture, aucune donnée locale écrasée.",
    [LOCAL_MIGRATION_STATUS.READ_ERROR]: "Lecture de revalidation impossible : conversion bloquée, source et cible inchangées.",
    [LOCAL_MIGRATION_STATUS.FAILED]: "Échec de la transaction locale : aucun demi-document écrit. La sauvegarde historique reste intacte.",
    [LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED]: "Aucune nouvelle insertion nécessaire : les enregistrements sont déjà présents."
  };
  const message = messages[outcome.status] || "Conversion locale interrompue : aucune écriture confirmée.";
  setLocalConversionStatus(message);
  notify(message);
  if (outcome.status !== LOCAL_MIGRATION_STATUS.ALREADY_MIGRATED) {
    context.plan = { ...context.plan, operations: [], fingerprint: context.plan.fingerprint };
    if (localConversionConfirmEl) localConversionConfirmEl.disabled = true;
    if (localConversionConsentEl) localConversionConsentEl.disabled = true;
  }
}

function renderAuthPanel() {
  if (!authPanelEl) return;
  const authenticated = canAccessBusiness(authState);
  authPanelEl.hidden = !requiresAuthentication() || authenticated;
  applyBusinessVisibility();
  if (authPanelEl.hidden) return;
  renderLocalRecovery();
  const interaction = authInteraction;
  const codePhase = !!(interaction && interaction.kind === "otp");
  const alertPhase = !!(interaction && interaction.kind === "alert");
  const errorAlerts = interaction ? interaction.alerts.filter((alert) => alert.type === "error") : [];
  const infoAlerts = interaction ? interaction.alerts.filter((alert) => alert.type !== "error") : [];
  if (authEmailFieldEl) authEmailFieldEl.hidden = codePhase || alertPhase;
  if (authOtpFieldEl) authOtpFieldEl.hidden = !codePhase;
  if (authEmailEl) authEmailEl.required = !(codePhase || alertPhase);
  if (authOtpEl) authOtpEl.required = codePhase;
  if (authSubmitEl) {
    authSubmitEl.textContent = alertPhase ? "OK" :
      codePhase ? "Valider le code" : signInMethods()[0].label;
    // Loading may remain stuck if native IndexedDB/session initialization
    // stalls: a user-initiated OTP login must still be possible.
    authSubmitEl.disabled = authSubmitting;
  }
  if (authResendEl) authResendEl.hidden = !codePhase;
  if (authCancelEl) authCancelEl.hidden = !codePhase;
  if (authOfflineEl) {
    authOfflineEl.hidden = authState.status !== AUTH_STATUS.OFFLINE_REQUIRED;
    authOfflineEl.textContent = authMessage("offline-first");
  }
  setAuthStatus(infoAlerts.length ? infoAlerts[0].message
    : authSubmitting ? "Demande de code en cours auprès de Dexie Cloud…" : authState.message);
  if (errorAlerts.length) setAuthError(errorAlerts[0].message);
  else if (authState.kind && authState.kind !== "sign-in") setAuthError(authState.message);
  else setAuthError("");
}
function handleAuthState(next) {
  authState = next && typeof next === "object" ? next : { status: AUTH_STATUS.SIGNED_OUT, kind: null, message: "" };
  if (canAccessBusiness(authState) || authState.status === AUTH_STATUS.REFUSED) {
    authSubmitting = false;
  }
  if (canAccessBusiness(authState)) {
    authInteraction = null;
    renderAuthPanel();
    startBusiness();
    return;
  }
  renderAuthPanel();
}
function handleAuthInteraction(interaction) {
  authInteraction = interaction;
  // A cleared native interaction can mean the provider is waiting on its
  // network response. Keep a visible pending state instead of silently
  // resetting the request.
  if (interaction) authSubmitting = false;
  renderAuthPanel();
}
function startBusiness() {
  if (businessStarted) return;
  businessStarted = true;
  documentLoaded = false;
  applyBusinessVisibility();
  notify("Chargement des données enregistrées dans IndexedDB…");
  if (!changesSubscribed) {
    subscribeToChanges();
    changesSubscribed = true;
  }
  // Cloud is the single source of truth after authentication, not localStorage.
  void refreshSyncedDocument().then(() => offerHistoricalMigration());
}
function setupAuthentication() {
  if (!syncedDatabase) return;
  if (authController) return;
  const adapter = createCloudAuthAdapter(syncedDatabase);
  authController = createAuthController({
    adapter,
    storage: localStorage,
    getOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
    onStateChange: handleAuthState,
    onInteraction: handleAuthInteraction
  });
  adapter.subscribeUser((user) => authController.applyUser(user));
  adapter.subscribeInteraction((payload) => authController.handleInteraction(payload));
  renderAuthPanel();
  // Opening IndexedDB starts restoration of the persisted native login.
  // A reloaded page must not require a new OTP when the session is valid.
  void syncedDatabase.open().catch(() => {
    notify("Impossible d'ouvrir IndexedDB ou de restaurer la session Dexie Cloud. Vos données locales restent intactes.");
    if (authState.status === AUTH_STATUS.AUTHENTICATED) {
      if (dashboardEl) dashboardEl.hidden = true;
    }
  });
}
function showAuthFieldError(message) {
  setAuthError(message);
  if (authState.status === AUTH_STATUS.SIGNED_OUT) setAuthStatus("");
}
function submitAuthForm(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (!authController) {
    setAuthError("Connexion Dexie Cloud non initialisée. Rechargez la page sans supprimer vos données.");
    return;
  }
  if (authSubmitting) return;
  const interaction = authController.currentInteraction() || authInteraction;
  if (interaction && interaction.kind === "alert") {
    authController.submitInteraction({});
    renderAuthPanel();
    return;
  }
  if (interaction && interaction.kind === "otp") {
    const otp = authOtpEl ? authOtpEl.value.trim() : "";
    if (!otp) {
      showAuthFieldError("Saisissez le code reçu par email.");
      if (authOtpEl) authOtpEl.focus();
      return;
    }
    authSubmitting = true;
    setAuthError("");
    authController.submitInteraction({ otp });
    if (authOtpEl) authOtpEl.value = "";
    renderAuthPanel();
    return;
  }
  if (interaction && interaction.kind === "email") {
    const email = authEmailEl ? authEmailEl.value.trim() : "";
    if (!email) {
      showAuthFieldError("Saisissez une adresse email valide.");
      if (authEmailEl) authEmailEl.focus();
      return;
    }
    authSubmitting = true;
    setAuthError("");
    authController.submitInteraction({ email });
    renderAuthPanel();
    return;
  }
  const email = authEmailEl ? authEmailEl.value.trim() : "";
  if (!email || !email.includes("@")) {
    showAuthFieldError("Saisissez une adresse email valide.");
    if (authEmailEl) authEmailEl.focus();
    return;
  }
  authSubmitting = true;
  setAuthError("");
  const outcome = authController.startSignIn(email);
  if (outcome && typeof outcome.then === "function") {
    outcome.then(() => {
      authSubmitting = false;
      renderAuthPanel();
    }, () => {
      authSubmitting = false;
      setAuthError("Impossible de contacter Dexie Cloud. Vérifiez votre réseau et la configuration de l'instance.");
      renderAuthPanel();
    });
  }
  renderAuthPanel();
}
function resendOtp() {
  if (!authController) return;
  authSubmitting = true;
  setAuthError("");
  const outcome = authController.resend();
  if (outcome && typeof outcome.then === "function") {
    outcome.then(() => {
      authSubmitting = false;
      renderAuthPanel();
    });
  }
  renderAuthPanel();
}
function cancelOtp() {
  if (!authController) return;
  authController.cancelInteraction();
  authInteraction = null;
  authSubmitting = false;
  setAuthError("");
  setAuthStatus(authState.message);
  renderAuthPanel();
}
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function persist() {
  if (!businessAllowed() || (syncedDatabase && (!documentLoaded || cloudWriteBlocked)) ||
      (!syncedDatabase && (!documentLoaded || localWriteBlocked))) {
    if (!syncedDatabase && localWriteBlocked) {
      setLocalError("Écriture locale interrompue : rechargez la page après avoir exporté vos données.");
    }
    notify("Enregistrement indisponible : gardez votre export JSON, ne supprimez pas les données locales.");
    return Promise.resolve();
  }
  // Mutations are serialized and lastRecords advances only AFTER Dexie
  // commits the local transaction. No false 'saved' on write failure.
  const records = documentToRecords(documentState);
  render();
  return commitOperations(records);
}
function load() {
  expandedParents = new Set();
  openMenuId = null;
  if (!businessAllowed()) return;
  if (syncedDatabase) {
    void refreshSyncedDocument();
    return;
  }
  void refreshLocalDocument();
}
async function refreshLocalDocument() {
  if (!localDatabase || !businessStore) {
    localReadFailed = true;
    localWriteBlocked = true;
    documentLoaded = false;
    applyBusinessVisibility();
    setLocalError("Stockage local IndexedDB indisponible : aucune donnée métier n'est lue ni écrite dans un autre stockage.");
    notify("Stockage local indisponible : exportez votre sauvegarde historique si elle existe.");
    return;
  }
  if (localReadPending) return localReadPending;
  localReadPending = (async () => {
    await businessStore.open();
    let writesSnapshot;
    let records;
    do {
      writesSnapshot = pendingCloudWrites;
      await writesSnapshot;
      records = await businessStore.read();
    } while (writesSnapshot !== pendingCloudWrites);
    documentState = recordsToDocument(records);
    lastRecords = records;
    documentLoaded = true;
    localReadFailed = false;
    localWriteBlocked = false;
    resumeRef = readResumePreference();
    setLocalError("");
    render();
    applyBusinessVisibility();
    setLocalStatus("Données chargées depuis IndexedDB sur cet appareil.");
    notify("Données chargées depuis IndexedDB sur cet appareil.");
  })().catch(() => {
    documentLoaded = false;
    localReadFailed = true;
    localWriteBlocked = true;
    applyBusinessVisibility();
    setLocalError("Lecture de l'espace IndexedDB impossible : affichage bloqué pour protéger les données. Vos données historiques restent exportables ; ne réimportez pas à l'aveugle.");
    notify("Lecture IndexedDB impossible : affichage bloqué pour protéger les données. Ne réimportez pas.");
  }).finally(() => { localReadPending = null; });
  return localReadPending;
}
function startLocalWorkspace() {
  if (businessStarted) return;
  businessStarted = true;
  documentLoaded = false;
  applyBusinessVisibility();
  renderLocalWorkspace();
  setLocalStatus("Chargement des données enregistrées dans IndexedDB sur cet appareil…");
  notify("Chargement des données enregistrées dans IndexedDB…");
  if (!changesSubscribed) {
    subscribeToChanges();
    changesSubscribed = true;
  }
  void refreshLocalDocument();
}
function readResumePreference() {
  try {
    return parseResumePreference(localStorage.getItem(RESUME_KEY));
  } catch {
    return null;
  }
}
function saveResumePreference(ref) {
  try {
    localStorage.setItem(RESUME_KEY, serializeResumePreference(ref));
  } catch {
    notify("Stockage indisponible : le suivi ne sera pas conservé.");
  }
}
function removeResumePreference() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // Ignore: a missing or unavailable store leaves no orphan reference to clean.
  }
}
function reconcileResume() {
  const view = resumeView(documentState, resumeRef);
  if (view) return view;
  if (resumeRef && documentLoaded) {
    resumeRef = null;
    removeResumePreference();
  }
  return null;
}
function expandAncestorForFocus() {
  if (!focusItemId) return;
  for (const subject of documentState.subjects) {
    const ancestorId = substepAncestorId(subject.items, focusItemId);
    if (ancestorId && !expandedParents.has(ancestorId)) {
      expandedParents = toggleExpandedParent(expandedParents, ancestorId);
    }
  }
}
function render() {
  if (!businessAllowed()) return;
  subjectsEl.replaceChildren();
  expandAncestorForFocus();
  if (reorderNoteEl) reorderNoteEl.hidden = !hideCompleted;
  const n = pendingCount(documentState);
  counterEl.textContent = n + (n > 1 ? " prochaines étapes" : " prochaine étape");
  const detail = route.view !== "overview";
  subjectForm.hidden = detail;
  focusSuggestEl.hidden = detail;
  if (detail) {
    focusCardEl.hidden = true;
    resumeCardEl.hidden = true;
    renderDetail();
    applyFocus();
    return;
  }
  renderSuggestion();
  renderResumeCard();
  if (!documentState.subjects.length) {
    subjectsEl.append(el("p", "empty", "Aucun sujet pour le moment. Ajoutez un premier fil de travail ci-dessus."));
    return;
  }
  for (const subject of documentState.subjects) subjectsEl.append(renderSubject(subject));
  applyFocus();
}
function navigate(hash) {
  if (location.hash === hash) {
    route = parseRoute(hash);
    render();
    return;
  }
  location.hash = hash;
}
function renderDetail() {
  if (route.view === "invalid") {
    subjectsEl.append(renderDetailFallback());
    return;
  }
  const subject = findSubject(documentState, route.subjectId);
  if (!subject) {
    subjectsEl.append(renderDetailFallback());
    return;
  }
  subjectsEl.append(renderDetailView(subject));
}
function renderDetailView(subject) {
  const card = el("section", "subject detail");
  card.dataset.subject = subject.id;
  card.setAttribute("aria-label", subject.title);
  card.tabIndex = -1;
  const nav = el("div", "detail-nav");
  const back = el("button", "secondary detail-return", "Retour à la vue d'ensemble");
  back.type = "button";
  back.setAttribute("aria-label", "Retour à la vue d'ensemble depuis " + subject.title);
  back.addEventListener("click", () => returnToOverview(subject.id));
  nav.append(back);
  card.append(nav);
  card.append(renderDetailHead(subject));
  card.append(renderTaskArea(subject));
  return card;
}
function renderDetailFallback() {
  const card = el("section", "subject detail fallback");
  card.tabIndex = -1;
  const heading = el("h2", "detail-title", "Projet introuvable");
  heading.tabIndex = -1;
  const message = el("p", "detail-message", "Ce projet n'est pas disponible. Il a peut-être été supprimé, remplacé par un import, ou n'existe pas.");
  message.setAttribute("role", "alert");
  const back = el("button", "secondary detail-return", "Retour à la vue d'ensemble");
  back.type = "button";
  back.setAttribute("aria-label", "Retour à la vue d'ensemble");
  back.addEventListener("click", () => navigate("#/"));
  card.append(heading, message, back);
  return card;
}
function renderDetailHead(subject) {
  if (renamingSubject) return renderRenameForm(subject);
  const head = el("div", "subject-head detail-head");
  const titleBox = el("div");
  const heading = el("h2", "detail-title", subject.title);
  heading.tabIndex = -1;
  titleBox.append(heading);
  const pending = subject.items.filter((item) => !item.done).length;
  titleBox.append(el("p", "small", pending + " étape" + (pending > 1 ? "s" : "") + " en attente"));
  titleBox.append(el("p", "small subject-total", totalTaskCountLabel(totalTaskCount(subject.items))));
  const controls = el("div", "subject-controls");
  const rename = el("button", "subtle subject-rename", "Renommer le projet");
  rename.type = "button";
  rename.setAttribute("aria-label", "Renommer le projet " + subject.title);
  rename.addEventListener("click", () => {
    renamingSubject = true;
    render();
  });
  controls.append(rename);
  head.append(titleBox, controls);
  return head;
}
function renderRenameForm(subject) {
  const form = el("form", "subject-rename-form");
  const input = el("input", "subject-rename-input");
  input.type = "text";
  input.maxLength = 100;
  input.required = true;
  input.value = subject.title;
  input.setAttribute("aria-label", "Nouveau nom du projet " + subject.title);
  const save = el("button", "primary", "Enregistrer");
  save.type = "submit";
  const cancel = el("button", "subtle subject-rename-cancel", "Annuler");
  cancel.type = "button";
  const error = el("p", "rename-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  form.append(input, save, cancel, error);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const trimmed = input.value.trim();
    if (!trimmed || trimmed.length > 100) {
      error.textContent = "Le nom doit contenir entre 1 et 100 caractères.";
      error.hidden = false;
      input.focus();
      return;
    }
    const next = renameSubject(documentState, subject.id, input.value);
    renamingSubject = false;
    focusRenameControl = true;
    if (next === documentState) { render(); return; }
    documentState = next;
    persist();
  });
  cancel.addEventListener("click", () => {
    renamingSubject = false;
    focusRenameControl = true;
    render();
  });
  return form;
}
function returnToOverview(subjectId) {
  renamingSubject = false;
  focusOpenSubjectId = subjectId;
  navigate("#/");
}
function openSubject(subject) {
  const target = subjectRoute(subject.id);
  if (!target) return;
  renamingSubject = false;
  focusDetailHeading = true;
  navigate(target);
}
function applyFocus() {
  if (editingItemId) {
    const input = subjectsEl.querySelector(".task-edit-title");
    if (input) { input.focus(); input.select(); return; }
  }
  if (renamingSubject) {
    const input = subjectsEl.querySelector(".subject-rename-input");
    if (input) { input.focus(); input.select(); return; }
  }
  if (focusDetailHeading) {
    focusDetailHeading = false;
    const heading = subjectsEl.querySelector(".detail-title");
    if (heading) { heading.focus(); return; }
  }
  if (focusOpenSubjectId) {
    const id = focusOpenSubjectId;
    focusOpenSubjectId = null;
    const control = [...subjectsEl.querySelectorAll(".subject-open")].find((node) => node.dataset.subject === id);
    if (control) { control.focus(); return; }
  }
  if (focusRenameControl) {
    focusRenameControl = false;
    const control = subjectsEl.querySelector(".subject-rename");
    if (control) { control.focus(); return; }
  }
  if (focusSubjectId) {
    const card = [...subjectsEl.querySelectorAll(".subject")].find((node) => node.dataset.subject === focusSubjectId);
    focusSubjectId = null;
    if (card) card.focus();
    return;
  }
  if (focusItemId) {
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === focusItemId);
    const target = card && card.querySelector(".task-edit");
    focusItemId = null;
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingCollapseFocus) {
    const itemId = pendingCollapseFocus;
    pendingCollapseFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    const target = card && card.querySelector(".task-toggle");
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingPriorityFocus) {
    const itemId = pendingPriorityFocus;
    pendingPriorityFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    const target = card && card.querySelector(".priority-control");
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingMenuFocus) {
    const itemId = pendingMenuFocus;
    pendingMenuFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    const target = card && card.querySelector(".task-menu-button");
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingMoveFocus) {
    const { itemId } = pendingMoveFocus;
    pendingMoveFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    const target = card && card.querySelector(".task-handle");
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
  }
}
function renderSuggestion() {
  focusCardEl.replaceChildren();
  if (!suggestionVisible) {
    focusCardEl.hidden = true;
    return;
  }
  focusCardEl.hidden = false;
  const suggestion = nextActionSuggestion(documentState);
  if (!suggestion) {
    focusCardEl.append(el("p", "focus-empty", "Aucune étape à faire pour le moment. Ajoutez une prochaine action pour commencer."));
    return;
  }
  focusCardEl.append(el("p", "focus-label", "Prochaine étape suggérée"));
  focusCardEl.append(el("p", "focus-title", suggestion.itemTitle));
  focusCardEl.append(el("p", "focus-meta", suggestion.subjectTitle + " · " + priorityLabels[suggestion.priority]));
  const reason = suggestionReason(suggestion.priority);
  if (reason) focusCardEl.append(el("p", "focus-reason", reason));
  const actions = el("div", "focus-actions");
  const reveal = el("button", "subtle focus-reveal", "Voir dans la liste");
  reveal.type = "button";
  reveal.addEventListener("click", () => revealSuggestion(suggestion));
  const close = el("button", "subtle focus-close", "Fermer");
  close.type = "button";
  close.addEventListener("click", hideSuggestion);
  actions.append(reveal, close);
  focusCardEl.append(actions);
}
function revealAction(subjectId, itemId) {
  revealItemId = itemId;
  focusItemId = itemId;
  const subject = findSubject(documentState, subjectId);
  if (subject && !isWithinOverviewPreview(subject.items, itemId, hideCompleted)) {
    renamingSubject = false;
    focusDetailHeading = false;
    navigate(subjectRoute(subject.id));
    return;
  }
  render();
}
function revealSuggestion(suggestion) {
  revealAction(suggestion.subjectId, suggestion.itemId);
}
function hideSuggestion() {
  suggestionVisible = false;
  revealItemId = null;
  renderSuggestion();
}
function renderResumeCard() {
  resumeCardEl.replaceChildren();
  const view = reconcileResume();
  if (!view) {
    resumeCardEl.hidden = true;
    return;
  }
  resumeCardEl.hidden = false;
  resumeCardEl.append(el("h3", "resume-label", "Je reprends ici"));
  resumeCardEl.append(el("p", "resume-title", view.itemTitle));
  resumeCardEl.append(el("p", "resume-meta", view.subjectTitle + " · " + priorityLabels[view.priority]));
  const actions = el("div", "resume-actions");
  const reveal = el("button", "subtle resume-reveal", "Voir dans la liste");
  reveal.type = "button";
  reveal.setAttribute("aria-label", "Voir dans la liste : " + view.itemTitle);
  reveal.addEventListener("click", () => revealResume(view));
  const clear = el("button", "subtle resume-clear", "Ne plus suivre");
  clear.type = "button";
  clear.setAttribute("aria-label", "Ne plus suivre : " + view.itemTitle);
  clear.addEventListener("click", clearResume);
  actions.append(reveal, clear);
  resumeCardEl.append(actions);
}
function revealResume(view) {
  revealAction(view.subjectId, view.itemId);
}
function clearResume() {
  resumeRef = null;
  removeResumePreference();
  if (pendingRemoval) pendingRemoval.trackedRef = null;
  revealItemId = null;
  render();
}
function clearRemovalTimer() {
  if (removalTimer !== null) {
    clearTimeout(removalTimer);
    removalTimer = null;
  }
}
function hideSnackbar() {
  snackbarEl.hidden = true;
  snackbarEl.replaceChildren();
}
function invalidatePendingRemoval() {
  clearRemovalTimer();
  pendingRemoval = null;
  hideSnackbar();
}
function expireRemoval() {
  removalTimer = null;
  pendingRemoval = null;
  hideSnackbar();
}
function startRemovalTimer(delay) {
  clearRemovalTimer();
  removalDeadline = Date.now() + delay;
  removalTimer = setTimeout(expireRemoval, delay);
}
function suspendRemovalTimer() {
  if (removalTimer === null) return;
  removalDeadline = Math.max(0, removalDeadline - Date.now());
  clearRemovalTimer();
}
function resumeRemovalTimer() {
  if (pendingRemoval && removalTimer === null) startRemovalTimer(removalDeadline);
}
function showSnackbar(itemTitle) {
  snackbarEl.replaceChildren();
  snackbarEl.append(el("span", "snackbar-message", "Étape retirée"));
  const undo = el("button", "snackbar-undo", "Annuler");
  undo.type = "button";
  undo.setAttribute("aria-label", "Annuler le retrait de " + itemTitle);
  undo.addEventListener("click", undoRemoval);
  snackbarEl.append(undo);
  snackbarEl.hidden = false;
}
function retirerAction(subject, item) {
  const result = planRemoval(documentState, subject.id, item.id);
  if (!result.removal) return;
  invalidatePendingRemoval();
  pendingRemoval = { subjectId: subject.id, rootItemId: item.id, removal: result.removal, trackedRef: null };
  if (resumeRef && removalContainsItem(result.removal, resumeRef.itemId)) {
    pendingRemoval.trackedRef = { subjectId: resumeRef.subjectId, itemId: resumeRef.itemId };
  }
  documentState = result.document;
  focusSubjectId = subject.id;
  persist();
  showSnackbar(item.title);
  startRemovalTimer(UNDO_WINDOW_MS);
}
function undoRemoval() {
  if (!pendingRemoval) return;
  const { removal, trackedRef } = pendingRemoval;
  const restoredDocument = restoreRemoval(documentState, removal);
  const rootId = removal.rootId;
  if (restoredDocument === documentState) {
    invalidatePendingRemoval();
    return;
  }
  documentState = restoredDocument;
  const restored = restorableTrackingRef(documentState, trackedRef);
  if (restored) {
    resumeRef = restored;
    saveResumePreference(resumeRef);
  }
  focusItemId = rootId;
  revealItemId = rootId;
  invalidatePendingRemoval();
  persist();
}
function move(subject, direction) {
  const reordered = moveSubject(documentState.subjects, subject.id, direction);
  if (reordered === documentState.subjects) return;
  documentState.subjects = reordered;
  persist();
  focusAfterMove(subject.id, direction);
}
function focusAfterMove(subjectId, direction) {
  const controls = [...subjectsEl.querySelectorAll(".subject-move")];
  const own = controls.filter((button) => button.dataset.subject === subjectId);
  const card = [...subjectsEl.querySelectorAll(".subject")].find((node) => node.dataset.subject === subjectId);
  const target = own.find((button) => button.dataset.direction === direction && !button.disabled)
    || own.find((button) => !button.disabled)
    || card;
  if (target) target.focus();
}
function renderSubject(subject) {
  const index = documentState.subjects.indexOf(subject);
  const card = el("section", "subject");
  card.setAttribute("aria-label", subject.title);
  card.dataset.subject = subject.id;
  card.tabIndex = -1;
  const head = el("div", "subject-head");
  const titleBox = el("div");
  titleBox.append(el("h3", "", subject.title));
  const pending = subject.items.filter((item) => !item.done).length;
  titleBox.append(el("p", "small", pending + " étape" + (pending > 1 ? "s" : "") + " en attente"));
  titleBox.append(el("p", "small subject-total", totalTaskCountLabel(totalTaskCount(subject.items))));
  const controls = el("div", "subject-controls");
  const open = el("button", "secondary subject-open", "Ouvrir le projet");
  open.type = "button";
  open.dataset.subject = subject.id;
  open.setAttribute("aria-label", "Ouvrir le projet " + subject.title);
  open.addEventListener("click", () => openSubject(subject));
  const up = el("button", "subtle subject-move", "↑");
  up.type = "button";
  up.dataset.subject = subject.id;
  up.dataset.direction = "up";
  up.disabled = index === 0;
  up.setAttribute("aria-label", "Monter le sujet " + subject.title);
  up.addEventListener("click", () => move(subject, "up"));
  const down = el("button", "subtle subject-move", "↓");
  down.type = "button";
  down.dataset.subject = subject.id;
  down.dataset.direction = "down";
  down.disabled = index === documentState.subjects.length - 1;
  down.setAttribute("aria-label", "Descendre le sujet " + subject.title);
  down.addEventListener("click", () => move(subject, "down"));
  const remove = el("button", "danger", "Supprimer");
  remove.type = "button";
  remove.setAttribute("aria-label", "Supprimer le sujet " + subject.title);
  remove.addEventListener("click", () => {
    if (!confirm("Supprimer ce sujet et toutes ses étapes ?")) return;
    invalidatePendingRemoval();
    documentState.subjects = documentState.subjects.filter((s) => s.id !== subject.id);
    persist();
  });
  controls.append(open, up, down, remove);
  head.append(titleBox, controls);
  card.append(head);
  card.append(renderTaskArea(subject, { preview: true }));
  return card;
}
function renderSeeMore(subject) {
  const control = el("button", "secondary overview-see-more", "Voir plus");
  control.type = "button";
  control.setAttribute("aria-label", "Voir plus de tâches pour le projet " + subject.title);
  control.addEventListener("click", () => openSubject(subject));
  return control;
}
function renderTaskArea(subject, { preview = false } = {}) {
  const area = el("div", "task-area");
  const form = el("form", "task-form");
  const input = el("input");
  input.required = true;
  input.maxLength = 300;
  input.placeholder = "Quelle est la prochaine action ?";
  input.setAttribute("aria-label", "Nouvelle étape pour " + subject.title);
  const select = el("select");
  select.setAttribute("aria-label", "Priorité de la nouvelle étape");
  for (const priority of PRIORITIES) {
    const option = el("option", "", priorityLabels[priority]);
    option.value = priority;
    if (priority === "normal") option.selected = true;
    select.append(option);
  }
  const add = el("button", "primary", "+ Étape");
  add.type = "submit";
  form.append(input, select, add);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim() || subject.items.length >= 500) return;
    subject.items.push(newItem(input.value, select.value, crypto.randomUUID()));
    input.value = "";
    persist();
    input.focus();
  });
  area.append(form);

  const list = el("ul", "tasks");
  const selection = preview
    ? overviewPreview(subject.items, hideCompleted)
    : { shown: visibleItems(subject.items, null, hideCompleted), hasMore: false };
  for (const item of selection.shown) list.append(renderItem(subject, item));
  if (!subject.items.length) area.append(el("p", "empty", "Aucune étape. Ajoutez la prochaine action à faire."));
  area.append(list);
  if (selection.hasMore) area.append(renderSeeMore(subject));
  return area;
}
function substepListId(itemId) {
  return "substeps-" + encodeURIComponent(String(itemId));
}
function renderItem(subject, item) {
  const level = item.parentId === null ? "task-parent" : "task-substep";
  const li = el("li", "task " + level + (item.done ? " done" : "") + (revealItemId === item.id ? " reveal" : ""));
  li.dataset.item = item.id;
  const view = substepView(subject.items, item.id, hideCompleted, expandedParents);
  if (editingItemId === item.id) {
    li.append(renderEditor(subject, item));
  } else {
    li.append(renderRow(subject, item));
    if (typeof item.note === "string" && item.note.trim().length > 0) li.append(renderNote(item));
    li.append(renderActions(subject, item, view));
  }
  if (view.renderChildren) {
    const list = el("ul", "tasks children");
    list.id = substepListId(item.id);
    for (const child of view.children) list.append(renderItem(subject, child));
    li.append(list);
  }
  return li;
}
function renderRow(subject, item) {
  const row = el("div", "task-row");
  const check = el("input", "task-check");
  check.type = "checkbox";
  check.checked = item.done;
  check.setAttribute("aria-label", "Terminer " + item.title);
  check.addEventListener("change", () => {
    item.done = check.checked;
    persist();
  });
  const title = el("span", "task-title", item.title);
  const control = el("select", "priority priority-" + item.priority + " priority-control");
  control.setAttribute("aria-label", "Priorité de « " + item.title + " » : " + priorityLabels[item.priority]);
  for (const priority of PRIORITIES) {
    const option = el("option", "", priorityLabels[priority]);
    option.value = priority;
    if (priority === item.priority) option.selected = true;
    control.append(option);
  }
  control.addEventListener("change", () => {
    const next = setItemPriority(documentState, subject.id, item.id, control.value);
    if (next === documentState) return;
    documentState = next;
    pendingPriorityFocus = item.id;
    persist();
    notify("Priorité mise à jour");
  });
  row.append(check, title, control);
  return row;
}
function renderNote(item) {
  return el("p", "task-note", item.note);
}
function moveItem(subject, item, direction) {
  const reordered = moveWithinPriority(subject.items, item.id, direction);
  if (reordered === subject.items) return;
  subject.items = reordered;
  pendingMoveFocus = { itemId: item.id, direction };
  persist();
  notify(direction === "up" ? "Étape montée" : "Étape descendue");
}
function moveContext(subject, item) {
  const parent = item.parentId === null
    ? null
    : subject.items.find((entry) => entry.id === item.parentId);
  return parent
    ? "sous-étape de « " + parent.title + " », priorité " + priorityLabels[item.priority]
    : "priorité " + priorityLabels[item.priority];
}
function renderDragHandle(subject, item) {
  if (hideCompleted) return null;
  const handle = el("button", "task-handle", "⠿");
  handle.type = "button";
  handle.setAttribute("aria-label", "Déplacer « " + item.title + " » (" + moveContext(subject, item) + ")");
  handle.setAttribute("aria-describedby", "reorder-note");
  handle.addEventListener("pointerdown", (event) => startDrag(event, subject, item, handle));
  return handle;
}
function startDrag(event, subject, item, handle) {
  if (hideCompleted || dragState) return;
  if (typeof event.button === "number" && event.button !== 0) return;
  dragState = {
    pointerId: event.pointerId,
    subjectId: subject.id,
    itemId: item.id,
    handle,
    candidate: null
  };
  if (typeof handle.setPointerCapture === "function" && event.pointerId !== undefined) {
    try { handle.setPointerCapture(event.pointerId); } catch { /* capture unavailable */ }
  }
  handle.classList.add("dragging-handle");
  handle.setAttribute("aria-grabbed", "true");
  const task = handle.closest(".task");
  if (task) task.classList.add("dragging");
}
function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (event.cancelable) event.preventDefault();
  updateDropIndicator(resolveDropTarget(event.clientX, event.clientY));
}
function resolveDropTarget(x, y) {
  const subject = documentState.subjects.find((entry) => entry.id === dragState.subjectId);
  if (!subject) return null;
  const stack = typeof document.elementsFromPoint === "function"
    ? document.elementsFromPoint(x, y)
    : [document.elementFromPoint(x, y)];
  for (const element of stack) {
    if (!element || typeof element.closest !== "function") continue;
    const task = element.closest(".task");
    if (!task) continue;
    const owner = task.closest(".subject");
    if (!owner || owner.dataset.subject !== dragState.subjectId) continue;
    const row = task.querySelector(".task-row") || task;
    if (typeof row.getBoundingClientRect !== "function") continue;
    const rect = row.getBoundingClientRect();
    const position = y < rect.top + rect.height / 2 ? "before" : "after";
    if (canReorderWithinPriority(subject.items, dragState.itemId, task.dataset.item, position)) {
      return { targetId: task.dataset.item, position, row: task };
    }
  }
  return null;
}
function clearDropIndicators() {
  for (const node of subjectsEl.querySelectorAll(".drop-before, .drop-after")) {
    node.classList.remove("drop-before", "drop-after");
  }
}
function updateDropIndicator(candidate) {
  clearDropIndicators();
  if (!dragState) return;
  dragState.candidate = candidate;
  if (candidate && candidate.row) {
    candidate.row.classList.add(candidate.position === "before" ? "drop-before" : "drop-after");
  }
}
function releaseDrag(state, pointerId) {
  if (typeof state.handle.releasePointerCapture === "function" && pointerId !== undefined) {
    try { state.handle.releasePointerCapture(pointerId); } catch { /* already released */ }
  }
  state.handle.classList.remove("dragging-handle");
  state.handle.removeAttribute("aria-grabbed");
  const task = state.handle.closest(".task");
  if (task) task.classList.remove("dragging");
  clearDropIndicators();
  if (dragState === state) dragState = null;
}
function onDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const state = dragState;
  const candidate = state.candidate;
  releaseDrag(state, event.pointerId);
  if (!candidate) return;
  const subject = documentState.subjects.find((entry) => entry.id === state.subjectId);
  if (!subject) return;
  const reordered = reorderWithinPriority(subject.items, state.itemId, candidate.targetId, candidate.position);
  if (reordered === subject.items) return;
  subject.items = reordered;
  pendingMoveFocus = { itemId: state.itemId, direction: null };
  persist();
  notify("Étape déplacée");
}
function cancelDrag(event) {
  if (!dragState) return;
  const state = dragState;
  const pointerId = event && event.pointerId !== undefined ? event.pointerId : state.pointerId;
  releaseDrag(state, pointerId);
  notify("Déplacement annulé");
}
function renderSubstepToggle(item, view) {
  const label = substepToggleLabel(view.children.length, view.collapsed);
  const toggle = el("button", "subtle task-toggle", label);
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", view.collapsed ? "false" : "true");
  toggle.setAttribute("aria-label", label + " de « " + item.title + " »");
  if (view.renderChildren) toggle.setAttribute("aria-controls", substepListId(item.id));
  toggle.addEventListener("click", () => {
    expandedParents = toggleExpandedParent(expandedParents, item.id);
    pendingCollapseFocus = item.id;
    render();
  });
  return toggle;
}
function renderActions(subject, item, view) {
  const actions = el("div", "task-actions");
  const handle = renderDragHandle(subject, item);
  if (handle) actions.append(handle);
  if (item.parentId === null && view && view.hasVisibleSubsteps) actions.append(renderSubstepToggle(item, view));
  actions.append(renderItemMenu(subject, item));
  return actions;
}
function menuPanelId(itemId) {
  return "task-menu-" + encodeURIComponent(String(itemId));
}
function menuAccessibleName(subject, item, command) {
  switch (command.id) {
    case "edit": return "Modifier " + item.title;
    case "remove": return "Retirer " + item.title;
    case "add-substep": return "Ajouter une sous-tâche à " + item.title;
    case "promote": return "Promouvoir en tâche principale : " + item.title;
    case "keep-track": return command.label + " : " + item.title;
    case "move-up":
    case "move-down": return command.label + " « " + item.title + " » (" + moveContext(subject, item) + ")";
    default: return command.label;
  }
}
function renderMenuCommand(subject, item, command) {
  const button = el("button", "subtle task-menu-command task-menu-" + command.id, command.label);
  button.type = "button";
  button.disabled = command.disabled === true;
  button.dataset.command = command.id;
  button.setAttribute("aria-label", menuAccessibleName(subject, item, command));
  button.addEventListener("click", () => runMenuCommand(subject, item, command.id));
  return button;
}
function renderMenuPanel(subject, item) {
  const panel = el("div", "task-menu");
  panel.id = menuPanelId(item.id);
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Actions pour " + item.title);
  const tracked = !!(resumeRef && resumeRef.subjectId === subject.id && resumeRef.itemId === item.id);
  const commands = itemMenuCommands(item, {
    tracked,
    canMoveUp: !hideCompleted && canMoveWithinPriority(subject.items, item.id, "up"),
    canMoveDown: !hideCompleted && canMoveWithinPriority(subject.items, item.id, "down")
  });
  for (const command of commands) panel.append(renderMenuCommand(subject, item, command));
  return panel;
}
function renderItemMenu(subject, item) {
  const open = openMenuId === item.id;
  const wrap = el("div", "task-menu-wrap");
  const button = el("button", "subtle task-menu-button", "⋮");
  button.type = "button";
  button.setAttribute("aria-label", "Actions pour " + item.title);
  button.setAttribute("aria-expanded", open ? "true" : "false");
  button.setAttribute("aria-controls", menuPanelId(item.id));
  button.addEventListener("click", () => toggleItemMenu(item.id));
  wrap.append(button);
  if (open) wrap.append(renderMenuPanel(subject, item));
  return wrap;
}
function toggleItemMenu(itemId) {
  if (openMenuId === itemId) {
    openMenuId = null;
    pendingMenuFocus = itemId;
  } else {
    openMenuId = itemId;
    pendingMenuFocus = null;
  }
  render();
}
function runMenuCommand(subject, item, commandId) {
  const wasOpen = openMenuId === item.id;
  if (wasOpen) openMenuId = null;
  switch (commandId) {
    case "edit":
      editingItemId = item.id;
      focusItemId = null;
      render();
      return;
    case "remove":
      retirerAction(subject, item);
      return;
    case "add-substep": {
      const title = prompt("Nom de la sous-étape :");
      if (!title || !title.trim() || title.length > 300 || subject.items.length >= 500) {
        if (wasOpen) render();
        return;
      }
      subject.items.push(newItem(title, "normal", crypto.randomUUID(), item.id));
      persist();
      return;
    }
    case "promote": {
      const next = promoteItemToTopLevel(documentState, subject.id, item.id);
      if (next === documentState) { if (wasOpen) render(); return; }
      documentState = next;
      persist();
      revealAction(subject.id, item.id);
      return;
    }
    case "keep-track":
      resumeRef = { subjectId: subject.id, itemId: item.id };
      saveResumePreference(resumeRef);
      if (pendingRemoval) pendingRemoval.trackedRef = null;
      render();
      return;
    case "move-up":
      moveItem(subject, item, "up");
      return;
    case "move-down":
      moveItem(subject, item, "down");
      return;
    default:
      return;
  }
}
function renderEditor(subject, item) {
  const form = el("form", "task-edit-form");
  const titleInput = el("input", "task-edit-title");
  titleInput.type = "text";
  titleInput.maxLength = 300;
  titleInput.required = true;
  titleInput.value = item.title;
  titleInput.setAttribute("aria-label", "Titre de l'étape " + item.title);
  const select = el("select", "task-edit-priority");
  select.setAttribute("aria-label", "Priorité de l'étape " + item.title);
  for (const priority of PRIORITIES) {
    const option = el("option", "", priorityLabels[priority]);
    option.value = priority;
    if (priority === item.priority) option.selected = true;
    select.append(option);
  }
  const noteLabel = el("label", "task-edit-note-label", "Note (facultative)");
  const noteInput = el("textarea", "task-edit-note");
  noteInput.rows = 3;
  noteInput.maxLength = 2000;
  noteInput.value = typeof item.note === "string" ? item.note : "";
  noteInput.setAttribute("aria-label", "Note (facultative) de l'étape " + item.title);
  noteLabel.append(noteInput);
  const save = el("button", "primary", "Enregistrer");
  save.type = "submit";
  const cancel = el("button", "subtle", "Annuler");
  cancel.type = "button";
  const error = el("p", "edit-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  form.append(titleInput, select, noteLabel, save, cancel, error);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (noteInput.value.length > 2000) {
      error.textContent = "La note doit contenir au plus 2000 caractères.";
      error.hidden = false;
      noteInput.focus();
      return;
    }
    const trimmed = titleInput.value.trim();
    if (!trimmed || trimmed.length > 300) {
      error.textContent = "Le titre doit contenir entre 1 et 300 caractères.";
      error.hidden = false;
      titleInput.focus();
      return;
    }
    const next = updateItem(documentState, subject.id, item.id, { title: titleInput.value, priority: select.value, note: noteInput.value });
    editingItemId = null;
    focusItemId = item.id;
    if (next === documentState) { render(); return; }
    documentState = next;
    persist();
  });
  cancel.addEventListener("click", () => {
    editingItemId = null;
    focusItemId = item.id;
    render();
  });
  return form;
}
hideCompletedEl.addEventListener("change", () => {
  hideCompleted = hideCompletedEl.checked;
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openMenuId) {
    event.preventDefault();
    pendingMenuFocus = openMenuId;
    openMenuId = null;
    render();
    return;
  }
  if (event.key !== "Escape" || !dragState) return;
  event.preventDefault();
  cancelDrag(null);
});
document.addEventListener("click", (event) => {
  if (!openMenuId) return;
  const target = event.target;
  if (target && typeof target.closest === "function" &&
      (target.closest(".task-menu") || target.closest(".task-menu-button"))) {
    return;
  }
  openMenuId = null;
  render();
});
window.addEventListener("pointermove", (event) => {
  if (dragState) onDragMove(event);
});
window.addEventListener("pointerup", (event) => {
  if (dragState) onDragEnd(event);
});
window.addEventListener("pointercancel", (event) => {
  if (dragState) cancelDrag(event);
});
focusSuggestEl.addEventListener("click", () => {
  suggestionVisible = true;
  revealItemId = null;
  renderSuggestion();
});
subjectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = subjectForm.elements.namedItem("subject");
  if (!input.value.trim() || documentState.subjects.length >= 40) return;
  documentState.subjects.push(newSubject(input.value, crypto.randomUUID()));
  input.value = "";
  persist();
  input.focus();
});
document.querySelector("#export").addEventListener("click", () => {
  const committed = recordsToDocument(lastRecords);
  downloadJsonText(JSON.stringify(committed, null, 2), "threadstep-backup.json");
  notify("Export JSON généré depuis IndexedDB");
});
if (authLegacyExportEl) authLegacyExportEl.addEventListener("click", exportLegacyBackup);
if (localExportLegacyEl) localExportLegacyEl.addEventListener("click", exportLegacyBackup);
if (localConvertLegacyEl) localConvertLegacyEl.addEventListener("click", () => { void openLocalConversion(); });
if (localConversionConsentEl) localConversionConsentEl.addEventListener("change", () => {
  if (localConversionConfirmEl) {
    const plan = localConversionContext ? localConversionContext.plan : null;
    localConversionConfirmEl.disabled = !localConversionConsentEl.checked ||
      !plan || plan.operations.length === 0;
  }
});
if (localConversionConfirmEl) localConversionConfirmEl.addEventListener("click", () => { void confirmLocalConversion(); });
if (localConversionRefuseEl) localConversionRefuseEl.addEventListener("click", () => {
  hideLocalConversion();
  notify("Conversion locale refusée : la source historique et la cible IndexedDB restent inchangées.");
});
document.querySelector("#import").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("Fichier trop volumineux (maximum 1 Mo).");
    const incoming = parseDocument(await file.text());
    if (syncedDatabase) {
      if (!businessAllowed() || !documentLoaded) {
        notify("Connectez-vous et attendez la lecture IndexedDB avant tout import.");
        return;
      }
      await pendingCloudWrites;
      await offerJsonReconciliation(incoming);
      return;
    }
    if (!confirm("Remplacer toutes les données locales par cet import ?")) return;
    invalidatePendingRemoval();
    expandedParents = new Set();
    pendingCollapseFocus = null;
    openMenuId = null;
    documentState = incoming;
    documentLoaded = true;
    localWriteBlocked = false;
    await persist();
    if (!localWriteBlocked) notify("Import terminé localement dans IndexedDB");
  } catch {
    notify("Import impossible : lecture ou enregistrement refusé. Conservez votre export JSON.");
  } finally {
    event.target.value = "";
  }
});
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  invalidatePendingRemoval();
  load();
});
window.addEventListener("hashchange", () => {
  const nextRoute = parseRoute(location.hash);
  if (isViewEntry(route, nextRoute)) expandedParents = new Set();
  openMenuId = null;
  route = nextRoute;
  render();
});
snackbarEl.addEventListener("focusin", suspendRemovalTimer);
snackbarEl.addEventListener("focusout", (event) => {
  if (event.relatedTarget && snackbarEl.contains(event.relatedTarget)) return;
  resumeRemovalTimer();
});
if (authFormEl) authFormEl.addEventListener("submit", submitAuthForm);
// On mobile browsers a native form submit may be blocked by HTML validation
// or the strict form-action CSP before a visible login state transition.
// A direct click handler keeps the user action and feedback deterministic.
if (authSubmitEl) authSubmitEl.addEventListener("click", submitAuthForm);
if (authResendEl) authResendEl.addEventListener("click", resendOtp);
if (authCancelEl) authCancelEl.addEventListener("click", cancelOtp);
window.addEventListener("online", () => { if (authController) authController.refresh(); });
window.addEventListener("offline", () => { if (authController) authController.refresh(); });
if (cloudConfigFormEl) {
  cloudConfigFormEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = validateCloudUrl(cloudUrlEl ? cloudUrlEl.value : "");
    if (!result.valid) {
      showCloudConfigError(result.message);
      return;
    }
    if (!writeCloudConfig(localStorage, result.url)) {
      showCloudConfigError("Impossible d'enregistrer l'URL dans ce navigateur.");
      return;
    }
    if (cloudUrlEl) cloudUrlEl.value = result.url;
    hideCloudConfigError();
    syncedDatabase = bootstrapSyncedDatabase();
    businessStore = syncedDatabase ? createDexieStore(syncedDatabase) : null;
    documentState = emptyDocument();
    documentLoaded = false;
    lastRecords = emptyRecords();
    cloudWriteBlocked = false;
    localWriteBlocked = false;
    localReadFailed = false;
    pendingCloudWrites = Promise.resolve();
    authController = null;
    authInteraction = null;
    authSubmitting = false;
    businessStarted = false;
    changesSubscribed = false;
    authState = { status: AUTH_STATUS.LOADING, kind: null, message: "" };
    renderCloudConfig();
    renderLocalWorkspace();
    if (syncedDatabase) {
      setupAuthentication();
    } else {
      if (!localDatabase) localDatabase = bootstrapLocalDatabase();
      businessStore = createDexieStore(localDatabase);
      startLocalWorkspace();
    }
    notify("Instance Dexie Cloud enregistrée");
  });
}
function commitOperations(records) {
  const writeBlocked = syncedDatabase ? cloudWriteBlocked : localWriteBlocked;
  if (!businessAllowed() || !businessStore || writeBlocked) return Promise.resolve();
  pendingCloudWrites = pendingCloudWrites.then(async () => {
    if (syncedDatabase ? cloudWriteBlocked : localWriteBlocked) return;
    const operations = diffRecords(lastRecords, records);
    if (!operations.length) return;
    try {
      await businessStore.commit(operations);
      lastRecords = records;
      broadcastChange();
      if (syncedDatabase) {
        notify("Enregistré dans IndexedDB ; synchronisation Cloud à confirmer.");
      } else {
        setLocalError("");
        setLocalStatus("Enregistré sur cet appareil dans IndexedDB.");
        notify("Enregistré sur cet appareil dans IndexedDB.");
      }
    } catch (error) {
      documentState = recordsToDocument(lastRecords);
      render();
      if (syncedDatabase) {
        cloudWriteBlocked = true;
        const refusal = classifyPermissionFailure(error && error.cause ? error.cause : error);
        notify(refusal ? authMessage(refusal) :
          "Échec d'écriture IndexedDB : données non enregistrées. Conservez votre export JSON.");
      } else {
        localWriteBlocked = true;
        const message = isLocalError(error)
          ? "Échec de la transaction locale : la modification n'est pas enregistrée. Exportez votre sauvegarde puis rechargez."
          : "Échec d'écriture IndexedDB local : données non enregistrées. Conservez votre export JSON.";
        setLocalError(message);
        notify(message);
      }
    }
  });
  return pendingCloudWrites;
}
async function refreshSyncedDocument() {
  if (!syncedDatabase || !businessAllowed()) return;
  // Await previously submitted writes before replacing the DOM from IndexedDB.
  if (cloudReadPending) return cloudReadPending;
  cloudReadPending = (async () => {
    let writesSnapshot;
    let records;
    // Mutations may arrive while a reactive refresh reads IndexedDB. Never
    // replace a freshly edited UI with a stale snapshot.
    do {
      writesSnapshot = pendingCloudWrites;
      await writesSnapshot;
      records = await readTargetRecords();
    } while (writesSnapshot !== pendingCloudWrites);
    const nextDocument = recordsToDocument(records);
    documentState = nextDocument;
    lastRecords = records;
    documentLoaded = true;
    cloudWriteBlocked = false;
    resumeRef = readResumePreference();
    render();
    applyBusinessVisibility();
    notify("Données chargées depuis IndexedDB ; synchronisation Cloud à confirmer.");
  })().catch(() => {
    documentLoaded = false;
    applyBusinessVisibility();
    notify("Lecture IndexedDB impossible : affichage bloqué pour protéger les données. Ne réimportez pas.");
  }).finally(() => { cloudReadPending = null; });
  return cloudReadPending;
}
function ensureChangeChannel() {
  if (!changeChannel && typeof BroadcastChannel === "function") {
    changeChannel = new BroadcastChannel(CHANGE_CHANNEL);
  }
  return changeChannel;
}
function broadcastChange() {
  const channel = ensureChangeChannel();
  if (channel) channel.postMessage({ type: "records-changed" });
}
function subscribeToChanges() {
  const channel = ensureChangeChannel();
  if (channel && typeof channel.addEventListener === "function") {
    channel.addEventListener("message", () => { load(); });
  }
  // Dexie Cloud emits a sync completion when remote records have arrived.
  // The Dexie 'changes' event requires an addon absent from this bundle.
  if (syncedDatabase && syncedDatabase.cloud.events.syncComplete) {
    syncedDatabase.cloud.events.syncComplete.subscribe(() => {
      const attestation = evaluateSyncAttestation(nativeAttestationInput());
      migrationStatus = reduceReconciliationStatus(migrationStatus, {
        type: "sync-complete",
        attested: attestation.attested
      });
      load();
      if (!migrationContext) void offerHistoricalMigration();
    });
  }
}
let migrationPanelEl = null;
let migrationContext = null;
let migrationStatus = initialReconciliationStatus();

const CATEGORY_LABELS = {
  [CATEGORY.IDENTICAL]: "identiques",
  [CATEGORY.ABSENT]: "absents du Cloud",
  [CATEGORY.CONFLICT]: "en conflit",
  [CATEGORY.CLOUD_ONLY]: "propres au Cloud",
  [CATEGORY.INVALID]: "invalides"
};
const STORE_LABELS = { subjects: "Sujets", items: "Étapes" };
const FIELD_LABELS = {
  title: "titre",
  note: "note",
  priority: "priorité",
  done: "statut",
  order: "ordre",
  subjectId: "sujet",
  parentId: "parent"
};
const BLOCK_REASON_LABELS = {
  "unresolved-conflict": "conflit non résolu : conservez Cloud ou importez une copie",
  "kept-cloud": "version Cloud conservée, branche historique exclue",
  "subject-blocked": "sujet parent bloqué ou exclu",
  "parent-blocked": "parent bloqué ou exclu",
  "copy-collision": "identifiant de copie déjà occupé par un autre contenu",
  quota: "quota métier dépassé",
  invalid: "données invalides ou indéterminées"
};
function blockReasonLabel(reason) {
  return BLOCK_REASON_LABELS[reason] || "groupe bloqué ou indéterminé";
}

function migrationPanel() {
  if (!migrationPanelEl) {
    migrationPanelEl = el("section", "migration-panel");
    migrationPanelEl.id = "migration-panel";
    migrationPanelEl.setAttribute("aria-labelledby", "migration-title");
    migrationPanelEl.hidden = true;
    const container = document.querySelector("main.shell");
    if (container) container.append(migrationPanelEl);
  }
  return migrationPanelEl;
}
function migrationDestination() {
  const config = readCloudConfig();
  return shouldOpenSyncedDatabase(config) ? config.databaseUrl : null;
}
async function readTargetRecords() {
  return readSyncedRecords(syncedDatabase);
}
function observableValue(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}
function nativeAttestationInput() {
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  return {
    online: typeof navigator === "undefined" || navigator.onLine !== false,
    user: observableValue(cloud && cloud.currentUser),
    syncState: observableValue(cloud && cloud.syncState),
    persistedSyncState: persisted,
    databaseUrl: migrationDestination(),
    remoteDbId: persisted && typeof persisted.remoteDbId === "string" ? persisted.remoteDbId : null
  };
}
function destinationIdentity(attestation) {
  return {
    url: migrationDestination(),
    remoteDbId: attestation && attestation.identity ? attestation.identity.remoteDbId : null
  };
}
async function readAttestedTarget() {
  return withAttestedTarget(nativeAttestationInput(), () => readSyncedRecords(syncedDatabase));
}
function reconciliationBlockMessage(result) {
  if (result && result.status === "read-error") {
    return "Lecture IndexedDB impossible : migration bloquée sans conclure que le Cloud est vide. Vos sauvegardes restent intactes.";
  }
  const reason = result && result.reason
    ? result.reason
    : result && result.attestation
      ? result.attestation.reason
      : "indeterminate";
  return describeAttestationReason(reason);
}
function hideMigrationPanel() {
  migrationContext = null;
  if (!migrationPanelEl) return;
  migrationPanelEl.hidden = true;
  migrationPanelEl.replaceChildren();
}
function openReconciliation(documentValue, target, attestation, sourceKind) {
  const destination = destinationIdentity(attestation);
  const userId = attestation && attestation.identity ? attestation.identity.userId : null;
  const resolutions = {};
  const plan = planReconciliation({
    document: documentValue,
    target,
    destination,
    userId,
    resolutions
  });
  migrationContext = { document: documentValue, target, destination, userId, attestation, resolutions, plan, sourceKind };
  renderMigrationPanel(migrationContext);
}
function replanMigration() {
  const context = migrationContext;
  if (!context) return null;
  context.plan = planReconciliation({
    document: context.document,
    target: context.target,
    destination: context.destination,
    userId: context.userId,
    resolutions: context.resolutions
  });
  return context.plan;
}
function inventorySummary(view) {
  const lines = [];
  for (const store of ["subjects", "items"]) {
    const counts = view.counts ? view.counts[store] : null;
    if (!counts) continue;
    const parts = Object.keys(CATEGORY_LABELS).map((category) =>
      counts[category] + " " + CATEGORY_LABELS[category]);
    lines.push(STORE_LABELS[store] + " : " + parts.join(", ") + ".");
  }
  return lines;
}
function renderMigrationPanel(context, options = {}) {
  const panel = migrationPanel();
  if (!panel || !context) return;
  const view = buildReconciliationView(context.plan);
  panel.replaceChildren();
  const title = el("h2", "migration-title", "Réconcilier mes données existantes");
  title.id = "migration-title";
  title.tabIndex = -1;
  const live = el("p", "migration-live", "");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  live.textContent = context.plan.status === "already-migrated"
    ? "Tous les enregistrements historiques sont déjà présents ou résolus : aucune insertion n'est nécessaire."
    : view.operationCount + " insertion(s) indépendante(s) prévue(s), " + view.blocked.length + " groupe(s) bloqué(s). Rien n'est encore écrit.";
  const destinationText = context.destination && context.destination.url
    ? "Destination effective : " + context.destination.url +
      (context.destination.remoteDbId ? " (base " + context.destination.remoteDbId + ")" : "") + "."
    : "Aucune destination Cloud effective.";
  const disclosure = el("p", "migration-disclosure", destinationText);
  const inventory = el("div", "migration-inventory");
  for (const line of inventorySummary(view)) inventory.append(el("p", null, line));

  let conflictGroup = null;
  if (view.conflicts.length > 0) {
    conflictGroup = el("div", "migration-conflicts");
    conflictGroup.append(el("h3", null, "Conflits métier à résoudre"));
    view.conflicts.forEach((conflict, index) => {
      const fieldset = el("fieldset", "migration-conflict");
      const legend = el("legend", null,
        (conflict.store === "subjects" ? "Sujet" : "Étape") +
        " " + (conflict.title || conflict.id) +
        " — champs différents : " + conflict.fields.map((field) => FIELD_LABELS[field] || field).join(", "));
      fieldset.append(legend);
      for (const option of conflict.options) {
        const inputId = "migration-resolution-" + index + "-" + option;
        const input = el("input");
        input.type = "radio";
        input.name = "migration-resolution-" + index;
        input.value = option;
        input.id = inputId;
        input.dataset.key = conflict.key + ":" + option;
        if (context.resolutions[conflict.key] === option) input.checked = true;
        input.addEventListener("change", () => {
          context.resolutions[conflict.key] = option;
          replanMigration();
          renderMigrationPanel(context, { focusKey: input.dataset.key });
        });
        const label = el("label", "migration-conflict-option");
        label.htmlFor = inputId;
        label.append(input, el("span", null, option === RESOLUTION.KEEP_CLOUD
          ? "Conserver la version Cloud"
          : "Importer la version historique comme copie"));
        fieldset.append(label);
      }
      fieldset.append(el("p", "migration-conflict-hint",
        "Sans choix, ce groupe reste exclu et expliqué : aucun écrasement ni copie automatique."));
      conflictGroup.append(fieldset);
    });
  }

  let blockedGroup = null;
  if (view.blocked.length > 0) {
    blockedGroup = el("div", "migration-blocked");
    blockedGroup.append(el("h3", null, "Groupes bloqués ou exclus"));
    const list = el("ul");
    for (const entry of view.blocked) {
      list.append(el("li", null,
        (entry.store === "subjects" ? "Sujet" : "Étape") + " " + (entry.title || entry.id) +
        " : " + blockReasonLabel(entry.reason)));
    }
    blockedGroup.append(list);
  }

  const consentLabel = el("label", "migration-consent");
  const consentBox = el("input");
  consentBox.type = "checkbox";
  consentBox.id = "migration-consent";
  consentLabel.append(consentBox, el("span", null,
    " Je confirme explicitement l'import des seuls groupes indépendants vers cette destination Cloud. " +
    "La connexion OTP seule ne vaut pas consentement."));
  const actions = el("div", "migration-actions");
  const accept = el("button", "primary migration-accept", "Confirmer et importer");
  accept.type = "button";
  accept.id = "migration-confirm";
  accept.disabled = context.plan.operations.length === 0 || !consentBox.checked;
  consentBox.addEventListener("change", () => {
    accept.disabled = context.plan.operations.length === 0 || !consentBox.checked;
  });
  accept.addEventListener("click", () => confirmReconciliation(context));
  const refuse = el("button", "secondary migration-refuse", "Conserver localement");
  refuse.type = "button";
  refuse.addEventListener("click", () => {
    hideMigrationPanel();
    notify("Migration refusée : vos données locales et le Cloud restent inchangés.");
  });
  actions.append(accept, refuse);
  panel.append(title, live, disclosure, inventory);
  if (conflictGroup) panel.append(conflictGroup);
  if (blockedGroup) panel.append(blockedGroup);
  panel.append(consentLabel, actions);
  panel.hidden = false;
  title.focus();
  if (options.focusKey) {
    const next = Array.from(panel.querySelectorAll("input"))
      .find((input) => input.dataset.key === options.focusKey);
    if (next) next.focus();
  }
}
function renderMigrationBlocked(result) {
  const panel = migrationPanel();
  if (!panel) return;
  panel.replaceChildren();
  const title = el("h2", "migration-title", "Migration temporairement bloquée");
  title.id = "migration-title";
  title.tabIndex = -1;
  const body = el("p", "migration-disclosure", reconciliationBlockMessage(result));
  const detail = el("p", "migration-disclosure",
    "Aucune écriture n'est effectuée et votre sauvegarde threadstep.document.v1 ou votre fichier JSON reste intact.");
  const actions = el("div", "migration-actions");
  const close = el("button", "secondary migration-refuse", "Fermer");
  close.type = "button";
  close.addEventListener("click", () => hideMigrationPanel());
  actions.append(close);
  panel.append(title, body, detail, actions);
  panel.hidden = false;
  title.focus();
}
async function offerHistoricalMigration() {
  if (!businessAllowed()) return;
  const detected = detectHistoricalDocument(localStorage);
  const destination = migrationDestination();
  if (detected.status !== "present" || !destination || !businessStore) {
    hideMigrationPanel();
    return;
  }
  const result = await readAttestedTarget();
  if (result.status !== "ready") {
    renderMigrationBlocked(result);
    notify(reconciliationBlockMessage(result));
    return;
  }
  openReconciliation(detected.document, result.records, result.attestation, "historical");
}
async function offerJsonReconciliation(documentValue) {
  const destination = migrationDestination();
  if (!destination || !businessStore) {
    notify("Import Cloud indisponible : configurez une destination Dexie Cloud. Votre fichier JSON est intact.");
    return;
  }
  const result = await readAttestedTarget();
  if (result.status !== "ready") {
    renderMigrationBlocked(result);
    notify(reconciliationBlockMessage(result));
    return;
  }
  openReconciliation(documentValue, result.records, result.attestation, "json");
}
function reconciliationAdapter() {
  return {
    commit(operations) {
      if (!Array.isArray(operations) || operations.some((operation) => operation.type !== "add")) {
        return Promise.reject(new Error("La réconciliation n'accepte que des insertions add."));
      }
      return businessStore.commit(operations);
    }
  };
}
async function confirmReconciliation(context) {
  const consentBox = document.querySelector("#migration-consent");
  if (!consentBox || !consentBox.checked) {
    notify("Consentement explicite requis avant toute écriture de migration.");
    return;
  }
  await pendingCloudWrites;
  const result = await readAttestedTarget();
  if (result.status !== "ready") {
    notify(reconciliationBlockMessage(result));
    return;
  }
  let documentValue = context.document;
  if (context.sourceKind === "historical") {
    const detected = detectHistoricalDocument(localStorage);
    if (detected.status !== "present") {
      notify("Migration interrompue : sauvegarde source non disponible ou modifiée. Votre export JSON reste intact.");
      return;
    }
    documentValue = detected.document;
  }
  const destination = destinationIdentity(result.attestation);
  const userId = result.attestation && result.attestation.identity
    ? result.attestation.identity.userId : null;
  const fresh = planReconciliation({
    document: documentValue,
    target: result.records,
    destination,
    userId,
    resolutions: context.resolutions
  });
  context.document = documentValue;
  context.target = result.records;
  context.destination = destination;
  context.userId = userId;
  context.attestation = result.attestation;
  context.plan = fresh;
  if (fresh.status !== "ready" && fresh.status !== "already-migrated") {
    renderMigrationPanel(context);
    notify("Plan modifié depuis la prévisualisation : relisez l'inventaire. Aucune écriture effectuée.");
    return;
  }
  const consent = { confirmed: true, fingerprint: fresh.fingerprint };
  const outcome = await runReconciliation(reconciliationAdapter(), fresh, consent, async () => {
    const refreshed = await readAttestedTarget();
    return {
      attestation: refreshed.attestation,
      document: documentValue,
      target: refreshed.records,
      destination: destinationIdentity(refreshed.attestation),
      userId: refreshed.attestation && refreshed.attestation.identity
        ? refreshed.attestation.identity.userId : null
    };
  });
  if (outcome.status === "local-written") {
    migrationStatus = reduceReconciliationStatus(migrationStatus, {
      type: "committed",
      online: typeof navigator === "undefined" || navigator.onLine !== false
    });
    hideMigrationPanel();
    await refreshSyncedDocument();
    notify(migrationStatus.status === RECONCILIATION_STATUS.OFFLINE_PENDING
      ? "Écrit localement ; synchronisation Cloud en attente hors ligne. Aucun push distant n'est confirmé."
      : "Écrit localement dans IndexedDB ; synchronisation Cloud en attente. Aucun push distant n'est confirmé.");
  } else if (outcome.status === "already-migrated" || outcome.status === "up-to-date") {
    hideMigrationPanel();
    await refreshSyncedDocument();
    notify("Aucune nouvelle insertion nécessaire : les éléments déjà présents ou copiés sont reconnus.");
  } else if (outcome.status === "stale-plan") {
    renderMigrationPanel(context);
    notify("Plan périmé : source, destination, session ou cible modifiée. Nouvelle revue nécessaire, aucune écriture.");
  } else if (outcome.status === "refused" || outcome.status === "consent-mismatch") {
    notify("Migration refusée : consentement absent ou lié à un autre plan. Aucune écriture.");
  } else if (outcome.status === "sync-blocked") {
    notify(describeAttestationReason(outcome.reason));
  } else if (outcome.status === "read-error") {
    notify("Lecture de revalidation impossible : migration bloquée, cible et source inchangées.");
  } else if (outcome.status === "failed") {
    migrationStatus = reduceReconciliationStatus(migrationStatus, { type: "transaction-error" });
    notify("Échec de la transaction : aucun groupe partiel écrit, cible et source inchangées.");
  } else if (outcome.status === "invalid-plan") {
    notify("Plan invalide : seules des insertions add sont autorisées. Aucune écriture.");
  } else {
    notify("Migration interrompue : aucune écriture confirmée.");
  }
}

syncedDatabase = bootstrapSyncedDatabase();
historicalGuard = compatibilityGuard(localStorage);
renderCloudConfig();
renderLocalWorkspace();
if (syncedDatabase) {
  businessStore = createDexieStore(syncedDatabase);
  setupAuthentication();
} else {
  try {
    localDatabase = bootstrapLocalDatabase();
    businessStore = createDexieStore(localDatabase);
  } catch {
    localDatabase = null;
    businessStore = null;
  }
  startLocalWorkspace();
}

