# Spec Delta

## MODIFIED Requirements

### Requirement: Retained historical source is not a migration order
La présence de `threadstep.document.v1` SHALL être traitée comme une donnée retirée et non comme une source de migration ou d'import. Elle MUST NOT déclencher de proposition, de conversion, d'insertion, d'export V1 ou de trafic Cloud. La valeur MUST rester physiquement intacte jusqu'à un nettoyage volontaire et consenti, et une différence réelle doit être observée uniquement à partir des données IndexedDB et des sauvegardes modernes.

#### Scenario: Restored target already contains every relevant record
- **GIVEN** une cible restaurée contenant déjà tous les enregistrements pertinents
- **AND** la clé `threadstep.document.v1` est encore présente
- **WHEN** l'application réévalue après chargement, synchronisation ou rechargement
- **THEN** aucune demande d'import ou de migration n'est affichée
- **AND** aucune insertion n'est planifiée ni exécutée
- **AND** la clé reste intacte et n'est pas exportée

#### Scenario: A real difference remains observable
- **GIVEN** une clé V1 conservée et un workspace Cloud ou local
- **WHEN** une réconciliation, une activation ou un import est préparé
- **THEN** la clé V1 n'est pas lue comme source
- **AND** aucun plan ne contient d'enregistrement dérivé d'elle
- **AND** les compteurs et empreintes proviennent des données IndexedDB ou du fichier modern choisi

#### Scenario: Explicit dismissal is scoped to source and destination
- **GIVEN** une ancienne préférence d'écartement liée à une migration V1
- **WHEN** l'application démarre
- **THEN** cette préférence n'est plus utilisée pour décider d'une offre
- **AND** la portée historique de l'écartement ne s'applique plus à aucun parcours courant
- **AND** elle n'empêche ni n'autorise aucune opération métier
- **AND** elle peut être supprimée uniquement par le nettoyage volontaire des clés retirées

#### Scenario: A different source or destination reopens verification
- **GIVEN** une clé V1 conservée
- **WHEN** le contenu de la source, l'URL Cloud, la base distante ou le compte change
- **THEN** aucune migration V1 n'est proposée
- **AND** seules une vérification explicite d'une sauvegarde modern et les données IndexedDB peuvent rouvrir un plan
- **AND** aucune donnée n'est copiée ou insérée automatiquement vers la nouvelle identité

#### Scenario: Dismissal metadata is not business data
- **WHEN** un écartement historique est relu ou nettoyé
- **THEN** seuls une version et des clés opaques peuvent être conservés localement
- **AND** aucun titre, note, email, OTP, jeton ni identifiant utilisateur brut
  n'est stocké ou affiché
- **AND** un stockage indisponible n'entraîne ni suppression de la source ni
  migration implicite
