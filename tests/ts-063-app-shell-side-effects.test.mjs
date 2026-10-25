import test from "node:test";
import assert from "node:assert/strict";
import {
  appShellSourceFiles,
  createShellFixture,
  installDeterministicDom
} from "./helpers/ts-063-app-shell-harness.mjs";

test("TS-063 app shell modules import no data, auth, persistence or app controller", () => {
  const forbidden = [
    /from\s+"[^"]*dexie/i,
    /from\s+"[^"]*authentication/i,
    /from\s+"[^"]*persistence/i,
    /from\s+"[^"]*react-adapter/i,
    /from\s+"[^"]*react-boundary/i,
    /from\s+"\.\.\/app\.js"/,
    /from\s+"[^"]*store/i,
    /indexedDB/i,
    /localStorage/i,
    /sessionStorage/i,
    /persist\s*\(/,
    /startAuthentication/i,
    /fetch\s*\(/,
    /WebSocket/,
    /new\s+Dexie/,
    /\.cloud\./,
    /OTP|otp/
  ];
  for (const { name, source } of appShellSourceFiles()) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, name + " must not match " + pattern);
    }
  }
});

test("TS-063 app shell sources add no route, storage key or preference", () => {
  for (const { name, source } of appShellSourceFiles()) {
    assert.doesNotMatch(source, /threadstep\./i, name);
    assert.doesNotMatch(source, /storage/i, name);
    assert.doesNotMatch(source, /#\/(parametres|sujet|donnees|synchronisation)/, name);
    assert.doesNotMatch(source, /pathname|searchParams|URLSearchParams/, name);
  }
});

test("TS-063 lifecycle emits no storage, network, auth or business command", async () => {
  const dom = installDeterministicDom();
  const calls = {
    indexedDBOpen: 0,
    storageSet: 0,
    storageRemove: 0,
    fetch: 0,
    websocket: 0,
    otp: 0,
    command: 0
  };
  const previous = {
    indexedDB: Object.getOwnPropertyDescriptor(globalThis, "indexedDB"),
    fetch: Object.getOwnPropertyDescriptor(globalThis, "fetch"),
    WebSocket: Object.getOwnPropertyDescriptor(globalThis, "WebSocket")
  };
  const setGlobal = (key, value) => {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  try {
    setGlobal("indexedDB", {
      open() {
        calls.indexedDBOpen += 1;
        return {};
      }
    });
    setGlobal("fetch", () => {
      calls.fetch += 1;
      return Promise.resolve({});
    });
    setGlobal("WebSocket", class {
      constructor() {
        calls.websocket += 1;
      }
    });
    dom.window.localStorage.setItem = () => {
      calls.storageSet += 1;
    };
    dom.window.localStorage.removeItem = () => {
      calls.storageRemove += 1;
    };
    const commands = {
      authenticate() { calls.otp += 1; },
      persist() { calls.command += 1; },
      openDatabase() { calls.command += 1; }
    };

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const fixture = await createShellFixture({
        initialState: {
          open: false,
          route: { view: "overview" },
          onToggle: () => commands.authenticate(),
          onNavigate: () => commands.persist()
        }
      });
      assert.equal(fixture.container.querySelectorAll("form, input, select, textarea").length, 0);
      fixture.update({ open: true, route: { view: "settings", section: "sync" } });
      assert.equal(fixture.container.querySelectorAll("form, input, select, textarea").length, 0);
      fixture.update({ open: false });
      fixture.unmount();
      assert.equal(fixture.container.childNodes.length, 0);
    }

    assert.deepEqual(calls, {
      indexedDBOpen: 0,
      storageSet: 0,
      storageRemove: 0,
      fetch: 0,
      websocket: 0,
      otp: 0,
      command: 0
    });
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.cleanup();
  }
});

test("TS-063 the shell renders no OTP or Cloud form and no business content", async () => {
  const dom = installDeterministicDom();
  try {
    const fixture = await createShellFixture({
      initialState: {
        open: true,
        route: { view: "settings", section: "sync" }
      }
    });
    const text = fixture.container.textContent;
    assert.match(text, /Menu/);
    for (const id of ["auth-otp", "auth-email", "cloud-url", "export", "import", "restore", "subjects"]) {
      assert.equal(fixture.container.querySelector("#" + id), null, id);
    }
    assert.equal(fixture.container.querySelectorAll("[data-subject]").length, 0);
    assert.doesNotMatch(text, /code reçu|adresse email|exporter mes données|restaurer/i);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});
