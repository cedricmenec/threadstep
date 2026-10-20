# Tasks

## 1. Trust model and attributed synchronization observation

- [ ] 1.1 Create `site/sync-trust-guidance.js` with pure constants and `buildTrustGuidance(input)` returning the mode label, local database name, destination, session, connection, phase, pending state, evidence levels, state explanation and five intent descriptors; verify with a Node test that the module contains no DOM, `localStorage`, IndexedDB or network access.
- [ ] 1.2 Add the exact-label assertions in `tests/ts-047-trust-guidance.test.mjs` for « Local uniquement, enregistré sur cet appareil », « Copie locale IndexedDB reliée à Dexie Cloud », « Données Cloud temporairement masquées, non présumées perdues » and « Date non disponible ».
- [ ] 1.3 Implement the state-priority resolution and state catalogue for non-configured, OTP, activation, initial pull, offline, pending, permission, `UNVERIFIED`, `MISMATCH`, error, historical cache and isolated recovery; verify that each state test asserts meaning, accessible data, masked data, risk, safe action and forbidden actions.
- [ ] 1.4 Add `shouldRecordSyncObservation`, `buildSyncObservationRecord`, `readSyncObservation`, `writeSyncObservation` and `resolveObservedSync` in `site/sync-trust-guidance.js`; verify with unit tests that only an attributable event with matching workspace, URL, `remoteDbId` and `userDigest` produces a date.
- [ ] 1.5 Add unit tests for a late event after an account, URL or workspace change, a reload with a matching observation, a reload with a mismatching observation, a storage write failure and an absent observation; verify each returns « Date non disponible » where attribution is not proven.
- [ ] 1.6 Add redaction tests in `tests/ts-047-trust-guidance.test.mjs` asserting that email, OTP, token, raw `userId`, project title, note and raw server error are never present in the built guidance or observation record.

## 2. Three-question trust summary rendering

- [ ] 2.1 Add `#sync-trust-location`, `#sync-trust-evidence` and `#sync-trust-actions` to `site/index.html` with the headings « Où sont mes données ? », « Sont-elles synchronisées ? » and « Que puis-je faire maintenant ? »; verify a static test asserts the three IDs and their order inside `#settings-sync-page`.
- [ ] 2.2 Render the summary, the three evidence levels and the state explanation from `buildTrustGuidance` in `site/app.js`; verify a static test asserts the renderer uses the pure helper and does not add a second diagnostic, form or handler.
- [ ] 2.3 Add deterministic tests covering local-only, synchronized, masked/`UNVERIFIED`, `MISMATCH`, expired session, offline, pending upload and unknown upload states, asserting the correct summary label and the presence of the local database name.
- [ ] 2.4 Add tests asserting that `in-sync` alone never produces a global Cloud-safety claim and that local save, pending upload, observed Cloud sync and other-device verification render as distinct text.
- [ ] 2.5 Implement the five conditional intent checklists with renvois to the existing controls; verify tests assert the five labels, state-based filtering, and that no intent descriptor references a transfer, retry, logout, suspension or purge handler.
- [ ] 2.6 Add a deterministic empty/masked/error test matrix asserting that an empty local database, masked cache, different account, unknown remote evidence, storage error and network interruption never render « Cloud vide » or an unproven success.

## 3. Progressive disclosure and existing panel preservation

- [ ] 3.1 Wrap the four business panels in native `<details>` disclosures and place supplemental identifiers under `#sync-technical-info` labelled « Informations techniques »; verify a static test asserts the disclosures and the technical summary text.
- [ ] 3.2 Add static tests asserting that `#cloud-config`, `#cloud-activation`, `#auth-panel`, `#workspace-panel` and `#sync-diagnostic` still appear exactly once and remain inside their original sections after the disclosure change.
- [ ] 3.3 Update `syncSectionVisibility`/`applySyncSectionVisibility` only as needed so collapsed sections remain hidden or visible according to existing onboarding state; verify tests cover local, configured, authenticated and degraded visibility without duplicating handlers.
- [ ] 3.4 Add static tests asserting that the technical block is separate from the first-screen summary and that no technical identifier is required for the mode, local base or destination text.
- [ ] 3.5 Adjust only the obsolete structural assertions in `tests/ts-043-sync-page.test.mjs` and `tests/ts-044-settings-hub.test.mjs` that depend on the previous non-collapsible markup; verify `node --test tests/ts-043-sync-page.test.mjs tests/ts-044-settings-hub.test.mjs` passes without removing uniqueness, no-side-effect or handler-reuse assertions.

## 4. Accessible compact presentation

- [ ] 4.1 Add CSS for the three-question hierarchy, compact first screen, 320 px layout, visible focus and 44 px minimum touch targets; verify static tests assert the media query, focus-visible rule and minimum target declarations.
- [ ] 4.2 Add text-based status markers independent of color for safe, pending, masked and error states; verify a static test asserts each status has a text label and does not rely on a color class alone.
- [ ] 4.3 Implement « Pourquoi ? » / « En savoir plus » controls with `aria-expanded`, `aria-controls` and Enter/Space-compatible native buttons; verify a static test asserts the attributes and that no action handler is attached to the help control.
- [ ] 4.4 Add static tests asserting the summary and state messages use a live status region and that the page does not duplicate the same status text in both the summary and diagnostic.

## 5. Native wiring and regressions

- [ ] 5.1 Pass the normalized diagnostic, workspace contribution, onboarding state, activation state and stored observation into `buildTrustGuidance` in `site/app.js`; verify a static test asserts the read path reuses `buildSyncDiagnostic`, `workspaceDiagnosticInput` and `readCloudConfig` without opening a base.
- [ ] 5.2 Subscribe to the existing `cloud.events.syncComplete` signal to build an observation only through `shouldRecordSyncObservation` and persist it with `writeSyncObservation`; verify a unit test asserts an unattributable event writes nothing and an attributable event writes exactly one record.
- [ ] 5.3 Add regression tests for account/URL changes, late native events, offline, reload, pending writes and unattested timestamps, asserting that no stale label or date survives and no business data is read.
- [ ] 5.4 Add tests asserting that opening, closing or collapsing the page does not invoke any Cloud action and that the intent renvois only open/focus existing controls.
- [ ] 5.5 Add tests asserting that the observation key is versioned, workspace-scoped, additive and contains no business data or synchronized table.

## 6. Integration verification

- [ ] 6.1 Run `npm run check` and confirm the full suite passes with the new module, tests and adjusted structure assertions.
- [ ] 6.2 Run `openspec validate ts-047 --strict --no-interactive` and confirm the change validates without warnings that affect the delta.
- [ ] 6.3 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-047/tasks.md` and confirm the pre-sync checklist gate accepts the plan.

## Manual acceptance

- Sur un navigateur desktop réel et un Chrome mobile réel, vérifier qu'un utilisateur non technique comprend en moins de cinq secondes le mode actif, l'emplacement des copies et le niveau de synchronisation, sans déplier « Informations techniques ».
- Vérifier la lisibilité et l'interprétation d'une date de synchronisation observée, puis l'affichage « Date non disponible » lorsqu'aucun événement attribuable n'existe ; ne pas confondre cette recette avec les tests simulés.
- Parcourir la page au clavier seul (Tab, Entrée, Espace), au toucher et avec un lecteur d'écran : aides contextuelles, sections repliables, focus, annonces ARIA et statuts non exclusivement colorés.
- Tester la mise en page à 320 px et en orientation mobile : absence de débordement horizontal, cibles tactiles et hiérarchie visuelle compacte.
- Avec des profils isolés et une instance Dexie Cloud de test, couvrir connexion OTP, bascule local/Cloud, compte différent, `UNVERIFIED`, `MISMATCH`, session expirée, hors ligne, écritures en attente et récupération isolée.
- Vérifier qu'aucune intention, navigation, ouverture de section ou lecture d'aide ne déclenche de transfert, relance, déconnexion, suspension ou purge, et que les cinq intentions mènent à une action sûre sans provoquer d'action destructrice par erreur.
- Confronter les textes affichés aux affirmations de synchronisation : aucune promesse de contenu complet dans le Cloud ni de convergence sur un autre appareil.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer les deltas canoniques de `cloud-sync-trust-guidance`, `cloud-settings-hub` et `cloud-sync-lifecycle` au comportement livré.
- Vérifier l'archive OpenSpec et la cohérence des exigences avec les specs canoniques existantes.
- Après publication de la PR, vérifier le check GitHub indépendant `check` sur son SHA exact, la protection de `main`, les evidences de fusion et la CI/Pages après fusion.
- Confronter la recette réelle multi-appareils aux invariants sans assimiler les tests simulés à une preuve de propagation Cloud.
