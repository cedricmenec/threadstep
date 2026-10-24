# Tasks

## 1. Socle de dépendances, JSX et build

- [x] 1.1 Avant toute modification de code React, exécuter `npm ci` puis `npm run build`, et consigner dans un fichier temporaire les tailles réelles de `dist/assets` et de chaque chunk ; vérifier avec un script Node que la CSP construite est identique à `site/index.html` et que le build est bien écrit hors de `site/`.
- [x] 1.2 Ajouter `react` et `react-dom` avec `npm install --save-exact`, et l'outillage DOM de test avec `npm install --save-dev --save-exact` ; exécuter `npm ci`, puis une assertion Node vérifiant que `package.json`, le lockfile et `node_modules` portent exactement les mêmes versions sans `^` ni `~`, que `dexie`/`dexie-cloud-addon` sont inchangés et que React n'est pas déclaré en `devDependencies`.
- [x] 1.3 Configurer dans `vite.config.mjs` le traitement JSX automatique local (`esbuild.jsx = "automatic"`) sans Babel, sans nouvelle entrée runtime, sans CDN et sans modification de `base`, de `outDir`, du vendor Dexie ni de la CSP ; vérifier avec `node --check vite.config.mjs`.
- [x] 1.4 Créer `tests/ts-058-react-toolchain.test.mjs` avec des assertions statiques et de compilation sur les versions exactes, le lockfile, l'absence de Babel/CDN/script inline, la CSP de production, la base `/threadstep/`, la sortie statique et la présence du runtime JSX automatique ; exécuter `node --test tests/ts-058-react-toolchain.test.mjs`.

## 2. Propriété DOM exclusive

- [x] 2.1 Implémenter `site/react-boundary.js` sans import React ni Dexie : clé de contexte, propriétaire unique, montage idempotent, refus d'un second propriétaire, démontage, invalidation et prédicat `canWriteVanilla` ; vérifier avec `node --check site/react-boundary.js`.
- [x] 2.2 Intégrer le garde-fou dans le chemin de rendu de `site/app.js` et dans les transitions de route/identité/chargement, sans monter de surface React en production ni modifier le rendu vanilla courant ; exécuter `node --test tests/ts-041-navigation.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-050-transient-view-state.test.mjs tests/ts-052-overview-presentation.test.mjs`.
- [x] 2.3 Ajouter `tests/ts-058-react-boundary.test.mjs` couvrant montage, démontage, remontage, cycles répétés de navigation et de rafraîchissement simulés, refus d'écriture vanilla dans le conteneur actif, démontage avant retour vanilla, propriétaire unique et absence de listener dupliqué ; exécuter `node --test tests/ts-058-react-boundary.test.mjs`.

## 3. Adaptateur de présentation

- [x] 3.1 Implémenter `site/react-adapter.js` : instantané détaché et figé dérivé de `site/core.js`, identifiants stables, sous-objet `transient` séparé, commandes explicitement nommées, notification de rafraîchissement et invalidation ; vérifier par une assertion statique l'absence d'import Dexie, Dexie Cloud, OTP, `site/app.js` et de second store.
- [x] 3.2 Ajouter `tests/ts-058-react-adapter.test.mjs` couvrant l'échec ou l'absence d'effet d'une mutation de l'instantané, la stabilité des identifiants, la séparation métier/transitoire, le routage de chaque commande vers son callback et l'absence de duplication des règles métier ; exécuter `node --test tests/ts-058-react-adapter.test.mjs`.
- [x] 3.3 Ajouter dans `tests/ts-058-react-adapter.test.mjs` des espions d'écriture Dexie/IndexedDB, de requête Cloud et d'OTP, puis prouver qu'un montage, un rendu, un démontage et un changement de préférence visuelle n'émettent aucune écriture ni requête ; exécuter le test ciblé.
- [x] 3.4 Ajouter dans `tests/ts-058-react-adapter.test.mjs` les scénarios d'invalidation par changement de route, de projet, d'identité autorisée, de chargement bloquant, de projet disparu, et le cas d'un rafraîchissement autorisé qui conserve les états transitoires valides ; vérifier qu'aucune donnée du contexte précédent ne reste dans l'instantané ; exécuter le test ciblé.

## 4. Fixture React et intégration déterministe

- [x] 4.1 Ajouter une fixture React synthétique `.jsx` sans accès aux données réelles, un utilitaire de test DOM déterministe et un test d'intégration qui la compile avec les options JSX du projet, la monte et la démonte via les API React ; vérifier que la compilation référence le runtime JSX local et qu'aucun accès réseau ou stockage réel n'est effectué.
- [x] 4.2 Ajouter un test d'intégration répétant montage, navigation simulée, rafraîchissement simulé et démontage, avec comptage des conteneurs et des listeners, et assertions d'un seul propriétaire DOM et d'aucun listener actif dupliqué ; exécuter le test d'intégration.
- [x] 4.3 Ajouter dans les tests React et adaptateur les assertions d'absence de nouvelle source de vérité, de non-régression des routes `#/`, `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation`, `#/sujet/<id>` et de stabilité des identifiants ; exécuter les tests ciblés.

## 5. Documentation, taille et réversibilité

- [x] 5.1 Exécuter `npm run build` après les changements, comparer les tailles d'assets et de chunks à la mesure de la tâche 1.1, et consigner l'écart réel ainsi que l'absence ou la présence de React dans le bundle de production avec son explication.
- [x] 5.2 Mettre à jour `docs/product/developer-guide.md` et `docs/architecture.md` avec les dépendances exactes, le JSX automatique, la CSP, les modules de frontière et d'adaptateur, le contrat de montage/démontage, l'invalidation, le diagnostic d'un conteneur vide ou remplacé, l'écart de taille, les limites de test et la procédure de retour arrière vers le vanilla.
- [x] 5.3 Créer `tests/ts-058-react-docs.test.mjs` vérifiant la présence des fichiers et commandes documentés, du JSX, de la CSP, du retour arrière, de l'écart de taille, des limites de vérification et de l'absence de modification de `.github/workflows/`, `AGENTS.md`, `backlog/tasks/TS-058.md` et des specs canoniques ; exécuter le test ciblé.

## 6. Vérification d'intégration pré-sync

- [x] 6.1 Exécuter `npm ci` sur le lockfile final et rapporter le résultat réel.
- [x] 6.2 Exécuter les tests ciblés `node --test tests/ts-058-react-toolchain.test.mjs tests/ts-058-react-boundary.test.mjs tests/ts-058-react-adapter.test.mjs tests/ts-058-react-docs.test.mjs tests/ts-041-navigation.test.mjs tests/ts-049-interaction-continuity.test.mjs tests/ts-050-transient-view-state.test.mjs` et rapporter le résultat réel.
- [x] 6.3 Exécuter `npm run check` et rapporter le résultat réel ; ne pas cocher si un test, `backlog:check` ou un contrôle syntaxique échoue.
- [x] 6.4 Exécuter `npm run build`, `npm run verify:build` et `npm run verify:servers` dans cet ordre et rapporter les résultats réels, y compris la prévisualisation sous `/threadstep/` ; ne pas cocher si un contrôle de chemin, CSP, vendor ou sécurité échoue.
- [x] 6.5 Exécuter `openspec validate ts-058 --strict --no-interactive` et rapporter le résultat réel ; ne pas cocher si la validation échoue.
- [x] 6.6 Exécuter `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-058/tasks.md` et rapporter le résultat réel ; ne pas cocher si le contrôle pré-sync échoue.
- [x] 6.7 Vérifier avec `git status --porcelain` et une assertion Node que `AGENTS.md`, `opencode.json`, `.github/workflows/`, `backlog/tasks/TS-058.md`, `openspec/specs/` et `openspec/changes/archive/` n'ont pas été modifiés, qu'aucun workflow ni secret n'a été ajouté et que seuls les chemins autorisés du changement sont touchés ; ne pas cocher en cas d'écart.

## Manual acceptance

À exécuter sur le build Vite et un profil de test desktop/Chrome Android, avec
des données synthétiques ou une base de test uniquement. Ces vérifications
restent **à effectuer** et ne sont pas prouvées par la CI.

- Comparer visuellement et fonctionnellement Overview, la vue détail, Paramètres, Imports / Exports et Synchronisation Dexie Cloud avec la référence Vite publiée ; aucune surface React métier ne doit être visible ou activée.
- Parcourir les routes `#/`, `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation` et un `#/sujet/<id>` valide, y compris chargement direct, rafraîchissement et Précédent/Suivant.
- Vérifier au clavier (Tab, Entrée, Espace, Échap) et au toucher que le focus, le scroll, les menus, les groupes développés et les cibles tactiles restent inchangés sur desktop et Chrome Android.
- Inspecter les outils réseau et constater qu'aucune requête Cloud, ressource CDN ou asset manquant n'est provoqué par l'outillage ; contrôler la CSP appliquée dans la console.
- Vérifier sur une base de test existante que les données IndexedDB, l'export/import, la restauration et les préférences de reprise restent inchangés après plusieurs navigations et rafraîchissements.
- Vérifier avec un lecteur d'écran disponible que l'ordre de lecture et les noms accessibles des écrans existants ne régressent pas ; noter appareil, navigateur, version et résultat observé.
- Consigner séparément les observations réellement réalisées et celles qui restent non vérifiées ; une coche de build ou un test Node ne vaut pas acceptation visuelle, mobile, clavier ou lecteur d'écran.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer le delta canonique `react-integration-boundary` avec les exigences et scénarios de ce changement, notamment la propriété DOM, l'adaptateur, l'invalidation et la réversibilité.
- Relire le diff OpenSpec et l'archive du changement ; vérifier que les specs métier existantes, les archives antérieures, `AGENTS.md`, les workflows, les secrets et les données utilisateur n'ont pas été modifiés accidentellement.
- Inspecter le graphe de dépendances, les versions React verrouillées, la CSP de production, la sortie `dist/`, l'écart de taille documenté et l'absence de CDN ou de ressource au mauvais chemin.
- Exécuter à nouveau `npm ci`, `npm run check`, `npm run build`, `npm run verify:build` et `npm run verify:servers` sur le SHA final, puis conserver les résultats réels.
- Contrôler la CI indépendante `check` sur le SHA exact de la PR, la protection de `main`, le diff de sécurité et l'absence de modification des workflows.
- Vérifier la fusion, la CI post-fusion et le déploiement GitHub Pages ; rappeler que la spec canonique `static-build-pipeline` contient encore une formulation « publication `site/` » antérieure à ASF-WF-004 alors que Pages sert `dist/`, sans réécrire cette spec dans ce changement.
- Conserver une preuve explicite et datée des vérifications manuelles réellement effectuées, ou déclarer celles qui restent non vérifiées. Ne pas présenter ce socle comme une migration de vue achevée ni comme une activation React en production.
