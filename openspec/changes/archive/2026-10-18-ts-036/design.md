# Design

## Context

See `proposal.md` — Why. The applied code already provides attested target
reads, a deterministic inventory, add-only plans, deterministic copies,
fingerprints and a truthful local/pending/synced status reducer in
`site/migration-reconciliation.js`. `site/app.js` renders the preview and the
transient “Migration temporairement bloquée” panel, and `site/sync-diagnostics.js`
derives the read-only native diagnostic.

The remaining gaps are lifecycle and consent boundaries in `site/app.js`:

- `confirmReconciliation` recomputes the plan, assigns `context.plan = fresh`
  and then uses the *fresh* fingerprint as consent, so a plan that changed after
  the preview can still be committed.
- `offerHistoricalMigration` is launched from authentication startup,
  `syncComplete`, and some source changes. Its asynchronous result is not
  sequenced, and a transient failed attestation renders a blocking panel that
  is not re-evaluated by the `syncState` subscriptions used by the diagnostic.
- The footer is a single last-write-wins text node. A stale migration block can
  overwrite or outlive a real storage/read error, and clearing it can leave a
  false “disconnected” or unsupported “synchronized” claim.
- Any valid `threadstep.document.v1` value currently leads to a reconciliation
  panel, even when the restored target already contains every relevant record;
  no explicit dismissal survives a reload.

The runner has no DOM, IndexedDB, Cloud session or network, so the decisive
lifecycle rules must remain pure and injectable, as with TS-031 and TS-034.
Real browser and isolated-Cloud verification stays manual.

## Goals / Non-Goals

**Goals:**

- Make the plan actually displayed, including its ordered operations, the only
  object consent can authorise.
- Recompute the historical offer and footer from current native signals, with
  stale asynchronous results discarded.
- Suppress automatic re-proposal when the source is already reconciled or
  explicitly dismissed for that source and destination, while preserving V1 and
  an explicit verification/export path.
- Keep a real storage/read error and truthful synchronization status separate
  from migration lifecycle messages.
- Prove all deterministic rules with Node tests on the runner.

**Non-Goals:**

- Changing the add-only transaction, Dexie schema, copy-id derivation or
  conflict semantics already delivered by TS-031.
- Removing or rewriting `threadstep.document.v1`, or implementing TS-040.
- Inventing new native Dexie Cloud permission APIs, synchronization signals or
  automatic conflict resolution.
- Replacing the local-only JSON import or local conversion behavior.
- Adding a browser test runner or a new runtime dependency.

## Decisions

### 1. Consent is captured from the rendered plan, never from a recomputation

`site/migration-reconciliation.js` gains a pure review helper, for example
`reviewDisplayedPlan(displayedPlan, nextPlan)`, returning whether the next plan
is the displayed one. The comparison covers:

- the plan fingerprint (source, destination, URL, `remoteDbId`, user, target
  projection, provenance and resolutions);
- the plan status (`ready`, `already-migrated`, blocked, ambiguous, invalid);
- the ordered add operations (`store`, `id`, business values and placement);
- the blocked groups and reasons, so a newly explained exclusion also requires
  review.

`site/app.js` stores `previewFingerprint` and the ordered operation projection
when it renders a plan. Confirmation re-reads the source and target, builds the
fresh plan, and calls the review helper before creating consent:

- different plan → render the fresh plan, clear the consent checkbox, announce
  that a new review is required, and do not call the adapter;
- same plan → keep the user’s checked consent and pass the **displayed** plan
  and its fingerprint to `runReconciliation`.

`runReconciliation` continues to reject missing, false or mismatched consent and
to revalidate the native attestation and input fingerprints. Its revalidation
payload may also include the freshly built plan; when present, the gate compares
the ordered operations and blocked groups before calling `commit`. The app always
supplies that plan, so the migration layer — not only the UI — refuses a stale or
reordered plan. If the plan changed only by native metadata, the fingerprint and
operations are unchanged and the rendered preview stays valid.

Alternative rejected: storing the fresh fingerprint as consent after the
recomputation. It silently authorises a plan the user never saw.

### 2. A pure lifecycle module decides the offer and ordering

Add a small pure module (working name `site/migration-lifecycle.js`) for rules
that do not need IndexedDB, DOM or Dexie:

- `computeDismissalKey({ sourceFingerprint, destination, userId })` — canonical
  SHA-256 over the exact V1 source fingerprint, normalized URL, `remoteDbId` and
  a hashed user identity.
- `parseDismissalStore(text)` / `addDismissal(store, key)` /
  `isDismissed(store, key)` — a versioned origin-local record containing only
  version and opaque keys. No titles, notes, email, OTP, token or raw user id.
- `decideHistoricalOffer(input)` — pure decision over source presence, explicit
  request, dismissal match, attestation result and plan outcome. It returns an
  action such as `closed`, `blocked`, `preview`, `already-reconciled` or
  `dismissed`.
- `reduceFooterStatus(current, event)` — a small owner/generation reducer
  described in decision 5.

The app keeps the storage adapter and DOM rendering. Alternative rejected:
putting the rules directly in `app.js`, which the runner cannot execute.

### 3. Every asynchronous offer is generation-guarded and identity-scoped

A lifecycle generation increases whenever the inputs may have changed:

- authentication/session observable, `syncState`, `persistedSyncState`;
- `online`/`offline` events;
- Cloud URL configuration changes;
- `storage` events for `threadstep.document.v1`;
- an explicit “verify the historical backup” action;
- a completed commit or a closed panel.

Each request captures the generation plus the source fingerprint and destination
identity (`url`, `remoteDbId`, user). When the asynchronous attested read and
plan return, the result is applied only if its generation is still current and
the source/destination identity still matches. An older result is discarded.
This makes two concurrent sync events non-destructive even if the older read
finishes last, and a reload starts a new in-memory sequence.

The subscriptions that currently call `renderSyncDiagnostic()` also schedule the
lifecycle. Re-rendering is keyed by action + plan fingerprint + attestation
reason, so an unchanged plan is not rebuilt and a metadata-only sync does not
reset the user’s checked consent. A changed plan, a real blocking state or a
different destination re-renders and clears consent.

Alternative rejected: relying on launch order or last-completed-read ordering;
it cannot distinguish a stale slow read from a new one.

### 4. “V1 retained” is distinct from “migration needed”

The automatic offer proceeds only when the source exists, the workspace is
authenticated/configured, and the dismissal key does not match:

1. If the source is absent, invalid or unavailable, close the panel.
2. If the attested target is unavailable, render the blocking state with the
   current typed reason (not an old one).
3. If the fresh plan has insertions or blocked groups, render the preview.
4. If the plan is `already-migrated` with no operation and no blocked group, do
   not render an import panel and do not insert anything.

An explicit “verify the historical backup” action bypasses the automatic
suppression for that invocation and shows the current plan, including an
`already-migrated` result, so a real later difference remains observable.

The existing explicit “Conserver localement” refusal of a rendered plan records
the dismissal key. Closing a transient blocked panel does not record a
dismissal, because nothing about the source/target comparison was accepted.
Dismissal storage is origin-local and best-effort: if it cannot be written, the
panel still closes for this session but no false persistence is claimed.

A new Cloud-mode historical-backup area exposes the retained V1 source whenever
it is present and authenticated, with a download action and the explicit
verification action. It is not an import request and is shown even after
dismissal or `already-migrated`. Local mode keeps its existing notice, export and
conversion controls unchanged. V1 is never removed or rewritten by any of these
paths.

### 5. Footer updates are owned and generation-bound

Replace the bare last-write-wins footer helper with a small reducer:

- ordinary actions publish a `notice` message and take ownership;
- the migration lifecycle publishes a `migration` message with its generation;
- clearing the migration block succeeds only if the migration message still
  owns the footer and its generation is current;
- a later storage/read/transaction error or ordinary action takes ownership, so
  a late migration clear cannot erase it.

When a block disappears because the re-evaluated state is healthy, the migration
lifecycle replaces its own message with the verified outcome (“plan to review”
or “already reconciled, no migration needed”) or clears it. It never announces
“synchronisé” or a remote push; those claims remain exclusive to the diagnostic
and reconciliation status reducers with native proof. A genuine disconnect or
conflict re-renders a blocking state only after a new evaluation yields a
non-attested or blocked result.

### 6. Completion, reload and failure boundaries

- A successful local commit closes the panel, advances the lifecycle generation,
  refreshes the business read and reports `local-written`/`sync-pending` exactly
  as today. It never reports remote convergence from the IndexedDB commit.
- Reload re-reads the source and native signals. Dismissals survive because they
  are keyed metadata; consent never survives because it is in-memory only.
- A URL/account change produces a different dismissal key, closes or invalidates
  the old panel, and allows a fresh safe verification. No data is copied.
- A failed revalidation, read or commit leaves V1, the target and the existing
  recovery panels intact and clears or updates only the migration-owned footer
  message.

### 7. Tests stay deterministic and DOM-free

New tests exercise the pure review helper, dismissal key/store, offer decision,
generation guard and footer reducer. Focused additions to the existing
reconciliation tests cover a 5-subject / 18-step source into a populated target,
subject and sub-step conflicts, order changes, late collisions, divergent
source/target, quotas and repeated runs without duplicates. Static source
assertions verify that `app.js` passes the displayed plan, checks the generation,
does not use a fresh fingerprint as consent, does not delete the V1 key and does
not auto-commit.

## Risks / Trade-offs

- **Native observable churn causes repeated target reads** → generation guard,
  de-duplication by rendered state key and a single in-flight lifecycle request
  per generation.
- **Dismissal key false positives** → exact source fingerprint plus full
  destination and user scope; any byte or identity change reopens verification.
- **Consent reset on harmless sync metadata** → compare the business/operation
  fingerprint, not raw native metadata, before re-rendering.
- **Footer ownership regression** → keep the reducer tiny, test notice/error vs
  migration ordering and never clear another owner’s message.
- **Ordered-operation comparison adds coupling** → compare a canonical ordered
  projection supplied by the same pure planner; keep the existing fingerprint
  contract and add the comparison without changing the add-only transaction.
- **Real Cloud timing cannot be proven in CI** → keep manual Cloud/browser
  acceptance separate and do not claim it from Node tests.

## Migration Plan

No schema or storage migration is required. Deploy the new module, app wiring
and UI controls as a static change; the dismissal key starts absent and is
created only by an explicit refusal. Rolling back is safe: unknown dismissal
metadata is ignored, V1 remains untouched, and existing reconciliation plans and
exports keep working. `threadstep.document.v1` is neither deleted nor rewritten.
