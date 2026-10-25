import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NAV_MENU_ENTRIES,
  navigationMenuState,
  parseRoute,
  routeHeadingId,
  subjectRoute,
  isViewEntry
} from "../site/core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

test("settings routes resolve to their section without opening business views", () => {
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute(""), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.deepEqual(parseRoute("#/inconnu"), { view: "overview" });
  assert.deepEqual(parseRoute(null), { view: "overview" });
  assert.notEqual(parseRoute("#/parametres").view, "subject");
});

test("project routes keep their existing behavior including URL-special ids", () => {
  const id = "projet a/b & c";
  const hash = subjectRoute(id);
  assert.equal(hash, "#/sujet/projet%20a%2Fb%20%26%20c");
  assert.deepEqual(parseRoute(hash), { view: "subject", subjectId: id });
  assert.deepEqual(parseRoute("#/sujet/"), { view: "invalid" });
  assert.deepEqual(parseRoute("#/sujet/%E0%A4%A"), { view: "invalid" });
  assert.deepEqual(parseRoute("#/sujet/" + "x".repeat(101)), { view: "invalid" });
});

test("isViewEntry detects settings, project and overview transitions", () => {
  const overview = parseRoute("#/");
  const rootSettings = parseRoute("#/parametres");
  const dataSettings = parseRoute("#/parametres/donnees");
  const project = parseRoute("#/sujet/a");
  assert.equal(isViewEntry(overview, rootSettings), true);
  assert.equal(isViewEntry(rootSettings, dataSettings), true);
  assert.equal(isViewEntry(dataSettings, project), true);
  assert.equal(isViewEntry(project, rootSettings), true);
  assert.equal(isViewEntry(rootSettings, parseRoute("#/parametres")), false);
  assert.equal(isViewEntry(project, parseRoute("#/sujet/a")), false);
});

test("menu entries are exact, ordered, frozen and target stable fragments", () => {
  assert.deepEqual(NAV_MENU_ENTRIES.map((entry) => entry.label), [
    "Mes projets",
    "Paramètres",
    "Imports / Exports",
    "Synchronisation Dexie Cloud"
  ]);
  assert.deepEqual(NAV_MENU_ENTRIES.map((entry) => entry.fragment), [
    "#/",
    "#/parametres",
    "#/parametres/donnees",
    "#/parametres/synchronisation"
  ]);
  assert.equal(Object.isFrozen(NAV_MENU_ENTRIES), true);
  for (const entry of NAV_MENU_ENTRIES) assert.equal(Object.isFrozen(entry), true);
  assert.throws(() => NAV_MENU_ENTRIES.push({}));
});

test("routeHeadingId maps each stable route to its focusable heading", () => {
  assert.equal(routeHeadingId(parseRoute("#/")), "dashboard-title");
  assert.equal(routeHeadingId(parseRoute("#/parametres")), "settings-title");
  assert.equal(routeHeadingId(parseRoute("#/parametres/donnees")), "settings-data-title");
  assert.equal(routeHeadingId(parseRoute("#/parametres/synchronisation")), "settings-sync-title");
  assert.equal(routeHeadingId(parseRoute("#/sujet/a")), null);
  assert.equal(routeHeadingId(parseRoute("#/inconnu")), "dashboard-title");
  assert.equal(routeHeadingId(null), null);
  assert.equal(routeHeadingId({ view: "settings" }), null);
});

test("navigation menu state machine handles every action without mutation", () => {
  const closed = Object.freeze({ open: false });
  const open = Object.freeze({ open: true });
  assert.deepEqual(navigationMenuState(closed, "toggle"), { open: true, restoreFocus: false });
  assert.deepEqual(navigationMenuState(open, "toggle"), { open: false, restoreFocus: false });
  assert.deepEqual(navigationMenuState(open, "escape"), { open: false, restoreFocus: true });
  assert.deepEqual(navigationMenuState(closed, "escape"), { open: false, restoreFocus: false });
  for (const action of ["outside", "navigate", "route-change"]) {
    assert.deepEqual(navigationMenuState(open, action), { open: false, restoreFocus: false }, action);
  }
  assert.deepEqual(navigationMenuState(open, "inconnue"), { open: true, restoreFocus: false });
  assert.deepEqual(navigationMenuState(closed, "inconnue"), { open: false, restoreFocus: false });
  assert.deepEqual(open, { open: true });
  assert.deepEqual(closed, { open: false });
});

const html = read("site/index.html");
const css = read("site/styles.css");
const app = read("site/app.js");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

test("header menu markup exposes accessible state and the exact ordered links", () => {
  const button = /<button[^>]*id="nav-menu-button"[^>]*>/.exec(html);
  assert.ok(button, "menu button present");
  assert.match(button[0], /type="button"/);
  assert.match(button[0], /aria-expanded="false"/);
  assert.match(button[0], /aria-controls="nav-menu-panel"/);
  assert.match(html, /<span class="nav-menu-label">Menu<\/span>/);
  const panel = between(html, '<div id="nav-menu-panel"', "</div>");
  assert.match(panel, /\shidden(\s|>)/);
  const links = [...panel.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map((match) => match[2]), NAV_MENU_ENTRIES.map((entry) => entry.label));
  assert.deepEqual(links.map((match) => match[1]), NAV_MENU_ENTRIES.map((entry) => entry.fragment));
});

test("settings pages expose titles, back links and destination sections", () => {
  assert.match(html, /<h2 id="settings-title" tabindex="-1">Paramètres<\/h2>/);
  assert.match(html, /<h2 id="settings-data-title" tabindex="-1">Imports \/ Exports<\/h2>/);
  assert.match(html, /<h2 id="settings-sync-title" tabindex="-1">Synchronisation Dexie Cloud<\/h2>/);
  assert.match(html, /<a class="settings-back" href="#\/">Retour à Mes projets<\/a>/);
  assert.equal((html.match(/<a class="settings-back" href="#\/parametres">Retour aux paramètres<\/a>/g) || []).length, 2);
  assert.match(html, /<h3[^>]*>Exporter<\/h3>/);
  assert.match(html, /<h3[^>]*>Importer et fusionner<\/h3>/);
  assert.match(html, /<h3[^>]*>Restaurer un état antérieur<\/h3>/);
  assert.match(html, /réunit la configuration, l'activation, la connexion/i);
});

test("settings pages host the data and Cloud controls once in their destination", () => {
  const dataBlock = between(html, '<section id="settings-data-page"', '<section id="settings-sync-page"');
  for (const id of ["business-tools", "export", "import", "restore", "restore-panel"]) {
    assert.match(dataBlock, new RegExp('id="' + id + '"'), id);
    const occurrences = html.split('id="' + id + '"').length - 1;
    assert.equal(occurrences, 1, id + " must occur exactly once");
  }
  const syncPage = between(
    html,
    '<section id="settings-sync-page"',
    '<div id="sync-summary"'
  );
  for (const id of ["cloud-config", "cloud-activation", "auth-panel", "workspace-panel", "sync-diagnostic"]) {
    assert.match(syncPage, new RegExp('id="' + id + '"'), id);
    const occurrences = html.split('id="' + id + '"').length - 1;
    assert.equal(occurrences, 1, id + " must occur exactly once in the sync page");
  }
  const settingsBlock = between(html, '<section id="settings-page"', '<section class="dashboard"');
  assert.equal(settingsBlock.split('id="cloud-config"').length - 1, 1);
  assert.match(html, /<div id="sync-summary"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
  assert.match(html, /id="sync-settings-access"[^>]*href="#\/parametres\/synchronisation"/);
});

test("menu CSS keeps 44px targets, bounded panel, focus and hidden handling", () => {
  const button = between(css, ".nav-menu-button{", "}");
  assert.match(button, /min-width:44px/);
  assert.match(button, /min-height:44px/);
  const link = between(css, ".nav-menu a{", "}");
  assert.match(link, /min-width:44px/);
  assert.match(link, /min-height:44px/);
  const panel = between(css, ".nav-menu-panel{", "}");
  assert.match(panel, /calc\(100vw - 32px\)/);
  assert.match(css, /\.nav-menu-button:focus-visible/);
  assert.match(css, /\.nav-menu-panel\[hidden\]\{display:none\}/);
  assert.match(css, /@media\(max-width:620px\)\{[^}]*\.nav-menu-panel/);
});

test("app wires menu state, escape, outside activation and route changes", () => {
  assert.match(app, /import \{ createAppShellSurface \} from "\.\/app-shell\/AppShellSurface\.jsx"/);
  assert.match(app, /const appShellBoundary = createReactBoundary\(\)/);
  assert.match(app, /function reconcileAppShell\(/);
  assert.match(app, /createAppShellSurface\(\{/);
  assert.match(app, /appShellRecord\.surface\.update\(\{ open: navMenuOpen, route \}\)/);
  assert.match(app, /appShellRecord\.surface\.focusMenuButton\(\)/);
  assert.match(app, /updateNavigationMenu\("escape"\)/);
  assert.match(app, /updateNavigationMenu\("outside"\)/);
  assert.match(app, /updateNavigationMenu\("route-change"\)/);
  assert.doesNotMatch(app, /navMenuButtonEl\.setAttribute/);
  assert.doesNotMatch(app, /navMenuPanelEl\.hidden/);
  assert.doesNotMatch(app, /navMenuPanelEl\.querySelectorAll/);
});

test("menu links use the pure heading mapping and close before navigating", () => {
  const activate = between(app, "function activateNavigationLink(", "\n}\n");
  assert.match(activate, /updateNavigationMenu\("navigate"\)/);
  assert.match(activate, /routeHeadingId\(nextRoute\)/);
  assert.match(activate, /pendingNavigationFocus = routeHeadingId\(nextRoute\)/);
  assert.match(activate, /location\.hash = target/);
  assert.match(app, /routeHeadingId, navigationMenuState/);
  assert.match(app, /onNavigate: \(fragment\) => \{ activateNavigationLink\(null, fragment\); \}/);
  assert.doesNotMatch(app, /querySelectorAll\("a\[href\]"\)/);
});

test("route visibility shows one settings section and preserves existing selectors", () => {
  const visibility = between(app, "function applySettingsVisibility(", "\n}\n");
  for (const [element, section] of [["settingsPageEl", "root"], ["settingsDataPageEl", "data"], ["settingsSyncPageEl", "sync"]]) {
    assert.match(visibility, new RegExp(element + "\\.hidden = section !== \"" + section + "\""));
  }
  assert.match(app, /const settingsSection = route\.view === "settings" \? route\.section : null/);
  assert.match(app, /dashboardEl\.hidden = Boolean\(settingsSection\)/);
  for (const selector of ["#business-tools", "#workspace-panel", "#auth-panel", "#cloud-config", "#restore-panel", "#sync-diagnostic"]) {
    assert.match(app, new RegExp('querySelector\\("' + selector + '"\\)'), selector);
  }
});

test("navigation handlers contain no data, network or authentication side effects", () => {
  const blocks = [
    between(app, "function applyNavigationMenu(", "\n}\n"),
    between(app, "function updateNavigationMenu(", "\n}\n"),
    between(app, "function focusRouteHeading(", "\n}\n"),
    between(app, "function activateNavigationLink(", "\n}\n"),
    between(app, 'window.addEventListener("hashchange"', "\n});")
  ];
  const forbidden = /\bload\s*\(|\bpersist\s*\(|refreshSyncedDocument|bootstrap|\.open\s*\(|fetch\s*\(|indexedDB|localStorage|startAuthentication|pull/i;
  for (const block of blocks) assert.doesNotMatch(block, forbidden);
});

test("documentation describes navigation, settings routes and unchanged controls", () => {
  const guide = read("docs/product/guide-utilisation.md");
  const acceptance = read("docs/product/acceptance-checklist.md");
  for (const source of [guide, acceptance]) {
    assert.match(source, /Menu/);
    assert.match(source, /Mes projets/);
    assert.match(source, /Imports \/ Exports/);
    assert.match(source, /Synchronisation Dexie Cloud/);
    assert.match(source, /#\/parametres/);
    assert.match(source, /une seule fois|unique destination|réunies/i);
  }
});
