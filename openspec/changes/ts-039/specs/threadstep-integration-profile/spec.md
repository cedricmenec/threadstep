# Spec Delta

## ADDED Requirements

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
