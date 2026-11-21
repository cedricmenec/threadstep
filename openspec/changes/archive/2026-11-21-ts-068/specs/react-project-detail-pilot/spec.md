# Spec Delta

## MODIFIED Requirements

### Requirement: Parité de données et de présentation

La surface React SHALL afficher les mêmes données, identifiants, compteurs,
hiérarchies et ordres que le rendu de référence. Les classes et noms accessibles
des éléments existants restent stables ; leur présentation visuelle MAY évoluer
selon TS-068. Les titres et notes utilisateur MUST rester des nœuds texte.

#### Scenario: En-tête et compteurs identiques

- **GIVEN** un projet avec des tâches terminées et non terminées et des
  sous-tâches
- **WHEN** son détail React est affiché
- **THEN** le titre, le libellé d'étapes en attente et le libellé de total de
  tâches de premier niveau sont ceux du rendu vanilla de référence
- **AND** les sous-tâches ne sont pas comptées dans le total de premier niveau
- **AND** les identifiants et classes de l'en-tête et du contrôle de retour sont
  préservés

#### Scenario: Ordre et hiérarchie préservés

- **GIVEN** un projet contenant plusieurs priorités et une tâche parente avec
  des sous-tâches directes
- **WHEN** le détail React est rendu
- **THEN** les tâches de premier niveau suivent l'ordre de priorité existant
- **AND** chaque sous-tâche reste dans la liste enfant du bon parent
- **AND** chaque élément garde son identifiant stable et ses classes de
  hiérarchie

#### Scenario: Filtre des tâches terminées

- **GIVEN** « Masquer les étapes terminées » est actif
- **WHEN** le détail React est rendu ou rafraîchi
- **THEN** les tâches sans sous-tâche non terminée et terminées sont masquées
  selon la règle existante
- **AND** les sous-tâches terminées sont masquées sans révéler d'élément caché

#### Scenario: Notes et états vides

- **GIVEN** une tâche porte une note multiligne et un projet ne contient aucune
  étape
- **WHEN** le détail React est rendu
- **THEN** la note est affichée comme texte avec ses retours à la ligne
- **AND** le message d'état vide existant est affiché pour le projet sans étape

#### Scenario: Markup affiché littéralement

- **WHEN** un titre ou une note contient `<img src=x onerror=alert(1)>`
- **THEN** la chaîne est affichée littéralement
- **AND** aucun élément exécutable n'est créé à partir de ce texte

## ADDED Requirements

### Requirement: Stitch affordances are static and truthful

Les éléments Stitch approuvés par le propriétaire pour recherche, filtres, tri,
échéances/calendrier, métadonnées, partage/archivage et panneau projet SHALL
rester statiques ou nativement désactivés. Ils MUST NOT déclencher une action,
modifier l'état, créer une route ou persister une préférence ou donnée. Aucune
valeur métier absente MUST être simulée.

#### Scenario: Recherche, filtres et tri désactivés

- **GIVEN** la vue détaillée affiche les éléments visuels de recherche, filtre
  ou tri issus de Stitch
- **WHEN** l'utilisateur tente de les modifier ou les activer
- **THEN** les éléments restent inactifs
- **AND** les tâches visibles et leur ordre restent ceux des règles actuelles

#### Scenario: Échéance et calendrier sans effet

- **GIVEN** une tâche est affichée à côté d'un élément Stitch d'échéance ou de
  calendrier
- **WHEN** cet élément est activé ou reçoit une date
- **THEN** aucune date n'est enregistrée et aucun calendrier ou sélecteur actif
  n'est ouvert
- **AND** la tâche et ses exports restent inchangés

#### Scenario: Métadonnées absentes sans donnée fictive

- **GIVEN** le détail présente les emplacements Stitch de description,
  catégorie, code ou couverture
- **WHEN** ces propriétés n'existent pas dans le modèle projet actuel
- **THEN** aucune valeur, image ou donnée d'exemple n'est inventée
- **AND** les libellés statiques ou l'indication accessible d'indisponibilité ne
  sont pas présentés comme des données du projet

#### Scenario: Partage et archivage désactivés

- **GIVEN** le détail affiche les actions Stitch de partage ou d'archivage
- **WHEN** l'utilisateur tente de les activer
- **THEN** elles sont nativement désactivées ou non interactives
- **AND** aucun partage, archivage, changement de route ou écriture n'a lieu

#### Scenario: Panneau de projet sans activité simulée

- **GIVEN** le détail affiche la composition Stitch du panneau de prochaine
  action, progression ou activité
- **WHEN** une donnée correspondante n'est pas fournie par les règles et données
  existantes
- **THEN** aucun événement, compte, score ou texte d'activité de démonstration
  n'est affiché
- **AND** le panneau et ses commandes restent statiques/désactivés et
  accessibles
