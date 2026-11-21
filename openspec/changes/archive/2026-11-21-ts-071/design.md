# Design

## Contexte

La vue `#/` monte déjà une surface React bornée sous `#subjects`. `ProjectCard`, `OverviewTaskList` et `TaskItem` possèdent les cartes et tâches ; le contrôleur existant reste propriétaire des mutations. Le rendu doit reprendre les captures TS-071 sans copier leurs contenus de démonstration, l’état compact repliable, ni les métadonnées fictives.

## Décisions de présentation

- Carte claire arrondie avec en-tête à titre et indicateur discret, métriques réelles en libellés courts, zone de tâches puis pied avec « Voir plus », création de tâche et ouverture du projet.
- Aucun compteur nouveau : réutiliser `pendingCount`, `totalTaskCountLabel`, `urgencyLabel` et `progressLabel`, en gardant les distinctions textuelles existantes.
- Regrouper les commandes projet déjà actives (monter, descendre, supprimer) dans un menu natif `<details>/<summary>` par carte. L’ouverture du projet reste également disponible au pied. Le menu utilise les commandes déléguées existantes et n’en crée pas de nouvelles.
- Garder les tâches dans les composants partagés. Sur petit écran ou appareil à pointeur grossier, masquer la poignée de glisser-déposer et garder les commandes Monter/Descendre déjà présentes dans le menu de chaque tâche. Aucune priorité ou parenté ne change ; le contrôleur continue de refuser les déplacements invalides.
- Rendre les sous-tâches avec les connecteurs et l’indentation compacts des tokens/couleurs déjà présents. Maintenir les noms accessibles, textes bruts, focus visible et cibles minimales de 44 px.
- Distinguer une carte sans tâche d’une carte dont l’aperçu est vide parce que le filtre masque les tâches. L’état de chargement ou de lecture incertaine demeure géré hors de la carte.

## Continuité et frontières

Conserver la racine React montée, les clés `project.id`/`item.id`, les états de brouillon/édition, l’ouverture des sous-tâches, le menu et les ancres de scroll sur les mises à jour de même contexte. Le menu projet natif reste dans le même arbre. La navigation, l’isolation d’identité, la lecture bloquante et les mutations restent déléguées au code existant. Le rendu n’écrit aucune donnée.

## Vérification

Ajouter des assertions structurelles et responsive dans les tests Overview : présence des métriques réelles et actions uniques, retrait des champs sans source, état vide contre filtré, cibles/focus, poignée cachée au tactile avec commandes de déplacement toujours rendues, longueurs de texte, et maintien des règles 0/1/5/6 et du rendu en place. La recette réelle aux largeurs et sur clavier/tactile/lecteur d’écran demeure manuelle.

## Questions ouvertes

Aucune. La fiche approuve les deux captures et précise les variantes exclues ainsi que l’alternative de réordonnancement.
