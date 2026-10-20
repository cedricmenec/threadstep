import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  BINDING_DIAGNOSTIC_STATE,
  buildDiagnosticSummary,
  buildDiagnosticView,
  buildSyncDiagnostic
} from "../site/sync-diagnostics.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "site/app.js"), "utf8");

// Execute the actual app handlers with isolated, read-only in-memory stubs.
// The test never opens a Dexie database or changes the real browser profile.
function isolatedHandler(start, end, context) {
  const first = app.indexOf(start);
  const last = app.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, "handler boundaries are present");
  vm.runInNewContext(app.slice(first, last), context);
}

test("TS-048 a started workspace retries an interrupted project load, but not a completed one", async () => {
  let reads = 0;
  const state = {
    businessStarted: true,
    documentLoaded: false,
    businessAllowed: () => true,
    requiresAuthentication: () => true,
    bindingAllowsBusiness: () => true,
    refreshSyncedDocument: () => { reads += 1; return Promise.resolve(); }
  };
  isolatedHandler("function startBusiness() {", "function setupAuthentication() {", state);
  state.startBusiness();
  assert.equal(reads, 1, "a previous start must not prevent recovery");
  state.documentLoaded = true;
  state.startBusiness();
  assert.equal(reads, 1, "a fully rendered workspace is not unnecessarily re-read");
});

test("TS-048 a binding block invalidates the previous start without deleting IndexedDB", () => {
  let cleared = 0;
  const state = {
    businessStarted: true,
    documentLoaded: true,
    cloudWriteBlocked: false,
    documentState: { subjects: [1] },
    lastRecords: { subjects: [1] },
    subjectForm: { hidden: true },
    subjectsEl: { replaceChildren: () => { cleared += 1; } },
    emptyDocument: () => ({ subjects: [] }),
    emptyRecords: () => ({ subjects: [] }),
    applyBusinessVisibility: () => {}
  };
  isolatedHandler("function clearBusinessForBindingBlock() {", "async function refreshAccountBinding() {", state);
  state.clearBusinessForBindingBlock();
  assert.equal(state.businessStarted, false);
  assert.equal(state.documentLoaded, false);
  assert.equal(state.cloudWriteBlocked, true);
  assert.equal(cleared, 1);
  assert.doesNotMatch(app.slice(app.indexOf("function clearBusinessForBindingBlock()"), app.indexOf("async function refreshAccountBinding()")), /\.delete\(|\.clear\(|Dexie\.delete/);
});

test("TS-048 a native identity event restarts projects after trust returns, without new OTP", async () => {
  const entry = { url: "https://example.dexie.cloud", databaseName: "threadstep-recovery-test" };
  const allowed = { state: "bound", businessAllowed: true, userDigest: "digest-test", adopt: false, bind: false };
  const blocked = { state: "unverified", businessAllowed: false, adopt: false, bind: false };
  let resumeCount = 0;
  let blocks = 0;
  const state = {
    bindingGeneration: 0,
    bindingCacheHasRecords: null,
    bindingIdentityPending: false,
    bindingWriteFailed: false,
    accountBinding: blocked,
    workspaceEntry: entry,
    authState: { status: "authenticated" },
    AUTH_STATUS: { AUTHENTICATED: "authenticated" },
    BINDING_STATE: {
      MISMATCH: "mismatch", DESTINATION_MISMATCH: "destination-mismatch",
      UNVERIFIED: "unverified", INDETERMINATE: "indeterminate"
    },
    BOOTSTRAP_EVENT: { IDENTITY_OBSERVED: "identity", CACHE_READ: "cache", BINDING_EVALUATED: "binding" },
    selectedSyncedEntry: () => entry,
    syncedDatabase: { cloud: {
      currentUser: { value: { userId: "user-a" } },
      persistedSyncState: { value: { remoteDbId: "remote-a" } }
    } },
    observableValue: (observable) => observable?.value,
    readCacheHasBusinessRecords: async () => true,
    activationAttestationFor: () => null,
    evaluateAccountBinding: () => allowed,
    recordBootstrap: () => {},
    renderWorkspacePanel: () => {},
    renderActivationPanel: () => {},
    applyBusinessVisibility: () => {},
    renderSyncDiagnostic: () => {},
    clearBusinessForBindingBlock: () => { blocks += 1; },
    startBusiness: () => { resumeCount += 1; }
  };
  isolatedHandler("async function refreshAccountBinding() {", "async function continueAuthenticatedWorkspace() {", state);
  await state.refreshAccountBinding();
  assert.equal(resumeCount, 1);
  assert.equal(blocks, 0);
  state.evaluateAccountBinding = () => blocked;
  await state.refreshAccountBinding();
  assert.equal(resumeCount, 1, "access loss never starts a read");
  assert.equal(blocks, 1, "unverified data stays masked");
  state.evaluateAccountBinding = () => allowed;
  await state.refreshAccountBinding();
  assert.equal(resumeCount, 2, "native recovery resumes without a new authentication event");
});

test("TS-048 a stale asynchronous read cannot render projects after account identity changes", async () => {
  const db = {};
  let releaseRead;
  let releaseReplay;
  let rendered = 0;
  let reads = 0;
  const state = {
    syncedDatabase: db,
    accountBinding: { userDigest: "user-a", businessAllowed: true },
    businessStarted: true,
    documentLoaded: false,
    cloudReadPending: null,
    cloudReadReplayRequested: false,
    pendingCloudWrites: Promise.resolve(),
    syncReadError: null,
    cloudWriteBlocked: false,
    businessAllowed: () => state.accountBinding.businessAllowed,
    bindingAllowsBusiness: () => state.accountBinding.businessAllowed,
    readSyncedWorkspace: () => {
      reads += 1;
      if (reads === 1) return new Promise((resolve) => { releaseRead = resolve; });
      if (reads === 2) return new Promise((resolve) => { releaseReplay = resolve; });
      return Promise.resolve({ code: "ok", records: { subjects: [], items: [] } });
    },
    recordsToDocument: (records) => records,
    read: null,
    BOOTSTRAP_EVENT: { BUSINESS_READ: "business" },
    recordBootstrap: () => {},
    clearRecovery: () => {},
    reloadMetadataPreference: async () => {},
    render: () => { rendered += 1; },
    applyBusinessVisibility: () => {},
    renderSyncDiagnostic: () => {},
    notify: () => {},
    notifyError: () => {},
    enterRecoveryMode: () => {},
    READ_FAILURE: { INDETERMINATE: "indeterminate", PROJECTION_INVALID: "projection-invalid" }
  };
  isolatedHandler("async function refreshSyncedDocument() {", "function ensureChangeChannel() {", state);
  const pending = state.refreshSyncedDocument();
  // vm promises can be scheduled across realms; let the async read reach its first await.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof releaseRead, "function");
  state.accountBinding = { userDigest: "user-b", businessAllowed: true };
  const overlapping = state.refreshSyncedDocument();
  releaseRead({ code: "ok", records: { subjects: [1], items: [2] } });
  await pending;
  await overlapping;
  assert.equal(rendered, 0, "a read for account A cannot draw under account B");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2, "concurrent resume requests coalesce into one replay");
  assert.equal(typeof releaseReplay, "function");
  releaseReplay({ code: "ok", records: { subjects: [3], items: [4] } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, 1, "the replay loads projects for the current account");
});

test("TS-048 bound account never gets a false 'masked data' bootstrap diagnosis", () => {
  const input = {
    configured: true,
    databaseUrl: "https://example.dexie.cloud",
    online: true,
    user: { userId: "user-a", isLoggedIn: true },
    syncState: { status: "connected", phase: "in-sync" },
    persistedSyncState: {
      initiallySynced: true,
      databaseUrl: "https://example.dexie.cloud",
      remoteDbId: "remote-a",
      serverRevision: 1
    },
    workspace: { type: "synchronized", effectiveBase: "threadstep-recovery-test" },
    binding: BINDING_DIAGNOSTIC_STATE.BOUND
  };
  const view = buildDiagnosticView(buildSyncDiagnostic(input));
  assert.equal(view.rows.some((row) => row.key === "bootstrap-cause"), false);
  assert.doesNotMatch(buildDiagnosticSummary(buildSyncDiagnostic(input)).text, /Cause indéterminée : données masquées/);
  const blocked = buildDiagnosticView(buildSyncDiagnostic({
    ...input, binding: BINDING_DIAGNOSTIC_STATE.UNVERIFIED
  }));
  assert.equal(blocked.rows.some((row) => row.key === "bootstrap-cause"), true);
});
