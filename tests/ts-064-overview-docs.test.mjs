import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAV_MENU_ENTRIES, parseRoute, STORAGE_KEY, RESUME_KEY } from "../site/core.js";
import { overviewSourceFiles } from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const doc = read("docs/product/react-overview-cards.md");
const guide = read("docs/product/developer-guide.md");
const html = read("site/index.html");
const app = read("site/app.js");
const packageJson = JSON.parse(read("package.json"));

test("TS-064 documentation maps ownership, boundaries, continuity, diagnostics, rollback and evidence", () => {
  const headings = [
    "Carte de propriété DOM",
    "Points de montage",
    "Frontières route, identité, blocage et lecture",
    "Cycle de mise à jour",
    "Diagnostic",
    "Commandes de test",
    "Retour arrière",
    "Preuves automatisées et recette humaine",
    "Limites"
  ];
  assert.match(doc, /^# Cartes projets Overview/m);
  const positions = headings.map((heading) => {
    const index = doc.indexOf("## " + heading);
    assert.notEqual(index, -1, heading);
    return index;
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  for (const phrase of [
    /#subjects/,
    /#app-shell-root/,
    /createReactBoundary/,
    /overview-adapter\.js/,
    /surface-decision\.js/,
    /OverviewSurface\.jsx/,
    /ProjectCard\.jsx/,
    /overviewPreview/,
    /Voir plus/,
    /#\/sujet\/<id>/,
    /npm run check/,
    /npm run build/,
    /npm run verify:build/,
    /non cochée par `apply`/,
    /Chrome Android/,
    /lecteur d'écran/
  ]) {
    assert.match(doc, phrase);
  }
  assert.ok(existsSync(resolve(root, "site/overview/overview-adapter.js")));
  assert.ok(existsSync(resolve(root, "site/overview/surface-decision.js")));
  assert.ok(existsSync(resolve(root, "site/overview/OverviewSurface.jsx")));
  assert.match(guide, /Cartes projets Overview React \(TS-064\)/);
  assert.match(guide, /site\/overview\/overview-adapter\.js/);
  assert.match(guide, /reactBoundary/);
  assert.match(guide, /tests\/ts-064-overview-\*\.test\.mjs/);
  assert.match(guide, /docs\/product\/react-overview-cards\.md/);
  assert.match(guide, /recette desktop et Chrome Android reste manuelle|recette humaine/);
});

test("TS-064 routes, storage keys and JSON contracts are unchanged", () => {
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.deepEqual(parseRoute("#/sujet/p1"), { view: "subject", subjectId: "p1" });
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  assert.equal(NAV_MENU_ENTRIES.length, 4);
  const source = overviewSourceFiles().map((entry) => entry.source).join("\n");
  assert.doesNotMatch(source, /localStorage\.setItem|indexedDB\.open|threadstep\.[a-z]+\.v\d/);
  assert.doesNotMatch(source, /location\.hash\s*=|pushState|replaceState/);
});

test("TS-064 adds no dependency, CSP change or remote asset", () => {
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
    "dexie",
    "dexie-cloud-addon",
    "react",
    "react-dom"
  ]);
  assert.equal(packageJson.dependencies.react, "19.3.1");
  assert.equal(packageJson.dependencies["react-dom"], "19.3.1");
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.ok(csp);
  assert.equal(
    csp[1],
    "default-src 'self'; connect-src https://*.dexie.cloud wss://*.dexie.cloud; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
  );
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
  assert.doesNotMatch(html, /url\(https?:\/\//i);
});

test("TS-064 preserves #subjects, filters, form ids and vanilla surfaces", () => {
  const ids = [
    "subjects",
    "subject-form",
    "hide-completed",
    "overview-urgency-filter",
    "overview-filter-all",
    "overview-filter-urgent",
    "overview-filter-following",
    "overview-filter-completed",
    "dashboard",
    "projects-loading",
    "sync-summary",
    "sync-settings-access",
    "app-shell-root"
  ];
  for (const id of ids) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " must occur exactly once");
  }
  assert.match(html, /<div id="subjects" class="subjects" aria-live="polite"><\/div>/);
  assert.match(app, /const subjectsEl = document\.querySelector\("#subjects"\)/);
  assert.match(app, /const subjectForm = document\.querySelector\("#subject-form"\)/);
  assert.match(app, /function setOverviewProjectFilter\(mode, focusControl = false\)/);
  assert.match(app, /function renderSuggestion\(\)/);
  assert.match(app, /function renderResumeCard\(\)/);
  assert.match(app, /function renderUrgencyList\(\)/);
  assert.match(app, /function applyOverviewCounter\(presentation\)/);
  assert.doesNotMatch(sourceOfOverview(), /subject-form|hide-completed|id="overview-filter|dashboard|projects-loading|sync-summary/);
});

function sourceOfOverview() {
  return overviewSourceFiles().map((entry) => entry.source).join("\n");
}
