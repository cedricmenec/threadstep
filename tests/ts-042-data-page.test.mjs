import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyDocument, newSubject, newItem } from "../site/core.js";
import { documentToRecords } from "../site/persistence.js";
import {
  BACKUP_ERROR,
  BACKUP_FORMAT,
  parseIndexedDbBackup,
  serializeIndexedDbBackup,
  unsupportedV1Refusal
} from "../site/indexeddb-backup.js";
import { buildBusinessExport } from "../site/data-integrity-recovery.js";
import { planReconciliation } from "../site/migration-reconciliation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");
const guide = read("docs/product/guide-utilisation.md");
const acceptance = read("docs/product/acceptance-checklist.md");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

const dataPage = between(
  html,
  '<section id="settings-data-page"',
  '<section id="settings-sync-page"'
);
const hero = between(html, '<header class="hero">', "</header>");
const dashboard = html.slice(
  html.indexOf('<section class="dashboard"'),
  html.indexOf('<section id="cloud-config"')
);
const restorePanel = between(
  dataPage,
  '<section id="restore-panel"',
  "</section>"
);

function fixtureRecords() {
  const document = emptyDocument();
  const subject = newSubject("Sujet de sauvegarde", "s1");
  subject.items.push(newItem("Étape principale", "normal", "i1"));
  subject.items.push({ ...newItem("Sous-étape", "urgent", "i2"), parentId: "i1" });
  document.subjects.push(subject);
  return documentToRecords(document);
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
}

test("data controls are moved once into the Imports / Exports page", () => {
  for (const id of ["business-tools", "export", "import", "restore", "restore-panel"]) {
    assert.equal(occurrences(html, 'id="' + id + '"'), 1, id + " must occur exactly once");
    assert.match(dataPage, new RegExp('id="' + id + '"'), id + " must be in the data page");
    assert.doesNotMatch(hero, new RegExp('id="' + id + '"'), id + " must not remain in the hero");
    assert.doesNotMatch(dashboard, new RegExp('id="' + id + '"'), id + " must not remain in the dashboard");
  }
});

test("the three data actions keep their distinct sections and explanations", () => {
  assert.match(dataPage, /<h3 id="settings-export-title">Exporter<\/h3>/);
  assert.match(dataPage, /<h3 id="settings-import-title">Importer et fusionner<\/h3>/);
  assert.match(dataPage, /<h3 id="settings-restore-title">Restaurer un état antérieur<\/h3>/);
  assert.match(dataPage, /sauvegarde JSON locale/i);
  assert.match(dataPage, /threadstep\.indexeddb-backup/);
  assert.match(dataPage, /additif et non destructif/i);
  assert.match(dataPage, /ne supprime ni ne remplace/i);
  assert.match(dataPage, /restauration remplace l'état actuel/i);
  assert.match(dataPage, /sauvegarde préalable/i);
  assert.match(dataPage, /RESTAURER/);
  assert.match(dataPage, /n'est jamais déclenchée par une navigation, un rechargement ou une annulation/i);
});

test("restore panel keeps its safeguards, status regions and identifiers", () => {
  assert.match(restorePanel, /\shidden(\s|>)/);
  assert.match(restorePanel, /id="restore-title"/);
  assert.match(restorePanel, /class="restore-warning"/);
  assert.match(restorePanel, /id="restore-scope"/);
  assert.match(restorePanel, /id="restore-backup-status"/);
  assert.match(restorePanel, /id="restore-download-backup"/);
  assert.match(restorePanel, /<label for="restore-confirmation">[^<]*RESTAURER/);
  assert.match(restorePanel, /<input id="restore-confirmation"/);
  assert.match(restorePanel, /<button id="restore-confirm"[^>]*disabled/);
  assert.match(restorePanel, /id="restore-cancel"/);
  assert.match(restorePanel, /id="restore-status"[^>]*role="status"/);
});

test("data styles stack sections, hide inputs and keep 44px touch targets", () => {
  const section = between(css, ".settings-destination.data-section{", "}");
  assert.match(section, /display:flex/);
  assert.match(section, /flex-direction:column/);
  assert.match(section, /max-width:100%/);
  assert.match(section, /overflow-wrap:anywhere/);
  const tools = between(css, "#business-tools{", "}");
  assert.match(tools, /flex-direction:column/);
  assert.match(tools, /max-width:100%/);
  assert.match(css, /#business-tools\[hidden\]\{display:none\}/);
  const inputs = between(css, "#import,#restore{", "}");
  assert.match(inputs, /position:absolute/);
  assert.match(inputs, /width:1px/);
  assert.match(inputs, /height:1px/);
  assert.match(inputs, /opacity:0/);
  const targets = between(css, ".settings-destination.data-section .secondary", "}");
  assert.match(targets, /min-width:44px/);
  assert.match(targets, /min-height:44px/);
  assert.match(css, /\.settings-destination\.data-section\{padding:12px\}/);
});

test("existing handlers are attached exactly once without a second engine", () => {
  assert.equal(occurrences(app, 'document.querySelector("#export").addEventListener("click", exportBusinessBackup)'), 1);
  assert.equal(occurrences(app, 'document.querySelector("#import").addEventListener("change"'), 1);
  assert.equal(occurrences(app, 'restoreInputEl.addEventListener("change"'), 1);
  assert.equal(occurrences(app, "function exportBusinessBackup("), 1);
  assert.equal(occurrences(app, "function openRestorePreview("), 1);
  assert.equal(occurrences(app, "function confirmRestore("), 1);
  const importBlock = between(
    app,
    'document.querySelector("#import").addEventListener("change"',
    'if (navMenuButtonEl)'
  );
  assert.match(importBlock, /parseIndexedDbBackup\(text\)/);
  assert.match(importBlock, /offerJsonReconciliation\(parsed\.records\)/);
  assert.match(importBlock, /openLocalImportPreview\(parsed\.records\)/);
  const restoreBlock = between(app, "async function openRestorePreview(", "\nfunction buildRestoreBackup(");
  assert.match(restoreBlock, /parseIndexedDbBackup\(text\)/);
});

test("business visibility and settings routing stay free of data side effects", () => {
  const visibility = between(app, "function applyBusinessVisibility(", "\n}\n");
  assert.match(visibility, /businessToolsEl\.hidden = configured && \(!authenticated \|\| bindingBlocked\)/);
  const settingsVisibility = between(app, "function applySettingsVisibility(", "\n}\n");
  assert.doesNotMatch(settingsVisibility, /\.open\s*\(|fetch\s*\(|indexedDB|localStorage|startAuthentication|businessStore|confirmRestore/i);
  assert.match(settingsVisibility, /settingsDataPageEl\.hidden = section !== "data"/);
});

test("restore requires backup, exact confirmation and a fresh allowed plan", () => {
  assert.match(restorePanel, /class="restore-panel"[^>]*hidden/);
  const update = between(app, "function updateRestoreConfirmState(", "\n}\n");
  assert.match(update, /restoreConfirmEl\.disabled = !\(plan && plan\.allowed\) \|\| !restoreContext\.backupDownloaded/);
  assert.match(update, /restoreConfirmationEl\.value !== "RESTAURER"/);
  const confirm = between(app, "async function confirmRestore(", "\nfunction recoveryInstanceContext(");
  assert.match(confirm, /!restoreContext\.backupDownloaded/);
  assert.match(confirm, /restoreConfirmationEl\.value !== "RESTAURER"/);
  assert.match(confirm, /if \(!plan \|\| !plan\.allowed\)/);
  assert.match(confirm, /freshPlan\.fingerprint !== plan\.fingerprint/);
  assert.match(confirm, /await businessStore\.commit\(operations\)/);
});

test("navigation, cancellation and file resets never trigger an implicit restore", () => {
  const hashchange = between(app, 'window.addEventListener("hashchange"', "\n});");
  assert.doesNotMatch(hashchange, /confirmRestore|businessStore\.commit|diffRecords|buildRestorePlan|openRestorePreview/);
  const cancel = between(app, 'if (restoreCancelEl) restoreCancelEl.addEventListener("click"', "\n});");
  assert.match(cancel, /hideRestorePanel\(\)/);
  assert.doesNotMatch(cancel, /confirmRestore|businessStore\.commit|diffRecords|buildRestorePlan/);
  const restoreChange = between(app, 'if (restoreInputEl) restoreInputEl.addEventListener("change"', "\n});");
  assert.doesNotMatch(restoreChange, /confirmRestore|businessStore\.commit|diffRecords/);
  const importChange = between(app, 'document.querySelector("#import").addEventListener("change"', 'if (navMenuButtonEl)');
  const reset = between(importChange, "} finally {", "}");
  assert.match(reset, /event\.target\.value = ""/);
  assert.doesNotMatch(reset, /confirmRestore|businessStore\.commit|diffRecords|buildRestorePlan/);
  assert.doesNotMatch(app, /beforeunload|pagehide/);
});

test("contextual safety backups and raw recovery exports remain in place", () => {
  const workspaceConfirmation = between(
    html,
    '<div id="workspace-confirmation"',
    "</div>\n      <section id=\"legacy-cleanup\""
  );
  assert.match(workspaceConfirmation, /id="workspace-backup"/);
  const recoveryPanel = between(html, '<section id="recovery-panel"', '<section id="sync-diagnostic"');
  assert.match(recoveryPanel, /id="recovery-raw-export"/);
  assert.doesNotMatch(dataPage, /id="workspace-backup"/);
  assert.doesNotMatch(dataPage, /id="recovery-raw-export"/);
  assert.match(app, /workspaceBackupEl\.addEventListener\("click", \(\) => \{ downloadWorkspaceSnapshot\(\); \}\)/);
  assert.match(app, /recoveryRawExportEl\.addEventListener\("click", exportRawRecovery\)/);
});

test("business export stays identical, counted and free of secrets", () => {
  const records = fixtureRecords();
  const built = buildBusinessExport(records, { schemaVersion: 3 });
  const serialized = serializeIndexedDbBackup(records, { schemaVersion: 3 });
  assert.equal(built.status, "ready");
  assert.equal(serialized.ok, true);
  assert.deepEqual(built.document, serialized.document);
  assert.equal(built.document.format, BACKUP_FORMAT);
  assert.deepEqual(built.document.counts, { subjects: 1, items: 2 });
  assert.deepEqual(built.document.records.subjects, serialized.document.records.subjects);
  assert.deepEqual(built.document.records.items, serialized.document.records.items);
  assert.equal(built.document.records.subjects[0].id, "s1");
  assert.equal(built.document.records.items.length, 2);
  const keys = collectKeys(built.document);
  for (const forbidden of ["email", "otp", "token", "password", "cloudUrl", "remoteDbId"]) {
    assert.equal(keys.includes(forbidden), false, forbidden + " must not be exported");
  }
});

test("modern import is accepted, additive and idempotent", () => {
  const records = fixtureRecords();
  const parsed = parseIndexedDbBackup(serializeIndexedDbBackup(records).document);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.code, "backup-valid");
  const first = planReconciliation({
    records: parsed.records,
    target: { subjects: [], items: [] },
    destination: { url: "https://demo.dexie.cloud" },
    userId: "user"
  });
  assert.equal(first.status, "ready");
  assert.ok(first.operations.length > 0);
  assert.equal(first.operations.every((operation) => operation.type === "add"), true);
  const second = planReconciliation({
    records: parsed.records,
    target: JSON.parse(JSON.stringify(parsed.records)),
    destination: { url: "https://demo.dexie.cloud" },
    userId: "user"
  });
  assert.equal(second.operations.length, 0);
});

test("duplicate identifiers, dangling references, V1 and malformed JSON are refused", () => {
  const valid = serializeIndexedDbBackup(fixtureRecords()).document;
  const duplicate = JSON.parse(JSON.stringify(valid));
  duplicate.records.subjects.push({ ...duplicate.records.subjects[0] });
  assert.equal(parseIndexedDbBackup(duplicate).code, BACKUP_ERROR.DUPLICATE_ID);
  const dangling = JSON.parse(JSON.stringify(valid));
  dangling.records.items[0].subjectId = "missing";
  assert.equal(parseIndexedDbBackup(dangling).code, BACKUP_ERROR.DANGLING_REFERENCE);
  const v1 = { version: 1, subjects: [] };
  const frozen = JSON.stringify(v1);
  const refused = parseIndexedDbBackup(v1);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, BACKUP_ERROR.UNSUPPORTED_V1);
  assert.equal(refused.writes, undefined);
  assert.equal(unsupportedV1Refusal(refused.code).writes, false);
  assert.equal(JSON.stringify(v1), frozen);
  const malformed = parseIndexedDbBackup("ceci n'est pas du JSON");
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, BACKUP_ERROR.INVALID);
  assert.equal(malformed.writes, undefined);
});

test("documentation places the data actions on the dedicated page", () => {
  for (const source of [guide, acceptance]) {
    assert.match(source, /#\/parametres\/donnees/);
    assert.match(source, /Imports \/ Exports/);
    assert.match(source, /accueil/i);
  }
  assert.match(guide, /L'accueil \*\*n'affiche plus\*\* la barre d'actions/i);
  assert.match(guide, /sauvegarde de sécurité/i);
  assert.match(guide, /diagnostic de récupération/i);
  assert.match(acceptance, /l'accueil ne duplique plus la barre d'actions/i);
  assert.match(acceptance, /sauvegarde de sécurité/i);
  assert.match(acceptance, /export brut/i);
});
