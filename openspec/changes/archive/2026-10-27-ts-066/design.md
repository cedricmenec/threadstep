# Design

## Context

Voir `proposal.md` — Why. L'état de départ est celui livré par TS-064 et
TS-065 :

- `#/` est composé dans `site/index.html` par des zones vanilla (synthèse,
  filtre, reprise, suggestion, urgences, formulaire projet, chargement) et par
  la surface React bornée `#subjects` pour les cartes.
- `site/overview/ProjectCard.jsx`, `OverviewTaskList.jsx` et
  `OverviewCards.jsx` réutilisent déjà `CreateTaskForm`, `TaskItem`, les
  primitives `site/ui/` et les tokens de `site/styles/tokens.css`.
- `site/styles.css` porte les règles Overview actuelles, avec un point de
  rupture compact à `620px`, une largeur de contenu `--content-max-width:
  1000px` et des cibles tactiles de `44px`.
- Les interactions, la propriété DOM, la continuité de focus/scroll et les
  états de lecture sont couverts par TS-064/TS-065 et ne doivent pas changer.
- Les références M01 et `DESKTOP-1` sont approuvées pour la présentation ; la
  navigation latérale, la recherche et les autres commandes desktop de la
  maquette restent exclues du périmètre.

Contrainte structurante : le changement est **visuel et responsive**. Toute
modification du markup React, de l'ordre DOM, des commandes ou des données
serait un changement de comportement non demandé.

## Goals / Non-Goals

**Goals :**

- Clarifier la hiérarchie visuelle de la page Overview (titre, synthèse,
  zones de reprise/suggestion/urgences, cartes, aperçus de tâches) avec les
  tokens et composants existants.
- Rendre les espacements, largeurs, retours à la ligne et densités cohérents
  de 320 à 1280 px sans débordement horizontal ni commande rognée.
- Prouver par des tests déterministes la parité DOM, la réutilisation des
  tokens, le comportement responsive structurel et l'absence de dépendance ou
  d'effet de bord.
- Documenter la cartographie visuelle, les breakpoints, les preuves et les
  limites de la recette humaine.

**Non-Goals :**

- Modifier les composants React, leurs props, leur ordre de rendu ou la
  frontière de propriété DOM.
- Ajouter une sidebar, une navigation inférieure, une recherche, un partage,
  des archives, des statistiques ou toute autre fonctionnalité.
- Changer les valeurs des tokens existants, la palette, l'échelle typographique
  ou ajouter une police, une icône ou une ressource distante.
- Réécrire les états de lecture, les règles métier, les commandes, la
  persistance ou les routes.

## Decisions

### 1. Ajustement CSS-only dans le périmètre Overview

Les changements sont appliqués dans `site/styles.css`, en ciblant les
sélecteurs Overview existants (`.dashboard`, `.section-top`, `.counter`,
`.resume-card`, `.focus-bar`, `.focus-card`, `.overview-urgencies*`,
`.add-subject`, `.filter-toggle`, `.overview-urgency-filter*`, `.subjects`,
`.subject*`, `.task*` lorsqu'ils sont utilisés dans les cartes, `.empty`).
Aucun nouveau composant ni wrapper n'est créé.

Pourquoi : la fiche exige la conservation du HTML, des classes, des
identifiants, des noms accessibles et de l'ordre de lecture. Une approche
CSS-only garantit cette parité et évite toute régression de comportement React
ou vanilla.

Alternatives rejetées : introduire des wrappers de composition (change le DOM
et les tests de parité) ; migrer les zones globales vers React (hors périmètre
et nouvelle frontière) ; ajouter une bibliothèque UI (dépendance et palette
nouvelles).

### 2. Réutilisation stricte des tokens et des primitives existantes

Les règles nouvelles consomment les variables existantes
(`--color-*`, `--space-*`, `--radius-*`, `--focus-outline`,
`--control-target-min`, `--content-max-width`, `--font-size-*`, etc.). Aucune
valeur de token n'est modifiée et aucun nouveau token n'est nécessaire. Les
valeurs littérales préexistantes strictement locales à Overview peuvent être
ramenées vers un token existant à valeur identique, sans changer le rendu
attendu.

Pourquoi : `semantic-design-tokens` exige une source unique et une parité des
valeurs ; `ui-foundation.md` documente déjà la procédure d'adoption
progressive. Les tests vérifieront que les variables utilisées existent et que
leurs valeurs n'ont pas changé.

Alternative rejetée : créer une nouvelle échelle d'espacement ou de couleur
(change la palette et exige une décision produit distincte).

### 3. Deux paliers responsive dans la continuité de l'existant

Le point de rupture compact `max-width:620px` est conservé. Un palier desktop
`min-width:768px` ajuste la respiration verticale, la largeur utile et la
hiérarchie typographique tout en gardant une seule colonne de cartes et la
navigation actuelle. Les largeurs 320, 390 et 430 px utilisent le palier de
base/compact, 768 px le palier desktop naissant, et 1280 px la largeur maximale
`--content-max-width` existante.

Toutes les règles utilisent `min-width:0`, `max-width:100%`, `flex-wrap` et
`overflow-wrap:anywhere` là où un texte long est possible. Aucune largeur fixe
supérieure à la zone mobile n'est introduite et aucune `overflow-x` n'est
ajoutée.

Pourquoi : l'adaptation demandée porte sur la lisibilité et l'espacement, pas
sur une nouvelle structure de navigation. Garder une colonne évite de créer une
disposition desktop non prévue par les specs et préserve le défilement
existant.

Alternatives rejetées : grille multi-colonnes de cartes (change la densité et
le parcours de lecture sans référence approuvée pour ce point) ; sidebar
desktop (explicitement hors périmètre) ; breakpoints supplémentaires non
justifiés.

### 4. Hiérarchie par espacement, taille et couleur, sans réordonner

La hiérarchie est obtenue en ajustant les marges, paddings, tailles de texte,
graisses et couleurs sur les éléments existants. Les paragraphes de métriques
des cartes restent dans leur ordre DOM actuel. Le titre de projet reste un
`h3` ; le titre de page reste `h2` ; les libellés et noms accessibles ne
changent pas.

Pourquoi : une hiérarchie visuelle plus nette ne doit pas modifier la structure
sémantique ni l'ordre de lecture, conformément à `react-overview-cards` et
`task-hierarchy-presentation`.

Alternative rejetée : regrouper les métriques dans un nouveau conteneur ou
changer l'ordre des paragraphes (modifie le DOM et la parité).

### 5. Préservation de la continuité et des états

Le changement n'ajoute ni animation, ni transition, ni défilement programmé.
Les styles de focus existants (`:focus-visible`) sont conservés et étendus aux
éléments Overview qui en ont besoin. Les états `hidden`, `aria-busy`, les
messages de chargement/erreur/vide, les badges de priorité, les lignes
terminées, les urgences et la progression restent perceptibles sans couleur
seule. Le filtre, la reprise, la suggestion et les urgences conservent leurs
mécanismes de réinitialisation ou de continuité.

Pourquoi : `ux-interaction-continuity` exige que la mise en page ne provoque
pas de saut arbitraire et que les contrôles restent utilisables. Un changement
purement CSS ne remonte pas la surface React, ne remonte pas les éditeurs et ne
réinitialise pas les brouillons.

## Risks / Trade-offs

- **Modification CSS affectant une autre route via des sélecteurs partagés** →
  limiter les nouvelles règles aux sélecteurs Overview ; exécuter les suites
  TS-052, TS-063, TS-064, TS-065 et les tests de tokens ; comparer le CSS
  compilé.
- **Régression de parité DOM** → tests de rendu React et assertions statiques
  sur les classes, IDs, noms accessibles et ordre des commandes ; aucun
  changement de JSX.
- **Débordement sur libellés longs ou commandes mobiles** → `flex-wrap`,
  `min-width:0`, `max-width:100%`, `overflow-wrap:anywhere` ; vérification
  structurelle des largeurs puis recette réelle 320/390/430/768/1280.
- **Contraste insuffisant introduit par une nouvelle combinaison** → réutiliser
  uniquement les paires de tokens documentées ; ne pas présenter les exceptions
  existantes comme conformes ; toute correction sensible reste hors de ce
  changement.
- **Confusion entre preuve CI et recette** → consigner les tests structurels
  comme preuves de règles CSS/DOM seulement ; la recette visuelle, tactile,
  clavier et lecteur d'écran reste dans `Manual acceptance` sans case cochée.

## Migration Plan

Aucune migration de données, de route, de préférence ou de configuration Cloud.

1. Capturer un état de référence DOM/classes/tokens des cartes Overview.
2. Appliquer les règles CSS Overview par paliers.
3. Ajouter les tests déterministes de parité, tokens et responsive.
4. Exécuter les suites ciblées, `npm run check`, `npm run build` et
   `npm run verify:build`.
5. Mettre à jour la documentation de présentation et le guide développeur.
6. En cas de régression visuelle, revenir au commit précédent des règles CSS :
   aucun donnée ni stockage n'est affecté.

## Open Questions

Aucune question bloquante. Les états Stitch non observés et les mesures
d'accessibilité restent des vérifications de recette humaine, pas des décisions
de conception à trancher avant implémentation.
