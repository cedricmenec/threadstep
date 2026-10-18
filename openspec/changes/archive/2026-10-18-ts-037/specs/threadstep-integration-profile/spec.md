# Spec Delta

## ADDED Requirements

### Requirement: ThreadStep activates Cloud from its local IndexedDB workspace

Après usage local, ThreadStep SHALL proposer l'activation Cloud depuis
`threadstep-local`. L'URL MUST être une instance `https://…dexie.cloud` valide,
la connexion MUST utiliser l'OTP email natif et la source MUST rester dans la
base autonome jusqu'au consentement de transfert.

#### Scenario: Local subjects exist before activation
- **GIVEN** plusieurs sujets et étapes créés dans `threadstep-local`
- **WHEN** l'utilisateur saisit une URL Dexie Cloud et s'authentifie par OTP
- **THEN** ces sujets et étapes ne sont pas encore synchronisés
- **AND** l'assistant attend la première lecture distante et la prévisualisation du rapprochement
- **AND** l'espace local et son export restent utilisables

#### Scenario: Invalid or unsafe destination is refused
- **WHEN** l'URL n'est pas HTTPS, ne pointe pas vers `dexie.cloud`, est malformée ou contient des identifiants
- **THEN** l'assistant refuse la destination avec un message compréhensible
- **AND** aucune instance synchronisée n'est configurée
- **AND** l'espace local reste inchangé

#### Scenario: OTP does not authorise transfer by itself
- **GIVEN** une session OTP établie
- **WHEN** la lecture distante et l'inventaire sont disponibles
- **THEN** l'application attend une confirmation distincte du plan affiché
- **AND** aucun sujet ni étape local n'est envoyé avant cette confirmation

### Requirement: ThreadStep transfer respects its business profile

Le transfert SHALL conserver les identifiants, titres, ordres, notes,
priorités, états `done` et relations `subjectId`/`parentId` des sujets et étapes.
Il MUST respecter les quotas ThreadStep de 40 sujets et 500 étapes par sujet et
ne MUST PAS réécrire un enregistrement cible existant.

#### Scenario: Five subjects and eighteen steps are transferred intact
- **GIVEN** une source locale de 5 sujets et 18 étapes
- **WHEN** l'utilisateur consent au plan vers une cible vide ou peuplée
- **THEN** seuls les groupes absents et sûrs sont insérés
- **AND** la hiérarchie, les notes, priorités, ordres et états sont conservés
- **AND** la source locale reste intacte et exportable

#### Scenario: Quota or structural constraint blocks only the affected group
- **WHEN** un groupe dépasserait 40 sujets ou 500 étapes dans un sujet, ou présente une relation invalide
- **THEN** ce groupe est refusé avec une raison explicite
- **AND** les groupes indépendants valides peuvent rester proposés
- **AND** aucune écriture partielle n'est confirmée

#### Scenario: Target already contains the local records
- **GIVEN** une cible attestée contenant déjà les enregistrements pertinents
- **WHEN** l'inventaire compare la source locale et la cible
- **THEN** aucune insertion n'est proposée
- **AND** l'assistant indique qu'aucun transfert supplémentaire n'est nécessaire
- **AND** aucune donnée n'est supprimée ou réécrite

### Requirement: ThreadStep activation reports local commit and remote completion separately

Après le transfert, ThreadStep SHALL distinguer l'enregistrement local dans
l'espace synchronisé de l'achèvement distant, et SHALL conserver la source
autonome récupérable. Une erreur postérieure au commit MUST NOT être présentée
comme un échec des données locales ni comme un push réussi.

#### Scenario: Pending synchronization after transfer
- **GIVEN** les insertions de transfert ont réussi dans IndexedDB
- **WHEN** la synchronisation native n'a pas encore confirmé la propagation
- **THEN** l'interface indique « écrit localement, synchronisation en attente »
- **AND** elle n'indique pas « synchronisé »
- **AND** l'espace `threadstep-local` reste récupérable

#### Scenario: Remote completion is shown only with native evidence
- **GIVEN** un transfert localement commité et une session autorisée
- **WHEN** les signaux natifs confirment le premier pull et l'achèvement de la synchronisation attendue
- **THEN** l'interface peut afficher l'achèvement distant
- **AND** cette preuve reste distincte de la réussite de la transaction locale
- **AND** un second appareil doit être vérifié séparément

#### Scenario: Activation failure keeps the local source
- **WHEN** une panne réseau, un refus de permission ou une erreur de synchronisation survient après le commit local
- **THEN** la source locale, l'export et la sauvegarde historique restent accessibles
- **AND** l'interface propose une reprise sans duplication
- **AND** elle ne purge ni ne réinitialise implicitement un espace
