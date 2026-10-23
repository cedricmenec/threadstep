# Spec Delta

## Purpose

Permettre à la vue « Mes projets » d'isoler temporairement les projets qui
contiennent encore une urgence en attente, sans tri persistant, sans écriture
et sans modifier les compteurs globaux ni les règles de suggestion et de
reprise.

## ADDED Requirements

### Requirement: Contrôle de filtre accessible et explicite

La vue Overview SHALL proposer un unique contrôle à deux états nommés
« Tous les projets » et « Projets avec urgences », placé à proximité de la
liste et indépendant du filtre « Masquer les étapes terminées ». L'état initial
MUST être « Tous les projets ». Le contrôle MUST être utilisable au clavier et
au toucher, avec un focus visible, une cible d'au moins 44 × 44 px et un état
coché annoncé nativement.

#### Scenario: État initial sur tous les projets

- **GIVEN** une lecture métier autorisée achevée et aucun changement de filtre
- **WHEN** la vue Overview est affichée
- **THEN** « Tous les projets » est l'état actif
- **AND** tous les projets autorisés restent affichés dans leur ordre d'origine

#### Scenario: Activation sans changement de navigation

- **GIVEN** le filtre est sur « Tous les projets »
- **WHEN** l'utilisateur active « Projets avec urgences »
- **THEN** seules les cartes des projets correspondants restent visibles
- **AND** la route, l'URL et l'historique navigateur restent inchangés
- **AND** réactiver « Tous les projets » restaure toutes les cartes

#### Scenario: Utilisation au clavier et au toucher

- **GIVEN** le contrôle est affiché
- **WHEN** il est atteint au clavier puis activé par Entrée ou Espace, ou touché
- **THEN** l'état demandé devient actif une seule fois
- **AND** le focus reste visible et la cible tactile respecte au moins 44 × 44 px

#### Scenario: Un seul contrôle et aucune annonce dupliquée

- **GIVEN** la vue Overview est rendue
- **WHEN** le contrôle de filtre est présent
- **THEN** ses deux libellés apparaissent une seule fois
- **AND** son état provient de l'état coché natif, sans nouvelle région
  `aria-live` ajoutée pour le répéter

### Requirement: Sélection fondée sur l'urgence en attente

En mode « Projets avec urgences », un sujet SHALL être affiché si et seulement
s'il contient au moins une étape `priority: urgent` et `done: false`, parent ou
sous-tâche. La sélection MUST réutiliser la définition d'urgence en attente de
TS-053 et MUST NOT dépendre du fait que le parent soit terminé, replié ou
affiché.

#### Scenario: Sous-tâche urgente sous un parent terminé et replié

- **GIVEN** un projet dont le parent est terminé et dont une sous-tâche urgente
  reste à faire
- **WHEN** le mode « Projets avec urgences » est actif et le parent est replié
- **THEN** le projet est affiché

#### Scenario: Urgence terminée exclue

- **GIVEN** un projet dont la seule étape urgente est marquée `done: true`
- **WHEN** le mode « Projets avec urgences » est calculé
- **THEN** le projet n'est pas affiché

#### Scenario: Urgence dépriorisée exclue

- **GIVEN** un projet dont la seule étape urgente passe à `normal` ou `later`
- **WHEN** le mode « Projets avec urgences » est recalculé
- **THEN** le projet n'est plus affiché

#### Scenario: Projet sans urgence ou sans étape

- **GIVEN** un projet sans aucune urgence en attente, ou un projet sans étape
- **WHEN** le mode « Projets avec urgences » est calculé
- **THEN** le projet n'est pas affiché
- **AND** aucun statut projet différent n'est créé

#### Scenario: Étape urgente principale

- **GIVEN** un projet dont une étape principale est urgente et non terminée
- **WHEN** le mode « Projets avec urgences » est calculé
- **THEN** le projet est affiché

### Requirement: Ordre, aperçu et interactions préservés

Le filtre urgent SHALL conserver l'ordre d'origine des sujets, la limite de
cinq parents visibles par carte et toutes les interactions existantes. Il MUST
s'appliquer aux projets uniquement : les étapes affichées dans une carte
restent régies par l'aperçu et par « Masquer les étapes terminées ».

#### Scenario: Ordre d'origine conservé

- **GIVEN** trois projets A, B et C dans cet ordre, où B ne contient aucune
  urgence en attente
- **WHEN** le mode « Projets avec urgences » est actif
- **THEN** les cartes visibles apparaissent dans l'ordre A puis C
- **AND** aucune carte n'est triée ou déplacée selon l'urgence

#### Scenario: Aperçu de cinq parents conservé

- **GIVEN** un projet retenu contenant plus de cinq parents visibles
- **WHEN** sa carte est affichée sous le filtre urgent
- **THEN** au plus cinq parents sont rendus
- **AND** le contrôle « Voir plus » existant reste disponible selon la règle
  de l'aperçu

#### Scenario: Filtres d'étapes indépendants

- **GIVEN** une sous-tâche urgente non terminée et un parent terminé
- **WHEN** « Masquer les étapes terminées » est activé ou désactivé
- **THEN** le filtre urgent continue de retenir le projet
- **AND** l'affichage des étapes à l'intérieur de la carte suit uniquement le
  filtre « Masquer les étapes terminées » et l'aperçu existants
- **AND** aucune étape urgente non terminée n'est masquée par le filtre urgent

#### Scenario: Interactions existantes intactes

- **GIVEN** une carte retenue par le filtre urgent
- **WHEN** l'utilisateur ouvre, replie, modifie, réordonne ou termine une étape
- **THEN** les contrôles et gestes existants se comportent comme sans filtre
- **AND** aucune priorité, relation de parenté ou complétion n'est modifiée par
  le seul filtrage

### Requirement: État vide filtré et retour à tous les projets

Quand le mode « Projets avec urgences » est actif et qu'aucun projet ne
correspond, l'interface SHALL afficher exactement « Aucun projet avec urgence
en attente » avec une action de retour vers « Tous les projets ». Elle MUST NOT
présenter le message d'absence générale de projet dans cet état.

#### Scenario: Aucun projet correspondant

- **GIVEN** une lecture métier autorisée achevée et aucun projet avec urgence
  en attente
- **WHEN** le mode « Projets avec urgences » est actif
- **THEN** le message « Aucun projet avec urgence en attente » est affiché
- **AND** une action « Tous les projets » est disponible
- **AND** le message « Aucun sujet pour le moment » n'est pas affiché

#### Scenario: Retour depuis l'état vide

- **GIVEN** l'état vide filtré est affiché
- **WHEN** l'utilisateur active « Tous les projets »
- **THEN** toutes les cartes autorisées réapparaissent dans leur ordre d'origine
- **AND** le contrôle revient à l'état « Tous les projets »
- **AND** aucune écriture de données n'est effectuée

#### Scenario: Document réellement vide en mode tous

- **GIVEN** un document autorisé sans aucun projet et le mode « Tous les projets »
- **WHEN** la vue Overview est affichée
- **THEN** le message d'absence générale existant est conservé
- **AND** il n'est pas remplacé par le message propre au filtre urgent

### Requirement: Durée de vie transitoire et réinitialisations

Le filtre SHALL vivre uniquement en mémoire pendant la visite courante et les
rafraîchissements autorisés du même espace. Il MUST être réinitialisé à « Tous
les projets » lors d'une véritable entrée de vue, d'un rechargement, d'un
changement d'espace ou de compte, et d'un import ou d'une restauration réussis.
Il MUST NOT être persisté, exporté, synchronisé ni encodé dans l'URL.

#### Scenario: Mutation locale et Undo dans la même vue

- **GIVEN** le mode « Projets avec urgences » actif sur Overview
- **WHEN** une étape est créée, terminée, dépriorisée, supprimée puis restaurée
  par « Annuler » dans la même vue et le même espace
- **THEN** le filtre reste actif et le résultat est recalculé
- **AND** un projet dont la dernière urgence disparaît quitte le résultat
- **AND** un projet dont l'urgence est restaurée réapparaît

#### Scenario: Actualisation Dexie ou inter-onglets

- **GIVEN** le mode « Projets avec urgences » actif
- **WHEN** une actualisation Dexie ou un événement inter-onglets fournit un
  nouvel état dans le même espace et la même route
- **THEN** le filtre reste actif et les cartes sont recalculées
- **AND** aucun rechargement de page n'est provoqué par ce seul événement

#### Scenario: Véritable entrée de vue

- **GIVEN** le mode « Projets avec urgences » actif
- **WHEN** l'utilisateur quitte Overview puis y revient par navigation, y
  compris avec Précédent ou Suivant
- **THEN** le filtre est revenu à « Tous les projets »
- **AND** aucun projet n'est filtré par l'état de la visite précédente

#### Scenario: Rechargement ou nouvel onglet

- **WHEN** la page est réellement rechargée ou ouverte dans un nouvel onglet
- **THEN** le filtre est à « Tous les projets »
- **AND** aucune préférence de filtre n'est relue depuis un stockage

#### Scenario: Changement d'espace ou de compte

- **GIVEN** le mode « Projets avec urgences » actif dans l'espace A
- **WHEN** l'espace ou le compte autorisé devient B
- **THEN** le filtre est réinitialisé à « Tous les projets »
- **AND** aucune carte ni résultat de l'espace A n'est conservé

#### Scenario: Import ou restauration réussis

- **WHEN** un import ou une restauration autorisés réussissent
- **THEN** le filtre revient à « Tous les projets »
- **AND** le résultat est dérivé du document remplacé, sans préférence écrite

#### Scenario: Aucune persistance ni synchronisation

- **WHEN** le filtre est activé, désactivé ou réinitialisé
- **THEN** aucune clé de stockage, aucun champ d'export, aucune requête réseau,
  aucune synchronisation et aucun fragment d'URL ne porte son état

### Requirement: Indicateurs globaux et révélation des cibles masquées

Les compteurs globaux TS-053, la suggestion « Une étape pour maintenant » et la
carte « Je reprends ici » SHALL rester globaux et identiques avec ou sans
filtre. Une action « Voir dans la liste » MUST rester utilisable pour un projet
momentanément masqué, en révélant l'action ciblée par la vue de détail ou par le
retour à « Tous les projets », sans changer les priorités ni sauvegarder.

#### Scenario: Chiffres globaux identiques

- **GIVEN** un document avec plusieurs projets et des urgences en attente
- **WHEN** le filtre urgent est activé puis désactivé
- **THEN** les nombres de projets actifs, d'étapes en attente et d'urgences en
  attente restent identiques
- **AND** ils continuent de compter les projets masqués par le filtre

#### Scenario: Suggestion ciblant un projet masqué

- **GIVEN** le mode « Projets avec urgences » actif et une suggestion globale
  portant sur un projet sans urgence en attente
- **WHEN** l'utilisateur active « Voir dans la liste » sur la suggestion
- **THEN** l'action ciblée devient accessible par la vue de détail du projet ou
  par le retour à « Tous les projets »
- **AND** aucune priorité, complétion, préférence ou donnée n'est modifiée

#### Scenario: Reprise ciblant un projet masqué

- **GIVEN** le mode « Projets avec urgences » actif et « Je reprends ici »
  portant sur un projet sans urgence en attente
- **WHEN** l'utilisateur active « Voir dans la liste » sur la reprise
- **THEN** l'étape suivie devient accessible de façon sûre
- **AND** la préférence de reprise reste inchangée

#### Scenario: Cible visible sous le filtre

- **GIVEN** le mode « Projets avec urgences » actif et une cible située dans un
  projet retenu
- **WHEN** « Voir dans la liste » est activé
- **THEN** le comportement de révélation existant est conservé
- **AND** aucun projet ni aucune étape n'est réordonné

### Requirement: Sécurité de lecture et d'identité

Le filtre MUST s'appliquer uniquement à un document métier déjà autorisé et
achevé. Il MUST NOT produire de faux état vide, de faux zéro ou de carte d'un
ancien espace pendant une restauration, une lecture en attente, une liaison non
vérifiée ou un changement d'identité.

#### Scenario: Lecture en attente

- **GIVEN** la lecture métier autorisée n'est pas achevée
- **WHEN** la vue Overview est affichée
- **THEN** le chargement ou le diagnostic prévu reste affiché
- **AND** « Aucun projet avec urgence en attente » n'est pas affiché
- **AND** aucune carte filtrée fictive n'est rendue

#### Scenario: Liaison non vérifiée

- **GIVEN** une liaison de compte non vérifiée ou incompatible
- **WHEN** le mode « Projets avec urgences » était actif
- **THEN** aucune carte ni aucun résultat filtré n'est affiché
- **AND** aucun document mis en cache non autorisé n'est utilisé

#### Scenario: Bascule d'espace avec événement tardif

- **GIVEN** des projets de l'espace A affichés avec le filtre urgent
- **WHEN** l'espace B devient autorisé puis qu'un événement tardif de A arrive
- **THEN** le filtre est réinitialisé et seules les données autorisées de B
  peuvent produire des cartes
- **AND** aucune carte de A ne réapparaît dans le résultat

### Requirement: Continuité du focus, du défilement et de l'état transitoire

Le changement de filtre et les rerendus associés SHALL préserver le focus sur
un contrôle présent et pertinent, un ancrage de défilement cohérent, le repli
des sous-tâches et les brouillons applicables lorsque le projet concerné reste
affiché. Les réductions réelles de contenu dues au filtre restent permises.

#### Scenario: Bascule du filtre sans perte d'état des cartes restantes

- **GIVEN** un parent développé et une édition en cours dans un projet qui
  reste visible sous le filtre urgent
- **WHEN** l'utilisateur active ou désactive le filtre urgent
- **THEN** le parent reste développé et l'édition en cours reste disponible
- **AND** les autres cartes conservent leur état de présentation

#### Scenario: Dernière urgence terminée sous le focus

- **GIVEN** le focus se trouve dans un projet qui quitte le résultat parce que
  sa dernière urgence vient d'être terminée
- **WHEN** la liste est rerendue sous le filtre actif
- **THEN** le focus rejoint un contrôle restant pertinent
- **AND** le défilement reste borné par la nouvelle hauteur réelle
- **AND** le filtre reste actif

#### Scenario: Rafraîchissement identique sans oscillation

- **GIVEN** le mode « Projets avec urgences » actif et un résultat inchangé
- **WHEN** plusieurs rerendus autorisés se succèdent
- **THEN** l'état coché du contrôle n'est pas réécrit inutilement
- **AND** aucune annonce accessible supplémentaire n'est produite par un texte
  de filtre réécrit à l'identique

### Requirement: Filtre indépendant et données inchangées

Le filtre urgent SHALL être une présentation purement dérivée. Il MUST NOT
modifier `documentState`, les identifiants, priorités, états `done`, relations
parentes, ordres, exports, imports ou préférences, ni déclencher d'écriture,
de lecture supplémentaire ou d'opération réseau.

#### Scenario: Aucune mutation par filtrage

- **GIVEN** un document affiché avec ses cartes
- **WHEN** le filtre urgent est activé, désactivé ou recalculé
- **THEN** le document, le stockage local, l'export JSON et l'historique
  navigateur sont strictement inchangés
- **AND** aucune opération Dexie, Cloud, réseau ou d'authentification n'est
  déclenchée

#### Scenario: Indépendance avec « Masquer les étapes terminées »

- **GIVEN** les deux filtres affichés
- **WHEN** l'un des deux change
- **THEN** l'autre conserve son état
- **AND** la liste des projets suit uniquement le filtre urgent
- **AND** les étapes dans chaque carte suivent uniquement le filtre de
  complétion et l'aperçu existants

#### Scenario: Export et import inchangés

- **GIVEN** un document affiché et filtré
- **WHEN** il est exporté puis réimporté
- **THEN** sa forme et ses enregistrements métier sont identiques
- **AND** aucun champ, statut ou préférence de filtre n'est ajouté
