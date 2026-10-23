# Tasks

## 1. Pure filter model

- [ ] 1.1 Add exported `OVERVIEW_FILTER_ALL`, `OVERVIEW_FILTER_URGENT`, `subjectHasPendingUrgency(subject)`, `overviewFilteredSubjects(subjects, mode)` and `isSubjectVisibleInOverviewFilter(subject, mode)` to `site/core.js`, reusing `subjectMetrics()` for the pending-urgency predicate; create `tests/ts-054-overview-urgency-filter.test.mjs` covering an empty document, a project without steps, a project without urgency, an urgent parent, an urgent child under a completed parent, a completed urgent step, and normal/later steps; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 1.2 Extend `tests/ts-054-overview-urgency-filter.test.mjs` to assert that urgent mode preserves the order A, B, C while omitting non-matching B, that unknown or non-urgent modes return every subject in order, and that inputs and object identities are not mutated; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 1.3 Add deterministic assertions in `tests/ts-054-overview-urgency-filter.test.mjs` that the new pure functions reference no DOM, `localStorage`, IndexedDB, Dexie, network, timer or authentication API and that they call the TS-053 metrics definition instead of duplicating the `priority`/`done` condition; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.

## 2. Accessible control and transient state

- [ ] 2.1 Add the static two-radio control with the exact visible labels « Tous les projets » and « Projets avec urgences » beside the completion filter and immediately before `#subjects` in `site/index.html`, and add wrapping, visible focus and at least 44 × 44 px target rules in `site/styles.css`; add deterministic markup and CSS assertions in `tests/ts-054-overview-urgency-filter.test.mjs` for one control, the initial checked state, label uniqueness, DOM order and the absence of a new `aria-live` region; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 2.2 Add the memory-only `overviewUrgencyFilter` state, a guarded `syncOverviewFilterControl()` that writes `checked` only when it changes, and the radio `change` handler that updates the state and calls `render()` in `site/app.js`; add deterministic assertions in `tests/ts-054-overview-urgency-filter.test.mjs` that no URL, history, `localStorage` or document write occurs and that identical synchronization does not rewrite the control; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 2.3 Reset the filter to `OVERVIEW_FILTER_ALL` from `resetExpandedViewState()` and resynchronize the control; add deterministic tests in `tests/ts-054-overview-urgency-filter.test.mjs` proving that true view entry, successful import/reconciliation and authorized identity change reset the filter, while `load()` and the local/Dexie/inter-tab refresh paths do not call the reset; run `node --test tests/ts-054-overview-urgency-filter.test.mjs tests/ts-050-transient-view-state.test.mjs`.

## 3. Filtered render, empty state and safe reveal

- [ ] 3.1 Render the Overview cards from `overviewFilteredSubjects(documentState.subjects, overviewUrgencyFilter)` while keeping `#counter`, `renderSuggestion()` and `renderResumeCard()` on the full `documentState`, and leave `renderTaskArea()`/`overviewPreview()` unchanged; add a deterministic render harness in `tests/ts-054-overview-urgency-filter.test.mjs` proving filtered card order, absence of non-matching cards and unchanged five-parent preview behavior; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 3.2 Add the filtered empty state with the exact text « Aucun projet avec urgence en attente » and a « Tous les projets » action that resets the mode and focuses the static radio, while preserving the existing general empty message in `all` mode; add deterministic tests for a non-empty document without urgency, a truly empty document in each mode, the action's state change and the absence of data writes; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 3.3 Extend `revealAction()` so a suggestion or resume target whose subject is hidden by the active filter opens the existing detail route, while visible targets keep the existing preview reveal; add deterministic tests in `tests/ts-054-overview-urgency-filter.test.mjs` for the hidden-subject predicate, the chosen detail route, the visible-target path and the absence of `persist()` or priority changes; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.

## 4. Safety, continuity and non-regression

- [ ] 4.1 Add deterministic tests in `tests/ts-054-overview-urgency-filter.test.mjs` proving that the filtered empty state is unreachable during `AWAITING_READ`, an action-required presentation without available projects, a disallowed business state and an unverified identity, and that the filter is evaluated only after the TS-052 suppression branch; run `node --test tests/ts-054-overview-urgency-filter.test.mjs tests/ts-052-overview-presentation.test.mjs`.
- [ ] 4.2 Add deterministic tests in `tests/ts-054-overview-urgency-filter.test.mjs` that a local mutation, a Dexie/inter-tab refresh and an Undo recalculate the filtered result while preserving the active mode, and that a removed last urgency drops the project while its restoration brings it back; run `node --test tests/ts-054-overview-urgency-filter.test.mjs`.
- [ ] 4.3 Add deterministic assertions in `tests/ts-054-overview-urgency-filter.test.mjs` that toggling the filter does not clear `expandedParents`, `editingItemId` or `openMenuId`, does not add a live region, keeps the static control focused outside `#subjects`, and leaves the completion filter independent; run `node --test tests/ts-054-overview-urgency-filter.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-050-transient-view-state.test.mjs`.
- [ ] 4.4 Update existing tests affected by the added control or reset hook without weakening their assertions, especially `tests/ts-049-tablet-scroll.test.mjs`, `tests/ts-050-transient-view-state.test.mjs` and `tests/ts-053-overview-presentation.test.mjs`; run `node --test tests/ts-049-tablet-scroll.test.mjs tests/ts-050-transient-view-state.test.mjs tests/ts-053-overview-presentation.test.mjs`.

## 5. Repository validation

- [ ] 5.1 Run `node --test tests/ts-054-overview-urgency-filter.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-050-transient-view-state.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-053-overview-presentation.test.mjs` and report the actual result; do not check this task if any test fails.
- [ ] 5.2 Run `npm run check` and report the actual result; do not check this task if any test, backlog check or JavaScript syntax check fails.
- [ ] 5.3 Run `openspec validate ts-054 --strict --no-interactive` and report the actual result; do not check this task if validation fails.
- [ ] 5.4 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-054/tasks.md` and report the actual result; do not check this task if the pre-sync checklist gate fails.

## Manual acceptance

À exécuter sur Chrome Android en portrait et paysage ainsi que sur desktop,
avec un jeu synthétique local puis une instance Dexie Cloud de test. Ces
vérifications restent **à effectuer** et ne sont pas prouvées par la CI.

- Parcourir le contrôle au clavier (Tab, Entrée, Espace) et au toucher : vérifier l'état coché, le focus visible, les cibles d'au moins 44 × 44 px, les libellés exacts et l'absence de débordement horizontal sur écran étroit.
- Avec un lecteur d'écran, vérifier que le groupe et son état sont annoncés une fois, sans oscillation pendant un rafraîchissement identique, et que le message « Aucun projet avec urgence en attente » n'est lu que lorsqu'il s'applique.
- Filtrer un jeu synthétique contenant une urgence sur un parent, une urgence sur une sous-tâche dont le parent est terminé et replié, une urgence terminée, une urgence passée à Normal/Plus tard et un projet sans urgence ; vérifier l'ordre, l'aperçu de cinq parents et l'indépendance de « Masquer les étapes terminées ».
- Depuis le filtre, terminer la dernière urgence d'un projet puis annuler cette action : vérifier que la carte quitte puis revient, que le focus et le défilement restent pertinents, que le repli et les brouillons des cartes restantes sont conservés et que les compteurs globaux, la suggestion et « Je reprends ici » restent identiques.
- Ouvrir « Voir dans la liste » sur une suggestion puis sur une reprise pointant vers un projet masqué : vérifier que l'action ciblée devient accessible par le détail ou par le retour à « Tous les projets », sans changement de priorité ni sauvegarde.
- Vérifier une navigation réelle, Précédent/Suivant et un rechargement : le filtre revient à « Tous les projets ». Vérifier un import ou une restauration réussis sur données synthétiques : le filtre revient également à « Tous les projets ».
- Sur Cloud de test avec accès lent, session en restauration, liaison non vérifiée, événement tardif et changement de compte : vérifier qu'aucun faux état vide, aucun faux zéro et aucune carte de l'ancien espace n'apparaît. Ne jamais purger de données réelles ni utiliser de données personnelles.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer le delta canonique de `overview-urgency-filter` avec les exigences et scénarios de ce changement.
- Vérifier l'archive du changement, son contenu versionné et l'absence de modification accidentelle des specs existantes, archives antérieures, données produit, exports, workflows ASF, secrets ou fichiers protégés.
- Après publication de la PR, contrôler la CI indépendante `check` sur le SHA exact, la protection de `main`, le diff de code et de sécurité, puis la fusion, la CI post-fusion et le déploiement GitHub Pages.
- Séparer strictement les tests CI automatisés, la recette réelle Chrome Android/desktop et la vérification sur une instance Dexie Cloud de test ; ne présenter aucun test simulé comme preuve de la recette utilisateur et ne pas marquer comme effectuées les vérifications manuelles non réalisées.
