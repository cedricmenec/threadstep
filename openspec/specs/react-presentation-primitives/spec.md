# react-presentation-primitives Specification

## Purpose

Fournir un petit socle de composants React de présentation réutilisables,
accessibles et sans effet métier, afin de réduire les duplications du détail
projet sans changer son comportement, ses classes ni le rendu des autres vues.

## Requirements

### Requirement: Presentation-only component contract

Les primitives SHALL être des composants React de présentation avec des props
explicites et des callbacks fournis par l'appelant. Elles MUST NOT importer ou
appeler Dexie, IndexedDB, Dexie Cloud, l'OTP, `persist()`, `site/app.js`, un
routeur ou un store, ni recopier une règle de validation métier.

#### Scenario: Props and variants are explicit

- **WHEN** l'interface d'une primitive est inspectée
- **THEN** ses props, variantes, états et valeurs attendues sont documentés
- **AND** aucune prop ne déclenche implicitement une écriture ou une navigation

#### Scenario: No business dependency or side effect

- **WHEN** les sources des primitives sont inspectées
- **THEN** elles n'importent ni Dexie, ni IndexedDB, ni l'OTP, ni `persist()`,
  ni `site/app.js`, ni un second store
- **AND** leur montage, rendu, re-rendu et démontage n'émettent aucune écriture
  ni requête réseau

#### Scenario: One user intention, one callback

- **WHEN** l'utilisateur active une primitive une fois
- **THEN** le callback fourni par l'appelant est invoqué exactement une fois
- **AND** aucun gestionnaire ou écriture métier n'est dupliqué par la primitive

### Requirement: Button primitive variants and states

Le bouton partagé SHALL exposer les variantes visuelles `primary`,
`secondary`, `subtle` et `danger`, les états focus visible et désactivé, ainsi
que le type HTML fourni par l'appelant. Il MUST rendre un unique élément
`button` avec les classes et le nom accessible transmis, sans wrapper ni
gestionnaire métier.

#### Scenario: Variants keep the existing classes

- **WHEN** le bouton est rendu avec chaque variante
- **THEN** il produit respectivement les classes existantes `primary`,
  `secondary`, `subtle` ou `danger`
- **AND** une classe supplémentaire fournie par l'appelant est conservée dans
  le même ordre utile

#### Scenario: Disabled state prevents activation

- **GIVEN** un bouton rendu avec `disabled`
- **WHEN** l'utilisateur tente de l'activer
- **THEN** le bouton expose l'attribut `disabled`
- **AND** aucun callback n'est invoqué

#### Scenario: Submit and accessible name are caller-controlled

- **WHEN** le bouton est rendu avec `type="submit"` et un libellé ou
  `aria-label`
- **THEN** le type HTML et le nom accessible sont ceux fournis
- **AND** la primitive n'invente ni libellé métier ni nom accessible

#### Scenario: Focus and disabled styles use shared tokens

- **WHEN** le bouton reçoit le focus clavier ou est désactivé
- **THEN** son style de focus visible et son opacité désactivée proviennent des
  tokens partagés
- **AND** l'état désactivé ne repose pas sur la seule couleur

### Requirement: Priority control variants and states

Le contrôle de priorité SHALL exposer uniquement les valeurs `urgent`,
`normal` et `later`, dans cet ordre, avec les libellés existants et la valeur
courante marquée. Il SHALL accepter les variantes badge et champ, transmettre
la classe fournie et émettre un seul callback avec la priorité choisie.

#### Scenario: Badge variant preserves appearance and semantics

- **WHEN** le contrôle est rendu en variante badge
- **THEN** il produit les classes `priority`, `priority-<valeur>` et
  `priority-control`
- **AND** son nom accessible nomme l'élément et sa priorité courante

#### Scenario: Field variant preserves the caller layout

- **WHEN** le contrôle est rendu en variante champ avec une classe existante
- **THEN** il rend un unique `select` avec cette classe
- **AND** il ne lui ajoute pas les classes visuelles du badge

#### Scenario: Values and current selection are exact

- **WHEN** le contrôle est rendu avec une priorité courante
- **THEN** les options sont exactement `Urgent`, `Normal` et `Plus tard` dans
  l'ordre `urgent`, `normal`, `later`
- **AND** la valeur courante est celle fournie par l'appelant

#### Scenario: Selecting a priority emits one intention

- **WHEN** l'utilisateur choisit une autre priorité
- **THEN** le callback reçoit une seule fois la valeur choisie
- **AND** le contrôle ne démarre ni drag, ni complétion, ni édition, ni
  écriture métier

### Requirement: Text field and error state

Le champ texte partagé SHALL rendre un `input` ou un `textarea` avec un nom
accessible fourni, les attributs `required`, `maxLength`, `disabled` et la
valeur contrôlée. En état invalide, il SHALL exposer `aria-invalid` et associer
le message d'erreur fourni par l'appelant sans exécuter la validation métier
lui-même.

#### Scenario: Input attributes pass through unchanged

- **WHEN** le champ est rendu avec `type`, `required`, `maxLength`,
  `placeholder`, `value` et une classe existante
- **THEN** l'élément `input` porte ces attributs et cette classe
- **AND** son nom accessible est celui fourni par l'appelant

#### Scenario: Textarea keeps its multiline contract

- **WHEN** le champ est rendu comme `textarea` avec `rows` et `maxLength`
- **THEN** il rend un unique élément `textarea` avec ces attributs
- **AND** les retours à la ligne de la valeur restent du texte brut

#### Scenario: Invalid state is announced, not decided

- **GIVEN** l'appelant fournit un état invalide et l'identifiant du message
  d'erreur existant
- **WHEN** le champ est rendu
- **THEN** il expose `aria-invalid="true"` et associe ce message via
  `aria-describedby`
- **AND** il n'exécute aucune validation, sauvegarde ou mutation de son propre
  chef

#### Scenario: Error messages remain literal text

- **WHEN** un message d'erreur contient du markup
- **THEN** il reste un nœud texte
- **AND** aucun élément exécutable n'est créé

### Requirement: Reuse in the React project detail with visual parity

Au moins deux primitives distinctes SHALL être réellement utilisées dans la
surface React du détail projet. Leur adoption MUST conserver les éléments HTML,
classes, libellés français, noms accessibles, ordre de lecture, commandes et
comportements du rendu précédent, sans migrer Overview ni changer la propriété
DOM.

#### Scenario: At least two primitives serve the detail

- **WHEN** les sources du détail projet sont inspectées
- **THEN** au moins deux primitives partagées distinctes y sont importées et
  rendues
- **AND** elles ont des consommateurs réels, pas seulement un exemple de
  démonstration

#### Scenario: Classes, labels and roles remain identical

- **GIVEN** le détail projet rendu avant et après l'adoption des primitives
- **WHEN** les contrôles, libellés, classes, noms accessibles et attributs
  ARIA sont comparés
- **THEN** ils sont identiques pour les éléments concernés
- **AND** l'ordre de lecture et l'ordre des commandes du menu restent inchangés

#### Scenario: Interactions still produce one command

- **WHEN** création, édition, priorité, menu, complétion, retour ou annulation
  sont activés depuis le détail
- **THEN** chaque intention produit exactement un callback du contrôleur
- **AND** aucune seconde écriture ni mutation parallèle n'est observée

#### Scenario: Transient state and focus are preserved

- **GIVEN** un brouillon, un parent développé, un menu ouvert ou un focus
  valide dans le détail
- **WHEN** une primitive est re-rendue après une action locale ou un
  rafraîchissement autorisé
- **THEN** les états applicables sont conservés selon
  `ux-interaction-continuity`
- **AND** le focus ne reste pas sur un nœud détaché

#### Scenario: Other routes remain vanilla

- **WHEN** `#/`, `#/parametres`, `#/parametres/donnees` ou
  `#/parametres/synchronisation` est affiché
- **THEN** aucune primitive métier n'est montée pour remplacer le rendu vanilla
- **AND** aucune route, préférence ou donnée n'est créée par cette adoption

### Requirement: Documented conventions and deterministic verification

La documentation SHALL décrire l'API, les variantes, les états, les tokens
consommés, les règles d'accessibilité, les exceptions et l'intégration
progressive des maquettes. Des tests déterministes SHALL couvrir le rendu, les
états, les interactions, la parité DOM et l'absence d'effet métier ; les
dimensions non simulables MUST rester dans la recette manuelle.

#### Scenario: Conventions are versioned and actionable

- **WHEN** la documentation du socle est relue
- **THEN** elle liste les tokens, primitives, variantes, états, règles
  d'accessibilité et procédure de retour arrière
- **AND** elle distingue l'adoption du détail d'une migration générale

#### Scenario: Deterministic tests cover the contract

- **WHEN** les tests ciblés s'exécutent
- **THEN** ils couvrent les variantes, les états, les libellés, les classes,
  les interactions et l'absence d'écriture sur données synthétiques
- **AND** ils n'ouvrent aucune base réelle et n'appellent aucun service Cloud

#### Scenario: Automated checks are not human evidence

- **WHEN** les tests déterministes réussissent
- **THEN** ils ne sont pas présentés comme une validation visuelle, tactile,
  clavier ou lecteur d'écran réelle
- **AND** les vérifications correspondantes restent explicitement à effectuer
