# Design

## Context

Voir `proposal.md` — Why. L'état actuel est une application statique dont
`site/index.html` place `#business-tools` dans l'en-tête `.hero` et
`#restore-panel` après les panneaux Cloud. `site/app.js` acquiert ces nœuds au
chargement, conserve les listeners existants (`exportBusinessBackup`, import
`parseIndexedDbBackup`/réconciliation, restauration avec sauvegarde et
confirmation) et applique la visibilité métier via `applyBusinessVisibility` et
`applySettingsVisibility`.

Les routes `#/parametres`, `#/parametres/donnees` et
`#/parametres/synchronisation` existent déjà et affichent trois sections
statiques. La page de données est actuellement descriptive. Les commandes
métier restent fonctionnelles indépendamment de leur conteneur : les
sélecteurs sont des identifiants uniques et les handlers sont attachés une
seule fois au chargement.

Le runner ne fournit ni DOM réel, ni IndexedDB, ni navigateur. Les preuves
automatisables doivent rester des tests Node purs et des assertions statiques
sur le HTML, le CSS et le câblage JavaScript, sans ajouter de dépendance de
navigateur.

## Goals / Non-Goals

**Goals:**

- Rendre `#/parametres/donnees` fonctionnelle avec les mêmes contrôles, sans
  duplication ni nouveau moteur.
- Préserver exactement les garde-fous de restauration, les messages d'erreur,
  les rôles accessibles, les états `hidden` et la visibilité conditionnelle
  Cloud existants.
- Conserver les sauvegardes de sécurité des opérations dangereuses et l'export
  brut de récupération dans leurs contextes actuels.
- Prouver par des tests déterministes que l'export, l'import/fusion et la
  restauration ne changent pas de comportement.

**Non-Goals:**

- Refondre les modules de sauvegarde, de réconciliation ou de persistance.
- Déplacer les panneaux de synchronisation, de connexion, d'activation, de
  configuration, d'espaces de travail ou de diagnostic.
- Créer un routeur ou modifier `parseRoute`.
- Simuler un navigateur réel, un appareil mobile ou un lecteur d'écran en CI.

## Decisions

### 1. Déplacer les nœuds existants au lieu de recréer les contrôles

Le bloc `#business-tools` est déplacé dans `#settings-data-page`. Les trois
sections « Exporter », « Importer et fusionner » et « Restaurer un état
antérieur » sont conservées comme conteneurs descriptifs et fonctionnels :
chaque action existante rejoint sa section. Les identifiants `#export`,
`#import`, `#restore` et `#restore-panel` restent uniques et les listeners de
`site/app.js` restent inchangés.

Alternative rejetée : générer une nouvelle barre d'actions et supprimer
l'ancienne. Cela risquerait de renommer les sélecteurs, de perdre un handler ou
de créer deux branchements, et rendrait l'équivalence difficile à prouver.

### 2. Conserver `#business-tools` comme conteneur unique des commandes

Le conteneur `#business-tools` reste l'élément dont `applyBusinessVisibility`
contrôle l'accès en mode Cloud non authentifié ou avec liaison de compte
bloquée. Il englobe les trois sections et leurs contrôles dans la page de
données. La barre d'actions de l'accueil disparaît donc sans changer la règle
de sécurité existante.

Conséquence assumée : lorsque l'accès métier Cloud est bloqué, les sections de
commandes de la page sont masquées comme l'était la barre d'actions. Le titre et
le retour de la page restent disponibles. Cette perte de texte descriptif dans
un état d'accès bloqué est préférable à un déplacement du contrôle de sécurité
ou à un affichage de commandes inopérantes.

Alternative rejetée : déplacer chaque contrôle dans un conteneur distinct et
réécrire la visibilité conditionnelle. Cela modifierait un mécanisme de
sécurité existant sans nécessité produit.

### 3. Intégrer le parcours de restauration dans la section de restauration

`#restore-panel` est déplacé sous le contrôle `#restore` dans la section
« Restaurer un état antérieur ». Le panneau conserve son attribut `hidden`, son
avertissement de remplacement, sa portée, l'obligation de télécharger une
sauvegarde de l'état courant, la saisie `RESTAURER`, la validation
`plan.allowed`, l'annulation et sa zone `role="status"`.

Le déplacement ne change pas la machine d'état : `hideRestorePanel`,
`openRestorePreview`, `renderRestorePanel`, `updateRestoreConfirmState`,
`downloadRestoreBackup` et `confirmRestore` continuent de gouverner le parcours.
Un changement de route, un rechargement ou une annulation ne doit appeler aucun
commit ; seule une confirmation valide avec sauvegarde vérifiée peut écrire.

Alternative rejetée : réinitialiser systématiquement le contexte de
restauration au changement de route. Le brief demande de préserver l'état de
confirmation ; le critère observable est l'absence d'écriture implicite, pas la
destruction d'une prévisualisation non confirmée.

### 4. Garder les actions contextuelles hors de la page de données

Le bouton `#workspace-backup` reste dans `#workspace-confirmation`, et
`#recovery-raw-export` reste dans `#recovery-panel`. Ces actions dépendent d'un
contexte de confirmation ou de diagnostic qui serait perdu par une navigation
vers `#/parametres/donnees`. Aucun de ces panneaux n'est déplacé.

Alternative rejetée : centraliser toutes les sauvegardes sur la page de
données. Cela obligerait l'utilisateur à quitter une confirmation de purge ou de
déconnexion, contrairement à l'exigence de conservation du contexte.

### 5. Tests statiques ciblés et non-régression métier

Le nouveau test `tests/ts-042-data-page.test.mjs` vérifie :

- l'unicité de `#business-tools`, `#export`, `#import`, `#restore` et
  `#restore-panel`, et leur présence dans `#settings-data-page` ;
- l'absence de ces commandes dans `.hero` et `#dashboard` ;
- la présence des trois sections et de leurs textes distinctifs ;
- l'attachement unique des listeners existants aux mêmes fonctions ;
- les garde-fous de restauration et l'absence d'appel de commit dans le
  traitement de navigation, d'annulation et de rechargement ;
- le maintien de `#workspace-backup` dans `#workspace-confirmation` et de
  `#recovery-raw-export` dans `#recovery-panel` ;
- la non-régression du format et des règles d'import via les modules existants
  (`buildBusinessExport`, `serializeIndexedDbBackup`, `parseIndexedDbBackup`,
  `planReconciliation`) sur des fixtures déterministes.

`tests/ts-041-navigation.test.mjs` est adapté : il vérifiait l'absence de
contrôles dans les pages de paramètres, ce qui devient faux par conception. Il
continue de vérifier les routes, les titres, les retours et l'absence d'effet
de bord de navigation.

Alternative rejetée : ajouter jsdom ou Playwright. Le runner ne disposerait
toujours ni d'IndexedDB réelle, ni de lecteur d'écran, ni de tactile, pour un
coût de dépendance et de maintenance supérieur. Les recettes réelles restent
manuelles.

## Risks / Trade-offs

- [Les tests statiques ne prouvent pas le rendu réel] → Ils prouvent le contrat
  DOM et l'absence de duplication ; les vérifications visuelles, tactiles,
  clavier et lecteur d'écran restent dans `Manual acceptance`.
- [Un déplacement HTML casse silencieusement un sélecteur] → Des tests
  d'unicité et d'attachement des handlers échouent avant sync si un
  identifiant ou listener manque.
- [Le conteneur `#business-tools` masque les descriptions en Cloud bloqué] →
  Comportement cohérent avec la règle de sécurité existante ; documenté ici et
  vérifié en recette réelle.
- [La page devient longue sur mobile] → Contrôles empilés, cibles d'au moins
  44 px, entrées de fichier masquées et libellés visibles ; vérification à
  320 px en recette réelle.
- [Une restauration reste en attente après navigation] → Aucune écriture n'est
  déclenchée par la navigation ; seule la confirmation explicite avec
  sauvegarde et plan valide peut committer.
- [Le déplacement révèle un couplage métier] → Arrêter l'implémentation et
  requalifier le risque, comme indiqué dans le brief.

## Migration Plan

Aucune migration de données. Modification de présentation réversible :
restaurer l'ancien emplacement des deux blocs HTML et les styles associés suffit
à revenir à l'état précédent. Aucun format, aucune base, aucune configuration
Cloud et aucune archive OpenSpec n'est modifiée par l'implémentation.

## Open Questions

Aucune question ouverte ne change les spécifications, l'approche ou le
découpage des tâches. La formulation exacte des textes français et la classe CSS
du conteneur peuvent être ajustées pendant `apply` sans modifier le comportement
observable.
