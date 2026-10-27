# Tasks

## Implementation checklist (pre-sync)

### 1. Baseline and delivery dependency

- [ ] 1.1 Verify the TS-065 technical dependency with a Node assertion that `openspec/changes/archive/2026-10-27-ts-065` exists, that `site/overview/` and the TS-065 overview tests are present, and that no prior human acceptance record is used as a gate; report the actual result.
- [ ] 1.2 Before CSS edits, add a deterministic baseline in `tests/ts-066-overview-visual.test.mjs` that captures the Overview control classes, IDs, accessible names, reading order and token values, and assert it contains `subject-open`, `overview-see-more`, `task-check`, `priority-control`, `task-toggle`, `task-handle`, `overview-filter-all` and `--control-target-min: 44px`.
- [ ] 1.3 Run deterministic tests with `node --test tests/ts-064-overview-render.test.mjs tests/ts-064-overview-responsive.test.mjs tests/ts-065-overview-continuity.test.mjs tests/ts-061-design-tokens.test.mjs` and report the actual results without checking this item if a suite fails.

### 2. Overview composition and visual hierarchy

- [ ] 2.1 Apply Overview-only CSS for shell/dashboard spacing, section title, synthesis/counter, resume and suggestion blocks, urgency block, project form and filters using existing tokens or strictly equivalent local values, and add a static assertion that the new declarations reference defined `--color-*`, `--space-*`, `--radius-*` or `--font-*` tokens where applicable.
- [ ] 2.2 Apply the card and task-preview hierarchy to `.subject`, `.subject-head`, `.subject-controls`, `.subject h3`, the metric paragraphs, `.task-area`, task rows, notes, children and `.overview-see-more` without changing markup, classes, IDs or order, and add a deterministic test that the rendered card still exposes the same title, four metric paragraphs, controls and preview markers.
- [ ] 2.3 Add the responsive tiers for 320, 390, 430, 768 and 1280 px using the existing `620px` compact rules plus a `min-width:768px` desktop tier, with `min-width:0`, `max-width:100%`, `flex-wrap` and `overflow-wrap:anywhere` where long content is possible, and add deterministic tests asserting the media queries and absence of `overflow-x:auto|scroll`.
- [ ] 2.4 Preserve and assert state presentation rules for `[hidden]`, `:focus-visible`, `:disabled`, `.task.done`, priority badges, `.subject-progress`, loading `aria-busy` and empty/filtered states, and add a deterministic test asserting each selector remains present and no information is conveyed by colour alone.
- [ ] 2.5 Add a deterministic jsdom/parity test that compiles the Overview surface and asserts the existing HTML structure, control classes, IDs, accessible names, command order, task hierarchy and `Voir plus` placement are unchanged by the presentation change.

### 3. Component, token and dependency boundaries

- [ ] 3.1 Add assertions that `site/styles/tokens.css` values are unchanged, that no new token, palette, font, icon, CDN or remote asset is introduced, and that no new dependency appears in `package.json` or `package-lock.json`.
- [ ] 3.2 Add assertions that the Overview components keep their existing React ownership and imports, introduce no `dangerouslySetInnerHTML`, `innerHTML`, route change, `localStorage`/IndexedDB access, network call or new storage key.
- [ ] 3.3 Add deterministic tests for continuity that a same-context surface update keeps focus on a connected control and preserves the expanded-parent, filter and draft state, and that route/identity boundaries still release transient state according to `ux-interaction-continuity`.

### 4. Documentation

- [ ] 4.1 Create or update `docs/product/react-overview-cards.md` (or a dedicated `docs/product/react-overview-presentation.md`) with the Overview visual map, responsive tiers, reused components/tokens, focus/scroll invariants, rollback and the distinction between structural tests and human acceptance.
- [ ] 4.2 Update `docs/product/developer-guide.md` with the TS-066 presentation entry points, test commands, rollback and manual-verification limits, and add deterministic documentation assertions for the required sections and filenames.

### 5. Integration checks before semantic sync

- [ ] 5.1 Run deterministic tests with `node --test tests/ts-066-overview-visual.test.mjs tests/ts-064-overview-render.test.mjs tests/ts-064-overview-responsive.test.mjs tests/ts-065-overview-continuity.test.mjs tests/ts-065-overview-docs.test.mjs tests/ts-061-design-tokens.test.mjs` and report the actual results without checking this item if any suite fails.
- [ ] 5.2 Run deterministic tests for non-regression: `node --test tests/ts-052-overview-presentation.test.mjs tests/ts-053-overview-presentation.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs tests/ts-056-overview-urgency-list.test.mjs tests/ts-060-overview-read-state.test.mjs tests/ts-063-app-shell-responsive.test.mjs tests/ts-064-overview-boundary.test.mjs tests/ts-064-overview-commands.test.mjs tests/ts-064-overview-continuity.test.mjs tests/ts-064-overview-read-state.test.mjs tests/ts-064-overview-side-effects.test.mjs tests/ts-065-overview-commands.test.mjs tests/ts-065-overview-drag.test.mjs tests/ts-065-overview-editors.test.mjs tests/ts-065-overview-context.test.mjs` and report the actual result.
- [ ] 5.3 Run `npm run check` and report the actual result without checking this item if any test, backlog check or syntax check fails.
- [ ] 5.4 Run `npm run build`, report the actual result and measured asset sizes, then run `npm run verify:build` and report the actual result without checking this item on failure.
- [ ] 5.5 Run `openspec validate ts-066 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-066/tasks.md`, and report the actual results without checking this item on failure.
- [ ] 5.6 Run `git status --porcelain` with a Node assertion that only `site/styles.css`, the presentation documentation, `tests/ts-066-*.test.mjs` and `openspec/changes/ts-066/` changed, while `site/core.js`, `site/app.js`, `site/overview/`, `site/ui/`, `package.json`, `package-lock.json`, `AGENTS.md`, `.github/workflows/`, `backlog/` and existing canonical specs remain unchanged.

## Manual acceptance

Ces vérifications restent **obligatoires pour l'acceptation humaine** et ne sont
ni cochées par `apply`, ni prouvées par la CI, un test jsdom ou une revue
statique. Consigner `PASS`, `FAIL` ou `NOT_RUN` avec la preuve, l'appareil, le
navigateur, la version et la date. Les scénarios TS-065 non attestés restent
`NOT_RUN` et ne sont pas convertis en preuve par cette section.

- Sur desktop réel, comparer Overview à la référence `DESKTOP-1` « Mes Projets -
  Vue d'ensemble » dans la limite du périmètre : hiérarchie du titre et de la
  synthèse, respiration des blocs, cartes, aperçus de tâches et commandes.
  Vérifier qu'aucune sidebar, recherche, archive ou commande non autorisée
  n'apparaît.
- Sur Chrome Android réel, comparer Overview à la référence M01 « Mes projets /
  Overview » et à la planche `M32` : en-tête, synthèse, filtre, reprise,
  suggestion, urgences, formulaire, cartes et aperçus. Vérifier la lisibilité,
  la densité et l'absence de débordement horizontal en portrait et paysage.
- Vérifier visuellement et fonctionnellement à 320, 390, 430, 768 et 1280 px :
  titres longs, métriques, notes multilignes, commandes, menus, badges de
  priorité, sous-tâches et « Voir plus ». Relever toute commande rognée ou
  information perdue.
- Parcourir au clavier physique `Tab`, `Entrée`, `Espace` et `Échap` les
  filtres, le formulaire, les cartes, les éditeurs, les menus et les commandes
  de tâche. Vérifier le focus visible, le retour de focus après action et
  l'absence de focus sur un nœud détaché.
- Au toucher réel, vérifier les cibles d'au moins 44 × 44 px, l'ouverture et la
  fermeture des menus, le repli/dépli des sous-tâches, le défilement naturel et
  l'absence de geste ou de débordement parasite.
- Vérifier les états de lecture et de synchronisation : chargement, lecture en
  attente, document vide, filtre sans résultat, erreur confirmée, action
  requise, synchronisation de fond et retour hors ligne. Contrôler qu'aucune
  métrique factice n'apparaît et que la surface React n'est pas remontée.
- Vérifier avec le lecteur d'écran disponible les noms des zones, cartes,
  tâches, formulaires, filtres et commandes, ainsi que les annonces de
  chargement, complétion, retrait et annulation.
- Comparer le rendu au comportement livré : ordre de lecture, libellés,
  classes, identifiants, commandes, brouillons, parents développés et ancrage
  de scroll. Aucun changement fonctionnel n'est attendu.
- Consigner séparément la recette humaine réellement effectuée et les
  vérifications non exécutées. Une CI verte ne vaut pas acceptation visuelle,
  tactile, clavier, Chrome Android ou lecteur d'écran.

## Post-sync review

- Après la synchronisation sémantique OPSX séparée, comparer le delta canonique
  `overview-visual-harmonization` aux exigences de ce changement : composition,
  responsive, hiérarchie des cartes, réutilisation des composants/tokens,
  parité DOM et accessibilité, préservation du comportement et vérification
  déterministe.
- Vérifier l'archive du changement et son contenu versionné, notamment le
  `Purpose`, les scénarios, la documentation de présentation et l'absence de
  route, stockage, dépendance ou configuration nouvelle.
- Relire le diff publié et vérifier qu'aucun fichier protégé, secret, workflow,
  donnée personnelle, configuration Cloud ou identifiant IndexedDB n'a été
  modifié accidentellement.
- Après publication de la PR, vérifier la CI indépendante `check` sur le SHA
  exact, la protection de branche, le build et le résultat GitHub Pages
  post-fusion, puis consigner les liens et SHA observés.
- Consigner la recette humaine réellement exécutée ou `NOT_RUN` ; ne jamais
  présenter une CI verte ou un déploiement réussi comme un essai desktop,
  Android, clavier, tactile, lecteur d'écran ou Dexie Cloud de test.
