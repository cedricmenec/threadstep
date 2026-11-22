# Présentation simplifiée de l’Overview (TS-073)

**Périmètre :** route `#/` uniquement. Le contenu principal est la liste des
projets : une carte affiche le nom, le total des tâches principales et le nombre
d’urgences non terminées. L’activation de la carte ouvre le détail du projet.
Les tâches et leurs commandes restent dans cette vue de détail.

## Carte projet

La carte entière est activable via sa commande d’ouverture étendue à toute la
surface, avec un nom accessible contenant le nom du projet et ses compteurs.
Le total reprend le calcul canonique des
tâches principales, terminées comprises et sous-tâches exclues. Le nombre
d’urgences reprend les éléments `urgent` non terminés, sous-tâches comprises.
Les compteurs sont du texte réel dérivé du document autorisé.

Aucun aperçu de tâche, progression, liste globale d’urgences, suggestion,
reprise ou filtre n’est affiché sur cette page. La notion de « tâche en cours »
n’a pas de définition fiable dans les données ; aucun libellé approximatif
n’est ajouté. Le formulaire d’ajout de projet et l’état vide restent disponibles.
Le chargement et les états de lecture bloquée restent gérés par les surfaces
existantes et ne sont jamais présentés comme une liste vide.

## Responsive et accessibilité

Les cartes gardent une seule colonne et s’adaptent aux largeurs 320, 390, 430,
768 et 1280 px. Les noms longs reviennent à la ligne sans débordement
horizontal. Chaque carte a un focus visible et s’active au clavier, à la souris
ou au toucher. Les compteurs sont compris sans couleur seule.
Les styles qui masquent les panneaux et les lignes de tâche sont dans
`site/styles.css` et réutilisent les tokens définis dans
`site/styles/tokens.css`.

## Composants et continuité

`site/overview/OverviewSurface.jsx`, `site/overview/OverviewCards.jsx`,
`site/overview/ProjectCard.jsx` et `site/overview/OverviewTaskList.jsx`
restent dans la frontière React qui possède `#subjects`. La surface garde les
composants et commandes existants, mais ne montre que les deux compteurs et la
commande d’ouverture. La carte délègue une commande
`openProject` ; `openSubject`, la route hash et le focus du titre de détail
restent inchangés. La racine ne remonte pas lors d’un rafraîchissement de même
contexte ; elle est démontée lors d’une navigation ou d’un changement
d’identité.

Le formulaire de création de projet reste géré par le contrôleur existant.
Les données, l’ordre, la persistance, les exports/imports et les interactions
du détail ne changent pas.

## Vérifications et recette

Les tests Node/jsdom couvrent le DOM de carte, les compteurs, l’ordre, le
clic délégué, la sécurité des titres, les rafraîchissements et les sélecteurs
responsive. Ils ne prouvent pas le rendu réel, le toucher, le clavier physique,
le lecteur d’écran ni l’absence d’un défilement horizontal mesuré en navigateur.
La recette humaine doit inspecter les largeurs 320/390/430/768/1280 px et
l’ouverture de plusieurs projets.

```sh
npm run check
npm run build
npm run verify:build
```

## Limites

Aucune tâche n’est supprimée et aucun schéma, route, token, stockage, dépendance
ou règle métier n’est ajouté. Le détail projet reste la destination pour
consulter et gérer les tâches.
