# Design

## Context

Voir `proposal.md` — Why. L'application est un site statique vanilla JS :
`site/app.js` détient l'état de vue (`route`, `expandedParents`, `editingItemId`,
`openMenuId`, indicateurs de focus différé) et reconstruit `#subjects` à chaque
`render()`. `persist()` appelle `render()` avant la résolution asynchrone de
l'écriture, puis certains handlers rappellent `focus()` sur une référence
capturée avant le rendu. `renderTaskArea()` construit un formulaire interne au
projet ; après création, `input.focus()` vise donc un nœud déjà détaché par
`replaceChildren()`. Les rafraîchissements (`load()`, synchronisation native,
autre onglet) passent par le même rendu global.

Contraintes structurantes :

- Aucun framework, bundler ou dépendance DOM de test n'est ajouté au produit.
- Aucun état persisté nouveau : la continuité est uniquement en mémoire.
- `site/core.js`, le schéma `threadstep.document.v1`, les URLs, l'export/import,
  Dexie Cloud et les règles métier restent inchangés.
- Les intentions de focus existantes (`pendingNavigationFocus`, `focusItemId`,
  `focusSubjectId`, `focusDetailHeading`, `focusOpenSubjectId`,
  `focusRenameControl`, `pendingCollapseFocus`, `pendingPriorityFocus`,
  `pendingMenuFocus`, `pendingMoveFocus`) restent prioritaires.
- Les routes, l'import et les changements d'identité/liaison restent des
  frontières de réinitialisation documentées.

## Goals / Non-Goals

**Goals:**

- Une capture/restauration déterministe et testable du focus logique et de
  l'ancrage de lecture à travers un rendu global de la même vue.
- La restitution du focus sur le champ de création réellement monté, avec
  ajouts successifs sans nœud détaché.
- Une cible de repli prévisible lorsqu'un contrôle a réellement disparu, et le
  suivi du même contrôle logique lorsqu'il a seulement été déplacé.
- La conservation des groupes développés, des menus et des états de vue locaux
  lors des rendus de la même vue.
- Des tests déterministes exécutables sans navigateur pour distinguer contrôle
  supprimé, contrôle déplacé et absence d'ancrage.

**Non-Goals:**

- Prouver le comportement réel du clavier virtuel Android, du viewport ou du
  lecteur d'écran en CI.
- Remplacer tout rendu global par un moteur de rendu incrémental complet.
- Modifier les handlers métier, les validations, les écritures ou les
  confirmations.
- Ajouter une animation de défilement, une préférence persistée ou une
  dépendance.

## Decisions

### 1. Module pur `site/interaction-continuity.js`

Ajouter un module sans DOM, stockage, réseau ni IndexedDB, exposant des
fonctions pures de :

- normalisation d'une identité de focus logique à partir de métadonnées
  fournies par `site/app.js` (vue, sujet, élément, type de contrôle) ;
- sélection de l'ancrage de lecture à partir d'une liste de descripteurs
  `{key, top}` et de la position courante ;
- calcul d'un plan de restauration : contrôle identique, contrôle de repli,
  ou aucune cible ;
- calcul du décalage de défilement à appliquer pour conserver l'ancrage.

Pourquoi : ces décisions sont déterministes, testables en Node et ne
dépendent ni d'un vrai layout ni d'une bibliothèque DOM. `site/app.js` reste le
seul adaptateur DOM : il lit les positions, applique `focus()` et
`scrollBy()`.

Alternative écartée : mettre la logique dans `app.js` et tester uniquement des
chaînes sources. Cela ne prouverait ni la sélection de repli ni le calcul
d'ancrage, contrairement à l'exigence de tests déterministes de la tâche.

Alternative écartée : ajouter `jsdom`. Nouvelle dépendance non demandée, coût
et surface d'exécution supplémentaires pour un besoin limité.

### 2. Capture avant rendu, restauration après rendu

Autour de la reconstruction de `#subjects` :

1. Avant `replaceChildren()`, capturer l'élément actif s'il appartient à la vue
   courante et le premier élément d'ancrage visible (tâche, sujet ou conteneur
   de liste), avec son identité stable et son décalage par rapport au haut du
   viewport.
2. Après le rendu, appliquer d'abord les intentions de focus explicites
   existantes.
3. Sinon, retrouver le contrôle logique équivalent dans le nouveau DOM via les
   attributs stables (`data-item`, `data-subject` et classes de contrôle).
4. Si le contrôle n'existe plus, appliquer une chaîne de repli bornée à la même
   vue.
5. Restaurer l'ancrage de lecture par un ajustement de défilement sans
   animation, puis focaliser avec `preventScroll` lorsque disponible.

Une capture n'est appliquée que si la route, l'identité autorisée et le type de
vue sont identiques. Un changement de route, un import ou un blocage
d'identité invalide la capture au lieu de restaurer un état d'une autre vue.

Pourquoi : ce mécanisme couvre tous les rendus globaux restants sans réécrire
chaque handler et garantit qu'aucune référence détachée n'est réutilisée.

Alternative écartée : rendre `persist()` purement non rendant et mettre à jour
chaque sous-arbre à la main. Plus intrusif, risque de divergence entre le
modèle, le compteur, la suggestion, le suivi et les vues, pour un gain non
prouvé.

### 3. Mises à jour ciblées lorsque le risque est faible

Pour la création de tâche, conserver le rendu global sécurisé par la capture,
mais ne plus appeler `input.focus()` sur la référence d'origine : l'identité du
champ de création (sujet + contrôle) est restaurée vers le champ neuf du même
projet. Le formulaire reçoit un marqueur stable non métier (par exemple un
attribut `data-subject` sur le formulaire ou le champ) pour permettre cette
résolution.

Pour les actions déjà couvertes par une intention différée (édition, priorité,
réordonnancement, menu, retrait), réutiliser ces intentions au lieu d'en créer
de nouvelles. Une mise à jour ciblée n'est introduite que si elle ne duplique
pas la logique de tri, de filtre, de compteur ou de suggestion.

### 4. Priorité des intentions de focus

Ordre appliqué après chaque rendu :

1. navigation explicite et focus de titre de destination ;
2. édition ou renommage en cours ;
3. intentions différées existantes (sujet, élément, repli, priorité, menu,
   déplacement) ;
4. restauration du focus logique capturé ;
5. aucune focalisation forcée.

Ainsi, « Voir dans la liste », « Voir plus », « Ouvrir le projet », le retour
d'édition et le retour de menu gardent leur cible prévue ; la restauration de
continuité ne les écrase jamais.

### 5. Cibles de repli

Lorsqu'un contrôle a réellement disparu, la cible est choisie dans cet ordre,
dans la même vue et parmi des éléments affichés :

- même tâche : contrôle de priorité, bouton de menu, poignée ou carte ;
- tâche voisine encore affichée ;
- carte du sujet concerné ;
- titre de détail ou champ de création du projet ;
- titre de vue ou premier contrôle disponible.

Pour un filtre qui masque une tâche terminée, la cible de repli est une tâche
voisine ou la carte du sujet, jamais le haut de page. Pour un retrait, la
carte du sujet reste la cible existante ; pour une annulation, l'élément
restauré redevient la cible.

### 6. Ancrage de lecture

L'ancrage est le premier élément visible de la vue courante, avec son
décalage. Après rendu :

- si la même clé existe, le décalage est rétabli par un ajustement borné ;
- si elle a disparu, l'élément visible suivant ou précédent le plus proche
  devient l'ancrage ;
- si aucun ancrage n'est disponible, aucun défilement n'est imposé.

La restauration de continuité n'utilise pas `scrollIntoView()` : cet appel est
réservé aux révélations intentionnelles existantes. Le défilement de
restauration est instantané et respecte `prefers-reduced-motion` par absence
d'animation.

### 7. Rafraîchissements de données

`load()` conserve déjà `expandedParents` sauf entrée dans une nouvelle vue. Les
rendus issus d'une synchronisation native, d'un autre onglet ou d'une relecture
de la même vue utilisent la même capture/restauration. Un changement d'identité
ou de liaison reste une frontière de sécurité : la capture est invalidée et
aucun focus n'est restauré vers un espace masqué.

### 8. Tests déterministes sans navigateur

Ajouter `tests/ts-049-interaction-continuity.test.mjs` :

- tests unitaires du module pur : sélection d'ancrage, absence d'ancrage,
  contrôle identique, contrôle déplacé, contrôle supprimé, cible de repli,
  changement de route ;
- tests de handlers avec DOM simulé minimal et `vm`, sur le modèle de
  `tests/ts-048-resume-projects.test.mjs`, en vérifiant les appels réels de
  `focus()` et le décalage de défilement, et l'absence de `scrollIntoView` dans
  le chemin de continuité ;
- tests séparés pour les contrôles supprimés (filtre, retrait) et déplacés
  (priorité, tri, réordonnancement) ;
- tests de non-régression sur les intentions explicites (navigation,
  révélation, filtre, édition, annulation) ;
- tests de non-mutation : aucun nouvel enregistrement, aucune clé locale, aucun
  appel Cloud, export/import inchangés.

Le DOM simulé ne prouve pas le layout réel ni le clavier virtuel : ces
dimensions restent en recette manuelle.

## Risks / Trade-offs

- **Vol de focus pendant une actualisation** → ne restaurer que si l'élément
  actif capturé appartenait à `#subjects`, si la vue et l'identité sont
  identiques, et si le focus courant est le `body` ou un nœud détaché.
- **Conflit avec l'ancrage natif du navigateur** → appliquer un ajustement
  borné une seule fois après le rendu, sans animation, et ne rien faire sans
  ancrage valide.
- **Défilement provoqué par `focus()`** → utiliser `preventScroll` lorsque
  disponible, puis appliquer l'ancrage de lecture.
- **Capture obsolète après navigation ou changement de compte** → clé de route
  et génération d'identité dans la capture, invalidées aux frontières connues.
- **Doublon de logique de repli avec les intentions existantes** → ordre de
  priorité explicite et tests d'intersection.
- **Faux sentiment de preuve CI** → la recette Chrome Android, clavier virtuel,
  focus réel et lecteur d'écran reste manuelle et n'est jamais déclarée
  réussie par les tests Node.

## Migration Plan

Aucune migration de données. Le changement est mémoire-only et se déploie avec
le fichier statique habituel. Retour arrière : retirer l'appel de capture dans
`render()` et les tests associés ; aucune donnée utilisateur n'est affectée.

## Open Questions

- Le comportement exact du clavier virtuel Android (maintien du viewport et de
  la saisie après plusieurs validations) sera observé en recette manuelle ; il
  ne change ni les spécifications ni le découpage des tâches.
- La préférence entre un rendu ciblé supplémentaire et le rendu global sécurisé
  pourra être ajustée pendant `apply` selon le risque de régression, sans
  modifier le comportement observable décrit dans la spec.
