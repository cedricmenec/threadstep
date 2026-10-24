import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import config, { BASE, PRODUCTION_CSP } from "../vite.config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const configSource = read("vite.config.mjs");
const html = read("site/index.html");

function exact(version) {
  return typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version);
}

test("TS-058 React and React DOM are pinned runtime dependencies", () => {
  assert.ok(exact(pkg.dependencies.react), pkg.dependencies.react);
  assert.ok(exact(pkg.dependencies["react-dom"]), pkg.dependencies["react-dom"]);
  assert.equal(pkg.dependencies.react, lock.packages["node_modules/react"].version);
  assert.equal(pkg.dependencies["react-dom"], lock.packages["node_modules/react-dom"].version);
  assert.equal(lock.packages[""].dependencies.react, pkg.dependencies.react);
  assert.equal(lock.packages[""].dependencies["react-dom"], pkg.dependencies["react-dom"]);
  assert.equal(lock.packages["node_modules/react"].dev, undefined);
  assert.equal(lock.packages["node_modules/react-dom"].dev, undefined);
  assert.equal(pkg.devDependencies.react, undefined);
  assert.equal(pkg.devDependencies["react-dom"], undefined);
  for (const installed of ["react", "react-dom"]) {
    const path = resolve(root, "node_modules", installed, "package.json");
    if (existsSync(path)) {
      assert.equal(JSON.parse(readFileSync(path, "utf8")).version, pkg.dependencies[installed]);
    }
  }
});

test("TS-058 jsdom is pinned in devDependencies only", () => {
  assert.ok(exact(pkg.devDependencies.jsdom), pkg.devDependencies.jsdom);
  assert.equal(lock.packages["node_modules/jsdom"].version, pkg.devDependencies.jsdom);
  assert.equal(lock.packages["node_modules/jsdom"].dev, true);
  assert.equal(lock.packages[""].devDependencies.jsdom, pkg.devDependencies.jsdom);
  assert.equal(pkg.dependencies.jsdom, undefined);
});

test("TS-058 business dependency versions and Node engine are unchanged", () => {
  assert.equal(pkg.dependencies.dexie, "4.4.6");
  assert.equal(pkg.dependencies["dexie-cloud-addon"], "4.4.15");
  assert.equal(lock.packages["node_modules/dexie"].version, "4.4.6");
  assert.equal(lock.packages["node_modules/dexie-cloud-addon"].version, "4.4.15");
  assert.equal(pkg.engines.node, ">=22");
});

test("TS-058 no caret, tilde or Babel dependency is introduced", () => {
  for (const group of ["dependencies", "devDependencies"]) {
    for (const [name, version] of Object.entries(pkg[group])) {
      assert.ok(exact(version), name + " must be pinned exactly, got " + version);
      assert.doesNotMatch(name, /^@babel\//);
    }
  }
  assert.doesNotMatch(configSource, /@babel|babeljs|babel-loader/i);
});

test("TS-058 Vite compiles JSX with the automatic runtime and keeps the build static", async () => {
  assert.equal(config.esbuild.jsx, "automatic");
  assert.equal(config.root, "site");
  assert.equal(config.base, BASE);
  assert.equal(BASE, "/threadstep/");
  assert.equal(config.publicDir, false);
  assert.equal(config.appType, "spa");
  assert.equal(config.build.outDir, resolve(root, "dist"));
  assert.equal(config.build.outDir.startsWith(resolve(root, "site")), false);
  assert.doesNotMatch(configSource, /plugin-react|babel/i);
  assert.doesNotMatch(configSource, /cdn\.|unpkg|jsdelivr|esm\.sh/i);

  const source = 'export const view = <p data-fixture="automatic">JSX</p>;';
  const transformed = await transform(source, {
    loader: "jsx",
    jsx: config.esbuild.jsx,
    jsxImportSource: "react",
    format: "esm"
  });
  assert.match(transformed.code, /react\/jsx-runtime/);
  assert.doesNotMatch(transformed.code, /React\.createElement/);
});

test("TS-058 production CSP and document security are unchanged", () => {
  const expected = "default-src 'self'; connect-src https://*.dexie.cloud wss://*.dexie.cloud; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
  assert.equal(PRODUCTION_CSP, expected);
  assert.match(html, new RegExp('content="' + expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'));
  assert.match(PRODUCTION_CSP, /script-src 'self'/);
  assert.doesNotMatch(PRODUCTION_CSP, /unsafe-inline|unsafe-eval|cdn\.|unpkg|jsdelivr/i);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/i);
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /cdn\.|unpkg|jsdelivr|esm\.sh/i);
});

test("TS-058 the app still loads one local module and no React surface", () => {
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
  const app = read("site/app.js");
  assert.doesNotMatch(app, /from "react"|from "react-dom|\.jsx["']/);
  assert.match(app, /from "\.\/react-boundary\.js"/);
  assert.doesNotMatch(app, /createRoot|react-adapter\.js/);
});
