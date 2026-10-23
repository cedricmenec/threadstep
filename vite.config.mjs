import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sourceIndex = resolve(root, "site/index.html");
const vendorEntry = resolve(root, "site/vendor/dexie-cloud.mjs");

export const BASE = "/threadstep/";

const sourceHtml = readFileSync(sourceIndex, "utf8");
const cspPattern = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;
const productionCspMatch = cspPattern.exec(sourceHtml);
if (!productionCspMatch) {
  throw new Error("site/index.html must declare a production Content-Security-Policy meta tag");
}

export const PRODUCTION_CSP = productionCspMatch[1];
export const DEV_CSP = [
  "default-src 'self'",
  "connect-src https://*.dexie.cloud wss://*.dexie.cloud ws://localhost:* ws://127.0.0.1:*",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join("; ");

export function withDevelopmentCsp(html) {
  return html.replace(
    cspPattern,
    '<meta http-equiv="Content-Security-Policy" content="' + DEV_CSP + '">'
  );
}

function developmentCspPlugin() {
  return {
    name: "threadstep-development-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return withDevelopmentCsp(html);
    }
  };
}

export default {
  root: "site",
  base: BASE,
  publicDir: false,
  appType: "spa",
  plugins: [developmentCspPlugin()],
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
    target: "es2020",
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          return id === vendorEntry ? "vendor-dexie" : undefined;
        }
      }
    }
  }
};
