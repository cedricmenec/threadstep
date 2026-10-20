import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION } from "../site/dexie-foundation.js";
import { hashActivationUser } from "../site/cloud-activation.js";
import { sha256Hex } from "../site/fingerprint.js";
import {
  BINDING_EVIDENCE,
  BINDING_STATE,
  WORKSPACE_REGISTRY_KEY,
  WORKSPACE_STATUS,
  WORKSPACE_TYPE,
  emptyWorkspaceRegistry,
  evaluateAccountBinding,
  hashWorkspaceUser,
  mergeWorkspaceBinding,
  readWorkspaceRegistry,
  registerWorkspace,
  resolveBindingEvidence,
  syncWorkspaceStatus,
  updateWorkspaceStatus,
  workspaceDatabaseName,
  writeWorkspaceBinding,
  writeWorkspaceRegistry
} from "../site/workspace-identity.js";
import {
  BOOTSTRAP_CAUSE,
  BOOTSTRAP_EVENT,
  BOOTSTRAP_ORIGIN,
  BOOTSTRAP_TRACE_MAX_EVENTS,
  BOOTSTRAP_TRACE_STORAGE_KEY,
  classifyBootstrapCause,
  createBootstrapTrace,
  isBootstrapCause,
  parseBootstrapTrace,
  readBootstrapTrace,
  serializeBootstrapTrace,
  writeBootstrapTrace
} from "../site/bootstrap-diagnostics.js";
import {
  BINDING_DIAGNOSTIC_STATE,
  REMOTE_EVIDENCE,
  buildDiagnosticSummary,
  buildDiagnosticView,
  buildSyncDiagnostic
} from "../site/sync-diagnostics.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const URL_A = "https://alpha.dexie.cloud";
const URL_B = "https://beta.dexie.cloud";
const USER_A = "user-a-secret@example.test";
const USER_B = "user-b-secret@example.test";
const REMOTE_A = "remote-a";
const SAMPLE_EMAIL = "alice@example.test";
const SAMPLE_OTP = "123456";
const SAMPLE_TOKEN = "token-secret-value";
const SAMPLE_TITLE = "Titre métier confidentiel";
const SAMPLE_NOTE = "Note métier confidentielle";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    has: (key) => map.has(key),
    raw: (key) => map.get(key)
  };
}

function refusingStorage() {
  return {
    getItem: () => { throw new Error("SecurityError"); },
    setItem: () => { throw new Error("QuotaExceededError"); },
    removeItem: () => {}
  };
}

function silentStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: () => {},
    removeItem: () => {}
  };
}

function entry(url = URL_A, extra = {}) {
  return {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    url,
    databaseName: workspaceDatabaseName(url),
    schemaVersion: SCHEMA_VERSION,
    status: WORKSPACE_STATUS.ACTIVE,
    ...extra
  };
}

function registryWith(...entries) {
  let registry = emptyWorkspaceRegistry();
  for (const value of entries) registry = registerWorkspace(registry, value);
  return registry;
}

function attestation(overrides = {}) {
  return {
    version: 1,
    status: WORKSPACE_STATUS.ACTIVE,
    url: URL_A,
    remoteDbId: REMOTE_A,
    userDigest: hashWorkspaceUser(USER_A),
    ...overrides
  };
}

test("H1 a missing registry digest is rehydrated from a matching activation attestation", () => {
  const evidence = resolveBindingEvidence({ entry: entry(), attestation: attestation() });
  assert.equal(evidence.state, BINDING_EVIDENCE.ATTESTATION);
  assert.equal(evidence.adopt, true);
  assert.equal(evidence.userDigest, hashWorkspaceUser(USER_A));
  assert.equal(evidence.remoteDbId, REMOTE_A);

  const binding = evaluateAccountBinding({
    entry: entry(),
    userId: USER_A,
    authenticated: true,
    cacheHasRecords: true,
    attestation: attestation()
  });
  assert.equal(binding.state, BINDING_STATE.BOUND);
  assert.equal(binding.businessAllowed, true);
  assert.equal(binding.adopt, true);
  assert.equal(binding.evidence, BINDING_EVIDENCE.ATTESTATION);

  const legacyDigest = evaluateAccountBinding({
    entry: entry(),
    userId: USER_A,
    authenticated: true,
    cacheHasRecords: true,
    attestation: attestation({ userDigest: hashActivationUser(USER_A) })
  });
  assert.equal(legacyDigest.state, BINDING_STATE.BOUND);
});

test("H1 divergent attestations fail closed for URL, base and remote id", () => {
  const cases = [
    [entry(), attestation({ url: URL_B })],
    [entry(), attestation({ databaseName: "threadstep-ws-ffffffffffffffff" })],
    [entry(URL_A, { remoteDbId: REMOTE_A }), attestation({ remoteDbId: "remote-other" })]
  ];
  for (const [targetEntry, value] of cases) {
    const evidence = resolveBindingEvidence({ entry: targetEntry, attestation: value });
    assert.equal(evidence.state, BINDING_EVIDENCE.DIVERGENCE);
    assert.equal(evidence.adopt, false);
    const binding = evaluateAccountBinding({
      entry: targetEntry,
      userId: USER_A,
      authenticated: true,
      cacheHasRecords: true,
      attestation: value
    });
    assert.equal(binding.state, BINDING_STATE.UNVERIFIED);
    assert.equal(binding.businessAllowed, false);
  }
  const differentAccount = evaluateAccountBinding({
    entry: entry(),
    userId: USER_B,
    authenticated: true,
    cacheHasRecords: true,
    attestation: attestation()
  });
  assert.equal(differentAccount.state, BINDING_STATE.MISMATCH);
  assert.equal(differentAccount.businessAllowed, false);
});

test("H3 re-registration and status updates preserve remoteDbId and binding fields", () => {
  const original = registryWith(entry(URL_A, {
    remoteDbId: REMOTE_A,
    userDigest: hashWorkspaceUser(USER_A)
  }));
  const reRegistered = registerWorkspace(original, entry(URL_A));
  assert.equal(reRegistered.workspaces[URL_A].remoteDbId, REMOTE_A);
  assert.equal(reRegistered.workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));
  const suspended = updateWorkspaceStatus(reRegistered, URL_A, WORKSPACE_STATUS.SUSPENDED);
  assert.equal(suspended.workspaces[URL_A].remoteDbId, REMOTE_A);
  assert.equal(suspended.workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));
  const synced = syncWorkspaceStatus({
    registry: suspended,
    url: URL_A,
    status: WORKSPACE_STATUS.ACTIVE
  });
  assert.equal(synced.registry.workspaces[URL_A].remoteDbId, REMOTE_A);
  assert.equal(synced.registry.workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));
  assert.equal(synced.activationRecord.remoteDbId, REMOTE_A);
  assert.equal(synced.activationRecord.userDigest, hashWorkspaceUser(USER_A));
});

test("H2 a refused or unreadable binding write is reported and never attests durability", () => {
  const refused = refusingStorage();
  const result = writeWorkspaceBinding(refused, URL_A, { userDigest: hashWorkspaceUser(USER_A) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "registry-unavailable");

  const storage = memoryStorage();
  writeWorkspaceRegistry(storage, registryWith(entry(URL_A)));
  const noReadBack = writeWorkspaceBinding(silentStorage({
    [WORKSPACE_REGISTRY_KEY]: storage.raw(WORKSPACE_REGISTRY_KEY)
  }), URL_A, { userDigest: hashWorkspaceUser(USER_A), remoteDbId: REMOTE_A });
  assert.equal(noReadBack.ok, false);
  assert.equal(noReadBack.reason, "read-back-failed");

  const unknown = writeWorkspaceBinding(storage, URL_B, { userDigest: hashWorkspaceUser(USER_A) });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "workspace-unknown");
  assert.equal(readWorkspaceRegistry(storage).workspaces[URL_A].userDigest, undefined);
});

test("H5 concurrent read-modify-write merges binding and refuses divergent overwrite", () => {
  const storage = memoryStorage();
  writeWorkspaceRegistry(storage, registryWith(entry(URL_A), entry(URL_B)));
  const tabOne = readWorkspaceRegistry(storage);
  assert.equal(tabOne.workspaces[URL_A].userDigest, undefined);

  const bound = writeWorkspaceBinding(storage, URL_A, {
    userDigest: hashWorkspaceUser(USER_A),
    remoteDbId: REMOTE_A
  });
  assert.equal(bound.ok, true);
  assert.equal(bound.registry.workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));

  const emptyWrite = writeWorkspaceBinding(storage, URL_A, { userDigest: null, remoteDbId: null });
  assert.equal(emptyWrite.ok, true);
  assert.equal(emptyWrite.registry.workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));
  assert.equal(emptyWrite.registry.workspaces[URL_A].remoteDbId, REMOTE_A);

  const divergent = writeWorkspaceBinding(storage, URL_A, { userDigest: hashWorkspaceUser(USER_B) });
  assert.equal(divergent.ok, false);
  assert.equal(divergent.reason, "binding-divergence");
  assert.equal(readWorkspaceRegistry(storage).workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));

  const idempotent = writeWorkspaceBinding(storage, URL_A, {
    userDigest: hashWorkspaceUser(USER_A),
    remoteDbId: REMOTE_A
  });
  assert.equal(idempotent.ok, true);
  assert.equal(readWorkspaceRegistry(storage).workspaces[URL_A].remoteDbId, REMOTE_A);
  assert.equal(mergeWorkspaceBinding(tabOne, URL_A, {
    userDigest: hashWorkspaceUser(USER_A)
  }).workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));
});

test("H5 reload and A/B/A keep each attested binding without copying data", () => {
  const storage = memoryStorage();
  let registry = registryWith(entry(URL_A), entry(URL_B));
  registry = { ...registry, selected: URL_A };
  writeWorkspaceRegistry(storage, registry);
  assert.equal(writeWorkspaceBinding(storage, URL_A, {
    userDigest: hashWorkspaceUser(USER_A),
    remoteDbId: REMOTE_A
  }).ok, true);
  assert.equal(writeWorkspaceBinding(storage, URL_B, {
    userDigest: hashWorkspaceUser(USER_B),
    remoteDbId: "remote-b"
  }).ok, true);
  const reloaded = readWorkspaceRegistry(storage);
  assert.equal(reloaded.workspaces[URL_A].userDigest, hashWorkspaceUser(USER_A));
  assert.equal(reloaded.workspaces[URL_B].userDigest, hashWorkspaceUser(USER_B));
  assert.notEqual(reloaded.workspaces[URL_A].databaseName, reloaded.workspaces[URL_B].databaseName);
  assert.equal(reloaded.selected, URL_A);
});

test("H7 an observed remote mismatch blocks while missing fresh evidence stays readable", () => {
  const boundEntry = entry(URL_A, {
    remoteDbId: REMOTE_A,
    userDigest: hashWorkspaceUser(USER_A)
  });
  const mismatch = evaluateAccountBinding({
    entry: boundEntry,
    userId: USER_A,
    authenticated: true,
    cacheHasRecords: true,
    observedRemoteDbId: "remote-other"
  });
  assert.equal(mismatch.state, BINDING_STATE.DESTINATION_MISMATCH);
  assert.equal(mismatch.businessAllowed, false);

  const offline = evaluateAccountBinding({
    entry: boundEntry,
    userId: USER_A,
    authenticated: true,
    cacheHasRecords: true,
    observedRemoteDbId: null
  });
  assert.equal(offline.state, BINDING_STATE.BOUND);
  assert.equal(offline.businessAllowed, true);
});

test("H6/H7 unverified cache without prior attestation stays blocked", () => {
  const binding = evaluateAccountBinding({
    entry: entry(),
    userId: USER_A,
    authenticated: true,
    cacheHasRecords: true,
    attestation: null
  });
  assert.equal(binding.state, BINDING_STATE.UNVERIFIED);
  assert.equal(binding.businessAllowed, false);
  assert.equal(binding.bind, false);
});

test("2.1 trace is bounded, allowlisted and redacted", () => {
  let now = 1000;
  const trace = createBootstrapTrace({ now: () => now });
  for (let index = 0; index < BOOTSTRAP_TRACE_MAX_EVENTS + 8; index += 1) {
    now += 1;
    assert.equal(trace.add({
      code: BOOTSTRAP_EVENT.BINDING_EVALUATED,
      generation: index,
      ok: index % 2 === 0
    }), true);
  }
  const snapshot = trace.snapshot();
  assert.equal(snapshot.events.length, BOOTSTRAP_TRACE_MAX_EVENTS);
  assert.equal(snapshot.events[snapshot.events.length - 1].generation, BOOTSTRAP_TRACE_MAX_EVENTS + 7);
  for (const event of snapshot.events) {
    assert.equal(typeof event.at, "number");
    assert.ok(event.at >= 0);
  }

  assert.equal(trace.add({ code: "raw-error", message: SAMPLE_EMAIL }), false);
  assert.equal(trace.add({ code: BOOTSTRAP_EVENT.CACHE_READ, email: SAMPLE_EMAIL }), false);
  assert.equal(trace.add({ code: BOOTSTRAP_EVENT.CACHE_READ, note: SAMPLE_NOTE }), false);
  assert.equal(trace.add({ code: BOOTSTRAP_EVENT.CACHE_READ, ok: "yes" }), false);
  assert.equal(trace.add({ code: BOOTSTRAP_EVENT.CACHE_READ, count: -1 }), false);

  const serialized = serializeBootstrapTrace(snapshot);
  for (const forbidden of [
    SAMPLE_EMAIL, SAMPLE_OTP, SAMPLE_TOKEN, USER_A, URL_A, SAMPLE_TITLE, SAMPLE_NOTE
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }

  const storage = memoryStorage();
  assert.equal(writeBootstrapTrace(storage, snapshot), true);
  assert.deepEqual(readBootstrapTrace(storage), snapshot);
  assert.deepEqual(parseBootstrapTrace("not-json"), { version: 1, events: [] });
  assert.deepEqual(parseBootstrapTrace({ version: 99, events: [] }), { version: 1, events: [] });
  assert.deepEqual(readBootstrapTrace(null), { version: 1, events: [] });
  assert.equal(writeBootstrapTrace(null, snapshot), false);
  assert.equal(storage.has(BOOTSTRAP_TRACE_STORAGE_KEY), true);
});

test("2.2 classifier covers every path with stable categories and origins", () => {
  const cases = [
    [{ destinationChanged: true }, BOOTSTRAP_CAUSE.DESTINATION_CHANGE, BOOTSTRAP_ORIGIN.IDENTITY],
    [{ accountChanged: true }, BOOTSTRAP_CAUSE.ACCOUNT_CHANGE, BOOTSTRAP_ORIGIN.IDENTITY],
    [{ bindingWriteFailed: true }, BOOTSTRAP_CAUSE.BINDING_WRITE_FAILURE, BOOTSTRAP_ORIGIN.REGRESSION],
    [{ identityPending: true }, BOOTSTRAP_CAUSE.DELAYED_IDENTITY, BOOTSTRAP_ORIGIN.REGRESSION],
    [{ recovered: true }, BOOTSTRAP_CAUSE.RECOVERED_PRIOR_ATTESTATION, BOOTSTRAP_ORIGIN.REGRESSION],
    [{ attestedPrior: true }, BOOTSTRAP_CAUSE.RECOVERED_PRIOR_ATTESTATION, BOOTSTRAP_ORIGIN.REGRESSION],
    [{ firstPullCompleted: true }, BOOTSTRAP_CAUSE.FIRST_PULL_BEFORE_BINDING, BOOTSTRAP_ORIGIN.HISTORICAL],
    [{ cacheHasRecords: true }, BOOTSTRAP_CAUSE.HISTORICAL_UNATTESTED_CACHE, BOOTSTRAP_ORIGIN.HISTORICAL],
    [{ cacheHasRecords: false }, BOOTSTRAP_CAUSE.MISSING_ATTESTATION, BOOTSTRAP_ORIGIN.HISTORICAL],
    [{}, BOOTSTRAP_CAUSE.INDETERMINATE, BOOTSTRAP_ORIGIN.INDETERMINATE]
  ];
  for (const [input, cause, origin] of cases) {
    const result = classifyBootstrapCause(input);
    assert.equal(result.cause, cause);
    assert.equal(result.origin, origin);
    assert.equal(isBootstrapCause(result.cause), true);
    assert.equal(result.label.includes(SAMPLE_EMAIL), false);
    assert.equal(result.label.includes(SAMPLE_TITLE), false);
  }
  const destinationWins = classifyBootstrapCause({
    destinationChanged: true,
    accountChanged: true,
    bindingWriteFailed: true
  });
  assert.equal(destinationWins.cause, BOOTSTRAP_CAUSE.DESTINATION_CHANGE);
});

test("2.3 diagnostics exposes binding/bootstrap separately and never claims convergence", () => {
  const classification = classifyBootstrapCause({ identityPending: true });
  const input = {
    configured: true,
    databaseUrl: URL_A,
    online: true,
    user: { isLoggedIn: true, userId: USER_A },
    syncState: { status: "connected", phase: "in-sync" },
    persistedSyncState: {
      initiallySynced: true,
      remoteDbId: REMOTE_A,
      serverRevision: 7,
      realms: [USER_A],
      databaseUrl: URL_A
    },
    workspace: {
      type: "synchronized",
      effectiveBase: workspaceDatabaseName(URL_A),
      url: URL_A,
      remoteDbId: REMOTE_A
    },
    binding: BINDING_DIAGNOSTIC_STATE.BOUND,
    bootstrap: classification
  };
  const diagnostic = buildSyncDiagnostic(input);
  assert.equal(diagnostic.bootstrap.cause, BOOTSTRAP_CAUSE.DELAYED_IDENTITY);
  assert.equal(diagnostic.remoteEvidence.state, REMOTE_EVIDENCE.AVAILABLE);
  assert.notDeepEqual(diagnostic.bootstrap, diagnostic.remoteEvidence);
  const view = buildDiagnosticView(diagnostic);
  const byKey = (key) => view.rows.find((row) => row.key === key);
  assert.equal(byKey("bootstrap-cause").value, classification.label);
  assert.equal(byKey("bootstrap-origin").value, classification.originLabel);
  assert.equal(byKey("remote-evidence").value, "Synchronisation initiale attestée");
  const summary = buildDiagnosticSummary(diagnostic).text;
  assert.match(summary, /Liaison\/bootstrap/);
  for (const forbidden of [
    "convergence métier", "convergence inter-appareils", "présents sur un autre appareil",
    "propagé sur un autre appareil", SAMPLE_EMAIL, SAMPLE_OTP, SAMPLE_TOKEN
  ]) {
    assert.equal(summary.includes(forbidden), false, forbidden);
  }
  const sanitized = buildSyncDiagnostic({
    ...input,
    bootstrap: { cause: SAMPLE_EMAIL, origin: SAMPLE_TITLE, label: SAMPLE_NOTE }
  });
  assert.equal(sanitized.bootstrap.cause, BOOTSTRAP_CAUSE.INDETERMINATE);
  assert.equal(sanitized.bootstrap.origin, BOOTSTRAP_ORIGIN.INDETERMINATE);
  assert.equal(JSON.stringify(sanitized).includes(SAMPLE_EMAIL), false);
});

test("3.1-3.6 app.js records bootstrap, orders binding before reads and never auto-recovers", () => {
  const app = read("site/app.js");
  assert.match(app, /BOOTSTRAP_EVENT\.CONFIGURATION/);
  assert.match(app, /BOOTSTRAP_EVENT\.REGISTRY_READ/);
  assert.match(app, /BOOTSTRAP_EVENT\.BASE_OPEN/);
  assert.match(app, /BOOTSTRAP_EVENT\.SESSION_RESTORED/);
  assert.match(app, /BOOTSTRAP_EVENT\.IDENTITY_OBSERVED/);
  assert.match(app, /BOOTSTRAP_EVENT\.BINDING_EVALUATED/);
  assert.match(app, /BOOTSTRAP_EVENT\.CACHE_READ/);
  assert.match(app, /BOOTSTRAP_EVENT\.BUSINESS_READ/);
  assert.match(app, /BOOTSTRAP_EVENT\.INITIAL_PULL/);
  assert.match(app, /BOOTSTRAP_EVENT\.REMOTE_EVIDENCE/);
  assert.match(app, /bootstrap: currentBootstrapClassification\(\)/);
  assert.match(app, /function currentBootstrapClassification\(\)/);
  const auth = app.slice(
    app.indexOf("async function continueAuthenticatedWorkspace"),
    app.indexOf("async function diagnosePendingChanges")
  );
  assert.ok(auth.indexOf("refreshAccountBinding") < auth.indexOf("startBusiness"));
  assert.match(app, /const generation = \+\+bindingGeneration/);
  assert.match(app, /if \(generation !== bindingGeneration\) return accountBinding/);
  assert.match(app, /writeWorkspaceBinding\(localStorage/);
  assert.doesNotMatch(app, /if \(written\.ok\)[\s\S]{0,200}location\.reload/);
  const subscriptions = app.slice(
    app.indexOf("function setupSyncDiagnostics"),
    app.indexOf("async function retrySyncInitialPull")
  );
  assert.match(subscriptions, /subscribe\(cloud\.persistedSyncState\)/);
  assert.match(subscriptions, /subscribe\(cloud\.currentUser\)/);
  assert.match(subscriptions, /refreshAccountBinding\(\)/);
  const bootstrapStart = app.lastIndexOf("bootstrapTrace = createBootstrapTrace()");
  const bootstrap = app.slice(
    bootstrapStart,
    app.indexOf("setupSyncDiagnostics();", bootstrapStart)
  );
  assert.doesNotMatch(bootstrap, /requestWorkspaceRecovery|showWorkspaceConfirmation\("recover"|Dexie\.delete|\.delete\(/);
  const recoveryRequest = app.slice(
    app.indexOf("async function requestWorkspaceRecovery"),
    app.indexOf("async function requestWorkspacePurge")
  );
  assert.match(recoveryRequest, /accountBinding\.state !== BINDING_STATE\.UNVERIFIED/);
  assert.match(recoveryRequest, /showWorkspaceConfirmation\("recover"/);
  assert.match(recoveryRequest, /cloudRecoveryPlan/);
});

test("4.2 architecture documents the regression matrix and investigation rules", () => {
  const architecture = read("docs/architecture.md");
  for (const marker of [
    "Matrice de régression TS-045",
    "Profil neuf",
    "Profil historique",
    "Android et laptop",
    "Local vers Cloud",
    "Cloud vers local",
    "A/B/A",
    "Compte ou URL",
    "Rechargement",
    "Onglets concurrents",
    "Hors ligne",
    "Mutations en attente",
    "Session expirée",
    "Trace expurgée",
    "convergence métier"
  ]) {
    assert.match(architecture, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), marker);
  }
});
