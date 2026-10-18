import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATABASE_NAME,
  LOCAL_DATABASE_NAME,
  SCHEMA_VERSION
} from "../site/dexie-foundation.js";
import { hashActivationUser } from "../site/cloud-activation.js";
import { sha256Hex } from "../site/fingerprint.js";
import {
  BINDING_STATE,
  PENDING_STATE,
  WORKSPACE_REGISTRY_KEY,
  WORKSPACE_REGISTRY_VERSION,
  WORKSPACE_SELECTION_LOCAL,
  WORKSPACE_STATUS,
  WORKSPACE_TYPE,
  activationRecordForWorkspace,
  bindWorkspaceAccount,
  buildWorkspaceDiagnostic,
  emptyWorkspaceRegistry,
  evaluateAccountBinding,
  hashWorkspaceUser,
  initializeWorkspaceRegistry,
  migrateLegacyWorkspace,
  parseWorkspaceRegistry,
  pendingChangeWarning,
  pendingStatusFromMutationTables,
  planWorkspaceLogout,
  planWorkspacePurge,
  planWorkspaceResume,
  planWorkspaceSelection,
  planWorkspaceSuspension,
  readWorkspaceRegistry,
  readWorkspaceRegistryState,
  registerWorkspace,
  resolveWorkspaceStartup,
  selectWorkspaceInRegistry,
  serializeWorkspaceRegistry,
  syncWorkspaceStatus,
  workspaceDatabaseName,
  workspaceDiagnosticRows,
  workspaceUserDigestMatches,
  writeWorkspaceRegistry
} from "../site/workspace-identity.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const URL_A = "https://alpha.dexie.cloud";
const URL_B = "https://beta.dexie.cloud";
const URL_C = "https://gamma.dexie.cloud";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    has: (key) => map.has(key)
  };
}

function entry(url, status = WORKSPACE_STATUS.ACTIVE, extra = {}) {
  return {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    url,
    databaseName: workspaceDatabaseName(url),
    schemaVersion: SCHEMA_VERSION,
    status,
    ...extra
  };
}

function registryWith(...entries) {
  let registry = emptyWorkspaceRegistry();
  for (const value of entries) registry = registerWorkspace(registry, value);
  return registry;
}

test("1.1 registry round-trips an allowlisted synchronized entry", () => {
  const registry = registryWith(entry(URL_A, WORKSPACE_STATUS.ACTIVE, {
    remoteDbId: "remote-a",
    userDigest: sha256Hex("user-a")
  }));
  const selected = selectWorkspaceInRegistry(registry, URL_A);
  const parsed = parseWorkspaceRegistry(serializeWorkspaceRegistry(selected));
  assert.equal(parsed.version, WORKSPACE_REGISTRY_VERSION);
  assert.equal(parsed.selected, URL_A);
  assert.deepEqual(parsed.workspaces[URL_A], {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    url: URL_A,
    databaseName: workspaceDatabaseName(URL_A),
    schemaVersion: SCHEMA_VERSION,
    remoteDbId: "remote-a",
    userDigest: sha256Hex("user-a"),
    status: WORKSPACE_STATUS.ACTIVE
  });
});

test("1.1 malformed registries fail closed", () => {
  const valid = registryWith(entry(URL_A));
  const base = JSON.parse(serializeWorkspaceRegistry(selectWorkspaceInRegistry(valid, URL_A)));
  assert.equal(parseWorkspaceRegistry({ ...base, version: 99 }), null);
  assert.equal(parseWorkspaceRegistry({ ...base, selected: "https://not-a-url" }), null);
  assert.equal(parseWorkspaceRegistry({ ...base, selected: URL_B }), null);
  assert.equal(parseWorkspaceRegistry("{"), null);
  const invalidUrl = structuredClone(base);
  invalidUrl.workspaces[URL_A].url = "http://alpha.dexie.cloud";
  assert.equal(parseWorkspaceRegistry(invalidUrl), null);
  const invalidStatus = structuredClone(base);
  invalidStatus.workspaces[URL_A].status = "mystery";
  assert.equal(parseWorkspaceRegistry(invalidStatus), null);
  for (const key of ["email", "token", "otp", "userId"]) {
    const extra = structuredClone(base);
    extra.workspaces[URL_A][key] = "secret-value";
    assert.equal(parseWorkspaceRegistry(extra), null, key);
  }
});

test("1.1 storage stays non-synchronized and degrades safely when unavailable", () => {
  const storage = memoryStorage();
  const registry = selectWorkspaceInRegistry(registryWith(entry(URL_A)), URL_A);
  assert.equal(writeWorkspaceRegistry(storage, registry), true);
  assert.equal(storage.has(WORKSPACE_REGISTRY_KEY), true);
  assert.equal(storage.has("threadstep.document.v1"), false);
  assert.deepEqual(readWorkspaceRegistry(storage), registry);
  assert.deepEqual(readWorkspaceRegistryState(memoryStorage()).state, "absent");
  assert.deepEqual(readWorkspaceRegistryState(null).state, "unavailable");
  assert.equal(writeWorkspaceRegistry(null, registry), false);
  assert.equal(workspaceDatabaseName("not a url"), null);
});

test("1.1 a second registration reuses the recorded base name", () => {
  const original = entry(URL_A);
  const registry = registryWith(original);
  const changed = registerWorkspace(registry, {
    ...original,
    databaseName: "a-different-name",
    remoteDbId: "remote-a"
  });
  assert.equal(changed.workspaces[URL_A].databaseName, original.databaseName);
  assert.equal(changed.workspaces[URL_A].remoteDbId, "remote-a");
});

test("1.3 A/B/A routing reuses each workspace base without copy or merge", () => {
  let registry = registryWith(entry(URL_A), entry(URL_B));
  registry = selectWorkspaceInRegistry(registry, URL_A);
  const first = resolveWorkspaceStartup({ registry });
  assert.equal(first.workspace, "synced");
  assert.equal(first.databaseName, workspaceDatabaseName(URL_A));

  const selectB = planWorkspaceSelection({ registry, target: URL_B, pending: { status: PENDING_STATE.NONE } });
  assert.equal(selectB.allowed, true);
  assert.equal(selectB.databaseName, workspaceDatabaseName(URL_B));
  assert.equal(selectB.notice, null);
  const second = resolveWorkspaceStartup({ registry: selectB.registry });
  assert.equal(second.databaseName, workspaceDatabaseName(URL_B));

  const selectA = planWorkspaceSelection({ registry: selectB.registry, target: URL_A, pending: { status: PENDING_STATE.NONE } });
  const third = resolveWorkspaceStartup({ registry: selectA.registry });
  assert.equal(third.databaseName, workspaceDatabaseName(URL_A));
  for (const plan of [selectB, selectA]) {
    assert.equal(plan.copy, false);
    assert.equal(plan.merge, false);
    assert.deepEqual(plan.deletions, []);
    assert.deepEqual(plan.businessDeletes, []);
    assert.deepEqual(plan.remoteDeletes, []);
  }
  assert.deepEqual(third.operations, []);
  assert.deepEqual(third.deletedBases, []);
});

test("1.3 suspended and cancelled entries start locally and remain selectable", () => {
  const suspended = registryWith(entry(URL_A, WORKSPACE_STATUS.SUSPENDED));
  const selectedSuspended = selectWorkspaceInRegistry(suspended, URL_A);
  const startup = resolveWorkspaceStartup({ registry: selectedSuspended });
  assert.equal(startup.workspace, "local");
  assert.equal(startup.reason, WORKSPACE_STATUS.SUSPENDED);
  assert.equal(startup.databaseName, LOCAL_DATABASE_NAME);
  assert.equal(startup.entry.url, URL_A);
  assert.equal(startup.entry.databaseName, workspaceDatabaseName(URL_A));

  const cancelled = selectWorkspaceInRegistry(
    registryWith(entry(URL_B, WORKSPACE_STATUS.CANCELLED)),
    URL_B
  );
  assert.equal(resolveWorkspaceStartup({ registry: cancelled }).reason, WORKSPACE_STATUS.CANCELLED);
});

test("1.3 legacy configuration migrates without renaming a base", () => {
  const migrated = migrateLegacyWorkspace({
    config: { databaseUrl: URL_A },
    record: {
      status: WORKSPACE_STATUS.ACTIVE,
      url: URL_A,
      remoteDbId: "remote-a",
      sourceFingerprint: "a".repeat(64),
      userDigest: sha256Hex("user-a")
    },
    schemaVersion: SCHEMA_VERSION
  });
  assert.equal(migrated.selected, URL_A);
  assert.equal(migrated.workspaces[URL_A].databaseName, DATABASE_NAME);
  assert.equal(migrated.workspaces[URL_A].remoteDbId, "remote-a");
  const startup = resolveWorkspaceStartup({ registry: migrated });
  assert.equal(startup.workspace, "synced");
  assert.equal(startup.databaseName, DATABASE_NAME);
  assert.equal(startup.legacy, true);
  assert.deepEqual(startup.deletedBases, []);
});

test("1.3 an invalid registry never authorizes a purge", () => {
  const startup = resolveWorkspaceStartup({ registryInvalid: true });
  assert.equal(startup.workspace, "local");
  assert.equal(startup.reason, "registry-invalid");
  assert.equal(startup.purgeAllowed, false);
  const initialized = initializeWorkspaceRegistry({
    state: { state: "invalid", registry: null }
  });
  assert.equal(initialized.invalid, true);
  assert.equal(initialized.registry, null);
});

test("1.4 account binding covers matching, mismatch and unverified caches", () => {
  const boundEntry = { ...entry(URL_A), userDigest: hashWorkspaceUser("user-a") };
  const bound = evaluateAccountBinding({
    entry: boundEntry,
    userId: "user-a",
    authenticated: true,
    cacheHasRecords: true
  });
  assert.equal(bound.state, BINDING_STATE.BOUND);
  assert.equal(bound.businessAllowed, true);

  const mismatch = evaluateAccountBinding({
    entry: boundEntry,
    userId: "user-b",
    authenticated: true,
    cacheHasRecords: true
  });
  assert.equal(mismatch.state, BINDING_STATE.MISMATCH);
  assert.equal(mismatch.businessAllowed, false);
  assert.equal(mismatch.bind, false);

  const unverified = evaluateAccountBinding({
    entry: entry(URL_A),
    userId: "user-b",
    authenticated: true,
    cacheHasRecords: true
  });
  assert.equal(unverified.state, BINDING_STATE.UNVERIFIED);
  assert.equal(unverified.businessAllowed, false);

  const empty = evaluateAccountBinding({
    entry: entry(URL_A),
    userId: "user-b",
    authenticated: true,
    cacheHasRecords: false
  });
  assert.equal(empty.state, BINDING_STATE.UNBOUND);
  assert.equal(empty.businessAllowed, true);
  assert.equal(empty.bind, true);
  assert.equal(empty.digest, hashWorkspaceUser("user-b"));

  const cleared = evaluateAccountBinding({
    entry: entry(URL_A),
    userId: "user-c",
    authenticated: true,
    cacheHasRecords: false
  });
  assert.equal(cleared.state, BINDING_STATE.UNBOUND);
  assert.equal(cleared.businessAllowed, true);

  assert.equal(evaluateAccountBinding({
    entry: boundEntry,
    authenticated: false,
    userId: null,
    cacheHasRecords: null
  }).state, BINDING_STATE.UNAUTHENTICATED);
  assert.equal(evaluateAccountBinding({
    entry: boundEntry,
    authenticated: true,
    userId: "user-a",
    cacheHasRecords: null
  }).state, BINDING_STATE.BOUND);
  assert.equal(evaluateAccountBinding({
    entry: entry(URL_A),
    authenticated: true,
    userId: "user-a",
    cacheHasRecords: null
  }).state, BINDING_STATE.INDETERMINATE);
});

test("1.4 legacy activation digests still match the same account", () => {
  const legacyEntry = { ...entry(URL_A), userDigest: hashActivationUser("user-a") };
  assert.equal(workspaceUserDigestMatches(legacyEntry.userDigest, "user-a"), true);
  assert.equal(workspaceUserDigestMatches(legacyEntry.userDigest, "user-b"), false);
  const rebound = bindWorkspaceAccount(registryWith(legacyEntry), URL_A, "user-a");
  assert.equal(rebound.workspaces[URL_A].userDigest, hashWorkspaceUser("user-a"));
});

test("1.5 suspension is not logout and keeps destination and binding", () => {
  const registry = selectWorkspaceInRegistry(
    registryWith(entry(URL_A, WORKSPACE_STATUS.ACTIVE, { remoteDbId: "remote-a", userDigest: sha256Hex("user-a") })),
    URL_A
  );
  const plan = planWorkspaceSuspension({
    registry,
    url: URL_A,
    pending: { status: PENDING_STATE.PENDING, count: 2 }
  });
  assert.equal(plan.allowed, true);
  assert.equal(plan.nativeLogout, null);
  assert.equal(plan.registry.selected, WORKSPACE_SELECTION_LOCAL);
  assert.equal(plan.registry.workspaces[URL_A].status, WORKSPACE_STATUS.SUSPENDED);
  assert.equal(plan.registry.workspaces[URL_A].remoteDbId, "remote-a");
  assert.equal(plan.registry.workspaces[URL_A].userDigest, sha256Hex("user-a"));
  assert.deepEqual(plan.deletions, []);
  assert.deepEqual(plan.remoteDeletes, []);
  assert.match(plan.notice, /cache de l'espace suspendu/);
});

test("1.5 resume reopens the same base without another consent", () => {
  const suspended = selectWorkspaceInRegistry(
    registryWith(entry(URL_B, WORKSPACE_STATUS.SUSPENDED, { remoteDbId: "remote-b" })),
    URL_B
  );
  const plan = planWorkspaceResume({ registry: suspended, url: URL_B });
  assert.equal(plan.allowed, true);
  assert.equal(plan.registry.selected, URL_B);
  assert.equal(plan.registry.workspaces[URL_B].status, WORKSPACE_STATUS.ACTIVE);
  assert.equal(plan.databaseName, workspaceDatabaseName(URL_B));
  assert.equal(plan.consentRequired, false);
  assert.deepEqual(plan.deletions, []);
});

test("1.5 logout requires confirmation on pending or unknown changes", () => {
  const registry = selectWorkspaceInRegistry(
    registryWith(entry(URL_A, WORKSPACE_STATUS.ACTIVE, { userDigest: sha256Hex("user-a") })),
    URL_A
  );
  for (const pending of [
    { status: PENDING_STATE.PENDING, count: 3 },
    { status: PENDING_STATE.UNKNOWN, count: null }
  ]) {
    const plan = planWorkspaceLogout({ registry, url: URL_A, pending });
    assert.equal(plan.action, "confirm");
    assert.equal(plan.allowed, false);
    assert.equal(plan.nativeLogout, null);
    assert.equal(plan.backupSuggested, true);
    assert.match(plan.warning, pending.status === PENDING_STATE.PENDING
      ? /ne sont pas attestés comme transmis/
      : /indéterminé/);
  }
  const cancelled = planWorkspaceLogout({
    registry,
    url: URL_A,
    pending: { status: PENDING_STATE.PENDING, count: 1 },
    cancelled: true
  });
  assert.equal(cancelled.action, "cancel");
  assert.equal(cancelled.registry, null);
  assert.deepEqual(cancelled.businessDeletes, []);
});

test("1.5 confirmed logout uses only the forced native form and clears binding", () => {
  const registry = selectWorkspaceInRegistry(
    registryWith(entry(URL_A, WORKSPACE_STATUS.ACTIVE, { remoteDbId: "remote-a", userDigest: sha256Hex("user-a") })),
    URL_A
  );
  const plan = planWorkspaceLogout({
    registry,
    url: URL_A,
    pending: { status: PENDING_STATE.NONE, count: 0 },
    confirmed: true
  });
  assert.equal(plan.allowed, true);
  assert.deepEqual(plan.nativeLogout, { force: true });
  assert.equal(plan.registry.workspaces[URL_A].userDigest, undefined);
  assert.equal(plan.registry.workspaces[URL_A].remoteDbId, "remote-a");
  assert.equal(plan.registry.selected, URL_A);
  assert.deepEqual(plan.deletions, []);
  assert.deepEqual(plan.businessDeletes, []);
  assert.deepEqual(plan.remoteDeletes, []);
});

test("1.5 purge is blocked before confirmation and deletes only the identified base", () => {
  let registry = registryWith(
    entry(URL_A, WORKSPACE_STATUS.ACTIVE, { remoteDbId: "remote-a", userDigest: sha256Hex("user-a") }),
    entry(URL_B, WORKSPACE_STATUS.ACTIVE, { userDigest: sha256Hex("user-b") })
  );
  registry = selectWorkspaceInRegistry(registry, URL_A);
  const blocked = planWorkspacePurge({
    registry,
    target: URL_A,
    effectiveDatabaseName: workspaceDatabaseName(URL_A),
    pending: { status: PENDING_STATE.PENDING, count: 4 },
    confirmed: false
  });
  assert.equal(blocked.action, "confirm");
  assert.equal(blocked.allowed, false);
  assert.deepEqual(blocked.deletions, []);
  assert.match(blocked.warning, /perte est possible/i);

  for (const pending of [
    { status: PENDING_STATE.NONE, count: 0 },
    { status: PENDING_STATE.UNKNOWN, count: null }
  ]) {
    const plan = planWorkspacePurge({
      registry,
      target: URL_A,
      effectiveDatabaseName: workspaceDatabaseName(URL_A),
      pending,
      confirmed: true
    });
    assert.equal(plan.allowed, true);
    assert.deepEqual(plan.deletions, [workspaceDatabaseName(URL_A)]);
    assert.deepEqual(plan.businessDeletes, []);
    assert.deepEqual(plan.remoteDeletes, []);
    assert.equal(plan.registry.selected, WORKSPACE_SELECTION_LOCAL);
    assert.equal(plan.registry.workspaces[URL_A].userDigest, undefined);
    assert.equal(plan.registry.workspaces[URL_A].url, URL_A);
    assert.equal(plan.registry.workspaces[URL_A].remoteDbId, "remote-a");
    assert.equal(plan.registry.workspaces[URL_B].databaseName, workspaceDatabaseName(URL_B));
    assert.equal(plan.registry.workspaces[URL_B].userDigest, sha256Hex("user-b"));
  }
});

test("1.5 purge refuses a mismatched base, unknown workspace or unreadable registry", () => {
  const registry = registryWith(entry(URL_A));
  assert.equal(planWorkspacePurge({
    registry,
    target: URL_A,
    effectiveDatabaseName: workspaceDatabaseName(URL_B),
    pending: { status: PENDING_STATE.NONE },
    confirmed: true
  }).reason, "base-mismatch");
  assert.equal(planWorkspacePurge({
    registry,
    target: URL_C,
    effectiveDatabaseName: workspaceDatabaseName(URL_C),
    pending: { status: PENDING_STATE.NONE },
    confirmed: true
  }).reason, "unknown-workspace");
  assert.equal(planWorkspacePurge({
    registry: null,
    target: WORKSPACE_SELECTION_LOCAL,
    effectiveDatabaseName: LOCAL_DATABASE_NAME,
    confirmed: true
  }).reason, "registry-unreadable");
  assert.equal(planWorkspaceSelection({ registry: null, target: URL_A }).reason, "registry-unreadable");
});

test("1.5 purging the autonomous workspace touches no synchronized entry", () => {
  const registry = selectWorkspaceInRegistry(registryWith(entry(URL_A)), URL_A);
  const plan = planWorkspacePurge({
    registry,
    target: WORKSPACE_SELECTION_LOCAL,
    effectiveDatabaseName: LOCAL_DATABASE_NAME,
    pending: { status: PENDING_STATE.NONE },
    confirmed: true
  });
  assert.equal(plan.allowed, true);
  assert.deepEqual(plan.deletions, [LOCAL_DATABASE_NAME]);
  assert.equal(plan.registry.workspaces[URL_A].databaseName, workspaceDatabaseName(URL_A));
  assert.deepEqual(plan.businessDeletes, []);
  assert.deepEqual(plan.remoteDeletes, []);
});

test("1.5 pending-change adapter never claims absence without evidence", () => {
  assert.deepEqual(pendingStatusFromMutationTables({ mutationTables: [], counts: {} }), {
    status: PENDING_STATE.UNKNOWN,
    count: null
  });
  assert.deepEqual(pendingStatusFromMutationTables({ error: new Error("denied"), mutationTables: ["subjects_mutations"] }), {
    status: PENDING_STATE.UNKNOWN,
    count: null
  });
  assert.deepEqual(pendingStatusFromMutationTables({
    mutationTables: ["subjects_mutations", "items_mutations"],
    counts: { subjects_mutations: 2, items_mutations: 0 }
  }), { status: PENDING_STATE.PENDING, count: 2 });
  assert.deepEqual(pendingStatusFromMutationTables({
    mutationTables: ["subjects_mutations"],
    counts: { subjects_mutations: 0 }
  }), { status: PENDING_STATE.NONE, count: 0 });
  assert.match(pendingChangeWarning({ status: PENDING_STATE.PENDING, count: 2 }), /2 en attente/);
  assert.match(pendingChangeWarning({ status: PENDING_STATE.UNKNOWN }), /n'est affirmé absent/);
});

test("1.6 workspace diagnostic is allowlisted and changes with workspace and session", () => {
  const entryA = { ...entry(URL_A, WORKSPACE_STATUS.ACTIVE, { remoteDbId: "remote-a" }) };
  const diagnosticA = buildWorkspaceDiagnostic({
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    entry: entryA,
    effectiveBase: entryA.databaseName,
    url: URL_A,
    remoteDbId: "remote-a",
    session: "authenticated",
    binding: BINDING_STATE.BOUND
  });
  const diagnosticB = buildWorkspaceDiagnostic({
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    entry: entryA,
    effectiveBase: entryA.databaseName,
    url: URL_B,
    remoteDbId: "remote-b",
    session: "expired",
    binding: BINDING_STATE.MISMATCH
  });
  assert.equal(diagnosticA.url, URL_A);
  assert.equal(diagnosticB.url, URL_B);
  assert.equal(diagnosticA.session, "authenticated");
  assert.equal(diagnosticB.session, "expired");
  assert.equal(diagnosticA.binding, BINDING_STATE.BOUND);
  assert.equal(diagnosticB.binding, BINDING_STATE.MISMATCH);

  const rows = workspaceDiagnosticRows(diagnosticA);
  assert.deepEqual(rows.map((row) => row.key), [
    "workspace-type",
    "workspace-base",
    "workspace-url",
    "workspace-remote-db",
    "workspace-binding"
  ]);

  const serialized = JSON.stringify([
    diagnosticA,
    diagnosticB,
    rows,
    buildWorkspaceDiagnostic({
      type: WORKSPACE_TYPE.LOCAL,
      effectiveBase: LOCAL_DATABASE_NAME,
      session: "signed-out",
      binding: BINDING_STATE.UNAUTHENTICATED
    })
  ]);
  for (const forbidden of [
    "user-a", "user-b", "user@example.com", "123456", "bearer-token",
    "Titre privé", "Note privée", "raw error"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("2.2 registry and activation marker stay consistent without losing fields", () => {
  const registry = selectWorkspaceInRegistry(
    registryWith(entry(URL_A, WORKSPACE_STATUS.ACTIVE, { remoteDbId: "remote-a", userDigest: sha256Hex("user-a") })),
    URL_A
  );
  const record = {
    version: 1,
    status: WORKSPACE_STATUS.ACTIVE,
    url: URL_A,
    remoteDbId: "remote-a",
    sourceFingerprint: "b".repeat(64),
    userDigest: sha256Hex("user-a")
  };
  const suspended = syncWorkspaceStatus({
    registry,
    url: URL_A,
    status: WORKSPACE_STATUS.SUSPENDED,
    record
  });
  assert.equal(suspended.registry.workspaces[URL_A].status, WORKSPACE_STATUS.SUSPENDED);
  assert.equal(suspended.activationRecord.status, WORKSPACE_STATUS.SUSPENDED);
  assert.equal(suspended.activationRecord.url, URL_A);
  assert.equal(suspended.activationRecord.remoteDbId, "remote-a");
  assert.equal(suspended.activationRecord.sourceFingerprint, "b".repeat(64));
  assert.equal(suspended.activationRecord.userDigest, sha256Hex("user-a"));

  const resumed = syncWorkspaceStatus({
    registry: suspended.registry,
    url: URL_A,
    status: WORKSPACE_STATUS.ACTIVE,
    record: suspended.activationRecord
  });
  assert.equal(resumed.registry.workspaces[URL_A].status, WORKSPACE_STATUS.ACTIVE);
  assert.equal(resumed.activationRecord.status, WORKSPACE_STATUS.ACTIVE);
  assert.equal(resumed.activationRecord.remoteDbId, "remote-a");
  assert.equal(activationRecordForWorkspace({ type: WORKSPACE_TYPE.LOCAL }, record), null);
  assert.equal(syncWorkspaceStatus({ registry, url: URL_A, status: "mystery" }), null);
});

test("3.1 the workspace panel exposes labelled, non-HTML controls", () => {
  const html = read("site/index.html");
  assert.match(html, /id="workspace-panel"[^>]*aria-labelledby="workspace-panel-title"/);
  for (const id of [
    "workspace-panel-title", "workspace-status", "workspace-select", "workspace-apply",
    "workspace-suspend", "workspace-logout", "workspace-purge", "workspace-binding-status",
    "workspace-confirmation", "workspace-confirmation-title", "workspace-confirmation-scope",
    "workspace-confirmation-warning", "workspace-confirmation-cancel",
    "workspace-confirmation-continue", "workspace-backup"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<label for="workspace-select">Espace à sélectionner<\/label>/);
  assert.match(html, /Sélectionner cet espace/);
  assert.match(html, /Suspendre Cloud/);
  assert.match(html, /Se déconnecter/);
  assert.match(html, /Purger la copie locale/);
  assert.match(html, /Télécharger une sauvegarde JSON/);
  assert.match(html, /Annuler/);
  assert.doesNotMatch(html, /workspace-[^>]*innerHTML/);
});

test("3.2 the synchronized bootstrap keeps the registry base and native options", () => {
  const app = read("site/app.js");
  const source = app.slice(
    app.indexOf("function bootstrapSyncedDatabase"),
    app.indexOf("function bootstrapLocalDatabase")
  );
  assert.match(source, /const config = readCloudConfig\(\);/);
  assert.match(source, /if \(!shouldOpenSyncedDatabase\(config\)\) return null;/);
  assert.match(source, /cloudConfigureOptions\(config\.databaseUrl\)/);
  assert.match(source, /entry\.databaseName/);
  assert.match(source, /new Dexie\(databaseName, \{ addons: \[dexieCloud\] \}\)/);
  assert.doesNotMatch(source, /nameSuffix\s*:\s*false/);
  assert.match(app, /bootstrapSyncedDatabase\(workspaceEntry\)/);
});

test("3.3 startup initializes and migrates the registry without a delete", () => {
  const app = read("site/app.js");
  assert.match(app, /initializeWorkspaceRegistry\(/);
  assert.match(app, /resolveWorkspaceStartup\(/);
  assert.match(app, /writeWorkspaceRegistry\(localStorage, workspaceRegistry\)/);
  const initialization = app.slice(
    app.indexOf("const workspaceLegacyConfig"),
    app.indexOf("setupSyncDiagnostics();", app.indexOf("const workspaceLegacyConfig"))
  );
  assert.doesNotMatch(initialization, /Dexie\.delete|\.delete\(|table\.delete|cloud\.logout/);
});

test("3.4 binding is evaluated before business reads and native subscriptions", () => {
  const app = read("site/app.js");
  const auth = app.slice(
    app.indexOf("async function continueAuthenticatedWorkspace"),
    app.indexOf("async function diagnosePendingChanges")
  );
  assert.ok(auth.indexOf("refreshAccountBinding") < auth.indexOf("startBusiness"));
  assert.match(app, /async function refreshAccountBinding\(\)/);
  assert.match(app, /evaluateAccountBinding\(/);
  assert.match(app, /!bindingAllowsBusiness\(\)/);
  const refresh = app.slice(
    app.indexOf("async function refreshSyncedDocument"),
    app.indexOf("function ensureChangeChannel")
  );
  assert.match(refresh, /!bindingAllowsBusiness\(\)\) return/);
  assert.doesNotMatch(app, /readSyncedRecords\(syncedDatabase\)[\s\S]{0,40}refreshSyncedDocument/);
});

test("3.5 logout is forced only after the local warning and never deletes business data", () => {
  const app = read("site/app.js");
  assert.match(app, /syncedDatabase\.cloud\.logout\(\{ force: true \}\)/);
  const logout = app.slice(
    app.indexOf("async function executeWorkspaceLogout"),
    app.indexOf("async function requestWorkspaceLogout")
  );
  assert.match(logout, /const pending = await diagnosePendingChanges\(\);/);
  assert.ok(logout.indexOf("diagnosePendingChanges") < logout.indexOf(".cloud.logout({ force: true })"));
  assert.ok(logout.indexOf("planWorkspaceLogout") < logout.indexOf(".cloud.logout({ force: true })"));
  assert.doesNotMatch(app, /subjects\.delete\(|items\.delete\(|table\.delete\(|cloud\.delete/);
  assert.doesNotMatch(logout, /Dexie\.delete/);
});

test("3.6 purge closes the base and deletes only the planned physical name", () => {
  const app = read("site/app.js");
  const purge = app.slice(
    app.indexOf("async function executeWorkspacePurge"),
    app.indexOf("async function requestWorkspacePurge")
  );
  assert.match(purge, /db\.close\(\)/);
  assert.match(purge, /Dexie\.delete\(plan\.databaseName\)/);
  assert.match(purge, /planWorkspacePurge\(/);
  assert.doesNotMatch(purge, /table\.delete|cloud\.delete|subjects\.delete|items\.delete/);
});

test("3.7 pending warning and snapshot are wired before confirmation", () => {
  const app = read("site/app.js");
  assert.match(app, /pendingChangeWarning\(pending\)/);
  assert.match(app, /buildBusinessExport\(lastRecords, \{ inventory \}\)/);
  assert.match(app, /threadstep-workspace-backup\.json/);
  assert.match(app, /showWorkspaceConfirmation\("logout", entry, pending\)/);
  assert.match(app, /showWorkspaceConfirmation\("purge", entry, pending\)/);
  const request = app.slice(
    app.indexOf("async function requestWorkspaceLogout"),
    app.indexOf("async function executeWorkspacePurge")
  );
  assert.ok(request.indexOf("diagnosePendingChanges") < request.indexOf("executeWorkspaceLogout"));
  assert.match(request, /planWorkspaceLogout\(/);
  assert.match(request, /action === "confirm"/);
});

test("3.8 diagnostics receive workspace, session and binding categories", () => {
  const app = read("site/app.js");
  assert.match(app, /workspace: workspaceDiagnosticInput\(\)/);
  assert.match(app, /binding: accountBinding\.state/);
  assert.match(app, /buildWorkspaceDiagnostic\(\{/);
});

test("4.1 the check chain covers the new runtime module and no dependency changed", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /node --check site\/workspace-identity\.js/);
  assert.equal(pkg.dependencies.dexie, "4.4.6");
  assert.equal(pkg.dependencies["dexie-cloud-addon"], "4.4.15");
  const foundation = read("site/dexie-foundation.js");
  const version = /export const SCHEMA_VERSION = (\d+);/.exec(foundation);
  assert.ok(version);
  assert.equal(Number(version[1]), SCHEMA_VERSION);
});
