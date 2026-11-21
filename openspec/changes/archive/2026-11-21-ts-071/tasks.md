# Tasks

## Implementation checklist (apply, before OPSX sync)

### 1. Card composition

- [x] 1.1 Recompose the project card header and footer with actual project labels and the existing unique open/create commands; add render tests asserting no invented metadata or disabled sharing/archive controls.
- [x] 1.2 Group existing project move and remove commands into one accessible card action; test unique accessible names, command delegation and focusable controls.
- [x] 1.3 Render distinct genuine-empty and filter-hidden states; test both without changing preview or canonical counters.

### 2. Responsive task rows and interactions

- [x] 2.1 Add deterministic markup and CSS assertions for wrapping, semantic labels, visible-focus selectors, connectors and 44px targets in `tests/ts-071-overview-responsive.test.mjs`; verify with `node --test tests/ts-071-overview-responsive.test.mjs`.
- [x] 2.2 Add assertions in `tests/ts-071-overview-responsive.test.mjs` that mobile/coarse-pointer CSS hides free-drag handles and existing applicable move commands remain accessible; verify with `node --test tests/ts-071-overview-responsive.test.mjs`.
- [x] 2.3 Add deterministic regression coverage for preview 0/1/5/6, substeps, independent cards, delegated actions, and same-context state continuity; run the targeted Overview tests.

### 3. Product documentation and checks

- [x] 3.1 Update the Overview component and interaction guides to describe the new composition, project actions and touch reordering alternative; test documentation assertions.
- [x] 3.2 Run `npm run check`, `npm run build`, `npm run verify:build`, strict OpenSpec validation and the OpenSpec task-phase validator; check every completed task against its evidence before OPSX sync.

## Manual acceptance

Comparer les cartes aux deux captures sur bureau et téléphone. Vérifier 320, 390, 430, 768 et 1280 px, contenu long, tâches vides/filtrées/terminées, focus réel, clavier, toucher, menus, réordonnancement et lecteur d’écran. Relever les appareils, navigateurs et résultats réellement observés ; ces scénarios ne sont pas prouvés par les tests Node/jsdom.

## Post-sync review

Relire les deltas sémantiques, l’archive et les fichiers hors périmètre. Après publication, vérifier le contrôle indépendant sur le SHA exact, puis CI de `main` et Pages uniquement si fusion autorisée. Garder le statut de recette manuelle distinct.
