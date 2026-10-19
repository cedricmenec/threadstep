# Spec Delta

## MODIFIED Requirements

### Requirement: Versioned portable export
Chaque export SHALL déclarer un format et une version explicites et restituer les champs métier et relations nécessaires à une relecture fiable. Un export issu d'IndexedDB MUST utiliser un format distinct du document V1 et MUST déclarer des identifiants canoniques. Les secrets, tokens, credentials, configuration Cloud, compte et données d'authentification MUST être exclus.

#### Scenario: Export local-only records
- **GIVEN** un espace sans Cloud
- **WHEN** l'utilisateur télécharge une sauvegarde
- **THEN** les enregistrements `subjects` et `items` et leurs relations sont exportés dans le format IndexedDB versionné du projet
- **AND** l'export ne déclenche ni création de compte ni synchronisation

#### Scenario: Export of Cloud-synced data
- **WHEN** une sauvegarde est produite depuis l'espace synchronisé
- **THEN** les identifiants métier originaux sont préservés
- **AND** la provenance Cloud n'est pas confondue avec une source V1 inédite
- **AND** aucune URL, aucun `remoteDbId`, aucun email ni aucun jeton n'est inclus

#### Scenario: Export declares identity provenance
- **GIVEN** un export produit depuis IndexedDB avec des identifiants déjà canoniques
- **WHEN** le fichier est généré
- **THEN** il déclare son format `threadstep.indexeddb-backup`, sa version de format et des identifiants canoniques issus d'IndexedDB
- **AND** le bloc de provenance ne contient aucun titre, note, compte ou secret
- **AND** le fichier ne prend pas l'enveloppe `version: 1`

#### Scenario: Canonical legacy-prefixed identifiers stay intact
- **GIVEN** des enregistrements IndexedDB dont les identifiants commencent déjà par `legacy:`
- **WHEN** la sauvegarde est produite puis relue
- **THEN** ces identifiants et leurs `subjectId`/`parentId` restent identiques
- **AND** aucun préfixe supplémentaire n'est ajouté

#### Scenario: V1 export is disabled during an integrity anomaly
- **GIVEN** l'inventaire read-only signale une référence orpheline ou une variante d'identité non résolue
- **WHEN** l'utilisateur cherche un export V1
- **THEN** aucun export V1 n'est proposé, ce format étant retiré
- **AND** la sauvegarde métier modern est désactivée ou marquée incomplète selon `Business backup gating during integrity anomalies`
- **AND** l'export brut de récupération distinct reste disponible
- **AND** aucun enregistrement anomal n'est omis silencieusement

### Requirement: Strict import validation
Le fichier importé SHALL être validé en format, version, taille, structure, identifiants, relations, comptes et empreinte avant la création d'un plan. Une erreur de parsing MUST NOT affecter l'espace courant. Un document `version: 1`, une provenance inconnue ou un format non pris en charge MUST être refusés sans écriture et sans conversion implicite.

#### Scenario: Corrupt backup
- **WHEN** un fichier illisible, tronqué ou dont l'empreinte ne correspond pas est fourni
- **THEN** aucune mutation n'est effectuée
- **AND** le fichier source de l'utilisateur reste disponible
- **AND** un code d'erreur stable distingue le format, la structure et l'empreinte

#### Scenario: Missing parent or duplicate ID
- **WHEN** la source contient une relation invalide ou deux entités identiquement nommées par ID
- **THEN** le moteur ne corrige pas silencieusement la source
- **AND** aucun plan d'écriture n'est produit
- **AND** un diagnostic permet de choisir une récupération appropriée

#### Scenario: Legacy V1 document is rejected without write
- **GIVEN** un document dont l'enveloppe est `version: 1` avec des sujets et des étapes
- **WHEN** il est fourni à l'import, à la fusion locale ou à la restauration
- **THEN** il est refusé avec un message explicite indiquant que le format V1 n'est plus pris en charge
- **AND** aucune écriture locale ou Cloud n'est effectuée
- **AND** aucune conversion, aucun préfixage et aucun import implicite n'est tenté

#### Scenario: Unknown or unsupported format is rejected
- **WHEN** le fichier ne déclare pas le format IndexedDB attendu ou déclare une version de format inconnue
- **THEN** aucun plan n'est produit
- **AND** la cible reste inchangée
- **AND** l'interface ne déduit pas la provenance depuis le titre, la note ou la forme des identifiants

#### Scenario: Ambiguous provenance blocks the plan
- **GIVEN** une source sans provenance modern prouvée, avec ou sans identifiants préfixés
- **WHEN** l'application ne peut pas prouver le format attendu
- **THEN** aucun plan d'écriture n'est produit
- **AND** la source est refusée explicitement
- **AND** une décision de format modern explicite reste requise avant toute réimportation

#### Scenario: Invalid provenance metadata
- **WHEN** le bloc de provenance est présent mais incohérent, inconnu ou contredit la structure des identifiants
- **THEN** le document est traité comme invalide
- **AND** aucune écriture n'est effectuée
- **AND** le fichier source reste intact

### Requirement: Reimport idempotency
Les importations SHALL préserver l'identité logique quand l'export contient déjà des IDs métier stables. Un import répété du même contenu dans le même périmètre MUST NOT dupliquer ses enregistrements. Cette garantie SHALL s'appliquer au même résolveur d'identité pour l'import Cloud, l'import local et la restauration, sans préfixage récursif.

#### Scenario: Same JSON imported twice
- **GIVEN** un import confirmé puis son rechargement
- **WHEN** le même JSON est présenté une seconde fois
- **THEN** les objets identiques sont reconnus comme présents
- **AND** aucun nouveau groupe ni préfixe d'identifiant n'est ajouté
- **AND** le plan ne contient aucune opération

#### Scenario: Export after legacy migration is reimported
- **GIVEN** un export modern dont l'ID est déjà `legacy:abc` et déclaré canonique
- **WHEN** ce JSON est importé
- **THEN** l'ID reste `legacy:abc` pour le rapprochement
- **AND** le moteur ne crée pas `legacy:legacy:abc`

#### Scenario: Cloud import uses the same mapping as the UI
- **GIVEN** un export modern contenant `legacy:s1`, `subjectId: legacy:s1` et un `parentId` déjà canonique
- **WHEN** l'import Cloud construit son plan par le même classificateur d'enregistrements que l'interface
- **THEN** aucun identifiant n'est réécrit
- **AND** tous les `subjectId` et `parentId` restent cohérents
- **AND** une seconde importation du même fichier produit zéro doublon

#### Scenario: Raw V1 is mapped exactly once
- **GIVEN** une cible contenant déjà les mêmes enregistrements qu'une sauvegarde modern
- **WHEN** le plan est calculé
- **THEN** aucun `put` ni `delete` n'est produit
- **AND** les compteurs et la hiérarchie restent identiques

### Requirement: Separate import merge from restoration
L'interface SHALL proposer des intentions distinctes : « importer et fusionner » et « restaurer un état antérieur ». Une restauration pouvant remplacer des données SHALL afficher un diff, les suppressions ou pertes potentielles, une sauvegarde de sécurité et une confirmation renforcée. L'import SHALL reconnaître les identités, la provenance modern, les droits/realms de la cible et les enregistrements Cloud-only sans les écraser.

#### Scenario: Merge older backup into newer state
- **GIVEN** une sauvegarde plus ancienne que les données actuelles
- **WHEN** l'utilisateur choisit « fusionner »
- **THEN** les éléments seulement présents dans la sauvegarde sont examinés
- **AND** les changements récents ne sont jamais écrasés automatiquement
- **AND** aucune suppression n'est effectuée

#### Scenario: Restore requires explicit scope
- **WHEN** l'utilisateur choisit « restaurer »
- **THEN** la portée locale ou Cloud est affichée ainsi que les modifications potentiellement remplacées
- **AND** une sauvegarde récupérable de l'état actuel est proposée avant toute opération destructive
- **AND** l'utilisateur peut annuler sans effet

#### Scenario: Existing Cloud data during JSON import
- **WHEN** un JSON modern doit entrer dans une cible Cloud peuplée
- **THEN** la procédure passe par la découverte/attestation distante puis la réconciliation
- **AND** la lecture seule d'un fichier n'entraîne jamais son push
- **AND** les enregistrements Cloud-only, les droits et les realms sont préservés

#### Scenario: Restore is never an implicit import effect
- **WHEN** l'utilisateur choisit « importer et fusionner »
- **THEN** aucune suppression ou réécriture destructive n'est exécutée
- **AND** la restauration remplaçante reste une intention et une confirmation distinctes
- **AND** une sauvegarde de l'état courant est exigée avant une restauration destructive

#### Scenario: Restore of a modern backup is complete
- **GIVEN** une sauvegarde modern saine de 5 sujets, 18 étapes et une tâche supplémentaire
- **WHEN** elle est restaurée dans un profil de test vierge
- **THEN** la hiérarchie, les identifiants, les notes, priorités, ordres et états sont reproduits intégralement
- **AND** une seconde restauration du même fichier ne duplique rien

### Requirement: Abort, reload and recovery
Un import ou une restauration interrompu SHALL laisser un état explicable. Les conversions SHALL être idempotentes et les transactions locales atomiques ; les garanties de réplication distante restent distinctes.

#### Scenario: Cancel before confirmation
- **WHEN** l'utilisateur annule la prévisualisation
- **THEN** l'espace courant n'est pas modifié
- **AND** aucun fichier ni état de consentement n'est réutilisé implicitement

#### Scenario: Reload after local commit
- **WHEN** un import validé est suivi d'un rechargement
- **THEN** les éléments écrits restent présents
- **AND** aucune seconde importation automatique du fichier n'a lieu

#### Scenario: Stale plan is refused
- **GIVEN** une prévisualisation liée aux empreintes de la source et de la cible
- **WHEN** l'une des deux change avant la confirmation
- **THEN** le consentement est refusé avec un statut de plan périmé
- **AND** aucune opération du plan périmé n'est écrite

### Requirement: Import source provenance and ambiguity
L'application SHALL classifier la provenance d'une source à partir de métadonnées explicites, jamais à partir d'un titre, d'une note ou du seul suffixe `legacy:`. Un format modern déclare sa provenance et ses identifiants canoniques. Un document V1 ou une source non déclarée MUST rester non pris en charge et bloquer toute écriture.

#### Scenario: Projected IndexedDB export
- **GIVEN** un export déclaré comme provenant d'IndexedDB avec des identifiants canoniques
- **WHEN** il est importé
- **THEN** ses identifiants et relations sont conservés tels quels
- **AND** aucun second préfixe n'est ajouté

#### Scenario: Raw V1 with plain identifiers
- **GIVEN** un document V1 brut déclaré comme tel ou reconnu par son enveloppe `version: 1`
- **WHEN** il est importé
- **THEN** il est refusé sans écriture
- **AND** aucun mapping canonique n'est appliqué

#### Scenario: Historical double-prefixed export
- **GIVEN** une source V1 contenant des identifiants `legacy:legacy:`
- **WHEN** elle est importée
- **THEN** elle n'est pas reconnue comme une sauvegarde moderne
- **AND** aucune écriture n'est effectuée
- **AND** aucun préfixe n'est retiré par supposition

#### Scenario: Unmarked prefixed source is ambiguous
- **GIVEN** une source sans métadonnées modern, avec ou sans identifiants préfixés
- **WHEN** l'application prépare l'import
- **THEN** elle refuse la source et explique le format attendu
- **AND** le titre, la similitude de contenu ou le retrait des préfixes ne servent pas de preuve
- **AND** aucune écriture n'est effectuée

#### Scenario: Unmarked plain-identifier source is also ambiguous
- **GIVEN** une source sans provenance dont les identifiants ne portent aucun préfixe
- **WHEN** l'application ne peut pas prouver qu'il s'agit d'une sauvegarde modern
- **THEN** elle ne la traite pas automatiquement comme une source valide
- **AND** elle refuse la source sans écriture
- **AND** une source déclarée par le format modern reste importable

#### Scenario: Raw identifier that literally starts with legacy
- **GIVEN** une sauvegarde modern dont un identifiant canonique commence réellement par `legacy:`
- **WHEN** elle est importée
- **THEN** l'identifiant est conservé tel quel
- **AND** il n'est pas confondu avec une provenance V1

### Requirement: Traceable import and repair outcomes
Les événements d'import, de copie, de réparation, d'ambiguïté et de rejet SHALL être traçables par des codes stables. Les événements et journaux MUST NOT contenir de titre, note, email, OTP, token ou secret. Les identifiants affichés à la personne concernée restent dans son interface et ne sont pas publiés dans les journaux techniques.

#### Scenario: Outcomes are reported by code
- **WHEN** une importation, une copie ou une réparation se termine ou est refusée
- **THEN** le résultat expose un code stable et un compte
- **AND** le code distingue succès, format non pris en charge, plan périmé, collision et échec de transaction

#### Scenario: Legacy format rejection has a stable code
- **WHEN** un document `version: 1` est refusé
- **THEN** le résultat expose un code distinct tel que `unsupported-v1-backup`
- **AND** aucun contenu métier n'est journalisé
- **AND** les compteurs et identifiants privés ne sont pas publiés

#### Scenario: Logs contain no business content
- **WHEN** un événement d'import ou de réparation est produit
- **THEN** il ne contient ni titre, ni note, ni email, ni OTP, ni token
- **AND** aucune donnée métier n'est journalisée dans les erreurs techniques publiques

## ADDED Requirements

### Requirement: Business backup gating during integrity anomalies
Lorsqu'une anomalie d'intégrité empêche une projection fidèle, l'application SHALL désactiver ou marquer explicitement incomplet l'export métier modern. Elle MUST proposer l'export brut de récupération distinct et MUST NOT produire une sauvegarde qui omet silencieusement un enregistrement accessible.

#### Scenario: Anomaly disables the normal business backup
- **GIVEN** un inventaire read-only signale au moins une anomalie bloquante
- **WHEN** l'utilisateur ouvre l'action d'export métier
- **THEN** l'action est désactivée avec une explication
- **AND** l'export brut de récupération reste disponible

#### Scenario: No silent omission
- **WHEN** une sauvegarde métier est produite ou marquée incomplète malgré une anomalie
- **THEN** le fichier et l'interface indiquent explicitement son caractère incomplet
- **AND** aucun enregistrement accessible n'est omis sans avertissement

### Requirement: Retired V1 backup rejection and transition notice
L'application SHALL refuser tout document ou fichier V1 dans les parcours d'import, de fusion et de restauration. Avant le retrait effectif, elle SHALL afficher un avertissement de transition invitant l'utilisateur à générer et vérifier une sauvegarde modern. Aucun support permanent des sauvegardes V1 MUST être ajouté.

#### Scenario: V1 file produces an explicit refusal
- **GIVEN** un fichier `version: 1`, même récemment produit depuis IndexedDB
- **WHEN** l'utilisateur tente de l'importer ou de le restaurer
- **THEN** l'interface explique que ce format n'est plus accepté
- **AND** elle indique le format modern attendu
- **AND** aucune écriture, migration ou conversion n'a lieu

#### Scenario: Transition warning invites a modern backup
- **GIVEN** des données IndexedDB lisibles et un ancien fichier V1 susceptible d'exister
- **WHEN** l'utilisateur consulte l'export ou la notice de transition
- **THEN** il est averti que les anciens fichiers V1 ne seront plus acceptés
- **AND** il lui est proposé de générer et vérifier une sauvegarde modern
- **AND** aucune donnée n'est supprimée ou envoyée au Cloud par cet avertissement

#### Scenario: No permanent V1 reader is retained
- **WHEN** les parcours utilisateur d'import, de fusion et de restauration sont inspectés
- **THEN** ils n'acceptent que le format modern versionné
- **AND** aucun analyseur V1 de secours, aucune heuristique `legacy:` et aucune conversion silencieuse ne subsiste

## REMOVED Requirements

### Requirement: V1 export gating during integrity anomalies
**Reason**: The normal business export is no longer a V1 document; it is replaced by the modern IndexedDB backup contract and the gating requirement is restated under `Business backup gating during integrity anomalies`.

**Migration**: Use the modern business backup when the workspace is coherent. When an integrity anomaly blocks a faithful projection, use the unchanged raw recovery export. V1 backup files are no longer accepted.
