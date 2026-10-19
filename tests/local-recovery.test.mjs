import test from "node:test";
import assert from "node:assert/strict";
import {
  RETIRED_V1_KEYS,
  CLEANUP_CODE,
  buildCleanupInventory,
  evaluateCleanup,
  runCleanup
} from "../site/local-recovery.js";

function storage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { writes.push(["set", key]); map.set(key, String(value)); },
    removeItem(key) { writes.push(["remove", key]); map.delete(key); },
    has(key) { return map.has(key); }
  };
}

test("inventory lists only present retired V1 keys, never technical Cloud settings", () => {
  const store = storage({
    "threadstep.document.v1": "{}",
    "threadstep.migration.v1": "{}",
    "threadstep.resume.v1": "{}",
    "threadstep.migration.dismissals.v1": "{}",
    "threadstep.cloud.config.v1": JSON.stringify({ databaseUrl: "https://demo.dexie.cloud" }),
    "threadstep.activation.v1": "{}",
    "threadstep.workspaces.v1": "{}",
    "unrelated": "value"
  });
  const inventory = buildCleanupInventory(store);
  assert.deepEqual(inventory.keys.slice().sort(), RETIRED_V1_KEYS.slice().sort());
  assert.equal(inventory.scope, "current-origin");
  for (const key of ["threadstep.cloud.config.v1", "threadstep.activation.v1", "threadstep.workspaces.v1", "unrelated"]) {
    assert.equal(inventory.keys.includes(key), false);
  }
});

test("defaults to deleting nothing and requires a verified backup and metadata migration", () => {
  const store = storage({ "threadstep.document.v1": "{}" });
  const inventory = buildCleanupInventory(store);
  assert.equal(evaluateCleanup({ inventory }).defaultChoice, "keep");
  assert.equal(evaluateCleanup({ inventory }).code, CLEANUP_CODE.BACKUP_REQUIRED);
  assert.equal(evaluateCleanup({ inventory, backupVerified: true }).code, CLEANUP_CODE.MIGRATION_REQUIRED);
  assert.equal(evaluateCleanup({
    inventory,
    backupVerified: true,
    metadataMigrationComplete: true
  }).code, CLEANUP_CODE.CONSENT_REQUIRED);
  assert.equal(store.has("threadstep.document.v1"), true);
  assert.deepEqual(store.writes, []);
});

test("consented cleanup removes only listed keys with targeted removeItem calls", () => {
  const store = storage({
    "threadstep.document.v1": "{}",
    "threadstep.migration.v1": "{}",
    "threadstep.resume.v1": "{}",
    "threadstep.cloud.config.v1": JSON.stringify({ databaseUrl: "https://demo.dexie.cloud" }),
    "unrelated": "value"
  });
  const inventory = buildCleanupInventory(store);
  const result = runCleanup(store, inventory, {
    confirmed: true,
    backupVerified: true,
    metadataMigrationComplete: true
  });
  assert.deepEqual(result.removed.slice().sort(), RETIRED_V1_KEYS.filter((key) => key !== "threadstep.migration.dismissals.v1").sort());
  assert.deepEqual(result.remaining, []);
  assert.equal(store.has("threadstep.cloud.config.v1"), true);
  assert.equal(store.has("unrelated"), true);
  assert.equal(store.writes.every(([type]) => type === "remove"), true);
});

test("cancellation and errors leave every value intact", () => {
  const store = storage({ "threadstep.document.v1": "{}", "threadstep.resume.v1": "{}" });
  const inventory = buildCleanupInventory(store);
  const cancelled = runCleanup(store, inventory, {
    confirmed: false,
    backupVerified: true,
    metadataMigrationComplete: true
  });
  assert.equal(cancelled.status, CLEANUP_CODE.CANCELLED);
  assert.deepEqual(cancelled.removed, []);
  assert.equal(store.has("threadstep.document.v1"), true);
  assert.equal(store.has("threadstep.resume.v1"), true);

  const failing = {
    getItem: store.getItem,
    removeItem(key) {
      if (key === "threadstep.resume.v1") throw new Error("refused");
      store.removeItem(key);
    }
  };
  const failed = runCleanup(failing, inventory, {
    confirmed: true,
    backupVerified: true,
    metadataMigrationComplete: true
  });
  assert.equal(failed.status, CLEANUP_CODE.PARTIAL);
  assert.deepEqual(failed.removed, ["threadstep.document.v1"]);
  assert.deepEqual(failed.remaining, ["threadstep.resume.v1"]);
  assert.equal(store.has("threadstep.resume.v1"), true);
});

test("no automatic startup, reload, sync or migration path invokes cleanup", () => {
  // The pure module exposes no startup hook; the browser wiring only calls
  // runCleanup from the explicit delete button. This test locks that contract.
  const source = new URL("../site/app.js", import.meta.url);
  return import("node:fs").then(({ readFileSync }) => {
    const app = readFileSync(source, "utf8");
    const occurrences = app.match(/runCleanup\(/g) || [];
    assert.equal(occurrences.length, 1);
    assert.match(app, /if \(cleanupDeleteEl\) cleanupDeleteEl\.addEventListener\("click"/);
    assert.doesNotMatch(app, /localStorage\.clear\s*\(/);
    assert.doesNotMatch(app, /indexedDB\.deleteDatabase\s*\(/);
  });
});

test("the cleanup panel is wired to the existing workspace controls with a keep default", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
  for (const id of ["legacy-cleanup", "legacy-cleanup-list", "legacy-cleanup-confirm", "legacy-cleanup-keep", "legacy-cleanup-delete", "legacy-cleanup-status"]) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.match(html, /id="legacy-cleanup-keep"[^>]*>Ne rien effacer</);
  assert.match(html, /id="legacy-cleanup-delete"[^>]*disabled/);
  assert.match(app, /cleanupKeepEl\.addEventListener\("click"/);
  assert.match(app, /cleanupDeleteEl\.addEventListener\("click"/);
  assert.match(app, /renderCleanupPanel\(\)/);
  assert.match(app, /evaluateCleanup\(/);
  assert.match(app, /runCleanup\(localStorage/);
});
