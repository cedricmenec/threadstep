#!/usr/bin/env node
/**
 * Deterministic canonical serialization and content hashing (ASF-V2-006).
 *
 * A wave manifest and its durable journal must be compared byte-for-byte across
 * process restarts and interruptible writes. This module provides a stable
 * serialization (object keys sorted by code unit, arrays kept in order) and a
 * sha256 content hash so a compare-and-swap write can detect divergence without
 * ever reading a clock or the network.
 */
import { createHash } from "node:crypto";

function codeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Serialize a JSON-compatible value with sorted object keys. `undefined` keys
 * are dropped, matching `JSON.stringify` semantics, and unsupported values fail
 * closed instead of being silently coerced.
 */
export function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Cannot canonicalize a non-finite number");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort(codeUnit);
    return "{" + keys.map(key => JSON.stringify(key) + ":" + canonicalize(value[key])).join(",") + "}";
  }
  throw new TypeError("Cannot canonicalize value of type " + typeof value);
}

/** sha256 hex digest of the canonical serialization of `value`. */
export function contentSha256(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}
