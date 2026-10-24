import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const pages = read(".github/workflows/pages.yml");
const ci = read(".github/workflows/ci.yml");

function job(yaml, name) {
  const start = yaml.indexOf("\n  " + name + ":\n");
  assert.notEqual(start, -1, `missing job ${name}`);
  const next = yaml.slice(start + 1).search(/\n  [a-z][a-z-]*:\n/g);
  return next < 0 ? yaml.slice(start) : yaml.slice(start, start + 1 + next);
}

function assertOrdered(source, commands) {
  let offset = -1;
  for (const command of commands) {
    const found = source.indexOf(command, offset + 1);
    assert.ok(found > offset, `missing/out-of-order action: ${command}`);
    offset = found;
  }
}

function assertFailClosed(source) {
  assert.match(source, /on:\n  push:\n    branches: \[main\]\n  workflow_dispatch:/);
  assert.match(source, /contents: read/);
  assert.match(source, /pages: write/);
  assert.match(source, /id-token: write/);
  assert.match(source, /group: pages-deployment/);
  assert.doesNotMatch(source, /pull_request_target|continue-on-error:\s*true|if:\s*always\(\)|\|\|\s*true/);

  const validate = job(source, "validate");
  const build = job(source, "build");
  const deploy = job(source, "deploy");
  assertOrdered(validate, ["actions/checkout@v4", "actions/setup-node@v4", "npm ci", "npm run check"]);
  assert.match(build, /needs: validate/);
  assertOrdered(build, [
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "npm ci",
    "npm run build",
    "npm run verify:build",
    "npm run verify:servers",
    "actions/configure-pages@v5",
    "actions/upload-pages-artifact@v4"
  ]);
  assert.match(build, /path: dist(?:\s|$)/);
  assert.doesNotMatch(build, /path: site(?:\s|$)/);
  assert.match(deploy, /needs: build/);
  assert.match(deploy, /name: github-pages/);
  assert.match(deploy, /actions\/deploy-pages@v4/);
}

test("ASF-WF-004 Pages has a validated build and deploy dependency chain", () => {
  assertFailClosed(pages);
});

test("ASF-WF-004 pipeline rejects a raw site upload, missing verification, and an always-run upload", () => {
  assert.throws(() => assertFailClosed(pages.replace("path: dist", "path: site")));
  assert.throws(() => assertFailClosed(pages.replace("      - run: npm run verify:build\n", "")));
  assert.throws(() => assertFailClosed(pages.replace("      - run: npm run verify:servers\n", "")));
  assert.throws(() => assertFailClosed(pages.replace("      - uses: actions/upload-pages-artifact@v4", "      - if: always()\n        uses: actions/upload-pages-artifact@v4")));
  assert.throws(() => assertFailClosed(pages.replace("    needs: validate", "    needs: []")));
  assert.throws(() => assertFailClosed(pages.replace("    needs: build", "    needs: []")));
});

test("ASF-WF-004 independent pull-request check builds and inspects Vite before merge", () => {
  assert.match(ci, /pull_request:\n    branches: \[main\]/);
  assert.match(ci, /permissions:\n  contents: read/);
  const check = job(ci, "check");
  assertOrdered(check, [
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "actionlint@v1.7.7",
    "npm ci",
    "npm run check",
    "npm run build",
    "npm run verify:build",
    "npm run verify:servers"
  ]);
  assert.doesNotMatch(check, /continue-on-error:\s*true|pull_request_target/);
  assert.match(ci, /@fission-ai\/openspec@1.14.1/);
});

test("ASF-WF-004 existing artifact rejection tests remain part of npm test", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  const inspectors = read("tests/ts-057-build-verify.test.mjs");
  for (const rule of [
    "missing referenced asset",
    "unprefixed local URL",
    "incorrect or relaxed CSP",
    "sensitive files and configuration",
    "duplicated vendor chunk"
  ]) {
    assert.ok(inspectors.includes(rule), rule);
  }
});
