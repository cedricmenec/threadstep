# Spec Delta

## ADDED Requirements

### Requirement: Metrics follow authorized read presentation

La synthèse des projets et les indicateurs de carte SHALL être calculés et
affichés uniquement lorsque la lecture métier autorisée est achevée et que la
présentation de la vue d'ensemble est disponible. Pendant l'initialisation,
une lecture en attente, un changement d'identité ou une action requise sans
projets disponibles, aucun chiffre de synthèse ou de progression MUST être
présenté ou annoncé.

#### Scenario: Healthy reload shows no fabricated metrics

- **GIVEN** une session Cloud saine et une liaison de compte autorisée
- **WHEN** un rechargement traverse les états transitoires avant la fin de la
  lecture métier autorisée
- **THEN** aucune synthèse de projets, aucun zéro et aucun pourcentage ne sont
  affichés ou annoncés
- **AND** les indicateurs réels apparaissent une fois la lecture achevée

#### Scenario: In-sync alone does not expose metrics

- **GIVEN** l'état natif est `in-sync` mais la lecture métier autorisée n'est
  pas achevée
- **WHEN** la vue Mes projets est affichée
- **THEN** aucun chiffre de projets actifs, d'étapes en attente, d'urgences ou
  de progression n'est présenté
- **AND** l'état de lecture en attente prévu par la spécification reste affiché

#### Scenario: Account or base switch keeps metrics isolated

- **GIVEN** l'espace A affichait une synthèse et des indicateurs
- **WHEN** l'utilisateur bascule vers un espace ou un compte B non encore lisible
- **THEN** aucune métrique ni aucun document mis en cache de A n'est affiché
  sous B
- **AND** B affiche son propre chargement, ses propres métriques ou une action
  requise selon son état réel

#### Scenario: Blocking action shows no zero metrics

- **GIVEN** une liaison de compte non vérifiée, une session nécessitant une
  reconnexion ou une erreur confirmée empêche l'affichage fiable des projets
- **WHEN** la vue Mes projets présente l'action requise
- **THEN** aucune synthèse à zéro ni aucun indicateur de carte n'est affiché
  comme si la lecture avait réussi
- **AND** l'explication persistante et le lien vers Paramètres >
  Synchronisation restent visibles

#### Scenario: Available projects update the metrics in place

- **GIVEN** les projets sont disponibles sous la liaison autorisée courante
- **WHEN** une actualisation de fond conserve la même identité autorisée
- **THEN** la liste et les indicateurs restent affichés sans chargement qui les
  remplace
- **AND** les valeurs reflètent le document métier courant
