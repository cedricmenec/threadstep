# threadstep-integration-profile Specification

## Purpose
Paramétrer les contrats génériques local-first/Dexie Cloud pour ThreadStep, sans exporter les quotas, schémas, OTP obligatoire ou formats historiques du produit dans le socle réutilisable.
## Requirements
### Requirement: ThreadStep starts from local Dexie
ThreadStep SHALL présenter ses fonctionnalités métier sur IndexedDB/Dexie dès la première utilisation sans URL Cloud ni OTP. La migration initiale de `threadstep.document.v1` vers la base locale canonique SHALL être distincte de toute transmission distante.
#### Scenario: First launch after legacy localStorage
- **GIVEN** un document V1 valide avec 5 sujets et 18 étapes sur ce navigateur
- **WHEN** la nouvelle application locale démarre
- **THEN** un parcours de conversion non destructif vers IndexedDB est proposé
- **AND** le contenu historique reste exportable
- **AND** aucun enregistrement n'est envoyé à Dexie Cloud
#### Scenario: No local historical document
- **WHEN** aucun `threadstep.document.v1` valide n'existe
- **THEN** ThreadStep ouvre son espace local IndexedDB vide
- **AND** les sujets peuvent être créés sans configuration Cloud
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
## Adaptation du dépôt
**État existant à modifier après approbation :** `site/app.js` fonctionne en `localStorage` sans Cloud et en IndexedDB soumis à authentification avec Cloud ; `site/migration-reconciliation.js` applique un garde de connexion strict ; les spécifications OpenSpec canoniques actuelles reflètent ce mode historique.
**Trajectoire préconisée :** tâches séparées pour persistance sans Cloud, diagnostic Dexie, activation et rapprochement, corrections import/export, puis E2E ; chaque tâche possède un changement OpenSpec delta et une PR évaluée, jamais une substitution silencieuse des specs existantes.
**Références :** <mention-page url="https://app.notion.com/p/3fc12ac91636815a88a8e55164604d6a"/>, [PR TS-031 #130](https://github.com/cedricmenec/threadstep/pull/130), [source ThreadStep](https://github.com/cedricmenec/threadstep/tree/main/site), [spécifications OpenSpec actuelles](https://github.com/cedricmenec/threadstep/tree/main/openspec/specs).
