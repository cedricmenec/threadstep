# Proposal

## Why

The confirmed 18 October 2026 incident shows a laptop with 5 subjects and 19
tasks, where the 19th task is an orphan because its `subjectId` does not match
any visible subject. The same Cloud base also contains both `legacy:s1` and
`legacy:legacy:s1` variants for the same logical subject. The Cloud mapping path
currently calls `mapSourceDocument(document)` and then `mapRecords(...)` without
the idempotence option used by the local conversion, so an already projected
export is prefixed again. Independently, the strict business read rejects the
whole workspace when one reference is dangling, hiding all five valid subjects.

TS-035 fixes the recurring double-prefix at every import boundary, adds a
read-only diagnosis and faithful raw recovery export for already corrupted
workspaces, and introduces a conservative, previewable and consent-bound repair
plan. It must not guess identities from titles or from the `legacy:` suffix, and
it must never purge, mass-rename or overwrite personal data.

## What Changes

- Make identity mapping provenance-aware across the Cloud migration, JSON import,
  restoration, re-imported exports and local conversion. A document explicitly
  identified as raw V1, as an IndexedDB export or as already projected keeps its
  canonical identities and relations; an unmarked source is blocked for explicit
  provenance review instead of being inferred from its prefixes or titles.
- Reproduce the defect through the same mapping call used by the Cloud UI and
  prove that importing a projected export never creates `legacy:legacy:`, that a
  second import creates no duplicate, and that `subjectId`/`parentId` survive.
- Add a read-only integrity inventory over `subjects` and `items` that reports
  counts and stable codes for missing references, prefix variants, logical
  duplicates, identity collisions, parent inconsistencies and content conflicts.
  A reference that may be hidden by permissions is reported as invisible or
  unauthorized, never as a deleted subject.
- Distinguish four failure families: IndexedDB unavailable, IndexedDB read
  refused, business projection invalid and record not visible/unauthorized.
  None of them may become an empty workspace, an empty Cloud base or a confirmed
  synchronization.
- Provide a read-only degraded consultation mode that keeps valid subjects
  readable while listing every anomaly, without silently ignoring it and without
  automatic repair.
- Provide a raw recovery export of all accessible records, including orphans and
  recovery-relevant metadata, distinct from the V1 business export. While an
  anomaly exists, the normal V1 export is disabled with an explanation (or
  explicitly marked incomplete). An in-memory `lastRecords` snapshot is never
  presented as a complete backup.
- Produce a previewable repair plan with source(s), target, destination/account,
  ID variant, proposed subject/task mapping, `subjectId`/`parentId` changes,
  preserved content, ambiguous or blocked groups, before/after counts and a plan
  fingerprint. Attachment to an existing subject requires proven identity and an
  explicit choice, never title similarity or prefix stripping alone.
- Require a verifiable recovery backup and consent bound to the displayed plan
  and destination before mutation. Revalidate source, target, session,
  permissions, `remoteDbId` and fingerprint immediately before writing. Apply
  only targeted reference repairs atomically, preserve divergent records, block
  ambiguous collisions and remain idempotent and recoverable after interruption
  or reload.
- Separate backup, import/merge and restore intentions, recognizing V1 sources,
  IndexedDB exports, historical `legacy:legacy:` exports, partially populated
  targets, rights/realms and Cloud-only records. A destructive restore is never
  an implicit effect of an import.
- Report copy, repair, ambiguity and rejection outcomes through stable codes
  without exposing titles, notes, emails, OTPs or tokens in events or logs.
- Keep convergence truthful: a local IndexedDB commit, an `in-sync` signal or a
  single browser transaction never proves that the repair reached the server or
  another device. Cross-device convergence remains a separate, real-instance
  acceptance.

## Capabilities

### New Capabilities

- `data-integrity-recovery`: read-only integrity inventory, distinct read-failure
  categories, degraded read-only consultation and raw recovery export for an
  inconsistent workspace, without automatic mutation or data-loss inference.

### Modified Capabilities

- `data-backup-import-restore`: source-provenance recognition, idempotent
  re-import across paths, raw recovery export distinct from V1, explicit
  incomplete-export handling, and separated import/merge/restore intentions.
- `data-reconciliation`: provable-identity repair planning, recovery-backup and
  destination-bound consent, and non-destructive idempotent reference repair
  alongside the existing reconciliation guarantees.
- `legacy-storage-migration`: shared provenance-aware mapping so local conversion
  and Cloud import preserve already canonical IDs and never infer identity from
  the `legacy:` suffix alone.
- `cloud-migration-reconciliation`: the Cloud JSON/historical path uses the same
  canonical mapping as the local conversion and rejects ambiguous provenance.
- `workspace-identity-isolation`: permission/realm invisibility is distinct from
  deletion, recovery diagnostics carry instance context, and repair consent is
  bound to the account and remote base.
- `threadstep-integration-profile`: ThreadStep-specific provenance formats, the
  5-subject/19-task orphan regression, raw recovery export and V1 export gating.
- `cloud-sync-lifecycle`: repair convergence is reported only from native
  evidence plus a successful business re-read, never from a local commit or a
  generic `in-sync` alone.

## Impact

- `site/migration.js`: shared provenance classification and canonical identity
  mapping used by local conversion, Cloud planning and re-import.
- `site/migration-reconciliation.js`: source provenance input, ambiguity
  blocking, repair plan model, evidence checks and revalidation.
- `site/local-migration.js`: local conversion uses the same provenance policy and
  reports ambiguous prefixed sources instead of silently deciding.
- `site/synced-records.js`, `site/persistence.js`, `site/local-recovery.js`:
  tolerant read-only projection, four-way failure taxonomy, raw store reads and
  recovery export helpers.
- `site/app.js`, `site/index.html`, `site/styles.css`: recovery/diagnostic panel,
  raw export action, V1 export gating, repair preview and consent wiring.
- `tests/`: deterministic regression fixtures (5 subjects / 19 tasks with one
  orphan and `legacy:s1` vs `legacy:legacy:s1`), provenance matrices, failure
  taxonomy, repair planning/execution, backup/consent/staleness, idempotence and
  redaction tests. Static assertions cover UI wiring and absence of destructive
  writes or business-content logging.
- `docs/product/developer-guide.md`, `docs/product/dexie-cloud-rollout.md` and
  the acceptance notes: document provenance, recovery, repair and convergence
  limits.
- No protected ASF file, workflow, secret, configuration, backlog entry or
  historical archive is modified by this change.

## Non-goals

- Purging personal or server databases, clearing IndexedDB or `localStorage`,
  clearing caches, or performing an administrative Dexie Cloud restore.
- Automatically converting identifiers by stripping `legacy:`, resolving a
  variant by title similarity, or creating a fictitious subject for an orphan.
- Changing the native Dexie Cloud synchronization protocol or promising global
  transactional atomicity across devices.
- Repairing anything without a verified recovery backup and a plan-specific,
  destination-specific consent.
- Claiming real two-browser Dexie Cloud convergence, Chrome Android behavior,
  touch, keyboard or screen-reader acceptance from Node tests.

## Uncertainties (no product decision invented)

1. **Encoding provenance for existing exports.** New exports can carry an
   optional top-level provenance block (`exportKind`, `idsCanonical`,
   `mappingVersion`) that remains readable as V1. Older exports without it are
   genuinely ambiguous, even without a `legacy:` prefix: they may be raw V1
   documents or older IndexedDB exports using generated UUIDs, or they may
   contain raw IDs that literally start with `legacy:`. The design blocks them
   pending an explicit provenance choice rather than guessing. Whether a
   user-facing choice is acceptable for all old files must be confirmed during
   acceptance.
2. **Proof of orphan identity.** A repair may attach an orphan item only when a
   selected source document plus its provenance yields the exact target identity
   for that item's `subjectId`/`parentId`. If no such evidence exists, the group
   remains ambiguous and blocked. How users select or provide that source in the
   UI is a product detail to validate.
3. **Permission visibility.** Native Dexie Cloud signals may not always prove
   that an absent local reference is merely invisible rather than deleted. The
   design keeps the state `invisible-or-unauthorized` or `indeterminate` and
   never presumes deletion; exact signal semantics must be checked on an isolated
   instance.
4. **Recovery backup storage.** The design requires an independently stored,
   checksum-verified snapshot of impacted records before repair. Whether it is
   kept in origin-local storage, downloaded, or both is an implementation choice
   that must not weaken the "independently recoverable" guarantee.
5. **Raw export metadata.** The raw export includes accessible records and the
   metadata needed for recovery. The exact allowlist of native fields (for
   example `owner`, `realmId`, `$ts`) must exclude credentials, tokens, OTPs and
   secrets, and be confirmed against the bundled Dexie Cloud version.
6. **Cross-device convergence.** The runner can prove local transactions and
   pure status transitions, not real server propagation. The target behavior is
   specified; the two-browser Dexie Cloud proof remains manual.
