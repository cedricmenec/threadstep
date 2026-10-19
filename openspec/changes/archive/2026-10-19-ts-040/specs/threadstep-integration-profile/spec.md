# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: ThreadStep historical V1 local conversion
**Reason**: ThreadStep no longer detects, converts or supports the historical V1 document. The product decision of 18 October 2026 retires V1 backups and V1 business storage after the modern IndexedDB backup is secured.

**Migration**: Existing IndexedDB records are exported with the modern versioned backup. Historical `threadstep.document.v1` values remain inert and may be cleaned only through the voluntary scoped cleanup.

### Requirement: ThreadStep local export and legacy preservation
**Reason**: Exporting and preserving the historical V1 document as a supported product path contradicts the removal decision. Backups now come exclusively from IndexedDB and declare a distinct format.

**Migration**: Use the modern IndexedDB backup for export and restore. Legacy keys are not deleted automatically and are listed for optional cleanup.
