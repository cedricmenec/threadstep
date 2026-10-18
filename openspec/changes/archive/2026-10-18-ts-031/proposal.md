# Proposal

## Why

On Chrome mobile, after OTP sign-in, a historical migration can report
« La base cible contient déjà des données » and « Un identifiant existe déjà
avec un contenu différent », which globally disables migration even though the
declared incident concerns only 5 subjects and 18 steps. Local and Cloud data
may already have diverged after earlier attempts, and the first remote
synchronization is not attested. Users currently have no reliable way to tell
whether Cloud was actually read, to reconcile a populated base without
overwriting or duplicating, or to know whether data is only local or truly
synchronized.

TS-031 turns the all-or-nothing prompt into a verifiable, consent-bound
reconciliation: wait for a proven initial remote sync, classify business
differences per store, insert only independent missing branches, resolve real
conflicts by keeping Cloud or importing a deterministic copy, and revalidate
everything immediately before an atomic add-only commit.

## What Changes

- Gate migration planning on a native Dexie Cloud initial-sync attestation.
  Offline, pending initial sync, refused session, indeterminate remote state or
  IndexedDB read error block writes and can never be interpreted as an empty
  Cloud base. The target is read only after the attestation succeeds.
- Build an explicit inventory by store (`subjects`, `items`) and mapped legacy
  id. Compare only business fields (identity, title, note, priority, `done`,
  order, subject and parent relations) while ignoring native Cloud metadata such
  as `owner`, `realmId` and `$ts`. Classify identical, absent in Cloud, business
  conflict, Cloud-only and invalid/indeterminate.
- Present subject/item counts per category, the effective destination,
  conflicting records and differing field names in an accessible preview. Titles
  and notes stay non-executable text, public logs expose no business content, and
  a confirmation distinct from the OTP sign-in is required before any transfer.
- Reconcile a populated target partially: after confirmation, insert only
  records that are genuinely absent and independent. Never rewrite identical
  records or Cloud-only records. Preserve relation integrity and the 40-subject /
  500-item-per-subject quotas; block only branches that depend on an unresolved
  conflict.
- Offer, for every divergence, at least « conserver la version Cloud » or
  « importer la version historique comme copie ». No destructive `put` or
  overwrite. Copies receive new deterministic ids for the same source and
  destination, are checked for availability, remap descendants and parents, and
  are idempotent across reruns. Keeping Cloud never deletes the V1 source and no
  destructive choice is preselected.
- Bind every plan to a fingerprint of the V1/JSON source, the Cloud URL, the
  session/user and a target projection. Revalidate them, the sync availability
  and the conflicts immediately before commit; any change invalidates consent
  and requires a new review. The migration layer, not only the UI, rejects stale
  or unconsented plans.
- Commit with one atomic IndexedDB transaction using `add` insertions and
  anti-overwrite checks. No partially applied group survives a transaction
  failure, and reruns, retries and reloads stay idempotent.
- Report only evidenced status: written locally, synchronization pending,
  synchronized or error. A local IndexedDB commit never claims a remote push.
  Keep `threadstep.document.v1` and historical JSON exports fully recoverable
  before and after any attempt; add no purge, implicit deletion or cross-URL
  copy.
- Reuse the same plan, protections and explicit confirmation for JSON backups
  imported through the Cloud UI. The local-only JSON import path is unchanged.

## Capabilities

### New Capabilities

- `cloud-migration-reconciliation`: attested initial Cloud synchronization,
  business-field inventory and classification, accessible consent preview,
  partial non-overwriting reconciliation, keep-Cloud/copy conflict resolution,
  plan-bound consent, atomic add-only commit, truthful synchronization status and
  JSON-import reuse for an existing authenticated Dexie Cloud base.

### Modified Capabilities

- `legacy-document-migration`: the populated-target requirement changes from a
  global block to an explicit partial reconciliation plan that preserves
  existing records and may insert independent absent groups; the existing
  source-retention, idempotence, consent and no-cross-base guarantees remain.

## Impact

- `site/`: a new pure reconciliation module (normalization, attestation,
  inventory, partial planning, copies, fingerprint, consent revalidation and
  status reducer) plus the historical/JSON-import wiring and the accessible
  reconciliation panel in `app.js`. Existing `migration.js` detection and id
  mapping are reused; `synced-records.js` remains the fail-closed read boundary.
- `docs/product/developer-guide.md` and the Dexie Cloud rollout notes: describe
  the attested preflight, partial reconciliation, copy semantics and truthful
  status.
- `tests/`: deterministic Node tests over pure modules and injectable adapters,
  plus static assertions over rendered DOM construction and absence of
  destructive writes or business-content logging.
- `package.json`: extend `node --check` coverage for the new module. No new
  runtime dependency, secret or protected factory file is touched.

## Non-goals

- Purging or rewriting `threadstep.document.v1`, deleting JSON backups, or any
  administrative restore.
- Overwriting Cloud records, automatically resolving diverging text, or choosing
  a destructive conflict option by default.
- Changing Dexie Cloud instance identifiers, adding a new authentication method,
  or modifying the ASF factory, workflows, secrets or backlog from this change.
- Running a paid model or claiming a real Cloud/browser acceptance from Node
  tests.

## Uncertainties (no product decision invented)

1. **Attestation signal combination.** The native `syncState` and
   `persistedSyncState` fields that prove a completed initial sync are proposed
   conservatively (`initiallySynced`, `serverRevision`, `remoteDbId`, realm,
   `in-sync` phase, connected status). Their exact runtime semantics, including
   legacy persisted states, must be verified on an isolated Cloud instance; an
   absent or ambiguous signal fails closed.
2. **Copy identifier format.** The change requires deterministic, available copy
   ids but does not prescribe a wire format. The design proposes a prefixed
   SHA-256 derivation compatible with the current explicit `id` primary key;
   Dexie Cloud schema/operator confirmation remains necessary.
3. **Order comparison.** V1 order is array position, while a populated target
   may contain Cloud-only records between source records. The design compares
   relative order of the mapped source records and computes insertion positions;
   this interpretation must be confirmed during real-device acceptance.
4. **Conflict branch scope.** The design copies a conflicting subject or step
   together with its dependent descendants so the historical version remains
   coherent. Whether a copied subject should also duplicate identical children is
   a product presentation choice to confirm before implementation.
5. **Consent surface.** The exact panel layout, radio/checkbox wording and focus
   choreography are not fixed; the plan commits to an explicit, testable consent
   step distinct from OTP and to accessible controls.
