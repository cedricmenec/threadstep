// Certification matrix for the local-first and Dexie Cloud journeys (TS-039).
//
// This module is deliberately pure: it has no DOM, IndexedDB, network, clock,
// randomness, file or environment access. Canonical spec texts are injected by
// the caller; scenarios only call the delivered pure product modules with
// in-memory fixtures. A real Dexie Cloud observation is never inferred from a
// CI check.
import {
  emptyRecords,
  documentToRecords,
  recordsToDocument,
  applyOperations,
  planCreateSubject,
  planAddStep,
  planAddSubstep,
  planEditStep,
  planImport,
  createMemoryStore,
  normalizedRecords,
  localError,
  isLocalError,
  isSyncError
} from "../../site/persistence.js";
import {
  STORAGE_KEY,
  emptyDocument,
  newSubject,
  newItem
} from "../../site/core.js";
import {
  LOCAL_MERGE_STATUS,
  planModernLocalImport
} from "../../site/local-migration.js";
import {
  serializeIndexedDbBackup,
  BACKUP_FORMAT
} from "../../site/indexeddb-backup.js";
import {
  buildCleanupInventory,
  runCleanup
} from "../../site/local-recovery.js";
import {
  RESOLUTION,
  computeSourceFingerprint,
  planReconciliation,
  reviewDisplayedPlan,
  runReconciliation
} from "../../site/migration-reconciliation.js";
import {
  ACTIVATION_STAGE,
  FIRST_SYNC,
  TARGET_CLASSIFICATION,
  classifyTarget,
  evaluateActivationIsolation,
  findPreConsentSourceWrites,
  initialActivationState,
  initialFirstSyncState,
  isPreConsentStage,
  reduceFirstSync,
  transitionActivation
} from "../../site/cloud-activation.js";
import {
  BINDING_STATE,
  WORKSPACE_STATUS,
  bindWorkspaceAccount,
  buildWorkspaceDiagnostic,
  createWorkspaceEntry,
  emptyWorkspaceRegistry,
  evaluateAccountBinding,
  hashWorkspaceUser,
  planWorkspaceLogout,
  planWorkspacePurge,
  planWorkspaceSelection,
  registerWorkspace,
  resolveWorkspaceStartup,
  workspaceDatabaseName,
  workspaceDiagnosticRows
} from "../../site/workspace-identity.js";
import {
  CONNECTION_STATE,
  DIAGNOSTIC_ERROR,
  LOCAL_WRITE_STATE,
  REMOTE_EVIDENCE,
  SYNC_PHASE,
  buildSyncDiagnostic,
  classifySyncError,
  reduceLocalWriteStatus
} from "../../site/sync-diagnostics.js";
import {
  buildRawRecoveryExport,
  buildRestorePlan
} from "../../site/data-integrity-recovery.js";

export const EVIDENCE = Object.freeze({
  CI: "ci",
  REAL_DEXIE: "real-dexie",
  LIMITATION: "limitation",
  INCIDENT: "incident"
});

export const STATUS = Object.freeze({
  PASSED: "passed",
  PENDING: "pending",
  NOT_RUN: "not-run",
  OPEN: "open",
  FAILED: "failed"
});

export const REQUIRED_DOMAINS = Object.freeze([
  "local-only",
  "activation",
  "first-sync",
  "populated-target",
  "divergence",
  "concurrent-conflicts",
  "json-reimport",
  "restore",
  "logout",
  "url-change",
  "session-change",
  "network-errors",
  "states",
  "persistence",
  "fingerprints",
  "security",
  "idempotence"
]);

export const CROSS_CUTTING_GUARANTEES = Object.freeze([
  "states",
  "persistence",
  "fingerprints",
  "security",
  "idempotence"
]);

const DESTINATION = Object.freeze({
  url: "https://e2e-example.dexie.cloud",
  remoteDbId: "remote-e2e-synthetic"
});
const URL_A = "https://e2e-alpha.dexie.cloud";
const URL_B = "https://e2e-beta.dexie.cloud";
const USER = "user-e2e-synthetic";

const COMMON_LIMITATIONS = Object.freeze({
  indexeddb: "IndexedDB réel, le rechargement navigateur et le tactile ne sont pas exécutés par le runner Node.",
  nativeSync: "La propagation native Dexie Cloud (websocket) et la convergence entre deux navigateurs ne sont pas prouvées par le runner.",
  serverConflict: "La résolution de conflits côté serveur Dexie Cloud n'est pas prouvée par le runner.",
  otp: "La livraison réelle d'un OTP email n'est pas prouvée par le runner.",
  nativeLogout: "L'effacement du cache par le logout natif Dexie Cloud n'est pas prouvé par le runner.",
  mobile: "Chrome mobile, le clavier, le focus, les cibles tactiles et le lecteur d'écran ne sont pas exécutés par le runner."
});

function ensure(condition) {
  if (!condition) throw new Error("assertion-failed");
}

function applyPlan(records, operations) {
  const normalized = (Array.isArray(operations) ? operations : []).map((operation) =>
    operation && operation.type === "add" ? { ...operation, type: "put" } : operation);
  return applyOperations(records, normalized);
}

function allRecordsIntact(doc) {
  if (!doc || !Array.isArray(doc.subjects)) return false;
  for (const subject of doc.subjects) {
    if (!Array.isArray(subject.items)) return false;
    const ids = new Set(subject.items.map((item) => item.id));
    for (const item of subject.items) {
      if (item.parentId !== null && !ids.has(item.parentId)) return false;
    }
  }
  return true;
}

function basicDocument() {
  const doc = emptyDocument();
  const first = newSubject("Sujet synthétique A", "synthetic-subject-a");
  first.items.push(newItem("Étape synthétique 1", "urgent", "synthetic-step-1"));
  first.items.push(newItem("Sous-étape synthétique 1", "normal", "synthetic-substep-1", "synthetic-step-1"));
  first.items[0].note = "Note synthétique locale";
  first.items[1].done = true;
  first.items.push(newItem("Étape synthétique 2", "later", "synthetic-step-2"));
  const second = newSubject("Sujet synthétique B", "synthetic-subject-b");
  second.items.push(newItem("Étape synthétique 3", "normal", "synthetic-step-3"));
  doc.subjects.push(first, second);
  return doc;
}

function referenceDocument() {
  const doc = emptyDocument();
  const definitions = [
    { id: "ref-subject-1", title: "Référence synthétique 1", steps: ["1", "2", "3", "4", "5"] },
    { id: "ref-subject-2", title: "Référence synthétique 2", steps: ["6", "7", "8", "9"] },
    { id: "ref-subject-3", title: "Référence synthétique 3", steps: ["10", "11", "12"] },
    { id: "ref-subject-4", title: "Référence synthétique 4", steps: ["13", "14", "15"] },
    { id: "ref-subject-5", title: "Référence synthétique 5", steps: ["16", "17", "18"] }
  ];
  for (const definition of definitions) {
    const subject = newSubject(definition.title, definition.id);
    definition.steps.forEach((number, index) => {
      const id = "ref-step-" + number;
      const priority = index === 1 ? "urgent" : index === 3 ? "later" : "normal";
      const parentId = number === "2" ? "ref-step-1" : number === "8" ? "ref-step-7" : null;
      subject.items.push(newItem("Étape de référence " + number, priority, id, parentId));
    });
    subject.items[0].note = "Note de référence " + definition.id;
    subject.items[2].done = true;
    doc.subjects.push(subject);
  }
  return doc;
}

function attested(overrides = {}) {
  return {
    attested: true,
    reason: null,
    identity: {
      url: DESTINATION.url,
      remoteDbId: DESTINATION.remoteDbId,
      userId: USER
    },
    ...overrides
  };
}

function healthyNativeInput() {
  return {
    online: true,
    user: { isLoggedIn: true, userId: USER },
    databaseUrl: DESTINATION.url,
    remoteDbId: DESTINATION.remoteDbId,
    syncState: { status: "connected", phase: "in-sync" },
    persistedSyncState: {
      initiallySynced: true,
      remoteDbId: DESTINATION.remoteDbId,
      serverRevision: 7,
      realms: [USER],
      databaseUrl: DESTINATION.url
    }
  };
}

function buildPlan(doc, target, extra = {}) {
  return planReconciliation({
    records: documentToRecords(doc),
    target,
    destination: DESTINATION,
    userId: USER,
    resolutions: {},
    ...extra
  });
}

function revisionFor(doc, target) {
  return async () => ({
    attestation: attested(),
    records: documentToRecords(doc),
    target,
    destination: DESTINATION,
    userId: USER
  });
}

function workspaceFixture() {
  let registry = emptyWorkspaceRegistry();
  const baseA = workspaceDatabaseName(URL_A);
  const baseB = workspaceDatabaseName(URL_B);
  registry = registerWorkspace(registry, {
    url: URL_A,
    databaseName: baseA,
    schemaVersion: 1,
    status: WORKSPACE_STATUS.ACTIVE
  });
  registry = registerWorkspace(registry, {
    url: URL_B,
    databaseName: baseB,
    schemaVersion: 1,
    status: WORKSPACE_STATUS.ACTIVE
  });
  registry = bindWorkspaceAccount(registry, URL_A, USER);
  return { registry, baseA, baseB };
}

const localOnlyChecks = [
  {
    id: "bootstrap-without-cloud",
    label: "Démarrage local vide sans configuration Cloud",
    run() {
      const store = createMemoryStore();
      const snapshot = store.snapshot();
      ensure(snapshot.subjects.length === 0 && snapshot.items.length === 0);
      ensure(store.networkCalls === 0);
      ensure(recordsToDocument(snapshot).subjects.length === 0);
      return true;
    }
  },
  {
    id: "persist-create-edit-reload",
    label: "Création, édition et relecture locale avec relations",
    run() {
      let records = emptyRecords();
      records = applyOperations(records, planCreateSubject(records, {
        title: "Sujet synthétique A",
        id: "synthetic-subject-a"
      }));
      records = applyOperations(records, planAddStep(records, "synthetic-subject-a", {
        title: "Étape synthétique 1",
        priority: "urgent",
        id: "synthetic-step-1"
      }));
      records = applyOperations(records, planAddSubstep(records, "synthetic-subject-a", "synthetic-step-1", {
        title: "Sous-étape synthétique 1",
        id: "synthetic-substep-1"
      }));
      records = applyOperations(records, planEditStep(records, "synthetic-subject-a", "synthetic-step-1", {
        title: "Étape synthétique 1",
        priority: "urgent",
        note: "Note synthétique locale"
      }));
      const reloaded = normalizedRecords(records);
      const doc = recordsToDocument(reloaded);
      ensure(doc.subjects.length === 1 && doc.subjects[0].items.length === 2);
      const substep = doc.subjects[0].items.find((item) => item.id === "synthetic-substep-1");
      ensure(substep && substep.parentId === "synthetic-step-1");
      ensure(doc.subjects[0].items[0].note === "Note synthétique locale");
      return true;
    }
  },
  {
    id: "retired-key-inert-and-cleanable",
    label: "Clé V1 retirée inventoriée sans parsing et nettoyée seulement avec consentement",
    run() {
      const stored = JSON.stringify(basicDocument());
      const values = new Map([[STORAGE_KEY, stored]]);
      const storage = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        removeItem(key) { values.delete(key); }
      };
      const inventory = buildCleanupInventory(storage);
      ensure(inventory.keys.length === 1 && inventory.keys[0] === STORAGE_KEY);
      ensure(storage.getItem(STORAGE_KEY) === stored);
      const refused = runCleanup(storage, inventory, { confirmed: false });
      ensure(refused.removed.length === 0 && storage.getItem(STORAGE_KEY) === stored);
      const cleaned = runCleanup(storage, inventory, {
        confirmed: true,
        backupVerified: true,
        metadataMigrationComplete: true
      });
      ensure(cleaned.removed.length === 1 && storage.getItem(STORAGE_KEY) === null);
      return true;
    }
  }
];

const localPersistenceChecks = [
  {
    id: "records-roundtrip",
    label: "Projection document/records sans perte de relations",
    run() {
      const records = documentToRecords(basicDocument());
      ensure(records.subjects.length === 2 && records.items.length === 4);
      const doc = recordsToDocument(records);
      ensure(allRecordsIntact(doc));
      ensure(JSON.stringify(doc) === JSON.stringify(basicDocument()));
      return true;
    }
  },
  {
    id: "transactional-write",
    label: "Écriture locale confirmée et relecture identique",
    async run() {
      const store = createMemoryStore({ initial: documentToRecords(basicDocument()) });
      const before = store.snapshot();
      const operations = planAddStep(before, "synthetic-subject-a", {
        title: "Étape synthétique ajoutée",
        priority: "normal",
        id: "synthetic-step-added"
      });
      const result = await store.commit(operations);
      ensure(result.status === "recorded");
      ensure(store.snapshot().items.length === before.items.length + 1);
      return true;
    }
  }
];

const fingerprintChecks = [
  {
    id: "stable-source-fingerprint",
    label: "Empreinte de source stable pour les mêmes entrées",
    run() {
      const first = computeSourceFingerprint(basicDocument());
      const second = computeSourceFingerprint(basicDocument());
      ensure(first === second);
      ensure(/^[a-f0-9]{64}$/.test(first));
      return true;
    }
  },
  {
    id: "stable-plan-fingerprint",
    label: "Empreinte de plan stable et sensible à la cible",
    run() {
      const first = buildPlan(basicDocument(), emptyRecords());
      const second = buildPlan(basicDocument(), emptyRecords());
      const changed = buildPlan(basicDocument(), {
        subjects: [{ id: "synthetic-subject-a", title: "Cible synthétique modifiée", order: 0 }],
        items: []
      });
      ensure(first.fingerprint === second.fingerprint);
      ensure(first.fingerprint !== changed.fingerprint);
      return true;
    }
  }
];

const activationConsentChecks = [
  {
    id: "no-transfer-before-consent",
    label: "Aucune écriture source avant le consentement de transfert",
    run() {
      const snapshot = documentToRecords(basicDocument());
      const operations = [{ type: "put", store: "items", value: { ...snapshot.items[0] } }];
      const blocked = findPreConsentSourceWrites({ sourceSnapshot: snapshot, operations, consented: false });
      const allowed = findPreConsentSourceWrites({ sourceSnapshot: snapshot, operations, consented: true });
      ensure(blocked.length === 1);
      ensure(allowed.length === 0);
      return true;
    }
  },
  {
    id: "source-and-target-isolated",
    label: "Source locale et cible distante restent isolées",
    run() {
      const snapshot = documentToRecords(basicDocument());
      const operations = [{ type: "put", store: "items", value: { ...snapshot.items[0] } }];
      const blocked = evaluateActivationIsolation({
        sourceSnapshot: snapshot,
        operations,
        consented: false,
        targetRecords: emptyRecords()
      });
      const consented = evaluateActivationIsolation({
        sourceSnapshot: snapshot,
        operations,
        consented: true,
        targetRecords: emptyRecords()
      });
      ensure(blocked.isolated === false && blocked.preConsentSourceWrites.length === 1);
      ensure(consented.isolated === true);
      return true;
    }
  }
];

const activationStageChecks = [
  {
    id: "guided-stages",
    label: "Étapes guidées sans annonce prématurée",
    run() {
      let state = initialActivationState();
      const stages = [state.stage];
      for (const type of ["start", "configured", "authenticated", "discovered"]) {
        const transition = transitionActivation(state, { type });
        ensure(transition.ok === true);
        state = transition.state;
        stages.push(state.stage);
      }
      ensure(stages.join(",") === [
        ACTIVATION_STAGE.LOCAL,
        ACTIVATION_STAGE.PREPARING,
        ACTIVATION_STAGE.CONNECTING,
        ACTIVATION_STAGE.DISCOVERING,
        ACTIVATION_STAGE.REVIEW
      ].join(","));
      ensure(isPreConsentStage(state.stage) === true);
      ensure(transitionActivation(state, { type: "complete" }).ok === false);
      const consented = transitionActivation(state, { type: "consent" });
      ensure(consented.ok === true && consented.state.transferCommitted === false);
      const complete = transitionActivation(consented.state, { type: "complete" });
      ensure(complete.ok === true && complete.state.stage === ACTIVATION_STAGE.ACTIVE);
      ensure(complete.state.transferCommitted === true);
      return true;
    }
  }
];

const targetClassificationChecks = [
  {
    id: "target-classes",
    label: "Classement attesté des cibles vide, peuplée, divergente, indisponible et liée à un autre compte",
    run() {
      const empty = emptyRecords();
      const populated = documentToRecords(basicDocument());
      const divergent = { inventory: { counts: { subjects: { conflict: 1 }, items: {} } } };
      ensure(classifyTarget({ attestation: attested(), targetStatus: "ready", records: empty }).classification === TARGET_CLASSIFICATION.VERIFIED_EMPTY);
      ensure(classifyTarget({ attestation: attested(), targetStatus: "ready", records: populated }).classification === TARGET_CLASSIFICATION.POPULATED);
      ensure(classifyTarget({ attestation: attested(), targetStatus: "ready", records: populated, plan: divergent }).classification === TARGET_CLASSIFICATION.DIVERGENT);
      ensure(classifyTarget({ attestation: { attested: false, reason: "offline" }, records: empty }).classification === TARGET_CLASSIFICATION.UNAVAILABLE);
      ensure(classifyTarget({
        attestation: attested(),
        expected: { remoteDbId: "remote-e2e-other" },
        targetStatus: "ready",
        records: empty
      }).classification === TARGET_CLASSIFICATION.IDENTITY_MISMATCH);
      return true;
    }
  }
];

const firstSyncChecks = [
  {
    id: "local-pending-remote",
    label: "Commit local, attente réseau et complétion distante restent distincts",
    run() {
      let state = initialFirstSyncState();
      ensure(reduceFirstSync(state, { type: "native", ...healthyNativeInput() }).status === FIRST_SYNC.IDLE);
      state = reduceFirstSync(state, { type: "local-written" });
      ensure(state.status === FIRST_SYNC.LOCAL_WRITTEN && state.remoteComplete === false);
      state = reduceFirstSync(state, { type: "native", ...healthyNativeInput(), online: false });
      ensure(state.status === FIRST_SYNC.PENDING && state.remoteComplete === false);
      state = reduceFirstSync(state, { type: "native", ...healthyNativeInput() });
      ensure(state.status === FIRST_SYNC.REMOTE_COMPLETE && state.remoteComplete === true);
      const error = reduceFirstSync(state, { type: "error", reason: "network" });
      ensure(error.status === FIRST_SYNC.ERROR && error.remoteComplete === false);
      return true;
    }
  }
];

const divergenceChecks = [
  {
    id: "no-silent-overwrite",
    label: "Divergence bloquée sans écrasement silencieux",
    run() {
      const target = {
        subjects: [{ id: "synthetic-subject-a", title: "Titre divergents synthétique", order: 0 }],
        items: []
      };
      const plan = buildPlan(basicDocument(), target);
      ensure(plan.blocked.some((entry) => entry.reason === "unresolved-conflict"));
      ensure(plan.operations.every((operation) =>
        !(operation.store === "subjects" && operation.value.id === "synthetic-subject-a")));
      ensure(plan.operations.every((operation) =>
        !(operation.store === "items" && operation.value.subjectId === "synthetic-subject-a")));
      return true;
    }
  },
  {
    id: "conflict-requires-resolution",
    label: "Un conflit exige une résolution explicite avant toute copie",
    run() {
      const target = {
        subjects: [{ id: "synthetic-subject-a", title: "Titre divergents synthétique", order: 0 }],
        items: [{ id: "synthetic-step-1", subjectId: "synthetic-subject-a", parentId: null, title: "Étape divergente", priority: "normal", done: false, order: 0 }]
      };
      const blocked = buildPlan(basicDocument(), target);
      const resolved = buildPlan(basicDocument(), target, {
        resolutions: { "subjects:synthetic-subject-a": RESOLUTION.IMPORT_COPY }
      });
      ensure(blocked.blocked.length > 0);
      ensure(resolved.operations.length > 0);
      return true;
    }
  }
];

const concurrentChecks = [
  {
    id: "displayed-plan-consent",
    label: "Le consentement reste lié au plan affiché",
    async run() {
      const doc = basicDocument();
      const target = emptyRecords();
      const displayed = buildPlan(doc, target);
      const recomputed = buildPlan(doc, target);
      ensure(reviewDisplayedPlan(displayed, recomputed).same === true);
      const changedTarget = {
        subjects: [{ id: "synthetic-subject-other", title: "Cible synthétique ajoutée", order: 0 }],
        items: []
      };
      const changed = buildPlan(doc, changedTarget);
      ensure(reviewDisplayedPlan(displayed, changed).same === false);
      const store = createMemoryStore();
      const adapter = {
        commit(operations) {
          return store.commit(operations.map((operation) =>
            operation.type === "add" ? { ...operation, type: "put" } : operation));
        }
      };
      const refused = await runReconciliation(
        adapter,
        displayed,
        { confirmed: true, fingerprint: "fingerprint-refused" },
        revisionFor(doc, target)
      );
      ensure(refused.status === "consent-mismatch" && store.snapshot().subjects.length === 0);
      const stale = await runReconciliation(
        adapter,
        displayed,
        { confirmed: true, fingerprint: displayed.fingerprint },
        revisionFor(doc, changedTarget)
      );
      ensure(stale.status === "stale-plan" && store.snapshot().subjects.length === 0);
      const committed = await runReconciliation(
        adapter,
        displayed,
        { confirmed: true, fingerprint: displayed.fingerprint },
        revisionFor(doc, target)
      );
      ensure(committed.status === "local-written");
      ensure(store.snapshot().subjects.length === doc.subjects.length);
      return true;
    }
  },
  {
    id: "failed-commit-rolls-back",
    label: "Un échec de commit ne laisse aucune écriture partielle",
    async run() {
      const doc = basicDocument();
      const target = emptyRecords();
      const plan = buildPlan(doc, target);
      const store = createMemoryStore();
      store.failNextCommit();
      const adapter = {
        commit(operations) {
          return store.commit(operations.map((operation) =>
            operation.type === "add" ? { ...operation, type: "put" } : operation));
        }
      };
      const result = await runReconciliation(
        adapter,
        plan,
        { confirmed: true, fingerprint: plan.fingerprint },
        revisionFor(doc, target)
      );
      ensure(result.status === "failed");
      ensure(result.operations.length === 0);
      ensure(store.snapshot().subjects.length === 0 && store.snapshot().items.length === 0);
      return true;
    }
  }
];

const reimportChecks = [
  {
    id: "modern-reimport-idempotent",
    label: "Reimport d'une sauvegarde IndexedDB idempotent",
    run() {
      const records = documentToRecords(basicDocument());
      const backup = serializeIndexedDbBackup(records).document;
      ensure(backup.format === BACKUP_FORMAT && backup.version === undefined);
      const first = planImport(emptyRecords(), backup);
      const after = applyOperations(emptyRecords(), first);
      const second = planImport(after, backup);
      ensure(first.length > 0);
      ensure(second.length === 0);
      ensure(JSON.stringify(recordsToDocument(after)) === JSON.stringify(basicDocument()));
      return true;
    }
  },
  {
    id: "indexeddb-export-reimport-idempotent",
    label: "Reimport d'un export IndexedDB idempotent sans double préfixe",
    run() {
      const doc = basicDocument();
      doc.subjects[0].id = "synthetic-subject-a";
      const backup = serializeIndexedDbBackup(documentToRecords(doc)).document;
      const first = planImport(emptyRecords(), backup);
      const after = applyOperations(emptyRecords(), first);
      const second = planImport(after, backup);
      ensure(first.length > 0);
      ensure(second.length === 0);
      const ids = JSON.stringify(after);
      ensure(!ids.includes("legacy:legacy:"));
      ensure(after.subjects.some((record) => record.id === "synthetic-subject-a"));
      return true;
    }
  }
];

const restoreChecks = [
  {
    id: "restore-requires-backup",
    label: "La restauration exige une sauvegarde vérifiée et un remplacement explicite",
    run() {
      const current = documentToRecords(referenceDocument());
      const incoming = documentToRecords(basicDocument());
      const backup = serializeIndexedDbBackup(current).document;
      const refused = buildRestorePlan({
        current,
        records: incoming,
        backup: null
      });
      const ready = buildRestorePlan({
        current,
        records: incoming,
        backup,
        backupExpected: { counts: { subjects: current.subjects.length, items: current.items.length } }
      });
      ensure(refused.status === "backup-required" && refused.allowed === false);
      ensure(ready.status === "ready" && ready.allowed === true && ready.replacement === true);
      ensure(ready.counts.incoming.subjects === 2 && ready.counts.incoming.items === 4);
      ensure(allRecordsIntact(recordsToDocument(incoming)));
      return true;
    }
  },
  {
    id: "merge-not-restore",
    label: "Le merge additif reste distinct de la restauration",
    run() {
      const current = documentToRecords(basicDocument());
      const migrated = applyPlan(emptyRecords(), buildPlan(basicDocument(), emptyRecords()).operations);
      const plan = buildPlan(basicDocument(), migrated);
      ensure(plan.status === "already-migrated");
      ensure(plan.operations.length === 0);
      const incoming = documentToRecords(referenceDocument());
      const restore = buildRestorePlan({
        current,
        records: incoming,
        backup: serializeIndexedDbBackup(current).document,
        backupExpected: { counts: { subjects: current.subjects.length, items: current.items.length } }
      });
      ensure(restore.replacement === true);
      ensure(restore.counts.removed > 0);
      ensure(allRecordsIntact(recordsToDocument(incoming)));
      return true;
    }
  }
];

const logoutChecks = [
  {
    id: "logout-not-purge",
    label: "Déconnexion distincte d'une purge et avertissement sur changements en attente",
    run() {
      const { registry, baseA } = workspaceFixture();
      const pending = { status: "pending", count: 2 };
      const confirm = planWorkspaceLogout({ registry, url: URL_A, pending });
      ensure(confirm.action === "confirm" && confirm.allowed === false);
      ensure(typeof confirm.warning === "string" && confirm.warning.length > 0);
      const logout = planWorkspaceLogout({ registry, url: URL_A, pending, confirmed: true });
      ensure(logout.allowed === true);
      ensure(logout.nativeLogout && logout.nativeLogout.force === true);
      ensure(logout.deletions.length === 0 && logout.businessDeletes.length === 0 && logout.remoteDeletes.length === 0);
      const purge = planWorkspacePurge({
        registry,
        target: URL_A,
        effectiveDatabaseName: baseA,
        pending,
        confirmed: true
      });
      ensure(purge.allowed === true);
      ensure(purge.deletions.length === 1 && purge.deletions[0] === baseA);
      ensure(purge.businessDeletes.length === 0 && purge.remoteDeletes.length === 0);
      return true;
    }
  }
];

const urlChangeChecks = [
  {
    id: "abba-isolation",
    label: "Changement A/B/A sans mélange de bases locales",
    run() {
      const { registry, baseA, baseB } = workspaceFixture();
      ensure(baseA !== baseB);
      ensure(baseA.startsWith("threadstep-ws-"));
      const selectA = planWorkspaceSelection({ registry, target: URL_A });
      const selectB = planWorkspaceSelection({ registry: selectA.registry, target: URL_B });
      const selectAAgain = planWorkspaceSelection({ registry: selectB.registry, target: URL_A });
      ensure(selectA.allowed === true && selectB.allowed === true && selectAAgain.allowed === true);
      ensure(selectA.databaseName === baseA);
      ensure(selectB.databaseName === baseB);
      ensure(selectAAgain.databaseName === baseA);
      const startup = resolveWorkspaceStartup({ registry: selectAAgain.registry });
      ensure(startup.url === URL_A && startup.databaseName === baseA);
      return true;
    }
  }
];

const sessionChangeChecks = [
  {
    id: "account-binding",
    label: "Liaison de compte vérifiée avant accès métier",
    run() {
      const { registry, baseA } = workspaceFixture();
      const entry = createWorkspaceEntry({
        url: URL_A,
        databaseName: baseA,
        schemaVersion: 1,
        status: WORKSPACE_STATUS.ACTIVE,
        userDigest: hashWorkspaceUser(USER)
      });
      const bound = evaluateAccountBinding({ authenticated: true, userId: USER, entry, cacheHasRecords: true });
      const mismatch = evaluateAccountBinding({
        authenticated: true,
        userId: "user-e2e-other",
        entry,
        cacheHasRecords: true
      });
      const unverifiedEntry = { ...entry };
      delete unverifiedEntry.userDigest;
      const unverified = evaluateAccountBinding({
        authenticated: true,
        userId: USER,
        entry: unverifiedEntry,
        cacheHasRecords: true
      });
      const unbound = evaluateAccountBinding({
        authenticated: true,
        userId: USER,
        entry: unverifiedEntry,
        cacheHasRecords: false
      });
      ensure(registry.workspaces[URL_A].userDigest === hashWorkspaceUser(USER));
      ensure(bound.state === BINDING_STATE.BOUND && bound.businessAllowed === true);
      ensure(mismatch.state === BINDING_STATE.MISMATCH && mismatch.businessAllowed === false);
      ensure(unverified.state === BINDING_STATE.UNVERIFIED && unverified.businessAllowed === false);
      ensure(unbound.state === BINDING_STATE.UNBOUND && unbound.businessAllowed === true && unbound.bind === true);
      return true;
    }
  }
];

const networkChecks = [
  {
    id: "network-vs-storage",
    label: "Erreur réseau distincte d'une erreur de stockage local",
    run() {
      const network = classifySyncError({ name: "TypeError", messageCode: "network" });
      const storage = classifySyncError({ name: "QuotaExceededError" });
      const local = localError("Échec de transaction locale synthétique");
      ensure(network.category === DIAGNOSTIC_ERROR.NETWORK);
      ensure(storage.category === DIAGNOSTIC_ERROR.STORAGE);
      ensure(isLocalError(local) === true && isSyncError(local) === false);
      ensure(network.category !== storage.category);
      return true;
    }
  },
  {
    id: "offline-not-empty",
    label: "Le hors ligne ne transforme jamais le Cloud en cible vide",
    run() {
      const diagnostic = buildSyncDiagnostic({
        configured: true,
        online: false,
        databaseUrl: DESTINATION.url,
        remoteDbId: DESTINATION.remoteDbId,
        user: { isLoggedIn: true, userId: USER },
        syncState: { status: "offline", phase: "offline" },
        persistedSyncState: {
          initiallySynced: true,
          remoteDbId: DESTINATION.remoteDbId,
          serverRevision: 7,
          realms: [USER],
          databaseUrl: DESTINATION.url
        }
      });
      ensure(diagnostic.connection === CONNECTION_STATE.OFFLINE);
      ensure(diagnostic.remoteEvidence.state !== REMOTE_EVIDENCE.AVAILABLE);
      ensure(diagnostic.remoteEvidence.notEmpty === true);
      return true;
    }
  }
];

const stateChecks = [
  {
    id: "local-write-status",
    label: "Statut d'écriture locale véridique jusqu'à l'attestation native",
    run() {
      let state = reduceLocalWriteStatus(LOCAL_WRITE_STATE.NONE, { type: "commit-local" });
      ensure(state === LOCAL_WRITE_STATE.LOCAL);
      state = reduceLocalWriteStatus(state, { type: "sync-state", phase: SYNC_PHASE.PUSHING });
      ensure(state === LOCAL_WRITE_STATE.PENDING);
      state = reduceLocalWriteStatus(state, { type: "sync-complete", attested: false });
      ensure(state === LOCAL_WRITE_STATE.PENDING);
      state = reduceLocalWriteStatus(state, { type: "sync-complete", attested: true });
      ensure(state === LOCAL_WRITE_STATE.SYNCED);
      const indeterminate = reduceLocalWriteStatus(LOCAL_WRITE_STATE.LOCAL, {
        type: "sync-state",
        phase: SYNC_PHASE.IN_SYNC,
        initiallySynced: false
      });
      ensure(indeterminate === LOCAL_WRITE_STATE.INDETERMINATE);
      return true;
    }
  }
];

const securityChecks = [
  {
    id: "redacted-diagnostic",
    label: "Diagnostic d'espace redacted sans identifiant brut",
    run() {
      const { baseA } = workspaceFixture();
      const entry = createWorkspaceEntry({
        url: URL_A,
        databaseName: baseA,
        schemaVersion: 1,
        status: WORKSPACE_STATUS.ACTIVE,
        userDigest: hashWorkspaceUser(USER)
      });
      const diagnostic = buildWorkspaceDiagnostic({
        type: "synchronized",
        entry,
        url: URL_A,
        effectiveBase: baseA,
        remoteDbId: DESTINATION.remoteDbId,
        session: "authenticated",
        binding: BINDING_STATE.BOUND
      });
      const text = JSON.stringify(diagnostic) + JSON.stringify(workspaceDiagnosticRows(diagnostic));
      ensure(!text.includes(USER));
      ensure(!text.includes("@"));
      ensure(!/otp|token|secret|password/i.test(text));
      ensure(!/:\/\/[^/\s]+@/.test(text));
      return true;
    }
  }
];

const idempotenceChecks = [
  {
    id: "repeated-operations",
    label: "Plans et imports répétés sans effet supplémentaire",
    run() {
      const doc = basicDocument();
      const first = buildPlan(doc, emptyRecords());
      const second = buildPlan(doc, emptyRecords());
      ensure(first.fingerprint === second.fingerprint);
      const backup = serializeIndexedDbBackup(documentToRecords(doc)).document;
      const once = planImport(emptyRecords(), backup);
      const after = applyOperations(emptyRecords(), once);
      ensure(planImport(after, backup).length === 0);
      ensure(JSON.stringify(recordsToDocument(after)) === JSON.stringify(doc));
      return true;
    }
  }
];

const referenceChecks = [
  {
    id: "reference-modern-backup",
    label: "Référence de 5 sujets et 18 étapes conservée par la sauvegarde IndexedDB",
    async run() {
      const doc = referenceDocument();
      const records = documentToRecords(doc);
      ensure(records.subjects.length === 5 && records.items.length === 18);
      ensure(allRecordsIntact(recordsToDocument(records)));
      const backup = serializeIndexedDbBackup(records).document;
      const plan = planModernLocalImport(emptyRecords(), backup);
      ensure(plan.status === LOCAL_MERGE_STATUS.READY);
      ensure(plan.counts.subjects === 5 && plan.counts.items === 18);
      const store = createMemoryStore();
      const result = await store.commit(plan.operations);
      ensure(result.status === "recorded");
      const converted = recordsToDocument(store.snapshot());
      ensure(JSON.stringify(converted) === JSON.stringify(doc));
      ensure(allRecordsIntact(converted));
      return true;
    }
  },
  {
    id: "reference-modern-reconciliation",
    label: "Référence modern et relations conservées par la réconciliation planifiée",
    run() {
      const doc = referenceDocument();
      const plan = buildPlan(doc, emptyRecords());
      ensure(plan.status === "ready");
      ensure(plan.operations.length === 23);
      const applied = applyPlan(emptyRecords(), plan.operations);
      const projected = recordsToDocument(applied);
      ensure(projected.subjects.length === 5);
      ensure(projected.subjects.reduce((total, subject) => total + subject.items.length, 0) === 18);
      ensure(allRecordsIntact(projected));
      const original = documentToRecords(doc);
      projected.subjects.forEach((subject, subjectIndex) => {
        ensure(subject.title === original.subjects[subjectIndex].title);
        subject.items.forEach((item) => {
          const sourceItem = original.items.find((record) => record.id === item.id);
          ensure(sourceItem && item.title === sourceItem.title && item.priority === sourceItem.priority);
          ensure(item.done === sourceItem.done && item.note === sourceItem.note);
          ensure(item.parentId === null || projected.subjects.some((candidate) =>
            candidate.items.some((child) => child.id === item.parentId)));
        });
      });
      return true;
    }
  }
];

function manual(id, description) {
  return { id, evidence: EVIDENCE.REAL_DEXIE, description };
}

function limitation(description) {
  return { evidence: EVIDENCE.LIMITATION, description };
}

export const MATRIX = Object.freeze([
  {
    id: "local-only-bootstrap",
    domain: "local-only",
    capability: "local-indexeddb-persistence",
    requirement: "Autonomous local bootstrap",
    automated: localOnlyChecks,
    manual: [],
    limitations: [
      limitation(COMMON_LIMITATIONS.indexeddb),
      limitation(COMMON_LIMITATIONS.mobile)
    ],
    incidents: [],
    guarantees: ["persistence"]
  },
  {
    id: "local-persistence-relations",
    domain: "persistence",
    capability: "local-indexeddb-persistence",
    requirement: "Durable transactional business writes",
    automated: localPersistenceChecks,
    manual: [],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb)],
    incidents: [],
    guarantees: ["persistence", "idempotence"]
  },
  {
    id: "local-fingerprints",
    domain: "fingerprints",
    capability: "local-indexeddb-persistence",
    requirement: "Versioned schemas and stable identities",
    automated: fingerprintChecks,
    manual: [],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb)],
    incidents: [],
    guarantees: ["fingerprints", "idempotence"]
  },
  {
    id: "activation-consent",
    domain: "activation",
    capability: "cloud-opt-in-activation",
    requirement: "Isolation until transfer consent",
    automated: activationConsentChecks,
    manual: [manual("manual-activation-consent", "Observer la revue du plan et accepter explicitement le transfert avant toute écriture distante.")],
    limitations: [limitation(COMMON_LIMITATIONS.otp), limitation(COMMON_LIMITATIONS.nativeSync)],
    incidents: [],
    guarantees: ["security"]
  },
  {
    id: "activation-stages",
    domain: "activation",
    capability: "cloud-opt-in-activation",
    requirement: "Guided activation stages",
    automated: activationStageChecks,
    manual: [manual("manual-activation-stages", "Parcourir les étapes guidées, annuler avant consentement et vérifier que la source locale reste intacte.")],
    limitations: [limitation(COMMON_LIMITATIONS.otp)],
    incidents: [],
    guarantees: ["states", "security"]
  },
  {
    id: "target-classification",
    domain: "populated-target",
    capability: "cloud-opt-in-activation",
    requirement: "Attested target classification",
    automated: targetClassificationChecks,
    manual: [manual("manual-target-classification", "Vérifier une cible vide attestée, une cible peuplée, une divergence et une incohérence de compte.")],
    limitations: [limitation(COMMON_LIMITATIONS.serverConflict)],
    incidents: [],
    guarantees: ["states", "security"]
  },
  {
    id: "first-sync-evidence",
    domain: "first-sync",
    capability: "cloud-sync-lifecycle",
    requirement: "Activation first-sync evidence",
    automated: firstSyncChecks,
    manual: [manual("manual-first-sync", "Observer séparément le commit local, l'attente de synchronisation et la complétion distante attestée.")],
    limitations: [limitation(COMMON_LIMITATIONS.nativeSync)],
    incidents: [],
    guarantees: ["states", "persistence"]
  },
  {
    id: "divergence-blocked",
    domain: "divergence",
    capability: "data-reconciliation",
    requirement: "Conflict choices without silent overwrite",
    automated: divergenceChecks,
    manual: [manual("manual-divergence", "Introduire une divergence et une modification entre prévisualisation et confirmation, puis refuser l'ancien consentement.")],
    limitations: [limitation(COMMON_LIMITATIONS.serverConflict)],
    incidents: [],
    guarantees: ["security", "idempotence"]
  },
  {
    id: "concurrent-plans",
    domain: "concurrent-conflicts",
    capability: "data-reconciliation",
    requirement: "Consent bound to the displayed plan",
    automated: concurrentChecks,
    manual: [manual("manual-concurrent-plans", "Simuler deux plans concurrents sur deux navigateurs et vérifier le refus du plan périmé.")],
    limitations: [limitation(COMMON_LIMITATIONS.serverConflict), limitation(COMMON_LIMITATIONS.nativeSync)],
    incidents: [],
    guarantees: ["security", "idempotence"]
  },
  {
    id: "reimport-idempotence",
    domain: "json-reimport",
    capability: "data-backup-import-restore",
    requirement: "Reimport idempotency",
    automated: reimportChecks,
    manual: [manual("manual-reimport", "Réimporter deux fois le même JSON puis vérifier l'absence de doublon et de double préfixe.")],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb)],
    incidents: [],
    guarantees: ["idempotence", "persistence"]
  },
  {
    id: "restore-relations",
    domain: "restore",
    capability: "data-backup-import-restore",
    requirement: "Separate import merge from restoration",
    automated: restoreChecks,
    manual: [manual("manual-restore", "Restaurer une sauvegarde de test plus ancienne et vérifier sujets, étapes, notes, priorités, ordres et relations.")],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb)],
    incidents: [],
    guarantees: ["persistence", "idempotence"]
  },
  {
    id: "logout-with-pending",
    domain: "logout",
    capability: "workspace-identity-isolation",
    requirement: "Separate workspace, suspension, logout and purge actions",
    automated: logoutChecks,
    manual: [manual("manual-logout", "Tester la déconnexion avec écritures en attente puis la purge locale séparément, avec annulation et sauvegarde.")],
    limitations: [limitation(COMMON_LIMITATIONS.nativeLogout), limitation(COMMON_LIMITATIONS.nativeSync)],
    incidents: [],
    guarantees: ["security", "states"]
  },
  {
    id: "url-isolation",
    domain: "url-change",
    capability: "workspace-identity-isolation",
    requirement: "Distinct local base per remote URL",
    automated: urlChangeChecks,
    manual: [manual("manual-url-change", "Basculer A/B/A avec deux profils et vérifier qu'aucune donnée d'un autre espace n'est affichée, exportée ou copiée.")],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb)],
    incidents: [],
    guarantees: ["security", "persistence"]
  },
  {
    id: "account-binding",
    domain: "session-change",
    capability: "workspace-identity-isolation",
    requirement: "Account binding on a shared URL",
    automated: sessionChangeChecks,
    manual: [manual("manual-session-change", "Changer de session sur une même URL et vérifier que les données métier d'un autre compte restent masquées.")],
    limitations: [limitation(COMMON_LIMITATIONS.otp)],
    incidents: [],
    guarantees: ["security"]
  },
  {
    id: "network-error-states",
    domain: "network-errors",
    capability: "cloud-sync-lifecycle",
    requirement: "Transient and indeterminate native states stay distinct",
    automated: networkChecks,
    manual: [manual("manual-network-errors", "Couper puis rétablir le réseau pendant une écriture et vérifier la conservation locale et la reprise sans doublon.")],
    limitations: [limitation(COMMON_LIMITATIONS.nativeSync), limitation(COMMON_LIMITATIONS.serverConflict)],
    incidents: [],
    guarantees: ["states", "security"]
  },
  {
    id: "truthful-local-write-states",
    domain: "states",
    capability: "cloud-sync-lifecycle",
    requirement: "Truthful local write status",
    automated: stateChecks,
    manual: [manual("manual-local-write-states", "Observer les libellés enregistré localement, en attente et synchronisé dans le panneau de diagnostic.")],
    limitations: [limitation(COMMON_LIMITATIONS.nativeSync)],
    incidents: [],
    guarantees: ["states"]
  },
  {
    id: "redacted-diagnostics",
    domain: "security",
    capability: "workspace-identity-isolation",
    requirement: "Redacted workspace diagnostic",
    automated: securityChecks,
    manual: [manual("manual-redacted-diagnostics", "Capturer des statuts redacted sans URL, compte, OTP, jeton ni contenu métier.")],
    limitations: [limitation(COMMON_LIMITATIONS.mobile)],
    incidents: [],
    guarantees: ["security"]
  },
  {
    id: "repeated-operations-idempotence",
    domain: "idempotence",
    capability: "data-backup-import-restore",
    requirement: "Reimport idempotency",
    automated: idempotenceChecks,
    manual: [manual("manual-idempotence", "Répéter un import, une restauration et une conversion sans doublon ni perte.")],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb)],
    incidents: [],
    guarantees: ["idempotence"]
  },
  {
    id: "reference-v1-journey",
    domain: "persistence",
    capability: "threadstep-integration-profile",
    requirement: "ThreadStep historical V1 local conversion",
    automated: referenceChecks,
    manual: [manual("manual-reference-v1", "Rejouer la référence de 5 sujets et 18 étapes sur Chrome mobile puis vérifier les relations après rechargement.")],
    limitations: [limitation(COMMON_LIMITATIONS.indexeddb), limitation(COMMON_LIMITATIONS.mobile)],
    incidents: [],
    guarantees: ["persistence", "fingerprints", "idempotence"]
  }
]);

function normalizeSpecKey(value) {
  if (typeof value !== "string") return null;
  let key = value.trim();
  if (key.startsWith("openspec/specs/")) key = key.slice("openspec/specs/".length);
  if (key.endsWith("/spec.md")) key = key.slice(0, -"/spec.md".length);
  return key.length > 0 ? key : null;
}

export function parseRequirementTitles(specText) {
  if (typeof specText !== "string") return [];
  const titles = [];
  for (const line of specText.split(/\r?\n/)) {
    const match = /^### Requirement:\s*(.+?)\s*$/.exec(line);
    if (match) titles.push(match[1]);
  }
  return titles;
}

function specEntries(specs) {
  if (specs instanceof Map) return [...specs.entries()];
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    return Object.entries(specs);
  }
  return [];
}

export function validateTraceability(entries, specs) {
  const available = new Map();
  for (const [rawKey, text] of specEntries(specs)) {
    const key = normalizeSpecKey(rawKey);
    if (key) available.set(key, new Set(parseRequirementTitles(text)));
  }
  const errors = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = normalizeSpecKey(entry.capability);
    if (!key || !available.has(key)) {
      errors.push({
        scenario: entry.id,
        capability: entry.capability,
        requirement: entry.requirement,
        reason: "unknown-capability"
      });
      continue;
    }
    if (!available.get(key).has(entry.requirement)) {
      errors.push({
        scenario: entry.id,
        capability: entry.capability,
        requirement: entry.requirement,
        reason: "unknown-requirement"
      });
    }
  }
  return {
    ok: errors.length === 0,
    checked: Array.isArray(entries) ? entries.length : 0,
    capabilities: available.size,
    errors
  };
}

export function validateCoverage(entries) {
  const matrix = Array.isArray(entries) ? entries : MATRIX;
  const byDomain = new Map();
  for (const entry of matrix) {
    if (!entry || typeof entry.domain !== "string") continue;
    if (!byDomain.has(entry.domain)) byDomain.set(entry.domain, []);
    byDomain.get(entry.domain).push(entry);
  }
  const missingDomains = REQUIRED_DOMAINS.filter((domain) => !byDomain.has(domain));
  const missingCi = [];
  const missingManualOrLimitation = [];
  for (const domain of REQUIRED_DOMAINS) {
    const domainEntries = byDomain.get(domain);
    if (!domainEntries) continue;
    const hasCi = domainEntries.some((entry) => Array.isArray(entry.automated) && entry.automated.length > 0);
    const hasEvidence = domainEntries.some((entry) =>
      (Array.isArray(entry.manual) && entry.manual.length > 0) ||
      (Array.isArray(entry.limitations) && entry.limitations.length > 0));
    if (!hasCi) missingCi.push(domain);
    if (!hasEvidence) missingManualOrLimitation.push(domain);
  }
  const linkedGuarantees = new Set();
  for (const entry of matrix) {
    if (!entry || !REQUIRED_DOMAINS.includes(entry.domain)) continue;
    for (const guarantee of Array.isArray(entry.guarantees) ? entry.guarantees : []) {
      linkedGuarantees.add(guarantee);
    }
  }
  const missingGuarantees = CROSS_CUTTING_GUARANTEES.filter((guarantee) => !linkedGuarantees.has(guarantee));
  return {
    ok: missingDomains.length === 0 &&
      missingCi.length === 0 &&
      missingManualOrLimitation.length === 0 &&
      missingGuarantees.length === 0,
    missingDomains,
    missingCi,
    missingManualOrLimitation,
    missingGuarantees,
    requiredDomains: [...REQUIRED_DOMAINS]
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

async function runCheck(check) {
  try {
    const result = typeof check.run === "function" ? await check.run() : false;
    return result === true
      ? { id: check.id, label: check.label, status: STATUS.PASSED }
      : { id: check.id, label: check.label, status: STATUS.FAILED, reason: "assertion-failed" };
  } catch {
    return { id: check.id, label: check.label, status: STATUS.FAILED, reason: "check-error" };
  }
}

function normalizeIncident(incident, scenarioId = null) {
  const source = incident && typeof incident === "object" ? incident : {};
  return {
    id: typeof source.id === "string" && source.id.length > 0 ? source.id : "incident-synthetic",
    severity: typeof source.severity === "string" && source.severity.length > 0 ? source.severity : "unknown",
    status: source.status === STATUS.OPEN ? STATUS.OPEN : (source.status === "resolved" ? "resolved" : STATUS.OPEN),
    description: typeof source.description === "string" && source.description.length > 0
      ? source.description
      : "Incident de recette non documenté.",
    scenario: scenarioId
  };
}

function buildScenario(entry, asyncResults) {
  const checks = asyncResults.get(entry.id);
  const ciStatus = checks.length === 0
    ? STATUS.FAILED
    : checks.every((check) => check.status === STATUS.PASSED)
      ? STATUS.PASSED
      : STATUS.FAILED;
  const realDexie = (Array.isArray(entry.manual) ? entry.manual : []).map((observation) => ({
    id: observation.id,
    evidence: EVIDENCE.REAL_DEXIE,
    description: observation.description,
    status: STATUS.PENDING
  }));
  const limitations = (Array.isArray(entry.limitations) ? entry.limitations : []).map((item, index) => ({
    id: entry.id + "-limitation-" + String(index + 1),
    evidence: EVIDENCE.LIMITATION,
    description: item.description,
    status: STATUS.NOT_RUN
  }));
  const incidents = (Array.isArray(entry.incidents) ? entry.incidents : [])
    .map((incident) => normalizeIncident(incident, entry.id));
  const guarantees = Array.isArray(entry.guarantees) ? [...entry.guarantees] : [];
  const openIncident = incidents.some((incident) => incident.status === STATUS.OPEN);
  return {
    id: entry.id,
    domain: entry.domain,
    capability: entry.capability,
    requirement: entry.requirement,
    guarantees,
    ci: {
      evidence: EVIDENCE.CI,
      status: checks.length === 0 ? STATUS.FAILED : ciStatus,
      reason: checks.length === 0 ? "missing-ci-evidence" : null,
      checks
    },
    realDexie,
    limitations,
    incidents,
    ok: ciStatus === STATUS.PASSED && !openIncident
  };
}

export async function runAcceptanceMatrix(options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const matrix = Array.isArray(source.matrix) ? source.matrix : MATRIX;
  const asyncResults = new Map();
  for (const entry of matrix) {
    const checks = [];
    for (const check of Array.isArray(entry.automated) ? entry.automated : []) {
      checks.push(await runCheck(check));
    }
    asyncResults.set(entry.id, checks);
  }
  const scenarios = matrix.map((entry) => buildScenario(entry, asyncResults));
  const coverage = validateCoverage(matrix);
  const traceability = source.specs
    ? validateTraceability(matrix, source.specs)
    : { ok: false, checked: 0, capabilities: 0, status: STATUS.NOT_RUN, errors: [] };
  const entryIncidents = [];
  for (const scenario of scenarios) {
    for (const incident of scenario.incidents) entryIncidents.push(incident);
  }
  const extraIncidents = (Array.isArray(source.incidents) ? source.incidents : [])
    .map((incident) => normalizeIncident(incident));
  const incidents = [...entryIncidents, ...extraIncidents];
  const openIncidents = incidents.filter((incident) => incident.status === STATUS.OPEN);
  const limitations = [];
  for (const scenario of scenarios) {
    for (const item of scenario.limitations) {
      limitations.push({ ...item, scenario: scenario.id, domain: scenario.domain });
    }
  }
  const realDexie = [];
  for (const scenario of scenarios) {
    for (const observation of scenario.realDexie) {
      realDexie.push({ ...observation, scenario: scenario.id, domain: scenario.domain });
    }
  }
  const guarantees = {};
  for (const guarantee of CROSS_CUTTING_GUARANTEES) guarantees[guarantee] = [];
  for (const scenario of scenarios) {
    for (const guarantee of scenario.guarantees) {
      if (guarantees[guarantee] && !guarantees[guarantee].includes(scenario.domain)) {
        guarantees[guarantee].push(scenario.domain);
      }
    }
  }
  for (const guarantee of Object.keys(guarantees)) guarantees[guarantee].sort();
  const ciPassed = scenarios.filter((scenario) => scenario.ci.status === STATUS.PASSED).length;
  const ciFailed = scenarios.length - ciPassed;
  const counts = {
    scenarios: scenarios.length,
    automatedChecks: scenarios.reduce((total, scenario) => total + scenario.ci.checks.length, 0),
    ciPassed,
    ciFailed,
    realDexiePending: realDexie.length,
    limitations: limitations.length,
    openIncidents: openIncidents.length
  };
  const problems = [];
  for (const domain of coverage.missingDomains) problems.push("missing-domain:" + domain);
  for (const domain of coverage.missingCi) problems.push("missing-ci:" + domain);
  for (const domain of coverage.missingManualOrLimitation) problems.push("missing-manual-or-limitation:" + domain);
  for (const guarantee of coverage.missingGuarantees) problems.push("missing-guarantee:" + guarantee);
  for (const error of traceability.errors) {
    problems.push("traceability:" + error.reason + ":" + error.scenario);
  }
  for (const scenario of scenarios) {
    if (scenario.ci.status !== STATUS.PASSED) problems.push("ci-failed:" + scenario.id);
  }
  for (const incident of openIncidents) problems.push("open-incident:" + incident.id);
  if (source.specs && traceability.ok !== true) problems.push("traceability-failed");
  if (!source.specs) problems.push("traceability-not-run");
  const ok = problems.length === 0;
  return deepFreeze({
    mode: EVIDENCE.CI,
    ok,
    counts,
    scenarios,
    realDexie,
    limitations,
    incidents,
    guarantees,
    coverage,
    traceability,
    problems
  });
}

function statusLine(label, status) {
  return label + ": " + status;
}

export function formatAcceptanceReport(report) {
  const value = report && typeof report === "object" ? report : {};
  const counts = value.counts || {};
  const lines = [
    "Certification E2E ThreadStep — preuves CI local-first et Cloud",
    "Verdict global : " + (value.ok === true ? "réussi (CI et traçabilité)" : "non réussi / partiel"),
    "Mode : exécuteur déterministe sans réseau, sans horloge et sans écriture",
    "",
    "Synthèse",
    "- Scénarios : " + String(counts.scenarios || 0),
    "- Contrôles CI : " + String(counts.automatedChecks || 0) + " (" + String(counts.ciPassed || 0) + " scénarios réussis, " + String(counts.ciFailed || 0) + " en échec)",
    "- Preuves Dexie réelles en attente : " + String(counts.realDexiePending || 0),
    "- Limites déclarées : " + String(counts.limitations || 0),
    "- Incidents ouverts : " + String(counts.openIncidents || 0),
    "",
    "CI"
  ];
  for (const scenario of Array.isArray(value.scenarios) ? value.scenarios : []) {
    lines.push("- " + scenario.id + " [" + scenario.domain + "] " + statusLine("CI", scenario.ci.status));
    lines.push("  " + scenario.capability + " / " + scenario.requirement);
    for (const check of scenario.ci.checks) {
      lines.push("  - " + check.id + " : " + check.status);
    }
  }
  lines.push("", "Recette Dexie réelle");
  if (!Array.isArray(value.realDexie) || value.realDexie.length === 0) {
    lines.push("- Aucune observation réelle déclarée.");
  } else {
    for (const observation of value.realDexie) {
      lines.push("- " + observation.scenario + " / " + observation.id + " : " + observation.status);
    }
  }
  lines.push("", "Limites");
  if (!Array.isArray(value.limitations) || value.limitations.length === 0) {
    lines.push("- Aucune limite déclarée.");
  } else {
    for (const item of value.limitations) {
      lines.push("- " + item.scenario + " : " + item.description);
    }
  }
  lines.push("", "Incidents ouverts");
  const open = (Array.isArray(value.incidents) ? value.incidents : [])
    .filter((incident) => incident.status === STATUS.OPEN);
  if (open.length === 0) {
    lines.push("- Aucun incident ouvert déclaré.");
  } else {
    for (const incident of open) {
      lines.push("- " + incident.id + " [" + incident.severity + "] : " + incident.description);
    }
  }
  if (Array.isArray(value.problems) && value.problems.length > 0) {
    lines.push("", "Problèmes de certification");
    for (const problem of value.problems) lines.push("- " + problem);
  }
  return lines.join("\n");
}
