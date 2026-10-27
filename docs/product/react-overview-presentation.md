# Présentation visuelle Overview (TS-066)

**Périmètre :** route `#/` uniquement. TS-066 harmonise la composition, la
hiérarchie et les paliers responsive de la page « Mes fils de travail » avec les
références Stitch approuvées le 27 octobre 2026 : `M01` « Mes projets /
Overview », `DESKTOP-1` « Mes Projets - Vue d'ensemble » et la planche de
composants `M32`. Les commandes, routes, données, écritures et la frontière
React livrées par TS-064 et TS-065 ne changent pas.

## Carte visuelle

L'ordre de lecture et le propriétaire de chaque zone restent identiques :

| Ordre | Zone | Propriétaire |
| --- | --- | --- |
| 1 | Reprise manuelle (`#resume-card`) | contrôleur vanilla |
| 2 | En-tête « VUE D'ENSEMBLE », titre `h2` et compteur (`#counter`) | vanilla |
| 3 | Suggestion déterministe (`#focus-suggest`, `#focus-card`) | vanilla |
| 4 | Urgences à traiter (`#overview-urgencies`) | vanilla |
| 5 | Formulaire de projet (`#subject-form`) | vanilla |
| 6 | Filtre de complétion (`#hide-completed`) | vanilla |
| 7 | Filtre de projets (`#overview-urgency-filter`) | vanilla |
| 8 | Chargement (`#projects-loading`) | vanilla |
| 9 | Cartes projet et aperçus de tâches (`#subjects`) | surface React bornée |

Les ajustements portent sur la respiration des blocs, la taille relative du
titre et des métriques, la séparation entre en-tête de carte, commandes et
contenu de lecture, ainsi que l'espacement des notes et des sous-tâches. Aucune
sidebar, barre inférieure, recherche, archive ou destination supplémentaire
n'est introduite.

## Paliers responsive

- **320, 390 et 430 px** : palier de base et règles compactes existantes
  `max-width:620px`. Les en-têtes de carte et les commandes se replient avec
  `flex-wrap`, `min-width:0`, `max-width:100%` et `overflow-wrap:anywhere`.
- **768 px** : palier desktop naissant `min-width:768px` qui augmente la
  respiration verticale, la taille du titre et les paddings de carte sans
  changer l'ordre des zones ni créer de colonne.
- **1280 px** : la largeur reste bornée par `--content-max-width` (`1000px`),
  partagée avec la coque. Aucune largeur fixe supérieure à la zone mobile n'est
  imposée et aucune `overflow-x` n'est ajoutée.

Les paliers sont versionnés dans `site/styles.css` sous la section
`/* TS-066 Overview presentation */`. Le point de rupture compact `620px` reste
documenté dans `site/styles/tokens.css` et écrit littéralement dans les media
queries.

## Composants et tokens réutilisés

- `site/overview/ProjectCard.jsx`, `site/overview/OverviewTaskList.jsx` et
  `site/overview/OverviewCards.jsx` conservent leur propriétaire React, leur
  HTML, leurs classes, leurs identifiants, leurs noms accessibles et l'ordre de
  leurs commandes.
- Les primitives `site/ui/Button.jsx` et `site/ui/PriorityControl.jsx` ainsi que
  `CreateTaskForm`, `TaskItem`, `TaskEditor` et `TaskActionMenu` restent
  inchangées.
- Les règles TS-066 consomment les tokens de `site/styles/tokens.css` :
  `--space-*`, `--radius-*`, `--font-*`, `--line-height-control`,
  `--color-border-subtle`, `--color-text-control`, `--color-text-muted`,
  `--focus-outline`, `--control-target-min` et `--content-max-width`.
- Aucune valeur de token existante ne change, aucun nouveau token, palette,
  police, icône, CDN, ressource distante ou dépendance n'est introduit.

## Focus, scroll et continuité

Les nouvelles règles ne déplacent aucun nœud, ne réordonnent aucune commande et
n'ajoutent ni animation, ni transition, ni défilement programmé. Le focus
visible reste celui de `:focus-visible` et est étendu aux commandes Overview
concernées. Les cibles interactives pertinentes conservent au moins 44 × 44 px.

Une mise à jour de même vue et de même identité met à jour la surface en place :
le brouillon d'éditeur, le parent développé, le filtre et l'ancrage de scroll
restent continus. Un changement de route, un rechargement, un import/restauration
réussi ou un changement d'identité autorisée libère le contexte transitoire
selon `ux-interaction-continuity`. Aucune préférence de thème ou de présentation
n'est persistée.

## Retour arrière

Le changement est CSS-only. Le retour arrière consiste à retirer la section
`/* TS-066 Overview presentation */ ... /* End TS-066 */` de `site/styles.css`,
puis à retirer les tests `tests/ts-066-overview-*.test.mjs` et cette fiche. Le
reste de la feuille, les composants React, les tokens, les routes, les données,
la persistance IndexedDB/Dexie Cloud et les exports/imports ne sont pas affectés.

## Preuves structurelles et recette humaine

Les commandes de test sont :

```sh
node --test tests/ts-066-overview-*.test.mjs
npm run check
npm run build
npm run verify:build
```

Les tests Node et jsdom prouvent la parité DOM, les media queries versionnées,
la réutilisation des tokens, les cibles structurelles et l'absence de route,
stockage, dépendance ou effet de bord nouveaux. Ils ne prouvent pas le rendu
visuel réel, le toucher, le clavier physique, le lecteur d'écran, Chrome Android
ni un débordement mesuré dans un navigateur.

La recette desktop, Chrome Android, clavier, tactile et lecteur d'écran reste
dans `Manual acceptance` du changement, **non cochée par `apply`** et non
remplacée par une CI verte. Tant qu'elle n'est pas réellement effectuée, elle
reste `NOT_RUN` et ne doit pas être présentée comme `PASS`.

## Limites

- Aucun changement de règle métier, de route, de compteur, de priorité, de
  relation, de persistance, de préférence ou de format d'export/import.
- `M32` reste une planche de repère visuel non certifiée pour
  l'accessibilité ; les états non observés restent à vérifier manuellement.
- Les écrans `M03`, `M04` et `M05` ne sont pas des références Overview et ne
  sont pas modifiés par TS-066.
- Les tests automatisés ne constituent pas une recette physique et ne
  remplacent aucune attestation humaine.
