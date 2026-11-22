# Spec Delta

## REMOVED Requirements

### Requirement: Interaction parity and safe rendering
**Reason**: TS-071 réorganise les actions de carte et modifie la structure HTML de présentation ; la parité exacte du markup n'est plus requise.
**Migration**: Préserver les commandes métier uniques, les noms accessibles des contrôles de tâche, le focus, le texte utilisateur sûr et les frontières de route/stockage spécifiés par TS-071.

## ADDED Requirements

### Requirement: Accessible task reordering on touch devices
La surface Overview SHALL conserver une commande clavier et tactile pour déplacer une tâche sur les appareils où la poignée de glissement est masquée, en appliquant les mêmes règles de priorité, de parenté, d’ordre et de validation que le contrôleur existant.

#### Scenario: Touch device uses task action menu
- **GIVEN** un appareil à pointeur grossier ou une vue mobile sans poignée de glissement
- **WHEN** l’utilisateur ouvre les actions d’une tâche réordonnable
- **THEN** les commandes de déplacement avant/arrière applicables restent accessibles avec un nom indiquant le contexte de priorité ou de parenté
- **AND** une commande invalide ou sans effet n’écrit aucune donnée

#### Scenario: Reordering rules remain unchanged
- **WHEN** une tâche Overview est déplacée au clavier ou au toucher
- **THEN** le contrôleur applique les règles existantes de priorité et de parenté
- **AND** une activation valide produit au plus une mutation déléguée

### Requirement: Task controls retain accessible names and safe text
Les contrôles de tâche conservés dans Overview SHALL garder des noms accessibles qui identifient leur tâche et leur action. Les titres et notes MUST être rendus comme texte ; les actions projet regroupées ne MUST NOT dupliquer une commande.

#### Scenario: Task control names identify the task
- **GIVEN** une tâche avec priorité, sous-tâches et menu d'actions
- **WHEN** ses contrôles sont rendus dans Overview
- **THEN** la complétion, la priorité, l'ouverture des sous-tâches et les actions de menu ont des noms accessibles qui identifient la tâche
- **AND** les commandes de projet restent distinctes de celles de tâche

#### Scenario: User text cannot create markup
- **GIVEN** un titre ou une note contenant du balisage
- **WHEN** le texte est affiché dans une carte ou une tâche
- **THEN** il reste littéral et ne crée aucun élément exécutable
