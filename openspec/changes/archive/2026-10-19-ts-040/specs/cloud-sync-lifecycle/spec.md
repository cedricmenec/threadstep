# Spec Delta

## ADDED Requirements

### Requirement: Diagnostic and footer follow the current native state
Le diagnostic natif et le message de bas de page SHALL être recalculés depuis les mêmes signaux natifs Dexie. Un blocage transitoire MUST disparaître après réévaluation saine, un résultat asynchrone ancien MUST NOT remplacer un résultat plus récent, et la disparition d'un blocage MUST NOT effacer une erreur de stockage réelle ni annoncer une synchronisation distante non prouvée. Aucun panneau de migration V1 ne MUST réapparaître.

#### Scenario: Offline attestation becomes healthy
- **GIVEN** une attestation initialement `sync-offline`
- **WHEN** les signaux natifs passent à `connected` / `in-sync` et la cible est validée
- **THEN** le diagnostic est recalculé
- **AND** le bas de page ne continue pas à annoncer la déconnexion
- **AND** le message affiché correspond au parcours actif vérifié
- **AND** aucune écriture n'est effectuée par cette réévaluation

#### Scenario: Late asynchronous result cannot replace a recent one
- **GIVEN** deux lectures ou événements de synchronisation lancés successivement
- **WHEN** le résultat le plus ancien arrive après le plus récent
- **THEN** le résultat ancien est ignoré
- **AND** il ne réaffiche pas un état périmé
- **AND** seul le résultat de la génération courante peut modifier le diagnostic
  ou le bas de page

#### Scenario: A real storage error survives block removal
- **GIVEN** une erreur de stockage ou de lecture réelle est affichée
- **WHEN** un état transitoire disparaît ou est remplacé
- **THEN** l'erreur de stockage reste affichée
- **AND** aucun message de synchronisation distante réussie n'est annoncé
- **AND** les données restent inchangées

#### Scenario: Genuine blocking state reappears after re-evaluation
- **GIVEN** un diagnostic précédemment sain ou fermé
- **WHEN** une nouvelle évaluation atteste une vraie déconnexion, un conflit ou une lecture impossible
- **THEN** l'état bloquant est réaffiché avec la raison courante
- **AND** aucun import automatique n'est déclenché
- **AND** aucun panneau de migration V1 ni sauvegarde historique n'est supprimé

#### Scenario: Two concurrent sync events are ordered deterministically
- **GIVEN** deux événements natifs de synchronisation concurrents
- **WHEN** ils déclenchent chacun une réévaluation
- **THEN** l'évaluation la plus récemment démarrée détermine l'état affiché
- **AND** un résultat plus ancien reçu plus tard ne le remplace pas
- **AND** aucun consentement ni commit n'est créé par ces réévaluations

#### Scenario: Reload rebuilds the current state without stale UI
- **WHEN** la page est rechargée
- **THEN** le diagnostic et le bas de page sont reconstruits depuis les signaux
  natifs courants
- **AND** aucun ancien message de blocage, de plan ou de consentement n'est restauré
- **AND** aucun panneau historique V1 n'est affiché

#### Scenario: Native disconnection is not a migration panel
- **GIVEN** une déconnexion ou une erreur Dexie native
- **WHEN** le diagnostic est affiché
- **THEN** la catégorie native et la raison sont visibles
- **AND** aucun panneau « Migration bloquée » ni offre de conversion V1 n'apparaît
- **AND** aucune donnée métier ni secret n'est exposé

## REMOVED Requirements

### Requirement: Migration panel and footer follow the current native state
**Reason**: The historical V1 migration panel and its messages are removed with the V1 runtime. The native diagnostic and footer ordering guarantees remain required and are restated by `Diagnostic and footer follow the current native state`.

**Migration**: Use the native Dexie Cloud diagnostic and the active workflow status. Legacy V1 keys are inert and can only be listed for voluntary cleanup, never used to render a migration panel.
