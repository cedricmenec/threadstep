# Design

## Context

See `proposal.md` — Why. ThreadStep is a static vanilla-JS app: `site/index.html`
currently sets `connect-src 'none'` and loads `./app.js`/`./styles.css` through
relative paths; `site/core.js` holds pure domain functions; `site/app.js` owns
the DOM, `localStorage` (`threadstep.document.v1`, `threadstep.resume.v1`), JSON
export/import and focus. There is no front-end build and no runtime dependency
today. Tests are deterministic Node tests over `site/core.js` plus static source
assertions (`npm test` = `node --test tests/*.test.mjs`); there is no DOM or
IndexedDB test runner. `npm run check` adds `node --check` for `site/core.js` and
`site/app.js`. The `apply` workflow treats `scripts/*`, `openspec/config.yaml`,
workflows, `AGENTS.md` and `docs/factory/*` as protected paths and forbids the
agent from editing them.

TS-024 is the first change that adds an external runtime dependency, a browser
configuration UI and a network CSP exception. That shapes the approach: keep the
decision logic pure and Node-testable, keep the browser-only Dexie/Cloud opening
behind a small explicitly gated bootstrap, and verify the security boundary by
static inspection of the delivered files.

## Goals / Non-Goals

**Goals:**
- A deterministic, unit-testable core for URL validation, the bootstrap gate, the
  `configure` options and the schema/identifier convention.
- A single bootstrap path that opens the synchronized base only after a valid
  local configuration and always configures Dexie Cloud with `requireAuth: true`.
- A local, non-synchronized configuration store, distinct from the document and
  from the JSON export.
- A strict, Pages-compatible CSP and a bundle free of secrets, Dexie CLI files
  and any imposed user URL.
- Deterministic tests for every TS-024 acceptance criterion that can be proven
  without a real service or browser; the rest stays in Manual acceptance.

**Non-Goals:**
- Business table CRUD, the localStorage V1 migration, the OTP UI, the sync
  indicator/diagnostic view, logout/purge and the consolidated guarantee suite.
- Any transaction, conflict-resolution, cross-base copy or automatic cloud
  transfer.
- Editing protected factory files, configuration, workflows or secrets.

## Decisions

### Decision: pure decision core, thin browser bootstrap

Put the testable logic in pure functions (in `site/core.js` or a new pure
`site/` module) and keep `site/app.js` responsible only for DOM and Dexie wiring.
New pure functions:

- `validateCloudUrl(raw)` → `{ valid, url, reason }`: requires an absolute
  `https:` URL whose host is under `dexie.cloud`, rejects credentials/userinfo,
  queries and fragments if unsupported, normalizes the origin, and performs **no**
  network call.
- `shouldOpenSyncedDatabase(config)` → `boolean`: `true` only for a syntactically
  valid configuration.
- `cloudConfigureOptions(databaseUrl)` → `{ databaseUrl, requireAuth: true }`:
  never sets `nameSuffix: false`, so the native suffix stays active.
- `dexieSchema()` and `validateSynchronizedStores(stores)` → an explicit integer
  version plus stores keyed by globally unique string identifiers (`@id`), with a
  validator that rejects any `++id`.

Rationale: matches the existing `site/core.js` + static-assertion test style and
lets the runner prove the schema, ID, `nameSuffix` and `requireAuth` guarantees
without a browser. Alternative rejected: inline logic in `app.js`, which a static
string assertion proves only weakly.

### Decision: local non-synchronized configuration key

Store the URL under a dedicated browser-local key (for example
`threadstep.cloud.config.v1`) with read/write/clear helpers. It is not a Dexie
synchronized store, not part of the document and not part of the JSON export.
Rationale: the specification requires origin-scoped local storage that is not
synchronized; a separate key also avoids touching `threadstep.document.v1` and
keeps rollback trivial.

### Decision: syntax-only validation and a static CSP allowlist

Validation is purely syntactic and network-free so a configured base can be
recognized offline. Because validation restricts the host to the `dexie.cloud`
family, the CSP can be a **static** allowlist:
`connect-src https://*.dexie.cloud wss://*.dexie.cloud` (keeping `script-src
'self'`, `default-src 'self'` and the other directives). Alternative rejected:
allowing arbitrary HTTPS hosts, which would require a broad or dynamic
`connect-src` incompatible with the « strict, Dexie Cloud-only » requirement.

### Decision: additive coexistence with the localStorage MVP

TS-024 adds the synchronized foundation without removing or rewriting the
existing localStorage path, and the configuration screen gates only the
synchronized Dexie bootstrap. Rationale: the rollout plan forbids publishing an
intermediate state that hides historical V1 data before migration (TS-026). This
also keeps existing capabilities and their tests unchanged.

### Decision: reproducible vendored assets instead of a runtime CDN

Pin `dexie` and `dexie-cloud-addon` in `package.json` + lockfile and deliver
their ESM builds as committed local assets under `site/`, referenced through a
local import map (or equivalent), so the page loads no third-party CDN script and
works under `/threadstep/`. Tests assert the assets exist, are referenced
locally, carry the pinned version, and that no CDN URL appears in `index.html`.
Alternative rejected: CDN `<script>` tags, forbidden by the task. The exact
tooling is flagged as an assumption to confirm (proposal uncertainty 3); any
build/refresh helper must live outside the protected `scripts/*` path.

### Decision: no Dexie CLI files or environment secrets in the bundle

The Dexie CLI files `dexie-cloud.key`/`dexie-cloud.json` stay out of the sources
and the delivered assets (added to `.gitignore`); the build reads no secret env
var into `site/`. A deterministic inspection test scans the `site/` files and the
built output for those filenames, admin-token/secret patterns and hardcoded
instance URLs.

### Decision: test strategy

Add `tests/dexie-foundation.test.mjs` covering: `validateCloudUrl` (valid,
non-HTTPS, malformed, credentials, non-dexie host, offline no-network),
`shouldOpenSyncedDatabase`, `cloudConfigureOptions` (`requireAuth: true`,
`nameSuffix` not disabled), the schema (explicit version, `@id`, no `++id`,
non-destructive upgrade convention) and static assertions over `site/index.html`
(CSP), `site/app.js` (gate before `new Dexie`/`configure`, no imposed URL) and
`site/`+`.gitignore` (no secrets/CDN). The consolidated guarantee suite stays with
TS-030. Real browser, touch, keyboard, focus, screen-reader and real-service
behavior stays in Manual acceptance.

## Risks / Trade-offs

- [Adding the first runtime dependency and vendoring increases supply-chain and
  reproducibility risk] → Pin exact versions in `package.json` + lockfile, commit
  the vendored assets, assert their pinned version, and keep no CDN reference;
  confirm the mechanism with the policy owner.
- [A strict `dexie.cloud`-only CSP could block a legitimate custom Cloud host] →
  Recorded as an explicit assumption (proposal uncertainty 2); validation and CSP
  are aligned so an accepted URL is always allowed and rejected URLs are refused
  before use.
- [The configuration screen could hide existing localStorage data] → The
  foundation is additive and gates only the synchronized path; confirmed by
  non-regression tests and Manual acceptance of the first-launch flow.
- [The prerequisite policy PR is not merged] → Apply must not start until it is;
  the plan is written to be reviewable but the implementation is blocked.
- [Static assertions can drift from runtime behavior] → Keep the decisive logic
  in pure functions tested directly; use static assertions only for wiring,
  CSP and bundle-content facts that cannot be unit-tested in this repo.

## Migration Plan

No data migration: the change is additive and does not modify
`threadstep.document.v1`, its export or the routes. Deployment is the normal
static PR to `main` plus GitHub Pages. Rollback is reverting the PR: any stored
document stays valid because nothing in the stored shape changes, and no existing
IndexedDB base is deleted by the foundation.

## Assumptions requiring confirmation before apply

These restate the proposal's uncertainties; none is silently treated as decided:

1. The existing localStorage MVP stays functional behind the synchronized
   configuration gate (no Dexie bootstrap without a valid URL).
2. « Compatible avec Dexie Cloud » means an HTTPS host under `dexie.cloud`.
3. Pinned vendored ESM assets are the accepted packaging mechanism.
4. TS-024 fixes the schema convention and explicit version; detailed ThreadStep
   table modeling may remain with TS-025.
5. Any build/refresh tooling lives outside the protected `scripts/*` path.
6. The external policy prerequisite in `proposal.md` is merged before `apply`.
