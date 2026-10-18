# Spec Delta

## ADDED Requirements

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
