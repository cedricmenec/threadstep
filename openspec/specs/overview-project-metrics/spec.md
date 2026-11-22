# overview-project-metrics Specification

## Purpose

Fournir à la liste « Mes projets » les comptes canoniques de tâches et
d'urgences par projet, calculés uniquement à partir du document métier déjà
autorisé. La page principale reste une liste de navigation concise.

## Requirements

### Requirement: Task and urgency counts on project cards

Chaque carte de projet SHALL afficher le nombre de tâches principales
enregistrées, terminées comprises et sous-tâches exclues, ainsi que le nombre
d'éléments urgents non terminés, sous-tâches comprises. Ces comptes MUST être
dérivés du document métier déjà autorisé et indépendants des filtres ou de la
présentation.

#### Scenario: Canonical total and urgency counts

- **GIVEN** un projet avec deux tâches principales, une terminée, une sous-tâche urgente ouverte et une urgence terminée
- **WHEN** les comptes de la carte sont calculés
- **THEN** le nombre total de tâches principales vaut 2
- **AND** le nombre d'urgences restantes vaut 1

#### Scenario: Projet sans tâche principale

- **WHEN** les comptes d'un projet sans tâche sont calculés
- **THEN** son nombre total et son nombre d'urgences restantes valent 0

### Requirement: Indicateurs purement dérivés

L'affichage des métriques SHALL être purement dérivé du document métier déjà
autorisé : aucune colonne, préférence, clé de stockage, écriture,
synchronisation, requête réseau ou modification de l'export/import MUST être
créée par leur lecture ou leur rendu.

#### Scenario: Rendu sans écriture

- **GIVEN** un document affiché et des indicateurs calculés
- **WHEN** la vue d'ensemble est rendue ou rerendue
- **THEN** le document, les identifiants, les priorités, les états `done`, les
  relations parentes et les ordres sont inchangés
- **AND** aucune écriture de stockage, synchronisation ou requête réseau n'est
  déclenchée

#### Scenario: Export et import inchangés

- **GIVEN** un document affiché avec ses indicateurs
- **WHEN** il est exporté puis réimporté
- **THEN** la forme de sauvegarde et les enregistrements métier sont identiques
- **AND** aucun champ d'indicateur, de préférence ou de progression n'est ajouté

#### Scenario: Source unique déjà autorisée

- **WHEN** les métriques sont calculées
- **THEN** elles utilisent uniquement `documentState` après la lecture métier
  autorisée
- **AND** elles n'ouvrent aucune base, n'ajoutent ni `liveQuery`, ni requête
  Dexie, ni listener Cloud, ni opération d'authentification

### Requirement: Counts update with the current project document

Après une mutation métier autorisée ou une actualisation de données, les
compteurs visibles SHALL être recalculés à partir de l'état métier courant,
sans lecture réseau supplémentaire ni listener dédié.

#### Scenario: Création et complétion

- **GIVEN** la vue d'ensemble affichée avec ses indicateurs
- **WHEN** une tâche est créée, supprimée, terminée ou restaurée
- **THEN** le total de tâches principales et les urgences restantes de la carte reflètent immédiatement le nouvel état

#### Scenario: Changement de priorité et promotion

- **WHEN** une étape passe à `urgent`, cesse d'être urgente ou est promue en
  tâche principale
- **THEN** le compteur d'urgences restantes est recalculé depuis le document courant
- **AND** aucun déplacement de tâche n'est induit

#### Scenario: Suppression puis annulation

- **GIVEN** une étape visible contribuant aux indicateurs
- **WHEN** elle est supprimée puis restaurée par « Annuler » dans la fenêtre
- **THEN** les indicateurs reviennent aux valeurs précédentes exactes

#### Scenario: Import, restauration et actualisation

- **WHEN** un import ou une restauration autorisés remplacent le document, ou
  qu'une actualisation Dexie ou inter-onglets fournit un nouvel état
- **THEN** les compteurs des cartes sont recalculés depuis ce nouvel état
- **AND** aucune lecture réseau, écriture ou synchronisation supplémentaire
  n'est créée par les indicateurs

### Requirement: Accessible project counts

Les indicateurs SHALL être rendus comme du texte perceptible sans couleur
seule, sans HTML interprété, sans annonce répétée pour un état inchangé,
lisibles et sans débordement sur mobile, sans rendre la carte inopérante au
clavier ou au lecteur d'écran.

#### Scenario: Texte utilisateur non interprété

- **GIVEN** un titre ou un libellé contenant une balise comme
  `<img src=x onerror=alert(1)>`
- **WHEN** une carte est affichée
- **THEN** le contenu est rendu comme du texte littéral
- **AND** aucun élément n'est créé à partir de ce texte

#### Scenario: Compréhension sans couleur

- **WHEN** les indicateurs sont affichés
- **THEN** les nombres et les libellés suffisent à comprendre les deux comptes
- **AND** aucune information n'est portée par la couleur seule

#### Scenario: Rafraîchissement identique non réannoncé

- **GIVEN** une carte déjà affichée
- **WHEN** plusieurs rendus produisent le même contenu
- **THEN** ses libellés restent stables
- **AND** aucune annonce accessible supplémentaire n'est produite
- **AND** un changement réel de compte, de base ou de nombre est reflété

#### Scenario: Mobile et clavier

- **GIVEN** un viewport mobile étroit et une navigation au clavier
- **WHEN** la synthèse et les cartes sont affichées ou parcourues
- **THEN** les libellés se replient sans débordement horizontal
- **AND** la commande d'ouverture reste accessible au clavier et au lecteur d'écran
