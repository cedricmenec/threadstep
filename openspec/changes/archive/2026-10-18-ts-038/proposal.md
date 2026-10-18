# Proposal

## Why

ThreadStep now has an autonomous `threadstep-local` workspace and an opt-in
synchronized workspace, but the browser still keeps a single Cloud URL, relies
on Dexie Cloud's URL-derived database suffix alone, and exposes no separate
workspace selection, suspension, logout or local-purge actions. On one shared
origin, a changed URL or account can therefore leave the previous local cache
reachable, and there is no truthful pending-changes warning before a destructive
local action. TS-038 makes workspace identity explicit and makes every
destructive-looking action separate, scoped and reversible by cancellation or
JSON backup.

## What Changes

- Add a local, non-synchronized **workspace registry** keyed by the normalized
  Cloud URL, plus the autonomous local workspace. Each entry records the
  workspace type, effective local database name, optional `remoteDbId`, an
  opaque account digest, schema version and activation/suspension status. No
  email, token, OTP, raw user identifier or business content is stored.
- Give every new synchronized workspace a deterministic per-URL base name while
  keeping Dexie Cloud's native `nameSuffix` enabled. This prevents the native
  suffix's first-path/first-host-label collision from reusing another instance's
  base. Existing legacy bases keep their current name so current local caches and
  unsynchronized work are not orphaned.
- Bind each synchronized workspace to an opaque digest of the authenticated
  account. A different authenticated account on the same URL is refused before
  any business record is rendered; switching accounts requires an explicit
  logout, which uses the native cache clearing. An unbound legacy cache is
  treated as unverified until explicit re-authentication or purge.
- Expose **selection**, **suspension**, **logout** and **local purge** as
  separate actions. Suspension closes the synchronized workspace and returns to
  the autonomous local workspace without logging out, deleting a cache or
  changing the destination. Selection switches workspace without copying data.
- Before logout or purge, diagnose pending synchronized changes from native
  evidence, warn about loss, offer cancellation and a downloadable JSON
  snapshot, and require explicit confirmation. Never purge silently.
- Logout calls the native `db.cloud.logout()`. ThreadStep re-runs its
  pending-change diagnosis immediately before the confirmed call and uses the
  native forced form only after its own warning and explicit confirmation,
  because the custom login GUI does not render the native
  `logout-confirmation` interaction. No business `delete()` is issued and no
  remote record is removed.
- Purge deletes only the explicitly identified local IndexedDB base with
  Dexie's physical database deletion after closing it. It never calls business
  table deletion, never deletes another URL's base, the autonomous workspace or
  the remote copy. The Cloud URL and registry entry remain so the remote data
  can be re-pulled after reconnection.
- Extend the redacted diagnostic with workspace type, effective local base,
  normalized URL, available `remoteDbId` and account-binding category, and
  recompute it when the selected workspace, session or URL changes.
- Add deterministic Node tests for the registry, A/B/A routing, base-name
  distinctness, account binding/mismatch, pending-change plans, logout and purge
  orchestration with injected native adapters, redacted diagnostics and the
  absence of business deletes. Real browser, two-account and mobile acceptance
  remains manual.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-identity-isolation`: adds a persistent URL-scoped workspace
  registry, per-URL base discrimination, account binding on a shared URL,
  suspension distinct from logout, pending-change diagnosis and scoped physical
  purge without remote business deletion.
- `cloud-opt-in-activation`: adds the suspended post-activation state and the
  guarantees that suspension preserves the activation record, destination,
  cache and autonomous source, and that resuming requires no new transfer
  consent.
- `dexie-cloud-configuration`: replaces the single stable-name assumption with
  a stable per-workspace base name, while keeping the URL in origin-local,
  non-synchronized storage and preserving legacy configurations.
- `dexie-local-database`: documents that the native `nameSuffix` stays enabled
  and that an application-level per-URL discriminator prevents native suffix
  collisions between distinct instances.

## Impact

- `site/workspace-identity.js` (new pure module): registry parsing, workspace
  resolution, per-URL base naming, account binding, action planning and
  redacted diagnostic contribution.
- `site/dexie-foundation.js`: per-workspace synchronized base name helper while
  retaining `DATABASE_NAME`, `LOCAL_DATABASE_NAME`, `nameSuffix` and current
  `cloudConfigureOptions` security options.
- `site/cloud-activation.js`: suspended status and startup routing.
- `site/app.js`, `site/index.html`, `site/styles.css`: workspace selector,
  suspension, logout and purge panels, pending warning and backup, account
  mismatch gate, diagnostic wiring.
- `site/sync-diagnostics.js`: allowlisted workspace and binding rows.
- `package.json`: `npm run check` includes the new module; no new dependency,
  Dexie schema version or synchronization protocol change is introduced.
- `tests/`: new deterministic unit and static integration tests.

## Non-Goals

- Server-side erasure, Dexie Cloud administrative permission changes or
  cross-user/cross-instance data transfer.
- Changing the remote database, deleting synchronized business records, or
  inventing recovery of mutations that were never transmitted.
- Replacing the existing JSON export/import, reconciliation, activation or
  historical migration journeys.
- Browser automation, real OTP delivery, two-account Cloud acceptance, mobile,
  keyboard, focus or screen-reader campaigns.

## Uncertainties and decisions left to implementation

- The pinned `dexie-cloud-addon` 4.4.15 clears synchronized tables on logout only
  after its native unsynced-change confirmation, and `logout({ force: true })`
  clears unsynced data without that prompt. This was established by source
  inspection, not by execution on the runner; real-browser verification remains
  manual.
- Counting pending changes relies on the addon's internal mutation stores. When
  the count cannot be read, the implementation must warn conservatively, require
  an explicit decision and offer a backup rather than claim that nothing is
  pending.
- An existing synchronized cache created before account binding has no proof of
  ownership. The safe default is to hide its business records until the user
  explicitly logs out/re-authenticates or purges that local base; this may
  require a one-time re-authentication for legacy users. Product approval of
  that one-time friction is assumed from the non-exposure requirement.
- Exact French labels, confirmation copy and the placement of the workspace
  panel are implementation details to settle during apply and manual acceptance.
- Logout keeps the Cloud workspace selected and shows the native login state;
  the autonomous workspace remains reachable through the selector. Suspension,
  not logout, is the action that returns the user to the autonomous workspace.
