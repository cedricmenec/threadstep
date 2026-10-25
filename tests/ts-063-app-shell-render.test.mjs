import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAV_MENU_ENTRIES } from "../site/core.js";
import {
  appShellSourceFiles,
  createShellFixture,
  installDeterministicDom
} from "./helpers/ts-063-app-shell-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const html = read("site/index.html");
const app = read("site/app.js");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to + end.length);
}

async function controlledFixture(dom) {
  let open = false;
  let route = { view: "overview" };
  const toggles = [];
  const navigations = [];
  const fixture = await createShellFixture({
    initialState: {
      open,
      route,
      onToggle() {
        toggles.push(open);
        open = !open;
        fixture.update({ open });
      },
      onNavigate(fragment) {
        navigations.push(fragment);
      }
    }
  });
  return { fixture, toggles, navigations, isOpen: () => open, setRoute: (next) => { route = next; fixture.update({ route }); } };
}

test("TS-063 shell renders the exact header markup once in the host", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture } = await controlledFixture(dom);
    const host = fixture.container;
    assert.equal(host.children.length, 1);
    const headerNav = host.firstElementChild;
    assert.equal(headerNav.className, "header-nav");
    assert.deepEqual([...headerNav.children].map((node) => node.id), [
      "nav-menu-button",
      "nav-menu-panel"
    ]);
    assert.equal(document.querySelectorAll("#nav-menu-button").length, 1);
    assert.equal(document.querySelectorAll("#nav-menu-panel").length, 1);
    assert.equal(document.querySelectorAll('[aria-controls="nav-menu-panel"]').length, 1);

    const button = document.querySelector("#nav-menu-button");
    assert.equal(button.tagName, "BUTTON");
    assert.equal(button.getAttribute("type"), "button");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(button.getAttribute("aria-controls"), "nav-menu-panel");
    assert.equal(button.querySelector(".nav-menu-label").textContent, "Menu");
    assert.equal(button.querySelector(".nav-menu-icon").getAttribute("aria-hidden"), "true");

    const panel = document.querySelector("#nav-menu-panel");
    assert.equal(panel.hidden, true);
    assert.equal(panel.className, "nav-menu-panel");
    const nav = panel.querySelector("nav");
    assert.equal(nav.className, "nav-menu");
    assert.equal(nav.getAttribute("aria-label"), "Navigation principale");
    const links = [...nav.querySelectorAll("a")];
    assert.deepEqual(links.map((link) => link.textContent), NAV_MENU_ENTRIES.map((entry) => entry.label));
    assert.deepEqual(links.map((link) => link.getAttribute("href")), NAV_MENU_ENTRIES.map((entry) => entry.fragment));
    for (const link of links) {
      assert.ok([...link.childNodes].every((node) => node.nodeType === 3), "labels stay text nodes");
      assert.equal(link.querySelectorAll("*").length, 0, "no executable markup is created from a label");
    }
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-063 closed and open states are exact and update without remounting", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture } = await controlledFixture(dom);
    const button = document.querySelector("#nav-menu-button");
    const panel = document.querySelector("#nav-menu-panel");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.hidden, true);

    fixture.update({ open: true });
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(panel.hidden, false);

    fixture.update({ open: false });
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.hidden, true);
    assert.equal(fixture.container.children.length, 1);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-063 mount/update/unmount leaves no React tree and focuses the present button", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture } = await controlledFixture(dom);
    const button = document.querySelector("#nav-menu-button");
    assert.equal(fixture.surface.focusMenuButton(), true);
    assert.equal(document.activeElement, button);

    fixture.update({ open: true });
    assert.equal(fixture.surface.focusMenuButton(), true);
    assert.equal(document.activeElement, button);

    fixture.unmount();
    assert.equal(fixture.container.querySelector("#nav-menu-button"), null);
    assert.equal(fixture.container.childNodes.length, 0);
    assert.equal(fixture.surface.update({ open: true }), false);
    assert.equal(fixture.surface.focusMenuButton(), false);
    assert.equal(fixture.surface.unmount(), false);
  } finally {
    dom.cleanup();
  }
});

test("TS-063 native button activation and Tab order are deterministic", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture, toggles } = await controlledFixture(dom);
    const button = document.querySelector("#nav-menu-button");
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(toggles, [false]);
    assert.equal(document.querySelector("#nav-menu-panel").hidden, false);

    const focusables = [button, ...document.querySelectorAll("#nav-menu-panel a")];
    assert.deepEqual(focusables.map((node) => node.id || node.getAttribute("href")), [
      "nav-menu-button",
      ...NAV_MENU_ENTRIES.map((entry) => entry.fragment)
    ]);
    assert.equal(focusables.every((node) => node.tabIndex >= 0 || node.tagName === "A" || node.tagName === "BUTTON"), true);

    button.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(toggles, [false, true]);
    assert.equal(document.querySelector("#nav-menu-panel").hidden, true);

    button.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(toggles, [false, true, false]);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-063 shell source exposes no executable label path", () => {
  const sources = appShellSourceFiles();
  for (const { name, source } of sources) {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|createElement\("script"\)/, name);
  }
  assert.ok(sources.some(({ name }) => name === "AppNavigation.jsx"));
});

test("TS-063 static fallback host keeps the same ids, ARIA, labels and business controls outside", () => {
  const hostMatch = /<div id="app-shell-root">([\s\S]*?)\n      <\/div>/.exec(html);
  assert.ok(hostMatch, "dedicated shell host present");
  const host = hostMatch[1];
  assert.match(host, /<div class="header-nav">/);
  assert.match(host, /id="nav-menu-button"[^>]*type="button"|type="button"[^>]*id="nav-menu-button"/);
  assert.match(host, /aria-expanded="false"/);
  assert.match(host, /aria-controls="nav-menu-panel"/);
  assert.match(host, /<span class="nav-menu-label">Menu<\/span>/);
  assert.match(host, /id="nav-menu-panel"[^>]*hidden/);
  const links = [...host.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map((match) => match[2]), NAV_MENU_ENTRIES.map((entry) => entry.label));
  assert.deepEqual(links.map((match) => match[1]), NAV_MENU_ENTRIES.map((entry) => entry.fragment));

  const businessIds = [
    "subjects",
    "cloud-config",
    "cloud-activation",
    "auth-panel",
    "workspace-panel",
    "export",
    "import",
    "restore",
    "restore-panel",
    "cloud-activation-consent",
    "repair-consent"
  ];
  const withoutHost = html.replace(host, "");
  for (const id of businessIds) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " must occur exactly once");
    assert.doesNotMatch(host, new RegExp('id="' + id + '"'), id + " must stay outside the shell host");
    assert.match(withoutHost, new RegExp('id="' + id + '"'), id);
  }
  assert.match(html, /<div id="subjects" class="subjects" aria-live="polite"><\/div>/);
  assert.doesNotMatch(host, /<main|<section|<form|<input/);
  assert.ok(html.indexOf('<div id="app-shell-root">') < html.indexOf('<h1>Thread'));
  assert.ok(html.indexOf('<section class="dashboard" id="dashboard"') > html.indexOf('<div id="app-shell-root">'));
});

test("TS-063 app mounts the shell in a dedicated boundary and keeps one root per host", () => {
  assert.match(app, /const appShellHostEl = document\.querySelector\("#app-shell-root"\)/);
  assert.match(app, /const appShellBoundary = createReactBoundary\(\)/);
  assert.match(app, /function reconcileAppShell\(/);
  assert.match(app, /appShellBoundary\.mount\(\{/);
  assert.match(app, /container: appShellHostEl/);
  assert.equal((app.match(/createAppShellSurface\(/g) || []).length, 1);
  assert.match(app, /if \(appShellHostEl\) \{\s*reconcileAppShell\(\);/);
  assert.doesNotMatch(app, /createRoot\(appShellHostEl\)/);
  assert.match(app, /function applyNavigationMenu\(\) \{\s*reconcileAppShell\(\);/);
});

test("TS-063 shell source imports NAV_MENU_ENTRIES only from core", () => {
  const sources = appShellSourceFiles();
  const navigation = sources.find(({ name }) => name === "AppNavigation.jsx").source;
  assert.match(navigation, /import \{ NAV_MENU_ENTRIES \} from "\.\.\/core\.js"/);
  assert.doesNotMatch(navigation, /#\/[a-z/]/i);
});
