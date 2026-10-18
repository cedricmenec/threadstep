# Spec Delta

## ADDED Requirements

### Requirement: Visibility, permissions and destination context in recovery

Le diagnostic et l'inventaire de récupération SHALL exposer le type d'espace, l'URL normalisée, le `remoteDbId` disponible, une catégorie de session et la disponibilité des droits/realms, sans email, OTP, token ni contenu métier. Une référence invisible faute de droit MUST NOT être assimilée à une suppression. Un plan de réparation SHALL être lié au compte, à l'URL et à la base distante affichés.

#### Scenario: Invisible reference keeps its permission context
- **GIVEN** une session authentifiée dont les droits ou realms peuvent masquer un sujet
- **WHEN** une tâche référence ce sujet sans le trouver localement
- **THEN** le diagnostic indique une visibilité ou une autorisation indéterminée
- **AND** il ne présente pas le sujet comme supprimé
- **AND** aucun sujet fictif n'est créé pour réparer la référence

#### Scenario: Diagnostic shows instance context without personal data
- **WHEN** l'inventaire ou le diagnostic de récupération est affiché
- **THEN** il distingue l'espace local de l'espace synchronisé
- **AND** il affiche l'URL normalisée et le `remoteDbId` lorsqu'ils sont disponibles
- **AND** il n'affiche ni email, ni OTP, ni token, ni titre, ni note

#### Scenario: Account or base change invalidates recovery consent
- **WHEN** l'utilisateur, l'URL Cloud, le `remoteDbId`, les droits ou les realms changent après la prévisualisation
- **THEN** le plan de réparation est invalidé
- **AND** aucune donnée n'est réparée ou copiée vers la nouvelle identité
- **AND** les anciennes données restent intactes

#### Scenario: Recovery events stay free of personal content
- **WHEN** un événement de récupération, d'ambiguité ou de rejet est produit
- **THEN** il expose un code et un compte
- **AND** il ne contient aucun titre, note, email, OTP, token ou secret
- **AND** il n'est pas publié dans un journal public avec des identifiants privés
