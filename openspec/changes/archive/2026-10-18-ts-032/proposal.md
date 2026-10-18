# Proposal

## Why

The delivered ThreadStep still persists its Cloud-less business data through
`localStorage`, while the approved target is an autonomous IndexedDB/Dexie
workspace usable on first launch without a Cloud URL, OTP or network. TS-032
makes IndexedDB the default local store now, without activating Dexie Cloud and
without losing the historical `threadstep.document.v1` document.

## What Changes

- Add a stable, versioned local-only Dexie workspace with the existing
  `subjects`/`items` stores and stable string identifiers, opened without the
  Dexie Cloud addon or `db.cloud.configure()`.
- Start the business view immediately from the local workspace when no valid
  Cloud configuration exists. No Cloud identity, OTP, URL or synchronized
  instance is required.
- Route every local business read, mutation, JSON import and JSON export through
  the transactional IndexedDB adapter. A local write is announced only after
  the transaction commits; a failed or unavailable storage is reported as a
  distinct local persistence problem and never as success.
- Keep local and synchronized workspaces separate so existing local records are
  not attached to, or uploaded by, a Dexie Cloud instance before the explicit
  opt-in of TS-037.
- Preserve the historical `threadstep.document.v1` key byte-for-byte, keep it
  readable and exportable, and do not convert it automatically. Conversion to
  the local base remains the separate, explicit TS-033 work.
- Expose no Cloud configuration, credential or secret in the local V1 export.
- Revise the contradictory historical canonical requirements that made a valid
  Cloud URL a prerequisite for all business access. The local-first target
  specs remain authoritative for TS-032.
- Add deterministic runner tests for local bootstrap, offline first use,
  create/edit/delete/reload, transactional failure, unavailable storage,
  legacy preservation, export compatibility and the absence of Cloud network
  activity.

## Capabilities

### New Capabilities

None. TS-032 changes existing capabilities.

### Modified Capabilities

- `local-indexeddb-persistence`: the autonomous local bootstrap is the default
  business path; no Cloud URL, identity or network is required to open it.
- `dexie-cloud-configuration`: configuration gates only the synchronized
  workspace, never the autonomous local workspace.
- `dexie-local-database`: a dedicated local-only workspace is opened without
  the Cloud addon, while the synchronized workspace keeps its stable name and
  native `nameSuffix`.
- `local-first-business-persistence`: all business operations, import and
  export use the transactional IndexedDB store in local-only mode, and the
  historical compatibility guard is updated for the TS-033/TS-037 sequence.
- `threadstep-integration-profile`: ThreadStep starts on local Dexie, preserves
  a legacy V1 document without converting it automatically, and exports a local
  V1 backup without Cloud data.

## Impact

- `site/dexie-foundation.js`: local workspace schema/bootstrap and a distinct
  stable local database identity; no Cloud addon in local mode.
- `site/persistence.js`: a reusable Dexie transaction store adapter, exercised
  by both local and synchronized modes.
- `site/app.js`: startup branch, local load/mutation/import/export, local error
  states, legacy notice and business visibility without authentication.
- `site/index.html` and `site/styles.css`: accessible local persistence and
  legacy-preservation notices; no new dependency.
- `tests/`: deterministic unit and static tests for the new local path,
  failure cases, privacy and V1 compatibility.
- `docs/product/`: developer guide, MVP/rollout notes and manual acceptance
  documentation updated to distinguish local-first mode, TS-033 conversion and
  TS-037 opt-in.
- No Cloud activation, OTP, remote reconciliation, data migration, secret,
  workflow, factory file or protected ASF path is modified.

## Non-goals

- Activating Dexie Cloud, sending an OTP or transferring local records.
- Converting `threadstep.document.v1` into IndexedDB (TS-033) or reconciling
  local data with a remote destination (TS-037).
- Purging, renaming, hiding or rewriting the historical localStorage key.
- Changing the synchronized OTP flow, Cloud permissions, Dexie Cloud instance
  identifiers or navigation/UI business rules.
- Running a paid model or claiming browser, mobile, offline or screen-reader
  acceptance from Node tests alone.

## Uncertainties (no product decision invented)

1. **Local workspace identity.** The design proposes a dedicated stable
   database name (`threadstep-local`) distinct from the synchronized
   `threadstep`/`nameSuffix` workspace. This is a technical isolation choice to
   prevent pre-consent attachment; its operational interaction with TS-037 must
   be confirmed before activation.
2. **Existing Cloud configuration form.** The current URL form selects the
   synchronized workspace. The plan keeps that delivered path but requires the
   local workspace to stay separate and requires a clear notice that no local
   record is transferred. The final placement/wording of that notice is not a
   product decision fixed by the backlog.
3. **Legacy transition surface.** The backlog requires a non-destructive
   transition but not a conversion flow. The plan proposes a read-only local
   notice with the existing historical export; conversion remains TS-033.
4. **Scope of "all business actions".** Create, edit, delete, ordering,
   completion, filters, suggestion/tracking, import and export are treated as
   business actions. Only the JSON export is named explicitly in the backlog;
   routing local import through the same store follows the persistence target.
5. **Runner limits.** The GitHub Actions runner has no real browser IndexedDB.
   Local behavior is proven with deterministic fakes/static assertions, while
   real Chrome mobile, offline, storage-blocked and screen-reader acceptance
   remain manual.
