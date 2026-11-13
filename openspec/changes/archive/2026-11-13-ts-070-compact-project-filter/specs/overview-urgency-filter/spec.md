# Spec Delta

## MODIFIED Requirements

### Requirement: Contrôle de filtre accessible et explicite

La vue Overview SHALL proposer un unique contrôle de sélection compact à quatre modes, nommé « Filtrer les projets », placé à proximité de la liste et indépendant du filtre « Masquer les étapes terminées ». L'état initial MUST être « Tous les projets ». Le contrôle MUST rester visible sur une seule ligne aux largeurs mobiles courantes, être utilisable au clavier et au toucher, avoir un focus visible, une cible d'au moins 44 × 44 px et annoncer nativement sa valeur sélectionnée.

#### Scenario: État initial sur tous les projets

- **GIVEN** une lecture métier autorisée achevée et aucun changement de filtre
- **WHEN** la vue Overview est affichée
- **THEN** « Tous les projets » est la valeur sélectionnée
- **AND** tous les projets autorisés restent affichés dans leur ordre d'origine

#### Scenario: Activation sans changement de navigation

- **GIVEN** le filtre est sur « Tous les projets »
- **WHEN** l'utilisateur sélectionne successivement « Projets avec urgences », « Projets à suivre » puis « Projets terminés »
- **THEN** seules les cartes correspondant au mode sélectionné restent visibles
- **AND** la route, l'URL et l'historique navigateur restent inchangés
- **AND** sélectionner « Tous les projets » restaure toutes les cartes

#### Scenario: Modes mutuellement exclusifs

- **GIVEN** le contrôle propose ses quatre modes
- **WHEN** l'utilisateur sélectionne un mode
- **THEN** une seule valeur est sélectionnée à la fois
- **AND** le résultat de la liste correspond uniquement à ce mode

#### Scenario: Utilisation au clavier et au toucher

- **GIVEN** le contrôle est affiché
- **WHEN** il est atteint puis utilisé au clavier ou touché pour sélectionner un mode
- **THEN** l'état demandé devient actif une seule fois
- **AND** le focus reste visible et la cible tactile respecte au moins 44 × 44 px

#### Scenario: Un seul contrôle et aucune annonce dupliquée

- **GIVEN** la vue Overview est rendue
- **WHEN** le contrôle de filtre est présent
- **THEN** chacun des quatre libellés est proposé une seule fois dans le sélecteur
- **AND** la valeur sélectionnée est annoncée nativement, sans nouvelle région `aria-live`

#### Scenario: Affichage compact sur mobile

- **GIVEN** la vue Overview est affichée à une largeur mobile courante
- **WHEN** le contrôle est rendu
- **THEN** le libellé et le sélecteur restent sur une seule ligne sans débordement horizontal
- **AND** sa hauteur est inférieure à celle du groupe de quatre options empilées

#### Scenario: Focus conservé après sélection

- **GIVEN** le contrôle de sélection a le focus dans la vue Overview
- **WHEN** l'utilisateur choisit un mode et que la liste des projets est rerendue
- **THEN** le même contrôle reste présent et conserve le focus ainsi que la valeur choisie
- **AND** le changement de filtre ne déclenche aucune écriture métier ni navigation
