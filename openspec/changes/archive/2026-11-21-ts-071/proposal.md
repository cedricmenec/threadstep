# Proposal

## Why

Les cartes Overview livrées après TS-068 ne correspondent plus aux références desktop et mobile approuvées pour TS-071 : elles affichent des métadonnées fictives, des commandes désactivées et une composition trop dense sur petit écran. La nouvelle présentation doit rester fidèle aux données, interactions, règles d’aperçu et frontières déjà livrées.

## What Changes

- Recomposer l’en-tête, les métriques, les lignes de tâches, les sous-tâches, le pied et l’état de projet vide des cartes Overview.
- Retirer de ces cartes les métadonnées sans source réelle et les commandes Partager/Archiver désactivées.
- Regrouper les commandes projet existantes dans une action accessible et garder l’ouverture et la création de tâche dans le pied de carte.
- Garder les commandes de déplacement de tâches disponibles au clavier et au toucher sur mobile lorsque le glisser-déposer n’est pas adapté.
- Étendre les tests de rendu, de responsive, d’interactions, d’aperçu et de continuité ; ne changer ni données, ni compteurs, ni persistance, ni routes, ni dépendances.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `overview-visual-harmonization` : remplacer les contraintes visuelles TS-068 propres aux cartes par la composition approuvée TS-071 et ses règles d’accessibilité.
- `react-overview-cards` : spécifier les états et actions de carte réorganisés, sans changer les règles canoniques d’aperçu ni de compteurs.
- `react-overview-interactions` : garantir une alternative accessible au réordonnancement sur les largeurs tactiles.

## Impact

Composants Overview React et leurs styles locaux, tests Node/jsdom, documentation produit Overview et spécifications canoniques correspondantes. Aucun changement d’API, de données, de stockage, de route, de dépendance ou de service externe.
