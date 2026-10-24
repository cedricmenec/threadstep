# Design

## Context

Voir `proposal.md` — Why, et
`specs/react-project-detail-qualification/spec.md` pour le contrat observable.
TS-059 est livrée : `site/project-detail/ProjectDetailSurface.jsx` monte une
racine React unique dans `#subjects`, `site/project-detail/controller-commands.js`
route les intentions vers les callbacks injectés de `site/app.js`, et
`site/react-boundary.js` / `site/react-adapter.js` portent la propriété DOM, la
clé d'identité et l'instantané détaché. Le harnais
`tests/helpers/ts-059-project-detail-harness.mjs` compile les composants réels
et les monte dans jsdom avec des documents synthétiques.

Les invariants de continuité existent déjà dans `site/app.js`
(`captureUxContinuity`, `finishUxRender`, `applyFocus`, `restoreUxScroll`) et
dans `site/interaction-continuity.js`. Les états Overview sont calculés par
`site/overview-read-state.js` avec les seuils 250 ms et 8 000 ms. Les règles
métier et les identifiants viennent de `site/core.js` ; l'Undo de 10 s est
porté par le contrôleur vanilla (`UNDO_WINDOW_MS`, `pendingRemoval`,
`startRemovalTimer`). TS-060 ne crée pas de nouveau moteur : il prouve et
durcit ces frontières existantes.

## Goals / Non-Goals

**Goals :**

- Ajouter une preuve déterministe, reproductible et lisible pour chaque
  invariant de continuité, d'invalidation, d'écriture unique et de règle métier
  du détail React encore non couvert par TS-059.
- Produire une matrice de recette et un bilan versionnés qui distinguent
  strictement preuve CI, navigateur isolé, appareil physique et instance de
  test.
- Conserver Overview, `site/core.js`, la persistance et les contrats Cloud/OTP
  sans refonte.
- Ne corriger que ce qu'un test TS-060 démontre dans la frontière React ou ses
  commandes.

**Non-Goals :**

- Modifier le comportement produit, les règles métier, les styles, les routes,
  la synchronisation, la migration ou les données.
- Remplacer le harnais jsdom par un runner navigateur ou ajouter Playwright,
  Puppeteer ou une dépendance de test.
- Transformer la CI en certification Android, tactile, clavier, lecteur
  d'écran ou Dexie Cloud.
- Généraliser React ou préparer TS-061/TS-063.

## Decisions

### 1. Qualification sans nouveau module d'exécution

Le code de production ne reçoit aucun mode « qualification ». Les preuves
consomment les modules existants (`ProjectDetailSurface`, adaptateur, boundary,
commandes, `overview-read-state.js`, helpers de continuité) et le harnais
TS-059. Les nouveaux fichiers sont des tests et de la documentation.

*Alternative écartée :* un mode de test ou un deuxième adapter aurait créé une
surface divergente de la production et affaibli la valeur des preuves.

### 2. Tests TS-060 séparés par invariant, avec harnais réutilisé

Nouveaux fichiers déterministes, exécutables par `node --test` sur le runner :

- `tests/ts-060-project-detail-commands.test.mjs` : matrice de commandes,
  validations, un callback/une écriture, priorité/ordre/parent, notes brutes,
  titres, compteurs, retrait/Undo et alternative clavier du menu.
- `tests/ts-060-project-detail-lifecycle.test.mjs` : montage, rendu,
  rafraîchissement, changement de présentation et démontage avec espions
  IndexedDB/Dexie, `fetch`, WebSocket, `localStorage` et callbacks.
- `tests/ts-060-project-detail-transitions.test.mjs` : route, projet, identité,
  espace, lecture bloquée et projet disparu ; propriétaire DOM unique, contenu
  résiduel absent, invalidation avant vanilla, aucun effet supplémentaire.
- `tests/ts-060-project-detail-continuity.test.mjs` : brouillon, parent
  développé, rafraîchissement inter-onglets/Dexie simulé, focus intent de
  clavier virtuel, ancrage de liste longue, suppression d'ancre.
- `tests/ts-060-overview-read-state.test.mjs` : seuils 250/8 000 ms, absence de
  flash et de faux état vide, stabilité des projets disponibles, absence de
  montage React sur `#/`.
- `tests/ts-060-qualification-report.test.mjs` : structure de la matrice et du
  bilan, statuts autorisés, absence de `PASS` physique inventé, comparaison
  TS-059, décision GO/NO-GO bornée, mesures numériques, absence de modification
  des chemins protégés.

Les tests réutilisent `installDeterministicDom`, `createSurfaceFixture` et
`createStaticAdapter`. Les timeouts Overview sont pilotés par des valeurs
d'entrée déterministes, sans `sleep` ; les scénarios React utilisent `act` et
`flushSync` comme TS-059.

*Alternative écartée :* un unique fichier géant aurait mélangé les causes
d'échec et rendu le diagnostic moins précis.

### 3. Audit « fail-first » et corrections strictement bornées

L'ordre est : écrire les tests de l'invariant, exécuter, puis ne corriger que si
un test échoue de façon reproductible dans `site/project-detail/*`,
`site/react-adapter.js` ou `site/react-boundary.js`. Une correction :

- ne change ni `site/core.js`, ni les limites, ni les identifiants, ni le flux
  `persist()` ;
- conserve l'adaptateur en lecture seule et l'écriture métier unique ;
- ajoute ou ajuste le test qui démontre le défaut avant la correction ;
- est consignée avec la commande et le résultat réels dans le bilan.

Si tous les tests passent, le bilan indique « aucune régression démontrée dans
la frontière React » et aucune correction n'est ajoutée. Un défaut hors de cette
frontière (Dexie, identité, migration, vanilla) est documenté et orienté vers
une tâche distincte, sans extension du périmètre.

*Alternative écartée :* corriger par précaution des zones non prouvées aurait
augmenté le risque et contredit le caractère borné du lot.

### 4. Continuité : prouver la conservation et les exceptions

Les tests distinguent deux familles :

- **Conservation** dans la même vue et la même identité : brouillon local React
  conservé par clé stable, `expandedParents` porté par le contrôleur et
  rafraîchi sans remontage, focus appliqué sur un nœud connecté, ancrage de
  lecture restauré sur liste longue, absence de hauteur artificielle.
- **Réinitialisation justifiée** : navigation, retour/avant, rechargement,
  import, changement d'identité/espace, lecture bloquante, projet disparu. La
  clé de frontière et l'invalidation de l'adaptateur doivent vider la surface
  et empêcher toute fuite de l'ancien contexte.

Le clavier virtuel n'est pas simulable fidèlement par jsdom. Le test vérifie
seulement que l'intention de focus de création/sauvegarde est appliquée après le
commit sur un contrôle présent et sans écriture ; le comportement réel du
viewport et du clavier reste en recette manuelle.

*Alternative écartée :* simuler des dimensions d'écran ou un clavier virtuel
aurait donné une fausse preuve matérielle.

### 5. Invalidation avant vanilla, sans requête ni écriture supplémentaire

La preuve combine trois niveaux :

1. `decideProjectDetailSurface` retourne `mount: false` pour route invalide,
   projet absent, accès métier refusé ou lecture bloquée ;
2. l'adaptateur invalide et notifie `null` sur changement de contexte ;
3. le branchement `app.js` invalide la frontière avant `renderDetail` /
   `replaceSubjectsInCurrentView`, puis le vanilla écrit seul.

Les tests jsdom montent une surface, changent route/projet/identité/état de
lecture, vérifient l'absence de contenu résiduel et l'unicité de la racine, et
espionnent les écritures/réseau. Une assertion statique vérifie que
`releaseProjectDetailSurface` précède les branches de rendu vanilla et que
`canWriteVanilla` garde les remplacements.

*Alternative écartée :* tester uniquement la fonction pure de décision n'aurait
pas prouvé l'ordre réel d'invalidation dans `app.js`.

### 6. Overview : réutiliser le modèle TS-052, ne pas le refondre

Les tests TS-060 appellent `buildOverviewReadPresentation` avec des entrées
explicites et vérifient les seuils, les clés d'annonce, l'absence d'action
transitoire et la stabilité de `projectsAvailable`. Un test de branchement
vérifie qu'aucune surface React métier n'est montée pour `#/` et que les
constantes restent celles de TS-052. Aucun composant, timer ou style Overview
n'est modifié.

*Alternative écartée :* réimplémenter les timers dans un composant React
aurait dupliqué la logique et dépassé le périmètre.

### 7. Undo de dix secondes et règles métier : preuve ciblée

Les tests de commandes prouvent le retrait, l'annulation, l'écriture unique et
la restauration exacte via les callbacks injectés. Le test de qualification
vérifie en plus que `site/app.js` conserve `UNDO_WINDOW_MS = 10000`, que le
timer est annulable et que le snackbar expose « Étape retirée » et « Annuler ».
Les règles de priorité, ordre, parent/sous-tâche, notes brutes, titres et
compteurs sont vérifiées sur des documents synthétiques avec les helpers de
`site/core.js`. Une vraie attente de dix secondes n'est pas nécessaire : la
constante et le branchement du timer sont déterministes.

*Alternative écartée :* attendre réellement dix secondes aurait ralenti la suite
sans augmenter la preuve du branchement.

### 8. Matrice et bilan : un document unique, structure vérifiée

`docs/product/react-project-detail-qualification.md` contient :

- la portée, la date, le SHA ou l'état de build et les commandes ;
- une matrice avec identifiant, parcours, environnement, preuve/commande,
  statut `PASS`/`FAIL`/`NOT_RUN` et date/appareil si applicable ;
- une comparaison avec `docs/product/react-project-detail-pilot.md` (poids,
  code, couverture, tests, risques) ;
- les limites et les scénarios physiques `NOT_RUN` ;
- une recommandation explicite GO ou NO-GO pour le lot suivant, bornée et
  soumise à la décision humaine.

Un test statique vérifie la présence des colonnes et parcours, l'emploi exclusif
des statuts autorisés, l'absence de `PASS` sur les lignes physiques non
exécutées, la référence à TS-059 et la présence d'une décision. Les valeurs de
bundle et de couverture sont mesurées pendant `apply` puis recopiées ; le test
exige des nombres, pas des valeurs prédéterminées.

*Alternative écartée :* mettre la matrice uniquement dans `tasks.md` aurait
mélangé plan exécutable et recette humaine, et aurait disparu à l'archivage.

### 9. Mesures avant/après et absence de dérive

Les commandes de mesure sont celles du bilan TS-059 : `npm run build`, script
Node de taille `dist/assets` et du chunk applicatif, nombre de lignes des
fichiers concernés, `node --test --experimental-test-coverage` sur les tests
TS-060. Le rapport compare au bilan TS-059 et consigne tout écart. Le test de
documentation vérifie la présence des valeurs et de la date ; aucune valeur
n'est inventée avant la mesure.

*Alternative écartée :* ne pas remesurer aurait rendu la comparaison non
vérifiable.

## Risks / Trade-offs

- **jsdom ne prouve pas le rendu réel, le scroll, le clavier virtuel, le
  tactile ni le lecteur d'écran** → la matrice marque ces lignes `NOT_RUN`, le
  bilan le répète, et aucune CI verte n'est présentée comme certification.
- **Tests React asynchrones instables ou avertissements `act`** → usage de
  `act`/`flushSync` comme TS-059, timeouts déterministes, pas de sommeil réel.
- **Faux sentiment de sécurité d'un test statique** → les assertions statiques
  complètent des tests de comportement jsdom, elles ne les remplacent pas.
- **Régression hors frontière React découverte pendant l'audit** → documentée
  et orientée vers une tâche de fiabilité distincte, sans correction
  opportuniste.
- **Mesures de bundle variables selon la version de Vite ou l'ordre des
  modules** → consigner la commande, la date et le SHA, comparer au même
  environnement, ne pas promettre un chiffre avant mesure.
- **Documentation de qualification qui vieillit** → le bilan est daté et
  référence le SHA ; une nouvelle exécution crée une nouvelle preuve plutôt
  qu'une réécriture silencieuse.
- **Des corrections React changent un comportement non prévu** → uniquement sur
  test rouge reproductible, sans toucher `site/core.js`, avec test de
  non-régression et vérification complète.

## Migration Plan

1. Établir la base de mesures et exécuter les suites TS-058/TS-059.
2. Écrire les tests TS-060 par invariant, sans modifier le code produit.
3. Exécuter les tests ; corriger uniquement une régression démontrée dans la
   frontière React ou ses commandes, avec test de non-régression.
4. Rédiger la matrice et le bilan avec les preuves et mesures réelles ; marquer
   les essais physiques `NOT_RUN`.
5. Mettre à jour la documentation développeur et l'architecture.
6. Exécuter les tests ciblés, `npm run check`, `npm run build`,
   `npm run verify:build`, la validation OpenSpec et le contrôle de phases.
7. Aucune migration de données, de route, de schéma, de configuration Cloud ou
   de workflow. Rollback : retirer les tests/documentation TS-060 et, le cas
   échéant, la correction React bornée ; aucune donnée utilisateur n'est
   affectée.

## Open Questions

Aucune question bloquante. Le nom exact des fichiers de test peut être ajusté
sans changer les invariants. La décision GO/NO-GO finale et les statuts
physiques dépendent de preuves réelles produites pendant et après `apply` ;
ils ne sont volontairement pas prédéterminés ici.
