# Tasks

## 1. Pure metrics and French labels

- [x] 1.1 Add the pure exported metrics functions in `site/core.js` for a subject (total, done, pending, urgent pending, active) and for the whole document (active projects, pending steps, urgent steps), and add `tests/ts-053-overview-metrics.test.mjs` covering an empty document, a project without steps, several projects, parents plus substeps, an urgent substep, a completed parent with an unfinished child, a completed urgent step, and the 2 parents + 1 child fixture giving 2/3; run `node --test tests/ts-053-overview-metrics.test.mjs`.
- [x] 1.2 Add the pure French label helpers for the overview synthesis, the project urgency count and the project progress, with correct singular/plural agreement, the exact « Aucune étape » empty case without percentage, 0/N, 1/1, N/N, 2/3 at 67 %, and completion of rounding at the nearest integer; verify them in `tests/ts-053-overview-metrics.test.mjs` and run `node --test tests/ts-053-overview-metrics.test.mjs`.
- [x] 1.3 Extend `tests/ts-053-overview-metrics.test.mjs` to prove the metrics and label functions do not mutate their inputs and that those functions reference no `localStorage`, IndexedDB, Dexie, `fetch`, DOM, timer or authentication API; run `node --test tests/ts-053-overview-metrics.test.mjs`.

## 2. Overview synthesis in the existing global counter

- [x] 2.1 Make the initial `#counter` markup neutral (empty content, hidden) in `site/index.html`, allow the counter and card labels to wrap without horizontal overflow in `site/styles.css`, and add deterministic markup and CSS assertions in `tests/ts-053-overview-presentation.test.mjs`; run `node --test tests/ts-053-overview-presentation.test.mjs`.
- [x] 2.2 Add the overview summary rendering in `site/app.js` from `overviewMetrics(documentState)` and its label helper, update the counter only when its text changes, and only when `businessAllowed()` is true and TS-052 presentation is neither `AWAITING_READ` nor an action required without available projects; add a deterministic simulation test in `tests/ts-053-overview-presentation.test.mjs` proving one pending number, no duplicate summary surface and no rewrite of an unchanged `aria-live` text; run `node --test tests/ts-053-overview-presentation.test.mjs`.
- [x] 2.3 Add deterministic gating and isolation tests in `tests/ts-053-overview-presentation.test.mjs` for an awaiting read, an action-required state without projects, a healthy available document, an A→B account/base switch and a late event from A; prove that no zero, no percentage and no A metric is exposed under the blocked or B state; run `node --test tests/ts-053-overview-presentation.test.mjs tests/ts-052-overview-presentation.test.mjs`.

## 3. Per-card urgency and progress

- [x] 3.1 Render the remaining urgency count and the textual progress in `renderSubject()` only, below the existing pending and total labels, using `el()` text nodes and the pure label helpers; add static assertions in `tests/ts-053-overview-presentation.test.mjs` that both indicators are present on overview cards, the detail header is unchanged and no `innerHTML` is introduced; run `node --test tests/ts-053-overview-presentation.test.mjs`.
- [x] 3.2 Add deterministic card-rendering simulations or sliced-function assertions in `tests/ts-053-overview-presentation.test.mjs` for a project without steps, the 2/3 (67 %) fixture, an urgent substep, a completed urgent step and a zero-urgency card, proving the displayed text and the absence of a fabricated percentage for the empty project; run `node --test tests/ts-053-overview-presentation.test.mjs`.
- [x] 3.3 Add deterministic assertions in `tests/ts-053-overview-presentation.test.mjs` that the card indicators create no new control, no new `aria-live` region and no new storage/network/Dexie access, and that `site/app.js` still uses `replaceSubjectsInCurrentView()` for the atomic project list update; run `node --test tests/ts-053-overview-presentation.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-050-transient-view-state.test.mjs`.

## 4. Refresh coherence and non-regression

- [x] 4.1 Add deterministic tests in `tests/ts-053-overview-metrics.test.mjs` that recompute the aggregates after a creation, a completion, a priority change, a promotion, a removal and its undo, and an import-shaped replacement, using the existing core document transitions and asserting the exact before/after counts; run `node --test tests/ts-053-overview-metrics.test.mjs`.
- [x] 4.2 Add deterministic integration assertions in `tests/ts-053-overview-presentation.test.mjs` that the existing local, Dexie and inter-tab refresh paths still call the render cycle and that metrics are derived from the newly assigned `documentState` without any added read, subscription, timer or network request; run `node --test tests/ts-053-overview-presentation.test.mjs`.
- [x] 4.3 Update the existing tests affected by the counter's neutral initial state or enriched summary, especially `tests/ts-049-tablet-scroll.test.mjs` and `tests/ts-052-overview-presentation.test.mjs`, without weakening their focus, scroll, loader, diagnostic, visibility or isolation assertions; run `node --test tests/ts-049-tablet-scroll.test.mjs tests/ts-052-overview-presentation.test.mjs tests/core.test.mjs`.

## 5. Repository validation

- [x] 5.1 Run `node --test tests/ts-053-overview-metrics.test.mjs tests/ts-053-overview-presentation.test.mjs tests/ts-049-tablet-scroll.test.mjs tests/ts-052-overview-presentation.test.mjs tests/core.test.mjs` and report the actual result; do not check this task if any test fails.
- [x] 5.2 Run `npm run check` and report the actual result; do not check this task if any test, backlog check or JavaScript syntax check fails.
- [x] 5.3 Run `openspec validate ts-053 --strict --no-interactive` and report the actual result; do not check this task if validation fails.
- [x] 5.4 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-053/tasks.md` and report the actual result; do not check this task if the pre-sync checklist gate fails.

## Manual acceptance

À exécuter sur Chrome Android en portrait et paysage ainsi que sur desktop, avec
un jeu synthétique local puis une instance Dexie Cloud de test. Ces
vérifications restent **à effectuer** et ne sont pas prouvées par la CI.

- Vérifier la lisibilité de la synthèse et des indicateurs de carte pour un document synthétique contenant des projets actifs, inactifs, sans étape, avec sous-tâche urgente et étapes terminées ; contrôler les accords français et l'absence de 0 % fabriqué pour un projet sans étape.
- Contrôler que le nombre d'étapes en attente n'apparaît qu'une fois dans la synthèse globale et que les compteurs existants des cartes restent distincts et cohérents.
- Parcourir les cartes au clavier (Tab, Entrée, Espace) et avec un lecteur d'écran : vérifier les noms accessibles, l'absence de focus ajouté par les indicateurs, la compréhension sans couleur et l'absence d'annonces répétées lors de rafraîchissements identiques.
- Après une coche, un changement de priorité, une suppression puis « Annuler », vérifier que les chiffres se mettent à jour et que le focus, le défilement, le repli des sous-tâches et les brouillons applicables restent stables, sans déplacement de projet ou de tâche.
- Sur une instance Cloud de test avec accès lent, session en restauration et changement de compte, vérifier qu'aucun zéro, pourcentage ou indicateur d'un autre espace n'apparaît avant une lecture autorisée achevée, et que le loader/diagnostic TS-052 conserve son comportement.
- Vérifier sur mobile étroit l'absence de débordement horizontal et la lisibilité des libellés longs. Ne jamais utiliser de données personnelles, effectuer une purge réelle ou un test destructif.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer les deltas canoniques de `overview-project-metrics` et `overview-project-read-state` avec les exigences et scénarios de ce changement.
- Vérifier l'archive du changement, son contenu versionné et l'absence de modification accidentelle des specs canoniques, archives antérieures, données produit, exports, workflows ASF, secrets ou fichiers protégés.
- Après publication de la PR, contrôler la CI indépendante `check` sur le SHA exact, la protection requise de `main`, le diff de code et de sécurité, puis la fusion, la CI post-fusion et le déploiement GitHub Pages.
- Séparer strictement les tests CI automatisés, la recette réelle Chrome Android/desktop et la vérification sur une instance Dexie Cloud de test ; ne présenter aucun test simulé comme preuve de la recette utilisateur et ne pas marquer comme effectuées les vérifications manuelles non réalisées.
