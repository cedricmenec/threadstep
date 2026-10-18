import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "../site/fingerprint.js";
import {
  DISMISSAL_STORAGE_KEY,
  DISMISSAL_VERSION,
  OFFER_ACTION,
  addDismissal,
  computeDismissalKey,
  createGenerationGuard,
  decideHistoricalOffer,
  describeHistoricalOffer,
  footerMessage,
  initialFooterStatus,
  isDismissed,
  parseDismissalStore,
  readDismissalStore,
  reduceFooterStatus,
  rememberDismissal
} from "../site/migration-lifecycle.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const sourceFingerprint = sha256Hex("source-v1");
const destination = { url: "https://demo.dexie.cloud", remoteDbId: "remote-1" };
const userId = "user-1";

function key(overrides = {}) {
  return computeDismissalKey({
    sourceFingerprint,
    destination,
    userId,
    ...overrides
  });
}

function memoryStorage(initial = null) {
  return {
    value: initial,
    getItem(name) { return name === DISMISSAL_STORAGE_KEY ? this.value : null; },
    setItem(name, value) { if (name === DISMISSAL_STORAGE_KEY) this.value = value; }
  };
}

test("3.1 the dismissal key is stable and scoped by source, URL, remote database and user", () => {
  const first = key();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, key());
  assert.notEqual(first, key({ sourceFingerprint: sha256Hex("source-v2") }));
  assert.notEqual(first, key({ destination: { url: "https://other.dexie.cloud", remoteDbId: "remote-1" } }));
  assert.notEqual(first, key({ destination: { url: destination.url, remoteDbId: "remote-2" } }));
  assert.notEqual(first, key({ userId: "user-2" }));
  assert.equal(first.includes(userId), false);
});

test("3.1 the dismissal store is versioned, opaque and failure-safe", () => {
  const empty = parseDismissalStore("");
  assert.deepEqual(empty, { version: DISMISSAL_VERSION, keys: [] });
  assert.deepEqual(parseDismissalStore("{not json"), empty);
  assert.deepEqual(parseDismissalStore({ version: 99, keys: [key()] }), empty);

  const added = addDismissal(empty, key());
  assert.deepEqual(added, { version: DISMISSAL_VERSION, keys: [key()] });
  assert.equal(isDismissed(added, key()), true);
  assert.equal(isDismissed(added, key({ userId: "user-2" })), false);
  const duplicated = addDismissal(added, key());
  assert.equal(duplicated.keys.length, 1);
  assert.deepEqual(addDismissal(empty, "not-a-key"), empty);

  const unavailable = readDismissalStore(null);
  assert.deepEqual(unavailable, { version: DISMISSAL_VERSION, keys: [] });
  assert.equal(rememberDismissal(null, key()), false);
  const throwing = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("quota"); }
  };
  assert.deepEqual(readDismissalStore(throwing), empty);
  assert.equal(rememberDismissal(throwing, key()), false);
});

test("3.1 dismissal metadata contains no business content or raw identity", () => {
  const storage = memoryStorage();
  assert.equal(rememberDismissal(storage, key()), true);
  const serialized = storage.value;
  assert.equal(typeof serialized, "string");
  assert.equal(serialized.includes("Titre confidentiel"), false);
  assert.equal(serialized.includes("Note privée"), false);
  assert.equal(serialized.includes("alice@example.com"), false);
  assert.equal(serialized.includes(userId), false);
  assert.deepEqual(Object.keys(JSON.parse(serialized)).sort(), ["keys", "version"]);
  assert.match(serialized, /^[^{]*\{"version":1,"keys":\["[a-f0-9]{64}"\]\}$/);
});

test("3.2 an already-reconciled target suppresses the automatic import request", () => {
  const decision = decideHistoricalOffer({
    sourceStatus: "present",
    configured: true,
    authenticated: true,
    attestation: { attested: true },
    targetStatus: "ready",
    plan: { status: "already-migrated", operations: [], blocked: [] }
  });
  assert.equal(decision.action, OFFER_ACTION.ALREADY_RECONCILED);
  assert.equal(decision.reason, "already-migrated");
});

test("3.2 explicit dismissal suppresses automatic prompting but an explicit request reopens it", () => {
  const base = {
    sourceStatus: "present",
    configured: true,
    authenticated: true,
    dismissed: true,
    attestation: { attested: true },
    targetStatus: "ready",
    plan: { status: "ready", operations: [{ type: "add" }], blocked: [] }
  };
  assert.equal(decideHistoricalOffer(base).action, OFFER_ACTION.DISMISSED);
  assert.equal(decideHistoricalOffer({ ...base, explicitRequest: true }).action, OFFER_ACTION.PREVIEW);
  assert.equal(decideHistoricalOffer({ ...base, dismissed: false }).action, OFFER_ACTION.PREVIEW);
});

test("3.2 a source, URL or account change reopens safe verification", () => {
  const stored = addDismissal(parseDismissalStore(""), key());
  const changedSource = key({ sourceFingerprint: sha256Hex("source-changed") });
  const changedUrl = key({ destination: { url: "https://other.dexie.cloud", remoteDbId: destination.remoteDbId } });
  const changedDb = key({ destination: { url: destination.url, remoteDbId: "remote-2" } });
  const changedUser = key({ userId: "user-2" });
  for (const changed of [changedSource, changedUrl, changedDb, changedUser]) {
    assert.equal(isDismissed(stored, changed), false);
    const decision = decideHistoricalOffer({
      sourceStatus: "present",
      configured: true,
      authenticated: true,
      dismissed: false,
      attestation: { attested: true },
      targetStatus: "ready",
      plan: { status: "ready", operations: [{ type: "add" }], blocked: [] }
    });
    assert.equal(decision.action, OFFER_ACTION.PREVIEW);
  }
});

test("3.2 unavailable, offline or read-error states block without an import request", () => {
  const closed = decideHistoricalOffer({ sourceStatus: "absent", configured: true, authenticated: true });
  assert.equal(closed.action, OFFER_ACTION.CLOSED);
  const noDestination = decideHistoricalOffer({ sourceStatus: "present", configured: false, authenticated: true });
  assert.equal(noDestination.action, OFFER_ACTION.CLOSED);
  const signedOut = decideHistoricalOffer({ sourceStatus: "present", configured: true, authenticated: false });
  assert.equal(signedOut.action, OFFER_ACTION.CLOSED);
  const offline = decideHistoricalOffer({
    sourceStatus: "present",
    configured: true,
    authenticated: true,
    attestation: { attested: false, reason: "sync-offline" },
    targetStatus: "blocked"
  });
  assert.equal(offline.action, OFFER_ACTION.BLOCKED);
  assert.equal(offline.reason, "sync-offline");
  const readError = decideHistoricalOffer({
    sourceStatus: "present",
    configured: true,
    authenticated: true,
    attestation: { attested: true },
    targetStatus: "read-error"
  });
  assert.equal(readError.action, OFFER_ACTION.BLOCKED);
  assert.equal(readError.reason, "read-error");
});

test("3.2 the offer decision distinguishes preview, ambiguity and closed empty sources", () => {
  const ready = {
    sourceStatus: "present",
    configured: true,
    authenticated: true,
    attestation: { attested: true },
    targetStatus: "ready"
  };
  assert.equal(decideHistoricalOffer({
    ...ready,
    plan: { status: "ready", operations: [{ type: "add" }], blocked: [] }
  }).action, OFFER_ACTION.PREVIEW);
  assert.equal(decideHistoricalOffer({
    ...ready,
    plan: { status: "ready", operations: [], blocked: [{ store: "items", id: "x", reason: "quota" }] }
  }).action, OFFER_ACTION.PREVIEW);
  assert.equal(decideHistoricalOffer({
    ...ready,
    plan: { status: "ambiguous-provenance", operations: [], blocked: [] }
  }).action, OFFER_ACTION.PREVIEW);
  assert.equal(decideHistoricalOffer({
    ...ready,
    plan: { status: "empty-source", operations: [], blocked: [] }
  }).action, OFFER_ACTION.CLOSED);
});

test("3.1 the generation guard only accepts the latest started evaluation", () => {
  const guard = createGenerationGuard();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  assert.equal(guard.current(), second);
  const third = guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
  assert.equal(guard.isCurrent(third), true);
});

test("3.3 a healthy re-evaluation replaces a transient migration block", () => {
  let footer = initialFooterStatus();
  footer = reduceFooterStatus(footer, {
    type: "migration",
    generation: 1,
    message: "Migration temporairement bloquée : la déconnexion n'est pas résolue."
  });
  assert.match(footerMessage(footer), /Migration temporairement bloquée/);
  footer = reduceFooterStatus(footer, {
    type: "migration",
    generation: 2,
    message: describeHistoricalOffer({ action: OFFER_ACTION.PREVIEW })
  });
  assert.equal(footer.owner, "migration");
  assert.equal(footer.generation, 2);
  assert.doesNotMatch(footerMessage(footer), /temporairement bloquée|déconnexion/);
  footer = reduceFooterStatus(footer, {
    type: "migration",
    generation: 2,
    message: describeHistoricalOffer({ action: OFFER_ACTION.ALREADY_RECONCILED })
  });
  assert.match(footerMessage(footer), /déjà réconciliée/);
});

test("3.3 a real storage or read error survives a migration clear", () => {
  let footer = reduceFooterStatus(initialFooterStatus(), {
    type: "error",
    message: "Lecture IndexedDB impossible : aucune conclusion de base vide."
  });
  footer = reduceFooterStatus(footer, {
    type: "migration",
    generation: 1,
    message: "Migration temporairement bloquée."
  });
  assert.equal(footer.owner, "error");
  footer = reduceFooterStatus(footer, { type: "migration-clear", generation: 1 });
  assert.equal(footer.owner, "error");
  assert.match(footerMessage(footer), /Lecture IndexedDB impossible/);
});

test("3.3 a stale generation never replaces a newer footer message", () => {
  let footer = reduceFooterStatus(initialFooterStatus(), {
    type: "migration",
    generation: 2,
    message: "Plan de migration à relire."
  });
  footer = reduceFooterStatus(footer, {
    type: "migration",
    generation: 1,
    message: "Ancien blocage transitoire."
  });
  assert.equal(footer.generation, 2);
  assert.match(footerMessage(footer), /Plan de migration/);
  footer = reduceFooterStatus(footer, { type: "migration-clear", generation: 1 });
  assert.equal(footer.owner, "migration");
  footer = reduceFooterStatus(footer, { type: "migration-clear", generation: 2 });
  assert.equal(footer.owner, null);
  assert.equal(footerMessage(footer), "");
});

test("3.3 migration messages never claim a remote synchronization", () => {
  const messages = Object.values(OFFER_ACTION).map((action) => describeHistoricalOffer({ action }));
  for (const message of messages) {
    assert.doesNotMatch(message, /synchronis|push distant|convergence/i);
  }
});

test("4.1 app re-evaluates the historical offer on every native signal with a generation guard", () => {
  const app = read("site/app.js");
  assert.match(app, /from "\.\/migration-lifecycle\.js"/);
  assert.match(app, /createGenerationGuard\(\)/);
  assert.match(app, /const generation = migrationLifecycle\.begin\(\)/);
  assert.match(app, /migrationLifecycle\.isCurrent\(generation\)/);
  assert.match(app, /subscribe\(cloud\.syncState\)/);
  assert.match(app, /subscribe\(cloud\.persistedSyncState\)/);
  assert.match(app, /subscribe\(cloud\.currentUser\)/);
  const subscribeBlock = app.match(/const subscribe = \(observable\) => \{[\s\S]*?\n    \};/);
  assert.ok(subscribeBlock, "native observable subscription present");
  assert.match(subscribeBlock[0], /offerHistoricalMigration\(\)/);
  assert.match(app, /addEventListener\("online"[\s\S]*?offerHistoricalMigration\(\)/);
  assert.match(app, /addEventListener\("offline"[\s\S]*?offerHistoricalMigration\(\)/);
  assert.match(app, /event\.key === STORAGE_KEY\) void offerHistoricalMigration\(\)/);
  assert.match(app, /setupSyncDiagnostics\(\);\s*void offerHistoricalMigration\(\)/);
  assert.match(app, /sameMigrationIdentity\(identity, currentIdentity\)/);
  assert.match(app, /return \{ action: "superseded" \}/);
});

test("4.2 app renders each offer action and keeps consent only for the displayed plan", () => {
  const app = read("site/app.js");
  assert.match(app, /decideHistoricalOffer\(/);
  assert.match(app, /applyHistoricalOffer\(/);
  assert.match(app, /OFFER_ACTION\.BLOCKED/);
  assert.match(app, /OFFER_ACTION\.PREVIEW/);
  assert.match(app, /OFFER_ACTION\.ALREADY_RECONCILED/);
  assert.match(app, /OFFER_ACTION\.DISMISSED/);
  assert.match(app, /OFFER_ACTION\.CLOSED/);
  assert.match(app, /renderMigrationAlreadyReconciled/);
  assert.match(app, /const same = !!existing && existing\.sourceFingerprint === payload\.sourceFingerprint/);
  assert.match(app, /reviewDisplayedPlan\(existing\.displayedPlan, payload\.plan\)\.same/);
  assert.match(app, /renderMigrationPanel\(context\);\s*notify\("Plan modifié/);
});

test("4.3 the retained V1 area stays reachable without deleting or rewriting V1", () => {
  const html = read("site/index.html");
  assert.match(html, /id="historical-backup"/);
  assert.match(html, /aria-labelledby="historical-backup-title"/);
  assert.match(html, /id="historical-backup-download"[^>]*type="button"/);
  assert.match(html, /id="historical-backup-verify"[^>]*type="button"/);
  assert.match(html, /Exporter la sauvegarde historique/);
  assert.match(html, /Vérifier la sauvegarde historique/);
  const app = read("site/app.js");
  assert.match(app, /function renderHistoricalBackup\(\)/);
  assert.match(app, /function verifyHistoricalBackup\(\)/);
  assert.match(app, /offerHistoricalMigration\(\{ explicit: true \}\)/);
  assert.match(app, /historicalBackupDownloadEl\.addEventListener\("click", exportLegacyBackup\)/);
  assert.match(app, /historicalBackupVerifyEl\.addEventListener\("click", verifyHistoricalBackup\)/);
  assert.doesNotMatch(app, /removeItem\(STORAGE_KEY\)|setItem\(STORAGE_KEY/);
  const local = app.match(/function renderLocalWorkspace\([\s\S]*?\n\}/);
  assert.ok(local, "local workspace renderer remains present");
  assert.match(local[0], /localConversionEl/);
});

test("4.4 migration messages use the owned footer reducer", () => {
  const app = read("site/app.js");
  assert.match(app, /reduceFooterStatus\(footerStatus, event\)/);
  assert.match(app, /function notifyMigration\(generation, message\)/);
  assert.match(app, /function clearMigrationFooter\(generation\)/);
  assert.match(app, /notifyMigration\(generation, message\)/);
  assert.match(app, /clearMigrationFooter\(generation\)/);
  assert.match(app, /notifyError\(/);
  assert.doesNotMatch(app, /statusEl\.textContent = message/);
});

test("5.1 the product documentation records the TS-036 lifecycle contract", () => {
  const guide = read("docs/product/developer-guide.md");
  const rollout = read("docs/product/dexie-cloud-rollout.md");
  for (const source of [guide, rollout]) {
    assert.match(source, /TS-036/);
    assert.match(source, /plan affiché|displayed plan/i);
    assert.match(source, /génération|generation/i);
    assert.match(source, /écartement|dismissal/i);
    assert.match(source, /réconcili|reconcil/i);
  }
  assert.match(guide, /site\/migration-lifecycle\.js/);
  assert.match(guide, /threadstep\.migration\.dismissals\.v1/);
  assert.match(guide, /threadstep\.document\.v1/);
  assert.match(rollout, /TS-040/);
});

test("3.3 two concurrent sync evaluations and a reload never restore a stale block", () => {
  const guard = createGenerationGuard();
  const older = guard.begin();
  const newer = guard.begin();
  let footer = initialFooterStatus();
  if (guard.isCurrent(newer)) {
    footer = reduceFooterStatus(footer, {
      type: "migration",
      generation: newer,
      message: describeHistoricalOffer({ action: OFFER_ACTION.ALREADY_RECONCILED })
    });
  }
  if (guard.isCurrent(older)) {
    footer = reduceFooterStatus(footer, {
      type: "migration",
      generation: older,
      message: "Migration temporairement bloquée : ancien résultat."
    });
  }
  assert.match(footerMessage(footer), /déjà réconciliée/);
  assert.doesNotMatch(footerMessage(footer), /temporairement bloquée/);

  const reloaded = createGenerationGuard();
  assert.equal(reloaded.isCurrent(newer), false);
  const afterReload = reloaded.begin();
  assert.equal(reloaded.isCurrent(afterReload), true);
});
