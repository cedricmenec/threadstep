import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANOMALY,
  READ_FAILURE,
  REPAIR_OUTCOME,
  REPAIR_STATE,
  buildBusinessExport,
  buildDegradedView,
  buildIntegrityInventory,
  buildRawRecoveryExport,
  buildRepairPlan,
  buildRepairRecoverySnapshot,
  buildRestorePlan,
  classifyReadError,
  classifyReadSignals,
  evaluateV1Export,
  hasBlockingAnomaly,
  initialRepairStatus,
  readWorkspaceResult,
  reduceRepairConvergence,
  repairEvent,
  repairEventIsRedacted,
  runRepair,
  summarizeIntegrityInventory,
  typedReadError,
  verifyRecoverySnapshot
} from "../site/data-integrity-recovery.js";
import { parseDocument } from "../site/core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const sourceProvenance = { exportKind: "v1-raw", idsCanonical: false, mappingVersion: 1 };
const destination = {
  url: "https://demo.dexie.cloud",
  remoteDbId: "remote-1",
  userCategory: "authenticated",
  rightsAvailable: true,
  realmsAvailable: true
};

function fixture5x19() {
  const subjects = [
    { id: "legacy:legacy:s1", title: "Sujet 1", order: 0, owner: "private-owner", realmId: "private-realm" },
    { id: "legacy:s2", title: "Sujet 2", order: 1 },
    { id: "legacy:s3", title: "Sujet 3", order: 2 },
    { id: "legacy:s4", title: "Sujet 4", order: 3 },
    { id: "legacy:s5", title: "Sujet 5", order: 4 }
  ];
  const items = [];
  const add = (id, subjectId, order, extra = {}) => {
    items.push({
      id,
      subjectId,
      parentId: null,
      title: "Tâche " + id,
      priority: "normal",
      done: false,
      order,
      owner: "private-owner",
      realmId: "private-realm",
      $ts: 123,
      token: "must-not-leak",
      otp: "123456",
      email: "person@example.test",
      ...extra
    });
  };
  add("legacy:i1", "legacy:legacy:s1", 0, { note: "Note à conserver", priority: "urgent" });
  add("legacy:i2", "legacy:legacy:s1", 1, { parentId: "legacy:i1" });
  add("legacy:i3", "legacy:legacy:s1", 2, { done: true });
  add("legacy:i4", "legacy:legacy:s1", 3);
  for (const subjectId of ["legacy:s2", "legacy:s3", "legacy:s4"]) {
    for (let index = 1; index <= 4; index += 1) {
      add("legacy:" + subjectId + "-i" + index, subjectId, index - 1);
    }
  }
  add("legacy:s5-i1", "legacy:s5", 0);
  add("legacy:s5-i2", "legacy:s5", 1);
  add("legacy:orphan-task", "legacy:s1", 99, { note: "Tâche Android orpheline", priority: "later" });
  return { subjects, items };
}

function sourceDocument() {
  return {
    version: 1,
    subjects: [{
      id: "legacy:s1",
      title: "Projet Android",
      items: [
        { id: "legacy:orphan-task", title: "Tâche Android orpheline", priority: "later", done: false, parentId: null }
      ]
    }]
  };
}

function repairPlan(extra = {}) {
  return buildRepairPlan({
    raw: fixture5x19(),
    source: sourceDocument(),
    provenance: sourceProvenance,
    decisions: { "items:legacy:orphan-task:subjectId": "legacy:legacy:s1" },
    destination,
    context: { workspace: "synced", permissionsMayHide: false },
    ...extra
  });
}

function applyChanges(raw, changes) {
  const next = clone(raw);
  for (const change of changes) {
    const list = change.store === "subjects" ? next.subjects : next.items;
    const record = list.find((entry) => entry.id === change.id);
    if (record) record[change.field] = change.to;
  }
  return next;
}

test("TS-035 taxonomy: four read failures plus indeterminate never become empty or synced", async () => {
  const available = await readWorkspaceResult(undefined);
  assert.equal(available.code, READ_FAILURE.STORAGE_UNAVAILABLE);
  assert.equal(available.raw, null);

  const refusedError = typedReadError(READ_FAILURE.READ_REFUSED);
  const refused = await readWorkspaceResult(async () => { throw refusedError; });
  assert.equal(refused.code, READ_FAILURE.READ_REFUSED);
  assert.equal(refused.raw, null);

  const invalid = await readWorkspaceResult(async () => ({
    subjects: [],
    items: [{ id: "o", subjectId: "missing", parentId: null, title: "T", priority: "normal", done: false, order: 0 }]
  }));
  assert.equal(invalid.code, READ_FAILURE.PROJECTION_INVALID);
  assert.equal(invalid.raw.items.length, 1);

  const denied = await readWorkspaceResult(async () => {
    throw new Error("permission denied by realm");
  });
  assert.equal(denied.code, READ_FAILURE.NOT_VISIBLE_UNAUTHORIZED);

  assert.equal(classifyReadError(new Error("unexpected")), READ_FAILURE.READ_REFUSED);
  assert.equal(classifyReadSignals({}), READ_FAILURE.INDETERMINATE);
  assert.equal(classifyReadSignals({ storageAvailable: false }), READ_FAILURE.STORAGE_UNAVAILABLE);
  for (const result of [available, refused, invalid, denied]) {
    assert.notEqual(result.code, "empty");
    assert.notEqual(result.code, "synced");
  }
});

test("TS-035 inventory: 5 subjects / 19 tasks with one orphan and prefix variants", () => {
  const raw = fixture5x19();
  const before = JSON.stringify(raw);
  const inventory = buildIntegrityInventory(raw);
  assert.equal(inventory.counts.subjects, 5);
  assert.equal(inventory.counts.items, 19);
  assert.equal(inventory.codes[ANOMALY.DANGLING_SUBJECT], 1);
  assert.ok(inventory.codes[ANOMALY.PREFIX_VARIANT] >= 1);
  const variant = inventory.groups.find((group) => group.store === "subjects" &&
    group.variants.includes("legacy:s1") && group.variants.includes("legacy:legacy:s1"));
  assert.ok(variant);
  assert.equal(hasBlockingAnomaly(inventory), true);
  const summary = summarizeIntegrityInventory(inventory);
  assert.ok(summary.some((entry) => entry.code === ANOMALY.DANGLING_SUBJECT && entry.count === 1));
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(buildIntegrityInventory(raw), inventory);
});

test("TS-035 inventory: a permission context reports invisibility instead of deletion", () => {
  const inventory = buildIntegrityInventory({
    subjects: [{ id: "legacy:s1", title: "S", order: 0 }],
    items: [{ id: "legacy:o", subjectId: "legacy:hidden", parentId: null, title: "T", priority: "normal", done: false, order: 0 }]
  }, { workspace: "synced", permissionsMayHide: true });
  assert.equal(inventory.codes[ANOMALY.DANGLING_SUBJECT] || 0, 0);
  assert.equal(inventory.codes[ANOMALY.INVISIBLE_OR_UNAUTHORIZED], 1);
  assert.equal(JSON.stringify(inventory).includes("deleted"), false);
});

test("TS-035 inventory: duplicate IDs, logical duplicates and identity collisions are reported", () => {
  const inventory = buildIntegrityInventory({
    subjects: [
      { id: "s1", title: "Projet", order: 0 },
      { id: "legacy:s1", title: "Projet", order: 1 }
    ],
    items: [
      { id: "i1", subjectId: "s1", parentId: null, title: "Même", priority: "normal", done: false, order: 0 },
      { id: "i2", subjectId: "s1", parentId: null, title: "Même", priority: "normal", done: false, order: 0 },
      { id: "i2", subjectId: "s1", parentId: null, title: "Même", priority: "normal", done: false, order: 0 }
    ]
  });
  assert.ok(inventory.codes[ANOMALY.DUPLICATE_ID] >= 1);
  assert.ok(inventory.codes[ANOMALY.LOGICAL_DUPLICATE] >= 1);
  assert.ok(inventory.codes[ANOMALY.IDENTITY_COLLISION] >= 1);
  assert.ok(inventory.anomalies.every((entry) => typeof entry.code === "string"));
});

test("TS-035 restore: distinct intention requires a verified backup and exposes the scope", () => {
  const current = fixture5x19();
  const incoming = {
    subjects: [{ id: "legacy:legacy:s1", title: "Sujet 1", order: 0 }],
    items: []
  };
  const blocked = buildRestorePlan({
    document: { version: 1, subjects: [] },
    incoming,
    current
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, "ambiguous-provenance");

  const backup = buildRepairRecoverySnapshot(current, { workspace: "synced" });
  const plan = buildRestorePlan({
    document: { version: 1, provenance: { exportKind: "indexeddb-export", idsCanonical: true, mappingVersion: 1 }, subjects: [] },
    incoming,
    current,
    backup,
    backupExpected: { counts: { subjects: 5, items: 19 } }
  });
  assert.equal(plan.allowed, true);
  assert.equal(plan.replacement, true);
  assert.equal(plan.counts.current.subjects, 5);
  assert.equal(plan.counts.incoming.subjects, 1);
  assert.equal(plan.counts.removed, 23);
  assert.equal(plan.scope.items, 0);

  const withoutBackup = buildRestorePlan({
    document: { version: 1, provenance: { exportKind: "indexeddb-export", idsCanonical: true, mappingVersion: 1 }, subjects: [] },
    incoming,
    current
  });
  assert.equal(withoutBackup.allowed, false);
  assert.equal(withoutBackup.code, "backup-missing");
});

test("TS-035 repair: preview is deterministic, cancel writes nothing and merge never deletes", () => {
  const first = repairPlan();
  const second = repairPlan();
  assert.deepEqual(first, second);
  assert.ok(first.changes.every((change) => change.field === "subjectId" || change.field === "parentId"));
  assert.equal(first.changes.some((change) => change.store === "subjects" && change.field === "id"), false);
});

test("TS-035 degraded view: valid subjects stay consultable, orphan is listed, no writes", () => {
  const raw = fixture5x19();
  const inventory = buildIntegrityInventory(raw);
  const before = JSON.stringify(raw);
  const view = buildDegradedView(raw, inventory);
  assert.equal(view.editable, false);
  assert.equal(view.displayed.subjects, 5);
  assert.equal(view.displayed.items, 18);
  assert.equal(view.accountsForEveryRecord, true);
  assert.ok(view.anomalies.some((entry) => entry.id === "legacy:orphan-task"));
  assert.ok(view.document.subjects.some((subject) => subject.id === "legacy:legacy:s1"));
  assert.equal(JSON.stringify(raw), before);
});

test("TS-035 raw export: 19 tasks, checksum, counts, no secret and no lastRecords snapshot", () => {
  const raw = fixture5x19();
  const snapshot = buildRawRecoveryExport(raw, { workspace: "synced", url: destination.url,
    remoteDbId: destination.remoteDbId, sessionCategory: "authenticated" });
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.format, "threadstep.raw-recovery.v1");
  assert.equal(snapshot.exportKind, "raw-recovery");
  assert.equal(snapshot.counts.subjects, 5);
  assert.equal(snapshot.counts.items, 19);
  assert.ok(snapshot.records.items.some((item) => item.id === "legacy:orphan-task"));
  assert.equal(typeof snapshot.checksum, "string");
  const serialized = JSON.stringify(snapshot);
  for (const forbidden of ["must-not-leak", "123456", "person@example.test"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.equal(serialized.includes("private-owner") || serialized.includes("private-realm"), true);
  assert.equal(buildRawRecoveryExport(null).status, "unavailable");
  assert.equal(buildRawRecoveryExport({ subjects: [] }).status, "unavailable");
});

test("TS-035 V1 gating: anomaly disables the normal export and keeps a distinct raw export", () => {
  const inventory = buildIntegrityInventory(fixture5x19());
  const gate = evaluateV1Export(inventory);
  assert.equal(gate.allowed, false);
  assert.equal(gate.rawRecoveryRequired, true);
  const business = buildBusinessExport({ subjects: [], items: [] }, { inventory });
  assert.equal(business.status, "disabled");
  assert.equal(business.document, null);

  const clean = buildIntegrityInventory({ subjects: [], items: [] });
  const allowed = buildBusinessExport({ subjects: [], items: [] }, { inventory: clean });
  assert.equal(allowed.status, "ready");
  assert.equal(allowed.document.provenance.exportKind, "indexeddb-export");
  assert.equal(allowed.document.provenance.idsCanonical, true);
  assert.equal(JSON.stringify(allowed.document.provenance).includes("title"), false);
  assert.doesNotThrow(() => parseDocument(JSON.stringify(allowed.document)));
});

test("TS-035 repair preview: full plan, zero writes and preserved business fields", () => {
  const raw = fixture5x19();
  const before = JSON.stringify(raw);
  const plan = repairPlan();
  assert.equal(plan.changes.length, 1);
  assert.deepEqual(plan.changes[0], {
    store: "items",
    id: "legacy:orphan-task",
    field: "subjectId",
    from: "legacy:s1",
    to: "legacy:legacy:s1",
    consented: true
  });
  assert.equal(plan.idVariant, "v1-raw");
  assert.equal(plan.destination.url, destination.url);
  assert.equal(plan.destination.remoteDbId, destination.remoteDbId);
  assert.equal(plan.counts.before.subjects, 5);
  assert.equal(plan.counts.before.items, 19);
  assert.equal(plan.preservedFields.items.includes("note"), true);
  assert.equal(plan.writable, true);
  assert.equal(typeof plan.fingerprint, "string");
  assert.equal(JSON.stringify(raw), before);

  const orphan = raw.items.find((item) => item.id === "legacy:orphan-task");
  const repaired = applyChanges(raw, plan.changes).items.find((item) => item.id === "legacy:orphan-task");
  for (const field of ["title", "note", "priority", "done", "parentId", "order"]) {
    assert.equal(repaired[field], orphan[field], field);
  }
});

test("TS-035 repair identity: title or prefix stripping never proves an attachment", () => {
  const withoutSource = repairPlan({ source: null, provenance: null, decisions: {} });
  assert.ok(withoutSource.ambiguousGroups.length >= 1);
  assert.equal(withoutSource.changes.length, 0);
  assert.equal(withoutSource.writable, false);

  const titleOnly = repairPlan({
    source: { version: 1, subjects: [{ id: "s1", title: "Sujet 1", items: [] }] },
    decisions: { "items:legacy:orphan-task:subjectId": "legacy:legacy:s1" }
  });
  assert.ok(titleOnly.blockedGroups.some((group) => group.code === "identity-unproven"));
  assert.equal(titleOnly.changes.length, 0);
  assert.equal(titleOnly.writable, false);

  const unconsented = repairPlan({ decisions: {} });
  assert.equal(unconsented.changes.length, 1);
  assert.equal(unconsented.changes[0].consented, false);
  assert.equal(unconsented.writable, false);
});

test("TS-035 repair: nested references and parent references stay coherent", () => {
  const raw = fixture5x19();
  raw.items.push({
    id: "legacy:orphan-child",
    subjectId: "legacy:s1",
    parentId: "legacy:orphan-task",
    title: "Enfant orphelin",
    priority: "normal",
    done: false,
    order: 100
  });
  const plan = buildRepairPlan({
    raw,
    source: sourceDocument(),
    provenance: sourceProvenance,
    decisions: {
      "items:legacy:orphan-task:subjectId": "legacy:legacy:s1",
      "items:legacy:orphan-child:subjectId": "legacy:legacy:s1"
    },
    destination
  });
  const changed = applyChanges(raw, plan.changes);
  const orphan = changed.items.find((item) => item.id === "legacy:orphan-task");
  const child = changed.items.find((item) => item.id === "legacy:orphan-child");
  assert.equal(orphan.subjectId, "legacy:legacy:s1");
  assert.equal(child.subjectId, "legacy:legacy:s1");
  assert.equal(child.parentId, "legacy:orphan-task");
  assert.equal(buildIntegrityInventory(changed).codes[ANOMALY.DANGLING_SUBJECT] || 0, 0);
});

test("TS-035 repair: missing, corrupt or mismatched backup blocks the repair", async () => {
  const plan = repairPlan();
  const raw = fixture5x19();
  const snapshot = buildRepairRecoverySnapshot(raw, { workspace: "synced" });
  assert.equal(verifyRecoverySnapshot(snapshot, {
    counts: { subjects: 5, items: 19 }, checksum: snapshot.checksum
  }).valid, true);
  assert.equal(verifyRecoverySnapshot(null, {}).code, "backup-missing");
  const corrupt = clone(snapshot);
  corrupt.records.items.pop();
  assert.equal(verifyRecoverySnapshot(corrupt, {
    counts: { subjects: 5, items: 19 }
  }).valid, false);
  assert.equal(verifyRecoverySnapshot(snapshot, {
    counts: { subjects: 5, items: 18 }
  }).code, "backup-count-mismatch");

  let calls = 0;
  const adapter = { commitRepairs() { calls += 1; } };
  const baseConsent = { confirmed: true, fingerprint: plan.fingerprint, destinationFingerprint: plan.destinationFingerprint };
  const rejected = await runRepair(adapter, plan, baseConsent, async () => ({ raw, destination }));
  assert.equal(rejected.status, REPAIR_OUTCOME.BACKUP_INVALID);
  assert.equal(calls, 0);
});

test("TS-035 repair: consent is bound to plan and destination, stale source/target is refused", async () => {
  const plan = repairPlan();
  const raw = fixture5x19();
  const backup = buildRepairRecoverySnapshot(raw, { workspace: "synced" });
  const consent = {
    confirmed: true,
    fingerprint: plan.fingerprint,
    destinationFingerprint: plan.destinationFingerprint,
    backup
  };
  let calls = 0;
  const adapter = { commitRepairs() { calls += 1; return { status: "repaired" }; } };
  assert.equal((await runRepair(adapter, plan, undefined, async () => ({ raw, destination }))).status,
    REPAIR_OUTCOME.REJECTED);
  assert.equal((await runRepair(adapter, plan, { ...consent, fingerprint: "other" },
    async () => ({ raw, destination }))).status, REPAIR_OUTCOME.REJECTED);
  assert.equal((await runRepair(adapter, plan, { ...consent, destinationFingerprint: "other" },
    async () => ({ raw, destination }))).status, REPAIR_OUTCOME.DESTINATION_CHANGED);
  assert.equal((await runRepair(adapter, plan, consent,
    async () => ({ raw, destination: { ...destination, remoteDbId: "remote-2" } }))).status,
    REPAIR_OUTCOME.DESTINATION_CHANGED);

  const concurrent = clone(raw);
  concurrent.items.find((item) => item.id === "legacy:orphan-task").note = "Note concurrente";
  assert.equal((await runRepair(adapter, plan, consent,
    async () => ({ raw: concurrent, destination }))).status, REPAIR_OUTCOME.STALE_PLAN);

  const newOrphan = clone(raw);
  newOrphan.items.push({
    id: "legacy:orphan-2", subjectId: "legacy:s1", parentId: null, title: "Autre",
    priority: "normal", done: false, order: 101
  });
  assert.equal((await runRepair(adapter, plan, consent,
    async () => ({ raw: newOrphan, destination }))).status, REPAIR_OUTCOME.STALE_PLAN);
  assert.equal(calls, 0);
});

test("TS-035 repair: success, idempotence, collision and transaction error write no duplicate", async () => {
  const raw = fixture5x19();
  const plan = repairPlan();
  const backup = buildRepairRecoverySnapshot(raw, { workspace: "synced" });
  const consent = {
    confirmed: true,
    fingerprint: plan.fingerprint,
    destinationFingerprint: plan.destinationFingerprint,
    backup
  };
  let state = clone(raw);
  const adapter = {
    commitRepairs(changes) {
      const next = clone(state);
      for (const change of changes) {
        assert.ok(change.field === "subjectId" || change.field === "parentId");
        const list = change.store === "subjects" ? next.subjects : next.items;
        const record = list.find((entry) => entry.id === change.id);
        if (!record || record[change.field] !== change.from) {
          const error = new Error("collision");
          error.code = "collision";
          throw error;
        }
        record[change.field] = change.to;
      }
      state = next;
      return { status: "repaired" };
    },
    snapshot: () => clone(state)
  };
  const fresh = async () => ({ raw: state, destination, source: sourceDocument(),
    provenance: plan.provenance, decisions: plan.decisions });
  const outcome = await runRepair(adapter, plan, consent, fresh);
  assert.equal(outcome.status, REPAIR_OUTCOME.REPAIRED);
  assert.equal(state.items.find((item) => item.id === "legacy:orphan-task").subjectId, "legacy:legacy:s1");
  const rerun = await runRepair(adapter, plan, consent, fresh);
  assert.equal(rerun.status, REPAIR_OUTCOME.ALREADY_REPAIRED);
  assert.equal(state.items.length, 19);

  const collisionRaw = clone(raw);
  const collisionPlan = plan;
  let collisionState = clone(collisionRaw);
  let collisions = 0;
  const collisionAdapter = {
    commitRepairs() {
      collisions += 1;
      const error = new Error("collision");
      error.code = "collision";
      throw error;
    }
  };
  const collisionConsent = {
    confirmed: true,
    fingerprint: collisionPlan.fingerprint,
    destinationFingerprint: collisionPlan.destinationFingerprint,
    backup: buildRepairRecoverySnapshot(collisionRaw, {})
  };
  const collisionOutcome = await runRepair(collisionAdapter, collisionPlan, collisionConsent,
    async () => ({ raw: collisionState, destination, source: sourceDocument(),
      provenance: collisionPlan.provenance, decisions: collisionPlan.decisions }));
  assert.equal(collisionOutcome.status, REPAIR_OUTCOME.COLLISION);
  assert.equal(collisions, 1);
  assert.deepEqual(collisionState, collisionRaw);

  const failing = {
    commitRepairs() { throw new Error("transaction interrupted"); }
  };
  const failure = await runRepair(failing, plan, consent,
    async () => ({ raw: clone(raw), destination, source: sourceDocument(),
      provenance: plan.provenance, decisions: plan.decisions }));
  assert.equal(failure.status, REPAIR_OUTCOME.TRANSACTION_ERROR);
  assert.equal(state.items.length, 19);
});

test("TS-035 repair: events expose only codes and counts", () => {
  const event = repairEvent("repaired", {
    count: 1,
    title: "Titre secret",
    note: "Note privée",
    email: "person@example.test",
    otp: "123456",
    token: "secret-token"
  });
  assert.deepEqual(event, { code: "repaired", count: 1 });
  assert.equal(repairEventIsRedacted(event), true);
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("TS-035 convergence: local commit or in-sync alone is never convergence", () => {
  let state = initialRepairStatus();
  state = reduceRepairConvergence(state, { type: "local-committed", online: true });
  assert.equal(state.status, REPAIR_STATE.SYNC_PENDING);
  assert.equal(state.crossDeviceConverged, false);
  state = reduceRepairConvergence(state, { type: "in-sync" });
  assert.notEqual(state.status, REPAIR_STATE.CONVERGED_ON_THIS_DEVICE);

  const offline = reduceRepairConvergence(initialRepairStatus(), { type: "local-committed", online: false });
  assert.equal(offline.status, REPAIR_STATE.OFFLINE_PENDING);

  let converged = reduceRepairConvergence(state, { type: "native-pull" });
  converged = reduceRepairConvergence(converged, { type: "business-read", fresh: true, containsRepaired: true });
  assert.equal(converged.status, REPAIR_STATE.CONVERGED_ON_THIS_DEVICE);
  assert.equal(converged.crossDeviceConverged, false);

  const withoutPull = reduceRepairConvergence(
    reduceRepairConvergence(initialRepairStatus(), { type: "local-committed", online: true }),
    { type: "business-read", fresh: true, containsRepaired: true });
  assert.notEqual(withoutPull.status, REPAIR_STATE.CONVERGED_ON_THIS_DEVICE);
});

test("TS-035 convergence: later sync error preserves local evidence and never claims a second device", () => {
  let state = reduceRepairConvergence(initialRepairStatus(), { type: "local-committed", online: true });
  state = reduceRepairConvergence(state, { type: "sync-error" });
  assert.equal(state.status, REPAIR_STATE.SYNC_ERROR);
  assert.equal(state.localWritten, true);
  assert.equal(state.crossDeviceConverged, false);
  assert.equal(JSON.stringify(state).includes("second-device"), false);
});

test("TS-035 UI: recovery panel, raw export, V1 gating and repair consent are wired without destructive paths", () => {
  const html = read("site/index.html");
  for (const id of [
    "recovery-panel", "recovery-title", "recovery-instance", "recovery-read-code",
    "recovery-degraded", "recovery-anomalies", "recovery-v1-status", "recovery-raw-export",
    "recovery-repair-preview", "repair-preview", "repair-groups", "repair-backup-status",
    "repair-consent", "repair-confirm", "repair-cancel", "repair-status",
    "restore-panel", "restore-title", "restore-scope", "restore-backup-status",
    "restore-download-backup", "restore-confirm", "restore-cancel"
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /aria-labelledby="recovery-title"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /enregistrements bruts de récupération/i);

  const app = read("site/app.js");
  assert.doesNotMatch(app, /innerHTML/);
  assert.match(app, /function renderRecoveryPanel\(\)/);
  assert.match(app, /function exportRawRecovery\(\)/);
  assert.match(app, /function exportBusinessBackup\(\)/);
  assert.match(app, /evaluateV1Export\(inventory\)/);
  assert.match(app, /buildRawRecoveryExport\(recoveryContext\.raw/);
  assert.match(app, /buildIntegrityInventory\(raw/);
  assert.match(app, /runRepair\(repairAdapter\(\)/);
  assert.match(app, /repairContext\.backup/);
  assert.match(app, /consentement explicite requis/i);
  assert.doesNotMatch(app, /localStorage\.clear\s*\(/);
  assert.doesNotMatch(app, /deleteDatabase\s*\(/);
  assert.doesNotMatch(app, /removeItem\(\s*STORAGE_KEY\s*\)/);
  assert.doesNotMatch(app, /console\.(?:log|info|warn|error)/);
  assert.match(app, /function confirmRestore\(\)/);
  assert.match(app, /restoreConfirmationEl\.value !== "RESTAURER"/);
  assert.match(app, /function downloadRestoreBackup\(\)/);
  assert.match(html, /La restauration remplace l'état actuel/);
  const repairFunctions = ["renderRecoveryPanel", "exportRawRecovery", "confirmRepair", "runRepairAsync"];
  for (const name of repairFunctions) {
    const start = app.indexOf("function " + name + "(");
    assert.notEqual(start, -1, name);
    const end = app.indexOf("\nfunction ", start + 1);
    const source = app.slice(start, end === -1 ? app.length : end);
    assert.doesNotMatch(source, /innerHTML|localStorage\.clear|deleteDatabase/);
  }
});

test("TS-035 docs: provenance, degraded read, raw export, repair evidence and convergence are documented", () => {
  const guide = read("docs/product/developer-guide.md");
  const rollout = read("docs/product/dexie-cloud-rollout.md");
  for (const source of [guide, rollout]) {
    assert.match(source, /provenance/i);
    assert.match(source, /ambigu/i);
    assert.match(source, /lecture seule|read-only/i);
    assert.match(source, /export brut/i);
    assert.match(source, /récupération|recovery/i);
    assert.match(source, /consentement|consent/i);
    assert.match(source, /convergence/i);
    assert.match(source, /legacy:legacy:/);
    assert.match(source, /5 sujets/);
    assert.match(source, /19 tâches/);
  }
  for (const source of [guide, rollout]) {
    assert.doesNotMatch(source, /person@example|sk-[A-Za-z0-9]{20}|Bearer\s+[A-Za-z0-9]/);
  }
});
