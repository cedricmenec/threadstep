# Présentation visuelle des cartes Overview (TS-071)

**Périmètre :** route `#/` uniquement. TS-071 actualise les cartes à partir des
composants Stitch desktop `DS-CARD-OVERVIEW-72` et mobile 390 px, approuvés le
21 novembre 2026. Les zones globales et la frontière React livrées par TS-064
et TS-065 restent inchangées ; les cartes adoptent la nouvelle hiérarchie tout
en conservant les commandes, routes et données réelles.

## Carte visuelle

Une carte claire arrondie présente le titre et les métriques réelles en tête,
les tâches hiérarchisées au centre, puis la création et l'ouverture du projet
dans le pied. « Voir plus » reste la navigation vers le détail complet du
projet. Les commandes projet Monter, Descendre et Supprimer restent
disponibles dans une action nommée par projet.

Les métadonnées sans source, dates fictives, Partager et Archiver inactifs
disparaissent des cartes. Une carte réellement vide indique qu'aucune tâche
n'est attribuée. Lorsque le filtre masque les tâches existantes, la carte
affiche un état filtré distinct. Ni l'état de lecture ni le chargement ne sont
dérivés dans la carte ; ils restent gérés par les surfaces globales.

## Paliers responsive

- **320, 390 et 430 px** : palier compact `max-width:620px`. En-têtes,
  métriques, notes et commandes se replient avec `flex-wrap`, `min-width:0`,
  `max-width:100%` et `overflow-wrap:anywhere`. Les sous-tâches sont indentées
  d'environ 20 px ; la poignée de glisser-déposer est masquée sur mobile et
  les commandes Monter/Descendre restent dans le menu d'action des tâches.
- **768 px** : `min-width:768px` augmente l'espacement et les paddings sans
  changer l'ordre des zones ni créer de colonne.
- **1280 px** : la largeur reste bornée par `--content-max-width` (`1000px`),
  partagée avec la coque. Aucune largeur fixe supérieure à la zone mobile
  n'est imposée et aucun `overflow-x` n'est ajouté.

Les styles de cartes sont dans `site/styles.css`, section
`/* TS-071 Overview project cards */`. Les tokens viennent de
`site/styles/tokens.css` ; aucune valeur de token, palette, police, icône,
ressource distante ou dépendance n'est ajoutée.

## Composants et interactions

`site/overview/ProjectCard.jsx`, `site/overview/OverviewTaskList.jsx`,
`site/overview/OverviewCards.jsx`, `TaskItem` et `TaskActionMenu` restent dans
leur frontière React existante. La carte peut
changer sa structure HTML pour exposer la hiérarchie approuvée ; les commandes
métier restent déléguées au contrôleur existant. Le menu projet utilise le
`details/summary` natif et regroupe les seules commandes projet déjà actives.

Les tâches conservent les compteurs, l'ordre et la limite de cinq parents. Les
sous-tâches ne consomment pas de place, les notes restent du texte brut et les
priorités gardent leurs libellés. Sur mobile ou pointeur grossier, les poignées
de glissement sont cachées ; les commandes de déplacement Monter/Descendre
restent accessibles dans le menu de tâche et utilisent les règles actuelles de
priorité et de parenté. Tous les contrôles ont un nom accessible, une cible
d'au moins 44 × 44 px et un focus visible.

## Focus, scroll et continuité

La racine React n'est pas remontée lors des mises à jour de même vue et de même
identité. Les clés `project.id` et `item.id` conservent brouillons, édition,
menu de tâche et sous-tâches ouvertes. Le menu projet reste dans le même arbre
DOM. Les actions sont présentes une seule fois et n'écrivent que par les
commandes existantes. Une navigation, un changement d'identité ou une lecture
bloquante garde ses règles d'isolation et de réinitialisation existantes.

## Retour arrière

Restaurer l'ancien rendu de `ProjectCard.jsx` et retirer la section
`/* TS-071 Overview project cards */ ... /* End TS-071 */` de
`site/styles.css`, les tests TS-071 et cette fiche. Aucun changement de token,
route, données, persistance IndexedDB/Dexie Cloud ou export/import n'est requis.

## Vérifications et recette

```sh
node --test tests/ts-071-overview-*.test.mjs tests/ts-066-overview-visual.test.mjs
npm run check
npm run build
npm run verify:build
```

Les tests Node/jsdom vérifient la structure, les commandes déléguées, les media
queries, les tokens, les cibles structurelles et l'absence d'effet de bord. Ils
ne prouvent pas le rendu visuel réel, le toucher, le clavier physique, le
lecteur d'écran, Chrome Android ni un débordement mesuré dans un navigateur.
La recette humaine consiste à comparer les deux captures sur bureau et téléphone, vérifier 320/390/430/768/
1280 px, le clavier, le toucher, les menus et le lecteur d'écran sur appareils.
Consigner les appareils, navigateurs et résultats réellement observés.

## Limites

Aucun changement de règle métier, de route, de compteur, de priorité, de
relation, de persistance, de préférence ou de format d'export/import. Les
variantes de carte repliable et de filtre par carte, le partage, l'archivage,
les échéances, les métriques nouvelles et l'horodatage de synchronisation
restent hors périmètre. Une CI verte ne vaut pas recette physique.

### Fidélité Stitch des cartes Overview

Les tâches sont présentées en lignes compactes avec leurs commandes, les sous-tâches reliées par des connecteurs et les notes rattachées à leur tâche. La priorité reste un sélecteur natif accessible, présenté comme un badge. Le bouton « Ajouter une tâche » révèle le formulaire existant sans démonter son brouillon. Les compteurs et actions reposent sur les données et commandes réelles. La comparaison visuelle sur appareils et la recette clavier et tactile restent nécessaires.
