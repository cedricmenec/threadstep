# cloud-sync-lifecycle Specification

## Purpose
Décrire une réplication bidirectionnelle Dexie Cloud observable et résiliente sur un espace déjà activé, sans confondre enregistrement local, réseau, synchronisation, résolution de conflit ou première lecture distante.
## Requirements
### Requirement: Native synchronization state mapping
L'application SHALL interpréter `db.cloud.syncState` et les signaux natifs disponibles, sans inventer une connexion. Elle MUST distinguer le statut de transport, la phase de synchronisation et la réussite de chaque écriture locale.
#### Scenario: Connecting is not offline
- **WHEN** `syncState.status` est `connecting`
- **THEN** l'interface indique une connexion en cours
- **AND** elle ne présente ni « synchronisé » ni un refus permanent
#### Scenario: Pulling and pushing
- **WHEN** la phase est `pulling` ou `pushing`
- **THEN** l'interface précise la direction ou une synchronisation en cours
- **AND** elle ne conclut pas « en phase » avant signal natif
#### Scenario: Disconnected, offline and error
- **WHEN** le statut ou la phase reflète une déconnexion, une absence réseau ou une erreur
- **THEN** chaque cause est classée séparément si les signaux le permettent
- **AND** l'absence d'information reste « indéterminée », jamais « Cloud vide »
### Requirement: Durable local writes while offline
Une fois l'espace synchronisé et les droits locaux initialisés, les opérations métier SHALL être persistées localement sans attendre le serveur, dans les limites de la session et des permissions natives. Un échec de push MUST NOT être converti en échec d'écriture locale.
#### Scenario: Edit offline after successful activation
- **GIVEN** un espace Cloud précédemment activé et localement autorisé
- **WHEN** le réseau disparaît et une transaction IndexedDB réussit
- **THEN** la modification reste lisible localement
- **AND** le transfert est signalé « en attente » jusqu'à confirmation
#### Scenario: Local commit fails
- **WHEN** la transaction IndexedDB échoue
- **THEN** l'application ne considère pas la modification comme enregistrée
- **AND** elle distingue cet échec d'une panne réseau
### Requirement: Initial and subsequent sync
La première récupération distante SHALL être distinguée des reprises ordinaires. L'application SHALL utiliser le mécanisme natif approprié, en vérifiant que sa réussite implique le jeu de données attendu et les permissions du compte courant.
#### Scenario: Authenticated initial pull
- **GIVEN** un workspace synchronisé isolé sans données historiques pré-consenties
- **WHEN** la session est établie et la lecture native initiale est exécutée
- **THEN** l'inventaire n'est établi qu'après achèvement de la récupération attendue
- **AND** la projection cible est lue avec les permissions appropriées
#### Scenario: Retry on transient failure
- **WHEN** un premier échange échoue puis le réseau revient
- **THEN** une relance native contrôlée est disponible
- **AND** le statut et les erreurs s'actualisent sans duplication de mutation
### Requirement: Native conflict semantics and business consistency
Les modifications concurrentes SHALL s'appuyer sur les garanties documentées de Dexie Cloud ; l'application MUST expliquer les conséquences des opérations concurrentes pertinentes, notamment les écrasements de propriétés et les suppressions, et tester ses invariants métier.
#### Scenario: Independent field updates
- **GIVEN** deux clients éditant des propriétés distinctes d'un même enregistrement
- **WHEN** ces mutations sont formulées en `update` de propriétés
- **THEN** le résultat observé suit la sémantique de fusion native documentée de Dexie Cloud
- **AND** les tests ne simulent pas un comportement incompatible avec `put`
#### Scenario: Same property concurrent edits
- **GIVEN** deux clients éditant la même propriété sans se voir
- **WHEN** les changements se synchronisent
- **THEN** la règle de résolution native documentée est vérifiée en E2E
- **AND** une politique métier additionnelle est définie si cette résolution ne suffit pas
#### Scenario: Concurrent delete and child edit
- **WHEN** un client supprime un parent et un second édite un descendant hors ligne
- **THEN** le résultat final maintient les invariants de relations définis par le projet
- **AND** aucun descendant orphelin n'est considéré comme un état accepté silencieusement
### Requirement: Truthful diagnostic and native retry
L'interface SHALL afficher l'état local, l'état Cloud, la dernière confirmation connue et les erreurs techniques catégorisées. Les diagnostics MUST NOT contenir de tokens, OTP, titres ou notes d'utilisateur en journal public.
#### Scenario: Sync-complete is not proof of every historical write
- **WHEN** un événement de synchronisation arrive
- **THEN** l'application ne marque comme propagées que les écritures couvertes par une preuve native exploitable
- **AND** elle conserve « indéterminé » lorsqu'une association par lot n'est pas prouvée
#### Scenario: Diagnosis without Cloud
- **WHEN** Cloud n'est pas configuré
- **THEN** l'état affiché est « synchronisation non activée »
- **AND** aucune tentative de connexion n'est effectuée pour afficher le diagnostic
## Notes d'intégration
Types natifs documentés : `SyncStatus = not-started | connecting | connected | disconnected | error | offline` ; `SyncStatePhase = initial | not-in-sync | pushing | pulling | in-sync | error | offline`. Les `currentUser`, `syncState` et `persistedSyncState` doivent être lus avec la version effectivement embarquée. Ne pas réduire tous les autres états à « Dexie Cloud non connecté ».
