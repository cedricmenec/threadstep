# Tasks

Prerequisite (external, non-negotiable, not an apply task): the separately
reviewed policy PR described in `proposal.md` must be merged before `apply`,
because the OpenSpec project context still forbids cloud, authentication and
JavaScript dependencies while `AGENTS.md`, `vision.md` and `mvp.md` already allow
the Dexie Cloud evolution. The product agent must not edit `AGENTS.md`,
`openspec/config.yaml`, workflows or secrets. Until the prerequisite is merged,
implementation must not start.

## Implementation checklist (pre-sync, apply only)

### 1. Reproducible local dependencies and assets

- [ ] 1.1 Pin `dexie` and `dexie-cloud-addon` to exact versions in `package.json` with a committed lockfile and deliver their ESM builds as local assets under `site/`; verify with deterministic Node tests that the assets exist, are referenced from `site/index.html` through a local path, and that no third-party CDN URL appears in the delivered HTML.
- [ ] 1.2 Extend the `node --check` coverage in `package.json` to every new `site/` module; verify `npm run check` passes and report the real output.

### 2. Pure configuration, validation and gate logic

- [ ] 2.1 Add a pure `validateCloudUrl(raw)` to a pure `site/` module that accepts only absolute HTTPS URLs whose host is under `dexie.cloud`, rejects malformed input and embedded credentials, and performs no network call; verify with deterministic Node tests for the valid, non-HTTPS, malformed, credentialed and foreign-host cases, and assert statically that the module contains no network primitive.
- [ ] 2.2 Add pure `shouldOpenSyncedDatabase(config)` and `cloudConfigureOptions(databaseUrl)` functions that return `requireAuth: true` and never disable `nameSuffix`; verify with deterministic Node tests that the gate is false without a valid configuration and for invalid URLs, true for a valid one, and that the produced options keep `requireAuth: true` and omit `nameSuffix: false`.
- [ ] 2.3 Add local non-synchronized configuration storage helpers on a dedicated key (read, write, clear) that never touch `threadstep.document.v1` or the JSON export; verify with deterministic Node tests and a static assertion that the configuration key differs from the document key and never appears in the serialized document.

### 3. Explicitly versioned Dexie schema

- [ ] 3.1 Declare the explicit Dexie version and synchronized stores with globally unique `@id` string keys; verify with deterministic Node tests that the version is an explicit integer and that no store declares `++id`.
- [ ] 3.2 Add a pure `validateSynchronizedStores(stores)` helper and a non-destructive upgrade convention; verify with deterministic Node tests that a `++id` store is rejected, an `@id` store is accepted, and the declared upgrade performs no implicit deletion.
- [ ] 3.3 Add a stable database-name constant and assert the native `nameSuffix` is never disabled; verify with deterministic Node tests that the name is unchanged across the declared schema version and that the Cloud options keep the native suffix active.

### 4. Browser bootstrap, configuration form and CSP

- [ ] 4.1 Add the browser bootstrap that constructs and opens the synchronized database only when `shouldOpenSyncedDatabase` returns true and calls `db.cloud.configure` with `cloudConfigureOptions` before any base-opening access; verify with deterministic static assertions over `site/app.js` that every construction and configuration is guarded by the gate, that no Dexie CLI filename is referenced, and with `node --check`.
- [ ] 4.2 Add the accessible configuration form shown when no valid URL exists, with no Dexie business query issued in that state; verify with deterministic static assertions over `site/app.js` that the form is gated on the missing or invalid configuration and that the bootstrap returns before any Dexie operation.
- [ ] 4.3 Replace `connect-src 'none'` in `site/index.html` with an allowlist limited to `https://*.dexie.cloud` and `wss://*.dexie.cloud`; verify with a deterministic Node test that `connect-src` is no longer `'none'`, contains only those two hosts, keeps `script-src 'self'`, and uses relative asset paths.

### 5. Bundle inspection, documentation and final gate

- [ ] 5.1 Add `.gitignore` entries and a deterministic inspection test that scans the `site/` sources and delivered assets for `dexie-cloud.key`, `dexie-cloud.json`, administrative-token or secret patterns and hardcoded instance URLs, asserting that none is present.
- [ ] 5.2 Update `docs/product/developer-guide.md` and the MVP evolution note to describe the foundation; verify with deterministic assertions that the new text is present and that the historical no-dependency wording for this scope is reconciled.
- [ ] 5.3 Run `npm run check`, `openspec validate ts-024 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-024/tasks.md`, report the exact commands and their real output, and do not mark any earlier task complete if any of them fails.

## Manual acceptance

- On a real desktop and mobile browser, exercise the first-launch journey: with no
  configuration the accessible configuration form is presented, an invalid or
  non-HTTPS URL is refused with a clear message, a valid Dexie Cloud URL is
  accepted and reused after a reload, and no network request is made before a
  valid configuration exists.
- Against a **test** Dexie Cloud instance and an authorized Pages origin, verify
  that the native OTP email sign-in is offered with `requireAuth: true`, that no
  other sign-in method is exposed, and that no task content is sent before
  configuration and consent.
- Navigate the configuration flow with the keyboard alone (Tab, Enter, Space,
  Escape), confirm a visible focus indicator, coherent accessible names and
  errors announced to assistive technology, and check touch target sizes and the
  mobile layout.
- Verify the offline path: a configured URL is recognized with no network, an
  unreachable service shows a connection or synchronization error, the
  configuration and existing IndexedDB bases are preserved, and a return to the
  network resumes contact with the service.
- Confirm that the existing localStorage MVP data stays visible and usable during
  this transitional change, and that the site loaded from the repository subpath
  resolves its local Dexie assets under the strict CSP.
- These are pending human acceptance, not completed by any green Node test, and
  contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical deltas for
  `dexie-cloud-configuration`, `dexie-local-database` and
  `frontend-security-boundary` (all ADDED) against the intended behavior and
  confirm that no other requirement changed.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the
  exact head SHA, the required branch protection, the merge evidence and the
  post-merge CI / GitHub Pages deployment.
- This stage is external to `apply`; these reviews contain no checkbox and must
  never be marked complete before their evidence exists.
