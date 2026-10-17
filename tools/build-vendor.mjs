#!/usr/bin/env node
// Reproducible vendoring of the Dexie.js + dexie-cloud-addon browser bundle.
// The generated asset is committed under site/vendor/ so the static page loads
// no third-party CDN script at runtime. Run `npm run vendor:build` after
// changing the pinned versions in package.json.
import { build } from "esbuild";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const pinned = (name) => {
  const declared = pkg.dependencies && pkg.dependencies[name];
  if (!declared) throw new Error("Missing pinned dependency: " + name);
  return declared;
};
const versions = {
  dexie: pinned("dexie"),
  "dexie-cloud-addon": pinned("dexie-cloud-addon"),
};

const entry = [
  'import Dexie from "dexie";',
  'import dexieCloud from "dexie-cloud-addon";',
  "export { Dexie, dexieCloud };",
  "export default Dexie;",
].join("\n");

const outfile = resolve(root, "site/vendor/dexie-cloud.mjs");
mkdirSync(dirname(outfile), { recursive: true });

await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: "vendor-entry.mjs", loader: "js" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  legalComments: "none",
  outfile,
  banner: {
    js: [
      "/* Generated vendor bundle. Do not edit by hand.",
      " * dexie@" + versions.dexie + " + dexie-cloud-addon@" + versions["dexie-cloud-addon"],
      " * Rebuild with: npm run vendor:build */",
    ].join("\n"),
  },
});

console.log("Vendored Dexie Cloud bundle written to site/vendor/dexie-cloud.mjs");
