# react-project-detail-pilot Specification

## Purpose

Valider le socle React existant sur une tranche représentative — le détail
d'un projet `#/sujet/:id` — sans changer l'interface, les données, la
persistance, la synchronisation ni la sécurité livrées, afin de produire une
décision GO / NO-GO documentée.

## Requirements

### Requirement: Rendu React exclusif du détail projet

Pour une route `#/sujet/:id` valide, chargée et autorisée, la vue détail et
ses tâches SHALL être rendues par une unique racine React possédant
exclusivement son sous-arbre DOM. Le renderer vanilla MUST NOT écrire dans ce
sous-arbre tant que la racine est active.

#### Scenario: Le détail est rendu par React

- **GIVEN** une route `#/sujet/:id` valide, une identité autorisée et un projet
  existant
- **WHEN** la vue détail est affichée
- **THEN** le titre, les compteurs, les tâches et leurs sous-tâches du projet
  sont présents dans une unique surface React identifiée
- **AND** aucun renderer vanilla n'a produit une seconde copie de ce détail

#### Scenario: Les autres routes restent vanilla

- **WHEN** `#/`, `#/parametres`, `#/parametres/donnees` ou
  `#/parametres/synchronisation` est affiché
- **THEN** aucune surface React métier n'est montée dans la zone de contenu
- **AND** Overview, Paramètres, Imports / Exports et Synchronisation conservent
  leur rendu, leurs contrôles et leurs handlers existants

#### Scenario: Carte de suggestion d'Overview inchangée

- **GIVEN** une modification est effectuée dans le détail React
- **WHEN** l'utilisateur revient à Overview
- **THEN** la carte de suggestion, la carte « Je reprends ici », les cartes de
  projets et leurs contrôles conservent leur rendu vanilla et leurs handlers
- **AND** elles reflètent les données mises à jour sans qu'Overview soit migré
  vers React

#### Scenario: Une seule racine après navigation et rafraîchissement

- **GIVEN** le détail du projet A est affiché
- **WHEN** la route alterne plusieurs fois entre A, un autre projet et Overview,
  avec des rafraîchissements de données simulés
- **THEN** le nombre de surfaces React actives ne dépasse jamais un
- **AND** aucun listener de la surface précédente ne reste actif
- **AND** aucun descendant n'a deux propriétaires DOM

#### Scenario: Le vanilla reprend la main après démontage

- **GIVEN** le détail du projet A est rendu par React
- **WHEN** l'utilisateur active « Retour à la vue d'ensemble »
- **THEN** la racine React est démontée ou invalidée avant l'affichage Overview
- **AND** le renderer vanilla peut réécrire la zone de contenu sans conflit
- **AND** aucun contenu du détail A ne subsiste dans la vue Overview

#### Scenario: Repli accessible sans projet

- **GIVEN** une route de projet malformée, un identifiant absent du document
  courant ou un projet supprimé après import
- **WHEN** la route est interprétée
- **THEN** le repli accessible existant avec un contrôle de retour est affiché
- **AND** aucun projet n'est créé, modifié ou emprunté à un autre contexte

### Requirement: Parité de données et de présentation

La surface React SHALL afficher les mêmes données, identifiants, compteurs,
hiérarchies, ordres et classes CSS que le rendu vanilla de référence, sans
nouvelle fonctionnalité ni changement de style. Les titres et notes utilisateur
MUST être rendus comme nœuds texte, jamais comme HTML.

#### Scenario: En-tête et compteurs identiques

- **GIVEN** un projet avec des tâches terminées et non terminées et des
  sous-tâches
- **WHEN** son détail React est affiché
- **THEN** le titre, le libellé d'étapes en attente et le libellé de total de
  tâches de premier niveau sont ceux du rendu vanilla de référence
- **AND** les sous-tâches ne sont pas comptées dans le total de premier niveau
- **AND** les identifiants et classes de l'en-tête et du contrôle de retour sont
  préservés

#### Scenario: Ordre et hiérarchie préservés

- **GIVEN** un projet contenant plusieurs priorités et une tâche parente avec
  des sous-tâches directes
- **WHEN** le détail React est rendu
- **THEN** les tâches de premier niveau suivent l'ordre de priorité existant
- **AND** chaque sous-tâche reste dans la liste enfant du bon parent
- **AND** chaque élément garde son identifiant stable et ses classes de
  hiérarchie

#### Scenario: Filtre des tâches terminées

- **GIVEN** « Masquer les étapes terminées » est actif
- **WHEN** le détail React est rendu ou rafraîchi
- **THEN** les tâches sans sous-tâche non terminée et terminées sont masquées
  selon la règle existante
- **AND** les sous-tâches terminées sont masquées sans révéler d'élément caché

#### Scenario: Notes et états vides

- **GIVEN** une tâche porte une note multiligne et un projet ne contient aucune
  étape
- **WHEN** le détail React est rendu
- **THEN** la note est affichée comme texte avec ses retours à la ligne
- **AND** le message d'état vide existant est affiché pour le projet sans étape

#### Scenario: Markup affiché littéralement

- **WHEN** un titre ou une note contient `<img src=x onerror=alert(1)>`
- **THEN** la chaîne est affichée littéralement
- **AND** aucun élément exécutable n'est créé à partir de ce texte

### Requirement: Interactions et validations existantes

La surface React SHALL déléguer chaque intention aux commandes et règles du
contrôleur existant. Chaque interaction MUST produire le même résultat, les
mêmes validations, messages et noms accessibles que la référence vanilla.
React MUST NOT dupliquer une mutation, changer une limite métier ou ajouter une
seconde écriture.

#### Scenario: Création d'une tâche de premier niveau

- **GIVEN** le détail React affiche le formulaire de création avec une priorité
- **WHEN** l'utilisateur saisit un titre valide et l'ajoute
- **THEN** une seule commande de création est transmise au contrôleur
- **AND** la nouvelle tâche apparaît dans le bon projet et la bonne priorité
- **AND** le champ de saisie redevient utilisable sans perte d'ancrage

#### Scenario: Limites de création respectées

- **WHEN** le titre est vide ou composé d'espaces, dépasse la longueur
  autorisée, ou que le projet atteint la limite existante d'étapes
- **THEN** aucune tâche n'est créée et aucune écriture n'est émise

#### Scenario: Édition avec préremplissage, sauvegarde et annulation

- **GIVEN** une tâche possède un titre, une priorité et une note
- **WHEN** « Modifier » est activé
- **THEN** l'éditeur inline est prérempli avec ces valeurs et propose
  « Enregistrer » et « Annuler »
- **WHEN** l'utilisateur annule
- **THEN** le document et le brouillon ne sont pas enregistrés et la tâche
  d'origine reste affichée
- **WHEN** l'utilisateur modifie le titre, la priorité ou la note et enregistre
- **THEN** seule la tâche ciblée est mise à jour par une commande du contrôleur
- **AND** les validations de titre et de note existantes restent appliquées

#### Scenario: Complétion et priorité

- **WHEN** l'utilisateur coche ou décoche une tâche ou une sous-tâche
- **THEN** la complétion est enregistrée une seule fois et les compteurs sont
  recalculés depuis le document courant
- **WHEN** l'utilisateur choisit une autre priorité
- **THEN** seule la tâche ciblée change de priorité et se replace dans le
  groupe de priorité existant
- **AND** l'identité, le parent et la complétion de la tâche restent inchangés

#### Scenario: Suppression et annulation

- **GIVEN** une tâche est affichée dans le détail React
- **WHEN** « Retirer » est activé
- **THEN** la tâche et ses sous-tâches directes sont retirées selon la règle
  existante et une seule écriture est émise
- **AND** l'action « Annuler » du message existant restaure la tâche, sa
  position, sa hiérarchie et le suivi éventuel
- **AND** aucune seconde écriture n'est émise par la présentation

#### Scenario: Menu, sous-tâches et promotion

- **WHEN** le menu d'une tâche ou d'une sous-tâche est ouvert
- **THEN** il expose exactement les commandes applicables, les mêmes libellés,
  les mêmes noms accessibles et les mêmes états désactivés que la référence
- **WHEN** « Ajouter une sous-tâche » est utilisé
- **THEN** une seule sous-tâche directe est créée avec la priorité et la limite
  existantes
- **WHEN** « Promouvoir en tâche principale » est utilisé sur une sous-tâche
- **THEN** elle devient une tâche de premier niveau selon la règle existante
- **AND** aucune autre tâche n'est déplacée ou re-parentée

#### Scenario: Réordonnancement avec restrictions

- **WHEN** « Monter » ou « Descendre » est activé depuis le menu
- **THEN** l'élément se déplace d'un rang dans son groupe autorisé
- **AND** une commande impossible reste désactivée
- **WHEN** un glisser-déposer tente un déplacement hors du projet, du parent ou
  de la priorité autorisés
- **THEN** rien ne bouge et rien n'est enregistré

#### Scenario: Sous-tâches, suivi et retour

- **WHEN** l'utilisateur ouvre ou replie les sous-tâches d'un parent
- **THEN** seul ce parent change d'état et le focus revient sur son contrôle
- **WHEN** « Garder le fil » est activé sur une tâche non terminée
- **THEN** le suivi utilise les identifiants stables existants et le menu
  reflète l'état suivi
- **WHEN** « Retour à la vue d'ensemble » est activé
- **THEN** la route Overview est ouverte et le focus revient au contrôle
  d'ouverture du projet concerné selon la règle existante

#### Scenario: Erreur d'enregistrement existante

- **GIVEN** une commande valide est activée alors que le flux d'écriture existant
  est indisponible
- **WHEN** le contrôleur refuse ou échoue l'enregistrement
- **THEN** le message d'erreur existant est affiché et aucun faux succès n'est
  annoncé
- **AND** la surface ne déclenche ni seconde écriture ni mutation parallèle
- **AND** les données restent dans l'état décidé par le contrôleur

#### Scenario: Marquage HTML inerte dans les interactions

- **WHEN** un titre contenant du markup est utilisé dans un libellé, un nom
  accessible ou un menu
- **THEN** il reste du texte
- **AND** aucune commande ne s'exécute à cause du contenu du titre

### Requirement: Continuité des états éphémères, du focus et du scroll

Une modification locale ou un rafraîchissement autorisé dans la même vue et
la même identité SHALL préserver les états encore valides, dont le brouillon,
les parents développés, le focus, la position de lecture et le scroll. Les
exceptions de navigation, rechargement, import et identité restent celles des
specs canoniques, dont `ux-interaction-continuity`.

#### Scenario: Brouillon conservé lors d'un rafraîchissement

- **GIVEN** l'éditeur d'une tâche est ouvert avec un brouillon non enregistré
- **WHEN** un rafraîchissement de données autorisé survient ou que des données
  inchangées sont re-rendues
- **THEN** le brouillon reste dans l'éditeur
- **AND** aucune sauvegarde ni écriture n'est déclenchée par le rafraîchissement

#### Scenario: Parents développés conservés

- **GIVEN** des parents sont développés dans le détail React
- **WHEN** une tâche locale est modifiée, une sous-tâche est cochée, un filtre
  change ou un rafraîchissement inter-onglets/Dexie autorisé survient
- **THEN** les parents toujours affichables conservent leur ouverture
- **AND** un parent supprimé ou sans sous-tâche visible peut disparaître sans
  réinitialiser les autres

#### Scenario: Focus après sauvegarde, annulation, déplacement ou retrait

- **GIVEN** le focus clavier est sur un contrôle d'une tâche
- **WHEN** une sauvegarde, une annulation, un déplacement ou un retrait
  remplace ou supprime ce contrôle
- **THEN** le focus rejoint un contrôle réellement présent et pertinent pour la
  même tâche ou un repère voisin
- **AND** il ne reste jamais sur un nœud détaché
- **AND** aucun saut arbitraire en haut de page n'est provoqué

#### Scenario: Suppression d'une tâche ancrée

- **GIVEN** une tâche située loin du haut est le repère de lecture courant
- **WHEN** elle est retirée ou masquée par le filtre
- **THEN** le viewport se repositionne au plus près d'un élément restant
  pertinent lorsque cela est possible
- **AND** le navigateur peut borner naturellement le scroll à la nouvelle
  hauteur réelle
- **AND** aucune hauteur artificielle ne persiste après le rendu

#### Scenario: Liste longue et clamp de scroll

- **GIVEN** une liste longue est déjà défilée dans le détail React
- **WHEN** une création, une coche, un réordonnancement ou un rafraîchissement
  remplace des éléments
- **THEN** aucune phase intermédiaire vide ou fortement raccourcie ne ramène le
  viewport au début
- **AND** l'ancrage de lecture est préservé autant que la nouvelle géométrie le
  permet

#### Scenario: Navigation et identité réinitialisent

- **WHEN** l'utilisateur change de route, recharge la page, ouvre un nouvel
  onglet, importe un document ou change d'identité/espace autorisé
- **THEN** les états transitoires sont réinitialisés selon les specs canoniques
- **AND** aucune donnée ou brouillon du contexte précédent n'est réutilisé

#### Scenario: Menu et interactions ne persistent rien

- **WHEN** le menu est ouvert puis fermé, ou qu'un état de présentation local
  change sans commande métier
- **THEN** le document, `localStorage`, IndexedDB, l'export et la synchronisation
  restent strictement inchangés

### Requirement: Aucune écriture, requête ou effet métier implicite

Le montage, le rendu, le re-rendu, l'abonnement, la notification de
rafraîchissement et le démontage de la surface React MUST NOT écrire dans
Dexie ou IndexedDB, ni émettre de requête Cloud, d'authentification OTP, de
migration, de copie Cloud ou de transfert de données. Seule une commande
explicitement activée par l'utilisateur SHALL pouvoir déclencher une écriture
via le flux du contrôleur existant, et chaque commande MUST produire au plus
une intention et une écriture correspondante.

#### Scenario: Montage et démontage sans écriture

- **GIVEN** une surface React montée sur des données synthétiques avec des
  espions d'écriture et de réseau
- **WHEN** elle est montée, rendue, rafraîchie, démontée puis remontée
- **THEN** aucune écriture Dexie/IndexedDB, requête Cloud, OTP ou migration
  n'est observée

#### Scenario: Une commande, un callback

- **GIVEN** une commande de création, d'édition, de complétion, de priorité,
  de retrait, de réordonnancement, de promotion ou de suivi
- **WHEN** l'utilisateur l'active une fois
- **THEN** le contrôleur reçoit exactement une intention correspondante
- **AND** aucun double callback ni double écriture n'est observé

#### Scenario: Le rendu ne sauvegarde pas

- **GIVEN** un document synthétique chargé
- **WHEN** la surface est re-rendue à la suite d'un rafraîchissement ou d'un
  changement d'état de présentation local
- **THEN** le document métier, ses identifiants, ses ordres et ses exports
  restent inchangés

### Requirement: Invalidation aux frontières de contexte

L'ancienne surface SHALL être démontée ou invalidée et son contenu MUST NOT
rester visible lorsque la route change de vue ou de projet, lorsque l'identité,
la base ou l'espace autorisé change, lorsque l'accès métier devient faux, lors
d'un chargement bloquant ou lorsque le projet disparaît. Aucun contrôle rendu
ou listener actif de l'ancien contexte ne MUST subsister.

#### Scenario: Changement de projet ou de vue

- **GIVEN** le détail du projet A est rendu par React
- **WHEN** la route passe au projet B, à Overview ou à Paramètres
- **THEN** la surface de A est invalidée
- **AND** aucun titre, compteur, tâche ou note de A n'est visible dans la
  nouvelle vue

#### Scenario: Compte, cache ou espace bloqué

- **GIVEN** le détail d'une identité autorisée est affiché
- **WHEN** l'identité change, devient non vérifiée, bloquée ou non autorisée
- **THEN** la surface est invalidée et la zone de contenu est masquée ou
  remplacée selon les règles d'isolation existantes
- **AND** aucune donnée du contexte précédent n'est affichée, copiée ou écrite

#### Scenario: Chargement bloquant ou projet disparu

- **GIVEN** la surface est active
- **WHEN** une lecture bloquante survient ou le projet disparaît après import,
  restauration ou rafraîchissement
- **THEN** l'ancienne présentation est invalidée
- **AND** le repli ou l'état vide affiché ne réutilise aucune donnée de
  l'ancien contexte

#### Scenario: Rafraîchissement autorisé non invalidant

- **GIVEN** la surface active et l'identité autorisée sont inchangées
- **WHEN** un rafraîchissement de données autorisé survient
- **THEN** l'instantané est mis à jour sans démontage ni réinitialisation
  abusive des états encore valides

### Requirement: Compatibilité des routes, du build, de la CSP et des données

Le pilote SHALL conserver la navigation par hash, les URLs sous
`/threadstep/`, la CSP de production stricte, le build statique et les
formats de données existants. La sauvegarde, l'import/fusion, l'export, la
restauration, les données IndexedDB historiques, la clé
`threadstep.document.v1` et les contrats Cloud/OTP MUST rester compatibles et
inchangés. Aucune nouvelle route, préférence persistée, clé de stockage,
migration ou ressource réseau implicite ne MUST être créée.

#### Scenario: Routes et fragments inchangés

- **WHEN** `#/`, `#/parametres`, `#/parametres/donnees`,
  `#/parametres/synchronisation` et `#/sujet/<id>` sont ouverts directement,
  rafraîchis ou parcourus par Précédent/Suivant
- **THEN** leur interprétation et leur vue restent celles de la référence
  existante
- **AND** aucune route ou clé de stockage n'est ajoutée

#### Scenario: Build statique et CSP

- **WHEN** `npm run build` et `npm run verify:build` sont exécutés
- **THEN** l'artefact reste statique sous `/threadstep/`
- **AND** la CSP de production reste identique, avec `script-src 'self'` sans
  `unsafe-inline` ni `unsafe-eval`
- **AND** aucune requête CDN ou ressource réseau implicite n'est introduite

#### Scenario: Données et sauvegardes compatibles

- **GIVEN** un document existant avec des identifiants, notes, priorités,
  ordres et hiérarchies
- **WHEN** le détail React le lit et qu'une commande métier le modifie
- **THEN** l'export, l'import/fusion et la restauration conservent le format et
  les champs existants
- **AND** aucune donnée historique IndexedDB n'est migrée, copiée ou supprimée
  par la présentation
- **AND** les compteurs, le suivi et l'export reflètent la même mutation

### Requirement: Bilan de pilote et décision GO / NO-GO

Le changement SHALL produire un bilan versionné comparant explicitement, avant
et après, le volume et la complexité du code, la réutilisabilité des
composants, la couverture des tests, le poids du build et les efforts/risques
d'intégration. Le bilan MUST conclure GO ou NO-GO et MUST NOT déclencher,
planifier ou autoriser automatiquement la migration d'autres vues. Il SHALL
distinguer les preuves automatisées des recettes humaines non réalisées.

#### Scenario: Mesures et comparaison présentes

- **WHEN** le rapport de pilote est relu
- **THEN** il contient des mesures avant/après de taille de build, de volume de
  code et de couverture, ainsi qu'une appréciation de complexité et de
  réutilisabilité
- **AND** les commandes et la date des mesures sont indiquées
- **AND** aucun chiffre non mesuré n'est présenté comme prouvé

#### Scenario: Conclusion explicite

- **WHEN** le bilan est relu
- **THEN** il énonce explicitement GO ou NO-GO
- **AND** la décision est présentée comme une recommandation de pilote
- **AND** elle ne modifie ni le backlog, ni les routes, ni la configuration,
  ni l'autorisation de fusion/déploiement

#### Scenario: Limites de vérification déclarées

- **WHEN** le rapport décrit les résultats
- **THEN** il sépare les tests déterministes de la recette réelle desktop,
  Chrome Android, tablette, clavier, tactile et lecteur d'écran
- **AND** les vérifications non effectuées restent explicitement non vérifiées
