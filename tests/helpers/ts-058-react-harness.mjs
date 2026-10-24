import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import config from "../../vite.config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureRelative = "tests/fixtures/ts-058/synthetic-project-detail.jsx";

let fixtureModule = null;
let fixtureCode = "";

export async function compileFixture() {
  if (fixtureModule) return { module: fixtureModule, code: fixtureCode };
  const cacheRoot = resolve(root, "node_modules", ".cache");
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(join(cacheRoot, "ts058-fixture-"));
  const outfile = resolve(directory, "synthetic-project-detail.mjs");
  try {
    await build({
      entryPoints: [resolve(root, fixtureRelative)],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: config.esbuild && config.esbuild.jsx,
      jsxImportSource: "react",
      external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
      sourcemap: false,
      logLevel: "silent"
    });
    fixtureCode = readFileSync(outfile, "utf8");
    fixtureModule = await import(pathToFileURL(outfile).href + "?ts058=" + Date.now());
    return { module: fixtureModule, code: fixtureCode };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const globalKeys = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "CustomEvent",
  "MutationObserver",
  "DOMParser",
  "NodeFilter",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame"
];

export function installDeterministicDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://threadstep.test/threadstep/",
    pretendToBeVisual: true
  });
  const previous = new Map();
  for (const key of globalKeys) {
    if (!(key in dom.window)) continue;
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: dom.window[key]
    });
  }
  previous.set("IS_REACT_ACT_ENVIRONMENT", Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"));
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true
  });
  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    cleanup() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      dom.window.close();
    }
  };
}

export async function createReactFixture(adapter) {
  const compiled = await compileFixture();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const reactRoot = createRoot(container);
  await React.act(async () => {
    reactRoot.render(React.createElement(compiled.module.SyntheticProjectDetail, { adapter }));
  });
  return {
    React,
    module: compiled.module,
    container,
    root: reactRoot,
    act: React.act,
    listenerStats: compiled.module.fixtureListenerStats,
    resetListenerStats: compiled.module.resetFixtureListenerStats,
    unmount() {
      reactRoot.unmount();
      container.remove();
    }
  };
}

export function fixtureCompiledCode() {
  return fixtureCode;
}
