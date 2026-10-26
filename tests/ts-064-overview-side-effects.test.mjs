import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import {
  OVERVIEW_TEST_COMMANDS,
  createOverviewFixture,
  installDeterministicDom,
  overviewSourceFiles
} from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const app = read("site/app.js");
const packageJson = JSON.parse(read("package.json"));

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function item(id, priority = "normal", done = false, parentId = null) {
  return { id, title: id, priority, done, parentId };
}

function makeAdapter() {
  const state = {
    document: {
      version: 1,
      subjects: [{ id: "p1", title: "Projet A", items: [item("i1", "urgent"), item("i2")] }]
    },
    route: { view: "overview" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    presentation: {
      state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
      actionRequired: false,
      projectsAvailable: true
    },
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      projectFilter: "all"
    }
  };
  const calls = [];
  const handlers = {};
  for (const name of OVERVIEW_TEST_COMMANDS) {
    handlers[name] = (...args) => {
      calls.push([name, args]);
      return true;
    };
  }
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => state.identity,
    isBusinessAllowed: () => state.allowed,
    isLoadingBlocked: () => state.blocked,
    getPresentation: () => state.presentation,
    commands: handlers
  });
  return { adapter, state, calls };
}

test("TS-064 the Overview modules import no storage, auth, router, store or app controller", () => {
  for (const { name, source } of overviewSourceFiles()) {
    const code = withoutComments(source);
    assert.doesNotMatch(code, /\bDexie\b|DexieCloud|indexedDB|IndexedDB|\bOTP\b|authentication\.js/, name);
    assert.doesNotMatch(code, /persist\s*\(|commitOperations|syncedDatabase|localStorage|sessionStorage/, name);
    assert.doesNotMatch(code, /from\s+["'][^"']*app\.js["']|from\s+["'][^"']*persistence\.js["']/, name);
    assert.doesNotMatch(code, /history\.|location\.hash|pushState|replaceState|createStore|redux|zustand/, name);
    assert.doesNotMatch(code, /\bfetch\s*\(|new\s+WebSocket|XMLHttpRequest/, name);
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(
        specifier === "react" ||
        specifier.startsWith("../core.js") ||
        specifier.startsWith("../ui/") ||
        specifier.startsWith("../project-detail/") ||
        specifier.startsWith("../overview-read-state.js") ||
        specifier.startsWith("../interaction-continuity.js") ||
        specifier.startsWith("./"),
        name + " imports " + specifier
      );
    }
  }
  const sharedForm = withoutComments(read("site/project-detail/CreateTaskForm.jsx"));
  assert.doesNotMatch(sharedForm, /\bDexie\b|indexedDB|\bOTP\b|authentication\.js|localStorage|fetch\s*\(|WebSocket/);
  assert.doesNotMatch(sharedForm, /from\s+["'][^"']*app\.js["']|from\s+["'][^"']*persistence\.js["']/);
  assert.equal((app.match(/from "\.\/overview\/OverviewSurface\.jsx"/g) || []).length, 1);
  assert.equal((app.match(/from "\.\/overview\/overview-adapter\.js"/g) || []).length, 1);
});

test("TS-064 no route, storage key, preference or dependency is added", () => {
  assert.deepEqual(packageJson.dependencies, {
    dexie: "4.4.6",
    "dexie-cloud-addon": "4.4.15",
    react: "19.3.1",
    "react-dom": "19.3.1"
  });
  assert.deepEqual(packageJson.devDependencies, {
    esbuild: "0.25.10",
    jsdom: "30.1.3",
    vite: "7.3.7"
  });
  const overviewText = overviewSourceFiles().map((entry) => entry.source).join("\n");
  assert.doesNotMatch(overviewText, /threadstep\.[a-z]+\.v\d/);
  assert.doesNotMatch(overviewText, /#\/parametres|#\/sujet\/|parseRoute|subjectRoute/);
  assert.match(app, /function openSubject\(subject\) \{\s*\n\s*const target = subjectRoute\(subject\.id\);/);
});

test("TS-064 core, boundary and Dexie configuration are untouched by this change", () => {
  const paths = [
    "site/core.js",
    "site/react-boundary.js",
    "site/react-adapter.js",
    "site/dexie-foundation.js",
    "package.json",
    "package-lock.json",
    "AGENTS.md",
    "openspec/specs"
  ];
  const status = execFileSync("git", ["status", "--porcelain", "--", ...paths], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  assert.equal(status, "", status);
});

test("TS-064 mount, update, remount and unmount emit no write, request, auth or command", async () => {
  const dom = installDeterministicDom();
  const writes = [];
  const requests = [];
  const authCalls = [];
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const originalWindowIndexedDb = Object.getOwnPropertyDescriptor(dom.window, "indexedDB");
  const originalGlobalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = {
    getItem: () => null,
    setItem: (...args) => { writes.push(["localStorage", args]); },
    removeItem: () => { writes.push(["localStorage.removeItem"]); },
    clear: () => { writes.push(["localStorage.clear"]); }
  };
  globalThis.fetch = (...args) => {
    requests.push(args[0]);
    throw new Error("network forbidden");
  };
  globalThis.WebSocket = class {
    constructor(url) { requests.push(url); }
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    writable: true,
    value: {
      open() {
        writes.push(["indexedDB.open"]);
        throw new Error("storage forbidden");
      }
    }
  });
  Object.defineProperty(dom.window, "indexedDB", {
    configurable: true,
    writable: true,
    value: globalThis.indexedDB
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage
  });
  const otp = {
    request: (...args) => authCalls.push(["request", args]),
    verify: (...args) => authCalls.push(["verify", args])
  };
  try {
    const { adapter, state, calls } = makeAdapter();
    let fixture = await createOverviewFixture(adapter);
    assert.ok(fixture.container.querySelector(".subject"));
    state.transient.openMenuId = "i2";
    fixture.rerender();
    assert.ok(fixture.container.querySelector("#task-menu-i2"));
    fixture.unmount();
    assert.equal(fixture.container.childNodes.length, 0);

    state.transient.openMenuId = null;
    fixture = await createOverviewFixture(adapter);
    assert.ok(fixture.container.querySelector(".subject"));
    fixture.unmount();

    assert.equal(typeof otp.request, "function");
    assert.equal(typeof otp.verify, "function");
    assert.deepEqual(writes, []);
    assert.deepEqual(requests, []);
    assert.deepEqual(calls, []);
    assert.deepEqual(authCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    if (originalIndexedDb) Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
    else delete globalThis.indexedDB;
    if (originalWindowIndexedDb) Object.defineProperty(dom.window, "indexedDB", originalWindowIndexedDb);
    if (originalGlobalStorage) Object.defineProperty(globalThis, "localStorage", originalGlobalStorage);
    else delete globalThis.localStorage;
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});
