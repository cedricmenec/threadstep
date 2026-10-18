# Spec Delta

## MODIFIED Requirements

### Requirement: ThreadStep starts from local Dexie
ThreadStep SHALL present its business features on an autonomous local IndexedDB/Dexie workspace from first use without a Cloud URL, OTP or network. Opening that workspace MUST NOT construct or configure a synchronized instance. The initial transition from `threadstep.document.v1` SHALL preserve the historical document and SHALL remain distinct from any remote transmission or automatic conversion.

#### Scenario: First launch after legacy localStorage
- **GIVEN** un document V1 valide avec 5 sujets et 18 étapes sur ce navigateur
- **WHEN** la nouvelle application locale démarre
- **THEN** l'espace local IndexedDB est ouvert sans conversion automatique
- **AND** le contenu historique reste lisible et exportable
- **AND** aucun enregistrement n'est envoyé à Dexie Cloud
- **AND** la conversion vers IndexedDB reste une opération explicite distincte

#### Scenario: No local historical document
- **WHEN** aucun `threadstep.document.v1` valide n'existe
- **THEN** ThreadStep ouvre son espace local IndexedDB vide
- **AND** les sujets peuvent être créés sans configuration Cloud

#### Scenario: Business view without a Cloud identity
- **GIVEN** aucune URL Cloud ni session Cloud n'existe
- **WHEN** l'utilisateur ouvre ThreadStep
- **THEN** les sujets, étapes et exports restent accessibles
- **AND** aucun OTP, email ou identité Cloud n'est requis

## ADDED Requirements

### Requirement: ThreadStep local export and legacy preservation
ThreadStep SHALL export the committed local workspace as a V1-compatible JSON document containing business records and relations but no Cloud configuration, credential or secret. The historical `threadstep.document.v1` backup SHALL remain exportable without conversion.

#### Scenario: Export local records without Cloud
- **GIVEN** des sujets et étapes ont été enregistrés dans l'espace local sans Cloud
- **WHEN** l'utilisateur télécharge une sauvegarde
- **THEN** il obtient le format V1 du projet avec les relations et champs métier
- **AND** l'export ne contient ni URL Cloud, ni OTP, ni credential, ni secret
- **AND** aucune synchronisation ni création de compte n'est déclenchée

#### Scenario: Historical V1 backup remains exportable
- **GIVEN** un document `threadstep.document.v1` existe encore dans le navigateur
- **WHEN** l'utilisateur exporte la sauvegarde historique depuis le mode local
- **THEN** le JSON source est restitué sans réécriture destructive
- **AND** la clé historique n'est ni supprimée ni renommée
- **AND** aucune donnée historique n'est transmise à Dexie Cloud
