import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import config from "../../vite.config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const entryRelative = "site/app-shell/AppShellSurface.jsx";
const sourceRoot = resolve(root, "site/app-shell");

let compiledModule = null;
let compiledCode = "";

export async function compileAppShellSurface() {
  if (compiledModule) return { module: compiledModule, code: compiledCode };
  const cacheRoot = resolve(root, "node_modules", ".cache");
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(join(cacheRoot, "ts063-shell-"));
  const outfile = resolve(directory, "AppShellSurface.mjs");
  try {
    await build({
      entryPoints: [resolve(root, entryRelative)],
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
    compiledCode = readFileSync(outfile, "utf8");
    compiledModule = await import(pathToFileURL(outfile).href + "?ts063=" + Date.now());
    return { module: compiledModule, code: compiledCode };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function appShellSourceFiles() {
  return [
    "AppShell.jsx",
    "AppHeader.jsx",
    "AppNavigation.jsx",
    "AppShellSurface.jsx"
  ].map((name) => ({
    name,
    source: readFileSync(resolve(sourceRoot, name), "utf8")
  }));
}

export function appShellCompiledCode() {
  return compiledCode;
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

export function installDeterministicDom(html = "<!doctype html><html><body></body></html>") {
  const dom = new JSDOM(html, {
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

export async function createShellFixture({ container, initialState = {} } = {}) {
  const compiled = await compileAppShellSurface();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const host = container || document.createElement("div");
  if (!container) document.body.append(host);
  let surface;
  React.act(() => {
    surface = compiled.module.createAppShellSurface({
      container: host,
      createRoot,
      flushSync,
      initialState
    });
  });
  return {
    React,
    module: compiled.module,
    container: host,
    surface,
    act: React.act,
    update(next) {
      React.act(() => {
        surface.update(next);
      });
    },
    unmount() {
      React.act(() => {
        surface.unmount();
      });
      if (!container) host.remove();
    }
  };
}
