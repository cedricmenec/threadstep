# Spec Delta

## MODIFIED Requirements

### Requirement: Overview composition preserved

La route `#/` SHALL conserver les zones, commandes actives et ordre de lecture
livrés. Les éléments visuels Stitch approuvés pour TS-068 MAY apparaître
uniquement comme contenu statique ou commandes nativement désactivées dans les
cartes projet. Ils MUST NOT ajouter de destination, commande active, métrique
ou donnée métier fictive.

#### Scenario: All existing surfaces remain present

- **GIVEN** une lecture métier autorisée achevée avec au moins un projet
- **WHEN** la route `#/` est affichée
- **THEN** la reprise, la synthèse, la suggestion, les urgences, le formulaire,
  les filtres, le chargement et les cartes restent présents dans leur ordre
  relatif livré
- **AND** les commandes actives existantes conservent leur comportement
- **AND** les seules additions de TS-068 restent statiques/désactivées dans les
  cartes projet

#### Scenario: Navigation remains contractual

- **WHEN** l'en-tête et la navigation sont affichés sur Overview
- **THEN** les quatre destinations et leurs routes restent celles de
  `app-navigation`
- **AND** aucune sidebar, barre inférieure ou destination « Tâches / Focus /
  Chercher » n'est introduite
- **AND** aucun élément visuel désactivé ne crée une navigation

#### Scenario: Loading and empty states stay unchanged

- **GIVEN** une lecture en attente, un document vide ou un filtre sans résultat
- **WHEN** la route `#/` est affichée
- **THEN** le chargement, l'état vide ou l'état filtré prévu reste seul affiché
- **AND** aucune carte, métrique, valeur projet ou commande factice n'est créée

#### Scenario: Stitch affordances do not execute actions

- **GIVEN** une carte projet Overview affichant des éléments visuels issus de
  Stitch
- **WHEN** l'utilisateur tente d'utiliser une recherche, un filtre, un tri, une
  échéance, un partage, un archivage ou une métadonnée statique
- **THEN** ces éléments restent désactivés ou non interactifs
- **AND** la liste, l'ordre, les données, les routes et la persistance restent
  inchangés
- **AND** aucune valeur de démonstration n'est présentée comme donnée réelle
