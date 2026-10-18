# Proposal

## Why

TS-032 made the autonomous IndexedDB workspace the default, but the historical
`threadstep.document.v1` document is still only readable and exportable in
`localStorage`. A user who wants to keep working without Dexie Cloud cannot yet
bring the historical subjects and steps into the local base. TS-033 adds that
conversion as an explicit, non-destructive local operation, distinct from any
Cloud activation.

## What Changes

- Detect and strictly validate the historical V1 document with the existing
  `parseDocument` rules before offering any conversion.
- Present a local conversion review before consent: source inventory, current
  local-target inventory, planned insertions, detected collisions, the exact
  source fingerprint and the local destination. No Cloud URL, OTP or network is
  involved.
- Project subjects, items, substeps, `parentId`/`subjectId` relations, order,
  notes, priorities, `done` states and the local resume preference. Identifiers
  already using the legacy mapping are not prefixed a second time.
- Commit the conversion atomically and idempotently. A repeated conversion
  inserts nothing, a partially populated local target keeps its records, a
  colliding identifier is reported instead of overwritten, and a failed
  transaction leaves no partial document.
- Record stable local-conversion provenance (source fingerprint, mapping
  version, local target and result counts) in non-synchronized local storage,
  and distinguish "local conversion complete" from "Cloud activation".
- Revalidate the source and target at confirmation time; any source mutation
  makes the reviewed plan stale and aborts without writing.
- Keep `threadstep.document.v1` byte-for-byte intact and keep the historical
  JSON export available after every attempt.
- Guarantee that local conversion never constructs or configures a
  synchronized Dexie Cloud instance, never requests an OTP and never triggers a
  push.
- Add deterministic runner tests for detection, lossless mapping, consent,
  populated targets, collisions, stale plans, transaction failure, reload,
  provenance and the absence of Cloud activity.
- Update the product documentation and the canonical capability deltas so the
  historical "V1 to synchronized tables" wording no longer implies that every
  conversion requires a Cloud destination.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `legacy-storage-migration`: adds explicit local conversion review and
  consent, source fingerprint/staleness, lossless local mapping with
  non-recursive identifiers, populated-target and collision handling, atomic
  recovery and stable local provenance.
- `threadstep-integration-profile`: records the explicit V1-to-local
  conversion for a 5-subject/18-step document, the preservation of the source
  and its export, and the separation from Cloud activation.
- `legacy-document-migration`: clarifies that its consent gate governs
  synchronized imports, while an explicit local conversion requires no Cloud
  destination and does not perform a synchronized write.

## Impact

- `site/local-migration.js` (new pure module): source detection, local
  projection, plan/consent/revalidation/execution and provenance helpers.
- `site/fingerprint.js` (new pure module): SHA-256 source fingerprint shared
  with the existing reconciliation code without importing Cloud reconciliation
  into the local path.
- `site/migration.js`: reuse the existing detection/projection/mapping helpers;
  expose a non-recursive identifier option for the local conversion without
  changing the historical Cloud reconciliation contract.
- `site/app.js`: local conversion button, review/consent panel, confirmation
  flow through the existing local `businessStore`, reload of the converted
  records and truthful status messages.
- `site/index.html` and `site/styles.css`: accessible local conversion controls
  and review surface.
- `package.json`: `node --check` coverage for the new modules.
- `tests/`: new deterministic local-conversion tests plus static non-cloud,
  non-destructive and documentation assertions.
- `docs/product/`: developer guide, MVP/rollout and acceptance notes updated for
  the local conversion, its limits and the separate Cloud opt-in.
- No workflow, secret, protected ASF file, backlog task or archived OpenSpec
  change is modified.

## Non-goals

- Updating, converting or deleting the historical `threadstep.document.v1`
  value; there is no purge in this change.
- Transferring local records to Dexie Cloud, configuring a Cloud URL, sending
  an OTP, attesting a remote target or performing a push (TS-037).
- Merging or restoring arbitrary JSON files, resolving divergent backups and
  redesigning the general import/restore journey (TS-035).
- Adding a new business format, changing the V1 schema, quotas, ordering or
  task rules.
- Resolving a colliding local record by automatic overwrite or automatic copy;
  TS-033 fails closed and leaves later reconciliation work to its own task.
- Claiming real-browser, mobile, keyboard or screen-reader acceptance from Node
  tests alone.

## Uncertainties (no product decision invented)

1. **Collision outcome.** The backlog requires no duplication and no overwrite,
   but does not define a conflict-resolution UI for a local record that already
   uses a source identifier with different content. The plan chooses the
   conservative behavior: report the collision, write nothing for that plan and
   defer copy/merge choices to TS-035/TS-037. This does not invent a new merge
   feature.
2. **Provenance storage.** The stable provenance marker is proposed in
   non-synchronized origin-local storage (`threadstep.migration.v1`) rather than
   a new Dexie store. The business records remain the source of truth for
   idempotency; the marker only records that the local conversion completed and
   the source fingerprint it used. Its exact placement is a technical choice.
3. **Resume preference mapping.** The historical preference stores source
   identifiers while the converted records use stable mapped identifiers. The
   plan updates the preference only for references that exist in the source, so
   the tracked action still points to the same item. Whether an unreferenced
   stale preference should be preserved verbatim or cleared is not fixed by the
   backlog; the plan preserves it untouched.
4. **Identifier idempotency scope.** The non-recursive mapping is applied to the
   local conversion path. The existing synchronized reconciliation still uses
   its delivered mapping behavior; unifying all reimport paths is explicitly
   TS-035 scope.
5. **Runner limits.** The runner has no real browser IndexedDB or localStorage
   UI. Deterministic fakes and static assertions prove the conversion logic,
   while Chrome mobile, reload, visual comparison and real storage inspection
   remain manual acceptance.
