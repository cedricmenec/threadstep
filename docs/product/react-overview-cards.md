# Cartes projets Overview — surface React bornée (TS-064)

**Périmètre :** route `#/` uniquement, pour la liste des cartes projet dans
`#subjects`. Les filtres, le compteur global, la suggestion, la reprise, la
zone « Urgences à traiter », le chargement, la synthèse, le formulaire de
projet, les paramètres et les formulaires sensibles restent vanilla.
`automation: manual` : ce document ne planifie ni n'autorise une exécution
payante, une fusion ou une nouvelle migration.

## Carte de propriété DOM

| Zone | Propriétaire | Conteneur |
| --- | --- | --- |
| En-tête et menu de navigation | surface React de coque | `#app-shell-root` |
| Cartes projet Overview | surface React bornée Overview | `#subjects` |
| Détail projet | surface React bornée du détail | `#subjects` |
| Filtres, compteur global, suggestion, reprise, urgences, chargement, formulaire de projet, paramètres | contrôleur vanilla | éléments dédiés hors `#subjects` |

`#subjects` n'a qu'un propriétaire actif à la fois. Overview et détail ne sont
jamais montés simultanément. La coque garde son hôte séparé et ne réécrit
jamais le conteneur de contenu. Toute surface est démontée avant une écriture
vanilla ou un changement de contexte.

## Points de montage

- `site/overview/overview-adapter.js` produit un instantané détaché et gelé des
  projets filtrés, des compteurs dérivés de `site/core.js` et de l'état
  transitoire. Il ne lit ni n'écrit Dexie, IndexedDB, `localStorage`, le réseau
  ou l'OTP.
- `site/overview/surface-decision.js` décide du montage à partir de la route,
  de l'autorisation métier, de la lecture terminée et de la présentation
  TS-052.
- `site/overview/OverviewSurface.jsx`, `OverviewCards.jsx`, `ProjectCard.jsx`
  et `OverviewTaskList.jsx` rendent les cartes avec les primitives
  `site/ui/` et les composants de tâches déjà qualifiés du détail.
- `site/app.js` branche l'instance `createReactBoundary` existante (`reactBoundary`), les commandes de carte
  (`openProject`, `seeMore`, `moveProject`, `removeProject`, `resetFilter`) et
  les commandes d'items existantes. Il conserve `parseRoute`, `hashchange`,
  `navigate`, `openSubject`, `applyFocus` et `finishUxRender`.
- `OverviewTaskList` applique `overviewPreview` après le filtre « Masquer les
  étapes terminées » et avant la limite de cinq parents. Les sous-tâches ne
  consomment aucun emplacement. Au-delà du quota, une seule commande
  « Voir plus » ouvre `#/sujet/<id>` via `openSubject`.

## Frontières route, identité, blocage et lecture

- Quitter `#/` vers un projet, les paramètres ou une route invalide libère la
  surface Overview avant tout rendu vanilla ou montage du détail.
- Revenir vers `#/` libère d'abord la surface du détail ; les cartes sont
  dérivées du document courant.
- Un changement d'identité autorisée, d'espace ou de liaison invalide la
  surface avant toute réécriture. Un événement tardif de l'espace précédent ne
  peut pas réintroduire ses cartes.
- Un état `AWAITING_READ` ou `actionRequired` sans projets disponibles libère la
  surface et conserve le chargement, le résumé d'attention et le lien de
  synchronisation TS-052. Une lecture autorisée vide monte l'état vide existant.
- Un changement de filtre, une complétion ou un rafraîchissement de fond de la
  même vue met à jour la surface en place : pas de remontage, pas de seconde
  commande, pas d'écriture déclenchée par la présentation.

## Cycle de mise à jour

`render()` capture l'état UX avant le rendu, libère la surface dont la route ou
le contexte a changé, met à jour ou monte la surface Overview dans `#subjects`,
puis appelle `applyFocus()` et `finishUxRender()`. Les clés stables
(`subject.id`, `item.id`) et l'absence de remontage conservent les brouillons
d'éditeur, les parents développés, le menu ouvert, le filtre et l'ancrage de
scroll. Une navigation explicite, un rechargement, un import/restauration
réussi ou un changement d'identité réinitialise les états transitoires selon
`ux-interaction-continuity`.

## Diagnostic

1. Vérifier que `#subjects` n'a qu'un propriétaire : `reactBoundary.owner()`.
2. Vérifier la décision de montage avec `decideOverviewSurface` et l'état de
   présentation dans `overviewPresentationSnapshot`.
3. Vérifier `overviewSurfaceContextKey()` (vue, identité, état bloquant) et
   `reactOverviewRecord`.
4. Vérifier que `overview-adapter.js` n'importe ni Dexie, ni l'OTP, ni
   `site/app.js`, ni `persist()`.
5. Pour un compteur ou un aperçu, comparer avec `overviewPreview`,
   `subjectMetrics`, `subjectUrgencyLabel`, `subjectProgressLabel` et
   `totalTaskCountLabel` de `site/core.js`.

## Commandes de test

```sh
node --test tests/ts-064-overview-render.test.mjs \
  tests/ts-064-overview-commands.test.mjs \
  tests/ts-064-overview-boundary.test.mjs \
  tests/ts-064-overview-continuity.test.mjs \
  tests/ts-064-overview-read-state.test.mjs \
  tests/ts-064-overview-side-effects.test.mjs \
  tests/ts-064-overview-responsive.test.mjs \
  tests/ts-064-overview-docs.test.mjs
npm run check
npm run build
npm run verify:build
```

## Retour arrière

Le changement ne crée ni donnée, ni migration, ni route, ni clé de stockage.
Le retour arrière est un revert de code : retirer l'import et le montage de la
surface Overview, restaurer le rendu de cartes du contrôleur, puis supprimer
`site/overview/` s'il n'est plus consommé. La coque, le détail React, Dexie,
l'OTP, les exports et la configuration Cloud ne sont pas affectés.

## Preuves automatisées et recette humaine

Les tests jsdom et Node prouvent le markup, les compteurs, l'aperçu de cinq
parents, les commandes uniques, les frontières de propriété, la continuité
simulée, l'absence d'écriture et les garde-fous statiques. Ils ne prouvent pas
le rendu visuel, le toucher réel, le clavier physique, le focus perçu, le
lecteur d'écran ni une synchronisation Dexie Cloud de test.

La recette desktop et Chrome Android reste dans `Manual acceptance` du
changement, **non cochée par `apply`** et non remplacée par une CI verte.

## Limites

- Aucun changement de règle métier, de route, de stockage, de dépendance, de
  CSP ou de configuration Cloud.
- Les références visuelles Overview non approuvées restent hors périmètre ; la
  composition Stitch appartient à TS-066.
- Les interactions et éditeurs restent ceux déjà livrés ; leur qualification
  appartient à TS-065.
