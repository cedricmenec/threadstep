# threadstep-integration-profile Specification

## Purpose
Paramétrer les contrats génériques local-first/Dexie Cloud pour ThreadStep, sans exporter les quotas, schémas, OTP obligatoire ou formats historiques du produit dans le socle réutilisable.
## Requirements
### Requirement: ThreadStep starts from local Dexie
ThreadStep SHALL present its business features on an autonomous local IndexedDB/Dexie workspace from first use without a Cloud URL, OTP or network. Opening that workspace MUST NOT construct or configure a synchronized instance. A historical `threadstep.document.v1` value MUST be treated as inert: it is neither detected as a migration source nor converted, exported or sent to the Cloud.
#### Scenario: First launch after legacy localStorage
- **GIVEN** un document V1 valide avec 5 sujets et 18 étapes sur ce navigateur
- **WHEN** la nouvelle application locale démarre
- **THEN** l'espace local IndexedDB est ouvert sans conversion
- **AND** aucun panneau de migration, avertissement historique ou bouton d'export V1 n'est affiché
- **AND** aucun enregistrement n'est envoyé à Dexie Cloud
- **AND** la valeur historique reste physiquement intacte jusqu'à un nettoyage consenti
#### Scenario: No local historical document
- **WHEN** aucun `threadstep.document.v1` valide n'existe
- **THEN** ThreadStep ouvre son espace local IndexedDB vide
- **AND** les sujets peuvent être créés sans configuration Cloud
#### Scenario: Business view without a Cloud identity
- **GIVEN** aucune URL Cloud ni session Cloud n'existe
- **WHEN** l'utilisateur ouvre ThreadStep
- **THEN** les sujets, étapes et exports restent accessibles
- **AND** aucun OTP, email ou identité Cloud n'est requis
#### Scenario: Explicit local conversion is offered in local mode
- **GIVEN** une valeur `threadstep.document.v1` existe et aucune URL Cloud n'est configurée
- **WHEN** l'espace local est ouvert
- **THEN** aucune conversion locale de cette valeur n'est proposée ni exécutée
- **AND** seules l'importation d'une sauvegarde modern et la restauration explicite restent disponibles
- **AND** aucun addon Dexie Cloud n'est construit ou configuré à cause de cette valeur
- **AND** aucun trafic réseau n'est émis
### Requirement: ThreadStep business schema and relationships
Les sujets et étapes SHALL conserver leurs identifiants, titres, ordres, notes, priorités, états `done` et hiérarchie (`subjectId`, `parentId`). Les préférences de reprise et métadonnées locales restent non synchronisées et sont stockées dans un espace IndexedDB local. Les quotas métier actuels font partie du profil ThreadStep.
#### Scenario: Hierarchy preservation
- **WHEN** un sujet contenant des étapes et sous-étapes est importé depuis une sauvegarde modern
- **THEN** les relations parent et sujet pointent vers les enregistrements corrects
- **AND** les notes, ordres, priorités et états sont conservés
#### Scenario: Business quota is respected
- **WHEN** un import provoquerait un dépassement de la limite ThreadStep (40 sujets ou 500 étapes par sujet)
- **THEN** le groupe concerné est refusé avec une raison explicite
- **AND** les groupes indépendants valides ne sont pas nécessairement bloqués
#### Scenario: Local preferences are not replicated
- **GIVEN** une préférence de reprise référençant un sujet et une étape
- **WHEN** elle est enregistrée dans le store local `meta`
- **THEN** elle n'apparaît dans aucune table synchronisée
- **AND** elle n'est incluse dans aucune sauvegarde métier
- **AND** elle reste attachée au workspace local concerné
### Requirement: Explicit ThreadStep Cloud enablement
Après utilisation locale, ThreadStep SHALL proposer un assistant d'activation opt-in. L'URL doit être une instance `https://...dexie.cloud` valide et le parcours de connexion du projet utilise l'OTP email natif. Aucun transfert de données historiques n'a lieu sans consentement spécifique.
#### Scenario: Local data exists before OTP
- **GIVEN** plusieurs sujets créés en local
- **WHEN** l'utilisateur configure Dexie Cloud et saisit un OTP
- **THEN** ces sujets ne sont pas encore synchronisés automatiquement
- **AND** l'interface attend la première lecture de la cible et la prévisualisation de rapprochement
#### Scenario: Same account on a second browser
- **WHEN** un autre navigateur se connecte au même espace Cloud
- **THEN** il récupère les seuls enregistrements autorisés
- **AND** les modifications bidirectionnelles sont validées par une recette E2E réelle
### Requirement: ThreadStep backups and reimport
ThreadStep SHALL exporter et importer un format de sauvegarde IndexedDB versionné et distinct du V1. Ce format MUST préserver les identifiants métier canoniques et permettre une réimportation sans duplication. Un fichier `version: 1` MUST être refusé sans écriture. Fusion et restauration restent des intentions distinctes, avec collision et plan périmé bloqués sans perte.
#### Scenario: Same document reimport
- **WHEN** une même sauvegarde modern ThreadStep est importée une seconde fois
- **THEN** aucun sujet ni étape identique n'est dupliqué
- **AND** les IDs ne sont jamais réécrits ou préfixés une seconde fois
- **AND** le plan ne contient aucune opération
#### Scenario: IndexedDB export reimport keeps canonical IDs
- **GIVEN** un export ThreadStep produit depuis IndexedDB avec `legacy:s1`
- **WHEN** il est réimporté dans l'espace local ou Cloud
- **THEN** `legacy:s1` reste l'identifiant utilisé pour le rapprochement
- **AND** les `subjectId` et `parentId` restent cohérents
- **AND** aucun `legacy:legacy:` n'est créé
#### Scenario: Ambiguous legacy-prefixed file
- **GIVEN** un fichier ThreadStep au format `version: 1`, même récemment produit depuis IndexedDB
- **WHEN** l'utilisateur tente de l'importer ou de le restaurer
- **THEN** l'import ou la restauration est refusé avec un message explicite
- **AND** aucune donnée locale ou Cloud n'est modifiée
- **AND** aucun support V1 permanent n'est proposé
#### Scenario: Old backup differs from Cloud
- **WHEN** un export modern plus ancien est présenté à une cible synchronisée plus récente
- **THEN** un inventaire de différences est présenté avant toute écriture
- **AND** les choix de conservation ou de copie préservent les données déjà présentes
- **AND** la restauration destructive reste une intention distincte
### Requirement: ThreadStep incident recovery and readiness
La recette produit SHALL couvrir Chrome mobile, OTP, première connexion, recharge, données divergentes, deux navigateurs, mode offline et échec de migration. Les spécifications cibles MUST NOT être réputées implémentées sur la seule base d'une CI réussie. La déconnexion ou une erreur Dexie native MUST rester diagnostiquée sans réafficher de panneau de migration historique.
#### Scenario: Existing migration blocked
- **GIVEN** l'interface affiche « Dexie Cloud n'est pas connecté »
- **WHEN** le diagnostic natif de ThreadStep est consulté
- **THEN** les statuts `syncState.status` et `syncState.phase` et la raison du blocage sont affichés de manière sécurisée
- **AND** aucune base vide n'est déduite de l'absence de lecture distante
- **AND** aucun panneau de migration V1 ni message historique périmé n'est affiché
#### Scenario: Previously imported JSON vanished after reload
- **WHEN** un import semble terminé puis l'application est rechargée
- **THEN** les enregistrements commités localement sont restaurés depuis IndexedDB
- **AND** une synchronisation distante non prouvée reste signalée en attente
#### Scenario: Native Cloud error stays diagnosed
- **GIVEN** une erreur ou une déconnexion Dexie native
- **WHEN** le diagnostic est recalculé
- **THEN** l'erreur native reste visible avec sa catégorie
- **AND** elle n'est pas remplacée par un message de migration V1
- **AND** aucune donnée métier n'est exposée dans le diagnostic
### Requirement: ThreadStep inconsistent workspace recovery
ThreadStep SHALL diagnostiquer en lecture seule un workspace incohérent de 5 sujets et 19 tâches dont une orpheline, y compris les variantes `legacy:s1` et `legacy:legacy:s1`. Les 5 sujets valides SHALL rester consultables sans écriture, l'export brut SHALL inclure les 19 tâches et l'export métier modern SHALL être désactivé ou marqué incomplet. Une réparation SHALL préserver tous les champs métier et relations.
#### Scenario: Five subjects and nineteen tasks with one orphan
- **GIVEN** un workspace ThreadStep contenant 5 sujets et 19 tâches, dont une tâche dont le `subjectId` ne correspond à aucun sujet visible
- **WHEN** l'inventaire et la consultation dégradée sont affichés
- **THEN** les 5 sujets valides restent consultables
- **AND** la 19e tâche est signalée comme orpheline avec un code
- **AND** aucune écriture n'est effectuée
#### Scenario: Raw recovery export includes all nineteen tasks
- **GIVEN** le workspace incohérent de 5 sujets et 19 tâches
- **WHEN** l'utilisateur demande l'export brut de récupération
- **THEN** les 19 tâches accessibles sont présentes, y compris l'orpheline
- **AND** l'export est distinct de la sauvegarde métier modern
- **AND** il ne contient aucun token, OTP, credential ou secret
#### Scenario: Normal V1 export is gated during the anomaly
- **GIVEN** l'inventaire signale l'orpheline ou une variante d'identité non résolue
- **WHEN** l'utilisateur cherche un export V1
- **THEN** aucun export V1 n'est proposé puisque ce format est retiré
- **AND** la sauvegarde métier modern est désactivée avec une explication ou marquée incomplète
- **AND** aucun enregistrement accessible n'est omis silencieusement
#### Scenario: Repair preserves ThreadStep business fields
- **GIVEN** un plan de réparation consenti et prouvé pour une tâche orpheline
- **WHEN** la réparation est appliquée
- **THEN** la note, l'ordre, la priorité, l'état `done` et la relation parent/enfant sont conservés
- **AND** seule la référence nécessaire est modifiée
- **AND** une seconde exécution ne crée aucun doublon
#### Scenario: Prefix variants are not silently merged
- **GIVEN** un sujet visible sous `legacy:legacy:s1` et une tâche référençant `legacy:s1`
- **WHEN** aucune provenance ne prouve l'identité commune
- **THEN** le groupe est ambigu et bloqué
- **AND** aucune variante n'est renommée ou supprimée automatiquement
- **AND** les deux variantes restent visibles dans le diagnostic
### Requirement: ThreadStep modern backup and retired legacy keys
ThreadStep SHALL fournir un export et un import/restauration de sauvegarde IndexedDB modern, ainsi qu'un nettoyage facultatif des clés V1 retirées. L'export MUST contenir les enregistrements et relations métier sans configuration sensible. Le nettoyage MUST être précédé d'un inventaire, d'une sauvegarde vérifiée et d'un consentement, et ne MUST PAS être automatique.
#### Scenario: Complete modern backup restores in a clean test profile
- **GIVEN** un workspace IndexedDB de 5 sujets, 18 étapes et une tâche supplémentaire
- **WHEN** une sauvegarde modern est exportée puis restaurée dans un profil de test vierge
- **THEN** les 5 sujets, les 19 tâches, la hiérarchie et tous les attributs sont restaurés
- **AND** une seconde importation du même fichier ne crée aucun doublon
- **AND** une collision ou un plan périmé est bloqué sans perte
#### Scenario: Retired keys are listed but not purged automatically
- **GIVEN** des clés V1 retirées présentes dans le navigateur courant
- **WHEN** l'application démarre ou affiche le panneau de nettoyage
- **THEN** leur inventaire est visible et la portée est limitée à l'origine et au navigateur courants
- **AND** l'option par défaut est « ne rien effacer »
- **AND** aucune suppression n'a lieu sans confirmation
#### Scenario: Consented cleanup is scoped
- **GIVEN** une sauvegarde modern vérifiée et une confirmation explicite
- **WHEN** l'utilisateur choisit de supprimer les clés V1
- **THEN** seules les clés retirées listées sont supprimées
- **AND** IndexedDB local, les données Cloud et les autres navigateurs restent intacts
- **AND** une annulation ou une erreur laisse les valeurs restantes intactes
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

### Requirement: ThreadStep isolated certification environment

La certification ThreadStep SHALL s'exécuter sur une instance Dexie Cloud de
test isolée, avec Chrome mobile et deux navigateurs ou profils indépendants, une
session OTP email réelle et un export de secours. Elle MUST utiliser uniquement
des données de test et MUST NOT manipuler une base ou un document personnel.

#### Scenario: Test environment is prepared without personal data

- **GIVEN** une instance Dexie Cloud isolée et des profils de test
- **WHEN** la recette est préparée
- **THEN** un export de secours lisible est produit avant les manipulations
- **AND** les sujets, étapes et notes créés sont synthétiques
- **AND** aucune base personnelle n'est utilisée, purgée ou modifiée

#### Scenario: Chrome mobile and a second browser are exercised

- **WHEN** le parcours Cloud est recetté
- **THEN** il est exécuté sur Chrome mobile et sur un second navigateur ou profil indépendant
- **AND** la session réelle est établie par OTP email natif
- **AND** les contrôles tactiles, clavier et de focus sont consignés séparément des tests CI

#### Scenario: Offline and intermittent network are covered

- **GIVEN** un espace de test précédemment activé
- **WHEN** le réseau est coupé, puis rétabli de façon intermittente
- **THEN** la conservation locale, l'état en attente et la reprise sans doublon sont observés
- **AND** une erreur réseau n'est pas confondue avec un échec de transaction IndexedDB

### Requirement: ThreadStep bidirectional and recovery evidence

La recette SHALL observer la propagation dans les deux sens entre les deux
navigateurs, la conservation des relations après reimport ou restauration, et la
récupération de la source historique V1. Une preuve locale, un état `in-sync`
générique ou une réussite CI MUST NOT être présentés comme une propagation
distante prouvée.

#### Scenario: Both directions propagate

- **GIVEN** deux navigateurs de test connectés au même espace
- **WHEN** une modification créée sur le premier est observée sur le second, puis l'inverse
- **THEN** chaque propagation est consignée avec l'appareil, le navigateur et le résultat observé
- **AND** aucune conclusion n'est tirée d'un seul sens ou d'un simple signal natif local

#### Scenario: Reimport and restore preserve relations

- **GIVEN** un export ou une sauvegarde de test
- **WHEN** il est réimporté ou restauré après un parcours
- **THEN** les sujets, étapes, sous-étapes, notes, priorités, ordres et relations parent/enfant sont vérifiés
- **AND** aucun doublon ni préfixe `legacy:legacy:` n'est accepté silencieusement

#### Scenario: Historical V1 source is recoverable

- **GIVEN** une source `threadstep.document.v1` conservée dans le profil de test
- **WHEN** un incident ou une absence apparente de données survient
- **THEN** la récupération par l'export historique ou une sauvegarde vérifiée est documentée
- **AND** la source n'est ni supprimée ni réécrite
- **AND** cette récupération reste distincte de la synchronisation Cloud

#### Scenario: Unexecuted observations stay unaccepted

- **WHEN** une observation réelle n'a pas été réalisée
- **THEN** elle figure comme non exécutée ou en attente dans le compte rendu
- **AND** la CI verte n'est pas invoquée comme preuve de cette observation
- **AND** la certification globale reste partielle

## Adaptation du dépôt
**État existant à modifier après approbation :** `site/app.js` fonctionne en `localStorage` sans Cloud et en IndexedDB soumis à authentification avec Cloud ; `site/migration-reconciliation.js` applique un garde de connexion strict ; les spécifications OpenSpec canoniques actuelles reflètent ce mode historique.
**Trajectoire préconisée :** tâches séparées pour persistance sans Cloud, diagnostic Dexie, activation et rapprochement, corrections import/export, puis E2E ; chaque tâche possède un changement OpenSpec delta et une PR évaluée, jamais une substitution silencieuse des specs existantes.
**Références :** <mention-page url="https://app.notion.com/p/3fc12ac91636815a88a8e55164604d6a"/>, [PR TS-031 #130](https://github.com/cedricmenec/threadstep/pull/130), [source ThreadStep](https://github.com/cedricmenec/threadstep/tree/main/site), [spécifications OpenSpec actuelles](https://github.com/cedricmenec/threadstep/tree/main/openspec/specs).
