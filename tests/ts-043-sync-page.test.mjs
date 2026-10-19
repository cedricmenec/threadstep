import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isViewEntry, parseRoute } from "../site/core.js";
import {
  CONNECTION_STATE,
  INITIAL_PULL,
  LOCAL_WRITE_STATE,
  SESSION_STATE,
  SYNC_PHASE,
  buildDiagnosticSummary,
  buildSyncDiagnostic,
  canRetryInitialPull,
  createSyncDiagnosticsController,
  retryReasonLabel
} from "../site/sync-diagnostics.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");
const guide = read("docs/product/guide-utilisation.md");
const acceptance = read("docs/product/acceptance-checklist.md");
const URL_BASE = "https://demo.dexie.cloud";
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

function completePersisted(overrides = {}) {
  return {
    initiallySynced: true,
    remoteDbId: "remote-1",
    serverRevision: 42,
    realms: ["user-1"],
    databaseUrl: URL_BASE,
    ...overrides
  };
}

function baseInput(overrides = {}) {
  return {
    configured: true,
    databaseUrl: URL_BASE,
    online: true,
    user: USER,
    syncState: { status: "connected", phase: "in-sync" },
    persistedSyncState: completePersisted(),
    localWrites: LOCAL_WRITE_STATE.NONE,
    ...overrides
  };
}

function summary(overrides = {}) {
  return buildDiagnosticSummary(buildSyncDiagnostic(baseInput(overrides)));
}

const settingsSyncPage = between(
  html,
  '<section id="settings-sync-page"',
  '<div id="sync-summary"'
);

test("1.1 the native diagnostic lives exactly once inside the sync settings page", () => {
  const diagnostic = /<section id="sync-diagnostic" class="sync-diagnostic" aria-labelledby="sync-diagnostic-title" hidden><\/section>/;
  assert.match(html, diagnostic);
  assert.equal(occurrences(html, 'id="sync-diagnostic"'), 1);
  assert.equal(occurrences(settingsSyncPage, 'id="sync-diagnostic"'), 1);
  assert.equal(occurrences(html.slice(0, html.indexOf('<section id="settings-sync-page"')), 'id="sync-diagnostic"'), 0);
  assert.equal(occurrences(html.slice(html.indexOf('<div id="sync-summary"')), 'id="sync-diagnostic"'), 0);
});

test("1.2 the four integrated sections host their real control exactly once", () => {
  const sections = [
    ["Configuration", "settings-sync-configuration-title", "sync-configuration-section", "cloud-config", '<section id="sync-activation-section"'],
    ["Première activation", "settings-sync-activation-title", "sync-activation-section", "cloud-activation", '<section id="sync-connection-section"'],
    ["Connexion", "settings-sync-connection-title", "sync-connection-section", "auth-panel", '<section id="sync-workspaces-section"'],
    ["Espaces de travail", "settings-sync-workspaces-title", "sync-workspaces-section", "workspace-panel", '<section id="sync-diagnostic"']
  ];
  for (const [heading, titleId, sectionId, controlId, end] of sections) {
    const block = between(settingsSyncPage, '<section id="' + sectionId + '"', end);
    assert.match(block, new RegExp("<h3[^>]*" + titleId + "[^>]*>" + heading + "</h3>"), heading);
    assert.equal(occurrences(block, 'id="' + controlId + '"'), 1, controlId);
    assert.equal(occurrences(html, 'id="' + controlId + '"'), 1, controlId);
  }
  assert.doesNotMatch(html, /sync-descriptive/);
  assert.doesNotMatch(settingsSyncPage, /TS-044/);
});

test("1.3 the overview summary is a single non-interactive hidden status surface", () => {
  const markup = /<div id="sync-summary" class="sync-summary" role="status" aria-live="polite" hidden><\/div>/;
  assert.match(html, markup);
  assert.equal(occurrences(html, 'id="sync-summary"'), 1);
  const block = between(html, '<div id="sync-summary"', "</div>");
  assert.doesNotMatch(block, /<(button|a|input|select)\b/i);
  assert.ok(html.indexOf('<div id="sync-summary"') > html.indexOf('<section id="settings-sync-page"'));
});

test("1.4 paintSyncDiagnostic creates the page synthesis once without a retry control", () => {
  const paint = between(app, "function paintSyncDiagnostic(", "\nfunction renderSyncDiagnostic(");
  assert.equal(occurrences(paint, 'el("p", "sync-diagnostic-summary"'), 1);
  assert.match(paint, /pageSummary\.id = "sync-diagnostic-summary"/);
  assert.match(paint, /buildDiagnosticSummary\(diagnostic\)/);
  assert.match(paint, /syncDiagnosticEl\.append\(title, readonly, pageSummary, list\)/);
  assert.doesNotMatch(paint, /pageSummary\.(addEventListener|disabled)/);
});

test("1.5 styles cover the synthesis, summary, wrapping and the 44px retry target", () => {
  assert.match(css, /\.sync-diagnostic-summary\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.sync-summary\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.sync-summary\[hidden\]\{display:none\}/);
  assert.match(css, /\.sync-section\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:620px\)\{[^\n]*\.sync-diagnostic-summary,\.sync-summary\{padding:10px/);
  assert.match(css, /\.sync-diagnostic-retry\{[^}]*min-height:44px[^}]*min-width:44px/);
});

test("2.1 summary reports local, in-phase, connecting, offline and pending states", () => {
  const local = buildDiagnosticSummary(buildSyncDiagnostic({ configured: false }));
  assert.equal(local.needsAttention, false);
  assert.match(local.text, /Cloud non configuré/);
  assert.match(local.text, /local uniquement/);

  const healthy = summary();
  assert.equal(healthy.needsAttention, false);
  assert.match(healthy.text, /Synchronisation en phase/);
  assert.match(healthy.text, /Session authentifiée/);
  assert.match(healthy.text, /Connecté/);
  assert.match(healthy.text, /Synchronisé/);

  const connecting = summary({
    user: null,
    syncState: { status: "connecting", phase: "initial" },
    persistedSyncState: null
  });
  assert.equal(connecting.needsAttention, true);
  assert.match(connecting.text, /Session : Aucune session/);
  assert.match(connecting.text, /Connexion : Connexion en cours/);

  const offline = summary({
    online: false,
    syncState: { status: "offline", phase: "offline" },
    persistedSyncState: null
  });
  assert.equal(offline.needsAttention, true);
  assert.match(offline.text, /Hors ligne/);

  const pending = summary({
    syncState: { status: "connected", phase: "not-in-sync" },
    persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
  });
  assert.equal(pending.needsAttention, true);
  assert.match(pending.text, /Pull initial en attente/);

  const failed = summary({ persistedSyncState: completePersisted({ error: "boom" }) });
  assert.equal(failed.needsAttention, true);
  assert.match(failed.text, /Pull initial en échec|Erreur/);
});

test("2.1 summary reports pending local writes, session errors and local errors", () => {
  const pendingWrite = summary({ localWrites: LOCAL_WRITE_STATE.PENDING });
  assert.equal(pendingWrite.needsAttention, true);
  assert.match(pendingWrite.text, /En attente de synchronisation/);

  const sessionExpired = summary({ user: null, authExpired: true });
  assert.equal(sessionExpired.needsAttention, true);
  assert.match(sessionExpired.text, /Session expirée/);

  const localRead = buildDiagnosticSummary(buildSyncDiagnostic({
    configured: false,
    readError: { name: "ReadError" }
  }));
  assert.equal(localRead.needsAttention, true);
  assert.match(localRead.text, /Cloud non configuré/);
  assert.match(localRead.text, /local uniquement/);
  assert.match(localRead.text, /Erreur locale/);
  assert.doesNotMatch(localRead.text, /base distante vide/i);

  const localWrite = buildDiagnosticSummary(buildSyncDiagnostic({
    configured: false,
    localWrites: LOCAL_WRITE_STATE.ERROR
  }));
  assert.equal(localWrite.needsAttention, true);
  assert.match(localWrite.text, /Erreur locale/);
});

test("2.2 summary never exposes raw content and keeps an unproven remote state explicit", () => {
  const value = buildSyncDiagnostic(baseInput({
    user: { isLoggedIn: true, userId: "user-1", email: "alice@example.com" },
    otp: "985412",
    token: "tok_live_secret",
    title: "Titre métier confidentiel",
    note: "Note métier privée",
    syncState: { status: "connecting", phase: "initial" },
    persistedSyncState: null
  }));
  const built = buildDiagnosticSummary(value);
  const serialized = JSON.stringify(built);
  for (const forbidden of [
    "alice@example.com", "985412", "tok_live_secret",
    "Titre métier confidentiel", "Note métier privée"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
    assert.equal(built.text.includes(forbidden), false, forbidden);
  }
  assert.match(built.text, /non déterminé|pas considéré comme vide/i);
});

test("2.3 paint preserves the diagnostic rows, errors, live status, reason and retry binding", () => {
  const paint = between(app, "function paintSyncDiagnostic(", "\nfunction renderSyncDiagnostic(");
  assert.match(paint, /buildDiagnosticView\(diagnostic, \{ busy: syncRetryBusy \}\)/);
  assert.match(paint, /el\("dl", "sync-diagnostic-list"\)/);
  assert.match(paint, /view\.errors/);
  assert.match(paint, /reason\.id = "sync-diagnostic-reason"/);
  assert.match(paint, /status\.setAttribute\("role", "status"\)/);
  assert.match(paint, /status\.setAttribute\("aria-live", "polite"\)/);
  assert.match(paint, /retry\.setAttribute\("aria-describedby", "sync-diagnostic-reason sync-diagnostic-status"\)/);
  assert.equal(occurrences(paint, 'retry.addEventListener("click"'), 1);
  assert.match(paint, /retry\.addEventListener\("click", \(\) => \{ void retrySyncInitialPull\(\); \}\)/);
});

test("2.4 and 2.5 summary visibility depends on the overview route and only updates hidden/text", () => {
  const visibility = between(app, "function applySyncSummaryVisibility(", "\n}\n");
  assert.match(visibility, /route\.view === "overview"/);
  assert.match(visibility, /buildSyncDiagnostic\(readSyncDiagnosticInput\(\)\)/);
  assert.match(visibility, /buildDiagnosticSummary\(diagnostic\)/);
  assert.match(visibility, /syncSummaryEl\.hidden = !show/);
  assert.match(visibility, /syncSummaryEl\.textContent = summary\.text/);
  assert.match(visibility, /overviewAccessLinkVisible\(/);
  assert.match(visibility, /syncSettingsAccessEl\.hidden = !showLink/);
  assert.doesNotMatch(visibility, /renderSyncDiagnostic|\.refresh\(|setupSyncDiagnostics|retrySyncInitialPull|nativePullAdapter|\.open\(|fetch\(|startAuthentication|localStorage|indexedDB/);

  const render = between(app, "function render()", "\nfunction navigate(");
  assert.match(render, /applySyncSummaryVisibility\(\)/);
  for (const forbidden of [
    "renderSyncDiagnostic(", "syncDiagnosticsController.refresh",
    "setupSyncDiagnostics", "retrySyncInitialPull", "nativePullAdapter",
    ".open(", "fetch(", "startAuthentication"
  ]) {
    assert.equal(render.includes(forbidden), false, forbidden);
  }
  assert.equal(visibility.includes("localStorage"), false);
  assert.equal(visibility.includes("indexedDB"), false);
});

test("2.6 retry preconditions and reason labels are unchanged by the page move", () => {
  const scenarios = [
    [buildSyncDiagnostic({ configured: false }), "not-configured"],
    [buildSyncDiagnostic(baseInput({ user: null })), "unauthenticated"],
    [buildSyncDiagnostic(baseInput({ online: false })), "offline"],
    [buildSyncDiagnostic(baseInput()), "already-synced"],
    [buildSyncDiagnostic(baseInput({
      syncState: { status: "connected", phase: "pulling" },
      persistedSyncState: null
    })), "in-progress"],
    [buildSyncDiagnostic(baseInput({ authRefusal: "origin-refusal" })), "refused"],
    [buildSyncDiagnostic(baseInput({
      syncState: {},
      persistedSyncState: null
    })), "indeterminate"]
  ];
  for (const [diagnostic, reason] of scenarios) {
    const decision = canRetryInitialPull(diagnostic);
    assert.deepEqual(decision, { allowed: false, reason });
    assert.equal(retryReasonLabel(reason), retryReasonLabel(decision.reason));
  }
  assert.equal(canRetryInitialPull(buildSyncDiagnostic(baseInput({
    persistedSyncState: completePersisted({ serverRevision: null })
  }))).allowed, true);
});

test("3.1 subscriptions stay in the single guarded setup block", () => {
  const setup = between(app, "function setupSyncDiagnostics(", "\nasync function retrySyncInitialPull(");
  for (const observable of ["cloud.syncState", "cloud.persistedSyncState", "cloud.currentUser"]) {
    assert.equal(occurrences(setup, "subscribe(" + observable + ")"), 1, observable);
  }
  assert.match(setup, /syncDiagnosticsSubscribedFor !== syncedDatabase/);
  assert.match(setup, /syncDiagnosticsSubscribedFor = syncedDatabase/);
  const paint = between(app, "function paintSyncDiagnostic(", "\nfunction renderSyncDiagnostic(");
  const visibility = between(app, "function applySyncSummaryVisibility(", "\n}\n");
  for (const block of [paint, visibility]) {
    assert.doesNotMatch(block, /\.subscribe\s*\(/);
  }
});

test("3.2 repeated refreshes are deterministic and install no subscription", () => {
  const input = baseInput();
  let subscribeCount = 0;
  const observable = { subscribe() { subscribeCount += 1; } };
  const controller = createSyncDiagnosticsController({
    readInput: () => input,
    onChange: () => { void observable.subscribe(); }
  });
  const first = controller.refresh();
  const firstSummary = buildDiagnosticSummary(first).text;
  const firstValue = JSON.stringify(first);
  for (let index = 0; index < 4; index += 1) {
    const next = controller.refresh();
    assert.equal(JSON.stringify(next), firstValue);
    assert.equal(buildDiagnosticSummary(next).text, firstSummary);
  }
  assert.equal(subscribeCount, 5);
  assert.equal(occurrences(app, "createSyncDiagnosticsController("), 1);
});

test("3.5 sensitive controls stay once inside the sync page with their handlers", () => {
  const syncPage = between(html, '<section id="settings-sync-page"', '<div id="sync-summary"');
  for (const id of ["cloud-config", "cloud-activation", "auth-panel", "workspace-panel"]) {
    assert.equal(occurrences(html, 'id="' + id + '"'), 1, id);
    assert.equal(occurrences(syncPage, 'id="' + id + '"'), 1, id);
    assert.match(app, new RegExp('querySelector\\("#' + id + '"\\)'));
  }
  const ordered = [
    'id="sync-onboarding"', 'id="sync-configuration-section"', 'id="sync-activation-section"',
    'id="sync-connection-section"', 'id="sync-workspaces-section"', 'id="sync-diagnostic"'
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(syncPage.indexOf(ordered[index - 1]) < syncPage.indexOf(ordered[index]), ordered[index]);
  }
  assert.match(app, /cloudConfigFormEl\.addEventListener\("submit"/);
  assert.match(app, /authFormEl\.addEventListener\("submit", submitAuthForm\)/);
  assert.match(app, /workspaceApplyEl\.addEventListener\("click"/);
  assert.match(app, /workspacePurgeEl\.addEventListener\("click"/);
});

test("3.6 route changes resolve stably without side-effect references", () => {
  const overview = parseRoute("#/");
  const project = parseRoute("#/sujet/projet-a");
  const sync = parseRoute("#/parametres/synchronisation");
  const backToOverview = parseRoute("#/");
  assert.deepEqual(overview, { view: "overview" });
  assert.deepEqual(project, { view: "subject", subjectId: "projet-a" });
  assert.deepEqual(sync, { view: "settings", section: "sync" });
  assert.deepEqual(backToOverview, overview);
  assert.equal(isViewEntry(overview, sync), true);
  assert.equal(isViewEntry(sync, project), true);
  assert.equal(isViewEntry(project, backToOverview), true);
  assert.equal(isViewEntry(sync, parseRoute("#/parametres/synchronisation")), false);

  const hashchange = between(app, 'window.addEventListener("hashchange"', "\n});");
  assert.doesNotMatch(hashchange, /retrySyncInitialPull|nativePullAdapter|\.open\(|fetch\(|startAuthentication|renderSyncDiagnostic|setupSyncDiagnostics|\.subscribe\(/);
});

test("4.1 documentation describes the dedicated diagnostic page and summary boundaries", () => {
  for (const source of [guide, acceptance]) {
    assert.match(source, /#\/parametres\/synchronisation/);
    assert.match(source, /diagnostic/i);
    assert.match(source, /résumé/i);
    assert.match(source, /Mes projets/);
    assert.match(source, /une seule fois|unique destination|réunies/i);
  }
  assert.match(guide, /Relancer la lecture distante/);
  assert.match(guide, /garde-fous/);
  assert.match(acceptance, /pull manuel|relance/i);
});
