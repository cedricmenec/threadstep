# Design

## Overview

Garder la surface React bornée qui possède `#subjects`, mais remplacer ses cartes de tâches par des liens/boutons de projet avec titre, total de tâches principales et nombre d’urgences restantes. La carte est une commande d’ouverture unique, avec un nom accessible incluant le projet. L’état réellement vide de la liste garde son texte et l’accès existant à la création de projet.

## Data and behavior

- Réutiliser `totalTaskCount` et `subjectMetrics(...).urgentPending` à partir du snapshot déjà autorisé ; aucun champ ou stockage n’est ajouté.
- Ne pas utiliser `overviewPreview`, les filtres, les aperçus ou les états de tâche dans la surface Overview.
- Déléguer l’ouverture à `openProject(project.id)` et préserver la route et la gestion de focus existantes.
- Conserver le contrôle de création de projet hors du propriétaire React, ainsi que les surfaces de lecture bloquée et de chargement.

## Interaction and continuity

Le contenu de la carte est un seul contrôle de navigation, sans contrôles interactifs imbriqués. Tab/Entrée et le toucher doivent ouvrir le même projet ; son focus visible et son nom accessible sont testables dans le DOM. Un rafraîchissement de même route et identité met à jour les compteurs dans la surface montée et n’annonce pas de changement si les valeurs sont identiques. Une navigation explicite réinitialise le contexte selon `ux-interaction-continuity`.

## Responsive presentation

La liste conserve une colonne lisible à 320, 390 et 430 px et utilise l’espace disponible aux largeurs tablette et desktop. Les titres longs reviennent à la ligne ; aucun contenu de tâche, filtre ou panneau global n’ajoute de densité ou de débordement horizontal.

## Risks

La suppression des aperçus retire l’accès direct à des actions de tâche depuis l’overview. Ces tâches et commandes restent disponibles dans le détail du projet, désormais ouvert depuis la carte. Les tests doivent prouver l’ouverture du bon projet, l’exactitude des compteurs et l’absence d’aperçus/commandes de tâche dans l’overview.
