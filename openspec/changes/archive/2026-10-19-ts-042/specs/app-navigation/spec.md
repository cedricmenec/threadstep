# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page structure

Chaque page de paramètres SHALL afficher un titre explicite et un contrôle de
retour en français. La page Imports / Exports SHALL réunir les contrôles
existants d'export, d'import/fusion et de restauration dans des sections
distinctes. La page Synchronisation Dexie Cloud SHALL rester descriptive jusqu'à
sa tâche dédiée.

#### Scenario: Settings index page

- **WHEN** `#/parametres` est affiché
- **THEN** la page montre le titre « Paramètres »
- **AND** elle propose des liens vers Imports / Exports et Synchronisation Dexie Cloud
- **AND** elle propose un retour vers Mes projets

#### Scenario: Imports / Exports destination page

- **WHEN** `#/parametres/donnees` est affiché
- **THEN** la page montre le titre « Imports / Exports »
- **AND** elle contient les sections « Exporter », « Importer et fusionner » et « Restaurer un état antérieur »
- **AND** elle propose un retour vers les paramètres
- **AND** les contrôles existants `#export`, `#import`, `#restore` et `#restore-panel` y sont accessibles, chacun une seule fois
- **AND** chaque contrôle reste associé à son intention de sauvegarde
- **AND** chaque contrôle est atteignable au clavier et au toucher, avec un libellé français visible

#### Scenario: The overview no longer duplicates the data actions

- **WHEN** la vue d'ensemble `#/` est affichée
- **THEN** la barre d'actions initiale d'export, d'import et de restauration n'est plus affichée sur l'accueil
- **AND** aucune copie de `#export`, `#import`, `#restore` ou `#restore-panel` n'y est rendue
- **AND** les commandes de données sont accessibles depuis `#/parametres/donnees`

#### Scenario: Synchronization destination page

- **WHEN** `#/parametres/synchronisation` est affiché
- **THEN** la page montre le titre « Synchronisation Dexie Cloud »
- **AND** elle décrit la destination de la future page de diagnostic
- **AND** elle propose un retour vers les paramètres
- **AND** aucun formulaire de configuration, d'activation ou de connexion n'y est déplacé

#### Scenario: Existing controls remain available

- **WHEN** une page de paramètres est affichée
- **THEN** les contrôles existants d'export, d'import et de restauration restent disponibles sur la page Imports / Exports
- **AND** les contrôles de connexion, de configuration Cloud, d'espaces de travail et de diagnostic restent disponibles à leur emplacement existant
- **AND** leurs sélecteurs et handlers ne sont ni renommés, ni recréés, ni dupliqués

#### Scenario: Conditional business visibility is preserved

- **GIVEN** un espace Cloud configuré et non authentifié, ou une liaison de compte bloquée
- **WHEN** la page Imports / Exports est affichée
- **THEN** les commandes métier restent masquées selon la règle de visibilité existante
- **AND** aucune commande inopérante ou non autorisée n'est rendue
- **AND** la page ne déclenche ni authentification, ni requête réseau, ni ouverture de base
