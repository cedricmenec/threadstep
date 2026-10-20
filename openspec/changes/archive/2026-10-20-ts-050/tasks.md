# Tasks

## Implementation checklist (apply, before OPSX sync)

### 1. Separate refresh from view-state reset

- [x] 1.1 Add a pure, non-persistent helper in `site/interaction-continuity.js` that compares the effective authorized workspace identity (local/synced, database name and available user digest) and reports whether expansion must be reset; add a new `tests/ts-050-transient-view-state.test.mjs` covering same identity, changed identity and unavailable identity, then run `node --test tests/ts-050-transient-view-state.test.mjs`.
- [x] 1.2 In `site/app.js`, add a dedicated collapse-state reset helper used by explicit view boundaries and remove the `expandedParents` reset from the asynchronous `load()` refresh path; verify with the automated test assertions in `node --test tests/ts-050-transient-view-state.test.mjs tests/substep-collapse-default.test.mjs` that `load()` contains no expansion reset while the reset helper still clears the set and its pending collapse target.
- [x] 1.3 Wire the authorized-workspace identity key into the render/refresh boundary so that only a different effective identity resets `expandedParents`; verify with deterministic helper tests plus static assertions that a same-identity rebinding, a hidden business state or a sync refresh does not call the reset helper.
- [x] 1.4 Assert that the new boundary keeps `expandedParents` solely in memory and does not add a localStorage key, document field, schema change or export field; run the targeted TS-050 test and `node --test tests/substep-collapse-default.test.mjs`.

### 2. Preserve expansion across refresh events and filters

- [x] 2.1 Extend the static integration test so the `syncComplete` subscription and the `BroadcastChannel` message handler are sliced separately and each is proven to call the non-resetting refresh path; run `node --test tests/ts-050-transient-view-state.test.mjs`.
- [x] 2.2 Add deterministic model tests with `substepView` and `toggleExpandedParent` showing that an expanded parent stays expanded after a child is completed, that the completion filter still hides completed substeps, and that a parent with no visible child gets no control while another parent keeps its expansion; run `node --test tests/ts-050-transient-view-state.test.mjs`.
- [x] 2.3 Add automated test assertions for `hashchange`: a parsed route change through `isViewEntry` resets expansion, while a same-route event does not; verify statically that the reset occurs before `render()` and that the existing `aria-expanded` rendering path is unchanged; run `node --test tests/ts-050-transient-view-state.test.mjs tests/substep-collapse-default.test.mjs`.
- [x] 2.4 Add checks that a pending reveal still expands its ancestor before rendering and that a refresh never writes collapse state; run `node --test tests/ts-050-transient-view-state.test.mjs`.

### 3. Align imports and existing regression tests

- [x] 3.1 Move the local JSON import reset out of the file-selection/preview handler and into the successful confirmation path, keeping a cancelled, refused, colliding or failed import from changing expansion; verify with static assertions and `node --test tests/ts-050-transient-view-state.test.mjs`.
- [x] 3.2 Apply the same reset after a successful Cloud JSON reconciliation (written or already up to date) and not for refused, stale or failed plans; verify with static assertions in `tests/ts-050-transient-view-state.test.mjs`.
- [x] 3.3 Update `tests/substep-collapse-default.test.mjs` and `tests/task-actions-menu.test.mjs` where they assume every `load()` resets expansion, and run `node --test tests/substep-collapse-default.test.mjs tests/task-actions-menu.test.mjs tests/ts-050-transient-view-state.test.mjs`.
- [x] 3.4 Confirm that no product data, ids, parent relations, completion flags, order or exported JSON change when expansion is preserved or reset; verify with the model assertions from 2.2 and `node --test tests/ts-050-transient-view-state.test.mjs`.

### 4. Repository validation

- [x] 4.1 Run `npm run check` and report the actual result; do not check this task if any test, backlog check or JavaScript syntax check fails.
- [x] 4.2 Run `openspec validate ts-050 --strict --no-interactive` and report the actual result; do not check this task if validation fails.

## Manual acceptance

À exécuter sur deux navigateurs ou deux onglets et sur Chrome Android avec une base Dexie Cloud de test, sans données personnelles. Ces vérifications restent à effectuer et ne sont pas prouvées par la CI.

- Ouvrir une vue contenant plusieurs parents, développer plusieurs groupes, puis cocher et décocher une sous-tâche. Vérifier que le groupe concerné et les autres groupes visibles restent ouverts, que le focus ne saute pas et que `aria-expanded` reste exact.
- Provoquer une modification locale, une réception inter-onglets et une fin de synchronisation `syncComplete`, y compris après une période hors ligne puis un retour réseau. Vérifier qu'aucune de ces actualisations n'est traitée comme une entrée de vue et qu'aucun rechargement de page n'est déclenché.
- Naviguer vers une autre vue puis revenir, utiliser Précédent/Suivant, recharger la page et ouvrir un nouvel onglet. Vérifier que chaque nouvelle entrée réapplique l'état replié de TS-021 et qu'aucune ouverture n'est mémorisée entre visites.
- Annuler et refuser un import, provoquer un échec sans écriture, puis réussir un import JSON local et un import JSON Cloud. Vérifier que seuls les imports réussis replient la vue et que les annulations ou échecs conservent l'ouverture.
- Avec le filtre « Masquer les étapes terminées », terminer la dernière sous-tâche visible d'un parent, puis rétablir une sous-tâche visible. Vérifier que la commande disparaît quand aucun enfant n'est visible, qu'aucune sous-tâche filtrée ne réapparaît et que les autres groupes ne sont pas repliés.
- Changer de compte ou d'espace Cloud autorisé, y compris A→B→A. Vérifier qu'aucune expansion ni donnée métier de l'espace précédent ne reste visible, et qu'aucune erreur Cloud n'est masquée.
- Contrôler au clavier Tab, Entrée et Espace, au toucher, en focus visible et avec un lecteur d'écran sur téléphone et tablette que le contrôle reste utilisable, correctement nommé et que les sous-tâches repliées ne sont pas atteignables. Consigner appareil, navigateur, version et résultat réel ou non vérifié.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer les deltas réellement appliqués à `substep-collapse` avec les scénarios de ce changement, notamment les rafraîchissements Cloud, les notifications inter-onglets, les imports réussis et les changements d'identité autorisée.
- Vérifier l'archive du changement, son contenu versionné et l'absence de modification accidentelle des spécifications canoniques ou des archives antérieures.
- Après publication de la PR, contrôler la CI indépendante `check` sur le SHA exact, la protection de `main`, le diff de code et de sécurité, puis la fusion, la CI de `main` et le déploiement GitHub Pages.
- Séparer strictement les tests CI, la recette réelle multi-navigateurs/mobile et la vérification Dexie Cloud de test ; ne présenter aucun test simulé comme preuve de la recette utilisateur.
