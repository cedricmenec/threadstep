import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyDocument, newSubject, newItem, parseRoute, isViewEntry,
  substepView, toggleExpandedParent
} from "../site/core.js";
import { documentToRecords, recordsToDocument } from "../site/persistence.js";
import {
  authorizedWorkspaceIdentityKey, shouldResetExpandedParents
} from "../site/interaction-continuity.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const continuity = readFileSync(new URL("../site/interaction-continuity.js", import.meta.url), "utf8");

const loadBody = app.slice(app.indexOf("function load() {"), app.indexOf("async function refreshLocalDocument("));
const resetBody = app.slice(app.indexOf("function resetExpandedViewState() {"), app.indexOf("function currentAuthorizedWorkspaceIdentity("));
const identityBody = app.slice(app.indexOf("function currentAuthorizedWorkspaceIdentity() {"), app.indexOf("function applyExpandedIdentityBoundary() {"));
const boundaryBody = app.slice(app.indexOf("function applyExpandedIdentityBoundary() {"), app.indexOf("function load() {"));
const renderBody = app.slice(app.indexOf("function render() {"), app.indexOf("function navigate("));
const toggleBody = app.slice(app.indexOf("function renderSubstepToggle("), app.indexOf("function renderActions("));
const revealBody = app.slice(app.indexOf("function expandAncestorForFocus("), app.indexOf("function render() {"));
const hashchangeBody = app.slice(app.indexOf('window.addEventListener("hashchange"'), app.indexOf("if (cleanupKeepEl)"));
const importHandlerBody = app.slice(app.indexOf('document.querySelector("#import")'), app.indexOf("window.addEventListener(\"hashchange\""));
const localConfirmBody = app.slice(app.indexOf("async function confirmLocalImport("), app.indexOf("function renderAuthPanel("));
const reconciliationBody = app.slice(app.indexOf("async function confirmReconciliation("), app.indexOf("const workspaceLegacyConfig = readCloudConfig();"));
const subscribeBody = app.slice(app.indexOf("function subscribeToChanges()"), app.indexOf("let migrationPanelEl"));
const broadcastHandlerBody = subscribeBody.slice(
  subscribeBody.indexOf('channel.addEventListener("message"'),
  subscribeBody.indexOf("// Dexie Cloud emits")
);
const syncCompleteHandlerBody = subscribeBody.slice(
  subscribeBody.indexOf("syncedDatabase.cloud.events.syncComplete.subscribe")
);

const IDENTITY_A = {
  type: "synchronized",
  databaseName: "threadstep-ws-alpha",
  userDigest: "a".repeat(64)
};

test("TS-050 identity helper resets only for a different available authorized workspace", () => {
  assert.equal(authorizedWorkspaceIdentityKey({ type: "local" }), "local");
  assert.equal(
    authorizedWorkspaceIdentityKey(IDENTITY_A),
    "synced:threadstep-ws-alpha:" + IDENTITY_A.userDigest
  );
  assert.equal(authorizedWorkspaceIdentityKey({ type: "synchronized" }), null);
  assert.equal(authorizedWorkspaceIdentityKey({ type: "indeterminate", databaseName: "x" }), null);
  assert.equal(authorizedWorkspaceIdentityKey(null), null);

  assert.equal(shouldResetExpandedParents("local", { type: "local" }), false);
  assert.equal(shouldResetExpandedParents("local", IDENTITY_A), true);
  assert.equal(shouldResetExpandedParents(authorizedWorkspaceIdentityKey(IDENTITY_A), { ...IDENTITY_A }), false);
  assert.equal(shouldResetExpandedParents(authorizedWorkspaceIdentityKey(IDENTITY_A), {
    ...IDENTITY_A,
    userDigest: "b".repeat(64)
  }), true);
  assert.equal(shouldResetExpandedParents(authorizedWorkspaceIdentityKey(IDENTITY_A), {
    ...IDENTITY_A,
    databaseName: "threadstep-ws-beta"
  }), true);
  assert.equal(shouldResetExpandedParents(authorizedWorkspaceIdentityKey(IDENTITY_A), null), false);
  assert.equal(shouldResetExpandedParents(authorizedWorkspaceIdentityKey(IDENTITY_A), {
    type: "synchronized"
  }), false);
  assert.equal(shouldResetExpandedParents(null, IDENTITY_A), false);
});

test("TS-050 load refreshes data while the dedicated reset clears expansion and pending collapse focus", () => {
  assert.doesNotMatch(loadBody, /expandedParents|resetExpandedViewState/);
  assert.match(loadBody, /openMenuId = null/);
  assert.match(loadBody, /refreshSyncedDocument\(\)|refreshLocalDocument\(\)/);
  assert.match(resetBody, /expandedParents = new Set\(\)/);
  assert.match(resetBody, /pendingCollapseFocus = null/);
  assert.doesNotMatch(resetBody, /localStorage|documentState|persist\(/);
});

test("TS-050 render applies the authorized-identity boundary before building the view", () => {
  assert.match(identityBody, /if \(!businessAllowed\(\)\) return null/);
  assert.match(boundaryBody, /shouldResetExpandedParents\(expandedParentIdentityKey, identity\)/);
  assert.match(boundaryBody, /resetExpandedViewState\(\)/);
  assert.match(boundaryBody, /if \(nextKey !== null\) expandedParentIdentityKey = nextKey/);
  const boundaryIndex = renderBody.indexOf("applyExpandedIdentityBoundary();");
  const revealIndex = renderBody.indexOf("expandAncestorForFocus();");
  assert.ok(boundaryIndex >= 0 && revealIndex > boundaryIndex);
});

test("TS-050 expansion remains memory-only and adds no storage, schema or export field", () => {
  assert.match(app, /let expandedParents = new Set\(\);/);
  assert.match(app, /let expandedParentIdentityKey = null;/);
  assert.doesNotMatch(app, /expandedParents[^\n]*localStorage|localStorage[^\n]*expandedParents/);
  assert.doesNotMatch(app, /expandedParents[^\n]*documentState|documentState[^\n]*expandedParents/);
  assert.doesNotMatch(continuity, /localStorage|sessionStorage|IndexedDB|window\.|document\.|fetch\(/);
});

test("TS-050 syncComplete and BroadcastChannel each use the non-resetting refresh path", () => {
  assert.ok(broadcastHandlerBody.length > 0);
  assert.ok(syncCompleteHandlerBody.length > 0);
  assert.match(broadcastHandlerBody, /channel\.addEventListener\("message", \(\) => \{ load\(\); \}\)/);
  assert.doesNotMatch(broadcastHandlerBody, /resetExpandedViewState|expandedParents = new Set/);
  assert.match(syncCompleteHandlerBody, /load\(\);/);
  assert.doesNotMatch(syncCompleteHandlerBody, /resetExpandedViewState|expandedParents = new Set/);
});

test("TS-050 completion keeps groups open while the filter still hides completed substeps", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  const parentA = newItem("Parent A", "normal", "p1");
  const childA1 = newItem("Enfant A1", "normal", "a1", "p1");
  const childA2 = newItem("Enfant A2", "normal", "a2", "p1");
  const parentB = newItem("Parent B", "normal", "p2");
  const childB = newItem("Enfant B", "normal", "b1", "p2");
  const parentC = newItem("Parent C", "normal", "p3");
  const childC = newItem("Enfant C terminé", "normal", "c1", "p3");
  childC.done = true;
  subject.items.push(parentA, childA1, childA2, parentB, childB, parentC, childC);
  document.subjects.push(subject);
  const expanded = new Set(["p1", "p2"]);

  childA1.done = true;
  const openView = substepView(subject.items, "p1", false, expanded);
  assert.equal(openView.hasVisibleSubsteps, true);
  assert.equal(openView.collapsed, false);
  assert.equal(openView.renderChildren, true);

  const filteredView = substepView(subject.items, "p1", true, expanded);
  assert.equal(filteredView.collapsed, false);
  assert.deepEqual(filteredView.children.map((item) => item.id), ["a2"]);

  const childlessView = substepView(subject.items, "p3", true, expanded);
  assert.equal(childlessView.hasVisibleSubsteps, false);
  assert.equal(childlessView.renderChildren, false);

  assert.equal(substepView(subject.items, "p2", true, expanded).collapsed, false);
  const collapsedA = toggleExpandedParent(expanded, "p1");
  assert.equal(collapsedA.has("p1"), false);
  assert.equal(collapsedA.has("p2"), true);
  assert.equal(expanded.has("p1"), true);
});

test("TS-050 only a parsed view entry resets before render and aria-expanded is unchanged", () => {
  assert.match(hashchangeBody, /const nextRoute = parseRoute\(location\.hash\)/);
  assert.match(hashchangeBody, /if \(isViewEntry\(route, nextRoute\)\) resetExpandedViewState\(\)/);
  const resetIndex = hashchangeBody.indexOf("resetExpandedViewState()");
  const renderIndex = hashchangeBody.indexOf("render();");
  assert.ok(resetIndex >= 0 && renderIndex > resetIndex);
  assert.equal(isViewEntry(parseRoute("#/"), parseRoute("#/")), false);
  assert.equal(isViewEntry(parseRoute("#/sujet/s1"), parseRoute("#/sujet/s1")), false);
  assert.equal(isViewEntry(parseRoute("#/"), parseRoute("#/sujet/s1")), true);
  assert.match(toggleBody, /toggle\.setAttribute\("aria-expanded", view\.collapsed \? "false" : "true"\)/);
});

test("TS-050 a pending reveal expands its ancestor before rendering and refreshes write nothing", () => {
  assert.match(revealBody, /substepAncestorId\(subject\.items, focusItemId\)/);
  assert.match(revealBody, /expandedParents = toggleExpandedParent\(expandedParents, ancestorId\)/);
  assert.doesNotMatch(revealBody, /persist\(|localStorage/);
  assert.ok(renderBody.indexOf("expandAncestorForFocus();") < renderBody.indexOf("document.createDocumentFragment()"));
  assert.doesNotMatch(loadBody, /persist\(|localStorage/);
  assert.doesNotMatch(resetBody, /persist\(|localStorage/);
  assert.doesNotMatch(toggleBody, /persist\(|localStorage/);
});

test("TS-050 a local import resets only after a successful confirmation", () => {
  assert.doesNotMatch(importHandlerBody, /expandedParents|resetExpandedViewState/);
  const zeroPlanIndex = localConfirmBody.indexOf("plan.operations.length === 0");
  assert.ok(zeroPlanIndex > 0);
  assert.doesNotMatch(localConfirmBody.slice(0, zeroPlanIndex), /resetExpandedViewState/);
  assert.match(localConfirmBody, /if \(plan\.operations\.length === 0\) \{\s*resetExpandedViewState\(\);/);
  assert.match(localConfirmBody, /await businessStore\.commit\(plan\.operations\);[\s\S]*?resetExpandedViewState\(\);/);
});

test("TS-050 a Cloud import resets after written or already up-to-date outcomes only", () => {
  assert.match(reconciliationBody, /if \(outcome\.status === "local-written"\) \{\s*resetExpandedViewState\(\);/);
  assert.match(reconciliationBody, /else if \(outcome\.status === "already-migrated" \|\| outcome\.status === "up-to-date"\) \{\s*resetExpandedViewState\(\);/);
  assert.equal((reconciliationBody.match(/resetExpandedViewState\(\)/g) || []).length, 2);
  const refusedIndex = reconciliationBody.indexOf('outcome.status === "refused"');
  assert.ok(refusedIndex > 0);
  assert.doesNotMatch(reconciliationBody.slice(refusedIndex), /resetExpandedViewState/);
});

test("TS-050 preserving or resetting expansion never mutates product data or its export", () => {
  const document = emptyDocument();
  const subject = newSubject("Projet", "s1");
  subject.items.push(
    newItem("Parent", "urgent", "p1"),
    newItem("Enfant 1", "normal", "c1", "p1"),
    newItem("Enfant 2", "normal", "c2", "p1")
  );
  document.subjects.push(subject);
  const snapshot = JSON.stringify(document);
  const recordsSnapshot = JSON.stringify(documentToRecords(document));

  let expanded = new Set();
  expanded = toggleExpandedParent(expanded, "p1");
  assert.equal(substepView(subject.items, "p1", false, expanded).collapsed, false);
  expanded = toggleExpandedParent(expanded, "p1");
  assert.equal(substepView(subject.items, "p1", false, expanded).collapsed, true);

  assert.equal(JSON.stringify(document), snapshot);
  assert.equal(JSON.stringify(documentToRecords(document)), recordsSnapshot);
  assert.deepEqual(recordsToDocument(documentToRecords(document)), document);
});
