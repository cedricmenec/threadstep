# Proposal

## Why

L’overview affiche actuellement plusieurs synthèses globales, filtres, tâches et commandes qui concurrencent la liste des projets. Une vue limitée à des cartes projet et à quelques compteurs rendra la navigation plus directe, le détail projet restant la destination pour consulter et gérer les tâches.

## What Changes

- Réduire le contenu métier visible à la liste des projets ; masquer la suggestion, la reprise, la liste globale d’urgences, les filtres et les aperçus de tâches sur cette page.
- Afficher par projet le nombre total de tâches principales et le nombre de tâches urgentes non terminées, sous-tâches comprises, selon les calculs existants.
- Conserver une commande d’ouverture accessible dans chaque carte et ouvrir le détail du projet ; conserver la route, l’historique et le traitement du focus existants.
- Garder l’ajout de projet comme action de gestion de la liste et préserver les états de chargement et d’accès requis.
- Ne pas afficher de « tâche en cours » : aucune définition fiable de cette notion n’existe dans les données et la demande la présente comme facultative.
- Préserver données, ordre, règles métier, persistance, import/export et page de détail.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `overview-visual-harmonization` : simplifier la hiérarchie à une liste de cartes projet et ses métriques.
- `react-overview-cards` : supprimer l’aperçu de tâches de l’overview et rendre la carte activable pour ouvrir le détail.
- `overview-project-metrics` : conserver et exposer le total des tâches principales et le compteur d’urgences réelles dans la carte simplifiée.
- `subject-overview-preview` : cesser d’appliquer un aperçu de cinq tâches sur l’overview, puisque les tâches n’y sont plus affichées.

## Impact

La page et ses sections de synthèse dans `site/index.html`, le rendu Overview React et son adaptateur, les styles et les tests concernés. Aucune modification de route, document métier, persistance, dépendance ni vue de détail.

## Non-goals and decisions

- Pas de définition ou de calcul nouveau pour une tâche « en cours ».
- Pas de suppression de tâches ni de modification de leurs commandes dans le détail.
- Les compteurs gardent leurs calculs canoniques : le total porte sur les tâches principales, terminées incluses ; les urgences portent sur les éléments urgents non terminés, sous-tâches comprises.

## UI continuity

L’ouverture d’une carte est une navigation explicite vers la route existante du projet ; le focus rejoint le titre du détail selon le comportement actuel. Les rafraîchissements de même identité conservent la surface et l’ancrage de lecture. Les états de chargement et de lecture incertaine ne sont jamais remplacés par une liste vide.
