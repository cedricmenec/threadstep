# Spec Delta

## MODIFIED Requirements

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

#### Scenario: Attested binding survives reload and OTP restoration

- **GIVEN** un espace lié au compte A, avec une base locale peuplée et une URL inchangée
- **WHEN** la page est rechargée puis la session native est restaurée ou renouvelée par OTP avec le compte A
- **THEN** la même base locale et la même liaison sont relues avant toute lecture métier
- **AND** les enregistrements de A sont affichés sans créer de nouveau cache de récupération
- **AND** aucune copie, purge ou suppression distante n'est effectuée

#### Scenario: Previously attested binding is rehydrated without exposing an unattested cache

- **GIVEN** une entrée de registre sans empreinte de compte
- **AND** une attestation d'activation locale pour la même URL et la même base contient l'empreinte du compte A et un `remoteDbId` compatible
- **WHEN** l'application démarre avec le compte A
- **THEN** l'empreinte locale antérieure est réutilisée pour vérifier la liaison
- **AND** aucune donnée métier n'est lue avant cette vérification
- **AND** aucune donnée n'est copiée vers un autre compte ou une autre destination

#### Scenario: Failed binding persistence keeps business masked

- **GIVEN** un cache local vide et une authentification valide
- **WHEN** l'enregistrement durable de la liaison échoue ou n'est pas relu avec succès
- **THEN** les données métier restent masquées et aucun succès de liaison n'est annoncé
- **AND** aucun cache de récupération n'est créé automatiquement
- **AND** le cache et la session restent récupérables après reload

#### Scenario: Observed remote database mismatch is blocked

- **GIVEN** une liaison de compte pour une base distante identifiée
- **WHEN** un `remoteDbId` observé diffère de celui de la liaison
- **THEN** les données métier restent masquées
- **AND** le diagnostic distingue cette incohérence d'une simple absence de preuve distante
- **AND** aucune donnée n'est copiée, purgée ou transférée

## ADDED Requirements

### Requirement: Durable binding attestation across bootstrap

Une liaison de compte attestée pour une URL, une base locale et un compte SHALL
être relue depuis un stockage local autorisé avant toute lecture métier. Elle
MUST rester valide après reload, navigation, reprise OTP et retour réseau
lorsque ces trois identités sont inchangées. Une liaison non écrite ou non
relue MUST NOT autoriser les données métier.

#### Scenario: Navigation and network return preserve a bound workspace

- **GIVEN** un espace lié au compte A avec des mutations locales en attente
- **WHEN** l'utilisateur navigue entre les pages, passe hors ligne puis revient en ligne
- **THEN** la même base locale et la même liaison restent actives
- **AND** les mutations en attente ne sont ni supprimées ni dupliquées
- **AND** aucun nouveau cache de récupération n'est proposé ou créé
- **AND** aucun succès de propagation distante non prouvé n'est annoncé

#### Scenario: Same URL reuses the bound base after session expiry

- **GIVEN** une session expirée sur un espace lié au compte A
- **WHEN** l'utilisateur rétablit une session avec le compte A sur la même URL
- **THEN** l'application rouvre la même base locale et la même liaison
- **AND** aucun nouvel assistant de transfert ni aucune copie locale n'est requis
- **AND** les données restent masquées tant que la session n'est pas valide

#### Scenario: Legacy attestation is not used for a different destination

- **GIVEN** une attestation locale pour une URL et un `remoteDbId` donnés
- **WHEN** l'URL, la base effective ou le `remoteDbId` diffèrent
- **THEN** l'attestation n'est pas adoptée
- **AND** les données métier restent masquées
- **AND** les deux espaces et leurs caches restent intacts

### Requirement: Bootstrap cause classification and redacted trace

L'application SHALL enregistrer une séquence bornée d'étapes de bootstrap et de
liaison sous forme de codes et de catégories. Elle SHALL classifier tout état
non vérifié comme historique autorisé, régression de reprise, changement de
compte ou de destination, ou indéterminé. La trace MUST NOT contenir email,
OTP, jeton, identifiant utilisateur brut, URL brute, titre, note ni message
d'erreur brut.

#### Scenario: Historical cache and bootstrap regression are distinguished

- **GIVEN** un cache peuplé sans aucune attestation antérieure
- **WHEN** il reste non vérifié sous une session valide
- **THEN** il est classé comme cache historique non attesté et reste bloqué
- **AND** aucune correction automatique n'est annoncée

- **GIVEN** une attestation antérieure prouve une liaison pour la même URL, la même base et le même compte
- **WHEN** le registre a perdu son pointeur pendant le bootstrap
- **THEN** la perte est classée comme régression de reprise
- **AND** elle est corrigée sans lecture métier avant vérification
- **AND** aucune donnée n'est copiée depuis le cache

#### Scenario: Account, destination and attestation changes are classified

- **GIVEN** un cache non vérifié et une session authentifiée
- **WHEN** le compte observé, le `remoteDbId`, l'URL ou l'attestation distante diffère de la liaison
- **THEN** la classification indique le changement correspondant
- **AND** aucune donnée métier de l'ancien cache n'est affichée ni transférée

#### Scenario: First pull before binding is not mistaken for a regression

- **GIVEN** une nouvelle base locale initialement vide et aucun antécédent de liaison
- **WHEN** un premier pull remplit le cache avant l'écriture de la liaison
- **THEN** la cause est classée comme premier pull avant liaison
- **AND** aucune donnée n'est adoptée sans preuve ni consentement
- **AND** la récupération isolée reste explicite et non destructive

#### Scenario: Delayed identity and binding write failure are classified

- **GIVEN** un état d'authentification valide mais une identité native non encore observée
- **WHEN** la liaison est évaluée puis réévaluée à l'arrivée de l'identité
- **THEN** l'état transitoire est classé comme identité retardée et ne devient pas un blocage définitif
- **AND** si l'écriture de liaison échoue, la cause est classée comme échec de persistance
- **AND** les données métier restent masquées jusqu'à une liaison durable

#### Scenario: Unknown cause stays unknown

- **GIVEN** des événements insuffisants, contradictoires ou non reproduits
- **WHEN** un cache reste non vérifié
- **THEN** la classification affiche `indéterminée`
- **AND** aucune cause racine n'est inventée
- **AND** le cache reste intact, masqué et récupérable
- **AND** la trace expurgée permet de rapporter la séquence réellement observée

#### Scenario: Trace is bounded and redacted

- **WHEN** la trace de bootstrap ou le diagnostic est lu ou exporté
- **THEN** il ne contient aucun email, OTP, jeton, identifiant utilisateur brut, URL brute, titre, note ni message d'erreur brut
- **AND** il ne contient que des codes, catégories, compteurs, booléens et horodatages relatifs
- **AND** sa taille est bornée
- **AND** une trace absente ou illisible ne bloque pas le démarrage et n'autorise aucune action destructive

### Requirement: Remote destination coherence for bound caches

Lorsqu'un identifiant de base distante est observable, l'application SHALL le
comparer à la destination de la liaison avant de lire les données métier. Une
différence MUST masquer ces données sans copie ni purge. L'absence de preuve
distante fraîche MUST NOT dégrader une liaison locale déjà attestée.

#### Scenario: Remote mismatch blocks business reads

- **GIVEN** une liaison contenant un `remoteDbId` connu
- **WHEN** le signal natif expose un `remoteDbId` différent
- **THEN** aucune donnée métier n'est lue ni écrite
- **AND** le diagnostic expose l'incohérence de destination
- **AND** le cache local, les mutations et la destination restent intacts

#### Scenario: Offline bound cache remains readable with remote evidence unknown

- **GIVEN** un espace lié au compte courant et déjà lu avec succès auparavant
- **WHEN** l'application est hors ligne ou le pull initial est en attente
- **THEN** la liaison locale attestée reste valide et les données locales restent accessibles
- **AND** la preuve distante reste explicitement indéterminée
- **AND** aucune récupération isolée ni copie n'est déclenchée

#### Scenario: Matching remote database preserves the binding

- **GIVEN** une liaison et un `remoteDbId` connu
- **WHEN** un pull natif confirme le même `remoteDbId`
- **THEN** la liaison reste active sans réécriture opportuniste
- **AND** aucun nouveau cache n'est créé
- **AND** la convergence métier n'est pas déduite de ce seul signal

### Requirement: Non-destructive workspace and connection transitions

Changer d'espace, de compte, de connexion, suspendre, reprendre, se déconnecter
ou purger explicitement SHALL préserver les autres caches locaux, les mutations
en attente, la source autonome et les données distantes. Les protections de
confirmation, de sauvegarde et d'export existantes MUST rester applicables.

#### Scenario: A/B/A preserves each bound workspace

- **GIVEN** deux espaces A et B enregistrés avec des liaisons et des données distinctes
- **WHEN** l'utilisateur sélectionne A, puis B, puis A
- **THEN** chaque sélection retrouve sa propre base et sa propre liaison
- **AND** aucune donnée n'est copiée ou fusionnée entre A et B
- **AND** aucune base des espaces non sélectionnés n'est supprimée

#### Scenario: Account or connection change never purges implicitly

- **GIVEN** un cache local lié avec des mutations en attente
- **WHEN** la session expire, change de compte ou la connexion est interrompue
- **THEN** le cache et les mutations restent physiquement présents
- **AND** les données restent masquées si l'identité ne peut pas être prouvée
- **AND** aucune purge, copie ou suppression distante n'est effectuée sans confirmation explicite

#### Scenario: Unattested or pending cache remains protected

- **GIVEN** un cache peuplé non vérifié, une attestation manquante, un compte différent ou des mutations en attente
- **WHEN** une session tente de lire cet espace
- **THEN** aucune donnée métier n'est lue, exportée ou transférée
- **AND** aucune récupération, purge ou copie n'est déclenchée automatiquement
- **AND** le cache et les mutations restent physiquement intacts
- **AND** seules les actions explicites de récupération isolée, déconnexion ou purge confirmée restent disponibles

#### Scenario: Suspension and resume preserve destination and binding

- **GIVEN** un espace lié et une destination enregistrée
- **WHEN** l'utilisateur suspend Cloud puis reprend cet espace
- **THEN** la même base, la même URL et la même liaison sont réutilisées
- **AND** aucun nouvel assistant de transfert ni cache de récupération n'est requis
- **AND** la source autonome et les autres espaces restent intacts

### Requirement: Deterministic binding evaluation under concurrent and delayed events

Les évaluations de liaison SHALL être ordonnées et idempotentes face aux
événements natifs retardés, aux changements d'onglet et aux écritures locales
concurrentes. Un résultat ancien MUST NOT remplacer une évaluation plus récente
ni effacer un champ de liaison déjà attesté.

#### Scenario: Late async result cannot restore a stale block

- **GIVEN** deux évaluations de liaison lancées successivement
- **WHEN** le résultat de la première arrive après celui de la seconde
- **THEN** le résultat ancien est ignoré
- **AND** l'état affiché correspond à l'évaluation la plus récente
- **AND** aucune lecture métier supplémentaire n'est déclenchée par ce résultat ancien

#### Scenario: Concurrent tabs do not erase a durable binding

- **GIVEN** deux onglets lisent le même registre avant l'écriture de la liaison
- **WHEN** leurs écritures se succèdent
- **THEN** une écriture sans empreinte ne remplace pas une empreinte déjà attestée
- **AND** la base effective et l'URL de la liaison restent identiques
- **AND** aucune divergence ne crée de cache de récupération

#### Scenario: Delayed native identity resolves an indeterminate state

- **GIVEN** une session authentifiée sans identité native encore disponible
- **WHEN** l'identité native arrive pour le même compte et la même URL
- **THEN** la liaison déjà attestée est réévaluée et redevient lisible
- **AND** aucun OTP, transfert, pull supplémentaire ou écriture métier n'est déclenché par la réévaluation
