# Design

## Context

See `proposal.md` — Why. `site/core.js` is pure domain logic; `site/app.js` owns
the DOM, `localStorage` (`threadstep.document.v1`, `threadstep.resume.v1`), JSON
export/import and focus; `site/dexie-foundation.js` (TS-024) validates the Cloud
URL, gates the synchronized base and declares `dexieSchema()` with `subjects`
and `items` stores keyed by `@id`. `SYNCHRONIZED_STORES` already declares both
stores. Tests are deterministic Node tests over pure modules plus static source
assertions (`npm test` = `node --test tests/*.test.mjs`); there is no DOM,
IndexedDB or `fake-indexeddb` runner and `npm run check` also runs
`node --check site/core.js site/dexie-foundation.js site/app.js`. During `apply`
the reviewed `proposal.md`, `design.md` and delta specs are immutable and only
`tasks.md` may change; `scripts/*`, `.github/*`, `AGENTS.md`,
`openspec/config.yaml` and `docs/factory/*` are protected. Every checklist item
must be provable on the runner before OPSX sync, so decisive logic must be pure
and Node-testable.

## Goals / Non-Goals

**Goals:**

- A pure, deterministic core for the entity model, the V1 projection and every
  business mutation, testable without a browser.
- A thin adapter contract (`commit(operations)`) implemented by Dexie in the
  browser and by an in-memory fake in tests.
- Local confirmation on commit; local-failure and network-failure kinds
  distinct.
- Cross-tab propagation through the Dexie change mechanism / a broadcast
  channel, not only `storage`.
- Non-destructive coexistence with the historical V1 document behind a guard.

**Non-Goals:**

- The localStorage V1 conversion (TS-026), OTP (TS-027), synchronization
  indicator/diagnostic (TS-028), logout/purge (TS-029) and the consolidated
  guarantee suite (TS-030).
- Any new runtime dependency; any consent-less transfer to Cloud; editing
  protected factory files.

## Decisions

### Decision: pure model, projection and mutation planners, thin adapter

Put the record model, `documentToRecords`/`recordsToDocument` projection and pure
mutation planners in a new `site/persistence.js`, and keep `site/app.js`
responsible only for the DOM and for calling an injected
`store.commit(operations)`. This matches the existing pure-core plus
static-assertion test style and lets the runner prove the invariants and failure
semantics without a browser. Alternatives rejected: raw Dexie calls inside
`app.js` (untestable in the runner) and adding `fake-indexeddb` (new dependency
and environment risk on the ephemeral runner).

### Decision: fine-grained records with stable identifiers

Store one record per subject and one per step in the `subjects`/`items` stores,
keyed by globally unique string ids, with `subjectId`, `parentId`, an order
index, `priority`, `done`, `title` and optional `note`. A mutation emits put and
delete operations for only the affected records; there is no whole-document
write. This is the central TS-025 risk control: it prevents one tab or device
from overwriting another's independent edit. The projection reproduces the exact
V1 JSON shape so export/import, ids, `parentId`, order, `priority`, `done` and
`note` are preserved.

### Decision: commit-based local confirmation and distinct error kinds

`commit(operations)` resolves with a `recorded` status when the transaction
commits and rejects with a `local` error kind when IndexedDB fails. A later
synchronization failure is a separate `sync` kind and never retracts a
`recorded` result. Rationale: the specification requires local recording
independent of a network acknowledgement and a local failure distinct from a
network failure, and the interface must not present an IndexedDB failure as
success.

### Decision: cross-tab propagation via the Dexie change subscription

Subscribe to Dexie live queries / change events (with a `BroadcastChannel` for
non-Dexie signals) to refresh the projection in other tabs; keep the existing
`storage` listener only for the legacy document path. Rationale: the task
forbids relying solely on the `storage` event. The pure module exposes the
subscription contract so the in-memory fake can drive it deterministically.

### Decision: atomic import through a single operation set

Validate the whole V1 document first with the existing `parseDocument`, then
build one operation set that replaces the records in a single transaction. A
validation or transaction failure changes nothing. Rationale: the import must be
atomic and must never partially overwrite local data.

### Decision: compatibility guard with no destructive conversion

Until TS-026 delivers the explicit conversion, keep the historical
`threadstep.document.v1` document readable and visible; never delete it, never
rewrite it destructively and never transfer it to Cloud without explicit
consent. The exact guard form is an open question for the owner; the plan
implements a tested, non-destructive guard so no intermediate deployment hides
or erases historical data (the rollout plan forbids such a state).

### Decision: strictly local preferences

The tracked-action preference and other UI-only preferences stay in
origin-scoped local storage under the existing keys, are never written to
synchronized stores and are excluded from export. Rationale: the specification
requires strictly local, non-synchronized preferences.

### Decision: test strategy

Add `tests/local-persistence.test.mjs` with an in-memory store fake covering the
projection round-trip, every mutation planner, commit success and forced
failure, offline confirmation, synchronization-error separation, two-consumer
propagation and concurrent distinct-item edits, atomic import success and
failure, and preference separation. Add static assertions over
`site/persistence.js`/`site/app.js` for purity, adapter wiring, the guard and the
change subscription. Real browser, IndexedDB, multi-tab, offline, mobile,
keyboard and screen-reader behavior stays in Manual acceptance.

## Risks / Trade-offs

- [Asynchronous mutations change timing versus synchronous `localStorage`] →
  keep the mutation planners synchronous and pure; only `commit` is async; report
  status through the existing live region.
- [Static assertions can drift from runtime behavior] → keep the decisive logic
  in pure functions tested directly; use static assertions only for wiring,
  guard and subscription facts the runner cannot unit-test.
- [A compatibility guard can look like two sources of truth] → document the
  guard as transitional and non-destructive; TS-026 owns the single conversion.
- [No browser runner proves real IndexedDB/Dexie behavior] → keep those checks
  in Manual acceptance against an isolated instance; automate only what the
  runner can prove.
- [Dexie Cloud `@id` mapping is undecided] → keep logical ids stable in the
  projection and record the mapping as an open question; do not invent a prefix
  scheme.

## Migration Plan

The change is additive and non-destructive: the new module and tests ship with
the app, the V1 document and its export remain valid, and the guard keeps
historical data visible. The real conversion is TS-026. Rollback is reverting the
PR: no stored shape changes and no IndexedDB base is deleted.

## Open Questions

- Which guard mechanism (per-session feature gate, read-through overlay or
  atomic combined delivery) is preferred? Every option must be non-destructive
  and tested, so this does not change the requirements or the task breakdown.
- Must legacy UUIDs be re-prefixed for Dexie Cloud `@id`, and how does that map
  to V1 export identifiers? This is deferred to the sync/OTP work and does not
  change this change's specs.
