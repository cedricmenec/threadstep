# Spec Delta

## Purpose

Fournir une certification reproductible des parcours local-first et Cloud de
ThreadStep, en séparant les preuves CI, la recette réelle sur instance Dexie
isolée, les limites de simulation et les incidents ouverts.

## ADDED Requirements

### Requirement: Required journey coverage

La matrice de certification SHALL couvrir local-only, activation, première
synchronisation, cible peuplée, divergence, conflits concurrents, reimport JSON,
restauration, déconnexion, changement d'URL, changement de session, erreurs
réseau et les garanties transverses d'états, persistance, empreintes, sécurité
et idempotence. Chaque parcours MUST avoir au moins un scénario de preuve
identifiable.

#### Scenario: Local-first journeys are covered

- **GIVEN** la matrice de certification
- **WHEN** elle est évaluée
- **THEN** elle contient un parcours local-only vérifiant le démarrage sans Cloud, la persistance après rechargement et l'absence de requête Cloud
- **AND** elle contient les parcours de reimport JSON et de restauration avec conservation des relations

#### Scenario: Cloud journeys are covered

- **WHEN** la matrice est évaluée
- **THEN** elle contient l'activation, la première synchronisation, la cible peuplée, la divergence, les conflits concurrents, la déconnexion et les changements d'URL ou de session
- **AND** les erreurs réseau y figurent comme état observable distinct d'un échec local

#### Scenario: Cross-cutting guarantees are covered

- **WHEN** la matrice est évaluée
- **THEN** des scénarios couvrent les états, la persistance, les empreintes, la sécurité et l'idempotence
- **AND** chaque scénario nomme le comportement observé et non seulement le module sollicité

#### Scenario: A missing journey fails certification

- **GIVEN** une matrice à laquelle il manque un parcours requis
- **WHEN** la validation est exécutée
- **THEN** la certification échoue avec le nom du parcours manquant
- **AND** aucun rapport global n'est déclaré réussi

### Requirement: Canonical traceability

Chaque entrée de la matrice SHALL référencer un chemin de capacité existant sous
`openspec/specs/` et un intitulé exact de `### Requirement:`. Une référence
absente ou inconnue MUST faire échouer la validation sans modifier la
spécification canonique ni son historique archivé.

#### Scenario: A valid reference resolves

- **GIVEN** une entrée pointing vers une capacité et une exigence existantes
- **WHEN** la traçabilité est validée
- **THEN** la référence est résolue
- **AND** l'entrée reste associée au texte canonique attendu

#### Scenario: An unknown capability or requirement fails

- **WHEN** une entrée référence une capacité inconnue ou un intitulé d'exigence absent
- **THEN** la validation échoue avec le chemin et l'intitulé fautifs
- **AND** aucune spécification canonique n'est réécrite pour masquer l'écart

#### Scenario: Archived history is untouched

- **WHEN** la traçabilité est validée
- **THEN** seuls les fichiers canoniques courants sont lus
- **AND** aucun fichier sous `openspec/changes/archive/` n'est modifié

### Requirement: Deterministic CI evidence

Le rapport de certification SHALL être produit par un exécuteur déterministe,
sans réseau, horloge, aléa, appel payant ni écriture de données. Les mêmes
entrées MUST produire le même rapport, et un contrôle en échec MUST rester
`failed` ou non exécuté, jamais `passed`.

#### Scenario: Repeated runs produce the same report

- **WHEN** la certification est exécutée deux fois avec les mêmes entrées
- **THEN** les identifiants, statuts et contrôles sont identiques
- **AND** aucune date courante ni valeur aléatoire n'apparaît

#### Scenario: The runner has no external effect

- **WHEN** l'exécuteur de certification s'exécute
- **THEN** il n'émet aucune requête réseau et ne déclenche aucun service payant
- **AND** il n'écrit ni dans le dépôt, ni dans les données personnelles, ni dans une base Cloud

#### Scenario: A failing control is not promoted

- **GIVEN** un contrôle dont l'assertion échoue
- **WHEN** le rapport est construit
- **THEN** ce contrôle est marqué en échec
- **AND** le parcours concerné n'est pas déclaré accepté
- **AND** les autres statuts ne sont pas inventés

### Requirement: Evidence classes and statuses

Le rapport SHALL distinguer au minimum les preuves `ci`, `real-dexie`, les
`limitation` et les `incident`, avec des statuts distincts pour réussi, en
attente, non exécuté et ouvert. Une preuve CI MUST NOT être présentée comme une
recette réelle, et un incident ouvert MUST rendre la certification globale non
réussie.

#### Scenario: CI evidence stays CI evidence

- **GIVEN** un parcours dont seul le contrôle déterministe a été exécuté
- **WHEN** le rapport est affiché
- **THEN** sa preuve réelle apparaît en attente ou non exécutée
- **AND** elle n'est jamais marquée acceptée par la réussite CI

#### Scenario: Limitations are visible

- **WHEN** un comportement natif ne peut pas être prouvé sur le runner
- **THEN** il figure comme limitation avec une description du non-prouvé
- **AND** le rapport ne le compte ni comme succès ni comme échec caché

#### Scenario: Open incident blocks acceptance

- **GIVEN** un incident de recette ouverte
- **WHEN** le rapport est construit
- **THEN** l'incident est listé avec sa gravité et son statut
- **AND** la certification globale n'est pas annoncée réussie

#### Scenario: An unexecuted check is not accepted

- **GIVEN** un scénario manuel non exécuté
- **WHEN** le rapport est consulté
- **THEN** son statut reste non exécuté ou en attente
- **AND** aucune mention ne le présente comme validé

### Requirement: Real-instance manual protocol

Le protocole SHALL décrire une recette sur instance Dexie Cloud isolée avec
Chrome mobile, deux navigateurs ou profils indépendants, OTP email réel, mode
hors ligne, réseau intermittent et propagation dans les deux sens. Il MUST
exiger des données de test, un export de secours et l'interdiction des bases
personnelles.

#### Scenario: The protocol names every required condition

- **WHEN** le protocole est relu
- **THEN** il mentionne l'instance isolée, Chrome mobile, deux navigateurs, l'OTP réel, le hors ligne, le réseau intermittent et la propagation bidirectionnelle
- **AND** il décrit la préparation des données de test et l'export de secours

#### Scenario: Bidirectional propagation is observed

- **GIVEN** deux navigateurs connectés au même espace de test
- **WHEN** une modification est créée sur l'un puis sur l'autre
- **THEN** le protocole exige une observation de chaque modification sur l'autre navigateur
- **AND** la convergence n'est pas déduite d'un simple état `in-sync` local

#### Scenario: Intermittent network is tested explicitly

- **WHEN** le réseau est coupé puis rétabli pendant une écriture ou une synchronisation
- **THEN** le protocole exige de vérifier la conservation locale et la reprise sans doublon
- **AND** une erreur réseau reste distincte d'un échec de transaction locale

#### Scenario: Non-execution is recorded truthfully

- **WHEN** une étape du protocole n'a pas été exécutée
- **THEN** elle est consignée comme non exécutée
- **AND** elle n'est pas présentée comme acceptée
- **AND** la certification globale reste partielle

### Requirement: Historical V1 recovery in acceptance

Le protocole SHALL documenter la vérification de la source historique
`threadstep.document.v1` et de son export avant et après les parcours, sans
suppression ni réécriture destructive. La récupération via un export ou une
restauration SHALL être observée séparément de la synchronisation Cloud.

#### Scenario: Historical source is checked before testing

- **GIVEN** un profil de test contenant une source V1
- **WHEN** la recette commence
- **THEN** le protocole exige un export de secours lisible et la vérification de la clé historique
- **AND** aucune manipulation destructive n'est autorisée sur une base personnelle

#### Scenario: Recovery is verified after an incident

- **WHEN** un parcours échoue ou une donnée paraît absente
- **THEN** le protocole exige de vérifier la récupération via l'export ou la sauvegarde
- **AND** la récupération observée est rapportée séparément de la propagation distante

### Requirement: Redaction and test-data safety

Les fixtures, rapports et comptes rendus SHALL contenir uniquement des données
synthétiques et MUST NOT exposer email, OTP, token, URL avec credentials,
identifiant personnel, titre, note ou contenu métier réel. L'exécution MUST NOT
transférer de données héritées vers un service externe.

#### Scenario: Fixtures use synthetic data

- **WHEN** les fixtures de certification sont inspectées
- **THEN** elles utilisent des identifiants et contenus synthétiques
- **AND** elles ne contiennent ni email réel, ni OTP, ni token, ni URL avec credentials

#### Scenario: Reports are redacted

- **WHEN** le rapport automatique est produit
- **THEN** il n'affiche aucune valeur secrète ni contenu métier
- **AND** il ne contient que des catégories, identifiants de scénario et résultats

#### Scenario: No transfer to an external service

- **WHEN** l'exécuteur de certification s'exécute en CI
- **THEN** aucune donnée de test ou héritée n'est envoyée à Dexie Cloud
- **AND** aucun service payant n'est appelé
