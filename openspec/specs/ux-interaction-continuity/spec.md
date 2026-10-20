# ux-interaction-continuity Specification

## Purpose

Garantir une expérience prévisible dans ThreadStep en préservant le contexte de
travail de l'utilisateur pendant les modifications locales et les actualisations
asynchrones, sans modifier les règles métier, de navigation ou de sécurité.

## Requirements

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

#### Scenario: Edit, reorder or reprioritize a task

- **GIVEN** une tâche est visible après défilement dans la page
- **WHEN** elle est modifiée, réordonnée ou change de priorité
- **THEN** l'interface garde un ancrage pertinent sur la tâche ou sa nouvelle position
- **AND** aucun retour arbitraire au début de la vue n'est provoqué

#### Scenario: Unrelated regions remain stable

- **GIVEN** plusieurs projets et groupes sont visibles
- **WHEN** une action ne concerne qu'un élément
- **THEN** les états de présentation des éléments non concernés restent inchangés

### Requirement: Stable scroll geometry throughout in-place rendering

Lors d'un rendu dans la même vue, l'interface SHALL préserver une hauteur
défilable cohérente pendant le remplacement des éléments. Elle MUST NOT exposer
une liste transitoirement vide ou fortement raccourcie qui oblige le navigateur
à ramener le viewport au début. Le contrat porte sur le comportement observable
et n'impose ni framework ni technique DOM particulière. Les réductions réelles
de contenu dues au filtre ou à la suppression restent permises.

#### Scenario: Create a task after a long scroll

- **GIVEN** une liste longue est affichée et l'utilisateur travaille à plusieurs écrans du haut
- **WHEN** il crée une tâche sans changer de vue
- **THEN** aucune phase intermédiaire du rendu ne ramène le viewport au début du document
- **AND** le formulaire de création et les tâches voisines restent accessibles au même emplacement logique

#### Scenario: Complete a task in a long list

- **GIVEN** une tâche est visible après un défilement important, sur une liste qui contient encore d'autres tâches
- **WHEN** l'utilisateur coche ou décoche cette tâche
- **THEN** la zone défilable ne s'effondre pas temporairement pendant la mise à jour
- **AND** l'utilisateur conserve un repère de lecture pertinent sans saut vers le haut

#### Scenario: Filter removes the current visual anchor

- **GIVEN** une tâche terminée est proche du repère de lecture et le filtre masque les tâches terminées
- **WHEN** la tâche disparaît effectivement de la liste
- **THEN** le viewport se repositionne au plus près d'un élément restant pertinent lorsque cela est possible
- **AND** le navigateur peut limiter naturellement le scroll à la nouvelle hauteur réelle du contenu
- **AND** aucune hauteur artificielle ne persiste une fois le rendu terminé

#### Scenario: Real navigation must not retain an old list height

- **GIVEN** l'utilisateur quitte une longue liste vers une autre vue
- **WHEN** la nouvelle vue est affichée
- **THEN** la hauteur et la position propres à l'ancienne liste ne sont pas imposées à cette nouvelle vue

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

#### Scenario: Task operation removes its focused control

- **GIVEN** le focus se trouve sur une commande d'une tâche
- **WHEN** une action supprime ou remplace cette commande
- **THEN** le focus est placé sur une commande restante ou un repère pertinent
- **AND** l'ordre de navigation au clavier demeure prévisible

#### Scenario: Explicit navigation is different from an update

- **GIVEN** une navigation explicite change la vue affichée
- **WHEN** la nouvelle page est affichée
- **THEN** le focus peut rejoindre le titre de destination selon la spécification de navigation

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

### Requirement: Documented context-reset exceptions

La continuité UI SHALL respecter les changements d'identité, de vue et
l'indisponibilité réelle d'un contrôle. Les règles spécifiques de
`substep-collapse`, `app-navigation` et d'isolation Cloud prévalent lorsque
leur scénario impose explicitement une réinitialisation ou un blocage.

#### Scenario: Enter a different view

- **WHEN** l'utilisateur entre dans une autre vue, y compris via Précédent ou Suivant
- **THEN** les groupes de la nouvelle vue suivent la politique d'ouverture initiale de `substep-collapse`

#### Scenario: Reload or new tab

- **WHEN** l'application est réellement rechargée ou ouverte dans un nouvel onglet
- **THEN** les états transitoires non persistés sont initialisés selon leurs spécifications

#### Scenario: Account binding becomes unauthorized

- **GIVEN** des données métier ne sont plus accessibles au compte courant
- **WHEN** la liaison Cloud devient bloquante
- **THEN** la protection et le masquage des données restent effectifs
- **AND** aucune continuité visuelle ne permet de divulguer un autre espace

#### Scenario: A deleted group cannot remain open

- **GIVEN** un parent développé est supprimé
- **WHEN** la liste est actualisée
- **THEN** son ouverture peut disparaître sans réinitialiser celles des autres parents

### Requirement: Accessible and verifiable interaction continuity

Toute évolution touchant le rendu d'une interface SHALL prendre en compte le
focus, le défilement, les états transitoires, les contrôles clavier/tactiles et
la synchronisation. Les critères déterministes SHALL être testés en amont ;
la recette navigateur réelle SHALL être distinguée de la preuve CI.

#### Scenario: Regression testing

- **WHEN** une évolution modifie le rendu ou les handlers d'interaction
- **THEN** elle couvre les invariants UX concernés par des tests déterministes lorsque réalisables
- **AND** les scénarios dépendant du véritable viewport, du clavier mobile ou du lecteur d'écran sont consignés en recette manuelle sans résultat inventé

#### Scenario: Long-list regression simulates a scroll clamp

- **GIVEN** une suite de tests de rendu reproduit une liste longue déjà défilée
- **WHEN** une mise à jour remplace des tâches et qu'un navigateur simulé ramènerait le scroll à zéro si le contenu vivant était vidé
- **THEN** la suite démontre l'absence d'un état intermédiaire raccourci ou la préservation effective de l'ancrage
- **AND** elle couvre création, coche et vue de détail sans se limiter à la présence de chaînes dans le code

#### Scenario: Tablet and phone viewports are checked separately

- **GIVEN** une interface susceptible d'afficher de longues listes
- **WHEN** une régression de défilement est qualifiée sur les appareils réels
- **THEN** la recette distingue téléphone et tablette, avec portrait et paysage lorsque disponibles
- **AND** elle couvre création, coche et éventuel clavier virtuel, en relevant appareil, navigateur, version et résultat connu ou non vérifié
- **AND** une CI verte sur un simulateur ne vaut pas certification des moteurs de navigateur réels

#### Scenario: No hidden data side effects

- **WHEN** seule une préférence transitoire d'affichage change
- **THEN** les données, relations, exports et opérations de synchronisation restent inchangés
