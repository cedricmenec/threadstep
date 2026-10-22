import { PRIORITIES, emptyDocument, newSubject, newItem, subjectRoute, parseRoute, findSubject, renameSubject, visibleItems, overviewPreview, isWithinOverviewPreview, substepView, substepToggleLabel, toggleExpandedParent, substepAncestorId, isViewEntry, routeHeadingId, navigationMenuState, pendingCount, totalTaskCount, totalTaskCountLabel, moveSubject, updateItem, setItemPriority, reorderWithinPriority, moveWithinPriority, canMoveWithinPriority, canReorderWithinPriority, itemMenuCommands, promoteItemToTopLevel, nextActionSuggestion, suggestionReason, resumeView, planRemoval, restoreRemoval, removalContainsItem, restorableTrackingRef } from "./core.js";
import { readCloudConfig, writeCloudConfig, validateCloudUrl, shouldOpenSyncedDatabase, cloudConfigureOptions, dexieSchema, openLocalDatabase, SCHEMA_VERSION, LOCAL_DATABASE_NAME } from "./dexie-foundation.js";
import {
  ACTIVATION_STAGE,
  ACTIVATION_STATUS,
  FIRST_SYNC,
  TARGET_CLASSIFICATION,
  classifyTarget,
  createActivationRecord,
  describeActivationStage,
  canCompleteReadOnlyActivation,
  describeTargetClassification,
  initialActivationState,
  initialFirstSyncState,
  readActivationRecord,
  reduceFirstSync,
  resolveStartupWorkspace,
  transitionActivation,
  writeActivationRecord
} from "./cloud-activation.js";
import { documentToRecords, recordsToDocument, diffRecords, emptyRecords, normalizedRecords, isLocalError, createDexieStore } from "./persistence.js";
import {
  CATEGORY,
  RECONCILIATION_STATUS,
  RESOLUTION,
  buildReconciliationView,
  computeSourceRecordsFingerprint,
  describeAttestationReason,
  evaluateSyncAttestation,
  initialReconciliationStatus,
  planReconciliation,
  reduceReconciliationStatus,
  reviewDisplayedPlan,
  runReconciliation,
  withAttestedTarget
} from "./migration-reconciliation.js";
import {
  createGenerationGuard,
  footerMessage,
  initialFooterStatus,
  reduceFooterStatus
} from "./migration-lifecycle.js";
import { AUTH_MESSAGE_KINDS, AUTH_STATUS, authMessage, canAccessBusiness, classifyPermissionFailure, createAuthController, signInMethods } from "./authentication.js";
import { CLEANUP_CODE, buildCleanupInventory, evaluateCleanup, runCleanup } from "./local-recovery.js";
import { LOCAL_MERGE_STATUS, planModernRecordsMerge } from "./local-migration.js";
import { createDexieMetadataStore } from "./local-metadata.js";
import { BACKUP_FORMAT, parseIndexedDbBackup, unsupportedV1Refusal } from "./indexeddb-backup.js";
import { readSyncedRaw, readSyncedRecords, readSyncedWorkspace } from "./synced-records.js";
import {
  ANOMALY,
  READ_FAILURE,
  REPAIR_OUTCOME,
  REPAIR_STATE,
  buildBusinessExport,
  buildDegradedView,
  buildIntegrityInventory,
  buildRawRecoveryExport,
  buildRepairPlan,
  buildRestorePlan,
  buildRepairRecoverySnapshot,
  evaluateBusinessExport,
  hasBlockingAnomaly,
  initialRepairStatus,
  readWorkspaceResult,
  reduceRepairConvergence,
  runRepair,
  repairEvent,
  sanitizeInstanceContext,
  summarizeIntegrityInventory,
  verifyRecoverySnapshot
} from "./data-integrity-recovery.js";
import {
  INITIAL_PULL,
  LOCAL_WRITE_STATE,
  buildDiagnosticSummary,
  buildDiagnosticView,
  buildSyncDiagnostic,
  createSyncDiagnosticsController,
  normalizeSyncState,
  reduceLocalWriteStatus,
  retryReasonLabel
} from "./sync-diagnostics.js";
import {
  OVERVIEW_DURABLE_WAIT_MS,
  OVERVIEW_LOADER_DELAY_MS,
  OVERVIEW_LOADER_TEXT,
  OVERVIEW_PRESENTATION_STATE,
  buildOverviewReadPresentation
} from "./overview-read-state.js";
import {
  SHARE_MESSAGES,
  SHARE_STATUS,
  buildSyncDiagnosticReport,
  createDiagnosticSharingController
} from "./sync-diagnostic-report.js";
import {
  createSyncLifecycleInstrumentation
} from "./sync-lifecycle-instrumentation.js";
import {
  buildSyncObservationRecord,
  buildTrustGuidance,
  resolveObservedSync,
  shouldRecordSyncObservation,
  writeSyncObservation
} from "./sync-trust-guidance.js";
import {
  localDiagnosticError,
  onboardingView,
  overviewAccessLinkVisible,
  syncSectionVisibility
} from "./cloud-settings.js";
import {
  BINDING_STATE,
  PENDING_STATE,
  WORKSPACE_SELECTION_LOCAL,
  WORKSPACE_STATUS,
  WORKSPACE_TYPE,
  activationRecordForWorkspace,
  buildWorkspaceDiagnostic,
  describeBindingState,
  evaluateAccountBinding,
  initializeWorkspaceRegistry,
  isRecoverableUnverifiedWorkspace,
  pendingChangeWarning,
  pendingStatusFromMutationTables,
  planWorkspaceLogout,
  planUnverifiedCloudRecovery,
  planWorkspacePurge,
  planWorkspaceResume,
  planWorkspaceSelection,
  planWorkspaceSuspension,
  readWorkspaceRegistryState,
  registerWorkspace,
  resolveWorkspaceStartup,
  selectWorkspaceInRegistry,
  updateWorkspaceStatus,
  workspaceDatabaseName,
  writeWorkspaceBinding,
  writeWorkspaceRegistry
} from "./workspace-identity.js";
import {
  BOOTSTRAP_EVENT,
  classifyBootstrapCause,
  createBootstrapTrace,
  writeBootstrapTrace
} from "./bootstrap-diagnostics.js";
import { Dexie, dexieCloud } from "./vendor/dexie-cloud.mjs";
import { selectReadingAnchor, resolveReadingAnchor, readingScrollDelta, shouldRestoreInteraction, authorizedWorkspaceIdentityKey, shouldResetExpandedParents } from "./interaction-continuity.js";

const subjectsEl = document.querySelector("#subjects");
const projectsLoadingEl = document.querySelector("#projects-loading");
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
const navMenuButtonEl = document.querySelector("#nav-menu-button");
const navMenuPanelEl = document.querySelector("#nav-menu-panel");
const settingsPageEl = document.querySelector("#settings-page");
const settingsDataPageEl = document.querySelector("#settings-data-page");
const settingsSyncPageEl = document.querySelector("#settings-sync-page");
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
const localPanelEl = document.querySelector("#local-panel");
const cleanupPanelEl = document.querySelector("#legacy-cleanup");
const cleanupListEl = document.querySelector("#legacy-cleanup-list");
const cleanupScopeEl = document.querySelector("#legacy-cleanup-scope");
const cleanupBackupStatusEl = document.querySelector("#legacy-cleanup-backup-status");
const cleanupKeepEl = document.querySelector("#legacy-cleanup-keep");
const cleanupConfirmEl = document.querySelector("#legacy-cleanup-confirm");
const cleanupDeleteEl = document.querySelector("#legacy-cleanup-delete");
const cleanupStatusEl = document.querySelector("#legacy-cleanup-status");
const recoveryBusinessStatusEl = document.querySelector("#recovery-business-status");
const cloudActivationEl = document.querySelector("#cloud-activation");
const cloudActivationStageEl = document.querySelector("#cloud-activation-stage");
const cloudActivationStatusEl = document.querySelector("#cloud-activation-status");
const cloudActivationDestinationEl = document.querySelector("#cloud-activation-destination");
const cloudActivationReviewEl = document.querySelector("#cloud-activation-review");
const cloudActivationConsentEl = document.querySelector("#cloud-activation-consent");
const cloudActivationStartEl = document.querySelector("#cloud-activation-start");
const cloudActivationResumeEl = document.querySelector("#cloud-activation-resume");
const cloudActivationConfirmEl = document.querySelector("#cloud-activation-confirm");
const cloudActivationCancelEl = document.querySelector("#cloud-activation-cancel");
const cloudActivationRetryEl = document.querySelector("#cloud-activation-retry");
const cloudActivationStagesEl = document.querySelector("#cloud-activation-stages");
const workspacePanelEl = document.querySelector("#workspace-panel");
const workspaceStatusEl = document.querySelector("#workspace-status");
const workspaceSelectEl = document.querySelector("#workspace-select");
const workspaceApplyEl = document.querySelector("#workspace-apply");
const workspaceSuspendEl = document.querySelector("#workspace-suspend");
const workspaceLogoutEl = document.querySelector("#workspace-logout");
const workspacePurgeEl = document.querySelector("#workspace-purge");
const workspaceBindingStatusEl = document.querySelector("#workspace-binding-status");
const workspaceRecoverEl = document.querySelector("#workspace-recover");
const workspaceConfirmationEl = document.querySelector("#workspace-confirmation");
const workspaceConfirmationTitleEl = document.querySelector("#workspace-confirmation-title");
const workspaceConfirmationScopeEl = document.querySelector("#workspace-confirmation-scope");
const workspaceConfirmationWarningEl = document.querySelector("#workspace-confirmation-warning");
const workspaceConfirmationCancelEl = document.querySelector("#workspace-confirmation-cancel");
const workspaceConfirmationContinueEl = document.querySelector("#workspace-confirmation-continue");
const workspaceBackupEl = document.querySelector("#workspace-backup");
const workspaceConfirmationStatusEl = document.querySelector("#workspace-confirmation-status");
const localStatusEl = document.querySelector("#local-status");
const localStorageErrorEl = document.querySelector("#local-storage-error");
const syncDiagnosticEl = document.querySelector("#sync-diagnostic");
const syncTrustLocationBodyEl = document.querySelector("#sync-trust-location-body");
const syncTrustEvidenceBodyEl = document.querySelector("#sync-trust-evidence-body");
const syncTrustActionsBodyEl = document.querySelector("#sync-trust-actions-body");
const syncSummaryEl = document.querySelector("#sync-summary");
const syncSettingsAccessEl = document.querySelector("#sync-settings-access");
const syncOnboardingStepEl = document.querySelector("#sync-onboarding-step");
const syncOnboardingMessageEl = document.querySelector("#sync-onboarding-message");
const syncOnboardingNextEl = document.querySelector("#sync-onboarding-next");
const syncConfigurationSectionEl = document.querySelector("#sync-configuration-section");
const syncActivationSectionEl = document.querySelector("#sync-activation-section");
const syncConnectionSectionEl = document.querySelector("#sync-connection-section");
const syncWorkspacesSectionEl = document.querySelector("#sync-workspaces-section");
const recoveryPanelEl = document.querySelector("#recovery-panel");
const recoveryInstanceEl = document.querySelector("#recovery-instance");
const recoveryReadCodeEl = document.querySelector("#recovery-read-code");
const recoveryDegradedEl = document.querySelector("#recovery-degraded");
const recoveryAnomaliesEl = document.querySelector("#recovery-anomalies");
const recoveryRawExportEl = document.querySelector("#recovery-raw-export");
const recoveryRepairPreviewEl = document.querySelector("#recovery-repair-preview");
const repairPreviewEl = document.querySelector("#repair-preview");
const repairPreviewSummaryEl = document.querySelector("#repair-preview-summary");
const repairSourceEl = document.querySelector("#repair-source");
const repairGroupsEl = document.querySelector("#repair-groups");
const repairBackupStatusEl = document.querySelector("#repair-backup-status");
const repairConsentEl = document.querySelector("#repair-consent");
const repairConfirmEl = document.querySelector("#repair-confirm");
const repairCancelEl = document.querySelector("#repair-cancel");
const repairStatusEl = document.querySelector("#repair-status");
const restorePanelEl = document.querySelector("#restore-panel");
const restoreScopeEl = document.querySelector("#restore-scope");
const restoreBackupStatusEl = document.querySelector("#restore-backup-status");
const restoreDownloadBackupEl = document.querySelector("#restore-download-backup");
const restoreConfirmationEl = document.querySelector("#restore-confirmation");
const restoreConfirmEl = document.querySelector("#restore-confirm");
const restoreCancelEl = document.querySelector("#restore-cancel");
const restoreStatusEl = document.querySelector("#restore-status");
const restoreInputEl = document.querySelector("#restore");
let syncedDatabase = null;
let localDatabase = null;
let workspaceRegistry = null;
let workspaceRegistryInvalid = false;
let workspaceStartup = null;
let workspaceEntry = null;
let accountBinding = { state: BINDING_STATE.INDETERMINATE, businessAllowed: false };
let bindingCacheHasRecords = null;
let bindingIdentityPending = false;
let bindingWriteFailed = false;
let bootstrapTrace = createBootstrapTrace();
let workspaceConfirmation = null;
let workspaceBusy = false;
let bindingGeneration = 0;
let activationLifecycle = createGenerationGuard();
let activationState = initialActivationState();
let activationStatus = initialFirstSyncState();
let activationContext = null;
let activationStartup = null;
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
let expandedParentIdentityKey = null;
let dragState = null;
let route = parseRoute(location.hash);
let renamingSubject = false;
let focusDetailHeading = false;
let focusOpenSubjectId = null;
let focusRenameControl = false;
let openMenuId = null;
let pendingMenuFocus = null;
let navMenuOpen = false;
let pendingNavigationFocus = null;
let pendingTaskCreationFocus = null;
let lastRenderedUxContext = null;
let uxRenderVersion = 0;
let overviewPresentationSnapshot = null;
let overviewPendingSince = null;
let overviewPresentationBoundary = null;
let overviewPresentationTimer = null;
let overviewPresentationTimerGeneration = 0;
let overviewSummaryKey = "";
let overviewLoaderBusy = null;

const CHANGE_CHANNEL = "threadstep.changes.v1";
let businessStore = null;
let changeChannel = null;
let lastRecords = emptyRecords();
let pendingCloudWrites = Promise.resolve();
let cloudWriteBlocked = false;
let cloudReadPending = null;
let cloudReadReplayRequested = false;
let localReadPending = null;
let localReadFailed = false;
let localWriteBlocked = false;
let syncDiagnosticsController = null;
let syncDiagnosticsSubscribedFor = null;
let syncReadError = null;
let localWriteStatus = LOCAL_WRITE_STATE.NOT_APPLICABLE;
let syncRetryBusy = false;
let syncDiagnosticAnnouncement = "";
let syncSharingController = null;
let syncSharingState = {
  status: { kind: SHARE_STATUS.IDLE, message: SHARE_MESSAGES[SHARE_STATUS.IDLE] },
  previewOpen: false,
  hasReport: false,
  text: null
};
let lastSyncDiagnostic = null;
const syncLifecycle = createSyncLifecycleInstrumentation();
let recoveryContext = null;
let repairContext = null;
let repairStatus = initialRepairStatus();
let restoreContext = null;
let metadataStore = null;
let metadataMigrationComplete = false;
let modernBackupVerified = false;
let cleanupInventory = { status: "empty", keys: [], scope: "current-origin" };
let localImportContext = null;
const UNDO_WINDOW_MS = 10000;
let pendingRemoval = null;
let removalTimer = null;
let removalDeadline = 0;

const priorityLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };
let footerStatus = initialFooterStatus();
function publishFooter(event) {
  footerStatus = reduceFooterStatus(footerStatus, event);
  if (statusEl) statusEl.textContent = footerMessage(footerStatus);
}
function notify(message) {
  publishFooter({ type: "notice", message });
}
function notifyError(message) {
  publishFooter({ type: "error", message });
}
function requiresAuthentication() {
  return !!syncedDatabase;
}
function selectedSyncedEntry() {
  return workspaceEntry && workspaceEntry.type === WORKSPACE_TYPE.SYNCHRONIZED
    ? workspaceEntry
    : null;
}
function bindingAllowsBusiness() {
  return !requiresAuthentication() || accountBinding.businessAllowed === true;
}
function businessAllowed() {
  if (!requiresAuthentication()) return true;
  return bindingAllowsBusiness() && canAccessBusiness(authState);
}
function bootstrapSyncedDatabase(entry) {
  const config = readCloudConfig();
  if (!shouldOpenSyncedDatabase(config)) return null;
  const schema = dexieSchema();
  const options = cloudConfigureOptions(config.databaseUrl);
  const databaseName = entry && typeof entry.databaseName === "string"
    ? entry.databaseName
    : schema.name;
  const db = new Dexie(databaseName, { addons: [dexieCloud] });
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
function setupMetadataStore(db) {
  const synced = !!syncedDatabase && db === syncedDatabase;
  metadataStore = db ? createDexieMetadataStore(db, localStorage, {
    isRefAvailable: synced
      ? async (ref) => {
        const subject = await db.subjects.get(ref.subjectId);
        const item = await db.items.get(ref.itemId);
        return !!subject && !!item && item.subjectId === subject.id;
      }
      : null
  }) : null;
  metadataMigrationComplete = false;
}
async function reloadMetadataPreference() {
  if (!metadataStore) {
    metadataMigrationComplete = false;
    resumeRef = null;
    return;
  }
  try {
    const migration = await metadataStore.migratePreferences();
    metadataMigrationComplete = migration && migration.migrationComplete === true;
    resumeRef = await metadataStore.readResume();
  } catch {
    metadataMigrationComplete = false;
    resumeRef = null;
    notifyError("Métadonnées locales indisponibles : la préférence de reprise n'est pas annoncée comme durablement enregistrée.");
  }
  renderCleanupPanel();
}
// TS-038 workspace identity, binding and scoped destructive actions ----------------

function recordBootstrap(event) {
  if (!event || typeof event.code !== "string") return false;
  const added = bootstrapTrace.add(event);
  // The trace is overwritten at each bootstrap and stays bounded; a storage
  // failure never blocks startup or authorizes any action.
  writeBootstrapTrace(localStorage, bootstrapTrace.snapshot());
  return added;
}
function activationAttestationFor(entry) {
  const record = activationMarker();
  if (!record || !entry) return null;
  const sameUrl = typeof record.url === "string" && record.url === entry.url;
  if (!sameUrl || typeof record.userDigest !== "string") return null;
  return { ...record, databaseName: entry.databaseName };
}
function currentBootstrapClassification() {
  const entry = selectedSyncedEntry();
  const record = activationAttestationFor(entry);
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  const observedRemote = persisted && typeof persisted.remoteDbId === "string"
    ? persisted.remoteDbId : null;
  const entryRemote = entry && typeof entry.remoteDbId === "string"
    ? entry.remoteDbId : null;
  const hasPriorDigest = (!!record && !!record.userDigest) ||
    !!(entry && typeof entry.userDigest === "string" && entry.userDigest.length > 0);
  const classification = classifyBootstrapCause({
    destinationChanged: accountBinding.state === BINDING_STATE.DESTINATION_MISMATCH ||
      (!!entryRemote && !!observedRemote && entryRemote !== observedRemote),
    accountChanged: accountBinding.state === BINDING_STATE.MISMATCH,
    bindingWriteFailed: bindingWriteFailed === true,
    identityPending: bindingIdentityPending === true,
    recovered: accountBinding.adopt === true,
    firstPullCompleted: !hasPriorDigest &&
      bindingCacheHasRecords === true &&
      !!entry && entry.databaseName === workspaceDatabaseName(entry.url) &&
      !!persisted && persisted.initiallySynced === true,
    cacheHasRecords: bindingCacheHasRecords === true,
    attestationPresent: hasPriorDigest
  });
  return classification;
}
function persistWorkspaceRegistry(next) {
  if (!next) return false;
  if (!writeWorkspaceRegistry(localStorage, next)) return false;
  workspaceRegistry = next;
  workspaceEntry = next.selected === WORKSPACE_SELECTION_LOCAL
    ? null
    : next.workspaces[next.selected] || null;
  return true;
}
function persistActivationMarkerFor(registry, url) {
  const entry = registry && registry.workspaces ? registry.workspaces[url] : null;
  if (!entry) return true;
  const record = activationRecordForWorkspace(entry, activationMarker());
  if (!record) return true;
  return writeActivationRecord(localStorage, createActivationRecord({
    status: record.status,
    url: record.url,
    remoteDbId: record.remoteDbId,
    sourceFingerprint: record.sourceFingerprint,
    userDigest: record.userDigest
  }));
}
function diagnosticSessionCategory() {
  const status = authState && authState.status;
  if (status === AUTH_STATUS.AUTHENTICATED) return "authenticated";
  if (status === AUTH_STATUS.LOADING) return "loading";
  if (status === AUTH_STATUS.SIGNED_OUT) return "signed-out";
  if (status === AUTH_STATUS.EXPIRED) return "expired";
  if (status === AUTH_STATUS.REFUSED) return "refused";
  return "indeterminate";
}
function workspaceDiagnosticInput() {
  const entry = selectedSyncedEntry();
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  return buildWorkspaceDiagnostic({
    type: syncedDatabase ? WORKSPACE_TYPE.SYNCHRONIZED : WORKSPACE_TYPE.LOCAL,
    entry,
    effectiveBase: syncedDatabase && typeof syncedDatabase.name === "string"
      ? syncedDatabase.name : LOCAL_DATABASE_NAME,
    url: entry ? entry.url : null,
    remoteDbId: persisted && typeof persisted.remoteDbId === "string"
      ? persisted.remoteDbId : null,
    session: diagnosticSessionCategory(),
    binding: accountBinding.state
  });
}
function renderWorkspacePanel() {
  if (!workspacePanelEl) return;
  const registry = workspaceRegistry;
  const selected = registry ? registry.selected : WORKSPACE_SELECTION_LOCAL;
  if (workspaceSelectEl) {
    workspaceSelectEl.replaceChildren();
    const localOption = el("option", null, "Espace local autonome");
    localOption.value = WORKSPACE_SELECTION_LOCAL;
    workspaceSelectEl.append(localOption);
    if (registry) {
      const entries = Object.values(registry.workspaces)
        .sort((left, right) => left.url.localeCompare(right.url));
      for (const entry of entries) {
        const label = entry.url + " (" + entry.status + ")";
        const option = el("option", null, label);
        option.value = entry.url;
        workspaceSelectEl.append(option);
      }
    }
    workspaceSelectEl.value = registry ? selected : WORKSPACE_SELECTION_LOCAL;
    if (workspaceSelectEl.value !== (registry ? selected : WORKSPACE_SELECTION_LOCAL)) {
      workspaceSelectEl.value = WORKSPACE_SELECTION_LOCAL;
    }
  }
  const entry = selectedSyncedEntry();
  const entryForSelection = registry && selected !== WORKSPACE_SELECTION_LOCAL
    ? registry.workspaces[selected] : null;
  if (workspaceStatusEl) {
    if (workspaceRegistryInvalid) {
      workspaceStatusEl.textContent =
        "Registre d'espaces illisible : l'espace local autonome est ouvert. Aucune purge ni copie n'est autorisée.";
    } else if (syncedDatabase && entry) {
      workspaceStatusEl.textContent =
        "Espace synchronisé actif : " + entry.url + ". Base locale effective : " +
        (syncedDatabase.name || entry.databaseName) + ".";
    } else if (entryForSelection && entryForSelection.status === WORKSPACE_STATUS.SUSPENDED) {
      workspaceStatusEl.textContent =
        "Espace Cloud suspendu : " + entryForSelection.url +
        " (" + entryForSelection.databaseName + "). Il reste sélectionnable pour une reprise explicite.";
    } else if (entryForSelection && entryForSelection.status === WORKSPACE_STATUS.CANCELLED) {
      workspaceStatusEl.textContent =
        "Espace Cloud annulé : " + entryForSelection.url +
        ". Aucun nouveau transfert n'est déclenché automatiquement.";
    } else {
      workspaceStatusEl.textContent =
        "Espace local autonome actif. Aucune réplication Cloud n'est tentée.";
    }
  }
  const suspended = !!entryForSelection &&
    (entryForSelection.status === WORKSPACE_STATUS.SUSPENDED ||
      entryForSelection.status === WORKSPACE_STATUS.CANCELLED);
  if (workspaceSuspendEl) workspaceSuspendEl.disabled = !entry || suspended || workspaceBusy;
  if (workspaceLogoutEl) workspaceLogoutEl.disabled = !entry || workspaceBusy;
  if (workspacePurgeEl) workspacePurgeEl.disabled = workspaceBusy;
  if (workspaceRecoverEl) {
    workspaceRecoverEl.hidden = !isRecoverableUnverifiedWorkspace(entry, accountBinding.state);
    workspaceRecoverEl.disabled = workspaceBusy;
  }
  if (workspaceBindingStatusEl) {
    if (syncedDatabase) {
      const extra = accountBinding.state === BINDING_STATE.UNVERIFIED
        ? " OTP confirmé, cache Cloud non vérifié. Utilisez « Retrouver les projets Cloud dans un nouveau cache isolé » ; l'ancien cache restera intact."
        : accountBinding.state === BINDING_STATE.MISMATCH ||
          accountBinding.state === BINDING_STATE.INDETERMINATE
          ? " Les données restent masquées. Ne purgez aucun cache sans sauvegarde vérifiée."
          : "";
      workspaceBindingStatusEl.textContent = describeBindingState(accountBinding.state) + extra;
    } else {
      workspaceBindingStatusEl.textContent = "";
    }
  }
}
function setWorkspaceConfirmationStatus(message) {
  if (!workspaceConfirmationStatusEl) return;
  workspaceConfirmationStatusEl.textContent = typeof message === "string" ? message : "";
}
function hideWorkspaceConfirmation() {
  workspaceConfirmation = null;
  if (workspaceConfirmationEl) workspaceConfirmationEl.hidden = true;
  setWorkspaceConfirmationStatus("");
}
function showWorkspaceConfirmation(kind, entry, pending) {
  workspaceConfirmation = { kind, entry, pending };
  if (!workspaceConfirmationEl) return;
  workspaceConfirmationEl.hidden = false;
  if (workspaceConfirmationTitleEl) {
    workspaceConfirmationTitleEl.textContent = kind === "recover"
      ? "Récupérer le Cloud dans un cache isolé"
      : kind === "logout" ? "Confirmer la déconnexion" : "Confirmer la purge locale";
  }
  if (workspaceConfirmationScopeEl) {
    workspaceConfirmationScopeEl.textContent = kind === "recover"
      ? "L'ancien cache IndexedDB sera conservé intact. Une nouvelle base locale isolée " +
        "sera créée pour relire uniquement les données autorisées sur le serveur Dexie Cloud. " +
        "Aucune donnée n'est copiée depuis le cache non vérifié."
      : entry
        ? "Espace synchronisé : " + entry.url + ". Base locale effective : " + entry.databaseName +
          ". La copie distante n'est pas supprimée."
        : "Espace local autonome. Base locale effective : " + LOCAL_DATABASE_NAME + ".";
  }
  if (workspaceConfirmationWarningEl) {
    workspaceConfirmationWarningEl.textContent = kind === "recover"
      ? "La connexion et la destination ont été vérifiées, et aucune mutation native en attente " +
        "n'a été détectée. Cela ne prouve pas que toutes les données du cache historique " +
        "sont présentes sur le serveur. L'ancien cache reste accessible pour récupération. " +
        "Une nouvelle connexion par code peut être nécessaire."
      : pendingChangeWarning(pending);
  }
  if (workspaceConfirmationContinueEl) {
    workspaceConfirmationContinueEl.textContent = kind === "recover"
      ? "Créer la nouvelle copie Cloud"
      : kind === "logout" ? "Confirmer la déconnexion" : "Purger cette copie locale";
    workspaceConfirmationContinueEl.disabled = false;
    workspaceConfirmationContinueEl.classList.toggle("danger", kind !== "recover");
  }
  if (workspaceBackupEl) {
    workspaceBackupEl.hidden = kind === "recover";
    workspaceBackupEl.disabled = kind === "recover";
  }
  setWorkspaceConfirmationStatus("");
  if (workspaceConfirmationCancelEl) workspaceConfirmationCancelEl.focus();
}
async function readCacheHasBusinessRecords() {
  if (!syncedDatabase) return null;
  try {
    const raw = await readSyncedRaw(syncedDatabase);
    return raw.subjects.length > 0 || raw.items.length > 0;
  } catch {
    return null;
  }
}
function clearBusinessForBindingBlock() {
  // A blocked view cannot remain marked as started: restored trust must restart its read.
  businessStarted = false;
  documentState = emptyDocument();
  lastRecords = emptyRecords();
  documentLoaded = false;
  cloudWriteBlocked = true;
  subjectForm.hidden = false;
  if (subjectsEl) subjectsEl.replaceChildren();
  applyBusinessVisibility();
}
async function refreshAccountBinding() {
  const generation = ++bindingGeneration;
  const entry = selectedSyncedEntry();
  const authenticated = authState.status === AUTH_STATUS.AUTHENTICATED;
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const user = observableValue(cloud && cloud.currentUser);
  const userId = user && typeof user.userId === "string" ? user.userId : null;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  const observedRemoteDbId = persisted && typeof persisted.remoteDbId === "string"
    ? persisted.remoteDbId : null;
  let cacheHasRecords = null;
  if (authenticated && userId && syncedDatabase) {
    cacheHasRecords = await readCacheHasBusinessRecords();
  }
  // A later evaluation always wins: an older async cache read or native event
  // must not restore a stale block after a newer binding was attested.
  if (generation !== bindingGeneration) return accountBinding;
  bindingCacheHasRecords = cacheHasRecords;
  bindingIdentityPending = authenticated && !userId;
  const attestation = activationAttestationFor(entry);
  let next = evaluateAccountBinding({
    entry,
    userId,
    authenticated,
    cacheHasRecords,
    attestation,
    baseName: entry ? entry.databaseName : null,
    observedRemoteDbId
  });
  bindingWriteFailed = false;
  if (entry && (next.bind || next.adopt)) {
    const bindingDigest = next.userDigest || next.digest;
    const bindingRemote = next.remoteDbId || observedRemoteDbId;
    const written = writeWorkspaceBinding(localStorage, entry.url, {
      userDigest: bindingDigest,
      remoteDbId: bindingRemote
    });
    if (written.ok) {
      workspaceRegistry = written.registry;
      workspaceEntry = written.registry.selected === WORKSPACE_SELECTION_LOCAL
        ? null
        : written.registry.workspaces[written.registry.selected] || null;
      persistActivationMarkerFor(written.registry, entry.url);
    } else {
      // A binding that is not durably read back must never authorize reads.
      bindingWriteFailed = true;
      next = {
        ...next,
        state: next.state === BINDING_STATE.UNVERIFIED
          ? BINDING_STATE.UNVERIFIED
          : BINDING_STATE.INDETERMINATE,
        businessAllowed: false,
        bind: false,
        adopt: false,
        reason: "binding-write-failed"
      };
    }
  }
  accountBinding = next;
  recordBootstrap({
    code: BOOTSTRAP_EVENT.IDENTITY_OBSERVED,
    authenticated,
    identityObserved: !!userId
  });
  recordBootstrap({
    code: BOOTSTRAP_EVENT.CACHE_READ,
    ok: cacheHasRecords !== null,
    hasRecords: cacheHasRecords === true
  });
  recordBootstrap({
    code: BOOTSTRAP_EVENT.BINDING_EVALUATED,
    generation,
    ok: accountBinding.businessAllowed === true,
    present: !!entry
  });
  if (entry && (accountBinding.state === BINDING_STATE.MISMATCH ||
      accountBinding.state === BINDING_STATE.DESTINATION_MISMATCH ||
      accountBinding.state === BINDING_STATE.UNVERIFIED ||
      accountBinding.state === BINDING_STATE.INDETERMINATE)) {
    clearBusinessForBindingBlock();
  }
  renderWorkspacePanel();
  // Account binding settles asynchronously after the first native pull.
  // Update the activation banner too: the previous "OTP in progress" text
  // must not survive a verified session with an unbound populated cache.
  renderActivationPanel();
  applyBusinessVisibility();
  renderSyncDiagnostic();
  // Native identity/sync events can restore trust without another login callback.
  // Resume the business read here, not only in continueAuthenticatedWorkspace().
  if (authenticated && accountBinding.businessAllowed === true) startBusiness();
  return accountBinding;
}
async function continueAuthenticatedWorkspace() {
  // Hide any stale business view while the current session is compared to the
  // stored account binding, before any business row is read again.
  accountBinding = { state: BINDING_STATE.INDETERMINATE, businessAllowed: false };
  applyBusinessVisibility();
  const binding = await refreshAccountBinding();
  authInteraction = null;
  if (!binding.businessAllowed) {
    renderAuthPanel();
    notify("Données métier masquées : la liaison de compte ne permet pas la lecture de cet espace. Déconnectez-vous ou purgez la copie locale explicitement.");
    return;
  }
  renderAuthPanel();
  startBusiness();
}
async function diagnosePendingChanges() {
  if (!syncedDatabase) return { status: PENDING_STATE.NONE, count: 0 };
  const tables = Array.isArray(syncedDatabase.tables) ? syncedDatabase.tables : [];
  const mutationTables = tables.filter((table) =>
    table && typeof table.name === "string" && table.name.endsWith("_mutations"));
  if (mutationTables.length === 0) {
    return pendingStatusFromMutationTables({ mutationTables: [] });
  }
  const counts = {};
  try {
    await syncedDatabase.transaction("r", mutationTables, async () => {
      for (const table of mutationTables) {
        counts[table.name] = await table.count();
      }
    });
    return pendingStatusFromMutationTables({
      mutationTables: mutationTables.map((table) => table.name),
      counts
    });
  } catch {
    return pendingStatusFromMutationTables({ error: true });
  }
}
function downloadWorkspaceSnapshot() {
  const inventory = recoveryContext ? recoveryContext.inventory : null;
  const result = buildBusinessExport(lastRecords, { inventory, schemaVersion: SCHEMA_VERSION });
  if (result.status !== "ready") {
    setWorkspaceConfirmationStatus(
      "Sauvegarde impossible depuis l'export métier : anomalie d'intégrité. Utilisez l'export brut de récupération, distinct et complet."
    );
    return false;
  }
  downloadJsonText(JSON.stringify(result.document, null, 2), "threadstep-workspace-backup.json");
  modernBackupVerified = true;
  renderCleanupPanel();
  setWorkspaceConfirmationStatus("Sauvegarde IndexedDB téléchargée. Aucune donnée n'a été supprimée.");
  return true;
}
async function applyWorkspaceSelection() {
  if (workspaceBusy) return;
  const target = workspaceSelectEl ? workspaceSelectEl.value : WORKSPACE_SELECTION_LOCAL;
  const entry = workspaceRegistry && workspaceRegistry.workspaces
    ? workspaceRegistry.workspaces[target] : null;
  const pending = await diagnosePendingChanges();
  const plan = entry && (entry.status === WORKSPACE_STATUS.SUSPENDED ||
    entry.status === WORKSPACE_STATUS.CANCELLED)
    ? planWorkspaceResume({ registry: workspaceRegistry, url: entry.url })
    : planWorkspaceSelection({ registry: workspaceRegistry, target, pending });
  if (!plan.allowed) {
    notifyError("Sélection impossible : " + (plan.reason || "espace inconnu") +
      ". Aucune base n'est copiée ni supprimée.");
    return;
  }
  if (!persistWorkspaceRegistry(plan.registry)) {
    notifyError("Impossible d'enregistrer la sélection d'espace. Aucune base n'est modifiée.");
    return;
  }
  if (plan.url) writeCloudConfig(localStorage, plan.url);
  persistActivationMarkerFor(plan.registry, plan.url);
  if (plan.notice) notify(plan.notice);
  location.reload();
}
async function suspendCurrentWorkspace() {
  if (workspaceBusy) return;
  const entry = selectedSyncedEntry();
  if (!entry) return;
  const pending = await diagnosePendingChanges();
  const plan = planWorkspaceSuspension({
    registry: workspaceRegistry,
    url: entry.url,
    pending
  });
  if (!plan.allowed) {
    notifyError("Suspension impossible : aucune session n'est terminée et aucune base n'est supprimée.");
    return;
  }
  if (!persistWorkspaceRegistry(plan.registry)) {
    notifyError("Impossible d'enregistrer la suspension. Aucune base n'est supprimée.");
    return;
  }
  persistActivationMarkerFor(plan.registry, entry.url);
  if (plan.notice) notify(plan.notice);
  location.reload();
}
async function executeWorkspaceLogout(url) {
  const entry = workspaceRegistry && workspaceRegistry.workspaces
    ? workspaceRegistry.workspaces[url] : null;
  if (!entry || !syncedDatabase || !syncedDatabase.cloud ||
      typeof syncedDatabase.cloud.logout !== "function") {
    notifyError("Déconnexion impossible : la session native n'est pas disponible. Aucune donnée n'est supprimée.");
    return false;
  }
  // Re-run the diagnosis immediately before the confirmed native call.
  const pending = await diagnosePendingChanges();
  const plan = planWorkspaceLogout({
    registry: workspaceRegistry,
    url,
    pending,
    confirmed: true
  });
  if (!plan.allowed) {
    showWorkspaceConfirmation("logout", entry, pending);
    return false;
  }
  try {
    await syncedDatabase.cloud.logout({ force: true });
  } catch {
    notifyError("La déconnexion native a échoué : la session et le cache local restent inchangés, les données métier restent masquées si nécessaire.");
    return false;
  }
  persistWorkspaceRegistry(plan.registry);
  const previous = activationMarker();
  writeActivationRecord(localStorage, createActivationRecord({
    status: WORKSPACE_STATUS.ACTIVE,
    url,
    remoteDbId: previous ? previous.remoteDbId : entry.remoteDbId,
    sourceFingerprint: previous ? previous.sourceFingerprint : null
  }));
  location.reload();
  return true;
}
async function requestWorkspaceLogout() {
  if (workspaceBusy) return;
  const entry = selectedSyncedEntry();
  if (!entry) return;
  const pending = await diagnosePendingChanges();
  const plan = planWorkspaceLogout({
    registry: workspaceRegistry,
    url: entry.url,
    pending
  });
  if (plan.action === "confirm") {
    showWorkspaceConfirmation("logout", entry, pending);
    return;
  }
  await executeWorkspaceLogout(entry.url);
}
async function executeWorkspacePurge() {
  const entry = selectedSyncedEntry();
  const target = entry ? entry.url : WORKSPACE_SELECTION_LOCAL;
  const effective = syncedDatabase && typeof syncedDatabase.name === "string"
    ? syncedDatabase.name
    : LOCAL_DATABASE_NAME;
  const pending = await diagnosePendingChanges();
  const plan = planWorkspacePurge({
    registry: workspaceRegistry,
    target,
    effectiveDatabaseName: effective,
    pending,
    confirmed: true
  });
  if (!plan.allowed) {
    setWorkspaceConfirmationStatus(
      "Purge refusée : " + (plan.reason || "base non identifiée") +
      ". Aucune base n'a été supprimée et aucune donnée distante n'a été modifiée."
    );
    return false;
  }
  const db = syncedDatabase || localDatabase;
  try {
    if (db && typeof db.close === "function") db.close();
    await Dexie.delete(plan.databaseName);
  } catch {
    setWorkspaceConfirmationStatus(
      "Purge locale impossible : la base est peut-être encore ouverte. Rechargez la page puis réessayez ; aucune donnée distante n'a été modifiée."
    );
    return false;
  }
  persistWorkspaceRegistry(plan.registry);
  location.reload();
  return true;
}
// TS-038 remediation: do not silently associate a populated, unverified cache
// with a newly logged-in account. A fresh Cloud cache never reads the old one.
async function unusedCloudRecoveryBase(baseName) {
  // No existing database is ever re-used for a recovery. A random name avoids
  // renaming or mutating the legacy cache, including its mutation stores.
  if (!indexedDB || typeof indexedDB.databases !== "function") return false;
  try {
    const bases = await indexedDB.databases();
    return Array.isArray(bases) &&
      !bases.some((item) => item && typeof item.name === "string" &&
        (item.name === baseName || item.name.startsWith(baseName + "-")));
  } catch {
    return false;
  }
}
function cloudRecoveryPlan(candidate, pending) {
  return planUnverifiedCloudRecovery({
    registry: workspaceRegistry,
    binding: accountBinding.state,
    attestation: evaluateSyncAttestation(nativeAttestationInput()),
    pending,
    newDatabaseName: candidate
  });
}
async function requestWorkspaceRecovery() {
  if (workspaceBusy || accountBinding.state !== BINDING_STATE.UNVERIFIED) return;
  workspaceBusy = true;
  try {
    const candidate = "threadstep-recovery-" + crypto.randomUUID().replace(/-/g, "");
    const pending = await diagnosePendingChanges();
    const plan = cloudRecoveryPlan(candidate, pending);
    if (!plan.allowed || !(await unusedCloudRecoveryBase(candidate))) {
      notifyError("Récupération Cloud non autorisée (" +
        (plan.allowed ? "nouvelle-base-indisponible" : plan.reason) +
        "). L'ancien cache reste intact. Ne le purgez pas.");
      return;
    }
    showWorkspaceConfirmation("recover", selectedSyncedEntry(), pending);
    if (workspaceConfirmation) {
      workspaceConfirmation.recovery = {
        url: plan.url,
        previousBase: plan.oldDatabaseName,
        remoteDbId: plan.remoteDbId,
        userDigest: plan.userDigest,
        candidate
      };
    }
  } finally {
    workspaceBusy = false;
    renderWorkspacePanel();
  }
}
async function confirmWorkspaceRecovery() {
  const request = workspaceConfirmation && workspaceConfirmation.recovery;
  if (!request || accountBinding.state !== BINDING_STATE.UNVERIFIED) return;
  const pending = await diagnosePendingChanges();
  const plan = cloudRecoveryPlan(request.candidate, pending);
  if (!plan.allowed || plan.url !== request.url ||
      plan.oldDatabaseName !== request.previousBase ||
      plan.remoteDbId !== request.remoteDbId ||
      plan.userDigest !== request.userDigest ||
      !(await unusedCloudRecoveryBase(request.candidate))) {
    setWorkspaceConfirmationStatus(
      "Les preuves d'identité, de synchronisation ou les mutations ont changé : " +
      "récupération annulée. Aucun cache supprimé ni remplacé."
    );
    return;
  }
  if (!persistWorkspaceRegistry(plan.registry)) {
    setWorkspaceConfirmationStatus(
      "Enregistrement du nouvel espace impossible ; l'ancien cache reste inchangé."
    );
    return;
  }
  persistActivationMarkerFor(plan.registry, plan.url);
  // Only the registry pointer changes. Dexie Cloud will authenticate and
  // perform its native pull into the new empty local database after reload.
  location.reload();
}

async function requestWorkspacePurge() {
  if (workspaceBusy) return;
  const entry = selectedSyncedEntry();
  const pending = await diagnosePendingChanges();
  showWorkspaceConfirmation("purge", entry, pending);
}
async function confirmWorkspaceAction() {
  if (!workspaceConfirmation || workspaceBusy) return;
  workspaceBusy = true;
  if (workspaceConfirmationContinueEl) workspaceConfirmationContinueEl.disabled = true;
  if (workspaceBackupEl) workspaceBackupEl.disabled = true;
  const kind = workspaceConfirmation.kind;
  try {
    if (kind === "recover") {
      await confirmWorkspaceRecovery();
    } else if (kind === "logout") {
      const entry = selectedSyncedEntry();
      if (entry) await executeWorkspaceLogout(entry.url);
    } else if (kind === "purge") {
      await executeWorkspacePurge();
    }
  } finally {
    workspaceBusy = false;
    if (workspaceConfirmationContinueEl) workspaceConfirmationContinueEl.disabled = false;
    if (workspaceBackupEl) workspaceBackupEl.disabled = false;
    renderWorkspacePanel();
  }
  return;
}

// TS-037 activation assistant: the marker decides whether startup opens the
// autonomous local workspace or the synchronized database. No activation path
// ever reads business records out of the synchronized store as its source.
function activationMarker() {
  return readActivationRecord(localStorage);
}
function activationConfiguredUrl() {
  const entry = selectedSyncedEntry();
  if (entry) return entry.url;
  const config = readCloudConfig();
  return shouldOpenSyncedDatabase(config) ? config.databaseUrl : null;
}
function setActivationStage(event) {
  const outcome = transitionActivation(activationState, event);
  if (outcome.ok) activationState = outcome.state;
  return outcome;
}
function activationInProgress() {
  const record = activationMarker();
  return !!record && record.status === ACTIVATION_STATUS.ACTIVATING;
}
function activationPanelVisible() {
  const record = activationMarker();
  if (record && record.status === ACTIVATION_STATUS.ACTIVE) return false;
  if (record && record.status === ACTIVATION_STATUS.ACTIVATING) return true;
  return !activationConfiguredUrl();
}
function activationStageReached(stage) {
  const order = [
    ACTIVATION_STAGE.LOCAL, ACTIVATION_STAGE.PREPARING, ACTIVATION_STAGE.CONNECTING,
    ACTIVATION_STAGE.DISCOVERING, ACTIVATION_STAGE.REVIEW, ACTIVATION_STAGE.TRANSFER_PENDING,
    ACTIVATION_STAGE.ACTIVE
  ];
  const current = order.indexOf(activationState.stage);
  const target = order.indexOf(stage);
  if (current === -1 || target === -1) return false;
  return target <= current;
}
function setActivationStatus(message) {
  if (cloudActivationStatusEl) {
    cloudActivationStatusEl.textContent = typeof message === "string" ? message : "";
  }
}
function renderActivationStages() {
  if (!cloudActivationStagesEl) return;
  for (const entry of cloudActivationStagesEl.querySelectorAll("li")) {
    if (entry.dataset.stage === activationState.stage) entry.setAttribute("aria-current", "step");
    else entry.removeAttribute("aria-current");
    entry.dataset.reached = activationStageReached(entry.dataset.stage) ? "true" : "false";
  }
}
function activationDestinationText() {
  const record = activationMarker();
  const url = record && record.url ? record.url : activationConfiguredUrl();
  if (!url) return "Aucune destination Cloud configurée.";
  return "Destination normalisée : " + url +
    (record && record.remoteDbId ? " (base " + record.remoteDbId + ")" : "") + ".";
}
function renderActivationReview(context) {
  if (!cloudActivationReviewEl) return;
  cloudActivationReviewEl.replaceChildren();
  if (!context || !context.displayedPlan) {
    cloudActivationReviewEl.hidden = true;
    return;
  }
  const plan = context.displayedPlan;
  const view = buildReconciliationView(plan);
  const summary = el("p", "cloud-activation-review-summary",
    view.operationCount + " insertion(s) indépendante(s) prévue(s), " +
    view.blocked.length + " groupe(s) bloqué(s). Rien n'est encore écrit.");
  const counts = el("p", "cloud-activation-review-counts",
    "Source locale : " + context.sourceCounts.subjects + " sujet(s), " +
    context.sourceCounts.items + " étape(s). Cible attestée : " +
    context.targetCounts.subjects + " sujet(s), " + context.targetCounts.items + " étape(s).");
  cloudActivationReviewEl.append(summary, counts);
  if (view.blocked.length > 0) {
    const list = el("ul", "cloud-activation-blocked");
    for (const entry of view.blocked) {
      list.append(el("li", null,
        (entry.store === "subjects" ? "Sujet" : "Étape") + " " + (entry.title || entry.id) +
        " : " + blockReasonLabel(entry.reason)));
    }
    cloudActivationReviewEl.append(list);
  }
  cloudActivationReviewEl.hidden = false;
}
function renderActivationPanel() {
  if (!cloudActivationEl) return;
  renderSyncOnboarding();
  const visible = activationPanelVisible();
  cloudActivationEl.hidden = !visible;
  if (!visible) return;
  const record = activationMarker();
  const activated = !!record && record.status === ACTIVATION_STATUS.ACTIVATING;
  const cancelled = !!record && record.status === ACTIVATION_STATUS.CANCELLED;
  const authenticated = businessAllowed();
  let message = activationStatus.status !== FIRST_SYNC.IDLE
    ? describeFirstSync(activationStatus)
    : activationState.error
      ? "Interruption récupérable : la source locale reste intacte. Réessayez ou annulez l'activation."
      : "";
  if (activationContext && activationContext.classification) {
    message = describeTargetClassification(activationContext.classification) +
      (message ? " " + message : "");
  }
  const needsIsolatedRecovery = activationState.stage === ACTIVATION_STAGE.CONNECTING &&
    authState.status === AUTH_STATUS.AUTHENTICATED &&
    accountBinding.state === BINDING_STATE.UNVERIFIED;
  if (cloudActivationStageEl) {
    cloudActivationStageEl.textContent = needsIsolatedRecovery
      ? "OTP confirmé ; cache Cloud non vérifié. Dans « Espaces de travail », choisissez « Retrouver les projets Cloud dans un nouveau cache isolé ». L'ancien cache reste intact."
      : describeActivationStage(activationState.stage);
  }
  setActivationStatus(message);
  if (cloudActivationDestinationEl) cloudActivationDestinationEl.textContent = activationDestinationText();
  renderActivationStages();
  renderActivationReview(activationContext);
  const localStage = activationState.stage === ACTIVATION_STAGE.LOCAL ||
    activationState.stage === ACTIVATION_STAGE.CANCELLED ||
    (!activated && !authenticated);
  if (cloudActivationStartEl) {
    cloudActivationStartEl.hidden = !localStage;
    cloudActivationStartEl.disabled = false;
  }
  if (cloudActivationResumeEl) {
    cloudActivationResumeEl.hidden = !(cancelled && !!activationConfiguredUrl()) || localStage;
  }
  if (cloudActivationConfirmEl) {
    const reviewReady = !!activationContext && activationContext.displayedPlan &&
      activationContext.displayedPlan.operations.length > 0 &&
      activationState.stage === ACTIVATION_STAGE.REVIEW;
    cloudActivationConfirmEl.hidden = !reviewReady;
    cloudActivationConfirmEl.disabled = !reviewReady ||
      !cloudActivationConsentEl || !cloudActivationConsentEl.checked;
  }
  if (cloudActivationCancelEl) {
    cloudActivationCancelEl.hidden = !activated && activationState.stage === ACTIVATION_STAGE.LOCAL;
  }
  if (cloudActivationRetryEl) {
    cloudActivationRetryEl.hidden = activationState.stage !== ACTIVATION_STAGE.FAILED;
  }
}
function describeFirstSync(state) {
  switch (state && state.status) {
    case FIRST_SYNC.LOCAL_WRITTEN:
      return "Écrit localement dans la base synchronisée ; synchronisation distante non encore confirmée.";
    case FIRST_SYNC.PENDING:
      return "Écrit localement, synchronisation en attente. Aucun push distant n'est confirmé.";
    case FIRST_SYNC.REMOTE_COMPLETE:
      return "Première synchronisation distante attestée sur cet appareil ; un second appareil reste à vérifier séparément.";
    case FIRST_SYNC.ERROR:
      return "Écrit localement, mais la synchronisation distante a échoué. Reprise sans duplication possible.";
    case FIRST_SYNC.INDETERMINATE:
      return "Écrit localement ; propagation distante indéterminée, aucun succès n'est affirmé.";
    default:
      return "";
  }
}
async function readLocalActivationSource() {
  const reader = openLocalDatabase(Dexie);
  try {
    const store = createDexieStore(reader);
    const raw = await store.readRaw();
    const records = normalizedRecords(raw);
    return {
      raw,
      records,
      sourceCounts: { subjects: records.subjects.length, items: records.items.length }
    };
  } finally {
    if (reader && typeof reader.close === "function") reader.close();
  }
}
function rememberActivationContext(record, context) {
  if (!record || !context) return;
  writeActivationRecord(localStorage, createActivationRecord({
    status: ACTIVATION_STATUS.ACTIVATING,
    url: record.url,
    remoteDbId: context.destination ? context.destination.remoteDbId : record.remoteDbId,
    sourceFingerprint: context.sourceFingerprint,
    userId: context.userId
  }));
}
function failActivation(reason) {
  setActivationStage({ type: "fail", reason });
  activationContext = null;
  renderActivationPanel();
}
async function runActivationDiscovery() {
  const record = activationMarker();
  if (!syncedDatabase || !record || record.status !== ACTIVATION_STATUS.ACTIVATING) return null;
  const generation = activationLifecycle.begin();
  if (activationState.stage === ACTIVATION_STAGE.LOCAL ||
      activationState.stage === ACTIVATION_STAGE.CANCELLED) {
    setActivationStage({ type: "start" });
    setActivationStage({ type: "configured" });
  }
  if (!businessAllowed()) {
    renderActivationPanel();
    return { status: "awaiting-authentication" };
  }
  setActivationStage({ type: "authenticated" });
  renderActivationPanel();
  let source;
  try {
    source = await readLocalActivationSource();
  } catch {
    if (!activationLifecycle.isCurrent(generation)) return { status: "superseded" };
    failActivation("local-read-error");
    notifyError("Lecture de la source locale impossible : activation bloquée, aucune écriture.");
    return { status: "local-read-error" };
  }
  if (!activationLifecycle.isCurrent(generation)) return { status: "superseded" };
  const result = await readAttestedTarget();
  if (!activationLifecycle.isCurrent(generation)) return { status: "superseded" };
  const destination = destinationIdentity(result.attestation);
  const currentRecord = activationMarker();
  if (!currentRecord || currentRecord.status !== ACTIVATION_STATUS.ACTIVATING ||
      currentRecord.url !== destination.url) {
    return { status: "superseded" };
  }
  const expected = {
    url: currentRecord.url,
    remoteDbId: currentRecord.remoteDbId || null,
    userId: result.attestation && result.attestation.identity
      ? result.attestation.identity.userId : null
  };
  const plan = result.status === "ready"
    ? planReconciliation({
      records: source.records,
      target: result.records,
      destination,
      userId: expected.userId,
      resolutions: {}
    })
    : null;
  const classification = classifyTarget({
    attestation: result.attestation,
    targetStatus: result.status,
    records: result.records,
    expected,
    plan
  });
  if (classification.blocked) {
    failActivation(classification.reason);
    notifyError(describeTargetClassification(classification.classification));
    return { status: classification.classification, classification };
  }
  // On a second device with no local business records, a verified native pull
  // is sufficient: no transfer plan, fake consent or cloud mutation is needed.
  if (canCompleteReadOnlyActivation({
    sourceCounts: source.sourceCounts,
    plan,
    targetStatus: result.status,
    attestation: result.attestation
  })) {
    const completeRecord = createActivationRecord({
      status: ACTIVATION_STATUS.ACTIVE,
      url: currentRecord.url,
      remoteDbId: destination.remoteDbId,
      sourceFingerprint: computeSourceRecordsFingerprint(source.records),
      userId: expected.userId
    });
    const activeRegistry = updateWorkspaceStatus(
      workspaceRegistry, currentRecord.url, WORKSPACE_STATUS.ACTIVE
    );
    if (!completeRecord || !activeRegistry ||
        !writeActivationRecord(localStorage, completeRecord) ||
        !persistWorkspaceRegistry(activeRegistry)) {
      failActivation("activation-persistence-error");
      notifyError("Finalisation impossible ; aucune donnée transférée ou supprimée.");
      return { status: "activation-persistence-error" };
    }
    activationContext = null;
    setActivationStage({ type: "no-transfer" });
    renderActivationPanel();
    notify("Cloud actif après lecture distante attestée : aucun transfert local nécessaire.");
    return { status: "read-only-activated", classification };
  }
  const targetCounts = result.records
    ? { subjects: result.records.subjects.length, items: result.records.items.length }
    : { subjects: 0, items: 0 };
  activationContext = {
    records: source.records,
    target: result.records,
    destination,
    userId: expected.userId,
    attestation: result.attestation,
    plan,
    displayedPlan: plan,
    sourceFingerprint: computeSourceRecordsFingerprint(source.records),
    classification: classification.classification,
    sourceCounts: source.sourceCounts,
    targetCounts
  };
  rememberActivationContext(currentRecord, activationContext);
  setActivationStage({ type: "discovered" });
  if (cloudActivationConsentEl) cloudActivationConsentEl.checked = false;
  renderActivationPanel();
  notify("Première lecture distante attestée : relisez le plan affiché avant tout transfert.");
  return { status: classification.classification, classification };
}
function startActivation() {
  const url = activationConfiguredUrl();
  if (!url) {
    setActivationStage({ type: "start" });
    renderActivationPanel();
    if (cloudConfigEl) cloudConfigEl.hidden = false;
    if (cloudUrlEl) cloudUrlEl.focus();
    notify("Saisissez l'URL de votre instance Dexie Cloud pour démarrer l'activation.");
    return;
  }
  const record = activationMarker();
  if (!record || record.status === ACTIVATION_STATUS.CANCELLED) {
    const written = writeActivationRecord(localStorage, createActivationRecord({
      status: ACTIVATION_STATUS.ACTIVATING,
      url
    }));
    if (!written) {
      notifyError("Impossible d'enregistrer l'activation dans ce navigateur. La source locale reste intacte.");
      return;
    }
  }
  if (typeof location !== "undefined" && typeof location.reload === "function") location.reload();
}
function resumeActivation() {
  const record = activationMarker();
  if (record && record.status === ACTIVATION_STATUS.CANCELLED) {
    startActivation();
    return;
  }
  void runActivationDiscovery();
}
function cancelActivation() {
  const postCommit = activationStatus.localWritten ||
    activationState.stage === ACTIVATION_STAGE.TRANSFER_PENDING;
  if (postCommit) {
    const outcome = transitionActivation(activationState, { type: "cancel" });
    if (outcome.ok) activationState = outcome.state;
    activationContext = null;
    if (cloudActivationConsentEl) cloudActivationConsentEl.checked = false;
    setActivationStatus("Transfert déjà écrit localement : annulation sans suppression de la copie synchronisée ni de la source locale. Synchronisation distante toujours en attente ou indéterminée.");
    renderActivationPanel();
    notify("Annulation après commit local : aucune suppression implicite, synchronisation distante non affirmée.");
    return;
  }
  const record = activationMarker();
  const url = record ? record.url : activationConfiguredUrl();
  if (url) {
    writeActivationRecord(localStorage, createActivationRecord({
      status: ACTIVATION_STATUS.CANCELLED,
      url,
      remoteDbId: record ? record.remoteDbId : undefined
    }));
  }
  activationContext = null;
  activationStatus = initialFirstSyncState();
  activationState = initialActivationState();
  if (cloudActivationConsentEl) cloudActivationConsentEl.checked = false;
  if (typeof location !== "undefined" && typeof location.reload === "function") {
    location.reload();
    return;
  }
  renderActivationPanel();
  notify("Activation annulée avant consentement : la source locale et la cible restent inchangées.");
}
function retryActivation() {
  const outcome = transitionActivation(activationState, { type: "retry" });
  if (outcome.ok) activationState = outcome.state;
  activationStatus = initialFirstSyncState();
  void runActivationDiscovery();
}
function activationAdapter() {
  return {
    commit(operations) {
      if (!Array.isArray(operations) || operations.some((operation) => operation.type !== "add")) {
        return Promise.reject(new Error("L'activation n'accepte que des insertions add."));
      }
      return businessStore.commit(operations);
    }
  };
}
function updateActivationFromNative() {
  const record = activationMarker();
  if (!record || record.status !== ACTIVATION_STATUS.ACTIVATING) return;
  if (!activationStatus.localWritten) {
    if (businessAllowed() && activationState.stage === ACTIVATION_STAGE.CONNECTING) {
      setActivationStage({ type: "authenticated" });
      renderActivationPanel();
    }
    return;
  }
  activationStatus = reduceFirstSync(activationStatus, {
    type: "native",
    ...nativeAttestationInput()
  });
  if (activationStatus.status === FIRST_SYNC.REMOTE_COMPLETE) {
    setActivationStage({ type: "complete" });
    writeActivationRecord(localStorage, createActivationRecord({
      status: ACTIVATION_STATUS.ACTIVE,
      url: record.url,
      remoteDbId: record.remoteDbId,
      sourceFingerprint: record.sourceFingerprint,
      userDigest: record.userDigest
    }));
    const activated = updateWorkspaceStatus(
      workspaceRegistry,
      record.url,
      WORKSPACE_STATUS.ACTIVE
    );
    if (activated) persistWorkspaceRegistry(activated);
  } else if (activationStatus.status === FIRST_SYNC.ERROR) {
    setActivationStage({ type: "fail", reason: activationStatus.reason || "sync-error" });
  }
  renderActivationPanel();
}
async function confirmActivation() {
  const context = activationContext;
  if (!context || !context.displayedPlan) {
    notify("Aucun plan d'activation affiché : aucune écriture effectuée.");
    return;
  }
  if (!cloudActivationConsentEl || !cloudActivationConsentEl.checked) {
    notify("Consentement explicite requis avant tout transfert d'activation.");
    return;
  }
  const displayed = context.displayedPlan;
  await pendingCloudWrites;
  const result = await readAttestedTarget();
  if (result.status !== "ready") {
    failActivation(result.reason || "read-error");
    notifyError(reconciliationBlockMessage(result));
    return;
  }
  let source;
  try {
    source = await readLocalActivationSource();
  } catch {
    failActivation("local-read-error");
    notifyError("Reliure de la source locale impossible : aucune écriture.");
    return;
  }
  const destination = destinationIdentity(result.attestation);
  const userId = result.attestation && result.attestation.identity
    ? result.attestation.identity.userId : null;
  const fresh = planReconciliation({
    records: source.records,
    target: result.records,
    destination,
    userId,
    resolutions: context.plan ? context.plan.resolutions : {}
  });
  const review = reviewDisplayedPlan(displayed, fresh);
  if (!review.same) {
    context.records = source.records;
    context.target = result.records;
    context.destination = destination;
    context.userId = userId;
    context.attestation = result.attestation;
    context.plan = fresh;
    context.displayedPlan = fresh;
    context.sourceFingerprint = computeSourceRecordsFingerprint(source.records);
    context.sourceCounts = source.sourceCounts;
    context.targetCounts = {
      subjects: result.records.subjects.length,
      items: result.records.items.length
    };
    if (cloudActivationConsentEl) cloudActivationConsentEl.checked = false;
    renderActivationPanel();
    notify("Plan modifié depuis la prévisualisation : relisez l'inventaire et confirmez à nouveau. Aucune écriture effectuée.");
    return;
  }
  setActivationStage({ type: "consent" });
  renderActivationPanel();
  const outcome = await runReconciliation(activationAdapter(), displayed,
    { confirmed: true, fingerprint: displayed.fingerprint },
    async () => {
      const refreshed = await readAttestedTarget();
      let revalidatedSource;
      try {
        revalidatedSource = await readLocalActivationSource();
      } catch {
        revalidatedSource = null;
      }
      const revalidatedDestination = destinationIdentity(refreshed.attestation);
      const revalidatedUserId = refreshed.attestation && refreshed.attestation.identity
        ? refreshed.attestation.identity.userId : null;
      const revalidatedPlan = refreshed.status === "ready" && revalidatedSource
        ? planReconciliation({
          records: revalidatedSource.records,
          target: refreshed.records,
          destination: revalidatedDestination,
          userId: revalidatedUserId,
          resolutions: context.plan ? context.plan.resolutions : {}
        })
        : null;
      return {
        attestation: refreshed.attestation,
        records: revalidatedSource ? revalidatedSource.records : null,
        target: refreshed.records,
        destination: revalidatedDestination,
        userId: revalidatedUserId,
        plan: revalidatedPlan
      };
    });
  if (outcome.status === "local-written") {
    activationStatus = reduceFirstSync(activationStatus, { type: "local-written" });
    activationContext = null;
    if (cloudActivationConsentEl) cloudActivationConsentEl.checked = false;
    const record = activationMarker();
    if (record) {
      writeActivationRecord(localStorage, createActivationRecord({
        status: ACTIVATION_STATUS.ACTIVATING,
        url: record.url,
        remoteDbId: destination.remoteDbId,
        sourceFingerprint: context.sourceFingerprint,
        userId
      }));
    }
    await refreshSyncedDocument();
    updateActivationFromNative();
    renderActivationPanel();
    notify("Écrit localement dans IndexedDB ; synchronisation Cloud en attente. Aucun push distant n'est confirmé.");
    return;
  }
  if (outcome.status === "already-migrated" || outcome.status === "up-to-date") {
    activationContext = null;
    if (cloudActivationConsentEl) cloudActivationConsentEl.checked = false;
    updateActivationFromNative();
    renderActivationPanel();
    notify("Aucune insertion nécessaire : les enregistrements déjà présents sont reconnus, sans doublon.");
    return;
  }
  if (outcome.status === "stale-plan") {
    context.displayedPlan = null;
    activationState = { ...activationState, stage: ACTIVATION_STAGE.REVIEW };
    void runActivationDiscovery();
    notify("Plan périmé : source, destination, session ou cible modifiée. Nouvelle revue requise, aucune écriture.");
    return;
  }
  const reason = outcome.reason || outcome.status;
  failActivation(reason);
  if (outcome.status === "failed") {
    activationStatus = reduceFirstSync(activationStatus, { type: "local-error" });
    notifyError("Échec de la transaction : aucune écriture partielle, source et cible inchangées.");
  } else if (outcome.status === "sync-blocked") {
    notifyError(describeAttestationReason(reason));
  } else if (outcome.status === "read-error") {
    notifyError("Lecture de revalidation impossible : activation bloquée, source et cible inchangées.");
  } else if (outcome.status === "refused" || outcome.status === "consent-mismatch") {
    notify("Activation refusée : consentement absent ou lié à un autre plan. Aucune écriture.");
  } else {
    notify("Activation interrompue : aucune écriture confirmée.");
  }
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
      syncLifecycle.otpRequested();
      let pending;
      try {
        pending = Promise.resolve(db.cloud.login({ ...options, grant_type: "otp" }));
      } catch (error) {
        syncLifecycle.otpFailed();
        throw error;
      }
      return pending.then(
        (value) => {
          syncLifecycle.otpSucceeded();
          return value;
        },
        (error) => {
          syncLifecycle.otpFailed();
          throw error;
        }
      );
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
function hideRestorePanel() {
  restoreContext = null;
  if (restorePanelEl) restorePanelEl.hidden = true;
  if (restoreInputEl) restoreInputEl.value = "";
  if (restoreConfirmationEl) restoreConfirmationEl.value = "";
  if (restoreConfirmEl) restoreConfirmEl.disabled = true;
}
async function currentRawRecords() {
  if (syncedDatabase) {
    const result = await readSyncedWorkspace(syncedDatabase);
    return result.raw;
  }
  if (businessStore && typeof businessStore.readRaw === "function") {
    return businessStore.readRaw();
  }
  return null;
}
function currentInstanceContext() {
  return recoveryInstanceContext();
}
async function openRestorePreview(text) {
  const parsed = parseIndexedDbBackup(text);
  if (!parsed.ok) {
    const refusal = unsupportedV1Refusal(parsed.code);
    notify(refusal.message);
    return;
  }
  const raw = await currentRawRecords();
  if (!raw) {
    notify("Restauration impossible : l'état actuel n'est pas lisible, aucune sauvegarde sûre ne peut être produite.");
    return;
  }
  const backup = buildRestoreBackup(raw);
  restoreContext = {
    records: parsed.records,
    text,
    raw,
    backup,
    backupDownloaded: false,
    plan: null
  };
  rebuildRestorePlan();
  renderRestorePanel();
  notify("Restauration en prévisualisation : aucune écriture avant sauvegarde et confirmation renforcée.");
}
function buildRestoreBackup(raw) {
  const modern = buildBusinessExport(raw);
  if (modern.status === "ready") return modern.document;
  return buildRawRecoveryExport(raw, currentInstanceContext());
}
function rebuildRestorePlan() {
  if (!restoreContext) return null;
  restoreContext.plan = buildRestorePlan({
    records: restoreContext.records,
    current: restoreContext.raw,
    backup: restoreContext.backupDownloaded ? restoreContext.backup : null,
    backupExpected: {
      counts: {
        subjects: restoreContext.raw.subjects.length,
        items: restoreContext.raw.items.length
      }
    }
  });
  return restoreContext.plan;
}
function renderRestorePanel() {
  if (!restorePanelEl || !restoreContext) return;
  const plan = restoreContext.plan;
  restorePanelEl.hidden = false;
  if (restoreScopeEl) {
    restoreScopeEl.textContent = plan && plan.counts
      ? "Portée : " + plan.counts.incoming.subjects + " sujet(s), " +
        plan.counts.incoming.items + " tâche(s) restaurés ; " +
        plan.counts.removed + " enregistrement(s) supprimé(s), " +
        plan.counts.added + " ajouté(s)."
      : "Portée indisponible.";
  }
  if (restoreBackupStatusEl) {
    restoreBackupStatusEl.textContent = restoreContext.backup
      ? (restoreContext.backupDownloaded
        ? "Sauvegarde de l'état actuel téléchargée et vérifiable ; la restauration reste soumise à confirmation renforcée."
        : "Une sauvegarde de l'état actuel doit être téléchargée avant toute restauration.")
      : "Sauvegarde de l'état actuel impossible : restauration interdite.";
  }
  if (restoreDownloadBackupEl) {
    restoreDownloadBackupEl.disabled = !restoreContext.backup;
  }
  updateRestoreConfirmState();
}
function updateRestoreConfirmState() {
  if (!restoreConfirmEl) return;
  const plan = restoreContext ? restoreContext.plan : null;
  restoreConfirmEl.disabled = !(plan && plan.allowed) || !restoreContext.backupDownloaded ||
    !restoreConfirmationEl || restoreConfirmationEl.value !== "RESTAURER";
}
function downloadRestoreBackup() {
  if (!restoreContext || !restoreContext.backup) {
    notify("Sauvegarde de l'état actuel impossible : restauration interdite.");
    return;
  }
  downloadJsonText(JSON.stringify(restoreContext.backup, null, 2), "threadstep-avant-restauration.json");
  restoreContext.backupDownloaded = true;
  rebuildRestorePlan();
  renderRestorePanel();
  notify("Sauvegarde de l'état actuel téléchargée. Vérifiez-la avant de restaurer.");
}
async function confirmRestore() {
  if (!restoreContext || !restoreContext.backupDownloaded ||
      !restoreConfirmationEl || restoreConfirmationEl.value !== "RESTAURER") {
    notify("Restauration refusée : sauvegarde et confirmation renforcée requises.");
    return;
  }
  const plan = restoreContext.plan;
  if (!plan || !plan.allowed) {
    notify("Restauration bloquée (" + (plan ? plan.code : "indeterminate") + "). Aucune écriture.");
    return;
  }
  const freshRaw = await currentRawRecords();
  if (!freshRaw) {
    notify("Restauration bloquée : l'état actuel n'est plus lisible. Aucune écriture.");
    return;
  }
  const freshPlan = buildRestorePlan({
    records: restoreContext.records,
    current: freshRaw,
    backup: restoreContext.backup,
    backupExpected: {
      counts: { subjects: freshRaw.subjects.length, items: freshRaw.items.length }
    }
  });
  if (!freshPlan.allowed || freshPlan.fingerprint !== plan.fingerprint) {
    restoreContext.plan = freshPlan;
    renderRestorePanel();
    notify("Plan de restauration périmé : la cible a changé. Relisez la portée, aucune écriture n'a été effectuée.");
    return;
  }
  const operations = diffRecords(freshRaw, restoreContext.records);
  try {
    await businessStore.commit(operations);
  } catch {
    notify("Échec de la transaction de restauration : aucune écriture partielle confirmée.");
    return;
  }
  if (restoreStatusEl) restoreStatusEl.textContent = "Restauration explicitement confirmée et enregistrée localement. Vérifiez la synchronisation séparément.";
  notify("Restauration enregistrée localement ; aucune convergence distante n'est affirmée.");
  hideRestorePanel();
  if (syncedDatabase) await refreshSyncedDocument();
  else await refreshLocalDocument();
}

function recoveryInstanceContext() {
  const config = readCloudConfig();
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  return sanitizeInstanceContext({
    workspace: syncedDatabase ? "synced" : "local",
    url: config && config.databaseUrl ? config.databaseUrl : null,
    remoteDbId: persisted && typeof persisted.remoteDbId === "string" ? persisted.remoteDbId : null,
    sessionCategory: authState && authState.status ? authState.status : "unauthenticated",
    rightsAvailable: !!authState && canAccessBusiness(authState),
    realmsAvailable: !!(persisted && persisted.realms),
    permissionsMayHide: !!authState && authState.status === AUTH_STATUS.REFUSED
  });
}
function readCodeLabel(code) {
  switch (code) {
    case READ_FAILURE.STORAGE_UNAVAILABLE:
      return "Stockage IndexedDB indisponible : aucune conclusion de base vide n'est tirée.";
    case READ_FAILURE.READ_REFUSED:
      return "Lecture IndexedDB refusée : aucun export complet ne peut être promis.";
    case READ_FAILURE.PROJECTION_INVALID:
      return "Projection métier invalide : consultation dégradée en lecture seule.";
    case READ_FAILURE.NOT_VISIBLE_UNAUTHORIZED:
      return "Données possiblement invisibles ou non autorisées : pas de conclusion de suppression.";
    case READ_FAILURE.INDETERMINATE:
      return "État indéterminé : aucune synchronisation ni base vide n'est affirmée.";
    default:
      return "État de lecture inconnu : aucune conclusion n'est tirée.";
  }
}
function clearRecovery() {
  recoveryContext = null;
  if (recoveryPanelEl) {
    recoveryPanelEl.hidden = true;
    if (recoveryDegradedEl) recoveryDegradedEl.replaceChildren();
    if (recoveryAnomaliesEl) recoveryAnomaliesEl.replaceChildren();
    if (recoveryReadCodeEl) recoveryReadCodeEl.textContent = "";
    if (recoveryInstanceEl) recoveryInstanceEl.textContent = "";
    if (recoveryBusinessStatusEl) recoveryBusinessStatusEl.textContent = "";
  }
}
function enterRecoveryMode(raw, code) {
  const context = recoveryInstanceContext();
  const inventory = buildIntegrityInventory(raw, context);
  const degraded = buildDegradedView(raw, inventory);
  recoveryContext = { raw, inventory, degraded, readCode: code, instanceContext: context };
  if (raw) {
    documentState = degraded.document;
    documentLoaded = true;
    if (syncedDatabase) cloudWriteBlocked = true;
    else localWriteBlocked = true;
    localReadFailed = false;
    render();
  }
  renderRecoveryPanel();
  applyBusinessVisibility();
}
function renderRecoveryPanel() {
  if (!recoveryPanelEl) return;
  if (!recoveryContext) {
    recoveryPanelEl.hidden = true;
    return;
  }
  const { inventory, degraded, readCode, instanceContext } = recoveryContext;
  if (recoveryInstanceEl) {
    recoveryInstanceEl.textContent = "Espace " + instanceContext.workspace +
      (instanceContext.url ? " · URL normalisée " + instanceContext.url : "") +
      (instanceContext.remoteDbId ? " · base " + instanceContext.remoteDbId : "") +
      " · session " + instanceContext.sessionCategory +
      " · droits " + (instanceContext.rightsAvailable ? "disponibles" : "indéterminés") +
      " · realms " + (instanceContext.realmsAvailable ? "disponibles" : "indéterminés") + ".";
  }
  if (recoveryReadCodeEl) recoveryReadCodeEl.textContent = readCodeLabel(readCode);
  if (recoveryDegradedEl) {
    recoveryDegradedEl.replaceChildren();
    recoveryDegradedEl.append(el("p", "recovery-counts",
      "Consultation : " + degraded.displayed.subjects + " sujet(s) lisible(s), " +
      degraded.displayed.items + " tâche(s) cohérente(s) ; " +
      degraded.anomalies.length + " anomalie(s) listée(s)."));
    const list = el("ul", "recovery-subjects");
    for (const subject of degraded.document.subjects) {
      const item = el("li");
      item.append(el("strong", null, subject.title), el("span", null,
        " — " + subject.items.length + " tâche(s) consultable(s)"));
      list.append(item);
    }
    recoveryDegradedEl.append(list);
  }
  if (recoveryAnomaliesEl) {
    recoveryAnomaliesEl.replaceChildren();
    const summary = summarizeIntegrityInventory(inventory);
    const heading = el("p", null, "Anomalies par code :");
    recoveryAnomaliesEl.append(heading);
    const list = el("ul", "recovery-anomaly-list");
    for (const entry of summary) {
      list.append(el("li", null, entry.code + " : " + entry.count +
        " (" + entry.stores.join(", ") + ")"));
    }
    for (const entry of degraded.anomalies) {
      list.append(el("li", null, entry.code + " — " + (entry.store || "store") +
        " : " + (entry.id || "identifiant inconnu")));
    }
    recoveryAnomaliesEl.append(list);
  }
  if (recoveryBusinessStatusEl) {
    const gate = evaluateBusinessExport(inventory);
    recoveryBusinessStatusEl.textContent = gate.allowed
      ? "La sauvegarde métier IndexedDB moderne reste disponible."
      : "Sauvegarde métier moderne désactivée tant qu'une anomalie d'intégrité subsiste : utilisez l'export brut de récupération, distinct et complet.";
  }
  if (recoveryRawExportEl) {
    recoveryRawExportEl.disabled = !recoveryContext.raw || readCode === READ_FAILURE.READ_REFUSED;
  }
  if (recoveryRepairPreviewEl) {
    recoveryRepairPreviewEl.disabled = !recoveryContext.raw ||
      readCode === READ_FAILURE.READ_REFUSED || readCode === READ_FAILURE.STORAGE_UNAVAILABLE;
  }
  recoveryPanelEl.hidden = false;
}
function exportRawRecovery() {
  if (!recoveryContext || !recoveryContext.raw) {
    notify("Export brut indisponible : la lecture des stores a été refusée. Aucun instantané partiel n'est présenté comme complet.");
    return;
  }
  const snapshot = buildRawRecoveryExport(recoveryContext.raw, recoveryContext.instanceContext);
  if (snapshot.status !== "ready") {
    notify("Export brut indisponible : aucun fichier partiel n'est produit.");
    return;
  }
  downloadJsonText(JSON.stringify(snapshot, null, 2),
    "threadstep-recuperation-brute-" + snapshot.counts.subjects + "-" + snapshot.counts.items + ".json");
  notify("Export brut de récupération généré : " + snapshot.counts.subjects +
    " sujet(s), " + snapshot.counts.items + " tâche(s), orphelines incluses.");
}
function exportBusinessBackup() {
  const inventory = recoveryContext ? recoveryContext.inventory : null;
  const result = buildBusinessExport(lastRecords, { inventory, schemaVersion: SCHEMA_VERSION });
  if (result.status === "disabled") {
    notify("Export métier désactivé : une anomalie d'intégrité existe. Utilisez l'export brut de récupération, distinct et complet.");
    return;
  }
  if (result.status !== "ready") {
    notify("Export métier incomplet (" + result.code + ") : aucune sauvegarde partielle n'est produite. Utilisez l'export brut de récupération.");
    return;
  }
  downloadJsonText(JSON.stringify(result.document, null, 2), "threadstep-backup.json");
  modernBackupVerified = true;
  renderCleanupPanel();
  notify("Sauvegarde IndexedDB générée au format " + BACKUP_FORMAT + " avec empreinte et compteurs vérifiés.");
}
function parseRepairSource(text) {
  return parseIndexedDbBackup(text);
}
function repairDestination() {
  return {
    url: migrationDestination(),
    remoteDbId: recoveryContext && recoveryContext.instanceContext
      ? recoveryContext.instanceContext.remoteDbId : null,
    userCategory: authState && authState.status ? authState.status : "unauthenticated",
    rightsAvailable: !!authState && canAccessBusiness(authState),
    realmsAvailable: !!(recoveryContext && recoveryContext.instanceContext &&
      recoveryContext.instanceContext.realmsAvailable)
  };
}
function rebuildRepairPlan() {
  if (!repairContext) return null;
  const plan = buildRepairPlan({
    raw: recoveryContext.raw,
    source: repairContext.source,
    sourceRecords: repairContext.sourceRecords,
    provenance: repairContext.provenance,
    decisions: repairContext.decisions,
    destination: repairDestination(),
    context: recoveryContext.instanceContext
  });
  repairContext.plan = plan;
  const snapshot = buildRepairRecoverySnapshot(recoveryContext.raw, recoveryContext.instanceContext);
  const check = verifyRecoverySnapshot(snapshot, {
    counts: { subjects: plan.counts.before.subjects, items: plan.counts.before.items }
  });
  repairContext.backup = check.valid ? snapshot : null;
  repairContext.backupCheck = check;
  return plan;
}
function renderRepairPreview() {
  if (!repairPreviewEl || !repairContext) return;
  const plan = repairContext.plan;
  repairPreviewEl.hidden = false;
  if (repairPreviewSummaryEl) {
    repairPreviewSummaryEl.textContent = "Destination " + (plan.destination.url || "non configurée") +
      (plan.destination.remoteDbId ? " (base " + plan.destination.remoteDbId + ")" : "") +
      " · variante " + plan.idVariant + " · " + plan.changes.length + " changement(s) de référence, " +
      plan.ambiguousGroups.length + " groupe(s) ambigu(s), " + plan.blockedGroups.length + " groupe(s) bloqué(s). " +
      "Compteurs " + plan.counts.before.subjects + "/" + plan.counts.before.items + " avant, " +
      plan.counts.after.danglingSubjects + " référence(s) orpheline(s) après. " +
      "Empreinte " + plan.fingerprint.slice(0, 12) + "…";
  }
  if (repairGroupsEl) {
    repairGroupsEl.replaceChildren();
    plan.groups.forEach((group, index) => {
      const block = el("div", "repair-group");
      block.append(el("p", null, (group.store === "items" ? "Tâche " : "Sujet ") +
        group.id + " · " + group.field + " · " + group.code));
      group.candidates.forEach((candidate, candidateIndex) => {
        const id = "repair-choice-" + index + "-" + candidateIndex;
        const input = el("input");
        input.type = "radio";
        input.name = "repair-choice-" + index;
        input.value = candidate;
        input.id = id;
        input.dataset.key = group.key;
        if (repairContext.decisions[group.key] === candidate) input.checked = true;
        input.addEventListener("change", () => {
          repairContext.decisions[group.key] = candidate;
          rebuildRepairPlan();
          renderRepairPreview();
        });
        const label = el("label", "repair-choice");
        label.htmlFor = id;
        label.append(input, el("span", null, " Rattacher à " + candidate));
        block.append(label);
      });
      if (group.candidates.length === 0) {
        block.append(el("p", "repair-hint",
          "Aucune identité prouvée : aucun rattachement par titre, similitude ou retrait de préfixe."));
      }
      repairGroupsEl.append(block);
    });
  }
  if (repairBackupStatusEl) {
    repairBackupStatusEl.textContent = repairContext.backupCheck && repairContext.backupCheck.valid
      ? "Sauvegarde de récupération vérifiée : " + repairContext.backupCheck.counts.subjects +
        " sujet(s), " + repairContext.backupCheck.counts.items + " tâche(s), empreinte conforme."
      : "Sauvegarde de récupération absente ou invalide : la réparation reste désactivée.";
  }
  if (repairConfirmEl) {
    repairConfirmEl.disabled = !(repairConsentEl && repairConsentEl.checked) ||
      !repairContext.backup || !plan.writable;
  }
}
function openRepairPreview() {
  if (!recoveryContext || !recoveryContext.raw) {
    notify("Réparation indisponible : la lecture brute n'est pas accessible. Le diagnostic reste disponible.");
    return;
  }
  repairContext = {
    source: null,
    sourceRecords: null,
    provenance: null,
    decisions: {},
    plan: null,
    backup: null,
    backupCheck: null
  };
  rebuildRepairPlan();
  renderRepairPreview();
  const title = repairPreviewEl ? repairPreviewEl.querySelector("#repair-preview-title") : null;
  if (title) title.focus();
  notify("Prévisualisation de réparation : aucune écriture effectuée.");
}
async function loadRepairSource(file) {
  if (!repairContext || !file) return;
  if (file.size > 1024 * 1024) {
    notify("Fichier source trop volumineux : aucune réparation préparée.");
    return;
  }
  try {
    const parsed = parseRepairSource(await file.text());
    if (!parsed.ok) {
      notify(unsupportedV1Refusal(parsed.code).message + " Aucune réparation préparée.");
      return;
    }
    repairContext.sourceRecords = parsed.records;
    repairContext.source = null;
    repairContext.provenance = null;
    repairContext.decisions = {};
    rebuildRepairPlan();
    renderRepairPreview();
  } catch {
    notify("Fichier source illisible : aucune réparation préparée, la sauvegarde reste intacte.");
  }
}
function repairAdapter() {
  return {
    async commitRepairs(changes) {
      if (!syncedDatabase && !localDatabase) throw new Error("transaction-error");
      const db = syncedDatabase || localDatabase;
      await db.transaction("rw", db.subjects, db.items, async () => {
        for (const change of changes) {
          const table = change.store === "subjects" ? db.subjects : db.items;
          const current = await table.get(change.id);
          if (!current || current[change.field] !== change.from) {
            const error = new Error("collision");
            error.code = "collision";
            throw error;
          }
          await table.put({ ...current, [change.field]: change.to });
        }
      });
      return { status: "repaired", count: changes.length };
    }
  };
}
async function confirmRepair() {
  const context = repairContext;
  if (!context || !context.plan || !context.backup) {
    notify("Réparation refusée : sauvegarde de récupération vérifiable requise.");
    return;
  }
  if (!repairConsentEl || !repairConsentEl.checked) {
    notify("Réparation refusée : consentement explicite requis.");
    return;
  }
  if (!context.plan.writable) {
    notify("Réparation refusée : groupes ambigus ou consentement de provenance incomplet. Aucune écriture.");
    return;
  }
  const consent = {
    confirmed: true,
    fingerprint: context.plan.fingerprint,
    destinationFingerprint: context.plan.destinationFingerprint,
    backup: context.backup,
    backupExpected: {
      counts: {
        subjects: context.plan.counts.before.subjects,
        items: context.plan.counts.before.items
      }
    }
  };
  const outcome = await runRepairAsync(context, consent);
  if (outcome.status === REPAIR_OUTCOME.REPAIRED || outcome.status === REPAIR_OUTCOME.ALREADY_REPAIRED) {
    repairStatus = reduceRepairConvergence(repairStatus, {
      type: "local-committed",
      online: typeof navigator === "undefined" || navigator.onLine !== false
    });
    if (repairStatusEl) {
      repairStatusEl.textContent = outcome.status === REPAIR_OUTCOME.REPAIRED
        ? "Réparation enregistrée localement ; synchronisation Cloud en attente. Aucune convergence inter-appareils n'est affirmée."
        : "Réparation déjà appliquée : aucune nouvelle écriture.";
    }
    hideRepairPanel();
    await reloadRawAfterRepair();
    notify("Réparation locale enregistrée ; la propagation vers le serveur et un autre appareil reste à vérifier.");
    return;
  }
  if (repairStatusEl) {
    repairStatusEl.textContent = "Réparation non appliquée (" + outcome.code + "). Aucune écriture implicite.";
  }
  notify("Réparation non appliquée (" + outcome.code + "). Sauvegarde et enregistrements restent intacts.");
}
async function runRepairAsync(context, consent) {
  return runRepair(repairAdapter(), context.plan, consent, async () => {
    const fresh = syncedDatabase
      ? await readSyncedWorkspace(syncedDatabase)
      : await readWorkspaceResult(() => businessStore.readRaw());
    return {
      raw: fresh.raw,
      source: context.source,
      sourceRecords: context.sourceRecords,
      provenance: context.provenance,
      decisions: context.decisions,
      destination: repairDestination(),
      context: recoveryContext.instanceContext
    };
  });
}
function hideRepairPanel() {
  repairContext = null;
  if (repairPreviewEl) {
    repairPreviewEl.hidden = true;
    if (repairGroupsEl) repairGroupsEl.replaceChildren();
    if (repairConsentEl) repairConsentEl.checked = false;
    if (repairConfirmEl) repairConfirmEl.disabled = true;
  }
}
async function reloadRawAfterRepair() {
  try {
    if (syncedDatabase) {
      const result = await readSyncedWorkspace(syncedDatabase);
      if (result.code === "ok") clearRecovery();
      else enterRecoveryMode(result.raw, result.code);
    } else if (businessStore && typeof businessStore.readRaw === "function") {
      const result = await readWorkspaceResult(() => businessStore.readRaw());
      if (result.code === "ok") clearRecovery();
      else enterRecoveryMode(result.raw, result.code);
    }
  } catch {
    notifyError("Relecture après réparation impossible : rechargez la page pour recalculer le diagnostic.");
  }
}

function overviewPresentationBoundaryKey() {
  const identity = syncedDatabase
    ? [
      syncedDatabase.name || "synced",
      accountBinding.state || "",
      accountBinding.userDigest || accountBinding.digest || ""
    ]
    : ["local"];
  return [route.view, route.subjectId || "", ...identity].join("|");
}
function overviewPresentationNow() {
  return Date.now();
}
function cancelOverviewPresentationTimer() {
  overviewPresentationTimerGeneration += 1;
  if (overviewPresentationTimer !== null) {
    clearTimeout(overviewPresentationTimer);
    overviewPresentationTimer = null;
  }
}
function syncOverviewPresentationBoundary(boundaryKey) {
  if (boundaryKey === overviewPresentationBoundary) return;
  overviewPresentationBoundary = boundaryKey;
  overviewPendingSince = null;
  cancelOverviewPresentationTimer();
}
function overviewPresentationElapsed(boundaryKey) {
  syncOverviewPresentationBoundary(boundaryKey);
  if (overviewPendingSince === null) return 0;
  return Math.max(0, overviewPresentationNow() - overviewPendingSince);
}
function observeOverviewPresentation(presentation, boundaryKey) {
  syncOverviewPresentationBoundary(boundaryKey);
  if (route.view !== "overview") {
    cancelOverviewPresentationTimer();
    return;
  }
  const pending = presentation.state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ ||
    presentation.state === OVERVIEW_PRESENTATION_STATE.INITIALIZING;
  if (!pending) {
    if (presentation.state === OVERVIEW_PRESENTATION_STATE.AVAILABLE ||
        (presentation.actionRequired && presentation.reason !== "durable-wait")) {
      overviewPendingSince = null;
    }
    cancelOverviewPresentationTimer();
    return;
  }
  if (overviewPendingSince === null) overviewPendingSince = overviewPresentationNow();
  const elapsed = Math.max(0, overviewPresentationNow() - overviewPendingSince);
  const target = presentation.state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ &&
    elapsed < OVERVIEW_LOADER_DELAY_MS
    ? OVERVIEW_LOADER_DELAY_MS
    : OVERVIEW_DURABLE_WAIT_MS;
  const wait = Math.max(0, target - elapsed);
  cancelOverviewPresentationTimer();
  const generation = overviewPresentationTimerGeneration;
  const scheduledBoundary = overviewPresentationBoundary;
  overviewPresentationTimer = setTimeout(() => {
    overviewPresentationTimer = null;
    if (generation !== overviewPresentationTimerGeneration) return;
    if (scheduledBoundary !== overviewPresentationBoundaryKey()) return;
    if (route.view !== "overview") return;
    render();
  }, wait);
}
function overviewPresentationSignals(diagnostic, elapsedMs) {
  const configured = requiresAuthentication();
  return {
    configured,
    session: diagnostic.session,
    binding: diagnostic.binding,
    documentLoaded,
    readError: configured ? !!syncReadError : localReadFailed,
    writeError: localWriteStatus === LOCAL_WRITE_STATE.ERROR,
    localWrites: diagnostic.localWrites,
    baseMismatch: !!(diagnostic.base && diagnostic.base.mismatch),
    elapsedMs
  };
}
function refreshOverviewPresentation() {
  const diagnostic = buildSyncDiagnostic(readSyncDiagnosticInput());
  const boundary = overviewPresentationBoundaryKey();
  const elapsedMs = overviewPresentationElapsed(boundary);
  const presentation = buildOverviewReadPresentation(
    overviewPresentationSignals(diagnostic, elapsedMs)
  );
  observeOverviewPresentation(presentation, boundary);
  overviewPresentationSnapshot = { diagnostic, presentation };
  return overviewPresentationSnapshot;
}
function updateOverviewLoader(presentation) {
  if (!projectsLoadingEl) return;
  const active = route.view === "overview" && presentation.loaderVisible;
  const busy = active ? "true" : "false";
  if (overviewLoaderBusy !== busy) {
    projectsLoadingEl.setAttribute("aria-busy", busy);
    overviewLoaderBusy = busy;
  }
  if (projectsLoadingEl.hidden !== !active) {
    projectsLoadingEl.hidden = !active;
  }
  if (projectsLoadingEl.textContent !== OVERVIEW_LOADER_TEXT) {
    projectsLoadingEl.textContent = OVERVIEW_LOADER_TEXT;
  }
}
function applyOverviewSurfaces(snapshot) {
  const presentation = snapshot.presentation;
  updateOverviewLoader(presentation);
  if (route.view !== "overview" && overviewSummaryKey !== "") {
    overviewSummaryKey = "";
  }
  if (syncSummaryEl) {
    const show = route.view === "overview" && presentation.summaryVisible;
    if (syncSummaryEl.hidden !== !show) syncSummaryEl.hidden = !show;
    if (show && overviewSummaryKey !== presentation.summaryKey) {
      syncSummaryEl.textContent = presentation.summaryText;
      overviewSummaryKey = presentation.summaryKey;
    }
  }
  if (syncSettingsAccessEl) {
    const record = activationMarker();
    const localError = !requiresAuthentication() &&
      (localReadFailed || localWriteStatus === LOCAL_WRITE_STATE.ERROR);
    const showLink = route.view === "overview" && overviewAccessLinkVisible({
      configured: requiresAuthentication(),
      needsAttention: presentation.actionRequired,
      localError,
      activationNeedsResume: !!record &&
        (record.status === ACTIVATION_STATUS.SUSPENDED ||
          record.status === ACTIVATION_STATUS.CANCELLED)
    });
    if (syncSettingsAccessEl.hidden !== !showLink) {
      syncSettingsAccessEl.hidden = !showLink;
    }
  }
}

function applyBusinessVisibility() {
  const presentation = refreshOverviewPresentation().presentation;
  const configured = requiresAuthentication();
  const authenticated = canAccessBusiness(authState);
  const bindingBlocked = configured && accountBinding.businessAllowed !== true;
  const settingsSection = route.view === "settings" ? route.section : null;
  if (businessToolsEl) businessToolsEl.hidden = configured && (!authenticated || bindingBlocked);
  // Do not display an empty dashboard while IndexedDB is still loading or
  // while another account's cache is unverified/mismatched.
  if (dashboardEl) {
    dashboardEl.hidden = Boolean(settingsSection) ||
      (configured && (!authenticated || bindingBlocked || !documentLoaded));
    // A read that is genuinely authorized and still pending exposes the stable
    // placeholder instead of an empty or absent projects area.
    if (configured && !documentLoaded && !settingsSection && authenticated &&
        !bindingBlocked && presentation.state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ) {
      dashboardEl.hidden = false;
    }
    // In local mode the dashboard may load visibly, but a failed read must never
    // be presented as an authoritative empty workspace.
    if (!configured && !settingsSection) dashboardEl.hidden = localReadFailed;
  }
  applyOverviewSurfaces(overviewPresentationSnapshot);
  applySettingsVisibility(settingsSection);
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
  renderCleanupPanel();
  const local = !requiresAuthentication();
  localPanelEl.hidden = !local;
}
function setAuthStatus(message) {
  if (authStatusEl) authStatusEl.textContent = typeof message === "string" ? message : "";
}
function setAuthError(message) {
  if (!authErrorEl) return;
  authErrorEl.textContent = typeof message === "string" ? message : "";
  authErrorEl.hidden = !authErrorEl.textContent;
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
function cleanupBlockedMessage(code) {
  switch (code) {
    case CLEANUP_CODE.BACKUP_REQUIRED:
      return "Nettoyage désactivé : générez et vérifiez d'abord une sauvegarde IndexedDB modern dans cette session.";
    case CLEANUP_CODE.MIGRATION_REQUIRED:
      return "Nettoyage désactivé : la migration des préférences vers IndexedDB n'est pas vérifiée.";
    case CLEANUP_CODE.CONSENT_REQUIRED:
      return "Nettoyage désactivé : cochez la confirmation explicite, l'option par défaut est « ne rien effacer ».";
    case CLEANUP_CODE.EMPTY:
      return "Aucune clé V1 retirée n'est présente sur cette origine.";
    default:
      return "Nettoyage indisponible : aucune clé n'a été supprimée.";
  }
}
function renderCleanupPanel() {
  if (!cleanupPanelEl) return;
  cleanupInventory = buildCleanupInventory(localStorage);
  const present = cleanupInventory.status === "present";
  cleanupPanelEl.hidden = !present;
  if (!present) {
    if (cleanupListEl) cleanupListEl.replaceChildren();
    return;
  }
  if (cleanupListEl) {
    cleanupListEl.replaceChildren();
    const list = el("ul");
    for (const key of cleanupInventory.keys) list.append(el("li", null, key));
    cleanupListEl.append(list);
  }
  if (cleanupScopeEl) {
    cleanupScopeEl.textContent = "Portée : origine et navigateur courants uniquement. Aucune base IndexedDB, aucune donnée Cloud et aucun autre navigateur ne sont touchés.";
  }
  if (cleanupBackupStatusEl) {
    cleanupBackupStatusEl.textContent = modernBackupVerified
      ? (metadataMigrationComplete
        ? "Sauvegarde IndexedDB vérifiée dans cette session et préférences migrées : le nettoyage peut être confirmé."
        : "Sauvegarde vérifiée, mais la migration des préférences vers IndexedDB n'est pas terminée : nettoyage désactivé.")
      : "Générez et vérifiez une sauvegarde IndexedDB modern dans cette session avant tout nettoyage.";
  }
  const guardReady = modernBackupVerified && metadataMigrationComplete;
  if (cleanupConfirmEl) cleanupConfirmEl.disabled = !guardReady;
  if (cleanupDeleteEl) cleanupDeleteEl.disabled = !guardReady || !cleanupConfirmEl || !cleanupConfirmEl.checked;
}
function hideLocalImportPanel() {
  localImportContext = null;
  if (!migrationPanelEl) return;
  migrationPanelEl.hidden = true;
  migrationPanelEl.replaceChildren();
}
function renderLocalImportPanel() {
  const context = localImportContext;
  if (!context) return;
  const panel = migrationPanel();
  const plan = context.plan;
  panel.replaceChildren();
  const title = el("h2", "migration-title", "Importer et fusionner une sauvegarde IndexedDB");
  title.id = "migration-title";
  title.tabIndex = -1;
  const live = el("p", "migration-live", "");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  if (plan.status === LOCAL_MERGE_STATUS.COLLISION) {
    live.textContent = "Collision sur " + plan.collisions.length +
      " identifiant(s) au contenu différent : aucune écriture ne sera effectuée.";
  } else if (plan.status === LOCAL_MERGE_STATUS.ALREADY_PRESENT) {
    live.textContent = "Les enregistrements du fichier sont déjà présents à l'identique : aucune insertion n'est nécessaire.";
  } else {
    live.textContent = plan.operations.length + " enregistrement(s) absent(s) seront ajoutés, sans écrasement ni suppression.";
  }
  const inventory = el("div", "migration-inventory");
  inventory.append(el("p", null, "Source : " + plan.counts.subjects + " sujet(s), " + plan.counts.items + " tâche(s)."));
  inventory.append(el("p", null, "Cible actuelle : " + context.target.subjects.length + " sujet(s), " + context.target.items.length + " tâche(s)."));
  panel.append(title, live, inventory);
  const writable = plan.status === LOCAL_MERGE_STATUS.READY && plan.operations.length > 0;
  let consent = null;
  if (writable) {
    const label = el("label", "migration-consent");
    consent = el("input");
    consent.type = "checkbox";
    consent.id = "local-import-consent";
    label.append(consent, el("span", null,
      " Je confirme la fusion de ces seuls enregistrements absents. Aucune suppression ni restauration destructive."));
    panel.append(label);
  }
  const actions = el("div", "migration-actions");
  const accept = el("button", "primary migration-accept", "Confirmer la fusion");
  accept.type = "button";
  accept.id = "local-import-confirm";
  accept.disabled = true;
  if (writable && consent) {
    consent.addEventListener("change", () => { accept.disabled = !consent.checked; });
    accept.addEventListener("click", () => { void confirmLocalImport(); });
  }
  const refuse = el("button", "secondary migration-refuse", "Ne rien importer");
  refuse.type = "button";
  refuse.addEventListener("click", () => {
    hideLocalImportPanel();
    notify("Import annulé : aucune écriture effectuée.");
  });
  actions.append(accept, refuse);
  panel.append(actions);
  panel.hidden = false;
  title.focus();
}
async function openLocalImportPreview(records) {
  let target;
  try {
    target = await businessStore.read();
  } catch {
    setLocalError("Lecture de la cible locale impossible : import non proposé.");
    return;
  }
  const plan = planModernRecordsMerge(target, records);
  if (plan.status === LOCAL_MERGE_STATUS.INVALID) {
    notify(unsupportedV1Refusal(plan.code).message);
    return;
  }
  localImportContext = { records, target, plan };
  setLocalError("");
  renderLocalImportPanel();
}
async function confirmLocalImport() {
  const context = localImportContext;
  if (!context) return;
  const consent = document.querySelector("#local-import-consent");
  if (!consent || !consent.checked) {
    notify("Consentement explicite requis avant toute écriture d'import.");
    return;
  }
  await pendingCloudWrites;
  let fresh;
  try {
    fresh = await businessStore.read();
  } catch {
    notify("Lecture de la cible locale impossible : import non appliqué, aucune écriture.");
    return;
  }
  const plan = planModernRecordsMerge(fresh, context.records);
  if (plan.status === LOCAL_MERGE_STATUS.COLLISION || plan.status === LOCAL_MERGE_STATUS.INVALID) {
    hideLocalImportPanel();
    notify("Import bloqué (" + plan.code + ") : aucune écriture, les données existantes restent intactes.");
    return;
  }
  if (plan.operations.length === 0) {
    resetExpandedViewState();
    openMenuId = null;
    hideLocalImportPanel();
    notify("Aucune nouvelle insertion nécessaire : les enregistrements sont déjà présents.");
    return;
  }
  try {
    await businessStore.commit(plan.operations);
  } catch {
    notify("Échec de la transaction d'import : aucune écriture partielle, données existantes intactes.");
    return;
  }
  resetExpandedViewState();
  openMenuId = null;
  hideLocalImportPanel();
  notify("Import fusionné localement : seuls les enregistrements absents ont été ajoutés, sans suppression.");
  await refreshLocalDocument();
}
function renderAuthPanel() {
  if (!authPanelEl) return;
  const authenticated = canAccessBusiness(authState);
  authPanelEl.hidden = !requiresAuthentication() || authenticated;
  applyBusinessVisibility();
  renderSyncOnboarding();
  if (authPanelEl.hidden) return;
  if (authLocalDataEl) {
    authLocalDataEl.textContent = "L'espace de travail est masqué avant authentification. " +
      "Aucune donnée métier n'est lue depuis un stockage historique ; les données restent dans IndexedDB.";
  }
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
    recordBootstrap({ code: BOOTSTRAP_EVENT.SESSION_RESTORED, authenticated: true });
    void continueAuthenticatedWorkspace();
    return;
  }
  recordBootstrap({ code: BOOTSTRAP_EVENT.SESSION_RESTORED, authenticated: false });
  accountBinding = { state: BINDING_STATE.UNAUTHENTICATED, businessAllowed: false };
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
  if (businessStarted) {
    // A previous guarded read may have been hidden during transient identity checks.
    if (!documentLoaded && businessAllowed()) void refreshSyncedDocument();
    return;
  }
  if (requiresAuthentication() && !bindingAllowsBusiness()) return;
  businessStarted = true;
  documentLoaded = false;
  applyBusinessVisibility();
  notify("Chargement des données enregistrées dans IndexedDB…");
  if (!changesSubscribed) {
    subscribeToChanges();
    changesSubscribed = true;
  }
  // Cloud is the single source of truth after authentication, not localStorage.
  void refreshSyncedDocument().then(() => {
    void runActivationDiscovery();
  });
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
  syncLifecycle.dbOpenStarted();
  void syncedDatabase.open().then(() => {
    syncLifecycle.dbOpenResolved();
  }).catch(() => {
    syncLifecycle.dbOpenFailed();
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
  syncLifecycle.otpCancelled();
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
    notifyError("Enregistrement indisponible : gardez votre export JSON, ne supprimez pas les données locales.");
    return Promise.resolve();
  }
  // Mutations are serialized and lastRecords advances only AFTER Dexie
  // commits the local transaction. No false 'saved' on write failure.
  const records = documentToRecords(documentState);
  render();
  return commitOperations(records);
}
function resetExpandedViewState() {
  expandedParents = new Set();
  pendingCollapseFocus = null;
}
function currentAuthorizedWorkspaceIdentity() {
  if (!businessAllowed()) return null;
  if (!syncedDatabase) return { type: WORKSPACE_TYPE.LOCAL };
  const entry = selectedSyncedEntry();
  return {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    databaseName: typeof syncedDatabase.name === "string"
      ? syncedDatabase.name
      : (entry && entry.databaseName) || null,
    userDigest: (entry && typeof entry.userDigest === "string" && entry.userDigest) ||
      (accountBinding && (accountBinding.userDigest || accountBinding.digest)) || null
  };
}
function applyExpandedIdentityBoundary() {
  const identity = currentAuthorizedWorkspaceIdentity();
  const nextKey = authorizedWorkspaceIdentityKey(identity);
  if (shouldResetExpandedParents(expandedParentIdentityKey, identity)) {
    resetExpandedViewState();
  }
  if (nextKey !== null) expandedParentIdentityKey = nextKey;
}
function load() {
  // Async refreshes keep the user's transient expansion. Only explicit view
  // entries, reloads, new tabs, successful imports and identity changes reset it.
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
    notifyError("Stockage local indisponible : exportez votre sauvegarde historique si elle existe.");
    return;
  }
  if (localReadPending) return localReadPending;
  localReadPending = (async () => {
    await businessStore.open();
    let writesSnapshot;
    let result;
    do {
      writesSnapshot = pendingCloudWrites;
      await writesSnapshot;
      result = await readWorkspaceResult(() => businessStore.readRaw());
    } while (writesSnapshot !== pendingCloudWrites);
    if (result.code !== "ok") {
      localReadFailed = result.code !== READ_FAILURE.PROJECTION_INVALID;
      documentLoaded = result.code === READ_FAILURE.PROJECTION_INVALID;
      localWriteBlocked = true;
      localWriteStatus = reduceLocalWriteStatus(localWriteStatus, { type: "read-error" });
      enterRecoveryMode(result.raw, result.code);
      renderSyncDiagnostic();
      setLocalError(result.code === READ_FAILURE.PROJECTION_INVALID
        ? "Projection métier invalide : consultation locale en lecture seule ; aucun enregistrement n'est réécrit."
        : "Lecture IndexedDB non aboutie (" + result.code + ") : affichage non concluant, aucune base vide affirmée.");
      notifyError("Lecture locale non concluante (" + result.code + ") : export brut de récupération disponible si les stores sont lisibles.");
      return;
    }
    clearRecovery();
    const records = result.records;
    documentState = recordsToDocument(records);
    lastRecords = records;
    documentLoaded = true;
    localReadFailed = false;
    localWriteBlocked = false;
    await reloadMetadataPreference();
    setLocalError("");
    render();
    applyBusinessVisibility();
    renderSyncDiagnostic();
    setLocalStatus("Données chargées depuis IndexedDB sur cet appareil.");
    notify("Données chargées depuis IndexedDB sur cet appareil.");
  })().catch(() => {
    documentLoaded = false;
    localReadFailed = true;
    localWriteBlocked = true;
    localWriteStatus = reduceLocalWriteStatus(localWriteStatus, { type: "read-error" });
    applyBusinessVisibility();
    renderSyncDiagnostic();
    setLocalError("Lecture de l'espace IndexedDB impossible : affichage bloqué pour protéger les données. Vos données historiques restent exportables ; ne réimportez pas à l'aveugle.");
    notifyError("Lecture IndexedDB impossible : affichage bloqué pour protéger les données. Ne réimportez pas.");
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
async function saveResumePreference(ref) {
  if (!metadataStore) {
    notify("Stockage local des préférences indisponible : le suivi ne sera pas conservé.");
    return false;
  }
  try {
    await metadataStore.writeResume(ref);
    return true;
  } catch {
    notify("Stockage local des préférences indisponible : le suivi ne sera pas conservé durablement.");
    return false;
  }
}
async function removeResumePreference() {
  if (!metadataStore) return false;
  try {
    await metadataStore.removeResume();
    return true;
  } catch {
    return false;
  }
}
function reconcileResume() {
  const view = resumeView(documentState, resumeRef);
  if (view) return view;
  if (resumeRef && documentLoaded) {
    resumeRef = null;
    void removeResumePreference();
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
function applyNavigationMenu() {
  if (navMenuButtonEl) {
    navMenuButtonEl.setAttribute("aria-expanded", navMenuOpen ? "true" : "false");
  }
  if (navMenuPanelEl) navMenuPanelEl.hidden = !navMenuOpen;
}
function updateNavigationMenu(action) {
  const next = navigationMenuState({ open: navMenuOpen }, action);
  navMenuOpen = next.open;
  applyNavigationMenu();
  if (next.restoreFocus && navMenuButtonEl) navMenuButtonEl.focus();
  return next;
}
function focusRouteHeading(headingId) {
  if (!headingId) return;
  const heading = document.getElementById(headingId);
  if (!heading || heading.closest("[hidden]")) return;
  heading.focus();
}
function activateNavigationLink(event, target) {
  if (event) event.preventDefault();
  if (typeof target !== "string") return;
  updateNavigationMenu("navigate");
  const nextRoute = parseRoute(target);
  if (location.hash === target || (target === "#/" && (location.hash === "" || location.hash === "#"))) {
    pendingNavigationFocus = null;
    route = nextRoute;
    render();
    focusRouteHeading(routeHeadingId(nextRoute));
    return;
  }
  pendingNavigationFocus = routeHeadingId(nextRoute);
  location.hash = target;
}
function readCloudSettingsInput() {
  const diagnostic = buildSyncDiagnostic(readSyncDiagnosticInput());
  const interaction = authInteraction ||
    (authController && authController.currentInteraction());
  const record = activationMarker();
  const classification = activationContext && activationContext.classification
    ? activationContext.classification
    : null;
  const planReady = !!(activationContext && activationContext.displayedPlan);
  return {
    configured: diagnostic.configured,
    activationStage: activationState.stage,
    activationStatus: record ? record.status : null,
    authStatus: authState.status,
    otpPending: !!interaction && interaction.kind === "otp",
    authenticated: canAccessBusiness(authState),
    online: diagnostic.online !== false,
    classification,
    remoteAttested: !!classification || diagnostic.initialPull === INITIAL_PULL.COMPLETE,
    planReady,
    consentGiven: planReady && !!cloudActivationConsentEl && cloudActivationConsentEl.checked,
    firstSync: activationStatus.status,
    diagnostic,
    activationVisible: activationPanelVisible()
  };
}
function renderSyncOnboarding() {
  if (!syncOnboardingStepEl) return;
  const view = onboardingView(readCloudSettingsInput());
  syncOnboardingStepEl.textContent = view.isReached
    ? "Étape courante : " + view.title
    : "Prochaine étape : " + view.title;
  if (syncOnboardingMessageEl) syncOnboardingMessageEl.textContent = view.message;
  if (syncOnboardingNextEl) syncOnboardingNextEl.textContent = view.nextAction;
}
function applySyncSectionVisibility() {
  const visibility = syncSectionVisibility(readCloudSettingsInput());
  if (syncConfigurationSectionEl) syncConfigurationSectionEl.hidden = !visibility.configuration;
  if (syncActivationSectionEl) syncActivationSectionEl.hidden = !visibility.activation;
  if (syncConnectionSectionEl) syncConnectionSectionEl.hidden = !visibility.connection;
  if (syncWorkspacesSectionEl) syncWorkspacesSectionEl.hidden = !visibility.workspaces;
}
function applySettingsVisibility(section) {
  if (settingsPageEl) settingsPageEl.hidden = section !== "root";
  if (settingsDataPageEl) settingsDataPageEl.hidden = section !== "data";
  if (settingsSyncPageEl) settingsSyncPageEl.hidden = section !== "sync";
  applySyncSectionVisibility();
  renderSyncOnboarding();
}
function applySyncSummaryVisibility() {
  applyOverviewSurfaces(refreshOverviewPresentation());
}
// Transient viewport/focus continuity, scoped to one authorized view only.
// A full view transition or an account-binding change invalidates the capture.
function uxContext() {
  return {
    view: route.view,
    subjectId: route.subjectId || null,
    generation: bindingGeneration,
    allowed: businessAllowed()
  };
}
function uxSubject(id) {
  return [...subjectsEl.querySelectorAll(".subject")].find((node) => node.dataset.subject === id) || null;
}
function uxAnchorIdentity(node) {
  const subject = node.closest(".subject");
  if (!subject) return null;
  if (node.classList.contains("task-form")) return "form:" + subject.dataset.subject;
  if (node.classList.contains("task")) return "task:" + subject.dataset.subject + ":" + node.dataset.item;
  return "subject:" + subject.dataset.subject;
}
function uxVisibleAnchors() {
  if (typeof window.innerHeight !== "number" || window.innerHeight <= 0) return [];
  const nodes = [...subjectsEl.querySelectorAll(".task-form, .task")];
  // A subject card is a fallback when it has no visible task/form.
  if (!nodes.length) nodes.push(...subjectsEl.querySelectorAll(".subject"));
  return nodes.flatMap((node) => {
    if (typeof node.getBoundingClientRect !== "function") return [];
    const rect = node.getBoundingClientRect();
    const key = uxAnchorIdentity(node);
    return key ? [{ key, top: rect.top, bottom: rect.bottom, node }] : [];
  });
}
function uxFocusIdentity(node) {
  if (!node || typeof node.closest !== "function" || !subjectsEl.contains(node)) return null;
  const subject = node.closest(".subject");
  if (!subject) return null;
  const subjectId = subject.dataset.subject;
  const task = node.closest(".task");
  const form = node.closest(".task-form");
  if (form) {
    return { kind: "create", subjectId,
      control: node.tagName === "INPUT" ? "input" : node.tagName === "SELECT" ? "select" : "button" };
  }
  const selectors = [
    ".task-check", ".priority-control", ".task-menu-button", ".task-handle",
    ".task-toggle", ".task-edit", ".task-edit-title", ".task-menu-command"
  ];
  const control = selectors.find((selector) => node.matches && node.matches(selector)) || null;
  if (task) return { kind: "task", subjectId, itemId: task.dataset.item, control };
  return { kind: "subject", subjectId,
    control: [".subject-open", ".subject-rename", ".subject-rename-input"].find(
      (selector) => node.matches && node.matches(selector)) || null };
}
function uxFindFocus(identity) {
  if (!identity) return null;
  const subject = uxSubject(identity.subjectId);
  if (!subject) return null;
  if (identity.kind === "create") {
    return subject.querySelector(".task-form " + identity.control) || subject;
  }
  if (identity.kind === "subject") {
    return (identity.control && subject.querySelector(identity.control)) || subject;
  }
  const task = [...subject.querySelectorAll(".task")].find(
    (node) => node.dataset.item === identity.itemId);
  // A filtered or removed task cannot regain focus.
  if (!task) return subject.querySelector(".task-form input") || subject;
  return (identity.control && task.querySelector(identity.control)) ||
    task.querySelector(".task-check, .task-menu-button") || subject;
}
function captureUxContinuity() {
  const context = uxContext();
  if (!shouldRestoreInteraction(lastRenderedUxContext, context)) return null;
  const anchors = uxVisibleAnchors();
  const visible = selectReadingAnchor(anchors, window.innerHeight);
  const active = document.activeElement;
  return {
    context,
    anchors: anchors.map(({ key, top }) => ({ key, top })),
    anchorKey: visible && visible.key,
    scrollY: Number.isFinite(window.scrollY) ? window.scrollY : 0,
    focus: uxFocusIdentity(active),
    focusedNode: active
  };
}
// Explicitly restore after the DOM has been reconstructed. DOM removal can
// clamp window.scrollY to zero before the browser paints the replacement list.
function restoreUxScroll(snapshot) {
  if (!snapshot || !shouldRestoreInteraction(snapshot.context, uxContext())) return;
  const now = uxVisibleAnchors();
  const selected = resolveReadingAnchor(snapshot.anchors, snapshot.anchorKey, now.map((x) => x.key));
  const replacement = selected && now.find((x) => x.key === selected.key);
  const currentY = Number.isFinite(window.scrollY) ? window.scrollY : 0;
  const delta = replacement
    ? readingScrollDelta(selected.top, replacement.top, window.innerHeight)
    : null;
  // When the anchor itself was removed, retain the old absolute scroll
  // position, naturally bounded by the new document height.
  const target = Math.max(0, delta === null ? snapshot.scrollY : currentY + delta);
  if (Math.abs(target - currentY) >= 1 && typeof window.scrollTo === "function") {
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
  }
}
function finishUxRender(snapshot, skipFocus = false) {
  const version = ++uxRenderVersion;
  const context = uxContext();
  lastRenderedUxContext = context.allowed ? context : null;
  if (pendingTaskCreationFocus) {
    const subject = uxSubject(pendingTaskCreationFocus);
    pendingTaskCreationFocus = null;
    const field = subject && subject.querySelector(".task-form input");
    if (field && context.allowed) field.focus({ preventScroll: true });
  } else if (snapshot && snapshot.focus && !skipFocus &&
      (!snapshot.focusedNode.isConnected || document.activeElement === document.body)) {
    const target = uxFindFocus(snapshot.focus);
    if (target) target.focus({ preventScroll: true });
  }
  if (!snapshot || !shouldRestoreInteraction(snapshot.context, context)) return;
  restoreUxScroll(snapshot);
  // Layout/scroll anchoring can settle on the next frame, especially on
  // Chromium Android with the virtual keyboard. Re-apply only for the current
  // render and authorized view; never restore into a newer navigation.
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      if (version !== uxRenderVersion ||
          !shouldRestoreInteraction(snapshot.context, uxContext())) return;
      restoreUxScroll(snapshot);
    });
  }
}
// Build the replacement tree detached from the live document. Huawei M5's
// Android browser can clamp the page position as soon as an emptied grid loses
// its height, before a later scrollTo() can recover it. A single atomic swap
// with the previous height reserved avoids the transient empty-page state.
function replaceSubjectsInCurrentView(nextSubjects, snapshot) {
  const oldMinHeight = subjectsEl.style.minHeight;
  let guarded = false;
  if (snapshot) {
    const height = subjectsEl.getBoundingClientRect().height;
    if (Number.isFinite(height) && height > 0) {
      subjectsEl.style.minHeight = Math.ceil(height) + "px";
      guarded = true;
    }
  }
  try {
    subjectsEl.replaceChildren(nextSubjects);
  } finally {
    if (guarded) subjectsEl.style.minHeight = oldMinHeight;
  }
}
function render() {
  applyExpandedIdentityBoundary();
  // An intentional reveal/navigation must not be undone by scroll restoration.
  const uxSnapshot = pendingNavigationFocus || focusDetailHeading || focusOpenSubjectId ||
    (focusItemId && focusItemId === revealItemId) ? null : captureUxContinuity();
  const explicitUxFocus = Boolean(pendingNavigationFocus || focusDetailHeading ||
    focusOpenSubjectId || focusItemId || focusSubjectId || focusRenameControl ||
    pendingCollapseFocus || pendingPriorityFocus || pendingMenuFocus ||
    pendingMoveFocus || editingItemId || renamingSubject);
  applyBusinessVisibility();
  applyNavigationMenu();
  applySyncSummaryVisibility();
  if (!businessAllowed()) {
    applyFocus();
    finishUxRender(null, true);
    return;
  }
  expandAncestorForFocus();
  if (reorderNoteEl) reorderNoteEl.hidden = !hideCompleted;
  const n = pendingCount(documentState);
  counterEl.textContent = n + (n > 1 ? " prochaines étapes" : " prochaine étape");
  const presentation = overviewPresentationSnapshot
    ? overviewPresentationSnapshot.presentation
    : null;
  const suppressOverview = route.view === "overview" && !!presentation &&
    (presentation.state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ ||
      (presentation.actionRequired && !presentation.projectsAvailable));
  counterEl.hidden = suppressOverview;
  if (route.view === "settings") {
    // Real navigation: do not retain an unrelated list's height.
    subjectsEl.replaceChildren();
    subjectForm.hidden = true;
    focusSuggestEl.hidden = true;
    focusCardEl.hidden = true;
    resumeCardEl.hidden = true;
    applyFocus();
    finishUxRender(uxSnapshot, explicitUxFocus);
    return;
  }
  if (suppressOverview) {
    // A necessary read that has not produced a trustworthy document must never
    // show an empty list, a zero counter or an inoperative suggestion.
    subjectForm.hidden = true;
    focusSuggestEl.hidden = true;
    focusCardEl.hidden = true;
    resumeCardEl.hidden = true;
    if (reorderNoteEl) reorderNoteEl.hidden = true;
    replaceSubjectsInCurrentView(document.createDocumentFragment(), uxSnapshot);
    applyFocus();
    finishUxRender(uxSnapshot, explicitUxFocus);
    return;
  }
  const detail = route.view !== "overview";
  subjectForm.hidden = detail;
  focusSuggestEl.hidden = detail;
  const nextSubjects = document.createDocumentFragment();
  if (detail) {
    focusCardEl.hidden = true;
    resumeCardEl.hidden = true;
    renderDetail(nextSubjects);
  } else {
    renderSuggestion();
    renderResumeCard();
    if (!documentState.subjects.length) {
      nextSubjects.append(el("p", "empty", "Aucun sujet pour le moment. Ajoutez un premier fil de travail ci-dessus."));
    } else {
      for (const subject of documentState.subjects) nextSubjects.append(renderSubject(subject));
    }
  }
  // No intermediate blank grid or multi-step append to the live scroll tree.
  replaceSubjectsInCurrentView(nextSubjects, uxSnapshot);
  applyFocus();
  finishUxRender(uxSnapshot, explicitUxFocus);
}
function navigate(hash) {
  if (location.hash === hash) {
    route = parseRoute(hash);
    render();
    return;
  }
  location.hash = hash;
}
function renderDetail(target = subjectsEl) {
  if (route.view === "invalid") {
    target.append(renderDetailFallback());
    return;
  }
  const subject = findSubject(documentState, route.subjectId);
  if (!subject) {
    target.append(renderDetailFallback());
    return;
  }
  target.append(renderDetailView(subject));
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
  if (pendingNavigationFocus) {
    const headingId = pendingNavigationFocus;
    pendingNavigationFocus = null;
    focusRouteHeading(headingId);
    return;
  }
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
  void removeResumePreference();
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
    void saveResumePreference(resumeRef);
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
  form.dataset.subject = subject.id;
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
    pendingTaskCreationFocus = subject.id;
    persist();
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
      void saveResumePreference(resumeRef);
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
  if (event.key === "Escape" && navMenuOpen) {
    event.preventDefault();
    updateNavigationMenu("escape");
    return;
  }
  if (event.key !== "Escape" || !dragState) return;
  event.preventDefault();
  cancelDrag(null);
});
document.addEventListener("click", (event) => {
  const target = event.target;
  if (navMenuOpen && target && typeof target.closest === "function" &&
      !target.closest("#nav-menu-panel") && !target.closest("#nav-menu-button")) {
    updateNavigationMenu("outside");
  }
  if (!openMenuId) return;
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
if (workspaceApplyEl) workspaceApplyEl.addEventListener("click", () => { void applyWorkspaceSelection(); });
if (workspaceSuspendEl) workspaceSuspendEl.addEventListener("click", () => { void suspendCurrentWorkspace(); });
if (workspaceLogoutEl) workspaceLogoutEl.addEventListener("click", () => { void requestWorkspaceLogout(); });
if (workspacePurgeEl) workspacePurgeEl.addEventListener("click", () => { void requestWorkspacePurge(); });
if (workspaceRecoverEl) workspaceRecoverEl.addEventListener("click", () => { void requestWorkspaceRecovery(); });
if (workspaceConfirmationCancelEl) workspaceConfirmationCancelEl.addEventListener("click", () => {
  const kind = workspaceConfirmation ? workspaceConfirmation.kind : null;
  hideWorkspaceConfirmation();
  notify("Action annulée : la session, la base locale et la destination restent inchangées.");
  if (kind === "logout" && workspaceLogoutEl) workspaceLogoutEl.focus();
  else if (kind === "recover" && workspaceRecoverEl) workspaceRecoverEl.focus();
  else if (workspacePurgeEl) workspacePurgeEl.focus();
});
if (workspaceBackupEl) workspaceBackupEl.addEventListener("click", () => { downloadWorkspaceSnapshot(); });
if (workspaceConfirmationContinueEl) {
  workspaceConfirmationContinueEl.addEventListener("click", () => { void confirmWorkspaceAction(); });
}
document.querySelector("#export").addEventListener("click", exportBusinessBackup);
if (restoreInputEl) restoreInputEl.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    notify("Fichier de restauration trop volumineux : aucune écriture.");
    return;
  }
  try {
    await openRestorePreview(await file.text());
  } catch {
    notify("Restauration impossible : aucune écriture.");
  }
});
if (restoreDownloadBackupEl) restoreDownloadBackupEl.addEventListener("click", downloadRestoreBackup);
if (restoreConfirmationEl) restoreConfirmationEl.addEventListener("input", updateRestoreConfirmState);
if (restoreConfirmEl) restoreConfirmEl.addEventListener("click", () => { void confirmRestore(); });
if (restoreCancelEl) restoreCancelEl.addEventListener("click", () => {
  hideRestorePanel();
  notify("Restauration annulée : aucune écriture effectuée.");
});
if (recoveryRawExportEl) recoveryRawExportEl.addEventListener("click", exportRawRecovery);
if (recoveryRepairPreviewEl) recoveryRepairPreviewEl.addEventListener("click", openRepairPreview);
if (repairSourceEl) repairSourceEl.addEventListener("change", () => {
  const file = repairSourceEl.files && repairSourceEl.files[0];
  if (file) void loadRepairSource(file);
});
if (repairConsentEl) repairConsentEl.addEventListener("change", () => {
  if (repairConfirmEl) {
    repairConfirmEl.disabled = !repairConsentEl.checked || !repairContext ||
      !repairContext.backup || !repairContext.plan || !repairContext.plan.writable;
  }
});
if (repairConfirmEl) repairConfirmEl.addEventListener("click", () => { void confirmRepair(); });
if (repairCancelEl) repairCancelEl.addEventListener("click", () => {
  hideRepairPanel();
  notify("Réparation annulée : aucune écriture effectuée.");
});
document.querySelector("#import").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("Fichier trop volumineux (maximum 1 Mo).");
    const text = await file.text();
    const parsed = parseIndexedDbBackup(text);
    if (!parsed.ok) {
      notify(unsupportedV1Refusal(parsed.code).message);
      return;
    }
    if (syncedDatabase) {
      if (!businessAllowed() || !documentLoaded) {
        notify("Connectez-vous et attendez la lecture IndexedDB avant tout import.");
        return;
      }
      await pendingCloudWrites;
      await offerJsonReconciliation(parsed.records);
      return;
    }
    // Import is always a non-destructive merge. A destructive restore remains a
    // distinct intention and is never an implicit effect of this action.
    invalidatePendingRemoval();
    await openLocalImportPreview(parsed.records);
    notify("Import local en prévisualisation : fusion sans suppression. Aucune écriture avant votre confirmation.");
  } catch {
    notify("Import impossible : lecture ou enregistrement refusé. Conservez votre fichier de sauvegarde.");
  } finally {
    event.target.value = "";
  }
});
if (navMenuButtonEl) {
  navMenuButtonEl.addEventListener("click", () => {
    updateNavigationMenu("toggle");
  });
}
if (navMenuPanelEl) {
  for (const link of navMenuPanelEl.querySelectorAll("a[href]")) {
    link.addEventListener("click", (event) => {
      activateNavigationLink(event, link.getAttribute("href"));
    });
  }
}
window.addEventListener("hashchange", () => {
  const nextRoute = parseRoute(location.hash);
  if (isViewEntry(route, nextRoute)) resetExpandedViewState();
  openMenuId = null;
  updateNavigationMenu("route-change");
  route = nextRoute;
  render();
});
if (cleanupKeepEl) cleanupKeepEl.addEventListener("click", () => {
  if (cleanupConfirmEl) cleanupConfirmEl.checked = false;
  if (cleanupStatusEl) cleanupStatusEl.textContent = "Aucune clé V1 n'a été supprimée. Les valeurs restent intactes.";
  notify("Nettoyage annulé : aucune clé V1 n'a été supprimée.");
});
if (cleanupConfirmEl) cleanupConfirmEl.addEventListener("change", () => {
  if (cleanupDeleteEl) {
    cleanupDeleteEl.disabled = !modernBackupVerified || !metadataMigrationComplete || !cleanupConfirmEl.checked;
  }
});
if (cleanupDeleteEl) cleanupDeleteEl.addEventListener("click", () => {
  const decision = evaluateCleanup({
    inventory: cleanupInventory,
    backupVerified: modernBackupVerified,
    metadataMigrationComplete,
    confirmed: !!(cleanupConfirmEl && cleanupConfirmEl.checked)
  });
  if (!decision.allowed) {
    if (cleanupStatusEl) cleanupStatusEl.textContent = cleanupBlockedMessage(decision.code);
    notify(cleanupBlockedMessage(decision.code));
    return;
  }
  const result = runCleanup(localStorage, cleanupInventory, {
    backupVerified: modernBackupVerified,
    metadataMigrationComplete,
    confirmed: true
  });
  cleanupInventory = buildCleanupInventory(localStorage);
  if (cleanupConfirmEl) cleanupConfirmEl.checked = false;
  renderCleanupPanel();
  if (cleanupStatusEl) {
    cleanupStatusEl.textContent = result.removed.length > 0
      ? "Clés V1 supprimées : " + result.removed.join(", ") +
        (result.remaining.length > 0 ? ". Restent intactes : " + result.remaining.join(", ") + "." : ".")
      : "Aucune clé V1 n'a été supprimée. " +
        (result.remaining.length > 0 ? "Restent intactes : " + result.remaining.join(", ") + "." : "");
  }
  notify(result.removed.length > 0
    ? "Nettoyage volontaire effectué sur les seules clés V1 listées pour cette origine."
    : "Nettoyage sans suppression : les valeurs restent intactes.");
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
if (cloudActivationStartEl) cloudActivationStartEl.addEventListener("click", startActivation);
if (cloudActivationResumeEl) cloudActivationResumeEl.addEventListener("click", resumeActivation);
if (cloudActivationConfirmEl) cloudActivationConfirmEl.addEventListener("click", () => { void confirmActivation(); });
if (cloudActivationCancelEl) cloudActivationCancelEl.addEventListener("click", cancelActivation);
if (cloudActivationRetryEl) cloudActivationRetryEl.addEventListener("click", retryActivation);
if (cloudActivationConsentEl) {
  cloudActivationConsentEl.addEventListener("change", () => {
    if (!cloudActivationConfirmEl) return;
    const ready = !!activationContext && activationContext.displayedPlan &&
      activationContext.displayedPlan.operations.length > 0 &&
      activationState.stage === ACTIVATION_STAGE.REVIEW;
    cloudActivationConfirmEl.disabled = !ready || !cloudActivationConsentEl.checked;
  });
}
window.addEventListener("online", () => { if (authController) authController.refresh(); renderSyncDiagnostic(); updateActivationFromNative(); });
window.addEventListener("offline", () => { if (authController) authController.refresh(); renderSyncDiagnostic(); updateActivationFromNative(); });
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
    const markerWritten = writeActivationRecord(localStorage, createActivationRecord({
      status: ACTIVATION_STATUS.ACTIVATING,
      url: result.url
    }));
    if (!markerWritten) {
      showCloudConfigError("Impossible d'enregistrer l'activation dans ce navigateur. La source locale reste intacte.");
      return;
    }
    const registered = registerWorkspace(workspaceRegistry, {
      url: result.url,
      databaseName: workspaceDatabaseName(result.url),
      schemaVersion: SCHEMA_VERSION,
      status: WORKSPACE_STATUS.ACTIVATING
    });
    const selectedRegistry = selectWorkspaceInRegistry(registered, result.url);
    if (!selectedRegistry || !persistWorkspaceRegistry(selectedRegistry)) {
      showCloudConfigError("Impossible d'enregistrer l'espace de travail. La source locale reste intacte.");
      return;
    }
    activationState = initialActivationState();
    activationStatus = initialFirstSyncState();
    activationContext = null;
    if (cloudUrlEl) cloudUrlEl.value = result.url;
    hideCloudConfigError();
    syncedDatabase = bootstrapSyncedDatabase(workspaceEntry);
    businessStore = syncedDatabase ? createDexieStore(syncedDatabase) : null;
    setupMetadataStore(syncedDatabase);
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
    syncReadError = null;
    localWriteStatus = LOCAL_WRITE_STATE.NOT_APPLICABLE;
    syncDiagnosticAnnouncement = "";
    renderCloudConfig();
    renderLocalWorkspace();
    renderActivationPanel();
    if (syncedDatabase) {
      activationState = { ...initialActivationState(), stage: ACTIVATION_STAGE.CONNECTING };
      setupAuthentication();
    } else {
      if (!localDatabase) localDatabase = bootstrapLocalDatabase();
      businessStore = createDexieStore(localDatabase);
      setupMetadataStore(localDatabase);
      startLocalWorkspace();
    }
    setupSyncDiagnostics();
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
      localWriteStatus = reduceLocalWriteStatus(localWriteStatus, { type: "commit-local" });
      broadcastChange();
      if (syncedDatabase) {
        notify("Enregistré dans IndexedDB ; synchronisation Cloud à confirmer.");
      } else {
        setLocalError("");
        setLocalStatus("Enregistré sur cet appareil dans IndexedDB.");
        notify("Enregistré sur cet appareil dans IndexedDB.");
      }
      renderSyncDiagnostic();
    } catch (error) {
      localWriteStatus = reduceLocalWriteStatus(localWriteStatus, { type: "commit-error" });
      documentState = recordsToDocument(lastRecords);
      render();
      renderSyncDiagnostic();
      if (syncedDatabase) {
        cloudWriteBlocked = true;
        const refusal = classifyPermissionFailure(error && error.cause ? error.cause : error);
        notifyError(refusal ? authMessage(refusal) :
          "Échec d'écriture IndexedDB : données non enregistrées. Conservez votre export JSON.");
      } else {
        localWriteBlocked = true;
        const message = isLocalError(error)
          ? "Échec de la transaction locale : la modification n'est pas enregistrée. Exportez votre sauvegarde puis rechargez."
          : "Échec d'écriture IndexedDB local : données non enregistrées. Conservez votre export JSON.";
        setLocalError(message);
        notifyError(message);
      }
    }
  });
  return pendingCloudWrites;
}
async function refreshSyncedDocument() {
  if (!syncedDatabase || !businessAllowed() || !bindingAllowsBusiness()) return;
  // Await previously submitted writes before replacing the DOM from IndexedDB.
  if (cloudReadPending) {
    // Merge concurrent resume/sync events into at most one subsequent read.
    cloudReadReplayRequested = true;
    return cloudReadPending;
  }
  const readDatabase = syncedDatabase;
  const readDigest = accountBinding.userDigest || accountBinding.digest || null;
  const stillAuthorized = () => syncedDatabase === readDatabase && businessAllowed() &&
    (accountBinding.userDigest || accountBinding.digest || null) === readDigest;
  cloudReadPending = (async () => {
    let writesSnapshot;
    let result;
    // Mutations may arrive while a reactive refresh reads IndexedDB. Never
    // replace a freshly edited UI with a stale snapshot.
    do {
      writesSnapshot = pendingCloudWrites;
      await writesSnapshot;
      result = await readSyncedWorkspace(syncedDatabase);
    } while (writesSnapshot !== pendingCloudWrites);
    if (!stillAuthorized()) return;
    if (result.code === "ok") {
      await reloadMetadataPreference();
      if (!stillAuthorized()) return;
      recordBootstrap({ code: BOOTSTRAP_EVENT.BUSINESS_READ, ok: true });
      clearRecovery();
      const nextDocument = recordsToDocument(result.records);
      documentState = nextDocument;
      lastRecords = result.records;
      documentLoaded = true;
      cloudWriteBlocked = false;
      syncReadError = null;
      render();
      applyBusinessVisibility();
      renderSyncDiagnostic();
      notify("Données chargées depuis IndexedDB ; synchronisation Cloud à confirmer.");
      return;
    }
    recordBootstrap({ code: BOOTSTRAP_EVENT.BUSINESS_READ, ok: false });
    documentLoaded = result.code === READ_FAILURE.PROJECTION_INVALID;
    syncReadError = { name: "ReadError", code: result.code };
    cloudWriteBlocked = true;
    enterRecoveryMode(result.raw, result.code);
    renderSyncDiagnostic();
    notifyError(result.code === READ_FAILURE.PROJECTION_INVALID
      ? "Projection métier invalide : consultation en lecture seule, aucune donnée n'est masquée sans explication."
      : "Lecture IndexedDB non aboutie (" + result.code + ") : aucune conclusion de base vide ni de synchronisation confirmée.");
  })().catch((error) => {
    if (!stillAuthorized()) return;
    documentLoaded = false;
    syncReadError = { name: "ReadError", code: READ_FAILURE.INDETERMINATE };
    cloudWriteBlocked = true;
    applyBusinessVisibility();
    renderSyncDiagnostic();
    notifyError("État de lecture indéterminé : aucune base vide ni synchronisation confirmée n'est affirmée.");
  }).finally(() => {
    cloudReadPending = null;
    const replay = cloudReadReplayRequested;
    cloudReadReplayRequested = false;
    if (replay && businessStarted && businessAllowed() && !documentLoaded && !syncReadError) {
      void refreshSyncedDocument();
    }
  });
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
  if (syncedDatabase && bindingAllowsBusiness() &&
      syncedDatabase.cloud.events.syncComplete) {
    syncedDatabase.cloud.events.syncComplete.subscribe(() => {
      recordSyncObservationFromNative();
      const attestation = evaluateSyncAttestation(nativeAttestationInput());
      migrationStatus = reduceReconciliationStatus(migrationStatus, {
        type: "sync-complete",
        attested: attestation.attested
      });
      localWriteStatus = reduceLocalWriteStatus(localWriteStatus, {
        type: "sync-complete",
        attested: attestation.attested
      });
      renderSyncDiagnostic();
      load();
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
  const entry = selectedSyncedEntry();
  if (entry) return entry.url;
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
function syncLocalWriteStatusFromNative() {
  const configured = shouldOpenSyncedDatabase(readCloudConfig());
  if (!configured) {
    if (localWriteStatus === LOCAL_WRITE_STATE.NONE) {
      localWriteStatus = LOCAL_WRITE_STATE.NOT_APPLICABLE;
    }
    return;
  }
  if (localWriteStatus === LOCAL_WRITE_STATE.NOT_APPLICABLE) {
    localWriteStatus = LOCAL_WRITE_STATE.NONE;
  }
  if (!syncedDatabase) return;
  const cloud = syncedDatabase.cloud;
  if (!cloud) return;
  const phase = normalizeSyncState(observableValue(cloud.syncState)).phase;
  if (localWriteStatus !== LOCAL_WRITE_STATE.LOCAL && localWriteStatus !== LOCAL_WRITE_STATE.PENDING) {
    return;
  }
  const persisted = observableValue(cloud.persistedSyncState);
  localWriteStatus = reduceLocalWriteStatus(localWriteStatus, {
    type: "sync-state",
    phase,
    initiallySynced: !!persisted && persisted.initiallySynced === true
  });
}
function readSyncDiagnosticInput() {
  syncLocalWriteStatusFromNative();
  const config = readCloudConfig();
  const configured = shouldOpenSyncedDatabase(config);
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  const refusal = authState.kind === AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL ||
    authState.kind === AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL
    ? authState.kind
    : null;
  return {
    configured,
    databaseUrl: configured ? config.databaseUrl : null,
    online: typeof navigator === "undefined" || navigator.onLine !== false,
    user: observableValue(cloud && cloud.currentUser),
    syncState: observableValue(cloud && cloud.syncState),
    persistedSyncState: persisted,
    localWrites: localWriteStatus,
    readError: syncReadError,
    authRefusal: refusal,
    authLoading: !!syncedDatabase && authState.status === AUTH_STATUS.LOADING,
    authExpired: !!syncedDatabase && authState.status === AUTH_STATUS.EXPIRED,
    workspace: workspaceDiagnosticInput(),
    binding: accountBinding.state,
    bootstrap: currentBootstrapClassification()
  };
}
function nativePullAdapter(db) {
  return db.cloud.sync({ purpose: "pull", wait: true });
}
function currentObservedUserDigest() {
  const entry = selectedSyncedEntry();
  if (entry && typeof entry.userDigest === "string" && entry.userDigest.length > 0) {
    return entry.userDigest;
  }
  return accountBinding && typeof accountBinding.userDigest === "string"
    ? accountBinding.userDigest
    : null;
}
function syncObservationEvidence(eventReceived) {
  const entry = selectedSyncedEntry();
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  const phase = normalizeSyncState(observableValue(cloud && cloud.syncState)).phase;
  const url = entry ? entry.url : migrationDestination();
  const databaseName = syncedDatabase && typeof syncedDatabase.name === "string"
    ? syncedDatabase.name
    : null;
  const remoteDbId = persisted && typeof persisted.remoteDbId === "string"
    ? persisted.remoteDbId
    : null;
  const userDigest = currentObservedUserDigest();
  return {
    eventReceived: eventReceived === true,
    session: diagnosticSessionCategory(),
    binding: accountBinding.state,
    url,
    databaseName,
    remoteDbId,
    userDigest,
    phase,
    persistedSyncState: persisted,
    eventUrl: url,
    eventDatabaseName: databaseName,
    eventRemoteDbId: remoteDbId,
    eventUserDigest: userDigest
  };
}
function recordSyncObservationFromNative() {
  // Purely passive: a storage failure never blocks the native synchronization
  // nor any business write. Unattributable events leave no record behind.
  try {
    const input = syncObservationEvidence(true);
    if (!shouldRecordSyncObservation(input)) return;
    const record = buildSyncObservationRecord(input, Date.now());
    if (record) writeSyncObservation(localStorage, record);
  } catch {
    // The interface keeps "Date non disponible" when nothing was recorded.
  }
}
function currentObservedSync() {
  const entry = selectedSyncedEntry();
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  return resolveObservedSync({
    storage: localStorage,
    binding: accountBinding.state,
    url: entry ? entry.url : migrationDestination(),
    databaseName: syncedDatabase && typeof syncedDatabase.name === "string"
      ? syncedDatabase.name
      : null,
    remoteDbId: persisted && typeof persisted.remoteDbId === "string"
      ? persisted.remoteDbId
      : null,
    userDigest: currentObservedUserDigest()
  });
}
function revealExistingControl(targetId) {
  if (typeof targetId !== "string") return;
  const target = document.getElementById(targetId);
  if (!target) return;
  const disclosure = target.closest("details");
  if (disclosure) disclosure.open = true;
  const section = target.closest(".sync-section");
  if (section) section.hidden = false;
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "nearest" });
  }
  if (typeof target.focus === "function") target.focus();
}
function trustHelp(container, id, guidance) {
  const button = el("button", "sync-help-toggle", "Pourquoi ?");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", id);
  const panel = el("div", "sync-help-panel");
  panel.id = id;
  panel.hidden = true;
  panel.append(
    el("p", null, guidance.state.meaning),
    el("p", null, "Données accessibles : " + guidance.state.accessibleData),
    el("p", null, "Données masquées : " + guidance.state.maskedData),
    el("p", null, "Risque : " + guidance.state.risk),
    el("p", null, "Action sûre : " + guidance.state.safeAction),
    el("p", null, "Actions interdites : " + guidance.state.forbiddenActions.join(" ; ") + ".")
  );
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", expanded ? "false" : "true");
    panel.hidden = expanded;
  });
  container.append(button, panel);
}
function paintSyncTrustLocation(guidance) {
  if (!syncTrustLocationBodyEl) return;
  syncTrustLocationBodyEl.replaceChildren();
  const status = el("p", "sync-trust-primary", guidance.locationLabel);
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("data-state", guidance.state.key);
  syncTrustLocationBodyEl.append(status);
  syncTrustLocationBodyEl.append(el("p", "sync-trust-secondary",
    "Mode actif : " + (guidance.mode === "synchronized"
      ? "espace synchronisé Dexie Cloud"
      : "espace local autonome") + "."));
  const base = el("p", "sync-trust-secondary");
  base.append(el("strong", null, "Base locale IndexedDB : "));
  base.append(el("code", null, guidance.databaseName || "indisponible"));
  syncTrustLocationBodyEl.append(base);
  if (guidance.destination) {
    syncTrustLocationBodyEl.append(el("p", "sync-trust-secondary",
      "Destination Cloud : " + (guidance.destination.url || "URL indisponible")));
    if (guidance.destination.remoteDbId) {
      syncTrustLocationBodyEl.append(el("p", "sync-trust-secondary",
        "Identifiant distant : " + guidance.destination.remoteDbId));
    }
    syncTrustLocationBodyEl.append(el("p", "sync-trust-secondary",
      guidance.sessionLabel + " · " + guidance.connectionLabel + " · " + guidance.phaseLabel));
  } else {
    syncTrustLocationBodyEl.append(el("p", "sync-trust-secondary",
      "Aucune destination Cloud n'est configurée pour cet appareil."));
  }
  trustHelp(syncTrustLocationBodyEl, "sync-help-location", guidance);
}
function paintSyncTrustEvidence(guidance) {
  if (!syncTrustEvidenceBodyEl) return;
  syncTrustEvidenceBodyEl.replaceChildren();
  const status = el("p", "sync-trust-primary", guidance.evidence.cloud.label);
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("data-state", guidance.state.key);
  syncTrustEvidenceBodyEl.append(status);
  const list = el("ul", "sync-trust-evidence-list");
  for (const item of [guidance.evidence.local, guidance.evidence.pending, guidance.evidence.cloud]) {
    const entry = el("li", "sync-trust-evidence-item");
    entry.append(el("strong", null, item.key === "local" ? "Local : "
      : item.key === "pending" ? "Envoi : " : "Cloud : "));
    entry.append(document.createTextNode(item.label));
    list.append(entry);
  }
  const other = el("li", "sync-trust-evidence-item sync-trust-other-device");
  other.append(el("strong", null, "Autre appareil : "));
  other.append(document.createTextNode(guidance.evidence.otherDevice.label));
  list.append(other);
  syncTrustEvidenceBodyEl.append(list);
  const date = el("p", "sync-trust-secondary", guidance.observation.label);
  date.setAttribute("data-observation", guidance.observation.available ? "available" : "unavailable");
  syncTrustEvidenceBodyEl.append(date);
  if (guidance.observation.available) {
    syncTrustEvidenceBodyEl.append(el("p", "sync-trust-scope",
      guidance.observation.provenance + ". " + guidance.observation.scope));
  }
  trustHelp(syncTrustEvidenceBodyEl, "sync-help-evidence", guidance);
}
function paintSyncTrustActions(guidance) {
  if (!syncTrustActionsBodyEl) return;
  syncTrustActionsBodyEl.replaceChildren();
  for (const intent of guidance.intents) {
    if (intent.available !== true) continue;
    const details = el("details", "sync-intent");
    details.setAttribute("data-intent", intent.id);
    const summary = el("summary", null, intent.label);
    details.append(summary);
    const list = el("ol", "sync-intent-steps");
    for (const step of intent.steps) {
      const item = el("li", null);
      item.append(document.createTextNode(step.text));
      if (step.control) {
        const button = el("button", "sync-intent-link", "Consulter");
        button.type = "button";
        button.setAttribute("aria-controls", step.control);
        button.addEventListener("click", () => { revealExistingControl(step.control); });
        item.append(document.createTextNode(" "), button);
      }
      list.append(item);
    }
    details.append(list);
    syncTrustActionsBodyEl.append(details);
  }
}
function renderTrustGuidance() {
  if (!syncTrustLocationBodyEl && !syncTrustEvidenceBodyEl && !syncTrustActionsBodyEl) return;
  const diagnostic = buildSyncDiagnostic(readSyncDiagnosticInput());
  const entry = selectedSyncedEntry();
  const cloud = syncedDatabase && syncedDatabase.cloud;
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  const guidance = buildTrustGuidance({
    diagnostic,
    workspace: workspaceDiagnosticInput(),
    onboarding: onboardingView(readCloudSettingsInput()),
    observedSync: currentObservedSync(),
    url: entry ? entry.url : migrationDestination(),
    remoteDbId: persisted && typeof persisted.remoteDbId === "string" ? persisted.remoteDbId : null,
    localEmpty: documentLoaded && lastRecords.subjects.length === 0 && lastRecords.items.length === 0,
    isolatedRecovery: accountBinding.adopt === true
  });
  paintSyncTrustLocation(guidance);
  paintSyncTrustEvidence(guidance);
  paintSyncTrustActions(guidance);
}
function paintSyncDiagnostic(diagnostic, options = {}) {
  if (!syncDiagnosticEl) return;
  const preserveShareReport = options && options.preserveShareReport === true;
  lastSyncDiagnostic = diagnostic;
  ensureSyncSharingController();
  if (!preserveShareReport && syncSharingController.getState().previewOpen) {
    syncSharingController.refreshPreview();
  }
  const activeElement = document.activeElement;
  const activeShareId = activeElement && syncDiagnosticEl.contains(activeElement) &&
    typeof activeElement.id === "string" && SYNC_SHARE_CONTROL_IDS.has(activeElement.id)
    ? activeElement.id
    : null;
  const view = buildDiagnosticView(diagnostic, { busy: syncRetryBusy });
  const summary = buildDiagnosticSummary(diagnostic);
  syncDiagnosticEl.replaceChildren();
  const title = el("h2", null, view.title);
  title.id = "sync-diagnostic-title";
  const readonly = el("p", "sync-diagnostic-readonly", view.readonly);
  const pageSummary = el("p", "sync-diagnostic-summary", summary.text);
  pageSummary.id = "sync-diagnostic-summary";
  const list = el("dl", "sync-diagnostic-list");
  for (const row of view.rows) {
    list.append(el("dt", null, row.label), el("dd", null, row.value));
  }
  syncDiagnosticEl.append(title, readonly, pageSummary, list);
  if (view.errors.length > 0) {
    syncDiagnosticEl.append(el("h3", null, "Erreurs techniques classées"));
    const errors = el("ul", "sync-diagnostic-errors");
    for (const entry of view.errors) {
      errors.append(el("li", null, entry.message));
    }
    syncDiagnosticEl.append(errors);
  }
  const retry = el("button", "secondary sync-diagnostic-retry", view.retry.label);
  retry.type = "button";
  retry.id = "sync-diagnostic-retry";
  retry.disabled = view.retry.disabled;
  retry.setAttribute("aria-describedby", "sync-diagnostic-reason sync-diagnostic-status");
  retry.addEventListener("click", () => { void retrySyncInitialPull(); });
  const reason = el("p", "sync-diagnostic-reason", view.retry.reasonLabel);
  reason.id = "sync-diagnostic-reason";
  const status = el("p", "sync-diagnostic-status", syncDiagnosticAnnouncement || view.statusMessage);
  status.id = "sync-diagnostic-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  syncDiagnosticEl.append(retry, reason, status, buildSyncSharingPanel());
  syncDiagnosticEl.hidden = false;
  if (activeShareId) {
    const target = document.getElementById(activeShareId);
    if (target && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }
  applySyncSummaryVisibility();
  renderSyncOnboarding();
}
function renderSyncDiagnostic() {
  renderTrustGuidance();
  if (!syncDiagnosticEl) return;
  if (!syncDiagnosticsController) {
    paintSyncDiagnostic(buildSyncDiagnostic(readSyncDiagnosticInput()));
    return;
  }
  syncDiagnosticsController.refresh();
}
const SYNC_SHARE_CONTROL_IDS = new Set([
  "sync-diagnostic-copy",
  "sync-diagnostic-preview-toggle",
  "sync-diagnostic-preview-text"
]);
function currentLocalBaseDiagnosticValue() {
  if (!documentLoaded) return "unknown";
  return lastRecords.subjects.length === 0 && lastRecords.items.length === 0
    ? "empty"
    : "non-empty";
}
function diagnosticClipboardWriter() {
  if (typeof window === "undefined" || window.isSecureContext !== true) return null;
  if (typeof navigator === "undefined" || !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function") {
    return null;
  }
  const clipboard = navigator.clipboard;
  return (text) => clipboard.writeText(text);
}
function ensureSyncSharingController() {
  if (syncSharingController) return syncSharingController;
  syncSharingController = createDiagnosticSharingController({
    buildReport: () => buildSyncDiagnosticReport({
      diagnostic: lastSyncDiagnostic || buildSyncDiagnostic(readSyncDiagnosticInput()),
      now: new Date(),
      userAgent: typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
        ? navigator.userAgent
        : "",
      lifecycle: syncLifecycle.snapshot(Date.now()),
      localBase: currentLocalBaseDiagnosticValue()
    }),
    getWriteText: () => diagnosticClipboardWriter(),
    onChange: (state) => { syncSharingState = state; }
  });
  return syncSharingController;
}
function buildSyncSharingPanel() {
  const state = syncSharingController ? syncSharingController.getState() : syncSharingState;
  const container = el("div", "sync-diagnostic-share");
  const copy = el("button", "secondary sync-diagnostic-copy", "Copier le diagnostic pour assistance");
  copy.type = "button";
  copy.id = "sync-diagnostic-copy";
  copy.setAttribute("aria-describedby", "sync-diagnostic-share-status");
  copy.addEventListener("click", () => { void copySyncDiagnosticForAssistance(); });
  const previewToggle = el("button", "secondary sync-diagnostic-preview-toggle",
    state.previewOpen ? "Masquer l'aperçu du diagnostic" : "Afficher l'aperçu du diagnostic");
  previewToggle.type = "button";
  previewToggle.id = "sync-diagnostic-preview-toggle";
  previewToggle.setAttribute("aria-expanded", state.previewOpen ? "true" : "false");
  previewToggle.setAttribute("aria-controls", "sync-diagnostic-preview");
  previewToggle.addEventListener("click", toggleSyncDiagnosticPreview);
  const preview = el("div", "sync-diagnostic-preview");
  preview.id = "sync-diagnostic-preview";
  preview.hidden = !state.previewOpen;
  if (state.previewOpen && typeof state.text === "string") {
    const label = el("label", "sync-diagnostic-preview-label", "Aperçu du rapport (texte brut sélectionnable)");
    label.htmlFor = "sync-diagnostic-preview-text";
    const textarea = document.createElement("textarea");
    textarea.id = "sync-diagnostic-preview-text";
    textarea.className = "sync-diagnostic-preview-text";
    textarea.readOnly = true;
    textarea.rows = 16;
    textarea.spellcheck = false;
    textarea.value = state.text;
    textarea.setAttribute("aria-label", "Aperçu du diagnostic pour assistance");
    preview.append(label, textarea);
  }
  const shareStatus = el("p", "sync-diagnostic-share-status", state.status.message);
  shareStatus.id = "sync-diagnostic-share-status";
  shareStatus.setAttribute("role", "status");
  shareStatus.setAttribute("aria-live", "polite");
  shareStatus.setAttribute("aria-atomic", "true");
  container.append(copy, previewToggle, preview, shareStatus);
  return container;
}
async function copySyncDiagnosticForAssistance() {
  if (!syncSharingController) return;
  await syncSharingController.copy();
  paintSyncDiagnostic(lastSyncDiagnostic, { preserveShareReport: true });
}
function toggleSyncDiagnosticPreview() {
  if (!syncSharingController) return;
  syncSharingController.togglePreview();
  paintSyncDiagnostic(lastSyncDiagnostic, { preserveShareReport: true });
}
function setupSyncDiagnostics() {
  syncDiagnosticsController = createSyncDiagnosticsController({
    readInput: readSyncDiagnosticInput,
    syncPull: () => {
      if (!syncedDatabase) return Promise.reject({ name: "ReadError" });
      return nativePullAdapter(syncedDatabase);
    },
    onChange: (diagnostic, meta) => {
      syncRetryBusy = !!(meta && meta.retrying);
      paintSyncDiagnostic(diagnostic);
    }
  });
  if (syncedDatabase && syncDiagnosticsSubscribedFor !== syncedDatabase) {
    syncDiagnosticsSubscribedFor = syncedDatabase;
    const cloud = syncedDatabase.cloud;
    const subscribe = (observable) => {
      if (observable && typeof observable.subscribe === "function") {
        const name = observable === cloud.syncState
          ? "syncState"
          : observable === cloud.persistedSyncState
            ? "persistedSyncState"
            : observable === cloud.currentUser
              ? "currentUser"
              : null;
        observable.subscribe(() => {
          syncLifecycle.observeObservable(name);
          recordNativeBootstrapEvidence();
          renderSyncDiagnostic();
          updateActivationFromNative();
          if (requiresAuthentication() && authState.status === AUTH_STATUS.AUTHENTICATED) {
            void refreshAccountBinding();
          }
        });
      }
    };
    subscribe(cloud.syncState);
    subscribe(cloud.persistedSyncState);
    subscribe(cloud.currentUser);
  }
  recordNativeBootstrapEvidence();
  renderSyncDiagnostic();
}
function recordNativeBootstrapEvidence() {
  if (!syncedDatabase) return;
  const cloud = syncedDatabase.cloud;
  syncLifecycle.observeInitial("currentUser");
  syncLifecycle.observeInitial("syncState");
  syncLifecycle.observeInitial("persistedSyncState");
  const persisted = observableValue(cloud && cloud.persistedSyncState);
  const syncState = normalizeSyncState(observableValue(cloud && cloud.syncState));
  recordBootstrap({
    code: BOOTSTRAP_EVENT.INITIAL_PULL,
    pullCompleted: !!(persisted && persisted.initiallySynced === true &&
      persisted.serverRevision !== undefined && persisted.serverRevision !== null),
    present: syncState.phase === "in-sync"
  });
  recordBootstrap({
    code: BOOTSTRAP_EVENT.REMOTE_EVIDENCE,
    attested: evaluateSyncAttestation(nativeAttestationInput()).attested === true
  });
}
async function retrySyncInitialPull() {
  if (!syncDiagnosticsController || syncRetryBusy) return;
  syncRetryBusy = true;
  syncDiagnosticAnnouncement = "Relance native du pull initial demandée…";
  renderSyncDiagnostic();
  const result = await syncDiagnosticsController.retry();
  if (result.status === "completed") {
    syncDiagnosticAnnouncement =
      "Relance du pull initial terminée. Le diagnostic est actualisé et aucune donnée métier n'a été modifiée.";
  } else if (result.status === "blocked") {
    syncDiagnosticAnnouncement = "Relance non effectuée : " + retryReasonLabel(result.reason);
  } else {
    const category = result.error && result.error.category ? result.error.category : "uncategorized";
    syncDiagnosticAnnouncement =
      "La relance a échoué (catégorie " + category + "). Le Cloud n'est pas considéré comme vide.";
  }
  syncRetryBusy = false;
  renderSyncDiagnostic();
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
    return "Lecture IndexedDB impossible : import bloqué sans conclure que le Cloud est vide. Vos sauvegardes restent intactes.";
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
function openReconciliation(records, target, attestation, options = {}) {
  const destination = destinationIdentity(attestation);
  const userId = attestation && attestation.identity ? attestation.identity.userId : null;
  const resolutions = options.resolutions && typeof options.resolutions === "object"
    ? { ...options.resolutions }
    : {};
  const plan = planReconciliation({
    records,
    target,
    destination,
    userId,
    resolutions
  });
  migrationContext = {
    records,
    target,
    destination,
    userId,
    attestation,
    resolutions,
    plan,
    sourceKind: "json",
    sourceChecksum: options.sourceChecksum || null,
    previewFingerprint: plan.fingerprint,
    displayedPlan: plan
  };
  renderMigrationPanel(migrationContext);
}
function replanMigration() {
  const context = migrationContext;
  if (!context) return null;
  context.plan = planReconciliation({
    records: context.records,
    target: context.target,
    destination: context.destination,
    userId: context.userId,
    resolutions: context.resolutions
  });
  return context.plan;
}
function renderMigrationPanel(context, options = {}) {
  const panel = migrationPanel();
  if (!panel || !context) return;
  context.displayedPlan = context.plan;
  context.previewFingerprint = context.plan ? context.plan.fingerprint : null;
  const view = buildReconciliationView(context.plan);
  panel.replaceChildren();
  const title = el("h2", "migration-title", "Importer et réconcilier un fichier");
  title.id = "migration-title";
  title.tabIndex = -1;
  const live = el("p", "migration-live", "");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  live.textContent = context.plan.status === "already-migrated"
    ? "Tous les enregistrements du fichier sont déjà présents ou résolus : aucune insertion n'est nécessaire."
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
          : "Importer la version du fichier comme copie"));
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
    notify("Import refusé : vos données locales et le Cloud restent inchangés.");
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
  const title = el("h2", "migration-title", "Import temporairement bloqué");
  title.id = "migration-title";
  title.tabIndex = -1;
  const body = el("p", "migration-disclosure", reconciliationBlockMessage(result));
  const detail = el("p", "migration-disclosure",
    "Aucune écriture n'est effectuée et votre fichier de sauvegarde modern reste intact.");
  const actions = el("div", "migration-actions");
  const close = el("button", "secondary migration-refuse", "Fermer");
  close.type = "button";
  close.addEventListener("click", () => hideMigrationPanel());
  actions.append(close);
  panel.append(title, body, detail, actions);
  panel.hidden = false;
  title.focus();
}
async function offerJsonReconciliation(records) {
  const destination = migrationDestination();
  if (!destination || !businessStore) {
    notify("Import Cloud indisponible : configurez une destination Dexie Cloud. Votre fichier est intact.");
    return;
  }
  const result = await readAttestedTarget();
  if (result.status !== "ready") {
    renderMigrationBlocked(result);
    notify(reconciliationBlockMessage(result));
    return;
  }
  openReconciliation(records, result.records, result.attestation);
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
    notify("Consentement explicite requis avant toute écriture d'import.");
    return;
  }
  const displayed = context.displayedPlan || context.plan;
  if (!displayed) {
    notify("Plan affiché indisponible : aucune écriture effectuée.");
    return;
  }
  await pendingCloudWrites;
  const result = await readAttestedTarget();
  if (result.status !== "ready") {
    notifyError(reconciliationBlockMessage(result));
    return;
  }
  const destination = destinationIdentity(result.attestation);
  const userId = result.attestation && result.attestation.identity
    ? result.attestation.identity.userId : null;
  const fresh = planReconciliation({
    records: context.records,
    target: result.records,
    destination,
    userId,
    resolutions: context.resolutions
  });
  context.target = result.records;
  context.destination = destination;
  context.userId = userId;
  context.attestation = result.attestation;
  context.plan = fresh;
  const review = reviewDisplayedPlan(displayed, fresh);
  if (!review.same) {
    renderMigrationPanel(context);
    notify("Plan modifié depuis la prévisualisation : relisez l'inventaire et confirmez à nouveau. Aucune écriture effectuée.");
    return;
  }
  const consent = { confirmed: true, fingerprint: displayed.fingerprint };
  const outcome = await runReconciliation(reconciliationAdapter(), displayed, consent, async () => {
    const refreshed = await readAttestedTarget();
    const revalidatedDestination = destinationIdentity(refreshed.attestation);
    const revalidatedUserId = refreshed.attestation && refreshed.attestation.identity
      ? refreshed.attestation.identity.userId : null;
    const revalidatedPlan = refreshed.status === "ready"
      ? planReconciliation({
        records: context.records,
        target: refreshed.records,
        destination: revalidatedDestination,
        userId: revalidatedUserId,
        resolutions: context.resolutions
      })
      : null;
    return {
      attestation: refreshed.attestation,
      records: refreshed.records,
      target: refreshed.records,
      destination: revalidatedDestination,
      userId: revalidatedUserId,
      plan: revalidatedPlan
    };
  });
  if (outcome.status === "local-written") {
    resetExpandedViewState();
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
    resetExpandedViewState();
    hideMigrationPanel();
    await refreshSyncedDocument();
    notify("Aucune nouvelle insertion nécessaire : les éléments déjà présents ou copiés sont reconnus.");
  } else if (outcome.status === "stale-plan") {
    context.displayedPlan = null;
    context.previewFingerprint = null;
    renderMigrationPanel(context);
    notify("Plan périmé : source, destination, session ou cible modifiée. Nouvelle revue nécessaire, aucune écriture.");
  } else if (outcome.status === "refused" || outcome.status === "consent-mismatch") {
    notify("Import refusé : consentement absent ou lié à un autre plan. Aucune écriture.");
  } else if (outcome.status === "sync-blocked") {
    notifyError(describeAttestationReason(outcome.reason));
  } else if (outcome.status === "read-error") {
    notifyError("Lecture de revalidation impossible : import bloqué, cible et source inchangées.");
  } else if (outcome.status === "failed") {
    migrationStatus = reduceReconciliationStatus(migrationStatus, { type: "transaction-error" });
    notifyError("Échec de la transaction : aucun groupe partiel écrit, cible et source inchangées.");
  } else if (outcome.status === "invalid-plan") {
    notify("Plan invalide : seules des insertions add sont autorisées. Aucune écriture.");
  } else {
    notify("Import interrompu : aucune écriture confirmée.");
  }
}

bootstrapTrace = createBootstrapTrace();
const workspaceLegacyConfig = readCloudConfig();
recordBootstrap({ code: BOOTSTRAP_EVENT.CONFIGURATION, present: !!workspaceLegacyConfig });
const workspaceLegacyRecord = activationMarker();
const workspaceRegistryState = readWorkspaceRegistryState(localStorage);
recordBootstrap({
  code: BOOTSTRAP_EVENT.REGISTRY_READ,
  ok: workspaceRegistryState.state !== "invalid",
  present: workspaceRegistryState.state === "ok"
});
const initializedRegistry = initializeWorkspaceRegistry({
  state: workspaceRegistryState,
  config: workspaceLegacyConfig,
  record: workspaceLegacyRecord,
  schemaVersion: SCHEMA_VERSION
});
workspaceRegistry = initializedRegistry.registry;
workspaceRegistryInvalid = initializedRegistry.invalid;
if (initializedRegistry.migrated && workspaceRegistry) {
  // Migrate the legacy entry in place without renaming, copying or deleting
  // any existing IndexedDB base.
  writeWorkspaceRegistry(localStorage, workspaceRegistry);
}
workspaceStartup = resolveWorkspaceStartup({
  registry: workspaceRegistry,
  registryInvalid: workspaceRegistryInvalid,
  config: workspaceLegacyConfig,
  record: workspaceLegacyRecord,
  schemaVersion: SCHEMA_VERSION,
  state: initializedRegistry
});
workspaceRegistry = workspaceStartup.registry;
workspaceEntry = workspaceStartup.entry || null;
activationStartup = resolveStartupWorkspace({
  record: workspaceLegacyRecord,
  config: workspaceLegacyConfig
});
if (activationStartup.reason === ACTIVATION_STATUS.ACTIVATING) {
  activationState = { ...initialActivationState(), stage: ACTIVATION_STAGE.CONNECTING };
}
syncedDatabase = null;
if (workspaceStartup.workspace === "synced") syncedDatabase = bootstrapSyncedDatabase(workspaceEntry);
recordBootstrap({ code: BOOTSTRAP_EVENT.BASE_OPEN, present: !!syncedDatabase });
renderCloudConfig();
renderLocalWorkspace();
renderActivationPanel();
renderWorkspacePanel();
if (syncedDatabase) {
  businessStore = createDexieStore(syncedDatabase);
  setupMetadataStore(syncedDatabase);
  setupAuthentication();
} else {
  try {
    localDatabase = bootstrapLocalDatabase();
    businessStore = createDexieStore(localDatabase);
    setupMetadataStore(localDatabase);
  } catch {
    localDatabase = null;
    businessStore = null;
    setupMetadataStore(null);
  }
  startLocalWorkspace();
}
setupSyncDiagnostics();

