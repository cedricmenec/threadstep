import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import config from "../../vite.config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const entryRelative = "site/project-detail/ProjectDetailSurface.jsx";
const sourceRoot = resolve(root, "site/project-detail");

let compiledModule = null;
let compiledCode = "";

export async function compileProjectDetailSurface() {
  if (compiledModule) return { module: compiledModule, code: compiledCode };
  const cacheRoot = resolve(root, "node_modules", ".cache");
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(join(cacheRoot, "ts059-surface-"));
  const outfile = resolve(directory, "ProjectDetailSurface.mjs");
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
    compiledModule = await import(pathToFileURL(outfile).href + "?ts059=" + Date.now());
    return { module: compiledModule, code: compiledCode };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function projectDetailSourceFiles() {
  return [
    "ProjectDetail.jsx",
    "TaskList.jsx",
    "TaskItem.jsx",
    "SubtaskList.jsx",
    "TaskActionMenu.jsx",
    "TaskEditor.jsx",
    "ProjectDetailSurface.jsx"
  ].map((name) => ({
    name,
    source: readFileSync(resolve(sourceRoot, name), "utf8")
  }));
}

export function projectDetailCompiledCode() {
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

export async function createSurfaceFixture(adapter) {
  const compiled = await compileProjectDetailSurface();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const container = document.createElement("div");
  document.body.append(container);
  const surface = compiled.module.createProjectDetailSurface({
    adapter,
    container,
    createRoot,
    flushSync
  });
  return {
    React,
    module: compiled.module,
    container,
    surface,
    act: React.act,
    rerender() {
      React.act(() => {
        surface.update();
      });
    },
    unmount() {
      React.act(() => {
        surface.unmount();
      });
      container.remove();
    }
  };
}

export function createStaticAdapter({ snapshot, commandNames = [] } = {}) {
  const listeners = new Set();
  const calls = [];
  const commands = {};
  for (const name of commandNames) {
    commands[name] = (...args) => {
      calls.push([name, args]);
      return true;
    };
  }
  let current = snapshot;
  return {
    commands,
    calls,
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh() {
      for (const listener of [...listeners]) listener(current, { reason: "refresh" });
      return current;
    },
    setSnapshot(next) {
      current = next;
      for (const listener of [...listeners]) listener(current, { reason: "refresh" });
      return current;
    },
    listenerCount: () => listeners.size
  };
}
