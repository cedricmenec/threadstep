# Spec Delta

## REMOVED Requirements

### Requirement: Overview composition preserved
**Reason**: TS-071 approuve une nouvelle composition de carte et réactive les seules commandes produit déjà prises en charge.
**Migration**: Appliquer les exigences TS-071 de hiérarchie et d’actions accessibles ; conserver les zones globales, routes et commandes du contrôleur existants.

### Requirement: DOM parity and accessible presentation
**Reason**: La composition approuvée requiert une nouvelle structure et le déplacement des commandes projet dans un menu.
**Migration**: Préserver les libellés et commandes existants, les cibles tactiles, le focus visible et l’ordre de lecture définis par les exigences TS-071.

## ADDED Requirements

### Requirement: Approved Overview card composition
La carte Overview SHALL présenter le titre et les compteurs réels dans l’en-tête, la liste hiérarchique au centre et les commandes de création et d’ouverture dans le pied. Elle MUST NOT afficher de métadonnée sans source ou de commande inactive de partage/archivage.

#### Scenario: Project card uses its actual data
- **WHEN** une carte Overview est rendue pour un projet
- **THEN** son titre, ses compteurs, sa progression et ses urgences proviennent des propriétés réelles existantes
- **AND** aucun exemple, horodatage ou champ « non renseigné » n’est présenté comme une donnée du projet

#### Scenario: Project commands remain available once
- **WHEN** une carte Overview est rendue
- **THEN** l’ouverture du projet et la création de tâche restent disponibles dans le pied
- **AND** les commandes existantes de déplacement et de suppression restent accessibles depuis une action nommée
- **AND** aucun bouton Partager ou Archiver désactivé n’est présenté

### Requirement: Responsive task hierarchy and empty state
Les cartes SHALL adapter les lignes, notes et sous-tâches à la largeur disponible sans défilement horizontal, avec hiérarchie textuelle indépendante de la couleur. Une carte réellement vide MUST être distinguée d’un aperçu masqué par filtre.

#### Scenario: Long text and nested task remain readable
- **GIVEN** des titres ou notes longs et une sous-tâche visible
- **WHEN** la carte est présentée de 320 à 1280 px
- **THEN** le texte revient à la ligne, les sous-tâches restent indentées et reliées visuellement
- **AND** les badges de priorité et l’état terminé restent identifiables par leur texte ou leur forme

#### Scenario: Empty project differs from filtered preview
- **GIVEN** un projet sans tâche ou un projet dont toutes les tâches visibles sont filtrées
- **WHEN** la carte est rendue
- **THEN** l’état « aucune tâche » est réservé au projet réellement vide
- **AND** l’état filtré indique que les tâches sont masquées sans créer de tâche factice

#### Scenario: Touch targets and focus are available
- **WHEN** les commandes de carte ou de tâche sont affichées sur téléphone
- **THEN** leurs cibles mesurent au moins 44 × 44 px
- **AND** elles ont des noms accessibles distincts et un focus visible
