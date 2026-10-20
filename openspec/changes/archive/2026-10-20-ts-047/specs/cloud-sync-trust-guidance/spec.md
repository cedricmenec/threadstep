# Spec Delta

## Purpose

Rendre la page de synchronisation compréhensible en quelques secondes : où sont
les données, quel niveau de synchronisation est réellement prouvé, et quelle
prochaine action est sûre — sans exposer de données métier ni déclencher
d'opération implicite.

## ADDED Requirements

### Requirement: Immediate trust summary and location

La page `#/parametres/synchronisation` SHALL afficher, avant tout diagnostic
technique déplié, le mode actif et le nom effectif de la base IndexedDB locale.
Pour un espace synchronisé, elle SHALL aussi montrer la destination, la session
et la connexion. Si la preuve distante manque, elle SHALL afficher « Données
Cloud temporairement masquées, non présumées perdues ». Les identifiants
techniques supplémentaires MUST rester sous « Informations techniques ».

#### Scenario: Local workspace summary

- **GIVEN** aucune URL Dexie Cloud n'est configurée et l'espace local est actif
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** le résumé affiche « Local uniquement, enregistré sur cet appareil »
- **AND** le nom effectif de la base IndexedDB locale est visible sans déplier les informations techniques
- **AND** aucune destination Cloud n'est inventée
- **AND** aucune instance Cloud, requête réseau ou demande d'OTP n'est créée par cet affichage

#### Scenario: Synchronized workspace summary

- **GIVEN** un espace synchronisé actif possède une base locale et une session connue
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** le résumé affiche « Copie locale IndexedDB reliée à Dexie Cloud »
- **AND** le nom effectif de la base locale est visible sans déplier les informations techniques
- **AND** l'URL normalisée de destination, le `remoteDbId` disponible, l'état de session et l'état de connexion sont visibles sans déplier les informations techniques
- **AND** les autres identifiants techniques restent sous « Informations techniques »

#### Scenario: Missing or blocked remote evidence

- **GIVEN** un espace synchronisé présente un cache non vérifié, un compte différent, une preuve distante absente ou un accès bloqué
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** le résumé affiche « Données Cloud temporairement masquées, non présumées perdues »
- **AND** le nom effectif de la base locale concernée reste visible
- **AND** l'interface ne présente pas cet état comme une base distante vide ni comme une perte de données
- **AND** aucune lecture métier, écriture, récupération ou purge n'est déclenchée

### Requirement: Separated synchronization evidence

La page SHALL présenter séparément les modifications enregistrées localement,
celles en attente ou d'état inconnu, et la synchronisation Cloud observée. Un
commit local MUST NOT être présenté comme distant, et `in-sync` seul MUST NOT
prouver toutes les données distantes ni un autre appareil. Aucun libellé global
« Tout est sauvegardé dans le Cloud » n'est produit sans preuve.

#### Scenario: Local save is distinct from cloud synchronization

- **GIVEN** une transaction IndexedDB locale a réussi et aucun signal natif n'atteste la propagation distante
- **WHEN** le résumé de confiance est affiché
- **THEN** « Modifications enregistrées sur cet appareil » reflète le succès local
- **AND** « Modifications en attente d'envoi » ou « état inconnu » reste distinct
- **AND** « Synchronisation Cloud observée » n'affirme pas un envoi réussi
- **AND** aucun libellé global de sauvegarde Cloud n'est affiché

#### Scenario: Pending and unknown uploads stay explicit

- **GIVEN** des écritures locales sont en attente ou leur état de transmission est inconnu
- **WHEN** le résumé de confiance est affiché
- **THEN** la section « Modifications en attente d'envoi » indique l'attente ou « état inconnu »
- **AND** elle ne présente pas ces modifications comme perdues ou synchronisées
- **AND** elle ne déduit pas la présence de toutes les données distantes du seul état `in-sync`

#### Scenario: Observed Cloud synchronization is labelled as observed

- **GIVEN** un signal natif de synchronisation a été observé pour l'espace courant
- **WHEN** le résumé affiche « Synchronisation Cloud observée »
- **THEN** il précise qu'il s'agit d'une observation sur cet appareil
- **AND** il n'affirme ni la complétude de la copie distante ni la convergence d'un autre appareil

### Requirement: Plain-language state explanations and safe next action

Pour chaque état natif ou blocage, la page SHALL expliquer la signification, les
données accessibles ou masquées, le risque, l'action sûre et les actions
interdites. Cette aide SHALL être accessible au clavier et au toucher, sans
exposer de secret ni de contenu métier. Les états couverts MUST inclure les
états d'onboarding, hors ligne, attente, permission, `UNVERIFIED`, `MISMATCH`,
erreur, cache historique et récupération isolée.

#### Scenario: Onboarding states are explained without jargon

- **GIVEN** l'état est « Cloud non configuré », « OTP requis », « activation non terminée » ou « pull initial en attente »
- **WHEN** l'aide contextuelle est ouverte
- **THEN** elle explique en langage courant ce que cela signifie
- **AND** elle indique quelles données restent consultables localement
- **AND** elle indique la prochaine action sûre et les actions à éviter
- **AND** elle ne déclenche ni connexion, ni pull, ni transfert

#### Scenario: Offline and pending states are actionable

- **GIVEN** le navigateur est hors ligne ou des modifications sont en attente d'envoi
- **WHEN** l'aide contextuelle est ouverte
- **THEN** elle explique que les données locales restent enregistrées sur cet appareil
- **AND** elle indique que l'envoi Cloud n'est pas confirmé et qu'aucune conclusion de perte n'est possible
- **AND** elle propose une action sûre, telle qu'attendre le réseau ou consulter les écritures en attente
- **AND** elle n'exécute aucune relance ni transfert automatique

#### Scenario: Permissions and errors are classified

- **GIVEN** une permission est refusée ou une erreur réseau, de stockage ou de synchronisation est présente
- **WHEN** l'aide contextuelle est ouverte
- **THEN** elle distingue la catégorie compréhensible de l'erreur
- **AND** elle indique les données conservées localement et celles qui restent inaccessibles
- **AND** elle propose une action sûre sans exposer de message serveur brut ni de donnée métier

#### Scenario: Unverified and mismatch caches are explained

- **GIVEN** l'état de liaison est `UNVERIFIED`, `MISMATCH` ou une base distante différente
- **WHEN** l'aide contextuelle est ouverte
- **THEN** elle explique pourquoi les données Cloud sont masquées
- **AND** elle précise que le cache local est conservé et non présumé perdu
- **AND** elle présente l'action de vérification ou de récupération autorisée
- **AND** elle interdit explicitement la purge, le transfert ou la réutilisation inter-comptes avant résolution

#### Scenario: Historical cache and isolated recovery are distinguished

- **GIVEN** un cache historique non vérifiable ou une récupération isolée existe
- **WHEN** l'aide contextuelle est ouverte
- **THEN** elle distingue le cache historique conservé de la récupération explicitement demandée
- **AND** elle indique les copies concernées et ce qui est conservé ou non
- **AND** elle ne présente pas la récupération comme une preuve de propagation distante

### Requirement: Conditional intent-based guidance

La page SHALL proposer une checklist conditionnelle pour cinq intentions :
rester en local, synchroniser, retrouver ses projets sur un nouvel appareil,
revenir au local et corriger un blocage. Elle SHALL distinguer lecture,
sélection, consentement, suspension, déconnexion, récupération et purge. Les
actions dangereuses MUST garder leurs confirmations existantes, et aucune
intention MUST modifier les données.

#### Scenario: Local intent explains how to stay put

- **GIVEN** l'utilisateur choisit « Je veux rester en local »
- **WHEN** la checklist est affichée
- **THEN** elle indique que les données restent dans la base IndexedDB locale nommée
- **AND** elle indique comment sauvegarder ou exporter sans envoyer de données
- **AND** elle ne propose aucune activation Cloud comme action implicite

#### Scenario: Synchronize-this-device intent follows existing activation

- **GIVEN** l'utilisateur choisit « Je veux synchroniser cet appareil »
- **WHEN** la checklist est affichée
- **THEN** elle présente, selon l'état, la configuration HTTPS, l'activation opt-in, l'OTP, le premier pull, la revue du plan et le consentement
- **AND** chaque étape renvoie au contrôle existant correspondant
- **AND** aucun transfert n'est déclenché par la sélection de l'intention

#### Scenario: New-device intent never promises automatic copy

- **GIVEN** l'utilisateur choisit « Je veux retrouver mes projets sur un nouvel appareil »
- **WHEN** la checklist est affichée
- **THEN** elle indique la même URL, l'authentification et l'attente de la première lecture distante
- **AND** elle précise qu'aucune copie automatique ni propagation vers un autre appareil n'est prouvée
- **AND** elle ne propose ni import implicite ni fusion automatique

#### Scenario: Return-to-local intent separates suspension, logout and purge

- **GIVEN** l'utilisateur choisit « Je veux revenir au local »
- **WHEN** la checklist est affichée
- **THEN** elle distingue la suspension Cloud, la déconnexion et la purge de la seule copie locale identifiée
- **AND** elle indique les copies concernées et ce qui est conservé ou supprimé
- **AND** chaque action destructive reste derrière sa confirmation et sa sauvegarde préalable existantes
- **AND** l'ouverture de la checklist ne suspend, ne déconnecte et ne purge rien

#### Scenario: Fix-a-blockage intent stays safe

- **GIVEN** l'utilisateur choisit « Je veux corriger un blocage »
- **WHEN** la checklist est affichée
- **THEN** elle affiche la cause compréhensible, l'action sûre et les actions interdites pour l'état courant
- **AND** elle renvoie au diagnostic technique détaillé pour les cas avancés
- **AND** elle ne relance pas de pull, ne se connecte pas et ne récupère aucun cache sans action explicite ultérieure

#### Scenario: Guidance is read-only and reuses existing controls

- **GIVEN** une intention ou une aide est affichée
- **WHEN** l'utilisateur la consulte ou navigue dans la page
- **THEN** aucune donnée, aucun consentement, aucun statut natif ni aucune base n'est modifié
- **AND** chaque action proposée utilise le contrôle et le handler existants
- **AND** aucun formulaire, bouton ou handler n'est dupliqué

### Requirement: Explicit empty, masked and degraded states

La page SHALL afficher un état explicite et non trompeur lorsque la base locale
est vide, que le cache Cloud est masqué, que le compte est différent, que la
preuve distante est inconnue, que le stockage échoue ou que l'accès réseau est
interrompu. Une liste de projets vide MUST NOT être interprétée comme une preuve
que la cible Cloud est vide.

#### Scenario: Empty local list does not prove an empty Cloud

- **GIVEN** la base locale active ne contient aucun projet
- **WHEN** la page de synchronisation ou le résumé de confiance est affiché
- **THEN** l'état indique que la base locale est vide sur cet appareil
- **AND** il précise que l'état de la cible Cloud reste inconnu ou non vérifié si aucune preuve n'existe
- **AND** il ne conclut pas que le Cloud est vide

#### Scenario: Masked cache states retained data

- **GIVEN** le cache Cloud est masqué pour un compte différent ou une preuve absente
- **WHEN** le résumé est affiché
- **THEN** il indique que des données peuvent être conservées mais non affichées
- **AND** il ne présente pas le cache comme supprimé
- **AND** il rappelle l'action sûre et l'interdiction de purge avant résolution

#### Scenario: Storage or network interruption

- **GIVEN** une erreur de stockage ou une interruption réseau survient
- **WHEN** la page affiche le résumé
- **THEN** elle indique la catégorie de panne et les données restant accessibles
- **AND** elle ne déduit ni perte locale, ni base distante vide, ni synchronisation réussie
- **AND** aucune opération destructive n'est proposée comme action immédiate

### Requirement: Accessible compact trust presentation

La présentation SHALL rester compacte et utilisable sur un écran de 320 px, au
clavier, au toucher et avec un lecteur d'écran. Les aides contextuelles SHALL
être opérables par Entrée ou Espace, avec un nom accessible et un état
`aria-expanded` à jour. Les statuts MUST être compréhensibles sans dépendre de la
couleur. Les changements d'état SHALL être annoncés dans une zone `aria-live`
pertinente sans surcharge ni duplication de contenu.

#### Scenario: Keyboard-operable contextual help

- **GIVEN** une aide « Pourquoi ? » ou « En savoir plus » est affichée
- **WHEN** l'utilisateur la focalise puis active Entrée ou Espace
- **THEN** l'aide s'ouvre ou se ferme avec un état `aria-expanded` correct
- **AND** le focus reste dans un ordre logique
- **AND** aucune action métier ou Cloud n'est déclenchée

#### Scenario: Status is not conveyed by color alone

- **GIVEN** un état est affiché comme sûr, en attente, masqué ou en erreur
- **WHEN** la couleur est ignorée
- **THEN** un texte explicite porte la même information
- **AND** les contrastes et l'état désactivé restent identifiables

#### Scenario: Mobile compact layout

- **GIVEN** la page est affichée sur un écran de 320 px
- **WHEN** le résumé et les sections repliables sont affichés
- **THEN** le contenu ne déborde pas horizontalement
- **AND** les commandes tactiles principales atteignent une cible d'au moins 44 px
- **AND** le diagnostic technique reste disponible sans surcharger le premier écran
