# Proposal

## Why

La spec canonique `substep-collapse` exige que les groupes développés survivent
aux simples re-renders de la vue courante. Dans le code livré, `load()` remet
pourtant `expandedParents` à zéro, et cette fonction est appelée par
`syncComplete` de Dexie Cloud ainsi que par le canal inter-onglets. Cocher une
sous-tâche ou recevoir un rafraîchissement de données replie donc tous les
parents, interrompt le travail en cours et contredit aussi le contrat
`ux-interaction-continuity`. L'utilisateur perd son contexte sans navigation
réelle.

## What Changes

- Séparer le rafraîchissement des données de la réinitialisation des états
  transitoires de vue : un rafraîchissement métier ou asynchrone ne constitue
  plus une entrée de vue.
- Conserver l'ouverture des parents encore présents pendant une coche, une
  édition, un changement de priorité, un réordonnancement, un ajout, une
  réception inter-onglets et une fin de synchronisation Cloud, tant que la vue
  et l'identité d'espace autorisée restent les mêmes.
- Réinitialiser l'ouverture uniquement aux frontières prévues : chargement réel,
  nouvel onglet, import réussi, entrée dans une nouvelle vue et changement
  effectif d'espace ou d'identité Cloud autorisée.
- Déplacer la réinitialisation de l'import local après la réussite de la
  fusion, afin qu'une prévisualisation annulée ou refusée ne replie pas les
  groupes ; appliquer la même règle aux imports JSON réconciliés côté Cloud.
- Préserver le filtre des éléments terminés, l'absence de contrôle quand aucun
  enfant visible ne subsiste, `aria-expanded`, l'accès clavier et le focus.
- Ajouter des tests de régression distincts pour `load()`, `syncComplete`,
  `BroadcastChannel`, `hashchange`, l'import et la frontière d'identité, puis
  mettre à jour les tests qui supposaient que chaque `load()` repliait les
  sous-tâches.

## Capabilities

### New Capabilities

Aucune. Le correctif rétablit et précise un comportement déjà attendu par une
capacité existante.

### Modified Capabilities

- `substep-collapse` : préciser que les rafraîchissements locaux, la fin de
  synchronisation Cloud et les notifications inter-onglets conservent l'état
  d'ouverture, et que les réinitialisations restent limitées aux entrées de vue,
  aux rechargements, aux nouveaux onglets, aux imports réussis et aux
  changements effectifs d'identité ou d'espace autorisé.

## Impact

- `site/app.js` : frontière entre rafraîchissement des données, réinitialisation
  transitoire, entrée de vue, import et changement d'identité d'espace.
- `site/interaction-continuity.js` : éventuel helper pur, non persistant, pour
  décider si l'identité de vue autorisée a changé.
- `tests/substep-collapse-default.test.mjs` et
  `tests/task-actions-menu.test.mjs` : hypothèses actuelles sur `load()`.
- Nouveau test ciblé TS-050 pour `load()`, `syncComplete`, `BroadcastChannel`,
  `hashchange`, l'import et la frontière d'identité.
- Aucun changement de schéma, d'export, de persistance de `expandedParents`, de
  règle métier ni de politique de sécurité.

## Non-goals

- Mémoriser l'expansion entre visites, rechargements ou onglets.
- Changer l'état initial replié défini par TS-021.
- Ajouter un niveau de sous-tâches, refondre la synchronisation ou réparer
  TS-045/TS-048.
- Modifier la sélection d'espace, la liaison de compte, les caches ou les
  workflows ASF.

## Unresolved decisions and uncertainties

- L'observation utilisateur exacte sur mobile et sur une instance Dexie Cloud de
  test reste à confirmer ; elle n'est pas déduite d'une CI verte.
- TS-045 et TS-048 touchent le bootstrap et les lectures asynchrones dans
  `site/app.js`. Ce changement doit rester compatible avec leur reprise de
  lecture et ne doit pas traiter une réévaluation de liaison transitoire comme
  un changement d'identité : la réinitialisation n'est prévue que lorsque
  l'espace effectivement autorisé change.
- La frontière exacte du « chargement réel » est l'absence d'état préalable en
  mémoire ou un rechargement du document ; aucun stockage supplémentaire n'est
  introduit pour la reconnaître.
- Les imports JSON locaux et Cloud sont considérés comme des imports réussis au
  sens de la spec. Aucune autre forme d'import ou de restauration n'est ajoutée
  au périmètre.
