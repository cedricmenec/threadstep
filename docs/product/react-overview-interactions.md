# Interactions de l’Overview et du détail

## Vue Overview

Les cartes Overview sont des contrôles de navigation : l’utilisateur active
une carte au clavier, au pointeur ou au toucher pour ouvrir le détail du projet
correspondant. Chaque carte délègue exactement une commande `openProject` avec
l’identifiant de ce projet. Les contrôles de tâche, menus de projet et actions
de mutation ne sont pas présentés dans ces cartes ; ils restent disponibles
dans le détail.

Un rafraîchissement de même vue et identité met à jour le nom et les compteurs
dans la surface React déjà montée. Le focus reste sur une carte encore
présente ; le rendu ne déclenche pas de persistance. Une navigation explicite
ouvre le détail et transfère le focus au titre selon le contrat courant.

## Détail du projet

La création, l’édition, la complétion, les priorités, les sous-tâches, les
notes, les menus, le glisser-déposer, la suppression et leur annulation restent
disponibles dans la vue de détail via les commandes existantes. Le changement
de projet dans le détail suit le contrat TS-072 déjà livré.

Les formulaires valident leurs données et délèguent les écritures au
contrôleur. Les changements de route, d’identité ou de lecture bloquante
libèrent la surface et ses états transitoires. Les titres de projet restent
rendus comme du texte, jamais comme du HTML.

Cette présentation n’ajoute aucune route, clé de stockage, préférence,
dépendance, requête réseau ou mutation métier ; le détail utilise les routes et
les commandes déjà en place.

## Vérification

Les tests Node/jsdom couvrent la commande de navigation, les métriques
actualisées, la frontière React et l’absence de mutation au rendu. Une CI ne
prouve pas la perception du focus, l’usage tactile ou les annonces d’un
lecteur d’écran ; ces vérifications restent manuelles.

```sh
node --test tests/ts-073-overview-responsive.test.mjs
npm run check
npm run build
npm run verify:build
```
