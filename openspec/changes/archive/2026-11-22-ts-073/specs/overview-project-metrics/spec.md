## ADDED Requirements

### Requirement: Task and urgency counts on project cards

Chaque carte de la liste Overview SHALL afficher le total des tâches principales et le nombre d’urgences restantes calculés à partir du document autorisé. Le total inclut les tâches principales terminées et exclut les sous-tâches ; les urgences incluent tout élément urgent non terminé, sous-tâches comprises.

#### Scenario: Counts stay independent of presentation

- **GIVEN** des projets contenant des tâches terminées, en attente, urgentes et des sous-tâches
- **WHEN** l’overview est rendue ou actualisée
- **THEN** chaque carte affiche les valeurs des fonctions métriques canoniques
- **AND** les comptes ne dépendent d’aucun aperçu, filtre ou état de repli

#### Scenario: Metrics are read-only

- **WHEN** les métriques sont calculées ou affichées dans les cartes simplifiées
- **THEN** document, export, persistance, synchronisation et préférences restent inchangés
- **AND** aucun champ, stockage, lecture de base ou requête réseau n’est ajouté

## REMOVED Requirements

### Requirement: Synthèse de la vue d'ensemble

**Reason**: La page principale n’affiche plus de synthèse globale d’activité.
**Migration**: Les compteurs d’activité et d’urgence restent visibles par projet ; les tâches se consultent dans le détail.

### Requirement: Progression textuelle par carte

**Reason**: Le taux de progression ajoute une mesure non demandée à la carte simplifiée.
**Migration**: La carte affiche uniquement le nombre total de tâches principales et le nombre d’urgences restantes.

### Requirement: Comportement existant et continuité préservés

**Reason**: Cette exigence associe la présentation des métriques à la conservation des aperçus, filtres et panneaux globaux qui sont retirés.
**Migration**: Les exigences générales de continuité restent dans `ux-interaction-continuity` ; les compteurs restent dérivés en lecture seule du document autorisé.
