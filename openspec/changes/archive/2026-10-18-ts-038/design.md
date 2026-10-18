# Design

## Context

See `proposal.md` — Why. The delivered code already separates the autonomous
`threadstep-local` database from a synchronized Dexie base (`site/dexie-foundation.js`)
and routes startup through the TS-037 activation record (`site/cloud-activation.js`).
It still stores one Cloud URL and one activation record, so it has no durable
notion of several workspaces, no account binding and no UI for selection,
suspension, logout or local purge.

Two native facts shape this design:

1. Dexie Cloud 4.4.15 derives the native `nameSuffix` from the first path
   segment of the URL, or from the first hostname label when the path is `/`.
   `https://foo.dexie.cloud` and `https://dexie.cloud/foo` therefore derive
   `foo`; distinct instances can collide if the app relies on that suffix alone.
   `nameSuffix` must stay enabled.
2. `db.cloud.logout()` counts entries in the addon's `*_mutations` stores. With
   pending changes it emits a `logout-confirmation` `userInteraction` and only
   clears synchronized tables after native confirmation. `logout({ force: true })`
   clears unsynced data without that interaction. ThreadStep uses a custom login
   GUI that does not render `logout-confirmation`, so ThreadStep must produce
   the warning itself before calling the native logout.

The runner has no DOM, IndexedDB, Cloud session or network. Workspace and
destructive-action rules therefore stay in a pure, injectable module, as with
TS-034, TS-036 and TS-037; browser, two-account, mobile and accessibility
acceptance remains manual.

## Goals / Non-Goals

**Goals:**

- Make workspace identity durable across A/B/A URL journeys without copying or
  deleting data.
- Prevent a distinct URL from reusing another URL's local base, including when
  the native suffix collides.
- Prevent a different account on the same URL from seeing cached records,
  including sessions that change without an explicit logout.
- Make logout, suspension, selection and purge independent, explicit and
  recoverable, with truthful pending-change warnings and no remote business
  deletion.
- Preserve legacy bases, activation records, the autonomous workspace and all
  existing export/import behavior.
- Prove the rules with deterministic Node tests; leave real-browser and Cloud
  evidence to manual acceptance.

**Non-Goals:**

- Server-side erasure, Dexie Cloud admin/role changes, or cross-account transfer.
- Per-record server acknowledgement or recovery of mutations never pushed.
- A second synchronization or authentication protocol, a Dexie schema change, a
  new dependency, or disabling `nameSuffix`.
- Changing the existing reconciliation, activation, import or migration flows
  beyond the workspace routing described here.

## Decisions

### 1. A registry is the durable source of workspace identity

Add a pure module `site/workspace-identity.js` and one origin-local,
non-synchronized key `threadstep.workspaces.v1`:

```
{ version: 1, selected: "local" | "<normalized-url>",
  workspaces: {
    "<normalized-url>": {
      type: "synchronized",
      url, databaseName, schemaVersion,
      remoteDbId?, userDigest?,    // userDigest = sha256(opaque userId)
      status: "activating" | "active" | "suspended" | "cancelled"
    }
  } }
```

Parsing is allowlisted and versioned. Malformed URLs, unknown versions, invalid
statuses or extra sensitive keys degrade the entry to `null`; a registry that
cannot be read never authorizes a purge or transfer. `selected: "local"` is the
autonomous workspace and needs no entry. The registry stores no email, OTP,
token, raw user id or business content.

The existing `threadstep.cloud.config.v1` and `threadstep.cloud.activation.v1`
keys remain readable for migration and are still written for the selected
workspace so a rollback does not lose the current URL or activation status. On
first startup with a legacy config and no registry, the app synthesizes one
entry with `databaseName = DATABASE_NAME`, `status` from the activation record,
and the persisted `remoteDbId` when available.

Alternative rejected: keep one URL and rely on activation status only. It cannot
represent A and B simultaneously, so returning to A would not be deterministic
and A/B/A isolation could not be tested.

### 2. Base names get an application-level URL discriminator

`site/dexie-foundation.js` gains a deterministic helper:

- same API/version/schema as today;
- a new synchronized workspace uses
  `threadstep-ws-<first 16 hex of sha256(normalizedUrl)>`;
- a legacy workspace migrated from the old config keeps `threadstep`;
- the native `db.cloud.configure({ databaseUrl, nameSuffix: true, ... })`
  still appends its suffix, so the final IndexedDB name is
  `<base>-<nativeSuffix>`.

The registry stores the base name explicitly. Startup never re-derives a base
name for an existing entry, so a future change of hash length cannot silently
move a workspace. The effective IndexedDB name used by purge is read from
`db.name` after `configure()`, because the addon mutates the name itself; the app
does not duplicate the native suffix algorithm.

Alternative rejected: fully own the database name with `nameSuffix: false`. That
violates the canonical requirement and loses the native instance association.
Alternative rejected: trust the native suffix. Its first-segment derivation is
documented in the vendored bundle and can collide.

### 3. Startup resolves the selected workspace, then the legacy fallback

`resolveStartupWorkspace` becomes a composition of the registry and the legacy
activation/config inputs:

- valid registry with `selected` URL and status `active`/`activating` → open that
  synchronized base;
- `selected` URL with status `suspended` or `cancelled` → open the autonomous
  workspace while keeping the entry selectable;
- `selected: "local"` or no registry → autonomous workspace;
- legacy config without a registry → current behavior (synchronized when the
  activation record is active/activating or absent).

Selecting a workspace closes the current database without deleting it, updates
`selected`, and re-bootstraps the page. The implementation may reload the page
after selection to guarantee that no Dexie Cloud subscription survives; a reload
is not a data operation and preserves all bases. Suspension updates the entry to
`suspended`, closes the synchronized database and opens the local workspace in
the same page. Resume updates the entry to `active` and re-opens the same base.

### 4. Account binding is checked before business reads

Each synchronized entry may store `userDigest = sha256Hex(userId)` (the same
pure SHA-256 used by `site/fingerprint.js`; no raw id is persisted). Binding
states:

- `unbound`: no digest; if the synchronized cache contains no business records,
  the app may bind the current authenticated digest. If records exist, the cache
  is an unverified legacy cache and business remains hidden.
- `bound`: digest exists. If the current authenticated digest equals it, reads
  proceed. A different digest is `mismatch`: business stays hidden, no write is
  attempted, and the UI offers logout or purge.
- `unauthenticated`/`indeterminate`: no business read, as today.

The check runs before `refreshSyncedDocument()` and before subscribing to
native record changes. On a mismatch the app closes the synchronized database so
no background synchronization continues for the mismatched session. It does not
call `Dexie.delete()` or table deletion automatically: the user must choose
logout (native cache clear) or the explicit purge action.

For a mismatched session, logout must still work: the implementation calls the
native logout with the same pending-change preflight, then clears the binding.
The cache is left to the native logout behavior; if the native logout fails, the
app reports the category and keeps business hidden.

Alternative rejected: suffix the local database by user digest. Dexie Cloud
stores its login state inside the synchronized base, so a user-specific suffix
would require knowing the account before authentication and either a second
authentication store or an unauthenticated identity picker. That adds a new
trust boundary and risks duplicating sessions.

### 5. Pending changes are diagnosed conservatively

Add an adapter boundary:

```
countPendingChanges(db) -> { status: "none" | "pending" | "unknown", count? }
```

The browser implementation inspects Dexie's table names ending in `_mutations`
(the stores used by the native logout) and counts their rows in a read-only
transaction. If that inspection throws, is empty in an unexpected way, or the
native state is contradictory, it returns `unknown`.

A pure planner produces the action plan:

- `none` → logout can proceed; purge still requires its own explicit
  confirmation of scope;
- `pending` → warning, JSON backup offer, cancel, explicit continue;
- `unknown` → warning presented as possible loss, backup offer, explicit
  continue; never “nothing pending”.

The UI downloads a JSON snapshot using the existing business export before
confirmation. The snapshot is a user-controlled recovery artifact only; the app
does not claim it was re-transmitted to the server.

### 6. Logout, suspension and purge are separate orchestrations

- **Suspension** (`suspendWorkspace`): update registry status to `suspended`;
  close the synchronized DB (stopping native sync and websocket work); select
  and open the autonomous workspace. No `db.cloud.logout()`, no delete, no URL
  change, no transfer. Session and binding remain in the closed base for resume.
- **Logout** (`logoutWorkspace`): preflight pending changes and block local
  business writes while the confirmation is open. After explicit continuation,
  re-run the preflight immediately and call `db.cloud.logout({ force: true })`.
  The forced native form is used for every case because ThreadStep's own warning
  replaces the native `logout-confirmation` interaction, which the custom login
  GUI does not render; the native call still clears the synchronized cache.
  Clear `userDigest` in the registry and close the base. Keep the URL,
  `remoteDbId` and selected Cloud workspace so the login screen can authenticate
  the next account. Never touch `threadstep-local` or another workspace base.
  Never call a business `delete()`.
- **Purge** (`purgeLocalWorkspace`): preflight. After explicit confirmation of
  the displayed workspace and effective base, close that base and call Dexie's
  physical database deletion (`Dexie.delete(effectiveName)`). Do not call
  `table.delete`, `db.cloud` deletion or any remote action. Clear the entry's
  binding (its session lived in that base), keep the URL/config/`remoteDbId`,
  set selection to `local`, and reload into the autonomous workspace. Purging
  the autonomous workspace deletes only `threadstep-local`.
- **Selection** (`selectWorkspace`): update `selected`, close the current base,
  reload. If leaving a synchronized workspace with pending/unknown changes, show
  a non-blocking notice that replication is paused and the changes remain in its
  cache; the action itself deletes nothing.

The pure module returns plans/decisions; `site/app.js` owns the native calls,
confirmations and reloads. This keeps the rules testable in Node with injected
adapters.

### 7. Diagnostics expose workspace and binding categories only

`buildSyncDiagnostic`/`buildDiagnosticView` gain allowlisted inputs and rows:

- workspace type (`local` or `synchronized`);
- effective local base name (no data path);
- normalized URL and `remoteDbId` when available;
- session category (existing enum);
- account binding category (`bound`, `unbound`, `mismatch`, `unauthenticated`,
  `indeterminate`).

No email, OTP, token, raw `userId`, title, note or raw error string is added. A
URL/base mismatch already present in `persistedSyncState` remains visible. The
diagnostic is recomputed on selection, URL change, native user change and sync
state change.

### 8. UI composition and accessibility

`site/index.html` gains a workspace panel with a labelled select, a status
region, and four buttons: select, suspend, logout, purge. Destructive actions
open an inline confirmation region that identifies the workspace and effective
base in plain text, shows the pending-change warning, offers “Annuler” and
“Télécharger une sauvegarde JSON”, and requires a separate confirmation button.
Focus returns to the initiating control after cancellation; busy states disable
double submission. All labels are French text nodes, never HTML.

The account-mismatch state reuses the same panel and the auth panel, with a
business view hidden rather than partially rendered.

### 9. Tests and verification

Pure tests cover registry parsing/migration, A/B/A selection, deterministic and
colliding base names, binding states, pending plans, logout/purge orchestration
against fake adapters (including asserting no table/remote delete call),
suspension status and redacted diagnostic rows. Static integration tests assert
that `index.html` contains the labelled controls, `app.js` imports the module
and calls native logout/physical deletion only through the orchestration, the
new file is included in `npm run check`, and no new dependency or schema version
is introduced. `npm run check` and `openspec validate ts-038 --strict
--no-interactive` are the pre-sync gates.

## Risks / Trade-offs

- **Native logout behavior is not executable on the runner** → verify the pinned
  addon behavior by source inspection, test the orchestration contract with
  injected adapters, and keep real-browser/Cloud verification in Manual
  acceptance.
- **Mutation-store counting uses addon internals** → return `unknown` and warn
  conservatively when inspection fails; never claim “no pending changes” without
  evidence.
- **Legacy unbound cache has no provable owner** → hide business records until
  explicit logout/re-authentication or purge; this may require one-time friction
  for legacy users but prevents cross-account exposure.
- **Per-URL base name changes could orphan legacy caches** → keep the legacy
  name for migrated entries and never delete the old base.
- **Closing a base may not immediately settle native work** → reload after
  selection when needed; the pure plan never assumes a close cancelled an
  in-flight push, and the diagnostic keeps “indeterminate” when evidence is
  missing.
- **Registry corruption could block or misroute** → fail closed, keep legacy keys,
  never purge on unreadable state.
- **Manual acceptance may reveal UX wording/placement issues** → labels and
  placement are implementation details; behavior constraints remain unchanged.

## Migration Plan

1. Deploy the pure module, foundation helper, activation status extension, app
   wiring, UI and tests as a static change.
2. On first startup, if a legacy config exists and no registry does, synthesize
   one entry with the current base name and activation status. Do not rename,
   delete or copy any base.
3. Existing activation records remain valid; `suspended` is a new accepted
   status, and unknown statuses still degrade to `null`/local safely.
4. Rollback: removing the new code leaves the legacy config/activation keys and
   all IndexedDB bases intact. New registry entries and hashed bases are simply
   ignored; they are never deleted by rollback.
5. No Dexie schema version, dependency, service configuration or secret changes.

## Open Questions

None that change the specs, approach or task breakdown. The exact French labels,
panel placement, and whether the browser implementation also counts a
plain `persistedSyncState` pending flag are implementation details that do not
alter the required observable behavior.
