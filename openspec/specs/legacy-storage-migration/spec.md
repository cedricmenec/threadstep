# legacy-storage-migration Specification

## Purpose
Migrer des formats ou supports locaux hérités (localStorage, anciens fichiers, IndexedDB versionnées) vers la base Dexie locale canonique, sans transférer par défaut leur contenu au Cloud ni détruire les originaux.
## Requirements
### Requirement: Strict source detection and validation
L'application SHALL détecter les sources héritées selon un registre de formats/versionnements déclaré par le projet. Une source absente, corrompue ou non identifiable MUST NOT être convertie en base vide ou supprimée.
#### Scenario: Historical valid source
- **GIVEN** un document localStorage reconnu et valide
- **WHEN** l'application démarre
- **THEN** elle identifie une migration locale possible
- **AND** elle ne déclenche aucune écriture distante
#### Scenario: Unsupported or damaged source
- **WHEN** le document hérité ne respecte pas la version et le schéma attendus
- **THEN** aucune migration n'est lancée
- **AND** la valeur brute reste récupérable
### Requirement: Local-only migration with lossless mapping
La migration SHALL convertir dans une transaction les identités, objets et relations prévus par le schéma métier. Le transfert vers le Cloud est une opération ultérieure distincte, soumise au contrat d'activation.
#### Scenario: Nested records and settings
- **GIVEN** une source avec objets parents, enfants, notes et attributs métiers
- **WHEN** la migration locale est acceptée et appliquée
- **THEN** toutes les relations et valeurs conservables sont reproduites
- **AND** les préférences purement locales restent locales
#### Scenario: Local transaction failure
- **WHEN** une transaction de migration échoue
- **THEN** aucun demi-document n'est accepté comme migration complète
- **AND** la source historique reste lisible
### Requirement: Explicit format provenance and idempotency
Les conversions SHALL maintenir la provenance du format et des IDs, sans préfixage répété d'un identifiant déjà migré. Une reprise ou une seconde exécution MUST reconnaître les records déjà convertis.
#### Scenario: Repeat migration
- **GIVEN** une migration locale réussie
- **WHEN** le même document historique est présenté à nouveau
- **THEN** les éléments identiques sont reconnus
- **AND** aucun second sujet, objet ou groupe n'est créé
#### Scenario: Already mapped identifier
- **GIVEN** un ID métier marqué comme déjà migré
- **WHEN** un fichier produit par un export ultérieur est relu
- **THEN** le moteur conserve son identité stable
- **AND** il ne produit pas un ID de forme `legacy:legacy:ID`
### Requirement: Validated schema evolution boundaries
Les migrations de stores synchronisés SHALL suivre les contraintes Dexie Cloud ; une migration locale Dexie `version.upgrade()` MUST NOT être supposée sûre pour réécrire les données déjà synchronisées.
#### Scenario: Upgrade an unsynced local store
- **WHEN** une table non synchronisée reçoit une évolution Dexie documentée
- **THEN** l'upgrade est vérifiée et testée en conservant les enregistrements
#### Scenario: Incompatible already-synced schema
- **WHEN** une nouvelle version modifie une clé primaire ou transforme une table déjà synchronisée
- **THEN** l'opération est exclue de la migration cliente automatique
- **AND** une stratégie de migration contrôlée vers nouvelle table/base est documentée et validée séparément
### Requirement: Recoverability and migration status
L'application SHALL garder l'original et une preuve de conversion jusqu'à validation du résultat. Elle MUST distinguer « conversion locale terminée » et « activation Cloud terminée ».
#### Scenario: Reload during migration
- **WHEN** la page se ferme ou se recharge avant la validation de la migration
- **THEN** la reprise distingue état non commencé, complet ou incertain
- **AND** elle ne répète pas aveuglément des insertions
#### Scenario: Historical export remains available
- **WHEN** l'utilisateur annule ou termine la conversion
- **THEN** l'export du format source reste proposé pendant la période de conservation définie
- **AND** aucune purge ne suit automatiquement
## Notes d'intégration
Le profil du projet déclare ses formats historiques et les projections V1 ↔ données Dexie. La migration « base locale vers cible Cloud » appartient à `cloud-opt-in-activation` et `data-reconciliation`, pas à la migration de schéma locale.
