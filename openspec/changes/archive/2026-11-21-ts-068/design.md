# Design

## Context

Voir [proposal.md](proposal.md). `ProjectCard` et `OverviewTaskList` rendent les cartes Overview ; `ProjectDetail` et `TaskItem` rendent l'en-tête, les listes et sous-tâches du détail React. Les indicateurs viennent du modèle métier existant. Le catalogue Stitch décrit deux références desktop et M01/M05 mobile ; les composants utilisent les tokens de `site/styles/tokens.css`.

## Goals / Non-Goals

**Goals:**

- Réutiliser les quatre composants existants pour rapprocher la densité, la hiérarchie, les surfaces et les états de carte des références approuvées.
- Présenter les cinq groupes demandés de façon strictement statique ou désactivée, avec une sémantique explicite et aucune action.
- Garder les mêmes compteurs, tâches, priorités, notes, ordre, filtres existants, commandes, routes, stockage et propriétaires DOM.
- Éviter toute valeur d'exemple : ne rendre que les données déjà fournies ; indiquer sobrement qu'un champ sans donnée réelle n'est pas renseigné.

**Non-Goals:**

- Activer la recherche, des filtres supplémentaires, un nouveau tri, des échéances/calendrier, l'édition de métadonnées, le partage, l'archivage ou un flux d'activité.
- Ajouter un champ au modèle, calculer une nouvelle progression/prochaine action, persister une préférence, créer une route, une dépendance ou une couche UI générale.
- Modifier les valeurs des tokens globaux, le shell de navigation ou la recette visuelle Stitch.

## Decisions

1. **Éléments Stitch sans comportement.** Les actions représentées comme boutons utilisent le mécanisme natif `disabled`; les libellés et emplacements sans commande sont du contenu non interactif. Ils ne reçoivent aucun handler et ne sont jamais reliés à une commande existante. Une commande factice ou active-but-no-op donnerait une fausse affordance ; cette option est rejetée.
2. **Aucune donnée de démonstration.** Les champs absents du modèle n'affichent aucune valeur projet, date ou activité inventée. Ils utilisent une indication neutre telle que « Non renseigné ». Les métriques canoniques déjà disponibles peuvent rester affichées, sans recalcul ni nouvelle sémantique.
3. **Styles locaux et DOM borné.** Ajuster le JSX des cartes et les sélecteurs locaux existants, en réutilisant composants, classes et tokens. Ne pas déplacer la propriété DOM React ni changer les racines de rendu. Ajouter seulement les éléments statiques nécessaires aux références.
4. **Tests déterministes avant sync.** Étendre les tests React/DOM existants pour vérifier parité du contenu et des commandes, éléments inertes, compteurs, et invariants structurels aux largeurs ciblées. La revue visuelle réelle, le clavier et le toucher restent manuels.

## Risks / Trade-offs

- [Risque] Des commandes visibles mais désactivées peuvent sembler disponibles. → Employer l'état natif disabled, un contraste identifiable, un nom clair et aucun événement d'activation ; les champs sans donnée doivent annoncer l'absence de valeur.
- [Risque] Le contenu ajouté densifie les cartes sur téléphone. → Limiter les éléments aux compositions Stitch retenues, vérifier les ruptures CSS aux largeurs 320, 390, 430, 768 et 1280 px et conserver le retour à la ligne.
- [Risque] Une mise à jour JSX peut remplacer un nœud porteur de brouillon ou de focus. → Garder les sous-arbres de commandes existants, les clés et les propriétaires ; tester les mises à jour locales et consigner une vérification clavier/scroll réelle en recette manuelle.
- [Risque] La CI structurelle ne certifie pas le rendu des navigateurs. → Ne pas présenter les assertions DOM comme une recette visuelle ou tactile.

## Migration Plan

Aucune migration. Les changements sont de présentation seulement. Retour arrière par revert de la PR si la recette ou la CI révèle une régression.
