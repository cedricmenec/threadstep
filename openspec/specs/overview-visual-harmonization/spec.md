# overview-visual-harmonization Specification

## Purpose

Définir la présentation visuelle et responsive de la route Overview afin que la
page « Mes projets » reste lisible, cohérente et fidèle aux références Stitch
approuvées, sans modifier ses comportements, ses données ni sa frontière React.

## Requirements

### Requirement: Responsive hierarchy across representative widths

La présentation SHALL rester lisible et sans débordement horizontal à 320, 390,
430, 768 et 1280 px. Les titres, métriques, libellés et notes longs MUST revenir
à la ligne dans leur conteneur et les commandes MUST se replier sans être
rognées. Aucune largeur fixe supérieure à la largeur mobile MUST être imposée.

#### Scenario: Compact phone widths

- **GIVEN** une largeur de viewport de 320, 390 ou 430 px
- **WHEN** Overview affiche la synthèse, les filtres, le formulaire et les cartes
- **THEN** les zones restent dans la largeur disponible sans débordement
  horizontal
- **AND** les en-têtes de carte et les commandes se replient sans perte
  d'information
- **AND** les libellés longs et les notes restent lisibles

#### Scenario: Tablet and desktop widths

- **GIVEN** une largeur de viewport de 768 ou 1280 px
- **WHEN** Overview est affiché
- **THEN** la hiérarchie de titre, synthèse et cartes est plus aérée que sur
  mobile sans changer l'ordre des zones
- **AND** le contenu reste borné par la largeur maximale partagée
- **AND** aucune nouvelle colonne, sidebar ou disposition de navigation n'est
  introduite

#### Scenario: Long content wraps

- **GIVEN** un titre de projet, un libellé de commande ou une note dépasse la
  largeur disponible
- **WHEN** la carte ou la zone globale est rendue
- **THEN** le texte revient à la ligne dans sa zone autorisée
- **AND** aucune barre de défilement horizontale n'est ajoutée à la page

### Requirement: Card and task-preview visual hierarchy

Chaque carte projet SHALL présenter une hiérarchie distincte entre le titre du
projet, ses métriques, ses commandes et ses aperçus de tâches. Les métriques
d'étapes, d'urgences et de progression MUST rester visibles sans couleur seule,
et les aperçus de tâches MUST conserver la limite de cinq parents, les
sous-tâches hors quota et la commande « Voir plus » du comportement livré.

#### Scenario: Card hierarchy is perceivable

- **GIVEN** une carte projet avec des métriques et des tâches
- **WHEN** la carte est affichée
- **THEN** le titre du projet est visuellement plus proéminent que ses métriques
- **AND** les commandes de carte restent distinctes du contenu de lecture
- **AND** les informations d'étapes, d'urgences et de progression restent
  compréhensibles par leur texte

#### Scenario: Task preview stays within its contract

- **GIVEN** une carte avec zéro, un, cinq ou six tâches parentes visibles
- **WHEN** l'aperçu est rendu après application du filtre de complétion
- **THEN** l'aperçu affiche respectivement zéro, un, cinq ou cinq parents
- **AND** les sous-tâches ne consomment aucun emplacement
- **AND** « Voir plus » reste présent uniquement au-delà de cinq parents

#### Scenario: Task states remain distinguishable

- **GIVEN** des tâches terminées, des priorités différentes et des sous-étapes
  repliées ou développées
- **WHEN** les lignes sont affichées
- **THEN** les distinctions de priorité, de complétion et de hiérarchie restent
  perceptibles sans couleur seule
- **AND** les notes restent du texte brut multiligne
- **AND** aucune donnée ni relation n'est modifiée par la présentation

### Requirement: Existing components and tokens reused

La présentation SHALL réutiliser les composants React et les primitives
existants ainsi que les tokens sémantiques partagés. Elle MUST NOT modifier les
valeurs des tokens existants, ajouter une palette, une police ou une ressource
distante, ni introduire une dépendance, une couche d'architecture ou un
propriétaire DOM nouveau.

#### Scenario: Components and ownership are unchanged

- **WHEN** les composants Overview et le document sont inspectés
- **THEN** les cartes, tâches, éditeurs et commandes restent rendus par les
  composants React et la frontière existants
- **AND** `ProjectCard.jsx`, `OverviewTaskList.jsx`, `OverviewCards.jsx` et les
  primitives `site/ui/` ne changent pas de rôle ni de propriétaire
- **AND** aucune nouvelle dépendance ou ressource réseau n'est ajoutée

#### Scenario: Token values are stable

- **WHEN** `site/styles/tokens.css` et les règles Overview sont comparées au
  rendu livré
- **THEN** les valeurs des tokens existants restent identiques
- **AND** les nouvelles règles consomment ces tokens ou des valeurs littérales
  locales strictement équivalentes
- **AND** aucune nouvelle échelle typographique ou palette n'est créée

#### Scenario: No persisted design preference

- **WHEN** le document, `localStorage`, IndexedDB, les routes et l'export sont
  inspectés après le changement
- **THEN** aucune préférence de thème, de token ou de présentation n'est
  persistée
- **AND** aucune clé de stockage, route ou migration n'est ajoutée

### Requirement: Behaviour, data and interaction continuity preserved

La modification SHALL rester présentationnelle : routes, données, persistance
IndexedDB/Dexie Cloud, identité d'espace, consentement, sauvegarde/restauration,
règles métier et commandes MUST rester inchangés. Le focus, l'ancrage de scroll,
les brouillons, les parents développés, les menus ouverts et le filtre MUST
rester continus lors d'une mise à jour de même vue et de même identité.

#### Scenario: No business or persistence change

- **GIVEN** un document de projets affiché
- **WHEN** Overview est rendu, mis à jour et parcouru
- **THEN** le document, les routes, les compteurs, les priorités, les relations
  et les états `done` restent inchangés
- **AND** aucune écriture IndexedDB, `localStorage`, synchronisation, requête
  réseau, authentification ou migration n'est déclenchée par la présentation
- **AND** l'export et l'import gardent leur format

#### Scenario: In-place update keeps context

- **GIVEN** la page est défilée, un parent est développé et un brouillon est
  présent
- **WHEN** une actualisation de données de même contexte met à jour les cartes
- **THEN** la surface reste montée sans remontée arbitraire
- **AND** le brouillon, le parent développé, le filtre et l'ancrage de scroll
  applicables sont conservés
- **AND** le focus reste sur un contrôle réellement présent

#### Scenario: Explicit boundary resets transient state

- **WHEN** l'utilisateur change de route, recharge la page, importe un document
  ou change d'identité autorisée
- **THEN** les états transitoires sont réinitialisés selon
  `ux-interaction-continuity`
- **AND** aucun contenu, brouillon ou état du contexte précédent n'est réutilisé

### Requirement: Deterministic verification distinct from human acceptance

Les invariants automatisables SHALL être couverts par des tests déterministes
sur données synthétiques, sans navigateur réel, sans réseau et sans donnée
personnelle. Les dimensions visuelles, tactiles, clavier, mobile et lecteur
d'écran MUST rester des vérifications humaines distinctes et ne MUST pas être
présentées comme prouvées par la CI.

#### Scenario: Structural checks cover the visual contract

- **WHEN** les tests TS-066 s'exécutent
- **THEN** ils vérifient la parité DOM, les largeurs et media queries
  versionnées, la réutilisation des tokens, les cibles tactiles et l'absence de
  dépendance, route ou stockage nouveaux
- **AND** ils n'ouvrent aucune base réelle et n'appellent aucun service Cloud,
  OTP ou réseau

#### Scenario: Human checks stay separate

- **WHEN** une CI ou une suite jsdom réussit
- **THEN** elle n'est pas présentée comme une validation visuelle, tactile,
  clavier, Chrome Android ou lecteur d'écran réelle
- **AND** ces scénarios restent explicitement à effectuer dans la recette
  manuelle
- **AND** aucun résultat humain non exécuté n'est déclaré `PASS`

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
