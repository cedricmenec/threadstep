# Spec Delta

## ADDED Requirements

### Requirement: Dedicated data management page

La page `#/parametres/donnees` SHALL réunir l'export, l'import/fusion et la
restauration dans des sections distinctes, en réutilisant les contrôles,
validations et moteurs existants. Elle MUST présenter les erreurs et
prévisualisations dans son contexte. Elle MUST NOT modifier le format
`threadstep.indexeddb-backup`, les écritures IndexedDB, les plans de
réconciliation ou les protections anti-perte.

#### Scenario: Export from the data page is unchanged and secret-free

- **GIVEN** un espace local ou Cloud dont les enregistrements sont lisibles
- **WHEN** l'utilisateur active « Exporter mes données » depuis `#/parametres/donnees`
- **THEN** le fichier produit est le même document `threadstep.indexeddb-backup` qu'avant le déplacement, avec les mêmes sujets, tâches, relations, compteurs et empreinte
- **AND** il ne contient ni secret, ni OTP, ni token, ni credential, ni configuration Cloud, ni donnée de compte ou d'authentification
- **AND** l'export ne crée aucun compte, n'envoie aucune requête et ne synchronise aucune donnée

#### Scenario: Import and merge stay additive and idempotent from the page

- **GIVEN** une sauvegarde moderne valide sélectionnée depuis `#/parametres/donnees`
- **WHEN** l'utilisateur choisit « Importer et fusionner »
- **THEN** les mêmes validations et la même prévisualisation que le parcours existant sont appliquées dans la page
- **AND** la fusion n'effectue aucune suppression et ne remplace pas l'état courant
- **AND** une seconde importation du même fichier ne duplique aucun enregistrement
- **AND** aucune restauration de remplacement n'est déclenchée implicitement

#### Scenario: Invalid, unsupported or colliding documents are refused on the page

- **WHEN** le fichier sélectionné est un JSON invalide, un format inconnu, un document `version: 1`, un doublon d'identifiant ou une relation invalide
- **THEN** un message explicite et stable est affiché dans la page
- **AND** aucun plan ni aucune écriture n'est produit
- **AND** aucune conversion, aucun préfixage et aucun import implicite n'est tenté
- **AND** le fichier source reste disponible pour l'utilisateur

#### Scenario: Restore remains distinct and cannot start without safeguards

- **GIVEN** un fichier de restauration sélectionné depuis `#/parametres/donnees`
- **WHEN** la prévisualisation de restauration est affichée
- **THEN** la portée, les remplacements ou pertes potentielles et l'avertissement de remplacement apparaissent dans la page
- **AND** le panneau de restauration exige une sauvegarde téléchargée de l'état actuel, la saisie `RESTAURER` et un plan autorisé
- **AND** aucune écriture n'est effectuée avant que ces conditions soient réunies
- **AND** une annulation ou une confirmation absente laisse l'espace courant inchangé

#### Scenario: Navigation, cancellation and reload never restore implicitly

- **GIVEN** une prévisualisation de restauration ouverte ou une confirmation en attente
- **WHEN** l'utilisateur annule, change de page ou recharge l'application
- **THEN** aucune opération de restauration n'est exécutée automatiquement
- **AND** aucun fichier ni consentement antérieur n'est réutilisé implicitement
- **AND** les données locales restent inchangées tant qu'aucune confirmation explicite valide n'a été donnée

#### Scenario: Safety backups keep their original context

- **GIVEN** une confirmation de purge, de déconnexion ou d'action sur un espace de travail, ou le diagnostic de récupération en lecture seule
- **WHEN** cet écran ou ce panneau est affiché
- **THEN** l'action existante de sauvegarde JSON ou d'export brut de récupération reste accessible dans ce même contexte
- **AND** aucune navigation vers `#/parametres/donnees` n'est nécessaire pour l'atteindre
- **AND** son sélecteur et son handler ne sont ni renommés, ni recréés, ni dupliqués

#### Scenario: Opening the data page is presentation-only

- **WHEN** l'utilisateur ouvre ou quitte `#/parametres/donnees` sans activer de commande
- **THEN** aucun export, import, plan, écriture IndexedDB, requête réseau, authentification ou transfert Cloud n'est déclenché
- **AND** aucune confirmation ou sauvegarde en attente n'est validée automatiquement
