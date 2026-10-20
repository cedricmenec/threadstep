# Tasks

## 1. Guide de persistance et preuves de synchronisation

- [x] 1.1 Créer `docs/product/guide-persistance-et-synchronisation.md` avec l'objet du guide, le modèle local-first, les noms `threadstep-local`, `threadstep-ws-…` et `threadstep-recovery-…`, les six niveaux de preuve et les limites de synchronisation ; créer `tests/ts-046-persistence-guide.test.mjs` pour vérifier l'existence du fichier, ces sections, ces noms et l'absence de promesse `in-sync` comme preuve de copie complète ; exécuter `node --test tests/ts-046-persistence-guide.test.mjs` et corriger jusqu'au succès.
- [x] 1.2 Ajouter dans le guide la matrice de scénarios avec les colonnes espace actif, données consultables localement, destinataire distant éventuel, données conservées mais non montrées, danger, sauvegarde conseillée, action exacte et retour arrière ; couvrir le premier lancement local, la configuration sans activation, l'activation avec OTP/lecture/plan/consentement, l'autre appareil, la suspension, la déconnexion, le changement d'espace/d'URL/de compte, le retour local, la reprise Cloud, le hors ligne/erreur, l'écriture non transmise, `UNVERIFIED`/`MISMATCH`, la récupération isolée et la suppression des données du site ; étendre les assertions du test automatisé déterministe pour vérifier chaque scénario, chaque colonne et la séparation des actions sensibles ; exécuter le test ciblé.
- [x] 1.3 Ajouter dans le guide la couverture export/import/restauration/suppression des données du site, la FAQ priorisée dans l'ordre exigé, le glossaire sans jargon, les limites de durabilité, permissions, authentification et hors ligne, ainsi que les liens officiels Dexie ; utiliser uniquement des exemples génériques sans email réel, OTP, jeton, secret ni donnée personnelle ; étendre les assertions du test automatisé déterministe pour vérifier l'ordre de la FAQ, le glossaire, les liens, le format moderne `threadstep.indexeddb-backup`, l'absence de parcours V1 actif et l'absence de données sensibles ; exécuter le test ciblé.

## 2. Découvrabilité documentaire

- [x] 2.1 Ajouter un lien visible vers le guide depuis la section « Enregistrement, export et import » de `docs/product/guide-utilisation.md`, ainsi qu'une référence adaptée dans `docs/product/dexie-cloud-rollout.md` et `docs/product/acceptance-checklist.md` ; étendre `tests/ts-046-persistence-guide.test.mjs` pour résoudre chaque lien relatif et vérifier qu'il atteint le guide ; exécuter `node --test tests/ts-046-persistence-guide.test.mjs`.

## 3. Vérifications d'intégration pré-sync

- [x] 3.1 Exécuter `npm test` et vérifier que l'ensemble des tests, y compris le test documentaire TS-046, passe sans échec.
- [x] 3.2 Exécuter `npm run check` et `openspec validate ts-046 --strict --no-interactive` ; rapporter les résultats réels et ne cocher cette tâche que si les deux commandes réussissent.

## Manual acceptance

- Sur un ordinateur et sur un téléphone réels, faire relire le guide par une personne non avertie : lui demander de localiser la démarche pour « Mes projets est vide » et pour « passage du local à Cloud », puis vérifier qu'elle distingue correctement le cache local de la base distante.
- Parcourir les liens depuis le guide général, la documentation de déploiement et la recette : vérifier qu'ils ouvrent le bon guide et que les ancres utiles fonctionnent.
- Contrôler la lisibilité mobile à 320 px, le défilement des tableaux, les titres, la FAQ et le glossaire ; noter tout débordement ou jargon restant.
- Vérifier au clavier et avec un lecteur d'écran la navigation dans le guide rendu par la forge ou le site, y compris les liens et les tableaux.
- Relire les scénarios de déconnexion, import, restauration, purge et suppression des données navigateur avec un utilisateur non technique : confirmer qu'il trouve la sauvegarde conseillée, l'action exacte et le retour arrière sans confondre les copies.
- Vérifier que les libellés cités correspondent à l'interface réellement publiée au moment de la relecture et signaler tout écart découvert par TS-045 ou TS-047. Ces vérifications restent à effectuer et ne sont pas prouvées par la CI.

## Post-sync review

- Comparer les deltas OpenSpec réellement synchronisés à la nouvelle capacité `persistence-user-guide` et vérifier qu'aucune spécification de comportement applicatif n'a été modifiée par erreur.
- Vérifier l'archive du changement et son contenu versionné, notamment la présence du `## Purpose`, des scénarios et des liens documentaires.
- Après publication, contrôler la CI indépendante sur le SHA exact de la PR, la protection de branche, le diff documentaire et l'absence de secrets, puis la fusion, la CI de `main` et le déploiement GitHub Pages.
- Confronter le guide publié à `main` et aux éventuels correctifs TS-045/TS-047 ; noter explicitement les écarts, liens cassés, fautes ou limites non prouvées, sans présenter la CI comme une preuve de compréhension humaine ou de propagation distante.
