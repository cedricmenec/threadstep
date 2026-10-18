# Spec Delta

## ADDED Requirements

### Requirement: Guided activation stages

L'application SHALL présenter un assistant d'activation à étapes observables :
local, préparation, connexion/OTP, première lecture distante attestée, revue et
consentement, transfert local en attente, actif et échec récupérable. Chaque
étape MUST exposer la prochaine action permise et MUST NOT annoncer une étape
non atteinte.

#### Scenario: Local workspace remains the starting point
- **GIVEN** un espace local `threadstep-local` contenant des sujets et des étapes
- **WHEN** l'utilisateur ouvre ThreadStep sans activation Cloud
- **THEN** l'assistant n'est pas actif et les opérations locales restent disponibles
- **AND** aucune configuration, authentification ou réplication Cloud n'est tentée

#### Scenario: Activation reaches each stage only from its evidence
- **WHEN** l'utilisateur démarre l'activation, saisit une URL puis s'authentifie par OTP
- **THEN** l'interface affiche successivement la préparation, la connexion et la première lecture distante
- **AND** elle n'affiche la revue qu'après une lecture distante attestée
- **AND** elle n'affiche le transfert en attente qu'après acceptation du plan affiché

#### Scenario: Abandon before consent leaves both workspaces intact
- **GIVEN** un assistant parvenu à l'étape de revue
- **WHEN** l'utilisateur annule avant de confirmer le plan
- **THEN** aucune écriture de transfert n'est effectuée dans l'espace synchronisé
- **AND** l'espace local et la cible distante restent inchangés
- **AND** l'application revient à un état récupérable sans effacer l'URL ni les données locales

### Requirement: Local source isolated until transfer consent

Tant que le plan de transfert n'a pas été explicitement accepté, les
enregistrements locaux MUST rester dans l'espace autonome non répliqué. La
configuration de l'addon, l'OTP et le premier pull SHALL NOT placer ces
enregistrements dans une table synchronisée, créer une file de mutations
historiques, ni les attacher à l'instance Cloud.

#### Scenario: Configuration and OTP expose no historical record
- **GIVEN** des sujets et étapes créés dans `threadstep-local`
- **WHEN** l'utilisateur enregistre une URL Cloud valide puis termine l'OTP
- **THEN** l'espace synchronisé ne contient aucun de ces enregistrements
- **AND** aucune mutation historique n'est en attente de push
- **AND** l'espace local reste lisible et exportable

#### Scenario: First pull does not push local history
- **GIVEN** une cible Cloud accessible et des données locales non consenties
- **WHEN** la lecture distante initiale est exécutée et attestée
- **THEN** seuls les enregistrements distants autorisés deviennent visibles dans l'espace synchronisé
- **AND** aucun enregistrement local antérieur au consentement n'est envoyé
- **AND** l'application ne suppose pas que `sync({ purpose: "pull" })` empêche à lui seul un push historique

#### Scenario: Cached empty target is not consent or proof
- **GIVEN** l'IndexedDB synchronisée est vide et la lecture initiale n'est pas attestée
- **WHEN** l'assistant évalue la cible
- **THEN** la cible est déclarée indéterminée, jamais vérifiée vide
- **AND** aucun transfert n'est proposé ni exécuté

### Requirement: Attested target classification

Après une première lecture native attestée, l'application SHALL classer la cible
comme vide vérifiée, peuplée, divergente, indisponible/indéterminée ou liée à un
autre compte/périmètre. Une absence de preuve, une erreur de lecture ou des
signaux de session contradictoires MUST produire un état bloqué ou indéterminé.

#### Scenario: Verified empty target
- **GIVEN** une session et une instance autorisées
- **WHEN** le premier cycle de lecture s'achève avec une révision serveur connue et aucune donnée métier
- **THEN** l'assistant présente une cible vérifiée vide
- **AND** il exige toujours le consentement au plan de transfert

#### Scenario: Populated or divergent target
- **GIVEN** une cible attestée contenant déjà des sujets ou des étapes
- **WHEN** l'inventaire compare la source locale et la cible
- **THEN** les enregistrements identiques, absents, divergents et propres à la cible sont distingués
- **AND** seuls les groupes indépendants et sûrs peuvent être proposés à l'insertion
- **AND** aucun enregistrement existant n'est écrasé ou supprimé

#### Scenario: Target unavailable or unreadable
- **WHEN** le service est hors ligne, refuse la lecture ou ne fournit pas de signal initial exploitable
- **THEN** l'assistant bloque la revue et le transfert avec une catégorie compréhensible
- **AND** il ne conclut jamais que la cible est vide
- **AND** la source locale reste intacte

#### Scenario: Target belongs to another account or scope
- **GIVEN** l'utilisateur, l'URL, le `remoteDbId` ou les realms disponibles ne correspondent pas à la cible attendue
- **WHEN** l'assistant vérifie l'identité de destination
- **THEN** il bloque le parcours avec une explication
- **AND** il ne transmet aucun enregistrement local à cette identité

### Requirement: Review and plan-bound consent for local records

Le transfert SHALL présenter la destination normalisée, le `remoteDbId`
disponible, les compteurs source/cible, les insertions prévues, les conflits et
les groupes bloqués. Le consentement MUST porter sur ce plan affiché et sur son
identité de destination ; la réussite de l'OTP ou une cible vide MUST NOT valoir
consentement.

#### Scenario: Consent displays the exact transfer scope
- **GIVEN** une cible attestée et une source locale
- **WHEN** l'assistant affiche le plan de transfert
- **THEN** il indique la destination, la base distante disponible, les compteurs et les opérations proposées
- **AND** aucune écriture n'est effectuée avant une action de confirmation distincte

#### Scenario: Plan changes between preview and confirmation
- **GIVEN** un plan de transfert affiché et accepté
- **WHEN** la source, la cible, la destination, l'utilisateur, les droits, les realms ou les opérations ordonnées changent avant le commit
- **THEN** l'ancien consentement est refusé
- **AND** aucun enregistrement n'est inséré
- **AND** un nouveau plan est présenté pour une nouvelle revue explicite

#### Scenario: Only planned insertions are committed
- **GIVEN** un consentement valide lié au plan affiché
- **WHEN** le transfert est exécuté
- **THEN** seules les insertions `add` prévues sont écrites dans l'espace synchronisé
- **AND** la transaction est atomique
- **AND** la source locale est conservée

### Requirement: Interruption, reload and idempotent resume

Une interruption, un rechargement ou une reprise SHALL revalider la source, la
cible et la destination avant toute nouvelle écriture. Une opération déjà
transférée MUST NOT être rejouée en doublon, et un échec MUST laisser un état
récupérable sans purge implicite.

#### Scenario: Reload during review
- **WHEN** la page est rechargée après une lecture distante mais avant confirmation
- **THEN** le consentement en mémoire est perdu
- **AND** la source et la cible sont relues avant toute nouvelle proposition
- **AND** une nouvelle revue explicite est requise

#### Scenario: Resume after interruption
- **GIVEN** un transfert interrompu avant ou pendant le commit
- **WHEN** l'utilisateur reprend l'activation
- **THEN** l'application distingue non commencé, complet et incertain
- **AND** elle ne répète pas aveuglément les insertions déjà présentes
- **AND** la source locale, la cible et les sauvegardes restent récupérables

#### Scenario: URL or session changes during activation
- **WHEN** l'URL, l'utilisateur ou la base distante change après la prévisualisation
- **THEN** le plan et son consentement sont invalidés
- **AND** aucune donnée n'est copiée vers la nouvelle destination
- **AND** l'ancien espace local reste intact

### Requirement: Activation preserves the autonomous source

Après le transfert, l'application SHALL conserver l'espace local d'origine
récupérable et exportable. Une activation réussie, une erreur distante ou une
annulation MUST NOT purger implicitement les données locales ni la sauvegarde
historique.

#### Scenario: Source survives successful activation
- **GIVEN** un transfert consenti et commité localement
- **WHEN** l'activation se poursuit ou se termine
- **THEN** les données de l'espace local d'origine restent lisibles ou exportables
- **AND** aucune purge locale n'est effectuée
- **AND** aucune suppression distante n'est créée par cette conservation

#### Scenario: Failure after local commit
- **WHEN** les insertions dans l'IndexedDB synchronisée réussissent mais le push ou la synchronisation échoue
- **THEN** l'état indique que le transfert est écrit localement et que la synchronisation est en attente ou en erreur
- **AND** il n'annonce pas un push distant réussi
- **AND** la reprise n'ajoute pas de doublons
