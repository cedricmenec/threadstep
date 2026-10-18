# Design

## Context

See `proposal.md` — Why. The delivered code already separates the autonomous
`threadstep-local` database from the synchronized `threadstep` database with
Dexie Cloud's native name suffix (`site/dexie-foundation.js`). TS-032 opens the
local database without the Cloud addon; TS-033 converts a historical V1 document
explicitly; TS-034 exposes native session/connection/pull evidence; TS-036 binds
reconciliation consent to the displayed plan and refuses stale plans.

Today a saved URL immediately calls `bootstrapSyncedDatabase()`, configures
`db.cloud` and gates the business view behind OTP. That is safe for the
*physical* isolation of local records but is not an activation journey: there is
no explicit target discovery/classification, no activation-specific preview of
`threadstep-local`, no cancellation that returns to the local workspace and no
first-sync outcome distinct from the reconciliation commit. `db.cloud.login()`
also calls the native `sync()` before authentication, so the design must never
place historical local records into the synchronized database in anticipation of
consent.

The runner has no DOM, IndexedDB, Cloud session or network. Activation rules
must therefore stay in pure, injectable modules as with TS-031, TS-034 and
TS-036; browser and real-Cloud acceptance stays manual.

## Goals / Non-Goals

**Goals:**

- Make activation a staged, cancellable, reload-safe journey over two physically
  distinct databases.
- Reuse the existing attested target read, business inventory, add-only plan,
  fingerprint review and quota/relations rules for the local IndexedDB source.
- Preserve the local source and historical V1 backup through every outcome.
- Prove with deterministic tests that configuration, OTP and first pull cannot
  push historical records, and that a local commit is not reported as a push.
- Keep existing Cloud users (configuration already present, no activation
  marker) working without a migration prompt.

**Non-Goals:**

- A new synchronization or authentication protocol, server changes, account
  audit APIs, or per-record server acknowledgements that Dexie Cloud does not
  expose.
- Copying data between accounts/URLs, deleting local data, or rewriting V1.
- Replacing the historical migration offer or the local-only JSON import.
- Browser automation, real OTP/mobile/touch/screen-reader acceptance or paid
  model execution.

## Decisions

### 1. Activation is a state machine over a non-synced activation record

Add a pure module (working name `site/cloud-activation.js`) with an explicit
stage model:

`local → preparing → connecting → discovering → review → transfer-pending →
active`, plus `failed` (recoverable, with the last reached stage) and `cancelled`
before consent.

Store a small origin-local record under a non-synchronized key such as
`threadstep.cloud.activation.v1`:

```
{ version: 1, status: "activating" | "cancelled" | "active",
  url, remoteDbId?, sourceFingerprint?, userDigest? }
```

It contains no title, note, email, OTP, token, raw user id or business record.
It exists to decide whether startup should open the local workspace or the
synchronized workspace and to resume after reload. A missing marker with an
existing Cloud configuration is treated as a legacy already-active workspace,
so current users are not sent back through activation. Any new URL submitted
through the assistant writes `activating`.

Alternative rejected: treating the presence of the URL alone as activation
again. That made cancellation indistinguishable from an active Cloud workspace
after reload.

### 2. Discovery uses the synchronized database; the source stays local

After a valid URL, the app opens the synchronized database only for native
configuration, OTP, first pull and target discovery. It never reads the source
records from that database. The source snapshot is read from `threadstep-local`
in a read-only transaction and projected with the existing
`recordsToDocument()` shape using explicit `indexeddb-export` provenance, so
identifiers and relations are not remapped or prefixed a second time.

The UI can keep the local workspace visible while the assistant is in
`preparing`/`connecting`; once discovery starts it presents remote inventory
separately from the preserved local source. Before consent, business mutations
are not written into the synchronized database by the activation path. The
activation commit is the only bridge from the local source to the synchronized
tables.

Alternative rejected: staging historical records in the synchronized database
temporarily. Dexie Cloud may synchronize them eagerly; an `unsyncedTables`
list would also make them unavailable to the final transfer and is weaker than a
physical database boundary.

### 3. Target discovery and classification are fail-closed

Reuse `evaluateSyncAttestation()`, `withAttestedTarget()` and
`readSyncedRecords()` from the existing reconciliation layer. Add a pure
classifier returning one of:

- `verified-empty` — attestation is valid with a known initial pull/revision and
  the target inventory is empty;
- `populated` — attestation is valid and the target has records compatible with
  the source;
- `divergent` — attestation is valid but the inventory contains conflicts,
  blocked dependent groups or ambiguous records;
- `unavailable` — offline, read error, sync error or missing native evidence;
- `identity-mismatch` — URL, `remoteDbId`, user or available realms contradict
  the expected destination, including a changed activation record.

`verified-empty` still requires consent. `unavailable`/`identity-mismatch` never
become an empty target and never render a transfer action. The classifier does
not invent a server ownership API: it fails closed on missing or contradictory
native signals.

### 4. Transfer reuses attested, plan-bound reconciliation

The activation preview builds a normal `planReconciliation()` with:

- source: the normalized `threadstep-local` records projected as a document;
- target: the freshly read, attested synchronized records;
- destination: normalized URL plus available `remoteDbId`;
- user: authenticated `userId`;
- provenance: explicit `indexeddb-export`.

The UI displays destination, counts, `add` operations, conflicts and blocked
groups, with the existing `buildReconciliationView()` semantics. Consent is the
existing plan fingerprint; `reviewDisplayedPlan()` and `runReconciliation()`
re-read the source and target, compare ordered operations and refuse a stale
plan before calling the adapter once. The adapter accepts only `add` operations
into the synchronized Dexie store.

This preserves the TS-036 guarantees and the TS-035/TS-036 quotas, stable IDs,
conflict choices and idempotent copies without duplicating the reconciliation
engine.

Alternative rejected: a second importer for local records. It would drift from
the tested reconciliation rules and could weaken the anti-overwrite contract.

### 5. Cancellation before consent is non-destructive; after commit it is truthful

`cancelActivation()` before a transfer commit:

- writes `status: "cancelled"` to the activation record;
- closes or stops using the synchronized database for the current UI;
- returns to the local workspace and keeps the URL for a later explicit resume;
- performs no write to the target and no local purge.

After a transfer commit, cancelling does not pretend to undo the synchronized
local copy. The UI changes to `transfer-pending` and explains that the source and
the synchronized local copy remain, while remote completion is still unproven.
A compensating remote rollback would be a destructive new product capability and
is not introduced.

### 6. First-sync completion is a separate reducer from the local commit

Extend the activation state with a synchronization sub-state:

`idle → local-written → pending → remote-complete | error | indeterminate`

- `local-written` is set only after the IndexedDB transfer transaction succeeds;
- `pending` while native `syncState` reports `pulling`/`pushing` or no proof yet;
- `remote-complete` only when the session is authorized, the initial pull is
  attested, `persistedSyncState.initiallySynced === true` with a server revision,
  and the native phase is `in-sync` without a current error;
- `error` when the native state reports an error after the commit;
- unknown or contradictory signals stay `indeterminate`.

The reducer never converts `in-sync` into a claim that every record reached the
server; it reports the first synchronization as attested on this device. A later
error preserves the local-written evidence. This is the same conservative
evidence policy as `site/sync-diagnostics.js` and the TS-035 convergence rules.

### 7. Reload and changes revalidate; stale results cannot win

On startup:

- `cancelled` or no activation record → local workspace;
- `activating` → open synchronized database, restore the native session, replay
  discovery, and show resume/pending status; never restore an old consent;
- `active` → normal synchronized workspace;
- a changed URL, `remoteDbId`, user digest or source fingerprint invalidates the
  old plan and any completion label.

A monotonic generation guard is used for asynchronous discovery/plan results, as
in TS-036. The newest started evaluation wins; a late result from an older URL,
session or source is discarded. Reconciliation itself revalidates identity and
ordered operations at commit time.

### 8. Existing flows remain compatible

The historical V1 offer, local conversion, JSON import/restore, diagnostic,
logout and local recovery panels keep their existing behavior. Activation shows
the local source but does not mark `threadstep.document.v1` as migrated or
deleted. The existing Cloud configuration form becomes the URL step of the
assistant for new activations; a small “activate/continue/resume” entry point
keeps the local workspace usable. Legacy configurations without the marker keep
the current synchronized startup.

## Risks / Trade-offs

- **Native `login()` syncs before authentication** → local records never enter
  the synchronized database before the explicit activation commit; tests model
  configure/OTP/pull and assert an empty synchronized source before consent.
- **Two databases and two stores can confuse the UI** → label the autonomous
  source and synchronized target explicitly, keep source recovery/export
  available, and never merge their inventories implicitly.
- **Cancellation after commit cannot be undone safely** → state the truth
  (`transfer-pending`) and do not offer an implicit remote rollback.
- **Native observables churn during discovery** → generation guard plus
  de-duplication by destination/source/plan fingerprint; no debounce is required
  for correctness.
- **`in-sync` is not per-record proof** → keep `remote-complete` tied to the
  attested initial sync and never claim per-record server acknowledgement.
- **Legacy users may lack an activation marker** → treat an existing
  configuration without a marker as already active; only new activations write
  the marker, avoiding a forced re-onboarding.
- **Real Cloud timing, permissions and mobile behavior cannot be proven on the
  runner** → keep deterministic tests for rules and defer real-browser/Cloud
  acceptance to the manual section.

## Migration Plan

No Dexie schema or synchronization protocol migration is required. Deploy the
pure module, app wiring and accessible UI as a static change. New activations
write the non-synced marker; absent markers keep the legacy behavior. Cancelling
or rolling back the app leaves the URL, local database, synchronized cache and
V1 backup untouched; unknown activation markers are ignored safely. Existing
users can continue to start in the synchronized workspace.

## Open Questions

None that change the specs, approach or task breakdown. Final French labels,
the visual placement of the activation entry point and any optional debounce are
deferred to product/manual acceptance within the constraints above.
