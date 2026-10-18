# threadstep-integration-profile Specification

## Purpose
Paramétrer les contrats génériques local-first/Dexie Cloud pour ThreadStep, sans exporter les quotas, schémas, OTP obligatoire ou formats historiques du produit dans le socle réutilisable.
## Requirements
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
### Requirement: ThreadStep business schema and relationships
Les sujets et étapes SHALL conserver leurs identifiants, titres, ordres, notes, priorités, états `done` et hiérarchie (`subjectId`, `parentId`). Les préférences de reprise restent non synchronisées. Les quotas métier actuels font partie du profil ThreadStep.
#### Scenario: Hierarchy preservation
- **WHEN** un sujet contenant des étapes et sous-étapes est migré
- **THEN** les relations parent et sujet pointent vers les enregistrements corrects
- **AND** les notes, ordres, priorités et états sont conservés
#### Scenario: Business quota is respected
- **WHEN** un import provoquerait un dépassement de la limite ThreadStep (40 sujets ou 500 étapes par sujet)
- **THEN** le groupe concerné est refusé avec une raison explicite
- **AND** les groupes indépendants valides ne sont pas nécessairement bloqués
### Requirement: Explicit ThreadStep Cloud enablement
Après utilisation locale, ThreadStep SHALL proposer un assistant d'activation opt-in. L'URL doit être une instance `https://...dexie.cloud` valide et le parcours de connexion du projet utilise l'OTP email natif. Aucun transfert de données historiques n'a lieu sans consentement spécifique.
#### Scenario: Local data exists before OTP
- **GIVEN** plusieurs sujets créés en local
- **WHEN** l'utilisateur configure Dexie Cloud et saisit un OTP
- **THEN** ces sujets ne sont pas encore synchronisés automatiquement
- **AND** l'interface attend la première lecture de la cible et la prévisualisation de rapprochement
#### Scenario: Same account on a second browser
- **WHEN** un autre navigateur se connecte au même espace Cloud
- **THEN** il récupère les seuls enregistrements autorisés
- **AND** les modifications bidirectionnelles sont validées par une recette E2E réelle
### Requirement: ThreadStep backups and reimport
Le JSON V1 ThreadStep SHALL rester compatible avec les conversions autorisées. Réimporter un export local, historique ou Cloud MUST reconnaître les identifiants métier déjà mappés et offrir fusion/restauration comme intentions distinctes.
#### Scenario: Same document reimport
- **WHEN** un même export JSON ThreadStep est importé une seconde fois
- **THEN** aucun sujet ni étape identique n'est dupliqué
- **AND** les IDs ne reçoivent jamais une seconde fois le préfixe `legacy:`
#### Scenario: Old backup differs from Cloud
- **WHEN** un export ancien est présenté à une cible synchronisée plus récente
- **THEN** un inventaire de différences est présenté avant toute écriture
- **AND** les choix de conservation ou de copie préservent les données déjà présentes
### Requirement: ThreadStep incident recovery and readiness
La recette produit SHALL couvrir Chrome mobile, OTP, première connexion, recharge, données divergentes, deux navigateurs, mode offline et échec de migration. Les spécifications cibles MUST NOT être réputées implémentées sur la seule base d'une CI réussie.
#### Scenario: Existing migration blocked
- **GIVEN** l'interface affiche « Dexie Cloud n'est pas connecté »
- **WHEN** le diagnostic natif de ThreadStep est consulté
- **THEN** les statuts `syncState.status` et `syncState.phase` et la raison du blocage sont affichés de manière sécurisée
- **AND** aucune base vide n'est déduite de l'absence de lecture distante
#### Scenario: Previously imported JSON vanished after reload
- **WHEN** un import semble terminé puis l'application est rechargée
- **THEN** les enregistrements commités localement sont restaurés depuis IndexedDB
- **AND** une synchronisation distante non prouvée reste signalée en attente
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
## Adaptation du dépôt
**État existant à modifier après approbation :** `site/app.js` fonctionne en `localStorage` sans Cloud et en IndexedDB soumis à authentification avec Cloud ; `site/migration-reconciliation.js` applique un garde de connexion strict ; les spécifications OpenSpec canoniques actuelles reflètent ce mode historique.
**Trajectoire préconisée :** tâches séparées pour persistance sans Cloud, diagnostic Dexie, activation et rapprochement, corrections import/export, puis E2E ; chaque tâche possède un changement OpenSpec delta et une PR évaluée, jamais une substitution silencieuse des specs existantes.
**Références :** <mention-page url="https://app.notion.com/p/3fc12ac91636815a88a8e55164604d6a"/>, [PR TS-031 #130](https://github.com/cedricmenec/threadstep/pull/130), [source ThreadStep](https://github.com/cedricmenec/threadstep/tree/main/site), [spécifications OpenSpec actuelles](https://github.com/cedricmenec/threadstep/tree/main/openspec/specs).
