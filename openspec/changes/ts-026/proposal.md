# Proposal

## Why

ThreadStep still stores the whole workspace in the `threadstep.document.v1`
JSON blob in `localStorage`. The product contract now targets an
IndexedDB/Dexie base synchronized by Dexie Cloud
([spec](../../../docs/product/specs/dexie-cloud-local-first.md)), and TS-025
delivered the transactional store plus a temporary non-destructive guard. The
historical document must now be converted into the synchronized tables without
ever losing it, sending it to Cloud without consent, or overwriting an
already-populated target base.

## What Changes

- Detect the historical `threadstep.document.v1` document and validate it
  strictly with `parseDocument`, preserving subjects, items, business ids,
  `parentId`, notes, priorities, order, `done` states and the local resume
  preference.
- Present the migration destination, the data to transfer and the future
  synchronization effect, then require an explicit user confirmation before any
  write into synchronized tables.
- Apply the migration per target base atomically and idempotently, detecting
  duplication, id collisions, an already-populated base, a session/base change
  and a recovery after an interruption.
- Map legacy ids deterministically when the `@id` strategy requires a prefix,
  keeping `parentId` references and V1 export identifiers coherent.
- On refusal, interruption, exception or an invalid destination, keep the
  historical document available to export, never erase the old key and never
  overwrite Cloud or base data.
- Guarantee that changing the Dexie Cloud URL never imports data from one base
  into another.
- Keep the existing JSON V1 export/import usable after any attempted migration.

## Capabilities

### New Capabilities

- `legacy-document-migration`: detection and strict validation of the historical
  localStorage V1 document, consent-gated, atomic, idempotent and per-base
  conversion into the synchronized tables, with stable id mapping, non-destructive
  failure handling and no implicit cross-base transfer.

### Modified Capabilities

- None. The existing `local-first-business-persistence` compatibility guard and
  `dexie-local-database` base-selection requirements keep their observable
  behavior; TS-026 adds the explicit conversion the guard already anticipated
  without changing those requirements.

## Impact

- `site/`: a new pure migration module (detection, validation, consent
  description, id mapping, migration planning and execution over an injected
  adapter) plus consent-screen and execution wiring in `app.js`; `core.js` stays
  pure and the V1 document/export shape is unchanged.
- `package.json`: extended `node --check` coverage for the new module. No new
  runtime dependency.
- `tests/`: new deterministic Node tests over the pure migration functions with
  an injectable in-memory store and fake storage, plus static assertions over the
  delivered sources.
- `docs/product/developer-guide.md` and `docs/product/mvp.md`: describe the
  migration flow, its atomicity/idempotence and its non-destructive guarantees.
- No secrets or protected factory files are touched. No data is transferred
  before explicit consent.

## Non-goals

- Purging the historical `localStorage` key or the source data (an independent
  purge decision remains out of scope).
- Automatic transfer of data between different Dexie Cloud URLs.
- Restoring data that was never synchronized.
- The OTP sign-in journey (TS-027), the global synchronization indicator and
  diagnostic view (TS-028), logout/purge (TS-029) and the consolidated guarantee
  suite (TS-030).
- Editing `AGENTS.md`, `openspec/config.yaml`, workflows, secrets, backlog or
  other protected factory files.

## Uncertainties (no product decision invented)

1. **`@id` prefix scheme.** The rollout plan notes that Dexie Cloud `@id`
   keys impose a documented mapping for legacy identifiers. This proposal
   requires a deterministic, stable, injective mapping that preserves
   `parentId` and the resume preference, but it does not invent the concrete
   prefix format; that choice needs product/architecture confirmation.
2. **Target-base identity check.** Recovering after a session or base change
   requires binding a pending consent to the exact destination base identity.
   Which identifier (Cloud URL, database suffix, user id) is authoritative is
   not decided here; the spec requires that a changed destination aborts the
   migration instead of importing into another base.
3. **Consent-surface form.** The consent screen could be a dedicated panel, a
   modal or an inline card. The plan commits only to an explicit, testable
   consent gate before any synchronized write; the exact presentation needs
   confirmation.
4. **Resume preference transfer.** Whether the local resume preference is
   migrated with the document or kept purely local is not fixed by the task
   beyond preserving it; the spec keeps it local and non-synchronized, matching
   `local-first-business-persistence`.
5. **No new dependency.** Deterministic runner tests are proposed without
   `fake-indexeddb` or a DOM, using injectable in-memory/fake adapters, as in
   TS-025. A real IndexedDB/browser test dependency would be a separate decision.
