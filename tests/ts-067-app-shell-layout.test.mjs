import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NAV_MENU_ENTRIES,
  navigationMenuState,
  parseRoute,
  routeHeadingId
} from "../site/core.js";
import {
  createShellFixture,
  installDeterministicDom
} from "./helpers/ts-063-app-shell-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const html = read("site/index.html");
const app = read("site/app.js");

function hostContent(source) {
  const match = /<div id="app-shell-root">([\s\S]*?)\n    <\/div>/.exec(source);
  assert.ok(match, "dedicated shell host present");
  return match[1];
}

function activeLinks() {
  return [...document.querySelectorAll('#nav-menu-panel a[aria-current="page"]')];
}

async function controlledFixture(route = { view: "overview" }) {
  let open = false;
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
  return { fixture, toggles, navigations, isOpen: () => open };
}

function slice(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

const controllerCode = [
  slice(app, "function applyNavigationMenu(", "function focusRouteHeading("),
  slice(app, "function focusRouteHeading(", "function activateNavigationLink("),
  slice(app, "function activateNavigationLink(", "function readCloudSettingsInput(")
].join("\n");

function controller(dom, hash = "#/") {
  const updates = [];
  let focusCalls = 0;
  const sandbox = {
    location: { hash },
    document: dom.document,
    parseRoute,
    routeHeadingId,
    navigationMenuState,
    navMenuOpen: false,
    pendingNavigationFocus: null,
    route: parseRoute(hash),
    appShellRecord: {
      surface: {
        update(state) {
          updates.push(state);
          return true;
        },
        focusMenuButton() {
          focusCalls += 1;
          return true;
        }
      }
    },
    render() {},
    reconcileReactSurface() {},
    reconcileAppShell() {}
  };
  const api = runInNewContext(
    controllerCode + "\n;({ updateNavigationMenu, activateNavigationLink });",
    sandbox
  );
  return { sandbox, api, updates, get focusCalls() { return focusCalls; } };
}

test("TS-067 static host is a direct child of main with one drawer and four links", () => {
  assert.equal((html.match(/id="app-shell-root"/g) || []).length, 1);
  assert.match(html, /<main class="shell">\s*<div id="app-shell-root">/);
  const host = hostContent(html);
  assert.match(host, /<div class="header-nav">/);
  assert.match(host, /id="nav-menu-button"[^>]*aria-expanded="false"[^>]*aria-controls="nav-menu-panel"/);
  assert.match(host, /id="nav-menu-panel"[^>]*data-open="false"/);
  assert.doesNotMatch(host, /id="nav-menu-panel"[^>]*hidden/);

  const links = [...host.matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
  assert.deepEqual(links.map((match) => match[3]), NAV_MENU_ENTRIES.map((entry) => entry.label));
  assert.deepEqual(links.map((match) => match[1]), NAV_MENU_ENTRIES.map((entry) => entry.fragment));
  assert.match(links[0][2], /aria-current="page"/);
  for (const link of links.slice(1)) assert.doesNotMatch(link[2], /aria-current/);
});

test("TS-067 no business surface is moved into the shell host", () => {
  const host = hostContent(html);
  assert.doesNotMatch(host, /id="subjects"|id="settings-page"|id="settings-data-page"|id="settings-sync-page"|id="cloud-config"|id="cloud-activation"|id="auth-panel"|id="workspace-panel"|id="export"|id="import"|id="restore"|id="restore-panel"/);
  assert.doesNotMatch(host, /<main|<section|<form|<input|<select|<textarea/);
  for (const id of ["subjects", "settings-page", "cloud-config", "auth-panel", "workspace-panel", "export", "import", "restore"]) {
    assert.doesNotMatch(host, new RegExp('id="' + id + '"'), id);
    assert.match(html.replace(host, ""), new RegExp('id="' + id + '"'), id);
  }
  assert.ok(html.indexOf('<div id="app-shell-root">') < html.indexOf('<header class="hero">'));
});

test("TS-067 React shell exposes closed/open drawer state without hidden or duplicate links", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture } = await controlledFixture();
    const button = document.querySelector("#nav-menu-button");
    const panel = document.querySelector("#nav-menu-panel");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.getAttribute("data-open"), "false");
    assert.equal(panel.hasAttribute("hidden"), false);
    assert.equal(document.querySelectorAll("#nav-menu-button").length, 1);
    assert.equal(document.querySelectorAll("#nav-menu-panel").length, 1);
    assert.equal(document.querySelectorAll("#nav-menu-panel a").length, 4);

    fixture.update({ open: true });
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(panel.getAttribute("data-open"), "true");
    assert.equal(document.querySelectorAll("#nav-menu-panel a").length, 4);

    fixture.update({ open: false });
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.getAttribute("data-open"), "false");
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-067 aria-current marks exactly the mapped destination for every route", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture } = await controlledFixture();
    const cases = [
      ["#/", "#/"],
      ["#/sujet/projet%20a", "#/"],
      ["#/inconnu", "#/"],
      ["#/parametres", "#/parametres"],
      ["#/parametres/donnees", "#/parametres/donnees"],
      ["#/parametres/synchronisation", "#/parametres/synchronisation"]
    ];
    for (const [hash, expected] of cases) {
      fixture.update({ route: parseRoute(hash) });
      const active = activeLinks();
      assert.equal(active.length, 1, hash);
      assert.equal(active[0].getAttribute("href"), expected, hash);
    }

    fixture.update({ route: null });
    assert.equal(activeLinks().length, 0, "unparsed route exposes no invented active link");
    fixture.update({ route: { view: "settings", section: "unknown" } });
    assert.equal(activeLinks().length, 0, "unknown section exposes no invented active link");
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-067 link activation emits one controller intention and label nodes stay text", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture, navigations } = await controlledFixture();
    fixture.update({ route: parseRoute("#/parametres") });
    const links = [...document.querySelectorAll("#nav-menu-panel a")];
    assert.deepEqual(links.map((link) => link.textContent), NAV_MENU_ENTRIES.map((entry) => entry.label));
    for (const link of links) {
      assert.equal(link.querySelectorAll("*").length, 0);
      assert.ok([...link.childNodes].every((node) => node.nodeType === 3));
    }
    links[2].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(navigations, ["#/parametres/donnees"]);
    assert.equal(activeLinks()[0].getAttribute("href"), "#/parametres");
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-067 toggle, Escape, outside action and route change close the compact drawer", () => {
  const dom = installDeterministicDom();
  try {
    const harness = controller(dom);
    const { sandbox, api } = harness;
    assert.equal(sandbox.navMenuOpen, false);
    api.updateNavigationMenu("toggle");
    assert.equal(sandbox.navMenuOpen, true);
    api.updateNavigationMenu("escape");
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(harness.focusCalls, 1);

    api.updateNavigationMenu("toggle");
    assert.equal(sandbox.navMenuOpen, true);
    api.updateNavigationMenu("outside");
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(harness.focusCalls, 1, "outside close does not steal focus");

    api.updateNavigationMenu("toggle");
    assert.equal(sandbox.navMenuOpen, true);
    sandbox.location.hash = "#/parametres";
    api.updateNavigationMenu("route-change");
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(harness.updates.at(-1).open, false);
  } finally {
    dom.cleanup();
  }
});

test("TS-067 focus restoration targets the present Menu button", async () => {
  const dom = installDeterministicDom();
  try {
    const { fixture } = await controlledFixture();
    fixture.update({ open: true });
    const button = document.querySelector("#nav-menu-button");
    assert.equal(fixture.surface.focusMenuButton(), true);
    assert.equal(document.activeElement, button);
    fixture.update({ open: false });
    assert.equal(fixture.surface.focusMenuButton(), true);
    assert.equal(document.activeElement, button);
    fixture.unmount();
    assert.equal(fixture.surface.focusMenuButton(), false);
  } finally {
    dom.cleanup();
  }
});

test("TS-067 shell lifecycle performs no storage write, network call or business command", async () => {
  const dom = installDeterministicDom();
  const calls = { storageSet: 0, storageRemove: 0, fetch: 0, websocket: 0, indexedDBOpen: 0, command: 0 };
  const previous = {
    indexedDB: Object.getOwnPropertyDescriptor(globalThis, "indexedDB"),
    fetch: Object.getOwnPropertyDescriptor(globalThis, "fetch"),
    WebSocket: Object.getOwnPropertyDescriptor(globalThis, "WebSocket")
  };
  const setGlobal = (key, value) => {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  try {
    setGlobal("indexedDB", { open() { calls.indexedDBOpen += 1; return {}; } });
    setGlobal("fetch", () => { calls.fetch += 1; return Promise.resolve({}); });
    setGlobal("WebSocket", class { constructor() { calls.websocket += 1; } });
    dom.window.localStorage.setItem = () => { calls.storageSet += 1; };
    dom.window.localStorage.removeItem = () => { calls.storageRemove += 1; };

    const fixture = await createShellFixture({
      initialState: {
        open: false,
        route: parseRoute("#/"),
        onToggle: () => { calls.command += 1; },
        onNavigate: () => { calls.command += 1; }
      }
    });
    assert.equal(fixture.container.querySelectorAll("form, input, select, textarea").length, 0);
    fixture.update({ open: true, route: parseRoute("#/parametres/synchronisation") });
    fixture.update({ open: false, route: parseRoute("#/sujet/p1") });
    fixture.unmount();
    assert.equal(fixture.container.childNodes.length, 0);
    assert.deepEqual(calls, { storageSet: 0, storageRemove: 0, fetch: 0, websocket: 0, indexedDBOpen: 0, command: 0 });
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.cleanup();
  }
});
