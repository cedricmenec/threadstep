# Spec Delta

## ADDED Requirements

### Requirement: URL discriminator with native nameSuffix

Le nom de base synchronisé SHALL inclure un discriminant stable dérivé de l'URL
normalisée en plus du `nameSuffix` natif Dexie Cloud, qui MUST rester activé.
Deux URL distinctes MUST NOT produire le même nom de base, même si le suffixe
natif dériverait la même valeur.

#### Scenario: Colliding native suffixes stay isolated

- **GIVEN** deux URL Cloud valides dont le suffixe natif serait identique
- **WHEN** leurs noms effectifs de base sont calculés
- **THEN** les deux noms diffèrent par leur discriminant d'URL
- **AND** `nameSuffix` reste activé pour chacune
- **AND** aucune base ni donnée n'est partagée entre les deux espaces

#### Scenario: Deterministic name for a given URL

- **GIVEN** une URL normalisée et son nom de base enregistré
- **WHEN** le nom est recalculé après rechargement ou mise à jour applicative
- **THEN** le même nom de base est obtenu
- **AND** la même base IndexedDB est sélectionnée
- **AND** aucune copie ni migration n'est déclenchée

#### Scenario: Legacy base keeps its original name

- **GIVEN** une base synchronisée créée avant le discriminant d'URL
- **WHEN** son espace est rouvert
- **THEN** son nom d'origine est réutilisé
- **AND** `nameSuffix` reste appliqué
- **AND** aucun changement local en attente n'est abandonné par ce choix de nom
