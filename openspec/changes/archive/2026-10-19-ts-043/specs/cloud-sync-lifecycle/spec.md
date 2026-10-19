# Spec Delta

## ADDED Requirements

### Requirement: Dedicated read-only diagnostic page

La route `#/parametres/synchronisation` SHALL afficher en lecture seule une
synthèse et le diagnostic natif complet. Elle MUST réutiliser les signaux et
abonnements existants et MUST NOT ouvrir d'instance Cloud, demander un OTP,
envoyer une requête, lancer un pull ou exposer un secret, un email, un OTP, un
token ou un contenu métier.

#### Scenario: Local workspace without configuration or network

- **GIVEN** aucun espace Cloud n'est configuré et le navigateur est hors ligne
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** la page indique clairement « Cloud non configuré » et « local uniquement »
- **AND** la session, la connexion, le pull initial et les écritures locales sont présentés comme non applicables sans inventer d'état distant
- **AND** aucune instance Cloud n'est construite ou ouverte, aucun OTP n'est demandé et aucune requête réseau n'est envoyée
- **AND** le bouton de relance reste désactivé avec une raison compréhensible

#### Scenario: Configured diagnostic exposes every native dimension

- **GIVEN** une base Dexie Cloud configurée et une session disponible
- **WHEN** l'utilisateur consulte `#/parametres/synchronisation`
- **THEN** la synthèse et le diagnostic affichent séparément la session, la connexion, la phase native, le cache ou la base locale effective, le pull initial, les écritures locales, les erreurs classées et la preuve distante disponible
- **AND** l'absence de preuve distante reste « non déterminée » et n'est jamais présentée comme une base distante vide
- **AND** aucun email, OTP, token, message d'erreur brut, titre ou note n'est affiché

#### Scenario: Diagnostic page contains no moved sensitive control

- **WHEN** `#/parametres/synchronisation` est affiché
- **THEN** les emplacements « Configuration », « Première activation », « Connexion » et « Espaces de travail » sont descriptifs
- **AND** aucun formulaire, champ, sélection ou bouton appartenant à ces parcours n'y est déplacé, dupliqué ou activé
- **AND** l'ouverture de la page ne déclenche ni activation, ni OTP, ni connexion, ni sélection d'espace, ni purge

#### Scenario: Diagnostics update from the same native events

- **WHEN** `currentUser`, `syncState` ou `persistedSyncState` émet un nouvel état alors que la page est ouverte
- **THEN** la synthèse et le diagnostic de la page reflètent le nouvel état
- **AND** ils ne conservent pas un libellé antérieur devenu faux
- **AND** aucun nouvel abonnement n'est installé par la seule navigation vers cette page

#### Scenario: Accessible status and retry guards are preserved

- **WHEN** la page de diagnostic est affichée sur un appareil mobile ou au clavier
- **THEN** les messages d'état et les erreurs conservent leur zone `aria-live`
- **AND** le bouton de relance conserve son nom accessible, sa raison de désactivation et ses préconditions existantes
- **AND** seule son activation explicite peut lancer le pull natif, jamais l'ouverture ou la fermeture de la route

### Requirement: Overview synchronization attention summary

La vue `#/` SHALL afficher un résumé de synchronisation non interactif lorsqu'un
état Cloud configuré nécessite une attention ou qu'une erreur locale existe. Le
résumé MUST rester masqué pour un local non configuré sain et pour une
synchronisation configurée entièrement en phase, et MUST NOT proposer de
relance.

#### Scenario: Attention state remains visible on the overview

- **GIVEN** un espace Cloud configuré présente une erreur, une session absente ou expirée, une connexion hors ligne, un pull initial en attente ou en échec, ou une écriture locale en attente
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** un résumé minimal indique la session, la connexion, la phase et le statut ou l'erreur disponible
- **AND** il est annoncé via une zone de statut non interactive
- **AND** il ne contient aucune action, aucun bouton de relance et aucun secret ni contenu métier

#### Scenario: Healthy overview has no synchronization clutter

- **GIVEN** aucun espace Cloud n'est configuré et aucune erreur locale n'existe, ou un espace configuré est entièrement en phase
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** le résumé d'attention est masqué
- **AND** la page de diagnostic dédiée reste accessible depuis les paramètres
- **AND** aucune synchronisation, connexion ou requête n'est déclenchée pour afficher l'accueil

#### Scenario: Local read or write error stays visible

- **GIVEN** un espace local sans configuration Cloud présente une erreur de lecture ou d'écriture locale
- **WHEN** la vue Mes projets `#/` est affichée
- **THEN** le résumé d'attention signale l'erreur locale
- **AND** il ne présente pas cet échec comme une erreur réseau ou une base distante vide
- **AND** aucune ouverture d'instance Cloud n'est effectuée pour produire ce résumé

#### Scenario: Summary and page never claim an unproven remote state

- **WHEN** un résumé ou une synthèse est produit depuis des signaux absents, en attente ou contradictoires
- **THEN** l'état distant reste indéterminé ou explicitement non vérifié
- **AND** aucune présence d'enregistrements distants n'est inventée
- **AND** aucun import, consentement, transfert ou pull automatique n'est déclenché
