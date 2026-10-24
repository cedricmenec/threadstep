import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactBoundary, reactBoundaryKey } from "../site/react-boundary.js";
import { createReactAdapter, REACT_ADAPTER_COMMAND_NAMES } from "../site/react-adapter.js";
import { parseRoute, subjectRoute } from "../site/core.js";
import {
  compileFixture,
  createReactFixture,
  installDeterministicDom
} from "./helpers/ts-058-react-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const appSource = read("site/app.js");
const fixtureSource = read("tests/fixtures/ts-058/synthetic-project-detail.jsx");

function syntheticDocument() {
  return {
    version: 1,
    subjects: [{
      id: "p1",
      title: "Projet fixture",
      items: [
        { id: "i1", title: "Première étape", priority: "urgent", done: false, parentId: null },
        { id: "i2", title: "Sous-étape", priority: "normal", done: false, parentId: "i1" }
      ]
    }]
  };
}

function makeAdapter(document = syntheticDocument()) {
  const handlers = {};
  for (const name of REACT_ADAPTER_COMMAND_NAMES) handlers[name] = () => undefined;
  return createReactAdapter({
    getDocument: () => document,
    getRoute: () => ({ view: "subject", subjectId: "p1" }),
    getTransientState: () => ({ openMenuId: null, expandedParents: new Set(), editor: null, filter: "all" }),
    getAuthorizedIdentity: () => ({ type: "local" }),
    isBusinessAllowed: () => true,
    isLoadingBlocked: () => false,
    commands: handlers
  });
}

test("TS-058 the synthetic fixture compiles with the project JSX runtime and no data access", async () => {
  const compiled = await compileFixture();
  assert.match(compiled.code, /react\/jsx-runtime/);
  assert.doesNotMatch(compiled.code, /React\.createElement/);
  assert.doesNotMatch(compiled.code, /\bfetch\s*\(|\bindexedDB\b|\blocalStorage\b|\bXMLHttpRequest\b|\bDexie\b/);
  assert.doesNotMatch(fixtureSource, /\bfetch\s*\(|\bindexedDB\b|\blocalStorage\b|\bXMLHttpRequest\b|\bDexie\b/);
  assert.doesNotMatch(fixtureSource, /threadstep\.(?:document|resume|cloud)/);
});

test("TS-058 repeated mount, refresh, navigation and unmount keep one DOM owner and one listener", async () => {
  const dom = installDeterministicDom();
  const boundary = createReactBoundary();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = (...args) => {
    requests.push(args[0]);
    throw new Error("network is forbidden in TS-058 tests");
  };
  try {
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const adapter = makeAdapter();
      const fixture = await createReactFixture(adapter);
      const key = reactBoundaryKey({
        view: "subject",
        subjectId: "p1",
        identity: cycle % 2 === 0 ? "local" : "synced:db:digest"
      });
      const mounted = boundary.mount({
        key,
        container: fixture.container,
        unmount: () => fixture.root.unmount()
      });
      assert.equal(mounted.status, "mounted");
      assert.equal(boundary.activeCount(), 1);
      assert.equal(boundary.owner().container, fixture.container);
      assert.equal(boundary.canWriteVanilla(fixture.container), false);
      assert.equal(fixture.container.querySelectorAll("[data-react-surface]").length, 1);
      assert.equal(fixture.container.querySelectorAll('[data-project="p1"]').length, 1);
      assert.equal(fixture.listenerStats().activeListeners, 1);
      assert.equal(adapter.listenerCount(), 1);

      await fixture.act(async () => {
        adapter.refresh();
      });
      assert.equal(boundary.activeCount(), 1);
      assert.equal(fixture.container.querySelectorAll("[data-react-surface]").length, 1);
      assert.equal(fixture.listenerStats().activeListeners, 1);
      assert.equal(adapter.listenerCount(), 1);

      const refused = boundary.mount({
        key: key + "|other",
        container: fixture.container,
        unmount() { throw new Error("a second owner must never mount"); }
      });
      assert.equal(refused.status, "refused");
      assert.equal(boundary.activeCount(), 1);

      await fixture.act(async () => {
        boundary.invalidate("navigation-simulated");
      });
      assert.equal(boundary.activeCount(), 0);
      assert.equal(fixture.container.querySelectorAll("[data-react-surface]").length, 0);
      assert.equal(fixture.container.querySelectorAll("*").length, 0);
      assert.equal(fixture.listenerStats().activeListeners, 0);
      assert.equal(adapter.listenerCount(), 0);
      assert.equal(boundary.canWriteVanilla(fixture.container), true);
      fixture.container.remove();
    }
  } finally {
    globalThis.fetch = originalFetch;
    dom.cleanup();
  }
  assert.deepEqual(requests, []);
});

test("TS-058 vanilla cannot replace an active React container and owns it again after release", async () => {
  const dom = installDeterministicDom();
  try {
    const boundary = createReactBoundary();
    const adapter = makeAdapter();
    const fixture = await createReactFixture(adapter);
    const mounted = boundary.mount({
      key: reactBoundaryKey({ view: "subject", subjectId: "p1", identity: "local" }),
      container: fixture.container,
      unmount: () => fixture.root.unmount()
    });
    assert.equal(mounted.status, "mounted");
    if (boundary.canWriteVanilla(fixture.container)) {
      fixture.container.replaceChildren(dom.document.createTextNode("rendu vanilla interdit"));
    }
    assert.equal(fixture.container.querySelector("[data-react-surface]") !== null, true);
    assert.equal(fixture.container.textContent.includes("rendu vanilla interdit"), false);

    await fixture.act(async () => {
      boundary.unmount("return-to-vanilla");
    });
    assert.equal(boundary.canWriteVanilla(fixture.container), true);
    fixture.container.replaceChildren(dom.document.createTextNode("rendu vanilla"));
    assert.equal(fixture.container.textContent, "rendu vanilla");
    fixture.container.remove();
  } finally {
    dom.cleanup();
  }
});

test("TS-058 identifiers stay stable through React refresh and routes stay unchanged", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = makeAdapter();
    const fixture = await createReactFixture(adapter);
    const before = [...fixture.container.querySelectorAll("[data-item]")].map((node) => node.dataset.item);
    assert.deepEqual(before, ["i1", "i2"]);
    await fixture.act(async () => {
      adapter.refresh();
    });
    const after = [...fixture.container.querySelectorAll("[data-item]")].map((node) => node.dataset.item);
    assert.deepEqual(after, before);
    await fixture.act(async () => {
      fixture.root.unmount();
    });
    fixture.container.remove();
  } finally {
    dom.cleanup();
  }

  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.equal(subjectRoute("p1"), "#/sujet/p1");
  assert.deepEqual(parseRoute(subjectRoute("p1")), { view: "subject", subjectId: "p1" });
  assert.match(appSource, /window\.addEventListener\("hashchange"/);
  assert.doesNotMatch(appSource, /createRoot\s*\(|react-dom\/client|from "react"/);
  assert.doesNotMatch(appSource, /react-adapter\.js/);
  assert.doesNotMatch(appSource, /localStorage\.setItem\([^)]*(?:react|surface)/i);
});
