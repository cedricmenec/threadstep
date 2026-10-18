# Spec Delta

## MODIFIED Requirements

### Requirement: ThreadStep backups and reimport

Le JSON V1 ThreadStep SHALL rester compatible avec les conversions autorisées. Réimporter un export local, historique ou Cloud MUST reconnaître les identifiants métier déjà mappés et offrir fusion/restauration comme intentions distinctes. Un export IndexedDB ThreadStep SHALL déclarer sa provenance d'identifiants afin qu'une réimportation ne produise jamais `legacy:legacy:`, et une source ambiguë SHALL exiger une décision explicite.

#### Scenario: Same document reimport
- **WHEN** un même export JSON ThreadStep est importé une seconde fois
- **THEN** aucun sujet ni étape identique n'est dupliqué
- **AND** les IDs ne reçoivent jamais une seconde fois le préfixe `legacy:`

#### Scenario: IndexedDB export reimport keeps canonical IDs
- **GIVEN** un export ThreadStep produit depuis IndexedDB avec `legacy:s1`
- **WHEN** il est réimporté dans l'espace local ou Cloud
- **THEN** `legacy:s1` reste l'identifiant utilisé pour le rapprochement
- **AND** les `subjectId` et `parentId` restent cohérents
- **AND** aucun `legacy:legacy:` n'est créé

#### Scenario: Ambiguous legacy-prefixed file
- **GIVEN** un fichier ThreadStep non marqué contenant des identifiants `legacy:`
- **WHEN** sa provenance n'est pas prouvée
- **THEN** l'import est bloqué sans écriture
- **AND** l'interface présente les interprétations possibles
- **AND** l'utilisateur doit confirmer explicitement la provenance

#### Scenario: Old backup differs from Cloud
- **WHEN** un export ancien est présenté à une cible synchronisée plus récente
- **THEN** un inventaire de différences est présenté avant toute écriture
- **AND** les choix de conservation ou de copie préservent les données déjà présentes
- **AND** la restauration destructive reste une intention distincte

## ADDED Requirements

### Requirement: ThreadStep inconsistent workspace recovery

ThreadStep SHALL diagnostiquer en lecture seule un workspace incohérent de 5 sujets et 19 tâches dont une orpheline, y compris les variantes `legacy:s1` et `legacy:legacy:s1`. Les 5 sujets valides SHALL rester consultables sans écriture, l'export brut SHALL inclure les 19 tâches et l'export V1 normal SHALL être désactivé ou marqué incomplet. Une réparation SHALL préserver tous les champs métier et relations.

#### Scenario: Five subjects and nineteen tasks with one orphan
- **GIVEN** un workspace ThreadStep contenant 5 sujets et 19 tâches, dont une tâche dont le `subjectId` ne correspond à aucun sujet visible
- **WHEN** l'inventaire et la consultation dégradée sont affichés
- **THEN** les 5 sujets valides restent consultables
- **AND** la 19e tâche est signalée comme orpheline avec un code
- **AND** aucune écriture n'est effectuée

#### Scenario: Raw recovery export includes all nineteen tasks
- **GIVEN** le workspace incohérent de 5 sujets et 19 tâches
- **WHEN** l'utilisateur demande l'export brut de récupération
- **THEN** les 19 tâches accessibles sont présentes, y compris l'orpheline
- **AND** l'export est distinct d'un export V1 métier
- **AND** il ne contient aucun token, OTP, credential ou secret

#### Scenario: Normal V1 export is gated during the anomaly
- **GIVEN** l'inventaire signale l'orpheline ou une variante d'identité non résolue
- **WHEN** l'utilisateur demande l'export V1 normal
- **THEN** cet export est désactivé avec une explication ou marqué incomplet
- **AND** aucun enregistrement accessible n'est omis silencieusement

#### Scenario: Repair preserves ThreadStep business fields
- **GIVEN** un plan de réparation consenti et prouvé pour une tâche orpheline
- **WHEN** la réparation est appliquée
- **THEN** la note, l'ordre, la priorité, l'état `done` et la relation parent/enfant sont conservés
- **AND** seule la référence nécessaire est modifiée
- **AND** une seconde exécution ne crée aucun doublon

#### Scenario: Prefix variants are not silently merged
- **GIVEN** un sujet visible sous `legacy:legacy:s1` et une tâche référençant `legacy:s1`
- **WHEN** aucune provenance ne prouve l'identité commune
- **THEN** le groupe est ambigu et bloqué
- **AND** aucune variante n'est renommée ou supprimée automatiquement
- **AND** les deux variantes restent visibles dans le diagnostic
