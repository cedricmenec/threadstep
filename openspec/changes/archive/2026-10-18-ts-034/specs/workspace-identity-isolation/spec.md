# Spec Delta

## MODIFIED Requirements

### Requirement: Operational safety and diagnostics

Les diagnostics et journaux SHALL permettre d'identifier espace, URL normalisée, session, phase et erreurs techniques sans divulguer le contenu métier ni des secrets. Les données de test MUST rester séparées des données personnelles. Le diagnostic SHALL se mettre à jour lors d'un changement de session, d'URL ou de base distante.

#### Scenario: Diagnostic report

- **WHEN** un incident de connexion est étudié
- **THEN** des états natifs observables et une catégorie d'erreur peuvent être transmis
- **AND** aucun OTP, token, email ou texte métier n'est nécessaire dans le journal exportable

#### Scenario: Isolated end-to-end acceptance

- **WHEN** les tests simulent une purge, deux comptes ou un changement d'URL
- **THEN** ils ciblent des bases de test isolées et une origine autorisée
- **AND** aucune donnée de production n'est effacée

#### Scenario: Session or URL change updates the diagnostic

- **GIVEN** un diagnostic affichant une session et une URL données
- **WHEN** la session change ou une autre URL Dexie Cloud est enregistrée
- **THEN** le diagnostic affiche la nouvelle session et la nouvelle URL normalisée
- **AND** il signale une incohérence si la base distante persistée ne correspond plus
- **AND** aucune donnée de l'ancien espace n'est copiée ou exposée

#### Scenario: No personal or secret data in the diagnostic

- **WHEN** une session authentifiée affiche le diagnostic
- **THEN** le diagnostic ne contient ni email, ni OTP, ni token, ni titre, ni note, ni message d'erreur brut
- **AND** il ne contient aucun identifiant utilisateur réversible ou secret
- **AND** seule une catégorie de session et la base configurée sont exposées
