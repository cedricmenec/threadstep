# Spec Delta

## REMOVED Requirements

### Requirement: Accessible and responsive presentation parity
**Reason**: La nouvelle carte TS-071 modifie explicitement la structure, les classes de présentation et l’ordre des commandes projet.
**Migration**: Appliquer les critères TS-071 de composition responsive, de noms accessibles, de focus visible et de cibles tactiles ; les commandes métier et les règles de données restent inchangées.

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

### Requirement: Responsive and accessible Overview card controls
Les cartes SHALL rester lisibles sans défilement horizontal de 320 à 1280 px. Les contrôles SHALL avoir un nom accessible distinct, un focus visible et une cible tactile d'au moins 44 × 44 px ; les contenus utilisateur MUST rester du texte.

#### Scenario: Long card content and task controls remain reachable
- **GIVEN** un titre ou une note longue et les contrôles d'une carte
- **WHEN** la carte est rendue sur téléphone, tablette ou bureau
- **THEN** le texte revient à la ligne sans débordement horizontal
- **AND** chaque action projet, tâche, priorité et sous-tâche reste atteignable par clavier et toucher avec un nom accessible

#### Scenario: User content remains literal text
- **GIVEN** un titre de projet, une tâche ou une note contient un balisage tel que `<img src=x onerror=alert(1)>`
- **WHEN** la carte est rendue
- **THEN** le contenu est présenté comme texte littéral et ne crée aucun élément exécutable
