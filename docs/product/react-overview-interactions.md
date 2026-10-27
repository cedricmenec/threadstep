# Interactions et éditeurs Overview React (TS-065)

TS-065 qualifie les commandes et éditeurs des cartes Overview déjà rendus par la
surface React bornée de TS-064. Il ferme le dernier écart d'interaction
impérative : la présentation du glisser-déposer des tâches Overview appartient
désormais à l'état React de la surface. Les mutations restent déléguées au
contrôleur historique et à `site/core.js` ; aucune règle métier n'est recopiée
dans React.

## Carte de propriété des interactions

- `#subjects` reste possédé par une seule racine React bornée pour `#/`, via
  `reactBoundary`. Le détail projet, les paramètres et les zones vanilla ne
  partagent jamais cette racine.
- `site/overview/OverviewSurface.jsx` monte `OverviewCards`, `ProjectCard` et
  `OverviewTaskList`. `TaskItem`, `TaskEditor`, `TaskActionMenu`,
  `CreateTaskForm` et les primitives `site/ui/` restent les composants partagés
  du rendu livré.
- Les filtres, le compteur global, la suggestion, la reprise, la zone
  « Urgences à traiter », le chargement, la synthèse, le formulaire de projet et
  les pages de paramètres restent hors de cette surface.
- La session de glisser-déposer Overview vit dans
  `site/overview/use-overview-drag.js`. Elle expose l'item déplacé, la cible
  candidate et la position `before`/`after` comme props React. Aucune classe
  DOM n'est ajoutée ou retirée impérativement.

## Commandes déléguées

Chaque activation produit au plus une commande métier nommée et au plus une
écriture persistée par le contrôleur existant :

- `createItem` pour une soumission valide du formulaire de carte ;
- `updateItem` pour « Enregistrer » dans l'éditeur en ligne ;
- `setPriority`, `toggleItem`, `toggleSubsteps` et `runMenuCommand` pour les
  contrôles de tâche ;
- `removeItem` et `undoRemoval` pour le retrait et son annulation ;
- `trackItem` pour « Garder le fil » ;
- `reorderItem` pour un dépôt de glisser-déposer valide.

Ouvrir ou fermer un menu, replier ou déplier des sous-tâches et changer le
filtre d'affichage ne produisent aucune écriture. Une commande refusée par le
contrôleur (identifiant inconnu, valeur invalide, opération sans effet) ne
déclenche aucune écriture parallèle. `CreateTaskForm`, `TaskEditor` et
`TaskActionMenu` continuent d'appeler uniquement ces commandes nommées.

## Cycle du glisser-déposer

1. `pointerdown` sur `.task-handle` appelle `dragSession.startDrag` avec
   l'événement natif et la poignée. Le détail projet conserve son chemin
   historique `commands.startDrag` lorsque la prop `dragSession` est absente.
2. `pointermove` résout la cible parmi les tâches visibles du même sujet.
   Seules les tâches principales de même priorité et de même parenté sont
   acceptées par `canReorderWithinPriority`. La classe `dragging` marque l'item
   déplacé, `dragging-handle` sa poignée, `drop-before` ou `drop-after` la cible.
3. `pointerup` sur une cible valide appelle exactement une fois
   `commands.reorderItem(subjectId, itemId, targetId, position)`, puis efface
   l'état visuel. Le contrôleur applique `reorderWithinPriority`, met à jour le
   focus et persiste au plus une fois.
4. Une cible invalide, `Échap`, `pointercancel` ou l'invalidation de la surface
   annule le geste sans commande ni écriture. Les écouteurs `pointermove`,
   `pointerup`, `pointercancel` et `keydown` sont retirés au démontage.

Un dépôt vers un autre sujet, une autre priorité, une sous-étape ou un espace
vide est refusé. Lorsque « Masquer les étapes terminées » est actif, les
poignées ne sont pas rendues, comme dans le rendu livré.

## Diagnostic

- Vérifier `reactBoundary.owner()`, `reactOverviewRecord` et
  `overviewSurfaceContextKey()` pour confirmer un propriétaire unique de
  `#subjects`.
- Vérifier `decideOverviewSurface` et l'instantané de
  `overview-adapter.js` avant de conclure à une absence de cartes.
- Pour un drag, inspecter la session React (`draggingItemId`, `targetId`,
  `dropPositionFor`) et compter les appels à `reorderItem` et les écritures du
  contrôleur. Aucun listener ni état de dépôt ne doit survivre au démontage.
- Les commandes ciblées sont
  `node --test tests/ts-065-overview-*.test.mjs`, puis `npm run check`,
  `npm run build` et `npm run verify:build`.

## Continuité des éditeurs et du focus

Les éditeurs restent montés lors d'un rafraîchissement de même contexte :
`surface.update()` rafraîchit l'instantané sans remonter la racine et les clés
`subject.id` / `item.id` restent stables. Un titre, une priorité ou une note
non enregistrés survivent donc à une mise à jour de données de la même vue. Le
formulaire de création conserve son brouillon sans écriture.

Une validation refusée (titre vide, titre trop long, note dépassant la limite
canonique) ou une annulation ne persiste rien et affiche le message français
existant. Les commandes de sauvegarde, d'annulation, de complétion, de priorité,
de repli et de réordonnancement conservent les indications de focus du
contrôleur (`focusItemId`, `pending*`) et le focus rejoint un contrôle présent.

## Isolation des contextes

La décision de montage et l'invalidation restent celles de TS-064. Un
changement d'identité ou d'espace, une lecture bloquante ou une route non
Overview invalide l'adaptateur, qui notifie un instantané nul. La surface est
alors démontée ou vidée avant l'affichage vanilla suivant : aucun brouillon,
menu, cible de drag ni Undo du contexte précédent n'est réutilisé, exposé ou
écrit. La session de drag annule son geste et ses écouteurs ; un événement
tardif de l'ancien espace ne peut pas réintroduire une cible ou écrire dans le
nouveau contexte.

## Frontières de plateforme

Les modules d'interaction Overview n'ajoutent aucune route, aucune clé de
stockage, aucune préférence persistée, aucune dépendance, aucun accès
Dexie/IndexedDB, aucun appel OTP, aucune requête réseau et aucune modification
de CSP. Les routes hash, la persistance, l'identité d'espace, le consentement,
la sauvegarde et la restauration restent ceux du contrôleur existant. Les
titres, notes et noms accessibles restent des nœuds texte React ; aucun markup
utilisateur n'est interprété comme HTML exécutable. Une synchronisation de fond
de même contexte est une mise à jour en place, jamais une navigation.

## Retour arrière

Le retour arrière est un revert de code : retirer `dragSession` de
`TaskItem`, restaurer l'appel `commands.startDrag` pour Overview, puis supprimer
`site/overview/use-overview-drag.js` et les tests TS-065. Aucun schéma, aucune
route, aucune donnée, aucune préférence et aucun format d'import/export n'est
affecté.

## Preuves automatisées et recette humaine

Les tests `tests/ts-065-overview-*.test.mjs` utilisent des fixtures
synthétiques, des espions et jsdom ; ils n'ouvrent ni base réelle, ni réseau, ni
OTP, et ne lisent aucune donnée personnelle. Ils couvrent l'unicité des
commandes et écritures, les validations, l'annulation, les brouillons, le focus
simulé, le scroll simulé, le drag et l'isolation des contextes.

Une CI verte ou un test jsdom ne prouve ni le rendu visuel, ni le toucher réel,
ni le clavier physique, ni Chrome Android, ni le lecteur d'écran. La recette
desktop et Chrome Android reste manuelle, hors checklist `apply`, et doit être
consignée avec son appareil, son navigateur, sa date et son résultat.

## Limites

Les assertions DOM ne remplacent pas une campagne d'accessibilité réelle. Les
dimensions tactiles, le scroll naturel hors poignée, l'absence de débordement
horizontal, les libellés français perçus et les annonces de lecteur d'écran
restent à vérifier sur appareil. Aucune synchronisation Dexie Cloud de test
n'est exécutée par ces tests.
