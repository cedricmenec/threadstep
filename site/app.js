import { STORAGE_KEY, RESUME_KEY, PRIORITIES, emptyDocument, newSubject, newItem, subjectRoute, parseRoute, findSubject, renameSubject, visibleItems, overviewPreview, isWithinOverviewPreview, substepView, substepToggleLabel, toggleExpandedParent, substepAncestorId, isViewEntry, pendingCount, totalTaskCount, totalTaskCountLabel, parseDocument, moveSubject, updateItem, setItemPriority, reorderWithinPriority, moveWithinPriority, canMoveWithinPriority, canReorderWithinPriority, itemMenuCommands, promoteItemToTopLevel, nextActionSuggestion, suggestionReason, parseResumePreference, serializeResumePreference, resumeView, planRemoval, restoreRemoval, removalContainsItem, restorableTrackingRef } from "./core.js";
import { readCloudConfig, writeCloudConfig, validateCloudUrl, shouldOpenSyncedDatabase, cloudConfigureOptions, dexieSchema } from "./dexie-foundation.js";
import { documentToRecords, diffRecords, emptyRecords, compatibilityGuard, localError, isLocalError } from "./persistence.js";
import { detectHistoricalDocument, describeMigration, planMigration, runMigration } from "./migration.js";
import { AUTH_STATUS, authMessage, canAccessBusiness, classifyPermissionFailure, createAuthController, signInMethods } from "./authentication.js";
import { availableLocalBackup } from "./local-recovery.js";
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
let syncedDatabase = null;
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
let historicalGuard = null;

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
  if (dashboardEl) dashboardEl.hidden = configured && !authenticated;
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
    setAuthError("Aucune sauvegarde historique locale lisible à exporter.");
    return;
  }
  downloadJsonText(backup.json, "threadstep-historique-v1-sauvegarde.json");
  setAuthStatus("Sauvegarde JSON historique téléchargée. Aucune donnée n'a été modifiée.");
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
  const errorAlerts = interaction ? interaction.alerts.filter((alert) => alert.type === "error") : [];
  const infoAlerts = interaction ? interaction.alerts.filter((alert) => alert.type !== "error") : [];
  if (authEmailFieldEl) authEmailFieldEl.hidden = codePhase;
  if (authOtpFieldEl) authOtpFieldEl.hidden = !codePhase;
  if (authEmailEl) authEmailEl.required = !codePhase;
  if (authOtpEl) authOtpEl.required = codePhase;
  if (authSubmitEl) {
    authSubmitEl.textContent = codePhase ? "Valider le code" : signInMethods()[0].label;
    authSubmitEl.disabled = authSubmitting || authState.status === AUTH_STATUS.LOADING;
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
  authSubmitting = false;
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
  authSubmitting = false;
  if (!interaction) {
    setAuthStatus("Envoi du code en cours…");
  }
  renderAuthPanel();
}
function startBusiness() {
  if (businessStarted) return;
  businessStarted = true;
  if (!changesSubscribed) {
    subscribeToChanges();
    changesSubscribed = true;
  }
  load();
  offerHistoricalMigration();
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
}
function showAuthFieldError(message) {
  setAuthError(message);
  if (authState.status === AUTH_STATUS.SIGNED_OUT) setAuthStatus("");
}
function submitAuthForm(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (!authController) return;
  const interaction = authController.currentInteraction() || authInteraction;
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
  if (!businessAllowed()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
    notify("Sauvegardé localement");
  } catch {
    notify("Stockage indisponible : exportez vos données.");
  }
  commitOperations();
  documentLoaded = true;
  render();
}
function load() {
  expandedParents = new Set();
  openMenuId = null;
  if (!businessAllowed()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      documentState = parseDocument(raw);
      documentLoaded = true;
      resumeRef = readResumePreference();
    }
  } catch {
    notify("Données locales illisibles. Une importation reste possible.");
  }
  lastRecords = documentToRecords(documentState);
  render();
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
  downloadJsonText(JSON.stringify(documentState, null, 2), "threadstep-backup.json");
  notify("Export JSON généré");
});
if (authLegacyExportEl) authLegacyExportEl.addEventListener("click", exportLegacyBackup);
document.querySelector("#import").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("Fichier trop volumineux (maximum 1 Mo).");
    const incoming = parseDocument(await file.text());
    if (!confirm("Remplacer toutes les données locales par cet import ?")) return;
    invalidatePendingRemoval();
    expandedParents = new Set();
    pendingCollapseFocus = null;
    openMenuId = null;
    documentState = incoming;
    documentLoaded = true;
    persist();
    notify("Import terminé");
  } catch (error) {
    notify("Import impossible : " + error.message);
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
    businessStore = createBusinessStore(syncedDatabase);
    authController = null;
    authInteraction = null;
    authSubmitting = false;
    businessStarted = false;
    changesSubscribed = false;
    authState = { status: AUTH_STATUS.LOADING, kind: null, message: "" };
    renderCloudConfig();
    if (syncedDatabase) {
      setupAuthentication();
    } else {
      load();
      offerHistoricalMigration();
    }
    notify("Instance Dexie Cloud enregistrée");
  });
}
function createBusinessStore(db) {
  if (!db) return null;
  return {
    async commit(operations) {
      if (!Array.isArray(operations) || operations.length === 0) {
        return { status: "recorded", operations: [] };
      }
      try {
        await db.transaction("rw", db.subjects, db.items, async () => {
          for (const operation of operations) {
            const table = operation.store === "subjects" ? db.subjects : db.items;
            if (operation.type === "put") await table.put(operation.value);
            else if (operation.type === "delete") await table.delete(operation.key);
          }
        });
        return { status: "recorded", operations };
      } catch (error) {
        throw localError("Échec de l'enregistrement local.", error);
      }
    }
  };
}
function commitOperations() {
  if (!businessAllowed()) return;
  const records = documentToRecords(documentState);
  const operations = diffRecords(lastRecords, records);
  lastRecords = records;
  if (!operations.length || !businessStore) return;
  businessStore.commit(operations).then(
    () => { broadcastChange(); },
    (error) => {
      if (isLocalError(error)) notify("Stockage indisponible : exportez vos données.");
      else {
        const refusal = classifyPermissionFailure(error);
        if (refusal) notify(authMessage(refusal));
        else notify("Synchronisation en attente.");
      }
    }
  );
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
  if (syncedDatabase && typeof syncedDatabase.on === "function") {
    syncedDatabase.on("changes", () => { load(); });
  }
}
let migrationPanelEl = null;
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
  if (!syncedDatabase) return emptyRecords();
  try {
    const subjects = await syncedDatabase.subjects.toArray();
    const items = await syncedDatabase.items.toArray();
    return { subjects, items };
  } catch {
    return emptyRecords();
  }
}
function hideMigrationPanel() {
  if (!migrationPanelEl) return;
  migrationPanelEl.hidden = true;
  migrationPanelEl.replaceChildren();
}
async function offerHistoricalMigration() {
  if (!businessAllowed()) return;
  const detected = detectHistoricalDocument(localStorage);
  const destination = migrationDestination();
  if (detected.status !== "present" || !destination || !businessStore) {
    hideMigrationPanel();
    return;
  }
  const target = await readTargetRecords();
  const disclosure = describeMigration(detected.document, destination);
  const plan = planMigration(target, detected.document, { destination, currentDestination: destination });
  renderMigrationPanel(disclosure, plan, destination);
}
function renderMigrationPanel(disclosure, plan, destination) {
  const panel = migrationPanel();
  if (!panel) return;
  panel.replaceChildren();
  const title = el("h2", "migration-title", "Importer mes données existantes");
  title.id = "migration-title";
  const body = el("p", "migration-disclosure", disclosure.message);
  if (plan.populated) {
    body.textContent += " La base cible contient déjà des données : elles ne seront pas écrasées.";
  }
  if (plan.status === "collision") {
    body.textContent += " Un identifiant existe déjà avec un contenu différent : la migration est bloquée.";
  }
  const actions = el("div", "migration-actions");
  const accept = el("button", "primary migration-accept", "Migrer vers le cloud");
  accept.type = "button";
  accept.disabled = plan.status === "collision";
  accept.addEventListener("click", () => confirmHistoricalMigration(plan, destination));
  const refuse = el("button", "secondary migration-refuse", "Conserver localement");
  refuse.type = "button";
  refuse.addEventListener("click", () => {
    hideMigrationPanel();
    notify("Migration refusée : vos données locales restent inchangées.");
  });
  actions.append(accept, refuse);
  panel.append(title, body, actions);
  panel.hidden = false;
}
async function confirmHistoricalMigration(plan, destination) {
  const outcome = await runMigration(
    businessStore,
    plan,
    { confirmed: true, destination },
    () => migrationDestination()
  );
  if (outcome.status === "migrated") {
    hideMigrationPanel();
    notify("Migration terminée : vos données seront synchronisées.");
  } else if (outcome.status === "already-migrated") {
    hideMigrationPanel();
    notify("Ce document a déjà été migré.");
  } else if (outcome.status === "destination-changed") {
    notify("Destination modifiée : migration annulée.");
  } else if (outcome.status === "collision") {
    notify("Conflit d'identifiant : migration bloquée.");
  } else if (outcome.status === "refused") {
    notify("Migration refusée.");
  } else if (outcome.status === "failed") {
    notify("Migration interrompue : vos données locales restent disponibles.");
  }
}
syncedDatabase = bootstrapSyncedDatabase();
businessStore = createBusinessStore(syncedDatabase);
historicalGuard = compatibilityGuard(localStorage);
renderCloudConfig();
if (syncedDatabase) {
  setupAuthentication();
} else {
  subscribeToChanges();
  changesSubscribed = true;
  load();
  offerHistoricalMigration();
}

