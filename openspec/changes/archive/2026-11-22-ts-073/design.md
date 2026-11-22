# Design

## Overview

Garder la surface React bornée qui possède `#subjects` et les commandes existantes du contrôleur. Simplifier la présentation des cartes avec des styles qui masquent les aperçus, les commandes de tâches et les actions projet secondaires ; garder le titre, le total de tâches principales, le nombre d’urgences restantes et la commande d’ouverture accessible. L’état réellement vide de la liste garde son texte et l’accès existant à la création de projet.

## Data and behavior

- Réutiliser `totalTaskCount` et `subjectMetrics(...).urgentPending` à partir du snapshot déjà autorisé ; aucun champ ou stockage n’est ajouté.
- Conserver le calcul canonique de compteurs du `overview-adapter`; les filtres et données de tâche peuvent rester dans l’état interne mais ne sont pas présentés dans l’overview.
- Déléguer l’ouverture à `openProject(project.id)` depuis l’action nommée de la carte et préserver la route et la gestion de focus existantes.
- Conserver le contrôle de création de projet hors du propriétaire React, ainsi que les surfaces de lecture bloquée et de chargement.

## Interaction and continuity

La carte garde la commande d’ouverture nommée, atteignable par Tab/Entrée et toucher ; son focus visible et son nom accessible sont testables dans le DOM. Un rafraîchissement de même route et identité met à jour les compteurs dans la surface montée et n’annonce pas de changement si les valeurs sont identiques. Une navigation explicite réinitialise le contexte selon `ux-interaction-continuity`.

## Responsive presentation

La liste conserve une colonne lisible à 320, 390 et 430 px et utilise l’espace disponible aux largeurs tablette et desktop. Les titres longs reviennent à la ligne ; aucun contenu de tâche, filtre ou panneau global n’ajoute de densité ou de débordement horizontal.

## Risks

La suppression des aperçus retire l’accès direct à des actions de tâche depuis l’overview. Ces tâches et commandes restent disponibles dans le détail du projet, désormais ouvert depuis la carte. Les tests doivent prouver l’ouverture du bon projet, l’exactitude des compteurs et l’absence d’aperçus/commandes de tâche dans l’overview.
