# Proposal

## Why

Depuis « Mes projets », l'utilisateur doit ouvrir chaque fiche pour savoir
combien de projets restent actifs, combien d'urgences attendent et où en est
chaque projet. La vue d'ensemble ne montre aujourd'hui que le nombre global
d'étapes restantes et le total de tâches par carte. Une synthèse compacte et
une progression par projet permettraient de prioriser sans parcourir chaque
fiche.

## What Changes

- Ajouter à Overview une synthèse compacte des données réellement lues :
  « N projet(s) actif(s) », « N étape(s) en attente » et
  « N urgence(s) en attente ».
- Définir un **projet actif** comme un sujet contenant au moins un
  enregistrement d'étape non terminé, parent ou sous-tâche. Le nombre
  d'étapes en attente conserve son sens actuel : tous les enregistrements
  non terminés, parents et sous-tâches compris. Une urgence est un
  enregistrement `priority: urgent` et `done: false`.
- Enrichir chaque carte projet d'un compteur d'urgences restantes et d'une
  progression textuelle « X / Y étape(s) terminée(s) » avec pourcentage
  arrondi à l'entier le plus proche, en comptant chaque enregistrement
  d'étape une seule fois. Un projet sans étape affiche « Aucune étape »,
  sans pourcentage fabriqué.
- Réutiliser le compteur global existant comme support de la synthèse au
  lieu d'afficher deux fois le même nombre d'étapes en attente. Le nombre
  et le sens restent identiques ; seule la présentation est enrichie.
- Recalculer ces indicateurs à chaque rendu issu de la lecture métier
  autorisée : création, complétion, priorité, promotion, suppression et
  annulation, import/restauration autorisés, actualisation Dexie et
  changement inter-onglets.
- Conserver la barrière de visibilité TS-045/048 et le chargement ou
  diagnostic TS-052 : aucun chiffre nul, aucune donnée d'un autre espace et
  aucun cache non autorisé ne sont présentés avant une lecture autorisée
  achevée.
- Préserver la mise en page vanilla, les cartes de suivi et suggestion, les
  compteurs existants, le filtre « Masquer les étapes terminées », l'ordre
  des sujets, la limite de cinq parents en aperçu et les règles de
  suggestion et de reprise.

## Capabilities

### New Capabilities

- `overview-project-metrics` : agrégats dérivés des projets actifs, des
  étapes en attente et des urgences, synthèse de la vue d'ensemble, compteur
  d'urgences et progression par carte, recalculés sans écriture ni lecture
  supplémentaire.

### Modified Capabilities

- `overview-project-read-state` : ajouter l'exigence que la synthèse et les
  indicateurs de carte suivent l'état de lecture autorisée et restent
  absents ou masqués pendant l'initialisation, une lecture en attente, un
  changement d'identité ou une action requise, sans jamais afficher de
  chiffre fictif.

## Impact

- `site/core.js` : fonctions pures de comptage, d'activité, de progression
  et de libellés français.
- `site/app.js` : calcul à partir de `documentState` déjà autorisé, synthèse
  dans le compteur global existant et indicateurs dans les cartes projet.
- `site/index.html` et `site/styles.css` : état initial neutre du compteur,
  mise en page compacte, repli mobile sans débordement horizontal.
- Nouveaux tests déterministes et mise à jour ciblée des tests existants qui
  supposent le libellé actuel du compteur global.
- Aucun changement de schéma IndexedDB, de colonne, de préférence,
  d'export/import, de synchronisation, d'authentification, de lecture
  Dexie, de réseau, de workflow ASF, de secret ou de configuration Cloud.

## Assumptions and uncertainties

- Le brief impose « X / Y étapes terminées ». L'accord français est appliqué
  comme pour les compteurs existants : singulier quand `Y = 1`, pluriel
  sinon. Le nombre et le pourcentage restent ceux exigés.
- Le libellé exact du compteur d'urgences par carte n'est pas fourni par le
  brief. Le plan retient « 0 urgence restante », « 1 urgence restante » et
  « N urgences restantes » ; seul le comptage est contractuel.
- Les indicateurs sont ajoutés aux cartes de la vue d'ensemble. La vue de
  détail garde son en-tête actuel (étapes en attente et total), aucune
  exigence du brief ne demandant la progression dans le détail.
- Les espacements et la disposition visuelle exacte peuvent être ajustés
  pendant `apply` sans modifier les comptes, les libellés contractuels ni
  les scénarios.
- Aucune nouvelle décision produit n'est prise sur les filtres, la
  recherche, l'archivage, le partage, les graphiques, la charge, le temps,
  la suggestion, la reprise, la synchronisation ou la persistance.
