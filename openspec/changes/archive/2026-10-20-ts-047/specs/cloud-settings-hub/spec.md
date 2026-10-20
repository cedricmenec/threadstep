# Spec Delta

## Purpose

Recomposer la page de synchronisation en une hiérarchie progressive en trois
questions, avec des panneaux métier repliables, sans dupliquer les contrôles ni
transformer la lecture ou la navigation en opération Cloud.

## MODIFIED Requirements

### Requirement: Single Cloud settings destination

L'application SHALL réunir sur `#/parametres/synchronisation` la configuration,
l'activation, la connexion, la gestion des espaces et le diagnostic. Chaque
contrôle existant MUST y apparaître une seule fois avec son identifiant et son
handler d'origine. La page SHALL être organisée en trois questions successives :
« Où sont mes données ? », « Sont-elles synchronisées ? » et « Que puis-je faire
maintenant ? ». Le résumé de localisation et de synchronisation SHALL être
visible sans déplier le diagnostic technique. Les panneaux métier existants
SHALL rester accessibles dans des sections repliables, sans duplication et sans
opération déclenchée par la navigation.

#### Scenario: Every existing control appears once

- **GIVEN** l'application est chargée et la page `#/parametres/synchronisation` est affichée
- **THEN** `#cloud-config`, `#cloud-activation`, `#auth-panel` et `#workspace-panel` sont présents une seule fois
- **AND** ils sont contenus dans les sections « Configuration », « Première activation », « Connexion » et « Espaces de travail »
- **AND** `#sync-diagnostic` reste présent une seule fois sur la même page
- **AND** aucun de ces identifiants n'est dupliqué ailleurs dans le document

#### Scenario: Three questions lead the page

- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** les trois questions « Où sont mes données ? », « Sont-elles synchronisées ? » et « Que puis-je faire maintenant ? » structurent la page dans cet ordre
- **AND** le mode actif, le nom de la base locale et la destination Cloud éventuelle sont visibles avant tout diagnostic technique déplié
- **AND** les panneaux métier et le diagnostic technique restent accessibles sans duplication de contrôle

#### Scenario: Opening the page has no side effect

- **WHEN** l'utilisateur ouvre ou quitte `#/parametres/synchronisation`
- **THEN** aucune ouverture, réinitialisation ou reconfiguration de base n'est effectuée
- **AND** aucun OTP n'est demandé, aucune connexion ni sélection d'espace n'est lancée
- **AND** aucun transfert, consentement, pull, import, export ou purge n'est exécuté
- **AND** aucune requête réseau n'est déclenchée par la seule navigation

#### Scenario: Fresh local profile stays usable

- **GIVEN** un profil navigateur vierge sans URL Cloud configurée
- **WHEN** l'application démarre
- **THEN** Mes projets est affiché et utilisable sans OTP ni requête Cloud
- **AND** l'utilisateur peut ensuite ouvrir `#/parametres/synchronisation`
- **AND** la configuration HTTPS et l'onboarding y sont accessibles

## ADDED Requirements

### Requirement: Collapsible business panels preserve existing handlers

Les sections « Configuration », « Première activation », « Connexion » et
« Espaces de travail » SHALL être repliables au clavier et au toucher. Leur
ouverture ou fermeture MUST rester une opération de présentation : elle MUST NOT
ouvrir, reconnecter, soumettre, transférer, sélectionner, suspendre, déconnecter
ou purger quoi que ce soit. Chaque panneau MUST conserver le contrôle et le
handler existants, et une seule source de vérité pour son état en cours.

#### Scenario: Collapsing a panel changes only the presentation

- **GIVEN** une section métier est ouverte et contient un formulaire ou une erreur en cours
- **WHEN** l'utilisateur la replie puis la déplie
- **THEN** le formulaire, le statut et l'erreur sont conservés
- **AND** aucune requête, écriture, soumission ou sélection n'est déclenchée
- **AND** le focus reste utilisable au clavier

#### Scenario: Collapsed panels remain reachable

- **GIVEN** les sections métier sont repliées
- **WHEN** l'utilisateur parcourt la page au clavier ou au toucher
- **THEN** chaque section possède un titre et un contrôle d'ouverture accessibles
- **AND** les contrôles restent atteignables une seule fois après dépliage
- **AND** le diagnostic technique n'est pas dupliqué hors de sa section

### Requirement: Technical information stays secondary

Les identifiants techniques supplémentaires, les détails de bootstrap et les
messages classés SHALL être regroupés sous une rubrique « Informations
techniques » repliable, distincte du résumé de confiance. Leur lecture MUST NOT
être nécessaire pour identifier le mode, la base locale, la destination, la
session, la connexion ou la prochaine action sûre.

#### Scenario: First screen does not require the technical block

- **WHEN** la page est affichée sans déplier « Informations techniques »
- **THEN** le mode, le nom de la base locale, la destination éventuelle et l'état de synchronisation compréhensible sont visibles
- **AND** les identifiants techniques restent disponibles dans la rubrique repliée
- **AND** aucun élément métier ni secret n'est exposé dans l'un ou l'autre bloc
