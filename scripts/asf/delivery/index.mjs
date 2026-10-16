#!/usr/bin/env node
/**
 * Public surface of the read-only delivery verification adapter (ASF-V2-007).
 *
 * The orchestrator imports `scripts/asf/delivery/index.mjs` to observe GitHub
 * delivery evidence and obtain a `verified | pending | unknown` verdict before
 * it ever authorizes a paid call or an archive.
 */
export {
  DELIVERY_STATUS,
  DELIVERY_REASON,
  RUN_CORRELATION,
  asfBranchPattern,
  openspecBranchPattern,
  createAsfDeliveryConfig,
  createOpenspecDeliveryConfig,
  verifyDelivery,
  toSchedulerEvidence
} from "./verify.mjs";

export { collectDeliveryObservation } from "./observe.mjs";
