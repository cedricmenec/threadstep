# workspace-identity-isolation Specification

## Purpose
Isoler les espaces locaux, les bases distantes et les identités connectées ; distinguer désactivation de la synchronisation, déconnexion, sélection d'instance et purge sans perte ou divulgation implicite.
## Requirements
### Requirement: Stable workspace identity
Un espace SHALL avoir une identité explicite liant son type (local autonome ou synchronisé), la base locale effective et, s'il existe, la destination et l'utilisateur autorisé. Changer l'URL ou le compte MUST NOT réutiliser aveuglément une autre base locale.
#### Scenario: Switch remote URL
- **GIVEN** un compte lié à l'instance Cloud A avec données locales
- **WHEN** l'utilisateur sélectionne l'instance B
- **THEN** B utilise son espace local distinct
- **AND** aucune donnée A n'est importée ou supprimée implicitement
#### Scenario: Switch account on same URL
- **WHEN** un autre compte s'authentifie pour la même URL
- **THEN** le cache métier de l'ancien compte n'est pas exposé sans permission
- **AND** les données locales strictement personnelles restent séparées ou masquées selon leur espace
### Requirement: Native authentication with least privilege
L'accès distant SHALL utiliser les mécanismes d'identité et permissions de Dexie Cloud, sans embarquer de secret administratif dans le navigateur. Le mode local autonome MUST rester disponible sans identité Cloud.
#### Scenario: No Cloud credentials
- **WHEN** l'utilisateur travaille en local autonome
- **THEN** aucun compte Cloud ni OTP n'est demandé
#### Scenario: Authenticated but unauthorized
- **WHEN** la session OTP est valide mais l'utilisateur n'a pas accès à un realm ou à une table
- **THEN** aucune tentative de contournement n'est effectuée
- **AND** un diagnostic de permission est distinct d'un problème réseau
#### Scenario: Static build inspection
- **WHEN** les assets publics sont inspectés
- **THEN** aucun `dexie-cloud.key`, token administratif, credential machine ou secret n'y figure
### Requirement: Logout is not purge
La déconnexion et la suppression d'une copie locale SHALL être des actions indépendantes. Les comportements de `db.cloud.logout()` MUST être vérifiés avec la version native utilisée avant toute promesse de conservation du cache Cloud.
#### Scenario: Logout with pending writes
- **WHEN** l'utilisateur demande une déconnexion avec des écritures non synchronisées
- **THEN** l'application signale le risque de perte ou de non-publication
- **AND** elle permet d'annuler ou de sauvegarder de manière récupérable
#### Scenario: Local-only workspace survives logout
- **GIVEN** un espace autonome distinct de la base Cloud
- **WHEN** l'utilisateur se déconnecte de Dexie Cloud
- **THEN** l'espace local autonome reste intact et accessible
- **AND** aucune copie distante n'est considérée accessible sans authentification
### Requirement: No implicit destructive switch or purge
Changer l'instance, arrêter la réplication ou supprimer un cache local MUST NOT créer de suppressions synchronisées ou toucher les autres espaces. Toute purge SHALL préciser la portée et obtenir une confirmation explicite.
#### Scenario: User selects different workspace
- **WHEN** l'utilisateur quitte un espace synchronisé pour l'espace local autonome
- **THEN** les données ne sont pas automatiquement fusionnées
- **AND** les modifications encore en attente sont signalées
#### Scenario: Confirm local cache purge
- **WHEN** l'utilisateur confirme la suppression d'un cache local identifié
- **THEN** seules les données locales concernées sont effacées par un mécanisme qui n'émet pas des `delete` métier synchronisés
- **AND** la copie distante et les autres espaces restent inchangés
#### Scenario: Offline cache has unsynced changes
- **WHEN** une purge est demandée alors que des changements locaux ne sont pas propagés
- **THEN** une sauvegarde et un avertissement sont proposés
- **AND** la perte éventuelle n'est pas dissimulée
### Requirement: Operational safety and diagnostics
Les diagnostics et journaux SHALL permettre d'identifier espace, URL normalisée, session, phase et erreurs techniques sans divulguer le contenu métier ni des secrets. Les données de test MUST rester séparées des données personnelles.
#### Scenario: Diagnostic report
- **WHEN** un incident de connexion est étudié
- **THEN** des états natifs observables et une catégorie d'erreur peuvent être transmis
- **AND** aucun OTP, token, email ou texte métier n'est nécessaire dans le journal exportable
#### Scenario: Isolated end-to-end acceptance
- **WHEN** les tests simulent une purge, deux comptes ou un changement d'URL
- **THEN** ils ciblent des bases de test isolées et une origine autorisée
- **AND** aucune donnée de production n'est effacée
## Notes d'intégration
Dexie Cloud utilise un suffixe de nom de base par URL par défaut, mais cette protection seule ne couvre pas toutes les identités d'utilisateur. Une politique supplémentaire de séparation des comptes et des espaces doit être conçue/testée. La suppression physique de la base est différente des commandes métier `delete()`.
