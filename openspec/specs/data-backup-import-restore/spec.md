# data-backup-import-restore Specification

## Purpose
Distinguer export, import additif/fusion, restauration d'une sauvegarde et migration historique. Prévenir doublons, écrasements invisibles et modifications de compte/Cloud non consenties.
## Requirements
### Requirement: Versioned portable export
Chaque export SHALL déclarer un format/version et restituer les champs métier et relations nécessaires à une relecture fiable. Les secrets, tokens, credentials et configuration sensible MUST être exclus.
#### Scenario: Export local-only records
- **GIVEN** un espace sans Cloud
- **WHEN** l'utilisateur télécharge une sauvegarde
- **THEN** les enregistrements et leurs relations sont exportés dans le format du projet
- **AND** l'export ne déclenche ni création de compte ni synchronisation
#### Scenario: Export of Cloud-synced data
- **WHEN** une sauvegarde est produite depuis l'espace synchronisé
- **THEN** les identifiants métier originaux sont préservés
- **AND** la provenance Cloud n'est pas confondue avec une source V1 inédite
### Requirement: Strict import validation
Le fichier importé SHALL être validé en taille, version, structure, identifiants et relations avant la création d'un plan. Une erreur de parsing MUST NOT affecter l'espace courant.
#### Scenario: Corrupt backup
- **WHEN** un fichier illisible ou incompatible est fourni
- **THEN** aucune mutation n'est effectuée
- **AND** le fichier source de l'utilisateur reste disponible
#### Scenario: Missing parent or duplicate ID
- **WHEN** la source contient une relation invalide ou deux entités identiquement nommées par ID
- **THEN** le moteur ne corrige pas silencieusement la source
- **AND** un diagnostic permet de choisir une récupération appropriée
### Requirement: Reimport idempotency
Les importations SHALL préserver l'identité logique quand l'export contient déjà des IDs métier stables. Un import répété du même contenu dans le même périmètre MUST NOT dupliquer ses enregistrements.
#### Scenario: Same JSON imported twice
- **GIVEN** un import confirmé puis son rechargement
- **WHEN** le même JSON est présenté une seconde fois
- **THEN** les objets identiques sont reconnus comme présents
- **AND** aucun nouveau groupe ni préfixe d'identifiant n'est ajouté
#### Scenario: Export after legacy migration is reimported
- **GIVEN** un export dont l'ID est déjà `legacy:abc`
- **WHEN** ce JSON est importé
- **THEN** l'ID reste `legacy:abc` pour le rapprochement
- **AND** le moteur ne crée pas `legacy:legacy:abc`
### Requirement: Separate import merge from restoration
L'interface SHALL proposer des intentions distinctes : « importer et fusionner » et « restaurer un état antérieur ». Une restauration pouvant remplacer des données SHALL afficher un diff, les suppressions ou pertes potentielles, une sauvegarde de sécurité et une confirmation renforcée.
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
### Requirement: Abort, reload and recovery
Un import ou une restauration interrompu SHALL laisser un état explicable. Les conversions SHALL être idempotentes et les transactions locales atomiques ; les garanties de réplication distante restent distinctes.
#### Scenario: Cancel before confirmation
- **WHEN** l'utilisateur annule la prévisualisation
- **THEN** l'espace courant n'est pas modifié
#### Scenario: Reload after local commit
- **WHEN** un import validé est suivi d'un rechargement
- **THEN** les éléments écrits restent présents
- **AND** aucune seconde importation automatique du fichier n'a lieu
## Notes d'intégration
Les formats d'export de l'application ne sont **pas** identiques aux exports administratifs CLI de Dexie Cloud. Le profil applicatif décrit sa compatibilité et sa stratégie de restauration ; un import Cloud CLI ne doit jamais être assimilé à une importation JSON utilisateur.
