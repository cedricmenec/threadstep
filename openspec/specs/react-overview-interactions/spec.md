# react-overview-interactions Specification

## Purpose
Décrire le comportement observable des commandes et éditeurs de la surface
React Overview : une intention produit au plus une mutation déléguée, la saisie
et le contexte restent continus, et les interactions ne modifient que les
règles métier canoniques existantes.

## Requirements

### Requirement: Interaction ownership of the Overview card surface

Dans la vue `#/`, les commandes et éditeurs internes aux cartes SHALL être
rendus et gérés par la surface React bornée qui possède `#subjects`. Aucun
gestionnaire vanilla concurrent MUST modifier ce sous-arbre ou recevoir une
seconde activation du même contrôle.

#### Scenario: Active Overview surface owns card controls

- **WHEN** la vue `#/` affiche des cartes par la surface React bornée
- **THEN** la création, l'édition, la priorité, la complétion, le menu, la
  sous-étape, le retrait, l'annulation et le déplacement sont rendus dans cette
  surface
- **AND** aucun contrôle interne de carte n'est attaché une seconde fois par le
  contrôleur vanilla
- **AND** les filtres, la suggestion, la reprise, les urgences et le compteur
  global restent hors de cette surface

#### Scenario: Detail and other routes keep their existing interaction owner

- **WHEN** la route quitte `#/` pour `#/sujet/<id>` ou une page de paramètres
- **THEN** la surface Overview est démontée avant la surface suivante
- **AND** le détail projet et les zones vanilla conservent leurs gestionnaires
  existants sans duplication avec Overview

### Requirement: At most one delegated mutation per user intention

Chaque activation SHALL produire au plus une commande métier nommée et au plus
une écriture persistée déléguées au contrôleur existant. Une action de
présentation seule MUST NOT écrire de donnée, de préférence ou de clé de
stockage.

#### Scenario: Creating a valid task writes once

- **GIVEN** une carte Overview affichée avec un formulaire de création
- **WHEN** l'utilisateur soumet une fois un titre valide
- **THEN** exactement une commande de création est émise
- **AND** au plus une écriture persistée est déclenchée
- **AND** le champ de saisie est réinitialisé pour la prochaine action

#### Scenario: Saving an edit writes once

- **GIVEN** l'éditeur d'une tâche affiche son titre, sa priorité et sa note
- **WHEN** l'utilisateur active une fois « Enregistrer » avec des valeurs valides
- **THEN** exactement une commande de mise à jour est émise
- **AND** au plus une écriture persistée est déclenchée
- **AND** aucune seconde commande n'est produite par un gestionnaire dupliqué

#### Scenario: Presentation-only actions write nothing

- **GIVEN** une carte, une tâche ou un menu affiché
- **WHEN** l'utilisateur ouvre ou ferme un menu, replie ou déplie des
  sous-tâches, change le filtre d'affichage ou annule un déplacement
- **THEN** aucune commande métier ni écriture persistée n'est émise
- **AND** les données, l'export et les compteurs restent inchangés

#### Scenario: Commands refused by the controller stay write-free

- **GIVEN** une commande reçoit un identifiant inconnu, une valeur invalide ou
  une opération sans effet
- **WHEN** elle est activée depuis Overview
- **THEN** le contrôleur refuse l'intention
- **AND** aucune écriture persistée ni mutation parallèle n'est observée

### Requirement: Overview editors preserve parity, draft and validation

Les éditeurs et formulaires SHALL conserver les composants, libellés,
validations, préremplissages et commandes du rendu livré. Une saisie non
enregistrée MUST rester dans le composant lors d'une actualisation de même vue,
et une validation refusée ou une annulation MUST NOT persister de brouillon.

#### Scenario: Unsaved draft survives a same-context refresh

- **GIVEN** l'éditeur ou le formulaire de création d'Overview contient une
  saisie non enregistrée
- **WHEN** une actualisation de données de la même vue et de la même identité
  met à jour les cartes
- **THEN** la surface reste montée et la saisie est conservée
- **AND** aucune sauvegarde n'est déclenchée par l'actualisation

#### Scenario: Invalid title or note is rejected without a write

- **GIVEN** un éditeur contient un titre vide, un titre trop long ou une note
  dépassant la limite canonique
- **WHEN** l'utilisateur tente d'enregistrer
- **THEN** le document et le stockage restent inchangés
- **AND** le message de validation français existant est affiché
- **AND** aucune commande de mise à jour persistante n'est émise

#### Scenario: Cancel discards the draft without a write

- **GIVEN** l'éditeur d'une tâche contient des valeurs modifiées
- **WHEN** l'utilisateur active « Annuler »
- **THEN** l'édition se ferme sans modifier le document
- **AND** aucune écriture persistée n'est déclenchée
- **AND** le focus rejoint un contrôle réellement présent et pertinent

### Requirement: React-owned drag presentation with one final mutation

Le glisser-déposer des tâches Overview SHALL être présenté par un état local à
la surface React. Un dépôt valide SHALL émettre exactement une commande de
réordonnancement et au plus une écriture ; un dépôt invalide, `Échap` ou
`pointercancel` MUST n'écrire aucune donnée.

#### Scenario: Valid drop reorders once

- **GIVEN** une poignée de déplacement Overview est activée sur une tâche
- **WHEN** l'utilisateur la dépose sur une cible valide de même sujet et de même
  priorité
- **THEN** exactement une commande de réordonnancement est émise
- **AND** au plus une écriture persistée est déclenchée
- **AND** l'indicateur visuel de dépôt disparaît après le geste

#### Scenario: Invalid drop writes nothing

- **GIVEN** un drag Overview est en cours
- **WHEN** la cible est un autre sujet, une autre priorité, une sous-étape ou
  un espace vide
- **THEN** aucune commande de réordonnancement n'est émise
- **AND** aucune écriture persistée n'est déclenchée

#### Scenario: Escape or pointer cancellation writes nothing

- **GIVEN** un drag Overview est en cours
- **WHEN** l'utilisateur presse `Échap`, le pointeur est annulé ou la surface
  est invalidée
- **THEN** aucune donnée n'est déplacée ni persistée
- **AND** aucune session de drag ni écouteur de l'ancienne surface ne reste
  actif

#### Scenario: Detail drag behavior is unchanged

- **WHEN** une tâche est déplacée depuis le détail projet
- **THEN** son comportement, ses commandes et ses écritures restent ceux du
  rendu livré
- **AND** la session de drag spécifique à Overview n'est pas active

### Requirement: Interaction continuity across in-place updates

Les commandes et éditeurs SHALL préserver le focus pertinent, l'ancrage de
scroll, les menus ouverts, les parents développés et les brouillons encore
valides lors d'une mise à jour de même vue et de même identité. Une navigation
explicite, un rechargement, un import/restauration réussi ou un changement
d'identité SHALL réinitialiser ces états selon `ux-interaction-continuity`.

#### Scenario: Open menu stays open and focused after refresh

- **GIVEN** le menu d'une tâche Overview est ouvert et le focus est sur une de
  ses commandes
- **WHEN** une actualisation de données de même contexte survient
- **THEN** le menu reste ouvert et le focus reste sur un nœud connecté
- **AND** aucune commande métier n'est déclenchée par l'actualisation

#### Scenario: Collapse and completion preserve the reading anchor

- **GIVEN** une liste longue est affichée et l'utilisateur travaille loin du
  haut de page
- **WHEN** il replie un groupe, change une priorité, coche une tâche ou déplace
  une tâche
- **THEN** la surface ne remonte pas arbitrairement en haut de page
- **AND** le focus rejoint un contrôle présent et pertinent
- **AND** les autres groupes gardent leur état d'ouverture applicable

#### Scenario: Explicit boundary resets transient interaction state

- **WHEN** l'utilisateur change de route, recharge la page, importe un document
  ou change d'identité autorisée
- **THEN** les menus, éditeurs, brouillons et parents développés sont
  réinitialisés selon les spécifications canoniques
- **AND** aucun état du contexte précédent n'est réutilisé

### Requirement: Context isolation at blocking and workspace boundaries

Un changement d'identité, d'espace, de liaison ou une lecture bloquante SHALL
libérer la surface d'interaction avant tout affichage ou rendu vanilla. Aucun
brouillon, menu, cible de drag, commande en attente ou Undo du contexte
précédent MUST être réutilisé, exposé ou écrit dans le nouveau contexte.

#### Scenario: Workspace change releases an active editor

- **GIVEN** un éditeur ou un drag Overview est actif pour l'espace A
- **WHEN** l'espace B devient autorisé ou que la lecture devient bloquante
- **THEN** la surface de A est démontée avant l'affichage de B
- **AND** aucun contenu, brouillon ou cible de A n'est visible ou réutilisé
- **AND** aucune écriture ni requête supplémentaire n'est déclenchée par la
  transition

#### Scenario: Late event from the previous workspace is ignored

- **GIVEN** des interactions affichées appartiennent à l'espace A
- **WHEN** un événement tardif de A arrive après l'affichage de B
- **THEN** aucune carte, commande ou cible de A n'est réintroduite
- **AND** aucune donnée de A n'est écrite dans B

#### Scenario: Blocked read exposes no interaction data

- **GIVEN** la lecture métier n'est pas autorisée ou reste bloquante
- **WHEN** la vue `#/` est affichée
- **THEN** aucun éditeur, menu, brouillon, carte ou compteur de carte n'est
  rendu
- **AND** les états de chargement ou d'action requise prévus par
  `overview-project-read-state` restent seuls affichés

### Requirement: Interaction parity and safe rendering

Les commandes et éditeurs Overview SHALL conserver les éléments HTML, classes,
`data-*`, libellés français, noms accessibles, ordres de lecture et cibles
tactiles du rendu livré. Les contenus utilisateur MUST rester des nœuds texte
et aucune route, dépendance ou clé de stockage ne doit être ajoutée.

#### Scenario: Controls keep their classes, names and order

- **WHEN** une carte, une tâche, un éditeur et un menu Overview sont rendus
- **THEN** les contrôles, libellés, classes, `data-*`, noms accessibles et ordres
  de lecture restent ceux du rendu livré
- **AND** les cibles interactives conservent la taille tactile existante

#### Scenario: User markup is rendered literally

- **GIVEN** un titre, une note ou un nom accessible contient du markup
- **WHEN** une carte, une tâche ou un message de validation est rendu
- **THEN** le contenu reste un nœud texte
- **AND** aucun élément exécutable n'est créé

#### Scenario: Completed filter suspends reordering without changing data

- **GIVEN** « Masquer les étapes terminées » est actif
- **WHEN** les tâches Overview sont rendues
- **THEN** les commandes de réordonnancement sont indisponibles comme dans le
  rendu livré
- **AND** l'ordre stocké et les données restent inchangés

#### Scenario: No route or storage change

- **WHEN** les modules d'interaction et le build sont inspectés
- **THEN** aucune route, clé de stockage, préférence persistée, dépendance ou
  ressource réseau n'est ajoutée
- **AND** l'export/import et la CSP restent inchangés

### Requirement: Preserved platform and business boundaries

Le changement SHALL préserver les routes hash, Dexie/IndexedDB, l'identité
d'espace, l'OTP, le consentement, la sauvegarde et la restauration. Une
synchronisation de fond de même contexte MUST être traitée comme une mise à
jour en place, jamais comme une navigation ou un nouveau formulaire.

#### Scenario: Background synchronization updates cards in place

- **GIVEN** des cartes et un éditeur sont affichés sous une identité autorisée
- **WHEN** une synchronisation de fond fournit un nouvel état sans changer de
  vue ni d'identité
- **THEN** les cartes sont mises à jour dans la surface existante
- **AND** aucun chargement ne remplace la liste et aucune navigation n'est
  déclenchée
- **AND** aucune lecture, écriture ou requête Cloud supplémentaire n'est
  provoquée par la présentation

#### Scenario: Existing hash navigation and persistence still apply

- **WHEN** une carte, « Voir plus » ou une commande de retour est activée
- **THEN** la route et l'historique existants sont utilisés
- **AND** les mutations passent toujours par le contrôleur et le flux de
  persistance existants

### Requirement: Deterministic verification without simulated human proof

Les invariants automatisables SHALL être couverts par des tests déterministes
sur données synthétiques, sans navigateur réel, sans réseau et sans donnée
personnelle. Les dimensions visuelles, tactiles, clavier, mobile et
lecteur d'écran MUST rester des vérifications humaines distinctes et ne MUST
pas être présentées comme prouvées par la CI.

#### Scenario: Deterministic tests use synthetic data only

- **WHEN** les tests TS-065 des interactions et éditeurs s'exécutent
- **THEN** ils utilisent des espions et des fixtures synthétiques
- **AND** ils n'ouvrent aucune base réelle, n'appellent aucun service Cloud,
  OTP ou réseau et ne lisent aucune donnée personnelle

#### Scenario: Automated assertions cover the interaction contract

- **WHEN** les tests ciblés s'exécutent
- **THEN** ils couvrent l'unicité des commandes et écritures, les validations,
  l'annulation, les brouillons, le focus simulé, le scroll simulé, le drag et
  l'isolation des contextes

#### Scenario: Human acceptance is reported separately

- **WHEN** une CI ou une suite jsdom réussit
- **THEN** elle n'est pas présentée comme une validation visuelle, tactile,
  clavier, Chrome Android ou lecteur d'écran réelle
- **AND** ces scénarios restent explicitement à effectuer dans la recette
  manuelle
