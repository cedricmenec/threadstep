import { sha256Hex } from "./fingerprint.js";

export const CLOUD_CONFIG_KEY = "threadstep.cloud.config.v1";
export const DATABASE_NAME = "threadstep";
export const LOCAL_DATABASE_NAME = "threadstep-local";
export const SCHEMA_VERSION = 2;
export const CLOUD_HOST_SUFFIX = "dexie.cloud";
export const SYNCHRONIZED_STORES = Object.freeze({
  // Ordinary string primary keys accept current UUIDs and legacy: IDs.
  // Dexie Cloud @id tables reject explicit IDs without their table prefix.
  subjects: "id",
  items: "id"
});

function rejection(reason, message) {
  return { valid: false, url: null, reason, message };
}

export function validateCloudUrl(raw) {
  if (typeof raw !== "string") {
    return rejection("missing", "Indiquez l'URL de votre instance Dexie Cloud.");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return rejection("empty", "Indiquez l'URL de votre instance Dexie Cloud.");
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return rejection("malformed", "Cette URL est invalide.");
  }
  if (parsed.protocol !== "https:") {
    return rejection("insecure", "L'URL doit commencer par https://.");
  }
  if (parsed.username || parsed.password) {
    return rejection("credentials", "L'URL ne doit pas contenir d'identifiants.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== CLOUD_HOST_SUFFIX && !host.endsWith("." + CLOUD_HOST_SUFFIX)) {
    return rejection("host", "L'URL doit pointer vers une instance dexie.cloud.");
  }
  return { valid: true, url: parsed.origin, reason: null, message: null };
}

export function shouldOpenSyncedDatabase(config) {
  if (!config || typeof config !== "object") return false;
  const candidate = typeof config.databaseUrl === "string"
    ? config.databaseUrl
    : typeof config.url === "string" ? config.url : null;
  return validateCloudUrl(candidate).valid;
}

// Deterministic per-URL base name. `nameSuffix: true` (the Dexie Cloud
// default) remains enabled, so the effective IndexedDB name is
// `<base>-<nativeSuffix>`. Legacy workspaces pass their existing name.
export function synchronizedDatabaseName(rawUrl, options = {}) {
  const result = validateCloudUrl(rawUrl);
  if (!result.valid) return null;
  const settings = options && typeof options === "object" ? options : {};
  if (typeof settings.legacyDatabaseName === "string" && settings.legacyDatabaseName.length > 0) {
    return settings.legacyDatabaseName;
  }
  if (typeof settings.legacyName === "string" && settings.legacyName.length > 0) {
    return settings.legacyName;
  }
  return "threadstep-ws-" + sha256Hex(result.url).slice(0, 16);
}

export function cloudConfigureOptions(databaseUrl) {
  // ThreadStep renders the native Dexie Cloud userInteraction prompts in its
  // own DOM. Without customLoginGui the addon uses its default GUI instead,
  // so our email/OTP form is never wired to that authentication dialog.
  return { databaseUrl, requireAuth: true, customLoginGui: true };
}

export function upgradeSchema() {
  return undefined;
}

export function dexieSchema() {
  return {
    name: DATABASE_NAME,
    version: SCHEMA_VERSION,
    stores: { ...SYNCHRONIZED_STORES },
    upgrade: upgradeSchema
  };
}

export function localDexieSchema() {
  return {
    name: LOCAL_DATABASE_NAME,
    version: SCHEMA_VERSION,
    stores: { ...SYNCHRONIZED_STORES },
    upgrade: upgradeSchema
  };
}

// Opens the autonomous local workspace with a plain Dexie constructor. It
// deliberately installs no Dexie Cloud addon and never touches db.cloud, so
// local records cannot become eligible for replication before TS-037 consent.
export function openLocalDatabase(DexieConstructor) {
  if (typeof DexieConstructor !== "function") {
    throw new TypeError("Dexie constructor is required for the local workspace");
  }
  const schema = localDexieSchema();
  const db = new DexieConstructor(schema.name);
  db.version(schema.version).stores(schema.stores).upgrade(schema.upgrade);
  return db;
}

export function validateSynchronizedStores(stores) {
  if (!stores || typeof stores !== "object" || Array.isArray(stores)) return false;
  const entries = Object.entries(stores);
  if (entries.length === 0) return false;
  return entries.every(([, definition]) => {
    if (typeof definition !== "string") return false;
    const keys = definition.split(",").map((part) => part.trim());
    return (keys.includes("@id") || keys.includes("id")) &&
      !keys.some((key) => key.startsWith("++id"));
  });
}

function resolveStorage(storage) {
  if (storage) return storage;
  return typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
}

export function readCloudConfig(storage) {
  const store = resolveStorage(storage);
  if (!store || typeof store.getItem !== "function") return null;
  try {
    const raw = store.getItem(CLOUD_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = validateCloudUrl(parsed && parsed.databaseUrl);
    return result.valid ? { databaseUrl: result.url } : null;
  } catch {
    return null;
  }
}

export function writeCloudConfig(storage, rawUrl) {
  const store = resolveStorage(storage);
  if (!store || typeof store.setItem !== "function") return false;
  const result = validateCloudUrl(rawUrl);
  if (!result.valid) return false;
  try {
    store.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ databaseUrl: result.url }));
    return true;
  } catch {
    return false;
  }
}

export function clearCloudConfig(storage) {
  const store = resolveStorage(storage);
  if (!store || typeof store.removeItem !== "function") return;
  try {
    store.removeItem(CLOUD_CONFIG_KEY);
  } catch {
    // Unavailable storage leaves nothing to clean.
  }
}
