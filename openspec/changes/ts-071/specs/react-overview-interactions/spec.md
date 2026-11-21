# Spec Delta

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
