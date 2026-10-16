#!/usr/bin/env node
/**
 * Public surface of the bounded read-only GitHub client (ASF-V2-007).
 *
 * `createGithubClient` is pure and transport-injected; the real `gh` CLI binding
 * is exported as a separate factory so tests never touch a process or network.
 */
export {
  GITHUB_CLIENT_DEFAULTS,
  GITHUB_ERROR,
  normalizeGithubError,
  createGithubClient
} from "./client.mjs";

export { GH_TRANSPORT_DEFAULTS, createGhTransport } from "./transport.mjs";
