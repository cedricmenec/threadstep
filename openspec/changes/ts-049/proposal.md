# Proposal

## Why

Dans une liste longue, chaque mutation métier (`persist()`) déclenche
`render()`, qui vide `#subjects` via `replaceChildren()`. Le nœud actif est
alors détaché du DOM, la position de lecture peut revenir en haut et, dans
`renderTaskArea()`, `input.focus()` cible l'ancien champ de création déjà
retiré. L'utilisateur perd donc son contexte de saisie après une création, une
coche, un changement de priorité, une édition ou un réordonnancement, alors que
ces actions sont locales et ne devraient pas ressembler à une navigation.

## What Changes

- Préserver l'ancrage de lecture pertinent et le focus logique lors des
  mutations locales dans la vue courante : création de tâche ou de projet,
  complétion, priorité, édition, réordonnancement, retrait et annulation.
- Restituer le focus sur un contrôle réellement monté après chaque rendu
  concerné, en particulier dans le champ de création de tâche réellement
  présent, afin de permettre plusieurs ajouts successifs.
- Remplacer un contrôle disparu (filtre, retrait, changement de vue) par une
  cible prévisible et disponible de la même vue, sans laisser le focus sur un
  nœud détaché.
- Privilégier des mises à jour DOM ciblées lorsque c'est raisonnable et
  conserver un mécanisme de capture/restauration pour les rendus globaux
  restants.
- Conserver les comportements intentionnels : « Voir dans la liste », « Voir
  plus », navigation explicite, focus de titre de destination et changement de
  filtre.
- Ne créer aucun état persisté, aucun changement de schéma, de relation,
  d'export/import ni d'écriture Cloud implicite pour stabiliser le scroll ou le
  focus.

## Capabilities

### New Capabilities

Aucune. Le comportement relève de la continuité d'interaction déjà spécifiée.

### Modified Capabilities

- `ux-interaction-continuity`: préciser l'ancrage de lecture et la restauration
  du focus logique après une mutation locale ou un rafraîchissement de données,
  y compris les contrôles déplacés par tri/filtre et les contrôles réellement
  supprimés, sans modifier les exceptions de navigation explicite.

## Impact

- `site/app.js` : `persist`, `render`, `renderTaskArea`, `renderRow`,
  `renderEditor`, `applyFocus`, les handlers de complétion, priorité, édition,
  réordonnancement, retrait/annulation, `load()` et les chemins de navigation.
- Un module utilitaire pur (par exemple `site/interaction-continuity.js`) pour
  la capture/restauration testable du focus et de l'ancrage, sans DOM réel.
- `tests/` : nouveaux tests déterministes avec DOM simulé et tests de
  non-régression sur les interactions existantes.
- Aucun changement de `site/core.js`, du schéma `threadstep.document.v1`, de
  l'export/import JSON, d'IndexedDB, de Dexie Cloud, des URLs ni des règles
  métier.

## Uncertainties and decisions to confirm

- La cause exacte (nœud actif détaché lors de `replaceChildren()`, restitution
  implicite du navigateur, clavier virtuel Android) reste une hypothèse à
  confirmer en navigateur réel pendant la recette manuelle. Le plan ne prétend
  pas qu'un rechargement réseau complet se produit.
- Le comportement exact du clavier virtuel Android et le maintien de la saisie
  ne sont pas prouvables sur le runner CI ; ils restent des vérifications
  manuelles.
- Le plan privilégie un mécanisme déterministe de capture/restauration après
  rendu, complété par des mises à jour ciblées lorsque le risque de régression
  est faible. La répartition exacte entre rendu ciblé et rendu global sera
  arrêtée pendant `apply` sans changer le comportement observable spécifié.
- Aucune nouvelle préférence persistée, aucun nouvel état métier et aucune
  nouvelle dépendance ne sont introduits.

## Non-goals

- Refonte globale des composants UI, changement de framework ou animation de
  défilement systématique.
- Modification des règles métier, des URLs, des protections Dexie Cloud ou de
  la sauvegarde non destructive.
- Correction des incidents de liaison Cloud TS-045/TS-048.
- Remplacement de la recette navigateur, mobile, clavier et lecteur d'écran par
  des tests Node.
