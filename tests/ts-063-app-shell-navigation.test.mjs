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
  appShellSourceFiles,
  installDeterministicDom
} from "./helpers/ts-063-app-shell-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const app = read("site/app.js");

function slice(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, start);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

const navCode = [
  slice(app, "function applyNavigationMenu(", "function focusRouteHeading("),
  slice(app, "function focusRouteHeading(", "function activateNavigationLink("),
  slice(app, "function activateNavigationLink(", "function readCloudSettingsInput(")
].join("\n");

function controller(dom, hash = "#/") {
  const updates = [];
  let focusCalls = 0;
  let renderCalls = 0;
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
    render() {
      renderCalls += 1;
    },
    reconcileReactSurface() {},
    reconcileAppShell() {}
  };
  const api = runInNewContext(
    navCode + "\n;({ updateNavigationMenu, activateNavigationLink, focusRouteHeading });",
    sandbox
  );
  return {
    sandbox,
    api,
    updates,
    get focusCalls() { return focusCalls; },
    get renderCalls() { return renderCalls; }
  };
}

function dispatchLink(hash) {
  let prevented = 0;
  const event = {
    preventDefault() {
      prevented += 1;
    }
  };
  return { event, prevented: () => prevented };
}

test("TS-063 app delegates the whole menu to the shell surface", () => {
  assert.match(app, /import \{ createAppShellSurface \} from "\.\/app-shell\/AppShellSurface\.jsx"/);
  assert.match(app, /function appShellContextKey\(/);
  assert.match(app, /authorizedWorkspaceIdentityKey\(identity\)/);
  assert.match(app, /blocked \? "blocked" : "allowed"/);
  assert.match(app, /function appShellControlledState\(/);
  assert.match(app, /onToggle: \(\) => \{ updateNavigationMenu\("toggle"\); \}/);
  assert.match(app, /onNavigate: \(fragment\) => \{ activateNavigationLink\(null, fragment\); \}/);
  assert.match(app, /function reconcileAppShell\(/);
  assert.match(app, /releaseAppShellSurface\("context-change"\)/);
  assert.match(app, /appShellBoundary\.mount\(\{/);
  assert.doesNotMatch(app, /navMenuButtonEl/);
  assert.doesNotMatch(app, /navMenuPanelEl/);
  assert.equal((app.match(/addEventListener\("click", \(\) => \{\s*updateNavigationMenu\("toggle"\)/g) || []).length, 0);
});

test("TS-063 a link activation emits one intention, closes the menu and focuses the destination title", () => {
  const dom = installDeterministicDom();
  try {
    const headings = ["dashboard-title", "settings-title", "settings-data-title", "settings-sync-title"];
    for (const id of headings) {
      const heading = dom.document.createElement("h2");
      heading.id = id;
      heading.tabIndex = -1;
      dom.document.body.append(heading);
    }
    const { sandbox, api, updates, renderCalls } = controller(dom);
    api.updateNavigationMenu("toggle");
    assert.equal(sandbox.navMenuOpen, true);
    assert.equal(updates.at(-1).open, true);

    const { event, prevented } = dispatchLink("#/parametres");
    api.activateNavigationLink(event, "#/parametres");
    assert.equal(prevented(), 1);
    assert.equal(updates.length, 2);
    assert.equal(updates.at(-1).open, false);
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(sandbox.location.hash, "#/parametres");
    assert.equal(sandbox.pendingNavigationFocus, "settings-title");
    assert.equal(renderCalls, 0, "hashchange owns the render, not the link");

    const pending = sandbox.pendingNavigationFocus;
    sandbox.pendingNavigationFocus = null;
    api.updateNavigationMenu("route-change");
    sandbox.route = parseRoute(sandbox.location.hash);
    api.focusRouteHeading(pending);
    assert.equal(dom.document.activeElement.id, "settings-title");
    assert.equal(updates.at(-1).open, false);
  } finally {
    dom.cleanup();
  }
});

test("TS-063 simulated Back/Forward closes an open menu once per event", () => {
  const dom = installDeterministicDom();
  try {
    const { sandbox, api, updates } = controller(dom, "#/parametres");
    api.updateNavigationMenu("toggle");
    api.updateNavigationMenu("toggle");
    const before = updates.length;
    api.updateNavigationMenu("toggle");
    assert.equal(sandbox.navMenuOpen, true);

    sandbox.location.hash = "#/";
    api.updateNavigationMenu("route-change");
    sandbox.route = parseRoute(sandbox.location.hash);
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(updates.length, before + 2);

    api.updateNavigationMenu("toggle");
    sandbox.location.hash = "#/parametres";
    api.updateNavigationMenu("route-change");
    sandbox.route = parseRoute(sandbox.location.hash);
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(updates.at(-1).open, false);
  } finally {
    dom.cleanup();
  }
});

test("TS-063 Escape closes without navigating and returns focus to the trigger", () => {
  const dom = installDeterministicDom();
  try {
    const harness = controller(dom);
    const { sandbox, api, updates } = harness;
    const button = dom.document.createElement("button");
    button.id = "nav-menu-button";
    dom.document.body.append(button);
    api.updateNavigationMenu("toggle");
    const hashBefore = sandbox.location.hash;
    api.updateNavigationMenu("escape");
    assert.equal(sandbox.navMenuOpen, false);
    assert.equal(sandbox.location.hash, hashBefore);
    assert.equal(harness.focusCalls, 1);
    assert.equal(updates.at(-1).open, false);

    api.updateNavigationMenu("outside");
    assert.equal(harness.focusCalls, 1, "outside close does not steal focus");
  } finally {
    dom.cleanup();
  }
});

test("TS-063 the four destinations and project route keep their existing interpretation", () => {
  const dom = installDeterministicDom();
  try {
    const { sandbox, api } = controller(dom);
    for (const entry of NAV_MENU_ENTRIES) {
      const { event } = dispatchLink(entry.fragment);
      api.activateNavigationLink(event, entry.fragment);
      sandbox.route = parseRoute(entry.fragment);
      assert.deepEqual(sandbox.route, parseRoute(entry.fragment));
      assert.equal(routeHeadingId(sandbox.route), entry.headingId);
      assert.equal(sandbox.location.hash, entry.fragment);
    }
    api.activateNavigationLink(null, "#/sujet/projet%20a%2Fb%20%26%20c");
    assert.deepEqual(parseRoute(sandbox.location.hash), { view: "subject", subjectId: "projet a/b & c" });
    assert.equal(routeHeadingId(parseRoute(sandbox.location.hash)), null);
  } finally {
    dom.cleanup();
  }
});

test("TS-063 unknown and malformed fragments keep the deterministic fallback", () => {
  const dom = installDeterministicDom();
  try {
    const { sandbox, api } = controller(dom);
    api.activateNavigationLink(null, "#/inconnu");
    assert.deepEqual(parseRoute(sandbox.location.hash), { view: "overview" });
    assert.equal(routeHeadingId(parseRoute(sandbox.location.hash)), "dashboard-title");
    assert.equal(sandbox.pendingNavigationFocus, "dashboard-title");
    assert.equal(sandbox.navMenuOpen, false);

    api.updateNavigationMenu("toggle");
    api.activateNavigationLink(null, "#/sujet/");
    assert.deepEqual(parseRoute(sandbox.location.hash), { view: "invalid" });
    assert.equal(sandbox.pendingNavigationFocus, null);
    assert.equal(sandbox.navMenuOpen, false);
  } finally {
    dom.cleanup();
  }
});

test("TS-063 no parallel router, history or second route source is introduced", () => {
  for (const { name, source } of appShellSourceFiles()) {
    assert.doesNotMatch(source, /pushState|replaceState|history\.|react-router|createHashRouter|useNavigate/, name);
    assert.doesNotMatch(source, /location\.hash|window\.location/, name);
  }
  assert.equal((app.match(/from "\.\/core\.js"/g) || []).length, 1);
  assert.equal((app.match(/parseRoute\(location\.hash\)/g) || []).length, 2);
  assert.equal((app.match(/function parseRoute\(/g) || []).length, 0);
  assert.match(app, /window\.addEventListener\("hashchange", \(\) => \{\s*const nextRoute = parseRoute\(location\.hash\)/);
});
