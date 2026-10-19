import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { STORAGE_KEY, emptyDocument } from "../site/core.js";
import {
  CLOUD_CONFIG_KEY,
  DATABASE_NAME,
  LOCAL_DATABASE_NAME,
  SCHEMA_VERSION,
  SYNCHRONIZED_STORES,
  validateCloudUrl,
  shouldOpenSyncedDatabase,
  cloudConfigureOptions,
  dexieSchema,
  localDexieSchema,
  openLocalDatabase,
  validateSynchronizedStores,
  readCloudConfig,
  writeCloudConfig,
  clearCloudConfig,
  synchronizedDatabaseName
} from "../site/dexie-foundation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const pkg = JSON.parse(read("package.json"));

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    has: (key) => map.has(key)
  };
}

function filesUnder(relativeDir) {
  const absolute = resolve(root, relativeDir);
  const results = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) results.push(...filesUnder(join(relativeDir, entry)));
    else results.push(join(relativeDir, entry));
  }
  return results;
}

test("1.1 pinned dependencies and committed lockfile", () => {
  assert.equal(pkg.dependencies.dexie, "4.4.6");
  assert.equal(pkg.dependencies["dexie-cloud-addon"], "4.4.15");
  assert.ok(existsSync(resolve(root, "package-lock.json")));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.packages["node_modules/dexie"].version, "4.4.6");
  assert.equal(lock.packages["node_modules/dexie-cloud-addon"].version, "4.4.15");
});

test("1.1 vendored asset exists, carries pinned versions and is referenced locally", () => {
  assert.ok(existsSync(resolve(root, "site/vendor/dexie-cloud.mjs")));
  const bundle = read("site/vendor/dexie-cloud.mjs");
  assert.match(bundle, /dexie@4\.4\.6/);
  assert.match(bundle, /dexie-cloud-addon@4\.4\.15/);
  assert.match(bundle, /export\s*\{[^}]*\bDexie\b[^}]*\bdexieCloud\b/);
  const html = read("site/index.html");
  assert.match(html, /href="\.\/vendor\/dexie-cloud\.mjs"/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /cdn\./i);
});

test("1.2 npm run check covers the new site module", () => {
  assert.match(pkg.scripts.check, /node --check site\/dexie-foundation\.js/);
  assert.match(pkg.scripts.check, /node --check site\/app\.js/);
});

test("2.1 validateCloudUrl accepts only HTTPS dexie.cloud URLs", () => {
  const valid = validateCloudUrl("https://demo123.dexie.cloud");
  assert.equal(valid.valid, true);
  assert.equal(valid.url, "https://demo123.dexie.cloud");
  assert.equal(validateCloudUrl("https://dexie.cloud").valid, true);
  assert.equal(validateCloudUrl("https://demo123.dexie.cloud/").url, "https://demo123.dexie.cloud");

  assert.equal(validateCloudUrl("http://demo123.dexie.cloud").valid, false);
  assert.equal(validateCloudUrl("http://demo123.dexie.cloud").reason, "insecure");
  assert.equal(validateCloudUrl("not a url").valid, false);
  assert.equal(validateCloudUrl("not a url").reason, "malformed");
  assert.equal(validateCloudUrl("").valid, false);
  assert.equal(validateCloudUrl(null).valid, false);
  assert.equal(validateCloudUrl("https://user:pass@demo.dexie.cloud").valid, false);
  assert.equal(validateCloudUrl("https://user:pass@demo.dexie.cloud").reason, "credentials");
  assert.equal(validateCloudUrl("https://example.com").valid, false);
  assert.equal(validateCloudUrl("https://example.com").reason, "host");
  assert.equal(validateCloudUrl("https://evil-dexie.cloud.attacker.com").valid, false);
});

test("2.1 validation is purely syntactic (no network primitive in the module)", () => {
  const source = read("site/dexie-foundation.js");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert.doesNotMatch(source, /sendBeacon/);
  assert.doesNotMatch(source, /navigator\./);
});

test("2.2 shouldOpenSyncedDatabase gates on a valid configuration", () => {
  assert.equal(shouldOpenSyncedDatabase(null), false);
  assert.equal(shouldOpenSyncedDatabase(undefined), false);
  assert.equal(shouldOpenSyncedDatabase({}), false);
  assert.equal(shouldOpenSyncedDatabase({ databaseUrl: "http://demo.dexie.cloud" }), false);
  assert.equal(shouldOpenSyncedDatabase({ databaseUrl: "https://example.com" }), false);
  assert.equal(shouldOpenSyncedDatabase({ databaseUrl: "https://demo.dexie.cloud" }), true);
});

test("2.2 cloudConfigureOptions wires Dexie native interaction to custom OTP GUI", () => {
  const options = cloudConfigureOptions("https://demo.dexie.cloud");
  assert.deepEqual(options, {
    databaseUrl: "https://demo.dexie.cloud",
    requireAuth: true,
    customLoginGui: true,
    unsyncedTables: ["meta"]
  });
  assert.equal(Object.prototype.hasOwnProperty.call(options, "nameSuffix"), false);
  assert.notEqual(options.nameSuffix, false);
});

test("2.3 configuration storage uses a dedicated non-document key", () => {
  assert.notEqual(CLOUD_CONFIG_KEY, STORAGE_KEY);
  assert.doesNotMatch(JSON.stringify(emptyDocument()), new RegExp(CLOUD_CONFIG_KEY));
  const source = read("site/dexie-foundation.js");
  assert.match(source, /threadstep\.cloud\.config\.v1/);
});

test("2.3 read/write/clear never touch the document key", () => {
  const storage = fakeStorage();
  assert.equal(writeCloudConfig(storage, "https://demo.dexie.cloud"), true);
  assert.equal(storage.has(CLOUD_CONFIG_KEY), true);
  assert.equal(storage.has(STORAGE_KEY), false);
  assert.deepEqual(readCloudConfig(storage), { databaseUrl: "https://demo.dexie.cloud" });
  clearCloudConfig(storage);
  assert.equal(storage.has(CLOUD_CONFIG_KEY), false);
  assert.equal(readCloudConfig(storage), null);
});

test("2.3 invalid URLs are never recorded", () => {
  const storage = fakeStorage();
  assert.equal(writeCloudConfig(storage, "https://example.com"), false);
  assert.equal(writeCloudConfig(storage, "http://demo.dexie.cloud"), false);
  assert.equal(storage.has(CLOUD_CONFIG_KEY), false);
});

test("2.3 corrupt or foreign stored configuration is ignored", () => {
  const corrupt = fakeStorage({ [CLOUD_CONFIG_KEY]: "{not json" });
  assert.equal(readCloudConfig(corrupt), null);
  const foreign = fakeStorage({ [CLOUD_CONFIG_KEY]: JSON.stringify({ databaseUrl: "https://example.com" }) });
  assert.equal(readCloudConfig(foreign), null);
});

test("3.1 schema has an explicit integer version and no ++id store", () => {
  const schema = dexieSchema();
  assert.equal(Number.isInteger(schema.version), true);
  assert.equal(schema.version, SCHEMA_VERSION);
  const definitions = Object.entries(schema.stores);
  assert.ok(definitions.length > 0);
  for (const [name, definition] of definitions) {
    assert.doesNotMatch(definition, /\+\+id/);
    assert.equal(definition, name === "meta" ? "key" : "id");
  }
  assert.equal(schema.stores.meta, "key");
  assert.deepEqual(cloudConfigureOptions("https://demo.dexie.cloud").unsyncedTables, ["meta"]);
});

test("3.2 validateSynchronizedStores rejects ++id and accepts explicit id or @id", () => {
  assert.equal(validateSynchronizedStores({ subjects: "@id" }), true);
  assert.equal(validateSynchronizedStores({ subjects: "id" }), true);
  assert.equal(SCHEMA_VERSION, 3);
  assert.equal(validateSynchronizedStores({ subjects: "++id, title" }), false);
  assert.equal(validateSynchronizedStores({ subjects: "title" }), false);
  assert.equal(validateSynchronizedStores({}), false);
  assert.equal(validateSynchronizedStores(null), false);
  assert.equal(validateSynchronizedStores({ subjects: "@id", items: "++id" }), false);
});

test("3.2 declared upgrade performs no implicit deletion", () => {
  const schema = dexieSchema();
  assert.equal(typeof schema.upgrade, "function");
  const forbidden = () => { throw new Error("implicit deletion is not allowed"); };
  const transaction = { delete: forbidden, clear: forbidden, drop: forbidden };
  assert.doesNotThrow(() => schema.upgrade(transaction));
});

test("3.3 database name is stable and nameSuffix stays active", () => {
  const schema = dexieSchema();
  assert.equal(schema.name, DATABASE_NAME);
  assert.equal(typeof DATABASE_NAME, "string");
  assert.ok(DATABASE_NAME.length > 0);
  assert.deepEqual(Object.keys(SYNCHRONIZED_STORES).sort(), ["items", "subjects"]);
  const options = cloudConfigureOptions("https://demo.dexie.cloud");
  assert.notEqual(options.nameSuffix, false);
});

test("3.3 per-URL base names are deterministic, distinct and legacy preserving", () => {
  const same = synchronizedDatabaseName("https://alpha.dexie.cloud");
  assert.equal(same, synchronizedDatabaseName("https://alpha.dexie.cloud/"));
  assert.match(same, /^threadstep-ws-[a-f0-9]{16}$/);

  // Both URLs derive the same native nameSuffix ("alpha" / first path segment)
  // but must still receive distinct application-level bases.
  const pathCollision = synchronizedDatabaseName("https://dexie.cloud/alpha");
  const hostCollision = synchronizedDatabaseName("https://alpha.dexie.cloud");
  assert.notEqual(pathCollision, hostCollision);

  const beta = synchronizedDatabaseName("https://beta.dexie.cloud");
  assert.notEqual(same, beta);
  assert.equal(synchronizedDatabaseName("https://alpha.dexie.cloud", {
    legacyDatabaseName: DATABASE_NAME
  }), DATABASE_NAME);
  assert.equal(synchronizedDatabaseName("https://alpha.dexie.cloud", {
    legacyName: DATABASE_NAME
  }), DATABASE_NAME);
  assert.equal(synchronizedDatabaseName("not a url"), null);
  assert.equal(synchronizedDatabaseName("http://alpha.dexie.cloud"), null);
  assert.notEqual(synchronizedDatabaseName("https://alpha.dexie.cloud"), DATABASE_NAME);
  assert.notEqual(synchronizedDatabaseName("https://alpha.dexie.cloud"), LOCAL_DATABASE_NAME);

  const options = cloudConfigureOptions("https://alpha.dexie.cloud");
  assert.equal(options.nameSuffix, undefined);
  assert.notEqual(options.nameSuffix, false);
  assert.equal(options.requireAuth, true);
  assert.equal(dexieSchema().version, SCHEMA_VERSION);
});

test("3.4 the autonomous local workspace has a distinct stable schema", () => {
  const local = localDexieSchema();
  const synced = dexieSchema();
  assert.equal(local.name, LOCAL_DATABASE_NAME);
  assert.equal(typeof LOCAL_DATABASE_NAME, "string");
  assert.ok(LOCAL_DATABASE_NAME.length > 0);
  assert.notEqual(local.name, synced.name);
  assert.equal(local.version, synced.version);
  assert.equal(local.version, SCHEMA_VERSION);
  assert.deepEqual(local.stores, synced.stores);
  assert.deepEqual(Object.keys(local.stores).sort(), ["items", "meta", "subjects"]);
  for (const [name, definition] of Object.entries(local.stores)) {
    assert.equal(definition, name === "meta" ? "key" : "id");
    assert.doesNotMatch(definition, /\+\+id/);
  }
});

test("3.4 the local schema upgrade neither deletes, clears nor recreates records", () => {
  const local = localDexieSchema();
  assert.equal(typeof local.upgrade, "function");
  const forbidden = () => { throw new Error("implicit deletion is not allowed"); };
  const transaction = { delete: forbidden, clear: forbidden, drop: forbidden };
  assert.doesNotThrow(() => local.upgrade(transaction));
});

test("3.5 the local bootstrap installs no Dexie Cloud addon, configuration or network", () => {
  const calls = [];
  class FakeDexie {
    constructor(name, options) {
      calls.push({ type: "construct", name, options });
      this.cloud = { configure() { throw new Error("local workspace must not configure Cloud"); } };
    }
    version(value) { calls.push({ type: "version", value }); return this; }
    stores(value) { calls.push({ type: "stores", value }); return this; }
    upgrade(value) { calls.push({ type: "upgrade", value }); return this; }
  }
  const db = openLocalDatabase(FakeDexie);
  assert.ok(db instanceof FakeDexie);
  const construct = calls.find((call) => call.type === "construct");
  assert.equal(construct.name, LOCAL_DATABASE_NAME);
  assert.equal(construct.options, undefined);
  assert.equal(calls.some((call) => call.type === "configure"), false);
  assert.equal(calls.find((call) => call.type === "version").value, SCHEMA_VERSION);
  assert.deepEqual(calls.find((call) => call.type === "stores").value, { ...SYNCHRONIZED_STORES, meta: "key" });

  const source = read("site/dexie-foundation.js");
  const start = source.indexOf("export function openLocalDatabase");
  const localBootstrap = source.slice(start, source.indexOf("export function validateSynchronizedStores"));
  assert.doesNotMatch(localBootstrap, /dexieCloud|cloud\.configure|addons|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/i);
  assert.throws(() => openLocalDatabase(null), /Dexie constructor is required/);
});

test("3.5 every site module is covered by npm run check", () => {
  const modules = readdirSync(resolve(root, "site")).filter((file) => file.endsWith(".js"));
  assert.ok(modules.includes("dexie-foundation.js"));
  assert.ok(modules.includes("persistence.js"));
  for (const file of modules) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(pkg.scripts.check, new RegExp(`node --check site/${escaped}`), file);
  }
});

test("4.1 bootstrap constructs and configures only behind the gate", () => {
  const source = read("site/app.js");
  const gate = source.indexOf("shouldOpenSyncedDatabase(config)");
  const construct = source.indexOf("new Dexie(");
  const configure = source.indexOf("db.cloud.configure(");
  assert.ok(gate > -1 && construct > gate && configure > gate);
  assert.match(source, /if\s*\(!shouldOpenSyncedDatabase\(config\)\)\s*return null;/);
  assert.match(source, /cloudConfigureOptions\(config\.databaseUrl\)/);
  assert.doesNotMatch(source, /dexie-cloud\.key/);
  assert.doesNotMatch(source, /dexie-cloud\.json/);
});

test("4.2 the configuration form is gated and the bootstrap returns first", () => {
  const source = read("site/app.js");
  assert.match(source, /cloudConfigEl\.hidden = open;/);
  assert.match(source, /const open = shouldOpenSyncedDatabase\(config\);/);
  const bootstrapSource = source.slice(
    source.indexOf("function bootstrapSyncedDatabase"),
    source.indexOf("function showCloudConfigError")
  );
  assert.ok(bootstrapSource.indexOf("return null;") < bootstrapSource.indexOf("new Dexie("));
});

test("4.3 CSP allows only Dexie Cloud hosts and keeps relative assets", () => {
  const html = read("site/index.html");
  const match = /connect-src ([^;]+);/.exec(html);
  assert.ok(match);
  const sources = match[1].trim().split(/\s+/);
  assert.deepEqual(sources, ["https://*.dexie.cloud", "wss://*.dexie.cloud"]);
  assert.doesNotMatch(match[1], /'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /<script type="module" src="\.\/app\.js">/);
  assert.match(html, /href="\.\/styles\.css"/);
});

test("5.1 no secrets, Dexie CLI files or imposed URL in the delivered site", () => {
  const files = filesUnder("site");
  const forbiddenName = /dexie-cloud\.(?:key|json)/;
  const imposedUrl = /https:\/\/[a-z0-9-]+\.dexie\.cloud/i;
  const secretPatterns = [
    /BEGIN (?:RSA |EC )?PRIVATE KEY/,
    /"admin[_-]?token"\s*:\s*"/i,
    /admin[_-]?token\s*[:=]\s*['"][^'"]+['"]/i
  ];
  for (const file of files) {
    assert.doesNotMatch(file, forbiddenName, file + " filename must not ship Dexie CLI files");
    const content = read(file);
    assert.doesNotMatch(content, imposedUrl, file + " must not hardcode an instance URL");
    for (const pattern of secretPatterns) {
      assert.doesNotMatch(content, pattern, file + " must not ship secrets");
    }
  }
  assert.match(read(".gitignore"), /dexie-cloud\.key/);
  assert.match(read(".gitignore"), /dexie-cloud\.json/);
});

test("5.2 developer guide and MVP note describe the foundation", () => {
  const guide = read("docs/product/developer-guide.md");
  assert.match(guide, /dexie-foundation\.js/);
  assert.match(guide, /site\/vendor\/dexie-cloud\.mjs/);
  assert.match(guide, /connect-src https:\/\/\*\.dexie\.cloud wss:\/\/\*\.dexie\.cloud/);
  const mvp = read("docs/product/mvp.md");
  assert.match(mvp, /TS-024/);
  assert.match(mvp, /dexie-foundation\.js/);
});
