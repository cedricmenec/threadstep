# react-overview-cards Specification Delta

## Purpose

Rendre la liste des cartes projet de la vue d'ensemble avec une surface React
bornée, à parité de données, de compteurs, de commandes et de continuité, sans
changer les règles métier, la persistance ni les autres surfaces.

## ADDED Requirements

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

### Requirement: Card data and counter parity

Chaque carte SHALL reprendre les données du document courant et afficher le
même titre, le même nombre d'étapes en attente, le même total de tâches
parentes, le même compteur d'urgences restantes et la même progression
textuelle que le rendu livré. Les compteurs globaux MUST rester calculés sur
le document complet et ne MUST pas être déplacés ou dupliqués.

#### Scenario: Compteurs de carte dérivés du document

- **GIVEN** un projet avec des parents et des sous-tâches, dont certains sont
  terminés ou urgents
- **WHEN** sa carte est rendue
- **THEN** son nombre d'étapes en attente, son total, ses urgences restantes
  et sa progression correspondent aux helpers existants
- **AND** les accords français singulier/pluriel sont ceux du rendu livré

#### Scenario: Projet sans étape

- **WHEN** un projet sans enregistrement d'étape est rendu
- **THEN** sa progression affiche « Aucune étape » sans pourcentage
- **AND** son compteur d'urgences affiche « 0 urgence restante »

#### Scenario: Compteur global inchangé

- **GIVEN** plusieurs projets affichés
- **WHEN** la surface React des cartes est montée ou mise à jour
- **THEN** le compteur global reste unique et dérivé du document complet
- **AND** le nombre d'étapes en attente n'est pas dupliqué dans une seconde
  zone globale

#### Scenario: Ordre et filtre conservés

- **GIVEN** un filtre de projets actif et une liste enregistrée
- **WHEN** les cartes sont rendues
- **THEN** seules les cartes autorisées par le filtre sont présentes
- **AND** leur ordre relatif est celui du document
- **AND** aucune donnée n'est réordonnée ou modifiée par le rendu

### Requirement: Five-parent preview and open-detail control

Chaque carte SHALL rendre au plus les cinq premières tâches parentes visibles
après application du filtre « Masquer les étapes terminées ». Une tâche
parente et ses sous-tâches comptent pour une entrée ; les sous-tâches MUST
NOT consommer le quota. Au-delà de cinq parents visibles, une seule commande
« Voir plus » nommant le projet SHALL ouvrir `#/sujet/<id>`.

#### Scenario: Zéro à six tâches parentes visibles

- **GIVEN** une carte avec 0, 1, 5 ou 6 tâches parentes visibles
- **WHEN** son aperçu est rendu
- **THEN** elle affiche respectivement 0, 1, 5 et 5 tâches parentes
- **AND** les entrées au-delà du quota et leurs sous-tâches sont absentes du
  DOM

#### Scenario: Le filtre précède le quota

- **GIVEN** des tâches terminées masquées
- **WHEN** l'aperçu est calculé
- **THEN** ces tâches ne consomment aucun emplacement
- **AND** elles ne sont pas utilisées pour compléter le quota

#### Scenario: Les sous-tâches ne consomment pas d'emplacement

- **GIVEN** une tâche parente visible avec plusieurs sous-tâches visibles
- **WHEN** elle est repliée ou développée dans l'aperçu
- **THEN** elle compte pour une seule entrée
- **AND** les autres tâches parentes restent disponibles dans le quota

#### Scenario: Une seule commande « Voir plus »

- **GIVEN** une carte avec plus de cinq parents visibles
- **WHEN** elle est rendue
- **THEN** exactement une commande « Voir plus » est présente pour cette carte
- **AND** son nom accessible identifie le projet
- **WHEN** elle est activée
- **THEN** la route existante `#/sujet/<id>` du bon projet est ouverte
- **AND** le détail n'applique pas la limite de cinq

#### Scenario: Pas de « Voir plus » dans le quota

- **GIVEN** une carte avec cinq parents visibles ou moins
- **WHEN** elle est rendue
- **THEN** aucune commande « Voir plus » n'est présente

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

- **GIVEN** une carte ou sa commande « Voir plus »
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

### Requirement: Accessible and responsive presentation parity

La surface SHALL conserver les éléments HTML, classes, IDs, libellés, noms
accessibles, ordres de lecture et contrôles du rendu livré. Les cibles
interactives MUST rester d'au moins 44 × 44 px et la mise en page MUST éviter
tout débordement horizontal aux largeurs usuelles. Tous les textes
utilisateur MUST rester des nœuds texte.

#### Scenario: Parité des contrôles et noms accessibles

- **WHEN** les cartes sont rendues
- **THEN** les contrôles d'ouverture, déplacement, suppression, ajout,
  complétion, priorité, sous-tâches, menu et « Voir plus » conservent leurs
  classes, libellés et noms accessibles existants
- **AND** leur ordre de lecture et leur ordre dans le menu restent inchangés

#### Scenario: Balisage utilisateur rendu littéralement

- **GIVEN** un titre de projet, de tâche ou une note contient
  `<img src=x onerror=alert(1)>`
- **WHEN** une carte ou une ligne est rendue
- **THEN** le contenu est affiché comme du texte littéral
- **AND** aucun élément exécutable n'est créé

#### Scenario: Largeurs usuelles sans débordement

- **WHEN** les règles des cartes et des contrôles sont vérifiées pour 320,
  390, 430, 768 et 1280 px
- **THEN** les libellés peuvent revenir à la ligne sans débordement horizontal
- **AND** les cibles interactives restent d'au moins 44 × 44 px
- **AND** aucune nouvelle disposition, sidebar ou largeur fixe supérieure au
  mobile n'est introduite

#### Scenario: Aucun changement de route, stockage ou dépendance

- **WHEN** la surface et ses modules sont inspectés
- **THEN** aucune route, clé de stockage, préférence persistée, dépendance ou
  ressource réseau n'est ajoutée
- **AND** les routes hash, l'export/import et la CSP restent inchangés
