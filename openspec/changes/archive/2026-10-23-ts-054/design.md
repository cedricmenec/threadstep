# Design

## Context

Voir `proposal.md` pour la motivation et
`specs/overview-urgency-filter/spec.md` pour les comportements attendus.

L'état livré fournit déjà :

- `subjectMetrics(subject)` et `overviewMetrics(document)` dans `site/core.js`,
  avec `urgentPending` comptant chaque étape `priority: urgent` et
  `done: false`, parent ou sous-tâche (TS-053) ;
- `overviewPreview()`, `visibleItems()` et le filtre « Masquer les étapes
  terminées » dans `renderTaskArea()` ;
- `render()` qui supprime entièrement l'Overview pendant une lecture en
  attente ou une action requise sans projets (TS-052), et
  `applyExpandedIdentityBoundary()` qui réinitialise l'état transitoire lors
  d'un changement d'espace autorisé (TS-050) ;
- `resetExpandedViewState()`, appelé à une véritable entrée de vue, après un
  import/restauration réussi et lors d'un changement d'identité, mais jamais
  par `load()` ni par les rafraîchissements Dexie/inter-onglets ;
- `revealAction()`, qui ouvre déjà la vue de détail quand la cible n'est pas
  dans l'aperçu des cinq parents.

Le filtre urgent doit s'insérer dans ce cycle sans créer d'état métier, de
lecture ou d'abonnement supplémentaire.

## Goals / Non-Goals

**Goals:**

- Centraliser la définition « projet avec urgence en attente » et le filtrage
  ordonné dans des fonctions pures testables sans DOM.
- Ajouter un contrôle natif, stable et accessible, dont l'état ne dépend que
  d'une variable mémoire et ne provoque aucune réinitialisation implicite.
- Réutiliser le rendu, l'aperçu, les compteurs globaux, la suggestion, la
  reprise et la continuité existants.
- Garantir que les états de lecture et d'identité continuent de bloquer tout
  faux résultat vide ou toute carte d'un ancien espace.

**Non-Goals:**

- Trier, persister, synchroniser, exporter ou mettre dans l'URL un filtre.
- Ajouter un statut projet, une recherche, un compteur filtré, une lecture
  Dexie, un abonnement, une préférence ou un champ de schéma.
- Modifier `nextActionSuggestion()`, `resumeView()`, les compteurs TS-053,
  `overviewPreview()` ou les règles de « Masquer les étapes terminées ».
- Redessiner les cartes, changer la limite de cinq parents ou modifier les
  gestes de réorganisation.

## Decisions

### 1. Modèle pur dans `site/core.js`

Ajouter deux constantes exportées `OVERVIEW_FILTER_ALL = "all"` et
`OVERVIEW_FILTER_URGENT = "urgent"`, puis :

- `subjectHasPendingUrgency(subject)` retourne
  `subjectMetrics(subject).urgentPending > 0`. Il réutilise donc exactement la
  définition TS-053, sans redéfinir localement `priority`/`done`.
- `overviewFilteredSubjects(subjects, mode)` retourne, pour le mode urgent, les
  sujets satisfaisant `subjectHasPendingUrgency`, dans leur ordre d'origine,
  sans copie ni tri des objets métier. Tout mode inconnu ou non-urgent retourne
  la liste complète.
- `isSubjectVisibleInOverviewFilter(subject, mode)` expose le même prédicat
  pour la révélation des cibles masquées et pour les tests.

*Alternatives écartées :* un compteur filtré dédié créerait un second état
dérivé à maintenir ; un tri par urgence contredirait la conservation de
l'ordre ; un calcul directement dans `app.js` serait moins testable et
risquerait de diverger de TS-053.

### 2. Contrôle natif statique et état mémoire

`site/index.html` reçoit, près du filtre « Masquer les étapes terminées » et
avant la liste, un `fieldset` avec une légende explicite et deux `input
type="radio"` partageant le même `name`. Les libellés visibles sont exactement
« Tous les projets » et « Projets avec urgences ». Le premier est coché dans le
balisage initial. Le contrôle est statique : il n'est pas recréé à chaque
rendu de la liste.

`site/app.js` ajoute `let overviewUrgencyFilter = OVERVIEW_FILTER_ALL;` et une
fonction `syncOverviewFilterControl()` qui ne réécrit l'état `checked` d'un
bouton que s'il diffère de l'état mémoire. Le handler `change` met à jour la
variable puis appelle `render()` sans toucher au document, à l'URL ou à
l'historique.

*Alternatives écartées :* des boutons avec `aria-pressed` demanderaient de
gérer nous-mêmes l'annonce de l'état ; deux boutons radio natifs offrent un
seul point de tabulation, un nom de groupe et une annonce standard. Ajouter une
région `aria-live` dédiée au filtre risque de faire osciller les annonces lors
des rerendus.

### 3. Rendu filtré et état vide dédié

Dans la branche Overview de `render()`, après les gardes
`businessAllowed()`/TS-052, la liste des cartes est construite à partir de
`overviewFilteredSubjects(documentState.subjects, overviewUrgencyFilter)`.
Chaque sujet est rendu par `renderSubject()` inchangé, donc l'ordre, l'index de
déplacement, l'aperçu de cinq parents et les interactions restent ceux du
document complet.

Les calculs globaux continuent d'utiliser `documentState` : `#counter`,
`renderSuggestion()` et `renderResumeCard()` ne reçoivent jamais la liste
filtrée. Le filtre ne s'applique pas à `renderTaskArea()`.

Si le mode urgent est actif et que la liste filtrée est vide, un bloc dédié
affiche « Aucun projet avec urgence en attente » et un bouton « Tous les
projets ». Ce bouton remet le mode à `all`, resynchronise le contrôle, rend la
vue et laisse le focus sur le bouton radio « Tous les projets » (le contrôle
statique persiste hors de la liste). En mode `all`, le message existant
« Aucun sujet pour le moment » est conservé.

*Alternatives écartées :* masquer les cartes en CSS laisserait des contrôles
focusables hors résultat et ne respecterait pas la limite d'aperçu ; réutiliser
le message d'absence générale confondrait « aucun projet » et « aucun projet
urgent ».

### 4. Durée de vie branchée sur les réinitialisations existantes

`resetExpandedViewState()` devient le point unique de réinitialisation de
l'état de vue transitoire : il remet aussi `overviewUrgencyFilter` à `all` et
resynchronise le contrôle. Cela couvre les appelants déjà validés :

- `hashchange` quand `isViewEntry()` détecte une vraie entrée de vue ;
- la réconciliation/import réussi et l'import local fusionné ;
- `applyExpandedIdentityBoundary()` lors d'un changement d'espace/compte.

`load()`, `refreshLocalDocument()`, `refreshSyncedDocument()`, les événements
inter-onglets, `persist()` et l'Undo ne passent pas par cette fonction : ils
conservent donc le filtre et recalculent depuis le `documentState` courant. Un
rechargement réel réinitialise naturellement la variable mémoire du module.

Le fait de réactiver « Mes projets » alors que la route est déjà `#/` ne passe
pas par `isViewEntry` et reste un simple rerendu, conformément à la sémantique
existante. Ce point est signalé comme convention dans `proposal.md`.

Aucun `localStorage`, export, URL ou appel Cloud n'est ajouté.

### 5. Révélation sûre des cibles masquées

`revealAction()` conserve sa logique actuelle pour un projet visible. Si le
sujet ciblé n'est pas visible sous le filtre courant, la fonction navigue vers
la route de détail existante `#/sujet/<id>` avant de rendre la liste. La vue de
détail n'applique pas le filtre urgent et retrouve l'étape via `focusItemId` et
`expandAncestorForFocus()`.

Cette navigation est une vraie entrée de vue : le filtre sera réinitialisé au
retour, ce qui évite de laisser l'utilisateur devant une liste filtrée où la
cible reste invisible. Aucune priorité, complétion, `resumeRef` ou document
n'est modifié.

*Alternative écartée :* remettre silencieusement le filtre à `all` dans la vue
courante changerait la liste sous le focus sans navigation explicite et
rendrait l'historique moins prévisible.

### 6. Sécurité de lecture et d'identité

Le filtre n'est évalué que dans la branche où `businessAllowed()` est vrai et
où la présentation TS-052 n'est ni `AWAITING_READ` ni une action requise sans
projets. La branche de suppression reste inchangée : aucune carte filtrée,
aucun état vide et aucun zéro ne peuvent donc apparaître avant une lecture
autorisée achevée.

Le changement d'espace/compte passe par `applyExpandedIdentityBoundary()` avant
la construction de la liste, qui réinitialise le filtre. Les chemins de
rafraîchissement continuent d'ignorer les événements tardifs non autorisés ; le
filtre ne fait que dériver du document déjà accepté.

### 7. Continuité du focus, du défilement et des états locaux

Le contrôle étant statique et extérieur à `#subjects`, l'activation d'un bouton
radio conserve le focus sur ce contrôle pendant le rerendu. Les cartes restant
visibles gardent `expandedParents`, `editingItemId`, `openMenuId` et les
brouillons déjà portés par l'état mémoire existant. La liste est remplacée par
`replaceSubjectsInCurrentView()`, avec la capture/restauration TS-049 déjà en
place ; la réduction de hauteur due au filtre est une réduction réelle permise.

Lorsqu'une carte disparaît automatiquement parce que sa dernière urgence est
traitée, `finishUxRender()` réutilise la résolution de focus existante. Un
repli ciblé vers le contrôle de filtre ou l'action de l'état vide est prévu
uniquement si le focus précédent appartenait à une carte devenue absente, afin
de ne jamais laisser le focus sur un nœud détaché.

Aucune région `aria-live` supplémentaire n'est créée. L'état du filtre est porté
par le bouton radio coché ; la liste existante conserve son annonce. La
synchronisation `checked` évite une réécriture inutile lors des rerendus
identiques.

## Risks / Trade-offs

- **Perte de focus quand une carte quitte le résultat** → réutiliser la
  résolution TS-049 et ne replier vers le contrôle qu'en l'absence de cible
  restante ; vérifier le parcours réel en recette manuelle.
- **Annonces répétées du filtre ou de l'état vide lors des rafraîchissements** →
  pas de nouvelle région live, état radio natif, `checked` réécrit seulement en
  cas de changement ; la liste conserve son comportement existant.
- **Réinitialisation trop large ou trop étroite** → brancher uniquement sur
  `resetExpandedViewState()` et vérifier que `load()`/les rafraîchissements ne
  l'appellent pas ; les tests statiques couvrent ces chemins.
- **Révélation d'un projet masqué qui change de vue** → c'est l'option autorisée
  par le brief ; la cible est accessible dans le détail et le retour repart de
  « Tous les projets ».
- **Divergence avec TS-053** → le prédicat appelle `subjectMetrics()` au lieu de
  recopier la condition `priority`/`done`.
- **Coût de calcul** → un parcours des sujets par rendu, de même ordre que les
  compteurs existants, sans lecture ni stockage.
- **Confusion entre état vide général et état vide filtré** → deux branches
  distinctes testées avec un document vide et un document non vide sans
  urgence.

## Migration Plan

Aucune migration de données, de schéma, d'export ou d'import. Le déploiement
consiste à livrer le contrôle, le calcul pur, le rendu et les tests. Un retour
arrière se limite à retirer ces ajouts : aucune donnée ni préférence n'aura été
créée par le filtre.

## Open Questions

Aucune question bloquante. La disposition visuelle exacte du contrôle et son
espacement peuvent être ajustés pendant `apply` sans changer les libellés, les
règles de sélection, les réinitialisations ou les scénarios.
