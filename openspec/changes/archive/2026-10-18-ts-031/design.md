# Design

## Context

See `proposal.md` — Why. The applied code on `main` contains:

- `site/migration.js`: strict V1 detection, `legacy:` id mapping, a plan that
  only emits `put` operations, a global `populated`/`collision` block and a
  destination-only consent guard.
- `site/app.js`: the migration panel, a JSON import branch that blocks any
  non-empty Cloud target, a `nonOverwritingMigrationAdapter()` that maps `put`
  to `add`, and a single `businessStore.commit(operations)` Dexie transaction.
- `site/synced-records.js`: a fail-closed target read that rejects invalid or
  dangling records and strips native metadata to the business projection.
- `site/dexie-foundation.js`: explicit `id` primary keys (schema version 2),
  `@id`-free stores, Cloud URL validation and `requireAuth`.
- `site/persistence.js`/`site/core.js`: V1 limits (40 subjects, 500 items per
  subject), V1 projection, `parseDocument` and deterministic `documentToRecords`.

Native Dexie Cloud signals available to the page include
`db.cloud.syncState` (BehaviorSubject with `phase` and `status`),
`db.cloud.persistedSyncState` (BehaviorSubject with `initiallySynced`,
`serverRevision`, `remoteDbId`, `realms`, `timestamp`, revisions),
`db.cloud.currentUser`, `db.cloud.events.syncComplete` and the table-level
`db.initiallySynced` getter. The runner has no real IndexedDB, DOM, Cloud
session or network, so the decisive logic must be pure and injectable; a real
Chrome mobile/browser acceptance remains manual.

## Goals / Non-Goals

**Goals:**

- A fail-closed native attestation that must succeed before the target is read
  and again before the commit.
- A deterministic, side-effect-free inventory and partial reconciliation plan
  that is testable without Dexie, DOM or network.
- Explicit keep-Cloud/copy conflict resolutions with deterministic copy ids and
  idempotent reruns.
- A plan fingerprint and consent/revalidation contract enforced by the
  migration layer.
- One atomic add-only commit with truthful local/pending/synced/error status.
- An accessible, text-only preview and a shared engine for historical and JSON
  imports.
- Automated regression tests for every deterministic requirement.

**Non-Goals:**

- Replacing Dexie Cloud's synchronization protocol or inventing native signals.
- Overwriting Cloud records, automatic text resolution, purge, restore or
  cross-URL transfer.
- Buying a new dependency (`fake-indexeddb`, jsdom) or adding a browser test
  runner in this change.
- Making the OTP journey or factory changes.

## Decisions

### 1. A pure reconciliation core plus thin browser adapters

Add `site/migration-reconciliation.js` (name provisional but fixed by the
implementation task) for:

- business normalization and target validation;
- native attestation evaluation;
- inventory/classification;
- dependency-aware partial planning, order placement and quota checks;
- deterministic copy-id derivation and availability checks;
- canonical source/target/plan fingerprints and consent comparison;
- truthful status reduction;
- a pure view model for the accessible panel.

`site/app.js` keeps only DOM rendering, native subscriptions, the Dexie
transaction adapter and file/localStorage reads. Alternatives rejected: putting
classification and copy logic directly in `app.js` (not runner-testable) and
adding a browser/IndexedDB test dependency (new runtime risk, not needed to
prove the invariants).

### 2. Attestation is a conservative, injected predicate

`evaluateSyncAttestation({ online, user, syncState, persistedSyncState,
databaseUrl })` returns `{ attested, reason, identity }` and never throws into a
write path. It attests only when all hold:

- the device reports online;
- `user.isLoggedIn === true` and `user.userId` is a non-empty string;
- `syncState.phase === "in-sync"` and `syncState.status` is a healthy connected
  state (not `not-started`, `connecting`, `offline`, `disconnected` or `error`);
- `persistedSyncState` exists with `initiallySynced === true`;
- `persistedSyncState.remoteDbId` and `persistedSyncState.serverRevision` are
  present;
- `persistedSyncState.realms` includes the current `userId`;
- the configured `databaseUrl` is present and matches the active instance.

Anything else yields typed reasons such as `offline`, `unauthenticated`,
`initial-sync-pending`, `session-mismatch`, `sync-error`, `sync-offline`,
`indeterminate` or `read-error`. The planner and the UI treat every non-attested
reason as a write block. An empty IndexedDB state is never interpreted as an
empty Cloud base. The app subscribes to `syncState`, `persistedSyncState`,
`currentUser` and `syncComplete`, re-evaluates the attestation and only then
calls `readSyncedRecords`. A failed read becomes `read-error`, not an empty
target.

The exact healthy-status set is deliberately narrow and is the first item to
confirm on the isolated Cloud instance. If the native signal shape changes, the
predicate fails closed rather than guessing.

### 3. Business normalization uses an allowlist, not a metadata blacklist

Source records are projected with the existing `documentToRecords` and mapped
with the existing `legacy:` mapping. Target records come from
`readSyncedRecords`, which already drops native metadata.

The comparison projection is:

- subject: `{ id, title, order }`;
- item: `{ id, subjectId, parentId, title, priority, done, note? }`;
- `note` is omitted when absent, `null` or `undefined`; an empty string remains a
  business value;
- every other target field (`owner`, `realmId`, `$ts`, sync flags, unknown
  extensions) is ignored because it is not projected.

Indexes are built separately for `subjects` and `items`. A record in the other
store is never treated as the same record. Invalid target references, duplicate
mapped source ids, misplaced/malformed records and a non-attested state produce
`invalid`/`indeterminate`; planning then fails closed for the affected scope.

### 4. Relative order avoids false conflicts from Cloud-only records

V1 order is the array position. A populated target may contain Cloud-only
records between historical records, so absolute `order` values are not directly
comparable. For each subject (and for the subject list), the planner:

1. selects the records whose ids belong to the mapped source set;
2. sorts them by their target order;
3. compares that sequence with the source sequence (after removing source
   records absent from the target).

A real reversal is reported as an `order` conflict; Cloud-only interleaving is
not. For an inserted record, the planner places it between the nearest present
source neighbours using a midpoint order value (or `prev + 1` / `next - 1` at
the ends). Target reads are normalized to unique sequential orders by
`readSyncedRecords`, so a representable gap exists; if it does not, the branch
is blocked as invalid instead of guessing.

### 5. Dependency-aware partial planning

The unit of safety is the dependency branch, not the whole base. The planner
processes subjects in source order, then each subject's items in topological
order (parents before children, source order between siblings):

- An absent subject with no conflict plans a subject insertion; its absent
  items can be inserted when their parent chain is available.
- A subject conflict blocks its whole source branch unless the user chooses
  "copy"; choosing copy creates a new subject and copies the complete historical
  branch under it.
- An item conflict blocks that item and its descendants unless the user chooses
  "copy"; a copied item copies its dependent subtree and remaps the parent to the
  target parent or copy parent.
- An absent item whose parent is absent/planned, identical or copied can be
  inserted; an item whose parent is blocked stays blocked with a reason.
- Identical records produce no operation. Cloud-only records are never touched.
- Quotas are checked on the projected result: at most 40 subjects and 500 items
  per subject. An overflow blocks the responsible branch while independent
  branches remain planned.

No branch has a destructive default. An unresolved conflict is reported and
excluded from the operations; the user may still import the independent groups
after explicit confirmation.

### 6. Deterministic copy identity

A copy id is derived synchronously or through an injected digest from:

```
copy:<hex digest of { version, store, legacyId, sourceFingerprint, destinationFingerprint }>
```

The concrete prefix/length is capped to the existing id limit (100 characters)
and must be accepted by the explicit `id` schema. The same source document and
destination produce the same copy id; a different source or destination may
produce a different one. At planning time:

- id absent in the store → plan an `add`;
- id present with the same normalized business projection (including remapped
  parents) → treat the copy as already applied, no operation;
- id present with different content, or present in the wrong store with a
  conflicting role → block only that copy branch and explain the collision.

This makes a second run and a retry after a full commit idempotent without
creating a second copy.

### 7. Plan fingerprints and consent enforced below the UI

`fingerprint(kind, rawSource, destinationIdentity, userId, targetProjection,
resolutions)` uses a canonical JSON encoding and a SHA-256 digest (Web Crypto in
the browser, Node `crypto` in tests). If no digest is available the plan is
`indeterminate` and cannot be committed. The destination identity includes the
Cloud URL and `remoteDbId`; the user identity includes `userId`; the target
projection includes every normalized target record and the chosen resolutions.

`runReconciliation(adapter, plan, consent, revalidate)`:

1. rejects a missing/false consent or a consent fingerprint different from the
   plan;
2. re-evaluates the attestation;
3. re-reads the source and target through `revalidate(plan)` and recomputes the
   source fingerprint, destination/user identity, target projection and plan
   fingerprint;
4. returns `stale-plan` with no write at the first difference, including a
   changed source, URL, remote database, user/session, target record, conflict
   or lost sync availability;
5. calls `adapter.commit(operations)` once, only for a matching plan.

The UI may call the same function, but a stale or unconsented plan is rejected
by the migration layer itself, not only by a disabled button.

### 8. Atomic add-only commit and recovery

The browser adapter implements one Dexie `rw` transaction over `subjects` and
`items`. Every planned insertion uses `add` (never `put`); a collision with a
record created after revalidation rejects the transaction and rolls back the
whole commit. No partial group is written. The migration layer accepts only
`add` operations, verifies each operation's store and refuses a plan containing
`put`, `delete` or an unknown type.

A full commit followed by a reload is detected as already applied by the
deterministic copy ids and the inventory. A failed transaction leaves the target
and the V1/JSON source untouched and is reported as an error, never as success.

### 9. Truthful status reduction

A pure reducer tracks `idle`, `local-written`, `sync-pending`, `synced`,
`sync-error` and `offline-pending`. A successful commit produces at most
`local-written`/`sync-pending`; it never produces `synced`. Only a
`syncComplete` event received after the commit, combined with a healthy
attestation, may produce `synced`. A later sync error keeps the local success but
changes the synchronization label to `sync-error`. The UI presents a distinct
sentence per state and never says "poussé" or "synchronisé" on commit alone.

### 10. Accessible, text-only preview shared by historical and JSON imports

A pure `buildReconciliationView(plan)` returns counts per store/category, the
effective destination, conflict labels, differing field names, blocked-branch
reasons and option labels. `app.js` renders it with `document.createElement` and
`textContent` only:

- no `innerHTML`, template HTML or user string interpreted as markup;
- a labelled `section`, a heading receiving focus when the panel opens, an
  `aria-live` status for plan changes;
- one `fieldset`/`legend` per conflict with radio choices « Conserver Cloud » and
  « Importer comme copie », no destructive default checked; unresolved is
  described as ignored, not as an overwrite;
- `type="button"` controls with visible labels, keyboard-operable without
  pointer events, and 44 px minimum touch targets;
- a distinct confirmation control/button for the selected plan, not shared with
  OTP sign-in; the consent carries the plan fingerprint;
- no `console.*` call containing record ids, titles, notes, field values or
  source content. Only aggregate counts/reason codes may be logged, if at all.

The JSON branch builds the same source/plan from the selected file; the local
(non-Cloud) import path keeps its current confirmation and replacement behavior.
The historical source key and downloaded JSON files are never removed.

## Risks / Trade-offs

- **Native attestation semantics differ from the proposed combination** → fail
  closed with an explicit reason; verify `initiallySynced`, `serverRevision`,
  `remoteDbId`, `realms`, `phase` and `status` on an isolated Cloud instance
  before declaring acceptance.
- **Cloud-only records shift absolute order** → compare relative mapped order and
  compute midpoint insertion orders; test interleaving and reversals.
- **Copy explosion when a conflicting subject has many identical children** →
  copying the whole branch is explicit and branch-scoped; document it and let
  the user keep Cloud instead.
- **Single large transaction** → V1 limits cap the workload (40 subjects, 500
  items per subject); one transaction is preferable to partial groups.
- **Web Crypto unavailable or digest failure** → no plan/consent; fail closed.
- **Race between preview and transaction** → fresh revalidation plus `add`
  anti-overwrite; collision rolls back and asks for a new review.
- **Runner cannot prove real IndexedDB, mobile, touch, keyboard or network** →
  deterministic tests cover the decision layer only; the manual acceptance
  section and isolated Cloud recette remain mandatory.

## Migration Plan

1. Add the pure reconciliation module and its tests, including the 5-subject /
   18-step fixture, attestation reasons, metadata exclusion, order, dependency
   branches, copies, fingerprints and status.
2. Extend `site/synced-records.js` usage (not its fail-closed contract) to pass
   the attested target into the planner; keep the current read validation.
3. Replace the historical migration panel wiring with the accessible preview and
   pre-commit revalidation; route the Cloud JSON import through the same plan.
4. Add the atomic add-only adapter and the status reducer; keep the local import
   and V1/JSON recovery paths unchanged.
5. Update product developer/rollout documentation and `npm run check`.
6. Validate OpenSpec strictly, then run the manual isolated-Cloud acceptance
   separately. No data migration of existing records and no server-side change
   are required; rollback is reverting the code while keeping all V1/JSON
   sources and Cloud records intact.

## Open Questions

- Which exact native `syncState.status` strings should count as healthy beyond
  `in-sync`? Resolve against the isolated instance; until then only the narrow
  connected/in-sync combination is accepted.
- Is a prefixed SHA-256 copy id accepted by every Cloud schema/operator setup
  used by ThreadStep? Confirm before relying on the copy option in production.
- Should the preview show record titles or only ids/field names on shared
  screens? The spec forbids content in public logs but permits non-executable
  text in the UI; the visual wording can be decided during acceptance without
  changing the reconciliation logic.
