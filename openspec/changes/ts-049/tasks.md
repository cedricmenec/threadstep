# Tasks

## 1. Interaction continuity model

- [ ] 1.1 Create `site/interaction-continuity.js` with pure functions for logical focus normalization, reading-anchor selection, restoration planning and scroll-offset calculation; verify with a Node test that the module has no DOM, storage, network, IndexedDB or timer access.
- [ ] 1.2 Add deterministic unit tests in `tests/ts-049-interaction-continuity.test.mjs` for anchor selection: retained first visible anchor, anchor removed and replaced by the nearest visible neighbour, no anchor available, and empty viewport input; assert the computed offset and that no scroll is requested without an anchor.
- [ ] 1.3 Add deterministic unit tests for the restoration plan: identical logical control, control moved by sort or priority, control removed by filter or removal, task card fallback, subject card fallback, and heading fallback; assert the selected target for each case.
- [ ] 1.4 Add deterministic unit tests asserting that a capture from another route, view or identity generation is invalidated and never produces a restoration target.
- [ ] 1.5 Add deterministic unit tests asserting that explicit focus intents (navigation heading, pending item, pending subject, editing, renaming, collapse, priority, menu, move) outrank continuity restoration, and that a null plan does not force focus.

## 2. Render capture and restoration

- [ ] 2.1 Add stable non-business identity markers for view, subject, task control and task-creation field in `site/app.js`; verify with a static test that the markers are read-only attributes and that no new document field, storage key or schema version appears.
- [ ] 2.2 Implement capture of the active logical control and first visible reading anchor before `subjectsEl.replaceChildren()` and restoration after the new DOM is built; verify with a deterministic DOM-simulation test that a task control is re-focused on its replacement node and the recorded scroll offset is reapplied.
- [ ] 2.3 Implement focus application with `preventScroll` when available and a bounded instant `scrollBy`/scroll adjustment for the reading anchor; verify with a deterministic test that the continuity path does not call `scrollIntoView` and passes no animated behavior.
- [ ] 2.4 Replace the stale `input.focus()` after task creation with restoration of the creation-field identity for the same subject; verify with a deterministic DOM-simulation test that two successive submissions focus a newly mounted input each time and that the focused node is present in the rendered tree.
- [ ] 2.5 Route explicit navigation, reveal, edit, rename and menu intents before the continuity plan; verify with a deterministic test that « Voir dans la liste », « Voir plus », detail heading and edit return keep their intended focus target.
- [ ] 2.6 Invalidate the capture on route entry, JSON import, workspace or identity change and blocked binding; verify with deterministic tests that no focus or scroll restoration crosses those boundaries.

## 3. Mutation-specific continuity

- [ ] 3.1 Add a deterministic DOM-simulation test for task completion with the completed filter off, asserting that focus stays on the same task control and the reading anchor offset is unchanged.
- [ ] 3.2 Add a deterministic DOM-simulation test for task completion with « Masquer les étapes terminées » on, asserting that the hidden completed task is not focused and focus moves to a visible neighbour or the subject card.
- [ ] 3.3 Add a deterministic DOM-simulation test for a priority change that reorders an item, asserting that focus follows the same item's priority control at its new position and that no top-of-page scroll is requested.
- [ ] 3.4 Add deterministic DOM-simulation tests for edit save and edit cancel, asserting that the document is unchanged on cancel, focus returns to an available task command and the reading anchor is preserved.
- [ ] 3.5 Add deterministic DOM-simulation tests for keyboard move and drag reorder, asserting that the same item's handle receives focus after the move and that restoration does not call `scrollIntoView`.
- [ ] 3.6 Add deterministic DOM-simulation tests for removal and undo, asserting that focus moves to an available subject or task target after removal and returns to the restored item after undo.
- [ ] 3.7 Add deterministic DOM-simulation tests for project creation and project move, asserting that the new or moved subject keeps the overview focus target and that other displayed subjects keep their presentation state.
- [ ] 3.8 Add a deterministic DOM-simulation test for a same-view data refresh (`load()`/sync/other-tab path), asserting that expanded parents, the logical focus target and the reading anchor offset are preserved without a top-of-page jump.

## 4. No hidden persistence or cloud side effects

- [ ] 4.1 Add a deterministic test asserting that continuity captures, plans and restoration calls create no localStorage entry, no IndexedDB record, no Dexie operation and no Cloud write.
- [ ] 4.2 Add a deterministic test asserting that task and project mutations followed by continuity restoration keep the `threadstep.document.v1` shape and round-trip unchanged through the existing JSON export/import parser.
- [ ] 4.3 Add a static test asserting that `site/core.js`, the document schema/version, export/import formats, URLs and Dexie Cloud configuration are unchanged, and that no new runtime dependency is introduced.

## 5. Integration and specification verification

- [ ] 5.1 Run `node --test tests/ts-049-interaction-continuity.test.mjs` and confirm every new deterministic test passes.
- [ ] 5.2 Run `node --check site/interaction-continuity.js` and `node --check site/app.js` and confirm both files parse.
- [ ] 5.3 Run `npm test` and confirm the full Node suite passes with the new tests and the existing regression tests.
- [ ] 5.4 Run `npm run check` and confirm the full project check passes.
- [ ] 5.5 Run `openspec validate ts-049 --strict --no-interactive` and confirm the change validates without warnings that affect the delta.
- [ ] 5.6 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-049/tasks.md` and confirm the pre-sync checklist gate accepts the plan.

## Manual acceptance

- Dans Chrome Android et sur un ordinateur de bureau, en local-first puis avec une instance Cloud de test, ouvrir une page longue et défiler jusqu'à un projet : créer une tâche ne doit ni ramener en haut de page ni recharger le document.
- Avec le clavier virtuel Android ouvert, enchaîner plusieurs créations de tâches dans le même projet et vérifier que la saisie, le focus et le viewport restent utilisables sans fermeture ni saut du clavier.
- Cocher, changer la priorité, modifier, annuler, réordonner au clavier et par glisser-déposer, retirer puis annuler un retrait : observer l'ancrage visuel, la position du viewport et la continuité du focus.
- Activer et désactiver « Masquer les étapes terminées » pendant qu'une tâche est terminée, et vérifier que le focus rejoint une cible visible et que les groupes développés restent cohérents.
- Utiliser « Voir dans la liste », « Voir plus », « Ouvrir le projet », « Retour à la vue d'ensemble », Précédent/Suivant du navigateur et les liens de navigation : vérifier que ces déplacements intentionnels ne sont pas écrasés par la restauration de continuité.
- Parcourir les interactions au clavier seul (Tab, Entrée, Espace, Échap) et avec un lecteur d'écran si disponible : vérifier l'ordre de tabulation, les annonces, le focus visible et l'absence de focus sur un contrôle détaché.
- Vérifier sur mobile et ordinateur qu'aucun saut de page ni perte de contexte ne se produit après une synchronisation Cloud ou une actualisation provenant d'un autre onglet.
- Vérifier que l'export/import JSON et les parcours de sauvegarde restent inchangés et qu'aucune écriture Cloud implicite n'est déclenchée par une action de continuité.
- Ces observations constituent une recette humaine obligatoire et ne sont pas présumées validées par les tests Node ou la CI.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer le delta de `ux-interaction-continuity` au comportement réellement livré, notamment les scénarios de contrôle déplacé, de contrôle supprimé et de rafraîchissement de la même vue.
- Vérifier l'archive OpenSpec et l'absence de doublon ou de contradiction avec les spécifications canoniques `app-navigation`, `substep-collapse`, `task-actions-menu` et `subject-overview-preview`.
- Après publication de la PR, vérifier le check GitHub indépendant `check` sur son SHA exact, la protection de `main`, les preuves de fusion et la CI/Pages après fusion.
- Confronter la recette Chrome Android, clavier virtuel, focus réel et lecteur d'écran aux invariants sans assimiler les tests simulés à une preuve de navigateur réel.
