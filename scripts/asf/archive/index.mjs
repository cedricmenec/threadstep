#!/usr/bin/env node
/**
 * Public surface of the deterministic archiver (ASF-V2-010).
 *
 * A future end-of-wave adapter (GitHub App + documentary PR) imports this single
 * path: `scripts/asf/archive/index.mjs`. The core is pure: it never opens a
 * pull request, performs no network or filesystem I/O and reads no clock.
 */
export {
  ARCHIVE_SCHEMA_VERSION,
  ARCHIVE_RESULT,
  ARCHIVE_BLOCK_REASON,
  ARCHIVE_OUTCOME_REASON,
  ARCHIVE_BRANCH_PATTERN,
  ARCHIVE_BRANCH_PREFIX,
  DELIVERY_FIELD_ORDER,
  slugifyScope,
  archiveBranchFor,
  validateDeliveryProof,
  selectArchivable,
  toExecutionEvidence,
  rewriteBacklogLinks,
  renderArchivedTask,
  buildArchivePlan,
  evaluateArchiveOutcome,
  summarizeArchivePlan
} from "./core.mjs";

export { applyArchivePlan } from "./apply.mjs";
