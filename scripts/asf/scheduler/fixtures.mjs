#!/usr/bin/env node
/**
 * Deterministic, non-paying scenarios for the scheduler dry-run (ASF-V2-005).
 *
 * Each scenario is a plain object of injected inputs (`snapshot`, `evidence`,
 * optional `assumptions`, `journal`, `observedAt`). Nothing here reads GitHub,
 * a clock or the network: the values are simulated fixtures used to explain the
 * scheduler decision without any side effect. A scenario never proves a real
 * delivery; `assumptions` describe only a hypothetical future projection.
 */
import { createHash } from "node:crypto";

export const FIXTURE_NAMES = Object.freeze([
  "empty",
  "priority",
  "dependency-verified",
  "dependency-unknown",
  "dependency-pending",
  "delivered-not-archived"
]);

function sha(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function card(id, overrides = {}) {
  return {
    id,
    path: "backlog/tasks/" + id + ".md",
    type: "product",
    status: "ready",
    priority: "normal",
    automation: "allowed",
    risk: "low",
    depends_on: [],
    created_at: "2026-10-16",
    content_sha256: sha(id),
    ...overrides
  };
}

function snapshot(active = [], archive = []) {
  return { active, archive, legacy: [], diagnostics: [] };
}

function verified(proof = { pull_request: 7, merge_sha: "a".repeat(40) }) {
  return { status: "verified", proof };
}

/**
 * Built-in scenarios. Every factory returns a fresh, unfrozen copy so callers
 * may not accidentally share mutable state between dry-runs.
 */
export const FIXTURES = Object.freeze({
  /** Empty backlog: no candidate, no work, zero dispatch. */
  empty: () => ({
    snapshot: snapshot(),
    evidence: {},
    assumptions: [],
    observedAt: null
  }),

  /** Priority ordering: critical wins over high, normal and low. */
  priority: () => {
    const active = [
      card("TS-001", { priority: "low" }),
      card("TS-002", { priority: "normal" }),
      card("TS-003", { priority: "high" }),
      card("TS-004", { priority: "critical" })
    ];
    return { snapshot: snapshot(active), evidence: {}, assumptions: [], observedAt: null };
  },

  /** A verified dependency delivery unblocks the dependent. */
  "dependency-verified": () => {
    const dependency = card("TS-001");
    const dependent = card("TS-002", { priority: "critical", depends_on: ["TS-001"] });
    return {
      snapshot: snapshot([dependency, dependent]),
      evidence: { deliveries: { "TS-001": verified() } },
      assumptions: [],
      observedAt: null
    };
  },

  /**
   * GitHub delivery state is unavailable: the dependent must stay uncertain
   * instead of being presumed free.
   */
  "dependency-unknown": () => {
    const dependency = card("TS-001");
    const dependent = card("TS-002", { priority: "critical", depends_on: ["TS-001"] });
    return {
      snapshot: snapshot([dependency, dependent]),
      evidence: { deliveries: { "TS-001": { status: "unknown" } } },
      assumptions: [],
      observedAt: null
    };
  },

  /**
   * The dependency is outside the wave and not delivered: the wave waits, and
   * an explicit hypothetical assumption shows a projection — not a proof.
   */
  "dependency-pending": () => {
    const dependency = card("TS-001", { automation: "manual" });
    const dependent = card("TS-002", { priority: "critical", depends_on: ["TS-001"] });
    return {
      snapshot: snapshot([dependency, dependent]),
      evidence: {},
      assumptions: ["TS-001"],
      observedAt: null
    };
  },

  /** A delivery confirmed while the file is still under backlog/tasks/. */
  "delivered-not-archived": () => {
    const dependency = card("TS-005");
    const dependent = card("TS-010", { depends_on: ["TS-005"] });
    return {
      snapshot: snapshot([dependency, dependent]),
      evidence: { deliveries: { "TS-005": verified() } },
      assumptions: [],
      observedAt: null
    };
  }
});

/** Return a fresh scenario by name, or throw on an unknown fixture. */
export function loadFixture(name) {
  if (typeof name !== "string" || !Object.hasOwn(FIXTURES, name)) {
    throw new Error("Unknown fixture: " + String(name));
  }
  return FIXTURES[name]();
}
