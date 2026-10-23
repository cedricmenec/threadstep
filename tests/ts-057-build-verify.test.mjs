import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_CSP,
  compareArtifacts,
  inspectArtifact,
  sha256
} from "../tools/verify-build.mjs";

function html({ csp = PRODUCTION_CSP, script = "/threadstep/assets/app-abc.js", extra = "" } = {}) {
  return `<!doctype html>
<html lang="fr"><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="icon" href="/threadstep/assets/favicon-abc.svg" type="image/svg+xml">
<script type="module" crossorigin src="${script}"></script>
<link rel="modulepreload" crossorigin href="/threadstep/assets/vendor-dexie-abc.js">
<link rel="stylesheet" crossorigin href="/threadstep/assets/index-abc.css">
${extra}
</head><body><a href="#/parametres">Paramètres</a></body></html>`;
}

function artefact(overrides = {}) {
  const files = new Map([
    ["index.html", html()],
    [
      "assets/app-abc.js",
      'import"./vendor-dexie-abc.js";const n="evalDaysLeft";export{n};'
    ],
    ["assets/vendor-dexie-abc.js", "class DexieError{}class DexieYProvider{}export{DexieError};"],
    ["assets/index-abc.css", "body{color:#111}"],
    ["assets/favicon-abc.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>']
  ]);
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) files.delete(name);
    else files.set(name, value);
  }
  return files;
}

test("a complete artefact passes path, CSP, vendor and security inspection", () => {
  const result = inspectArtifact(artefact());
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("a missing referenced asset is detected", () => {
  const result = inspectArtifact(artefact({ "assets/app-abc.js": null }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("referenced asset missing: /threadstep/assets/app-abc.js")));
});

test("an unprefixed local URL is rejected", () => {
  const files = artefact();
  files.set("index.html", html({ script: "/assets/app-abc.js" }));
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("outside /threadstep/")));
});

test("a relative local URL is rejected", () => {
  const files = artefact();
  files.set("index.html", html({ script: "./assets/app-abc.js" }));
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("is not prefixed with /threadstep/")));
});

test("sensitive files and configuration are excluded", () => {
  const files = artefact();
  files.set("dexie-cloud.key", "secret");
  files.set("dexie-cloud.json", "{}");
  files.set(".env", "TOKEN=1");
  files.set("assets/debug.test.mjs", "test");
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  for (const name of ["dexie-cloud.key", "dexie-cloud.json", ".env", "assets/debug.test.mjs"]) {
    assert.ok(result.errors.some((error) => error.includes(name)), name);
  }
});

test("a duplicated vendor chunk and duplicated Dexie marker are detected", () => {
  const files = artefact();
  files.set("assets/vendor-dexie-def.js", "class DexieError{}export{};");
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("expected exactly one assets/vendor-dexie-*.js")));
  assert.ok(result.errors.some((error) => error.includes("duplicated outside the vendor chunk")));
});

test("a non-vendor chunk containing Dexie is detected even with one vendor file", () => {
  const files = artefact();
  files.set("assets/other-abc.js", "class DexieYProvider{}");
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("Dexie vendor marker duplicated")));
});

test("an incorrect or relaxed CSP is rejected", () => {
  const wrong = inspectArtifact(artefact({ "index.html": html({ csp: "default-src *" }) }));
  assert.equal(wrong.ok, false);
  assert.ok(wrong.errors.some((error) => error.includes("built CSP differs")));

  const dev = inspectArtifact(artefact({
    "index.html": html({ csp: PRODUCTION_CSP.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") })
  }));
  assert.equal(dev.ok, false);
  assert.ok(dev.errors.some((error) => error.includes("unsafe-inline")));

  const evalCsp = inspectArtifact(artefact({
    "index.html": html({ csp: PRODUCTION_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'") })
  }));
  assert.ok(evalCsp.errors.some((error) => error.includes("unsafe-eval")));

  const leaked = inspectArtifact(artefact({
    "index.html": html({ csp: PRODUCTION_CSP.replace("wss://*.dexie.cloud", "wss://*.dexie.cloud ws://localhost:*") })
  }));
  assert.ok(leaked.errors.some((error) => error.includes("development CSP leaked")));
});

test("CDN, instance URL, secret and eval content are rejected", () => {
  const files = artefact();
  files.set("assets/evil-abc.js", [
    'import("https://cdn.example.com/dexie.js");',
    'const u="https://demo123.dexie.cloud";',
    'const token={"admin_token":"abcd"};',
    "eval('1');"
  ].join("\n"));
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("CDN")));
  assert.ok(result.errors.some((error) => error.includes("imposed Dexie Cloud instance URL")));
  assert.ok(result.errors.some((error) => error.includes("secret-like content")));
  assert.ok(result.errors.some((error) => error.includes("unsafe eval")));
});

test("an external script tag in the built document is rejected", () => {
  const files = artefact();
  files.set("index.html", html({ extra: '<script src="https://cdn.example.com/app.js"></script>' }));
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("external script")));
});

test("a non-empty inline script is rejected while empty placeholders pass", () => {
  const files = artefact();
  files.set("index.html", html({ extra: "<script>alert(1)</script>" }));
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("inline script")));
});

test("Dexie evalDaysLeft and other normal identifiers are not false positives", () => {
  const result = inspectArtifact(artefact());
  assert.equal(result.errors.some((error) => error.includes("unsafe eval")), false);
});

test("unexpected residue files are rejected", () => {
  const files = artefact();
  files.set("notes.txt", "leftover");
  const result = inspectArtifact(files);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unexpected artefact file")));
});

test("two builds compare by relative path and SHA-256 content", () => {
  const first = artefact();
  const second = artefact();
  assert.deepEqual(compareArtifacts(first, second), { ok: true, errors: [] });
  assert.equal(sha256(first.get("index.html")), sha256(second.get("index.html")));

  const changed = artefact({ "assets/index-abc.css": "body{color:#222}" });
  const differing = compareArtifacts(first, changed);
  assert.equal(differing.ok, false);
  assert.ok(differing.errors.some((error) => error.includes("content differs")));

  const extra = artefact();
  extra.set("assets/extra-abc.js", "export{};");
  const mismatched = compareArtifacts(first, extra);
  assert.equal(mismatched.ok, false);
  assert.ok(mismatched.errors.some((error) => error.includes("unexpected in second build")));
});

test("the missing-document case fails closed", () => {
  const result = inspectArtifact(new Map());
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("index.html is missing")));
});
