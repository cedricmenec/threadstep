# Proposal

## Why

ThreadStep stores all subjects and steps in one `threadstep.document.v1` JSON
blob in `localStorage` and rewrites the whole blob on every mutation, which
cannot provide local-first, offline-capable, multi-tab-coherent business
persistence. The product contract now targets an IndexedDB/Dexie base
synchronized by Dexie Cloud
([spec](../../../docs/product/specs/dexie-cloud-local-first.md)), and TS-024
delivered only the foundation. TS-025 must move business operations onto a
transactional, fine-grained Dexie store so an offline write is confirmed on
commit, two tabs stay coherent and concurrent edits to distinct items do not
overwrite a whole document, without hiding or erasing existing V1 data before
the conversion (TS-026) and OTP (TS-027) steps.

## What Changes

- Add a transactional local-first business store over Dexie/IndexedDB that
  models subjects and steps as separate records with globally unique stable
  identifiers, preserving `parentId`, order, `priority`, `done` and `note`.
- Confirm a local write on transaction commit, without awaiting a Dexie Cloud
  acknowledgement, and report an IndexedDB failure as a local persistence error
  distinct from a network/synchronization error.
- Propagate committed changes across tabs through the Dexie
  change/live-query mechanism and/or a broadcast channel, not only the browser
  `storage` event.
- Route every current business operation (create/edit, completion, substeps,
  promotion, ordering, removal and undo, filters, counter, suggestion, tracking
  and routes) through the store while keeping `site/core.js` pure and current UI
  rules unchanged.
- Keep the tracked-action preference and other UI-only preferences in
  origin-scoped non-synchronized storage, absent from synchronized records and
  from the JSON export.
- Validate and apply a JSON V1 import atomically; keep export V1-compatible and
  round-trip safe.
- Add a non-destructive compatibility guard so the existing V1 document stays
  available and is never erased before the explicit TS-026 conversion, with no
  consent-less transfer to Cloud.
- **BREAKING (implementation only):** the interactive business path moves from
  synchronous `localStorage` to asynchronous IndexedDB, so mutations become
  asynchronous. The stored V1 shape and export/import compatibility are
  preserved.

## Capabilities

### New Capabilities

- `local-first-business-persistence`: transactional local-first storage of
  subjects and steps, local write confirmation independent of the network,
  distinct local-failure reporting, cross-tab coherence, fine-grained entity
  granularity, atomic JSON V1 import/export, non-synchronized preferences, and
  the compatibility guard that preserves historical V1 data.

### Modified Capabilities

- None. Existing UI and domain capabilities keep their observable behavior and
  no business requirement changes. TS-026 owns the explicit
  localStorage-to-IndexedDB conversion, so the existing `localStorage`-key
  requirements are not modified here.

## Impact

- `site/`: a new pure persistence module (entity model, V1 projection, mutation
  planners, adapter contract) plus adapter/subscription wiring in `app.js`;
  `core.js` stays pure.
- `package.json`: extended `node --check` coverage. The pinned `dexie` and
  `dexie-cloud-addon` dependencies are reused; no new runtime dependency.
- `tests/`: new deterministic Node tests over the pure projection and mutation
  functions with an injectable in-memory store, plus static assertions over the
  delivered sources.
- `docs/product/developer-guide.md` and `docs/product/mvp.md`: describe the
  TS-025 adapter, entity granularity and compatibility guard.
- No change to the V1 document shape, its export or the existing UI behavior.
  No secrets or protected factory files are touched.

## Non-goals

- Converting or removing the historical `threadstep.document.v1` key (TS-026).
- The OTP sign-in journey (TS-027), the global synchronization indicator and
  diagnostic view (TS-028), logout/purge (TS-029) and the consolidated guarantee
  suite (TS-030).
- Any automatic, consent-less transfer of existing local data to Dexie Cloud.
- Editing `AGENTS.md`, `openspec/config.yaml`, workflows, secrets, backlog or
  other protected factory files.

## Uncertainties (no product decision invented)

1. **Interactive path versus visibility of V1 data.** The task asks to replace
   the business `localStorage` path with Dexie while forbidding an intermediate
   state that hides the existing document. The safe reading adopted here is to
   move the interactive write path to the Dexie adapter but to keep the
   historical V1 document available and visible behind a compatibility guard
   until TS-026 performs the explicit conversion. Whether the interactive path
   may switch to Dexie before conversion, or must stay on `localStorage` until
   then, needs product confirmation.
2. **Dexie Cloud identifier mapping.** The rollout plan notes that `@id`
   prefixes impose a documented mapping for legacy identifiers. UUIDs generated
   by `crypto.randomUUID()` are globally unique, but whether they must be
   re-prefixed for Dexie Cloud and how that maps to V1 export identifiers is not
   decided here.
3. **Compatibility-guard mechanism.** A guard could be a per-session feature
   gate, a read-through overlay or an atomic combined delivery. The plan commits
   only to a non-destructive, tested guard that never rewrites or deletes V1
   data; the exact mechanism needs confirmation.
4. **Offline-after-initialization condition.** The specification allows offline
   writes only after a configured and authenticated session. TS-025 tests the
   local store in isolation; the real authenticated session depends on TS-027.
5. **No new dependency.** Deterministic runner tests are proposed without
   `fake-indexeddb` or a DOM, using an injectable in-memory store. If a real
   IndexedDB test dependency is required, that is a separate decision.
