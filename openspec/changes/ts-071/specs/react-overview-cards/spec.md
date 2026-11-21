# Spec Delta

## ADDED Requirements

### Requirement: Project card actions and task creation placement
Chaque carte Overview SHALL placer l’ouverture et l’ajout d’une tâche dans sa zone de pied, et SHALL garder les commandes projet actives accessibles une fois chacune avec un nom accessible identifiant le projet.

#### Scenario: Project actions remain delegated and unique
- **GIVEN** une carte Overview affichée
- **WHEN** l’utilisateur ouvre le projet, ajoute une tâche, déplace ou supprime le projet
- **THEN** une seule commande existante correspondante est déléguée au contrôleur
- **AND** aucune présentation de carte ne produit une écriture supplémentaire

### Requirement: Project empty and filtered task states
La carte SHALL différencier un projet sans tâche d’un projet dont les tâches sont absentes de l’aperçu après application du filtre, sans modifier la limite des cinq tâches parentes ni les compteurs canoniques.

#### Scenario: Genuine empty and filter-hidden projects
- **GIVEN** un projet vide ou un projet ayant des tâches toutes masquées
- **WHEN** sa carte est rendue après le filtre existant
- **THEN** seul le projet sans tâche reçoit l’état vide et l’action de création
- **AND** le projet filtré indique que ses tâches sont masquées
- **AND** les compteurs reflètent toujours les données complètes réelles
