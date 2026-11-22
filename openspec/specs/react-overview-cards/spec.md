# react-overview-cards Specification

## Purpose

Rendre la liste concise des cartes projet de la vue d'ensemble avec une
surface React bornée, des compteurs canoniques et une commande d'ouverture du
détail, sans changer les règles métier, la persistance ni les autres surfaces.

## Requirements

### Requirement: Bounded Overview card surface

La vue `#/` SHALL pouvoir rendre sa liste de cartes par une surface React
bornée qui possède exclusivement `#subjects` tant qu'elle est active. Elle
MUST NOT posséder les filtres, le compteur global, la suggestion, la reprise,
la zone d'urgences, le chargement, la synthèse, le formulaire de projet, les
paramètres ou les formulaires sensibles. Overview et le détail React MUST NOT
posséder `#subjects` simultanément.

#### Scenario: La surface ne possède que la liste des cartes

- **WHEN** la surface React des cartes Overview est montée sur `#/`
- **THEN** elle possède uniquement le contenu de `#subjects`
- **AND** les filtres, le compteur global, la suggestion, la reprise, la zone
  d'urgences, le chargement et le formulaire de projet conservent leur
  propriétaire vanilla
- **AND** aucune seconde copie d'une carte, d'un filtre ou d'un formulaire
  n'est créée

#### Scenario: Overview et détail sont mutuellement exclusifs

- **GIVEN** la surface Overview possède `#subjects`
- **WHEN** la route passe à `#/sujet/<id>`
- **THEN** la surface Overview est démontée avant le rendu du détail
- **AND** une seule surface React possède `#subjects`
- **AND** aucun contenu de carte ne reste visible dans le détail

#### Scenario: Retour du détail vers Overview

- **GIVEN** le détail React possède `#subjects`
- **WHEN** la route revient à `#/`
- **THEN** la surface du détail est démontée avant le montage des cartes
- **AND** les cartes sont dérivées du document courant
- **AND** aucun contrôle du détail ne reste actif ou visible

#### Scenario: Aucune surface métier vanilla concurrente

- **WHEN** les modules de la surface Overview sont montés, mis à jour puis
  démontés
- **THEN** le contrôleur vanilla ne remplace ni ne modifie les descendants du
  conteneur actif
- **AND** après démontage, le conteneur est libéré pour la surface suivante
- **AND** aucun listener de l'ancienne surface ne reste actif

### Requirement: Project-only Overview cards

La surface Overview SHALL présenter une carte par projet autorisé, dans
l'ordre enregistré, avec uniquement son nom, le nombre de tâches principales
et le nombre d'urgences non terminées. Elle MUST NOT présenter de ligne ou
d'aperçu de tâche, de commande de tâche ou de filtre.

#### Scenario: Minimal project card

- **GIVEN** un document autorisé contenant plusieurs projets
- **WHEN** la surface Overview est rendue
- **THEN** une carte textuelle est rendue pour chaque projet dans l'ordre du document
- **AND** chaque carte présente son nom et ses deux comptes canoniques
- **AND** les tâches et leurs commandes ne sont pas perceptibles ni atteignables au clavier

#### Scenario: Empty and read states

- **GIVEN** la lecture autorisée est achevée sans projet, ou est encore en attente ou bloquée
- **WHEN** la surface Overview est rendue
- **THEN** l'état vide, de chargement ou d'attention existant reste applicable
- **AND** aucune carte ou métrique fictive n'est affichée

### Requirement: Project opening and read continuity

Chaque carte SHALL exposer une seule commande d'ouverture accessible du projet.
Les mises à jour de même route et identité SHALL conserver la surface montée et
le contexte de lecture pertinent. L'ouverture SHALL utiliser la commande et
la route existantes sans écriture supplémentaire.

#### Scenario: Open the named project

- **GIVEN** une carte nommant le projet A
- **WHEN** sa commande d'ouverture est activée au clavier, au pointeur ou au toucher
- **THEN** une seule commande `openProject` est déléguée avec l'identifiant de A
- **AND** la route de détail existante de A est ouverte
- **AND** le focus rejoint le titre du détail selon le comportement existant

#### Scenario: Same-context refresh

- **GIVEN** la surface est focalisée ou positionnée après défilement
- **WHEN** les données du même contexte sont actualisées
- **THEN** les comptes sont recalculés sans remonter la surface
- **AND** le focus et l'ancrage de lecture pertinents restent valides
- **AND** le rendu n'ajoute aucune écriture métier ou de stockage

### Requirement: Single command and no implicit write

Le montage, le rendu, le re-rendu, le changement de filtre et le démontage de
la surface Overview MUST NOT écrire dans Dexie/IndexedDB ou `localStorage`,
envoyer une requête Cloud, déclencher un OTP, une migration, une ouverture de
base ou une commande métier. Chaque intention utilisateur SHALL produire au
plus une commande et une écriture déléguée au contrôleur existant.

#### Scenario: Montage et mise à jour sans écriture

- **GIVEN** une surface montée sur des données synthétiques avec des espions
  d'écriture, de réseau et d'authentification
- **WHEN** elle est montée, mise à jour, remontée et démontée
- **THEN** aucune écriture, requête, authentification, migration ou commande
  métier n'est observée

#### Scenario: Une intention, une commande

- **GIVEN** une carte affichée
- **WHEN** l'utilisateur active une fois un contrôle de complétion, priorité,
  menu, édition, déplacement, suppression ou ouverture
- **THEN** le contrôleur reçoit exactement l'intention correspondante
- **AND** au plus une écriture persistée est émise
- **AND** aucun listener dupliqué ne produit une seconde commande

#### Scenario: Ouverture du détail et hash inchangés

- **GIVEN** une carte projet
- **WHEN** l'ouverture est activée
- **THEN** la route `#/sujet/<id>` existante est utilisée
- **AND** l'historique, le retour et le focus de titre gardent leur
  comportement existant
- **AND** aucune route ni entrée d'historique parallèle n'est créée

#### Scenario: Retrait, annulation et confirmation conservés

- **GIVEN** une tâche ou une carte affichée
- **WHEN** un retrait est demandé
- **THEN** la règle de confirmation ou de retrait existante s'applique
- **AND** l'annulation éventuelle restaure l'état et les compteurs
- **AND** la présentation React n'ajoute aucune seconde mutation

### Requirement: Overview read states and context isolation

La surface des cartes SHALL respecter les états de lecture de
`overview-project-read-state` : aucune carte ni métrique avant la fin de la
lecture métier autorisée, chargement et action requise rendus comme avant, et
liste vide autorisée seulement après lecture achevée. Un changement de
compte, d'espace ou de liaison MUST libérer la surface et ne MUST pas révéler
les cartes du contexte précédent.

#### Scenario: Lecture en attente

- **GIVEN** la lecture métier autorisée n'est pas achevée
- **WHEN** la vue Overview est affichée
- **THEN** le chargement ou le résumé d'attention prévu reste affiché
- **AND** aucune carte, aucun compteur de carte et aucun pourcentage ne sont
  rendus
- **AND** aucune liste vide fictive n'est présentée

#### Scenario: Lecture autorisée sans projet

- **GIVEN** la lecture métier autorisée est achevée sans projet
- **WHEN** les cartes sont rendues
- **THEN** le message d'état vide existant est affiché
- **AND** aucune carte ni métrique factice n'est créée

#### Scenario: Filtre sans résultat

- **GIVEN** le filtre de projets ne retient aucun projet
- **WHEN** la vue est rendue
- **THEN** le message filtré existant et la commande « Tous les projets »
  conservent leur comportement
- **AND** aucune carte masquée n'est réintroduite

#### Scenario: Changement d'identité ou d'espace

- **GIVEN** des cartes de l'espace A sont affichées
- **WHEN** l'espace B devient autorisé ou que la lecture devient bloquante
- **THEN** la surface de A est libérée avant l'affichage de B
- **AND** aucune carte, aucun titre ni aucun compteur de A n'est conservé
- **AND** un événement tardif de A ne peut pas réintroduire ses cartes

#### Scenario: Synchronisation de fond

- **GIVEN** des cartes sont affichées sous une identité autorisée
- **WHEN** une synchronisation de fond ou un rafraîchissement inter-onglets
  fournit un nouvel état
- **THEN** la surface reste montée et les cartes sont mises à jour en place
- **AND** aucun chargement ne remplace la liste
- **AND** aucune lecture, écriture ou synchronisation supplémentaire n'est
  déclenchée par la présentation

### Requirement: Focus, scroll and transient state continuity

Une mutation ou un rafraîchissement de données dans la même vue et la même
identité SHALL préserver le focus pertinent, l'ancrage de scroll, les parents
développés, les brouillons et le filtre encore valides. Une navigation
explicite, un rechargement, un import/restauration réussi ou un changement
d'identité SHALL réinitialiser les états transitoires selon
`ux-interaction-continuity`.

#### Scenario: Rafraîchissement en place

- **GIVEN** une carte et un parent développé sont affichés loin du haut
- **WHEN** un rafraîchissement de données autorisé survient
- **THEN** la surface n'est pas remontée
- **AND** le parent demeure développé si ses sous-tâches restent visibles
- **AND** la position de lecture et le focus pertinent sont conservés

#### Scenario: Brouillon d'édition conservé

- **GIVEN** l'éditeur d'une tâche contient un brouillon non enregistré
- **WHEN** une mise à jour de la même vue réaffiche les cartes
- **THEN** le brouillon reste dans l'éditeur
- **AND** aucune sauvegarde n'est déclenchée par le rafraîchissement

#### Scenario: Focus après une commande

- **GIVEN** le focus clavier est sur un contrôle d'une carte
- **WHEN** une complétion, priorité, suppression, annulation ou ouverture
  remplace ce contrôle
- **THEN** le focus rejoint un contrôle réellement présent et pertinent
- **AND** aucun focus ne reste sur un nœud détaché
- **AND** aucun saut arbitraire en haut de page n'est provoqué

#### Scenario: Ouverture et fermeture du menu

- **GIVEN** une vue est défilée et le menu d'une tâche est disponible
- **WHEN** le menu est ouvert puis fermé sans mutation
- **THEN** la position de scroll et le focus de la vue restent stables
- **AND** aucune donnée ni préférence n'est écrite

#### Scenario: Réinitialisation à une vraie frontière

- **WHEN** l'utilisateur change de route, recharge la page, importe un
  document ou change d'identité
- **THEN** les cartes, menus, éditeurs et parents développés sont réinitialisés
  selon les spécifications canoniques
- **AND** aucun état du contexte précédent n'est réutilisé

### Requirement: Responsive and accessible Overview card controls

Les cartes SHALL rester lisibles sans défilement horizontal de 320 à 1280 px.
La commande d'ouverture SHALL avoir un nom accessible identifiant le projet,
un focus visible et une cible d'au moins 44 × 44 px. Le nom du projet MUST
rester du texte littéral.

#### Scenario: Long project names and open control remain reachable

- **GIVEN** un titre de projet long
- **WHEN** la carte est rendue sur téléphone, tablette ou bureau
- **THEN** le texte revient à la ligne sans débordement horizontal
- **AND** la commande d'ouverture reste atteignable par clavier et toucher avec un nom accessible

#### Scenario: Project title remains literal text
- **GIVEN** un titre de projet contenant du HTML malveillant
- **WHEN** la carte est rendue
- **THEN** le contenu est présenté comme texte littéral et ne crée aucun élément exécutable
