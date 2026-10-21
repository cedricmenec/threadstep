import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIFECYCLE_DB_OPEN,
  LIFECYCLE_OTP,
  MAX_LIFECYCLE_AGE_SECONDS,
  createSyncLifecycleInstrumentation,
  formatBoundedAge
} from "../site/sync-lifecycle-instrumentation.js";
import { buildSyncDiagnostic } from "../site/sync-diagnostics.js";
import { buildSyncDiagnosticReport } from "../site/sync-diagnostic-report.js";

const source = readFileSync(new URL("../site/sync-lifecycle-instrumentation.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");

function fakeClock(start = 1_000_000) {
  let value = start;
  return {
    now: () => value,
    advance: (ms) => { value += ms; },
    set: (ms) => { value = ms; }
  };
}

test("TS-051 instrumentation records db.open() states without messages", () => {
  const clock = fakeClock();
  const lifecycle = createSyncLifecycleInstrumentation({ now: clock.now });

  assert.equal(lifecycle.snapshot().dbOpen.state, LIFECYCLE_DB_OPEN.NOT_STARTED);
  assert.equal(lifecycle.snapshot().dbOpen.startedAgeSeconds, null);

  lifecycle.dbOpenStarted();
  clock.advance(15_000);
  const pending = lifecycle.snapshot();
  assert.equal(pending.dbOpen.state, LIFECYCLE_DB_OPEN.PENDING);
  assert.equal(pending.dbOpen.startedAgeSeconds, 15);
  assert.equal(pending.dbOpen.lastAgeSeconds, 15);

  clock.advance(5_000);
  lifecycle.dbOpenResolved();
  const resolved = lifecycle.snapshot();
  assert.equal(resolved.dbOpen.state, LIFECYCLE_DB_OPEN.RESOLVED);
  assert.equal(resolved.dbOpen.startedAgeSeconds, 20);
  assert.equal(resolved.dbOpen.lastAgeSeconds, 0);

  clock.advance(1_000);
  lifecycle.dbOpenStarted();
  lifecycle.dbOpenFailed();
  const failed = lifecycle.snapshot();
  assert.equal(failed.dbOpen.state, LIFECYCLE_DB_OPEN.FAILED);
  assert.equal(failed.dbOpen.lastAgeSeconds, 0);
  assert.doesNotMatch(JSON.stringify(failed), /error|stack|message|email|token/i);
});

test("TS-051 instrumentation records initial emission and last change for the three observables", () => {
  const clock = fakeClock();
  const lifecycle = createSyncLifecycleInstrumentation({ now: clock.now });

  lifecycle.observeInitial("currentUser");
  clock.advance(10_000);
  lifecycle.observeObservable("currentUser");
  clock.advance(10_000);
  lifecycle.observeObservable("syncState");
  clock.advance(10_000);
  lifecycle.observeObservable("persistedSyncState");
  clock.advance(10_000);
  lifecycle.observeObservable("currentUser");

  const snapshot = lifecycle.snapshot();
  assert.equal(snapshot.observables.currentUser.emissions, 2);
  assert.equal(snapshot.observables.currentUser.initialEmissionAgeSeconds, 40);
  assert.equal(snapshot.observables.currentUser.lastChangeAgeSeconds, 0);
  assert.equal(snapshot.observables.syncState.emissions, 1);
  assert.equal(snapshot.observables.syncState.initialEmissionAgeSeconds, 20);
  assert.equal(snapshot.observables.persistedSyncState.emissions, 1);
  assert.equal(snapshot.observables.persistedSyncState.lastChangeAgeSeconds, 10);
  assert.deepEqual(Object.keys(snapshot.observables), ["currentUser", "syncState", "persistedSyncState"]);
  assert.equal(lifecycle.observeObservable("businessRecords"), false);
});

test("TS-051 instrumentation records OTP request and normalized outcome only", () => {
  const clock = fakeClock();
  const lifecycle = createSyncLifecycleInstrumentation({ now: clock.now });
  assert.equal(lifecycle.snapshot().otp.state, LIFECYCLE_OTP.NOT_REQUESTED);

  lifecycle.otpRequested();
  clock.advance(4_000);
  lifecycle.otpSucceeded();
  clock.advance(2_000);
  let snapshot = lifecycle.snapshot();
  assert.equal(snapshot.otp.state, LIFECYCLE_OTP.SUCCEEDED);
  assert.equal(snapshot.otp.requestedAgeSeconds, 6);
  assert.equal(snapshot.otp.lastAgeSeconds, 2);

  lifecycle.otpRequested();
  lifecycle.otpFailed();
  assert.equal(lifecycle.snapshot().otp.state, LIFECYCLE_OTP.FAILED);

  lifecycle.otpRequested();
  lifecycle.otpCancelled();
  snapshot = lifecycle.snapshot();
  assert.equal(snapshot.otp.state, LIFECYCLE_OTP.CANCELLED);
  assert.doesNotMatch(JSON.stringify(snapshot), /@|code|email|token|cookie|account/i);
});

test("TS-051 ages are rounded, bounded and capped at seven days", () => {
  assert.equal(formatBoundedAge(0), "0 s");
  assert.equal(formatBoundedAge(59), "59 s");
  assert.equal(formatBoundedAge(60), "1 min");
  assert.equal(formatBoundedAge(3_600), "1 h");
  assert.equal(formatBoundedAge(86_400), "1 j");
  assert.equal(formatBoundedAge(MAX_LIFECYCLE_AGE_SECONDS), "≥ 7 jours");
  assert.equal(formatBoundedAge(MAX_LIFECYCLE_AGE_SECONDS * 10), "≥ 7 jours");
  assert.equal(formatBoundedAge(null), "non disponible");
  assert.equal(formatBoundedAge(Number.NaN), "non disponible");

  const clock = fakeClock();
  const lifecycle = createSyncLifecycleInstrumentation({ now: clock.now });
  lifecycle.dbOpenStarted();
  clock.set(clock.now() + (MAX_LIFECYCLE_AGE_SECONDS + 99) * 1000);
  const snapshot = lifecycle.snapshot();
  assert.equal(snapshot.dbOpen.startedAgeSeconds, MAX_LIFECYCLE_AGE_SECONDS);
});

test("TS-051 instrumentation stays in memory with a fixed shape and no persistence", () => {
  for (const pattern of [
    /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\bfetch\s*\(/,
    /XMLHttpRequest/, /sendBeacon/, /\bdocument\b/, /\bwindow\b/, /\bnavigator\b/,
    /\.message\b/, /\.stack\b/
  ]) {
    assert.doesNotMatch(source, pattern);
  }
  const lifecycle = createSyncLifecycleInstrumentation({ now: () => 1 });
  assert.deepEqual(Object.keys(lifecycle.snapshot()).sort(), ["dbOpen", "observables", "otp"]);
  assert.deepEqual(Object.keys(lifecycle.snapshot().dbOpen).sort(), ["lastAgeSeconds", "startedAgeSeconds", "state"]);
});

test("TS-051 app wires instrumentation passively around open, subscriptions and OTP", () => {
  const setupAuth = app.slice(app.indexOf("function setupAuthentication() {"),
    app.indexOf("function showAuthFieldError("));
  assert.match(setupAuth, /syncLifecycle\.dbOpenStarted\(\)/);
  assert.match(setupAuth, /\.then\(\(\) => \{\s*syncLifecycle\.dbOpenResolved\(\);/);
  assert.match(setupAuth, /\.catch\(\(\) => \{\s*syncLifecycle\.dbOpenFailed\(\);/);

  const setupDiagnostics = app.slice(app.indexOf("function setupSyncDiagnostics() {"),
    app.indexOf("function recordNativeBootstrapEvidence() {"));
  assert.match(setupDiagnostics, /observable === cloud\.syncState/);
  assert.match(setupDiagnostics, /observable === cloud\.persistedSyncState/);
  assert.match(setupDiagnostics, /observable === cloud\.currentUser/);
  assert.match(setupDiagnostics, /syncLifecycle\.observeObservable\(name\)/);
  assert.match(setupDiagnostics, /subscribe\(cloud\.syncState\)/);
  assert.match(setupDiagnostics, /subscribe\(cloud\.persistedSyncState\)/);
  assert.match(setupDiagnostics, /subscribe\(cloud\.currentUser\)/);
  assert.equal((setupDiagnostics.match(/\.subscribe\(/g) || []).length, 1);

  const adapter = app.slice(app.indexOf("function createCloudAuthAdapter(db) {"),
    app.indexOf("function hideRestorePanel() {"));
  assert.match(adapter, /syncLifecycle\.otpRequested\(\)/);
  assert.match(adapter, /syncLifecycle\.otpSucceeded\(\)/);
  assert.match(adapter, /syncLifecycle\.otpFailed\(\)/);
  assert.doesNotMatch(adapter, /\.email\b|request\.email/);

  const cancel = app.slice(app.indexOf("function cancelOtp() {"), app.indexOf("function el(tag, cls, text) {"));
  assert.match(cancel, /syncLifecycle\.otpCancelled\(\)/);
});

test("TS-051 report consumes the instrumentation snapshot and never blocks without it", () => {
  const diagnostic = buildSyncDiagnostic({
    configured: true,
    databaseUrl: "https://alpha.dexie.cloud",
    online: true,
    user: { isLoading: true },
    syncState: { status: "connecting", phase: "initial" },
    persistedSyncState: null
  });
  const clock = fakeClock();
  const lifecycle = createSyncLifecycleInstrumentation({ now: clock.now });
  lifecycle.dbOpenStarted();
  lifecycle.observeInitial("currentUser");
  lifecycle.observeObservable("currentUser");
  clock.advance(12_000);
  lifecycle.otpRequested();

  const withMeasures = buildSyncDiagnosticReport({
    diagnostic,
    now: new Date("2026-10-21T10:20:30Z"),
    lifecycle: lifecycle.snapshot()
  });
  assert.match(withMeasures.text, /db-open-etat` : en attente/);
  assert.match(withMeasures.text, /db-open-age-demarrage` : 12 s/);
  assert.match(withMeasures.text, /currentUser-emission-initiale` : 12 s/);
  assert.match(withMeasures.text, /otp-demande` : demandé/);
  assert.match(withMeasures.text, /otp-age-demande` : 0 s/);

  const withoutMeasures = buildSyncDiagnosticReport({
    diagnostic,
    now: new Date("2026-10-21T10:20:30Z"),
    lifecycle: undefined
  });
  const lifecycleSection = withoutMeasures.sections.find((entry) => entry.key === "lifecycle");
  assert.ok(lifecycleSection.entries.every((entry) => entry.value === "non disponible"));
  assert.match(withoutMeasures.text, /# Rapport de diagnostic/);
});
