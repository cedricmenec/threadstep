# Proposal

## Why

ThreadStep can run entirely in its autonomous `threadstep-local` workspace, but a
valid Cloud URL still opens and authenticates a synchronized database
immediately, without an activation journey that explains the destination,
attests its contents, previews the transfer and records the separate first-sync
outcome. TS-037 makes the transition from local-only use to Dexie Cloud a
voluntary, recoverable and observable opt-in: existing local records remain
completely outside any replicated table until the user consents to the exact
plan displayed, and a local IndexedDB commit is never presented as a successful
push.

The change builds on TS-032 (autonomous local Dexie), TS-033 (explicit local
conversion), TS-034 (native sync diagnostics and initial-pull evidence) and
TS-036 (plan-bound reconciliation consent, idempotent adds and truthful local
status). It must also work when the destination is already populated, belongs
to another account, is unreachable, or changes between preview and confirmation.

## What Changes

- Add a guided Cloud activation journey whose visible stages are local,
  preparation, connection/OTP, first attested pull, review/consent, local
  transfer pending, active, and recoverable failure. Authentication alone is
  never treated as consent to transfer.
- Keep the existing autonomous `threadstep-local` database and its records
  unchanged and unreplicated while the user configures a URL, authenticates by
  OTP and performs the first pull. The synchronized database remains a distinct
  Dexie Cloud workspace; no historical record, mutation queue entry or
  attachment to a synchronized table may exist before consent.
- Discover the target only after a native attested initial read. Classify it as
  verified empty, populated, divergent, unavailable/indeterminate or belonging
  to an unexpected account/scope; a cached empty IndexedDB or a failed read MUST
  NOT be interpreted as an empty Cloud.
- Reuse the attested, inventory-based, add-only reconciliation plan for the
  local IndexedDB source. Present destination (normalized URL and available
  `remoteDbId`), source and target counts, safe insertions, conflicts and blocked
  groups, then require explicit consent bound to that displayed plan and
  destination identity.
- Handle cancellation before consent without writing to either workspace.
  Handle interruption and reload idempotently: re-read local source and remote
  target, invalidate a stale plan/consent, and never duplicate already
  transferred records.
- After the local transfer transaction, distinguish “written locally /
  synchronization pending” from native remote completion. Track the initial and
  subsequent native synchronization separately, keep the autonomous source
  recoverable, and expose a truthful failure state without claiming a push.
- Cover a destination that changes during review, a permission/session/URL
  change, an offline or unavailable service, and a target associated with a
  different account by blocking or reopening review rather than copying data.
- Add deterministic Node tests for the activation state machine, target
  classification, isolation predicates, consent binding, cancellation,
  idempotent retry/reload, permission/URL/session changes, offline failures and
  commit-versus-push status. Real Cloud, mobile, keyboard and screen-reader
  acceptance remains manual.
- Update the affected canonical capabilities through OPSX deltas: activation
  and target discovery, native first-sync/completion evidence, and the
  ThreadStep-specific assistant and local-source preservation contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cloud-opt-in-activation`: the opt-in becomes an explicit staged assistant
  covering URL selection, OTP, attested target discovery, empty/populated/
  divergent/unavailable/other-account handling, plan-bound consent, local
  transfer, cancellation/interruption and preservation of the autonomous
  source.
- `cloud-sync-lifecycle`: activation adds a first-sync outcome that
  distinguishes the local transfer commit, pending/push state, native remote
  completion and errors, without inferring success from `in-sync` alone.
- `threadstep-integration-profile`: ThreadStep defines the assistant’s local
  source (`threadstep-local`), business quotas/relations, destination identity,
  explicit consent and retained-source expectations for Cloud activation.

## Impact

- `site/dexie-foundation.js`: activation-aware URL configuration and explicit
  separation of the local and synchronized database names, without changing the
  native `nameSuffix` behavior.
- `site/app.js`: staged activation controller/rendering, local-source snapshot,
  target discovery, reuse of attested reconciliation planning, cancellation,
  reload revalidation and first-sync status wiring. The existing URL form and
  historical migration path remain compatible.
- `site/migration-reconciliation.js` and/or a new pure activation module:
  target classification, source/destination/account binding, plan review and
  idempotent retry helpers reused by the UI, with no Dexie Cloud protocol
  replacement.
- `site/sync-diagnostics.js`: first-sync completion evidence used by activation,
  remaining distinct from a local commit and from a generic `in-sync` signal.
- `site/index.html`, `site/styles.css`: accessible assistant controls and
  status regions for destination, review, consent, pending transfer and
  recoverable failure.
- `tests/`: new deterministic activation/isolation/status tests and focused
  additions to the reconciliation and sync-diagnostic suites.
- No changes to the Dexie Cloud service, no server code, no implicit local
  purge, no account-to-account or URL-to-URL transfer, and no new secret. The
  autonomous local source remains intact after activation.

## Non-goals

- Modifying the Dexie Cloud server, its permissions model or native
  synchronization/authentication mechanisms.
- Automatically transferring data between accounts or URLs, or overwriting an
  existing remote record.
- Purging the local source or the historical `threadstep.document.v1` key.
- Removing the V1 reader or changing backup formats; that remains TS-040.
- Proving real OTP delivery, multi-device convergence, mobile layout, touch,
  keyboard, focus or screen-reader behavior in the runner; those remain manual.
- Launching a paid model, committing, pushing, archiving, merging or publishing
  from this planning change.

## Uncertainties (no product decision invented)

1. **Activation entry point and wording.** The brief requires an assistant but
   does not fix whether the existing Cloud configuration form becomes its first
   step or a separate “Activer Cloud” control opens it. The design reuses the
   existing form as the URL step while keeping local mode usable; final labels
   and placement need manual/product review.
2. **What “other account” evidence is available.** The project can compare the
   authenticated user, persisted `remoteDbId`, URL and available realms, but it
   does not invent a server-side ownership API. The design fails closed when
   those native signals disagree or are unavailable; it does not claim a
   stronger account-audit guarantee.
3. **Cancellation after the local transfer commit.** Cancelling before consent
   is non-destructive. Once the local IndexedDB transfer commits, undoing it
   would itself be a destructive remote-aware operation, so the design keeps the
   committed local synchronized copy and the autonomous source, and reports the
   transfer as pending rather than pretending cancellation reversed it. A
   product decision to offer a compensating rollback would be a separate
   change.
4. **Post-activation local source lifecycle.** The autonomous source must remain
   recoverable. Whether it remains permanently visible, becomes read-only, or is
   eventually retired is not decided here beyond preserving export/recovery
   access; any purge remains out of scope.
5. **First-sync completion granularity.** Native signals prove an initial pull
   and eventual synchronization of the synchronized database, but the brief
   requires distinguishing a local commit from remote completion. The design
   uses native `persistedSyncState`/`syncState` evidence and a conservative
   “indeterminate” state when per-record propagation cannot be proven; it does
   not invent a per-record acknowledgement API.
6. **Debounce of native observable churn.** Several `syncState` transitions may
   occur during one activation. The design refuses stale results with a
   generation guard; any additional visual debounce is a manual-performance
   question, not a new required behavior.
