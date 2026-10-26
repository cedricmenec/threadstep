# react-integration-boundary Specification Delta

## MODIFIED Requirements

### Requirement: Propriété DOM unique et bornée

Au plus une racine React SHALL posséder un même conteneur borné à la fois.
Pendant ce changement, l'application MAY avoir exactement deux conteneurs
bornés simultanément — l'en-tête et la surface de contenu — chacun avec un
propriétaire exclusif. La surface de contenu est soit la liste des cartes
Overview, soit le détail projet, jamais les deux. Tant qu'une racine est
active, le renderer vanilla MUST NOT remplacer ni modifier ses descendants.
Avant un nouveau rendu vanilla, la racine correspondante SHALL être démontée.
Plusieurs cycles de navigation et de rafraîchissement MUST NOT cumuler des
racines ni laisser des listeners actifs dupliqués.

#### Scenario: Montage puis démontage

- **GIVEN** un conteneur borné et une fixture React synthétique
- **WHEN** la racine est montée puis démontée
- **THEN** le conteneur ne contient plus d'arbre React après le démontage
- **AND** aucun listener actif de la fixture ne subsiste
- **AND** seul ce conteneur est libéré

#### Scenario: Le vanilla ne possède pas le conteneur actif

- **GIVEN** une racine React active dans son conteneur
- **WHEN** le renderer vanilla tente de remplacer les descendants du conteneur
- **THEN** l'écriture est refusée
- **AND** l'arbre React et son propriétaire restent uniques

#### Scenario: Cycles navigation et rafraîchissement

- **GIVEN** une surface montée, démontée puis remontée plusieurs fois
- **WHEN** une navigation simulée et un rafraîchissement simulé sont répétés
- **THEN** aucun descendant n'a deux propriétaires DOM
- **AND** aucun listener actif n'est dupliqué
- **AND** chaque conteneur actif possède au plus un propriétaire
- **AND** le nombre de conteneurs React actifs ne dépasse jamais deux

#### Scenario: Deux conteneurs autorisés coexistent

- **GIVEN** une racine de coque dans l'hôte d'en-tête et une surface de contenu
  dans le conteneur `#subjects`, soit Overview soit détail
- **WHEN** les deux surfaces sont actives
- **THEN** chaque conteneur possède exactement un propriétaire
- **AND** aucune racine ne réécrit le conteneur de l'autre
- **AND** le vanilla ne peut écrire ni dans l'un ni dans l'autre tant qu'ils
  sont actifs
- **AND** Overview et détail ne possèdent jamais `#subjects` simultanément

## ADDED Requirements

### Requirement: Invalidation indépendante des cartes Overview

Les cartes Overview et le détail React SHALL pouvoir être invalidés séparément
sur le conteneur de contenu partagé. Une invalidation de l'un MUST NOT
démonter ni réinitialiser l'autre au-delà du changement de route, d'identité
ou d'état bloquant. L'ancienne surface SHALL être libérée avant toute
réécriture vanilla de son conteneur.

#### Scenario: Overview libère sa surface avant le détail

- **GIVEN** les cartes Overview possèdent `#subjects`
- **WHEN** la route passe à un projet
- **THEN** seule la surface Overview est démontée
- **AND** le détail monte ensuite dans le même conteneur libéré
- **AND** la coque d'en-tête reste indépendante et utilisable

#### Scenario: Le détail libère sa surface avant Overview

- **GIVEN** le détail React possède `#subjects`
- **WHEN** la route revient à Overview
- **THEN** seule la surface du détail est libérée avant le rendu des cartes
- **AND** aucune commande, aucun Undo, aucune liste ni aucun brouillon du
  détail ne reste actif
- **AND** les cartes sont dérivées du document courant

#### Scenario: Identité et blocage libèrent avant le vanilla

- **GIVEN** une surface de contenu active pour une identité autorisée
- **WHEN** l'identité ou l'espace change, devient non vérifié, ou qu'une
  lecture bloquante survient
- **THEN** la surface concernée est invalidée avant toute réécriture vanilla
  de `#subjects`
- **AND** aucun contenu métier de l'ancien contexte n'est affiché ou copié
- **AND** aucune requête Cloud ou écriture IndexedDB supplémentaire n'est
  déclenchée par la transition de présentation

#### Scenario: Rafraîchissement de même contexte non invalidant

- **GIVEN** une surface Overview active sous une identité autorisée inchangée
- **WHEN** un rafraîchissement de données, un filtre ou un changement d'état
  de présentation locale survient
- **THEN** la surface n'est ni démontée ni recréée
- **AND** son propriétaire, ses listeners et ses clés d'éléments restent
  uniques
- **AND** les états encore valides sont conservés

#### Scenario: Cycles mixtes sans accumulation

- **GIVEN** des cycles simulés Overview, détail, paramètres, identité et
  lecture bloquée
- **WHEN** les cycles sont répétés
- **THEN** le nombre de conteneurs React actifs reste borné à deux
- **AND** `#subjects` ne possède jamais plus d'un propriétaire
- **AND** aucun listener ni arbre de l'ancienne surface ne subsiste
