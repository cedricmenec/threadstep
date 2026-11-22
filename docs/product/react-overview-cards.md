# Cartes de projet Overview — surface React bornée

La route `#/` rend dans `#subjects` une liste de cartes projet, chacune
exposant le titre, le nombre total de tâches principales et le nombre
d’urgences restantes. L’activation de la carte ouvre le détail du projet.
`#subjects` garde un seul propriétaire React actif à la fois : la surface
Overview ou celle du détail.

## Propriété et montage

`site/overview/overview-adapter.js` produit un instantané détaché et gelé des
projets dans l’ordre du document. Il calcule le total via `totalTaskCount` et
les urgences via `subjectMetrics` sans ouvrir ou modifier Dexie, IndexedDB,
`localStorage`, le réseau ou l’OTP. Les données restent transmises aux
composants existants ; les styles retirent les lignes de tâche de l’affichage.

`OverviewSurface.jsx`, `OverviewCards.jsx` et `ProjectCard.jsx` possèdent
uniquement le rendu des cartes dans `#subjects`. Le contenu visible de chaque
carte est son nom, ses deux compteurs et la commande d’ouverture accessible,
qui délègue `openProject(project.id)`. Les lignes de tâches, formulaires et
actions secondaires restent dans le DOM React existant mais sont masqués pour
la présentation Overview. La commande existante `openSubject` conserve la
route, l’historique et le transfert du focus vers le détail.
`site/overview/surface-decision.js` garde la décision de montage séparée pour
les états de route, d’accès métier, de lecture et de présentation.

Le formulaire de création de projet, les états de chargement et les zones de
sécurité/lecture restent dans leur conteneur vanilla. Aucun panneau global de
résumé, de suggestion, de reprise, d’urgences ou de filtrage n’est affiché.

## Métriques et continuité

Le total compte les tâches principales, y compris terminées, et exclut les
sous-tâches. Les urgences comptent tous les éléments urgents non terminés,
sous-tâches comprises. Les valeurs se recalculent depuis le document autorisé
à chaque mise à jour et n’ajoutent aucune préférence, propriété ou écriture.

Un rafraîchissement de même identité actualise la surface montée et garde les
cartes dans le même ordre. Une navigation ou un changement d’identité libère la
surface avant d’afficher le détail ou le contexte suivant. Une lecture en
attente ou bloquée ne devient jamais une liste vide fictive.

## Diagnostic et tests

Vérifier `reactBoundary.owner()`, `reactOverviewRecord` et
`overviewSurfaceContextKey()` pour confirmer le propriétaire de `#subjects`.
Les tests `tests/ts-064-overview-render.test.mjs`,
`tests/ts-064-overview-boundary.test.mjs` et
`tests/ts-073-overview-responsive.test.mjs` vérifient respectivement les
cartes/métriques, la frontière de surface et la structure responsive.

```sh
npm run check
npm run build
npm run verify:build
```

Les tests DOM ne remplacent pas l’inspection humaine au clavier, au toucher,
avec un lecteur d’écran ou sur un navigateur réel.

## Historique de recette

Le rapport [TS-064](react-overview-ts-064-acceptance.md) consigne une
déclaration de recette fonctionnelle antérieure sur desktop et Android. Elle
ne constitue pas une validation manuelle de la présentation simplifiée TS-073.
