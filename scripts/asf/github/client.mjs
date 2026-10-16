#!/usr/bin/env node
/**
 * Bounded, read-only GitHub client (ASF-V2-007).
 *
 * The delivery adapter observes GitHub — PRs, runs, checks, merges, Pages — but
 * never changes it. This client owns the two failure modes that must never be
 * mistaken for a clean observation:
 *
 *   - pagination is always bounded; reaching the page ceiling is reported as
 *     `truncated` so a missing record is never interpreted as "no conflict";
 *   - every transport error, including a bounded timeout, is converted into a
 *     structured error value, never into data.
 *
 * The transport is injected so the client is testable without network access.
 * The real `gh` CLI binding lives in ./transport.mjs and is the only file in
 * this directory that touches a process or the network. Normalized errors carry
 * a stable code and an optional HTTP status but deliberately drop the raw
 * transport message so a credential can never be echoed by accident.
 *
 * The module performs no I/O, reads no clock and mutates no input.
 *
 * Normative reference:
 *   - docs/factory/specs/orchestrator-v1.md §5, §7, §8
 */

export const GITHUB_CLIENT_DEFAULTS = Object.freeze({
  maxPages: 10,
  perPage: 100,
  timeoutMs: 15000
});

export const GITHUB_ERROR = Object.freeze({
  TRANSPORT: "transport_error",
  TIMEOUT: "timeout",
  PAGINATION_LIMIT: "pagination_limit",
  INVALID_RESPONSE: "invalid_response",
  INVALID_PATH: "invalid_path"
});

function error(code, status = null) {
  return Object.freeze({ code, status });
}

/**
 * Convert any thrown transport failure into a secret-free error value. A timeout
 * or abort is reported as `timeout`; anything else keeps a stable string code
 * when one is provided, otherwise `transport_error`.
 */
export function normalizeGithubError(cause) {
  if (cause && typeof cause === "object") {
    if (cause.code === GITHUB_ERROR.TIMEOUT || cause.name === "AbortError") {
      return error(GITHUB_ERROR.TIMEOUT);
    }
    const status = Number.isInteger(cause.status)
      ? cause.status
      : Number.isInteger(cause.response?.status) ? cause.response.status : null;
    if (typeof cause.code === "string" && cause.code) return error(cause.code, status);
    return error(GITHUB_ERROR.TRANSPORT, status);
  }
  return error(GITHUB_ERROR.TRANSPORT);
}

function isValidPath(path) {
  return typeof path === "string" && path.length > 0 &&
    !path.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith("//");
}

function withQuery(path, params) {
  const query = Object.entries(params)
    .map(([key, value]) => key + "=" + encodeURIComponent(value))
    .join("&");
  return path + (path.includes("?") ? "&" : "?") + query;
}

/**
 * Create a read-only client bound to an injected async transport
 * `(path, { timeoutMs }) => json`. The transport must never mutate anything.
 */
export function createGithubClient(options = {}) {
  const transport = options.transport;
  if (typeof transport !== "function") {
    throw new TypeError("createGithubClient requires an injected transport function");
  }
  const maxPages = Number.isInteger(options.maxPages) && options.maxPages > 0
    ? options.maxPages : GITHUB_CLIENT_DEFAULTS.maxPages;
  const perPage = Number.isInteger(options.perPage) && options.perPage > 0
    ? options.perPage : GITHUB_CLIENT_DEFAULTS.perPage;
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs : GITHUB_CLIENT_DEFAULTS.timeoutMs;

  async function call(path, callOptions = {}) {
    if (!isValidPath(path)) return { ok: false, data: null, error: error(GITHUB_ERROR.INVALID_PATH) };
    const ms = Number.isInteger(callOptions.timeoutMs) && callOptions.timeoutMs > 0
      ? callOptions.timeoutMs : timeoutMs;
    let timer = null;
    try {
      const data = await Promise.race([
        Promise.resolve(transport(path, { timeoutMs: ms })),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const timeout = new Error("github transport timeout");
            timeout.code = GITHUB_ERROR.TIMEOUT;
            reject(timeout);
          }, ms);
        })
      ]);
      return { ok: true, data, error: null };
    } catch (cause) {
      return { ok: false, data: null, error: normalizeGithubError(cause) };
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  /** Fetch one resource. Errors are returned, never thrown. */
  function get(path, callOptions = {}) {
    return call(path, callOptions);
  }

  /**
   * Collect a paginated JSON array with a hard page ceiling. A page that is
   * returned in full at the ceiling means more data may exist: the result is
   * flagged `truncated` and must be treated as incomplete evidence.
   */
  async function paginate(path, callOptions = {}) {
    const limit = Number.isInteger(callOptions.maxPages) && callOptions.maxPages > 0
      ? callOptions.maxPages : maxPages;
    const size = Number.isInteger(callOptions.perPage) && callOptions.perPage > 0
      ? callOptions.perPage : perPage;
    const items = [];
    for (let page = 1; page <= limit; page++) {
      const response = await call(withQuery(path, { per_page: size, page }), callOptions);
      if (!response.ok) {
        return { ok: false, items: [], pages: page - 1, truncated: false, error: response.error };
      }
      if (!Array.isArray(response.data)) {
        return {
          ok: false, items: [], pages: page - 1, truncated: false,
          error: error(GITHUB_ERROR.INVALID_RESPONSE)
        };
      }
      items.push(...response.data);
      if (response.data.length < size) {
        return { ok: true, items, pages: page, truncated: false, error: null };
      }
    }
    return { ok: true, items, pages: limit, truncated: true, error: null };
  }

  return Object.freeze({
    get,
    paginate,
    defaults: Object.freeze({ maxPages, perPage, timeoutMs })
  });
}
