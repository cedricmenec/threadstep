# Spec Delta

## ADDED Requirements

### Requirement: Canonical identity mapping for Cloud imports

Le parcours Cloud (migration historique et import JSON) SHALL résoudre les identifiants avec le même résolveur de provenance que la conversion locale et l'interface. Il MUST conserver les identifiants déjà canoniques, ne jamais produire `legacy:legacy:` pour une source déjà projetée, et MUST bloquer sans écriture une provenance ambiguë. Les relations `subjectId` et `parentId` SHALL suivre la même transformation.

#### Scenario: Cloud import of a projected export
- **GIVEN** un export IndexedDB déclaré canonique contenant `legacy:s1` et une tâche `subjectId: legacy:s1`
- **WHEN** l'utilisateur choisit ce fichier dans l'interface Cloud
- **THEN** le plan utilise le même appel de mapping que l'interface et la conversion locale
- **AND** aucun identifiant ne devient `legacy:legacy:s1`
- **AND** le `subjectId` et le `parentId` restent cohérents

#### Scenario: Second Cloud import creates no duplicate
- **GIVEN** un premier import Cloud confirmé et commité
- **WHEN** le même fichier est importé une seconde fois
- **THEN** les enregistrements identiques sont reconnus
- **AND** aucune insertion ni copie n'est créée
- **AND** les relations existantes restent inchangées

#### Scenario: Raw V1 source is mapped once
- **GIVEN** un document V1 déclaré brut avec des identifiants non préfixés
- **WHEN** il est importé dans une base Cloud attestée
- **THEN** chaque identifiant reçoit une seule fois le préfixe canonique
- **AND** les relations suivent le même mapping

#### Scenario: Ambiguous provenance blocks the Cloud plan
- **GIVEN** un fichier non marqué contenant des identifiants `legacy:`
- **AND** la provenance réelle ne peut pas être prouvée
- **WHEN** l'utilisateur tente de l'importer dans le Cloud
- **THEN** aucun plan d'écriture n'est proposé
- **AND** l'interface demande une décision de provenance avec les deux interprétations
- **AND** aucune donnée n'est écrite avant cette décision

#### Scenario: Unmarked plain identifiers are not assumed raw
- **GIVEN** un fichier non marqué dont les identifiants ne portent aucun préfixe
- **WHEN** il pourrait être un V1 brut ou un ancien export IndexedDB à identifiants générés
- **THEN** l'import Cloud demande explicitement la provenance
- **AND** aucun mapping n'est appliqué avant la réponse
- **AND** une provenance brute confirmée applique le mapping canonique une seule fois

#### Scenario: Historical double-prefixed export is not guessed
- **GIVEN** une source `legacy:legacy:s1` sans provenance explicite
- **WHEN** elle est présentée à l'import Cloud
- **THEN** elle reste ambiguë
- **AND** le moteur ne retire pas un préfixe pour deviner son identité
- **AND** aucun plan n'est appliqué sans provenance confirmée
