# overview-visual-harmonization Specification

## Purpose

Définir la présentation visuelle et responsive de la route Overview afin que la
page « Mes projets » reste lisible, cohérente et fidèle aux références Stitch
approuvées, sans modifier ses comportements, ses données ni sa frontière React.

## Requirements

### Requirement: Overview composition preserved

La route `#/` SHALL conserver les zones et commandes livrées ainsi que leur
ordre de lecture : reprise, synthèse et compteur, suggestion déterministe,
urgences, formulaire de projet, filtre de complétion, filtre de projets,
chargement et cartes projet. Aucune zone, destination ou commande nouvelle MUST
être introduite par la présentation.

#### Scenario: All existing surfaces remain present

- **GIVEN** une lecture métier autorisée achevée avec au moins un projet
- **WHEN** la route `#/` est affichée
- **THEN** la reprise, la synthèse, la suggestion, les urgences, le formulaire,
  les filtres, le chargement et les cartes restent présents
- **AND** leur ordre relatif dans le document reste celui du rendu livré
- **AND** aucune commande ou destination supplémentaire n'est ajoutée

#### Scenario: Navigation remains contractual

- **WHEN** l'en-tête et la navigation sont affichés sur Overview
- **THEN** les quatre destinations et leurs routes restent celles de
  `app-navigation`
- **AND** aucune sidebar, barre inférieure ou destination « Tâches / Focus /
  Chercher » n'est introduite

#### Scenario: Loading and empty states stay unchanged

- **GIVEN** une lecture en attente, un document vide ou un filtre sans résultat
- **WHEN** la route `#/` est affichée
- **THEN** le chargement, l'état vide ou l'état filtré prévu reste seul affiché
- **AND** aucune carte, métrique ou commande factice n'est créée par la mise en
  page

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

### Requirement: DOM parity and accessible presentation

Les éléments HTML, classes, identifiants, libellés, noms accessibles et ordres
de lecture de Overview SHALL rester identiques au rendu livré. Les cibles
interactives MUST conserver au moins 44 × 44 px et le focus visible MUST rester
perceptible sur les commandes concernées.

#### Scenario: Controls keep their markup and names

- **WHEN** les cartes, tâches, formulaires, filtres et zones Overview sont
  rendus
- **THEN** les contrôles conservent leurs classes, identifiants, libellés
  français, noms accessibles et ordre de lecture
- **AND** aucune commande n'est déplacée, remplacée ou dupliquée par la mise en
  page
- **AND** les textes utilisateur restent des nœuds texte

#### Scenario: Focus and touch targets remain usable

- **GIVEN** une navigation clavier ou un contexte tactile
- **WHEN** les commandes Overview sont atteintes ou activées
- **THEN** le focus visible reste perceptible
- **AND** les cibles interactives pertinentes conservent au moins 44 × 44 px
- **AND** aucun piège de focus ni changement arbitraire de l'ordre de tabulation
  n'est introduit

#### Scenario: State information is not colour-only

- **GIVEN** une carte avec progression, urgences, priorité ou tâche terminée
- **WHEN** la présentation est affichée en niveaux de gris ou sans perception
  des couleurs
- **THEN** les libellés, nombres et indices non chromatiques suffisent à
  distinguer les états
- **AND** aucune information n'est portée par la couleur seule

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
