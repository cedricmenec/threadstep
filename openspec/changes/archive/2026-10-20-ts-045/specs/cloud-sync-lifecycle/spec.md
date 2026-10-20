# Spec Delta

## ADDED Requirements

### Requirement: Binding bootstrap evidence in the diagnostic

Le diagnostic SHALL exposer séparément la catégorie de bootstrap/liaison, la
preuve native et la preuve distante. Il MUST se recalculer sur les événements
natifs utiles, ignorer un résultat asynchrone ancien et ne jamais exposer email,
OTP, jeton, identifiant utilisateur brut, titre, note ou message d'erreur brut.

#### Scenario: Binding and remote evidence stay distinct

- **GIVEN** un espace Cloud configuré avec un cache non vérifié ou une liaison attestée
- **WHEN** l'utilisateur consulte `#/parametres/synchronisation`
- **THEN** la catégorie de liaison ou de bootstrap est affichée séparément de la session, de la connexion, de la phase native et de la preuve distante
- **AND** une liaison attestée n'est pas présentée comme une preuve de contenu distant
- **AND** une preuve distante absente ou indéterminée n'est jamais présentée comme une base vide
- **AND** aucun contenu métier ni secret n'est affiché

#### Scenario: Delayed native events cannot restore a stale binding label

- **GIVEN** deux événements natifs déclenchent successivement une réévaluation de liaison
- **WHEN** le résultat le plus ancien arrive après le plus récent
- **THEN** le diagnostic conserve le résultat de l'évaluation la plus récente
- **AND** il ne réaffiche pas un cache non vérifié déjà résolu par une attestation cohérente
- **AND** aucune lecture métier, écriture ou récupération n'est déclenchée par cette réévaluation

#### Scenario: Remote mismatch and missing proof are distinguished

- **GIVEN** une liaison avec une destination connue
- **WHEN** le `remoteDbId` observé diffère de la liaison
- **THEN** le diagnostic signale une incohérence de destination
- **AND** il ne la confond pas avec une simple absence de preuve distante
- **WHEN** aucune preuve distante fraîche n'est disponible mais que la liaison locale est attestée
- **THEN** la preuve distante reste indéterminée sans invalider la liaison locale
- **AND** aucune récupération ni copie n'est proposée automatiquement

#### Scenario: Diagnostic trace remains redacted

- **WHEN** la classification de bootstrap et la trace expurgée sont affichées ou exportées
- **THEN** elles ne contiennent aucun email, OTP, jeton, identifiant utilisateur brut, URL brute, titre, note ni message d'erreur brut
- **AND** elles ne contiennent que des codes, catégories, compteurs, booléens et horodatages relatifs
- **AND** la trace reste bornée et son absence n'empêche pas le diagnostic

### Requirement: Truthful binding and convergence evidence

Le diagnostic SHALL distinguer un commit ou une lecture locale, une liaison
attestée, un pull natif prouvé et une lecture métier fraîche. Il MUST NOT
déduire d'un état `in-sync`, d'un pull initial terminé ou d'une lecture locale
une convergence métier ou une présence sur un autre appareil.

#### Scenario: In-sync alone is not binding or business convergence

- **GIVEN** un état natif `in-sync` et un pull initial terminé
- **WHEN** aucune lecture métier fraîche n'a confirmé les enregistrements attendus
- **THEN** le diagnostic ne déclare pas la convergence métier
- **AND** il conserve une preuve locale ou distante séparée
- **AND** il ne prétend pas que les données sont présentes sur un second appareil

#### Scenario: Bound local read is not remote convergence

- **GIVEN** un cache local lié au compte courant et lu avec succès
- **WHEN** l'application est hors ligne ou n'a pas de preuve distante fraîche
- **THEN** le diagnostic peut indiquer que la lecture locale est permise
- **AND** il conserve la preuve distante comme indéterminée
- **AND** il n'en déduit ni propagation serveur ni convergence inter-appareils

#### Scenario: Cross-device convergence requires separate evidence

- **WHEN** un second appareil doit retrouver les mêmes projets et tâches
- **THEN** la convergence est vérifiée sur une instance Dexie Cloud isolée avec un second appareil réel
- **AND** elle n'est pas déduite d'un test simulé, d'un `in-sync` ou d'un pull attesté sur le premier appareil
- **AND** les preuves de CI restent séparées de cette recette
