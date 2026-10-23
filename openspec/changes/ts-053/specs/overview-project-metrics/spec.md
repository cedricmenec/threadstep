# Spec Delta

## Purpose

Fournir à la vue « Mes projets » une synthèse et des indicateurs par projet
calculés uniquement à partir du document métier déjà autorisé, pour connaître
l'activité restante, les urgences et l'avancement sans ouvrir chaque fiche.

## ADDED Requirements

### Requirement: Comptage des étapes d'un projet

Les métriques d'un projet SHALL compter chaque enregistrement de
`subject.items` une seule fois : total, terminés, en attente et urgences en
attente. Un projet est actif dès qu'au moins un enregistrement, parent ou
sous-tâche, n'est pas terminé.

#### Scenario: Parents et sous-tâches comptés séparément

- **GIVEN** un projet avec 2 étapes parentes et 1 sous-tâche
- **WHEN** les métriques du projet sont calculées
- **THEN** le total des étapes vaut 3
- **AND** chaque enregistrement n'est compté qu'une fois

#### Scenario: Projet sans étape

- **WHEN** les métriques d'un projet sans aucun enregistrement sont calculées
- **THEN** son total, ses étapes terminées, ses étapes en attente et ses
  urgences en attente valent 0
- **AND** il n'est pas considéré comme actif

#### Scenario: Parent terminé avec sous-tâche restante

- **GIVEN** un projet dont une étape parente est terminée et dont une
  sous-tâche reste à faire
- **WHEN** les métriques du projet sont calculées
- **THEN** le projet est actif
- **AND** l'étape terminée et la sous-tâche restante sont comptées séparément

#### Scenario: Urgence terminée exclue

- **GIVEN** une étape `priority: urgent` marquée `done: true`
- **WHEN** les urgences en attente sont calculées
- **THEN** cette étape n'est pas comptée comme urgence

### Requirement: Synthèse de la vue d'ensemble

Lorsque la lecture métier autorisée est achevée, la vue d'ensemble SHALL
afficher une synthèse unique contenant le nombre de projets actifs, le nombre
d'étapes en attente et le nombre d'urgences en attente, dérivés du document
affiché. Le nombre d'étapes en attente MUST apparaître une seule fois dans la
vue.

#### Scenario: Document sans projet

- **GIVEN** une lecture métier autorisée achevée sur un document vide
- **WHEN** la vue d'ensemble est affichée
- **THEN** la synthèse indique « 0 projet actif », « 0 étape en attente » et
  « 0 urgence en attente »

#### Scenario: Plusieurs projets avec accords français

- **GIVEN** un document exposant plusieurs projets dont certains sont actifs
- **WHEN** la synthèse est affichée
- **THEN** elle indique le nombre exact de projets actifs avec l'accord
  « projet actif » ou « projets actifs »
- **AND** elle indique le nombre exact d'étapes en attente avec l'accord
  « étape en attente » ou « étapes en attente »
- **AND** elle indique le nombre exact d'urgences en attente avec l'accord
  « urgence en attente » ou « urgences en attente »

#### Scenario: Le nombre d'étapes en attente n'est pas dupliqué

- **GIVEN** une vue d'ensemble affichant la synthèse
- **WHEN** le nombre d'étapes en attente est présenté
- **THEN** il apparaît une seule fois dans la zone de synthèse globale
- **AND** aucune seconde zone globale n'affiche le même nombre

#### Scenario: Projets actifs fondés sur les enregistrements restants

- **GIVEN** un document contenant un projet dont seule une sous-tâche reste à
  faire et un autre projet entièrement terminé
- **WHEN** la synthèse est calculée
- **THEN** le premier projet est compté actif et le second ne l'est pas
- **AND** les étapes en attente et les urgences en attente incluent les
  sous-tâches restantes

### Requirement: Compteur d'urgences restantes par carte

Chaque carte projet SHALL afficher le nombre d'urgences restantes du sujet, y
compris les sous-tâches urgentes inachevées, indépendamment du filtre
d'affichage. Une étape urgente terminée MUST NOT être comptée.

#### Scenario: Sous-tâche urgente comptée

- **GIVEN** un projet contenant une sous-tâche `priority: urgent` et `done: false`
- **WHEN** sa carte projet est affichée
- **THEN** son compteur d'urgences restantes inclut cette sous-tâche

#### Scenario: Filtre sans effet sur le compteur

- **GIVEN** une carte projet dont les étapes terminées sont masquées
- **WHEN** le compteur d'urgences restantes est affiché
- **THEN** il conserve le même nombre que lorsque toutes les étapes sont visibles
- **AND** une urgence terminée ou masquée n'est jamais comptée

#### Scenario: Projet sans urgence

- **WHEN** une carte projet ne contient aucune urgence inachevée
- **THEN** son compteur indique « 0 urgence restante »
- **AND** l'information reste perceptible sans couleur

### Requirement: Progression textuelle par carte

Chaque carte projet SHALL afficher « X / Y étape(s) terminée(s) (Z %) » où X est
le nombre d'enregistrements terminés, Y le total des enregistrements et Z
l'arrondi à l'entier le plus proche de `100 × X / Y`. Un sujet sans étape SHALL
afficher « Aucune étape » sans pourcentage.

#### Scenario: Deux étapes terminées sur trois

- **GIVEN** un projet avec 2 étapes parentes et 1 sous-tâche, dont 1 parent et
  la sous-tâche sont terminés
- **WHEN** sa progression est affichée
- **THEN** elle indique « 2 / 3 étapes terminées (67 %) »

#### Scenario: Aucune étape terminée

- **GIVEN** un projet avec plusieurs étapes et aucune étape terminée
- **WHEN** sa progression est affichée
- **THEN** elle indique « 0 / N étapes terminées (0 %) »
- **AND** ce zéro représente les étapes réelles du projet

#### Scenario: Toutes les étapes terminées

- **GIVEN** un projet dont toutes les étapes sont terminées
- **WHEN** sa progression est affichée
- **THEN** elle indique « Y / Y étapes terminées (100 %) »

#### Scenario: Projet sans étape

- **GIVEN** un projet sans aucun enregistrement d'étape
- **WHEN** sa progression est affichée
- **THEN** elle indique « Aucune étape »
- **AND** aucun pourcentage n'est affiché

#### Scenario: Une seule étape

- **GIVEN** un projet avec une seule étape terminée
- **WHEN** sa progression est affichée
- **THEN** le libellé utilise l'accord singulier « 1 / 1 étape terminée (100 %) »

#### Scenario: Sous-tâches incluses une seule fois

- **GIVEN** un projet avec un parent et deux sous-tâches, tous terminés
- **WHEN** sa progression est calculée
- **THEN** le total vaut 3 et le nombre de terminés vaut 3
- **AND** aucune étape n'est comptée deux fois

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

### Requirement: Recalcul après mutation et actualisation

Après toute mutation métier autorisée ou actualisation de données, les
métriques SHALL être recalculées à partir de l'état métier courant, sans
lecture réseau supplémentaire ni listener dédié.

#### Scenario: Création et complétion

- **GIVEN** la vue d'ensemble affichée avec ses indicateurs
- **WHEN** une étape est créée puis terminée
- **THEN** la synthèse et la carte reflètent immédiatement le nouvel état
- **AND** le nombre d'étapes en attente diminue de un à la complétion

#### Scenario: Changement de priorité et promotion

- **WHEN** une étape passe à `urgent`, cesse d'être urgente ou est promue en
  tâche principale
- **THEN** les compteurs d'urgences et la progression sont recalculés depuis le
  document courant
- **AND** aucun déplacement d'étape n'est induit

#### Scenario: Suppression puis annulation

- **GIVEN** une étape visible contribuant aux indicateurs
- **WHEN** elle est supprimée puis restaurée par « Annuler » dans la fenêtre
- **THEN** les indicateurs reviennent aux valeurs précédentes exactes

#### Scenario: Import, restauration et actualisation

- **WHEN** un import ou une restauration autorisés remplacent le document, ou
  qu'une actualisation Dexie ou inter-onglets fournit un nouvel état
- **THEN** la synthèse et les cartes sont recalculées depuis ce nouvel état
- **AND** aucune lecture réseau, écriture ou synchronisation supplémentaire
  n'est créée par les indicateurs

### Requirement: Accessibilité et lisibilité mobile

Les indicateurs SHALL être rendus comme du texte perceptible sans couleur
seule, sans HTML interprété, sans annonce répétée pour un état inchangé,
lisibles et sans débordement sur mobile, sans rendre la carte inopérante au
clavier ou au lecteur d'écran.

#### Scenario: Texte utilisateur non interprété

- **GIVEN** un titre ou un libellé contenant une balise comme
  `<img src=x onerror=alert(1)>`
- **WHEN** une carte ou la synthèse est affichée
- **THEN** le contenu est rendu comme du texte littéral
- **AND** aucun élément n'est créé à partir de ce texte

#### Scenario: Compréhension sans couleur

- **WHEN** les indicateurs sont affichés
- **THEN** les nombres et les libellés suffisent à comprendre les urgences et
  la progression
- **AND** aucune information n'est portée par la couleur seule

#### Scenario: Rafraîchissement identique non réannoncé

- **GIVEN** une synthèse déjà affichée
- **WHEN** plusieurs rendus produisent le même contenu
- **THEN** le texte de synthèse n'est pas réécrit
- **AND** aucune annonce accessible supplémentaire n'est produite
- **AND** un changement réel de compte, de base ou de nombre est reflété

#### Scenario: Mobile et clavier

- **GIVEN** un viewport mobile étroit et une navigation au clavier
- **WHEN** la synthèse et les cartes sont affichées ou parcourues
- **THEN** les libellés se replient sans débordement horizontal
- **AND** les cartes restent identifiables et leurs contrôles existants restent
  accessibles au clavier et au lecteur d'écran

### Requirement: Comportement existant et continuité préservés

L'ajout des métriques SHALL préserver le filtre, l'aperçu de cinq parents,
l'ordre, les compteurs existants, la suggestion, la reprise, le focus, le
défilement, les groupes développés et les brouillons ; il MUST NOT déplacer un
projet ou une tâche.

#### Scenario: Filtre et aperçu inchangés

- **GIVEN** le filtre « Masquer les étapes terminées » et l'aperçu de cinq
  parents
- **WHEN** les indicateurs sont affichés
- **THEN** le filtre, l'ordre, la limite de cinq parents et les compteurs
  existants restent inchangés
- **AND** les métriques restent calculées sur le document complet

#### Scenario: Focus, défilement et repli conservés

- **GIVEN** une carte ou une tâche focalisée et un défilement éloigné du haut
- **WHEN** une complétion, un changement de priorité, une suppression ou une
  annulation met à jour les indicateurs
- **THEN** le focus reste sur un contrôle présent et pertinent
- **AND** l'ancrage de défilement et le repli des sous-tâches applicables sont
  conservés

#### Scenario: Suggestion et reprise indépendantes

- **WHEN** les indicateurs sont calculés ou affichés
- **THEN** la suggestion « Une étape pour maintenant » et la carte
  « Je reprends ici » restent inchangées et suivent leurs règles propres
- **AND** aucun projet ni aucune tâche n'est réordonné ou déplacé
