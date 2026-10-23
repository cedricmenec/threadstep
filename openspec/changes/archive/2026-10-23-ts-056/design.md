# Design

## Context

Voir `proposal.md` pour la motivation et
`specs/overview-urgency-list/spec.md` pour les comportements attendus.

L'état livré fournit déjà :

- `subjectMetrics(subject)` et `overviewMetrics(document)` dans `site/core.js`
  pour compter les urgences en attente, parents et sous-tâches incluses
  (TS-053) ;
- `render()` dans `site/app.js`, qui ne rend Overview qu'après
  `businessAllowed()` et après la branche TS-052 de suppression d'une lecture en
  attente ou d'une action requise sans projets ;
- `resetExpandedViewState()`, appelé à une véritable entrée de vue, après un
  import/restauration réussi et lors d'un changement d'identité autorisé, mais
  jamais par `load()`, `persist()`, l'Undo ni les rafraîchissements
  Dexie/inter-onglets ;
- `applyExpandedIdentityBoundary()` pour réinitialiser l'état de vue lors d'un
  changement d'espace/compte ;
- `revealAction(subjectId, itemId)`, `focusItemId`, `revealItemId`,
  `expandAncestorForFocus()` et `substepView()` pour révéler une étape, y
  compris lorsque son projet est masqué ou que son parent est replié ;
- `overviewPreview()` et la limite de cinq parents par carte, qu'il ne faut pas
  confondre avec la limite de cinq urgences de la nouvelle synthèse.

La synthèse doit s'insérer dans ce cycle sans créer de donnée, de lecture, de
stockage, d'abonnement ni de règle de suggestion supplémentaire.

## Goals / Non-Goals

**Goals:**

- Centraliser dans `site/core.js` une projection pure et testable des urgences
  en attente, de leur ordre, de leur quota et de leur cible stable.
- Ajouter une section statique compacte sur Overview, rendue à partir de cette
  projection, sans dupliquer les cartes projet.
- Réutiliser l'infrastructure de révélation, de réinitialisation, de focus et de
  défilement existante.
- Garantir qu'aucune ligne d'un ancien espace, aucun faux état vide et aucune
  cible d'un autre projet ne sont affichés pendant une lecture, une bascule
  d'identité ou une réponse tardive.

**Non-Goals:**

- Modifier `nextActionSuggestion()`, `resumeView()`, les compteurs TS-053, les
  filtres de projets, `overviewPreview()` ou les règles de repli.
- Trier par priorité, persister un ordre, ajouter un statut, un index, une
  préférence ou un champ d'export/import.
- Ajouter une lecture Dexie, un listener, un `fetch`, une authentification, une
  barrière d'autorisation ou une entrée d'historique.
- Redessiner les cartes projet ou transformer la synthèse en tableau de bord
  analytique.

## Decisions

### 1. Nouvelle capacité plutôt qu'extension du filtre de projets

La synthèse est une liste d'étapes globales, alors que
`overview-urgency-filter` sélectionne des projets. Mélanger les deux dans la
même capacité ferait dépendre la liste des filtres et brouillerait les règles
d'état vide. Une nouvelle capacité `overview-urgency-list` porte donc uniquement
la projection et le rendu de la synthèse.

*Alternatives écartées :* ajouter les étapes au filtre existant créerait un
second résultat concurrent ; faire de la synthèse un compteur de projets
répéterait TS-054.

### 2. Modèle pur dans `site/core.js`

Ajouter les exports suivants :

- `OVERVIEW_URGENCY_LIMIT = 5` ;
- `isPendingUrgentItem(item)` : prédicat unique
  `item.done === false && item.priority === "urgent"`, réutilisé par
  `countItemMetrics()` pour `urgentPending` afin de conserver une seule
  définition ;
- `overviewUrgencyEntries(document)` : tableau ordonné d'entrées
  `{ subjectId, subjectTitle, itemId, itemTitle, parentId, parentTitle,
  isSubstep }` ;
- `overviewUrgencyView(document, expanded)` : `{ entries, shown, total,
  hiddenCount, hasMore }`, où `shown` vaut les cinq premières entrées ou toutes
  les entrées lorsque `expanded` est vrai ;
- `findOverviewUrgency(document, subjectId, itemId)` : entrée courante ou
  `null`, utilisée pour revalider une cible au moment du clic.

La projection ne copie ni ne trie les objets métier. Elle ne lit que le
document reçu et n'accède ni au DOM, ni au stockage, ni au réseau.

*Alternatives écartées :* calculer dans `app.js` rendrait les cas limites et
l'ordre difficiles à tester ; réutiliser seulement `overviewMetrics()` ne
fournirait pas les titres, parents et IDs nécessaires aux lignes.

### 3. Ordre déterministe et placement des sous-tâches

Pour chaque projet dans l'ordre de `document.subjects`, parcourir les tâches
parentes dans leur ordre enregistré dans `subject.items`. Pour chaque parent,
émettre le parent s'il est urgent en attente, puis ses sous-tâches directes
urgentes dans leur ordre enregistré. Une sous-tâche urgente d'un parent non
urgent ou terminé est donc émise à la position de son parent, sans faire
apparaître le parent. Ce parcours garantit qu'une sous-tâche reste auprès de son
parent et qu'aucun tri par priorité ou par titre n'est introduit.

Ce choix applique l'interprétation signalée dans `proposal.md`. Il ne modifie
pas l'ordre enregistré et ne dépend pas du tri d'affichage urgent → normal →
plus tard utilisé par les cartes.

### 4. Section statique et rendu borné à Overview

`site/index.html` reçoit dans `#dashboard`, après la barre de suggestion et
avant le formulaire d'ajout, une section statique :

- `section#overview-urgencies` avec un titre « Urgences à traiter » ;
- un message « Aucune urgence en attente » ;
- une liste `ul#overview-urgencies-list` ;
- un compteur d'excédent ;
- un bouton « Voir toutes les urgences » / « Réduire ».

La section est masquée par défaut et n'est jamais rendue dans les routes de
détail ou de paramètres. `renderUrgencyList()` est appelée depuis la branche
Overview de `render()`, uniquement après les gardes d'autorisation et TS-052.
Elle met à jour le texte et les attributs seulement lorsque la valeur change,
pour éviter les annonces et écritures DOM inutiles. Les cartes projet ne sont
jamais réutilisées comme lignes de la synthèse.

*Alternatives écartées :* générer la section entière à chaque rendu multiplierait
les nœuds et les annonces ; la placer dans `#subjects` la mêlerait aux cartes et
au contrat de défilement existant.

### 5. Limite de cinq et état développé transitoire

`site/app.js` ajoute une variable mémoire `overviewUrgenciesExpanded`,
initialisée à `false`. Le rendu affiche `overviewUrgencyView(documentState,
overviewUrgenciesExpanded)` :

- total 0 → message « Aucune urgence en attente » ;
- total ≤ 5 → toutes les lignes, sans compteur ni commande de développement ;
- total > 5 et réduit → cinq lignes, compteur exact `total - 5`, bouton
  « Voir toutes les urgences » ;
- développé → toutes les lignes, compteur d'excédent masqué, bouton
  « Réduire ».

`resetExpandedViewState()` remet `overviewUrgenciesExpanded` à `false`, ce qui
couvre les vraies entrées de vue, les imports/restaurations réussis et les
changements d'identité. Les mutations, l'Undo, `persist()`, `load()` et les
rafraîchissements Dexie/inter-onglets conservent l'état et recalculent seulement
la projection. Aucun stockage, export, URL ou appel Cloud n'est ajouté.

*Alternatives écartées :* stocker l'état dans `localStorage` créerait une
préférence non demandée ; réinitialiser à chaque mutation ferait perdre le
contexte de lecture.

### 6. Ouverture par IDs stables et révélation sûre

Chaque ligne porte `data-subject` et `data-item`. La commande appelle
`openUrgencyEntry(entry)` qui :

1. revalide la cible avec `findOverviewUrgency(documentState, entry.subjectId,
   entry.itemId)` ; si elle a disparu ou n'est plus une urgence en attente, il
   efface `revealItemId`/`focusItemId` et retourne sans navigation ;
2. appelle `revealAction(subjectId, itemId, { detail: true })`. L'option
   `detail` est nouvelle et optionnelle ; son absence conserve exactement le
   comportement actuel de la suggestion et de la reprise ;
3. en mode `detail`, la route `#/sujet/<id>` est ouverte avec les IDs stables.
   `focusItemId`, `revealItemId` et `expandAncestorForFocus()` révèlent l'étape
   dans le détail, y compris une sous-tâche d'un parent replié ou une étape
   au-delà de l'aperçu de cinq parents ;
4. aucune priorité, complétion, relation, ordre ou préférence n'est modifiée.

Le repli de focus de `applyFocus()` est étendu pour une cible révélée : si
`.task-edit` n'existe pas, le premier contrôle réellement présent
(`.task-check`, puis `.task-menu-button`) reçoit le focus. Cela évite de laisser
le focus sur le bouton détaché après navigation, sans changer la sélection de la
suggestion.

*Alternatives écartées :* révéler seulement dans l'aperçu laisserait une cible
filtre/repliée inaccessible ; viser un élément absent du DOM produirait un focus
perdu ; ajouter un nouvel itinéraire dupliquerait la navigation existante.

### 7. Lecture, identité et réponses tardives

`renderUrgencyList()` n'est exécutée que dans la branche Overview autorisée et
après la suppression TS-052. Aucune entrée n'est mise en cache : la liste est
recalculée à chaque rendu depuis `documentState`, qui n'est remplacé que par une
lecture autorisée. Au changement d'espace/compte, `applyExpandedIdentityBoundary()`
réinitialise l'état de vue ; le rendu suivant ne peut donc montrer que le
document du nouvel espace. Les gardes `stillAuthorized()` existantes empêchent
déjà les lectures tardives de A de remplacer B ; la synthèse n'ajoute ni lecture
ni abonnement qui pourraient contourner ces gardes.

Pendant `AWAITING_READ`, une action requise sans projets, une liaison non
vérifiée ou une lecture locale échouée, la section est masquée et le chargement
ou le diagnostic existant reste seul visible. Aucun message d'absence n'est
affiché avant une lecture achevée.

### 8. Continuité du focus, du défilement et des états locaux

La section est statique et extérieure à `#subjects`. Le bouton de
développement conserve donc son focus pendant le rerendu. Les cartes projet
conservent `expandedParents`, `editingItemId`, `openMenuId`, les brouillons et
les filtres existants ; la synthèse ne les modifie pas.

Lors d'un rerendu de la synthèse, `renderUrgencyList()` capture l'identité
stable de la ligne focalisée (`subjectId` + `itemId`) et la restaure si elle
existe encore. Si la ligne a disparu, le focus rejoint le bouton de
développement ou le titre de la section, jamais un nœud détaché. Le mécanisme
TS-049 de capture/restauration du défilement reste actif pour `#subjects` ; la
variation réelle de hauteur due au développement ou à une urgence traitée est
autorisée. Aucune nouvelle région `aria-live` n'est créée : la liste et le
compteur sont des contenus statiques mis à jour, et les annonces existantes ne
sont pas dupliquées.

### 9. Aucun effet de bord supplémentaire

La projection, le rendu, le développement, la réduction et l'ouverture sont des
opérations de présentation. Elles n'écrivent ni ne lisent Dexie ou
`localStorage`, n'ajoutent pas d'index, de listener, de `fetch`, de opération
d'authentification, de champ d'export/import, de préférence, d'entrée
d'historique ou de règle de suggestion. L'export et l'import conservent leur
forme actuelle.

## Risks / Trade-offs

- **Interprétation de l'ordre des étapes** → supposition explicite dans
  `proposal.md` ; la projection et ses tests isolent ce choix pour qu'un
  ajustement produit ne touche pas le rendu, la navigation ou les données.
- **Révélation sous filtre, repli ou hors aperçu** → ouverture systématique du
  détail via les IDs stables et réutilisation de `expandAncestorForFocus()` ;
  recette manuelle dédiée sur Android et desktop.
- **Focus perdu après navigation ou disparition d'une ligne** → repli
  déterministe sur un contrôle réellement présent et tests DOM/navigation ;
  vérification réelle au clavier en recette manuelle.
- **Anciennes urgences visibles sous un nouvel espace** → aucune mise en cache,
  réinitialisation sur la frontière d'identité et tests A/B avec événement
  tardif ; pas de nouvelle lecture.
- **Annonces dupliquées ou oscillations** → pas de nouvelle région live, mises à
  jour conditionnelles du texte et conservation des surfaces existantes.
- **Tests existants fragiles au nouveau balisage** → mise à jour ciblée des
  extraits de tableau de bord sans relâcher les assertions sur les filtres, la
  lecture, le focus et l'isolation.

## Migration Plan

Aucune migration de données, de schéma, d'export ou d'import. Le déploiement
consiste à livrer la section, la projection pure, la navigation et les tests. Un
retour arrière se limite à retirer ces ajouts : aucune donnée, préférence ou
ordre n'aura été créé par la synthèse.

## Open Questions

Aucune question bloquante pour l'approche, les spécifications ou le découpage.
Les deux variantes de copie signalées dans `proposal.md` (« Ouvrir dans le
projet » / « Voir dans le projet », libellé exact du compteur) peuvent être
confirmées avant la finalisation des libellés sans changer le comportement, les
scénarios ni les tâches.
