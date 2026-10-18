# Spec Delta

## ADDED Requirements

### Requirement: Retained historical source is not a migration order

La présence de `threadstep.document.v1` SHALL distinguer la conservation de la
source historique de la nécessité d'une migration. Une source déjà réconciliée
avec les données canoniques, ou explicitement écartée pour une empreinte de
source et une identité de destination données, MUST NOT déclencher
automatiquement une demande d'import ou de nouvelles insertions. La source
MUST rester intacte, accessible et exportable ; une différence réelle MUST
rester observable par une vérification explicite.

#### Scenario: Restored target already contains every relevant record
- **GIVEN** une cible restaurée contenant déjà tous les enregistrements pertinents
- **AND** la clé `threadstep.document.v1` est encore présente
- **WHEN** l'application réévalue la proposition après chargement, synchronisation ou rechargement
- **THEN** aucune demande d'import n'est affichée automatiquement
- **AND** aucune insertion n'est planifiée ni exécutée
- **AND** la source historique reste intacte et exportable

#### Scenario: Explicit dismissal is scoped to source and destination
- **GIVEN** un plan de réconciliation affiché pour une source et une destination
- **WHEN** l'utilisateur refuse explicitement cette proposition
- **THEN** ce refus est mémorisé pour l'empreinte de la source, l'URL,
  le `remoteDbId` et l'utilisateur authentifié
- **AND** un rechargement ou une synchronisation ultérieure ne repropose pas
  automatiquement cette migration
- **AND** `threadstep.document.v1` n'est ni supprimé ni modifié
- **AND** son export reste disponible

#### Scenario: A different source or destination reopens verification
- **GIVEN** une proposition explicitement écartée pour une source et une destination
- **WHEN** le contenu de la source, l'URL Cloud, la base distante ou le compte change
- **THEN** l'ancien écartement ne s'applique plus
- **AND** une nouvelle vérification sûre peut être proposée
- **AND** aucune donnée n'est copiée ou insérée automatiquement vers la nouvelle identité

#### Scenario: A real difference remains observable
- **GIVEN** une source historique conservée et un écartement ou un résultat déjà réconcilié
- **WHEN** l'utilisateur demande explicitement à vérifier la sauvegarde historique
- **THEN** l'inventaire courant et toute différence réelle sont affichés
- **AND** aucune écriture n'est effectuée sans une nouvelle confirmation explicite

#### Scenario: Dismissal metadata is not business data
- **WHEN** un écartement est enregistré ou relu
- **THEN** seuls une version et des clés opaques sont conservés localement
- **AND** aucun titre, note, email, OTP, jeton ni identifiant utilisateur brut
  n'est stocké ou affiché
- **AND** un stockage indisponible n'entraîne ni suppression de la source ni
  migration implicite
