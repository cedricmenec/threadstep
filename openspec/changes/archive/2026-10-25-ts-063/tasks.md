# Tasks

## Implementation checklist (apply, before OPSX sync)

### 1. Portes produit et références de départ

- [x] 1.1 Contrôler par lecture et assertions Node que la décision TS-060 est favorable et documentée, que les tokens et primitives TS-061 sont livrés avec leurs tests verts, et que la section « Sous-ensemble navigation pour TS-063 » du catalogue TS-062 porte une validation propriétaire explicite avec date, portée et références approuvées ; si une porte manque, arrêter sans modifier `site/`, `tests/` ni la documentation produit et rapporter le blocage.
- [x] 1.2 Exécuter `npm ci`, puis écrire dans `/tmp/ts-063-nav-baseline.json` un instantané déterministe des IDs, classes, attributs ARIA, libellés, ordres, fragments et règles CSS actuels de l'en-tête et du menu ; vérifier par une assertion Node que l'instantané contient le bouton, le panneau, les quatre liens, les cibles de 44 px et les classes `.header-nav`/`.nav-menu-panel`.
- [x] 1.3 Exécuter `node --test tests/ts-041-navigation.test.mjs tests/ts-042-data-page.test.mjs tests/ts-043-sync-page.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-052-overview-read-state.test.mjs tests/ts-058-react-boundary.test.mjs tests/ts-059-project-detail-integration.test.mjs tests/ts-060-project-detail-transitions.test.mjs tests/ts-061-ui-primitives.test.mjs` et rapporter le résultat réel sans cocher en cas d'échec.

### 2. Coque React et navigation contrôlée

- [x] 2.1 Créer `site/app-shell/AppShell.jsx`, `site/app-shell/AppHeader.jsx` et `site/app-shell/AppNavigation.jsx` avec un état contrôlé (`open`, `route`, `onToggle`, `onNavigate`), le markup `.header-nav`, le bouton `#nav-menu-button`, le panneau `#nav-menu-panel` et les liens issus de `NAV_MENU_ENTRIES` ; ajouter `tests/ts-063-app-shell-render.test.mjs` et vérifier par assertions jsdom l'unicité des IDs, `aria-expanded`, `aria-controls`, `hidden`, l'ordre et les libellés exacts, les nœuds texte et l'absence de wrapper supplémentaire.
- [x] 2.2 Créer `site/app-shell/AppShellSurface.jsx` avec les opérations `update`, `unmount` et `focusMenuButton` ; étendre `tests/ts-063-app-shell-render.test.mjs` pour vérifier par jsdom que les états fermé/ouvert sont rendus exactement, qu'un cycle montage/update/démontage ne laisse aucun arbre React et que `focusMenuButton` place le focus sur le bouton présent.
- [x] 2.3 Remplacer dans `site/index.html` le seul sous-arbre `.header-nav` par un hôte dédié `#app-shell-root` contenant le markup statique de repli actuel, sans déplacer `.hero`, `#subjects`, les pages de paramètres ni les formulaires OTP/Cloud/import/restauration/consentement ; ajouter au test de rendu des assertions statiques vérifiant que ce repli reprend les IDs, classes, ARIA et libellés attendus, que chaque contrôle métier existant apparaît exactement une fois et hors de l'hôte de coque.
- [x] 2.4 Brancher dans `site/app.js` l'état `navMenuOpen`, `navigationMenuState`, `updateNavigationMenu`, les liens et les fermetures Échap/action extérieure/changement de route sur la surface de coque, en supprimant les écritures DOM directes et les listeners de liens dupliqués ; ajouter `tests/ts-063-app-shell-navigation.test.mjs` et vérifier par jsdom qu'un clic, Précédent/Suivant simulé et Échap produisent une seule intention, ferment le menu et appliquent le focus attendu.
- [x] 2.5 Vérifier dans `tests/ts-063-app-shell-navigation.test.mjs` que les quatre fragments et la route `#/sujet/<id>` restent interprétés par `parseRoute`, qu'aucun routeur ou historique parallèle n'est importé, et qu'un fragment inconnu ou malformé conserve le repli existant ; exécuter le test et rapporter le résultat réel.

### 3. Frontières DOM, coexistence et absence d'effet métier

- [x] 3.1 Créer une instance de frontière dédiée à la coque et une clé de contexte incluant route, identité autorisée et état bloquant, puis démonter/remonter la coque à chaque changement de clé ; ajouter `tests/ts-063-app-shell-boundary.test.mjs` et vérifier par jsdom qu'une coque et un détail peuvent être actifs dans deux conteneurs distincts, avec au plus un propriétaire par conteneur et au plus deux conteneurs actifs.
- [x] 3.2 Étendre `tests/ts-063-app-shell-boundary.test.mjs` avec des cycles répétés de navigation, rafraîchissement et changement d'identité ; vérifier l'absence de racines cumulées, de listeners dupliqués et de contenu métier de l'ancien contexte, ainsi que l'invalidation du détail avant tout retour vanilla.
- [x] 3.3 Vérifier par lectures statiques dans `tests/ts-063-app-shell-side-effects.test.mjs` que les modules `site/app-shell/` n'importent ni Dexie, ni IndexedDB, ni OTP, ni `persist()`, ni `site/app.js`, ni un store, et qu'ils n'ajoutent aucune route, clé de stockage ou préférence persistée.
- [x] 3.4 Ajouter dans `tests/ts-063-app-shell-side-effects.test.mjs` un montage jsdom avec espions sur IndexedDB, `localStorage`, `fetch`, WebSocket, OTP et commandes métier ; vérifier qu'un cycle montage/update/remontage/démontage n'émet aucune écriture, requête, authentification, migration ou commande, et que la coque ne monte aucun formulaire OTP/Cloud.
- [x] 3.5 Ajouter dans `tests/ts-063-app-shell-boundary.test.mjs` des assertions jsdom déterministes pour un scénario de coexistence où l'ouverture/fermeture du menu de coque ne démonte pas la racine détail et n'altère ni ses commandes, ni son Undo de dix secondes, ni ses listes, ni son focus, ni son scroll, ni ses brouillons ; exécuter le test et rapporter le résultat réel.

### 4. Responsive, accessibilité automatisable et documentation

- [x] 4.1 Ajouter `tests/ts-063-app-shell-responsive.test.mjs` avec des assertions statiques déterministes sur `site/styles.css` et `site/styles/tokens.css` pour 320, 390, 430, 768 et 1280 px : largeur bornée, `min-width:0`, retour à la ligne, cibles de 44 px, focus visible, média queries existantes et absence de sidebar ou de largeur fixe supérieure au mobile.
- [x] 4.2 Ajouter dans `tests/ts-063-app-shell-render.test.mjs` les assertions d'accessibilité automatisable : bouton natif de type `button`, libellé texte « Menu », panneau référencé une seule fois, ordre Tab simulé, fermeture par Entrée/Espace simulés, libellés avec markup rendus littéralement et aucun nœud exécutable.
- [x] 4.3 Créer `docs/product/react-app-shell.md` et compléter `docs/product/developer-guide.md` avec la carte de propriété coque/détail/vanilla, les points de montage, les frontières route/identité/blocage, le diagnostic, les commandes de test, la procédure de retour arrière et la distinction entre preuves automatisées et recette humaine ; ajouter `tests/ts-063-app-shell-docs.test.mjs` et vérifier par assertions déterministes la présence de ces sections.
- [x] 4.4 Ajouter dans `tests/ts-063-app-shell-docs.test.mjs` les garde-fous statiques d'absence de nouvelle route, de nouvelle clé `localStorage`/IndexedDB, de nouvelle dépendance, de changement de CSP ou de ressource distante, ainsi que la conservation des identifiants de formulaires et de `#subjects` ; exécuter le test et rapporter le résultat réel.

### 5. Vérifications d'intégration pré-sync

- [x] 5.1 Exécuter les tests déterministes Node `node --test tests/ts-063-app-shell-render.test.mjs tests/ts-063-app-shell-navigation.test.mjs tests/ts-063-app-shell-boundary.test.mjs tests/ts-063-app-shell-side-effects.test.mjs tests/ts-063-app-shell-responsive.test.mjs tests/ts-063-app-shell-docs.test.mjs` et rapporter le résultat réel sans cocher en cas d'échec.
- [x] 5.2 Exécuter les tests de non-régression `node --test tests/ts-041-navigation.test.mjs tests/ts-042-data-page.test.mjs tests/ts-043-sync-page.test.mjs tests/ts-052-overview-presentation.test.mjs tests/ts-052-overview-read-state.test.mjs tests/ts-058-react-boundary.test.mjs tests/ts-059-project-detail-render.test.mjs tests/ts-059-project-detail-commands.test.mjs tests/ts-059-project-detail-integration.test.mjs tests/ts-059-project-detail-continuity.test.mjs tests/ts-060-project-detail-transitions.test.mjs tests/ts-060-project-detail-continuity.test.mjs tests/ts-061-ui-primitives.test.mjs tests/ts-061-project-detail-parity.test.mjs` et rapporter le résultat réel.
- [x] 5.3 Exécuter `npm run check` et rapporter le résultat réel sans cocher si une suite, `backlog:check` ou un contrôle syntaxique échoue.
- [x] 5.4 Exécuter `npm run build` puis `npm run verify:build` et vérifier par assertions Node sur l'artefact la présence de la coque compilée, la CSP inchangée, les chemins sous `/threadstep/`, l'absence de ressource distante et la reproductibilité du build ; rapporter les résultats réels.
- [x] 5.5 Exécuter `openspec validate ts-063 --strict --no-interactive` et `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-063/tasks.md` ; rapporter les résultats réels sans cocher en cas d'échec.
- [x] 5.6 Exécuter `git status --porcelain` et une assertion Node vérifiant que seuls `site/app-shell/`, `site/index.html`, `site/app.js`, `site/styles.css`, le harnais et les tests TS-063, la documentation concernée et `openspec/changes/ts-063/` ont changé ; `AGENTS.md`, `.github/workflows/`, `opencode.json`, `backlog/`, `package.json`, `package-lock.json`, `site/core.js`, `site/react-adapter.js`, `site/project-detail/`, `openspec/specs/` existant et `openspec/changes/archive/` doivent rester inchangés.

## Manual acceptance

Ces vérifications restent **obligatoires pour l'acceptation humaine** et ne sont
pas cochées par l'`apply`, la CI, un test jsdom ou une revue statique.

- Faire lever explicitement par le propriétaire les portes TS-060, TS-061 et
  TS-062 avant toute implémentation : décision favorable et recette documentée,
  primitives livrées, puis validation datée et limitée des références
  header/menu et des quatre destinations dans le catalogue. Sans cette décision,
  la tâche reste `proposed` et l'application ne commence pas.
- Sur ordinateur, tablette et Chrome Android, parcourir les quatre destinations
  par le menu, l'accès direct au hash, le rechargement, Précédent et Suivant ;
  vérifier les libellés, l'ordre, l'état ouvert/fermé, l'absence de débordement
  horizontal et la conservation de l'état autorisé.
- Tester au clavier physique Tab, Entrée, Espace et Échap : focus visible,
  ouverture/fermeture, retour du focus au bouton, focus sur le titre de
  destination et ordre de lecture. Tester au toucher sur au moins un appareil
  mobile réel et consigner appareil, navigateur et version.
- Vérifier à 320, 390, 430, 768 et 1280 px sur un vrai navigateur l'absence de
  débordement, la lisibilité des libellés longs, les cibles de 44 × 44 px et la
  stabilité de la mise en page avant/après.
- Vérifier avec le lecteur d'écran disponible les noms « Menu » et destinations,
  `aria-expanded`, `aria-controls`, le masquage du panneau, les annonces et le
  retour de focus.
- Ouvrir le détail d'un projet React puis le menu de la coque : vérifier que les
  commandes, l'Undo de dix secondes, les listes, le focus, le scroll et les
  brouillons non enregistrés restent intacts ; revenir à Overview et vérifier
  que la carte de suggestion, les cartes projet et les sauvegardes gardent leur
  comportement.
- Dans un environnement Dexie Cloud **de test**, avec sauvegarde préalable et
  données synthétiques, vérifier qu'un changement de session, d'espace ou une
  lecture bloquée ne révèle aucun contenu du contexte précédent et ne déclenche
  ni OTP, ni pull, ni transfert, ni purge implicite. Ne jamais purger une base
  personnelle pour cette recette.
- Consigner `PASS`, `FAIL` ou `NOT_RUN` pour chaque scénario, avec la preuve,
  l'appareil et la date. Une CI verte, un test jsdom ou un rendu structurel ne
  vaut pas acceptation visuelle, tactile, clavier ou lecteur d'écran.

## Post-sync review

- Après la synchronisation sémantique OPSX séparée, comparer les deltas
  canoniques `app-navigation` et `react-integration-boundary` aux exigences et
  scénarios de ce changement, notamment la propriété DOM, la coexistence, les
  quatre destinations, le menu, le focus et l'absence d'effet métier.
- Vérifier l'archive du changement et son contenu versionné : purpose,
  scénarios, frontières de propriété, documentation, absence de route ou de
  stockage nouveau, et portes TS-060/TS-061/TS-062 toujours distinctes des
  preuves automatisées.
- Relire le diff publié et vérifier qu'aucun fichier protégé, secret, workflow,
  donnée personnelle, configuration Cloud ou identifiant IndexedDB n'a été
  modifié accidentellement.
- Après publication de la PR, vérifier la CI indépendante `check` sur le SHA
  exact, la protection de branche, le build et le résultat Pages post-fusion,
  puis consigner les liens et SHA observés.
- Consigner la recette humaine physiquement exécutée ou `NOT_RUN` ; ne jamais
  présenter une CI verte ou un déploiement réussi comme un essai desktop,
  tablette, Android, clavier, tactile, lecteur d'écran ou Dexie Cloud de test.
- Ne pas migrer Overview, les cartes, les tâches, les éditeurs ou les paramètres
  après cette livraison : ces surfaces restent des décisions distinctes UI-06 à
  UI-09, soumises à leurs propres preuves et validations.
