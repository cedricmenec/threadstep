# Spec Delta

## ADDED Requirements

### Requirement: Suspended activation preserves destination and source

Un espace synchronisé activé SHALL pouvoir être suspendu sans être annulé ni
réinitialisé. La suspension MUST conserver l'enregistrement d'activation, l'URL,
le `remoteDbId` disponible, la liaison de compte, le cache synchronisé et la
source autonome. Elle MUST NOT transférer, purger ni déconnecter.

#### Scenario: Suspension after activation

- **GIVEN** un espace dont l'activation est terminée et la première synchronisation attestée
- **WHEN** l'utilisateur suspend Cloud
- **THEN** l'activation passe à l'état suspendu sans perte de destination
- **AND** la source autonome et le cache synchronisé restent récupérables
- **AND** aucune donnée n'est copiée entre les espaces
- **AND** aucune déconnexion ni suppression distante n'est demandée

#### Scenario: Resume does not repeat activation consent

- **GIVEN** un espace précédemment activé puis suspendu
- **WHEN** l'utilisateur reprend cet espace
- **THEN** la même base locale et la même destination sont rouvertes
- **AND** aucun nouvel assistant de transfert n'est requis
- **AND** aucun enregistrement de la source autonome n'est réinséré

### Requirement: Suspended workspace is not an implicit reset

Un espace suspendu MUST NOT être traité comme une configuration absente, une
annulation ou une purge. Au démarrage, l'espace autonome peut être présenté, mais
la destination suspendue SHALL rester sélectionnable et son cache MUST rester
attaché à son identité.

#### Scenario: Startup with a suspended workspace

- **GIVEN** un registre contenant un espace suspendu et un espace autonome
- **WHEN** l'application démarre
- **THEN** elle n'ouvre pas automatiquement la réplication Cloud suspendue
- **AND** elle ne supprime ni son cache, ni son URL, ni sa liaison
- **AND** l'espace suspendu reste proposé pour une reprise explicite

#### Scenario: Suspended workspace is distinct from cancellation

- **GIVEN** un enregistrement suspendu
- **WHEN** l'inventaire ou l'assistant affiche son statut
- **THEN** il est présenté comme suspendu, jamais comme annulé ou actif
- **AND** aucune consigne de réinitialisation ou de nouveau transfert n'est affichée
