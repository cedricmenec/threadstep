# Tasks

## 1. Diagnostic page markup, summary surface and styles

- [x] 1.1 Move the existing `<section id="sync-diagnostic" aria-labelledby="sync-diagnostic-title" hidden>` markup from its global position into `#settings-sync-page`, preserving the identifier, `aria-labelledby`, hidden default and every dynamically rendered child contract; add static assertions in `tests/ts-043-sync-page.test.mjs` that the identifier occurs exactly once, only inside `#settings-sync-page`, and that no copy remains elsewhere in `site/index.html`.
- [x] 1.2 Add the descriptive sections « Configuration », « Première activation », « Connexion » and « Espaces de travail » inside `#settings-sync-page` with explanatory French text stating that their controls remain at their current location until TS-044; add static assertions for the four headings and assert that the section block contains no `form`, `input`, `select`, `button`, `#cloud-config`, `#cloud-activation`, `#auth-panel` or `#workspace-panel`.
- [x] 1.3 Add a single `#sync-summary` status surface outside the settings pages with `role="status"`, `aria-live="polite"`, a hidden initial state and no interactive descendant; add static assertions for its identifier, uniqueness, accessible attributes and absence of `button`, `a`, `input` or `select`.
- [x] 1.4 Add the page synthesis container `#sync-diagnostic-summary` to the diagnostic page contract rendered by `site/app.js`, so the page always exposes a short current-state summary above the technical rows; add source assertions that it is created once per `paintSyncDiagnostic` call and that it is not a retry control.
- [x] 1.5 Add and adjust `site/styles.css` rules for the diagnostic page sections, the page synthesis and `#sync-summary`, including `[hidden]` handling, readable wrapping and narrow-width behavior; add deterministic CSS assertions for the new selectors, the hidden rule and the existing diagnostic retry 44 px target.

## 2. Pure synthesis model, rendering and route visibility

- [x] 2.1 Add a pure `buildDiagnosticSummary(diagnostic)` model in `site/sync-diagnostics.js` that reuses `buildDiagnosticView`, returns a `needsAttention` flag and a short French text, states « Cloud non configuré » and « local uniquement » for an unconfigured local workspace, and never adds raw fields; add `tests/ts-043-sync-page.test.mjs` cases for local unconfigured, configured in-phase, connecting, offline, pending or failed initial pull, pending local write, session error and local read/write error.
- [x] 2.2 Add a deterministic secret-exposure test for `buildDiagnosticSummary` using raw inputs containing an email, OTP, token, title and note; assert that the returned summary and its serialization contain none of those values and that an unproven remote state is still described as indeterminate or not empty.
- [x] 2.3 Update `paintSyncDiagnostic` in `site/app.js` to render the page synthesis from `buildDiagnosticSummary` while preserving the existing `buildDiagnosticView` rows, errors, `role="status"`/`aria-live="polite"` status, `aria-describedby`, disabled reason and retry button; add source assertions for each preserved element and for the single `click` binding to `retrySyncInitialPull`.
- [x] 2.4 Add `applySyncSummaryVisibility` driven by `route.view === "overview"` and the latest pure summary, so `#sync-summary` is shown only on Mes projets with attention and hidden for a healthy unconfigured local workspace, a fully in-phase configured workspace, settings routes and project detail; add tests for the pure visibility decisions and source assertions that the helper only updates `hidden` and `textContent`.
- [x] 2.5 Call the summary visibility update from the existing render and diagnostic paint paths without calling `renderSyncDiagnostic`, `syncDiagnosticsController.refresh`, `setupSyncDiagnostics`, `retrySyncInitialPull`, `nativePullAdapter`, `.open(`, `fetch(`, `startAuthentication` or any storage write; add a source-level assertion that those calls are absent from the route, visibility and summary blocks.
- [x] 2.6 Add a deterministic test that `canRetryInitialPull` and the retry reason labels are unchanged for not-configured, unauthenticated, offline, already-synced, in-progress, refused and indeterminate states, proving that the page move does not alter the existing preconditions.

## 3. Subscription lifecycle, route non-regression and existing test adaptation

- [x] 3.1 Verify and, only if needed, minimally adjust `setupSyncDiagnostics` so it still subscribes exactly once per synchronized database to `cloud.syncState`, `cloud.persistedSyncState` and `cloud.currentUser`; add source assertions for the single subscription block, the `syncDiagnosticsSubscribedFor` guard and the absence of subscriptions in navigation, summary and paint helpers.
- [x] 3.2 Add a deterministic controller test that repeated `refresh()` calls with the same input yield the same diagnostic values and summary text, and that a second controller is not created by route or display changes; assert the test double's `subscribe` count stays unchanged across refreshes.
- [x] 3.3 Update `tests/ts-041-navigation.test.mjs` so its settings-page assertions expect `#sync-diagnostic` inside `#settings-sync-page` and the new overlay summary, while keeping route parsing, focus mapping, menu interactions and presentation-only assertions intact.
- [x] 3.4 Update `tests/ts-042-data-page.test.mjs` boundaries so the moved `#sync-diagnostic` no longer serves as the end marker after `#recovery-panel`; preserve its assertions on data-control uniqueness, restore guards and contextual backups, and add an assertion that the recovery panel still precedes the settings page in document order.
- [x] 3.5 Add static assertions that `#cloud-config`, `#cloud-activation`, `#auth-panel` and `#workspace-panel` still occur exactly once at their existing locations, are absent from `#settings-sync-page`, and keep their existing `site/app.js` selectors and handlers.
- [x] 3.6 Add a deterministic route test using `parseRoute` and `isViewEntry` for `#/`, `#/parametres/synchronisation`, a valid project and back to `#/`, asserting stable resolution and no side-effect function references; run `node --test tests/ts-041-navigation.test.mjs tests/ts-043-sync-page.test.mjs` and report the actual result.

## 4. Documentation, focused verification and integration checks

- [x] 4.1 Update `docs/product/guide-utilisation.md` and `docs/product/acceptance-checklist.md` to state that the full diagnostic and its summary live on `#/parametres/synchronisation`, that Mes projets keeps only a minimal attention summary, that the four future sections are descriptive, that sensitive configuration, activation, authentication and workspace controls remain at their current location, and that the manual pull stays in the diagnostic page with unchanged guards; add static documentation assertions in `tests/ts-043-sync-page.test.mjs`.
- [x] 4.2 Run `node --test tests/sync-diagnostics.test.mjs tests/ts-041-navigation.test.mjs tests/ts-042-data-page.test.mjs tests/ts-043-sync-page.test.mjs` and report the actual output; fix any failure before marking this item complete.
- [x] 4.3 Run `npm run check` and report the actual output; do not mark this item if any test or syntax check fails.
- [x] 4.4 Run `openspec validate ts-043 --strict --no-interactive` and report the actual result.
- [x] 4.5 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-043/tasks.md` and report the actual result.

## Manual acceptance

- On a real smartphone and a real desktop browser, open `#/parametres/synchronisation` from the Menu and verify the title, the current-state synthesis, the technical values, the four descriptive sections, the back link and the absence of horizontal overflow at 320 px and usual widths.
- With an isolated local profile and the network disabled, open the diagnostic page and verify that it clearly shows « Cloud non configuré » and « local uniquement », does not request an OTP, does not open a Cloud instance and does not emit a network request; compare the displayed values with the Mes projets summary.
- With an isolated Cloud test profile and an active session, verify session, connection, cache/base, initial pull, local writes, remote evidence and classified errors; simulate a network error and a reload and confirm that no empty Cloud is claimed, no retry is automatic and no business content or secret appears.
- Using keyboard only and a screen reader, verify focus after navigation, the diagnostic heading, the live status and error announcements, the disabled retry reason and the 44 px touch target of the retry action; verify that the minimal summary on Mes projets is non-interactive and is not announced twice when the full page is shown.
- Start an eligible manual pull retry, leave and return to the page by Menu, Précédent/Suivant and reload; verify that no second pull is launched implicitly and that the existing preconditions remain the only way to enable the action.
- Inspect the page visually and in the accessibility tree to confirm that `#cloud-config`, `#cloud-activation`, `#auth-panel` and `#workspace-panel` forms have not been moved or duplicated, and that their current workflows still behave as before.
- Use synthetic data and isolated profiles only; do not manipulate real production data. These checks require real devices, browsers, touch, keyboard and human/assistive inspection; they remain **to be verified** and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync, compare the `app-navigation` and `cloud-sync-lifecycle` deltas with the intended MODIFIED/ADDED behavior, especially the diagnostic page location, the overview attention summary, the descriptive placeholders and the preserved retry guards.
- Verify that canonical specs outside the approved deltas, archived changes, Cloud operations and the existing diagnostic algorithms were not modified beyond the presentation and summary change.
- Check the archived OpenSpec change and its versioned content.
- After PR publication, verify the independent GitHub `check` on the exact PR SHA, the required branch protection, the merge evidence and the post-merge `main` CI and GitHub Pages deployment.
- Compare the actual manual acceptance evidence with the mobile, keyboard, screen-reader, offline, reload and isolated-profile requirements; never report a check as passed before its evidence exists.
- This review is external to `apply`, contains no checkbox and remains open until its evidence exists.
