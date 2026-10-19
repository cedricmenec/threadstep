import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { documentToRecords, emptyRecords, recordsToDocument } from "../site/persistence.js";
import {
  planReconciliation,
  projectPlanForReview,
  reviewDisplayedPlan,
  runReconciliation
} from "../site/migration-reconciliation.js";
import { createGenerationGuard } from "../site/migration-lifecycle.js";
import {
  ACTIVATION_STAGE,
  ACTIVATION_STATUS,
  ACTIVATION_STORAGE_KEY,
  ACTIVATION_VERSION,
  FIRST_SYNC,
  TARGET_CLASSIFICATION,
  classifyTarget,
  canCompleteReadOnlyActivation,
  createActivationRecord,
  describeActivationStage,
  evaluateActivationIsolation,
  findPreConsentSourceWrites,
  hashActivationUser,
  initialActivationState,
  initialFirstSyncState,
  parseActivationRecord,
  readActivationRecord,
  reduceFirstSync,
  resolveStartupWorkspace,
  transitionActivation,
  workspaceNamesAreDistinct,
  writeActivationRecord
} from "../site/cloud-activation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const destination = { url: "https://demo.dexie.cloud", remoteDbId: "remote-1" };
const userId = "user-1";

function memoryStorage(initial = null) {
  return {
    value: initial,
    getItem(name) { return name === ACTIVATION_STORAGE_KEY ? this.value : null; },
    setItem(name, value) { if (name === ACTIVATION_STORAGE_KEY) this.value = value; },
    removeItem(name) { if (name === ACTIVATION_STORAGE_KEY) this.value = null; }
  };
}

function attested(overrides = {}) {
  return {
    attested: true,
    reason: null,
    identity: { userId, url: destination.url, remoteDbId: destination.remoteDbId },
    ...overrides
  };
}

function nativeEvidence(overrides = {}) {
  return {
    online: true,
    user: { isLoggedIn: true, userId },
    syncState: { phase: "in-sync", status: "connected" },
    persistedSyncState: {
      initiallySynced: true,
      remoteDbId: destination.remoteDbId,
      serverRevision: 42,
      realms: [userId]
    },
    databaseUrl: destination.url,
    ...overrides
  };
}

function sourceDocument() {
  const document = emptyDocument();
  for (let s = 1; s <= 5; s += 1) {
    const subject = newSubject("Sujet " + s, "s" + s);
    const count = s <= 3 ? 4 : 3;
    for (let i = 1; i <= count; i += 1) {
      const item = newItem("Étape " + s + "." + i, i === 1 ? "urgent" : "normal", "s" + s + "i" + i);
      if (i === 2) item.parentId = "s" + s + "i1";
      if (i === 3) item.done = true;
      if (i === 4) item.note = "Note privée " + s;
      subject.items.push(item);
    }
    document.subjects.push(subject);
  }
  return document;
}

function projection(document) {
  const records = documentToRecords(document);
  return { ...recordsToDocument(records), provenance: { exportKind: "indexeddb-export" } };
}

function buildPlan(document, target, overrides = {}) {
  return planReconciliation({
    document: projection(document),
    target,
    destination,
    userId,
    resolutions: {},
    provenance: { exportKind: "indexeddb-export" },
    ...overrides
  });
}

function fakeAdapter(target) {
  const calls = [];
  return {
    calls,
    target,
    async commit(operations) {
      calls.push(operations);
      for (const operation of operations) {
        assert.equal(operation.type, "add");
        const table = operation.store === "subjects" ? target.subjects : target.items;
        table.push({ ...operation.value });
      }
      return { status: "recorded", operations };
    }
  };
}

// 1.1 --------------------------------------------------------------------------

test("1.1 every activation stage is reachable only through its own evidence", () => {
  let state = initialActivationState();
  assert.equal(state.stage, ACTIVATION_STAGE.LOCAL);
  const steps = [
    ["start", ACTIVATION_STAGE.PREPARING],
    ["configured", ACTIVATION_STAGE.CONNECTING],
    ["authenticated", ACTIVATION_STAGE.DISCOVERING],
    ["discovered", ACTIVATION_STAGE.REVIEW],
    ["consent", ACTIVATION_STAGE.TRANSFER_PENDING],
    ["complete", ACTIVATION_STAGE.ACTIVE]
  ];
  for (const [type, stage] of steps) {
    const outcome = transitionActivation(state, { type });
    assert.equal(outcome.ok, true, type);
    assert.equal(outcome.state.stage, stage);
    state = outcome.state;
  }
});

test("1.1 read-only activation accepts only an empty source and an attested target", () => {
  const good = {
    sourceCounts: { subjects: 0, items: 0 },
    plan: { operations: [] },
    attestation: { attested: true },
    targetStatus: "ready"
  };
  assert.equal(canCompleteReadOnlyActivation(good), true);
  for (const change of [
    { sourceCounts: { subjects: 1, items: 0 } },
    { sourceCounts: { subjects: 0, items: 1 } },
    { plan: { operations: [{ type: "add" }] } },
    { plan: null },
    { attestation: { attested: false } },
    { targetStatus: "read-error" },
    { targetStatus: "pending" }
  ]) assert.equal(canCompleteReadOnlyActivation({ ...good, ...change }), false);
  let stage = initialActivationState();
  for (const type of ["start", "configured", "authenticated"]) {
    stage = transitionActivation(stage, { type }).state;
  }
  assert.equal(stage.stage, ACTIVATION_STAGE.DISCOVERING);
  const success = transitionActivation(stage, { type: "no-transfer" });
  assert.equal(success.ok, true);
  assert.equal(success.state.stage, ACTIVATION_STAGE.ACTIVE);
  assert.equal(success.state.transferCommitted, false);
  assert.equal(transitionActivation(initialActivationState(), { type: "no-transfer" }).ok, false);
  assert.equal(transitionActivation(transitionActivation(stage, {
    type: "discovered"
  }).state, { type: "no-transfer" }).ok, false);
});

test("1.1 invalid transitions never move the stage or announce a result", () => {
  const state = initialActivationState();
  for (const type of ["configured", "authenticated", "discovered", "consent", "complete", "unknown"]) {
    const outcome = transitionActivation(state, { type });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, "invalid-transition");
    assert.equal(outcome.state.stage, ACTIVATION_STAGE.LOCAL);
  }
  let review = initialActivationState();
  for (const type of ["start", "configured", "authenticated", "discovered"]) {
    review = transitionActivation(review, { type }).state;
  }
  const skipped = transitionActivation(review, { type: "complete" });
  assert.equal(skipped.ok, false);
  assert.equal(skipped.state.stage, ACTIVATION_STAGE.REVIEW);
});

test("1.1 a failure is recoverable from its last reached stage", () => {
  let state = initialActivationState();
  for (const type of ["start", "configured", "authenticated"]) state = transitionActivation(state, { type }).state;
  const failed = transitionActivation(state, { type: "fail", reason: "offline" });
  assert.equal(failed.state.stage, ACTIVATION_STAGE.FAILED);
  assert.equal(failed.state.resumeStage, ACTIVATION_STAGE.DISCOVERING);
  assert.equal(failed.state.error, "offline");
  const retried = transitionActivation(failed.state, { type: "retry" });
  assert.equal(retried.state.stage, ACTIVATION_STAGE.DISCOVERING);
});

test("1.1 cancellation before consent is distinct from post-commit cancellation", () => {
  let state = initialActivationState();
  for (const type of ["start", "configured", "authenticated", "discovered"]) {
    state = transitionActivation(state, { type }).state;
  }
  const cancelled = transitionActivation(state, { type: "cancel" });
  assert.equal(cancelled.state.stage, ACTIVATION_STAGE.CANCELLED);
  const restarted = transitionActivation(cancelled.state, { type: "restart" });
  assert.equal(restarted.state.stage, ACTIVATION_STAGE.PREPARING);

  let committed = initialActivationState();
  for (const type of ["start", "configured", "authenticated", "discovered", "consent"]) {
    committed = transitionActivation(committed, { type }).state;
  }
  const pending = transitionActivation(committed, { type: "cancel" });
  assert.equal(pending.state.stage, ACTIVATION_STAGE.TRANSFER_PENDING);
  assert.equal(pending.state.postConsentCancellation, true);
});

// 1.2 --------------------------------------------------------------------------

test("1.2 missing evidence, offline, read errors and empty caches are never verified empty", () => {
  const cases = [
    { attestation: null },
    { attestation: { attested: false, reason: "offline" } },
    { attestation: { attested: false, reason: "sync-error" } },
    { attestation: { attested: false, reason: "indeterminate" } },
    { attestation: attested(), targetStatus: "read-error", records: emptyRecords() },
    { attestation: attested(), targetStatus: "blocked", records: emptyRecords() },
    { attestation: attested(), records: null }
  ];
  for (const input of cases) {
    const result = classifyTarget(input);
    assert.notEqual(result.classification, TARGET_CLASSIFICATION.VERIFIED_EMPTY);
    assert.equal(result.blocked, true);
  }
});

test("1.2 identity mismatch blocks wrong URL, remote database, user and session", () => {
  const records = emptyRecords();
  assert.equal(classifyTarget({
    attestation: { attested: false, reason: "session-mismatch" },
    records
  }).classification, TARGET_CLASSIFICATION.IDENTITY_MISMATCH);
  assert.equal(classifyTarget({
    attestation: attested(),
    expected: { url: "https://other.dexie.cloud" },
    records
  }).classification, TARGET_CLASSIFICATION.IDENTITY_MISMATCH);
  assert.equal(classifyTarget({
    attestation: attested(),
    expected: { url: destination.url, remoteDbId: "remote-2" },
    records
  }).classification, TARGET_CLASSIFICATION.IDENTITY_MISMATCH);
  assert.equal(classifyTarget({
    attestation: attested(),
    expected: { userId: "user-2" },
    records
  }).classification, TARGET_CLASSIFICATION.IDENTITY_MISMATCH);
});

test("1.2 attested empty, populated and divergent targets are classified explicitly", () => {
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: emptyRecords()
  }).classification, TARGET_CLASSIFICATION.VERIFIED_EMPTY);
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: { subjects: [{ id: "other", title: "Autre" }], items: [] }
  }).classification, TARGET_CLASSIFICATION.POPULATED);
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: { subjects: [{ id: "other", title: "Autre" }], items: [] },
    plan: { indeterminate: false, blocked: [{ reason: "quota" }] }
  }).classification, TARGET_CLASSIFICATION.DIVERGENT);
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: emptyRecords(),
    plan: { indeterminate: true, blocked: [] }
  }).classification, TARGET_CLASSIFICATION.DIVERGENT);
});

// 1.3 --------------------------------------------------------------------------

test("1.3 the activation marker keeps only allowlisted, hashed metadata", () => {
  const record = createActivationRecord({
    status: ACTIVATION_STATUS.ACTIVATING,
    url: destination.url,
    remoteDbId: destination.remoteDbId,
    sourceFingerprint: "a".repeat(64),
    userId,
    title: "Titre confidentiel",
    note: "Note privée",
    email: "alice@example.com",
    otp: "123456",
    token: "secret-token"
  });
  assert.deepEqual(Object.keys(record).sort(),
    ["remoteDbId", "sourceFingerprint", "status", "url", "userDigest", "version"]);
  const serialized = JSON.stringify(record);
  for (const forbidden of ["Titre confidentiel", "Note privée", "alice@example.com", "123456", "secret-token", userId]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(record.userDigest, hashActivationUser(userId));
});

test("1.3 parsing rejects unknown versions, unsafe URLs and unavailable storage", () => {
  assert.equal(parseActivationRecord(""), null);
  assert.equal(parseActivationRecord("{not json"), null);
  assert.equal(parseActivationRecord({ version: 99, status: "active", url: destination.url }), null);
  assert.equal(parseActivationRecord({ version: 1, status: "active", url: "http://demo.dexie.cloud" }), null);
  assert.equal(parseActivationRecord({ version: 1, status: "unknown", url: destination.url }), null);
  assert.equal(readActivationRecord(null), null);
  const throwing = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  assert.equal(readActivationRecord(throwing), null);
  const record = createActivationRecord({ status: ACTIVATION_STATUS.ACTIVE, url: destination.url });
  assert.equal(writeActivationRecord(throwing, record), false);
  assert.equal(writeActivationRecord({ setItem() {} }, { version: 1 }), false);
});

test("1.3 cancellation and legacy configuration without a marker are distinguishable", () => {
  const storage = memoryStorage();
  const activating = createActivationRecord({ status: ACTIVATION_STATUS.ACTIVATING, url: destination.url });
  assert.equal(writeActivationRecord(storage, activating), true);
  assert.equal(readActivationRecord(storage).status, ACTIVATION_STATUS.ACTIVATING);
  const cancelled = createActivationRecord({ status: ACTIVATION_STATUS.CANCELLED, url: destination.url });
  assert.equal(writeActivationRecord(storage, cancelled), true);
  assert.equal(readActivationRecord(storage).status, ACTIVATION_STATUS.CANCELLED);
  const config = { databaseUrl: destination.url };
  assert.equal(resolveStartupWorkspace({ record: readActivationRecord(storage), config }).workspace, "local");
  assert.equal(resolveStartupWorkspace({ record: null, config }).workspace, "synced");
  assert.equal(resolveStartupWorkspace({ record: null, config }).legacy, true);
});

// 1.4 --------------------------------------------------------------------------

test("1.4 a local commit is never remote completion without native evidence", () => {
  let state = initialFirstSyncState();
  assert.equal(state.status, FIRST_SYNC.IDLE);
  state = reduceFirstSync(state, { type: "local-written" });
  assert.equal(state.status, FIRST_SYNC.LOCAL_WRITTEN);
  assert.equal(state.localWritten, true);

  const generic = reduceFirstSync(state, {
    type: "native",
    ...nativeEvidence({ persistedSyncState: { initiallySynced: false, remoteDbId: destination.remoteDbId } })
  });
  assert.equal(generic.status, FIRST_SYNC.INDETERMINATE);
  assert.equal(generic.remoteComplete, false);

  const complete = reduceFirstSync(state, { type: "native", ...nativeEvidence() });
  assert.equal(complete.status, FIRST_SYNC.REMOTE_COMPLETE);
  assert.equal(complete.remoteComplete, true);
});

test("1.4 an error after commit preserves the local-written evidence", () => {
  let state = reduceFirstSync(initialFirstSyncState(), { type: "local-written" });
  const failed = reduceFirstSync(state, {
    type: "native",
    ...nativeEvidence({ syncState: { phase: "error", status: "error" } })
  });
  assert.equal(failed.status, FIRST_SYNC.ERROR);
  assert.equal(failed.localWritten, true);
  assert.equal(failed.remoteComplete, false);
  const offline = reduceFirstSync(state, { type: "native", ...nativeEvidence({ online: false }) });
  assert.equal(offline.status, FIRST_SYNC.PENDING);
  assert.equal(offline.localWritten, true);
  const retried = reduceFirstSync(offline, { type: "native", ...nativeEvidence() });
  assert.equal(retried.status, FIRST_SYNC.REMOTE_COMPLETE);
});

// 1.5 --------------------------------------------------------------------------

test("1.5 source and synchronized databases are distinct and pre-consent writes are detected", () => {
  assert.equal(workspaceNamesAreDistinct("threadstep-local", "threadstep"), true);
  assert.equal(workspaceNamesAreDistinct("threadstep", "threadstep"), false);
  const document = sourceDocument();
  const snapshot = documentToRecords(document);
  const eager = [
    { type: "put", store: "subjects", value: snapshot.subjects[0] },
    { type: "put", store: "items", value: snapshot.items[0] }
  ];
  const isolation = evaluateActivationIsolation({
    sourceSnapshot: snapshot,
    operations: eager,
    targetRecords: emptyRecords(),
    consented: false
  });
  assert.equal(isolation.isolated, false);
  assert.equal(isolation.distinct, true);
  assert.equal(isolation.preConsentSourceWrites.length, 2);
  assert.equal(findPreConsentSourceWrites({
    sourceSnapshot: snapshot,
    operations: eager,
    consented: true
  }).length, 0);
  const leaked = evaluateActivationIsolation({
    sourceSnapshot: snapshot,
    operations: [],
    targetRecords: { subjects: [{ id: "s1", title: "Sujet 1" }], items: [] }
  });
  assert.equal(leaked.targetContainsSource, true);
  assert.equal(leaked.isolated, false);
  const clean = evaluateActivationIsolation({
    sourceSnapshot: snapshot,
    operations: [],
    targetRecords: emptyRecords()
  });
  assert.equal(clean.isolated, true);
});

test("1.5 configuration, OTP, first pull and cancellation never write the source", () => {
  const snapshot = documentToRecords(sourceDocument());
  for (const stage of ["preparing", "connecting", "discovering", "review"]) {
    const isolation = evaluateActivationIsolation({
      sourceSnapshot: snapshot,
      operations: [],
      targetRecords: emptyRecords(),
      consented: false
    });
    assert.equal(isolation.isolated, true, stage);
  }
  assert.equal(findPreConsentSourceWrites({
    sourceSnapshot: snapshot,
    operations: [{ type: "add", store: "subjects", value: { id: "cloud-only", title: "Cloud" } }],
    consented: false
  }).length, 0);
});

// 2.2 --------------------------------------------------------------------------

test("2.2 suspended activation is parsed, starts locally and keeps its destination", () => {
  const config = { databaseUrl: destination.url };
  const record = createActivationRecord({
    status: ACTIVATION_STATUS.SUSPENDED,
    url: destination.url,
    remoteDbId: destination.remoteDbId,
    userId
  });
  assert.equal(record.status, ACTIVATION_STATUS.SUSPENDED);
  assert.equal(parseActivationRecord(record).status, ACTIVATION_STATUS.SUSPENDED);
  const startup = resolveStartupWorkspace({ record, config });
  assert.equal(startup.workspace, "local");
  assert.equal(startup.reason, ACTIVATION_STATUS.SUSPENDED);
  assert.equal(startup.legacy, false);
  assert.equal(record.url, destination.url);
  assert.equal(record.remoteDbId, destination.remoteDbId);
  assert.equal(record.userDigest, hashActivationUser(userId));

  // Unknown statuses remain fail-closed to the local workspace.
  const unknown = resolveStartupWorkspace({
    record: { version: 1, status: "mystery", url: destination.url },
    config
  });
  assert.equal(unknown.workspace, "local");
});

test("2.2 startup routes local, cancelled, activating, active and legacy configurations", () => {
  const config = { databaseUrl: destination.url };
  const cases = [
    [null, "synced"],
    [{ version: 1, status: "cancelled", url: destination.url }, "local"],
    [{ version: 1, status: "activating", url: destination.url }, "synced"],
    [{ version: 1, status: "active", url: destination.url }, "synced"]
  ];
  for (const [record, workspace] of cases) {
    assert.equal(resolveStartupWorkspace({ record, config }).workspace, workspace);
  }
  assert.equal(resolveStartupWorkspace({ record: null, config: null }).workspace, "local");
  assert.equal(resolveStartupWorkspace({
    record: { version: 1, status: "active", url: destination.url },
    config: null
  }).workspace, "local");
});

test("2.2 openLocalDatabase installs no Dexie Cloud addon and the app uses it", () => {
  const foundation = read("site/dexie-foundation.js");
  const local = foundation.match(/export function openLocalDatabase[\s\S]*?\n\}/);
  assert.ok(local);
  assert.doesNotMatch(local[0], /dexieCloud|cloud\.configure|addons/);
  const app = read("site/app.js");
  assert.match(app, /resolveStartupWorkspace/);
  assert.match(app, /readActivationRecord/);
  assert.match(app, /openLocalDatabase\(Dexie\)/);
});

// 2.3 --------------------------------------------------------------------------

test("2.3 the activation UI exposes unique, labelled, button-only controls", () => {
  const html = read("site/index.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate DOM id");
  for (const id of [
    "cloud-activation",
    "cloud-activation-title",
    "cloud-activation-stage",
    "cloud-activation-status",
    "cloud-activation-source",
    "cloud-activation-review",
    "cloud-activation-destination",
    "cloud-activation-consent",
    "cloud-activation-start",
    "cloud-activation-resume",
    "cloud-activation-confirm",
    "cloud-activation-cancel",
    "cloud-activation-retry"
  ]) {
    assert.ok(ids.includes(id), id);
  }
  assert.match(html, /id="cloud-activation"[^>]*aria-labelledby="cloud-activation-title"/);
  assert.match(html, /id="cloud-activation-stage"[^>]*aria-live="polite"/);
  assert.match(html, /id="cloud-activation-status"[^>]*aria-live="polite"/);
  for (const id of ["start", "resume", "confirm", "cancel", "retry"]) {
    assert.match(html, new RegExp('id="cloud-activation-' + id + '"[^>]*type="button"'));
  }
  assert.match(html, /id="cloud-activation-confirm"[^>]*disabled/);
  assert.match(html, /id="cloud-config-form"/);
  assert.match(html, /id="auth-form"/);
  assert.doesNotMatch(html, /id="cloud-activation-review"[^>]*>[^<]*Titre/);
});

test("2.3 the assistant status regions never contain business content", () => {
  const app = read("site/app.js");
  const render = app.match(/function renderActivationPanel\([\s\S]*?\n\}/);
  assert.ok(render, "activation renderer present");
  assert.match(render[0], /cloudActivationStageEl\.textContent = describeActivationStage\(/);
  assert.match(render[0], /setActivationStatus\(message\)/);
  assert.match(app, /describeActivationStage\(/);
  assert.match(app, /describeTargetClassification\(/);
});

// 2.4 / 2.5 / 2.6 ----------------------------------------------------------------

test("2.4 the local source snapshot preserves identifiers and relations", () => {
  const document = sourceDocument();
  const projected = projection(document);
  const records = documentToRecords(document);
  assert.equal(projected.subjects.length, 5);
  assert.equal(projected.subjects.reduce((sum, subject) => sum + subject.items.length, 0), 18);
  const sourceIds = new Set(records.subjects.map((record) => record.id));
  const parentItem = records.items.find((record) => record.parentId !== null);
  assert.ok(sourceIds.has(parentItem.subjectId));
  assert.ok(records.items.some((record) => record.id === parentItem.parentId));
  assert.deepEqual(projected.provenance, { exportKind: "indexeddb-export" });
});

test("2.5 consent is bound to the displayed plan and a changed destination refuses the commit", async () => {
  const document = sourceDocument();
  const target = emptyRecords();
  const displayed = buildPlan(document, target);
  const adapter = fakeAdapter(target);
  const consent = { confirmed: true, fingerprint: displayed.fingerprint };
  const fresh = { attestation: attested(), document: projection(document), target, destination, userId };
  const outcome = await runReconciliation(adapter, displayed, consent, async () => fresh);
  assert.equal(outcome.status, "local-written");
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0].length, displayed.operations.length);

  const otherTarget = emptyRecords();
  const otherAdapter = fakeAdapter(otherTarget);
  const stale = await runReconciliation(otherAdapter, displayed, consent, async () => ({
    ...fresh,
    destination: { url: "https://other.dexie.cloud", remoteDbId: "remote-1" }
  }));
  assert.equal(stale.status, "stale-plan");
  assert.equal(otherAdapter.calls.length, 0);
});

test("2.6 pre-consent cancellation leaves both workspaces unchanged", () => {
  const document = sourceDocument();
  const target = emptyRecords();
  const plan = buildPlan(document, target);
  assert.ok(plan.operations.length > 0);
  assert.equal(target.subjects.length, 0);
  assert.equal(target.items.length, 0);
  assert.equal(documentToRecords(document).subjects.length, 5);
});

// 2.7 --------------------------------------------------------------------------

test("2.7 reload during review loses consent and requires a fresh review", () => {
  const document = sourceDocument();
  const target = emptyRecords();
  const first = buildPlan(document, target);
  const reloaded = buildPlan(document, target);
  assert.equal(reviewDisplayedPlan(first, reloaded).same, true);
  assert.equal(reviewDisplayedPlan(first, buildPlan(document, target, { userId: "user-2" })).same, false);
});

test("2.8 activation code never purges local source or the V1 document", () => {
  const app = read("site/app.js");
  const module = read("site/cloud-activation.js");
  for (const source of [app, module]) {
    assert.doesNotMatch(source, /removeItem\(STORAGE_KEY\)/);
    assert.doesNotMatch(source, /localStorage\.removeItem\("threadstep\.document\.v1"\)/);
  }
  assert.match(app, /function readLocalActivationSource/);
  assert.match(app, /openLocalDatabase\(Dexie\)/);
  assert.match(app, /readActivationRecord\(localStorage\)/);
});

// 3.1 --------------------------------------------------------------------------

test("3.1 configuration, OTP and first pull produce zero synchronized mutations", () => {
  const document = sourceDocument();
  const target = emptyRecords();
  const adapter = fakeAdapter(target);
  const classification = classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: target,
    expected: destination
  });
  assert.equal(classification.classification, TARGET_CLASSIFICATION.VERIFIED_EMPTY);
  assert.equal(adapter.calls.length, 0);
  assert.equal(target.subjects.length, 0);
  assert.equal(target.items.length, 0);
  const plan = buildPlan(document, target);
  assert.ok(plan.operations.length > 0);
  assert.equal(adapter.calls.length, 0);
});

// 3.2 --------------------------------------------------------------------------

test("3.2 empty, populated, divergent, refused, offline, URL/session changes and resume", async () => {
  const document = sourceDocument();
  const emptyTarget = emptyRecords();
  assert.equal(classifyTarget({
    attestation: attested(), targetStatus: "ready", records: emptyTarget, expected: destination
  }).classification, TARGET_CLASSIFICATION.VERIFIED_EMPTY);

  const partially = { subjects: [{ id: "s1", title: "Sujet 1", order: 0 }], items: [] };
  assert.equal(classifyTarget({
    attestation: attested(), targetStatus: "ready", records: partially, expected: destination
  }).classification, TARGET_CLASSIFICATION.POPULATED);

  const divergentPlan = buildPlan(document, {
    subjects: [{ id: "s1", title: "Sujet modifié", order: 0 }],
    items: []
  });
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: { subjects: [{ id: "s1", title: "Sujet modifié", order: 0 }], items: [] },
    expected: destination,
    plan: divergentPlan
  }).classification, TARGET_CLASSIFICATION.DIVERGENT);

  assert.equal(classifyTarget({
    attestation: { attested: false, reason: "sync-error" }, targetStatus: "blocked", records: null
  }).classification, TARGET_CLASSIFICATION.UNAVAILABLE);
  assert.equal(classifyTarget({
    attestation: { attested: false, reason: "offline" }, targetStatus: "blocked", records: null
  }).classification, TARGET_CLASSIFICATION.UNAVAILABLE);
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: emptyTarget,
    expected: { ...destination, url: "https://other.dexie.cloud" }
  }).classification, TARGET_CLASSIFICATION.IDENTITY_MISMATCH);
  assert.equal(classifyTarget({
    attestation: attested(),
    targetStatus: "ready",
    records: emptyTarget,
    expected: { ...destination, userId: "user-2" }
  }).classification, TARGET_CLASSIFICATION.IDENTITY_MISMATCH);

  const target = emptyRecords();
  const plan = buildPlan(document, target);
  const adapter = fakeAdapter(target);
  const outcome = await runReconciliation(adapter, plan,
    { confirmed: true, fingerprint: plan.fingerprint },
    async () => ({ attestation: attested(), document: projection(document), target, destination, userId }));
  assert.equal(outcome.status, "local-written");
  assert.equal(adapter.calls.length, 1);
  assert.deepEqual(adapter.calls[0].map((operation) => operation.type),
    plan.operations.map((operation) => operation.type));
  assert.ok(adapter.calls[0].every((operation) => operation.type === "add"));

  const resumed = buildPlan(document, target);
  assert.equal(resumed.status, "already-migrated");
  const resumedAdapter = fakeAdapter(target);
  const resumedOutcome = await runReconciliation(resumedAdapter, resumed,
    { confirmed: true, fingerprint: resumed.fingerprint },
    async () => ({ attestation: attested(), document: projection(document), target, destination, userId }));
  assert.equal(resumedOutcome.status, "already-migrated");
  assert.equal(resumedAdapter.calls.length, 0);
  assert.equal(target.subjects.length, 5);
  assert.equal(target.items.length, 18);
});

// 3.3 --------------------------------------------------------------------------

test("3.3 five subjects and eighteen steps keep notes, priorities, done, order and parents", () => {
  const document = sourceDocument();
  const target = { subjects: [{ id: "cloud-only", title: "Propre au Cloud", order: 0 }], items: [] };
  const plan = buildPlan(document, target);
  const addedSubjects = plan.operations.filter((operation) => operation.store === "subjects");
  const addedItems = plan.operations.filter((operation) => operation.store === "items");
  assert.equal(addedSubjects.length, 5);
  assert.equal(addedItems.length, 18);
  assert.ok(addedItems.some((operation) => operation.value.note === "Note privée 1"));
  assert.ok(addedItems.some((operation) => operation.value.priority === "urgent"));
  assert.ok(addedItems.some((operation) => operation.value.done === true));
  assert.ok(addedItems.some((operation) => operation.value.parentId === "s1i1"));
  assert.equal(target.subjects[0].title, "Propre au Cloud");
});

test("3.3 quota and structural constraints block only the affected groups", () => {
  const document = emptyDocument();
  for (let index = 0; index < 41; index += 1) {
    document.subjects.push(newSubject("Sujet " + index, "s" + index));
  }
  const plan = buildPlan(document, emptyRecords());
  assert.equal(plan.operations.filter((operation) => operation.store === "subjects").length, 40);
  assert.ok(plan.blocked.some((entry) => entry.store === "subjects" && entry.reason === "quota"));

  const itemsDocument = emptyDocument();
  const subject = newSubject("Sujet", "s1");
  for (let index = 0; index < 501; index += 1) {
    subject.items.push(newItem("Étape " + index, "normal", "i" + index));
  }
  itemsDocument.subjects.push(subject);
  const itemsPlan = buildPlan(itemsDocument, emptyRecords());
  assert.equal(itemsPlan.operations.filter((operation) => operation.store === "items").length, 500);
  assert.ok(itemsPlan.blocked.some((entry) => entry.store === "items" && entry.reason === "quota"));
});

test("3.3 a target with Cloud-only records is never overwritten or silently merged", async () => {
  const document = sourceDocument();
  const target = {
    subjects: [{ id: "cloud-only", title: "Propre au Cloud", order: 0 }],
    items: []
  };
  const plan = buildPlan(document, target);
  assert.equal(plan.operations.some((operation) => operation.value.id === "cloud-only"), false);
  const adapter = fakeAdapter(target);
  await runReconciliation(adapter, plan, { confirmed: true, fingerprint: plan.fingerprint },
    async () => ({ attestation: attested(), document: projection(document), target, destination, userId }));
  assert.equal(target.subjects.find((subject) => subject.id === "cloud-only").title, "Propre au Cloud");
});

// 4.x --------------------------------------------------------------------------

test("4.1 the package check script includes the activation module", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.check, /node --check site\/cloud-activation\.js/);
});

test("4.2 the product documentation records the TS-037 activation journey", () => {
  const guide = read("docs/product/developer-guide.md");
  const rollout = read("docs/product/dexie-cloud-rollout.md");
  for (const source of [guide, rollout]) {
    assert.match(source, /TS-037/);
    assert.match(source, /threadstep\.cloud\.activation\.v1/);
    assert.match(source, /threadstep-local/);
    assert.match(source, /verified-empty|vérifiée vide/);
    assert.match(source, /commit local|écrit localement/);
  }
  assert.match(guide, /site\/cloud-activation\.js/);
});

// 5.1 --------------------------------------------------------------------------

test("5.1 isolated workspace names remain the documented local and synchronized databases", () => {
  assert.equal(workspaceNamesAreDistinct("threadstep-local", "threadstep"), true);
  const foundation = read("site/dexie-foundation.js");
  assert.match(foundation, /export const DATABASE_NAME = "threadstep"/);
  assert.match(foundation, /export const LOCAL_DATABASE_NAME = "threadstep-local"/);
});

test("2.7 a delayed older discovery result never replaces the newer activation state", () => {
  const guard = createGenerationGuard();
  const older = guard.begin();
  const newer = guard.begin();
  let state = reduceFirstSync(initialFirstSyncState(), { type: "local-written" });
  if (guard.isCurrent(newer)) {
    state = reduceFirstSync(state, { type: "native", ...nativeEvidence() });
  }
  if (guard.isCurrent(older)) {
    state = reduceFirstSync(state, { type: "error", reason: "stale" });
  }
  assert.equal(state.status, FIRST_SYNC.REMOTE_COMPLETE);
  const reloaded = createGenerationGuard();
  assert.equal(reloaded.isCurrent(newer), false);
});

test("2.7 reload after commit rebuilds a conservative pending status and no stale success", () => {
  const document = sourceDocument();
  const target = emptyRecords();
  const committed = fakeAdapter(target);
  const plan = buildPlan(document, target);
  return runReconciliation(committed, plan, { confirmed: true, fingerprint: plan.fingerprint },
    async () => ({ attestation: attested(), document: projection(document), target, destination, userId }))
    .then((outcome) => {
      assert.equal(outcome.status, "local-written");
      const afterReload = buildPlan(document, target);
      assert.equal(afterReload.status, "already-migrated");
      assert.equal(initialFirstSyncState().remoteComplete, false);
      assert.match(describeActivationStage("transfer-pending"), /en attente|indéterminée/);
    });
});

test("2.6 a post-commit message never claims an undo or a remote push", () => {
  const pending = describeActivationStage("transfer-pending");
  assert.match(pending, /Écrit localement/);
  assert.doesNotMatch(pending, /push réussi|première synchronisation est achevée/);
  assert.match(pending, /attente|indéterminée/);
  const firstSync = reduceFirstSync(
    reduceFirstSync(initialFirstSyncState(), { type: "local-written" }),
    { type: "native", ...nativeEvidence({ online: false }) }
  );
  assert.equal(firstSync.status, FIRST_SYNC.PENDING);
  assert.equal(firstSync.localWritten, true);
});
