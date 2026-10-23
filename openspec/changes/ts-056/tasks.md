# Tasks

## 1. Pure urgency projection

- [ ] 1.1 Add exported `OVERVIEW_URGENCY_LIMIT`, `isPendingUrgentItem(item)`, `overviewUrgencyEntries(document)`, `overviewUrgencyView(document, expanded)` and `findOverviewUrgency(document, subjectId, itemId)` to `site/core.js`, reusing `isPendingUrgentItem()` in `countItemMetrics()` so the TS-053 urgency definition stays single-sourced; create `tests/ts-056-overview-urgency-list.test.mjs` covering empty, 1, 5, 6 and 8 urgencies, urgent parent plus urgent child, urgent child under a completed parent, and completed or non-urgent exclusions; run `node --test tests/ts-056-overview-urgency-list.test.mjs`.
- [ ] 1.2 Add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` asserting stored project order, stored item order, sub-tasks placed next to their parent, no priority sort, homonymous titles distinguished by subject and item IDs, `findOverviewUrgency()` returning `null` for a removed target, and no mutation of inputs or object identities; run `node --test tests/ts-056-overview-urgency-list.test.mjs`.
- [ ] 1.3 Add static assertions in `tests/ts-056-overview-urgency-list.test.mjs` that the new pure model references no DOM, `localStorage`, IndexedDB, Dexie, network, timer or authentication API and that `subjectMetrics()`/`overviewMetrics()` still return the same `urgentPending` values; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-053-overview-metrics.test.mjs`.

## 2. Static section and safe row rendering

- [ ] 2.1 Add a static `section#overview-urgencies` with the exact title « Urgences à traiter », the exact empty message « Aucune urgence en attente », a list container, a hidden excess counter and hidden controls « Voir toutes les urgences » / « Réduire » in `site/index.html` after the focus bar and before the subject form, plus compact styles, visible focus and at least 44 × 44 px targets in `site/styles.css`; add deterministic markup and CSS assertions in `tests/ts-056-overview-urgency-list.test.mjs` for one section, unique exact labels, initial hidden state, absence of a new `aria-live` region, target size and wrapping; run `node --test tests/ts-056-overview-urgency-list.test.mjs`.
- [ ] 2.2 Implement `renderUrgencyList()` in `site/app.js`, called only from the authorized Overview branch of `render()` after the TS-052 suppression branch, using `overviewUrgencyView(documentState, overviewUrgenciesExpanded)` to render the first five entries, the exact hidden count, the two development labels and the empty message; add deterministic render-harness tests in `tests/ts-056-overview-urgency-list.test.mjs` for 0, 1, 5, 6 and 8 entries, counter values, toggle labels and parent/child row content; run `node --test tests/ts-056-overview-urgency-list.test.mjs`.
- [ ] 2.3 Add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` asserting that project, task and parent titles are set as text content, that markup-looking titles create no element, that each row carries stable `data-subject` and `data-item` IDs, and that the opening control's accessible name identifies the project and the step; run `node --test tests/ts-056-overview-urgency-list.test.mjs`.

## 3. Five-entry development and transient state

- [ ] 3.1 Add the memory-only `overviewUrgenciesExpanded` state, the « Voir toutes les urgences » / « Réduire » handlers and the reset to collapsed from `resetExpandedViewState()`; add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` proving that expansion shows every entry, reduction restores five and the exact excess count, the state is preserved across mutations and refreshes, reset happens on true view entry, reload-equivalent initialization, authorized identity change and successful import/restore, and no storage, URL or history write occurs; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-050-transient-view-state.test.mjs`.
- [ ] 3.2 Add deterministic tests for focus continuity in `tests/ts-056-overview-urgency-list.test.mjs`, covering the static development control, a focused row that remains after a rerender, a focused row that disappears and falls back to a remaining relevant control, and unchanged card drafts/expanded groups; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-049-interaction-continuity.test.mjs`.

## 4. Stable-ID opening and safe reveal

- [ ] 4.1 Extend `revealAction(subjectId, itemId, options)` with an optional `detail` mode that preserves its current default behavior, and add `openUrgencyEntry(entry)` in `site/app.js` to revalidate the target through `findOverviewUrgency(documentState, subjectId, itemId)` before opening the project detail and revealing the exact step; add deterministic navigation/reveal tests in `tests/ts-056-overview-urgency-list.test.mjs` for a filtered project, a collapsed parent, a step beyond the five-parent preview, default suggestion/resume behavior, and absence of priority, completion, tracking or document writes; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs`.
- [ ] 4.2 Add a deterministic reveal-focus fallback in `applyFocus()` so a revealed task focuses `.task-edit` when present, otherwise `.task-check` or `.task-menu-button`, and never leaves the detached opening button focused; add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` for the fallback and for a target removed between render and activation, proving no navigation and no other-space content; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-049-interaction-continuity.test.mjs`.
- [ ] 4.3 Add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` proving that the section and its empty state are unreachable during `AWAITING_READ`, an action-required presentation without available projects, a disallowed business state or an unverified binding, and that an A-to-B identity change clears A's entries and a late A event cannot restore them; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-052-overview-presentation.test.mjs tests/workspace-identity.test.mjs`.

## 5. Refresh, independence and non-regression

- [ ] 5.1 Add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` proving recomputation after completion, priority change, removal then Undo, addition, successful import and an authorized Dexie event, with no additional read, write, listener or network call; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-053-overview-presentation.test.mjs`.
- [ ] 5.2 Add deterministic tests in `tests/ts-056-overview-urgency-list.test.mjs` proving independence from every project-filter mode, « Masquer les étapes terminées », the suggestion and « Je reprends ici », and asserting that global counters, project cards and the five-parent preview are unchanged and not duplicated; run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs`.
- [ ] 5.3 Add static assertions in `tests/ts-056-overview-urgency-list.test.mjs` that no Dexie index, listener, fetch, authentication, storage key, export/import field, history entry, preference, suggestion rule or authorization barrier is added; run `node --test tests/ts-056-overview-urgency-list.test.mjs`.
- [ ] 5.4 Update existing tests affected by the new dashboard section or added state without weakening their assertions, especially `tests/ts-052-overview-presentation.test.mjs`, `tests/ts-054-overview-urgency-filter.test.mjs`, `tests/ts-055-overview-project-filter.test.mjs` and `tests/ts-049-tablet-scroll.test.mjs`; run `node --test tests/ts-052-overview-presentation.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs tests/ts-049-tablet-scroll.test.mjs`.

## 6. Repository validation

- [ ] 6.1 Run `node --test tests/ts-056-overview-urgency-list.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-049-tablet-scroll.test.mjs tests/ts-050-transient-view-state.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-053-overview-metrics.test.mjs tests/ts-053-overview-presentation.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs tests/workspace-identity.test.mjs` and report the actual result; do not check this task if any test fails.
- [ ] 6.2 Run `npm run check` and report the actual result; do not check this task if any test, backlog check or JavaScript syntax check fails.
- [ ] 6.3 Run `openspec validate ts-056 --strict --no-interactive` and report the actual result; do not check this task if validation fails.
- [ ] 6.4 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-056/tasks.md` and report the actual result; do not check this task if the pre-sync checklist gate fails.

## Manual acceptance

À exécuter sur Chrome Android en portrait et paysage ainsi que sur desktop,
avec un jeu synthétique local puis, pour la bascule d'identité uniquement, des
espaces A/B synthétiques de test. Ces vérifications restent **à effectuer** et ne
sont pas prouvées par la CI.

- Créer plus de cinq urgences réparties sur plusieurs projets, dont des titres
  homonymes et des sous-tâches sous des parents terminés ou repliés, puis
  inspecter visuellement la zone compacte, l'ordre, la limite de cinq, le
  compteur d'excédent et les libellés exacts.
- Activer « Voir toutes les urgences » puis « Réduire » au clavier (Tab, Entrée,
  Espace) et au toucher : vérifier le focus, le défilement, l'accessibilité des
  commandes, les cibles d'au moins 44 × 44 px et l'absence de débordement
  horizontal sur mobile.
- Avec un lecteur d'écran, vérifier que le titre, les lignes, le compteur et
  l'état de développement sont compréhensibles, sans annonce dupliquée ni
  oscillation pendant un rafraîchissement identique.
- Appliquer chaque mode de filtre de projets et « Masquer les étapes
  terminées » : vérifier que la synthèse reste globale et inchangée, que les
  cartes suivent leurs propres filtres et que « Ouvrir dans le projet » révèle
  la bonne étape même dans un projet masqué.
- Ouvrir une urgence située au-delà de l'aperçu de cinq parents et une
  sous-tâche d'un parent replié : vérifier la navigation vers le bon projet, le
  développement du parent et la mise en évidence ou le focus de l'élément exact.
- Simuler une suppression entre le rendu et le clic, puis vérifier que l'action
  est annulée sans afficher de contenu d'un autre projet ou espace.
- Vérifier la conservation du focus, du défilement, des brouillons, des groupes
  développés, des compteurs globaux, de la suggestion et de « Je reprends ici »
  pendant le développement, la réduction et les mises à jour.
- Sur les espaces A/B synthétiques de test, vérifier la disparition immédiate des
  urgences de A après bascule et l'absence de réapparition lors d'un événement
  ou d'une réponse tardive. Ne jamais utiliser de données personnelles.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer le delta
  canonique de `overview-urgency-list` avec les exigences et scénarios de ce
  changement, notamment l'ordre, le quota, l'état vide, l'ouverture et
  l'isolation d'identité.
- Vérifier l'archive du changement, son contenu versionné et l'absence de
  modification accidentelle des specs existantes, archives antérieures, données
  produit, exports, workflows ASF, secrets ou fichiers protégés.
- Effectuer une revue de sécurité et de diff OpenSpec : rendu des titres comme
  texte, absence de nouvelle persistance ou lecture réseau, absence de fuite A
  vers B et préservation des frontières d'autorisation existantes.
- Après publication de la PR, contrôler la CI indépendante `check` sur le SHA
  exact, la protection de `main`, le diff de code et de sécurité, puis la
  fusion, la CI post-fusion et le déploiement GitHub Pages.
- Vérifier la recette mobile physique distincte et séparer strictement les tests
  CI automatisés, la recette réelle Android/desktop et la vérification sur les
  espaces de test ; ne présenter aucun test simulé comme preuve de la recette
  utilisateur.
