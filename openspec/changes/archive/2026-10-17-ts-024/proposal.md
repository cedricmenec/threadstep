# Proposal

## Why

ThreadStep's product contract now targets a local-first IndexedDB base managed by
Dexie.js and synchronized by Dexie Cloud
([spec](../docs/product/specs/dexie-cloud-local-first.md)). TS-024 lays the
mandatory foundation those changes depend on: an explicitly configured local
Cloud instance and a versioned synchronized schema that must exist before any
synchronized database is opened, without weakening the current frontend security
boundary. Without it, TS-025–TS-030 have no defined or secure bootstrap.

## What Changes

- Deliver `dexie` and `dexie-cloud-addon` as pinned, reproducible local client
  assets served from the `/threadstep/` static subpath, with no third-party CDN
  script at runtime.
- Let the user record the Dexie Cloud instance URL in **local non-synchronized
  storage**, validated **purely syntactically** (HTTPS, Dexie Cloud-compatible,
  network-independent), and show an accessible mandatory configuration screen
  when no valid URL exists.
- Declare an explicitly versioned Dexie schema whose synchronized stores use
  globally unique string identifiers (`@id`), never `++id`, with explicit
  non-destructive upgrades; keep a stable database name and the native
  `nameSuffix`.
- Call `db.cloud.configure({ databaseUrl, requireAuth: true })` before any
  access that would open the synchronized base; report an unreachable-but-valid
  service without deleting the configuration or existing IndexedDB bases.
- Restrict the CSP `connect-src 'none'` to the Dexie Cloud HTTPS/WSS hosts only,
  keep the site compatible with the repository subpath, and exclude
  `dexie-cloud.key`/`dexie-cloud.json`, credentials, admin tokens and any imposed
  user URL from the delivered bundle.
- Add deterministic tests for the schema/version/IDs, `nameSuffix`,
  `requireAuth`, purely syntactic URL validation, CSP and the static asset paths.

**BREAKING (product/agent policy only, not stored runtime data):** the historical
prohibition of cloud, authentication and JavaScript dependencies is superseded by
the new product specification. This plan does not edit protected factory policy;
see the prerequisite below.

## Capabilities

### New Capabilities

- `dexie-cloud-configuration`: local non-synchronized Cloud URL configuration,
  syntax-only validation, the mandatory pre-open configuration screen,
  `requireAuth` configuration, and non-destructive handling of an unreachable
  service.
- `dexie-local-database`: the explicitly versioned Dexie schema with globally
  unique synchronized identifiers, non-destructive upgrades, a stable database
  name and native `nameSuffix` selection.
- `frontend-security-boundary`: no secrets, admin tokens, Dexie CLI files or
  imposed user URL in the delivered bundle; reproducible vendored assets with no
  runtime CDN; strict CSP `connect-src` allowlist and subpath compatibility.

### Modified Capabilities

- None. Existing UI capabilities keep their behavior; TS-024 adds a foundation
  and changes neither the stored document shape nor the current features.

## Non-goals

- Migrating business operations or the localStorage V1 document (TS-025/TS-026),
  the OTP authentication journey (TS-027), the global synchronization indicator
  and diagnostic view (TS-028), logout/purge (TS-029) and the consolidated
  guarantee suite (TS-030).
- Enabling transactions, conflict resolution, schema conversion between bases or
  any automatic cloud transfer of existing local data.
- Editing `AGENTS.md`, `openspec/config.yaml`, workflows, secrets `/` execution
  configuration or any other protected factory file.

## Impact

- `site/`: new bootstrap/configuration module(s), the configuration screen and
  vendored Dexie assets; `index.html` CSP and asset references updated for the
  repository subpath.
- `package.json` and its lockfile: pinned `dexie`/`dexie-cloud-addon`
  dependencies used to produce the vendored assets.
- `tests/`: new deterministic Node tests (pure URL validation, gate, schema and
  configure options) plus static assertions over the `site/` files.
- `docs/product/developer-guide.md` and the MVP evolution note are updated during
  `apply` to describe the foundation; the product specification stays normative.
- No change to `threadstep.document.v1` or to the existing UI behavior.

## Prerequisite (external, non-negotiable)

The backlog requires lifting, by a **separately reviewed policy PR**, the
historical factory incompatibility that still forbids cloud, authentication and
JavaScript dependencies. In this repository the OpenSpec project context
(`context` in `openspec/config.yaml`) still states « Do not add a server,
authentication, telemetry or dependencies », while `AGENTS.md`, `vision.md` and
`mvp.md` have already been recentered on the Dexie Cloud evolution. That factory
reconciliation is outside this change's allowed scope and is **not** implemented
here: the product agent must not modify `AGENTS.md` or `openspec/config.yaml`.
`apply` must not start until the prerequisite is merged; it blocks a truthful
implementation, not the writing of this plan.

## Uncertainties (no product decision invented)

1. **Scope of « aucune opération métier ».** The safe reading adopted by the
   specs is: no *synchronized Dexie* database is opened and no Dexie business
   query runs without a valid URL, while the existing localStorage MVP stays
   functional so historical V1 data is never made invisible (the rollout plan
   forbids such an intermediate state). Whether the existing MVP must itself be
   gated behind the configuration screen needs product confirmation.
2. **URL « compatible avec Dexie Cloud » and strict CSP.** Dexie Cloud instances
   are assumed to live under `dexie.cloud`, so validation accepts HTTPS URLs
   whose host is under `dexie.cloud` and the CSP allowlist covers only that host
   family. Accepting arbitrary HTTPS hosts would conflict with a strict CSP and
   needs confirmation.
3. **Packaging and reproducibility.** The project has no bundler today. This plan
   proposes pinned vendored ESM assets referenced through a local import map as
   the smallest reproducible option; the exact mechanism adds dependencies and
   tooling and should be confirmed with the factory/policy owner.
4. **Schema granularity.** TS-024 fixes the versioned-schema convention, the
   globally unique identifiers and the explicit version; the concrete ThreadStep
   table modeling and operational adapter may remain with TS-025.
5. **Human prerequisites.** Real acceptance needs a Dexie Cloud test instance and
   an authorized Pages origin. The runner performs no service call; automated
   TS-024 tests must be offline and deterministic.
6. **`apply` scope guard.** The workflow forbids changes under `scripts/*` during
   apply, so any build/refresh tooling must live in an allowed path.
