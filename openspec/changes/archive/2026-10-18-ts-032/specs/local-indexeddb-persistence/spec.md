# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
