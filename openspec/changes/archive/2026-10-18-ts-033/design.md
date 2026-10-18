# Design

## Context

See `proposal.md` — Why.

The delivered application already has:

- an autonomous `threadstep-local` Dexie workspace opened without the Cloud
  addon (`site/dexie-foundation.js`, `site/app.js`);
- a transactional `createDexieStore(db)` adapter over `subjects`/`items`
  (`site/persistence.js`);
- strict V1 validation and projection helpers (`parseDocument`,
  `documentToRecords`, `recordsToDocument`);
- a pure historical conversion module (`site/migration.js`) with detection,
  deterministic `legacy:` mapping, planning and consent-gated execution;
- a Cloud-only reconciliation path (`site/migration-reconciliation.js`) that
  requires an authenticated, attested destination;
- a byte-for-byte historical export (`site/local-recovery.js`).

The gap is narrower than TS-026 but product-critical: in local mode the
historical document is only noticed and exported; there is no conversion into
`threadstep-local`, no local source fingerprint, no populated-target review and
no local provenance. The existing Cloud reconciliation cannot be reused as-is
because it requires a Cloud destination and would violate the local-first
boundary.

The runner has no browser or real IndexedDB. All conversion logic must therefore
be pure or injectable and statically assertable; real Chrome mobile behavior
remains manual acceptance.

## Goals / Non-Goals

**Goals:**

- Add an explicit local conversion flow from a valid V1 document into the
  autonomous `threadstep-local` workspace.
- Preserve every V1 field, hierarchy, note, priority, order, `done`, identifier
  relationship and the local resume preference.
- Review the source, the current local target and the planned insertions before
  consent, including a stable source fingerprint.
- Revalidate the source and target at confirmation; stale plans write nothing.
- Make conversion atomic and idempotent, with no duplicate, no overwrite and no
  partial document after a transaction failure.
- Keep the historical value and its export byte-for-byte intact.
- Record stable local provenance and distinguish local completion from Cloud
  activation.
- Prove that local conversion constructs no synchronized instance and performs
  no network or push activity.

**Non-Goals:**

- Building the Cloud activation assistant, OTP flow, remote attestation or
  local-to-Cloud transfer (TS-037).
- General JSON merge/restore semantics and global reimport idempotency
  (TS-035).
- Purging, rewriting or renaming `threadstep.document.v1`.
- Adding a new Dexie store, schema version or synchronization metadata.
- Resolving identifier conflicts by automatic copy or overwrite.

## Decisions

### 1. A dedicated pure local-conversion module

Add `site/local-migration.js` as a pure, deterministic module. It reuses
`detectHistoricalDocument`, `projectHistoricalDocument`, `mapRecords` and
`recordsToDocument` from `site/migration.js` and record helpers from
`site/persistence.js`, but it does not import `migration-reconciliation.js`,
`dexie-foundation.js` or any Dexie Cloud code.

Its contract is injected, like the existing adapters:

- `readSource()` returns the current raw historical string;
- `readTarget()` returns the current local records;
- `commit(operations)` commits one atomic operation set through the existing
  local store;
- `writeProvenance(record)` writes the non-synchronized provenance marker;
- `writeResumePreference(value)` updates the local preference when needed.

This keeps the browser wiring in `app.js` and makes every rule testable with
in-memory fakes. Alternatives considered: extending the Cloud reconciliation
module (rejected: requires a destination and Cloud attestation) and putting the
logic directly in `app.js` (rejected: untestable and mixes persistence with
DOM).

### 2. Source identity is the exact stored string

Add `site/fingerprint.js` with the existing SHA-256 implementation, extracted
from `site/migration-reconciliation.js` and re-exported there so its public
contract and tests stay valid. The local plan computes a fingerprint over the
exact raw `localStorage` string, not only the parsed object, so any byte change
(including whitespace or an invalid rewrite) invalidates the reviewed plan.

The plan fingerprint also covers the projected target records and the mapping
version. Confirmation re-reads both sides through injected callbacks and
recomputes the plan fingerprint before calling `commit`. A mismatch returns a
typed `stale-source` or `stale-plan` result with no write.

Alternatives considered: hashing only the parsed document (rejected: a
byte-level source mutation would be missed) and using an async Web Crypto digest
(rejected: the runner and existing tests are synchronous and dependency-free).

### 3. Local identifier mapping is non-recursive

The local path maps source identifiers to the existing stable `legacy:` form,
including `subjectId` and `parentId`. The mapping used by the local conversion
leaves an identifier that already starts with the prefix unchanged, so a source
produced by a later export cannot become `legacy:legacy:ID`.

The change is scoped to the local conversion option and does not silently
change the delivered Cloud reconciliation behavior; unifying all import paths is
TS-035. The stable prefix plus the provenance fingerprint give the mapping a
deterministic provenance without storing a full source copy.

### 4. Target classification: identical, absent, collision

`planLocalConversion` builds a business projection of the source and compares it
with the current local records:

- **absent**: an operation `put` is planned;
- **identical**: no operation, so repeated conversion is a no-op;
- **collision**: the same identifier exists with different business content; the
  plan reports it and the execution refuses to write anything.

A target that already contains unrelated records is `populated`, not an error:
after explicit consent only the absent records are inserted. This satisfies the
"partially populated target" acceptance without overwriting user data. A
collision leaves the whole plan unwritten so the user gets an explicit,
non-destructive outcome; copy/merge choices are deferred to TS-035/TS-037.

The target comparison uses the same business projection as the existing
store (title, order, subject, parent, note, priority, done) so Cloud-style
metadata can never be mistaken for a business difference.

### 5. One atomic commit plus non-synchronized provenance

`runLocalConversion` requires consent bound to the plan fingerprint
(`{ confirmed: true, fingerprint }`), revalidates source and target, and calls
`commit(operations)` exactly once. A failed transaction returns `failed` with no
provenance and no resume rewrite; the local target keeps its previous state.

After a successful commit, the flow writes a provenance record in
non-synchronized origin-local storage under `threadstep.migration.v1`:

```
{
  version: 1,
  sourceKey: "threadstep.document.v1",
  sourceFingerprint: "<sha256>",
  mappingVersion: 1,
  target: "threadstep-local",
  status: "local-complete",
  subjects: 5,
  items: 18
}
```

It contains no titles, notes or other business content, is not exported and is
not synchronized. It is metadata only: the committed records remain the source
of truth for idempotency if the marker is removed.

Alternatives considered: a new local Dexie store (rejected: schema evolution
and a possible synchronization-eligibility ambiguity for a metadata-only
concern) and putting provenance in the business records (rejected: alters the V1
export shape).

### 6. Resume preference is remapped, not synchronized

The V1 preference in `threadstep.resume.v1` stores source identifiers. After a
successful conversion, the flow maps `subjectId` and `itemId` only when those
references exist in the source document. The preference is then written back to
the same non-synchronized key so tracking still resolves to the converted item.
It never enters `subjects`/`items` and never appears in the V1 export. A
preference whose references are absent from the source is left untouched rather
than silently cleared.

### 7. Local review surface in `app.js`

The local panel gains a conversion control when a valid historical document
exists. It opens a review section rendered with `createElement`/`textContent`
(no `innerHTML`) containing:

- the local destination and an explicit statement that no Cloud is configured;
- source subject/step counts and the source fingerprint;
- current target counts and the planned insertion count;
- collision and already-converted states;
- an explicit consent checkbox and confirm/refuse buttons;
- an `aria-live` status for the outcome.

Confirmation reads the current local records through `businessStore.read()`,
runs the plan, and commits through `businessStore.commit()`. It does not call
`bootstrapSyncedDatabase`, `readAttestedTarget`, `db.cloud` or any network API.
After success it calls `refreshLocalDocument()` so the view shows the committed
records. The historical notice remains visible and the historical export remains
available. Refusal only closes the review.

### 8. Documentation and canonical boundaries

The product docs describe the explicit local conversion, the preserved source,
the five-subject/eighteen-step acceptance fixture and the fact that Cloud
activation remains TS-037. The `legacy-document-migration` delta adds only the
boundary that its consent gate is for synchronized imports; local conversion is
governed by `legacy-storage-migration` and requires no Cloud destination.

## Risks / Trade-offs

- **Provenance marker can be cleared.** → The marker is optional metadata; the
  target records still make a second conversion idempotent. The UI can report
  the conversion from the target inventory even without the marker.
- **Prefix mapping changes the displayed IDs after conversion.** → The V1
  source and its export stay unchanged; the converted local base uses the
  stable mapped IDs expected by later Cloud reconciliation. Tests cover
  hierarchy, export shape and resume remapping.
- **Resume preference write is not atomic with IndexedDB.** → The business
  commit remains authoritative. If the preference write fails, the data is
  complete and only tracking may need to be re-selected; the failure is reported
  without retracting the conversion.
- **Populated target plus collision blocks the whole plan.** → This is the
  fail-closed choice required by "no overwrite". Copy/merge resolution is
  deliberately deferred to TS-035/TS-037.
- **Exact-string fingerprint invalidates on cosmetic source changes.** → This is
  intentional: the reviewed plan must describe the exact source the user saw.
- **Runner cannot prove real IndexedDB, reload, mobile or screen-reader
  behavior.** → Pure/injectable tests plus static assertions; real-browser
  checks stay in `Manual acceptance`.

## Migration Plan

1. Ship the local conversion behind the explicit review/consent control. No
   automatic conversion runs on startup.
2. Existing historical data remains in `threadstep.document.v1`; the local
   workspace may already contain unrelated records and is preserved.
3. If the feature is rolled back, the local IndexedDB records may remain but are
   ignored by the previous release; the historical key and its export are still
   intact.
4. A later TS-037 activation can reconcile the local workspace with a Cloud
   destination; TS-033 does not configure or push anything.

## Open Questions

None that would change the specs or the task breakdown. Collision resolution
beyond fail-closed reporting and global reimport idempotency are explicitly
deferred to TS-035/TS-037.
