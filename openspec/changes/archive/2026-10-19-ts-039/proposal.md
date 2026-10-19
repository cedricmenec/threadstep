# Proposal

## Why

ThreadStep now implements local-first persistence, opt-in Cloud activation,
plan-bound reconciliation, reimport idempotency and workspace isolation across
many pure modules, but the proof is scattered across unit tests, product
documents and unexecuted manual campaigns. TS-039 adds a reproducible
certification layer that states, for every required journey, whether the
evidence comes from the Node runner, from a real isolated Dexie Cloud instance,
from a documented simulation limit, or from an open incident. This prevents a
green CI run from being presented as proof of real multi-device synchronization.

## What Changes

- Add a deterministic, offline **acceptance matrix** that maps the required
  local-first and Cloud journeys to their normative OpenSpec capabilities and
  requirements. The matrix covers local-only use, activation, first sync,
  populated target, divergence, concurrent conflicts, JSON reimport,
  restoration, logout, URL/session change and network errors.
- Add a pure in-memory runner and report formatter that execute deterministic
  scenarios against the delivered pure modules without network, clock, random
  values, paid model calls or repository writes. The report exposes, per
  scenario, automated checks, manual evidence pending, documented limitations
  and open incidents.
- Separate evidence classes explicitly: `ci`, `real-dexie`, `limitation` and
  `incident`, with statuses such as `passed`, `pending`, `not-run` and `open`.
  A manual or real-instance check is never inferred from an automated one.
- Add a ThreadStep manual protocol for an isolated Dexie Cloud test instance:
  Chrome mobile, two independent browsers/profiles, real OTP email, offline and
  intermittent network, bidirectional propagation, populated and divergent
  targets, reimport/restore, logout with pending writes and URL/session changes,
  with a fallback export and test data only.
- Document how to recover the historical V1 source and how to report results
  without secrets, personal data or business content. The automated report and
  the manual record remain distinct artifacts.
- Extend repository checks so `npm run check` validates the matrix, report,
  required-domain coverage, redaction and canonical traceability in addition to
  the existing product tests.

## Capabilities

### New Capabilities

- `e2e-certification`: required journey coverage, deterministic pre-sync
  evidence, real-instance manual protocol, evidence classification and
  redaction guarantees for local-first and Dexie Cloud acceptance.

### Modified Capabilities

- `threadstep-integration-profile`: adds the ThreadStep-specific certification
  protocol (isolated test instance, Chrome mobile, two browsers, real OTP,
  offline/intermittent network, bidirectional propagation, test-data safety and
  non-execution reporting) on top of the generic certification contract.

## Impact

- `scripts/product/` (new pure matrix, scenario builders and report formatter):
  no DOM, IndexedDB, network or file access at runtime.
- `tests/` (new deterministic acceptance tests plus static repository tests).
- `docs/product/`: new certification protocol/report template and references
  from the developer and acceptance documentation.
- `package.json`: the check chain includes the new executable module; no
  runtime dependency, Dexie schema or product behavior changes.
- No application code, product behavior, workflow, secret, archive or canonical
  spec is rewritten by this change.

## Non-Goals

- Running a real Dexie Cloud instance, sending a real OTP or executing Chrome
  mobile acceptance from the GitHub Actions runner.
- Certifying an untested remote environment, guaranteeing Cloud availability or
  triggering any paid service.
- Replacing the existing unit, reconciliation, activation or workspace tests.
- Changing synchronization, authentication, persistence or migration behavior.
- Deleting or rewriting personal data, historical V1 storage or Cloud records.

## Uncertainties and decisions

- The repository currently has no browser automation dependency and the runner
  has no real IndexedDB, DOM, Cloud session or network. Real native Dexie Cloud
  semantics (OTP delivery, websocket propagation, server conflict resolution,
  logout cache clearing and two-browser convergence) therefore cannot be proven
  by this change's automated evidence. They remain explicit manual evidence
  requirements and are never reported as CI successes.
- The acceptance matrix will reuse the already delivered pure modules rather
  than duplicate their logic. If a required journey cannot be exercised through
  a pure module without inventing behavior, its automated entry must be marked
  as a documented limitation instead of a passing test.
- A review of the legacy capabilities referenced by TS-039 found no
  requirement-level statement that makes local business access depend on a
  Cloud URL or OTP; the historical `dexie-cloud-configuration` purpose wording
  concerns synchronized opening only. Archived changes and canonical history
  are left untouched. Any contradiction discovered during apply must be handled
  by an explicit normative delta, never by silently rewriting canonical text.
- The exact French wording and visual placement of the report are not product
  decisions; the protocol and evidence categories are.
