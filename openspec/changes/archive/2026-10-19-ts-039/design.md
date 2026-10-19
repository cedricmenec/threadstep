# Design

## Context

See `proposal.md` — Why. The delivered runtime is a static browser application
(`site/`), while the GitHub Actions runner has no DOM, real IndexedDB, Dexie
Cloud session or network. Existing deterministic tests already exercise the pure
modules for persistence, migration, reconciliation, activation, diagnostics,
workspace identity and recovery, but they are not organized as a certification
matrix and do not state which properties remain unproven.

The normative references to cover are:
`local-indexeddb-persistence`, `cloud-sync-lifecycle`,
`cloud-opt-in-activation`, `data-backup-import-restore`,
`data-reconciliation`, `workspace-identity-isolation` and
`threadstep-integration-profile`. TS-035 to TS-038 have already delivered the
corresponding behaviors and their own unit/static tests. TS-039 adds the
certification layer on top of them.

## Goals / Non-Goals

**Goals:**

- Turn the required journeys into a machine-readable matrix with explicit
  canonical traceability.
- Produce a deterministic report that separates CI evidence, real-instance
  evidence still pending, documented simulation limits and open incidents.
- Make manual acceptance falsifiable: every real-instance check has a scenario,
  an expected observation and a place to record measured evidence.
- Keep the automated runner pure, dependency-free and safe for the default CI.
- Prevent accidental acceptance of unexecuted or simulated checks.

**Non-Goals:**

- Browser automation, fake IndexedDB or a new production dependency.
- Reimplementing product logic in test fixtures; scenarios call the delivered
  pure functions and planners.
- Recording manual outcomes inside the code repository as if CI had produced
  them.
- Modifying application code, Cloud behavior, schemas or workflows.

## Decisions

### 1. A declarative matrix plus pure scenario builders

Add `scripts/product/e2e-matrix.mjs` exporting:

- `EVIDENCE = { CI: "ci", REAL_DEXIE: "real-dexie", LIMITATION: "limitation", INCIDENT: "incident" }`
- `STATUS = { PASSED: "passed", PENDING: "pending", NOT_RUN: "not-run", OPEN: "open" }`
- `REQUIRED_DOMAINS` (the journeys named by TS-039)
- `MATRIX` entries shaped as
  `{ id, domain, capability, requirement, automated, manual, limitations, incidents }`
- `runAcceptanceMatrix()` returning a frozen report
  `{ mode, ok, counts, scenarios, limitations, incidents }`
- `formatAcceptanceReport(report)` for a human-readable French summary.

Each automated entry is a scenario builder that calls the delivered pure
modules. The matrix is data; adding a journey requires adding its mapping and
checks rather than editing prose.

Alternative rejected: one monolithic test file. It would hide the coverage
mapping and make it impossible to prove that every required domain is present.

### 2. Evidence classes are first-class and cannot be promoted implicitly

The report has four separate evidence classes:

- `ci`: deterministic checks executed by the runner in this change. `passed`
  only when every check passed.
- `real-dexie`: observations that require an isolated Dexie Cloud instance.
  Always `pending` or `not-run` in the automated report; it can only be marked
  passed by a human record that explicitly cites the measurement.
- `limitation`: properties that the pure runner cannot prove, for example
  native websocket propagation, server-side conflict resolution, real OTP
  delivery, native logout cache clearing or mobile accessibility.
- `incident`: a known failure, with severity and status. An open incident makes
  the overall certification non-`ok` even if all CI checks pass.

`runAcceptanceMatrix()` derives `ok` from CI checks plus the absence of open
incidents. It never derives a real-instance success from a CI check.

Alternative rejected: a single boolean `passed` field. It cannot represent the
backlog requirement to distinguish CI, real Dexie, limits and incidents.

### 3. Canonical traceability is verified structurally

Every matrix entry names an existing capability path under `openspec/specs/` and
an exact `### Requirement:` header. A deterministic test parses the canonical
spec files and fails when a reference is missing. This keeps the matrix attached
to the normative contract without invoking the OpenSpec CLI from the test.

Alternative rejected: free-text references. They drift silently and give a false
impression of coverage.

### 4. Required-domain coverage is exhaustive by construction

`REQUIRED_DOMAINS` lists at least: local-only, activation, first sync, populated
target, divergence, concurrent conflicts, JSON reimport, restore, logout,
URL change, session change, network errors, plus the cross-cutting guarantees
(states, persistence, fingerprints, security, idempotence). A test asserts every
domain has at least one CI scenario and at least one explicit manual or
limitation entry where the runner cannot prove the underlying property.

Alternative rejected: counting assertions. A large assertion count does not show
which product journeys are covered.

### 5. Scenarios reuse production modules and stay side-effect free

The scenario builders import from `site/persistence.js`, `site/core.js`,
`site/migration.js`, `site/local-migration.js`,
`site/migration-reconciliation.js`, `site/cloud-activation.js`,
`site/workspace-identity.js`, `site/sync-diagnostics.js` and
`site/data-integrity-recovery.js`. They use only in-memory stores and injected
records; they never read a clock, environment variable, file, network or
browser storage. Injecting fixed identifiers and fingerprints keeps the report
reproducible.

Alternative rejected: adding `fake-indexeddb` or a browser runner. It increases
dependencies and still would not prove Chromium mobile, OTP delivery or real
Cloud propagation.

### 6. Manual protocol and report template are separate human artifacts

Add `docs/product/e2e-certification.md` containing:

- the isolated-instance preparation and fallback export rules;
- the test-data and secret rules;
- the manual matrix (Chrome mobile, second browser/profile, real OTP, offline,
  intermittent network, empty/populated/divergent target, preview/commit race,
  reimport, restoration, logout with pending writes, URL/session change and
  bidirectional propagation);
- the expected observations and the path to recover the historical V1 source;
- a report template distinguishing CI evidence, real Dexie evidence, limits and
  incidents, plus a record of non-executed checks.

The document is narrative. The automated report remains the CI artifact and the
manual record remains separate; neither is copied into `tasks.md` as a checked
box.

Alternative rejected: storing manual results only in `tasks.md`. That would mix
human evidence with the pre-sync implementation checklist and recreate the
TS-017 failure mode.

### 7. Repository checks include the new module

`package.json` gains `node --check scripts/product/e2e-matrix.mjs` in the
`check` chain. Tests verify the chain includes the module and that no product
dependency or Dexie schema version changed. No runtime file is modified.

## Risks / Trade-offs

- [Matrix drifts from product behavior] → Scenarios call production pure
  functions; canonical references are verified; changes to requirements fail the
  traceability test until the matrix is updated.
- [A simulated check is mistaken for real E2E proof] → Evidence class `ci` is
  limited to deterministic checks, and all native properties are explicit
  `real-dexie`/`limitation` entries. The report prints the distinction.
- [Manual protocol is never executed but CI stays green] → The report counts
  real-instance evidence as pending and the backlog manual acceptance remains a
  release condition outside `apply`.
- [Test fixtures leak identifiers or secrets] → Fixtures use synthetic
  `legacy:` IDs, example `*.dexie.cloud` URLs without credentials and no email,
  OTP, token or business content from user devices; tests assert redaction.
- [The matrix overstates coverage by counting weak checks] → Each required
  journey must have its own scenario and at least one meaningful assertion about
  the observable outcome, not only a module import.
- [Legacy specs contain an unspotted contradiction] → The proposal records the
  audit result and any contradiction found during apply must be handled by an
  explicit normative delta, never by silently editing canonical history.

## Migration Plan

No data migration. The change is additive: a new report module, tests and
documentation. Rollback consists of removing the new files and the check entry;
no runtime data, schema or service configuration is touched.

## Open Questions

None that change the specs or task breakdown. The exact French wording of the
report can be adjusted during apply without changing the evidence model.
