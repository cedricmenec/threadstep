import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSyncDiagnostic } from "../site/sync-diagnostics.js";
import {
  SYNC_OBSERVATION_STORAGE_KEY,
  SYNC_OBSERVATION_VERSION,
  TRUST_LABELS,
  TRUST_STATE,
  buildSyncObservationRecord,
  buildTrustGuidance,
  readSyncObservation,
  resolveObservedSync,
  shouldRecordSyncObservation,
  writeSyncObservation
} from "../site/sync-trust-guidance.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");
const moduleSource = read("site/sync-trust-guidance.js");

const URL_A = "https://alpha.dexie.cloud";
const URL_B = "https://beta.dexie.cloud";
const USER = Object.freeze({ isLoggedIn: true, userId: "user-1" });
const DIGEST = "digest-user-1";

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = source.indexOf(end, from + start.length);
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

function completePersisted(overrides = {}) {
  return {
    initiallySynced: true,
    remoteDbId: "remote-1",
    serverRevision: 42,
    realms: ["user-1"],
    databaseUrl: URL_A,
    ...overrides
  };
}

function baseInput(overrides = {}) {
  return {
    configured: true,
    databaseUrl: URL_A,
    online: true,
    user: USER,
    syncState: { status: "connected", phase: "in-sync" },
    persistedSyncState: completePersisted(),
    localWrites: "none",
    binding: "bound",
    ...overrides
  };
}

function guidance(overrides = {}, extra = {}) {
  return buildTrustGuidance({
    diagnostic: buildSyncDiagnostic(baseInput(overrides)),
    onboarding: { step: "active" },
    workspace: { type: "synchronized", effectiveBase: "threadstep-ws-alpha", url: URL_A },
    url: URL_A,
    remoteDbId: "remote-1",
    ...extra
  });
}

function observationInput(overrides = {}) {
  return {
    eventReceived: true,
    session: "authenticated",
    binding: "bound",
    url: URL_A,
    databaseName: "threadstep-ws-alpha",
    remoteDbId: "remote-1",
    userDigest: DIGEST,
    phase: "in-sync",
    persistedSyncState: { initiallySynced: true, serverRevision: 42 },
    ...overrides
  };
}

test("1.1 the pure module exposes a deterministic trust model without browser access", () => {
  for (const forbidden of [
    "document.", "window.", "localStorage", "sessionStorage", "indexedDB",
    "fetch(", "XMLHttpRequest", "WebSocket", "navigator."
  ]) {
    assert.equal(moduleSource.includes(forbidden), false, forbidden);
  }
  const view = guidance();
  for (const key of [
    "mode", "locationLabel", "databaseName", "destination", "sessionLabel",
    "connectionLabel", "phaseLabel", "pendingLabel", "evidence", "state",
    "observation", "intents"
  ]) {
    assert.ok(key in view, key);
  }
  assert.equal(view.mode, "synchronized");
  assert.equal(view.databaseName, "threadstep-ws-alpha");
  assert.deepEqual(view.destination, { url: URL_A, remoteDbId: "remote-1" });
  assert.equal(typeof view.state.forbiddenActions, "object");
});

test("1.2 exact summary labels are stable", () => {
  assert.equal(TRUST_LABELS.LOCAL, "Local uniquement, enregistré sur cet appareil");
  assert.equal(TRUST_LABELS.SYNCHRONIZED, "Copie locale IndexedDB reliée à Dexie Cloud");
  assert.equal(TRUST_LABELS.MASKED, "Données Cloud temporairement masquées, non présumées perdues");
  assert.equal(TRUST_LABELS.DATE_UNAVAILABLE, "Date non disponible");

  const local = buildTrustGuidance({ diagnostic: buildSyncDiagnostic({ configured: false }) });
  assert.equal(local.locationLabel, TRUST_LABELS.LOCAL);
  const synced = guidance();
  assert.equal(synced.locationLabel, TRUST_LABELS.SYNCHRONIZED);
  const masked = guidance({ binding: "unverified" });
  assert.equal(masked.locationLabel, TRUST_LABELS.MASKED);
  assert.equal(masked.observation.label, TRUST_LABELS.DATE_UNAVAILABLE);
});

test("1.3 state priority and catalogue explain every blocking state", () => {
  const cases = [
    [{ binding: "unverified" }, TRUST_STATE.UNVERIFIED],
    [{ binding: "mismatch" }, TRUST_STATE.MISMATCH],
    [{ binding: "destination-mismatch" }, TRUST_STATE.DESTINATION_MISMATCH],
    [{ readError: { name: "ReadError" } }, TRUST_STATE.STORAGE_ERROR],
    [{ authRefusal: "permission-refusal" }, TRUST_STATE.PERMISSION],
    [{ user: null, authExpired: true }, TRUST_STATE.SESSION],
    [{ syncState: { status: "error", phase: "error" }, persistedSyncState: completePersisted({ error: { name: "SyncError" } }) }, TRUST_STATE.SYNC_ERROR],
    [{ online: false, syncState: { status: "offline", phase: "offline" } }, TRUST_STATE.OFFLINE],
    [{ syncState: { status: "connected", phase: "initial" }, persistedSyncState: { initiallySynced: false, databaseUrl: URL_A } }, TRUST_STATE.INITIAL_PULL],
    [{ localWrites: "pending" }, TRUST_STATE.PENDING],
    [{ localWrites: "indeterminate" }, TRUST_STATE.PENDING]
  ];
  for (const [input, expected] of cases) {
    const view = guidance(input);
    assert.equal(view.state.key, expected, JSON.stringify(input));
    for (const field of [
      "meaning", "accessibleData", "maskedData", "risk", "safeAction", "forbiddenActions"
    ]) {
      assert.equal(typeof view.state[field] === "string" || Array.isArray(view.state[field]), true, field);
      assert.ok(view.state[field].length > 0, field);
    }
  }
  const otp = buildTrustGuidance({
    diagnostic: buildSyncDiagnostic(baseInput({ user: null })),
    onboarding: { step: "otp" }
  });
  assert.equal(otp.state.key, TRUST_STATE.OTP_REQUIRED);
  const activation = buildTrustGuidance({
    diagnostic: buildSyncDiagnostic(baseInput()),
    onboarding: { step: "activation" }
  });
  assert.equal(activation.state.key, TRUST_STATE.ACTIVATION);
  const historical = buildTrustGuidance({
    diagnostic: buildSyncDiagnostic(baseInput({
      binding: "indeterminate",
      bootstrap: { cause: "historical-unattested-cache", origin: "historical-unverified" }
    }))
  });
  assert.equal(historical.state.key, TRUST_STATE.HISTORICAL_CACHE);
  const recovered = buildTrustGuidance({
    diagnostic: buildSyncDiagnostic(baseInput({
      bootstrap: { cause: "recovered-prior-attestation", origin: "bootstrap-regression" }
    }))
  });
  assert.equal(recovered.state.key, TRUST_STATE.ISOLATED_RECOVERY);
  assert.match(recovered.state.meaning, /isolée/i);
  assert.match(recovered.state.forbiddenActions.join(" "), /propagation|Purger/i);
});

test("1.4 only an attributable native event produces a synchronization date", () => {
  assert.equal(shouldRecordSyncObservation(observationInput()), true);
  const record = buildSyncObservationRecord(observationInput(), Date.UTC(2026, 9, 20, 12, 30));
  assert.equal(record.version, SYNC_OBSERVATION_VERSION);
  assert.equal(record.url, URL_A);
  assert.equal(record.databaseName, "threadstep-ws-alpha");
  assert.equal(record.remoteDbId, "remote-1");
  assert.equal(record.userDigest, DIGEST);
  assert.equal(record.observedAt, "2026-10-20T12:30:00.000Z");
  assert.equal(record.source, "sync-complete");

  const storage = memoryStorage();
  assert.deepEqual(writeSyncObservation(storage, record), { ok: true, reason: null });
  assert.deepEqual(readSyncObservation(storage), record);
  const resolved = resolveObservedSync({
    storage,
    binding: "bound",
    url: URL_A,
    databaseName: "threadstep-ws-alpha",
    remoteDbId: "remote-1",
    userDigest: DIGEST
  });
  assert.equal(resolved.available, true);
  assert.match(resolved.label, /Dernière synchronisation observée sur cet appareil/);
  assert.equal(resolved.dateLabel, "2026-10-20 à 12:30 UTC");
  assert.match(resolved.scope, /ne prouve ni l'intégralité/);

  for (const override of [
    { eventReceived: false },
    { session: "signed-out" },
    { binding: "unverified" },
    { url: null },
    { databaseName: null },
    { remoteDbId: null },
    { userDigest: null },
    { phase: "pulling" },
    { persistedSyncState: { initiallySynced: false } },
    { persistedSyncState: { initiallySynced: true } },
    { eventUrl: URL_B },
    { eventDatabaseName: "threadstep-ws-beta" },
    { eventRemoteDbId: "remote-2" },
    { eventUserDigest: "digest-user-2" }
  ]) {
    assert.equal(shouldRecordSyncObservation(observationInput(override)), false, JSON.stringify(override));
    assert.equal(buildSyncObservationRecord(observationInput(override), 0), null, JSON.stringify(override));
  }
});

test("1.5 late events, mismatching reloads, write failures and absence keep the date unavailable", () => {
  const storage = memoryStorage();
  const record = buildSyncObservationRecord({
    current: observationInput(),
    event: { type: "sync-complete", url: URL_A }
  }, Date.UTC(2026, 9, 20, 8, 0));
  assert.ok(record);

  const lateAccount = buildSyncObservationRecord({
    current: observationInput({ userDigest: "digest-user-2" }),
    event: { type: "sync-complete", url: URL_A, databaseName: "threadstep-ws-alpha", remoteDbId: "remote-1", userDigest: DIGEST }
  }, 0);
  assert.equal(lateAccount, null);

  const lateUrl = buildSyncObservationRecord({
    current: observationInput({ url: URL_B }),
    event: { type: "sync-complete", url: URL_A, databaseName: "threadstep-ws-alpha", remoteDbId: "remote-1", userDigest: DIGEST }
  }, 0);
  assert.equal(lateUrl, null);

  const lateWorkspace = buildSyncObservationRecord({
    current: observationInput({ databaseName: "threadstep-ws-beta" }),
    event: { type: "sync-complete", url: URL_A, databaseName: "threadstep-ws-alpha", remoteDbId: "remote-1", userDigest: DIGEST }
  }, 0);
  assert.equal(lateWorkspace, null);

  const absent = resolveObservedSync({
    storage,
    binding: "bound",
    url: URL_A,
    databaseName: "threadstep-ws-alpha",
    remoteDbId: "remote-1",
    userDigest: DIGEST
  });
  assert.equal(absent.available, false);
  assert.equal(absent.label, TRUST_LABELS.DATE_UNAVAILABLE);

  writeSyncObservation(storage, record);
  const matching = resolveObservedSync({
    storage,
    binding: "bound",
    url: URL_A,
    databaseName: "threadstep-ws-alpha",
    remoteDbId: "remote-1",
    userDigest: DIGEST
  });
  assert.equal(matching.available, true);
  for (const mismatch of [
    { url: URL_B },
    { databaseName: "threadstep-ws-beta" },
    { remoteDbId: "remote-2" },
    { userDigest: "digest-user-2" },
    { binding: "mismatch" }
  ]) {
    const stale = resolveObservedSync({
      storage,
      binding: "bound",
      url: URL_A,
      databaseName: "threadstep-ws-alpha",
      remoteDbId: "remote-1",
      userDigest: DIGEST,
      ...mismatch
    });
    assert.equal(stale.available, false, JSON.stringify(mismatch));
    assert.equal(stale.label, TRUST_LABELS.DATE_UNAVAILABLE);
  }

  const failing = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("quota"); }
  };
  assert.equal(readSyncObservation(failing), null);
  assert.deepEqual(writeSyncObservation(failing, record), { ok: false, reason: "write-failed" });
  assert.equal(resolveObservedSync({
    storage: failing,
    binding: "bound",
    url: URL_A,
    databaseName: "threadstep-ws-alpha",
    remoteDbId: "remote-1",
    userDigest: DIGEST
  }).available, false);
});

test("1.6 neither guidance nor observation leaks personal or business content", () => {
  const input = {
    configured: true,
    databaseUrl: URL_A,
    online: true,
    user: { isLoggedIn: true, userId: "user-raw-id", email: "alice@example.com" },
    syncState: { status: "error", phase: "error", error: { name: "SyncError", message: "Serveur brut secret" } },
    persistedSyncState: completePersisted({ error: { name: "SyncError", message: "Serveur brut secret" } }),
    otp: "985412",
    token: "tok_live_secret",
    title: "Titre métier confidentiel",
    note: "Note métier privée"
  };
  const diagnostic = buildSyncDiagnostic(input);
  const view = buildTrustGuidance({
    diagnostic,
    onboarding: { step: "active" },
    workspace: { type: "synchronized", effectiveBase: "threadstep-ws-alpha", url: URL_A }
  });
  const serialized = JSON.stringify(view);
  for (const forbidden of [
    "alice@example.com", "985412", "tok_live_secret", "user-raw-id",
    "Titre métier confidentiel", "Note métier privée", "Serveur brut secret"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  const record = buildSyncObservationRecord(observationInput(), 0);
  assert.deepEqual(Object.keys(record).sort(), [
    "databaseName", "observedAt", "remoteDbId", "source", "url", "userDigest", "version"
  ]);
  assert.equal(JSON.stringify(record).includes("alice@example.com"), false);
  assert.equal(JSON.stringify(record).includes("Titre métier confidentiel"), false);
});

test("2.1 the three questions lead the synchronization page in order", () => {
  const page = between(html, '<section id="settings-sync-page"', '<div id="sync-summary"');
  const ordered = [
    'id="sync-trust-location"',
    'id="sync-trust-evidence"',
    'id="sync-trust-actions"',
    'id="sync-onboarding"'
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(page.indexOf(ordered[index - 1]) < page.indexOf(ordered[index]), ordered[index]);
  }
  for (const heading of [
    "Où sont mes données ?",
    "Sont-elles synchronisées ?",
    "Que puis-je faire maintenant ?"
  ]) {
    assert.match(page, new RegExp(heading.replace("?", "\\?")));
  }
});

test("2.2 the renderer uses the pure helper without a second diagnostic or handler", () => {
  const render = between(app, "function renderTrustGuidance(", "\nfunction paintSyncDiagnostic(");
  assert.match(render, /buildTrustGuidance\(/);
  assert.match(render, /buildSyncDiagnostic\(readSyncDiagnosticInput\(\)\)/);
  assert.match(render, /workspaceDiagnosticInput\(\)/);
  assert.match(render, /onboardingView\(readCloudSettingsInput\(\)\)/);
  assert.doesNotMatch(render, /buildDiagnosticView|createSyncDiagnosticsController|renderSyncDiagnostic|nativePullAdapter|\.open\(/);
  assert.equal(occurrences(app, "function paintSyncDiagnostic("), 1);
  assert.doesNotMatch(render, /addEventListener/);
});

test("2.3 local, synchronized, masked, mismatch, expired, offline and pending states are explicit", () => {
  const local = buildTrustGuidance({ diagnostic: buildSyncDiagnostic({ configured: false }) });
  assert.equal(local.locationLabel, TRUST_LABELS.LOCAL);
  assert.equal(local.destination, null);

  const synced = guidance();
  assert.equal(synced.locationLabel, TRUST_LABELS.SYNCHRONIZED);
  assert.equal(synced.databaseName, "threadstep-ws-alpha");
  assert.equal(synced.destination.url, URL_A);

  for (const [input, key] of [
    [{ binding: "unverified" }, TRUST_STATE.UNVERIFIED],
    [{ binding: "mismatch" }, TRUST_STATE.MISMATCH],
    [{ user: null, authExpired: true }, TRUST_STATE.SESSION],
    [{ online: false, syncState: { status: "offline", phase: "offline" } }, TRUST_STATE.OFFLINE],
    [{ localWrites: "pending" }, TRUST_STATE.PENDING]
  ]) {
    const view = guidance(input);
    assert.equal(view.state.key, key);
    assert.equal(view.databaseName, "threadstep-ws-alpha");
    if (key === TRUST_STATE.PENDING) {
      assert.equal(view.locationLabel, TRUST_LABELS.SYNCHRONIZED);
      assert.equal(view.evidence.pending.label, TRUST_LABELS.PENDING);
    } else {
      assert.equal(view.locationLabel, TRUST_LABELS.MASKED, key);
    }
  }
  const unknown = guidance({ localWrites: "indeterminate" });
  assert.equal(unknown.evidence.pending.label, TRUST_LABELS.UNKNOWN_UPLOAD);
  assert.doesNotMatch(JSON.stringify(unknown), /Tout est sauvegardé dans le Cloud/);
});

test("2.4 in-sync alone never claims global Cloud safety and evidence levels stay distinct", () => {
  const observed = guidance({}, {
    observedSync: {
      available: true,
      label: "Dernière synchronisation observée sur cet appareil le 2026-10-20 à 08:00 UTC",
      dateLabel: "2026-10-20 à 08:00 UTC",
      observedAt: "2026-10-20T08:00:00.000Z"
    }
  });
  assert.equal(observed.evidence.local.label, "Aucune modification locale récente identifiée");
  assert.equal(observed.evidence.otherDevice.label, TRUST_LABELS.OTHER_DEVICE);
  assert.equal(observed.evidence.cloud.label, TRUST_LABELS.CLOUD_OBSERVED);
  assert.match(observed.evidence.cloud.scope, /ni la convergence d'un autre appareil/);
  assert.equal(observed.observation.available, true);
  const serialized = JSON.stringify(observed);
  assert.equal(serialized.includes("Tout est sauvegardé dans le Cloud"), false);

  const inSyncOnly = guidance({}, { observedSync: { available: true } });
  assert.equal(inSyncOnly.evidence.otherDevice.label, TRUST_LABELS.OTHER_DEVICE);
  assert.notEqual(inSyncOnly.evidence.local.label, inSyncOnly.evidence.pending.label);
  assert.notEqual(inSyncOnly.evidence.pending.label, inSyncOnly.evidence.cloud.label);
});

test("2.5 the five intent checklists reuse existing controls and never reference a handler", () => {
  const view = guidance();
  const labels = view.intents.map((intent) => intent.label);
  assert.deepEqual(labels, [
    "Je veux rester en local",
    "Je veux synchroniser cet appareil",
    "Je veux retrouver mes projets sur un nouvel appareil",
    "Je veux revenir au local",
    "Je veux corriger un blocage"
  ]);
  const serialized = JSON.stringify(view.intents);
  for (const forbidden of [
    "executeWorkspaceLogout", "planWorkspacePurge", "planWorkspaceSuspension",
    "retryInitialPull", "nativePullAdapter", "startAuthentication",
    "submitAuthForm", "bootstrapSyncedDatabase", "transferCommitted"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  const local = buildTrustGuidance({ diagnostic: buildSyncDiagnostic({ configured: false }) });
  const syncIntent = local.intents.find((intent) => intent.id === "synchronize");
  assert.ok(syncIntent.steps.some((step) => step.control === "cloud-config-form"));
  const returnLocal = view.intents.find((intent) => intent.id === "returnLocal");
  for (const control of ["workspace-suspend", "workspace-logout", "workspace-purge"]) {
    assert.ok(returnLocal.steps.some((step) => step.control === control), control);
  }
  const fix = view.intents.find((intent) => intent.id === "fixBlockage");
  assert.match(fix.steps.map((step) => step.text).join(" "), /Cause compréhensible/);
  assert.equal(fix.steps.some((step) => step.control === "workspace-recover"), false);
  const unverifiedFix = guidance({ binding: "unverified" }).intents
    .find((intent) => intent.id === "fixBlockage");
  assert.equal(unverifiedFix.steps.some((step) => step.control === "workspace-recover"), true);
  const mismatchFix = guidance({ binding: "mismatch" }).intents
    .find((intent) => intent.id === "fixBlockage");
  assert.equal(mismatchFix.steps.some((step) => step.control === "workspace-select"), true);
});

test("2.6 empty, masked, storage and network states never claim an empty Cloud or success", () => {
  const cases = [
    buildTrustGuidance({
      diagnostic: buildSyncDiagnostic({ configured: false }),
      localEmpty: true
    }),
    guidance({ binding: "mismatch" }),
    guidance({ binding: "destination-mismatch" }),
    guidance({ readError: { name: "ReadError" } }),
    guidance({ online: false, syncState: { status: "offline", phase: "offline" } }),
    guidance({ user: null, authExpired: true })
  ];
  for (const view of cases) {
    const serialized = JSON.stringify(view).toLowerCase();
    assert.equal(serialized.includes("la cible cloud est vide"), false);
    assert.equal(serialized.includes("aucun projet dans le cloud"), false);
    assert.equal(serialized.includes("tout est sauvegardé"), false);
    assert.notEqual(view.evidence.cloud.label, TRUST_LABELS.CLOUD_OBSERVED);
  }
  const empty = cases[0];
  assert.equal(empty.state.key, TRUST_STATE.LOCAL_EMPTY);
  assert.match(empty.state.maskedData, /Cloud reste inconnu/);
});

test("3.1 the four business panels are native disclosures and technical info stays secondary", () => {
  assert.equal(occurrences(html, '<details class="sync-business-details">'), 4);
  assert.match(html, /<details id="sync-technical-info" class="sync-technical-info">/);
  assert.match(html, /<summary>Informations techniques<\/summary>/);
  for (const id of [
    "sync-configuration-section", "sync-activation-section",
    "sync-connection-section", "sync-workspaces-section"
  ]) {
    const block = between(html, '<section id="' + id + '"', "</section>\n");
    assert.match(block, /<details class="sync-business-details">/);
    assert.match(block, /<summary>/);
  }
  const technical = between(html, '<details id="sync-technical-info"', "</details>");
  assert.match(technical, /id="sync-diagnostic"/);
});

test("3.2 every existing control stays unique and inside its original section", () => {
  for (const id of ["cloud-config", "cloud-activation", "auth-panel", "workspace-panel"]) {
    assert.equal(occurrences(html, 'id="' + id + '"'), 1, id);
  }
  assert.equal(occurrences(html, 'id="sync-diagnostic"'), 1);
  const sections = [
    ["sync-configuration-section", "cloud-config", "sync-activation-section"],
    ["sync-activation-section", "cloud-activation", "sync-connection-section"],
    ["sync-connection-section", "auth-panel", "sync-workspaces-section"],
    ["sync-workspaces-section", "workspace-panel", 'id="sync-technical-info"']
  ];
  for (const [section, control, end] of sections) {
    const block = between(html, '<section id="' + section + '"', end);
    assert.equal(occurrences(block, 'id="' + control + '"'), 1, control);
  }
  const page = between(html, '<section id="settings-sync-page"', '<div id="sync-summary"');
  assert.equal(occurrences(page, 'id="cloud-config"'), 1);
  assert.equal(occurrences(page, 'id="sync-diagnostic"'), 1);
});

test("3.3 section visibility stays presentation-only and keeps onboarding semantics", () => {
  const visibility = between(app, "function applySyncSectionVisibility(", "\n}\n");
  assert.match(visibility, /syncSectionVisibility\(readCloudSettingsInput\(\)\)/);
  assert.match(visibility, /\.hidden = !visibility\.configuration/);
  assert.match(visibility, /\.hidden = !visibility\.activation/);
  assert.match(visibility, /\.hidden = !visibility\.connection/);
  assert.match(visibility, /\.hidden = !visibility\.workspaces/);
  assert.doesNotMatch(visibility, /replaceChildren|createElement|innerHTML|renderSync|\.open\(|fetch\(/);
  const navigation = between(app, "function applySettingsVisibility(", "\n}\n");
  assert.doesNotMatch(navigation, /bootstrapSyncedDatabase|\.cloud\.configure|startAuthentication|Dexie\.delete/);
});

test("3.4 technical identifiers are not required for the first-screen summary", () => {
  const page = between(html, '<section id="settings-sync-page"', '<details id="sync-technical-info"');
  for (const id of ["sync-trust-location-body", "sync-trust-evidence-body", "sync-trust-actions-body"]) {
    assert.ok(page.includes(id), id);
  }
  assert.equal(page.includes('id="sync-diagnostic"'), false);
  const location = between(app, "function paintSyncTrustLocation(", "\nfunction paintSyncTrustEvidence(");
  assert.match(location, /guidance\.locationLabel/);
  assert.match(location, /guidance\.databaseName/);
  assert.match(location, /guidance\.destination/);
  assert.doesNotMatch(location, /sync-diagnostic-list|buildDiagnosticView/);
});

test("4.1 compact responsive styles, visible focus and 44px targets exist", () => {
  assert.match(css, /@media\(max-width:320px\)\{[^\n]*\.sync-trust-block/);
  assert.match(css, /\.sync-help-toggle:focus-visible[^}]*outline:(?:var\(--focus-outline\)|3px solid)/);
  assert.match(css, /\.sync-help-toggle,\.sync-intent-link\{[^}]*min-height:44px[^}]*min-width:44px/);
  assert.match(css, /\.sync-business-details>summary[^{]*\{[^}]*min-height:44px/);
  assert.match(css, /\.sync-intent>summary\{[^}]*min-height:44px/);
  assert.match(css, /\.sync-trust-block[^{]*\{[^}]*overflow-wrap:anywhere/);
  assert.equal(/\boverflow-x\s*:/.test(css), false);
});

test("4.2 status words accompany every visual state without relying on color", () => {
  const styles = between(css, ".sync-trust-primary{", ".sync-trust-secondary");
  assert.match(styles, /data-state="pending"/);
  assert.match(styles, /data-state="unverified"/);
  assert.match(styles, /data-state="storage-error"/);
  assert.match(styles, /data-state="observed"/);
  const evidence = between(app, "function paintSyncTrustEvidence(", "\nfunction paintSyncTrustActions(");
  assert.match(evidence, /guidance\.evidence\.local/);
  assert.match(evidence, /guidance\.evidence\.pending/);
  assert.match(evidence, /guidance\.evidence\.cloud/);
  assert.match(evidence, /item\.label/);
  assert.match(evidence, /setAttribute\("data-state", guidance\.state\.key\)/);
  assert.match(moduleSource, /label: "Cache local non vérifié"|label: "Compte différent de la liaison"/);
});

test("4.3 help controls expose aria-expanded, aria-controls and only toggle presentation", () => {
  const help = between(app, "function trustHelp(", "\nfunction paintSyncTrustLocation(");
  assert.match(help, /setAttribute\("aria-expanded", "false"\)/);
  assert.match(help, /setAttribute\("aria-controls", id\)/);
  assert.match(help, /el\("button", "sync-help-toggle", "Pourquoi \?"\)/);
  assert.equal(occurrences(help, "addEventListener"), 1);
  assert.match(help, /aria-expanded/);
  assert.doesNotMatch(help, /retrySyncInitialPull|nativePullAdapter|executeWorkspace|planWorkspace|startAuthentication|\.cloud\.sync/);
});

test("4.4 trust statuses use live regions without duplicating the diagnostic summary", () => {
  assert.match(app, /status\.setAttribute\("role", "status"\)/);
  assert.match(app, /status\.setAttribute\("aria-live", "polite"\)/);
  const render = between(app, "function renderTrustGuidance(", "\nfunction paintSyncDiagnostic(");
  assert.doesNotMatch(render, /buildDiagnosticSummary/);
  const paint = between(app, "function paintSyncDiagnostic(", "\nfunction renderSyncDiagnostic(");
  assert.match(paint, /buildDiagnosticSummary\(diagnostic\)/);
  assert.doesNotMatch(render, /pageSummary\.id = "sync-diagnostic-summary"/);
});

test("5.1 the read path reuses existing signals without opening a base", () => {
  const render = between(app, "function renderTrustGuidance(", "\nfunction paintSyncDiagnostic(");
  for (const signal of [
    "buildSyncDiagnostic(readSyncDiagnosticInput())",
    "workspaceDiagnosticInput()",
    "readCloudSettingsInput()"
  ]) {
    assert.ok(render.includes(signal), signal);
  }
  assert.doesNotMatch(render, /bootstrapSyncedDatabase|\.open\(|Dexie\(|fetch\(|startAuthentication|\.cloud\.sync/);
});

test("5.2 the native syncComplete signal records at most one attributable observation", () => {
  const subscribe = between(app, "function subscribeToChanges(", "\nfunction migrationPanel()");
  assert.match(subscribe, /cloud\.events\.syncComplete\.subscribe/);
  assert.match(subscribe, /recordSyncObservationFromNative\(\)/);
  const record = between(app, "function recordSyncObservationFromNative(", "\nfunction currentObservedSync(");
  assert.match(record, /shouldRecordSyncObservation|buildSyncObservationRecord/);
  assert.match(record, /writeSyncObservation\(localStorage, record\)/);
  assert.match(record, /try \{/);
  assert.match(record, /catch/);
  assert.equal(occurrences(record, "writeSyncObservation("), 1);

  const storage = memoryStorage();
  const unattributable = buildSyncObservationRecord(observationInput({ binding: "mismatch" }), 0);
  assert.equal(unattributable, null);
  assert.equal(readSyncObservation(storage), null);
  const recordable = buildSyncObservationRecord(observationInput(), 0);
  writeSyncObservation(storage, recordable);
  assert.ok(readSyncObservation(storage));
});

test("5.3 account, URL, reload, offline and pending regressions keep stale labels out", () => {
  const storage = memoryStorage();
  const record = buildSyncObservationRecord(observationInput(), Date.UTC(2026, 9, 20, 9, 0));
  writeSyncObservation(storage, record);
  const ate = resolveObservedSync({
    storage,
    binding: "mismatch",
    url: URL_A,
    databaseName: "threadstep-ws-alpha",
    remoteDbId: "remote-1",
    userDigest: "digest-user-2"
  });
  assert.equal(ate.available, false);

  const offline = guidance({ online: false, syncState: { status: "offline", phase: "offline" } }, {
    observedSync: resolveObservedSync({
      storage,
      binding: "bound",
      url: URL_A,
      databaseName: "threadstep-ws-alpha",
      remoteDbId: "remote-1",
      userDigest: DIGEST
    })
  });
  assert.equal(offline.observation.available, true);
  assert.equal(offline.locationLabel, TRUST_LABELS.MASKED);
  assert.equal(offline.evidence.cloud.label, TRUST_LABELS.CLOUD_NOT_OBSERVED);

  const pending = guidance({ localWrites: "pending" });
  assert.equal(pending.evidence.pending.label, TRUST_LABELS.PENDING);
  assert.notEqual(pending.evidence.cloud.label, TRUST_LABELS.PENDING);

  const unattested = buildSyncObservationRecord(observationInput({
    persistedSyncState: { initiallySynced: true, serverRevision: null }
  }), 0);
  assert.equal(unattested, null);
});

test("5.4 opening or collapsing the page never invokes a Cloud action", () => {
  const reveal = between(app, "function revealExistingControl(", "\nfunction trustHelp(");
  assert.match(reveal, /\.closest\("details"\)/);
  assert.match(reveal, /disclosure\.open = true/);
  assert.match(reveal, /section\.hidden = false/);
  assert.match(reveal, /target\.focus\(\)/);
  assert.doesNotMatch(reveal, /cloud\.sync|retryInitialPull|executeWorkspace|planWorkspace|purge|logout|suspend|fetch\(|startAuthentication/i);

  const actions = between(app, "function paintSyncTrustActions(", "\nfunction renderTrustGuidance(");
  assert.match(actions, /revealExistingControl\(step\.control\)/);
  assert.equal(occurrences(actions, "addEventListener"), 1);
  assert.doesNotMatch(actions, /retrySyncInitialPull|executeWorkspace|planWorkspace|startAuthentication/);

  const visibility = between(app, "function applySettingsVisibility(", "\n}\n");
  assert.doesNotMatch(visibility, /renderTrustGuidance|recordSyncObservation|revealExistingControl/);
});

test("5.5 the observation key is versioned, workspace-scoped and business-free", () => {
  assert.equal(SYNC_OBSERVATION_STORAGE_KEY, "threadstep.sync-observation.v1");
  assert.equal(SYNC_OBSERVATION_VERSION, 1);
  assert.match(moduleSource, /SYNC_OBSERVATION_VERSION/);
  const record = buildSyncObservationRecord(observationInput(), 0);
  assert.equal(record.url, URL_A);
  assert.equal(record.databaseName, "threadstep-ws-alpha");
  assert.equal(record.remoteDbId, "remote-1");
  assert.equal(record.userDigest, DIGEST);
  assert.equal("subjects" in record, false);
  assert.equal("items" in record, false);
  assert.equal("title" in record, false);
  assert.equal("note" in record, false);
  const storage = memoryStorage();
  writeSyncObservation(storage, record);
  const raw = storage.getItem(SYNC_OBSERVATION_STORAGE_KEY);
  assert.equal(raw.includes("subjects"), false);
  assert.equal(raw.includes("items"), false);
  assert.equal(raw.includes("alice@example.com"), false);
});

test("6.1 the app wires the renderer into the existing diagnostic refresh", () => {
  const renderDiagnostic = between(app, "function renderSyncDiagnostic(", "\nfunction setupSyncDiagnostics(");
  assert.match(renderDiagnostic, /renderTrustGuidance\(\)/);
  const setup = between(app, "function setupSyncDiagnostics(", "\nasync function retrySyncInitialPull(");
  assert.match(setup, /renderSyncDiagnostic\(\)/);
  assert.equal(occurrences(app, "function renderTrustGuidance("), 1);
});
