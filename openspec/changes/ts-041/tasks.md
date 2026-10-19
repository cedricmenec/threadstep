# Tasks

## 1. Pure routing and navigation model

- [ ] 1.1 Extend `parseRoute` in `site/core.js` with the exact settings fragments `#/parametres`, `#/parametres/donnees` and `#/parametres/synchronisation`, returning a settings section while preserving `#/sujet/<id>`, malformed-project and unknown-fragment behavior; add `tests/ts-041-navigation.test.mjs` cases for each route, the empty hash, an unknown fragment, a valid project id with URL-special characters and a malformed project id.
- [ ] 1.2 Extend `isViewEntry` so changes between overview, project and each settings section are detected and identical routes are not; add deterministic assertions for overview/settings, settings/settings, settings/project and repeated identical routes.
- [ ] 1.3 Add pure helpers in `site/core.js` for the four ordered menu entries (`Mes projets`, `Paramètres`, `Imports / Exports`, `Synchronisation Dexie Cloud`) with their exact fragments, and a route-to-heading-id mapping for `dashboard-title`, `settings-title`, `settings-data-title` and `settings-sync-title`; add unit tests for exact labels, order, fragments, immutability and each mapping including null inputs.
- [ ] 1.4 Add a pure navigation-menu state function covering `toggle`, `escape`, `outside`, `navigate` and `route-change`, with an explicit focus-restore decision; add unit tests for every action, the closed and open initial states, and an unknown action leaving the state unchanged.

## 2. Header menu markup, styles and behavior

- [ ] 2.1 Add the header menu button and navigation panel to `site/index.html` with `type="button"`, accessible name « Menu », `aria-expanded="false"`, `aria-controls` linked to the panel and the panel initially `hidden`; add static assertions that the button, panel, exact four labels, exact four fragments and visible order are present.
- [ ] 2.2 Add the menu styles to `site/styles.css` with a minimum 44 × 44 px trigger and links, a viewport-bounded panel, a visible focus style, `hidden` handling and a narrow-width media query; add static CSS assertions for these selectors and declarations.
- [ ] 2.3 Wire the menu in `site/app.js`: toggle open/closed state, keep `aria-expanded` and `hidden` synchronized, close on Escape with focus restoration to the trigger, close on outside activation, and close on every route change; add source-level assertions for each listener and state update.
- [ ] 2.4 Add menu-link activation handling that closes the panel before navigation and schedules focus on the destination heading returned by the pure mapping, including the already-active-route case; add static assertions that the handler uses the pure focus mapping and that destination headings expose `tabindex="-1"`.

## 3. Settings routes, pages and presentation-only navigation

- [ ] 3.1 Add the three settings page sections to `site/index.html` with the exact titles « Paramètres », « Imports / Exports » and « Synchronisation Dexie Cloud », explicit French back links, and descriptive destination sections; add static assertions for the titles, back links, « Exporter », « Importer et fusionner », « Restaurer un état antérieur » and the synchronization destination text.
- [ ] 3.2 Implement route-driven visibility in `site/app.js` so exactly one settings section is shown for a settings route and the dashboard is hidden, while all existing global panels and the current `#business-tools`, `#workspace-panel`, `#auth-panel`, `#cloud-config`, `#restore-panel` and `#sync-diagnostic` selectors remain in place; add static assertions for the visibility rules and selector preservation.
- [ ] 3.3 Add static tests proving no business control id (`export`, `import`, `restore`, `restore-panel`, `sync-diagnostic`, `cloud-config`, `auth-panel`, `workspace-panel`) is duplicated inside the settings sections and that the existing ids still occur exactly once in `site/index.html`.
- [ ] 3.4 Add a deterministic source test that the `hashchange` handler and the menu open/close/link handlers contain no `load(`, `persist(`, `refreshSyncedDocument`, `bootstrap`, `.open(`, `fetch(`, `indexedDB`, `localStorage`, authentication start or Cloud pull call; fix the implementation until that assertion passes.

## 4. Non-regression, documentation and focused verification

- [ ] 4.1 Add non-regression assertions that a valid `#/sujet/<id>` still resolves to the project view, an invalid or unknown project fragment still uses the accessible fallback, and no settings route is interpreted as a subject id; run `node --test tests/core.test.mjs tests/ts-041-navigation.test.mjs` and report the actual result.
- [ ] 4.2 Update `docs/product/guide-utilisation.md` and `docs/product/acceptance-checklist.md` to describe the Menu, the four entries, the three settings fragments, back navigation and the fact that existing import/export/Cloud controls stay at their current location; add a static documentation test for these statements.
- [ ] 4.3 Run `node --check site/core.js && node --check site/app.js` and report the actual result; do not mark this item if either check fails.

## 5. Integration verification

- [ ] 5.1 Run `npm run check` and report the actual output; fix any failure before marking this item complete.
- [ ] 5.2 Run `openspec validate ts-041 --strict --no-interactive` and report the actual result.
- [ ] 5.3 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-041/tasks.md` and report the actual result.

## Manual acceptance

- Sur un smartphone réel et un ordinateur, vérifier le bouton Menu, son icône hamburger, son libellé accessible, son ouverture et sa fermeture à la souris et au toucher, ainsi que l'absence de débordement horizontal à 320 px et aux largeurs usuelles.
- Naviguer au clavier seul (Tab, Entrée, Espace, Échap) dans le menu et les pages de paramètres, vérifier le focus visible, le retour du focus au déclencheur après Échap, le placement du focus sur le titre après un lien et l'absence de piège de focus.
- Contrôler avec un lecteur d'écran le nom du bouton, `aria-expanded`, `aria-controls`, l'ordre des quatre entrées, l'annonce des titres de pages et la navigation retour.
- Vérifier les liens profonds des trois pages de paramètres, Précédent/Suivant, le rechargement, la réouverture de session et le comportement hors ligne, sans perte de la route affichée.
- Vérifier que la navigation entre Mes projets, Imports / Exports et Synchronisation Dexie Cloud ne modifie aucune donnée IndexedDB, ne change aucune configuration Cloud, ne déclenche ni OTP, ni requête réseau, ni pull, et conserve l'état de synchronisation en mémoire.
- Vérifier visuellement et au zoom que les pages de paramètres n'affichent aucun contrôle métier dupliqué, que les commandes existantes restent accessibles à leur emplacement actuel et que le menu se ferme lors d'une action extérieure pertinente.
- Ces contrôles nécessitent un vrai navigateur, un appareil réel et une inspection humaine. Ils restent à vérifier et ne contiennent aucune case à cocher.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer les deltas de `app-navigation` avec le comportement attendu des routes, du menu, des pages de paramètres et de l'absence d'effet de bord.
- Vérifier que `subject-detail-view` et les autres spécifications canoniques n'ont pas été modifiées au-delà du delta approuvé, et que les changements archivés n'ont pas été altérés.
- Contrôler le changement OpenSpec archivé et son contenu versionné.
- Après publication de la PR, vérifier le check GitHub indépendant `check` sur son SHA exact, la protection requise, la preuve de fusion, la CI `main` et le déploiement GitHub Pages.
- Comparer la recette humaine réellement effectuée aux exigences mobiles, clavier, lecteur d'écran et hors ligne ; ne jamais présenter une vérification non exécutée ou partielle comme réussie.
- Cette revue est externe à `apply`, ne contient aucune case à cocher et reste ouverte tant que ses preuves n'existent pas.
