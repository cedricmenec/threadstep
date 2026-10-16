#!/usr/bin/env node
/**
 * Public surface of the wave manifest, durable journal and quota engine
 * (ASF-V2-006).
 *
 * Future adapters (GitHub delivery verification in ASF-V2-007, the orchestrator
 * workflow in ASF-V2-008/009) depend on this single import path:
 * `scripts/asf/waves/index.mjs`.
 */
export {
  MANIFEST_SCHEMA_VERSION,
  ORCHESTRATOR_POLICY_VERSION,
  MODEL_ALLOWLIST,
  WAVE_MODES,
  EXECUTORS,
  PHASES,
  MAX_TASK_STARTS,
  validateWaveManifest,
  createWaveManifest,
  hashWaveManifest
} from "./manifest.mjs";

export {
  JOURNAL_SCHEMA_VERSION,
  WAVE_STATE,
  WAVE_EVENT,
  STOP_CODE,
  DISPATCH_DECISION,
  RESUME_OUTCOME,
  createJournal,
  currentState,
  applyEvent,
  selectTask,
  reserveDispatch,
  beginDispatch,
  decideResume,
  planDispatch,
  canDispatch,
  validateJournal,
  serializeJournal,
  reconstructJournal,
  summarizeJournal,
  toSchedulerExecutionState
} from "./journal.mjs";

export {
  createMemoryWaveStore,
  loadJournal,
  commitEvent,
  contentSha256
} from "./store.mjs";

export { canonicalize } from "./hash.mjs";
export { findSecretPaths, isSecretFree } from "./secrets.mjs";
