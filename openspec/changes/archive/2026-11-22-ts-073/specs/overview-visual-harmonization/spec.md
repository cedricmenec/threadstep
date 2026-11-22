## ADDED Requirements

### Requirement: Project list hierarchy and responsive cards

La page Overview SHALL privilégier la liste de cartes projet. Chaque carte présente uniquement le nom du projet et ses compteurs de tâches et d’urgences, sans aperçu de tâches. La liste SHALL rester lisible et sans débordement horizontal à 320, 390, 430, 768 et 1280 px.

#### Scenario: Compact list across viewports

- **GIVEN** une liste de projets et des noms longs
- **WHEN** Overview est affichée à 320, 390, 430, 768 ou 1280 px
- **THEN** les cartes et compteurs restent visibles, lisibles et contenus dans la largeur
- **AND** les noms longs reviennent à la ligne
- **AND** aucun filtre, résumé global ou aperçu de tâche n’est affiché

#### Scenario: Accessible project card

- **WHEN** une carte projet est affichée
- **THEN** elle offre une cible de navigation avec un focus visible et un nom accessible qui identifie le projet
- **AND** ses métriques restent compréhensibles comme texte sans dépendre de la couleur seule

## REMOVED Requirements

### Requirement: Responsive hierarchy across representative widths

**Reason**: La hiérarchie n’inclut plus les synthèses, filtres et aperçus qui sont retirés.
**Migration**: La nouvelle hiérarchie responsive est définie par `Project list hierarchy and responsive cards`.

### Requirement: Card and task-preview visual hierarchy

**Reason**: Les cartes ne présentent plus d’aperçu de tâches, d’indicateur de progression ou de filtre de complétion.
**Migration**: La hiérarchie réduite comprend le titre du projet et les compteurs dans la liste.

### Requirement: Approved Overview card composition

**Reason**: L’en-tête, les tâches, l’ajout de tâche et le pied des cartes TS-071 ne correspondent plus à la liste projet seule.
**Migration**: Chaque carte simplifiée ouvre le détail du projet ; les tâches y conservent leurs commandes.

### Requirement: Responsive task hierarchy and empty state

**Reason**: Aucune ligne de tâche ni sous-tâche n’est affichée dans les cartes.
**Migration**: La lisibilité des noms et compteurs et l’état de liste vide suivent la nouvelle exigence de liste.
