# Proposal

## Why

ThreadStep can already build a non-destructive reconciliation plan, but the UI
still re-computes that plan during the confirmation click and uses the fresh
fingerprint as consent, so a plan the user never saw can be committed. The
historical migration panel is also driven by one-shot asynchronous reads: a
transient `sync-offline` attestation can leave “Migration temporairement
bloquée” and its footer message on screen after Dexie Cloud is healthy again,
and a late result from an older read can replace a newer one. Finally, the mere
presence of `threadstep.document.v1` keeps re-offering an import even when the
restored target already contains every relevant record.

TS-036 closes those gaps without weakening the existing add-only, attested,
plan-bound guarantees and without deleting or transforming the historical V1
source.

## What Changes

- Bind the confirmation action to the fingerprint of the plan actually rendered.
  A plan recomputed between preview and confirmation, including a changed
  target, source, destination, session, rights, resolution, or ordered operation
  set, MUST be refused by the migration layer and re-presented; no commit is
  performed on the old consent.
- Revalidate ordered migration operations, not only the source/target
  fingerprint, immediately before the single add-only transaction. Keep the
  existing distinction between the local IndexedDB commit and a later native
  remote-sync guarantee.
- Derive the historical migration panel from the same current native Dexie
  signals as the synchronization diagnostic. On a session, sync-state, URL,
  source or destination change, re-evaluate the offer; hide or replace a
  transient block when the new attestation and target validation succeed.
- Ignore stale asynchronous lifecycle results with a monotonically increasing
  generation captured when each read starts. An older migration read or status
  result MUST never overwrite a newer panel or footer state, including with two
  concurrent sync events or after a reload.
- Distinguish “the V1 source is preserved” from “migration is still needed”.
  A target that already contains all relevant records produces no automatic
  import request and no insertion. An explicit refusal/dismissal is remembered
  for that exact source fingerprint, destination (URL, `remoteDbId`) and
  authenticated user, without deleting or modifying V1. A real source, URL or
  account change reopens safe verification; a real difference remains
  observable through explicit access.
- Keep the historical backup and its JSON export reachable in every outcome,
  including after dismissal, and preserve existing recovery paths.
- Make the footer message reflect the current journey. Removing a stale
  migration block MUST NOT erase a real storage/read error and MUST NOT claim a
  remote synchronization. A verified “already reconciled” or “plan to review”
  status replaces only the migration-owned message.
- Add deterministic regression tests for stale consent, ordered-operation
  revalidation, panel/footer lifecycle, dismissal scoping, reload, concurrent
  sync events and V1 retention. Existing 5-subject / 18-step, conflict,
  ordering, collision, quota and idempotence coverage is extended where needed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-reconciliation`: the displayed-plan consent requirement now explicitly
  covers re-computation during confirmation, revalidation of rights and ordered
  migration operations, and refusal of a previously accepted plan without a new
  explicit review.
- `cloud-opt-in-activation`: a retained historical source is not itself a
  migration order; reconciled targets and explicit per-source/destination
  dismissals suppress automatic re-proposal while V1 remains accessible and
  real differences remain observable.
- `cloud-sync-lifecycle`: the historical migration panel and footer follow the
  current native synchronization state; transient blocks disappear after
  re-evaluation, stale asynchronous results are ignored, genuine blocking
  states reappear, and real storage errors or remote-sync claims are never
  replaced or invented by migration lifecycle updates.

## Impact

- `site/app.js`: the historical migration offer becomes a generation-guarded
  lifecycle driven by native observables; confirmation re-renders a changed plan
  instead of committing it; the footer status gains an owner/generation so a
  migration update cannot erase a storage error.
- `site/migration-reconciliation.js`: a pure plan-review helper and ordered
  operation revalidation support for the commit gate, without changing the
  add-only transaction contract.
- A small pure lifecycle module and origin-local dismissal metadata (no business
  content, not synchronized) for offer decisions, generation ordering and footer
  ownership.
- `site/index.html`/`site/styles.css`: an explicit “verify the historical
  backup” entry point when the V1 source is retained, and removal of any stale
  claim when no migration is required.
- `tests/`: new deterministic lifecycle/consent tests and focused additions to
  the existing reconciliation and sync-diagnostic suites.
- No new runtime dependency, Cloud secret, schema version change or deletion of
  `threadstep.document.v1`. The optional removal of the V1 reader remains
  TS-040.

## Non-goals

- Automatically resolving all concurrent business edits, replacing Dexie
  Cloud’s native synchronization protocol, purging data, or deleting V1.
- Changing the local-only JSON import, the local conversion flow, authentication
  or Cloud configuration semantics.
- Performing real-browser, mobile, touch, keyboard, screen-reader or real Cloud
  acceptance in the runner; those remain manual and separate from CI.
- Modifying the ASF factory, workflows, secrets, backlog or protected files.
- Launching a paid model, automatic import, merge, archive or publication from
  this planning change.

## Uncertainties (no product decision invented)

1. **Dismissal gesture.** The brief allows an explicit refusal/dismissal to be
   remembered. The design proposes reusing the existing explicit “Conserver
   localement” refusal of a rendered plan, while the “Fermer” button of a
   transient blocked panel does not record a dismissal. A dedicated dismissal
   label can be added if product review prefers clearer wording.
2. **Explicit re-check control.** The design adds a clearly labelled way to
   reopen verification for a retained V1 source after dismissal or after an
   “already reconciled” result. Its exact placement and wording must be
   confirmed during manual acceptance; it must not become an automatic import.
3. **Native signal timing.** Dexie Cloud may emit several `syncState` /
   `persistedSyncState` transitions during one connection. The design treats
   every new evaluation as a new generation and only the latest started request
   may render. Whether an additional debounce is desirable on slow devices is a
   manual-performance observation, not a change to the required behavior.
4. **Dismissal expiry.** No automatic expiry is proposed: the key is scoped by
   source fingerprint, URL, `remoteDbId` and user, so any real identity or
   source change reopens verification. A time-based expiry would be a new
   product decision and is not introduced.
5. **Rights revalidation source.** The available native persisted state exposes
   realms rather than a full permission object. The design reuses the existing
   attestation (realms, user, `remoteDbId`, session) plus fail-closed read and
   commit errors, and does not invent a client-side permission API.
