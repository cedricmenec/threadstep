// Pure, DOM-free workspace identity core (TS-038).
//
// It owns the origin-local workspace registry, deterministic per-URL base
// names, startup/selection routing, account binding, pending-change planning
// and the redacted workspace diagnostic contribution. `site/app.js` injects
// storage, native adapters and confirmations; this module never touches
// IndexedDB, Dexie Cloud, the DOM or the network.
import {
  DATABASE_NAME,
  LOCAL_DATABASE_NAME,
  validateCloudUrl
} from "./dexie-foundation.js";
import { hashActivationUser } from "./cloud-activation.js";
import { sha256Hex } from "./fingerprint.js";

export const WORKSPACE_REGISTRY_KEY = "threadstep.workspaces.v1";
export const WORKSPACE_REGISTRY_VERSION = 1;
export const WORKSPACE_SELECTION_LOCAL = "local";
export const WORKSPACE_BASE_PREFIX = "threadstep-ws-";

export const WORKSPACE_TYPE = Object.freeze({
  LOCAL: "local",
  SYNCHRONIZED: "synchronized"
});

export const WORKSPACE_STATUS = Object.freeze({
  ACTIVATING: "activating",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled"
});

export const BINDING_STATE = Object.freeze({
  BOUND: "bound",
  UNBOUND: "unbound",
  UNVERIFIED: "unverified",
  MISMATCH: "mismatch",
  UNAUTHENTICATED: "unauthenticated",
  INDETERMINATE: "indeterminate"
});

export const PENDING_STATE = Object.freeze({
  NONE: "none",
  PENDING: "pending",
  UNKNOWN: "unknown"
});

const STATUS_VALUES = new Set(Object.values(WORKSPACE_STATUS));
const BINDING_VALUES = new Set(Object.values(BINDING_STATE));
const PENDING_VALUES = new Set(Object.values(PENDING_STATE));
const SELECTION_VALUES = new Set([WORKSPACE_SELECTION_LOCAL]);
const ENTRY_KEYS = new Set([
  "type",
  "url",
  "databaseName",
  "schemaVersion",
  "remoteDbId",
  "userDigest",
  "status"
]);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

export function normalizeWorkspaceUrl(raw) {
  const result = validateCloudUrl(raw);
  return result.valid ? result.url : null;
}

export function hashWorkspaceUser(userId) {
  return nonEmptyString(userId) ? sha256Hex(userId) : null;
}

export function workspaceUserDigestMatches(userDigest, userId) {
  if (!nonEmptyString(userDigest) || !nonEmptyString(userId)) return false;
  if (!DIGEST_PATTERN.test(userDigest)) return false;
  return userDigest === sha256Hex(userId) || userDigest === hashActivationUser(userId);
}

// Deterministic application-level discriminator added to the native Dexie
// Cloud nameSuffix. A legacy entry keeps its explicit original name.
export function workspaceDatabaseName(rawUrl, options = {}) {
  const url = normalizeWorkspaceUrl(rawUrl);
  if (!url) return null;
  const settings = isPlainObject(options) ? options : {};
  if (nonEmptyString(settings.legacyDatabaseName)) return settings.legacyDatabaseName;
  if (nonEmptyString(settings.legacyName)) return settings.legacyName;
  return WORKSPACE_BASE_PREFIX + sha256Hex(url).slice(0, 16);
}

export function emptyWorkspaceRegistry() {
  return {
    version: WORKSPACE_REGISTRY_VERSION,
    selected: WORKSPACE_SELECTION_LOCAL,
    workspaces: {}
  };
}

function parseWorkspaceEntry(key, value) {
  if (!isPlainObject(value)) return null;
  if (Object.keys(value).some((name) => !ENTRY_KEYS.has(name))) return null;
  if (value.type !== WORKSPACE_TYPE.SYNCHRONIZED) return null;
  const url = normalizeWorkspaceUrl(value.url);
  if (!url || url !== key) return null;
  if (!nonEmptyString(value.databaseName)) return null;
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) return null;
  if (!STATUS_VALUES.has(value.status)) return null;
  const entry = {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    url,
    databaseName: value.databaseName,
    schemaVersion: value.schemaVersion,
    status: value.status
  };
  if (nonEmptyString(value.remoteDbId)) entry.remoteDbId = value.remoteDbId;
  if (nonEmptyString(value.userDigest)) {
    if (!DIGEST_PATTERN.test(value.userDigest)) return null;
    entry.userDigest = value.userDigest;
  }
  return entry;
}

export function createWorkspaceEntry(input = {}) {
  if (!isPlainObject(input)) return null;
  const url = normalizeWorkspaceUrl(input.url);
  if (!url) return null;
  if (!nonEmptyString(input.databaseName)) return null;
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) return null;
  if (!STATUS_VALUES.has(input.status)) return null;
  const entry = {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    url,
    databaseName: input.databaseName,
    schemaVersion: input.schemaVersion,
    status: input.status
  };
  if (nonEmptyString(input.remoteDbId)) entry.remoteDbId = input.remoteDbId;
  if (nonEmptyString(input.userDigest)) {
    if (!DIGEST_PATTERN.test(input.userDigest)) return null;
    entry.userDigest = input.userDigest;
  }
  return entry;
}

// Unknown versions, malformed URLs, invalid statuses and any extra key
// (email, OTP, token, raw user id, business content) fail the whole registry
// closed: an unreadable registry never authorizes a purge or a transfer.
export function parseWorkspaceRegistry(value) {
  if (typeof value === "string") {
    if (!value.trim()) return null;
    try {
      return parseWorkspaceRegistry(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!isPlainObject(value)) return null;
  if (value.version !== WORKSPACE_REGISTRY_VERSION) return null;
  if (typeof value.selected !== "string") return null;
  if (value.selected !== WORKSPACE_SELECTION_LOCAL &&
      !normalizeWorkspaceUrl(value.selected)) return null;
  if (!isPlainObject(value.workspaces)) return null;
  const workspaces = {};
  for (const [key, entry] of Object.entries(value.workspaces)) {
    const parsed = parseWorkspaceEntry(key, entry);
    if (!parsed) return null;
    workspaces[key] = parsed;
  }
  if (value.selected !== WORKSPACE_SELECTION_LOCAL && !workspaces[value.selected]) {
    return null;
  }
  return {
    version: WORKSPACE_REGISTRY_VERSION,
    selected: value.selected,
    workspaces
  };
}

export function serializeWorkspaceRegistry(registry) {
  const parsed = parseWorkspaceRegistry(registry);
  return parsed ? JSON.stringify(parsed) : null;
}

export function readWorkspaceRegistryState(storage) {
  const store = storage || (typeof globalThis !== "undefined" ? globalThis.localStorage : undefined);
  if (!store || typeof store.getItem !== "function") {
    return { state: "unavailable", registry: null };
  }
  let raw;
  try {
    raw = store.getItem(WORKSPACE_REGISTRY_KEY);
  } catch {
    return { state: "unavailable", registry: null };
  }
  if (!raw) return { state: "absent", registry: null };
  const registry = parseWorkspaceRegistry(raw);
  return registry
    ? { state: "ok", registry }
    : { state: "invalid", registry: null };
}

export function readWorkspaceRegistry(storage) {
  return readWorkspaceRegistryState(storage).registry;
}

export function writeWorkspaceRegistry(storage, registry) {
  const store = storage || (typeof globalThis !== "undefined" ? globalThis.localStorage : undefined);
  if (!store || typeof store.setItem !== "function") return false;
  const serialized = serializeWorkspaceRegistry(registry);
  if (!serialized) return false;
  try {
    store.setItem(WORKSPACE_REGISTRY_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function registerWorkspace(registry, input = {}) {
  const current = parseWorkspaceRegistry(registry) || emptyWorkspaceRegistry();
  const entry = createWorkspaceEntry(input);
  if (!entry) return current;
  const existing = current.workspaces[entry.url];
  // An existing entry never re-derives its base name: a future hash-length
  // change must not silently move a workspace.
  const databaseName = existing ? existing.databaseName : entry.databaseName;
  const next = {
    ...entry,
    databaseName,
    schemaVersion: existing ? existing.schemaVersion : entry.schemaVersion
  };
  if (!entry.userDigest && existing && existing.userDigest) next.userDigest = existing.userDigest;
  return {
    version: WORKSPACE_REGISTRY_VERSION,
    selected: current.selected,
    workspaces: { ...current.workspaces, [entry.url]: next }
  };
}

export function updateWorkspaceStatus(registry, url, status) {
  const current = parseWorkspaceRegistry(registry);
  const normalized = normalizeWorkspaceUrl(url);
  if (!current || !normalized || !STATUS_VALUES.has(status)) return null;
  const entry = current.workspaces[normalized];
  if (!entry) return null;
  return {
    ...current,
    workspaces: {
      ...current.workspaces,
      [normalized]: { ...entry, status }
    }
  };
}

export function selectWorkspaceInRegistry(registry, target) {
  const current = parseWorkspaceRegistry(registry);
  if (!current) return null;
  if (target === WORKSPACE_SELECTION_LOCAL) {
    return { ...current, selected: WORKSPACE_SELECTION_LOCAL };
  }
  const url = normalizeWorkspaceUrl(target);
  if (!url || !current.workspaces[url]) return null;
  return { ...current, selected: url };
}

export function bindWorkspaceAccount(registry, url, userId) {
  const current = parseWorkspaceRegistry(registry);
  const normalized = normalizeWorkspaceUrl(url);
  const digest = hashWorkspaceUser(userId);
  if (!current || !normalized || !digest) return null;
  const entry = current.workspaces[normalized];
  if (!entry) return null;
  return {
    ...current,
    workspaces: {
      ...current.workspaces,
      [normalized]: { ...entry, userDigest: digest }
    }
  };
}

export function clearWorkspaceBinding(registry, url) {
  const current = parseWorkspaceRegistry(registry);
  const normalized = normalizeWorkspaceUrl(url);
  if (!current || !normalized) return null;
  const entry = current.workspaces[normalized];
  if (!entry) return null;
  const nextEntry = { ...entry };
  delete nextEntry.userDigest;
  return {
    ...current,
    workspaces: {
      ...current.workspaces,
      [normalized]: nextEntry
    }
  };
}

// Legacy migration: synthesize one entry without renaming, copying or
// deleting any existing IndexedDB base.
export function migrateLegacyWorkspace(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const config = isPlainObject(source.config) ? source.config : null;
  if (!config) return null;
  const url = normalizeWorkspaceUrl(config.databaseUrl);
  if (!url) return null;
  const record = isPlainObject(source.record) ? source.record : null;
  const status = record && STATUS_VALUES.has(record.status)
    ? record.status
    : WORKSPACE_STATUS.ACTIVE;
  const entry = createWorkspaceEntry({
    url,
    databaseName: DATABASE_NAME,
    schemaVersion: Number.isInteger(source.schemaVersion) ? source.schemaVersion : 1,
    status,
    remoteDbId: record ? record.remoteDbId : null,
    userDigest: record ? record.userDigest : null
  });
  if (!entry) return null;
  return {
    version: WORKSPACE_REGISTRY_VERSION,
    selected: url,
    workspaces: { [url]: entry }
  };
}

export function initializeWorkspaceRegistry(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const state = source.state && typeof source.state === "object"
    ? source.state
    : readWorkspaceRegistryState(source.storage);
  if (state.state === "invalid") {
    return { registry: null, invalid: true, migrated: false, state: "invalid" };
  }
  if (state.state === "ok") {
    return { registry: state.registry, invalid: false, migrated: false, state: "ok" };
  }
  const migrated = migrateLegacyWorkspace(source);
  if (migrated) {
    return { registry: migrated, invalid: false, migrated: true, state: "migrated" };
  }
  return {
    registry: emptyWorkspaceRegistry(),
    invalid: false,
    migrated: false,
    state: state.state === "unavailable" ? "unavailable" : "empty"
  };
}

export function resolveSelectedWorkspace(registry) {
  const current = parseWorkspaceRegistry(registry);
  if (!current) return null;
  if (current.selected === WORKSPACE_SELECTION_LOCAL) {
    return {
      type: WORKSPACE_TYPE.LOCAL,
      url: null,
      databaseName: LOCAL_DATABASE_NAME,
      status: null,
      entry: null
    };
  }
  const entry = current.workspaces[current.selected];
  if (!entry) return null;
  return {
    type: WORKSPACE_TYPE.SYNCHRONIZED,
    url: entry.url,
    databaseName: entry.databaseName,
    status: entry.status,
    entry
  };
}

// Startup composition. A malformed registry never falls back to a destructive
// path: it opens the autonomous workspace and keeps every base untouched.
export function resolveWorkspaceStartup(input = {}) {
  const source = isPlainObject(input) ? input : {};
  if (source.registryInvalid === true) {
    return {
      workspace: "local",
      reason: "registry-invalid",
      url: null,
      databaseName: LOCAL_DATABASE_NAME,
      entry: null,
      registry: null,
      legacy: false,
      purgeAllowed: false,
      operations: [],
      deletedBases: []
    };
  }
  const initialized = source.registry
    ? { registry: parseWorkspaceRegistry(source.registry), invalid: false }
    : initializeWorkspaceRegistry(source);
  const registry = initialized.registry;
  if (!registry) {
    return {
      workspace: "local",
      reason: "registry-unavailable",
      url: null,
      databaseName: LOCAL_DATABASE_NAME,
      entry: null,
      registry: null,
      legacy: false,
      purgeAllowed: false,
      operations: [],
      deletedBases: []
    };
  }
  const selected = resolveSelectedWorkspace(registry);
  if (!selected) {
    return {
      workspace: "local",
      reason: "registry-invalid",
      url: null,
      databaseName: LOCAL_DATABASE_NAME,
      entry: null,
      registry,
      legacy: false,
      purgeAllowed: false,
      operations: [],
      deletedBases: []
    };
  }
  if (selected.type === WORKSPACE_TYPE.LOCAL) {
    return {
      workspace: "local",
      reason: source.state && source.state.state === "migrated"
        ? "migrated-local"
        : "selected-local",
      url: null,
      databaseName: LOCAL_DATABASE_NAME,
      entry: null,
      registry,
      legacy: false,
      purgeAllowed: true,
      operations: [],
      deletedBases: []
    };
  }
  const entry = selected.entry;
  const base = {
    url: entry.url,
    databaseName: entry.databaseName,
    entry,
    registry,
    legacy: entry.databaseName === DATABASE_NAME,
    purgeAllowed: true,
    operations: [],
    deletedBases: []
  };
  if (entry.status === WORKSPACE_STATUS.ACTIVE ||
      entry.status === WORKSPACE_STATUS.ACTIVATING) {
    return { ...base, workspace: "synced", reason: entry.status };
  }
  if (entry.status === WORKSPACE_STATUS.SUSPENDED) {
    return {
      ...base,
      workspace: "local",
      reason: WORKSPACE_STATUS.SUSPENDED,
      databaseName: LOCAL_DATABASE_NAME
    };
  }
  return {
    ...base,
    workspace: "local",
    reason: WORKSPACE_STATUS.CANCELLED,
    databaseName: LOCAL_DATABASE_NAME
  };
}

function planBase() {
  return {
    allowed: false,
    closeCurrent: false,
    reload: false,
    nativeLogout: null,
    deletions: [],
    businessDeletes: [],
    remoteDeletes: [],
    backupSuggested: false,
    warning: null,
    notice: null,
    copy: false,
    merge: false,
    registry: null
  };
}

export function normalizePendingState(pending) {
  if (isPlainObject(pending) && PENDING_VALUES.has(pending.status)) {
    return pending;
  }
  return { status: PENDING_STATE.UNKNOWN, count: null };
}

export function pendingChangeWarning(pending) {
  const state = normalizePendingState(pending);
  if (state.status === PENDING_STATE.PENDING) {
    const count = Number.isInteger(state.count) && state.count > 0 ? state.count : null;
    return "Des changements synchronisés ne sont pas attestés comme transmis" +
      (count ? " (" + count + " en attente)" : "") +
      ". Leur perte est possible : téléchargez une sauvegarde JSON ou annulez.";
  }
  if (state.status === PENDING_STATE.NONE) {
    return "Aucun changement synchronisé en attente n'a été observé. La suppression locale reste limitée à cette copie.";
  }
  return "L'état des changements synchronisés est indéterminé : une perte est possible. " +
    "Aucun changement en attente n'est affirmé absent ; téléchargez une sauvegarde JSON ou annulez.";
}

// Browser adapter result normalization: no mutation store, unreadable count or
// contradictory evidence is `unknown`, never `none`.
export function pendingStatusFromMutationTables(input = {}) {
  const source = isPlainObject(input) ? input : {};
  if (source.error) return { status: PENDING_STATE.UNKNOWN, count: null };
  const tables = Array.isArray(source.mutationTables) ? source.mutationTables : [];
  if (tables.length === 0) return { status: PENDING_STATE.UNKNOWN, count: null };
  const counts = isPlainObject(source.counts) ? source.counts : {};
  let total = 0;
  for (const table of tables) {
    const count = counts[table];
    if (!Number.isInteger(count) || count < 0) {
      return { status: PENDING_STATE.UNKNOWN, count: null };
    }
    total += count;
  }
  return {
    status: total > 0 ? PENDING_STATE.PENDING : PENDING_STATE.NONE,
    count: total
  };
}

export function evaluateAccountBinding(input = {}) {
  const source = isPlainObject(input) ? input : {};
  if (source.authenticated !== true || !nonEmptyString(source.userId)) {
    return { state: BINDING_STATE.UNAUTHENTICATED, businessAllowed: false, bind: false, digest: null };
  }
  const entry = isPlainObject(source.entry) ? source.entry : null;
  if (!entry || entry.type !== WORKSPACE_TYPE.SYNCHRONIZED) {
    return { state: BINDING_STATE.INDETERMINATE, businessAllowed: false, bind: false, digest: null };
  }
  if (nonEmptyString(entry.userDigest)) {
    return workspaceUserDigestMatches(entry.userDigest, source.userId)
      ? { state: BINDING_STATE.BOUND, businessAllowed: true, bind: false, digest: null }
      : { state: BINDING_STATE.MISMATCH, businessAllowed: false, bind: false, digest: null };
  }
  const digest = hashWorkspaceUser(source.userId);
  if (source.cacheHasRecords === true) {
    return { state: BINDING_STATE.UNVERIFIED, businessAllowed: false, bind: false, digest };
  }
  if (source.cacheHasRecords === false) {
    return { state: BINDING_STATE.UNBOUND, businessAllowed: true, bind: true, digest };
  }
  return { state: BINDING_STATE.INDETERMINATE, businessAllowed: false, bind: false, digest: null };
}

// A legacy synchronized cache with no account binding cannot be adopted by
// merely logging in: it may contain another account's cached records. Recover
// remote-visible data in a NEW isolated cache; leave the old IndexedDB intact.
export function planUnverifiedCloudRecovery(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const deny = (reason) => ({
    allowed: false, reason, registry: null, operations: [],
    deletedBases: [], remoteDeletes: [], copy: false, merge: false
  });
  const registry = parseWorkspaceRegistry(source.registry);
  if (!registry || registry.selected === WORKSPACE_SELECTION_LOCAL) return deny("workspace-invalid");
  const entry = registry.workspaces[registry.selected];
  if (!entry || entry.type !== WORKSPACE_TYPE.SYNCHRONIZED ||
      entry.status !== WORKSPACE_STATUS.ACTIVE) return deny("workspace-not-active");
  if (source.binding !== BINDING_STATE.UNVERIFIED || nonEmptyString(entry.userDigest)) {
    return deny("not-unverified");
  }
  // Only a real old-style base can be recovered this way. New cache bases
  // already have account binding established BEFORE any business reads.
  if (entry.databaseName !== DATABASE_NAME) return deny("not-legacy-cache");
  const attestation = isPlainObject(source.attestation) ? source.attestation : null;
  const identity = attestation && isPlainObject(attestation.identity) ? attestation.identity : null;
  if (!attestation || attestation.attested !== true || !identity ||
      !nonEmptyString(identity.userId) || !nonEmptyString(identity.remoteDbId) ||
      normalizeWorkspaceUrl(identity.databaseUrl) !== entry.url) {
    return deny("remote-not-attested");
  }
  if (nonEmptyString(entry.remoteDbId) && entry.remoteDbId !== identity.remoteDbId) {
    return deny("remote-mismatch");
  }
  if (normalizePendingState(source.pending).status !== PENDING_STATE.NONE) {
    return deny("pending-or-unknown");
  }
  const nextBase = source.newDatabaseName;
  // An application-generated cryptographic random suffix, never derived
  // from a raw email or user identifier. The browser also checks existence.
  if (typeof nextBase !== "string" ||
      !/^threadstep-recovery-[a-f0-9]{32}$/.test(nextBase) ||
      Object.values(registry.workspaces).some((value) => value.databaseName === nextBase)) {
    return deny("invalid-new-base");
  }
  const nextEntry = {
    ...entry,
    databaseName: nextBase,
    remoteDbId: identity.remoteDbId,
    userDigest: hashWorkspaceUser(identity.userId)
  };
  return {
    allowed: true, reason: null,
    registry: {
      ...registry,
      workspaces: { ...registry.workspaces, [entry.url]: nextEntry }
    },
    url: entry.url,
    userDigest: nextEntry.userDigest,
    remoteDbId: nextEntry.remoteDbId,
    oldDatabaseName: entry.databaseName,
    newDatabaseName: nextBase,
    operations: [], deletedBases: [], remoteDeletes: [],
    copy: false, merge: false
  };
}

export function planWorkspaceSelection(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const plan = { ...planBase(), action: "select" };
  const registry = parseWorkspaceRegistry(source.registry);
  if (!registry) return { ...plan, reason: "registry-unreadable" };
  const target = source.target;
  const next = selectWorkspaceInRegistry(registry, target);
  if (!next) return { ...plan, reason: "unknown-workspace" };
  const selected = resolveSelectedWorkspace(next);
  const pending = normalizePendingState(source.pending);
  plan.allowed = true;
  plan.registry = next;
  plan.selected = next.selected;
  plan.workspace = selected.type;
  plan.url = selected.url;
  plan.databaseName = selected.databaseName;
  plan.closeCurrent = true;
  plan.reload = true;
  plan.notice = pending.status !== PENDING_STATE.NONE
    ? "La synchronisation de l'espace quitté est interrompue ; ses changements restent conservés dans son cache local."
    : null;
  return plan;
}

export function planWorkspaceResume(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const plan = { ...planBase(), action: "resume" };
  const registry = parseWorkspaceRegistry(source.registry);
  const url = normalizeWorkspaceUrl(source.url);
  if (!registry || !url) return { ...plan, reason: "invalid-workspace" };
  const entry = registry.workspaces[url];
  if (!entry) return { ...plan, reason: "unknown-workspace" };
  const next = updateWorkspaceStatus(registry, url, WORKSPACE_STATUS.ACTIVE);
  const selected = selectWorkspaceInRegistry(next, url);
  if (!selected) return { ...plan, reason: "invalid-workspace" };
  plan.allowed = true;
  plan.registry = selected;
  plan.selected = url;
  plan.workspace = WORKSPACE_TYPE.SYNCHRONIZED;
  plan.url = url;
  plan.databaseName = entry.databaseName;
  plan.closeCurrent = true;
  plan.reload = true;
  plan.consentRequired = false;
  return plan;
}

export function planWorkspaceSuspension(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const plan = { ...planBase(), action: "suspend" };
  const registry = parseWorkspaceRegistry(source.registry);
  const url = normalizeWorkspaceUrl(source.url);
  if (!registry || !url) return { ...plan, reason: "invalid-workspace" };
  const entry = registry.workspaces[url];
  if (!entry) return { ...plan, reason: "unknown-workspace" };
  const suspended = updateWorkspaceStatus(registry, url, WORKSPACE_STATUS.SUSPENDED);
  const selected = selectWorkspaceInRegistry(suspended, WORKSPACE_SELECTION_LOCAL);
  if (!selected) return { ...plan, reason: "invalid-workspace" };
  const pending = normalizePendingState(source.pending);
  plan.allowed = true;
  plan.registry = selected;
  plan.selected = WORKSPACE_SELECTION_LOCAL;
  plan.workspace = WORKSPACE_TYPE.LOCAL;
  plan.url = null;
  plan.databaseName = LOCAL_DATABASE_NAME;
  plan.closeCurrent = true;
  plan.reload = true;
  plan.notice = pending.status !== PENDING_STATE.NONE
    ? "Suspension : la synchronisation est interrompue et les changements restent dans le cache de l'espace suspendu."
    : null;
  return plan;
}

export function planWorkspaceLogout(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const plan = { ...planBase(), action: "logout" };
  const registry = parseWorkspaceRegistry(source.registry);
  const url = normalizeWorkspaceUrl(source.url);
  if (!registry || !url || !registry.workspaces[url]) {
    return { ...plan, reason: "invalid-workspace" };
  }
  if (source.cancelled === true) {
    return { ...plan, action: "cancel", reason: "cancelled" };
  }
  const pending = normalizePendingState(source.pending);
  plan.registry = registry;
  plan.url = url;
  plan.databaseName = registry.workspaces[url].databaseName;
  if (pending.status !== PENDING_STATE.NONE && source.confirmed !== true) {
    return {
      ...plan,
      action: "confirm",
      reason: "confirmation-required",
      backupSuggested: true,
      warning: pendingChangeWarning(pending)
    };
  }
  plan.allowed = true;
  plan.registry = clearWorkspaceBinding(registry, url);
  plan.nativeLogout = { force: true };
  plan.closeCurrent = true;
  plan.reload = true;
  plan.backupSuggested = pending.status !== PENDING_STATE.NONE;
  return plan;
}

export function planWorkspacePurge(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const plan = { ...planBase(), action: "purge" };
  const registry = parseWorkspaceRegistry(source.registry);
  if (!registry) return { ...plan, reason: "registry-unreadable" };
  if (source.cancelled === true) {
    return { ...plan, action: "cancel", reason: "cancelled" };
  }
  const target = source.target;
  let expectedBase;
  let url = null;
  if (target === WORKSPACE_SELECTION_LOCAL) {
    expectedBase = LOCAL_DATABASE_NAME;
  } else {
    url = normalizeWorkspaceUrl(target);
    if (!url || !registry.workspaces[url]) {
      return { ...plan, reason: "unknown-workspace" };
    }
    expectedBase = registry.workspaces[url].databaseName;
  }
  if (source.effectiveDatabaseName !== expectedBase) {
    return { ...plan, reason: "base-mismatch" };
  }
  const pending = normalizePendingState(source.pending);
  plan.registry = registry;
  plan.target = target;
  plan.url = url;
  plan.databaseName = expectedBase;
  if (source.confirmed !== true) {
    return {
      ...plan,
      action: "confirm",
      reason: "confirmation-required",
      backupSuggested: true,
      warning: pendingChangeWarning(pending)
    };
  }
  let nextRegistry = registry;
  if (url) {
    nextRegistry = clearWorkspaceBinding(registry, url);
    const selected = selectWorkspaceInRegistry(nextRegistry, WORKSPACE_SELECTION_LOCAL);
    if (!selected) return { ...plan, reason: "invalid-workspace" };
    nextRegistry = selected;
  }
  plan.allowed = true;
  plan.registry = nextRegistry;
  plan.selected = WORKSPACE_SELECTION_LOCAL;
  plan.closeCurrent = true;
  plan.reload = true;
  plan.backupSuggested = pending.status !== PENDING_STATE.NONE;
  plan.deletions = [expectedBase];
  plan.operations = [{ type: "delete-database", databaseName: expectedBase }];
  return plan;
}

export function activationRecordForWorkspace(entry, record = null) {
  if (!isPlainObject(entry) || entry.type !== WORKSPACE_TYPE.SYNCHRONIZED) return null;
  const previous = isPlainObject(record) ? record : null;
  const result = {
    version: 1,
    status: entry.status,
    url: entry.url
  };
  if (nonEmptyString(entry.remoteDbId)) result.remoteDbId = entry.remoteDbId;
  else if (previous && nonEmptyString(previous.remoteDbId)) result.remoteDbId = previous.remoteDbId;
  if (previous && nonEmptyString(previous.sourceFingerprint)) {
    result.sourceFingerprint = previous.sourceFingerprint;
  }
  if (nonEmptyString(entry.userDigest)) result.userDigest = entry.userDigest;
  else if (previous && nonEmptyString(previous.userDigest)) result.userDigest = previous.userDigest;
  return result;
}

// Updates the registry and the legacy activation marker together while
// preserving destination, remote id, source fingerprint and account digest.
export function syncWorkspaceStatus(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const registry = parseWorkspaceRegistry(source.registry);
  const url = normalizeWorkspaceUrl(source.url);
  if (!registry || !url || !STATUS_VALUES.has(source.status)) return null;
  const updated = updateWorkspaceStatus(registry, url, source.status);
  if (!updated) return null;
  return {
    registry: updated,
    activationRecord: activationRecordForWorkspace(updated.workspaces[url], source.record)
  };
}

const BINDING_LABELS = Object.freeze({
  [BINDING_STATE.BOUND]: "Compte lié à cet espace",
  [BINDING_STATE.UNBOUND]: "Espace lié au compte courant (cache vide)",
  [BINDING_STATE.UNVERIFIED]: "Cache local non vérifié : déconnexion ou purge explicite requise",
  [BINDING_STATE.MISMATCH]: "Compte différent de la liaison : données métier masquées",
  [BINDING_STATE.UNAUTHENTICATED]: "Aucune session authentifiée",
  [BINDING_STATE.INDETERMINATE]: "Liaison de compte indéterminée"
});

export function describeBindingState(value) {
  return BINDING_LABELS[value] || BINDING_LABELS[BINDING_STATE.INDETERMINATE];
}

const SESSION_CATEGORIES = new Set([
  "authenticated",
  "loading",
  "signed-out",
  "expired",
  "refused",
  "indeterminate"
]);

// Allowlisted contribution only: never an email, OTP, token, raw user id,
// business content or raw error string.
export function buildWorkspaceDiagnostic(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const entry = isPlainObject(source.entry) ? source.entry : null;
  const type = source.type === WORKSPACE_TYPE.SYNCHRONIZED ||
    (entry && entry.type === WORKSPACE_TYPE.SYNCHRONIZED)
    ? WORKSPACE_TYPE.SYNCHRONIZED
    : WORKSPACE_TYPE.LOCAL;
  const base = nonEmptyString(source.effectiveBase)
    ? source.effectiveBase
    : type === WORKSPACE_TYPE.SYNCHRONIZED && entry
      ? entry.databaseName
      : LOCAL_DATABASE_NAME;
  const url = type === WORKSPACE_TYPE.SYNCHRONIZED
    ? normalizeWorkspaceUrl(source.url || (entry && entry.url))
    : null;
  const remoteDbId = type === WORKSPACE_TYPE.SYNCHRONIZED &&
    nonEmptyString(source.remoteDbId)
    ? source.remoteDbId
    : type === WORKSPACE_TYPE.SYNCHRONIZED && entry && nonEmptyString(entry.remoteDbId)
      ? entry.remoteDbId
      : null;
  const session = SESSION_CATEGORIES.has(source.session)
    ? source.session
    : "indeterminate";
  const binding = BINDING_VALUES.has(source.binding)
    ? source.binding
    : BINDING_STATE.INDETERMINATE;
  return {
    type,
    effectiveBase: base,
    url,
    remoteDbId,
    session,
    binding,
    bindingLabel: describeBindingState(binding)
  };
}

export function workspaceDiagnosticRows(contribution) {
  const value = buildWorkspaceDiagnostic(contribution);
  const rows = [
    {
      key: "workspace-type",
      label: "Espace de travail",
      value: value.type === WORKSPACE_TYPE.SYNCHRONIZED ? "Synchronisé" : "Local autonome"
    },
    { key: "workspace-base", label: "Base locale effective", value: value.effectiveBase }
  ];
  if (value.type === WORKSPACE_TYPE.SYNCHRONIZED) {
    rows.push({ key: "workspace-url", label: "URL normalisée", value: value.url });
    if (value.remoteDbId) {
      rows.push({ key: "workspace-remote-db", label: "Identifiant distant", value: value.remoteDbId });
    }
  }
  rows.push({ key: "workspace-binding", label: "Liaison de compte", value: value.bindingLabel });
  return rows;
}
