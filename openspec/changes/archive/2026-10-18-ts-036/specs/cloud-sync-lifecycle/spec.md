# Spec Delta

## ADDED Requirements

### Requirement: Migration panel and footer follow the current native state

Le panneau de migration historique et le message de bas de page SHALL être
recalculés depuis les mêmes signaux natifs Dexie que le diagnostic. Un blocage
transitoire MUST disparaître après réévaluation saine, un résultat asynchrone
ancien MUST NOT remplacer un résultat plus récent, et la disparition d'un
blocage MUST NOT effacer une erreur de stockage réelle ni annoncer une
synchronisation distante non prouvée.

#### Scenario: Offline attestation becomes healthy
- **GIVEN** une attestation initialement `sync-offline` affiche « Migration temporairement bloquée »
- **WHEN** les signaux natifs passent à `connected` / `in-sync` et la cible est validée
- **THEN** le panneau est recalculé
- **AND** le panneau et le bas de page ne continuent pas à annoncer la déconnexion
- **AND** le message affiché correspond au parcours actif vérifié
- **AND** aucune écriture n'est effectuée par cette réévaluation

#### Scenario: Late asynchronous result cannot replace a recent one
- **GIVEN** deux lectures ou événements de synchronisation lancés successivement
- **WHEN** le résultat le plus ancien arrive après le plus récent
- **THEN** le résultat ancien est ignoré
- **AND** il ne réaffiche pas un blocage ou un plan périmé
- **AND** seul le résultat de la génération courante peut modifier le panneau
  ou le bas de page

#### Scenario: A real storage error survives block removal
- **GIVEN** une erreur de stockage ou de lecture réelle est affichée
- **WHEN** un ancien blocage de migration disparaît ou est remplacé
- **THEN** l'erreur de stockage reste affichée
- **AND** aucun message de synchronisation distante réussie n'est annoncé
- **AND** la source et les données restent inchangées

#### Scenario: Genuine blocking state reappears after re-evaluation
- **GIVEN** un panneau précédemment sain ou fermé
- **WHEN** une nouvelle évaluation atteste une vraie déconnexion, un conflit ou une lecture impossible
- **THEN** l'état bloquant est réaffiché avec la raison courante
- **AND** aucune migration ni import automatique n'est déclenché
- **AND** aucune donnée ni sauvegarde historique n'est supprimée

#### Scenario: Two concurrent sync events are ordered deterministically
- **GIVEN** deux événements natifs de synchronisation concurrents
- **WHEN** ils déclenchent chacun une réévaluation du panneau
- **THEN** l'évaluation la plus récemment démarrée détermine l'état affiché
- **AND** un résultat plus ancien reçu plus tard ne le remplace pas
- **AND** aucun consentement ni commit n'est créé par ces réévaluations

#### Scenario: Reload rebuilds the current state without stale UI
- **WHEN** la page est rechargée
- **THEN** le panneau et le bas de page sont reconstruits depuis les signaux
  natifs et la source courants
- **AND** aucun ancien message de blocage, de plan ou de consentement n'est restauré
- **AND** la source historique demeure récupérable
