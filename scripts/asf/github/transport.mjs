#!/usr/bin/env node
/**
 * Real read-only GitHub transport for the delivery adapter (ASF-V2-007).
 *
 * This is the only file under `scripts/asf/github/` allowed to touch a process
 * or the network: it shells out to the authenticated `gh` CLI with read-only
 * scopes and a hard, bounded timeout. A synchronous `execFileSync` cannot be
 * interrupted by an outer `Promise.race`, so this transport enforces its own
 * `timeout` and `maxBuffer` limits. Every failure is thrown and normalized by
 * the client into a structured error.
 *
 * The orchestrator injects the workflow token; this module never reads, stores
 * or logs a credential and never passes arguments that could write.
 */
import { execFileSync } from "node:child_process";

export const GH_TRANSPORT_DEFAULTS = Object.freeze({
  ghPath: "gh",
  timeoutMs: 15000,
  maxBuffer: 8 * 1024 * 1024
});

/**
 * Build an async transport that reads one GitHub API path through `gh api`.
 * `timeoutMs` is provided per call by the client and always honoured.
 */
export function createGhTransport(options = {}) {
  const ghPath = typeof options.ghPath === "string" && options.ghPath
    ? options.ghPath : GH_TRANSPORT_DEFAULTS.ghPath;
  const maxBuffer = Number.isInteger(options.maxBuffer) && options.maxBuffer > 0
    ? options.maxBuffer : GH_TRANSPORT_DEFAULTS.maxBuffer;
  const defaultTimeout = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs : GH_TRANSPORT_DEFAULTS.timeoutMs;

  return async function transport(path, callOptions = {}) {
    const timeout = Number.isInteger(callOptions.timeoutMs) && callOptions.timeoutMs > 0
      ? callOptions.timeoutMs : defaultTimeout;
    const out = execFileSync(ghPath, ["api", path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
      maxBuffer
    });
    return JSON.parse(out);
  };
}
