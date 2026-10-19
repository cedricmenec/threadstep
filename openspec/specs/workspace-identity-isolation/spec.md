# workspace-identity-isolation Specification

## Purpose
Isoler les espaces locaux, les bases distantes et les identités connectées ; distinguer désactivation de la synchronisation, déconnexion, sélection d'instance et purge sans perte ou divulgation implicite.
## Requirements
### Requirement: Stable workspace identity
Un espace SHALL avoir une identité explicite liant son type (local autonome ou synchronisé), la base locale effective et, s'il existe, la destination et l'utilisateur autorisé. Changer l'URL ou le compte MUST NOT réutiliser aveuglément une autre base locale.
#### Scenario: Switch remote URL
- **GIVEN** un compte lié à l'instance Cloud A avec données locales
- **WHEN** l'utilisateur sélectionne l'instance B
- **THEN** B utilise son espace local distinct
- **AND** aucune donnée A n'est importée ou supprimée implicitement
#### Scenario: Switch account on same URL
- **WHEN** un autre compte s'authentifie pour la même URL
- **THEN** le cache métier de l'ancien compte n'est pas exposé sans permission
- **AND** les données locales strictement personnelles restent séparées ou masquées selon leur espace
### Requirement: Native authentication with least privilege
L'accès distant SHALL utiliser les mécanismes d'identité et permissions de Dexie Cloud, sans embarquer de secret administratif dans le navigateur. Le mode local autonome MUST rester disponible sans identité Cloud.
#### Scenario: No Cloud credentials
- **WHEN** l'utilisateur travaille en local autonome
- **THEN** aucun compte Cloud ni OTP n'est demandé
#### Scenario: Authenticated but unauthorized
- **WHEN** la session OTP est valide mais l'utilisateur n'a pas accès à un realm ou à une table
- **THEN** aucune tentative de contournement n'est effectuée
- **AND** un diagnostic de permission est distinct d'un problème réseau
#### Scenario: Static build inspection
- **WHEN** les assets publics sont inspectés
- **THEN** aucun `dexie-cloud.key`, token administratif, credential machine ou secret n'y figure
### Requirement: Logout is not purge
La déconnexion et la suppression d'une copie locale SHALL être des actions indépendantes. Les comportements de `db.cloud.logout()` MUST être vérifiés avec la version native utilisée avant toute promesse de conservation du cache Cloud.
#### Scenario: Logout with pending writes
- **WHEN** l'utilisateur demande une déconnexion avec des écritures non synchronisées
- **THEN** l'application signale le risque de perte ou de non-publication
- **AND** elle permet d'annuler ou de sauvegarder de manière récupérable
#### Scenario: Local-only workspace survives logout
- **GIVEN** un espace autonome distinct de la base Cloud
- **WHEN** l'utilisateur se déconnecte de Dexie Cloud
- **THEN** l'espace local autonome reste intact et accessible
- **AND** aucune copie distante n'est considérée accessible sans authentification
### Requirement: No implicit destructive switch or purge
Changer l'instance, arrêter la réplication ou supprimer un cache local MUST NOT créer de suppressions synchronisées ou toucher les autres espaces. Toute purge SHALL préciser la portée et obtenir une confirmation explicite.
#### Scenario: User selects different workspace
- **WHEN** l'utilisateur quitte un espace synchronisé pour l'espace local autonome
- **THEN** les données ne sont pas automatiquement fusionnées
- **AND** les modifications encore en attente sont signalées
#### Scenario: Confirm local cache purge
- **WHEN** l'utilisateur confirme la suppression d'un cache local identifié
- **THEN** seules les données locales concernées sont effacées par un mécanisme qui n'émet pas des `delete` métier synchronisés
- **AND** la copie distante et les autres espaces restent inchangés
#### Scenario: Offline cache has unsynced changes
- **WHEN** une purge est demandée alors que des changements locaux ne sont pas propagés
- **THEN** une sauvegarde et un avertissement sont proposés
- **AND** la perte éventuelle n'est pas dissimulée
### Requirement: Operational safety and diagnostics
Les diagnostics et journaux SHALL permettre d'identifier espace, URL normalisée, session, phase et erreurs techniques sans divulguer le contenu métier ni des secrets. Les données de test MUST rester séparées des données personnelles. Le diagnostic SHALL se mettre à jour lors d'un changement de session, d'URL ou de base distante.
#### Scenario: Diagnostic report
- **WHEN** un incident de connexion est étudié
- **THEN** des états natifs observables et une catégorie d'erreur peuvent être transmis
- **AND** aucun OTP, token, email ou texte métier n'est nécessaire dans le journal exportable
#### Scenario: Isolated end-to-end acceptance
- **WHEN** les tests simulent une purge, deux comptes ou un changement d'URL
- **THEN** ils ciblent des bases de test isolées et une origine autorisée
- **AND** aucune donnée de production n'est effacée
#### Scenario: Session or URL change updates the diagnostic
- **GIVEN** un diagnostic affichant une session et une URL données
- **WHEN** la session change ou une autre URL Dexie Cloud est enregistrée
- **THEN** le diagnostic affiche la nouvelle session et la nouvelle URL normalisée
- **AND** il signale une incohérence si la base distante persistée ne correspond plus
- **AND** aucune donnée de l'ancien espace n'est copiée ou exposée
#### Scenario: No personal or secret data in the diagnostic
- **WHEN** une session authentifiée affiche le diagnostic
- **THEN** le diagnostic ne contient ni email, ni OTP, ni token, ni titre, ni note, ni message d'erreur brut
- **AND** il ne contient aucun identifiant utilisateur réversible ou secret
- **AND** seule une catégorie de session et la base configurée sont exposées
### Requirement: Visibility, permissions and destination context in recovery
Le diagnostic et l'inventaire de récupération SHALL exposer le type d'espace, l'URL normalisée, le `remoteDbId` disponible, une catégorie de session et la disponibilité des droits/realms, sans email, OTP, token ni contenu métier. Une référence invisible faute de droit MUST NOT être assimilée à une suppression. Un plan de réparation SHALL être lié au compte, à l'URL et à la base distante affichés.
#### Scenario: Invisible reference keeps its permission context
- **GIVEN** une session authentifiée dont les droits ou realms peuvent masquer un sujet
- **WHEN** une tâche référence ce sujet sans le trouver localement
- **THEN** le diagnostic indique une visibilité ou une autorisation indéterminée
- **AND** il ne présente pas le sujet comme supprimé
- **AND** aucun sujet fictif n'est créé pour réparer la référence
#### Scenario: Diagnostic shows instance context without personal data
- **WHEN** l'inventaire ou le diagnostic de récupération est affiché
- **THEN** il distingue l'espace local de l'espace synchronisé
- **AND** il affiche l'URL normalisée et le `remoteDbId` lorsqu'ils sont disponibles
- **AND** il n'affiche ni email, ni OTP, ni token, ni titre, ni note
#### Scenario: Account or base change invalidates recovery consent
- **WHEN** l'utilisateur, l'URL Cloud, le `remoteDbId`, les droits ou les realms changent après la prévisualisation
- **THEN** le plan de réparation est invalidé
- **AND** aucune donnée n'est réparée ou copiée vers la nouvelle identité
- **AND** les anciennes données restent intactes
#### Scenario: Recovery events stay free of personal content
- **WHEN** un événement de récupération, d'ambiguité ou de rejet est produit
- **THEN** il expose un code et un compte
- **AND** il ne contient aucun titre, note, email, OTP, token ou secret
- **AND** il n'est pas publié dans un journal public avec des identifiants privés
### Requirement: URL-scoped workspace registry

L'application SHALL conserver un registre local à l'origine, non synchronisé et
à clés autorisées, identifiant l'espace autonome et chaque espace synchronisé par
URL normalisée, nom effectif de base locale, version de schéma, `remoteDbId`
facultatif, empreinte opaque du compte et statut. Il MUST NOT contenir email,
OTP, jeton, identifiant de compte brut ni contenu métier. Un registre illisible
MUST NOT autoriser une suppression ou un transfert.

#### Scenario: A synchronized workspace is registered once per URL

- **GIVEN** aucune entrée de registre pour une URL Cloud normalisée
- **WHEN** cette URL est activée ou sélectionnée
- **THEN** une entrée est créée avec son nom effectif de base, sa version de schéma et son statut
- **AND** un second enregistrement de la même URL réutilise cette entrée
- **AND** aucun email, OTP, jeton ou identifiant brut n'est écrit

#### Scenario: A/B/A returns to the original workspace

- **GIVEN** les espaces A et B enregistrés avec des données locales distinctes
- **WHEN** l'utilisateur sélectionne A, puis B, puis A
- **THEN** chaque sélection ouvre la base locale propre à l'URL choisie
- **AND** aucune donnée n'est copiée ou fusionnée entre A et B
- **AND** les données propres à chaque instance et leur préférence de reprise sont retrouvées
- **AND** aucune base des espaces non sélectionnés n'est supprimée

#### Scenario: Malformed registry fails closed

- **GIVEN** un registre illisible, d'une version inconnue ou aux clés non autorisées
- **WHEN** l'application démarre ou demande une action destructive
- **THEN** elle ne purge aucune base et ne copie aucune donnée
- **AND** elle revient à un état local récupérable avec un message compréhensible

### Requirement: Distinct local base per remote URL

Chaque espace synchronisé SHALL utiliser un nom de base locale stable dérivé de
son URL normalisée, en complément du `nameSuffix` natif Dexie Cloud. Deux URL
distinctes MUST NOT partager une base même lorsque le suffixe natif produirait la
même valeur. Une base héritée SHALL conserver son nom existant.

#### Scenario: Native suffix collision is prevented

- **GIVEN** deux URL Cloud distinctes dont le suffixe natif dériverait la même valeur
- **WHEN** les deux espaces sont enregistrés
- **THEN** leurs noms effectifs de base locale sont différents
- **AND** aucune donnée de l'un n'est lue ni écrite dans la base de l'autre

#### Scenario: Same URL reuses the same base

- **GIVEN** une URL déjà enregistrée avec son nom effectif de base
- **WHEN** cette URL est sélectionnée à nouveau
- **THEN** le même nom de base locale est réutilisé
- **AND** aucune copie ni migration de données n'est déclenchée

#### Scenario: Existing legacy base keeps its name

- **GIVEN** une configuration Cloud livrée avant le registre
- **WHEN** le registre est initialisé pour cette URL
- **THEN** l'entrée conserve le nom de base legacy déjà utilisé
- **AND** les changements locaux non synchronisés restent attachés à cette base

### Requirement: Recovery of unverified freshly synchronized cache
Un pull natif peut remplir une nouvelle IndexedDB avant l'écriture de la première liaison de compte. L'application MUST NOT adopter ce cache peuplé sans preuve. Elle SHALL proposer une récupération confirmée dans une base isolée liée à l'identité attestée, en conservant l'ancien cache, les mutations et l'espace autonome intacts.
#### Scenario: Tablet completes OTP and pull before account binding
- **GIVEN** une session OTP authentifiée, un premier pull terminé et un nouveau cache peuplé sans empreinte de compte
- **WHEN** ThreadStep constate que le cache reste non vérifié
- **THEN** aucune donnée métier du cache non lié n'est affichée
- **AND** une action explicite de récupération isolée reste visible même pour une base `threadstep-ws-*` en activation
#### Scenario: Attested isolated recovery
- **GIVEN** la session, l'URL, l'identité et la base distante attestées, sans mutation locale en attente
- **WHEN** l'utilisateur confirme la récupération
- **THEN** une nouvelle base vierge et inédite est liée à l'empreinte opaque du compte avant toute lecture métier
- **AND** aucune donnée n'est copiée depuis l'ancien cache, conservé sans suppression
- **AND** aucune mutation distante n'est créée par la récupération
#### Scenario: Unsafe recovery remains blocked
- **WHEN** les mutations sont en attente, les preuves distantes manquent, l'identité diffère ou le nom de la base candidate existe
- **THEN** aucune récupération ni changement de base n'est appliqué
- **AND** le cache initial demeure intact

### Requirement: Account binding on a shared URL

Un espace synchronisé SHALL être lié à une empreinte opaque du compte authentifié.
Avant d'afficher un enregistrement métier, l'application SHALL comparer
l'empreinte de la session courante à cette liaison. Si une liaison existe et
diffère, ou si un cache legacy non vérifié contient des enregistrements,
l'application MUST masquer les données métier et exiger une déconnexion ou une
purge explicite ; elle MUST NOT copier ces données vers la nouvelle identité.

#### Scenario: Bound account reads its own workspace

- **GIVEN** un espace synchronisé lié à l'empreinte du compte A
- **WHEN** la session authentifiée correspond au compte A
- **THEN** les enregistrements de l'espace peuvent être lus et affichés
- **AND** la liaison reste opaques dans le stockage local

#### Scenario: Another account on the same URL is blocked

- **GIVEN** un espace lié au compte A et un cache local contenant ses enregistrements
- **WHEN** une session authentifiée correspond à un compte B pour la même URL
- **THEN** aucun enregistrement de A n'est affiché ni exporté
- **AND** aucune écriture métier n'est effectuée pour B
- **AND** l'application explique qu'une déconnexion ou une purge explicite est requise

#### Scenario: Unverified legacy cache is not shown

- **GIVEN** un cache synchronisé antérieur au registre, sans liaison de compte
- **AND** ce cache contient des enregistrements métier
- **WHEN** une session s'authentifie pour cette URL
- **THEN** les enregistrements restent masqués tant que l'identité du cache n'est pas vérifiée
- **AND** aucune suppression distante n'est demandée
- **AND** l'utilisateur peut annuler, se déconnecter ou purger la copie locale explicitement

#### Scenario: Explicit logout clears the previous cache before a new binding

- **GIVEN** un espace lié au compte A
- **WHEN** l'utilisateur confirme la déconnexion puis authentifie le compte B
- **THEN** la déconnexion native a supprimé le cache synchronisé local de A
- **AND** B est lié à un cache vide avant toute lecture métier
- **AND** aucune donnée de A n'est exposée à B

### Requirement: Separate workspace, suspension, logout and purge actions

L'application SHALL exposer la sélection d'espace, la suspension, la déconnexion
et la purge locale comme des actions indépendantes. La suspension MUST fermer
l'espace synchronisé et revenir à l'espace autonome sans terminer la session,
supprimer un cache ni changer la destination. La sélection MUST NOT copier de
données.

#### Scenario: Suspending Cloud returns to the autonomous workspace

- **GIVEN** un espace synchronisé actif lié à un compte
- **WHEN** l'utilisateur suspend Cloud
- **THEN** l'espace autonome redevient actif
- **AND** l'URL, le `remoteDbId` et la liaison de compte restent enregistrés
- **AND** aucune purge ni déconnexion n'a lieu
- **AND** la reprise ultérieure sélectionne la même base et la même destination

#### Scenario: Selecting the autonomous workspace from Cloud

- **GIVEN** un espace synchronisé avec des changements en attente
- **WHEN** l'utilisateur sélectionne l'espace autonome
- **THEN** le cache synchronisé et ses changements restent conservés
- **AND** l'application signale que la synchronisation est interrompue
- **AND** les données autonomes ne sont ni remplacées ni fusionnées

#### Scenario: Suspension is not logout

- **GIVEN** une session authentifiée valide
- **WHEN** l'utilisateur suspend Cloud
- **THEN** aucune déconnexion native n'est appelée
- **AND** la session peut être réutilisée à la reprise
- **AND** aucune action distante n'est émise

### Requirement: Pending-change diagnosis before destructive action

Avant une déconnexion ou une purge, l'application SHALL déterminer si des
changements synchronisés restent non transmis, avertir de leur perte possible,
identifier l'espace concerné et proposer l'annulation ainsi qu'un instantané JSON
téléchargeable avant confirmation explicite. Une preuve de changements
indisponible MUST être traitée comme une perte possible, jamais comme une absence.

#### Scenario: Logout with pending writes

- **GIVEN** un espace synchronisé dont des changements ne sont pas attestés comme transmis
- **WHEN** l'utilisateur demande une déconnexion
- **THEN** l'application avertit avant tout changement de session
- **AND** elle propose d'annuler, de télécharger un instantané JSON ou de continuer explicitement
- **AND** aucune déconnexion n'est exécutée avant la décision

#### Scenario: Purge with pending writes

- **GIVEN** une purge demandée alors que des changements locaux ne sont pas propagés
- **WHEN** l'avertissement est affiché
- **THEN** la perte possible est annoncée sans la dissimuler
- **AND** l'instantané JSON porte l'état courant de l'espace
- **AND** la purge reste bloquée jusqu'à confirmation explicite

#### Scenario: Pending count cannot be established

- **GIVEN** les signaux natifs ne permettent pas de compter les changements en attente
- **WHEN** l'utilisateur demande une déconnexion ou une purge
- **THEN** l'application présente un état indéterminé comme risque de perte
- **AND** elle ne déclare pas qu'aucun changement n'est en attente
- **AND** elle exige une confirmation explicite avec sauvegarde proposée

#### Scenario: User cancels the destructive action

- **GIVEN** un avertissement de changements en attente affiché
- **WHEN** l'utilisateur annule
- **THEN** la session, la base locale et la destination restent inchangées
- **AND** aucune suppression ni écriture métier n'est effectuée

### Requirement: Scoped physical purge without remote deletion

Une purge locale SHALL supprimer uniquement la base IndexedDB locale identifiée,
par suppression physique de la base après sa fermeture. Elle MUST NOT appeler la
suppression de tables métier, MUST NOT supprimer les données distantes, les bases
d'autres URL ou l'espace autonome, et SHALL conserver la destination pour un
futur pull.

#### Scenario: Purge a synchronized local cache

- **GIVEN** un espace synchronisé identifié par son URL et son nom de base effectif
- **WHEN** l'utilisateur confirme sa purge locale
- **THEN** seule cette base locale est supprimée physiquement
- **AND** aucune requête de suppression d'enregistrement métier n'est émise
- **AND** la configuration Cloud et les autres bases restent présentes
- **AND** une reconnexion ultérieure peut récupérer les données distantes

#### Scenario: Purge the autonomous workspace

- **GIVEN** l'espace autonome sélectionné
- **WHEN** sa purge est explicitement confirmée
- **THEN** seule la base locale autonome est supprimée
- **AND** les bases synchronisées et les destinations Cloud restent intactes

#### Scenario: Purge does not touch another workspace

- **GIVEN** les espaces A et B présents sur l'appareil
- **WHEN** la base locale de A est purgée
- **THEN** la base locale, les changements et la liaison de B restent inchangés
- **AND** la purge de A ne produit aucune suppression distante

### Requirement: Redacted workspace diagnostic

Le diagnostic SHALL exposer le type d'espace, le nom effectif de base locale,
l'URL normalisée, le `remoteDbId` disponible, une catégorie de session et une
catégorie de liaison de compte, sans email, OTP, jeton, identifiant brut, titre,
note ni message d'erreur brut. Il MUST être recalculé lors d'un changement
d'espace, de session ou d'URL.

#### Scenario: A/B/A updates the diagnostic

- **GIVEN** un diagnostic affichant l'espace A
- **WHEN** l'utilisateur sélectionne B puis revient à A
- **THEN** le diagnostic affiche à chaque fois le type, la base et l'URL courants
- **AND** il ne conserve pas l'identité d'un autre espace
- **AND** aucune donnée métier de A ou B n'y est copiée

#### Scenario: Account mismatch is reported without personal data

- **GIVEN** une liaison de compte et une session courante différentes
- **WHEN** le diagnostic est affiché
- **THEN** il indique une catégorie de liaison incompatible
- **AND** il ne contient ni email, ni OTP, ni jeton, ni identifiant brut
- **AND** aucun contenu métier n'est exposé

#### Scenario: Diagnostic changes with the session or URL

- **GIVEN** un diagnostic affichant une session et une URL données
- **WHEN** la session change ou une autre URL est enregistrée
- **THEN** le diagnostic affiche la nouvelle catégorie de session et la nouvelle URL normalisée
- **AND** il signale une incohérence si la base persistée ne correspond plus
- **AND** aucune donnée de l'ancien espace n'est copiée ou exposée

## Notes d'intégration
Dexie Cloud utilise un suffixe de nom de base par URL par défaut, mais cette protection seule ne couvre pas toutes les identités d'utilisateur. Une politique supplémentaire de séparation des comptes et des espaces doit être conçue/testée. La suppression physique de la base est différente des commandes métier `delete()`.
