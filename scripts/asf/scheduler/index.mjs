#!/usr/bin/env node
/**
 * Public surface of the pure scheduler core (ASF-V2-004).
 *
 * Re-exported so future adapters (dry-run CLI in ASF-V2-005, wave journal in
 * ASF-V2-006, GitHub delivery adapter in ASF-V2-007) depend on a single
 * import path: `scripts/asf/scheduler/index.mjs`.
 */
export {
  POLICY_VERSION,
  DECISION,
  DEFAULT_POLICY,
  validateBacklog,
  buildWaveCandidates,
  classifyEligibility,
  selectNextTask,
  explainWave
} from "./core.mjs";
