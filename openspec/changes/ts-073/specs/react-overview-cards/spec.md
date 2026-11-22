## ADDED Requirements

### Requirement: Project-only Overview cards

La surface Overview SHALL afficher une carte par projet autorisé, dans l’ordre enregistré, avec son nom, le nombre total de tâches principales et le nombre d’urgences non terminées. Elle MUST NOT afficher de ligne de tâche, d’aperçu, d’action de tâche ou de filtre de projet.

#### Scenario: Minimal project card

- **GIVEN** un document autorisé contenant plusieurs projets
- **WHEN** la surface Overview est rendue
- **THEN** une carte textuelle est rendue pour chaque projet dans l’ordre du document
- **AND** chaque carte présente son nom, son total de tâches principales et ses urgences restantes
- **AND** aucune tâche ni commande de tâche n’est présente dans la surface

#### Scenario: Existing project metrics

- **GIVEN** un projet contenant des tâches principales et des sous-tâches terminées, en attente ou urgentes
- **WHEN** sa carte est rendue
- **THEN** le total inclut toutes les tâches principales, terminées comprises, sans compter les sous-tâches
- **AND** les urgences comptent les éléments urgents non terminés, sous-tâches comprises
- **AND** les libellés français correspondent aux valeurs réelles

#### Scenario: Open a project from its card

- **GIVEN** une carte nommant le projet A
- **WHEN** l’utilisateur active la carte par clavier, pointeur ou toucher
- **THEN** l’intention existante ouvre la route de détail du projet A
- **AND** aucun autre projet n’est ouvert
- **AND** le focus de navigation suit le contrat existant de la route de détail

#### Scenario: Empty project list

- **GIVEN** la lecture métier autorisée est achevée et le document ne contient aucun projet
- **WHEN** l’overview est rendue
- **THEN** l’état vide et l’action existante de création de projet restent disponibles
- **AND** aucune métrique fictive n’est présentée

#### Scenario: Loading and uncertain read

- **GIVEN** la lecture métier n’est pas achevée ou est bloquée
- **WHEN** l’overview est rendue
- **THEN** l’état de chargement ou d’attention applicable est affiché
- **AND** aucune carte vide ni aucune métrique n’est présentée

### Requirement: Card interaction and read continuity

La carte SHALL être un contrôle de navigation accessible unique, sans contrôle interactif imbriqué. Les mises à jour de même route et identité SHALL préserver le focus pertinent, le contexte de lecture et la surface montée. L’ouverture SHALL utiliser la commande et la route existantes sans écriture supplémentaire.

#### Scenario: Single navigation command

- **WHEN** une carte projet est activée une fois
- **THEN** une seule commande `openProject` est déléguée avec son identifiant
- **AND** aucun état métier ni stockage n’est modifié par le rendu

#### Scenario: Same-context refresh

- **GIVEN** une carte est focalisée ou visible après défilement
- **WHEN** des données de la même identité sont actualisées
- **THEN** les métriques sont recalculées sans remonter la surface
- **AND** le focus pertinent et l’ancrage de lecture restent valides

## REMOVED Requirements

### Requirement: Card data and counter parity

**Reason**: La carte n’affiche plus les tâches, le compte d’attente ou la progression des anciennes cartes.
**Migration**: Utiliser les compteurs de tâches principales et d’urgences définis par `Project-only Overview cards` ; la gestion détaillée reste dans la vue projet.

### Requirement: Five-parent preview and open-detail control

**Reason**: Les lignes de tâches et leur aperçu n’appartiennent plus à la page d’overview simplifiée.
**Migration**: Ouvrir le projet depuis sa carte pour consulter l’ensemble des tâches dans le détail.

### Requirement: Project card actions and task creation placement

**Reason**: Les commandes et la création de tâches ne font plus partie des cartes de l’overview.
**Migration**: Gérer et créer les tâches dans la vue de détail existante ; l’ajout de projets reste disponible au niveau de la liste.
