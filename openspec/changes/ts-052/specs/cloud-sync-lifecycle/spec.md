# Spec Delta

## MODIFIED Requirements

### Requirement: Overview synchronization attention summary

La vue `#/` SHALL afficher un résumé de synchronisation non interactif
uniquement lorsqu'une erreur confirmée de lecture ou d'écriture, une session
nécessitant une reconnexion, un blocage de liaison ou une attente durablement
non résolue empêche ou dégrade l'accès aux projets. Le résumé MUST rester masqué
pendant les transitions ordinaires `loading`, `connecting`, `initial` et pull
initial en attente, pour un local non configuré sain, pour une synchronisation
entièrement en phase et lorsque les projets restent consultables sous la
liaison autorisée. Il MUST NOT proposer de relance. Un lien distinct vers
`#/parametres/synchronisation` SHALL suivre les mêmes déclencheurs.

#### Scenario: Attention state remains visible on the overview

- **GIVEN** un espace configuré présente une erreur confirmée de lecture ou de stockage, une session expirée ou refusée nécessitant une reconnexion, une liaison de compte bloquée ou une attente durablement non résolue
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** un résumé minimal indique la catégorie d'état et la prochaine action sûre
- **AND** il est annoncé via une zone de statut non interactive
- **AND** le résumé lui-même ne contient aucune action et aucun bouton de relance
- **AND** un lien distinct vers `#/parametres/synchronisation` est visible et n'exécute aucune action Cloud
- **AND** il ne présente ni base distante vide, ni perte de données, ni synchronisation réussie sans preuve

#### Scenario: Ordinary initialization remains silent

- **GIVEN** un espace Cloud configuré traverse une restauration saine
- **WHEN** la session est `loading`, la connexion `connecting`, la phase `initial` ou le pull initial en attente sans erreur confirmée
- **THEN** le résumé d'attention et le lien d'accès Cloud restent masqués
- **AND** les calculs et abonnements natifs continuent en arrière-plan
- **AND** aucune annonce accessible ne clignote entre des états temporaires

#### Scenario: Available projects are not hidden by background synchronization

- **GIVEN** les projets sont consultables sous la liaison autorisée courante
- **WHEN** une synchronisation de fond change transitoirement la phase native
- **THEN** la liste reste affichée sans résumé d'attention ni chargement qui la remplace
- **AND** les états de focus, de défilement et de groupes développés restent stables
- **AND** aucun succès distant non prouvé n'est annoncé

#### Scenario: Healthy overview has no synchronization clutter

- **GIVEN** aucun espace Cloud n'est configuré et aucune erreur locale n'existe, ou un espace configuré est entièrement en phase et les projets sont disponibles
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** le résumé d'attention et le lien d'accès Cloud sont masqués
- **AND** la page de diagnostic dédiée reste accessible depuis les paramètres
- **AND** aucune synchronisation, connexion ou requête n'est déclenchée pour afficher l'accueil

#### Scenario: Local read or write error stays visible

- **GIVEN** un espace local sans configuration Cloud présente une erreur confirmée de lecture ou d'écriture locale
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** le résumé d'attention signale l'erreur locale
- **AND** il ne présente pas cet échec comme une erreur réseau ou une base distante vide
- **AND** aucune ouverture d'instance Cloud n'est effectuée pour produire ce résumé

#### Scenario: Durable wait is explained instead of spinning forever

- **GIVEN** une lecture métier autorisée reste non résolue au-delà du seuil déterministe d'attente durable
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** un résumé persistant explique que le chargement se prolonge et indique la prochaine action sûre
- **AND** le lien vers `#/parametres/synchronisation` est visible
- **AND** aucune lecture, preuve distante ou autorisation supplémentaire n'est inventée

#### Scenario: Summary and page never claim an unproven remote state

- **WHEN** un résumé ou une synthèse est produit depuis des signaux absents, en attente ou contradictoires
- **THEN** l'état distant reste indéterminé ou explicitement non vérifié
- **AND** aucune présence d'enregistrements distants n'est inventée
- **AND** aucun import, consentement, transfert ou pull automatique n'est déclenché
