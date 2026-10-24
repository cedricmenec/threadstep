import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import config, { BASE, DEV_CSP, PRODUCTION_CSP, withDevelopmentCsp } from "../vite.config.mjs";
import {
  DATABASE_NAME,
  LOCAL_DATABASE_NAME,
  SCHEMA_VERSION,
  SYNCHRONIZED_STORES,
  CLOUD_CONFIG_KEY
} from "../site/dexie-foundation.js";
import { STORAGE_KEY, RESUME_KEY, PRIORITIES } from "../site/core.js";
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BACKUP_SCHEMA_VERSION } from "../site/indexeddb-backup.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const configSource = read("vite.config.mjs");
const html = read("site/index.html");

test("1.1 Vite is pinned exactly in package.json, lockfile and node_modules", () => {
  assert.match(pkg.devDependencies.vite, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.packages[""].devDependencies.vite, pkg.devDependencies.vite);
  assert.equal(lock.packages["node_modules/vite"].version, pkg.devDependencies.vite);
  assert.equal(lock.packages["node_modules/vite"].dev, true);
  const installedPath = resolve(root, "node_modules/vite/package.json");
  if (existsSync(installedPath)) {
    const installed = JSON.parse(read("node_modules/vite/package.json"));
    assert.equal(installed.version, pkg.devDependencies.vite);
  }
  assert.equal(lock.packages["node_modules/vite"].resolved, `https://registry.npmjs.org/vite/-/vite-${pkg.devDependencies.vite}.tgz`);
});

test("1.1 business dependencies stay pinned to their delivered versions", () => {
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["dexie", "dexie-cloud-addon", "react", "react-dom"]);
  assert.equal(pkg.dependencies.dexie, "4.4.6");
  assert.equal(pkg.dependencies["dexie-cloud-addon"], "4.4.15");
  assert.equal(lock.packages["node_modules/dexie"].version, "4.4.6");
  assert.equal(lock.packages["node_modules/dexie-cloud-addon"].version, "4.4.15");
  assert.match(pkg.dependencies.react, /^\d+\.\d+\.\d+$/);
  assert.match(pkg.dependencies["react-dom"], /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.engines.node, ">=22");
});

test("1.2 Vite scripts exist and existing commands keep their intent", () => {
  assert.equal(pkg.scripts.dev, "vite");
  assert.equal(pkg.scripts.build, "vite build");
  assert.equal(pkg.scripts.preview, "vite preview");
  assert.equal(pkg.scripts["verify:build"], "node tools/verify-build.mjs");
  assert.equal(pkg.scripts["verify:servers"], "node tools/verify-servers.mjs");
  assert.equal(pkg.scripts.test, "node --test tests/*.test.mjs");
  assert.equal(pkg.scripts["backlog:check"], "node scripts/asf/backlog-cli.mjs check");
  assert.equal(pkg.scripts["vendor:build"], "node tools/build-vendor.mjs");
  assert.match(pkg.scripts.check, /^npm test && npm run backlog:check && /);
  assert.doesNotMatch(pkg.scripts.check, /\bvite\b/);
});

test("1.2 dist is ignored and never versioned", () => {
  assert.match(read(".gitignore"), /^dist\/$/m);
  assert.ok(existsSync(resolve(root, "dist")) || true);
});

test("1.3 Vite config uses site/ source, /threadstep/ base and an isolated dist output", () => {
  assert.equal(config.root, "site");
  assert.equal(config.base, "/threadstep/");
  assert.equal(BASE, "/threadstep/");
  assert.equal(config.publicDir, false);
  assert.equal(config.appType, "spa");
  assert.equal(config.build.emptyOutDir, true);
  assert.equal(config.build.target, "es2020");
  assert.equal(config.build.outDir, resolve(root, "dist"));
  assert.notEqual(resolve(config.build.outDir), resolve(root, "site"));
  assert.equal(config.build.outDir.startsWith(resolve(root, "site")), false);
  assert.equal(config.build.assetsInlineLimit, 0);
  assert.equal(config.build.sourcemap, false);
});

test("1.3 deterministic asset and chunk names plus a single vendor chunk", () => {
  const output = config.build.rollupOptions.output;
  assert.equal(output.entryFileNames, "assets/app-[hash].js");
  assert.equal(output.chunkFileNames, "assets/[name]-[hash].js");
  assert.equal(output.assetFileNames, "assets/[name]-[hash][extname]");
  assert.equal(typeof output.manualChunks, "function");
  assert.equal(output.manualChunks(resolve(root, "site/vendor/dexie-cloud.mjs")), "vendor-dexie");
  assert.equal(output.manualChunks(resolve(root, "site/app.js")), undefined);
});

test("4.1 production CSP stays exact and free of development relaxations", () => {
  const expected = "default-src 'self'; connect-src https://*.dexie.cloud wss://*.dexie.cloud; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
  assert.equal(PRODUCTION_CSP, expected);
  assert.match(html, new RegExp('content="' + expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'));
  assert.doesNotMatch(PRODUCTION_CSP, /unsafe-inline|unsafe-eval|ws:\/\/localhost|127\.0\.0\.1/);
  assert.match(PRODUCTION_CSP, /script-src 'self'/);
  assert.doesNotMatch(html, /unsafe-eval/);
});

test("4.1 development CSP is limited to HMR WebSocket and injected styles", () => {
  assert.match(DEV_CSP, /connect-src https:\/\/\*\.dexie\.cloud wss:\/\/\*\.dexie\.cloud ws:\/\/localhost:\* ws:\/\/127\.0\.0\.1:\*/);
  assert.match(DEV_CSP, /style-src 'self' 'unsafe-inline'/);
  assert.match(DEV_CSP, /script-src 'self'/);
  assert.doesNotMatch(DEV_CSP, /unsafe-eval/);
  assert.doesNotMatch(DEV_CSP, /https:\/\/cdn|unpkg|jsdelivr/i);
  const transformed = withDevelopmentCsp(html);
  assert.match(transformed, /ws:\/\/localhost:\*/);
  assert.doesNotMatch(html, /ws:\/\/localhost:/);
});

test("4.1 the CSP override plugin only applies to the development server", () => {
  const plugins = config.plugins.filter(Boolean);
  assert.equal(plugins.length, 1);
  const plugin = plugins[0];
  assert.equal(plugin.name, "threadstep-development-csp");
  assert.equal(plugin.apply, "serve");
  assert.equal(typeof plugin.transformIndexHtml, "function");
  const htmlAfterBuildTransform = plugin.transformIndexHtml(html);
  assert.equal(htmlAfterBuildTransform, withDevelopmentCsp(html));
  assert.ok(htmlAfterBuildTransform);
});

test("4.2 build configuration never runs the application or Dexie and defines no env", () => {
  assert.doesNotMatch(configSource, /site\/app\.js/);
  assert.doesNotMatch(configSource, /\bfrom\s+["']dexie(?:-cloud-addon)?["']/);
  assert.doesNotMatch(configSource, /\bimport\s*\(\s*["']dexie/);
  assert.doesNotMatch(configSource, /\bdefine\s*:/);
  assert.doesNotMatch(configSource, /loadEnv|process\.env/);
  assert.doesNotMatch(configSource, /\b(?:fetch|XMLHttpRequest|WebSocket|indexedDB)\b/);
});

test("4.2 storage identity, routes and backup formats remain the delivered constants", () => {
  assert.equal(DATABASE_NAME, "threadstep");
  assert.equal(LOCAL_DATABASE_NAME, "threadstep-local");
  assert.equal(SCHEMA_VERSION, 3);
  assert.deepEqual(Object.keys(SYNCHRONIZED_STORES).sort(), ["items", "subjects"]);
  assert.equal(CLOUD_CONFIG_KEY, "threadstep.cloud.config.v1");
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  assert.deepEqual(PRIORITIES, ["urgent", "normal", "later"]);
  assert.equal(BACKUP_FORMAT, "threadstep.indexeddb-backup");
  assert.equal(BACKUP_FORMAT_VERSION, 1);
  assert.equal(BACKUP_SCHEMA_VERSION, 3);
});

test("2.1 the obsolete manual Dexie modulepreload is absent from the source document", () => {
  assert.doesNotMatch(html, /rel="modulepreload"[^>]*vendor\/dexie-cloud\.mjs/);
  assert.match(read("site/app.js"), /from "\.\/vendor\/dexie-cloud\.mjs"/);
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
});
