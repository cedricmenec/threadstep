# Tasks

## 1. Dependency gate and interaction baseline

- [ ] 1.1 Verify by Node assertions that `openspec/changes/archive/2026-10-26-ts-064` exists, that its delivery commit is an ancestor of `HEAD`, that `site/overview/` and `site/project-detail/TaskItem.jsx` are present, and that `site/core.js`, `site/react-boundary.js`, `site/react-adapter.js`, `package.json`, `package-lock.json`, `AGENTS.md`, `.github/workflows/` and existing `openspec/specs/` are unmodified by this change; if the TS-064 prerequisite evidence is absent, report the blocker without editing product files.
- [ ] 1.2 Before production edits, write `/tmp/ts-065-interactions-baseline.json` from deterministic fixtures with the current Overview control classes, accessible names, command names, drag classes and write counts, and add a Node assertion that the snapshot contains `task-menu-button`, `task-check`, `priority-control`, `task-toggle`, `task-handle`, `overview-see-more` and `reorderItem`.
- [ ] 1.3 Run `node --test tests/ts-064-overview-commands.test.mjs tests/ts-064-overview-continuity.test.mjs tests/ts-064-overview-render.test.mjs tests/ts-064-overview-side-effects.test.mjs tests/ts-059-project-detail-commands.test.mjs tests/ts-060-project-detail-commands.test.mjs` and report the actual result without checking any item if a suite fails.

## 2. React-owned drag interaction and delegated commands

- [ ] 2.1 Add an optional drag-session prop to `site/project-detail/TaskItem.jsx` so its existing detail behavior remains the default when the prop is absent, and add a deterministic jsdom assertion that the detail path still calls `startDrag` exactly once while a supplied session owns the gesture.
- [ ] 2.2 Create a bounded Overview drag-session module under `site/overview/` that keeps dragging item, candidate target and `before`/`after` position in React state, and add deterministic jsdom tests asserting the visual classes during pointer movement and their removal on completion, cancellation and unmount.
- [ ] 2.3 Wire the drag session into `OverviewSurface`, `ProjectCard` and `OverviewTaskList`, and add a deterministic jsdom test using the real command factory that a valid drop emits exactly one `reorderItem` command and at most one `persist` write.
- [ ] 2.4 Add deterministic jsdom tests asserting that an invalid target, `Escape`, `pointercancel` and surface invalidation each emit zero `reorderItem` commands and zero `persist` writes, and that no drag listener remains after unmount.
- [ ] 2.5 Add `tests/ts-065-overview-commands.test.mjs` assertions using real controller commands and spies: one activation each for create, save edit, priority, completion, menu command, collapse, removal, undo and tracking emits exactly one named command and at most one write; opening or closing a menu emits zero writes.
- [ ] 2.6 Create `docs/product/react-overview-interactions.md` with the drag ownership, delegated command and diagnostic sections, and add `tests/ts-065-overview-docs.test.mjs` assertions that the documented sections and command names exist.

## 3. Editors, continuity and context isolation

- [ ] 3.1 Add deterministic jsdom tests for the Overview create form asserting valid submission emits one create command and one write, resets the fields, rejects blank or too-long titles with no write, and respects the 500-item limit with no write.
- [ ] 3.2 Add deterministic jsdom tests for the inline editor asserting title, priority and note prefill; valid save emits one update command and at most one write; note or title validation failure emits no write; cancel discards the draft and emits no write.
- [ ] 3.3 Add deterministic jsdom tests asserting a focused editor control remains connected after `surface.update()`, that an unsaved title and note survive a same-context refresh, and that the create-form draft survives the same refresh without a write.
- [ ] 3.4 Add deterministic jsdom tests asserting an open menu, an expanded parent and a simulated scroll anchor survive a same-context update, and that focus returns to a present control after completion, priority change, collapse, cancel and reorder.
- [ ] 3.5 Add deterministic jsdom tests asserting that an identity change, a workspace change, a blocked read and a late event from the previous workspace release the surface with no draft, menu, drag target or pending-undo data exposed and with zero additional writes.
- [ ] 3.6 Add static assertions that Overview interaction modules add no route, storage key, dependency, Dexie/IndexedDB access, OTP call, network request, CSP change or executable rendering of user text.
- [ ] 3.7 Extend `docs/product/react-overview-interactions.md` and `docs/product/developer-guide.md` with editor continuity, context-isolation, platform-boundary and rollback sections, and extend `tests/ts-065-overview-docs.test.mjs` to assert those sections and the absence of new routes or storage keys.

## 4. Integration checks before semantic sync

- [ ] 4.1 Run `node --test tests/ts-065-overview-commands.test.mjs tests/ts-065-overview-editors.test.mjs tests/ts-065-overview-drag.test.mjs tests/ts-065-overview-continuity.test.mjs tests/ts-065-overview-context.test.mjs tests/ts-065-overview-docs.test.mjs` and report the actual result without checking any item if a suite fails.
- [ ] 4.2 Run the non-regression suites `node --test tests/ts-064-overview-render.test.mjs tests/ts-064-overview-commands.test.mjs tests/ts-064-overview-boundary.test.mjs tests/ts-064-overview-continuity.test.mjs tests/ts-064-overview-read-state.test.mjs tests/ts-064-overview-side-effects.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-049-tablet-scroll.test.mjs tests/ts-059-project-detail-commands.test.mjs tests/ts-059-project-detail-continuity.test.mjs tests/ts-060-project-detail-commands.test.mjs tests/ts-060-project-detail-continuity.test.mjs tests/ts-061-ui-primitives.test.mjs tests/ts-063-app-shell-navigation.test.mjs` and report the actual result.
- [ ] 4.3 Run `npm run check` and report the actual result without checking the item if any test, backlog check or syntax check fails.
- [ ] 4.4 Run `npm run build` and report the actual result and the measured asset sizes.
- [ ] 4.5 Run `npm run verify:build` and add a Node assertion on the artifact for unchanged CSP, `/threadstep/` paths, no remote resource and reproducible output; report the actual result.
- [ ] 4.6 Run `openspec validate ts-065 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-065/tasks.md`, and report the actual results without checking the item on failure.
- [ ] 4.7 Run `git status --porcelain` with a Node assertion that only `site/overview/`, the optional `site/project-detail/TaskItem.jsx` prop change, `site/app.js` wiring strictly needed for the drag session, `tests/ts-065-*.test.mjs`, the two affected documentation files and `openspec/changes/ts-065/` changed; protected workflow, package, Dexie, core, boundary, adapter, backlog and existing-spec paths must remain unchanged.

## Manual acceptance

Ces vérifications restent **obligatoires pour l'acceptation humaine** et ne sont
ni cochées par `apply`, ni prouvées par la CI, un test jsdom ou une revue
statique. Consigner `PASS`, `FAIL` ou `NOT_RUN` avec la preuve, l'appareil, le
navigateur, la version et la date.

- Confirmer que TS-064 est fusionnée et que sa recette propriétaire desktop et
  Android est effectivement déclarée validée ; sans cette preuve, consigner le
  blocage et ne pas revendiquer la dépendance comme satisfaite.
- Sur desktop réel, parcourir Overview : création, édition préremplie,
  validation refusée, annulation, conservation d'un brouillon après
  rafraîchissement, priorité, complétion, menu, repli/dépli des sous-tâches,
  retrait/Undo, suivi, déplacement et « Voir plus ». Vérifier qu'une seule
  action est produite par clic et que les compteurs restent cohérents.
- Vérifier au clavier physique `Tab`, `Entrée`, `Espace` et `Échap` sur les
  formulaires, éditeurs, menus, poignées et commandes ; contrôler le focus
  visible, le retour de focus après sauvegarde, annulation, complétion,
  priorité et dépôt, ainsi que l'absence de focus sur un nœud détaché.
- Sur Chrome Android réel, au toucher, tester création et édition avec clavier
  virtuel, priorité, complétion, menu, repli/dépli, retrait/Undo et
  glisser-déposer en portrait et paysage. Vérifier le scroll naturel hors
  poignée, les cibles tactiles d'au moins 44 × 44 px et l'absence de
  débordement horizontal.
- Comparer visuellement le rendu desktop et Android à celui du comportement
  livré : ordre, densité, libellés français, classes visuelles, indicateur de
  dépôt et états désactivés. Aucun changement de composition Stitch n'est
  attendu.
- Vérifier avec le lecteur d'écran disponible les noms des cartes, contrôles,
  éditeurs, menus, poignées et messages de validation, ainsi que les annonces
  après complétion, priorité, retrait et annulation.
- Dans une instance Dexie Cloud **de test**, avec sauvegarde préalable et
  données synthétiques, vérifier qu'une synchronisation de fond met à jour les
  cartes sans remonter la surface, et qu'un changement d'espace ou une lecture
  bloquée ne révèle ni brouillon, ni menu, ni cible de drag, ni Undo du
  contexte précédent. Ne jamais purger une base personnelle.
- Vérifier à 320, 390, 430, 768 et 1280 px sur un vrai navigateur la lisibilité
  des formulaires, éditeurs, menus et libellés longs, ainsi que l'absence de
  débordement ou de commande rognée.
- Une CI verte ou un test jsdom ne vaut pas acceptation visuelle, tactile,
  clavier, mobile, lecteur d'écran ou synchronisation réelle.

## Post-sync review

- Après la synchronisation sémantique OPSX séparée, comparer le delta canonique
  `react-overview-interactions` aux exigences de ce changement : unicité des
  commandes et écritures, éditeurs, drag, continuité, isolation des contextes,
  parité et vérification déterministe.
- Vérifier l'archive du changement et son contenu versionné, notamment la
  présence du `Purpose`, des scénarios, de la documentation et l'absence de
  route, stockage ou dépendance nouvelle.
- Relire le diff publié et vérifier qu'aucun fichier protégé, secret, workflow,
  donnée personnelle, configuration Cloud ou identifiant IndexedDB n'a été
  modifié accidentellement.
- Après publication de la PR, vérifier la CI indépendante `check` sur le SHA
  exact, la protection de branche, le build et le résultat GitHub Pages
  post-fusion, puis consigner les liens et SHA observés.
- Consigner la recette humaine réellement exécutée ou `NOT_RUN` ; ne jamais
  présenter une CI verte ou un déploiement réussi comme un essai desktop,
  Android, clavier, tactile, lecteur d'écran ou Dexie Cloud de test.
- Ne pas démarrer TS-066 à partir de cette livraison : la composition visuelle
  garde ses propres prérequis et validations.
