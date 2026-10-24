# Design

## Context

Voir `proposal.md` — Why, et `specs/react-project-detail-pilot/spec.md` pour les
comportements attendus. Le socle TS-058 est livré : `site/react-boundary.js`
garantit un propriétaire DOM unique, `site/react-adapter.js` expose un instantané
figé et des commandes nommées, et le harnais jsdom compile du JSX local. Le
vanilla de `site/app.js` rend encore tout `#subjects`, y compris le détail.

Le détail projet est une tranche représentative : carte d'en-tête, renommage,
création, hiérarchie parent/sous-tâche, filtre, menu, éditeur, priorité,
suppression/annulation, réordonnancement, promotion, suivi et continuité
focus/scroll. Les règles et identifiants viennent de `site/core.js` ; les
écritures passent par `persist()` et le contrôleur existant. La continuité
focus/scroll est capturée et restaurée par les helpers de `site/app.js`
(`captureUxContinuity`, `finishUxRender`, `restoreUxScroll`).

## Goals / Non-Goals

**Goals :**

- Monter une seule surface React pour `#/sujet/:id` dans le conteneur borné
  `#subjects`, sans coexistence de deux propriétaires DOM.
- Réutiliser les classes, libellés, compteurs, IDs, ordres et règles existants,
  via des composants de présentation réutilisables et `site/core.js`.
- Conserver la continuité focus/scroll/états transitoires et les exceptions de
  navigation, rechargement, import et identité.
- Router chaque intention vers une commande unique du contrôleur, sans seconde
  source de vérité ni écriture de présentation.
- Prouver ces invariants par des tests déterministes sur données synthétiques,
  puis produire un bilan mesuré GO / NO-GO.

**Non-Goals :**

- Migrer Overview ou une autre route, modifier le design, les styles, les
  routes, la persistance, la synchronisation ou le format JSON.
- Extraire ou réécrire `site/app.js`, `site/core.js`, Dexie, l'OTP, la
  sauvegarde, l'import/fusion ou la restauration.
- Ajouter un routeur React, Redux, un state manager, un second store, un
  lazy-loading réseau ou un portail hors du sous-arbre.
- Rendre React responsable des mutations métier ou de la validation finale.

## Decisions

### 1. Racine unique montée dans `#subjects`, démontée avant tout vanilla

La surface React est montée directement dans `subjectsEl` (`#subjects`) quand la
route est `subject`, que `businessAllowed()` est vrai, que le document est
chargé, qu'aucun chargement bloquant n'est actif et que le projet existe. Ce choix réutilise le garde-fou
`canWriteVanilla(subjectsEl)` déjà branché sur tous les remplacements vanilla et
évite qu'un conteneur enfant soit détruit par `replaceChildren` du parent.

- Clé de frontière : `reactBoundaryKey({ view, subjectId, identity })`, déjà
  calculée par `reactSurfaceContextKey()`.
- `mount` est réutilisé pour la même clé ; un changement de route, de projet ou
  d'identité invalide l'ancienne racine via `reconcileReactSurface()` /
  `applyExpandedIdentityBoundary()`.
- Le retour à Overview, Paramètres ou Synchronisation invalide la racine avant
  que le vanilla ne remplace ou ne vide `#subjects`.
- Une route invalide ou un projet absent affiche le repli vanilla existant :
  aucun projet n'est inventé et aucune surface React métier n'est montée.
- Aucune surface React n'est montée pour Overview, Paramètres, Imports / Exports
  ou Synchronisation.

*Alternative écartée :* un conteneur enfant dédié aurait obligé à modifier tous
les garde-fous vanilla du parent et aurait laissé une fenêtre où le parent
détruit le sous-arbre React. Un portail dans `body` aurait cassé la frontière de
focus et de scroll.

### 2. Composants de présentation sous `site/project-detail/`

Découpage prévu, noms ajustables sans changer le contrat :

- `site/project-detail/ProjectDetail.jsx` : en-tête, retour, renommage, zone de
  tâches et formulaire de création.
- `TaskList.jsx` : tâches de premier niveau triées par priorité, état vide.
- `TaskItem.jsx` : ligne parente, note, actions, éditeur inline, sous-tâches.
- `SubtaskList.jsx` : liste enfant d'un parent, réutilisable par Overview plus
  tard sans l'activer ici.
- `TaskActionMenu.jsx` : bouton « ⋮ », panneau, commandes et états désactivés.
- `TaskEditor.jsx` : formulaire inline titre/priorité/note, erreurs et focus.
- `ProjectDetailSurface.jsx` : racine React, abonnement à l'adaptateur et
  montage/démontage exposé au contrôleur.
- `surface-decision.js` : fonction pure testable décidant si la route et le
  contexte autorisent la surface React.

Les composants importent uniquement React, `site/core.js` et des utilitaires
purs. Ils n'importent ni Dexie, ni l'OTP, ni `site/app.js`, ni `persistence.js`.
Les titres et notes sont rendus par `{value}` (nœuds texte). Les classes
existantes (`subject detail`, `detail-head`, `task`, `task-row`, `task-check`,
`priority-control`, `task-menu-*`, `task-edit-*`, `tasks children`, etc.) sont
conservées pour que CSS, tests et recettes restent comparables.

*Alternative écartée :* un unique gros composant aurait limité la
réutilisabilité demandée ; des composants génériques avec un design system
auraient dépassé le pilote.

### 3. L'état transitoire reste porté par le contrôleur ; React ne garde que les brouillons de saisie

Pour maximiser la parité avec le vanilla et réutiliser les réinitialisations
existantes, le contrôleur reste propriétaire de :

- `expandedParents` (ouverture/repli, reset sur entrée de vue et identité) ;
- `openMenuId`, `editingItemId`, `renamingSubject` ;
- `hideCompleted`, `resumeRef`, `pendingRemoval`, `revealItemId` ;
- intentions de focus (`focusItemId`, `pendingCollapseFocus`,
  `pendingPriorityFocus`, `pendingMenuFocus`, `pendingMoveFocus`,
  `pendingTaskCreationFocus`, `focusDetailHeading`, `focusOpenSubjectId`) ;
- `dragState`.

Ces valeurs sont exposées dans `snapshot.transient` par `getTransientState()`.
Les commandes `toggleSubsteps`, `openItemMenu`, `closeItemMenu`, `beginEdit`,
`cancelEdit`, `trackItem` mettent à jour le contrôleur puis appellent le rendu
existant. Les intents de focus sont appliqués par `applyFocus()` après le commit
React, comme après un rendu vanilla.

Seul le contenu non enregistré des champs (`TaskEditor`, formulaire de
renommage, formulaire de création) est un état local React. Le composant est
identifié par l'ID stable de la tâche ou du projet : un re-rendu ou un
rafraîchissement autorisé conserve donc le brouillon, alors qu'un démontage
(navigation, reload, identité) le supprime. Aucun effet de montage n'écrit.

*Alternative écartée :* déplacer tout l'état dans React aurait dupliqué les
règles de reset de `substep-collapse` et les intentions de focus, avec un risque
élevé de divergence entre Overview et détail.

### 4. Adaptateur enrichi, commandes explicites, aucune règle métier dupliquée

`site/react-adapter.js` conserve les commandes TS-058 et leurs signatures. Il
les complète pour le détail :

- `createItem(subjectId, title, priority)` (existant) ;
- `createSubstep(subjectId, parentId, title)` ;
- `updateItem(subjectId, itemId, { title, priority, note })` (existant) ;
- `setPriority(subjectId, itemId, priority)` ;
- `toggleItem(subjectId, itemId, done)` (existant) ;
- `removeItem(subjectId, itemId)` (existant) ;
- `undoRemoval()` ;
- `reorderItem(subjectId, itemId, targetId, position)` (existant) ;
- `moveItem(subjectId, itemId, direction)` ;
- `promoteItem(subjectId, itemId)` (existant) ;
- `toggleSubsteps(subjectId, parentId)`, `openItemMenu(itemId)`,
  `closeItemMenu(restoreFocus?)` (existantes) ;
- `beginEdit(subjectId, itemId)`, `cancelEdit(subjectId, itemId)` ;
- `trackItem(subjectId, itemId)` (existant) ;
- `renameSubject(subjectId, title)` (existant) ;
- `returnToOverview(subjectId)` (existant) ;
- `startDrag(subjectId, itemId, nativeEvent, handle)`, `cancelDrag(nativeEvent)`.

L'instantané ajoute au sous-objet `transient` les champs nécessaires
(`expandedParents`, `openMenuId`, `editingItemId`, `renamingSubject`,
`hideCompleted`, `trackedItemId`, `revealItemId`). Il reste détaché, figé et
dérivé de `site/core.js`.

Un module pur `site/project-detail/controller-commands.js` fabrique les handlers
à partir de dépendances injectées (`getDocument`, `setDocument`, `persist`,
`navigate`, focus/intents) et de `site/core.js`. `site/app.js` l'instancie une
seule fois et le branche à l'adaptateur. Il valide avec les mêmes règles et
constantes que le vanilla (titre 1–300 après trim, note ≤ 2000, nom de projet
1–100, limites de 500 étapes et 40 projets, priorité parmi `PRIORITIES`) puis
appelle `site/core.js` et `persist()` au plus une fois. Ce module n'est ni un
store ni une seconde source de vérité : il ne conserve aucun document propre.
React ne fait aucun calcul de règle métier : il transmet les valeurs et affiche
le résultat/erreur renvoyé.
Les commandes sans validation (priorité, complétion, réordonnancement,
promotion, suivi, menu) réutilisent les fonctions existantes.

*Alternative écartée :* laisser React importer `updateItem` et muter le document
aurait créé une seconde voie d'écriture. Mettre les validations dans l'adaptateur
aurait dupliqué les règles du contrôleur.

### 5. Rendu synchrone, capture/restauration focus-scroll existante

Le contrôleur pilote les mises à jour :

1. capturer l'instantané UX courant (`captureUxContinuity`) hors navigation
   explicite ;
2. mettre à jour `documentState` puis appeler `adapter.refresh()` à l'intérieur
   de `flushSync(() => ...)` de `react-dom` ;
3. après le commit, appeler `finishUxRender(snapshot, explicitFocus)` puis
   `applyFocus()`.

`flushSync` évite une phase asynchrone où le focus/scroll serait restauré avant
le nouveau DOM et rend les tests déterministes. Les listes utilisent des `key`
stables (`item.id`) : les nœuds DOM sont réutilisés lors des mises à jour et des
déplacements, ce qui préserve le focus et la géométrie. Les ancres de lecture
restent les sélecteurs existants `.task-form` / `.task`; aucune hauteur
artificielle n'est laissée après le rendu. Une réduction réelle due au filtre ou
à une suppression reste permise et bornée par le navigateur.

*Alternative écartée :* `root.render()` asynchrone aurait rendu le moment de
restauration non déterministe et aurait risqué un saut de scroll sur Android.

### 6. Rafraîchissements, invalidations et absence d'écriture

- Une modification locale appelle `persist()` → `render()` → `adapter.refresh()`
  avec la même identité : pas de remontage, états conservés.
- `load()` (inter-onglets, Dexie) garde son comportement : il ferme le menu
  (`openMenuId = null`), conserve les parents développés et rafraîchit
  l'instantané sans remonter la racine.
- Un changement de route/projet invalide la racine ; un changement d'identité
  ou un blocage de liaison passe par `applyExpandedIdentityBoundary()` /
  `clearBusinessForBindingBlock()` et masque les données.
- L'adaptateur ne fait que lire et notifier. Aucun `useEffect` de la surface
  n'appelle une commande ; les effets ne font qu'abonner/désabonner et mettre à
  jour l'état React local.
- Les commandes d'écriture passent par le contrôleur ; chaque activation produit
  exactement un callback. Les tests espionnent Dexie/IndexedDB, `fetch`,
  WebSocket et les callbacks.

*Alternative écartée :* un abonnement direct de React à Dexie ou un store React
aurait dupliqué le cycle de vie et les frontières de confiance.

### 7. Drag/tactile réutilise le contrôleur existant

Le handle reste un `button.task-handle` avec `aria-label` et
`aria-describedby="reorder-note"`. `onPointerDown` transmet l'événement natif et
le nœud au contrôleur, qui réutilise `startDrag`, `onDragMove`, `onDragEnd`,
`cancelDrag`, les classes `.dragging`, `.drop-before/.drop-after` et les
restrictions `canReorderWithinPriority`. Les listeners `pointermove/up/cancel`
restent au niveau `window`. Le réordonnancement clavier par menu reste
disponible ; le drag n'est jamais la seule voie.

### 8. Tests déterministes et intégration de build

- `tests/helpers/ts-059-project-detail-harness.mjs` compile les composants de
  production avec les options JSX de `vite.config.mjs`, monte la surface dans
  jsdom et fournit des documents synthétiques, des handlers espions et des
  utilitaires d'acte/événements.
- Tests de rendu : header, compteurs, ordre, hiérarchie, filtre, notes, état
  vide, classes, markup inerte, IDs stables.
- Tests d'interaction : création parent/sous-tâche, limites, éditeur
  (préremplissage/save/cancel/erreurs), complétion, priorité, remove/undo,
  menu (commandes, disabled, un seul ouvert, Escape, outside), promotion,
  réordonnancement, suivi, retour, un callback par action.
- Tests de continuité : brouillon et expansion après refresh, menu fermé sur
  navigation, focus après save/cancel/déplacement/retrait, suppression d'ancre,
  liste longue/clamp, route/identité/projet disparu, aucune écriture réseau.
- Tests d'intégration : décision de route pure (subject vs autres), `app.js`
  n'importe la surface que pour le détail, un seul `createRoot`, garde-fous
  vanilla, build de production contenant le runtime React, CSP inchangée.
- Tests de documentation : rapport et guides présents, sections de mesure et
  décision GO/NO-GO, séparation preuves/recette humaine.

Les tests jsdom ne prouvent ni le rendu visuel réel, ni le focus navigateur, ni
le tactile, ni le lecteur d'écran : ces points restent en recette manuelle.

### 9. Bilan mesuré et décision explicite

Un rapport versionné `docs/product/react-project-detail-pilot.md` consigne :

- tailles `dist/assets` avant/après et écart (octets et %) ;
- volume de code : lignes de `site/app.js`, des composants, des tests, et
  éventuel code vanilla conservé pour Overview ;
- complexité : nombre de handlers/effets et duplication restante, qualitative
  et vérifiable par inspection ;
- couverture des tests ciblés (`node --test --experimental-test-coverage`) ;
- interactions couvertes et risques d'intégration ;
- décision **GO** ou **NO-GO**, datée, avec commandes de mesure.

La mesure « avant » est prise au début de `apply`, avant toute édition du code.
Le rapport ne planifie ni n'autorise aucune migration supplémentaire.

### 10. Retour arrière

Retirer l'import et la branche React de `site/app.js` (ou revenir au commit
précédent), laisser les modules inutilisés dormants ou les supprimer, puis
reconstruire et republier par la CI normale. Aucune donnée, préférence, route,
clé de stockage, base IndexedDB ou configuration Cloud n'est affectée.

## Risks / Trade-offs

- **Le vanilla vide `#subjects` pendant une mise à jour React** → garde-fou
  `canWriteVanilla` sur chaque écriture, invalidation avant tout rendu vanilla,
  test de cycles route/refresh et d'écriture vanilla refusée.
- **Perte de focus ou saut de scroll avec React asynchrone** → `flushSync`,
  clés stables, capture/restauration existante, intents de focus du contrôleur,
  tests de liste longue et de suppression d'ancre.
- **Divergence des règles/validations entre React et Overview** → commandes
  contrôleur uniques, `site/core.js` comme source, tests comparant les résultats
  et les limites, aucune validation métier dans React.
- **Double callback ou double écriture** → un seul handler par commande, espions
  de callbacks et d'écritures, aucun `useEffect` déclencheur.
- **État transitoire réinitialisé à tort lors d'un refresh** → état porté par le
  contrôleur (reset uniquement sur entrée de vue/identité), brouillons React
  conservés par clé stable ; tests inter-onglets/Dexie simulés.
- **Fuite de données d'un contexte précédent** → invalidation générationnelle
  existing + clé d'identité, tests de route/compte/cache bloqué.
- **Régressions Overview ou Paramètres** → import limité, branche conditionnée à
  `route.view === "subject"`, tests des autres routes et non-modification de
  leurs handlers.
- **Poids du bundle React** → mesure avant/après, import statique assumé pour
  éviter une requête de chunk à l'ouverture, décision GO/NO-GO documentée.
- **Le drag React synthétique diffère du tactile réel** → réutilisation des
  listeners natifs et recette manuelle Chrome Android séparée.
- **Le rapport de pilote devient obsolète après fusion** → commandes et date
  consignées, revue post-sync et recette physique restent distinctes.

## Migration Plan

1. Mesurer et archiver les tailles de build et le volume de code avant édition.
2. Ajouter les composants de présentation et leurs tests de rendu, sans les
   brancher en production.
3. Étendre l'adaptateur et les commandes contrôleur, avec tests d'interaction et
   de non-écriture.
4. Brancher la surface dans `site/app.js` pour la seule route détail, avec
   invalidation, capture/restauration et tests d'intégration.
5. Exécuter les suites ciblées, `npm run check`, `npm run build`,
   `npm run verify:build`, `npm run verify:servers`, puis mesurer l'après et
   rédiger le bilan GO / NO-GO.
6. Mettre à jour guides et architecture, puis valider OpenSpec et le contrôle
   de phases.
7. Aucun changement de données, schéma, route, configuration Cloud ou workflow.
   Rollback : section 10.

## Open Questions

Aucune question bloquante pour les specs, l'approche ou le découpage. Les noms
exacts de fichiers/composants peuvent être ajustés, et les valeurs mesurées du
bilan (taille, couverture, décision GO/NO-GO) ne sont volontairement pas
prédéterminées : elles seront produites pendant `apply` sans changer le contrat
observable.
