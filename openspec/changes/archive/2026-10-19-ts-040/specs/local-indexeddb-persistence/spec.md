# Spec Delta

## MODIFIED Requirements

### Requirement: Recoverable local data
L'application SHALL proposer un export lisible de l'espace local au format IndexedDB versionné du projet et MUST utiliser une sauvegarde modern vérifiée avant toute opération destructive. Elle MUST NOT dépendre d'une sauvegarde historique V1 pour la récupération et MUST préserver les clés retirées jusqu'à un nettoyage explicitement consenti.

#### Scenario: Export without Cloud
- **WHEN** l'utilisateur exporte son espace local sans compte Cloud
- **THEN** il obtient les données métier et relations dans le format IndexedDB versionné
- **AND** aucune configuration ou credential Cloud n'est incluse
- **AND** aucun document V1 n'est produit

#### Scenario: Restore uses a verified modern backup
- **GIVEN** une sauvegarde modern saine de l'espace courant
- **WHEN** l'utilisateur prépare une restauration
- **THEN** les comptes et l'empreinte de la sauvegarde sont vérifiés avant écriture
- **AND** une sauvegarde de l'état courant reste disponible
- **AND** une sauvegarde V1 ne peut pas être utilisée

#### Scenario: Legacy V1 key is not a recovery source
- **GIVEN** une clé `threadstep.document.v1` existe et IndexedDB est indisponible
- **WHEN** l'application tente une récupération
- **THEN** elle ne lit ni ne restaure la clé V1 comme donnée métier
- **AND** elle explique que la persistance IndexedDB est indisponible
- **AND** elle ne propose pas d'export V1

#### Scenario: Retired key remains until consent
- **WHEN** l'application démarre, se recharge ou récupère un workspace
- **THEN** aucune clé métier retirée n'est purgée automatiquement
- **AND** seul un nettoyage volontaire, prévisualisé et consenti peut la supprimer

## ADDED Requirements

### Requirement: Versioned non-synchronized local metadata store
L'application SHALL stocker les préférences et métadonnées locales qui référencent des identifiants métier dans un store IndexedDB versionné, local au workspace et explicitement non synchronisé. La migration depuis le stockage local historique MUST être idempotente, vérifiée et résistante aux interruptions, sans écraser une cible déjà peuplée.

#### Scenario: Local metadata store is explicitly unsynchronized
- **GIVEN** une base Dexie synchronisée avec Dexie Cloud
- **WHEN** la configuration native est construite
- **THEN** le store de métadonnées est déclaré dans `unsyncedTables`
- **AND** aucun enregistrement de ce store n'est envoyé au service distant
- **AND** le store n'est pas exporté dans la sauvegarde métier

#### Scenario: Migration survives reload and crash
- **GIVEN** une préférence historique et aucun enregistrement migré
- **WHEN** l'application est interrompue avant ou après l'écriture puis rechargée
- **THEN** la reprise détecte l'état déjà migré ou recommence sans duplication
- **AND** la cible déjà peuplée n'est jamais écrasée
- **AND** la valeur historique reste intacte jusqu'à la vérification

#### Scenario: Metadata write unavailable
- **GIVEN** IndexedDB refuse ou n'expose pas le store de métadonnées
- **WHEN** une préférence est lue ou écrite
- **THEN** l'application signale une erreur locale distincte d'une erreur réseau
- **AND** elle ne prétend pas que la préférence est durablement enregistrée
- **AND** elle ne supprime pas la préférence historique

#### Scenario: Workspaces keep separate metadata
- **GIVEN** un workspace local autonome et un workspace synchronisé
- **WHEN** chacun ouvre sa base locale
- **THEN** chaque base possède son propre store de métadonnées
- **AND** aucune préférence n'est copiée entre les workspaces ou les comptes
- **AND** les identifiants métier d'un workspace ne fuitent pas dans un autre
