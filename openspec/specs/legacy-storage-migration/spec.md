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
#### Scenario: Invalid source leaves the local target unchanged
- **GIVEN** une cible locale contenant déjà des sujets ou des étapes
- **WHEN** la valeur historique ne satisfait pas les règles de validation V1
- **THEN** aucun plan de conversion n'est exécutable
- **AND** aucun enregistrement local n'est ajouté, modifié ou supprimé
- **AND** un message compréhensible indique que le document est inutilisable
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
#### Scenario: Explicit local review precedes consent
- **GIVEN** un document V1 valide et un espace local autonome sans configuration Cloud
- **WHEN** la conversion locale est proposée
- **THEN** la prévisualisation indique la destination locale, l'inventaire source, l'inventaire de la cible et les insertions prévues
- **AND** elle présente l'empreinte de la source examinée
- **AND** aucune écriture locale n'a lieu avant une confirmation explicite
- **AND** un refus laisse la source et la cible locale inchangées
#### Scenario: Local conversion performs no Cloud activity
- **GIVEN** aucune configuration Cloud active
- **WHEN** l'utilisateur confirme une conversion locale
- **THEN** aucune instance Dexie Cloud n'est construite ou configurée
- **AND** aucun OTP, appel réseau ou file de transfert distant n'est créé
- **AND** le statut obtenu est « conversion locale terminée », jamais « synchronisé »
#### Scenario: Resume preference remains usable
- **GIVEN** une préférence locale de reprise qui référence un sujet et une étape présents dans la source
- **WHEN** la conversion locale réussit
- **THEN** la préférence référence les identifiants convertis du même sujet et de la même étape
- **AND** elle n'est écrite ni dans les tables métier ni dans l'export V1
- **AND** une préférence sans référence dans la source est conservée sans réécriture
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
#### Scenario: Reload restores the converted document
- **GIVEN** un document V1 valide de 5 sujets et 18 étapes converti localement
- **WHEN** l'application est rechargée sans configuration Cloud
- **THEN** les 5 sujets, les 18 étapes et leurs relations sont relus depuis la base locale
- **AND** la source `threadstep.document.v1` et son export de secours restent identiques
#### Scenario: Stable local provenance
- **GIVEN** une conversion locale terminée
- **WHEN** la provenance et l'état de conversion sont consultés
- **THEN** la provenance indique l'empreinte de source, la version de mapping, la cible locale et les comptes convertis
- **AND** elle ne contient aucun titre, note ou autre contenu métier
- **AND** elle distingue la conversion locale d'une activation Cloud
- **AND** elle est conservée après un rechargement tant que la source reste présente

### Requirement: Reviewed conversion into a populated local target
Lorsque la cible locale contient déjà des enregistrements, la conversion SHALL présenter un inventaire explicite et ne SHALL insérer que les enregistrements source absents et indépendants. Un identifiant déjà présent avec un contenu différent MUST NOT être écrasé.
#### Scenario: Populated target is inventoried before consent
- **GIVEN** une cible locale contenant déjà des sujets ou des étapes
- **WHEN** une conversion historique est proposée
- **THEN** la prévisualisation présente les enregistrements locaux existants et les insertions absentes prévues
- **AND** aucun enregistrement existant n'est remplacé sans décision explicite
#### Scenario: Partially populated target receives only missing records
- **GIVEN** une cible locale qui contient déjà une partie des enregistrements source
- **WHEN** l'utilisateur confirme le plan présenté
- **THEN** seuls les enregistrements absents et indépendants sont insérés
- **AND** les enregistrements identiques et les enregistrements locaux propres à la cible restent inchangés
- **AND** une seconde exécution n'ajoute aucun doublon
#### Scenario: Collision blocks without overwrite
- **GIVEN** un identifiant source déjà présent dans la cible locale avec un contenu différent
- **WHEN** la conversion est planifiée ou confirmée
- **THEN** la collision est signalée avant toute écriture
- **AND** l'enregistrement local existant n'est ni remplacé ni supprimé
- **AND** aucun succès de conversion complet n'est annoncé
#### Scenario: Refusal keeps both sides unchanged
- **GIVEN** une cible locale peuplée et un plan de conversion prévisualisé
- **WHEN** l'utilisateur refuse la conversion
- **THEN** la cible locale reste identique
- **AND** la valeur historique reste identique et exportable
## Notes d'intégration
Le profil du projet déclare ses formats historiques et les projections V1 ↔ données Dexie. La migration « base locale vers cible Cloud » appartient à `cloud-opt-in-activation` et `data-reconciliation`, pas à la migration de schéma locale.
