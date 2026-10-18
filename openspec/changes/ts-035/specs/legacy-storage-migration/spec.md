# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit format provenance and idempotency

Les conversions SHALL maintenir la provenance du format et des IDs, sans préfixage répété d'un identifiant déjà migré. Une reprise ou une seconde exécution MUST reconnaître les records déjà convertis. La conversion locale, l'import Cloud et les réimportations SHALL employer le même résolveur d'identité fondé sur une provenance explicite, jamais sur le seul suffixe `legacy:` ni sur l'absence de préfixe.

#### Scenario: Repeat migration
- **GIVEN** une migration locale réussie
- **WHEN** le même document historique est présenté à nouveau
- **THEN** les éléments identiques sont reconnus
- **AND** aucun second sujet, objet ou groupe n'est créé

#### Scenario: Already mapped identifier
- **GIVEN** un export déclaré comme déjà projeté et contenant `legacy:s1`
- **WHEN** un fichier produit par un export ultérieur est relu
- **THEN** le moteur conserve son identité stable
- **AND** il ne produit pas un ID de forme `legacy:legacy:s1`

#### Scenario: Local and Cloud paths share the same identity result
- **GIVEN** le même document source et la même provenance
- **WHEN** la conversion locale et l'import Cloud construisent leurs enregistrements
- **THEN** les identifiants canoniques, `subjectId` et `parentId` sont identiques
- **AND** aucune des deux voies n'ajoute un préfixe que l'autre n'ajoute pas

#### Scenario: Unmarked source requires a decision
- **GIVEN** un document non marqué, avec ou sans identifiants préfixés
- **WHEN** sa provenance ne peut pas être prouvée
- **THEN** aucune conversion n'est exécutée
- **AND** l'ambiguïté est signalée avec les interprétations possibles
- **AND** la source et la cible restent inchangées

#### Scenario: Historical local key supplies a raw context
- **GIVEN** un document lu depuis `threadstep.document.v1` sans identifiant préfixé
- **WHEN** la conversion locale planifie son mapping
- **THEN** le contexte documenté de la clé historique permet de le traiter comme V1 brut
- **AND** chaque identifiant reçoit une seule fois le préfixe canonique
- **AND** si la valeur contient des identifiants préfixés, l'ambiguïté reste signalée

#### Scenario: Raw identifier that begins with legacy
- **GIVEN** un document explicitement déclaré brut dont un identifiant commence réellement par `legacy:`
- **WHEN** il est converti
- **THEN** il est traité comme un identifiant brut
- **AND** il n'est pas confondu avec un identifiant déjà projeté

#### Scenario: Source mutation invalidates the reviewed plan
- **GIVEN** une prévisualisation locale liée à une empreinte de source
- **WHEN** la valeur historique change avant la confirmation
- **THEN** l'exécution est refusée avec un statut de plan périmé
- **AND** aucun enregistrement n'est écrit dans la cible locale
- **AND** une nouvelle prévisualisation est nécessaire

#### Scenario: Target mutation invalidates the reviewed plan
- **GIVEN** une prévisualisation locale liée à une empreinte de cible
- **WHEN** la cible locale change avant la confirmation
- **THEN** le plan est recalculé et l'ancienne confirmation ne s'applique plus
- **AND** aucune insertion du plan périmé n'est committée
