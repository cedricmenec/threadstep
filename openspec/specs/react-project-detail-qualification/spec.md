# react-project-detail-qualification Specification

## Purpose

Qualifier de façon reproductible et bornée le pilote React du détail projet,
prouver ses invariants de continuité et d'invalidation sur données synthétiques,
et consigner une décision de poursuite honnête comparée à TS-059.

## Requirements

### Requirement: Matrice de recette exhaustive et statuts de preuve

La qualification SHALL fournir une matrice versionnée couvrant création,
édition et annulation, sous-tâches, filtres, priorités, menus, glisser-déposer
et alternative clavier, retrait/Undo, listes longues, retour/avant,
rechargement, clavier virtuel, tactile et lecteur d'écran. Chaque ligne MUST
indiquer l'environnement et une preuve datée ou `NOT_RUN`.

#### Scenario: Tous les parcours du détail sont listés

- **GIVEN** la matrice de qualification est relue
- **WHEN** les parcours du détail projet React sont comparés au périmètre TS-060
- **THEN** chaque parcours demandé possède au moins une ligne de recette
- **AND** les scénarios de retrait/Undo, longue liste, retour/avant et
  rechargement sont présents

#### Scenario: Preuves automatisées et essais physiques sont distingués

- **GIVEN** une ligne de la matrice est renseignée
- **WHEN** elle provient d'un test déterministe, d'un navigateur isolé, d'un
  appareil Android réel, d'un clavier physique, du tactile, d'un lecteur
  d'écran ou d'une instance Dexie Cloud de test
- **THEN** l'environnement est nommé explicitement
- **AND** une preuve automatisée n'est pas présentée comme un essai matériel
- **AND** une CI verte n'est pas présentée comme un test Android réel

#### Scenario: Statuts de preuve autorisés

- **GIVEN** un scénario de la matrice n'a pas été exécuté ou a échoué
- **WHEN** la matrice est relue
- **THEN** son statut est `NOT_RUN` ou `FAIL`
- **AND** aucun statut `PASS` n'est attribué sans commande, capture, appareil,
  navigateur et date de preuve
- **AND** les scénarios physiques non exécutés restent `NOT_RUN`

#### Scenario: Données et Cloud de test uniquement

- **GIVEN** la qualification utilise des données ou une instance Cloud
- **WHEN** les scénarios sont préparés
- **THEN** seules des données synthétiques et une instance Dexie Cloud de test
  sont employées
- **AND** aucune donnée personnelle n'est purgée, réimportée ou transférée

### Requirement: Une seule intention et une seule écriture par commande

Chaque interaction du détail SHALL transmettre au plus une intention nommée au
contrôleur et au plus une écriture via le flux existant. Une commande invalide
ou sans changement MUST NOT persister ni modifier le document.

#### Scenario: Chaque commande du détail est exercée une fois

- **GIVEN** un document synthétique chargé et des callbacks espions
- **WHEN** création, création de sous-tâche, édition, priorité, complétion,
  retrait, annulation, réordonnancement, promotion, suivi, menu et retour sont
  activés une fois chacun
- **THEN** le callback correspondant reçoit exactement une intention
- **AND** aucun double callback n'est observé
- **AND** chaque commande valide produit au plus une écriture

#### Scenario: Les validations existantes restent seules juges

- **GIVEN** un titre vide, un titre hors limite, une note hors limite, une
  priorité invalide, un parent inexistant ou une limite d'étapes atteinte
- **WHEN** la commande est activée
- **THEN** aucune écriture n'est émise et le document reste inchangé
- **AND** le message ou l'état d'erreur reste celui du contrôleur existant

### Requirement: Montage, rendu et démontage sans effet métier

Le montage, l'abonnement, le rafraîchissement, le changement de présentation et
le démontage de la surface React MUST NOT écrire dans Dexie ou IndexedDB, ni
émettre de requête Cloud, d'OTP, de migration, de copie ou de transfert.

#### Scenario: Cycle de vie complet sans écriture ni réseau

- **GIVEN** une surface montée sur données synthétiques avec des espions
  d'écriture, de stockage et de réseau
- **WHEN** elle est montée, rendue, rafraîchie, démontée puis remontée
- **THEN** aucune écriture Dexie ou IndexedDB n'est observée
- **AND** aucune requête `fetch`, WebSocket, Cloud ou OTP n'est émise
- **AND** aucune commande métier n'est appelée par le cycle de vie

#### Scenario: Un brouillon ou un menu ne sauvegarde pas

- **GIVEN** un menu est ouvert ou un brouillon non enregistré est saisi
- **WHEN** la présentation locale change ou qu'un rafraîchissement autorisé
  survient
- **THEN** le document, les identifiants, les ordres et les exports restent
  inchangés
- **AND** aucune préférence transitoire n'est persistée

### Requirement: Continuité des états transitoires valides

Une action locale ou un rafraîchissement autorisé dans la même vue et la même
identité SHALL préserver le brouillon encore applicable, les parents développés,
le focus connecté et l'ancrage de lecture, sauf réduction réelle de contenu.

#### Scenario: Brouillon et parent développé survivent à un rafraîchissement

- **GIVEN** un éditeur contient un brouillon non enregistré et un parent est
  développé
- **WHEN** un rafraîchissement inter-onglets ou Dexie simulé met à jour des
  données inchangées ou non pertinentes
- **THEN** le brouillon et l'ouverture du parent restent présents
- **AND** aucune sauvegarde n'est déclenchée
- **AND** les autres parents gardent leur ouverture

#### Scenario: Focus et lecture après création, coche ou déplacement

- **GIVEN** une liste longue est défilée et le focus est sur un contrôle du
  détail
- **WHEN** une tâche est créée, cochée, sauvegardée, annulée ou déplacée
- **THEN** le focus reste sur un contrôle connecté et pertinent
- **AND** l'ancrage de lecture ne revient pas arbitrairement en haut
- **AND** aucune hauteur artificielle ne persiste après le rendu

#### Scenario: Clavier virtuel simulé après le commit

- **GIVEN** une intention de focus de création ou de sauvegarde est demandée
- **WHEN** le rendu React est commité
- **THEN** le focus est appliqué au champ ou contrôle présent prévu
- **AND** cette application ne déclenche ni écriture ni navigation

#### Scenario: Suppression de l'ancre ou du parent

- **GIVEN** la tâche ou le parent développé servant d'ancrage est retiré ou
  masqué par le filtre
- **WHEN** la liste est réactualisée
- **THEN** le viewport se rapproche d'un voisin pertinent lorsque possible
- **AND** les autres parents affichables conservent leur état
- **AND** aucune donnée de l'élément supprimé ne reste affichée

### Requirement: Invalidation avant tout retour au rendu vanilla

Lors d'un changement de route, de projet, de compte ou d'espace, d'une lecture
bloquante ou de la disparition du projet, la racine React SHALL être démontée ou
invalidée avant que le renderer vanilla ne réécrive la zone de contenu.

#### Scenario: Changement de projet ou de vue

- **GIVEN** le détail React du projet A est affiché
- **WHEN** la route passe au projet B, à Overview, à Paramètres ou à
  Synchronisation
- **THEN** la surface de A est invalidée avant le rendu vanilla
- **AND** aucun titre, compteur, tâche, note, brouillon ou menu de A ne reste
  visible
- **AND** une seule racine reste active au maximum

#### Scenario: Identité, espace ou cache bloqué

- **GIVEN** le détail d'une identité autorisée est affiché
- **WHEN** l'identité ou l'espace change, devient non vérifié ou bloqué
- **THEN** l'ancienne surface est invalidée et son contenu masqué
- **AND** aucune donnée de l'identité précédente n'est affichée, copiée ou
  écrite
- **AND** aucune requête Cloud ou écriture IndexedDB supplémentaire n'est créée
  par la transition de présentation

#### Scenario: Projet disparu ou lecture bloquée

- **GIVEN** la surface est active
- **WHEN** le projet disparaît après import, restauration ou rafraîchissement,
  ou qu'une lecture bloquante survient
- **THEN** l'ancienne présentation est invalidée
- **AND** le repli ou l'état vide affiché ne réutilise aucune donnée antérieure
- **AND** le retour au vanilla n'a lieu qu'après l'invalidation

### Requirement: Contrats Overview TS-052 préservés

La qualification SHALL vérifier les seuils et états de lecture d'Overview sans
modifier le modèle de présentation ni le moteur Dexie : aucun loader avant
250 ms, attente durable à partir de 8 000 ms, aucun flash de diagnostic et
aucun faux état vide.

#### Scenario: Loader discret et attente durable

- **GIVEN** une lecture métier autorisée est encore en attente
- **WHEN** l'écran Overview est observé avant puis après les seuils
- **THEN** aucun loader n'est visible avant 250 ms
- **AND** le loader stable est visible à partir de 250 ms
- **AND** à partir de 8 000 ms l'attente durable remplace le loader
- **AND** aucun état vide, compteur nul ou diagnostic transitoire n'est présenté

#### Scenario: Overview reste vanilla

- **GIVEN** la route `#/` est affichée pendant ou après la qualification
- **WHEN** la surface de contenu est inspectée
- **THEN** aucune surface React métier n'est montée pour Overview
- **AND** aucun nouvel abonnement, requête ou écriture n'est créé par le détail
  React
- **AND** les projets redeviennent disponibles dès que la lecture autorisée est
  achevée

### Requirement: Règles métier, clavier et Undo conservés

Les opérations du détail SHALL conserver les priorités, l'ordre, les relations
parent/sous-tâche, les notes brutes, les titres, les compteurs, le suivi,
l'Undo de dix secondes et les commandes clavier existantes.

#### Scenario: Priorité, ordre et hiérarchie

- **GIVEN** un projet contient plusieurs priorités, un parent et ses
  sous-tâches
- **WHEN** priorité, ordre, complétion ou promotion sont modifiés
- **THEN** l'ordre par priorité, le parent et les sous-tâches restent ceux des
  règles existantes
- **AND** les titres, notes brutes, identifiants et compteurs reflètent la
  mutation
- **AND** aucune autre tâche n'est déplacée ou re-parentée

#### Scenario: Retrait et Undo de dix secondes

- **GIVEN** une tâche est retirée depuis le détail React
- **WHEN** l'annulation est activée dans la fenêtre de dix secondes
- **THEN** la tâche, ses sous-tâches, sa position et son suivi éventuel sont
  restaurés par une seule écriture
- **AND** après expiration, aucune annulation n'est possible
- **AND** aucune seconde écriture n'est émise par la présentation

#### Scenario: Alternative clavier au glisser-déposer

- **GIVEN** une tâche est affichée
- **WHEN** l'utilisateur parcourt le menu au clavier
- **THEN** les commandes de déplacement applicables restent accessibles et
  désactivées lorsqu'elles sont impossibles
- **AND** le glisser-déposer n'est pas la seule voie de réordonnancement
- **AND** les noms accessibles et l'ordre de tabulation restent prévisibles

### Requirement: Bilan comparé et décision bornée

Le changement SHALL produire un bilan versionné comparant les résultats à TS-059
et distinguant les preuves automatisées des essais physiques `PASS`, `FAIL` ou
`NOT_RUN`. Il MUST conclure par une recommandation GO ou NO-GO explicitement
bornée au lot suivant.

#### Scenario: Mesures et comparaison présentes

- **GIVEN** le bilan de qualification est relu
- **WHEN** ses sections sont vérifiées
- **THEN** il contient la date, le SHA ou l'état de build, les commandes, les
  tests automatisés effectivement passés, les mesures de bundle et de
  couverture
- **AND** il compare explicitement ces résultats au bilan TS-059
- **AND** aucun chiffre non mesuré n'est présenté comme prouvé

#### Scenario: Décision GO/NO-GO sans GO global

- **GIVEN** les tests automatisés et la CI sont verts
- **WHEN** le bilan énonce sa recommandation
- **THEN** il choisit explicitement GO ou NO-GO pour le lot suivant
- **AND** il précise que la CI ne remplace pas les essais Android, clavier,
  tactile, lecteur d'écran ou Dexie Cloud de test
- **AND** il ne déclenche, ne planifie et n'autorise aucune autre migration,
  fusion ou publication

#### Scenario: Absence de preuve physique signalée

- **GIVEN** un scénario physique n'a pas été exécuté au moment du bilan
- **WHEN** le bilan est publié
- **THEN** ce scénario est marqué `NOT_RUN`
- **AND** il reste requis pour l'acceptation humaine
- **AND** il n'est ni coché ni présenté comme validé

### Requirement: Compatibilité build, routes et données

La qualification SHALL conserver le build statique, les routes par hash, la
CSP, les identifiants, le format de données et les contrats Cloud/OTP existants.
Aucune route, clé de stockage, migration ou ressource réseau ne MUST être
ajoutée.

#### Scenario: Vérifications de build sur la branche

- **WHEN** `npm run check`, `npm run build` et `npm run verify:build` sont
  exécutés sur la branche proposée
- **THEN** les commandes réussissent et l'artefact reste statique sous
  `/threadstep/`
- **AND** la CSP conserve `script-src 'self'` sans `unsafe-inline` ni
  `unsafe-eval`
- **AND** les tests React ciblés passent

#### Scenario: Données et routes inchangées

- **GIVEN** un document synthétique existant
- **WHEN** la qualification monte, rafraîchit et démonte la surface
- **THEN** les routes `#/`, `#/parametres`, `#/parametres/donnees`,
  `#/parametres/synchronisation` et `#/sujet/<id>` restent interprétées comme
  avant
- **AND** les identifiants, la clé `threadstep.document.v1`, l'export/import et
  les données IndexedDB ne sont ni migrés, ni copiés, ni supprimés
- **AND** aucune nouvelle route ou clé de stockage n'apparaît
