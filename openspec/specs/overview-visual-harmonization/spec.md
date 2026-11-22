# overview-visual-harmonization Specification

## Purpose

Définir la présentation visuelle et responsive de la route Overview afin que la
page « Mes projets » privilégie une liste de cartes projet claire et concise,
sans modifier ses comportements, ses données ni sa frontière React.

## Requirements

### Requirement: Project list hierarchy and responsive cards

La page Overview SHALL privilégier une liste de cartes projet. Chaque carte
présente le nom du projet, le nombre de tâches principales et le nombre
d'urgences non terminées, sans aperçu de tâches, filtre ou panneau de synthèse
globale. La liste SHALL rester lisible et sans débordement horizontal à 320,
390, 430, 768 et 1280 px.

#### Scenario: Compact list across viewports

- **GIVEN** une liste de projets et des noms longs
- **WHEN** Overview est affichée à 320, 390, 430, 768 ou 1280 px
- **THEN** les cartes et compteurs restent lisibles et contenus dans la largeur
- **AND** les noms longs reviennent à la ligne
- **AND** aucun filtre, résumé global ou aperçu de tâche n'est présenté

#### Scenario: Accessible project card

- **WHEN** une carte projet est affichée
- **THEN** elle offre une commande d'ouverture avec focus visible et nom
  accessible qui identifie le projet
- **AND** ses métriques restent compréhensibles comme texte sans dépendre de la couleur seule

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

- **WHEN** les tests déterministes de la liste projet s'exécutent
- **THEN** ils vérifient la présence des cartes et compteurs, l'absence visuelle
  des panneaux et tâches, les règles responsive, les tokens et le contrôle
  d'ouverture accessible
- **AND** ils n'ouvrent aucune base réelle et n'appellent aucun service Cloud,
  OTP ou réseau

#### Scenario: Human checks stay separate

- **WHEN** une CI ou une suite jsdom réussit
- **THEN** elle n'est pas présentée comme une validation visuelle, tactile,
  clavier, Chrome Android ou lecteur d'écran réelle
- **AND** ces scénarios restent explicitement à effectuer dans la recette
  manuelle
- **AND** aucun résultat humain non exécuté n'est déclaré `PASS`
