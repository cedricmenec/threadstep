# Spec Delta

## ADDED Requirements

### Requirement: Activation first-sync evidence

Pendant et après l'activation, l'application SHALL distinguer le commit
IndexedDB de transfert, la synchronisation en attente, l'achèvement distant
attesté et l'échec de synchronisation. Elle MUST s'appuyer sur les signaux natifs
`syncState` et `persistedSyncState` et MUST conserver un état indéterminé
lorsqu'une propagation par enregistrement n'est pas prouvée.

#### Scenario: Transfer commit is only local
- **GIVEN** un plan de transfert consenti
- **WHEN** la transaction IndexedDB dans l'espace synchronisé réussit sans signal natif de propagation
- **THEN** l'état affiche le transfert comme écrit localement ou en attente
- **AND** il n'affiche ni « synchronisé » ni « push réussi »
- **AND** la source autonome reste récupérable

#### Scenario: First synchronization completes remotely
- **GIVEN** un transfert localement commité
- **WHEN** les signaux natifs attestent une session autorisée, une synchronisation initiale terminée et un état `in-sync` couvrant la destination
- **THEN** l'application peut indiquer que la première synchronisation est achevée
- **AND** elle sépare cette preuve de l'achèvement du simple commit local

#### Scenario: Generic in-sync is not record-level proof
- **WHEN** un état `in-sync` est observé sans preuve native exploitable pour les enregistrements transférés
- **THEN** le statut de propagation reste en attente ou indéterminé
- **AND** l'application ne prétend pas que chaque écriture a atteint le serveur

#### Scenario: Error after commit preserves local evidence
- **GIVEN** le transfert a été commité localement
- **WHEN** le réseau, les permissions ou le service provoquent ensuite une erreur de synchronisation
- **THEN** l'erreur est classée et affichée séparément
- **AND** le commit local reste reconnu comme tel
- **AND** aucun succès distant n'est annoncé

#### Scenario: Retry is native and duplicates nothing
- **GIVEN** un transfert en attente ou en erreur
- **WHEN** l'utilisateur relance la synchronisation native
- **THEN** l'application utilise le mécanisme Dexie Cloud sans simuler de connexion
- **AND** elle ne réinsère pas les enregistrements déjà présents
- **AND** une réponse retardée ne remplace pas un état plus récent

### Requirement: Activation status is observable and reload-safe

L'assistant SHALL afficher la session, la connexion, la phase native, le premier
pull et l'achèvement distant avec des libellés distincts, sans exposer de jeton,
OTP, email ni contenu métier. Après rechargement, l'état MUST être reconstruit
depuis les signaux natifs et la source courante, jamais depuis un message
antérieur conservé en mémoire.

#### Scenario: Native state changes are reflected during activation
- **WHEN** `currentUser`, `syncState` ou `persistedSyncState` émet un nouvel état
- **THEN** l'assistant actualise la connexion, la phase et l'achèvement affichés
- **AND** un état transitoire n'est pas converti en erreur permanente
- **AND** un état inconnu reste indéterminé

#### Scenario: Reload rebuilds activation status
- **WHEN** la page est rechargée pendant ou après l'activation
- **THEN** l'assistant relit les signaux natifs et la source locale courante
- **AND** il ne restaure pas un ancien consentement ni un message de succès obsolète
- **AND** la source historique et l'espace local restent récupérables

#### Scenario: Diagnostic content is redacted
- **WHEN** l'assistant affiche l'état de synchronisation
- **THEN** il n'affiche ni email, ni OTP, ni jeton, ni titre, ni note, ni message d'erreur brut
- **AND** seules des catégories et des valeurs techniques non sensibles sont visibles
