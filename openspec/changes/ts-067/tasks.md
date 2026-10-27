# Tasks

## 1. Baseline and delivery dependency

- [x] 1.1 Add a Node assertion (temporary script or test run) that `openspec/changes/archive/2026-10-27-ts-066` exists with `proposal.md`, `design.md` and `tasks.md`, that `site/app-shell/` contains the four shell modules, and that no prior human acceptance record is read as a gate; report the actual result.
- [x] 1.2 Before editing, run the deterministic test command `node --test tests/ts-041-navigation.test.mjs tests/ts-063-app-shell-render.test.mjs tests/ts-063-app-shell-navigation.test.mjs tests/ts-063-app-shell-boundary.test.mjs tests/ts-063-app-shell-side-effects.test.mjs tests/ts-063-app-shell-responsive.test.mjs tests/ts-063-app-shell-docs.test.mjs tests/ts-066-overview-visual.test.mjs` and report the actual results without checking this item if a suite fails.

## 2. Pure route-to-destination mapping

- [x] 2.1 Add an exported pure helper in `site/core.js` that maps a parsed route to the matching `NAV_MENU_ENTRIES` fragment (Overview, project detail and unknown fallback to `#/`; settings root/data/sync to their fragments) and verify with `tests/ts-067-navigation-state.test.mjs` covering every route, `null`, invalid and malformed input, with no mutation of the frozen entries.
- [x] 2.2 Add deterministic assertions that `NAV_MENU_ENTRIES` keeps exactly four labels, four fragments and their order, that `parseRoute` produces unchanged results, and that no new route, fragment, history or store is introduced; run `node --test tests/ts-067-navigation-state.test.mjs tests/ts-041-navigation.test.mjs` and report the actual result.

## 3. Shell markup and accessible state

- [x] 3.1 Move the static `#app-shell-root` block in `site/index.html` so it is a direct child of `<main class="shell">`, keep exactly one host, four fallback links and their `data-open` state, and add deterministic assertions in `tests/ts-067-app-shell-layout.test.mjs` that no business id (`#subjects`, settings forms, data actions, Cloud panels) is inside the host; run the test and report the actual result.
- [x] 3.2 Update `site/app-shell/AppHeader.jsx` and `site/app-shell/AppNavigation.jsx` to use a single navigation instance with `data-open="true|false"` instead of the `hidden` attribute, and to set `aria-current="page"` on exactly the link returned by the pure mapping; add deterministic render assertions for closed/open state, unique panel/link nodes, active-link parity for `#/`, `#/sujet/<id>`, all three settings routes and unknown routes; run `node --test tests/ts-067-app-shell-layout.test.mjs` and report the actual result.
- [x] 3.3 Add deterministic tests for interaction: that a link activation calls the controller once, that toggle, Escape, outside action and route change close the compact drawer, that focus restoration targets the present Menu button, and that mounting/updating/unmounting the shell performs no storage write, network call, OTP, authentication or business command; run `node --test tests/ts-067-app-shell-layout.test.mjs tests/ts-063-app-shell-navigation.test.mjs tests/ts-063-app-shell-side-effects.test.mjs` and report the actual result.
- [x] 3.4 Update `tests/ts-041-navigation.test.mjs` and `tests/ts-063-app-shell-*.test.mjs` assertions that still expect the `hidden` attribute or forbid all permanent navigation, replacing them with the approved `data-open` rail/drawer semantics while keeping the checks on four exact links, 44 px targets, focus and absence of business side effects; run those suites and report the actual result.

## 4. Responsive shell and presentation invariants

- [x] 4.1 Add the shell grid, sticky desktop rail and compact drawer rules in `site/styles.css` with a documented local `1024px` breakpoint, a content column preserving `--content-max-width`, `min-width:0`, `max-width:100%` and no `overflow-x`; add deterministic static assertions in `tests/ts-067-app-shell-responsive.test.mjs` for the media query, grid columns, `calc(var(--content-max-width) + 232px)`, bounded panel widths at 320/390/430/768/1280 px and absence of fixed widths above the mobile viewport; run the test and report the actual result.
- [x] 4.2 Add active-destination and focus styles using existing tokens (`--color-surface-muted`, `--color-action`, `--focus-outline`, `--control-target-min`) with a non-colour cue, and add deterministic assertions that each link and the Menu button keep `min-width:44px`/`min-height:44px`, that focus-visible rules remain present, and that the closed compact panel uses `display:none` through `[data-open="false"]`; run `node --test tests/ts-067-app-shell-responsive.test.mjs` and report the actual result.
- [x] 4.3 Add deterministic assertions that every value in `site/styles/tokens.css` is unchanged, that no new token, palette, font, icon, CDN, remote asset or dependency is introduced, and that the CSP meta content in `site/index.html` is unchanged; run the relevant TS-061 token test and report the actual result.
- [x] 4.4 Add deterministic assertions that TS-066 Overview card classes, task classes, accessible names and command order remain unchanged and that only the shell/container composition is touched; run `node --test tests/ts-066-overview-visual.test.mjs tests/ts-064-overview-render.test.mjs tests/ts-065-overview-continuity.test.mjs` and report the actual result.

## 5. Documentation

- [x] 5.1 Update `docs/product/react-app-shell.md` with the desktop rail, compact drawer, `1024px` local breakpoint, host placement, ownership map, focus/scroll invariants, rollback, evidence and manual-acceptance limits, and update `docs/product/developer-guide.md` with the TS-067 entry points and deterministic test commands.
- [x] 5.2 Add `tests/ts-067-docs.test.mjs` asserting the required sections, breakpoint, rail/drawer description, unchanged ownership boundary, rollback and the distinction between structural tests and human acceptance, and run `node --test tests/ts-067-docs.test.mjs tests/ts-063-app-shell-docs.test.mjs`; report the actual result.

## 6. Integration checks before semantic sync

- [x] 6.1 Run the deterministic test command `node --test tests/ts-067-navigation-state.test.mjs tests/ts-067-app-shell-layout.test.mjs tests/ts-067-app-shell-responsive.test.mjs tests/ts-067-docs.test.mjs tests/ts-041-navigation.test.mjs tests/ts-063-app-shell-render.test.mjs tests/ts-063-app-shell-navigation.test.mjs tests/ts-063-app-shell-boundary.test.mjs tests/ts-063-app-shell-side-effects.test.mjs tests/ts-063-app-shell-responsive.test.mjs tests/ts-063-app-shell-docs.test.mjs tests/ts-064-overview-render.test.mjs tests/ts-065-overview-continuity.test.mjs tests/ts-066-overview-visual.test.mjs` and report the actual results without checking this item if any suite fails.
- [x] 6.2 Run `npm run check` and report the actual result without checking this item if any test, backlog check or syntax check fails.
- [x] 6.3 Run `npm run build`, report the actual result and measured asset sizes, then run `npm run verify:build` and report the actual result without checking this item on failure.
- [x] 6.4 Run `openspec validate ts-067 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-067/tasks.md`, and report the actual results without checking this item on failure.
- [x] 6.5 Run `git status --porcelain` with a Node assertion that only `site/app-shell/`, `site/core.js`, `site/index.html`, `site/styles.css`, `docs/product/react-app-shell.md`, `docs/product/developer-guide.md`, `tests/ts-067-*.test.mjs`, updated `tests/ts-041-navigation.test.mjs` and `tests/ts-063-app-shell-*.test.mjs`, and `openspec/changes/ts-067/` changed, while `site/styles/tokens.css`, `package.json`, `package-lock.json`, `AGENTS.md`, `.github/workflows/`, `backlog/`, `openspec/specs/` and Dexie/storage modules remain unchanged.

## Manual acceptance

Ces vérifications restent **obligatoires pour l'acceptation humaine** et ne sont
ni cochées par `apply`, ni prouvées par la CI, un test jsdom ou une revue
statique. Consigner `PASS`, `FAIL` ou `NOT_RUN` avec l'appareil, le navigateur,
la version, la largeur et la date. La recette TS-066 non attestée reste
`NOT_RUN` et n'est pas convertie en preuve par cette section.

- Sur navigateur desktop réel, comparer le shell à `DESKTOP-1` « Mes Projets -
  Vue d'ensemble » : navigation latérale persistante, hiérarchie du contenu
  Overview, proportions, respiration et absence de liens ou commandes
  dupliqués. Vérifier qu'aucune recherche, archive, partage ou destination
  supplémentaire n'apparaît.
- À 1280 px, vérifier que les quatre destinations sont visibles dans le rail,
  que la zone Overview reste lisible et que le bouton Menu n'est pas présenté
  comme contrôle actif.
- À 768, 430, 390 et 320 px, vérifier que le bouton Menu ouvre un tiroir
  lisible, sans débordement horizontal, sans libellé tronqué et avec des cibles
  d'au moins 44 × 44 px.
- Parcourir au clavier physique `Tab`, `Entrée`, `Espace` et `Échap` le bouton,
  le tiroir, les quatre liens et les commandes de la page. Vérifier le focus
  visible, le retour de focus sur le bouton après Échap, l'absence de piège de
  focus et l'absence de focus sur un nœud détaché après navigation.
- Au toucher réel, vérifier l'ouverture et la fermeture du tiroir, la sélection
  d'un lien, la fermeture après navigation et le défilement naturel.
- Sur Chrome Android réel, comparer le menu ouvert à `M02` et les largeurs
  compactes aux repères de `M32` sans traiter `M32` comme une certification
  d'accessibilité.
- Vérifier la continuité : l'ouverture/fermeture du tiroir ne déplace ni le
  scroll ni le focus de la vue courante ; un changement de route conserve
  l'historique Précédent/Suivant ; le détail projet ne remonte pas sa racine
  React et conserve ses brouillons, listes, Undo, focus et scroll ; un OTP ou
  une activation Cloud en cours conserve son état.
- Vérifier avec le lecteur d'écran disponible l'annonce du bouton, de
  `aria-expanded`, du panneau, de `aria-current` et des quatre libellés.
- Vérifier visuellement l'état de route courant sur `#/`, un détail projet,
  chaque page de paramètres et un fragment inconnu ; confirmer qu'aucune
  information n'est portée par la seule couleur.
- Consigner séparément la recette réellement effectuée et les vérifications non
  exécutées. Une CI verte ne vaut pas acceptation visuelle, tactile, clavier,
  Chrome Android ou lecteur d'écran.

## Post-sync review

- Après la synchronisation sémantique OPSX séparée, comparer le delta canonique
  `app-navigation` aux exigences de ce changement : rail desktop, tiroir
  compact, point de rupture `1024px`, `aria-current`, parité des quatre
  destinations et conservation des frontières.
- Vérifier l'archive du changement et son contenu versionné, notamment
  `Purpose` ou exigences mises à jour, scénarios, documentation de la coque et
  absence de route, stockage, dépendance ou configuration nouvelle.
- Relire le diff publié et vérifier qu'aucun fichier protégé, secret, workflow,
  donnée personnelle, configuration Cloud, valeur de token ou identifiant
  IndexedDB n'a été modifié accidentellement.
- Après publication de la PR, vérifier la CI indépendante `check` sur le SHA
  exact, la protection de branche, le build et le résultat GitHub Pages
  post-fusion, puis consigner les liens et SHA observés.
- Consigner la recette humaine réellement exécutée ou `NOT_RUN` ; ne jamais
  présenter une CI verte ou un déploiement réussi comme un essai desktop,
  Android, clavier, tactile, lecteur d'écran ou Dexie Cloud de test.
