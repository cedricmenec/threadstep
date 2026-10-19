import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGenerationGuard,
  footerMessage,
  initialFooterStatus,
  reduceFooterStatus
} from "../site/migration-lifecycle.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

test("only the current generation may publish a diagnostic result", () => {
  const guard = createGenerationGuard();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test("footer ordering keeps real errors and notices authoritative", () => {
  let state = initialFooterStatus();
  state = reduceFooterStatus(state, { type: "error", message: "Erreur locale" });
  state = reduceFooterStatus(state, { type: "migration", generation: 2, message: "Diagnostic" });
  assert.equal(footerMessage(state), "Erreur locale");
  state = reduceFooterStatus(state, { type: "notice", message: "Notice" });
  assert.equal(footerMessage(state), "Notice");
});

test("older generations cannot replace a newer footer message", () => {
  let state = initialFooterStatus();
  state = reduceFooterStatus(state, { type: "migration", generation: 3, message: "Récent" });
  state = reduceFooterStatus(state, { type: "migration", generation: 2, message: "Ancien" });
  assert.equal(footerMessage(state), "Récent");
  state = reduceFooterStatus(state, { type: "migration-clear", generation: 2 });
  assert.equal(footerMessage(state), "Récent");
  state = reduceFooterStatus(state, { type: "migration-clear", generation: 3 });
  assert.equal(footerMessage(state), "");
});

test("the historical offer and dismissal storage are retired", () => {
  const lifecycle = read("site/migration-lifecycle.js");
  for (const symbol of [
    "DISMISSAL_STORAGE_KEY",
    "decideHistoricalOffer",
    "OFFER_ACTION",
    "readDismissalStore",
    "rememberDismissal",
    "localStorage"
  ]) {
    assert.equal(lifecycle.includes(symbol), false, symbol);
  }
  const app = read("site/app.js");
  for (const symbol of [
    "decideHistoricalOffer",
    "offerHistoricalMigration",
    "rememberDismissal",
    "readDismissalStore",
    "threadstep.migration.dismissals.v1"
  ]) {
    assert.equal(app.includes(symbol), false, symbol);
  }
});

test("the runtime still diagnoses native disconnections without a migration panel", () => {
  const app = read("site/app.js");
  assert.match(app, /renderSyncDiagnostic\(\)/);
  assert.match(app, /describeAttestationReason/);
  assert.equal(app.includes("panneau historique"), false);
  assert.equal(app.includes("Migration bloquée"), false);
  assert.equal(app.includes("Migration temporairement bloquée"), false);
});
