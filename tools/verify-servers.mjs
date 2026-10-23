#!/usr/bin/env node
// Local verification of the Vite preview and development servers under
// /threadstep/. It only talks to 127.0.0.1 and stops every child process.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEV_CSP, PRODUCTION_CSP } from "../vite.config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "/threadstep/";
const viteBin = resolve(root, "node_modules/vite/bin/vite.js");
const APP_MARKER = "ThreadStep | Gardez le fil";

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function startVite(args) {
  const child = spawn(process.execPath, [viteBin, ...args], {
    cwd: root,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
  return { response, text: await response.text() };
}

async function waitFor(url, server, label) {
  const deadline = Date.now() + 20000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready:\n${server.output()}`);
    }
    try {
      const { response } = await fetchText(url);
      if (response.ok) return;
      lastError = new Error(`${label} answered HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw new Error(`${label} did not become ready: ${lastError && lastError.message}\n${server.output()}`);
}

async function stop(server) {
  if (!server || server.child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.child.once("exit", resolveExit));
  server.child.kill("SIGTERM");
  await Promise.race([exited, sleep(3000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([exited, sleep(1000)]);
  }
}

function cspOf(html) {
  const match = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  return match ? match[1] : null;
}

function localAssetUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1];
    if (!value.startsWith(BASE)) continue;
    if (value.startsWith(BASE + "#")) continue;
    urls.add(new URL(value, "http://127.0.0.1").pathname);
  }
  return [...urls];
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function checkAssets(origin, html, label, errors) {
  for (const path of localAssetUrls(html)) {
    try {
      const { response } = await fetchText(origin + path);
      assert(response.ok, `${label}: asset ${path} answered HTTP ${response.status}`, errors);
    } catch (error) {
      errors.push(`${label}: asset ${path} failed (${error.message})`);
    }
  }
}

export async function verifyServers() {
  if (!existsSync(resolve(root, "dist/index.html"))) {
    throw new Error("dist/index.html is missing: run npm run build before verify:servers");
  }
  const errors = [];
  const builtCsp = cspOf(readFileSync(resolve(root, "dist/index.html"), "utf8"));
  assert(builtCsp === PRODUCTION_CSP, "dist/index.html does not carry the production CSP", errors);

  let preview = null;
  let development = null;
  try {
    const previewPort = await freePort();
    const previewOrigin = `http://127.0.0.1:${previewPort}`;
    preview = startVite(["preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"]);
    await waitFor(previewOrigin + BASE, preview, "vite preview");

    const previewPage = await fetchText(previewOrigin + BASE);
    assert(previewPage.response.status === 200, `preview: ${BASE} answered HTTP ${previewPage.response.status}`, errors);
    assert(previewPage.text.includes(APP_MARKER), "preview: built document does not contain the application", errors);
    assert(cspOf(previewPage.text) === PRODUCTION_CSP, "preview: CSP is not the production CSP", errors);
    assert(!/ws:\/\/localhost|ws:\/\/127\.0\.0\.1|unsafe-eval/i.test(previewPage.text), "preview: development CSP leaked into the served document", errors);
    await checkAssets(previewOrigin, previewPage.text, "preview", errors);

    const rootPage = await fetchText(previewOrigin + "/", { redirect: "manual" });
    const rootIsApp = rootPage.response.status === 200 && rootPage.text.includes(APP_MARKER);
    assert(!rootIsApp, "preview: the unprefixed root served the application", errors);

    const devPort = await freePort();
    const devOrigin = `http://127.0.0.1:${devPort}`;
    development = startVite(["--host", "127.0.0.1", "--port", String(devPort), "--strictPort"]);
    await waitFor(devOrigin + BASE, development, "vite dev");

    const devPage = await fetchText(devOrigin + BASE);
    assert(devPage.response.status === 200, `dev: ${BASE} answered HTTP ${devPage.response.status}`, errors);
    assert(cspOf(devPage.text) === DEV_CSP, "dev: CSP is not the documented development CSP", errors);
    assert(/ws:\/\/localhost:\*/.test(cspOf(devPage.text) || ""), "dev: CSP does not allow the local HMR WebSocket", errors);
    assert(/style-src 'self' 'unsafe-inline'/.test(cspOf(devPage.text) || ""), "dev: CSP does not allow injected development styles", errors);
    assert(!/unsafe-eval/i.test(devPage.text), "dev: CSP allows unsafe-eval", errors);
    assert(devPage.text.includes("@vite/client"), "dev: Vite client script is missing", errors);
    await checkAssets(devOrigin, devPage.text, "dev", errors);

    const viteClient = localAssetUrls(devPage.text).find((path) => path.includes("@vite/client"));
    if (viteClient) {
      const clientResponse = await fetchText(devOrigin + viteClient);
      assert(clientResponse.response.ok, `dev: Vite client answered HTTP ${clientResponse.response.status}`, errors);
    }
    const appScript = localAssetUrls(devPage.text).find((path) => path.endsWith("/app.js"));
    if (!appScript) {
      errors.push("dev: HTML does not reference the application module");
    } else {
      const appResponse = await fetchText(devOrigin + appScript);
      assert(appResponse.response.ok, `dev: application module answered HTTP ${appResponse.response.status}`, errors);
    }

    return { ok: errors.length === 0, errors };
  } finally {
    await stop(development);
    await stop(preview);
  }
}

async function main() {
  try {
    const result = await verifyServers();
    if (!result.ok) {
      console.error("verify-servers: FAILED");
      for (const error of result.errors) console.error(" - " + error);
      process.exitCode = 1;
      return;
    }
    console.log("verify-servers: OK (preview and dev under /threadstep/)");
  } catch (error) {
    console.error("verify-servers: ERROR " + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
