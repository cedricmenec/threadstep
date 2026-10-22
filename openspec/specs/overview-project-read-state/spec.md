# overview-project-read-state Specification

## Purpose

Définir ce que Mes projets montre pendant l'initialisation, la lecture métier
autorisée, la disponibilité des projets et les incidents, afin d'éviter les
clignotements, les fausses listes vides et les annonces accessibles oscillantes.

## Requirements

### Requirement: Explicit overview presentation states

La vue `#/` SHALL distinguer quatre états observables : initialisation
transitoire, lecture métier autorisée en attente, projets disponibles et
incident ou action requise. La disponibilité des projets SHALL provenir de la
lecture métier autorisée et de son achèvement, jamais du seul état natif
`in-sync`, d'un délai écoulé ou d'une preuve distante.

#### Scenario: Healthy reload stays silent

- **GIVEN** une session Cloud saine et une liaison de compte autorisée
- **WHEN** un rechargement traverse `loading`, `connecting`, `initial` puis `in-sync` pendant que la lecture locale se termine
- **THEN** aucun résumé d'attention ni lien d'alerte n'apparaît pendant ces transitions ordinaires
- **AND** la liste des projets apparaît dès que la lecture métier autorisée est achevée
- **AND** aucune annonce accessible n'alterne entre des états temporaires

#### Scenario: In-sync alone does not prove projects are available

- **GIVEN** l'état natif est `in-sync` et le pull initial est terminé
- **WHEN** la lecture métier autorisée n'est pas encore achevée
- **THEN** l'écran ne présente ni liste vide, ni `0 projet`, ni suggestion vide
- **AND** il affiche l'état de lecture en attente prévu par la spécification
- **AND** il ne déclare pas les projets disponibles

#### Scenario: Authorized local workspace reads before showing projects

- **GIVEN** aucun espace Cloud n'est configuré et l'espace local autonome est actif
- **WHEN** la lecture IndexedDB locale est encore en cours
- **THEN** l'interface n'affirme pas que la liste est vide
- **AND** elle présente l'état de lecture prévu puis la liste réelle à la fin de la lecture

### Requirement: Stable pending-read placeholder

Lorsqu'une lecture métier réellement nécessaire empêche d'afficher les projets,
la vue `#/` SHALL afficher un composant compact et stable « Chargement de vos
projets… » dans l'emplacement de la liste. Le composant SHALL utiliser
`role="status"` et `aria-busy` de manière cohérente, et l'interface MUST NOT
afficher transitoirement une liste vide, un compteur nul ou une suggestion vide.

#### Scenario: Blocking read shows a stable placeholder

- **GIVEN** une lecture métier autorisée est nécessaire et n'est pas terminée
- **WHEN** la vue Mes projets est affichée
- **THEN** un chargement compact et stable occupe l'emplacement de la liste
- **AND** il est exposé comme un statut accessible et signalé comme occupé
- **AND** aucune liste vide, aucun `0 projet` et aucune suggestion vide ne sont présentés
- **WHEN** la lecture aboutit
- **THEN** les projets remplacent le chargement sans passer par une liste vide fictive
- **AND** la hauteur, le focus et le défilement ne subissent pas de saut évitable

#### Scenario: Fast read does not flash a placeholder

- **GIVEN** une lecture métier autorisée se termine avant le seuil de présentation retenu
- **WHEN** les projets deviennent disponibles
- **THEN** aucun chargement n'est affiché ou annoncé transitoirement
- **AND** la liste réelle est présentée directement

### Requirement: Available projects remain stable during background sync

Une fois les projets consultables sous la liaison actuellement autorisée, la
vue `#/` SHALL les conserver pendant une synchronisation de fond ou un
changement transitoire de phase Dexie. Elle MUST NOT les masquer, les démonter
ou provoquer un défilement à cause de ces seuls signaux.

#### Scenario: Background pull leaves the list in place

- **GIVEN** les projets sont affichés sous la liaison autorisée courante
- **WHEN** Dexie Cloud passe par `pulling`, `pushing`, `not-in-sync` ou `initial` en arrière-plan
- **THEN** la liste reste affichée sans animation de chargement qui la remplace
- **AND** les groupes développés, le focus pertinent et l'ancrage de défilement sont conservés
- **AND** aucun compteur ni message vide n'est affiché pendant le pull

#### Scenario: Available projects are not replaced by a diagnostic flash

- **GIVEN** les projets sont consultables et aucune erreur confirmée n'existe
- **WHEN** un signal natif transitoire est reçu
- **THEN** aucun bandeau d'attention ni lien d'alerte n'apparaît
- **AND** le diagnostic natif continue d'être calculé sans modifier la liste

### Requirement: Confirmed incidents and durable waits are actionable

La vue `#/` SHALL réserver le résumé d'attention et le lien vers
`#/parametres/synchronisation` aux erreurs confirmées de lecture ou de stockage,
aux sessions nécessitant une reconnexion, aux blocages de liaison et aux
attentes durablement non résolues. L'aide SHALL être concise, persistante,
non trompeuse et proposer une prochaine action sûre.

#### Scenario: Confirmed error is shown immediately

- **GIVEN** une erreur confirmée de lecture ou de stockage empêche l'affichage fiable des projets
- **WHEN** l'erreur est connue
- **THEN** une explication visible et stable apparaît sans attendre la temporisation de présentation
- **AND** elle indique la prochaine action sûre et renvoie vers Paramètres > Synchronisation
- **AND** elle ne présente ni perte de données, ni base distante vide, ni synchronisation réussie

#### Scenario: Session or binding requires an action

- **GIVEN** un espace Cloud configuré présente une session expirée ou refusée nécessitant une reconnexion, ou une liaison de compte non vérifiée ou incompatible
- **WHEN** la vue Mes projets est affichée
- **THEN** une explication persistante décrit le blocage et l'action sûre
- **AND** le lien vers Paramètres > Synchronisation reste visible
- **AND** aucune donnée d'un autre compte ni d'un cache non vérifié n'est affichée

#### Scenario: Durable wait replaces an indefinite loader

- **GIVEN** une lecture métier autorisée reste en attente au-delà du seuil déterministe d'attente durable
- **WHEN** aucun résultat ni erreur n'est encore disponible
- **THEN** une explication persistante indique que le chargement se prolonge et propose de consulter Paramètres > Synchronisation
- **AND** le chargement ne tourne pas indéfiniment sans explication
- **AND** aucune lecture supplémentaire, preuve distante ou autorisation n'est inventée

#### Scenario: Healthy local workspace has no attention surface

- **GIVEN** aucun espace Cloud n'est configuré, aucune erreur locale n'existe et la lecture locale a réussi
- **WHEN** la vue Mes projets est affichée
- **THEN** le résumé d'attention et le lien Cloud sont masqués
- **AND** la page de synchronisation reste accessible depuis les paramètres

### Requirement: Presentation-only timing and cancellation

Toute temporisation introduite SHALL être exclusivement de présentation, bornée
et déterministe. Elle SHALL être annulée et nettoyée lors d'une résolution, d'un
changement d'espace ou de liaison, d'un changement de route ou d'un
rechargement. Elle MUST NOT autoriser une lecture, fabriquer une preuve distante
ou retarder l'affichage d'une erreur confirmée.

#### Scenario: Resolution cancels the delayed placeholder

- **GIVEN** une lecture en attente a démarré une temporisation de présentation
- **WHEN** la lecture aboutit, échoue, change d'espace ou change de route avant le seuil
- **THEN** la temporisation est annulée et nettoyée
- **AND** aucun chargement ou message différé ne s'affiche sur l'état suivant
- **AND** une erreur confirmée est affichée sans attendre le seuil

#### Scenario: Delayed callback cannot restore stale UI

- **GIVEN** une temporisation a été planifiée pour un espace ou une route donnés
- **WHEN** l'utilisateur change d'espace, de compte ou de route avant son échéance
- **THEN** le callback échu ne modifie pas la nouvelle vue
- **AND** l'isolation de l'ancien espace reste effective
- **AND** aucune donnée, aucun statut natif et aucune preuve distante de l'espace précédent ne sont réutilisés

### Requirement: Isolation and absence of hidden side effects

La présentation de Mes projets SHALL préserver les frontières de
`applyBusinessVisibility()`, l'isolation des comptes et des bases IndexedDB, la
non-destruction et la distinction entre preuve native et lecture métier. Elle
MUST NOT déclencher de synchronisation, d'écriture, de purge, de reconnexion,
d'OTP, de requête réseau ou de lecture supplémentaire.

#### Scenario: Account or base switch A to B stays isolated

- **GIVEN** l'espace A affichait des projets et l'utilisateur bascule vers un espace ou un compte B
- **WHEN** des événements natifs tardifs de A arrivent après la bascule
- **THEN** aucune donnée de A n'est affichée sous B
- **AND** B affiche son propre chargement, ses propres projets ou une action requise selon son état réel
- **AND** une liaison non autorisée conserve les restrictions métier existantes

#### Scenario: Offline and return preserve the same authorized view

- **GIVEN** des projets sont affichés sous une liaison autorisée et une session valide
- **WHEN** le navigateur passe hors ligne puis revient en ligne
- **THEN** la même liste reste affichée sans être remplacée par un faux état vide
- **AND** la preuve distante reste non affirmée
- **AND** aucune récupération, copie ou écriture implicite n'est déclenchée

#### Scenario: Presentation reads existing signals only

- **WHEN** l'état de présentation est calculé ou rendu
- **THEN** il réutilise les signaux de session, de liaison, de bootstrap et de lecture déjà disponibles
- **AND** il n'ajoute ni abonnement natif, ni pull, ni OTP, ni ouverture de base, ni mutation
- **AND** le diagnostic complet et les commandes de `#/parametres/synchronisation` restent inchangés

### Requirement: Accessible announcements remain stable

Les changements d'état de Mes projets SHALL être annoncés dans une zone de
statut pertinente sans répétition ni oscillation. Le chargement SHALL utiliser
`role="status"` et `aria-busy` de façon exacte, rester compatible avec
`prefers-reduced-motion`, le clavier et les lecteurs d'écran, et ne MUST pas
déplacer le focus ni le défilement de façon involontaire.

#### Scenario: Repeated evaluation does not duplicate announcements

- **GIVEN** l'état de présentation est recalculé plusieurs fois avec le même résultat
- **WHEN** la vue est rendue à nouveau
- **THEN** le texte de statut et les attributs accessibles restent identiques
- **AND** aucune annonce `aria-live` supplémentaire n'est produite pour un état inchangé
- **AND** le focus et le défilement restent stables

#### Scenario: Reduced motion and keyboard usage stay usable

- **GIVEN** l'utilisateur préfère réduire les animations ou navigue au clavier
- **WHEN** le chargement apparaît puis laisse place aux projets
- **THEN** aucune animation n'est nécessaire pour comprendre l'état
- **AND** le chargement n'est pas un piège de focus
- **AND** l'ordre de tabulation et le focus pertinent restent prévisibles
