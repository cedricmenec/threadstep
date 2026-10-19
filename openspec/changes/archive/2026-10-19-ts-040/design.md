# Design

## Context

See `proposal.md` - Why. The current runtime has three coupled legacy paths:
`site/core.js#parseDocument` reads the V1 document shape,
`site/data-integrity-recovery.js#buildBusinessExport` writes a `version: 1`
document from IndexedDB records, and `site/local-migration.js` /
`site/migration-lifecycle.js` / `site/app.js` detect, offer and convert the
`threadstep.document.v1` key. The resume preference and migration metadata are
still in `localStorage`. The local and synchronized Dexie schemas currently
share version 2 with `subjects`/`items` only.

## Goals / Non-Goals

**Goals:**

- Define one explicit modern backup contract with its own format identifier,
  validation and provenance, independent of V1.
- Make import, local merge, Cloud reconciliation and restore consume records
  from that contract, with the existing non-destructive/idempotent safety.
- Remove every user-facing V1 reader, offer and legacy export while leaving the
  stored key physically untouched until a consented cleanup.
- Move resume/local metadata to a versioned non-synchronized IndexedDB store
  with an idempotent migration from the old origin key.
- Provide a deterministic, origin-scoped cleanup that is opt-in and refuses to
  run without a verified modern backup.

**Non-Goals:**

- Preserving, converting or recovering V1 documents or V1 backups.
- Deleting IndexedDB databases, Cloud records, other browsers' data or remote
  accounts.
- Replacing Dexie Cloud, native OTP or the reconciliation engine.
- Changing business rules, hierarchy, ordering, notes or quotas.

## Decisions

### 1. Modern backup format

Use a new self-describing document:

```json
{
  "format": "threadstep.indexeddb-backup",
  "formatVersion": 1,
  "provenance": {
    "source": "indexeddb",
    "idsCanonical": true,
    "mappingVersion": 2,
    "schemaVersion": 3
  },
  "counts": { "subjects": 5, "items": 19 },
  "records": {
    "subjects": [{ "id": "legacy:s1", "title": "Sujet", "order": 0 }],
    "items": [{ "id": "legacy:i1", "subjectId": "legacy:s1", "parentId": null,
                "title": "Étape", "priority": "normal", "done": false,
                "order": 0, "note": "…" }]
  },
  "checksum": "<sha256 of canonical records>"
}
```

Rationale:

- `format` + `formatVersion` never resembles the V1 `version: 1` envelope, so
  the rejection gate is unambiguous.
- Records are exported directly from committed IndexedDB rows. This removes
  the `recordsToDocument`/V1 projection from the backup path and preserves
  canonical IDs, including IDs that literally start with `legacy:`.
- The format is identical in local-only, offline, connected and
  post-instance-change modes. It contains no URL, account, remote database id,
  OTP, token or technical configuration.
- `counts` and `checksum` are verified before any plan is built; an incomplete
  or truncated file cannot be presented as a valid backup.

Alternative considered: add `version: 2` beside the V1 parser. Rejected because
it keeps the V1 shape and invites accidental acceptance of old files.

### 2. One strict parser and no fallback

Introduce a pure parser (for example `parseIndexedDbBackup`) that validates
format, version, record fields, unique IDs, parent/subject references, quotas,
counts and checksum. Import and restore call only this parser. A file that has
`version: 1`, lacks the modern `format`, has an unknown format/version or fails
the checksum returns a stable error code (`unsupported-v1-backup`,
`unknown-format`, `invalid-backup`, `count-mismatch`, `checksum-mismatch`) and
performs no read-plan write and no mapping. No `legacy:`/no-prefix heuristic is
used to guess provenance.

`parseDocument` may remain as an internal invariant helper for
`recordsToDocument`/`normalizedRecords`, but no user-supplied file path may call
it. Tests assert that import, restore, local merge and Cloud import reject V1
without writing.

### 3. Import, merge, restore and Cloud use records

The modern backup exposes record arrays; import paths use them directly:

- Local merge reuses the existing collision classifier: matching IDs and
  identical fields produce no operation, missing IDs produce inserts, a
  different existing record is a collision that blocks the whole plan.
- Reimport of the same file produces zero operations. Canonical IDs are never
  prefixed or rewritten.
- Cloud import feeds the same records into the existing reconciliation planner,
  preserving Cloud-only rows, realms and rights.
- Restore remains a distinct, reinforced intention: preview the added/removed
  scope, require a verified backup of the current state (modern business
  backup, or the distinct raw recovery export when the projection is
  inconsistent), and reject a stale plan whose source/target fingerprint
  changed.
- A pre-confirmation re-read recomputes the plan; consent is bound to its
  fingerprint (TS-035/TS-036 behavior).

The existing `data-integrity-recovery` gate still disables the normal business
export when a blocking anomaly prevents a faithful projection and directs the
user to the raw recovery export, which remains unchanged and distinct.

### 4. Local metadata store

Add a string-keyed `meta` store to both Dexie schemas and bump
`SCHEMA_VERSION` explicitly. With Dexie Cloud configured, declare
`unsyncedTables: ["meta"]` via `cloudConfigureOptions`, so no metadata is
replicated. The autonomous database has no addon. Records are non-business
documents such as:

- `resume`: `{ key: "resume", version: 1, subjectId, itemId }`
- `preferencesMigration`: `{ key: "preferencesMigration", version: 1,
  status: "complete", sourceKey, sourceFingerprint }`

Do not put titles, notes, emails, tokens or business content in `meta`.

Migration algorithm for `threadstep.resume.v1`:

1. Read the meta record first. If valid, it is authoritative.
2. If absent, read and validate the legacy key.
3. Write meta inside one transaction. If the target key appeared meanwhile,
   keep the existing value and report a duplicate/conflict instead of
   overwriting.
4. Mark the versioned migration complete only after a successful write. On
   write failure or crash, keep the legacy value and retry later; never clear
   it automatically.
5. After a verified completion, stop reading the legacy key. Before completion,
   the legacy key is read-only fallback, never written.

The meta store lives in each workspace's own database, so preferences are
scoped to the workspace/account/URL that owns that database. The autonomous
`threadstep-local` database migrates the origin-global legacy preference; a
synchronized workspace migrates only when the referenced subject and item
exist in its own records.

### 5. Retiring V1 runtime

Remove from the runtime:

- `detectHistoricalDocument`, `availableLocalBackup`, `detectLocalSource`,
  local/Cloud migration offers, dismissals, historical panels, legacy export
  buttons, `historicalGuard`, `compatibilityGuard` and the `storage` event
  branch that reacts to `STORAGE_KEY`.
- The V1 readers in import/restore and the `recordsToDocument` envelope in
  `buildBusinessExport`; replace the latter with the modern serializer.
- Tests and documentation that assert the old V1 flow.

The only remaining reference to the retired keys is the cleanup inventory. It
reads raw key names/values only to count them and display an inventory; it must
not parse them into business records, write derived data or trigger network
activity. Referencing a legacy key value must never construct or configure a
Cloud instance.

### 6. Voluntary cleanup

Expose a cleanup panel only when at least one retired key exists. It:

- lists the exact keys and current-origin scope;
- defaults to "ne rien effacer";
- requires an explicit confirmation and a current-session modern export whose
  checksum/counts were verified;
- requires the local metadata migration to be complete;
- deletes only the listed keys with `removeItem`, one by one, and never calls
  `localStorage.clear()`, `indexedDB.deleteDatabase()` or a Cloud API;
- on cancellation, error or partial removal, leaves remaining values intact and
  reports what was and was not removed;
- never runs at deployment, startup, login, synchronization, conversion or
  reload.

If the modern backup was not verified in the current session, the cleanup
action stays disabled with an explanation.

## Risks / Trade-offs

- **Irreversible loss of unsupported V1 files** → require the intermediate
  modern-export/warning stage when the owner mandates it; the final UI states
  clearly that V1 files are no longer accepted and never deletes external
  files.
- **Users forget to regenerate before the removal** → the transition notice is
  visible while legacy keys exist and the manual acceptance verifies the
  modern backup before cleanup. This risk cannot be eliminated by code alone
  if a single release is chosen.
- **Metadata lost on crash or blocked storage** → idempotent migration, no
  overwrite of an existing target, legacy key kept until a verified write, and
  explicit error status.
- **`meta` accidentally synchronized** → `unsyncedTables` declaration plus a
  deterministic schema/configuration test; no business content is written to
  `meta`.
- **Stale plans or collisions after preview** → source/target fingerprints and
  a pre-commit re-read; collision blocks without overwrite.
- **Old tests encode V1 behavior** → adapt or replace them and add static
  assertions that user-facing paths no longer reference the V1 reader/offer.

## Migration Plan

1. Implement and test the modern serializer/parser, import/merge/restore and
   Cloud reconciliation integration while the existing data remains untouched.
2. Add the `meta` store, explicit schema upgrade and idempotent preference
   migration.
3. Add the transition notice and, when applicable in the rollout chosen by the
   owner, keep the V1 reader only for that intermediate delivery so users can
   regenerate a modern backup.
4. Remove the V1 reader/offer/panels/export and make unsupported files fail
   closed without writes.
5. Add the voluntary cleanup, then update tests and documentation.
6. Rollback: a release without these changes still opens the same Dexie
   schemas; the added `meta` store is ignorable. No automatic deletion occurs,
   so old keys and IndexedDB remain recoverable. The modern backup format is
   versioned for forward compatibility.

## Open Questions

None for the technical implementation. The cross-release sequencing decision is
recorded in `proposal.md` - Uncertainties and requires an owner decision before
merge if a separately deployed intermediate version is mandatory.
