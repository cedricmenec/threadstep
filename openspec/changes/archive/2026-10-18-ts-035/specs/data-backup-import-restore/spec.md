# Spec Delta

## MODIFIED Requirements

### Requirement: Versioned portable export

Chaque export SHALL déclarer un format/version et restituer les champs métier et relations nécessaires à une relecture fiable. Les secrets, tokens, credentials et configuration sensible MUST être exclus. Un export issu d'IndexedDB SHALL déclarer si ses identifiants sont déjà canoniques, et un export V1 produit pendant une anomalie d'intégrité SHALL être désactivé avec explication ou explicitement marqué incomplet.

#### Scenario: Export local-only records
- **GIVEN** un espace sans Cloud
- **WHEN** l'utilisateur télécharge une sauvegarde
- **THEN** les enregistrements et leurs relations sont exportés dans le format du projet
- **AND** l'export ne déclenche ni création de compte ni synchronisation

#### Scenario: Export of Cloud-synced data
- **WHEN** une sauvegarde est produite depuis l'espace synchronisé
- **THEN** les identifiants métier originaux sont préservés
- **AND** la provenance Cloud n'est pas confondue avec une source V1 inédite

#### Scenario: Export declares identity provenance
- **GIVEN** un export produit depuis IndexedDB avec des identifiants déjà canoniques
- **WHEN** le fichier est généré
- **THEN** il déclare que ses identifiants sont canoniques et issus d'un export IndexedDB
- **AND** le bloc de provenance ne contient aucun titre, note, compte ou secret
- **AND** le format métier reste lisible par la validation V1

#### Scenario: V1 export is disabled during an integrity anomaly
- **GIVEN** l'inventaire read-only signale une référence orpheline ou une variante d'identité non résolue
- **WHEN** l'utilisateur demande l'export V1 normal
- **THEN** cet export est désactivé avec une explication, ou explicitement marqué incomplet
- **AND** l'interface propose l'export brut de récupération distinct
- **AND** aucun enregistrement anomal n'est omis silencieusement

### Requirement: Strict import validation

Le fichier importé SHALL être validé en taille, version, structure, identifiants et relations avant la création d'un plan. Une erreur de parsing MUST NOT affecter l'espace courant. La provenance du document SHALL être classée avant le mapping, et une provenance ambiguë MUST bloquer le plan sans écriture.

#### Scenario: Corrupt backup
- **WHEN** un fichier illisible ou incompatible est fourni
- **THEN** aucune mutation n'est effectuée
- **AND** le fichier source de l'utilisateur reste disponible

#### Scenario: Missing parent or duplicate ID
- **WHEN** la source contient une relation invalide ou deux entités identiquement nommées par ID
- **THEN** le moteur ne corrige pas silencieusement la source
- **AND** un diagnostic permet de choisir une récupération appropriée

#### Scenario: Ambiguous provenance blocks the plan
- **GIVEN** un fichier non marqué contenant des identifiants préfixés `legacy:`
- **WHEN** l'application ne peut pas prouver s'il s'agit d'un V1 brut, d'un export IndexedDB ou d'un export historique doublement préfixé
- **THEN** aucun plan d'écriture n'est produit
- **AND** les deux interprétations d'identité sont présentées avec leurs comptes
- **AND** une décision explicite de provenance est requise avant toute réimportation

#### Scenario: Invalid provenance metadata
- **WHEN** le bloc de provenance est présent mais incohérent, inconnu ou contredit la structure des identifiants
- **THEN** le document est traité comme ambigu ou invalide
- **AND** aucune écriture n'est effectuée
- **AND** le fichier source reste intact

### Requirement: Reimport idempotency

Les importations SHALL préserver l'identité logique quand l'export contient déjà des IDs métier stables. Un import répété du même contenu dans le même périmètre MUST NOT dupliquer ses enregistrements. Cette garantie SHALL s'appliquer au même résolveur d'identité pour l'import Cloud, l'import local, la restauration et la conversion locale, sans préfixage récursif.

#### Scenario: Same JSON imported twice
- **GIVEN** un import confirmé puis son rechargement
- **WHEN** le même JSON est présenté une seconde fois
- **THEN** les objets identiques sont reconnus comme présents
- **AND** aucun nouveau groupe ni préfixe d'identifiant n'est ajouté

#### Scenario: Export after legacy migration is reimported
- **GIVEN** un export dont l'ID est déjà `legacy:abc` et déclaré canonique
- **WHEN** ce JSON est importé
- **THEN** l'ID reste `legacy:abc` pour le rapprochement
- **AND** le moteur ne crée pas `legacy:legacy:abc`

#### Scenario: Cloud import uses the same mapping as the UI
- **GIVEN** un export IndexedDB contenant `legacy:s1`, `subjectId: legacy:s1` et un `parentId` déjà mappé
- **WHEN** l'import Cloud construit son plan par le même appel de mapping que l'interface
- **THEN** aucun identifiant ne devient `legacy:legacy:`
- **AND** tous les `subjectId` et `parentId` restent cohérents
- **AND** une seconde importation du même fichier produit zéro doublon

#### Scenario: Raw V1 is mapped exactly once
- **GIVEN** un document V1 brut déclaré comme tel, avec des identifiants non préfixés
- **WHEN** il est importé ou converti
- **THEN** chaque identifiant reçoit une seule fois le préfixe canonique
- **AND** les relations suivent la même transformation
- **AND** une seconde exécution reconnaît les enregistrements déjà présents

### Requirement: Separate import merge from restoration

L'interface SHALL proposer des intentions distinctes : « importer et fusionner » et « restaurer un état antérieur ». Une restauration pouvant remplacer des données SHALL afficher un diff, les suppressions ou pertes potentielles, une sauvegarde de sécurité et une confirmation renforcée. L'import SHALL reconnaître les identités et provenances, les droits/realms de la cible et les enregistrements Cloud-only sans les écraser.

#### Scenario: Merge older backup into newer state
- **GIVEN** une sauvegarde plus ancienne que les données actuelles
- **WHEN** l'utilisateur choisit « fusionner »
- **THEN** les éléments seulement présents dans la sauvegarde sont examinés
- **AND** les changements récents ne sont jamais écrasés automatiquement

#### Scenario: Restore requires explicit scope
- **WHEN** l'utilisateur choisit « restaurer »
- **THEN** la portée locale ou Cloud est affichée ainsi que les modifications potentiellement remplacées
- **AND** une sauvegarde récupérable de l'état actuel est proposée avant toute opération destructive
- **AND** l'utilisateur peut annuler sans effet

#### Scenario: Existing Cloud data during JSON import
- **WHEN** un JSON doit entrer dans une cible Cloud peuplée
- **THEN** la procédure passe par la découverte/attestation distante puis la réconciliation
- **AND** la lecture seule d'un fichier n'entraîne jamais son push
- **AND** les enregistrements Cloud-only, les droits et les realms sont préservés

#### Scenario: Restore is never an implicit import effect
- **WHEN** l'utilisateur choisit « importer et fusionner »
- **THEN** aucune suppression ou réécriture destructive n'est exécutée
- **AND** la restauration remplaçante reste une intention et une confirmation distinctes
- **AND** une sauvegarde de l'état courant est exigée avant une restauration destructive

## ADDED Requirements

### Requirement: Import source provenance and ambiguity

L'application SHALL classifier la provenance d'une source à partir de métadonnées explicites ou d'une décision utilisateur documentée, jamais à partir d'un titre, d'une note ou du seul suffixe `legacy:`. Elle SHALL distinguer un V1 réellement brut, un export IndexedDB déjà projeté, un export historique doublement préfixé et une source inconnue. Une source inconnue SHALL rester ambiguë et bloquer toute écriture jusqu'à décision explicite, même si aucun identifiant ne porte de préfixe.

#### Scenario: Raw V1 with plain identifiers
- **GIVEN** un document V1 déclaré brut sans identifiant préfixé
- **WHEN** il est importé
- **THEN** il est traité comme une source brute
- **AND** le mapping canonique est appliqué une seule fois

#### Scenario: Projected IndexedDB export
- **GIVEN** un export déclaré comme provenant d'IndexedDB avec des identifiants canoniques
- **WHEN** il est importé
- **THEN** ses identifiants et relations sont conservés tels quels
- **AND** aucun second préfixe n'est ajouté

#### Scenario: Historical double-prefixed export
- **GIVEN** une source explicitement identifiée comme un export historique `legacy:legacy:`
- **WHEN** elle est importée
- **THEN** son schéma d'identité est reconnu à partir de cette provenance
- **AND** le moteur ne retire pas les préfixes par supposition
- **AND** les identifiants restent stables pour le rapprochement

#### Scenario: Unmarked prefixed source is ambiguous
- **GIVEN** une source sans provenance dont les identifiants commencent par `legacy:`
- **WHEN** l'application prépare la réimportation
- **THEN** elle présente les deux interprétations possibles et leurs comptes
- **AND** aucune écriture n'est effectuée avant une décision explicite
- **AND** le titre, la similitude de contenu ou le retrait des préfixes ne servent pas de preuve

#### Scenario: Unmarked plain-identifier source is also ambiguous
- **GIVEN** une source sans provenance dont les identifiants ne portent aucun préfixe
- **WHEN** l'application ne peut pas prouver s'il s'agit d'un V1 brut ou d'un export IndexedDB à identifiants générés
- **THEN** elle ne traite pas automatiquement la source comme brute
- **AND** elle demande une décision de provenance avant toute écriture
- **AND** une source explicitement déclarée brute reste importable avec le mapping canonique

#### Scenario: Raw identifier that literally starts with legacy
- **GIVEN** un document explicitement déclaré brut dont un identifiant brut commence par `legacy:`
- **WHEN** il est converti
- **THEN** il est traité comme un identifiant brut, sans déduire qu'il est déjà projeté
- **AND** aucun autre document non marqué ne reçoit cette interprétation par défaut

### Requirement: V1 export gating during integrity anomalies

Lorsqu'une anomalie d'intégrité empêche une projection V1 fidèle, l'application SHALL soit désactiver l'export V1 avec une explication, soit le marquer explicitement incomplet. Elle MUST proposer un export brut de récupération distinct et MUST NOT produire un export V1 qui omet silencieusement un enregistrement accessible.

#### Scenario: Anomaly disables the normal V1 export
- **GIVEN** un inventaire read-only signale au moins une anomalie bloquante
- **WHEN** l'utilisateur ouvre l'action d'export V1
- **THEN** l'action est désactivée avec une explication
- **AND** l'export brut de récupération reste disponible

#### Scenario: No silent omission
- **WHEN** un export V1 est produit ou marqué incomplet malgré une anomalie
- **THEN** le fichier et l'interface indiquent explicitement son caractère incomplet
- **AND** aucun enregistrement accessible n'est omis sans avertissement

### Requirement: Traceable import and repair outcomes

Les événements d'import, de copie, de réparation, d'ambiguïté et de rejet SHALL être traçables par des codes stables. Les événements et journaux MUST NOT contenir de titre, note, email, OTP, token ou secret. Les identifiants affichés à la personne concernée restent dans son interface et ne sont pas publiés dans les journaux techniques.

#### Scenario: Outcomes are reported by code
- **WHEN** une importation, une copie ou une réparation se termine ou est refusée
- **THEN** le résultat expose un code stable et un compte
- **AND** le code distingue succès, ambiguïté, plan périmé, collision et échec de transaction

#### Scenario: Logs contain no business content
- **WHEN** un événement d'import ou de réparation est produit
- **THEN** il ne contient ni titre, ni note, ni email, ni OTP, ni token
- **AND** aucune donnée métier n'est journalisée dans les erreurs techniques publiques
