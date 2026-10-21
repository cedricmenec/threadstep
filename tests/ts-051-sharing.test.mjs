import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHARE_MESSAGES,
  SHARE_STATUS,
  createDiagnosticSharingController
} from "../site/sync-diagnostic-report.js";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../site/styles.css", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function between(start, end) {
  const from = app.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(to, -1, end);
  return app.slice(from, to);
}

const controllerBody = between("function ensureSyncSharingController() {",
  "function buildSyncSharingPanel() {");
const panelBody = between("function buildSyncSharingPanel() {",
  "async function copySyncDiagnosticForAssistance() {");
const copyBody = between("async function copySyncDiagnosticForAssistance() {",
  "function toggleSyncDiagnosticPreview() {");
const toggleBody = between("function toggleSyncDiagnosticPreview() {",
  "function setupSyncDiagnostics() {");
const paintBody = between("function paintSyncDiagnostic(diagnostic, options = {}) {",
  "function renderSyncDiagnostic() {");
const sharingBodies = [controllerBody, panelBody, copyBody, toggleBody, paintBody].join("\n");

test("TS-051 copy button is always available and never gated by session or remote state", () => {
  const buttonBody = between('const copy = el("button", "secondary sync-diagnostic-copy"',
    'copy.addEventListener("click"');
  assert.match(buttonBody, /Copier le diagnostic pour assistance/);
  assert.match(buttonBody, /copy\.id = "sync-diagnostic-copy"/);
  assert.doesNotMatch(buttonBody, /disabled|configured|session|remote|online|view\.retry/);
  assert.doesNotMatch(panelBody, /\.disabled\s*=/);
  assert.doesNotMatch(panelBody, /configured|remoteEvidence|session/);
});

test("TS-051 preview is keyboard-operable, selectable and read-only", () => {
  assert.match(panelBody, /sync-diagnostic-preview-toggle/);
  assert.match(panelBody, /aria-expanded/);
  assert.match(panelBody, /aria-controls", "sync-diagnostic-preview"/);
  assert.match(panelBody, /document\.createElement\("textarea"\)/);
  assert.match(panelBody, /textarea\.readOnly = true/);
  assert.match(panelBody, /textarea\.value = state\.text/);
  assert.match(panelBody, /textarea\.spellcheck = false/);
  assert.match(panelBody, /sync-diagnostic-preview-label/);
  assert.match(panelBody, /label\.htmlFor = "sync-diagnostic-preview-text"/);
});

test("TS-051 sharing status is announced through role=status and keeps textual feedback", () => {
  assert.match(panelBody, /shareStatus\.id = "sync-diagnostic-share-status"/);
  assert.match(panelBody, /shareStatus\.setAttribute\("role", "status"\)/);
  assert.match(panelBody, /shareStatus\.setAttribute\("aria-live", "polite"\)/);
  assert.match(panelBody, /shareStatus\.setAttribute\("aria-atomic", "true"\)/);
  assert.match(panelBody, /copy\.setAttribute\("aria-describedby", "sync-diagnostic-share-status"\)/);
  assert.match(SHARE_MESSAGES[SHARE_STATUS.MANUAL], /copiez-le manuellement/i);
  assert.doesNotMatch(SHARE_MESSAGES[SHARE_STATUS.MANUAL], /Diagnostic copié/);
});

test("TS-051 handlers use the sharing controller and never trigger sync side effects", () => {
  assert.match(copyBody, /syncSharingController\.copy\(\)/);
  assert.match(toggleBody, /syncSharingController\.togglePreview\(\)/);
  assert.match(panelBody, /copySyncDiagnosticForAssistance/);
  assert.match(panelBody, /toggleSyncDiagnosticPreview/);
  for (const body of [copyBody, toggleBody]) {
    assert.doesNotMatch(body, /renderSyncDiagnostic|retrySyncInitialPull|syncDiagnosticsController\.retry/);
    assert.doesNotMatch(body, /\.login\(|syncPull|nativePullAdapter|refreshSyncedDocument/);
    assert.doesNotMatch(body, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/);
    assert.doesNotMatch(body, /import|purge|migration/i);
  }
});

test("TS-051 report is built only on user action and preview refresh preserves state", () => {
  assert.match(controllerBody, /createDiagnosticSharingController/);
  assert.match(controllerBody, /buildSyncDiagnosticReport/);
  assert.match(controllerBody, /getWriteText: \(\) => diagnosticClipboardWriter\(\)/);
  assert.doesNotMatch(controllerBody, /window\.isSecureContext[\s\S]*?buildSyncDiagnosticReport/);
  assert.match(paintBody, /if \(!preserveShareReport && syncSharingController\.getState\(\)\.previewOpen\) \{\s*syncSharingController\.refreshPreview\(\);/);
  assert.match(panelBody, /state\.previewOpen \? "Masquer l'aperçu du diagnostic" : "Afficher l'aperçu du diagnostic"/);
  assert.match(panelBody, /preview\.hidden = !state\.previewOpen/);

  let current = "rapport initial";
  const controller = createDiagnosticSharingController({
    buildReport: () => ({ text: current, sections: [], unavailable: [] }),
    getWriteText: () => null
  });
  controller.openPreview();
  current = "rapport actualisé";
  assert.equal(controller.getState().text, "rapport initial");
  controller.refreshPreview();
  assert.equal(controller.getState().text, "rapport actualisé");
  assert.equal(controller.getState().previewOpen, true);
});

test("TS-051 copy and preview repaints keep the exact report that was produced", () => {
  assert.match(copyBody, /paintSyncDiagnostic\(lastSyncDiagnostic, \{ preserveShareReport: true \}\)/);
  assert.match(toggleBody, /paintSyncDiagnostic\(lastSyncDiagnostic, \{ preserveShareReport: true \}\)/);
  let builds = 0;
  const controller = createDiagnosticSharingController({
    buildReport: () => {
      builds += 1;
      return { text: "rapport numéro " + builds, sections: [], unavailable: [] };
    },
    getWriteText: () => async () => {}
  });
  controller.openPreview();
  return controller.copy().then((result) => {
    assert.equal(result.text, controller.getState().text);
    assert.equal(result.text, "rapport numéro 2");
  });
});

test("TS-051 re-render restores sharing focus without scrolling", () => {
  assert.match(paintBody, /document\.activeElement/);
  assert.match(paintBody, /SYNC_SHARE_CONTROL_IDS\.has\(activeElement\.id\)/);
  assert.match(paintBody, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(paintBody, /scrollIntoView|scrollTo|location\.hash/);
  assert.doesNotMatch(sharingBodies, /scrollIntoView/);
});

test("TS-051 sharing path never interprets text as HTML or adds persistence/network", () => {
  assert.doesNotMatch(sharingBodies, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(sharingBodies, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|sendBeacon/);
  assert.doesNotMatch(sharingBodies, /createObjectURL|Blob\(/);
  assert.match(panelBody, /el\("p", "sync-diagnostic-share-status", state\.status\.message\)/);
});

test("TS-051 mobile styles provide a 44 px target and a scrollable preview", () => {
  assert.match(css, /\.sync-diagnostic-copy,\.sync-diagnostic-preview-toggle\{min-height:44px;min-width:44px/);
  assert.match(css, /\.sync-diagnostic-preview-text\{[^}]*width:100%/);
  assert.match(css, /\.sync-diagnostic-preview-text\{[^}]*white-space:pre-wrap/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /\.sync-diagnostic-share\{flex-direction:column/);
  assert.match(css, /\.sync-diagnostic-copy:focus-visible/);
});

test("TS-051 new modules are registered in the npm check syntax command", () => {
  assert.match(pkg.scripts.check, /node --check site\/sync-diagnostic-report\.js/);
  assert.match(pkg.scripts.check, /node --check site\/sync-lifecycle-instrumentation\.js/);
  assert.match(pkg.scripts.test, /node --test tests\/\*\.test\.mjs/);
});
