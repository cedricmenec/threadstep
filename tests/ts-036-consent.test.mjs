import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { emptyRecords } from "../site/persistence.js";
import {
  RESOLUTION,
  evaluateSyncAttestation,
  planReconciliation,
  projectPlanForReview,
  reviewDisplayedPlan,
  runReconciliation
} from "../site/migration-reconciliation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const destination = { url: "https://demo.dexie.cloud", remoteDbId: "remote-1" };
const userId = "user-1";

function fixture() {
  const document = emptyDocument();
  const first = newSubject("Projet", "s1");
  first.items.push(
    newItem("A", "normal", "a"),
    newItem("B", "normal", "b", "a"),
    newItem("B1", "normal", "b1", "b")
  );
  document.subjects.push(first, newSubject("Second", "s2"));
  return document;
}

function targetFor(document) {
  return {
    subjects: [{ id: "legacy:s2", title: "Second", order: 0 }],
    items: []
  };
}

function plan(document, target, extra = {}) {
  return planReconciliation({
    document,
    target,
    destination,
    userId,
    resolutions: {},
    provenance: { exportKind: "v1-raw" },
    ...extra
  });
}

function conflictPlan() {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(newItem("A", "normal", "a"));
  document.subjects.push(subject);
  const target = {
    subjects: [{ id: "legacy:s1", title: "Projet modifié", order: 0 }],
    items: [{ id: "legacy:a", subjectId: "legacy:s1", parentId: null, title: "A cloud", priority: "normal", done: false, order: 0 }]
  };
  return { document, target, built: plan(document, target) };
}

test("1.1 the review helper accepts an identical rendered plan", () => {
  const document = fixture();
  const built = plan(document, targetFor(document));
  const review = reviewDisplayedPlan(built, plan(document, targetFor(document)));
  assert.deepEqual(review, { same: true, reason: null });
  assert.deepEqual(projectPlanForReview(built).operations, projectPlanForReview(plan(document, targetFor(document))).operations);
});

test("1.1 a changed source, target, destination, user or resolution invalidates consent", () => {
  const document = fixture();
  const target = targetFor(document);
  const built = plan(document, target);
  const changedSource = clone(document);
  changedSource.subjects[0].title = "Projet modifié";
  assert.equal(reviewDisplayedPlan(built, plan(changedSource, target)).same, false);

  const changedTarget = clone(target);
  changedTarget.subjects[0].title = "Second modifié";
  assert.equal(reviewDisplayedPlan(built, plan(document, changedTarget)).same, false);

  assert.equal(reviewDisplayedPlan(built, plan(document, target, {
    destination: { url: "https://other.dexie.cloud", remoteDbId: "remote-1" }
  })).same, false);
  assert.equal(reviewDisplayedPlan(built, plan(document, target, {
    destination: { url: destination.url, remoteDbId: "remote-2" }
  })).same, false);
  assert.equal(reviewDisplayedPlan(built, plan(document, target, { userId: "user-2" })).same, false);

  const conflicted = conflictPlan();
  const kept = plan(conflicted.document, conflicted.target, {
    resolutions: { "subjects:legacy:s1": RESOLUTION.KEEP_CLOUD }
  });
  assert.equal(reviewDisplayedPlan(conflicted.built, kept).same, false);
});

test("1.1 a reordered operation list is detected even with an identical fingerprint", () => {
  const document = fixture();
  const built = plan(document, targetFor(document));
  assert.ok(built.operations.length > 1);
  const reordered = clone(built);
  reordered.operations = [reordered.operations[1], reordered.operations[0], ...reordered.operations.slice(2)];
  assert.deepEqual(reviewDisplayedPlan(built, reordered), { same: false, reason: "operations" });
});

test("1.1 a changed blocked group is detected even with an identical fingerprint", () => {
  const conflicted = conflictPlan();
  assert.ok(conflicted.built.blocked.length > 0);
  const changed = clone(conflicted.built);
  changed.blocked[0].reason = "parent-blocked";
  assert.deepEqual(reviewDisplayedPlan(conflicted.built, changed), { same: false, reason: "blocked" });
});

test("1.1 an already-migrated plan is stable and a different status needs review", () => {
  const document = { ...emptyDocument(), provenance: { exportKind: "v1-raw" } };
  document.subjects.push(newSubject("Projet", "s1"));
  const mapped = { subjects: [{ id: "legacy:s1", title: "Projet", order: 0 }], items: [] };
  const migrated = plan(document, mapped);
  assert.equal(migrated.status, "already-migrated");
  assert.equal(reviewDisplayedPlan(migrated, plan(document, mapped)).same, true);
  const emptyTarget = plan(document, emptyRecords());
  assert.equal(reviewDisplayedPlan(migrated, emptyTarget).same, false);
});

function attested() {
  return evaluateSyncAttestation({
    online: true,
    user: { isLoggedIn: true, userId },
    syncState: { phase: "in-sync", status: "connected" },
    persistedSyncState: {
      initiallySynced: true,
      remoteDbId: "remote-1",
      serverRevision: 42,
      realms: [userId]
    },
    databaseUrl: destination.url
  });
}

test("1.2 the commit gate refuses missing, mismatched and stale consent before any adapter call", async () => {
  const document = fixture();
  const target = targetFor(document);
  const displayed = plan(document, target);
  const fresh = { attestation: attested(), document, target, destination, userId };
  const calls = [];
  const adapter = { commit(operations) { calls.push(operations); return { status: "recorded" }; } };

  assert.equal((await runReconciliation(adapter, displayed, undefined, async () => fresh)).status, "refused");
  assert.equal((await runReconciliation(adapter, displayed, { confirmed: false, fingerprint: displayed.fingerprint },
    async () => fresh)).status, "refused");
  assert.equal((await runReconciliation(adapter, displayed, { confirmed: true, fingerprint: "wrong" },
    async () => fresh)).status, "consent-mismatch");
  assert.equal((await runReconciliation(adapter, displayed, { confirmed: true, fingerprint: displayed.fingerprint },
    async () => ({ ...fresh, document: null, target: emptyRecords() }))).status, "stale-plan");
  assert.equal((await runReconciliation(adapter, displayed, { confirmed: true, fingerprint: displayed.fingerprint },
    async () => ({ ...fresh, userId: "user-2" }))).status, "stale-plan");
  assert.equal(calls.length, 0);
});

test("1.2 reordered operations or changed blockers from revalidation are stale", async () => {
  const document = fixture();
  const target = targetFor(document);
  const displayed = plan(document, target);
  const fresh = plan(document, target);
  const calls = [];
  const adapter = { commit(operations) { calls.push(operations); return { status: "recorded" }; } };
  const consent = { confirmed: true, fingerprint: displayed.fingerprint };

  const reordered = clone(fresh);
  reordered.operations = [reordered.operations[1], reordered.operations[0], ...reordered.operations.slice(2)];
  const reorderedOutcome = await runReconciliation(adapter, displayed, consent,
    async () => ({ attestation: attested(), document, target, destination, userId, plan: reordered }));
  assert.equal(reorderedOutcome.status, "stale-plan");
  assert.equal(reorderedOutcome.reason, "operations");

  const conflicted = conflictPlan();
  const blocked = clone(conflicted.built);
  blocked.blocked[0].reason = "parent-blocked";
  const blockedOutcome = await runReconciliation(adapter, conflicted.built,
    { confirmed: true, fingerprint: conflicted.built.fingerprint },
    async () => ({
      attestation: attested(),
      document: conflicted.document,
      target: conflicted.target,
      destination,
      userId,
      plan: blocked
    }));
  assert.equal(blockedOutcome.status, "stale-plan");
  assert.equal(blockedOutcome.reason, "blocked");
  assert.equal(calls.length, 0);
});

test("1.2 the displayed plan commits exactly once when revalidation matches", async () => {
  const document = fixture();
  const target = targetFor(document);
  const displayed = plan(document, target);
  const fresh = plan(document, target);
  const calls = [];
  const adapter = { commit(operations) { calls.push(operations); return { status: "recorded" }; } };
  const outcome = await runReconciliation(adapter, displayed,
    { confirmed: true, fingerprint: displayed.fingerprint },
    async () => ({ attestation: attested(), document, target, destination, userId, plan: fresh }));
  assert.equal(outcome.status, "local-written");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], displayed.operations);
});

test("1.3 app captures the displayed plan and never uses a fresh fingerprint as consent", () => {
  const app = read("site/app.js");
  assert.match(app, /reviewDisplayedPlan,/);
  assert.match(app, /context\.displayedPlan/);
  assert.match(app, /previewFingerprint/);
  assert.match(app, /const displayed = context\.displayedPlan \|\| context\.plan/);
  assert.match(app, /const review = reviewDisplayedPlan\(displayed, fresh\)/);
  assert.match(app, /fingerprint: displayed\.fingerprint/);
  assert.match(app, /runReconciliation\(reconciliationAdapter\(\), displayed, consent/);
  assert.doesNotMatch(app, /fingerprint: fresh\.fingerprint/);
  assert.doesNotMatch(app, /removeItem\(STORAGE_KEY\)|setItem\(STORAGE_KEY/);
  const moduleSource = read("site/migration-reconciliation.js");
  assert.match(moduleSource, /export function reviewDisplayedPlan/);
  assert.match(moduleSource, /reviewDisplayedPlan\(plan, fresh\.plan\)/);
});
