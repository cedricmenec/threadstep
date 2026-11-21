# Proposal

## Why

Les cartes projet de la vue d'ensemble et les tâches du détail projet sont déjà rendues par React, mais leur présentation manque de cohérence avec les références Stitch approuvées. TS-068 doit harmoniser les cartes tout en gardant les règles, données et interactions déjà livrées.

## What Changes

- Harmoniser la hiérarchie, les surfaces, les espacements, les libellés et les états des cartes projet et des tâches, sur desktop et mobile.
- Montrer les éléments Stitch des cinq groupes tranchés par le propriétaire comme éléments visuels statiques ou désactivés : recherche/filtres/tri, échéances/calendrier, métadonnées projet, partage/archivage, panneau de prochaine action/progression/activité.
- Ne donner aucun effet à ces éléments : pas de filtrage, tri, calendrier, partage, archivage, modification de données, navigation ou persistance. Ne pas inventer de valeurs projet, dates, activité ou autre contenu métier.
- Préserver les commandes existantes, les compteurs canoniques, la hiérarchie parent/sous-tâche, l'ordre et la continuité du focus, du scroll et des états transitoires.
- Réutiliser les composants et tokens locaux ; ajouter des tests déterministes de parité, d'inertie et de structure responsive.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `overview-visual-harmonization` : autoriser des éléments Stitch statiques/désactivés dans les cartes Overview sans ajouter de commande active ni changer leur composition métier.
- `react-project-detail-pilot` : permettre l'harmonisation visuelle et les représentations Stitch inertes dans le détail, tout en préservant les données, commandes et comportements existants.

## Impact

- Composants concernés : `ProjectCard`, `OverviewTaskList`, `TaskItem` et `ProjectDetail` ; styles locaux et tokens existants.
- Tests : tests React/DOM déterministes et règles structurelles responsive.
- Aucun changement de route, modèle de données, API, dépendance, persistance, synchronisation ou configuration.
