#!/usr/bin/env node
/**
 * Secret guard for the wave manifest and its durable journal (ASF-V2-006).
 *
 * The journal is persisted on an operational branch and reconstructed in
 * reports. It must never carry credentials, tokens or private keys. The guard
 * scans every string of an injected value and returns the JSON paths of any
 * suspicious field so callers can fail closed without echoing the secret.
 */

const SECRET_PATTERNS = Object.freeze([
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bghs_[A-Za-z0-9]{20,}\b/,
  /\bgho_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/
]);

function walk(value, path, found) {
  if (typeof value === "string") {
    if (SECRET_PATTERNS.some(pattern => pattern.test(value))) found.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, path + "[" + index + "]", found));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      walk(value[key], path ? path + "." + key : key, found);
    }
  }
}

/**
 * Return the sorted, deterministic list of field paths whose string values look
 * like a credential. An empty list means the value is clean. Secret values are
 * never included in the returned paths.
 */
export function findSecretPaths(value) {
  const found = [];
  walk(value, "", found);
  return [...new Set(found)].sort();
}

/** True when the value contains no secret-looking string. */
export function isSecretFree(value) {
  return findSecretPaths(value).length === 0;
}
