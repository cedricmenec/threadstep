import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BINDING_DIAGNOSTIC_STATE,
  CONNECTION_STATE,
  DIAGNOSTIC_ERROR,
  INITIAL_PULL,
  LOCAL_WRITE_STATE,
  PHASE_LABELS,
  REMOTE_EVIDENCE,
  SESSION_STATE,
  SYNC_PHASE,
  WORKSPACE_DIAGNOSTIC_TYPE,
  buildDiagnosticView,
  buildSyncDiagnostic,
  canRetryInitialPull,
  classifySyncError,
  createSyncDiagnosticsController,
  normalizeCloudBaseUrl,
  normalizeSyncState,
  normalizeUser,
  reduceLocalWriteStatus,
  retryInitialPull,
  retryReasonLabel
} from "../site/sync-diagnostics.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const pkg = JSON.parse(read("package.json"));
const URL_BASE = "https://demo.dexie.cloud";
const USER = Object.freeze({ isLoggedIn: true, userId: "user-1" });

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

function diagnostic(overrides = {}) {
  return buildSyncDiagnostic(baseInput(overrides));
}

test("1.2 every native status and phase maps to a distinct safe value", () => {
  const statuses = {
    "not-started": CONNECTION_STATE.CONNECTING,
    connecting: CONNECTION_STATE.CONNECTING,
    connected: CONNECTION_STATE.CONNECTED,
    disconnected: CONNECTION_STATE.DISCONNECTED,
    error: CONNECTION_STATE.ERROR,
    offline: CONNECTION_STATE.OFFLINE,
    mystery: CONNECTION_STATE.INDETERMINATE
  };
  for (const [status, expected] of Object.entries(statuses)) {
    assert.equal(normalizeSyncState({ status, phase: "in-sync" }).status, expected, status);
  }
  assert.equal(normalizeSyncState(undefined).status, CONNECTION_STATE.INDETERMINATE);
  const phases = {
    initial: SYNC_PHASE.INITIAL,
    "not-in-sync": SYNC_PHASE.NOT_IN_SYNC,
    pulling: SYNC_PHASE.PULLING,
    pushing: SYNC_PHASE.PUSHING,
    "in-sync": SYNC_PHASE.IN_SYNC,
    error: SYNC_PHASE.ERROR,
    offline: SYNC_PHASE.OFFLINE,
    mystery: SYNC_PHASE.INDETERMINATE
  };
  for (const [phase, expected] of Object.entries(phases)) {
    assert.equal(normalizeSyncState({ status: "connected", phase }).phase, expected, phase);
  }
  assert.equal(normalizeSyncState(undefined).phase, SYNC_PHASE.INDETERMINATE);
});

test("1.2 session categories are derived without identity content", () => {
  assert.equal(normalizeUser(USER), SESSION_STATE.AUTHENTICATED);
  assert.equal(normalizeUser({ isLoading: true }), SESSION_STATE.LOADING);
  assert.equal(normalizeUser(null), SESSION_STATE.SIGNED_OUT);
  assert.equal(normalizeUser({ isLoggedIn: false }, { expired: true }), SESSION_STATE.EXPIRED);
  assert.equal(normalizeUser(USER, { refusal: "permission-refusal" }), SESSION_STATE.REFUSED);
  assert.equal(normalizeUser(USER, { refusal: "origin-refusal" }), SESSION_STATE.REFUSED);
  const diagnosticValue = diagnostic();
  assert.equal(diagnosticValue.session, SESSION_STATE.AUTHENTICATED);
  assert.equal(JSON.stringify(diagnosticValue).includes("user-1"), false);
});

test("1.3 transient states are not permanent errors and unknown input is indeterminate", () => {
  const connecting = diagnostic({ syncState: { status: "connecting", phase: "initial" }, persistedSyncState: null });
  assert.equal(connecting.connection, CONNECTION_STATE.CONNECTING);
  assert.equal(connecting.phase, SYNC_PHASE.INITIAL);
  assert.deepEqual(connecting.errors, []);
  const pulling = diagnostic({ syncState: { status: "connected", phase: "pulling" }, persistedSyncState: null });
  assert.equal(pulling.phase, SYNC_PHASE.PULLING);
  assert.deepEqual(pulling.errors, []);
  const pushing = diagnostic({ syncState: { status: "connected", phase: "pushing" }, persistedSyncState: null });
  assert.equal(pushing.phase, SYNC_PHASE.PUSHING);
  assert.deepEqual(pushing.errors, []);
  const unknown = diagnostic({ syncState: {}, persistedSyncState: null });
  assert.equal(unknown.connection, CONNECTION_STATE.INDETERMINATE);
  assert.equal(unknown.phase, SYNC_PHASE.INDETERMINATE);
  assert.equal(unknown.initialPull, INITIAL_PULL.INDETERMINATE);
  assert.notEqual(unknown.remoteEvidence.state, REMOTE_EVIDENCE.AVAILABLE);
});

test("1.4 initial pull states use only native evidence", () => {
  assert.equal(diagnostic({ configured: false, databaseUrl: null }).initialPull, INITIAL_PULL.NOT_CONFIGURED);
  assert.equal(diagnostic({
    syncState: { status: "connected", phase: "not-in-sync" },
    persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
  }).initialPull, INITIAL_PULL.PENDING);
  assert.equal(diagnostic({
    syncState: { status: "connected", phase: "pulling" },
    persistedSyncState: null
  }).initialPull, INITIAL_PULL.IN_PROGRESS);
  assert.equal(diagnostic().initialPull, INITIAL_PULL.COMPLETE);
  assert.equal(diagnostic({
    persistedSyncState: completePersisted({ error: "boom" })
  }).initialPull, INITIAL_PULL.FAILED);
  assert.equal(diagnostic({
    persistedSyncState: completePersisted({ serverRevision: null })
  }).initialPull, INITIAL_PULL.INDETERMINATE);
  const pending = diagnostic({
    syncState: { status: "connected", phase: "not-in-sync" },
    persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
  });
  assert.equal(pending.remoteEvidence.notEmpty, true);
  assert.notEqual(pending.remoteEvidence.state, REMOTE_EVIDENCE.AVAILABLE);
});

test("1.5 base normalization detects URL and remote-database mismatch", () => {
  assert.equal(normalizeCloudBaseUrl(" https://demo.dexie.cloud/ "), URL_BASE);
  const same = diagnostic();
  assert.equal(same.base.url, URL_BASE);
  assert.equal(same.base.mismatch, false);
  const changedUrl = diagnostic({ persistedSyncState: completePersisted({ databaseUrl: "https://other.dexie.cloud" }) });
  assert.equal(changedUrl.base.mismatch, true);
  const changedDb = diagnostic({
    persistedSyncState: completePersisted({ remoteDbId: "remote-2" }),
    remoteDbId: "remote-1"
  });
  assert.equal(changedDb.base.mismatch, true);
  assert.equal(changedDb.base.remoteDbId, "remote-2");
  const trailingSlash = diagnostic({ databaseUrl: "https://demo.dexie.cloud/" });
  assert.equal(trailingSlash.base.mismatch, false);
});

test("2.1 errors are classified from stable fields only", () => {
  const cases = [
    [{ name: "TypeError", message: "Failed to fetch" }, DIAGNOSTIC_ERROR.NETWORK],
    [{ code: "offline" }, DIAGNOSTIC_ERROR.OFFLINE],
    [{ httpStatus: 403 }, DIAGNOSTIC_ERROR.PERMISSION],
    [{ name: "SecurityError" }, DIAGNOSTIC_ERROR.ORIGIN],
    [{ httpStatus: 401 }, DIAGNOSTIC_ERROR.SESSION],
    [{ name: "SyncError" }, DIAGNOSTIC_ERROR.SYNC],
    [{ name: "QuotaExceededError" }, DIAGNOSTIC_ERROR.STORAGE],
    [{ name: "ReadError" }, DIAGNOSTIC_ERROR.READ],
    [{ name: "MysteryError" }, DIAGNOSTIC_ERROR.UNCATEGORIZED]
  ];
  for (const [value, expected] of cases) {
    const classified = classifySyncError(value);
    assert.equal(classified.category, expected, JSON.stringify(value));
    assert.equal(typeof classified.code, "string");
  }
  assert.equal(classifySyncError(null), null);
  const raw = classifySyncError({ name: "TypeError", message: "alice@example.com otp 123456 token secret" });
  assert.equal(JSON.stringify(raw).includes("alice@example.com"), false);
  assert.equal(JSON.stringify(raw).includes("123456"), false);
});

test("2.2 redaction keeps emails, OTPs, tokens, titles and notes out of outputs", () => {
  const secrets = [
    "alice@example.com",
    "985412",
    "tok_live_secret",
    "Titre confidentiel",
    "Note privée très sensible",
    "secret-value"
  ];
  const value = diagnostic({
    user: { isLoggedIn: true, userId: "user-secret", email: secrets[0], name: secrets[3] },
    syncState: {
      status: "error",
      phase: "error",
      error: { name: "TypeError", message: `${secrets[0]} ${secrets[1]} ${secrets[2]} ${secrets[4]}` }
    },
    persistedSyncState: completePersisted({ error: secrets[5], note: secrets[4], title: secrets[3] }),
    readError: { name: "ReadError", message: secrets[4] }
  });
  const view = buildDiagnosticView(value);
  const serialized = JSON.stringify(value) + JSON.stringify(view);
  for (const secret of secrets) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(serialized.includes("user-secret"), false);
  for (const error of view.errors) {
    assert.equal(error.message.includes("alice@example.com"), false);
  }
});

test("3.1 remote evidence maps every attestation reason safely", () => {
  const expectations = [
    [baseInput(), REMOTE_EVIDENCE.AVAILABLE, null],
    [baseInput({ online: false }), REMOTE_EVIDENCE.BLOCKED, "offline"],
    [baseInput({ user: { isLoggedIn: false } }), REMOTE_EVIDENCE.BLOCKED, "unauthenticated"],
    [baseInput({ databaseUrl: null, persistedSyncState: null }), REMOTE_EVIDENCE.BLOCKED, "destination-missing"],
    [baseInput({ syncState: { status: "error", phase: "in-sync" } }), REMOTE_EVIDENCE.BLOCKED, "sync-error"],
    [baseInput({ syncState: { status: "disconnected", phase: "not-in-sync" } }), REMOTE_EVIDENCE.BLOCKED, "sync-offline"],
    [baseInput({
      syncState: { status: "connected", phase: "not-in-sync" },
      persistedSyncState: completePersisted({ initiallySynced: false })
    }), REMOTE_EVIDENCE.BLOCKED, "initial-sync-pending"],
    [baseInput({ persistedSyncState: completePersisted({ realms: ["other-user"] }) }), REMOTE_EVIDENCE.BLOCKED, "session-mismatch"],
    [baseInput({ syncState: null, persistedSyncState: null }), REMOTE_EVIDENCE.UNKNOWN, "indeterminate"]
  ];
  for (const [input, state, reason] of expectations) {
    const value = buildSyncDiagnostic(input);
    assert.equal(value.remoteEvidence.state, state, JSON.stringify(input));
    assert.equal(value.remoteEvidence.reason, reason, JSON.stringify(input));
  }
});

test("3.2 pending, failed and indeterminate evidence never concludes an empty Cloud", () => {
  const inputs = [
    baseInput({
      syncState: { status: "connected", phase: "not-in-sync" },
      persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
    }),
    baseInput({ persistedSyncState: completePersisted({ error: "boom" }) }),
    baseInput({ syncState: null, persistedSyncState: null })
  ];
  for (const input of inputs) {
    const value = buildSyncDiagnostic(input);
    const view = buildDiagnosticView(value);
    assert.equal(value.remoteEvidence.notEmpty, true);
    assert.notEqual(value.remoteEvidence.state, REMOTE_EVIDENCE.AVAILABLE);
    assert.match(view.remoteEvidenceMessage, /pas considéré comme vide/);
    assert.equal("records" in value, false);
    assert.equal("write" in value, false);
  }
});

test("3.3 a failed remote read keeps local evidence and never claims availability", () => {
  const value = diagnostic({
    localWrites: LOCAL_WRITE_STATE.LOCAL,
    readError: { name: "ReadError", message: "lecture brute" }
  });
  assert.equal(value.remoteEvidence.state, REMOTE_EVIDENCE.UNKNOWN);
  assert.equal(value.remoteEvidence.notEmpty, true);
  assert.equal(value.localWrites, LOCAL_WRITE_STATE.LOCAL);
  assert.ok(value.errors.some((entry) => entry.category === DIAGNOSTIC_ERROR.READ));
  assert.notEqual(value.localWrites, LOCAL_WRITE_STATE.SYNCED);
});

test("4.1 local commits and read errors are truthful", () => {
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.NONE, { type: "commit-local" }), LOCAL_WRITE_STATE.LOCAL);
  assert.notEqual(reduceLocalWriteStatus(LOCAL_WRITE_STATE.NONE, { type: "commit-local" }), LOCAL_WRITE_STATE.SYNCED);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.LOCAL, { type: "read-error" }), LOCAL_WRITE_STATE.ERROR);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.LOCAL, { type: "commit-error" }), LOCAL_WRITE_STATE.ERROR);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.ERROR, { type: "reset" }), LOCAL_WRITE_STATE.NONE);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.NONE, { type: "not-applicable" }), LOCAL_WRITE_STATE.NOT_APPLICABLE);
});

test("4.2 synchronization transitions require native proof", () => {
  let status = reduceLocalWriteStatus(LOCAL_WRITE_STATE.NONE, { type: "commit-local" });
  assert.equal(status, LOCAL_WRITE_STATE.LOCAL);
  assert.equal(reduceLocalWriteStatus(status, { type: "sync-state", phase: SYNC_PHASE.PULLING }), LOCAL_WRITE_STATE.PENDING);
  status = LOCAL_WRITE_STATE.PENDING;
  assert.equal(reduceLocalWriteStatus(status, { type: "sync-state", phase: SYNC_PHASE.PUSHING }), LOCAL_WRITE_STATE.PENDING);
  assert.equal(reduceLocalWriteStatus(status, {
    type: "sync-state",
    phase: SYNC_PHASE.IN_SYNC,
    initiallySynced: true
  }), LOCAL_WRITE_STATE.SYNCED);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.LOCAL, {
    type: "sync-state",
    phase: SYNC_PHASE.IN_SYNC,
    initiallySynced: false
  }), LOCAL_WRITE_STATE.INDETERMINATE);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.LOCAL, { type: "sync-error" }), LOCAL_WRITE_STATE.LOCAL);
  assert.equal(reduceLocalWriteStatus(LOCAL_WRITE_STATE.PENDING, {
    type: "sync-complete",
    attested: true
  }), LOCAL_WRITE_STATE.SYNCED);
});

test("5.1 retry predicate exposes every typed blocked reason", () => {
  const cases = [
    [buildSyncDiagnostic({ configured: false }), "not-configured"],
    [diagnostic({ user: null }), "unauthenticated"],
    [diagnostic({ authRefusal: "origin-refusal" }), "refused"],
    [diagnostic({ online: false }), "offline"],
    [diagnostic({ syncState: { status: "connected", phase: "pulling" }, persistedSyncState: null }), "in-progress"],
    [diagnostic({ persistedSyncState: completePersisted({ databaseUrl: "https://other.dexie.cloud" }) }), "indeterminate"],
    [diagnostic({ syncState: null, persistedSyncState: null }), "indeterminate"]
  ];
  for (const [value, reason] of cases) {
    const decision = canRetryInitialPull(value);
    assert.equal(decision.allowed, false, reason);
    assert.equal(decision.reason, reason, reason);
    assert.equal(typeof retryReasonLabel(decision.reason), "string");
  }
  assert.equal(canRetryInitialPull(diagnostic()).reason, "already-synced");
  const pending = diagnostic({
    syncState: { status: "connected", phase: "not-in-sync" },
    persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
  });
  assert.deepEqual(canRetryInitialPull(pending), { allowed: true, reason: null });
});

test("5.2 retry calls the native adapter exactly once and never on blocked states", async () => {
  let calls = 0;
  const adapter = { syncPull: () => { calls += 1; return Promise.resolve(); } };
  const blocked = await retryInitialPull(adapter, { isAllowed: { allowed: false, reason: "offline" } });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.reason, "offline");
  assert.equal(calls, 0);
  const completed = await retryInitialPull(adapter, { isAllowed: { allowed: true } });
  assert.equal(completed.status, "completed");
  assert.equal(calls, 1);
  const failure = await retryInitialPull({
    syncPull: () => Promise.reject({ name: "TypeError", message: "secret alice@example.com" })
  }, { isAllowed: { allowed: true } });
  assert.equal(failure.status, "failed");
  assert.equal(failure.error.category, DIAGNOSTIC_ERROR.NETWORK);
  assert.equal(JSON.stringify(failure).includes("alice@example.com"), false);
});

test("5.3 controller handles success, failure, rejection and duplicate clicks", async () => {
  let persisted = { initiallySynced: false, realms: ["user-1"] };
  let calls = 0;
  const changes = [];
  const controller = createSyncDiagnosticsController({
    readInput: () => baseInput({
      syncState: { status: "connected", phase: persisted.initiallySynced ? "in-sync" : "not-in-sync" },
      persistedSyncState: persisted
    }),
    syncPull: async () => {
      calls += 1;
      persisted = completePersisted();
    },
    onChange: (value, meta) => changes.push({ value, meta })
  });
  const success = await controller.retry();
  assert.equal(success.status, "completed");
  assert.equal(success.diagnostic.initialPull, INITIAL_PULL.COMPLETE);
  assert.equal(canRetryInitialPull(success.diagnostic).reason, "already-synced");
  assert.equal(calls, 1);
  assert.ok(changes.some((entry) => entry.meta.retrying === true));
  assert.ok(changes.some((entry) => entry.meta.retrying === false));

  let release;
  const gate = new Promise((resolveGate) => { release = resolveGate; });
  let duplicateCalls = 0;
  const duplicate = createSyncDiagnosticsController({
    readInput: () => baseInput({
      syncState: { status: "connected", phase: "not-in-sync" },
      persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
    }),
    syncPull: () => { duplicateCalls += 1; return gate; }
  });
  const first = duplicate.retry();
  const second = await duplicate.retry();
  assert.equal(second.status, "blocked");
  assert.equal(second.reason, "in-progress");
  release();
  assert.equal((await first).status, "completed");
  assert.equal(duplicateCalls, 1);

  const failed = createSyncDiagnosticsController({
    readInput: () => baseInput({
      syncState: { status: "connected", phase: "not-in-sync" },
      persistedSyncState: { initiallySynced: false, realms: ["user-1"] }
    }),
    syncPull: () => Promise.reject({ name: "TypeError", message: "Failed to fetch secret" })
  });
  const failedResult = await failed.retry();
  assert.equal(failedResult.status, "failed");
  assert.equal(failedResult.diagnostic.initialPull, INITIAL_PULL.FAILED);
  assert.notEqual(failedResult.diagnostic.remoteEvidence.state, REMOTE_EVIDENCE.AVAILABLE);
  assert.equal(failedResult.diagnostic.remoteEvidence.notEmpty, true);
  assert.equal(JSON.stringify(failedResult).includes("secret"), false);
});

test("6.2 view model exposes labelled rows, errors, retry and live status", () => {
  const view = buildDiagnosticView(diagnostic({
    syncState: { status: "error", phase: "error", error: { name: "TypeError" } }
  }), { busy: true });
  assert.equal(view.title, "Diagnostic de synchronisation");
  assert.match(view.readonly, /lecture seule/i);
  assert.deepEqual(view.rows.map((row) => row.key), [
    "session",
    "connection",
    "phase",
    "initial-pull",
    "base",
    "remote-db",
    "local-writes",
    "remote-evidence",
    "bootstrap-cause",
    "bootstrap-origin",
    "remote-message"
  ]);
  assert.equal(view.bootstrap.cause, "indeterminate");
  assert.equal(view.bootstrap.origin, "indeterminate");
  assert.ok(view.rows.every((row) => typeof row.label === "string" && typeof row.value === "string"));
  assert.ok(view.errors.some((entry) => entry.category === DIAGNOSTIC_ERROR.NETWORK));
  assert.ok(view.errors.every((entry) => entry.message.length > 0));
  assert.equal(view.retry.disabled, true);
  assert.equal(view.retry.label, "Relancer la lecture distante");
  assert.equal(typeof view.retry.reasonLabel, "string");
  assert.equal(typeof view.statusMessage, "string");
  assert.equal(view.remoteNotEmpty, true);
  for (const label of Object.values(PHASE_LABELS)) assert.equal(typeof label, "string");
});

test("2.3 and 5.4 diagnostic code has no logging, HTML rendering or mutation retry path", () => {
  const moduleSource = read("site/sync-diagnostics.js");
  assert.equal(moduleSource.includes("innerHTML"), false);
  assert.equal(/console\.(log|info|warn|error)/.test(moduleSource), false);
  const app = read("site/app.js");
  assert.equal(app.includes("innerHTML"), false);
  assert.match(app, /db\.cloud\.sync\(\{ purpose: "pull", wait: true \}\)/);
  assert.match(app, /subscribe\(cloud\.syncState\)/);
  assert.match(app, /subscribe\(cloud\.persistedSyncState\)/);
  assert.match(app, /subscribe\(cloud\.currentUser\)/);
  const nativeCall = app.match(/function nativePullAdapter[\s\S]*?\n\}/);
  assert.ok(nativeCall, "nativePullAdapter present");
  const retryPath = app.match(/async function retrySyncInitialPull[\s\S]*?\n\}/);
  assert.ok(retryPath, "retrySyncInitialPull present");
  for (const source of [nativeCall[0], retryPath[0]]) {
    assert.equal(/\blogin\b|\bimport\b|\.put\(|\.add\(|\.delete\(/.test(source), false);
  }
  const inputPath = app.match(/function readSyncDiagnosticInput[\s\S]*?\n\}/);
  assert.ok(inputPath);
  assert.match(inputPath[0], /shouldOpenSyncedDatabase/);
  assert.match(app, /localWriteStatus = reduceLocalWriteStatus\(localWriteStatus, \{ type: "commit-local" \}\)/);
  assert.match(app, /localWriteStatus = reduceLocalWriteStatus\(localWriteStatus, \{ type: "commit-error" \}\)/);
  assert.match(app, /localWriteStatus = reduceLocalWriteStatus\(localWriteStatus, \{\s*type: "sync-complete"/);
  assert.match(app, /localWriteStatus = reduceLocalWriteStatus\(localWriteStatus, \{\s*type: "read-error"/);
});

test("6.1 injected observables update session, phase, initial pull and URL", () => {
  let input = baseInput({
    user: { isLoggedIn: false },
    syncState: { status: "connecting", phase: "initial" },
    persistedSyncState: null,
    databaseUrl: URL_BASE
  });
  const controller = createSyncDiagnosticsController({ readInput: () => input });
  const first = controller.refresh();
  assert.equal(first.session, SESSION_STATE.SIGNED_OUT);
  assert.equal(first.connection, CONNECTION_STATE.CONNECTING);
  assert.equal(first.initialPull, INITIAL_PULL.PENDING);
  assert.equal(first.base.url, URL_BASE);
  input = baseInput({
    user: USER,
    syncState: { status: "connected", phase: "pulling" },
    persistedSyncState: null,
    databaseUrl: "https://other.dexie.cloud"
  });
  const second = controller.refresh();
  assert.equal(second.session, SESSION_STATE.AUTHENTICATED);
  assert.equal(second.phase, SYNC_PHASE.PULLING);
  assert.equal(second.initialPull, INITIAL_PULL.IN_PROGRESS);
  assert.equal(second.base.url, "https://other.dexie.cloud");
  input = baseInput();
  const third = controller.refresh();
  assert.equal(third.initialPull, INITIAL_PULL.COMPLETE);
  assert.notEqual(third.initialPull, second.initialPull);
});

test("5.1 workspace, URL and binding rows are allowlisted and refresh with the input", () => {
  const a = diagnostic({
    workspace: {
      type: WORKSPACE_DIAGNOSTIC_TYPE.SYNCHRONIZED,
      effectiveBase: "threadstep-ws-aaaaaaaaaaaaaaaa",
      url: URL_BASE,
      remoteDbId: "remote-1"
    },
    binding: BINDING_DIAGNOSTIC_STATE.BOUND
  });
  const b = diagnostic({
    workspace: {
      type: WORKSPACE_DIAGNOSTIC_TYPE.SYNCHRONIZED,
      effectiveBase: "threadstep-ws-bbbbbbbbbbbbbbbb",
      url: "https://other.dexie.cloud",
      remoteDbId: "remote-2"
    },
    binding: BINDING_DIAGNOSTIC_STATE.MISMATCH
  });
  const viewA = buildDiagnosticView(a);
  const viewB = buildDiagnosticView(b);
  const keysA = viewA.rows.map((row) => row.key);
  for (const key of [
    "workspace-type", "workspace-base", "workspace-url",
    "workspace-remote-db", "workspace-binding"
  ]) {
    assert.ok(keysA.includes(key), key);
  }
  const valueOf = (view, key) => view.rows.find((row) => row.key === key).value;
  assert.equal(valueOf(viewA, "workspace-base"), "threadstep-ws-aaaaaaaaaaaaaaaa");
  assert.equal(valueOf(viewA, "workspace-url"), URL_BASE);
  assert.equal(valueOf(viewB, "workspace-url"), "https://other.dexie.cloud");
  assert.match(valueOf(viewB, "workspace-binding"), /Compte différent/);
  assert.equal(a.binding, BINDING_DIAGNOSTIC_STATE.BOUND);
  assert.equal(b.binding, BINDING_DIAGNOSTIC_STATE.MISMATCH);

  const local = buildDiagnosticView(diagnostic({
    workspace: {
      type: WORKSPACE_DIAGNOSTIC_TYPE.LOCAL,
      effectiveBase: "threadstep-local"
    },
    binding: BINDING_DIAGNOSTIC_STATE.UNAUTHENTICATED
  }));
  assert.equal(valueOf(local, "workspace-type"), "Local autonome");
  assert.equal(local.rows.some((row) => row.key === "workspace-url"), false);

  const serialized = JSON.stringify([viewA, viewB, local, a, b]);
  for (const forbidden of ["user-1", "user@example.com", "otp-123", "bearer-token"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("6.3 local mode shows an inactive Cloud diagnostic and disables retry", () => {
  const value = buildSyncDiagnostic({ configured: false, localWrites: LOCAL_WRITE_STATE.NOT_APPLICABLE });
  const view = buildDiagnosticView(value);
  assert.equal(value.connection, CONNECTION_STATE.NOT_CONFIGURED);
  assert.equal(value.remoteEvidence.state, REMOTE_EVIDENCE.NOT_CONFIGURED);
  assert.match(view.connectionLabel, /non activée/i);
  assert.equal(view.retry.disabled, true);
  assert.equal(view.retry.reason, "not-configured");
});

test("6.2, 6.3, 6.4 static accessible wiring and local-mode guard", () => {
  assert.match(pkg.scripts.check, /node --check site\/sync-diagnostics\.js/);
  const html = read("site/index.html");
  assert.match(html, /id="sync-diagnostic"/);
  assert.match(html, /aria-labelledby="sync-diagnostic-title"/);
  const app = read("site/app.js");
  assert.match(app, /el\("dl", "sync-diagnostic-list"\)/);
  assert.match(app, /aria-live", "polite"/);
  assert.match(app, /type = "button"/);
  assert.match(app, /sync-diagnostic-reason/);
  assert.match(app, /function setupSyncDiagnostics[\s\S]*?if \(!syncedDatabase/);
  const css = read("site/styles.css");
  assert.match(css, /\.sync-diagnostic-retry\{[^}]*min-height:44px[^}]*min-width:44px/);
  assert.match(css, /\.sync-diagnostic-retry:focus-visible\{/);
});

test("7.2 product documentation explains the TS-034 diagnostic contract", () => {
  const guide = read("docs/product/developer-guide.md");
  const rollout = read("docs/product/dexie-cloud-rollout.md");
  for (const source of [guide, rollout]) {
    assert.match(source, /TS-034/);
    assert.match(source, /lecture seule/i);
    assert.match(source, /pull initial/i);
    assert.match(source, /relance/i);
    assert.match(source, /local.*pending.*synced/i);
  }
  const combined = guide + rollout;
  assert.equal(/alice@example\.com|tok_live|985412/.test(combined), false);
});
