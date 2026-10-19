# Proposal

## Why

ThreadStep still exposes and reads the historical `localStorage` V1 business
document and, more importantly, the backups produced today from IndexedDB are
still serialized with the V1 `version: 1` envelope. The product decision of
18 October 2026 retires V1 backups and V1 business storage, but removing the V1
reader before a distinct, tested IndexedDB backup exists would leave users with
no trustworthy way to preserve their current workspace. This change delivers a
new portable backup contract first, then removes V1 business compatibility, in
a controlled and non-destructive order.

## What Changes

- **BREAKING** Add a portable, versioned IndexedDB backup format
  (`threadstep.indexeddb-backup`, format version 1) built from the committed
  `subjects` and `items` records. It preserves canonical IDs, hierarchy,
  order, notes, priorities and `done`, declares its provenance, counts and a
  checksum, and contains no Cloud configuration, account, OTP, token or
  secret.
- **BREAKING** Remove support for the historical V1 document and V1 backup
  files from the current import, restore and conversion paths. A `version: 1`
  document or a legacy `threadstep.document.v1` value is rejected explicitly,
  without any write, fallback parse, conversion or `legacy:` heuristic.
- Retire V1 detection, migration offers, historical warnings, legacy export
  buttons, dismissals and the residual V1 panels. The historical
  `threadstep.document.v1` key becomes inert until the user explicitly cleans
  it.
- Move business preferences and local metadata that reference subject/step IDs
  (notably the resume preference) into a versioned, non-synchronized
  IndexedDB metadata store. Migrate them idempotently from their old origin
  keys, without overwriting an already populated target and without exposing
  them to Dexie Cloud.
- Offer a voluntary, explicitly consented cleanup of the listed retired V1
  keys. The default is "delete nothing"; cleanup is scoped to the current
  origin and browser, requires a verified modern backup, and never touches
  IndexedDB, Cloud data, other browsers or remote records.
- Keep native Dexie Cloud diagnostics, raw recovery export for inconsistent
  workspaces and anti-loss protections. Adapt tests, product documentation and
  canonical OpenSpec capabilities through deltas, without modifying archived
  changes.

## Capabilities

### New Capabilities

None. The change modifies the existing backup, migration, persistence and
product-profile capabilities instead of creating a near-duplicate capability.

### Modified Capabilities

- `data-backup-import-restore`: the portable export becomes a distinct
  IndexedDB format; V1 files are rejected; import, reimport, collision and
  restore scenarios are redefined around records and checksums.
- `legacy-storage-migration`: historical detection/conversion is retired and
  replaced by inert legacy values, verified preference migration and voluntary
  scoped cleanup.
- `threadstep-integration-profile`: the product no longer converts, exports or
  restores historical V1 documents; it uses the modern backup and keeps native
  Cloud diagnostics.
- `local-first-business-persistence`: V1 document import/export and the V1
  compatibility guard are replaced by modern record backups, and preferences
  move to IndexedDB local metadata.
- `local-indexeddb-persistence`: recoverable data uses the modern backup and a
  versioned non-synchronized metadata store is introduced.
- `resume-tracking`: the tracked preference is persisted in IndexedDB local
  metadata and no longer depends on `threadstep.resume.v1`.
- `data-integrity-recovery`: the raw recovery export remains, but it is
  distinguished from the modern business backup and no longer keeps a legacy
  V1 export path.
- `cloud-sync-lifecycle`: the historical migration panel is removed while the
  native diagnostic and footer state ordering are preserved.
- `cloud-opt-in-activation`: a retained historical key is inert and is never a
  migration order; it is neither exported nor used to propose an import.

## Impact

- Runtime modules: `site/app.js`, `site/core.js`, `site/persistence.js`,
  `site/dexie-foundation.js`, `site/data-integrity-recovery.js`,
  `site/migration.js`, `site/local-migration.js`,
  `site/migration-lifecycle.js`, `site/local-recovery.js`, and the Cloud
  reconciliation/activation paths that consume imported documents.
- Persistence: new IndexedDB backup parser/serializer and a non-synchronized
  `meta` store in the local schema, with an explicit Dexie schema version.
- UI: removal of V1 notices/panels/actions; new backup verification and
  cleanup controls; import/restore error messages for unsupported V1 files.
- Tests: legacy-migration, local-migration, local-persistence,
  migration-reconciliation, ts-035/ts-036/ts-037 and static source assertions
  must be replaced or adapted. New deterministic tests cover the modern
  format, rejection without write, idempotence, collisions, stale plans,
  metadata migration and cleanup scoping.
- Documentation and canonical specs: `docs/product/developer-guide.md`,
  `docs/product/guide-utilisation.md`, `docs/product/mvp.md`,
  `docs/product/acceptance-checklist.md` and
  `docs/product/specs/dexie-data-lifecycle-target-v1.md`; canonical specs are
  updated by OPSX sync from the deltas. Archived changes are not modified.

## Uncertainties

- **Release sequencing of the transition.** The backlog requires the previous
  deployed version to be able to generate and verify the new backup before V1
  support disappears, and the transition warning to appear before the removal
  is deployed. A single OpenSpec change normally produces one merged delivery.
  If the owner requires a separately deployed intermediate version, TS-040
  must be delivered in two authorized stages (modern format + warning first,
  V1 removal second) or split into two changes. This plan implements the final
  target and a visible transition notice for users who still hold legacy keys;
  it does not invent a permanent compatibility flag. The owner decision is
  required before merge if the two-stage rollout is mandatory.
- **Legacy key inventory.** The plan treats
  `threadstep.document.v1`, `threadstep.migration.v1`,
  `threadstep.resume.v1` and `threadstep.migration.dismissals.v1` as the
  retired business/metadata keys. Purely technical Dexie Cloud settings
  (`threadstep.cloud.config.v1`, activation markers and workspace registry)
  are explicitly outside the cleanup list.
- **Existing V1 backups outside ThreadStep.** Historical files already
  downloaded by users are never touched by the application. After the removal
  they are refused; the plan does not add a manual recovery path for them.
