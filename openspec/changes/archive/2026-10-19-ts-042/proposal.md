# Proposal

## Why

Les commandes d'export, d'import/fusion et de restauration occupent encore la
barre d'actions de l'accueil alors que les routes de paramètres existent depuis
TS-041. Les centraliser sur `#/parametres/donnees` libère la vue « Mes projets »
et rend les intentions de sauvegarde explicites, sans modifier les moteurs
d'import/export ni les protections anti-perte de TS-035, TS-040 et TS-041.

## What Changes

- Déplacer visuellement la barre d'actions existante `#business-tools` de
  l'en-tête de l'accueil vers `#/parametres/donnees`, dans les sections
  « Exporter », « Importer et fusionner » et « Restaurer un état antérieur »,
  sans dupliquer les contrôles.
- Déplacer le parcours existant `#restore-panel` dans la section de restauration
  de cette page, en conservant ses avertissements, sa sauvegarde préalable, sa
  confirmation renforcée, son annulation et ses zones de statut.
- Réutiliser exactement les mêmes identifiants DOM, listeners, validations,
  parseurs et modules métier : aucun second moteur d'import, d'export ou de
  restauration n'est créé.
- Expliquer la différence entre export local JSON IndexedDB, import/fusion sans
  destruction et restauration de remplacement avec sauvegarde et confirmation.
- Retirer la barre d'actions initiale de l'accueil sans la recréer ailleurs ;
  l'accueil ne doit plus afficher une copie des commandes de données.
- Conserver à leur emplacement et dans leur contexte les actions de sauvegarde
  des confirmations dangereuses (purge, déconnexion, espace de travail) ainsi
  que l'export brut du diagnostic en lecture seule.
- Mettre à jour les tests de navigation, de présence DOM et de non-régression
  import/export/restauration, ainsi que la documentation produit.

## Capabilities

### New Capabilities

Aucune. Le changement ne crée pas de comportement métier nouveau : il déplace
une présentation existante vers une route déjà définie.

### Modified Capabilities

- `app-navigation` : la page `#/parametres/donnees` devient la page
  fonctionnelle des commandes de données ; l'accueil n'affiche plus la barre
  d'actions en double et la page de synchronisation reste descriptive. Les
  sélecteurs, handlers et règles de visibilité des contrôles existants sont
  préservés.
- `data-backup-import-restore` : ajout d'une exigence de page dédiée qui
  garantit un export inchangé et sans secret, un import/fusion non destructif
  et idempotent, un refus explicite des fichiers V1 ou invalides, une
  restauration protégée sans effet implicite, et le maintien des sauvegardes de
  sécurité dans leurs contextes d'opérations dangereuses.

## Impact

- `site/index.html` : déplacement de `#business-tools` et `#restore-panel` dans
  `#settings-data-page`, textes de sections et ordre des contrôles.
- `site/styles.css` : présentation des sections et actions de données, cibles
  tactiles, entrées de fichier, comportement `hidden` et largeur étroite.
- `site/app.js` : aucun changement de logique métier attendu ; vérification que
  les listeners et la visibilité conditionnelle de `#business-tools` restent
  identiques après le déplacement.
- `tests/ts-041-navigation.test.mjs`, nouveau
  `tests/ts-042-data-page.test.mjs` : contrat DOM, unicité des identifiants,
  handlers préservés, garde-fous de restauration, non-régression du format.
- `docs/product/guide-utilisation.md` et
  `docs/product/acceptance-checklist.md` : emplacement et usage des commandes.
- Aucun changement de schéma IndexedDB, de format
  `threadstep.indexeddb-backup`, de plan de réconciliation, d'écriture Dexie,
  de configuration Cloud, de secret ou de workflow.

## Non-Goals

- Modifier le format d'export, les validations, l'idempotence, les collisions,
  les plans de réconciliation ou les écritures IndexedDB/Dexie Cloud.
- Réintroduire ou prendre en charge les sauvegardes `version: 1`.
- Déplacer `#workspace-panel`, `#auth-panel`, `#cloud-config`,
  `#cloud-activation`, `#sync-diagnostic` ou `#recovery-panel` : TS-043 et
  TS-044 traitent leurs pages dédiées.
- Modifier les parcours de consentement, d'authentification, de purge, de
  déconnexion, de suspension ou de sélection d'espace.
- Ajouter un algorithme de sauvegarde, une réparation de données ou une purge.

## Uncertainties and decisions

- **Déplacement, pas duplication.** La barre `#business-tools` est déplacée
  avec ses identifiants et ses handlers. L'accueil ne conserve aucune copie des
  commandes ; une duplication créerait des listeners concurrents et violerait
  l'unicité des identifiants.
- **Portée des sections.** Les trois sections de la page décrivent les
  intentions et hébergent les contrôles correspondants. Le panneau de
  restauration reste dans la section de restauration et ne devient jamais un
  effet implicite de l'import.
- **Cycle de vie de la prévisualisation.** Un changement de page, un
  rechargement ou une annulation ne doivent exécuter aucune restauration. La
  prévisualisation peut rester en mémoire tant qu'aucune confirmation valide
  n'est donnée, mais aucune action n'est rejouée automatiquement.
- **Couplage éventuel.** L'étude du code montre que les listeners et les
  modules d'import/export sont indépendants de l'emplacement HTML. Si
  l'implémentation révélait un couplage imposant de modifier les écritures ou
  les protections, l'exécution doit s'arrêter et le risque être requalifié
  avant toute exécution automatique.
- **Décision produit non tranchée.** Aucun nouveau texte réglementaire, nouveau
  format ou nouvelle option de sauvegarde n'est introduit. La formulation
  exacte des descriptions françaises peut être ajustée pendant `apply` sans
  changer les scénarios observables.
