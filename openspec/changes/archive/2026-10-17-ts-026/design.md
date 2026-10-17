# Design

## Context

See `proposal.md` — Why. `site/core.js` is the pure domain (`parseDocument`,
`STORAGE_KEY = "threadstep.document.v1"`, `RESUME_KEY`, limits). TS-025 added
`site/persistence.js` (fine-grained `subjects`/`items` records,
`documentToRecords`/`recordsToDocument`, `applyOperations`, `diffRecords`, an
injectable `commit(operations)` adapter contract, an in-memory store and a
non-destructive `compatibilityGuard`). `site/app.js` keeps the DOM, `localStorage`,
export/import and a `createBusinessStore(db)` Dexie adapter over the
`subjects`/`items` stores; `site/dexie-foundation.js` validates the Cloud URL and
declares `subjects`/`items` keyed by `@id`. Tests are deterministic Node tests
over pure modules plus static source assertions; there is no DOM, IndexedDB or
`fake-indexeddb` runner. During `apply`, `proposal.md`, `design.md` and the
delta specs are immutable and only `tasks.md` may change; `scripts/*`,
`.github/*`, `AGENTS.md`, `openspec/config.yaml` and `docs/factory/*` are
protected. Every checklist item must be provable on the runner before OPSX sync,
so the decisive logic must be pure and Node-testable.

## Goals / Non-Goals

**Goals:**

- A pure, deterministic migration core: detection, validation, consent
  disclosure content, id mapping, migration planning (including collision,
  duplication and populated-target classification) and an execution over the
  injected adapter.
- An explicit, testable consent gate: no synchronized write without it.
- Atomic, per-base idempotent conversion with stable legacy-id mapping.
- Non-destructive handling of refusal, interruption, exception and an invalid
  or changed destination; the source stays readable and exportable.
- No implicit cross-base transfer on URL change.

**Non-Goals:**

- Purging the historical key or source (independent decision).
- The OTP journey (TS-027), sync indicator/diagnostic (TS-028), logout/purge
  (TS-029) and consolidated guarantee suite (TS-030).
- Any new runtime dependency; any consent-less transfer; editing protected
  factory files.

## Decisions

### Decision: a pure migration module, thin adapter and consent gate

Add `site/migration.js` for detection, validation, disclosure data, id mapping
and pure planning/execution over an injected adapter, and let `app.js` own only
the consent screen, the adapter wiring and the notifications. This matches the
TS-025 pure-core plus static-assertion test style and lets the runner prove the
invariants and failure semantics without a browser. Alternatives rejected: Dexie
calls inside `app.js` (untestable in the runner) and adding `fake-indexeddb`
(new dependency and ephemeral-runner risk).

### Decision: strict reuse of `parseDocument` for detection

`detectHistoricalDocument(storage)` reads `STORAGE_KEY` and returns the document
only when `parseDocument` accepts it; otherwise it returns a typed rejection and
never migrates. Rationale: the task requires strict validation and forbids
migrating malformed data; reusing `parseDocument` keeps a single validation
source of truth.

### Decision: consent descriptor separate from execution

`describeMigration(document, destination, records)` produces the disclosure
(destination, transferred subjects/items counts, future synchronization effect)
and the migration is only executable when an explicit consent flag is passed.
Rationale: the spec requires the disclosure to precede consent and the consent
gate to be observable and testable; separating the content from the write makes
both provable.

### Decision: atomic execution through one operation set

`planMigration(records, document, options)` builds one operation set for the
injected adapter; `runMigration(adapter, plan, consent, destinationCheck)`
commits it in a single `commit(operations)` call. A validation, consent,
destination or transaction failure leaves the adapter unchanged. Rationale: the
import must be atomic and must never leave partial data.

### Decision: idempotence and collision classification before writing

The planner computes the diff between the current records and the projected
records, detects an already-migrated document (empty diff), detects an id
collision (target id with different content) and detects a populated target.
Re-running yields no operations, so no duplication occurs. Rationale: atomicity
alone does not prevent duplicates; the classification must be explicit and
testable.

### Decision: deterministic, injective legacy-id mapping

`mapLegacyId(legacyId, options)` applies a documented, stable, injective
transformation (for example a fixed prefix) and `mapRecords` remaps every `id`
and `parentId` consistently, while the V1 projection keeps the original export
identifiers. The exact prefix is an open question; the function contract and its
injectivity/stability are required and tested. Rationale: the rollout plan flags
`@id` prefixing but does not fix the format.

### Decision: destination binding for session/base changes

The consent carries the disclosed destination identity; `runMigration` receives
a destination check and aborts when the current destination differs from the
disclosed one. Rationale: a session or base change must never route the data into
another base, and URL changes must never import data implicitly.

### Decision: non-destructive failure and source retention

No migration code path calls `storage.removeItem(STORAGE_KEY)` or destructively
rewrites the historical value; on any failure the source stays readable and
`exportDocument` continues to work. The TS-025 `compatibilityGuard` remains.
Rationale: the task requires the source and export to stay usable and forbids
erasing the old key.

### Decision: test strategy

Add `tests/legacy-migration.test.mjs` with a fake storage and the in-memory store
from `persistence.js` covering detection/validation, disclosure content, the
consent gate, atomic execution, idempotent re-run, collision, populated target,
interruption/failure recovery, id mapping consistency, destination change and
source retention. Add static assertions over `site/migration.js`/`site/app.js`
for the consent gate, adapter wiring and absence of destructive removal. Real
browser, IndexedDB, multi-tab, offline, mobile, keyboard and screen-reader
behavior stays in Manual acceptance.

## Risks / Trade-offs

- [Consent can be bypassed by wiring instead of logic] → keep the write behind an
  explicit consent flag in `runMigration` and assert the gate statically and by
  test.
- [Legacy-id mapping could break references] → remap `id` and `parentId`
  through one function and test injectivity plus round-trip export.
- [Idempotence depends on comparing projected records] → base it on the same
  `diffRecords` projection TS-025 already tests; re-run must yield an empty diff.
- [Static assertions can drift from runtime behavior] → keep decisive logic in
  pure functions tested directly; static assertions only for wiring and
  non-destructive facts.
- [`@id` prefix format is undecided] → keep the mapping injective/stable and
  record the format as an open question; do not invent it in a requirement.

## Migration Plan

The change is additive and gated: the migration module and consent screen ship
with the app, the historical document and its export remain valid and the guard
stays, and no write to synchronized tables happens without consent. Rollback is
reverting the PR: no stored shape changes, no key is deleted and no IndexedDB
base is deleted. The actual source purge remains a separate future decision.

## Open Questions

- Which concrete `@id` prefix scheme is required, and how does it map back to V1
  export identifiers? The mapping contract (deterministic, stable, injective,
  reference-preserving) is fixed; the format is deferred.
- Which destination identity (Cloud URL, database suffix, user id) binds a
  pending consent? The requirement to abort on a changed destination is fixed;
  the authoritative field needs confirmation.
- Which consent-surface form (panel, modal or inline card) is preferred? Any
  option must be explicit and testable, so it does not change the requirements
  or the breakdown.
