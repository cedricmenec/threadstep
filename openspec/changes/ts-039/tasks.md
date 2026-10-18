# Tasks

## 1. Acceptance matrix and report contract

- [ ] 1.1 Create `scripts/product/e2e-matrix.mjs` with the evidence constants (`ci`, `real-dexie`, `limitation`, `incident`), status constants, `REQUIRED_DOMAINS`, declarative `MATRIX` entries, `runAcceptanceMatrix()` and `formatAcceptanceReport()`; add `tests/product-e2e-matrix.test.mjs` asserting the report is frozen, deterministic across two runs and exposes distinct CI, real-instance, limitation and incident sections.
- [ ] 1.2 Implement canonical traceability validation in the matrix module by parsing capability paths and exact `### Requirement:` headers from `openspec/specs/**/spec.md`; add tests for a valid reference, an unknown capability and an unknown requirement header.
- [ ] 1.3 Implement required-domain coverage checks so every domain in `REQUIRED_DOMAINS` has at least one CI scenario and an explicit manual or limitation entry; add tests where a missing domain fails with the domain name and where a scenario without CI evidence cannot be reported as passed.
- [ ] 1.4 Implement report status rules so an open incident makes the global report non-`ok`, an unexecuted manual observation stays `pending`/`not-run`, and a failing check stays failed; add deterministic tests for each transition.
- [ ] 1.5 Add redaction and purity assertions to `tests/product-e2e-matrix.test.mjs`: the source uses no network, clock, randomness, filesystem, process environment, paid-service reference or repository write, and the generated report text exposes no secret or business field from the synthetic fixtures.

## 2. Deterministic journey scenarios

- [ ] 2.1 Add local-only scenarios proving empty autonomous bootstrap without Cloud, create/edit/reload persistence with relations, stable fingerprints and no Cloud call; expose them through the matrix and verify with `node --test tests/product-e2e-matrix.test.mjs`.
- [ ] 2.2 Add activation and synchronization scenarios for no transfer before consent, verified-empty, populated, divergent, unavailable and identity-mismatch targets, local commit versus pending versus native completion, and a distinct network-error state; verify each scenario produces a passing deterministic check.
- [ ] 2.3 Add data lifecycle scenarios for raw V1 and IndexedDB JSON reimport idempotency, absence of `legacy:legacy:`, merge versus restore semantics, deterministic conflict copies, concurrent plans and rollback without partial writes; verify each assertion in the same test file.
- [ ] 2.4 Add workspace scenarios for A/B/A URL isolation, account mismatch on one URL, logout versus purge separation, pending-change warning and redacted URL/session diagnostics; verify each scenario in the same test file.
- [ ] 2.5 Add cross-cutting scenarios and assertions covering observable states, persistence, fingerprints, security redaction and repeated-run idempotence; verify that each cross-cutting guarantee appears in the report and is linked to at least one required domain.
- [ ] 2.6 Add a test reproducing the reference V1 fixture of 5 subjects and 18 steps through the local persistence and reconciliation modules, asserting that all subjects, steps, substeps, notes, priorities, orders and relations survive the deterministic acceptance path.

## 3. Manual protocol, evidence report and legacy audit

- [ ] 3.1 Add `docs/product/e2e-certification.md` containing the required-domain matrix, the isolated-instance protocol conditions required by `threadstep-integration-profile`, the test-data and secret rules, the historical V1 recovery procedure and the report template separating CI evidence, real Dexie evidence, limitations and incidents; add a static test asserting each named topic is present.
- [ ] 3.2 Add the report template sections for `CI`, `Recette Dexie réelle`, `Limites` and `Incidents ouverts`, with explicit non-executed and partial states; add a static test that the template never labels an unexecuted observation as accepted.
- [ ] 3.3 Add a legacy-capability audit section in `docs/product/e2e-certification.md` naming `dexie-cloud-configuration`, `dexie-local-database`, `email-otp-authentication`, `legacy-document-migration`, `local-first-business-persistence` and `cloud-migration-reconciliation`, recording that no archived file was modified and stating the conclusion for any requirement-level contradiction; add a static test asserting the six names and the no-archive-rewrite statement are present.
- [ ] 3.4 Link the new protocol and report from `docs/product/developer-guide.md` and `docs/product/acceptance-checklist.md`, keeping manual results distinct from CI; add a static test asserting both documents reference `e2e-certification.md` and distinguish automated from manual evidence.
- [ ] 3.5 Add a static test that the protocol and generated report text contain no email address, OTP value, token, credential-bearing URL or real user title/note pattern, and that fixtures use only synthetic `legacy:` identifiers and example `*.dexie.cloud` hosts.

## 4. Repository checks

- [ ] 4.1 Add `node --check scripts/product/e2e-matrix.mjs` to the `check` script in `package.json`; add a test asserting the check chain covers the new module and that no runtime dependency or Dexie schema version changed.
- [ ] 4.2 Run `node --test tests/product-e2e-matrix.test.mjs` and `npm test`; record the actual pass/fail counts and do not check this item if any test fails.
- [ ] 4.3 Run `npm run check`; record the actual output and keep this item unchecked if the command fails.
- [ ] 4.4 Run `openspec validate ts-039 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-039/tasks.md`; report both results and keep this item unchecked if either fails.

## Manual acceptance

- Prepare an isolated Dexie Cloud test instance, two independent Chrome profiles and a Chrome mobile profile, with a synthetic V1 fixture (5 subjects, 18 steps, notes, mixed priorities, `done` states and substeps) and a readable fallback export. Never use a personal base or personal document. Record the instance category, browser versions, device, date and commit SHA without exposing the Cloud URL, account, OTP or business content.
- Start with the autonomous local workspace offline: create, edit, complete, reorder and remove subjects and steps, reload, and confirm that the same records and relations return with no Cloud request and no OTP. Check the historical `threadstep.document.v1` notice and export unchanged.
- Activate Cloud from the populated local workspace with a real OTP email session: verify that no local record is transmitted before the displayed reconciliation plan is explicitly accepted, then observe the local commit, pending synchronization and remote completion as separate states.
- Exercise a verified-empty target and a populated target; introduce a divergence, a dependent conflict and a change between preview and confirmation, and confirm that the previous consent is refused with no overwrite or duplicate.
- On both browsers, create and edit independent subjects and substeps in each direction, including a reconnect after offline and an intermittent network interruption; verify propagation A→B and B→A, pending-write warnings, retry without duplication and preservation of every relation after reload.
- Reimport the same JSON twice, then restore an older test backup: confirm idempotency, no `legacy:legacy:`, explicit merge-versus-restore intent and preservation of subjects, steps, notes, priorities, orders, `done` states and parent relations.
- Test logout with pending writes and local purge separately on the isolated test instance: verify the warning, cancellation, JSON snapshot, native logout behavior, absence of remote business deletion and recovery of the autonomous workspace. Test an A/B/A URL switch and a session change on one URL, confirming that no other workspace's data is shown, exported or copied.
- On Chrome mobile and desktop, inspect the activation, reconciliation, diagnostic, workspace and recovery panels visually; navigate only with Tab/Enter/Space/Escape; check focus return, accessible names, live-region announcements, touch targets of at least 44 px and screen-reader output. Capture only redacted status screenshots.
- These observations require a real browser, real IndexedDB, a real OTP email and real network conditions. They are not proven by the Node matrix, carry no checkbox here, and remain pending until their evidence is recorded.

## Post-sync review

- After the separate OPSX semantic sync, compare each delta against the canonical specs for `e2e-certification` and `threadstep-integration-profile`, verify the intended ADDED requirements and confirm that archived history and canonical wording were not silently rewritten.
- Check the archived OpenSpec change and its versioned contents, including the evidence classes, required-domain list, manual protocol and legacy-capability audit.
- After the PR is published, verify the independent GitHub `check` on its exact SHA, the required protection, the merge evidence, post-merge CI on `main` and the Pages deployment.
- Review any incident recorded during the manual campaign and keep its status separate from the automated report; never present an unexecuted or partially executed manual check as passed.
- This review is external to `apply`, contains no checkbox and remains open until its evidence exists.
