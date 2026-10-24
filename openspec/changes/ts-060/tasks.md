# Tasks

## 1. Base de mesure et audit initial

- [x] 1.1 Exécuter `npm ci` puis `node --test tests/ts-059-project-detail-render.test.mjs tests/ts-059-project-detail-commands.test.mjs tests/ts-059-project-detail-integration.test.mjs tests/ts-059-project-detail-continuity.test.mjs`; rapporter le résultat réel et ne pas cocher si une suite échoue.
- [x] 1.2 Exécuter `npm run build`, puis un script Node qui lit `dist/` et écrit dans `/tmp/ts-060-build-baseline.json` la taille totale de `dist/assets`, celle du chunk applicatif `app-*.js` et celle du CSS ; vérifier par une assertion Node que les trois valeurs sont des entiers positifs et que le chunk applicatif existe.
- [x] 1.3 Écrire dans `/tmp/ts-060-code-baseline.json` le nombre de lignes de `site/app.js`, des fichiers `site/project-detail/*`, de `site/react-adapter.js`, de `site/react-boundary.js`, des tests TS-059 et TS-060, ainsi que le nombre de commandes exposées par l'adaptateur ; vérifier par une assertion Node que chaque valeur est un entier positif.
- [x] 1.4 Exécuter `git status --porcelain` et une assertion Node vérifiant que `AGENTS.md`, `opencode.json`, `.github/workflows/`, `backlog/tasks/TS-060.md`, `openspec/specs/`, `openspec/changes/archive/`, `package.json`, `package-lock.json`, `site/core.js` et `site/index.html` n'ont pas été modifiés avant l'audit ; rapporter le résultat réel.

## 2. Commandes, règles métier, Undo et alternative clavier

- [x] 2.1 Ajouter `tests/ts-060-project-detail-commands.test.mjs` avec une matrice déterministe qui active une fois chaque commande du détail (création, sous-tâche, édition, priorité, complétion, retrait, annulation, réordonnancement, promotion, suivi, menu, retour) et vérifie exactement un callback, au plus une écriture et aucun double callback ; exécuter le fichier et rapporter le résultat réel.
- [x] 2.2 Ajouter dans `tests/ts-060-project-detail-commands.test.mjs` les assertions déterministes de priorité, ordre, relation parent/sous-tâche, notes brutes, titres, compteurs, suivi et validations existantes sur documents synthétiques ; vérifier qu'une commande invalide ou sans changement n'émet aucune écriture ; exécuter le fichier.
- [x] 2.3 Ajouter dans `tests/ts-060-project-detail-commands.test.mjs` les assertions de retrait/annulation unique, de restauration exacte du sous-arbre, de suivi restauré et de conservation de `UNDO_WINDOW_MS = 10000` avec un timer annulable dans `site/app.js`, ainsi que l'alternative clavier de réordonnancement par le menu et ses commandes désactivées ; exécuter le fichier.
- [x] 2.4 Vérifier par assertion statique dans `tests/ts-060-project-detail-commands.test.mjs` que les modules React et les commandes n'importent ni Dexie, ni `indexedDB`, ni `localStorage`, ni `fetch`, ni l'authentification, ni `site/app.js`, ni `persistence.js` ; exécuter le fichier et rapporter le résultat réel.

## 3. Cycle de vie, transitions et continuité

- [x] 3.1 Ajouter `tests/ts-060-project-detail-lifecycle.test.mjs` montant la surface réelle avec des espions sur Dexie/IndexedDB, `fetch`, WebSocket, `localStorage` et les callbacks métier, puis vérifier qu'un cycle montage, rendu, rafraîchissement, ouverture de menu, changement de présentation, démontage et remontage n'émet aucune écriture, requête ou commande ; exécuter le fichier.
- [x] 3.2 Ajouter `tests/ts-060-project-detail-transitions.test.mjs` couvrant changement de route, de projet, d'identité, d'espace, lecture bloquée et projet disparu sur plusieurs cycles ; vérifier l'invalidation de l'ancienne surface, l'unicité de la racine, l'absence de contenu de l'ancien contexte et l'absence d'écriture ou de requête supplémentaire ; exécuter le fichier.
- [x] 3.3 Ajouter dans `tests/ts-060-project-detail-transitions.test.mjs` les assertions statiques et comportementales montrant que l'invalidation précède tout retour au rendu vanilla, que `canWriteVanilla` protège le conteneur et que `decideProjectDetailSurface` refuse le montage pour route invalide, accès métier refusé, lecture bloquante ou projet absent ; exécuter le fichier.
- [x] 3.4 Ajouter `tests/ts-060-project-detail-continuity.test.mjs` avec des assertions jsdom déterministes couvrant brouillon non enregistré, parent développé, rafraîchissement inter-onglets/Dexie simulé, focus après création/sauvegarde/annulation/déplacement/retrait et intention de focus de clavier virtuel appliquée après le commit ; vérifier qu'aucune sauvegarde ni écriture n'est déclenchée ; exécuter le fichier.
- [x] 3.5 Ajouter dans `tests/ts-060-project-detail-continuity.test.mjs` les scénarios de liste longue et d'ancrage : conservation d'un voisin après suppression de l'ancre, absence de hauteur artificielle persistante, focus connecté et absence de retour arbitraire en haut dans le rendu jsdom déterministe ; exécuter le fichier.

## 4. États Overview TS-052

- [x] 4.1 Ajouter `tests/ts-060-overview-read-state.test.mjs` vérifiant les seuils `OVERVIEW_LOADER_DELAY_MS = 250` et `OVERVIEW_DURABLE_WAIT_MS = 8000`, l'absence de loader avant le seuil, le loader stable après 250 ms, l'attente durable à partir de 8 000 ms, l'absence de flash de diagnostic, l'absence de faux état vide et la stabilité des projets disponibles pendant un rafraîchissement de fond.
- [x] 4.2 Ajouter dans `tests/ts-060-overview-read-state.test.mjs` une assertion de branchement vérifiant qu'aucune surface React métier n'est montée pour `#/`, que les constantes et clés d'annonce restent celles de TS-052 et que le modèle de présentation réutilise les signaux existants sans lecture supplémentaire ; exécuter le fichier et rapporter le résultat réel.

## 5. Correction bornée des régressions démontrées

- [x] 5.1 Exécuter les tests des groupes 2, 3 et 4 ; si et seulement si un échec reproductible est localisé dans `site/project-detail/*`, `site/react-adapter.js` ou `site/react-boundary.js`, corriger uniquement cette régression sans modifier `site/core.js` ni les règles métier, ajouter le test de non-régression correspondant et relancer les tests ciblés ; consigner dans le bilan soit la correction, soit l'absence de régression démontrée.
- [x] 5.2 Vérifier par assertion déterministe que l'adaptateur reste en lecture seule, que les écritures métier passent toujours par le `persist()` injecté, que les identifiants et limites de `site/core.js` sont inchangés et qu'aucun second store, second document ou abonnement Dexie direct n'a été introduit ; exécuter le test concerné et rapporter le résultat réel.

## 6. Matrice, bilan et documentation

- [x] 6.1 Créer `docs/product/react-project-detail-qualification.md` avec la portée, la date, l'état de build, les commandes, une matrice couvrant création, édition/annulation, sous-tâches, filtres, priorités, menus, glisser-déposer, alternative clavier, retrait/Undo, listes longues, retour/avant, rechargement, clavier virtuel, tactile, lecteur d'écran et Dexie Cloud de test ; chaque ligne indique l'environnement, la preuve ou `NOT_RUN`, et le statut `PASS`, `FAIL` ou `NOT_RUN`, avec les assertions déterministes du test 6.5 qui contrôlent la structure.
- [x] 6.2 Exécuter `node --test --experimental-test-coverage tests/ts-060-*.test.mjs`, écrire dans `/tmp/ts-060-coverage.json` la couverture observée, relire `/tmp/ts-060-build-baseline.json`, exécuter `npm run build`, mesurer de nouveau `dist/assets` et le chunk applicatif, puis vérifier par assertion Node que toutes les mesures sont présentes et numériques.
- [x] 6.3 Compléter `docs/product/react-project-detail-qualification.md` avec les mesures avant/après, la comparaison explicite au bilan `docs/product/react-project-detail-pilot.md`, les tests automatisés effectivement réussis, les scénarios physiques `NOT_RUN`, les limites et une recommandation explicite GO ou NO-GO bornée au lot suivant, sans GO global fondé sur une CI verte.
- [x] 6.4 Mettre à jour `docs/product/developer-guide.md` et `docs/architecture.md` avec la qualification TS-060, les commandes de mesure, la séparation preuve automatisée/essais physiques, les frontières d'invalidation et l'absence d'autorisation automatique du lot suivant.
- [x] 6.5 Ajouter `tests/ts-060-qualification-report.test.mjs` vérifiant la présence de la matrice, des parcours, des environnements, des statuts autorisés, de la comparaison TS-059, des mesures numériques, de la décision GO/NO-GO et des mentions de limites ; vérifier qu'aucune ligne physique non exécutée n'est marquée `PASS`, que la documentation développeur/architecture référence TS-060 et que les chemins protégés sont inchangés ; exécuter le fichier et rapporter le résultat réel.

## 7. Vérification pré-sync

- [x] 7.1 Exécuter `node --test tests/ts-060-project-detail-commands.test.mjs tests/ts-060-project-detail-lifecycle.test.mjs tests/ts-060-project-detail-transitions.test.mjs tests/ts-060-project-detail-continuity.test.mjs tests/ts-060-overview-read-state.test.mjs tests/ts-060-qualification-report.test.mjs` et rapporter le résultat réel ; ne pas cocher si un test échoue.
- [x] 7.2 Exécuter les tests React ciblés TS-058 et TS-059 et rapporter le résultat réel ; ne pas cocher en cas d'échec ou de régression de la frontière.
- [x] 7.3 Exécuter `npm run check` et rapporter le résultat réel ; ne pas cocher si une suite, `backlog:check` ou un contrôle syntaxique échoue.
- [x] 7.4 Exécuter `npm run build` puis `npm run verify:build` et rapporter les résultats réels, y compris l'artefact statique sous `/threadstep/`, la CSP et l'absence de ressource réseau implicite.
- [x] 7.5 Exécuter `openspec validate ts-060 --strict --no-interactive` et rapporter le résultat réel ; ne pas cocher si la validation échoue.
- [x] 7.6 Exécuter `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-060/tasks.md` et rapporter le résultat réel ; ne pas cocher si le contrôle échoue.
- [x] 7.7 Exécuter `git status --porcelain` et une assertion Node vérifiant que seuls les tests TS-060, la documentation de qualification, les guides concernés et, le cas échéant, une correction React bornée ont été modifiés ; `AGENTS.md`, `opencode.json`, `.github/workflows/`, `backlog/tasks/TS-060.md`, `openspec/specs/`, `openspec/changes/archive/`, `package.json`, `package-lock.json`, `site/core.js` et `site/index.html` doivent rester inchangés.

## Manual acceptance

À exécuter sur le build Vite, avec des projets et des données de test uniquement,
après sauvegarde. Ces vérifications restent **à effectuer** et ne sont pas
prouvées par la CI. Ne jamais purger une base personnelle pour la recette.

- Ouvrir le détail projet sur ordinateur puis sur Chrome Android réel : créer,
  modifier, annuler et compléter des tâches et sous-tâches, changer les
  priorités, ouvrir et replier les parents, filtrer les tâches terminées et
  vérifier les compteurs, l'ordre, les notes et les titres.
- Réordonner au toucher par glisser-déposer puis au clavier physique via le
  menu ; vérifier les commandes désactivées, les cibles tactiles de 44 × 44 px,
  le focus visible et l'ordre Tab/Entrée/Espace/Échap.
- Sur une longue liste déjà défilée, créer et cocher une tâche, ouvrir le menu,
  retirer une tâche puis annuler dans les dix secondes ; vérifier l'ancrage de
  lecture, le focus, le snackbar « Étape retirée » et l'expiration de l'Undo.
- Tester le clavier virtuel Android après création et édition, puis le scroll
  portrait et paysage si disponibles ; comparer téléphone et tablette et
  consigner appareil, navigateur et version.
- Faire Précédent/Suivant, un rechargement et un retour Overview puis revenir
  au détail : vérifier que la racine React est remplacée sans contenu résiduel,
  sans double rendu et sans perte de données.
- Sur une instance Dexie Cloud **de test** uniquement, ouvrir un second onglet
  ou appareil, provoquer une actualisation et changer de compte ou d'espace
  autorisé ; vérifier l'absence de fuite de l'ancien espace, la conservation des
  parents développés et brouillons encore valides, et l'absence de requête ou
  d'écriture supplémentaire due au rendu.
- Parcourir le détail avec un lecteur d'écran disponible : noms accessibles,
  ordre de lecture, `aria-expanded`, menus, erreurs et annonces.
- Consigner `PASS`, `FAIL` ou `NOT_RUN` pour chaque scénario, avec la preuve
  correspondante. Une CI verte ne vaut pas acceptation visuelle, mobile,
  tactile, clavier ou lecteur d'écran.

## Post-sync review

- Comparer après la synchronisation sémantique OPSX la spec canonique
  `react-project-detail-qualification` aux exigences et scénarios de ce
  changement, notamment la matrice, les preuves, l'invalidation, les états
  Overview et la décision bornée.
- Relire l'archive du changement et le diff OpenSpec ; vérifier que
  `AGENTS.md`, les workflows, les secrets, le backlog, les specs métier
  existantes et les données utilisateur n'ont pas été modifiés accidentellement.
- Vérifier la CI indépendante `check` sur le SHA exact de la PR, la protection
  de `main`, l'absence de nouvel effet réseau ou de persistance implicite, et
  les résultats de `check`/build/verify sur ce SHA.
- Après fusion autorisée, vérifier la CI post-fusion et le déploiement GitHub
  Pages, puis compléter la recette physique desktop, Chrome Android, clavier,
  tactile, lecteur d'écran et Dexie Cloud de test distinctement.
- Obtenir une décision humaine de poursuite sur le bilan GO/NO-GO avant toute
  application de TS-061 ou TS-063 ; ne lancer automatiquement aucune autre
  tâche, fusion ou migration.
