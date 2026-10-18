# local-indexeddb-persistence Specification

## Purpose
Garantir une persistance métier IndexedDB/Dexie autonome, durable, réactive et testable, que Dexie Cloud soit absent, désactivé, inaccessible ou non authentifié. Contrat générique, sans schéma métier imposé.
## Requirements
### Requirement: Autonomous local bootstrap
The application SHALL initialize its autonomous local IndexedDB workspace before and independently of any optional Cloud configuration. It MUST NOT gate local business access on a Cloud URL, account, OTP or network. A local-only launch MUST NOT construct or configure a synchronized Dexie Cloud instance.
#### Scenario: First visit without Cloud
- **GIVEN** aucune configuration Cloud sur le navigateur
- **WHEN** l'utilisateur ouvre l'application
- **THEN** une base Dexie locale versionnée est ouverte
- **AND** l'utilisateur peut créer et consulter ses données sans OTP ni appel Cloud
#### Scenario: Offline first use
- **GIVEN** aucune synchronisation Cloud activée
- **WHEN** l'appareil est hors ligne
- **THEN** les opérations locales restent utilisables après ouverture d'IndexedDB
- **AND** aucune erreur d'authentification Cloud n'est présentée
#### Scenario: No Cloud configuration prerequisite
- **GIVEN** aucune URL Dexie Cloud valide n'est enregistrée
- **WHEN** l'application démarre
- **THEN** la vue métier locale est disponible sans identité Cloud
- **AND** aucun formulaire de configuration ou code OTP ne bloque les opérations métier
- **AND** l'absence ou l'invalidité de l'URL ne remplace pas IndexedDB par un autre stockage métier
#### Scenario: Local mode opens no synchronized instance
- **GIVEN** aucune configuration Cloud active
- **WHEN** l'espace local est ouvert
- **THEN** aucun addon de synchronisation Dexie Cloud n'est construit ou configuré
- **AND** les enregistrements locaux ne sont pas placés dans une table éligible à une réplication distante
### Requirement: Durable transactional business writes
Toute mutation métier SHALL être écrite dans une transaction IndexedDB. La confirmation locale MUST être émise après son succès, jamais avant. Une erreur de stockage SHALL laisser l'interface dans un état réconciliable avec la base.
#### Scenario: Commit followed by reload
- **WHEN** un enregistrement local est créé et sa transaction réussit
- **THEN** un rechargement restitue cet enregistrement et ses relations
- **AND** aucun accusé Cloud n'a été nécessaire
#### Scenario: Local commit fails
- **WHEN** IndexedDB refuse une transaction
- **THEN** la modification n'est pas annoncée comme enregistrée
- **AND** l'utilisateur reçoit un état d'erreur local distinct d'une erreur réseau
- **AND** une sauvegarde récupérable existante n'est pas supprimée
#### Scenario: Atomic dependent records
- **WHEN** une opération crée un parent et plusieurs enfants dépendants
- **AND** la transaction échoue au milieu
- **THEN** aucun sous-ensemble incohérent de cette opération n'est conservé
### Requirement: Versioned schemas and stable identities
Le schéma Dexie SHALL être versionné, et les identifiants métier MUST rester stables et compatibles avec la stratégie d'activation Cloud du projet. Une évolution de schéma MUST NOT supprimer implicitement les données.
#### Scenario: Safe local schema upgrade
- **GIVEN** une ancienne base locale non synchronisée et récupérable
- **WHEN** un schéma compatible est déployé
- **THEN** une évolution testée conserve les enregistrements et relations
- **AND** un échec n'entraîne ni purge automatique ni affichage d'une base faussement vide
#### Scenario: Cloud-compatible identity
- **WHEN** une nouvelle entité est créée localement
- **THEN** elle reçoit un identifiant stable dans l'espace métier attendu
- **AND** sa stratégie de clé est documentée et éprouvée avec Dexie Cloud avant la première activation
### Requirement: Separate local state from remote replication
L'état « enregistré localement » SHALL être indépendant de l'état « synchronisé ». La base locale autonome MUST NOT être considérée comme synchronisable simplement parce que `dexie-cloud-addon` est disponible dans le bundle.
#### Scenario: Local-only write
- **GIVEN** Cloud non activé
- **WHEN** une transaction locale réussit
- **THEN** la donnée est enregistrée localement
- **AND** aucune file de transfert distant n'est créée pour ce contenu
#### Scenario: Storage unavailable
- **WHEN** IndexedDB est indisponible, saturé ou bloqué par le navigateur
- **THEN** l'application explique que la persistance ne peut pas être garantie
- **AND** elle propose une récupération/export si les données sont lisibles
- **AND** elle ne bascule pas silencieusement vers un autre stockage métier
### Requirement: Recoverable local data
L'application SHALL proposer un export lisible de l'espace local et MUST préserver les sauvegardes historiques encore nécessaires jusqu'à la validation de leur migration.
#### Scenario: Export without Cloud
- **WHEN** l'utilisateur exporte son espace local sans compte Cloud
- **THEN** il obtient les données métier et relations selon le format versionné du projet
- **AND** aucune configuration ou credential Cloud n'est incluse
### Requirement: No Cloud activity in local-only mode
When no Cloud activation exists, the application MUST NOT configure Dexie Cloud, request or verify an OTP, open a Cloud connection or create a remote transfer queue for local business content.
#### Scenario: Local write makes no network call
- **GIVEN** l'espace local autonome est ouvert
- **WHEN** une mutation métier locale réussit
- **THEN** aucune requête d'authentification ou de synchronisation Cloud n'est émise
- **AND** la confirmation locale ne mentionne pas une synchronisation distante en attente
#### Scenario: No remote transfer queue
- **GIVEN** des données locales ont été créées sans Cloud
- **WHEN** l'application est rechargée
- **THEN** les données sont relues depuis IndexedDB
- **AND** aucune file de transfert vers une destination Cloud n'a été créée pour ce contenu
## Notes d'intégration
Le nom IndexedDB, la version, les stores et la validation de domaine appartiennent au profil de l'application. Les migrations de *tables déjà synchronisées* relèvent de règles Dexie Cloud plus restrictives et ne sont pas couvertes par la seule upgrade Dexie locale.
