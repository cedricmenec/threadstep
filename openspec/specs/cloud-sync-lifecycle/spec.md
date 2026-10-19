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
### Requirement: Repair convergence evidence
Une réparation de workspace SHALL distinguer le commit IndexedDB local, l'envoi natif, le pull distant et la lecture métier réussie. Un commit local, un signal `in-sync` générique ou une transaction unique MUST NOT suffire à déclarer la réparation achevée sur le serveur ou sur un autre appareil. La convergence inter-appareils SHALL rester une preuve de recette séparée.
#### Scenario: Local repair commit is not a remote completion
- **WHEN** une transaction de réparation IndexedDB réussit
- **THEN** l'application indique que la réparation est enregistrée localement
- **AND** elle indique la synchronisation comme en attente ou indéterminée
- **AND** elle n'annonce ni push distant ni convergence inter-appareils
#### Scenario: In-sync alone is not convergence
- **GIVEN** un commit local de réparation
- **WHEN** un état natif `in-sync` est observé sans nouvelle lecture métier réussie
- **THEN** la convergence n'est pas déclarée sur cet appareil
- **AND** le statut reste en attente ou indéterminé
#### Scenario: Native pull plus successful business read
- **GIVEN** un commit local de réparation
- **WHEN** le pull natif est prouvé et une lecture métier fraîche relit les enregistrements réparés
- **THEN** l'application peut indiquer que la réparation a convergé sur cet appareil
- **AND** elle ne prétend pas prouver la convergence sur un autre appareil
#### Scenario: Later synchronization error preserves local evidence
- **WHEN** le commit local a réussi puis la synchronisation distante échoue
- **THEN** la réparation reste enregistrée localement
- **AND** l'erreur de synchronisation est signalée séparément
- **AND** aucune conclusion de convergence n'est produite
#### Scenario: Cross-device convergence requires separate evidence
- **WHEN** un deuxième navigateur doit afficher le workspace réparé
- **THEN** la convergence est vérifiée sur une instance réelle et un second appareil
- **AND** elle n'est pas déduite d'un commit local ou d'un état `in-sync` sur le premier appareil
### Requirement: Diagnostic and footer follow the current native state
Le diagnostic natif et le message de bas de page SHALL être recalculés depuis les mêmes signaux natifs Dexie. Un blocage transitoire MUST disparaître après réévaluation saine, un résultat asynchrone ancien MUST NOT remplacer un résultat plus récent, et la disparition d'un blocage MUST NOT effacer une erreur de stockage réelle ni annoncer une synchronisation distante non prouvée. Aucun panneau de migration V1 ne MUST réapparaître.
#### Scenario: Offline attestation becomes healthy
- **GIVEN** une attestation initialement `sync-offline`
- **WHEN** les signaux natifs passent à `connected` / `in-sync` et la cible est validée
- **THEN** le diagnostic est recalculé
- **AND** le bas de page ne continue pas à annoncer la déconnexion
- **AND** le message affiché correspond au parcours actif vérifié
- **AND** aucune écriture n'est effectuée par cette réévaluation
#### Scenario: Late asynchronous result cannot replace a recent one
- **GIVEN** deux lectures ou événements de synchronisation lancés successivement
- **WHEN** le résultat le plus ancien arrive après le plus récent
- **THEN** le résultat ancien est ignoré
- **AND** il ne réaffiche pas un état périmé
- **AND** seul le résultat de la génération courante peut modifier le diagnostic
  ou le bas de page
#### Scenario: A real storage error survives block removal
- **GIVEN** une erreur de stockage ou de lecture réelle est affichée
- **WHEN** un état transitoire disparaît ou est remplacé
- **THEN** l'erreur de stockage reste affichée
- **AND** aucun message de synchronisation distante réussie n'est annoncé
- **AND** les données restent inchangées
#### Scenario: Genuine blocking state reappears after re-evaluation
- **GIVEN** un diagnostic précédemment sain ou fermé
- **WHEN** une nouvelle évaluation atteste une vraie déconnexion, un conflit ou une lecture impossible
- **THEN** l'état bloquant est réaffiché avec la raison courante
- **AND** aucun import automatique n'est déclenché
- **AND** aucun panneau de migration V1 ni sauvegarde historique n'est supprimé
#### Scenario: Two concurrent sync events are ordered deterministically
- **GIVEN** deux événements natifs de synchronisation concurrents
- **WHEN** ils déclenchent chacun une réévaluation
- **THEN** l'évaluation la plus récemment démarrée détermine l'état affiché
- **AND** un résultat plus ancien reçu plus tard ne le remplace pas
- **AND** aucun consentement ni commit n'est créé par ces réévaluations
#### Scenario: Reload rebuilds the current state without stale UI
- **WHEN** la page est rechargée
- **THEN** le diagnostic et le bas de page sont reconstruits depuis les signaux
  natifs courants
- **AND** aucun ancien message de blocage, de plan ou de consentement n'est restauré
- **AND** aucun panneau historique V1 n'est affiché
#### Scenario: Native disconnection is not a migration panel
- **GIVEN** une déconnexion ou une erreur Dexie native
- **WHEN** le diagnostic est affiché
- **THEN** la catégorie native et la raison sont visibles
- **AND** aucun panneau « Migration bloquée » ni offre de conversion V1 n'apparaît
- **AND** aucune donnée métier ni secret n'est exposé
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

### Requirement: Dedicated read-only diagnostic page

La route `#/parametres/synchronisation` SHALL afficher en lecture seule une
synthèse et le diagnostic natif complet. Elle MUST réutiliser les signaux et
abonnements existants et MUST NOT ouvrir d'instance Cloud, demander un OTP,
envoyer une requête, lancer un pull ou exposer un secret, un email, un OTP, un
token ou un contenu métier.

#### Scenario: Local workspace without configuration or network

- **GIVEN** aucun espace Cloud n'est configuré et le navigateur est hors ligne
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** la page indique clairement « Cloud non configuré » et « local uniquement »
- **AND** la session, la connexion, le pull initial et les écritures locales sont présentés comme non applicables sans inventer d'état distant
- **AND** aucune instance Cloud n'est construite ou ouverte, aucun OTP n'est demandé et aucune requête réseau n'est envoyée
- **AND** le bouton de relance reste désactivé avec une raison compréhensible

#### Scenario: Configured diagnostic exposes every native dimension

- **GIVEN** une base Dexie Cloud configurée et une session disponible
- **WHEN** l'utilisateur consulte `#/parametres/synchronisation`
- **THEN** la synthèse et le diagnostic affichent séparément la session, la connexion, la phase native, le cache ou la base locale effective, le pull initial, les écritures locales, les erreurs classées et la preuve distante disponible
- **AND** l'absence de preuve distante reste « non déterminée » et n'est jamais présentée comme une base distante vide
- **AND** aucun email, OTP, token, message d'erreur brut, titre ou note n'est affiché

#### Scenario: Diagnostic page contains no moved sensitive control

- **WHEN** `#/parametres/synchronisation` est affiché
- **THEN** les emplacements « Configuration », « Première activation », « Connexion » et « Espaces de travail » sont descriptifs
- **AND** aucun formulaire, champ, sélection ou bouton appartenant à ces parcours n'y est déplacé, dupliqué ou activé
- **AND** l'ouverture de la page ne déclenche ni activation, ni OTP, ni connexion, ni sélection d'espace, ni purge

#### Scenario: Diagnostics update from the same native events

- **WHEN** `currentUser`, `syncState` ou `persistedSyncState` émet un nouvel état alors que la page est ouverte
- **THEN** la synthèse et le diagnostic de la page reflètent le nouvel état
- **AND** ils ne conservent pas un libellé antérieur devenu faux
- **AND** aucun nouvel abonnement n'est installé par la seule navigation vers cette page

#### Scenario: Accessible status and retry guards are preserved

- **WHEN** la page de diagnostic est affichée sur un appareil mobile ou au clavier
- **THEN** les messages d'état et les erreurs conservent leur zone `aria-live`
- **AND** le bouton de relance conserve son nom accessible, sa raison de désactivation et ses préconditions existantes
- **AND** seule son activation explicite peut lancer le pull natif, jamais l'ouverture ou la fermeture de la route

### Requirement: Overview synchronization attention summary

La vue `#/` SHALL afficher un résumé de synchronisation non interactif lorsqu'un
état Cloud configuré nécessite une attention ou qu'une erreur locale existe. Le
résumé MUST rester masqué pour un local non configuré sain et pour une
synchronisation configurée entièrement en phase, et MUST NOT proposer de
relance.

#### Scenario: Attention state remains visible on the overview

- **GIVEN** un espace Cloud configuré présente une erreur, une session absente ou expirée, une connexion hors ligne, un pull initial en attente ou en échec, ou une écriture locale en attente
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** un résumé minimal indique la session, la connexion, la phase et le statut ou l'erreur disponible
- **AND** il est annoncé via une zone de statut non interactive
- **AND** il ne contient aucune action, aucun bouton de relance et aucun secret ni contenu métier

#### Scenario: Healthy overview has no synchronization clutter

- **GIVEN** aucun espace Cloud n'est configuré et aucune erreur locale n'existe, ou un espace configuré est entièrement en phase
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** le résumé d'attention est masqué
- **AND** la page de diagnostic dédiée reste accessible depuis les paramètres
- **AND** aucune synchronisation, connexion ou requête n'est déclenchée pour afficher l'accueil

#### Scenario: Local read or write error stays visible

- **GIVEN** un espace local sans configuration Cloud présente une erreur de lecture ou d'écriture locale
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** le résumé d'attention signale l'erreur locale
- **AND** il ne présente pas cet échec comme une erreur réseau ou une base distante vide
- **AND** aucune ouverture d'instance Cloud n'est effectuée pour produire ce résumé

#### Scenario: Summary and page never claim an unproven remote state

- **WHEN** un résumé ou une synthèse est produit depuis des signaux absents, en attente ou contradictoires
- **THEN** l'état distant reste indéterminé ou explicitement non vérifié
- **AND** aucune présence d'enregistrements distants n'est inventée
- **AND** aucun import, consentement, transfert ou pull automatique n'est déclenché

## Notes d'intégration
Types natifs documentés : `SyncStatus = not-started | connecting | connected | disconnected | error | offline` ; `SyncStatePhase = initial | not-in-sync | pushing | pulling | in-sync | error | offline`. Les `currentUser`, `syncState` et `persistedSyncState` doivent être lus avec la version effectivement embarquée. Ne pas réduire tous les autres états à « Dexie Cloud non connecté ».
