# Spec Delta

## MODIFIED Requirements

### Requirement: Contextual access from the projects overview

La vue Mes projets SHALL proposer un lien non destructif vers
`#/parametres/synchronisation` uniquement lorsqu'une erreur confirmée, une
session nécessitant une reconnexion, un blocage de liaison ou une attente
durablement non résolue demande une action. Le lien MUST rester masqué pendant
les transitions ordinaires de restauration ou lorsqu'une synchronisation de fond
laisse les projets consultables. Le résumé de synchronisation MUST rester non
interactif et aucune action Cloud ne MUST être déclenchée par son affichage.

#### Scenario: Action required exposes a settings link

- **GIVEN** un espace Cloud configuré présente une erreur confirmée de lecture ou de stockage, une session expirée ou refusée nécessitant une reconnexion, une liaison de compte bloquée ou une attente durablement non résolue
- **WHEN** Mes projets est affiché
- **THEN** un lien libellé en français vers `#/parametres/synchronisation` est visible
- **AND** il est atteignable au clavier et au toucher
- **AND** son activation ouvre la page de synchronisation sans lancer d'OTP, de pull, de transfert ou de purge

#### Scenario: Ordinary initialization exposes no settings alert link

- **GIVEN** un espace Cloud configuré traverse une restauration saine
- **WHEN** la session est `loading`, la connexion `connecting`, la phase `initial` ou le pull initial en attente sans erreur confirmée
- **THEN** le lien d'accès contextuel et le résumé d'attention restent masqués
- **AND** les projets apparaissent dès que leur lecture autorisée est achevée
- **AND** aucun événement natif transitoire ne fait clignoter le lien

#### Scenario: Healthy local overview has no Cloud link

- **GIVEN** aucun espace Cloud n'est configuré et aucune erreur locale n'existe
- **WHEN** Mes projets est affiché
- **THEN** le résumé d'attention et le lien Cloud sont masqués
- **AND** la page de synchronisation reste accessible depuis le menu
- **AND** aucune ouverture d'instance Cloud n'est effectuée pour produire cet affichage

#### Scenario: Available projects with background sync keep no alert link

- **GIVEN** les projets sont consultables sous la liaison autorisée courante
- **WHEN** une synchronisation de fond change transitoirement la phase native
- **THEN** le lien contextuel et le résumé d'attention restent masqués
- **AND** la liste n'est ni masquée ni remplacée par un chargement
- **AND** aucune action Cloud n'est déclenchée

#### Scenario: Summary stays non-interactive

- **WHEN** le résumé d'attention de Mes projets est visible
- **THEN** il reste une zone de statut non interactive sans bouton de relance
- **AND** il ne contient aucun secret, OTP, token ni contenu métier
- **AND** le lien d'accès est un élément distinct qui ne propose aucune relance ni mutation
