# Tasks

## 1. Mesures de référence et garde-fous

- [ ] 1.1 Exécuter `npm ci` puis `npm run build`, et écrire dans `/tmp/ts-059-build-baseline.json` la taille totale de `dist/assets`, celle du chunk applicatif et celle du CSS ; vérifier par une assertion Node que le fichier contient trois entiers positifs et que le build a réussi.
- [ ] 1.2 Écrire dans `/tmp/ts-059-code-baseline.json` le nombre de lignes de `site/app.js`, `site/react-boundary.js`, `site/react-adapter.js` et des tests, ainsi que le nombre de commandes exposées par `site/react-adapter.js` ; vérifier par une assertion Node que chaque valeur est un entier et que `site/app.js` ne contient encore aucun import de composant de détail.
- [ ] 1.3 Exécuter `node --test tests/ts-058-react-toolchain.test.mjs tests/ts-058-react-boundary.test.mjs tests/ts-058-react-adapter.test.mjs tests/ts-058-react-integration.test.mjs` et rapporter le résultat réel ; ne pas cocher si un test échoue.

## 2. Composants de présentation et décision de route

- [ ] 2.1 Créer `site/project-detail/surface-decision.js` avec une fonction pure décidant du montage React selon la route, l'accès métier, le chargement bloquant et l'existence du projet ; ajouter dans `tests/ts-059-project-detail-render.test.mjs` des assertions déterministes pour `#/sujet/:id`, `#/`, les paramètres, un projet absent et un accès bloqué.
- [ ] 2.2 Implémenter `ProjectDetail.jsx`, `TaskList.jsx`, `TaskItem.jsx` et `SubtaskList.jsx` en réutilisant `site/core.js` et les classes CSS existantes ; ajouter dans `tests/ts-059-project-detail-render.test.mjs` les assertions déterministes sur le titre, les compteurs, l'ordre par priorité, la hiérarchie, les IDs, les notes multilignes, l'état vide, les classes et le rendu littéral du markup.
- [ ] 2.3 Implémenter `TaskActionMenu.jsx` et `TaskEditor.jsx` avec les libellés, noms accessibles, `aria-expanded`, commandes désactivées, préremplissage titre/priorité/note et affichage d'erreur ; ajouter dans `tests/ts-059-project-detail-render.test.mjs` les assertions déterministes correspondantes, dont l'absence de commande non applicable.
- [ ] 2.4 Créer `site/project-detail/ProjectDetailSurface.jsx` montant les composants précédents et exposant `mount`/`update`/`unmount` ; compiler la surface avec les options JSX de `vite.config.mjs` via un nouveau `tests/helpers/ts-059-project-detail-harness.mjs`, et vérifier par une assertion statique que les composants n'importent ni Dexie, ni OTP, ni `site/app.js`, ni `persistence.js`.
- [ ] 2.5 Mettre à jour `docs/product/developer-guide.md` et `docs/architecture.md` avec la liste des composants du détail, leur propriété de présentation et le fait qu'Overview reste vanilla ; exécuter `node --test tests/ts-059-project-detail-render.test.mjs` et rapporter le résultat réel.

## 3. Adaptateur, commandes et validations

- [ ] 3.1 Étendre `site/react-adapter.js` avec les commandes `createSubstep`, `setPriority`, `undoRemoval`, `moveItem`, `beginEdit`, `cancelEdit`, `startDrag` et `cancelDrag`, en conservant les noms et signatures TS-058 ; ajouter dans `tests/ts-059-project-detail-commands.test.mjs` une assertion déterministe que chaque nom délègue une seule fois au callback correspondant et qu'aucun import Dexie/OTP/store secondaire n'est ajouté.
- [ ] 3.2 Enrichir l'instantané avec `expandedParents`, `openMenuId`, `editingItemId`, `renamingSubject`, `hideCompleted`, `trackedItemId` et `revealItemId` dans `transient`, sans exposer le document mutable ; ajouter un test déterministe de non-mutabilité et de stabilité des IDs après `refresh()`.
- [ ] 3.3 Créer `site/project-detail/controller-commands.js` comme fabrique à dépendances injectées, réutilisant `site/core.js` pour création, édition, priorité, complétion, retrait/annulation, réordonnancement, déplacement, promotion, sous-tâche, suivi, renommage et retour ; vérifier par `node --check` et par une assertion statique l'absence de document interne et d'écriture hors du callback `persist` injecté.
- [ ] 3.4 Ajouter dans `tests/ts-059-project-detail-commands.test.mjs` les cas déterministes de limites et validations : titre vide ou espaces, titre de 301 caractères, note de 2001 caractères, nom de projet de 101 caractères, tentative d'ajout au-delà de 500 étapes, priorité invalide et sous-tâche sous un parent inexistant ; vérifier qu'aucun `persist` ni mutation n'est déclenché en cas d'échec.
- [ ] 3.5 Ajouter dans `tests/ts-059-project-detail-commands.test.mjs` les cas nominaux et limites de complétion, priorité sans changement, remove/undo, réordonnancement interdit, promotion, ouverture/repli, menu (un seul ouvert, Escape, clic extérieur), suivi et retour ; vérifier exactement un callback et au plus un `persist` par action valide.
- [ ] 3.6 Exécuter `node --test tests/ts-059-project-detail-commands.test.mjs` et rapporter le résultat réel ; ne pas cocher si un cas de validation ou de double écriture échoue.

## 4. Intégration, propriété DOM et continuité

- [ ] 4.1 Brancher la surface dans `site/app.js` pour la seule route `subject` : import statique, décision via `surface-decision`, `reactBoundary.mount` sur `subjectsEl`, invalidation avant tout rendu vanilla et repli vanilla pour route invalide ou projet absent ; ajouter dans `tests/ts-059-project-detail-integration.test.mjs` des assertions déterministes sur la présence d'une seule branche de montage et sur l'absence de montage React pour Overview et Paramètres, et sur la conservation des appels vanilla de la carte de suggestion et des cartes de projets.
- [ ] 4.2 Piloter les mises à jour par `adapter.refresh()` dans `flushSync` et réutiliser `captureUxContinuity`, `finishUxRender` et `applyFocus` après le commit ; ajouter un test déterministe jsdom vérifiant que le focus revient sur un contrôle présent après sauvegarde, annulation, déplacement et retrait, et qu'il ne reste pas sur un nœud détaché.
- [ ] 4.3 Garantir l'invalidation sur changement de projet, de route, d'identité autorisée, de chargement bloquant et de projet disparu ; ajouter dans `tests/ts-059-project-detail-integration.test.mjs` des assertions déterministes d'unicité de racine sur plusieurs cycles, sans contenu résiduel du contexte antérieur et sans listener dupliqué.
- [ ] 4.4 Ajouter dans `tests/ts-059-project-detail-continuity.test.mjs` des scénarios déterministes de brouillon conservé après `refresh()`, de parents développés conservés après rafraîchissement inter-onglets/Dexie simulé, de menu fermé sur navigation et de reset sur changement de route/identité.
- [ ] 4.5 Ajouter dans `tests/ts-059-project-detail-continuity.test.mjs` les scénarios déterministes de liste longue et de clamp de scroll : ancrage conservé lors d'une création et d'une coche, repositionnement sur un voisin après retrait de l'ancre, et absence de hauteur artificielle après le rendu.
- [ ] 4.6 Ajouter dans `tests/ts-059-project-detail-integration.test.mjs` les espions Dexie/IndexedDB, `fetch`, WebSocket et `localStorage`, puis prouver qu'un montage, un rendu, un rafraîchissement, un changement d'état de présentation local et un démontage n'émettent aucune écriture ni requête, et qu'une commande utilisateur n'émet qu'une intention.
- [ ] 4.7 Exécuter `node --test tests/ts-059-project-detail-integration.test.mjs tests/ts-059-project-detail-continuity.test.mjs` et rapporter le résultat réel ; ne pas cocher si une fuite de données, un double propriétaire ou une écriture implicite est détectée.
- [ ] 4.8 Mettre à jour les assertions de dormance de `tests/ts-058-react-toolchain.test.mjs`, `tests/ts-058-react-integration.test.mjs` et `tests/ts-058-react-docs.test.mjs` pour exiger la surface React uniquement sur le détail tout en conservant les assertions de propriété DOM, d'adaptateur, d'invalidation et d'absence d'écriture ; exécuter `node --test tests/ts-058-react-*.test.mjs` et rapporter le résultat réel.

## 5. Build, rétrocompatibilité et documentation du pilote

- [ ] 5.1 Exécuter `npm run build` puis une assertion Node sur `dist/` vérifiant que l'artefact contient le runtime React de la surface, reste sous `/threadstep/`, conserve la CSP de `site/index.html` et n'introduit ni CDN ni `unsafe-eval` ; exécuter `npm run verify:build` et rapporter le résultat réel.
- [ ] 5.2 Ajouter dans `tests/ts-059-project-detail-docs.test.mjs` les assertions déterministes de non-régression des routes `#/`, `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation`, `#/sujet/<id>`, de la clé `threadstep.document.v1`, du format JSON et de l'absence de nouvelle clé de stockage, route ou dépendance.
- [ ] 5.3 Exécuter `node --test --experimental-test-coverage tests/ts-059-project-detail-*.test.mjs`, écrire la couverture observée dans `/tmp/ts-059-coverage.json`, et comparer les tailles de build et le volume de code aux fichiers de référence ; vérifier par une assertion Node que les mesures sont présentes et numériques.
- [ ] 5.4 Rédiger `docs/product/react-project-detail-pilot.md` avec les mesures avant/après de taille, volume, couverture, complexité, réutilisabilité et interactions, les commandes et la date, ainsi qu'une conclusion explicite GO ou NO-GO sans migration automatique ; vérifier par une assertion Node la présence des sections et de la décision.
- [ ] 5.5 Compléter `docs/product/developer-guide.md` et `docs/architecture.md` avec le montage React du détail, la répartition de l'état transitoire, le diagnostic, le retour arrière et la séparation preuves automatisées/recette humaine ; ajouter ces exigences dans `tests/ts-059-project-detail-docs.test.mjs` et exécuter le test.
- [ ] 5.6 Exécuter `node --test tests/ts-059-project-detail-docs.test.mjs` et rapporter le résultat réel ; ne pas cocher si le rapport, les mesures, la décision ou la documentation manquent.

## 6. Vérification pré-sync

- [ ] 6.1 Exécuter `npm ci` sur le lockfile final et rapporter le résultat réel ; ne pas cocher si l'installation échoue ou modifie les versions verrouillées.
- [ ] 6.2 Exécuter `node --test tests/ts-059-project-detail-render.test.mjs tests/ts-059-project-detail-commands.test.mjs tests/ts-059-project-detail-integration.test.mjs tests/ts-059-project-detail-continuity.test.mjs tests/ts-059-project-detail-docs.test.mjs` et rapporter le résultat réel.
- [ ] 6.3 Exécuter `npm run check` et rapporter le résultat réel ; ne pas cocher si un test, `backlog:check` ou un contrôle syntaxique échoue.
- [ ] 6.4 Exécuter `npm run build`, `npm run verify:build` et `npm run verify:servers` dans cet ordre et rapporter les résultats réels, y compris la prévisualisation sous `/threadstep/`.
- [ ] 6.5 Exécuter `openspec validate ts-059 --strict --no-interactive` et rapporter le résultat réel ; ne pas cocher si la validation échoue.
- [ ] 6.6 Exécuter `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-059/tasks.md` et rapporter le résultat réel ; ne pas cocher si le contrôle échoue.
- [ ] 6.7 Exécuter `git status --porcelain` et une assertion Node vérifiant que `AGENTS.md`, `opencode.json`, `.github/workflows/`, `backlog/tasks/TS-059.md`, `openspec/specs/`, `openspec/changes/archive/`, `package.json`, `package-lock.json` et `site/index.html` n'ont pas été modifiés ; ne pas cocher en cas d'écart.

## Manual acceptance

À exécuter sur le build Vite, avec des profils et des données de test uniquement,
après avoir exporté une sauvegarde. Ces vérifications restent **à effectuer** et
ne sont pas prouvées par la CI. Ne jamais purger une base personnelle pour la
recette.

- Comparer visuellement le détail React à la référence Vite actuelle sur desktop : titre, compteurs, ordre, hiérarchie, notes, menus, éditeur, états vides et focus visible.
- Vérifier sur téléphone et tablette Chrome Android, en portrait et paysage lorsque disponibles, le toucher, les cibles de 44 × 44 px, les sous-tâches, le menu, le glisser-déposer, les listes longues et le clavier virtuel après création, édition et coche.
- Parcourir au clavier réel Tab, Entrée, Espace et Échap : formule de création, priorité, menu, commandes, éditeur, ouverture/repli des sous-tâches et retour ; vérifier que le focus ne se perd pas après sauvegarde, annulation, déplacement, retrait ou changement de filtre.
- Vérifier au lecteur d'écran disponible les noms accessibles, l'ordre de lecture, les états `aria-expanded`, les messages d'erreur et les annonces du détail.
- Ouvrir un second onglet et provoquer une actualisation Dexie Cloud de test : vérifier que les parents développés et les brouillons valides restent cohérents, que le menu se ferme selon le comportement actuel et qu'aucune sauvegarde implicite n'est déclenchée.
- Tester un changement de compte, un espace/cache non vérifié ou bloqué, puis Précédent/Suivant, rechargement et retour Overview : aucune donnée de l'identité précédente ne doit rester visible.
- Vérifier sur des données de test que l'export, l'import/fusion, la restauration et les préférences de suivi restent compatibles, sans migration ni copie Cloud provoquée par le rendu React.
- Consigner séparément les scénarios réellement observés et ceux qui restent non vérifiés, avec appareil, navigateur et version. Une CI verte ne vaut pas acceptation visuelle, mobile, tactile, clavier ou lecteur d'écran.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer les deltas canoniques `react-project-detail-pilot` et `react-integration-boundary` aux exigences et scénarios de ce changement, notamment la portée limitée au détail, la propriété DOM, la continuité, l'invalidation et la réversibilité.
- Relire le diff OpenSpec et l'archive du changement ; vérifier que les specs métier existantes, les archives antérieures, `AGENTS.md`, les workflows, les secrets, le backlog et les données utilisateur n'ont pas été modifiés accidentellement.
- Contrôler l'absence de nouveaux effets réseau ou de persistance implicite, l'absence de nouvelle route/clé de stockage/migration, et la présence effective du runtime React uniquement dans la surface du détail.
- Exécuter à nouveau `npm ci`, `npm run check`, `npm run build`, `npm run verify:build` et `npm run verify:servers` sur le SHA final, puis conserver les résultats réels.
- Vérifier la CI indépendante `check` sur le SHA exact de la PR, la protection de `main`, le diff de sécurité et l'absence de modification des workflows.
- Après fusion autorisée, vérifier la CI post-fusion et le déploiement GitHub Pages, puis réaliser la recette physique desktop/téléphone/tablette et consigner les résultats.
- Garder le bilan GO / NO-GO comme décision distincte : une CI verte ou un déploiement réussi ne suffit pas à approuver la migration générale, et aucune migration d'une autre vue ne doit être déclenchée par cette revue.
