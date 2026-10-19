# legacy-storage-migration Specification

## Purpose
Les anciennes sources métier V1 sont retirées : leurs valeurs `localStorage` restent inertes, conservées et sans effet sur le démarrage, les imports et les écritures IndexedDB/Dexie. Seul un nettoyage volontaire et ciblé, après sauvegarde IndexedDB moderne vérifiée et consentement explicite, peut retirer les clés historiques. Cette capacité encadre également les évolutions de schéma Dexie et les métadonnées locales non synchronisées, sans réactiver la conversion V1.

## Requirements
### Requirement: Validated schema evolution boundaries
Les migrations de stores synchronisés SHALL suivre les contraintes Dexie Cloud ; une migration locale Dexie `version.upgrade()` MUST NOT être supposée sûre pour réécrire les données déjà synchronisées. L'ajout du store local de métadonnées MUST être explicitement versionné et MUST NOT être répliqué par Dexie Cloud.
#### Scenario: Upgrade an unsynced local store
- **WHEN** une table non synchronisée reçoit une évolution Dexie documentée, notamment le store `meta`
- **THEN** l'upgrade est vérifiée et testée en conservant les enregistrements
- **AND** le store `meta` reste déclaré hors synchronisation
#### Scenario: Incompatible already-synced schema
- **WHEN** une nouvelle version modifie une clé primaire ou transforme une table déjà synchronisée
- **THEN** l'opération est exclue de la migration cliente automatique
- **AND** une stratégie de migration contrôlée vers nouvelle table/base est documentée et validée séparément
#### Scenario: Local metadata upgrade is non-destructive
- **GIVEN** une base locale contenant des sujets, des étapes et d'éventuelles métadonnées
- **WHEN** la nouvelle version de schéma est ouverte
- **THEN** aucun enregistrement métier n'est supprimé, recréé ou déplacé
- **AND** le store `meta` peut être créé ou complété sans écraser une valeur existante
- **AND** aucune base n'est supprimée automatiquement en cas d'échec
### Requirement: Retired historical V1 storage is inert
L'application SHALL traiter `threadstep.document.v1` et les autres valeurs métier V1 comme des données retirées. Elle MUST NOT les détecter comme source de migration, les convertir, les importer, les restaurer, les exporter ni déclencher une écriture ou un trafic Cloud à leur sujet. La valeur MUST rester physiquement intacte jusqu'à un nettoyage explicitement consenti.
#### Scenario: Legacy key does not trigger a migration offer
- **GIVEN** une valeur valide `threadstep.document.v1` présente dans `localStorage`
- **WHEN** l'application démarre, se recharge, change de session, passe en ligne ou reçoit un événement de synchronisation
- **THEN** aucun panneau de migration, avertissement historique, bouton d'export V1 ou action de conversion n'apparaît
- **AND** aucune écriture IndexedDB ou Cloud n'est effectuée à cause de cette valeur
- **AND** aucun appel réseau n'est déclenché
#### Scenario: Legacy key does not feed the business view
- **GIVEN** une valeur `threadstep.document.v1` et un espace IndexedDB lisible
- **WHEN** la vue métier est rendue
- **THEN** les sujets et étapes affichés proviennent exclusivement d'IndexedDB
- **AND** aucune sauvegarde V1 n'est utilisée comme source de secours ou de comparaison automatique
#### Scenario: Legacy storage event is ignored
- **GIVEN** l'application ouverte dans deux onglets
- **WHEN** un onglet écrit ou supprime `threadstep.document.v1`
- **THEN** l'autre onglet ne lance ni migration, ni import, ni rechargement métier depuis cette clé
- **AND** les données IndexedDB restent inchangées
#### Scenario: Retired key survives without implicit purge
- **WHEN** l'application démarre, se connecte, synchronise, se déconnecte ou applique une conversion de préférences
- **THEN** `threadstep.document.v1` et les autres clés retirées ne sont ni supprimées, ni renommées, ni écrasées
- **AND** `localStorage.clear()` et `indexedDB.deleteDatabase()` ne sont jamais appelés par ces parcours
### Requirement: Versioned migration of legacy local preferences
Les préférences et métadonnées locales qui référencent des identifiants de sujets ou d'étapes SHALL être transférées vers un store IndexedDB local et non synchronisé, de façon versionnée, idempotente et vérifiée. La migration MUST NOT écraser une cible déjà peuplée, MUST résister à une fermeture, un rechargement ou une écriture indisponible, et MUST préserver l'isolation du workspace.
#### Scenario: Resume preference is migrated once
- **GIVEN** une préférence `threadstep.resume.v1` valide et un store `meta` sans préférence
- **WHEN** l'application ouvre le workspace
- **THEN** la préférence est écrite dans le store `meta` local non synchronisé
- **AND** un marqueur versionné atteste la migration terminée
- **AND** la préférence est relue depuis IndexedDB après rechargement
- **AND** la clé historique n'est pas supprimée automatiquement
#### Scenario: Reload or crash before the metadata write
- **GIVEN** une migration de préférence interrompue avant le commit
- **WHEN** l'application est rechargée
- **THEN** la migration reprend de façon idempotente
- **AND** aucune duplication ni écrasement de la cible n'est produit
- **AND** la valeur historique reste lisible en secours tant que la migration n'est pas vérifiée
#### Scenario: Target already contains a preference
- **GIVEN** le store `meta` contient déjà une préférence valide
- **WHEN** une valeur historique différente est rencontrée
- **THEN** la valeur du store `meta` reste autoritaire
- **AND** aucune écriture de remplacement n'est effectuée
- **AND** un état de duplication ou de conflit est signalé sans perte
#### Scenario: Metadata write is unavailable
- **GIVEN** IndexedDB refuse l'écriture du store `meta`
- **WHEN** la migration ou une mise à jour de préférence est tentée
- **THEN** l'échec est signalé distinctement d'une erreur réseau
- **AND** aucune clé historique n'est effacée
- **AND** aucune préférence n'est annoncée comme durablement enregistrée
#### Scenario: Workspace change does not leak preferences
- **GIVEN** deux workspaces ou deux comptes ayant chacun leur base locale
- **WHEN** l'utilisateur passe de l'un à l'autre
- **THEN** chaque store `meta` reste attaché à son propre workspace
- **AND** aucune préférence contenant des identifiants métier n'est copiée ou synchronisée entre eux
- **AND** le contenu du store `meta` n'est jamais répliqué par Dexie Cloud
#### Scenario: Metadata store contains no business content
- **WHEN** le store `meta` est inspecté après migration
- **THEN** il ne contient aucun titre, note, email, OTP, token ou secret
- **AND** il ne contient que des identifiants, versions, empreintes et statuts nécessaires au fonctionnement local
### Requirement: Voluntary scoped cleanup of retired V1 keys
L'application SHALL proposer un nettoyage volontaire des clés V1 retirées, sans jamais l'exécuter automatiquement. Le nettoyage MUST afficher l'inventaire exact, proposer « ne rien effacer », exiger une sauvegarde modern vérifiée et une confirmation explicite, puis ne supprimer que les clés listées pour l'origine et le navigateur courants.
#### Scenario: No cleanup by default
- **GIVEN** une ou plusieurs clés V1 retirées présentes
- **WHEN** l'application démarre, se recharge, se connecte, se synchronise ou détecte les clés
- **THEN** aucune clé n'est supprimée
- **AND** l'action de nettoyage est facultative et son option par défaut est « ne rien effacer »
#### Scenario: Inventory precedes consent
- **GIVEN** des clés `threadstep.document.v1`, `threadstep.migration.v1`, `threadstep.resume.v1` ou `threadstep.migration.dismissals.v1` présentes
- **WHEN** l'utilisateur ouvre le panneau de nettoyage
- **THEN** la liste exacte des clés présentes et la portée « origine et navigateur courants » sont affichées
- **AND** aucune valeur n'est parsée, convertie ou utilisée comme donnée métier
- **AND** aucune suppression n'a lieu avant la confirmation
#### Scenario: Cleanup requires a verified modern backup
- **GIVEN** aucune sauvegarde modern dont l'empreinte et les comptes ont été vérifiés dans la session courante
- **WHEN** l'utilisateur tente d'activer le nettoyage
- **THEN** l'action reste désactivée avec une explication
- **AND** aucune clé n'est supprimée
#### Scenario: Consented cleanup removes only listed keys
- **GIVEN** une sauvegarde modern vérifiée, une migration de préférences terminée et une confirmation explicite
- **WHEN** le nettoyage est exécuté
- **THEN** seules les clés retirées listées pour l'origine courante sont supprimées via des suppressions ciblées
- **AND** `localStorage.clear()` n'est pas utilisé
- **AND** aucune base IndexedDB, aucune donnée Cloud, aucun autre navigateur et aucune sauvegarde externe ne sont touchés
#### Scenario: Cancel or error leaves values intact
- **GIVEN** un nettoyage prévisualisé
- **WHEN** l'utilisateur annule ou une suppression échoue
- **THEN** les valeurs restantes ne sont ni réécrites ni supprimées
- **AND** l'interface indique ce qui a été supprimé et ce qui reste
- **AND** aucune donnée IndexedDB ou Cloud n'est modifiée
#### Scenario: Technical Cloud settings are outside the cleanup
- **GIVEN** des clés techniques Dexie Cloud ou de registre d'espace présentes
- **WHEN** le nettoyage des clés V1 est exécuté
- **THEN** ces clés techniques ne sont pas supprimées
- **AND** la configuration Cloud et les espaces restent intacts
## Notes d'intégration
Le profil du projet déclare ses formats historiques et les projections V1 ↔ données Dexie. La migration « base locale vers cible Cloud » appartient à `cloud-opt-in-activation` et `data-reconciliation`, pas à la migration de schéma locale.
