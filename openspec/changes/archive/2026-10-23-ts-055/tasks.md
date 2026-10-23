# Tasks

## 1. Pure classification and filter model

- [x] 1.1 Add `OVERVIEW_FILTER_FOLLOWING`, `OVERVIEW_FILTER_COMPLETED` and a pure `overviewSubjectStatus(subject)` that derives `following`/`completed`/`empty` from `subjectMetrics()`, then extend `isSubjectVisibleInOverviewFilter()` and `overviewFilteredSubjects()` for all four modes; create `tests/ts-055-overview-project-filter.test.mjs` covering a completed parent with a pending child, all steps done with a non-zero total, an empty project, a pending parent, and a completed urgent step; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 1.2 Add deterministic assertions in `tests/ts-055-overview-project-filter.test.mjs` that the three filtered modes are distinct, that urgency selection is unchanged from TS-054, that valid modes preserve stored order, that an unknown mode returns every subject, and that inputs and object identities are not mutated; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 1.3 Add static assertions in `tests/ts-055-overview-project-filter.test.mjs` that the new pure classification and filtering reference no DOM, `localStorage`, IndexedDB, Dexie, network, timer or authentication API and call `subjectMetrics()` instead of duplicating `done`/`total` logic; run `node --test tests/ts-055-overview-project-filter.test.mjs`.

## 2. Accessible selector and transient state

- [x] 2.1 Extend the existing project-filter `fieldset` in `site/index.html` with four same-name radio controls labelled exactly « Tous les projets », « Projets avec urgences », « Projets à suivre » and « Projets terminés », keep the first checked initially, and add wrapping, visible-focus and at least 44 × 44 px target rules in `site/styles.css`; add deterministic markup and CSS assertions in `tests/ts-055-overview-project-filter.test.mjs` for four options, one group, label uniqueness, the initial checked state, DOM order before `#subjects` and the absence of a new `aria-live` region; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 2.2 Replace the urgency-only memory state with `overviewProjectFilter`, a guarded synchronization function that writes `checked` only when a radio differs, and `change` handlers for all four modes that update the state and call `render()`; add deterministic VM-harness tests in `tests/ts-055-overview-project-filter.test.mjs` proving mode normalization, one checked control, no URL/history/storage/document write, and no redundant `checked` rewrite on identical synchronization; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 2.3 Reset `overviewProjectFilter` to `OVERVIEW_FILTER_ALL` and resynchronize all controls from `resetExpandedViewState()`; add deterministic tests in `tests/ts-055-overview-project-filter.test.mjs` proving that true view entry, successful import/reconciliation and authorized identity change reset the mode, while `load()`, local/Dexie/inter-tab refresh, `persist()` and Undo preserve it; run `node --test tests/ts-055-overview-project-filter.test.mjs tests/ts-050-transient-view-state.test.mjs`.

## 3. Filtered render, empty states and safe reveal

- [x] 3.1 Render Overview cards from `overviewFilteredSubjects(documentState.subjects, overviewProjectFilter)` while keeping `#counter`, `renderSuggestion()` and `renderResumeCard()` on the full `documentState` and leaving `renderTaskArea()`/`overviewPreview()` unchanged; add deterministic render-harness tests in `tests/ts-055-overview-project-filter.test.mjs` proving card membership and original order for all four modes, unchanged global surfaces, and the five-parent preview; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 3.2 Add the exact filtered empty states « Aucun projet à suivre » and « Aucun projet terminé » beside the existing urgent empty state, each with a « Tous les projets » action that resets the mode and focuses the static all-projects radio, while preserving the general empty message in `all` mode; add deterministic tests for a non-empty document without matching projects, a truly empty document in each mode, the action's state change and the absence of data writes; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 3.3 Extend `revealAction()` so a suggestion or resume target whose subject is hidden by any active filtered mode opens the existing detail route, while visible targets keep the existing preview reveal; add deterministic tests in `tests/ts-055-overview-project-filter.test.mjs` for hidden subjects under following, completed and urgent modes, the visible-target path and the absence of `persist()` or priority changes; run `node --test tests/ts-055-overview-project-filter.test.mjs`.

## 4. Safety, continuity and non-regression

- [x] 4.1 Add deterministic tests in `tests/ts-055-overview-project-filter.test.mjs` proving that no filtered empty state is reachable during `AWAITING_READ`, an action-required presentation without available projects, a disallowed business state or an unverified identity, and that filtering stays after the TS-052 suppression branch; run `node --test tests/ts-055-overview-project-filter.test.mjs tests/ts-052-overview-presentation.test.mjs`.
- [x] 4.2 Add deterministic tests in `tests/ts-055-overview-project-filter.test.mjs` that completion, creation, removal then Undo and a Dexie/inter-tab refresh recalculate membership under following and completed modes, that a priority change recalculates the urgency mode, and that every path preserves the selected mode and issues no extra write; run `node --test tests/ts-055-overview-project-filter.test.mjs`.
- [x] 4.3 Add deterministic assertions in `tests/ts-055-overview-project-filter.test.mjs` that switching modes does not clear `expandedParents`, `editingItemId` or `openMenuId`, adds no live region, keeps the static control outside `#subjects`, preserves the completion filter, and falls back focus to the selected radio when the focused project leaves following or completed results; run `node --test tests/ts-055-overview-project-filter.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-050-transient-view-state.test.mjs`.
- [x] 4.4 Update existing tests affected by the added modes or renamed state without weakening their assertions, especially `tests/ts-054-overview-urgency-filter.test.mjs` and `tests/ts-049-tablet-scroll.test.mjs`; run `node --test tests/ts-054-overview-urgency-filter.test.mjs tests/ts-049-tablet-scroll.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-053-overview-presentation.test.mjs`.

## 5. Repository validation

- [x] 5.1 Run `node --test tests/ts-055-overview-project-filter.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-049-tablet-scroll.test.mjs tests/ts-050-transient-view-state.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-053-overview-presentation.test.mjs` and report the actual result; do not check this task if any test fails.
- [x] 5.2 Run `npm run check` and report the actual result; do not check this task if any test, backlog check or JavaScript syntax check fails.
- [x] 5.3 Run `openspec validate ts-055 --strict --no-interactive` and report the actual result; do not check this task if validation fails.
- [x] 5.4 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-055/tasks.md` and report the actual result; do not check this task if the pre-sync checklist gate fails.

## Manual acceptance

À exécuter sur Chrome Android en portrait et paysage ainsi que sur desktop,
avec un jeu synthétique local puis, pour la bascule de compte uniquement, une
instance de test. Ces vérifications restent **à effectuer** et ne sont pas
prouvées par la CI.

- Parcourir les quatre modes au clavier (Tab, flèches du groupe radio, Entrée,
  Espace) et au toucher : vérifier l'état coché unique, le focus visible, les
  cibles d'au moins 44 × 44 px, les libellés exacts et l'absence de débordement
  horizontal sur écran étroit.
- Avec un lecteur d'écran, vérifier que le groupe, le mode actif et les états
  vides sont annoncés une fois, sans oscillation pendant un rafraîchissement
  identique.
- Filtrer un jeu synthétique contenant un projet sans étape, un projet actif
  avec une sous-tâche en attente sous un parent terminé, un projet entièrement
  terminé, un projet avec urgence en attente et un projet urgent terminé ;
  vérifier « À suivre », « Terminés », « Urgences », le retour « Tous les
  projets », l'ordre, l'aperçu de cinq parents et l'indépendance de « Masquer
  les étapes terminées ».
- Depuis « Projets à suivre », terminer la dernière étape d'un projet puis
  annuler cette action ; vérifier que la carte quitte puis revient, que le mode
  reste actif, que le focus, le défilement, le repli et les brouillons restent
  pertinents, et que les compteurs globaux, la suggestion et « Je reprends ici »
  restent identiques.
- Ouvrir « Voir dans la liste » sur une suggestion puis sur une reprise
  pointant vers un projet masqué par « À suivre » ou « Terminés » : vérifier
  que l'action ciblée devient accessible par le détail ou par le retour à
  « Tous les projets », sans changement de priorité ni sauvegarde.
- Vérifier une navigation réelle, Précédent/Suivant et un rechargement : le
  mode revient à « Tous les projets ». Vérifier un import ou une restauration
  réussis sur données synthétiques : le mode revient également à « Tous les
  projets ».
- Sur l'instance de test uniquement, avec accès lent, session en restauration,
  liaison non vérifiée, événement tardif et changement de compte : vérifier
  qu'aucun faux état vide, aucun faux zéro et aucune carte de l'ancien espace
  n'apparaît. Ne jamais utiliser de données réelles ni personnelles.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer le delta
  canonique de `overview-urgency-filter` avec les exigences et scénarios de ce
  changement, notamment la conservation du mode urgence TS-054 et la
  classification « à suivre » / « terminé ».
- Vérifier le `Purpose` de la capacité canonique après sync : le chemin existant
  est conservé, mais sa formulation doit refléter les quatre modes sans
  introduire de nouveau statut ni d'archivage réel.
- Vérifier l'archive du changement, son contenu versionné et l'absence de
  modification accidentelle des specs existantes, archives antérieures,
  données produit, exports, workflows ASF, secrets ou fichiers protégés.
- Après publication de la PR, contrôler la CI indépendante `check` sur le SHA
  exact, la protection de `main`, le diff de code et de sécurité, puis la
  fusion, la CI post-fusion et le déploiement GitHub Pages.
- Séparer strictement les tests CI automatisés, la recette réelle Chrome
  Android/desktop et la vérification sur l'instance de test ; ne présenter
  aucun test simulé comme preuve de la recette utilisateur et ne pas marquer
  comme effectuées les vérifications manuelles non réalisées.
