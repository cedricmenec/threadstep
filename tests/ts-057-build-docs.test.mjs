import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const guide = read("docs/product/developer-guide.md");
const architecture = read("docs/architecture.md");
const pages = read(".github/workflows/pages.yml");
const pkg = JSON.parse(read("package.json"));

test("5.1 the developer guide documents the exact Vite version and commands", () => {
  assert.match(guide, /vite@7\.3\.7/);
  assert.match(guide, /sans `\^` ni\s+`~`|sans `\^` ni `~`/);
  for (const command of ["npm ci", "npm run dev", "npm run build", "npm run preview", "npm run verify:build", "npm run verify:servers", "npm run check"]) {
    assert.ok(guide.includes(command), command);
  }
});

test("ASF-WF-004 the guide distinguishes Vite sources from deployed artifact", () => {
  assert.match(guide, /`site\/` est la source unique/);
  assert.match(guide, /`dist\/` est un artefact local/);
  assert.match(guide, /GitHub Pages publie désormais `dist\/`/);
  assert.match(guide, /l'ancienne publication `site\/`/i);
  assert.match(guide, /ASF-WF-004/);
});

test("5.1 the guide documents base, vendor, CSP, diagnostics and rollback", () => {
  assert.match(guide, /\/threadstep\//);
  assert.match(guide, /site\/vendor\/dexie-cloud\.mjs/);
  assert.match(guide, /vendor-dexie-/);
  assert.match(guide, /modulepreload/);
  assert.match(guide, /CSP de production/);
  assert.match(guide, /ws:\/\/localhost:\*/);
  assert.match(guide, /unsafe-eval/);
  assert.match(guide, /Diagnostic des chemins cassés/);
  assert.match(guide, /Retour arrière/);
  assert.match(guide, /recette manuelle|recette \*\*manuelle\*\*/i);
});

test("5.1 the architecture distinguishes local tooling from the static publication", () => {
  assert.match(architecture, /Vite \(`TS-057`\)/);
  assert.match(architecture, /`site\/` as source/);
  assert.match(architecture, /unversioned `dist\/`/);
  assert.match(architecture, /serves the compiled assets from `dist\/`/);
  assert.match(architecture, /authorized and CI-checked PR/);
  assert.doesNotMatch(architecture, /no build\/bundle/);
});

test("ASF-WF-004 Pages publishes the verified Vite artifact, not the raw sources", () => {
  assert.match(pages, /uses: actions\/upload-pages-artifact@v4/);
  assert.match(pages, /path: dist/);
  assert.doesNotMatch(pages, /path: site/);
  assert.match(pages, /npm ci/);
  assert.match(pages, /npm run build/);
  assert.match(pages, /npm run verify:build/);
  assert.match(pages, /npm run verify:servers/);
  const workflowFiles = ["pages.yml", "ci.yml"];
  for (const name of workflowFiles) {
    assert.ok(read(".github/workflows/" + name).length > 0, name);
  }
});

test("5.2 package scripts keep the documented separation between check and Vite", () => {
  assert.equal(pkg.scripts["verify:build"], "node tools/verify-build.mjs");
  assert.equal(pkg.scripts["verify:servers"], "node tools/verify-servers.mjs");
  assert.doesNotMatch(pkg.scripts.check, /\bvite\b/);
  assert.doesNotMatch(pkg.scripts.check, /verify:build|verify:servers/);
});
