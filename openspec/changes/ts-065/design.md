# Design

## Context

Voir `proposal.md` — Why. L'état de départ est celui de TS-064 fusionnée :

- `site/overview/OverviewSurface.jsx` monte `OverviewCards` et
  `ProjectCard` dans `#subjects` par la frontière `reactBoundary` existante.
- `ProjectCard` réutilise déjà `CreateTaskForm` ; `OverviewTaskList` rend les
  tâches avec le `TaskItem` partagé, qui contient `TaskEditor`,
  `TaskActionMenu`, la priorité, la complétion, les sous-étapes et la poignée
  de drag.
- `site/project-detail/controller-commands.js` porte les commandes d'édition
  et de mutation utilisées aussi par Overview. `site/app.js` compose
  `overviewCommands` à partir de ces commandes et ajoute les intentions de
  carte (`openProject`, `seeMore`, `moveProject`, `removeProject`,
  `resetFilter`).
- Le drag actuel commence dans `TaskItem` via `commands.startDrag`, puis le
  contrôleur `site/app.js` ajoute et retire directement des classes sur les
  nœuds `.task` (`.dragging`, `.drop-before`, `.drop-after`) et applique le
  réordonnancement final. Cette présentation impérative écrit dans un
  sous-arbre possédé par React.
- `site/overview/overview-adapter.js` fournit un instantané gelé et un état
  transitoire séparé. `site/app.js` conserve la décision de montage, la
  continuité `captureUxContinuity`/`applyFocus`/`finishUxRender` et les
  commandes d'écriture uniques.

Contrainte structurante : le changement ne doit ni créer un second store, ni
dupliquer les règles de `site/core.js`, ni modifier le comportement du détail
projet ou des zones Overview restées vanilla.

## Goals / Non-Goals

**Goals :**

- Rendre la session de glisser-déposer Overview possédée par React, tout en
  conservant une seule mutation finale déléguée au contrôleur.
- Qualifier par des tests déterministes l'unicité des commandes et écritures
  pour la création, l'édition, la priorité, la complétion, le menu, les
  sous-étapes, le retrait/annulation, le suivi et le drag.
- Prouver la continuité des brouillons, du focus et du scroll lors des mises à
  jour de même contexte, ainsi que l'isolation aux changements de route,
  d'identité, d'espace et de lecture bloquée.
- Documenter les frontières et distinguer les preuves CI de la recette
  humaine.

**Non-Goals :**

- Réécrire les composants d'édition déjà React ou changer leurs validations.
- Modifier le drag du détail projet, les zones globales Overview, la
  persistance, les routes ou le rendu visuel.
- Ajouter une bibliothèque de drag, un routeur, un store, une préférence
  persistée ou une dépendance.

## Decisions

### 1. Session de drag Overview possédée par React, mutation déléguée

Introduire un module de présentation borné, par exemple
`site/overview/use-overview-drag.js`, qui :

- suit un identifiant d'item en cours de déplacement, la cible candidate et la
  position `before`/`after` dans un état React local à la surface ;
- expose les classes visuelles (`dragging-handle`, `dragging`,
  `drop-before`, `drop-after`) par les props des composants rendus, sans
  `querySelector` ni mutation impérative de classes ;
- écoute `pointermove`, `pointerup`, `pointercancel` et `Échap` au niveau de
  la surface Overview, avec un seul abonnement et un nettoyage au démontage ;
- appelle `commands.reorderItem(subjectId, itemId, targetId, position)` une
  seule fois lors d'un dépôt valide et n'appelle rien pour une cible invalide,
  une annulation ou une perte de pointeur.

`TaskItem` reçoit une prop optionnelle de session de drag. Sans cette prop, il
conserve exactement le chemin actuel du détail projet
(`commands.startDrag`/`cancelDrag`). Overview fournit la session React ; le
détail n'est pas modifié fonctionnellement.

Pourquoi : TS-064 a explicitement différé ce point à TS-065. La mutation
finale reste celle de `reorderWithinPriority` et du flux `persist()` existant,
mais la présentation cesse de muter un arbre React depuis le contrôleur.

Alternatives rejetées : conserver le drag vanilla (violation de la propriété
exclusive et état de dépôt non testable en React) ; migrer aussi le détail
dans ce lot (élargit le risque sans valeur produit demandée) ; ajouter une
bibliothèque de drag (dépendance et comportement non nécessaires).

### 2. Aucun second chemin de commande

Overview continue d'utiliser l'objet `overviewCommands` composé des commandes
existantes. Les composants React ne calculent aucune mutation : ils appellent
une commande nommée, et les valeurs de retour `false`/no-op du contrôleur ne
déclenchent aucune écriture supplémentaire. Le drag React ne remplace pas le
réordonnancement existant ; il fournit seulement la cible et la position à
`reorderItem`.

Pourquoi : les tests TS-059/TS-060/TS-064 couvrent déjà les validations et les
écritures des commandes. Une seconde implémentation React recréerait les
risques de double commande que ce lot doit éliminer.

Alternative rejetée : déplacer les validations dans les composants Overview
(duplication de `site/core.js` et risque de divergence avec le détail).

### 3. Éditeurs et brouillons conservés par la stabilité de la surface

Les éditeurs restent les composants partagés. Une mise à jour de même clé
appelle `surface.update()` et rafraîchit l'instantané sans remonter la racine ;
les clés `subject.id` et `item.id` restent stables. L'état local de saisie
(`title`, `priority`, `note`, message d'erreur) reste donc dans le composant
d'édition. Un changement de route, d'identité, d'espace ou une lecture bloquée
invalide la surface et libère le brouillon, conformément à
`ux-interaction-continuity`.

Les commandes de sauvegarde et d'annulation gardent le contrôle du focus via
l'état transitoire existant (`focusItemId`, `editingItemId`,
`pendingTaskCreationFocus`). Aucun nouveau mécanisme de focus parallèle n'est
introduit.

### 4. Isolation par la frontière et nettoyage de session

La décision de montage et l'invalidation restent celles de TS-064. En plus, la
session de drag Overview annule son geste et ses listeners au démontage ou à
l'invalidation. Un événement tardif de l'espace A ne peut donc ni terminer un
drag dans l'espace B, ni réintroduire une cible de l'ancien instantané. Un
Undo ou une commande en attente restent portés par le contrôleur existant, qui
invalide déjà le retrait en attente lors d'un changement de sujet/import.

### 5. Tests déterministes sur le contrôleur réel

Le harnais TS-064 (esbuild + jsdom + `createRoot`/`flushSync`) est réutilisé et
étendu. Les tests TS-065 montent la surface avec l'adaptateur injecté, puis
utilisent de vraies commandes `createProjectDetailCommands` avec des espions
sur `persist`, `render`, `removeAction`, `undoAction` et les callbacks de drag.
Ils vérifient :

- une activation unique produit exactement une commande et au plus une
  écriture ;
- un formulaire invalide ou une annulation ne produit aucune écriture ;
- un drag valide produit un seul `reorderItem`/`persist`, et une annulation
  aucun ;
- les brouillons, menus, parents ouverts et focus survivent à un refresh de
  même contexte ;
- un changement d'identité ou un état bloqué libère la surface sans conserver
  de données du contexte précédent.

Aucun test n'ouvre Dexie, IndexedDB, le réseau ou l'OTP.

### 6. Documentation et retour arrière

Documenter dans `docs/product/react-overview-interactions.md` la propriété des
interactions, les commandes déléguées, le cycle de drag, le diagnostic et les
limites de recette. Compléter `docs/product/developer-guide.md` d'un renvoi.

Le retour arrière est un revert de code : retirer la session React de drag et
sa prop optionnelle, restaurer l'appel `commands.startDrag` pour Overview, puis
supprimer le module et les tests TS-065. Aucun schéma, aucune route, aucune
donnée et aucune préférence ne sont affectés.

## Risks / Trade-offs

- **Régression du drag partagé avec le détail** → prop optionnelle, chemin du
  détail inchangé, tests TS-059/TS-060 exécutés en non-régression.
- **Double écoute pointeur Overview/vanilla** → un seul abonnement possédé par
  la surface, désactivation du chemin global pour le drag Overview, test de
  comptage des commandes et du nombre d'écritures.
- **Focus ou scroll perdu après un drag** → conservation de `applyFocus` et
  `finishUxRender`, clés stables, tests jsdom de focus connecté et d'ancrage.
- **Brouillon perdu lors d'un refresh** → pas de remontage sur même clé,
  test explicite de saisie non enregistrée après `surface.update()`.
- **Fuite entre espaces** → invalidation et nettoyage de session, tests de
  changement d'identité, de lecture bloquée et d'événement tardif.
- **Allégation excessive sur l'accessibilité** → recette navigateur réelle
  conservée sans cases à cocher, aucun résultat simulé présenté comme preuve.
- **Ambiguïté de périmètre** → documentée dans `proposal.md` ; si elle change
  la frontière retenue, elle doit être tranchée avant `apply`.

## Migration Plan

1. Vérifier la fusion et l'archive TS-064, la présence des modules partagés et
   l'absence de modification des chemins protégés.
2. Capturer dans `/tmp` le comportement de référence des commandes et du drag
   actuel sur des données synthétiques.
3. Ajouter la session de drag React bornée et la prop optionnelle de `TaskItem`
   sans modifier le chemin du détail.
4. Brancher Overview sur cette session et sur les commandes existantes.
5. Ajouter les tests d'unicité, d'éditeur, de continuité, d'isolation et de
   non-régression ; exécuter les suites ciblées après chaque groupe.
6. Compléter la documentation et exécuter `npm run check`, `npm run build`,
   `npm run verify:build`, `openspec validate` et le contrôle de phases.
7. Laisser la recette humaine desktop/Chrome Android hors checklist et ne
   jamais la présenter comme exécutée par la CI.

Aucune migration de données n'est nécessaire.

## Open Questions

Aucune question technique bloquante. Les deux incertitudes produit (trace de
recette TS-064 et périmètre exact des zones restées vanilla) sont consignées
dans `proposal.md` et doivent être levées avant `apply` si elles changent la
frontière de ce plan.
