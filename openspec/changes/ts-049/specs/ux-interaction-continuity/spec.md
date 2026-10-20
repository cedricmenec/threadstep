# Spec Delta

## MODIFIED Requirements

### Requirement: Context preservation during in-place actions

Une action réalisée dans la vue courante SHALL conserver autant que possible
l'ancrage visuel, le groupe consulté et les contrôles utilisables. L'interface
MUST NOT revenir arbitrairement en haut de page ni donner l'impression d'une
navigation complète pour une simple modification locale.

#### Scenario: Create a task deep in a project

- **GIVEN** l'utilisateur consulte un formulaire de création situé loin du haut d'une page longue
- **WHEN** il crée une tâche dans le même projet
- **THEN** la tâche apparaît au bon endroit sans saut inattendu en haut de page
- **AND** l'utilisateur peut poursuivre sa saisie dans le contexte courant

#### Scenario: Create several tasks in a row

- **GIVEN** l'utilisateur vient d'enregistrer une tâche depuis un formulaire situé bas dans la page
- **WHEN** il saisit et enregistre une deuxième puis une troisième tâche valide
- **THEN** chaque nouveau champ de création utilisable est réellement monté dans le document
- **AND** la position de lecture reste proche du formulaire du projet concerné
- **AND** aucune actualisation complète du document n'est déclenchée

#### Scenario: Create a project from the overview

- **GIVEN** des sujets et des étapes sont déjà affichés
- **WHEN** l'utilisateur crée un projet depuis le formulaire d'ajout
- **THEN** le nouveau projet apparaît sans rechargement du document
- **AND** les autres sujets conservent leur contenu, leur ordre et leur état de présentation

#### Scenario: Edit, reorder or reprioritize a task

- **GIVEN** une tâche est visible après défilement dans la page
- **WHEN** elle est modifiée, réordonnée ou change de priorité
- **THEN** l'interface garde un ancrage pertinent sur la tâche ou sa nouvelle position
- **AND** aucun retour arbitraire au début de la vue n'est provoqué

#### Scenario: Complete a task while completed tasks are hidden

- **GIVEN** le filtre « Masquer les étapes terminées » est actif et une tâche non terminée est visible
- **WHEN** l'utilisateur la termine
- **THEN** la tâche peut disparaître conformément au filtre
- **AND** la position de lecture reste ancrée sur un élément voisin encore affiché
- **AND** le document n'est pas rechargé

#### Scenario: Unrelated regions remain stable

- **GIVEN** plusieurs projets et groupes sont visibles
- **WHEN** une action ne concerne qu'un élément
- **THEN** les états de présentation des éléments non concernés restent inchangés

### Requirement: Predictable focus after an update

À l'issue d'une action, le focus clavier SHALL rester sur un élément réellement
présent, cohérent avec l'intention de l'utilisateur. La reconstruction du DOM
MUST NOT laisser le focus sur un nœud détaché ni déclencher un déplacement
involontaire de la page.

#### Scenario: Continue entering tasks after creation

- **GIVEN** le focus est dans le formulaire d'ajout d'une tâche
- **WHEN** une tâche valide est enregistrée
- **THEN** le champ de saisie disponible après mise à jour peut être réutilisé immédiatement
- **AND** le focus n'est pas dirigé vers un ancien champ retiré du DOM

#### Scenario: Add several tasks without leaving the keyboard

- **GIVEN** une tâche vient d'être créée au clavier depuis un projet
- **WHEN** l'utilisateur tape une nouvelle valeur puis valide le formulaire
- **THEN** le focus reste dans le champ de création du même projet après chaque validation
- **AND** la valeur est acceptée par le champ réellement connecté au document

#### Scenario: Task operation removes its focused control

- **GIVEN** le focus se trouve sur une commande d'une tâche
- **WHEN** une action supprime ou remplace cette commande
- **THEN** le focus est placé sur une commande restante ou un repère pertinent
- **AND** l'ordre de navigation au clavier demeure prévisible

#### Scenario: Task operation moves its focused control

- **GIVEN** le focus se trouve sur la case de complétion, le contrôle de priorité ou le menu d'une tâche
- **WHEN** une complétion, un changement de priorité, un tri, un réordonnancement ou un filtre déplace cette tâche
- **THEN** le focus suit le même contrôle logique s'il reste affiché à sa nouvelle position
- **AND** aucun défilement involontaire n'est déclenché par la restauration du focus
- **AND** si un filtre masque la tâche, le focus rejoint une commande encore disponible de la même vue

#### Scenario: An in-place edit is cancelled

- **GIVEN** l'éditeur d'une tâche est ouvert et le focus se trouve dans l'un de ses champs
- **WHEN** l'utilisateur annule sans modifier les données
- **THEN** le document reste inchangé et le focus revient à une commande disponible de la même tâche
- **AND** la position de lecture reste stable

#### Scenario: A background refresh keeps logical focus

- **GIVEN** le focus se trouve sur une commande d'une tâche affichée
- **WHEN** une actualisation de données de la même vue reconstruit la liste sans changer d'itinéraire
- **THEN** le focus revient au contrôle logique équivalent réellement monté
- **AND** si ce contrôle a réellement disparu, le focus rejoint une cible disponible et prévisible

#### Scenario: Explicit navigation is different from an update

- **GIVEN** une navigation explicite change la vue affichée
- **WHEN** la nouvelle page est affichée
- **THEN** le focus peut rejoindre le titre de destination selon la spécification de navigation

#### Scenario: Explicit reveal keeps its intended target

- **GIVEN** l'utilisateur active « Voir dans la liste » ou « Voir plus »
- **WHEN** la tâche ou le projet demandé est affiché
- **THEN** la cible de navigation ou de révélation prévue reçoit le focus et devient visible
- **AND** la restauration de continuité ne remplace pas cette cible intentionnelle

### Requirement: Preserve transient view state on data refresh

Un rafraîchissement de données dans la même vue SHALL conserver les états UI
temporaires encore valides, notamment les groupes développés. Un événement de
synchronisation ou de changement inter-onglets MUST NOT être traité comme une
nouvelle navigation ni réinitialiser les choix d'affichage de l'utilisateur.

#### Scenario: Complete a subtask under an expanded parent

- **GIVEN** une tâche parente est développée et ses sous-tâches sont visibles
- **WHEN** une sous-tâche est cochée ou décochée
- **THEN** le parent demeure développé si des sous-tâches visibles subsistent
- **AND** les autres parents conservent leur état

#### Scenario: Cloud sync refreshes unchanged tasks

- **GIVEN** l'utilisateur a développé un parent dans la vue courante
- **WHEN** Dexie Cloud signale une synchronisation sans changer de vue ni d'identité autorisée
- **THEN** le parent conserve son état d'ouverture si cet état reste applicable
- **AND** aucun rechargement de page n'est déclenché par cet événement seul

#### Scenario: Another tab changes a task

- **GIVEN** des groupes sont volontairement ouverts dans l'onglet courant
- **WHEN** une actualisation des données provient d'un autre onglet
- **THEN** les groupes toujours présents et affichables conservent leur état

#### Scenario: Filter removes a completed subtask

- **GIVEN** le filtre masquant les tâches terminées est actif
- **WHEN** l'utilisateur termine une sous-tâche
- **THEN** la sous-tâche peut disparaître conformément au filtre
- **AND** les autres groupes affichables gardent leur ouverture

#### Scenario: In-place action keeps expanded groups and reading position

- **GIVEN** des parents sont développés et la page est défilée
- **WHEN** une tâche est créée, cochée, modifiée, réordonnée ou change de priorité dans la même vue
- **THEN** les parents encore visibles conservent leur état d'ouverture
- **AND** l'élément d'ancrage conservé garde le même décalage par rapport au haut du viewport

#### Scenario: Same-view refresh does not jump to the top

- **GIVEN** l'utilisateur a défilé jusqu'à une tâche d'une liste longue
- **WHEN** une actualisation de données de la même vue se produit sans changement d'itinéraire ni d'identité
- **THEN** la position de lecture reste ancrée sur un élément encore présent
- **AND** aucun retour arbitraire au début de la page n'est provoqué

### Requirement: Accessible and verifiable interaction continuity

Toute évolution touchant le rendu d'une interface SHALL prendre en compte le
focus, le défilement, les états transitoires, les contrôles clavier/tactiles et
la synchronisation. Les critères déterministes SHALL être testés en amont ;
la recette navigateur réelle SHALL être distinguée de la preuve CI.

#### Scenario: Regression testing

- **WHEN** une évolution modifie le rendu ou les handlers d'interaction
- **THEN** elle couvre les invariants UX concernés par des tests déterministes lorsque réalisables
- **AND** les scénarios dépendant du véritable viewport, du clavier mobile ou du lecteur d'écran sont consignés en recette manuelle sans résultat inventé

#### Scenario: Removed and moved controls are covered separately

- **WHEN** une évolution restaure le focus après un rendu
- **THEN** les tests déterministes distinguent un contrôle réellement supprimé d'un contrôle déplacé par tri, priorité ou filtre
- **AND** ils vérifient la cible de repli dans chaque cas

#### Scenario: No hidden data side effects

- **WHEN** seule une préférence transitoire d'affichage change
- **THEN** les données, relations, exports et opérations de synchronisation restent inchangés

#### Scenario: Continuity state is not persisted

- **GIVEN** un rendu a conservé le focus et l'ancrage de lecture
- **WHEN** l'utilisateur recharge la page ou exporte ses données
- **THEN** aucun champ, aucune clé de stockage, aucune version de document ni aucune écriture Cloud nouvelle n'apparaît
- **AND** l'export et l'import JSON restent compatibles avec le format existant
