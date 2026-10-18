# Spec Delta

## MODIFIED Requirements

### Requirement: Consent bound to the displayed plan
Le consentement SHALL être lié au plan **effectivement présenté**, à son
empreinte source/cible, à l'identité, au périmètre, aux résolutions, à la
destination et aux opérations ordonnées qu'il contient. Toute divergence entre
ce plan et une revalidation MUST demander une nouvelle revue et refuser
l'ancien consentement. Les droits, les realms, le `remoteDbId` et l'ordre de
migration font partie de l'identité des données autorisées.

#### Scenario: Target changed after preview
- **WHEN** un autre client modifie la cible pendant l'affichage du plan
- **THEN** la confirmation précédente est refusée
- **AND** un nouveau plan est affiché, à accepter séparément

#### Scenario: Source changed after preview
- **WHEN** l'utilisateur modifie le document local après la prévisualisation
- **THEN** le plan devient périmé
- **AND** aucune mutation n'est exécutée sur l'ancien consentement

#### Scenario: Replanning is not automatic consent
- **WHEN** le moteur recalcule un nouveau plan pendant le clic de confirmation
- **THEN** il compare son empreinte à celle que l'utilisateur avait réellement vue
- **AND** toute différence nécessite un nouveau geste explicite avant commit

#### Scenario: Recomputed plan differs during confirmation
- **GIVEN** un plan affiché et son consentement explicite
- **WHEN** la relecture de la source ou de la cible produit un plan différent
  avant le commit
- **THEN** le consentement affiché est refusé
- **AND** le nouvel inventaire et les nouveaux groupes sont affichés pour revue
- **AND** l'adaptateur de commit n'est pas appelé
- **AND** aucune insertion n'est effectuée

#### Scenario: Ordered operations or rights changed after preview
- **GIVEN** un consentement lié au plan affiché
- **WHEN** l'ordre des insertions planifiées, les groupes bloqués, les droits,
  les realms, l'URL ou le `remoteDbId` diffèrent lors de la revalidation
- **THEN** le plan est refusé comme périmé
- **AND** aucune insertion n'est effectuée
- **AND** une nouvelle revue est nécessaire

#### Scenario: Destination or identity switched
- **WHEN** l'URL Cloud, le `remoteDbId`, l'utilisateur, ses droits ou ses realms changent
- **THEN** le plan est invalidé
- **AND** aucune donnée n'est transférée à cette nouvelle identité
- **AND** aucune réparation n'est appliquée sur cette nouvelle destination

#### Scenario: Same displayed plan commits once
- **GIVEN** la source, la destination, l'utilisateur, la cible, les résolutions,
  les droits et les opérations ordonnées sont identiques au plan affiché
- **WHEN** le consentement explicite de ce plan est soumis
- **THEN** la couche de migration appelle l'adaptateur une seule fois
- **AND** elle n'autorise que les insertions `add` affichées
