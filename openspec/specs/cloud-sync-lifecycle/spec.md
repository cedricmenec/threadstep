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
L'interface SHALL afficher l'état local, l'état Cloud, la dernière confirmation connue et les erreurs techniques catégorisées. Elle MUST distinguer une écriture locale d'une synchronisation confirmée et ne MUST NOT exposer tokens, OTP, emails, titres, notes ni messages d'erreur bruts dans un diagnostic ou un journal public.
#### Scenario: Sync-complete is not proof of every historical write
- **WHEN** un événement de synchronisation arrive
- **THEN** l'application ne marque comme propagées que les écritures couvertes par une preuve native exploitable
- **AND** elle conserve « indéterminé » lorsqu'une association par lot n'est pas prouvée
#### Scenario: Diagnosis without Cloud
- **WHEN** Cloud n'est pas configuré
- **THEN** l'état affiché est « synchronisation non activée »
- **AND** aucune tentative de connexion n'est effectuée pour afficher le diagnostic
#### Scenario: Local write remains distinct from synchronization
- **GIVEN** une transaction IndexedDB locale a réussi
- **WHEN** aucun signal natif n'atteste encore la propagation distante
- **THEN** le diagnostic présente l'écriture comme locale ou en attente
- **AND** il ne la présente pas comme synchronisée
### Requirement: Read-only native synchronization diagnostic
L'application SHALL exposer en lecture seule la session, la connexion, la phase native, l'état du pull initial, la base configurée (URL normalisée et identifiant distant disponible) et le statut des écritures locales. Chaque dimension MUST rester distincte et refléter les observables natifs effectivement disponibles.
#### Scenario: All dimensions are exposed
- **GIVEN** une base Dexie Cloud configurée et une session authentifiée
- **WHEN** l'utilisateur consulte le diagnostic
- **THEN** la session, la connexion, la phase native, le pull initial, la base configurée, les erreurs classées et le statut des écritures locales sont affichés séparément
- **AND** aucune donnée métier, aucun OTP, token ou email n'est affiché
#### Scenario: Diagnostic updates on observable changes
- **WHEN** `currentUser`, `syncState` ou `persistedSyncState` émet un nouvel état
- **THEN** le diagnostic affiche la nouvelle session, connexion, phase et état du pull initial
- **AND** il ne conserve pas un libellé antérieur devenu faux
### Requirement: Transient and indeterminate native states stay distinct
L'application SHALL distinguer `connecting`, `disconnected`, `offline`, `error`, `pulling`, `pushing`, `in-sync` et `indeterminate`. Un état transitoire MUST NOT être transformé en erreur permanente, et une information absente ou contradictoire MUST rester indéterminée.
#### Scenario: Connecting is not a permanent error
- **WHEN** `syncState.status` est `connecting` ou `not-started` pendant une tentative de connexion
- **THEN** le diagnostic indique une connexion en cours
- **AND** il n'affiche ni erreur permanente ni synchronisation terminée
#### Scenario: Pulling and pushing are not in-sync
- **WHEN** la phase native est `pulling` ou `pushing`
- **THEN** le diagnostic précise la synchronisation en cours et sa direction si disponible
- **AND** il n'annonce pas `in-sync` avant le signal natif correspondant
#### Scenario: Offline and disconnected are classified separately
- **WHEN** les signaux natifs reflètent `offline` ou `disconnected`
- **THEN** le diagnostic affiche la cause de transport correspondante
- **AND** il ne la remplace pas par une erreur de permission ou de synchronisation
#### Scenario: Unknown native values are indeterminate
- **WHEN** un statut ou une phase natifs est absent, inconnu ou contradictoire
- **THEN** le diagnostic affiche « indéterminé »
- **AND** il ne conclut ni erreur permanente ni base distante vide
### Requirement: Initial pull evidence and non-empty guarantee
L'application SHALL distinguer un pull initial en attente, en cours, terminé ou en échec à partir de `persistedSyncState` et des signaux natifs. Un échec, une absence de lecture ou un état indéterminé MUST NOT être interprété comme une base distante vide.
#### Scenario: Completed initial pull is proven natively
- **WHEN** `persistedSyncState.initiallySynced` vaut `true` avec une révision serveur connue
- **THEN** le diagnostic indique que le pull initial est terminé
- **AND** il ne propose pas de relance inutile
#### Scenario: Pending initial pull is not an empty base
- **GIVEN** une IndexedDB cible vide et un pull initial encore en attente
- **WHEN** le diagnostic est affiché
- **THEN** il indique que l'état distant n'est pas encore déterminé
- **AND** il affirme explicitement que le Cloud n'est pas considéré comme vide
- **AND** aucune migration ni import n'est déclenché
#### Scenario: Read failure and blocked migration are explained
- **WHEN** une lecture distante échoue ou que l'attestation de synchronisation initiale bloque la migration
- **THEN** le diagnostic affiche une catégorie d'erreur et la raison du blocage
- **AND** aucune base vide n'est déduite de l'échec
- **AND** les données locales et la source historique restent intactes
### Requirement: Truthful local write status
L'application SHALL distinguer une écriture locale confirmée, une synchronisation en attente, une synchronisation prouvée et une erreur. Elle MUST NOT présenter un commit IndexedDB local comme un push distant réussi.
#### Scenario: Local commit is reported as local
- **WHEN** une transaction IndexedDB locale réussit et qu'aucune preuve native n'atteste encore la propagation
- **THEN** le statut des écritures locales indique « enregistré localement » ou « en attente »
- **AND** il n'indique pas « synchronisé »
#### Scenario: Synchronized requires native proof
- **WHEN** l'état natif est `in-sync` avec un pull initial terminé après une écriture locale
- **THEN** le diagnostic peut indiquer « synchronisé »
- **AND** une erreur de synchronisation ultérieure conserve la preuve d'écriture locale tout en affichant l'erreur séparément
### Requirement: Controlled native initial pull retry
L'application SHALL proposer une relance native du pull initial via le mécanisme Dexie Cloud, sans simulation de connexion, sans import et sans mutation produit. La relance MUST être disponible uniquement lorsque la base est configurée, la session authentifiée, le réseau disponible et qu'aucun échange n'est déjà en cours.
#### Scenario: Retry calls only the native pull
- **GIVEN** une base configurée, une session authentifiée et un pull initial en échec ou en attente
- **WHEN** l'utilisateur confirme la relance
- **THEN** l'application appelle le pull natif une seule fois
- **AND** elle n'écrit aucun enregistrement métier, ne se connecte pas et n'importe rien
#### Scenario: Retry unavailable reasons are explained
- **WHEN** la relance n'est pas possible (hors ligne, session absente ou expirée, base non configurée, droit refusé, pull déjà en cours ou déjà terminé)
- **THEN** l'action est désactivée avec une raison compréhensible
- **AND** aucun appel natif n'est effectué
#### Scenario: Failed retry never concludes empty Cloud
- **WHEN** la relance native échoue
- **THEN** le diagnostic classe l'échec et actualise le statut
- **AND** il ne conclut jamais que la base distante est vide
- **AND** il ne duplique aucune mutation produit
#### Scenario: Successful retry resumes the initial read
- **WHEN** la relance native réussit et que les signaux natifs confirment le pull initial
- **THEN** le diagnostic affiche le pull initial terminé et l'état de synchronisation correspondant
- **AND** aucune relance supplémentaire n'est déclenchée automatiquement
### Requirement: Accessible diagnostic and retry on mobile
L'interface SHALL présenter le message de diagnostic et l'action de relance de manière accessible, y compris sur mobile. Le message MUST être annoncé et l'action MUST être opérable au toucher et au clavier avec un libellé explicite.
#### Scenario: Mobile diagnostic exposes a labelled retry action
- **WHEN** le diagnostic est affiché sur un écran mobile
- **THEN** le message d'état est restitué via une zone `aria-live`
- **AND** l'action de relance possède un nom accessible et une cible tactile d'au moins 44 px
- **AND** elle reste utilisable sans pointeur
#### Scenario: Disabled retry keeps an explanation
- **WHEN** la relance est indisponible
- **THEN** le bouton est désactivé
- **AND** la raison reste visible et associée au message d'état
## Notes d'intégration
Types natifs documentés : `SyncStatus = not-started | connecting | connected | disconnected | error | offline` ; `SyncStatePhase = initial | not-in-sync | pushing | pulling | in-sync | error | offline`. Les `currentUser`, `syncState` et `persistedSyncState` doivent être lus avec la version effectivement embarquée. Ne pas réduire tous les autres états à « Dexie Cloud non connecté ».
