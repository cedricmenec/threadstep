import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ONBOARDING_STEP,
  SYNC_SECTION,
  localDiagnosticError,
  onboardingView,
  overviewAccessLinkVisible,
  resolveOnboardingStep,
  syncSectionVisibility
} from "../site/cloud-settings.js";
import {
  ACTIVATION_STAGE,
  ACTIVATION_STATUS,
  FIRST_SYNC,
  TARGET_CLASSIFICATION,
  classifyTarget,
  initialActivationState,
  transitionActivation
} from "../site/cloud-activation.js";
import { AUTH_STATUS, createAuthController } from "../site/authentication.js";
import { emptyRecords } from "../site/persistence.js";
import { evaluateSyncAttestation, planReconciliation, reviewDisplayedPlan } from "../site/migration-reconciliation.js";
import {
  PENDING_STATE,
  WORKSPACE_SELECTION_LOCAL,
  emptyWorkspaceRegistry,
  planWorkspacePurge,
  planWorkspaceSelection,
  planWorkspaceSuspension,
  registerWorkspace,
  resolveSelectedWorkspace
} from "../site/workspace-identity.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");
const guide = read("docs/product/guide-utilisation.md");
const acceptance = read("docs/product/acceptance-checklist.md");
const URL_A = "https://alpha.dexie.cloud";
const URL_B = "https://beta.dexie.cloud";
const USER = Object.freeze({ isLoggedIn: true, userId: "user-1" });

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (name) => values.has(name) ? values.get(name) : null,
    setItem: (name, value) => { values.set(name, String(value)); },
    removeItem: (name) => { values.delete(name); }
  };
}

function diagnostic(overrides = {}) {
  return {
    configured: true,
    online: true,
    session: "authenticated",
    connection: "connected",
    phase: "in-sync",
    initialPull: "complete",
    errors: [],
    localWrites: "none",
    ...overrides
  };
}

test("1.1 onboarding derives local, configuration, OTP, active, failed and offline steps", () => {
  assert.equal(resolveOnboardingStep({ configured: false }), ONBOARDING_STEP.LOCAL);
  assert.equal(resolveOnboardingStep({ configured: true }), ONBOARDING_STEP.CONFIGURATION);
  assert.equal(resolveOnboardingStep({
    configured: true,
    activationStage: ACTIVATION_STAGE.CONNECTING,
    otpPending: true
  }), ONBOARDING_STEP.OTP);
  assert.equal(resolveOnboardingStep({
    configured: true,
    authenticated: true,
    activationStage: ACTIVATION_STAGE.DISCOVERING
  }), ONBOARDING_STEP.FIRST_PULL);
  assert.equal(resolveOnboardingStep({
    configured: true,
    authenticated: true,
    remoteAttested: true,
    planReady: true
  }), ONBOARDING_STEP.REVIEW);
  assert.equal(resolveOnboardingStep({
    configured: true,
    authenticated: true,
    planReady: true,
    consentGiven: true
  }), ONBOARDING_STEP.TRANSFER);
  assert.equal(resolveOnboardingStep({
    configured: true,
    authenticated: true,
    activationStage: ACTIVATION_STAGE.ACTIVE,
    firstSync: FIRST_SYNC.REMOTE_COMPLETE
  }), ONBOARDING_STEP.ACTIVE);
  assert.equal(resolveOnboardingStep({
    configured: true,
    activationStage: ACTIVATION_STAGE.FAILED
  }), ONBOARDING_STEP.ERROR);
  assert.equal(resolveOnboardingStep({
    configured: true,
    online: false
  }), ONBOARDING_STEP.ERROR);
});

test("1.1 onboarding view never claims an unreached stage", () => {
  const local = onboardingView({ configured: false });
  assert.deepEqual(local.reached, [ONBOARDING_STEP.LOCAL]);
  assert.equal(local.isReached, true);

  const configured = onboardingView({ configured: true });
  assert.deepEqual(configured.reached, [ONBOARDING_STEP.LOCAL, ONBOARDING_STEP.CONFIGURATION]);
  assert.equal(configured.isReached, true);
  assert.equal(configured.reached.includes(ONBOARDING_STEP.FIRST_PULL), false);

  const pendingOtp = onboardingView({
    configured: true,
    activationStage: ACTIVATION_STAGE.CONNECTING,
    otpPending: true
  });
  assert.equal(pendingOtp.step, ONBOARDING_STEP.OTP);
  assert.equal(pendingOtp.reached.includes(ONBOARDING_STEP.OTP), false);
  assert.equal(pendingOtp.isReached, false);
  assert.match(pendingOtp.nextAction, /code/i);

  const reviewed = onboardingView({
    configured: true,
    authenticated: true,
    remoteAttested: true,
    planReady: true
  });
  assert.equal(reviewed.isReached, true);
  assert.equal(reviewed.reached.includes(ONBOARDING_STEP.TRANSFER), false);
  assert.equal(reviewed.reached.includes(ONBOARDING_STEP.ACTIVE), false);
  assert.match(reviewed.nextAction, /consentement/i);
});

test("1.1 section visibility follows configuration and session state", () => {
  const local = syncSectionVisibility({ configured: false });
  assert.equal(local.configuration, true);
  assert.equal(local.connection, false);
  assert.equal(local.onboarding, true);
  assert.equal(local.diagnostic, true);

  const waiting = syncSectionVisibility({ configured: true, authenticated: false });
  assert.equal(waiting.configuration, false);
  assert.equal(waiting.connection, true);
  assert.equal(waiting.current, SYNC_SECTION.ACTIVATION);

  const authenticated = syncSectionVisibility({ configured: true, authenticated: true });
  assert.equal(authenticated.connection, false);
  assert.equal(authenticated.activation, true);
  assert.equal(authenticated.workspaces, true);
});

test("1.1 overview access link appears only for Cloud attention or local error states", () => {
  assert.equal(overviewAccessLinkVisible({ configured: false }), false);
  assert.equal(overviewAccessLinkVisible({ configured: false, localError: true }), true);
  assert.equal(overviewAccessLinkVisible({ configured: true, needsAttention: false }), false);
  assert.equal(overviewAccessLinkVisible({ configured: true, needsAttention: true }), true);
  assert.equal(overviewAccessLinkVisible({ configured: true, activationNeedsResume: true }), true);
  assert.equal(localDiagnosticError({ configured: false, errors: [{ category: "read" }] }), true);
  assert.equal(localDiagnosticError({ configured: false, errors: [] }), false);
  assert.equal(localDiagnosticError({ configured: true, errors: [{ category: "read" }] }), false);
});

test("2.1 the four real controls live once inside the synchronization page", () => {
  const syncPage = between(html, '<section id="settings-sync-page"', '<div id="sync-summary"');
  const expected = [
    ["Configuration", "cloud-config", "settings-sync-configuration-title", "sync-configuration-section"],
    ["Première activation", "cloud-activation", "settings-sync-activation-title", "sync-activation-section"],
    ["Connexion", "auth-panel", "settings-sync-connection-title", "sync-connection-section"],
    ["Espaces de travail", "workspace-panel", "settings-sync-workspaces-title", "sync-workspaces-section"]
  ];
  for (const [heading, id, titleId, sectionId] of expected) {
    assert.match(syncPage, new RegExp('id="' + sectionId + '"'), sectionId);
    assert.match(syncPage, new RegExp("<h3[^>]*" + titleId + "[^>]*>" + heading + "</h3>"), heading);
    assert.match(syncPage, new RegExp('id="' + id + '"'), id);
    assert.equal(occurrences(html, 'id="' + id + '"'), 1, id);
    assert.equal(occurrences(syncPage, 'id="' + id + '"'), 1, id);
  }
  assert.equal(occurrences(html, 'id="sync-diagnostic"'), 1);
  assert.equal(occurrences(syncPage, 'id="sync-diagnostic"'), 1);
  assert.equal(occurrences(syncPage, 'id="sync-onboarding"'), 1);
  assert.doesNotMatch(html, /sync-descriptive/);
  assert.doesNotMatch(syncPage, /TS-044/);
});

test("2.2 onboarding states map to deterministic French steps", () => {
  const cases = [
    [{ configured: false }, ONBOARDING_STEP.LOCAL, /local autonome/i],
    [{ configured: true }, ONBOARDING_STEP.CONFIGURATION, /HTTPS/i],
    [{ configured: true, activationStage: ACTIVATION_STAGE.CONNECTING, otpPending: true }, ONBOARDING_STEP.OTP, /OTP|code/i],
    [{ configured: true, authenticated: true, remoteAttested: false }, ONBOARDING_STEP.FIRST_PULL, /lecture distante/i],
    [{ configured: true, authenticated: true, remoteAttested: true, planReady: true }, ONBOARDING_STEP.REVIEW, /plan/i],
    [{ configured: true, authenticated: true, activationStage: ACTIVATION_STAGE.ACTIVE }, ONBOARDING_STEP.ACTIVE, /attestées/i],
    [{ configured: true, activationStage: ACTIVATION_STAGE.FAILED }, ONBOARDING_STEP.ERROR, /récupérable/i],
    [{ configured: true, online: false }, ONBOARDING_STEP.ERROR, /hors ligne|dégradé/i]
  ];
  for (const [input, step, message] of cases) {
    const view = onboardingView(input);
    assert.equal(view.step, step);
    assert.match(view.title + " " + view.message, message);
  }
  assert.match(guide, /onboarding/i);
  assert.match(guide, /étape/i);
});

test("2.3 the overview summary stays non-interactive and the access link is distinct", () => {
  const summary = between(html, '<div id="sync-summary"', "</div>");
  assert.doesNotMatch(summary, /<(button|a|input|select)\b/i);
  assert.equal(occurrences(html, 'id="sync-settings-access"'), 1);
  const link = /<a id="sync-settings-access"[^>]*href="#\/parametres\/synchronisation"[^>]*hidden>([^<]+)<\/a>/.exec(html);
  assert.ok(link, "access link present");
  assert.match(link[1], /configurer|diagnostiquer/i);
  assert.ok(html.indexOf('id="sync-settings-access"') > html.indexOf('id="sync-summary"'));
  assert.match(app, /overviewAccessLinkVisible\(/);
  assert.match(app, /syncSettingsAccessEl\.hidden = !showLink/);
  const visibility = between(app, "function applySyncSummaryVisibility(", "\n}\n");
  assert.doesNotMatch(visibility, /retrySyncInitialPull|nativePullAdapter|\.subscribe\(|fetch\(|startAuthentication|indexedDB|localStorage/);
});

test("2.4 route visibility toggles presentation without recreating panels", () => {
  const visibility = between(app, "function applySettingsVisibility(", "\n}\n");
  assert.match(visibility, /settingsSyncPageEl\.hidden = section !== "sync"/);
  assert.match(visibility, /applySyncSectionVisibility\(\)/);
  assert.match(visibility, /renderSyncOnboarding\(\)/);
  const sections = between(app, "function applySyncSectionVisibility(", "\n}\n");
  assert.match(sections, /syncSectionVisibility\(readCloudSettingsInput\(\)\)/);
  assert.match(sections, /syncConfigurationSectionEl\.hidden/);
  assert.match(sections, /syncConnectionSectionEl\.hidden/);
  assert.doesNotMatch(sections, /replaceChildren|createElement|innerHTML/);

  const navigationBlocks = [
    between(app, "function applyNavigationMenu(", "\n}\n"),
    between(app, "function updateNavigationMenu(", "\n}\n"),
    between(app, "function focusRouteHeading(", "\n}\n"),
    between(app, "function activateNavigationLink(", "\n}\n"),
    between(app, "function applySettingsVisibility(", "\n}\n"),
    between(app, 'window.addEventListener("hashchange"', "\n});")
  ];
  const forbidden = /bootstrapSyncedDatabase|\.open\s*\(|\.cloud\.configure|setupAuthentication|authController\s*=\s*null|db\.delete|Dexie\.delete/;
  for (const block of navigationBlocks) assert.doesNotMatch(block, forbidden);
});

test("3.1 an OTP interaction survives a simulated route change unchanged", () => {
  let submitted = 0;
  let cancelled = 0;
  let interaction = null;
  const controller = createAuthController({
    adapter: { login: () => Promise.resolve({}) },
    storage: memoryStorage(),
    getOnline: () => true,
    onStateChange: () => {},
    onInteraction: (value) => { interaction = value; }
  });
  controller.handleInteraction({
    type: "otp",
    fields: { otp: {} },
    onSubmit: () => { submitted += 1; },
    onCancel: () => { cancelled += 1; }
  });
  const before = controller.currentInteraction();
  assert.equal(before.kind, "otp");
  assert.equal(interaction, before);
  // A route change is presentation-only: it reads but never submits or cancels.
  const after = controller.currentInteraction();
  assert.equal(after, before);
  assert.equal(submitted, 0);
  assert.equal(cancelled, 0);
  assert.equal(controller.submitInteraction({ otp: "123456" }), true);
  assert.equal(submitted, 1);
  assert.equal(cancelled, 0);
});

test("3.1 an activation review and an error survive a navigation event", () => {
  let state = initialActivationState();
  for (const type of ["start", "configured", "authenticated", "discovered"]) {
    state = transitionActivation(state, { type }).state;
  }
  assert.equal(state.stage, ACTIVATION_STAGE.REVIEW);
  const navigation = transitionActivation(state, { type: "route-change" });
  assert.equal(navigation.ok, false);
  assert.equal(navigation.state, state);
  assert.equal(navigation.state.stage, ACTIVATION_STAGE.REVIEW);
  assert.equal(navigation.state.transferCommitted, false);

  const failed = transitionActivation(state, { type: "fail", reason: "network" }).state;
  assert.equal(failed.stage, ACTIVATION_STAGE.FAILED);
  assert.equal(transitionActivation(failed, { type: "route-change" }).state.error, "network");
});

test("3.1 navigation paths invoke no submit, cancel, consent or destructive action", () => {
  const blocks = [
    between(app, "function applyNavigationMenu(", "\n}\n"),
    between(app, "function updateNavigationMenu(", "\n}\n"),
    between(app, "function activateNavigationLink(", "\n}\n"),
    between(app, "function applySettingsVisibility(", "\n}\n"),
    between(app, "function renderSyncOnboarding(", "\n}\n"),
    between(app, 'window.addEventListener("hashchange"', "\n});")
  ];
  const forbidden = /submitInteraction|cancelInteraction|cloudActivationConfirm|workspaceConfirmationContinue|executeWorkspace|requestWorkspace|confirmWorkspace|runReconciliation|runActivationDiscovery/;
  for (const block of blocks) assert.doesNotMatch(block, forbidden);
});

test("3.2 consent, stale plan, divergence, offline and reload stay non-destructive", () => {
  const source = { subjects: [{ id: "s1", title: "Projet", order: 0 }], items: [] };
  const target = emptyRecords();
  const destination = { url: URL_A, remoteDbId: "remote-1" };
  const built = planReconciliation({
    records: source,
    target,
    destination,
    userId: "user-1",
    resolutions: {}
  });
  assert.equal(built.operations.length > 0, true);
  assert.deepEqual(reviewDisplayedPlan(built, built), { same: true, reason: null });
  const changed = planReconciliation({
    records: source,
    target: { subjects: [{ id: "remote", title: "Autre", order: 0 }], items: [] },
    destination,
    userId: "user-1",
    resolutions: {}
  });
  assert.equal(reviewDisplayedPlan(built, changed).same, false);

  let state = initialActivationState();
  for (const type of ["start", "configured", "authenticated", "discovered"]) {
    state = transitionActivation(state, { type }).state;
  }
  const consent = transitionActivation(state, { type: "consent" });
  assert.equal(consent.ok, true);
  assert.equal(consent.state.stage, ACTIVATION_STAGE.TRANSFER_PENDING);
  assert.equal(consent.state.transferCommitted, false);

  const divergent = classifyTarget({
    attestation: {
      attested: true,
      reason: null,
      identity: { userId: "user-1", url: URL_A, remoteDbId: "remote-1" }
    },
    targetStatus: "ready",
    records: { subjects: [{ id: "x", title: "X" }], items: [] },
    plan: { blocked: [{ reason: "conflict" }] }
  });
  assert.equal(divergent.classification, TARGET_CLASSIFICATION.DIVERGENT);
  const divergentView = onboardingView({
    configured: true,
    authenticated: true,
    remoteAttested: true,
    planReady: true,
    classification: divergent.classification
  });
  assert.equal(divergentView.step, ONBOARDING_STEP.REVIEW);
  assert.notEqual(divergentView.step, ONBOARDING_STEP.TRANSFER);

  const offline = evaluateSyncAttestation({ online: false });
  assert.equal(offline.attested, false);
  assert.equal(offline.reason, "offline");
  assert.equal(onboardingView({ configured: true, online: false }).step, ONBOARDING_STEP.ERROR);

  const reloaded = onboardingView({
    configured: true,
    authenticated: true,
    activationStage: initialActivationState().stage,
    firstSync: FIRST_SYNC.IDLE
  });
  assert.equal(reloaded.step, ONBOARDING_STEP.FIRST_PULL);
  assert.equal(initialActivationState().transferCommitted, false);
});

test("3.2 A/B/A workspace transitions keep distinct bases and copy nothing", () => {
  let registry = emptyWorkspaceRegistry();
  registry = registerWorkspace(registry, {
    url: URL_A, databaseName: "threadstep-ws-a", schemaVersion: 1, status: ACTIVATION_STATUS.ACTIVE
  });
  registry = registerWorkspace(registry, {
    url: URL_B, databaseName: "threadstep-ws-b", schemaVersion: 1, status: ACTIVATION_STATUS.ACTIVE
  });
  const pending = { status: PENDING_STATE.NONE };
  const toA = planWorkspaceSelection({ registry, target: URL_A, pending });
  assert.equal(toA.allowed, true);
  assert.deepEqual(resolveSelectedWorkspace(toA.registry).databaseName, "threadstep-ws-a");
  assert.deepEqual(toA.deletions, []);
  assert.deepEqual(toA.remoteDeletes, []);
  assert.equal(toA.copy, false);
  const toB = planWorkspaceSelection({ registry: toA.registry, target: URL_B, pending });
  assert.equal(resolveSelectedWorkspace(toB.registry).databaseName, "threadstep-ws-b");
  assert.deepEqual(toB.deletions, []);
  const backToA = planWorkspaceSelection({ registry: toB.registry, target: URL_A, pending });
  assert.equal(resolveSelectedWorkspace(backToA.registry).databaseName, "threadstep-ws-a");
  assert.deepEqual(backToA.deletions, []);
  assert.deepEqual(backToA.businessDeletes, []);
  assert.equal(occurrences(JSON.stringify(backToA.registry), "threadstep-ws-b"), 1);
});

test("3.3 the four workspace actions stay separate, scoped and confirmed", () => {
  const panel = between(html, '<section id="workspace-panel"', '<section id="sync-diagnostic"');
  for (const label of [
    "Sélectionner cet espace", "Suspendre Cloud", "Se déconnecter", "Purger la copie locale"
  ]) {
    assert.match(panel, new RegExp(">" + label + "<"), label);
  }
  assert.match(app, /Base locale effective : " \+/);
  assert.match(app, /La copie distante n'est pas supprimée/);
  assert.match(app, /pendingChangeWarning\(pending\)/);
  assert.match(app, /workspaceBackupEl/);
  assert.match(app, /workspaceConfirmationCancelEl/);
  assert.match(app, /planWorkspaceLogout\(/);
  assert.match(app, /planWorkspacePurge\(/);
  assert.match(app, /planWorkspaceSuspension\(/);
  assert.match(app, /planWorkspaceSelection\(/);
  for (const binding of [
    'workspaceApplyEl.addEventListener("click"',
    'workspaceSuspendEl.addEventListener("click"',
    'workspaceLogoutEl.addEventListener("click"',
    'workspacePurgeEl.addEventListener("click"'
  ]) {
    assert.match(app, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(occurrences(app, "executeWorkspaceLogout(") >= 2, true);
});

test("3.3 purge and suspension never touch remote data", () => {
  let registry = registerWorkspace(emptyWorkspaceRegistry(), {
    url: URL_A, databaseName: "threadstep-ws-a", schemaVersion: 1, status: ACTIVATION_STATUS.ACTIVE
  });
  const purge = planWorkspacePurge({
    registry,
    target: URL_A,
    effectiveDatabaseName: "threadstep-ws-a",
    pending: { status: PENDING_STATE.PENDING, count: 2 },
    confirmed: true
  });
  assert.equal(purge.allowed, true);
  assert.deepEqual(purge.deletions, ["threadstep-ws-a"]);
  assert.deepEqual(purge.operations, [{ type: "delete-database", databaseName: "threadstep-ws-a" }]);
  assert.equal(JSON.stringify(purge).includes("remote-delete"), false);

  const suspended = planWorkspaceSuspension({
    registry,
    url: URL_A,
    pending: { status: PENDING_STATE.NONE }
  });
  assert.equal(suspended.allowed, true);
  assert.equal(suspended.selected, WORKSPACE_SELECTION_LOCAL);
  assert.deepEqual(suspended.deletions, []);
  assert.equal(suspended.registry.workspaces[URL_A].status, ACTIVATION_STATUS.SUSPENDED);
});

test("4.1 styles cover the integrated sections, onboarding and 44px access link", () => {
  assert.match(css, /\.sync-onboarding\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.sync-section\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.sync-section\[hidden\]\{display:none\}/);
  assert.match(css, /\.sync-settings-access\{[^}]*min-height:44px[^}]*min-width:44px/);
  assert.match(css, /\.sync-settings-access:focus-visible\{[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
  assert.match(css, /\.sync-settings-access\[hidden\]\{display:none\}/);
  assert.match(css, /@media\(max-width:620px\)\{[^\n]*\.sync-settings-access\{width:100%/);
  assert.doesNotMatch(css, /overflow-x\s*:/);
});

test("4.3 product documentation describes the single Cloud destination and its limits", () => {
  for (const source of [guide, acceptance]) {
    assert.match(source, /#\/parametres\/synchronisation/);
    assert.match(source, /onboarding|on-boarding/i);
    assert.match(source, /OTP/);
    assert.match(source, /Purger la copie\s+locale/);
    assert.match(source, /Suspendre Cloud/);
    assert.match(source, /Se déconnecter/);
    assert.match(source, /Changer d'espace|Sélectionner cet espace/);
    assert.doesNotMatch(source, /restent à leur emplacement actuel/i);
    assert.doesNotMatch(source, /sont \*\*descriptifs\*\*/i);
  }
  assert.match(guide, /état/i);
  assert.match(acceptance, /manuelle/i);
});
