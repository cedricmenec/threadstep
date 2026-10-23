# Design

## Context

Voir `proposal.md` pour la motivation. L'état livré calcule déjà
`pendingCount(documentState)` pour le compteur global, `totalTaskCount(subject.items)`
pour le total de tâches principales, et rend chaque carte dans `renderSubject()`
à partir du `documentState` autorisé. `render()` décide déjà de masquer la liste,
le compteur, la suggestion et les cartes de reprise lorsque TS-052 est en
`AWAITING_READ` ou en action requise sans projets ; `applyBusinessVisibility()`
et `clearBusinessForBindingBlock()` conservent les frontières TS-045/048.

Les contrats de référence restent `overview-project-read-state`,
`subject-task-total`, `subject-overview-preview`, `next-action-suggestion`,
`resume-tracking`, `workspace-identity-isolation` et
`ux-interaction-continuity`. Le changement est une présentation dérivée : il ne
touche ni à la lecture, ni à l'écriture, ni au schéma, ni aux exports.

## Goals / Non-Goals

**Goals:**

- Centraliser dans des fonctions pures les comptes, la définition d'un projet
  actif, la progression et les libellés.
- Afficher une synthèse unique sans dupliquer le nombre d'étapes en attente.
- Rendre la progression et les urgences par carte lisibles au texte, sans
  couleur seule, sur mobile et pour les technologies d'assistance.
- Garantir qu'aucun indicateur n'est présenté avant une lecture métier
  autorisée achevée ni ne réutilise un document d'un autre espace.
- Conserver le cycle de rendu existant, le focus, l'ancrage de défilement,
  les groupes développés et les brouillons.

**Non-Goals:**

- Ajouter un filtre, une recherche, un graphique, une migration, un champ ou
  une préférence.
- Modifier la suggestion, la reprise, le filtre, l'aperçu de cinq parents,
  l'ordre, les priorités, la complétion ou les gestes de réorganisation.
- Ajouter un abonnement Dexie, une lecture, un `liveQuery`, un accès réseau,
  une opération d'authentification ou une écriture.
- Reprendre le design Stitch ou changer l'architecture vanilla.

## Decisions

### 1. Calculs purs dans `site/core.js`

Ajouter des fonctions pures et exportées, sans DOM ni stockage :

- `subjectMetrics(subject)` retourne `total`, `done`, `pending`, `urgentPending`
  et `active` (`pending > 0`), à partir de `subject.items`.
- `overviewMetrics(document)` agrège `activeProjects`, `pendingSteps` et
  `urgentSteps` sur tous les sujets.
- `subjectUrgencyLabel(count)`, `subjectProgressLabel(items)` et
  `overviewSummaryLabel(metrics)` produisent les libellés français.

`subjectProgressLabel` compte chaque enregistrement une fois et calcule
`Math.round(100 * done / total)` quand `total > 0`. Il retourne « Aucune étape »
sans pourcentage quand `total = 0`. `overviewSummaryLabel` joint les trois
métriques avec un séparateur stable.

*Alternatives écartées :* un nouveau module dédié serait isolé mais
dupliquerait des conventions de comptage déjà présentes dans `core.js` ; un
calcul directement dans `app.js` serait plus difficile à tester sans DOM.

### 2. Le compteur global devient la synthèse

Le `#counter` existant reste l'unique surface de synthèse. Son contenu est
remplacé par `overviewSummaryLabel(overviewMetrics(documentState))`, par
exemple « 2 projets actifs · 5 étapes en attente · 1 urgence en attente ».
Le nombre d'étapes en attente conserve sa valeur et son sens
(`pendingCount`), mais n'est plus répété dans une seconde zone.

Le compteur est mis à jour uniquement si sa chaîne change, afin qu'un rendu
identique ne réécrive pas le contenu d'une région `aria-live`. Il est masqué
pendant `AWAITING_READ` ou une action requise sans projets, comme aujourd'hui.
Le balisage initial est neutre (contenu vide et masqué) : aucun « 0 » fictif
n'est affiché avant la première lecture autorisée.

*Alternatives écartées :* ajouter une seconde synthèse à côté du compteur
existant aurait dupliqué le nombre d'étapes en attente, explicitement proscrit
par le brief ; remplacer `#counter` par plusieurs éléments interactifs aurait
ajouté de la complexité sans valeur.

### 3. Indicateurs de carte dans `renderSubject()`

Chaque carte de la vue d'ensemble reçoit, sous les compteurs existants, deux
paragraphes texte :

- urgences restantes : « 0 urgence restante », « 1 urgence restante » ou
  « N urgences restantes » ;
- progression : « X / Y étape(s) terminée(s) (Z %) » ou « Aucune étape ».

Le compteur « N étape(s) en attente » et le total « N tâche(s) au total »
restent présents et calculés comme avant. Tous les textes passent par `el()`
et `textContent`; aucun `innerHTML` n'est introduit. Les indicateurs sont des
textes ordinaires, pas de nouveaux contrôles : aucune carte ne devient
focalisable ou déplaçable à cause d'eux. La vue de détail n'est pas modifiée.

*Alternative écartée :* ajouter les indicateurs à tous les en-têtes, y compris
le détail, élargirait la portée du brief « carte projet » sans nécessité.

### 4. Recalcul par le cycle de rendu existant

Aucun nouvel abonnement ni timer n'est ajouté. `renderSubject()` et
`render()` relisent le `documentState` courant, lui-même remplacé par les
chemins existants : `persist()` avant commit, import/restauration, suppression
et annulation, `refreshLocalDocument()`, `refreshSyncedDocument()`, événements
de synchronisation et actualisations inter-onglets. Les comptes suivent donc
immédiatement l'état en mémoire, y compris après un échec de commit qui
restaure `lastRecords`.

*Alternative écartée :* mémoriser les indicateurs ou les recalculer à partir
d'un abonnement dédié créerait un second état à synchroniser.

### 5. La visibilité suit la lecture autorisée

La synthèse et les indicateurs de carte ne sont rendus que si
`businessAllowed()` est vrai et si la présentation Overview n'est ni
`AWAITING_READ` ni une action requise sans projets disponibles. Ils proviennent
exclusivement de `documentState`; aucun cache, état natif `in-sync`, statut de
session ou document d'un autre espace ne peut les alimenter. Un changement de
compte/base ou une liaison non vérifiée continue de vider ou masquer la vue
selon les chemins existants. Le résumé n'est jamais annoncé tant qu'il est
masqué.

*Alternative écartée :* afficher le résumé hors du tableau de bord pour le
garder visible pendant le chargement produirait exactement les zéros fictifs
que TS-052 interdit.

### 6. Accessibilité et continuité

Les indicateurs sont du texte perceptible sans couleur. Le compteur global
conserve `aria-live="polite"` mais n'est réécrit que lorsque son contenu change.
Les cartes ne gagnent aucune région live, aucun focus et aucun raccourci. Le
rendu utilise toujours le remplacement atomique
`replaceSubjectsInCurrentView()` : le focus, l'ancrage de défilement, les
parents développés et, le cas échéant, les brouillons restent gérés par
TS-049/050. Un rafraîchissement de données ne déclenche ni navigation, ni
déplacement de projet ou de tâche.

Les libellés longs se replient dans l'en-tête (`overflow-wrap`) et la synthèse
peut passer sur plusieurs lignes sans provoquer de débordement horizontal.

## Risks / Trade-offs

- [Un pourcentage arrondi est confondu avec une estimation de charge] →
  Libellé explicite « étapes terminées », comptage brut des enregistrements et
  aucun calcul de temps.
- [Le compteur global perd son ancien libellé « prochaine(s) étape(s) »] →
  Le nombre et le sens restent identiques, la synthèse est plus informative et
  le doublon est évité ; les tests vérifient le nouveau libellé et l'absence de
  seconde occurrence.
- [Un rendu identique réannonce la synthèse] → comparaison de la chaîne avant
  écriture, aucun nouvel `aria-live`, et test de rendus répétés.
- [Un projet sans étape affiche un faux 0 %] → branche « Aucune étape » dédiée
  et test dédié.
- [Des indicateurs apparaissent pendant une lecture ou sous un autre compte] →
  gating sur `businessAllowed()` et la présentation disponible, tests
  d'isolation et de chargement.
- [L'ajout de texte décale le défilement ou casse le focus] → rendu atomique
  existant, aucun nouveau contrôle, tests de non-régression TS-049/050 et
  recette réelle mobile.
- [Les libellés se chevauchent sur petit écran] → repli autorisé, `min-width: 0`
  là où nécessaire et vérification manuelle sur viewport étroit.

## Migration Plan

Aucune migration de données, de schéma, de préférence, d'export ou de
configuration. Le changement est une évolution de présentation réversible :
retirer les fonctions, les lignes de carte, la synthèse et les styles concernés
suffit à revenir au comportement antérieur. Rollback par revert de la PR, sans
action utilisateur ni opération Cloud.

## Open Questions

Aucune question bloquante. L'espacement exact des indicateurs et la disposition
fine de la synthèse peuvent être ajustés pendant `apply` sans changer les
comptes, les libellés contractuels, la visibilité ni les scénarios.
