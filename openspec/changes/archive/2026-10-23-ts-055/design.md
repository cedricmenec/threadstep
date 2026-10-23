# Design

## Context

Voir `proposal.md` pour la motivation et
`specs/overview-urgency-filter/spec.md` pour les comportements attendus.

L'état livré fournit déjà :

- `subjectMetrics(subject)` et `overviewMetrics(document)` dans `site/core.js`,
  avec `total`, `pending`, `active` et `urgentPending` calculés sur chaque
  enregistrement parent ou sous-tâche (TS-053) ;
- `subjectHasPendingUrgency()`, `isSubjectVisibleInOverviewFilter()` et
  `overviewFilteredSubjects()` pour le filtre urgent TS-054 ;
- `overviewPreview()`, `visibleItems()` et « Masquer les étapes terminées »
  dans `renderTaskArea()` ;
- `render()` qui supprime entièrement l'Overview pendant une lecture en
  attente ou une action requise sans projets (TS-052), et
  `applyExpandedIdentityBoundary()` qui réinitialise l'état transitoire lors
  d'un changement d'espace autorisé (TS-050) ;
- `resetExpandedViewState()`, appelé à une véritable entrée de vue, après un
  import/restauration réussi et lors d'un changement d'identité, mais jamais
  par `load()` ni par les rafraîchissements Dexie/inter-onglets ;
- `revealAction()`, qui ouvre déjà la vue de détail quand la cible n'est pas
  visible dans le filtre ou dans l'aperçu des cinq parents.

Le nouveau sélecteur doit s'insérer dans ce cycle sans créer d'état métier, de
lecture, de stockage ou d'abonnement supplémentaire.

## Goals / Non-Goals

**Goals:**

- Centraliser la classification « à suivre » / « terminé » et le filtrage
  ordonné dans des fonctions pures testables sans DOM.
- Étendre le groupe de boutons radio existant à quatre modes exclusifs sans
  créer un second contrôle de projets.
- Réutiliser le rendu, l'aperçu, les compteurs globaux, la suggestion, la
  reprise et la continuité existants.
- Garantir que les états de lecture et d'identité continuent de bloquer tout
  faux résultat vide ou toute carte d'un ancien espace.

**Non-Goals:**

- Trier, persister, synchroniser, exporter ou mettre dans l'URL un mode.
- Ajouter un statut projet, un archivage, une recherche, un compteur filtré,
  une lecture Dexie, un abonnement, une préférence ou un champ de schéma.
- Modifier `nextActionSuggestion()`, `resumeView()`, les compteurs TS-053,
  `overviewPreview()` ou les règles de « Masquer les étapes terminées ».
- Redessiner les cartes, changer la limite de cinq parents ou modifier les
  gestes de réorganisation.

## Decisions

### 1. Modèle pur étendu dans `site/core.js`

Conserver `OVERVIEW_FILTER_ALL` et `OVERVIEW_FILTER_URGENT`, ajouter
`OVERVIEW_FILTER_FOLLOWING = "following"` et
`OVERVIEW_FILTER_COMPLETED = "completed"`, puis ajouter une classification
unique :

- `overviewSubjectStatus(subject)` appelle `subjectMetrics(subject)` et
  retourne `"following"` si `pending > 0`, `"completed"` si `total > 0` et
  `pending === 0`, sinon `"empty"`. Un projet sans étape n'est donc ni à
  suivre ni terminé, et la définition reste alignée sur TS-053.
- `isSubjectVisibleInOverviewFilter(subject, mode)` retourne vrai pour
  « Tous les projets », applique `subjectHasPendingUrgency()` pour le mode
  urgence, puis compare le statut pur pour les deux nouveaux modes.
- `overviewFilteredSubjects(subjects, mode)` filtre dans l'ordre d'origine pour
  les trois modes reconnus et retourne la liste complète pour un mode inconnu,
  en préservant le comportement TS-054.

*Alternatives écartées :* un compteur filtré dédié créerait un second état
dérivé à maintenir ; un tri par avancement contredirait la conservation de
l'ordre ; dupliquer la condition `done`/`total` dans `app.js` risquerait de
diverger de `subjectMetrics()`.

### 2. Quatre boutons radio natifs et état mémoire

`site/index.html` conserve un unique `fieldset` « Filtrer les projets » et
étend son groupe à quatre `input type="radio"` partageant le même `name`. Les
libellés visibles sont exactement « Tous les projets », « Projets avec
urgences », « Projets à suivre » et « Projets terminés ». Le premier reste
coché dans le balisage initial. Le contrôle reste statique, hors de
`#subjects`, et n'est pas recréé à chaque rendu.

`site/app.js` remplace l'état spécifique à l'urgence par une variable mémoire
`overviewProjectFilter`, initialisée à `OVERVIEW_FILTER_ALL`. Une fonction de
synchronisation parcourt les quatre contrôles et ne réécrit `checked` que
lorsqu'il diffère du mode courant. Les handlers `change` mettent à jour la
variable puis appellent `render()` sans toucher au document, à l'URL,
à l'historique ni au stockage. Un mode inconnu est normalisé à « Tous les
projets ».

*Alternatives écartées :* un second sélecteur « actifs / terminés »
dupliquerait le contrôle et créerait deux sources de vérité ; des boutons avec
`aria-pressed` demanderaient de gérer nous-mêmes l'annonce de l'état ; une
région `aria-live` dédiée au filtre risquerait de faire osciller les annonces.

### 3. Rendu filtré, compteurs globaux et états vides dédiés

Dans la branche Overview de `render()`, après les gardes
`businessAllowed()`/TS-052, la liste des cartes est construite à partir de
`overviewFilteredSubjects(documentState.subjects, overviewProjectFilter)`.
Chaque sujet est rendu par `renderSubject()` inchangé, donc l'ordre, l'index de
déplacement global, l'aperçu de cinq parents et les interactions restent ceux
du document complet.

Les calculs globaux continuent d'utiliser `documentState` : `#counter`,
`renderSuggestion()` et `renderResumeCard()` ne reçoivent jamais la liste
filtrée. Le filtre ne s'applique pas à `renderTaskArea()`.

Un tableau de correspondance associe chaque mode filtré à son message exact :
« Aucun projet avec urgence en attente », « Aucun projet à suivre » ou
« Aucun projet terminé ». Le bloc d'état vide conserve la classe et l'action
« Tous les projets » existantes ; cette action remet le mode à `all`,
resynchronise le contrôle et rend la vue. En mode `all`, le message existant
« Aucun sujet pour le moment » est conservé.

*Alternatives écartées :* masquer les cartes en CSS laisserait des contrôles
focusables hors résultat ; réutiliser le message d'absence générale
confondrait « aucun projet » avec « aucun projet dans ce mode ».

### 4. Durée de vie branchée sur les réinitialisations existantes

`resetExpandedViewState()` reste le point unique de réinitialisation de l'état
de vue transitoire : il remet aussi `overviewProjectFilter` à `all` et
resynchronise les quatre contrôles. Cela couvre les appelants déjà validés :

- `hashchange` quand `isViewEntry()` détecte une vraie entrée de vue ;
- la réconciliation/import réussi et l'import local fusionné ;
- `applyExpandedIdentityBoundary()` lors d'un changement d'espace/compte.

`load()`, `refreshLocalDocument()`, `refreshSyncedDocument()`, les événements
inter-onglets, `persist()`, l'Undo et les mutations ordinaires ne passent pas
par cette fonction : ils conservent donc le mode et recalculent depuis le
`documentState` courant. Un rechargement réel réinitialise naturellement la
variable mémoire du module.

Aucun `localStorage`, export, URL ou appel Cloud n'est ajouté.

### 5. Révélation sûre des cibles masquées

`revealAction()` conserve sa logique actuelle pour un projet visible sous le
mode actif. Si le sujet ciblé n'est pas visible, la fonction navigue vers la
route de détail existante `#/sujet/<id>` avant de rendre la liste. La vue de
détail n'applique pas le filtre de projets et retrouve l'étape via
`focusItemId` et `expandAncestorForFocus()`.

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

Lorsqu'une carte disparaît automatiquement parce que son avancement change,
`finishUxRender()` réutilise la résolution de focus existante. Le repli vers le
contrôle de filtre est généralisé : si le focus précédent appartenait à une
carte devenue absente et qu'aucune cible restante n'est trouvée, le bouton
radio du mode filtré actif reçoit le focus, et non plus seulement le mode
urgence. Le mode `all` conserve la résolution existante.

Aucune région `aria-live` supplémentaire n'est créée. L'état du filtre est porté
par le bouton radio coché ; la liste existante conserve son annonce. La
synchronisation `checked` évite une réécriture inutile lors des rerendus
identiques.

## Risks / Trade-offs

- **Perte de focus quand une carte quitte le résultat** → réutiliser la
  résolution TS-049 et replier vers le radio du mode actif seulement en
  l'absence de cible restante ; vérifier le parcours réel en recette manuelle.
- **Annonces répétées du filtre ou de l'état vide lors des rafraîchissements** →
  pas de nouvelle région live, état radio natif, `checked` réécrit seulement en
  cas de changement ; la liste conserve son comportement existant.
- **Réinitialisation trop large ou trop étroite** → brancher uniquement sur
  `resetExpandedViewState()` et vérifier que `load()`, l'Undo et les
  rafraîchissements ne l'appellent pas ; les tests statiques couvrent ces
  chemins.
- **Révélation d'un projet masqué qui change de vue** → c'est l'option autorisée
  par le brief ; la cible est accessible dans le détail et le retour repart de
  « Tous les projets ».
- **Divergence avec TS-053** → la classification appelle `subjectMetrics()` au
  lieu de recopier la condition `done`/`total`.
- **Tests existants fragiles au nombre de radios** → mettre à jour les
  assertions TS-054 et les harnais de rendu sans relâcher leurs vérifications
  sur l'urgence, la sécurité et la continuité.
- **Confusion entre état vide général et états vides filtrés** → branches
  distinctes testées avec un document vide et un document non vide sans projet
  correspondant.

## Migration Plan

Aucune migration de données, de schéma, d'export ou d'import. Le déploiement
consiste à livrer le contrôle, le calcul pur, le rendu et les tests. Un retour
arrière se limite à retirer ces ajouts : aucune donnée ni préférence n'aura été
créée par le filtre.
