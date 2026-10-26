# Design

## Context

Voir `proposal.md` — Why. L'état livré est le suivant :

- `site/app.js` possède `render()`, `renderSubject()`, `renderTaskArea()`,
  `renderSeeMore()`, `renderItem()` et les handlers `openSubject`, `move`,
  suppression de projet, complétion, priorité, menu, édition, retrait/Undo et
  drag. `#subjects` reçoit les cartes via `replaceSubjectsInCurrentView()`.
- `site/react-boundary.js` gère un conteneur à propriétaire unique.
  `site/app.js` utilise `reactBoundary` pour `#subjects` en détail et une
  instance séparée `appShellBoundary` pour `#app-shell-root`.
- `site/react-adapter.js`, `site/project-detail/*` et `site/ui/*` fournissent
  déjà une surface React de détail, des commandes déléguées, des primitives
  et des tests jsdom/esbuild. `TaskList`, `TaskItem`, `TaskEditor`,
  `TaskActionMenu` et le formulaire d'ajout de tâche rendent déjà le sous-arbre
  des tâches.
- `site/core.js` fournit `overviewPreview`, `overviewFilteredSubjects`,
  `overviewMetrics`, `subjectMetrics`, `subjectUrgencyLabel`,
  `subjectProgressLabel`, `totalTaskCountLabel` et les helpers de réduction.
- Les états de lecture TS-052 sont calculés par
  `buildOverviewReadPresentation` et rendus hors de la liste : `#dashboard`,
  `#projects-loading`, `#sync-summary`, `#sync-settings-access`.
- Les filtres, la suggestion, la reprise, la zone d'urgences, le formulaire
  `#subject-form` et le compteur global sont hors de `#subjects`.

Contrainte structurante : `#subjects` ne peut avoir qu'un propriétaire React
actif. Overview et détail doivent donc être deux surfaces possibles du même
conteneur, jamais simultanées, tandis que la coque garde son hôte séparé.

## Goals / Non-Goals

**Goals :**

- Rendre la liste des cartes projet d'Overview par React avec une parité DOM,
  textuelle et comportementale stricte.
- Conserver un propriétaire unique de `#subjects` et libérer l'ancienne
  surface avant tout rendu vanilla ou changement de contexte.
- Réutiliser les composants et commandes existants sans recopier les règles
  de `site/core.js`.
- Préserver focus, scroll, parents développés, brouillons et filtre pendant
  les mises à jour de la même vue.
- Prouver les invariants par des tests déterministes et un build vert.

**Non-Goals :**

- Migrer la coque, les filtres, la suggestion, la reprise, les urgences, le
  formulaire de projet, les paramètres ou les formulaires sensibles.
- Modifier les interactions ou les éditeurs au-delà de leur réutilisation à
  l'identique ; TS-065 reste leur lot de qualification distinct.
- Choisir une nouvelle composition visuelle ou une référence Stitch non
  approuvée.
- Introduire un routeur, un store, une préférence persistée, une clé de
  stockage, une dépendance ou une migration de données.

## Decisions

### 1. Une seule frontière de contenu pour `#subjects`

Réutiliser l'instance existante `reactBoundary` pour les deux surfaces de
contenu : détail et cartes Overview. Un enregistrement `reactOverviewRecord`
s'ajoute à `reactProjectDetailRecord` ; au plus un des deux est actif. La clé
Overview inclut la vue `overview`, la chaîne d'identité autorisée et l'état
bloquant. Le changement de filtre, de complétion ou de données ne change pas
la clé et provoque une mise à jour, pas un remontage.

Pourquoi : `#subjects` est déjà borné par `reactBoundary` et
`replaceSubjectsInCurrentView()` vérifie `canWriteVanilla()`. Réutiliser la
même frontière empêche mécaniquement deux propriétaires sur le même
conteneur.

Alternatives rejetées : une troisième instance dédiée à Overview
(créerait deux frontières sur le même conteneur et un risque d'oubli de
libération) ; une frontière globale multi-conteneurs (plus générale mais
inutile et plus risquée pour le détail déjà qualifié).

### 2. Un adaptateur Overview séparé, en lecture seule

Créer `site/overview/overview-adapter.js` sur le modèle de `react-adapter.js` :
il lit `getDocument`, `getRoute`, l'identité autorisée, l'état bloquant et
l'état transitoire, puis produit un instantané détaché et gelé. Il ne lit ni
n'écrit Dexie, `localStorage`, le réseau ou l'OTP. Il expose `getSnapshot`,
`refresh`, `subscribe`, `invalidate` et un objet de commandes déléguées.

L'instantané contient les projets filtrés dans l'ordre enregistré, les
libellés de compteurs dérivés par `core.js`, le mode de filtre et l'état
transitoire pertinent. Aucune règle métier n'est recopiée dans React.

Pourquoi : `react-adapter.js` est spécifique au détail (`route.view ===
"subject"`, commandes de projet détaillées). L'étendre pour Overview
mélangerait deux cycles de vie et risquerait une régression du pilote.

Alternative rejetée : faire lire `documentState` directement aux composants
React ; cela rendrait la surface dépendante du contrôleur global et
difficile à tester sans ouvrir de base.

### 3. Réutiliser les composants de tâches et les commandes existants

Créer `site/overview/OverviewSurface.jsx`, `OverviewCards.jsx`,
`ProjectCard.jsx` et `OverviewTaskList.jsx`. `OverviewTaskList` applique
`overviewPreview(items, hideCompleted)` puis rend chaque entrée avec le
`TaskItem` existant ; les sous-tâches restent gérées par `TaskItem` et ne
consomment pas le quota. `ProjectCard` reprend le markup actuel de
`renderSubject` : `.subject`, `.subject-head`, `.subject-controls`,
`.subject-open`, `.subject-move`, suppression, compteurs, formulaire d'ajout,
liste et « Voir plus ».

Le formulaire d'ajout déjà React de `ProjectDetail.jsx` est extrait, sans
changement de markup ni de validation, dans un module partagé si nécessaire
pour éviter toute duplication. Les commandes d'items (`toggleItem`,
`setPriority`, `updateItem`, `removeItem`, `undoRemoval`, `toggleSubsteps`,
`runMenuCommand`, `createItem`, `startDrag`, `cancelDrag`) restent celles de
`createProjectDetailCommands`. Les commandes de carte (`openProject`,
`seeMore`, `moveProject`, `removeProject`) sont ajoutées au contrôleur
`site/app.js` et réutilisent `openSubject`, `move`, la confirmation de
suppression et `persist` existants.

Pourquoi : la parité de comportement et une seule intention par clic sont
plus sûres en réutilisant le code déjà couvert par TS-059/TS-060.

Alternatives rejetées : recopier les handlers dans React (double règle,
double écriture) ; laisser le formulaire/éditeur au vanilla dans le même
conteneur (viole la propriété exclusive).

### 4. Montage uniquement lorsque les cartes sont réellement disponibles

La surface Overview est montée seulement si la route est `overview`, que
`businessAllowed()` est vrai, que `documentLoaded` est vrai et que la
présentation TS-052 ne supprime pas la liste (`AWAITING_READ`, ou
`actionRequired` sans projets disponibles). Dans les autres cas, la surface
est libérée avant que le vanilla n'écrive dans `#subjects` ; le loader, le
résumé d'attention et le lien de synchronisation restent ceux de TS-052.

Une lecture autorisée terminée avec une liste vide monte la surface et rend
les messages d'état vide existants (`Aucun sujet…` ou message filtré avec
« Tous les projets »), afin de conserver le contrat de `overview-project-read-state`
et le comportement du rendu livré. Aucun zéro ni pourcentage n'est rendu
avant la lecture autorisée.

### 5. Cycle de mise à jour synchrone et continuité

`render()` capture l'état UX avant le rendu, puis :
1. libère la surface de détail si la route quitte le détail ;
2. libère la surface Overview si la route quitte Overview ou si l'état de
   lecture la supprime ;
3. monte ou met à jour la surface Overview dans `#subjects` ;
4. appelle `applyFocus()` puis `finishUxRender(uxSnapshot, …)`.

Les cartes et les tâches utilisent des clés stables (`subject.id`,
`item.id`). Une mise à jour de données, un filtre ou un rafraîchissement
réutilise la même surface ; les composants React conservent donc les
brouillons locaux des éditeurs, et l'adaptateur restitue les parents
développés et l'état de menu depuis le contrôleur. `applyFocus` continue de
retrouver les contrôles par leurs classes et `data-*` existants.
`finishUxRender` conserve l'ancrage de scroll et restaure le focus si le nœud
actif a été détaché. Un changement de route, d'identité, un rechargement ou
un import réussis démontent la surface et réinitialisent les états selon
`ux-interaction-continuity`.

Aucune hauteur artificielle ni boucle de rendu React n'est ajoutée. Les
mutations passent toujours par `persist()` et le cycle de rendu existant.

### 6. Parité graphique et accessibilité par réutilisation

Aucun nouveau wrapper visuel n'est introduit. Les classes, IDs, `data-*`,
libellés, noms accessibles, ordres et contrôles restent ceux de
`renderSubject`/`renderTaskArea`/`renderSeeMore`. Les primitives `Button`,
`PriorityControl` et `TextField` sont utilisées comme dans le détail. Les
titres et notes restent des nœuds texte. Les règles CSS existantes
(`.subjects`, `.subject`, `.subject-open`, `.overview-see-more`) continuent de
fournir la grille, les cibles de 44 px et le responsive. Aucun CSS nouveau
n'est requis, sauf une règle strictement nécessaire à l'hôte React ; elle
réutilise les tokens TS-061.

### 7. Tests déterministes et documentation

Nouveau harnais `tests/helpers/ts-064-overview-harness.mjs` compilant la
surface avec esbuild et la montant dans jsdom, sur le modèle TS-063/TS-059.
Fichiers prévus :

- `tests/ts-064-overview-render.test.mjs` : markup, parité, compteurs,
  aperçu 0/1/5/6, sous-tâches, « Voir plus », états vides, texte littéral ;
- `tests/ts-064-overview-commands.test.mjs` : une intention, une commande,
  ouverture du détail/hash, déplacement, suppression, complétion, priorité,
  menu, édition, aucune commande au montage ;
- `tests/ts-064-overview-boundary.test.mjs` : Overview/détail exclusifs,
  coque séparée, cycles répétés, lecture bloquée, identité, projet disparu ;
- `tests/ts-064-overview-continuity.test.mjs` : focus, scroll, parents
  développés, brouillons et filtre lors des mises à jour et rafraîchissements ;
- `tests/ts-064-overview-side-effects.test.mjs` : imports interdits, aucune
  écriture/requête/OTP/migration au montage, pas de nouvelle clé ;
- `tests/ts-064-overview-responsive-docs.test.mjs` : garde-fous CSS,
  largeurs, cibles, documentation, CSP, routes et dépendances.

Les tests existants qui inspectent `renderSubject`/`renderTaskArea` dans
`site/app.js` sont adaptés pour inspecter les nouveaux modules ou le harnais,
sans affaiblir leurs assertions de comportement.

Les limites restent explicites : ces tests ne prouvent ni le rendu visuel, ni
le toucher réel, ni le focus perçu, ni le lecteur d'écran. La recette
desktop/Chrome Android reste dans `Manual acceptance`.

### 8. Retour arrière

Le changement ne crée ni donnée, ni migration, ni route, ni clé. Le retour
arrière est un revert de code : retirer l'import et le montage de la surface
Overview, restaurer le rendu de cartes du contrôleur, puis supprimer
`site/overview/` s'il n'est plus consommé. La coque, le détail React, Dexie,
l'OTP, les exports et la configuration Cloud ne sont pas affectés.

## Risks / Trade-offs

- **Double propriétaire de `#subjects`** → une seule instance de frontière,
  un seul enregistrement actif, libération avant tout rendu vanilla, tests de
  cycles et d'invalidation.
- **Perte de brouillon au rafraîchissement** → pas de remontage sur mise à
  jour de même clé, clés stables, test de continuité ; un remontage à
  frontière explicite reste voulu.
- **Focus perdu lors d'un diff React** → `applyFocus` et `finishUxRender`
  conservés, contrôles identiques, tests de focus simulé ; recette clavier
  réelle séparée.
- **Scroll ramené en haut sur liste longue** → mise à jour en place et
  restauration d'ancrage existante ; tests de scroll simulé ; recette
  Android réelle séparée.
- **Régression des compteurs ou de l'aperçu** → projection dérivée de
  `core.js`, tests 0/1/5/6, sous-tâches hors quota, filtre avant limite.
- **Double commande** → commandes injectées une seule fois, pas d'effet au
  montage, tests d'espions et de mutation unique.
- **Surface montée trop tôt** → condition de montage alignée sur TS-052,
  tests des états `AWAITING_READ`/`actionRequired` et absence de métriques.
- **Ambiguïté formulaire/éditeurs** → documentée dans `proposal.md` ; le plan
  réutilise l'existant sans nouvelle fonctionnalité et réserve TS-065.
- **Drag impératif** → comportement existant conservé et testé comme une
  intention déléguée ; toute refonte de drag relève de TS-065.

## Migration Plan

1. Vérifier l'archive TS-063, l'ascendance Git, les primitives TS-061 et
   l'absence de modification des chemins protégés.
2. Capturer le comportement et le markup de référence d'Overview avant
   édition dans `/tmp`.
3. Créer l'adaptateur et la surface Overview sans la monter.
4. Brancher le montage/mise à jour/libération dans `site/app.js`, en
   conservant les états TS-052 et le cycle UX.
5. Ajouter les tests ciblés, adapter les tests d'implémentation devenus
   obsolètes et compléter la documentation.
6. Exécuter les tests ciblés, les non-régressions, `npm run check`,
   `npm run build`, `npm run verify:build`, `openspec validate` et le
   contrôle de phases.
7. Laisser la recette humaine desktop/Chrome Android hors checklist et ne
   jamais la présenter comme exécutée par la CI.

Aucune migration de données n'est nécessaire.

## Open Questions

Aucune question technique bloquante pour le plan. Deux décisions produit
restent explicitement hors implémentation et sont signalées dans
`proposal.md` : le périmètre exact des formulaires/éditeurs déjà React et
l'absence de références Stitch Overview approuvées. Si la première change la
frontière DOM retenue, elle doit être tranchée avant `apply` ou scindée en
un lot distinct.
