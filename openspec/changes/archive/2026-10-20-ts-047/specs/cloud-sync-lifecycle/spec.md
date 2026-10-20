# Spec Delta

## Purpose

Ajouter une observation de dernière synchronisation honnête, attribuée au bon
espace et à la bonne session, sans prendre un horodatage interne non contractuel
pour une preuve de synchronisation globale ni pour une vérification sur un autre
appareil.

## ADDED Requirements

### Requirement: Attributed last synchronization observation

L'application SHALL afficher une date de dernière synchronisation uniquement si
un événement natif de réussite est attribuable à la session, l'URL, l'espace
local et la base distante courants. L'observation SHALL être passive, cloisonnée
par workspace et étiquetée par sa provenance et sa portée. Sans attribution,
l'interface MUST afficher « Date non disponible », jamais l'heure courante.

#### Scenario: Attributable native success records the observation

- **GIVEN** une session authentifiée pour l'espace courant, une URL normalisée, un nom de base locale, un `remoteDbId` et une liaison de compte concordants
- **WHEN** un événement natif de synchronisation réussie est observé pendant que la phase native est `in-sync` et que le pull initial est attesté
- **THEN** l'application peut enregistrer passivement l'instant de cet événement pour ce workspace
- **AND** l'interface affiche cette date avec la provenance « événement Cloud observé sur cet appareil »
- **AND** elle précise que cette observation ne prouve ni l'intégralité de la copie distante ni la convergence d'un autre appareil
- **AND** aucune donnée métier, email, OTP, token ni `userId` brut n'est enregistré ou affiché

#### Scenario: Missing attribution shows Date non disponible

- **GIVEN** aucun événement natif de réussite attribuable n'a été observé, ou la preuve est absente ou contradictoire
- **WHEN** la page affiche la dernière synchronisation
- **THEN** elle affiche exactement « Date non disponible »
- **AND** elle n'affiche pas l'heure courante ni l'heure de chargement
- **AND** elle n'utilise pas un champ natif non validé comme date de synchronisation
- **AND** elle ne présente pas cette absence de date comme une perte de données

#### Scenario: Late event after an account or URL change records nothing

- **GIVEN** un événement natif de synchronisation était en cours pour un espace, une URL ou un compte précédents
- **WHEN** l'utilisateur a changé de workspace, d'URL ou de compte avant que l'événement ne soit traité
- **THEN** l'observation n'est pas enregistrée pour le nouvel espace
- **AND** aucune date de l'ancien espace n'est affichée pour le nouveau
- **AND** aucune écriture, récupération ou sélection n'est déclenchée par cet événement tardif

#### Scenario: Reload preserves only a matching observation

- **GIVEN** une observation horodatée a été enregistrée pour un workspace donné
- **WHEN** la page est rechargée avec la même session, la même URL, la même base locale et la même base distante
- **THEN** la date observée peut être réaffichée avec la même provenance et la même portée
- **WHEN** le compte, l'URL, la base locale ou la base distante ne concordent plus
- **THEN** la date n'est pas affichée et « Date non disponible » est présenté
- **AND** l'observation de l'ancien workspace reste cloisonnée et n'est pas réutilisée pour le nouveau

#### Scenario: Local save, cloud event and other-device verification stay distinct

- **GIVEN** des modifications ont été enregistrées localement et un événement Cloud a été observé sur cet appareil
- **WHEN** la synthèse est affichée
- **THEN** « dernière sauvegarde locale » décrit uniquement le commit sur cet appareil
- **AND** « dernier événement Cloud observé » porte l'horodatage attribué et sa portée locale
- **AND** « vérification sur un autre appareil » reste explicitement non vérifiée
- **AND** aucun niveau n'est présenté comme la preuve des autres

#### Scenario: Passive observation never blocks or mutates business data

- **GIVEN** un événement natif attribuable est observé
- **WHEN** l'observation locale est enregistrée ou échoue
- **THEN** aucune transaction métier, aucun consentement et aucune configuration ne sont modifiés
- **AND** un échec d'enregistrement de l'observation n'empêche pas la synchronisation native et affiche « Date non disponible »
- **AND** l'observation n'est écrite dans aucune table synchronisée
