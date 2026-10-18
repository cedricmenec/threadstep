# Spec Delta

## MODIFIED Requirements

### Requirement: ThreadStep starts from local Dexie
ThreadStep SHALL present its business features on an autonomous local IndexedDB/Dexie workspace from first use without a Cloud URL, OTP or network. Opening that workspace MUST NOT construct or configure a synchronized instance. The initial transition from `threadstep.document.v1` SHALL preserve the historical document and SHALL remain distinct from any remote transmission or automatic conversion.
#### Scenario: First launch after legacy localStorage
- **GIVEN** un document V1 valide avec 5 sujets et 18 étapes sur ce navigateur
- **WHEN** la nouvelle application locale démarre
- **THEN** l'espace local IndexedDB est ouvert sans conversion automatique
- **AND** le contenu historique reste lisible et exportable
- **AND** aucun enregistrement n'est envoyé à Dexie Cloud
- **AND** la conversion vers IndexedDB reste une opération explicite distincte
#### Scenario: No local historical document
- **WHEN** aucun `threadstep.document.v1` valide n'existe
- **THEN** ThreadStep ouvre son espace local IndexedDB vide
- **AND** les sujets peuvent être créés sans configuration Cloud
#### Scenario: Business view without a Cloud identity
- **GIVEN** aucune URL Cloud ni session Cloud n'existe
- **WHEN** l'utilisateur ouvre ThreadStep
- **THEN** les sujets, étapes et exports restent accessibles
- **AND** aucun OTP, email ou identité Cloud n'est requis
#### Scenario: Explicit local conversion is offered in local mode
- **GIVEN** un document V1 valide et aucune configuration Cloud active
- **WHEN** l'utilisateur ouvre la prévisualisation de conversion locale
- **THEN** il voit la destination locale, les comptes source et cible et les insertions prévues
- **AND** il peut confirmer ou refuser sans OTP ni URL Cloud
- **AND** la conversion ne construit aucune instance synchronisée

## ADDED Requirements

### Requirement: ThreadStep historical V1 local conversion
ThreadStep SHALL convert a validated V1 document into its own local Dexie workspace only after an explicit local review and consent, preserving subjects, steps, substeps, relations, order, notes, priorities, `done` and the resume preference. The historical source and its JSON export MUST remain available, and the conversion MUST NOT create, configure or push to a Dexie Cloud instance.
#### Scenario: Five subjects and eighteen steps survive reload
- **GIVEN** un document V1 valide de 5 sujets et 18 étapes
- **WHEN** la conversion locale est confirmée puis l'application rechargée sans Cloud
- **THEN** les 5 sujets, les 18 étapes, les sous-étapes et leurs relations sont présents dans l'espace local
- **AND** la source `threadstep.document.v1` et son export de secours sont inchangés
- **AND** aucune instance Cloud, aucun OTP et aucun push n'ont été créés
#### Scenario: Invalid, repeated or interrupted conversion is non-destructive
- **GIVEN** une cible locale vide, partiellement peuplée ou déjà convertie
- **WHEN** la conversion est relancée, reçoit un V1 invalide ou échoue dans sa transaction
- **THEN** aucune duplication ni aucun écrasement n'est produit
- **AND** la source reste lisible et exportable
- **AND** une reprise ultérieure reconnaît les enregistrements déjà convertis
#### Scenario: Business fields and resume tracking are preserved
- **GIVEN** une source V1 avec notes, priorités mixtes, états `done`, ordre et une préférence de reprise
- **WHEN** la conversion locale réussit
- **THEN** chaque note, priorité, état et ordre est conservé
- **AND** la préférence de reprise pointe vers la même étape convertie sans être synchronisée ni exportée
- **AND** les identifiants déjà convertis ne reçoivent pas un second préfixe `legacy:`
