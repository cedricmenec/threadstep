#!/usr/bin/env node
// Deterministic verification of the local Vite artefact. It never publishes
// anything: two builds are produced in temporary directories, compared and
// inspected for paths, security and Dexie vendor duplication.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BASE = "/threadstep/";
export const PRODUCTION_CSP = (() => {
  const html = readFileSync(resolve(root, "site/index.html"), "utf8");
  const match = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  if (!match) throw new Error("site/index.html must declare a production Content-Security-Policy");
  return match[1];
})();

const SENSITIVE_NAMES = [
  /(^|\/)dexie-cloud\.(?:key|json)$/i,
  /(^|\/)\.env(?:$|\.)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)\.envrc$/i,
  /\.pem$|\.p12$|\.pfx$|\.key$/i,
  /(^|\/)tests?\//i,
  /\.test\.(?:mjs|js)$/i
];

const SECRET_CONTENT = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /"admin[_-]?token"\s*:\s*"[^"]+"/i,
  /admin[_-]?token\s*[:=]\s*['"][^'"]+['"]/i
];

const IMPOSED_INSTANCE = /https:\/\/[a-z0-9-]+\.dexie\.cloud/i;
const CDN_HOST = /(?:cdn\.|unpkg\.com|cdn\.jsdelivr\.net|esm\.sh)/i;
const EVAL_CALL = /\beval\s*\(|new\s+Function\s*\(/;
const VENDOR_NAME = /^assets\/vendor-dexie-[^/]+\.js$/;
const VENDOR_MARKER = /DexieYProvider|DexieError/;

export function sha256(content) {
  return createHash("sha256").update(Buffer.isBuffer(content) ? content : Buffer.from(String(content))).digest("hex");
}

export function readArtifact(directory) {
  const files = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (statSync(absolute).isDirectory()) walk(absolute);
      else files.set(relative(directory, absolute).split("\\").join("/"), readFileSync(absolute));
    }
  };
  walk(directory);
  return files;
}

export function compareArtifacts(first, second) {
  const errors = [];
  const firstNames = [...first.keys()].sort();
  const secondNames = [...second.keys()].sort();
  for (const name of firstNames) {
    if (!second.has(name)) errors.push(`missing in second build: ${name}`);
  }
  for (const name of secondNames) {
    if (!first.has(name)) errors.push(`unexpected in second build: ${name}`);
  }
  for (const name of firstNames) {
    if (!second.has(name)) continue;
    if (sha256(first.get(name)) !== sha256(second.get(name))) {
      errors.push(`content differs between builds: ${name}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function textOf(value) {
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}

function localTarget(value) {
  if (typeof value !== "string" || value === "") return null;
  if (value.startsWith("#")) return null;
  if (/^(?:data:|mailto:|tel:|blob:)/i.test(value)) return null;
  if (/^(?:https?:)?\/\//i.test(value)) return { external: value };
  if (value.startsWith("/")) return { path: value };
  return { relative: value };
}

function stripQuery(value) {
  return value.split("#")[0].split("?")[0];
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assetPath(value) {
  const clean = stripQuery(value);
  if (!clean.startsWith(BASE)) return null;
  return decode(clean.slice(BASE.length));
}

function checkHtmlUrls(files, html, errors) {
  const tags = [...html.matchAll(/<(script|link|img|source|a)\b([^>]*)>/gi)];
  for (const [, tag, attributes] of tags) {
    for (const attribute of ["src", "href", "poster"]) {
      const match = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i").exec(attributes);
      if (!match) continue;
      const target = localTarget(match[1]);
      if (!target) continue;
      if (target.external) {
        if (tag === "script" || tag === "link") errors.push(`external ${tag} ${attribute}: ${target.external}`);
        else errors.push(`external URL in ${tag}: ${target.external}`);
        continue;
      }
      if (target.relative !== undefined) {
        errors.push(`local ${tag} ${attribute} is not prefixed with ${BASE}: ${target.relative}`);
        continue;
      }
      const asset = assetPath(target.path);
      if (asset === null) {
        errors.push(`local ${tag} ${attribute} is outside ${BASE}: ${target.path}`);
        continue;
      }
      if (!files.has(asset)) {
        errors.push(`referenced asset missing: ${target.path}`);
      }
    }
  }
}

function checkCssUrls(files, errors) {
  for (const [name, value] of files) {
    if (!name.endsWith(".css")) continue;
    const css = textOf(value);
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const target = localTarget(match[1].trim());
      if (!target || target.external) {
        if (target && target.external) errors.push(`external CSS URL in ${name}: ${target.external}`);
        continue;
      }
      if (target.relative !== undefined) {
        errors.push(`CSS URL in ${name} is not prefixed with ${BASE}: ${target.relative}`);
        continue;
      }
      const asset = assetPath(target.path);
      if (asset === null || !files.has(asset)) {
        errors.push(`CSS asset missing from ${name}: ${target.path}`);
      }
    }
  }
}

function checkModuleImports(files, errors) {
  for (const [name, value] of files) {
    if (!name.endsWith(".js")) continue;
    const source = textOf(value);
    const specifiers = [
      ...source.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g)
    ].map((match) => match[1]);
    for (const specifier of specifiers) {
      const target = posix.normalize(posix.join(posix.dirname(name), stripQuery(specifier)));
      if (!files.has(target)) {
        errors.push(`module import missing in ${name}: ${specifier}`);
      }
    }
  }
}

export function inspectArtifact(files, expectedCsp = PRODUCTION_CSP) {
  const errors = [];
  const htmlValues = [...files.entries()].filter(([name]) => name === "index.html");
  if (htmlValues.length !== 1) errors.push("index.html is missing from the artefact");
  const html = htmlValues.length ? textOf(htmlValues[0][1]) : "";

  for (const name of files.keys()) {
    if (name !== "index.html" && !/^assets\/[^/]+$/.test(name)) {
      errors.push(`unexpected artefact file: ${name}`);
    }
    if (SENSITIVE_NAMES.some((pattern) => pattern.test(name))) {
      errors.push(`sensitive file in artefact: ${name}`);
    }
  }

  if (html) {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
    if (!csp) {
      errors.push("built document has no Content-Security-Policy meta tag");
    } else {
      if (csp[1] !== expectedCsp) errors.push("built CSP differs from site/index.html");
      if (/unsafe-eval/i.test(csp[1])) errors.push("built CSP allows unsafe-eval");
      if (/unsafe-inline/i.test(csp[1])) errors.push("built CSP allows unsafe-inline");
      if (/ws:\/\/localhost|127\.0\.0\.1/i.test(csp[1])) errors.push("development CSP leaked into the build");
    }
    const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes, body]) => !/\bsrc\s*=/.test(attributes) && body.trim() !== "");
    if (inlineScripts.length) errors.push("built document contains a non-empty inline script");
    checkHtmlUrls(files, html, errors);
  }

  checkCssUrls(files, errors);
  checkModuleImports(files, errors);

  const vendorFiles = [...files.keys()].filter((name) => VENDOR_NAME.test(name));
  if (vendorFiles.length !== 1) {
    errors.push(`expected exactly one assets/vendor-dexie-*.js chunk, found ${vendorFiles.length}`);
  }
  if (html && vendorFiles.length === 1) {
    const vendor = vendorFiles[0];
    if (!html.includes(BASE + vendor)) errors.push(`vendor chunk is not referenced under ${BASE}: ${vendor}`);
  }
  const canonicalVendor = vendorFiles.length ? [...vendorFiles].sort()[0] : null;
  for (const [name, value] of files) {
    const text = textOf(value);
    if (VENDOR_MARKER.test(text) && name !== canonicalVendor) {
      errors.push(`Dexie vendor marker duplicated outside the vendor chunk: ${name}`);
    }
    if (SECRET_CONTENT.some((pattern) => pattern.test(text))) {
      errors.push(`secret-like content in artefact: ${name}`);
    }
    if (IMPOSED_INSTANCE.test(text)) {
      errors.push(`imposed Dexie Cloud instance URL in artefact: ${name}`);
    }
    if (CDN_HOST.test(text)) {
      errors.push(`third-party CDN reference in artefact: ${name}`);
    }
    if (name.endsWith(".js") && EVAL_CALL.test(text)) {
      errors.push(`unsafe eval or new Function in artefact: ${name}`);
    }
  }

  return { ok: errors.length === 0, errors, files: [...files.keys()].sort() };
}

async function runBuild(outDir, viteBuild) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "leftover-from-previous-build.txt"), "must be removed");
  await viteBuild({
    configFile: resolve(root, "vite.config.mjs"),
    logLevel: "silent",
    build: { outDir, emptyOutDir: true }
  });
  return readArtifact(outDir);
}

export async function verifyBuild() {
  const { build } = await import("vite");
  const first = mkdtempSync(join(tmpdir(), "threadstep-build-a-"));
  const second = mkdtempSync(join(tmpdir(), "threadstep-build-b-"));
  const firstOut = join(first, "dist");
  const secondOut = join(second, "dist");
  try {
    const firstFiles = await runBuild(firstOut, build);
    const secondFiles = await runBuild(secondOut, build);
    const comparison = compareArtifacts(firstFiles, secondFiles);
    const firstInspection = inspectArtifact(firstFiles);
    const secondInspection = inspectArtifact(secondFiles);
    const errors = [
      ...comparison.errors,
      ...firstInspection.errors.map((error) => `first build: ${error}`),
      ...secondInspection.errors.map((error) => `second build: ${error}`)
    ];
    return {
      ok: errors.length === 0,
      errors,
      fileCount: firstFiles.size,
      files: firstInspection.files
    };
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
}

async function main() {
  try {
    const result = await verifyBuild();
    if (!result.ok) {
      console.error("verify-build: FAILED");
      for (const error of result.errors) console.error(" - " + error);
      process.exitCode = 1;
      return;
    }
    console.log(`verify-build: OK (${result.fileCount} files, two identical builds)`);
    for (const file of result.files) console.log("  " + file);
  } catch (error) {
    console.error("verify-build: ERROR " + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
