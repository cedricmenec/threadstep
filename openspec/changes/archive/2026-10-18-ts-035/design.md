# Design

## Context

See `proposal.md` — Why. The current implementation has three separate mapping
call sites:

- `site/local-migration.js` projects the historical document with
  `mapRecords(..., { idempotent: true })`;
- `site/migration-reconciliation.js` maps the Cloud source with
  `mapSourceDocument(document)`, which calls `mapRecords` without the option;
- `site/migration.js` still exposes the legacy `legacy:` mapping and the older
  `planMigration` path.

`site/synced-records.js` reads both stores atomically and immediately calls
`normalizedRecords` in `site/persistence.js`, which reparses the V1 projection
and throws on any dangling relation. `site/app.js` catches that error and hides
the business view instead of rendering the readable part or a recovery surface.
The workspace can therefore contain valid records while remaining completely
invisible.

The runner has no browser, IndexedDB, Dexie Cloud session or network. The
decisive behaviour must therefore live in pure, injectable modules; real
two-browser convergence, touch, keyboard, focus and screen-reader checks remain
manual acceptance.

## Goals / Non-Goals

**Goals:**

- One provenance-aware identity resolver shared by local conversion, Cloud
  migration, JSON import, restoration and re-imported exports.
- No `legacy:legacy:` created by the Cloud path, and no second duplicate on a
  repeated import.
- A read-only integrity inventory that explains the 5-subject / 19-task orphan
  regression without writing anything.
- A four-way read-failure taxonomy that never turns an indeterminate state into
  an empty workspace or a confirmed Cloud state.
- A raw recovery export that includes every accessible record, including
  orphans, and is clearly not a V1 business export.
- A previewable repair plan whose attachment decisions are backed by explicit
  provenance evidence and consent, not by title or prefix heuristics.
- Targeted, atomic, idempotent reference repair that preserves all business
  fields and records.
- Truthful convergence status: local commit, native send, remote pull and
  business re-read are separate pieces of evidence.

**Non-Goals:**

- Replacing Dexie Cloud synchronization or claiming cross-device atomicity.
- Automatic data migration, automatic prefix stripping, automatic conflict
  resolution or any purge.
- A new browser test framework. Existing Node tests plus injectable adapters and
  static assertions cover deterministic behaviour; real browser checks stay in
  `Manual acceptance`.
- Changing protected factory files, workflows, secrets or backlog entries.

## Decisions

### 1. Provenance-aware identity resolution is shared, not duplicated

Introduce a pure provenance classifier and a single canonical identity resolver
used by every import/conversion path. The resolver takes an explicit provenance
descriptor, never a title, a note or a bare prefix:

```
provenance = {
  exportKind: "v1-raw" | "indexeddb-export" | "projected" | "legacy-double" | "unknown",
  idsCanonical: true | false | null,
  mappingVersion: 1 | 2 | null,
  sourceFingerprint: "sha256:..."
}
```

- `v1-raw`: the source is a validated raw V1 document. Identifiers are raw, so
  the canonical mapping still applies. A raw ID that happens to start with
  `legacy:` becomes `legacy:legacy:...` only when provenance explicitly says the
  source is raw.
- `indexeddb-export` / `projected`: the source was produced from an IndexedDB
  projection and already carries canonical identifiers. Keep IDs, `subjectId`
  and `parentId` unchanged.
- `legacy-double`: a historical export produced by the faulty double-prefix
  path. It is recognized only from explicit metadata or a user-confirmed
  provenance decision, never by counting prefixes.
- `unknown`: no usable metadata and no explicit source intent. The document is
  ambiguous even when no identifier starts with `legacy:`, because it may be a
  raw V1 document or an older IndexedDB export whose records use generated
  UUIDs. The plan is blocked pending an explicit provenance choice. The one
  documented exception is the historical `threadstep.document.v1` storage key,
  whose product context declares a raw V1 source; if that value itself contains
  prefixed identifiers, it is still ambiguous with a pasted projected export.

New exports add an optional top-level provenance block:

```
{
  "version": 1,
  "provenance": {
    "exportKind": "indexeddb-export",
    "format": "threadstep.v1",
    "mappingVersion": 1,
    "idsCanonical": true
  },
  "subjects": [...]
}
```

`parseDocument` already ignores unknown top-level properties, so old readers
still accept the file and the business shape remains V1-compatible. The marker
contains no title, note, account or secret.

Alternatives rejected:

- Plain `idempotent: true` everywhere. It would conflate a raw ID literally
  starting with `legacy:` with an already projected ID.
- Stripping all prefixes. It is destructive and non-injective.
- Inferring from title or ID shape. The backlog explicitly forbids it.

### 2. Cloud reconciliation consumes the shared resolver

`planReconciliation` and `mapSourceDocument` accept a provenance descriptor and
return an `ambiguous-provenance` plan when the source is unmarked, regardless of
whether its identifiers start with `legacy:`. The UI must ask the user to
confirm whether the file is a raw V1 document, an IndexedDB export, or a
historical double-prefixed export, and show both identity interpretations with
counts before any plan can run. Once the provenance is confirmed, the plan
fingerprint includes it, so changing the answer invalidates consent.

The local conversion uses the same resolver. The historical
`threadstep.document.v1` key supplies an explicit `v1-raw` context; if the stored
value contains prefixed identifiers, the source remains ambiguous. The local
conversion no longer assumes that any `legacy:`-prefixed ID is already
projected. This requires updating the TS-033 tests that currently treat an
unmarked prefixed document as already converted; the new expected behaviour is
an explicit ambiguity state unless provenance is provided.

The obsolete `planMigration` path is either migrated to the shared resolver or
documented as an internal compatibility wrapper that delegates to it. No path
may keep its own prefix policy.

### 3. Integrity inventory is read-only and code-based

Add a pure inventory function over raw `subjects` and `items` arrays. It works on
the result of a read-only IndexedDB transaction and returns counts and entries
with stable codes, never HTML, never logs containing content:

- `dangling-subject`: item `subjectId` has no matching subject.
- `dangling-parent`: item `parentId` has no matching parent in the same subject.
- `duplicate-id`: the same ID appears more than once in one store.
- `prefix-variant`: the same logical candidate appears under different prefix
  depths (`legacy:s1` and `legacy:legacy:s1`), reported without deciding which
  is canonical.
- `logical-duplicate`: two records have identical business fields but different
  IDs; reported, not merged.
- `identity-collision`: two records in one store map to the same canonical ID.
- `parent-inconsistency`: a child points to a parent in another subject, a
  parent itself has a parent, or a cycle exists.
- `content-conflict`: the same candidate identity carries different business
  fields.
- `invisible-or-unauthorized`: the reference cannot be resolved locally and
  native session/permission context indicates the record may be hidden.
- `indeterminate`: the evidence is insufficient for any other code.

The inventory never creates a placeholder subject. A missing reference with a
permission or realm context is `invisible-or-unauthorized`, not `deleted`.

### 4. Four failure families plus an indeterminate fallback

`site/synced-records.js` and `site/persistence.js` expose a typed read result
instead of throwing an undifferentiated error:

| Code | Meaning | UI consequence |
| --- | --- | --- |
| `storage-unavailable` | IndexedDB cannot be opened or does not exist | Explain that persistence cannot be guaranteed; offer historical export if available; do not show an empty workspace |
| `read-refused` | The read transaction is rejected (permission, schema, storage failure) | Block editing and export-completeness claims; show the category and retry path |
| `projection-invalid` | Tables were read but the strict business projection fails (dangling, duplicate, invalid shape) | Enter read-only degraded consultation with valid records and anomaly codes |
| `not-visible-unauthorized` | Access exists but records or realms are hidden by permission | Do not infer deletion or emptiness; do not claim synchronization |
| `indeterminate` | Signals are missing or contradictory | Keep read-only; no empty or synced conclusion |

The existing fail-closed contract is preserved: a failed read still cannot look
like an empty target. The difference is that `projection-invalid` is no longer
treated as a total read failure.

### 5. Degraded consultation keeps valid data readable

When the strict projection fails, the app builds a tolerant view:

- subjects whose own fields are valid remain visible;
- items are shown when their subject is valid and their parent chain is valid;
- every rejected or unplaceable record is listed with its store, ID and code;
- no edit, import, repair or automatic normalization is enabled in this mode;
- a normal V1 export is disabled with an explanation, or marked incomplete if a
  later product decision permits it. This design chooses disabling to avoid a
  silently lossy file.

The raw recovery export is built from the raw store arrays, not from
`lastRecords` or `recordsToDocument`. It includes accessible records, orphan
records and recovery-relevant metadata, plus counts and a checksum. It excludes
tokens, OTPs, credentials and secrets. If the read itself is refused or the
storage is unavailable, no export is offered and the UI says why; it never
presents an in-memory snapshot as complete.

### 6. Repair planning uses evidence, not heuristics

A repair plan is a pure value built from:

- the read-only inventory;
- an optional source document and its provenance, selected by the user;
- the current destination identity (URL, `remoteDbId`, session category,
  permission/realm context);
- explicit user decisions for ambiguous groups.

For each orphan reference, the planner derives candidate target IDs from the
selected source and mapping version:

```
source subject id -> canonical target id under mappingVersion 1
source subject id -> canonical target id under historical double-prefix mapping
```

An attachment is proposed only when exactly one candidate matches an existing
target subject or item and the source evidence is unambiguous. If two candidates
match, if no source is provided, or if only prefix stripping or title similarity
would justify the match, the group is `ambiguous` and blocked.

The plan exposes, without writing:

- source(s), target workspace, destination URL/`remoteDbId` and session category;
- ID variant and mapping version;
- proposed subject/task mapping and all `subjectId`/`parentId` changes;
- fields preserved (title, note, priority, `done`, order, hierarchy);
- ambiguous/blocked groups with codes;
- counts before/after and a fingerprint over all of the above.

Planning is deterministic and side-effect free.

### 7. Repair execution is targeted, backed up and idempotent

Before commit:

1. Build and verify a recovery snapshot of the impacted records. The snapshot is
   stored independently of the working view (origin-local storage and/or
   download), with a checksum and record count. If it cannot be verified, repair
   is disabled; read-only diagnosis remains.
2. Require consent bound to the plan fingerprint and destination identity.
3. Re-read the source, target, session, permissions, `remoteDbId` and plan
   fingerprint. Any difference returns `stale-plan` or `sync-blocked`.

Commit:

- one `rw` IndexedDB transaction;
- only targeted `update` operations for `subjectId`/`parentId` on the planned
  items, with a compare-and-swap check on the other business fields;
- no `delete`, no mass primary-key rename, no `put` that replaces a divergent
  record, no subject creation for an orphan;
- a late collision or concurrent edit aborts the whole transaction;
- after commit, the same plan rerun produces no operation because the references
  already match.

Interruption before commit writes nothing. Interruption after commit but before
the status metadata is written leaves `uncertain`; reload reads IndexedDB and
recomputes the inventory, which recognizes the repaired state and proposes no
duplicate operation.

### 8. Convergence is reported from separate evidence

Reuse the existing truthful status reducer. A repair produces:

- `local-written` after the IndexedDB transaction;
- `sync-pending`/`offline-pending` until native evidence exists;
- `converged-on-this-device` only after a native pull / healthy `in-sync` state
  and a successful fresh business read that includes the repaired records;
- `indeterminate` when any of those signals is missing.

Cross-device convergence is not inferred. It is a separate manual acceptance on
an isolated Cloud instance and two browsers.

### 9. Test strategy

- Pure module tests for provenance classification, mapping, inventory, failure
  taxonomy, repair planning, backup verification, consent/revalidation and
  status reduction.
- A deterministic 5-subject / 19-task fixture with one orphan and both
  `legacy:s1` / `legacy:legacy:s1` variants.
- Adapter tests prove zero writes on preview, cancellation, missing/invalid
  backup, stale consent, concurrent modification, account/URL change, collision
  and transaction error.
- Static assertions prove the Cloud UI uses the shared resolver, that no path
  strips prefixes or logs business content, and that the V1 export is gated when
  anomalies exist.
- `npm run check` and `openspec validate ts-035 --strict --no-interactive` run on
  the runner. Real Dexie Cloud propagation remains manual.

## Risks / Trade-offs

- [Ambiguity blocks imports that previously "worked"] → The user gets an
  explicit provenance choice with both interpretations and counts. Silent
  guessing is worse than a blocked write.
- [New export provenance is ignored by older app versions] → The extra top-level
  field is optional and V1-compatible; older readers keep working.
- [Permission invisibility cannot always be proven] → Keep
  `invisible-or-unauthorized`/`indeterminate`, never infer deletion, and block
  repair for that group.
- [Reference repair could still race with another client] → Compare-and-swap on
  the impacted records inside one transaction; any mismatch aborts. Remote
  convergence is not promised atomically.
- [Recovery backup itself may be incomplete if the read is partial] → Only
  verify and accept a backup built from a complete read; otherwise disable
  repair.
- [The local conversion's historical idempotent behaviour changes] → Document
  the transition and update TS-033 tests; the new behavior is stricter and
  non-destructive.
- [Raw export may expose the user's own metadata] → Include only
  recovery-relevant fields, exclude credentials/tokens/OTP/secrets, and never log
  business content.

## Migration Plan

1. Add the shared provenance descriptor and identity resolver, then migrate all
   mapping call sites to it.
2. Add the optional provenance block to new V1 exports while keeping the file
   readable by `parseDocument`.
3. Add typed read results, the integrity inventory and the tolerant read-only
   view.
4. Add the raw recovery export and disable the normal V1 export while an anomaly
   exists.
5. Add repair planning, evidence checks, backup verification, consent and the
   targeted transaction.
6. Wire the UI recovery panel and repair preview, including anomaly codes and
   accessible controls.
7. Add the status/convergence reporting and documentation.
8. Run deterministic tests, `npm run check`, and OpenSpec strict validation.

Rollback: the change adds read-only paths and explicit actions. If a defect is
found, the UI can keep the recovery view read-only and hide the repair action;
no data migration or rollback is needed because existing records are not
rewritten outside a confirmed repair.

## Open Questions

- Exact allowlist of native metadata fields for the raw recovery export, to be
  confirmed against `dexie-cloud-addon@4.4.15`.
- Whether the provenance choice for unmarked legacy exports should offer a file
  selection, a checkbox, or inferred metadata from an accompanying recovery
  snapshot.
- Whether the recovery snapshot must always be downloaded, or origin-local
  storage plus a visible export action is sufficient for the product's backup
  promise.
