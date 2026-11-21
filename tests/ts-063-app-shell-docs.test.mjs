import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAV_MENU_ENTRIES, parseRoute } from "../site/core.js";
import { appShellSourceFiles } from "./helpers/ts-063-app-shell-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const html = read("site/index.html");
const app = read("site/app.js");
const packageJson = JSON.parse(read("package.json"));
const doc = read("docs/product/react-app-shell.md");
const guide = read("docs/product/developer-guide.md");

test("TS-063 documentation maps ownership, boundaries, diagnostics, rollback and evidence", () => {
  const headings = [
    "Carte de propriété DOM",
    "Points de montage",
    "Frontières route, identité et blocage",
    "Diagnostic",
    "Retour arrière",
    "Preuves automatisées et recette humaine",
    "Limites"
  ];
  assert.match(doc, /^# Coque React bornée/m);
  const positions = headings.map((heading) => {
    const index = doc.indexOf("## " + heading);
    assert.notEqual(index, -1, heading);
    return index;
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  for (const phrase of [
    /#app-shell-root/,
    /#subjects/,
    /createReactBoundary/,
    /parseRoute/,
    /hashchange/,
    /identité autorisée/,
    /état bloquant/,
    /npm run check/,
    /npm run build/,
    /npm run verify:build/,
    /propriétaire/,
    /lecteur d'écran/,
    /non coché par `apply`/,
    /M01, M02, M15, M16 et M19/
  ]) {
    assert.match(doc, phrase);
  }
  assert.match(guide, /Coque React bornée de l'en-tête \(TS-063\)/);
  assert.match(guide, /#app-shell-root/);
  assert.match(guide, /deux frontières React distinctes/);
  assert.match(guide, /tests\/ts-063-app-shell-\*\.test\.mjs/);
  assert.match(guide, /docs\/product\/react-app-shell\.md/);
});

test("TS-063 adds no new route or fragment source", () => {
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.deepEqual(parseRoute("#/inconnu"), { view: "overview" });
  assert.equal(NAV_MENU_ENTRIES.length, 4);

  const fragments = new Set(NAV_MENU_ENTRIES.map((entry) => entry.fragment));
  const routerCalls = [...app.matchAll(/parseRoute\("([^"]*)"\)/g)].map((match) => match[1]);
  for (const fragment of routerCalls) {
    assert.ok(fragment === "" || fragments.has(fragment) || fragment === "#/sujet/", fragment);
  }
  for (const { name, source } of appShellSourceFiles()) {
    assert.doesNotMatch(source, /parseRoute|location|history|router/i, name);
  }
  const hostMatch = /<div id="app-shell-root">([\s\S]*?)\n    <\/div>/.exec(html);
  assert.ok(hostMatch);
  const host = hostMatch[1];
  const hrefs = [...host.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, NAV_MENU_ENTRIES.map((entry) => entry.fragment));
});

test("TS-063 adds no storage key, Dexie change or new dependency", () => {
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
    "dexie",
    "dexie-cloud-addon",
    "react",
    "react-dom"
  ]);
  assert.equal(packageJson.devDependencies.esbuild, "0.25.10");
  for (const { name, source } of appShellSourceFiles()) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|Dexie|threadstep\.|persist\s*\(/, name);
  }
  assert.doesNotMatch(doc, /threadstep\.[a-z]/i, "documentation must not declare a new storage key");
  assert.match(read("site/dexie-foundation.js"), /threadstep-local/);
  assert.match(app, /const LOCAL_DATABASE_NAME|LOCAL_DATABASE_NAME/);
});

test("TS-063 keeps the production CSP and ships no remote asset", () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.ok(csp);
  assert.equal(
    csp[1],
    "default-src 'self'; connect-src https://*.dexie.cloud wss://*.dexie.cloud; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
  );
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//, "index.html must not load a remote resource");
  assert.doesNotMatch(html, /url\(https?:\/\//i, "index.html must not embed a remote URL");
  assert.doesNotMatch(html, /http-equiv="refresh"|@import url\(/i);
  assert.match(html, /<link rel="stylesheet" href="\.\/styles.css">/);
  assert.match(html, /<script type="module" src="\.\/app.js"><\/script>/);
});

test("TS-063 preserves business form ids and the #subjects root once", () => {
  const ids = [
    "subjects",
    "cloud-config",
    "cloud-config-form",
    "cloud-activation",
    "cloud-activation-consent",
    "auth-panel",
    "auth-form",
    "auth-email",
    "auth-otp",
    "workspace-panel",
    "workspace-select",
    "export",
    "import",
    "restore",
    "restore-panel",
    "restore-confirmation",
    "repair-consent",
    "settings-page",
    "settings-data-page",
    "settings-sync-page"
  ];
  const hostMatch = /<div id="app-shell-root">([\s\S]*?)\n    <\/div>/.exec(html);
  assert.ok(hostMatch);
  const host = hostMatch[1];
  for (const id of ids) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " must occur exactly once");
    assert.doesNotMatch(host, new RegExp('id="' + id + '"'), id + " must stay outside the shell host");
  }
  assert.match(html, /<div id="subjects" class="subjects" aria-live="polite"><\/div>/);
  assert.match(html, /<main class="shell">/);
  assert.match(html, /<footer>ThreadStep/);
});
