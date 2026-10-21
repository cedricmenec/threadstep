# Tasks

## 1. Pure report, allowlist and clipboard behavior

- [x] 1.1 Add a pure report module with `buildSyncDiagnosticReport(input)` producing stable Markdown sections and keys for timestamps, application, browser, workspace, network, session, connection, phase, initial pull, local writes, remote evidence, binding, errors, bootstrap, retry, lifecycle, limitations and suggested checks; verify with `node --check` and a unit test asserting every section key and the local/UTC timestamps from an injected clock.
- [x] 1.2 Implement source-level allowlist projection, anonymous workspace labels, masked Cloud origin, `non disponible`/`indéterminée` fallbacks, browser family/version extraction and optional build value; verify with a deterministic unit test using trapped emails, OTPs, tokens, cookies, account ids, raw URLs, server messages, stacks, titles and notes, asserting none appear in the report or preview.
- [x] 1.3 Implement truthful session and remote-evidence wording, including the 21 October Android incident, the four session distinctions, separate observed fact/cause/safe checks, no remote success from native phase, and separate missing-proof/masked-cache/empty-local-base wording; verify with tests for `loading`, `signed-out`, `authenticated`, `refused`, offline, pull pending/failed/complete and cache `UNVERIFIED`.
- [x] 1.4 Add an injectable clipboard helper and a DOM-free sharing controller covering preview, copy, status and manual fallback; verify with tests for clipboard success, missing API and rejected promise, exact preview/copied text equality, no success message on failure, report recomputation after a new diagnostic and preservation of a still-valid preview state.
- [x] 1.5 Add static tests asserting the report module performs no storage, network, telemetry or DOM access and exposes no raw-share option; verify the new tests pass.

## 2. Bounded lifecycle instrumentation

- [x] 2.1 Add a bounded in-memory instrumentation module recording `db.open()` as not started/pending/resolved/failed, initial emission and last change for `currentUser`, `syncState` and `persistedSyncState`, and OTP request/launch/outcome; verify with tests for each state, rounded and capped ages, missing chronology as `non disponible`, fixed bounds and absence of persistent storage.
- [x] 2.2 Wire the instrumentation passively around `syncedDatabase.open()`, the existing native subscriptions and the OTP login adapter, without adding a subscription, request, login, pull or write; verify with a source-level test of the wiring and `node --check site/app.js`.
- [x] 2.3 Feed the instrumentation snapshot into the report and verify with tests that present measurements appear with bounded ages while an unavailable snapshot keeps every lifecycle field `non disponible` and does not block report generation.

## 3. Sharing surface and continuity

- [x] 3.1 Add the always-enabled copy button, keyboard-operable preview and dedicated `role="status"` live region to the diagnostic rendering, with mobile-friendly styles and a 44 px touch target; verify with deterministic static checks of the DOM and styles that the button is not gated by session or remote state and that the preview is selectable read-only text.
- [x] 3.2 Wire preview and copy handlers to the sharing controller so the report is built only on user action, clipboard refusal or absence opens the manual fallback, and the click path does not call diagnostic refresh, retry, login, pull, import or storage; verify with controller tests and source-level assertions on the handler.
- [x] 3.3 Preserve preview-open state across a native diagnostic re-render and restore the sharing control after DOM replacement; verify with deterministic tests of the sharing controller and static checks of the rendering code that a newer diagnostic replaces stale report text while preserving still-valid sharing state.
- [x] 3.4 Add static tests for accessible naming, `role="status"`, non-color-dependent feedback, absence of executable HTML interpolation, and absence of new persistence keys or network APIs in the sharing path; verify the tests pass.

## 4. Integration checks

- [x] 4.1 Register the new site modules in the `npm run check` syntax checks and verify the updated command parses them successfully.
- [x] 4.2 Run `node --test tests/ts-051-*.test.mjs`, then `npm run check`, then `openspec validate ts-051 --strict --no-interactive`; report actual results and do not mark this task complete if any command fails.

## Manual acceptance

- On a real Chrome Android phone and tablet, in portrait and landscape, open `#/parametres/synchronisation` with a session kept in `loading` and a simulated blocked bootstrap: verify the copy button is visible and usable without leaving the page.
- Verify the real clipboard content exactly matches the visible preview, contains no personal or business data, and that navigation, focus and scroll position are preserved after preview and copy.
- Repeat with clipboard permission denied and with the clipboard API unavailable: verify the full report remains selectable and an accessible manual-copy instruction is announced.
- Check touch targets, keyboard Tab/Enter/Space operation, focus visibility and screen-reader announcement of the copy status.
- Keep an anonymized record of the recipe; never paste a real report into the public repository. These checks are pending human acceptance and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the archived canonical spec with the intended `sync-diagnostic-sharing` requirements and scenarios.
- Verify the archived change content and that no application, product, backlog, workflow, secret or protected factory file was modified outside the authorized scope.
- After PR publication, verify the independent GitHub `check` on the exact final SHA, required branch protection, merge evidence, post-merge CI and GitHub Pages deployment.
- Review the manual Android recipe results separately from the simulated CI evidence, and state clearly what was validated on real Dexie Cloud versus what remains unverified. This stage is external to `apply` and contains no checkbox.
