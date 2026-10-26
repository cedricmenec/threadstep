# Tasks

## 1. Porte de départ et référence de comportement

- [x] 1.1 Vérifier par assertions Node que l'archive `openspec/changes/archive/2026-10-25-ts-063` existe, que son commit est un ancêtre de `HEAD`, que `site/app-shell/AppShellSurface.jsx` et `site/ui/Button.jsx` sont présents, et que `site/core.js`, `site/react-boundary.js`, `site/react-adapter.js`, `site/project-detail/`, `package.json`, `package-lock.json`, `AGENTS.md`, `.github/workflows/` et `openspec/specs/` ne sont pas déjà modifiés par cette tâche ; si une porte manque, arrêter sans modifier `site/`, `tests/` ni la documentation produit et rapporter le blocage.
- [x] 1.2 Avant toute édition de production, écrire dans `/tmp/ts-064-overview-baseline.json` un instantané déterministe des classes, IDs, `data-*`, libellés, ordres, compteurs, limite de cinq parents, sous-tâches hors quota, commande « Voir plus » et états vides du rendu Overview actuel ; ajouter une assertion Node vérifiant que l'instantané contient `.subject`, `.subject-open`, `.subject-move`, `.subject-urgency`, `.subject-progress`, `.overview-see-more` et `#subjects`.
- [x] 1.3 Exécuter `node --test tests/overview-preview.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-053-overview-presentation.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs tests/ts-056-overview-urgency-list.test.mjs tests/ts-060-overview-read-state.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-049-tablet-scroll.test.mjs` et rapporter le résultat réel sans cocher en cas d'échec.

## 2. Adaptateur et surface React Overview

- [x] 2.1 Créer `tests/helpers/ts-064-overview-harness.mjs` sur le modèle des harnais TS-059/TS-063 (compilation esbuild, jsdom, `createRoot`, `flushSync`, `act`), puis vérifier par un test Node que la compilation de `site/overview/OverviewSurface.jsx` produit un module importable et que le harnais monte et démonte une surface vide sans erreur.
- [x] 2.2 Créer `site/overview/overview-adapter.js` avec un instantané détaché et gelé des projets filtrés dans l'ordre enregistré, des compteurs dérivés de `site/core.js`, du mode de filtre, de l'état transitoire et de la disponibilité des projets ; vérifier dans `tests/ts-064-overview-render.test.mjs` que l'adaptateur ne mute pas le document, n'invalide pas une surface autorisée, refuse `business-not-allowed`/`loading-blocked`/identité indisponible et produit les libellés de compteurs exacts.
- [x] 2.3 Créer `site/overview/OverviewSurface.jsx`, `OverviewCards.jsx`, `ProjectCard.jsx` et `OverviewTaskList.jsx` en réutilisant `TaskItem`, `TaskList`/la liste d'aperçu, `TaskEditor`, `TaskActionMenu` et les primitives `site/ui/` existantes ; ajouter dans `tests/ts-064-overview-render.test.mjs` des assertions jsdom sur les classes, IDs, `data-*`, libellés français, noms accessibles, ordres, compteurs, progressions et nœuds texte.
- [x] 2.4 Vérifier dans `tests/ts-064-overview-render.test.mjs` les cas 0, 1, 5 et 6 tâches parentes visibles, le filtre appliqué avant la limite, les sous-tâches qui ne consomment pas d'emplacement, l'indépendance entre cartes, l'unicité de « Voir plus » au-delà de cinq, son absence dans le quota, l'état vide autorisé et l'état vide filtré avec « Tous les projets » ; exécuter le test et rapporter le résultat réel.
- [x] 2.5 Ajouter dans `tests/ts-064-overview-render.test.mjs` un cycle `mount`/`update`/`unmount` de la surface avec vérification qu'aucun arbre React ne subsiste, qu'aucun listener de fixture ne reste actif et qu'un remontage ne duplique ni carte ni ID ; exécuter le test et rapporter le résultat réel.

## 3. Commandes, frontières et absence d'effet métier

- [x] 3.1 Ajouter dans `site/app.js` les commandes de carte `openProject`, `seeMore`, `moveProject` et `removeProject` en réutilisant `openSubject`, `move`, la confirmation de suppression et `persist` existants ; ajouter `tests/ts-064-overview-commands.test.mjs` et vérifier qu'une activation unique d'ouverture, « Voir plus », déplacement, suppression confirmée/annulée, complétion, priorité, menu ou édition produit exactement une intention et au plus une mutation.
- [x] 3.2 Vérifier dans `tests/ts-064-overview-commands.test.mjs` que l'ouverture d'une carte ou de « Voir plus » utilise `#/sujet/<id>` et le comportement `openSubject` existant, que les bornes de déplacement restent celles du document, et qu'aucun listener dupliqué ne produit une seconde commande après une mise à jour.
- [x] 3.3 Brancher dans `site/app.js` le montage, la mise à jour et la libération de la surface Overview dans `#subjects` avec l'instance `reactBoundary` existante, une clé vue/identité/blocage, la libération du détail avant Overview et d'Overview avant le détail ; ajouter `tests/ts-064-overview-boundary.test.mjs` et vérifier qu'un seul propriétaire possède `#subjects`, que la coque garde son hôte séparé et que les cycles répétés ne cumulent ni racine ni listener.
- [x] 3.4 Vérifier dans `tests/ts-064-overview-boundary.test.mjs` que les états `AWAITING_READ` et `actionRequired` sans projets disponibles libèrent la surface avant toute réécriture vanilla, qu'une lecture autorisée vide monte la surface d'état vide, et qu'un changement d'identité, d'espace, de projet ou une lecture bloquante ne laisse aucun contenu du contexte précédent.
- [x] 3.5 Ajouter `tests/ts-064-overview-side-effects.test.mjs` avec des assertions statiques vérifiant que `site/overview/` n'importe ni Dexie, ni IndexedDB, ni OTP, ni `persist()`, ni `site/app.js`, ni routeur/store, et qu'aucune route, clé de stockage, préférence ou dépendance n'est ajoutée ; vérifier aussi que `site/core.js`, `site/react-boundary.js` et la configuration Dexie restent inchangés.
- [x] 3.6 Ajouter dans `tests/ts-064-overview-side-effects.test.mjs` un montage jsdom avec espions sur IndexedDB, `localStorage`, `fetch`, WebSocket, OTP et commandes métier ; vérifier qu'un cycle montage/update/remontage/démontage ne produit aucune écriture, requête, authentification, migration ou commande, et que le montage ne déclenche aucune commande de carte.
- [x] 3.7 Ajouter `tests/ts-064-overview-continuity.test.mjs` et vérifier par jsdom que le focus pertinent, l'ancrage de scroll simulé, les parents développés, le brouillon d'éditeur, le filtre et l'état de menu sont conservés lors d'une mise à jour ou d'un rafraîchissement de même contexte, sans remontage de la surface.
- [x] 3.8 Ajouter dans `tests/ts-064-overview-continuity.test.mjs` des assertions jsdom déterministes vérifiant que le focus rejoint un contrôle présent après complétion, priorité, suppression, annulation ou ouverture, qu'aucun focus ne reste sur un nœud détaché, et qu'une navigation, un import/restauration réussi ou un changement d'identité réinitialise les états transitoires selon `ux-interaction-continuity` ; exécuter le test et rapporter le résultat réel.
- [x] 3.9 Ajouter `tests/ts-064-overview-read-state.test.mjs` et vérifier qu'une lecture en attente, une action requise ou une lecture bloquée n'affiche ni carte, ni compteur de carte, ni pourcentage, que la synchronisation de fond conserve les cartes en place et qu'un événement tardif de l'espace A ne réintroduit aucune carte sous l'espace B.

## 4. Non-régression, accessibilité structurelle et documentation

- [x] 4.1 Adapter `tests/overview-preview.test.mjs`, `tests/ts-053-overview-presentation.test.mjs`, `tests/task-total.test.mjs`, `tests/ts-049-interaction-continuity.test.mjs`, `tests/ts-049-tablet-scroll.test.mjs`, `tests/ts-054-overview-urgency-filter.test.mjs` et `tests/ts-055-overview-project-filter.test.mjs` aux nouveaux modules ou au harnais Overview lorsque leurs assertions ciblent l'ancien `renderSubject`/`renderTaskArea`, sans supprimer les assertions de comportement sur l'aperçu, les compteurs, le filtre, le focus, le scroll et l'atomicité ; exécuter ces fichiers et rapporter le résultat réel.
- [x] 4.2 Ajouter `tests/ts-064-overview-responsive.test.mjs` avec des assertions statiques déterministes sur `site/styles.css` et les modules Overview pour les largeurs 320, 390, 430, 768 et 1280 px : grille `.subjects`, largeur bornée, retour à la ligne, cibles de 44 px, focus visible existant, absence de `overflow-x`, de sidebar, de largeur fixe supérieure au mobile et de nouvelle disposition non approuvée ; exécuter le test et rapporter le résultat réel.
- [x] 4.3 Créer `docs/product/react-overview-cards.md` et compléter `docs/product/developer-guide.md` avec la carte de propriété coque/Overview/détail/vanilla, les points de montage, les frontières route/identité/blocage/lecture, le cycle de mise à jour, le diagnostic, les commandes de test, le retour arrière et la distinction entre preuves automatisées et recette humaine.
- [x] 4.4 Ajouter `tests/ts-064-overview-docs.test.mjs` et vérifier par assertions déterministes la présence des sections documentaires, l'absence de nouvelle route, de nouvelle clé `localStorage`/IndexedDB, de nouvelle dépendance, de changement de CSP ou de ressource distante, ainsi que la conservation de `#subjects`, de `#subject-form`, des filtres et des identifiants des formulaires ; exécuter le test et rapporter le résultat réel.

## 5. Vérifications d'intégration pré-sync

- [x] 5.1 Exécuter les tests automatisés déterministes ciblés `node --test tests/ts-064-overview-render.test.mjs tests/ts-064-overview-commands.test.mjs tests/ts-064-overview-boundary.test.mjs tests/ts-064-overview-continuity.test.mjs tests/ts-064-overview-read-state.test.mjs tests/ts-064-overview-side-effects.test.mjs tests/ts-064-overview-responsive.test.mjs tests/ts-064-overview-docs.test.mjs` et rapporter le résultat réel sans cocher en cas d'échec.
- [x] 5.2 Exécuter les tests de non-régression `node --test tests/ts-041-navigation.test.mjs tests/ts-042-data-page.test.mjs tests/ts-043-sync-page.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-052-overview-read-state.test.mjs tests/ts-053-overview-metrics.test.mjs tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs tests/ts-056-overview-urgency-list.test.mjs tests/ts-058-react-boundary.test.mjs tests/ts-059-project-detail-render.test.mjs tests/ts-059-project-detail-commands.test.mjs tests/ts-059-project-detail-integration.test.mjs tests/ts-059-project-detail-continuity.test.mjs tests/ts-060-project-detail-transitions.test.mjs tests/ts-060-project-detail-continuity.test.mjs tests/ts-061-ui-primitives.test.mjs tests/ts-061-project-detail-parity.test.mjs tests/ts-063-app-shell-boundary.test.mjs tests/ts-063-app-shell-navigation.test.mjs` et rapporter le résultat réel.
- [x] 5.3 Exécuter `npm run check` et rapporter le résultat réel sans cocher si une suite, `backlog:check` ou un contrôle syntaxique échoue.
- [x] 5.4 Exécuter `npm run build` puis `npm run verify:build` et vérifier par assertions Node sur l'artefact la présence de la surface Overview compilée, la CSP inchangée, les chemins sous `/threadstep/`, l'absence de ressource distante et la reproductibilité du build ; rapporter les résultats réels.
- [x] 5.5 Exécuter `openspec validate ts-064 --strict --no-interactive` et `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-064/tasks.md` ; rapporter les résultats réels sans cocher en cas d'échec.
- [x] 5.6 Exécuter `git status --porcelain` et une assertion Node vérifiant que seuls `site/overview/`, les ajustements bornés de `site/app.js` et `site/project-detail/` strictement nécessaires à la réutilisation du formulaire, les tests TS-064, les tests Overview adaptés, la documentation concernée et `openspec/changes/ts-064/` ont changé ; `AGENTS.md`, `.github/workflows/`, `opencode.json`, `backlog/`, `package.json`, `package-lock.json`, `site/core.js`, `site/react-boundary.js`, `site/react-adapter.js`, `site/project-detail/` hors extraction sans changement de comportement, `openspec/specs/` existant et `openspec/changes/archive/` doivent rester inchangés.

## Manual acceptance

Ces vérifications restent **obligatoires pour l'acceptation humaine** et ne sont
ni cochées par `apply`, ni prouvées par la CI, un test jsdom ou une revue
statique.

- Confirmer que TS-063 est effectivement fusionnée et que sa recette
  propriétaire déclarée couvre le périmètre de dépendance ; sans cette
  confirmation, arrêter avant de revendiquer une livraison.
- Sur desktop, comparer Overview avant et après : ordre des cartes, titres,
  compteurs d'étapes, total, urgences, progression, aperçu de cinq parents,
  sous-tâches, état vide, filtre et commande « Voir plus ». Vérifier que les
  contrôles existants restent à leur place et qu'aucune carte ou commande
  n'est dupliquée.
- Parcourir la navigation hash, le rechargement, Précédent/Suivant, l'ouverture
  du détail et le retour vers la carte d'origine ; vérifier que le focus de
  titre et l'historique restent ceux du comportement livré.
- Tester au clavier physique Tab, Entrée, Espace et Échap sur les cartes, les
  tâches, les menus, l'éditeur et « Voir plus » ; vérifier le focus visible et
  l'absence de focus sur un nœud détaché après une mutation.
- Tester sur Chrome Android, au toucher, l'ouverture d'une carte, l'ajout et la
  complétion d'une tâche, la priorité, le menu, l'édition, le déplacement et
  « Voir plus » ; vérifier le scroll, le clavier virtuel, les cibles de 44 px
  et l'absence de débordement horizontal, puis consigner appareil, navigateur
  et version.
- Vérifier à 320, 390, 430, 768 et 1280 px sur un vrai navigateur l'absence de
  débordement et la lisibilité des titres, notes et libellés longs.
- Vérifier avec le lecteur d'écran disponible les noms des cartes, contrôles,
  menus, compteurs, progressions, états vides et « Voir plus », ainsi que les
  annonces lors du chargement et des mutations.
- Dans un environnement Dexie Cloud **de test**, avec sauvegarde préalable et
  données synthétiques, vérifier qu'un rafraîchissement de fond, un changement
  d'espace ou une lecture bloquée ne révèle aucune carte du contexte précédent
  et ne déclenche ni OTP, ni pull, ni transfert, ni purge implicite. Ne jamais
  purger une base personnelle pour cette recette.
- Consigner `PASS`, `FAIL` ou `NOT_RUN` pour chaque scénario, avec la preuve,
  l'appareil et la date. Une CI verte ou un test jsdom ne vaut pas acceptation
  visuelle, tactile, clavier ou lecteur d'écran.

## Post-sync review

- Après la synchronisation sémantique OPSX séparée, comparer les deltas
  canoniques `react-overview-cards` et `react-integration-boundary` aux
  exigences de ce changement, notamment la propriété de `#subjects`,
  l'exclusivité Overview/détail, les compteurs, l'aperçu, les commandes,
  les états de lecture et la continuité.
- Vérifier l'archive du changement et son contenu versionné : purpose,
  scénarios, frontières de propriété, documentation, absence de route, de
  stockage ou de dépendance nouvelle.
- Relire le diff publié et vérifier qu'aucun fichier protégé, secret, workflow,
  donnée personnelle, configuration Cloud ou identifiant IndexedDB n'a été
  modifié accidentellement.
- Après publication de la PR, vérifier la CI indépendante `check` sur le SHA
  exact, la protection de branche, le build et le résultat Pages post-fusion,
  puis consigner les liens et SHA observés.
- Consigner la recette humaine physiquement exécutée ou `NOT_RUN` ; ne jamais
  présenter une CI verte ou un déploiement réussi comme un essai desktop,
  Android, clavier, tactile, lecteur d'écran ou Dexie Cloud de test.
- Ne pas commencer TS-065 (interactions et éditeurs) ni TS-066 (composition
  Stitch) à partir de cette livraison : ces lots gardent leurs propres
  prérequis et validations.
