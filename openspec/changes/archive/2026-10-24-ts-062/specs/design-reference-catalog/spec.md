# Spec Delta

## Purpose

Fournir un catalogue documentaire durable et traçable des références visuelles
externes, afin que ThreadStep puisse évoluer sans confondre une proposition
Stitch avec une règle produit approuvée.

## ADDED Requirements

### Requirement: Exhaustive reference inventory

Le catalogue SHALL inventorier M01 à M32 et exactement quatre références
desktop, chacune avec un identifiant, une zone fonctionnelle ou un état observé,
un statut de revue contrôlé et un lien Stitch identifiable. Une référence
absente ou non inspectée MUST NOT être présentée comme approuvée.

#### Scenario: All 32 mobile references are present once

- **WHEN** le catalogue est relu ou contrôlé automatiquement
- **THEN** chaque identifiant de `M01` à `M32` apparaît exactement une fois dans l'inventaire
- **AND** aucune référence mobile n'est omise ou dupliquée

#### Scenario: Exactly four desktop references are identified

- **WHEN** le catalogue présente les références desktop
- **THEN** exactement quatre entrées sont présentes
- **AND** elles utilisent des identifiants locaux `DESKTOP-1` à `DESKTOP-4` explicitement déclarés comme convention de catalogue
- **AND** aucun identifiant local n'est présenté comme un identifiant officiel Stitch

#### Scenario: Required functional surfaces are covered

- **WHEN** l'inventaire est constitué
- **THEN** il couvre Overview, le détail, les tâches et éditeurs, la navigation, les paramètres, l'import/export/restauration, le Cloud, les messages limites et les composants
- **AND** chaque référence est associée à au moins une de ces surfaces ou est marquée comme fonction non inspectée
- **AND** aucune surface exigée n'est absente du catalogue

#### Scenario: Missing or unobserved reference is not approved

- **GIVEN** une référence n'a pas été inspectée ou n'est pas accessible
- **WHEN** le catalogue affiche son statut
- **THEN** elle est marquée `NOT_REVIEWED`
- **AND** elle n'est ni approuvée, ni utilisée comme preuve de validation
- **AND** la raison de l'absence d'inspection est consignée

#### Scenario: Identifiable link without an invented deep link

- **GIVEN** aucun lien profond par écran n'est disponible
- **WHEN** le catalogue référence une référence Stitch
- **THEN** il fournit au minimum l'URL du projet Stitch et l'identifiant de la référence
- **AND** il ne fabrique aucun identifiant, nom d'écran ou lien profond non observé

### Requirement: Controlled review statuses and honest evidence

Chaque référence SHALL porter un statut parmi `NOT_REVIEWED`,
`PARTIALLY_REVIEWED`, `REVIEWED_KEEP`, `REVIEWED_CORRECT_IN_STITCH`,
`PRODUCT_DECISION_REQUIRED` ou `REJECTED`. Seule une inspection réelle et
autorisée SHALL produire un statut `REVIEWED_*` ; une génération Stitch, un lien
ou un contrôle automatisé MUST NOT valoir revue.

#### Scenario: Only controlled status values are used

- **WHEN** les statuts de référence sont contrôlés
- **THEN** chaque valeur appartient à la liste contrôlée
- **AND** aucune valeur libre ou approximative n'est utilisée comme statut

#### Scenario: Not reviewed cannot be approved

- **GIVEN** une référence porte `NOT_REVIEWED`
- **WHEN** le catalogue est relu ou contrôlé
- **THEN** elle n'est pas marquée approuvée, retenue ou prête pour TS-063
- **AND** sa présence dans Stitch ne constitue pas une validation

#### Scenario: Generation, link or CI is not a review

- **GIVEN** une référence existe dans Stitch et son lien est présent dans le catalogue
- **WHEN** aucune inspection humaine réelle n'a eu lieu
- **THEN** le statut reste `NOT_REVIEWED`
- **AND** un contrôle automatique de complétude documentaire n'est pas présenté comme une revue visuelle
- **AND** une CI verte n'est pas présentée comme une preuve sur appareil

#### Scenario: Partial review lists unseen states

- **GIVEN** une référence a été observée seulement pour certains états
- **WHEN** elle est marquée `PARTIALLY_REVIEWED`
- **THEN** les états ou parcours non observés sont listés
- **AND** elle n'est pas déclarée intégralement approuvée
- **AND** les points manquants restent à vérifier

### Requirement: Source precedence and non-authorizing references

Le catalogue SHALL établir que les spécifications canoniques, le code livré et
les contrats de sécurité priment sur les maquettes. Une référence Stitch MUST NOT
créer, modifier ou approuver une règle métier, une route, une persistance ou une
exigence de sécurité.

#### Scenario: Conflict resolves in favour of the canonical source

- **GIVEN** une maquette contredit une spécification canonique ou le code livré
- **WHEN** l'écart est consigné
- **THEN** la règle canonique ou le comportement livré est retenu comme source
- **AND** la maquette est classée `CORRECT_IN_STITCH`, `PRODUCT_DECISION` ou `REJECT` selon le cas
- **AND** aucune règle canonique n'est modifiée par la revue

#### Scenario: Visual proposal does not change a business rule

- **WHEN** une référence propose une priorité, un compteur, une suggestion, une hiérarchie, une note, une reprise ou une synchronisation différente
- **THEN** le catalogue la traite comme une différence à arbitrer
- **AND** il ne la transforme pas en nouvelle règle approuvée
- **AND** la règle existante reste la référence

#### Scenario: No new route, storage or feature by reference

- **WHEN** une référence suggère une nouvelle route, un nouvel espace, une nouvelle donnée persistée ou une nouvelle fonctionnalité
- **THEN** le catalogue l'identifie comme `NEW_FEATURE` ou `PRODUCT_DECISION`
- **AND** aucune route, clé de stockage, table ou fonctionnalité n'est déclarée approuvée par la revue

#### Scenario: Signed-off mockups and product code stay unchanged

- **WHEN** la revue documentaire est livrée
- **THEN** aucune maquette signée-off n'a été modifiée
- **AND** aucun code produit, test ou configuration n'a été modifié
- **AND** les corrections Stitch restent des propositions

#### Scenario: Stitch correction requires validated access and scope

- **GIVEN** une correction de référence est proposée
- **WHEN** l'accès à Stitch ou le périmètre de correction n'est pas explicitement validé
- **THEN** la correction n'est pas appliquée
- **AND** elle est consignée comme proposition à valider
- **AND** aucune génération externe payante n'est déclenchée

### Requirement: Explicit unauthorized-idea register

Le catalogue SHALL repérer recherche, archives, partage, Markdown, raccourcis et
statistiques comme idées non autorisées par le contrat actuel. Chacune MUST
exiger une tâche distincte et l'accord du propriétaire avant toute adoption.

#### Scenario: All forbidden ideas are listed

- **WHEN** le registre des idées non autorisées est relu
- **THEN** recherche, archives, partage, Markdown, raccourcis et statistiques y figurent explicitement
- **AND** chaque idée est associée à la référence ou à l'écart qui la suggère

#### Scenario: Forbidden idea is not implicitly approved

- **WHEN** une idée non autorisée apparaît dans une référence
- **THEN** elle est classée `NEW_FEATURE` ou `PRODUCT_DECISION`
- **AND** elle n'est pas marquée approuvée, retenue ou couverte par le style
- **AND** le catalogue indique qu'une tâche distincte et un accord propriétaire sont requis

#### Scenario: Style or interaction cannot smuggle a feature

- **GIVEN** une différence est présentée comme un simple changement de style ou d'interaction
- **WHEN** elle introduit en réalité une recherche, une archive, un partage, du Markdown, un raccourci ou une statistique
- **THEN** le catalogue la reclasse comme nouvelle fonctionnalité
- **AND** elle reste soumise à une décision produit explicite

### Requirement: Traceable difference matrix

Chaque écart observable SHALL figurer dans une matrice avec origine, écran ou
état, différence, catégorie, disposition, risque, propriétaire de décision,
règle ou décision et référence. La disposition SHALL être conserver, corriger
dans Stitch, décision produit distincte ou rejeter.

#### Scenario: Reviewed reference is compared to current behaviour

- **GIVEN** une référence a été inspectée
- **WHEN** elle entre dans la matrice
- **THEN** elle est comparée à l'écran actuel et à la spécification canonique applicable
- **AND** les différences observables sont consignées, ou l'absence de différence est explicitement indiquée
- **AND** aucune comparaison n'est revendiquée pour une référence `NOT_REVIEWED`

#### Scenario: Matrix exposes every required column

- **WHEN** la matrice est relue
- **THEN** elle présente les colonnes d'identifiant, d'origine, d'écran ou état, de différence observable, de catégorie, de disposition, de risque, de propriétaire, de règle ou décision et de référence
- **AND** chaque ligne renseigne ces colonnes sans valeur vide non justifiée

#### Scenario: All four dispositions are available

- **WHEN** une différence est classée
- **THEN** sa disposition est `KEEP`, `CORRECT_IN_STITCH`, `PRODUCT_DECISION` ou `REJECT`
- **AND** aucune autre disposition n'est utilisée
- **AND** les libellés français correspondants sont explicites

#### Scenario: Decision owner is the user

- **WHEN** une ligne exige une décision de produit
- **THEN** le propriétaire indiqué est l'utilisateur ou le propriétaire du produit
- **AND** l'agent n'est jamais présenté comme décideur
- **AND** une décision non encore rendue reste explicitement en attente

#### Scenario: Every functional gap is linked

- **GIVEN** une ligne décrit un écart fonctionnel
- **WHEN** la matrice est relue
- **THEN** la ligne renvoie à une règle existante ou à une décision produit explicite
- **AND** aucun écart fonctionnel n'est laissé sans référence
- **AND** une simple observation visuelle ne suffit pas à autoriser le comportement

#### Scenario: No orphan functional row

- **WHEN** les lignes fonctionnelles sont contrôlées
- **THEN** chacune possède une origine, une règle ou décision, un propriétaire et une référence
- **AND** aucune ligne fonctionnelle n'est orpheline de source
- **AND** une ligne sans source est bloquée jusqu'à clarification

### Requirement: Separate style, structure, interaction and new functionality

Chaque ligne de matrice SHALL distinguer style, structure, interaction et
nouvelle fonctionnalité. Une nouvelle fonctionnalité MUST NOT être autorisée
implicitement par une ligne de style, de structure ou d'interaction.

#### Scenario: Each difference receives one category

- **WHEN** une différence est consignée
- **THEN** sa catégorie est `STYLE`, `STRUCTURE`, `INTERACTION` ou `NEW_FEATURE`
- **AND** aucune catégorie fourre-tout n'est utilisée
- **AND** une ambiguïté est escaladée en décision produit

#### Scenario: New feature requires a product decision

- **GIVEN** une différence ajoute une capacité absente du contrat actuel
- **WHEN** elle est classée `NEW_FEATURE`
- **THEN** elle porte une disposition `PRODUCT_DECISION` ou `REJECT`
- **AND** elle n'est pas déclarée approuvée par la seule revue visuelle
- **AND** une tâche distincte est requise avant implémentation

#### Scenario: Style-only change leaves behaviour unchanged

- **GIVEN** une différence est classée `STYLE`
- **WHEN** elle est retenue
- **THEN** elle ne change ni règle métier, ni route, ni donnée, ni interaction fonctionnelle
- **AND** le catalogue le précise explicitement

#### Scenario: Interaction proposal is checked against current behaviour

- **GIVEN** une différence est classée `INTERACTION`
- **WHEN** elle est comparée au contrat actuel
- **THEN** le catalogue indique si le comportement existant est conservé, corrigé ou à décider
- **AND** une interaction qui modifie une règle métier est reclassée ou escaladée

### Requirement: Business-rule coverage

Le catalogue SHALL relier les écarts fonctionnels aux règles existantes, au
minimum : quatre destinations, aperçu de cinq tâches parentes, compteurs et
suggestion déterministes, hiérarchie à un niveau et priorités des sous-tâches,
notes en texte brut, reprise, Undo, consentement, authentification,
synchronisation et restauration.

#### Scenario: Four destinations are covered

- **WHEN** le catalogue traite la navigation
- **THEN** il reprend les quatre destinations « Mes projets », « Paramètres », « Imports / Exports » et « Synchronisation Dexie Cloud »
- **AND** il vérifie leur ordre, leurs libellés et leurs routes `#/`, `#/parametres`, `#/parametres/donnees` et `#/parametres/synchronisation`
- **AND** il ne propose ni destination supplémentaire ni nouvel espace par une maquette

#### Scenario: Five-parent preview quota is covered

- **WHEN** une référence montre une carte projet
- **THEN** le catalogue vérifie la limite de cinq tâches parentes visibles
- **AND** il précise que les sous-tâches ne consomment pas un emplacement d'aperçu
- **AND** il identifie tout écart comme une différence à traiter, sans modifier le quota

#### Scenario: Counters and deterministic suggestion are covered

- **WHEN** une référence montre des compteurs, une progression ou une suggestion
- **THEN** le catalogue les compare aux règles de `overview-project-metrics` et `next-action-suggestion`
- **AND** il vérifie que la sélection reste déterministe, sans hasard, date, réseau ou IA
- **AND** il ne valide aucune suggestion fondée sur une maquette seule

#### Scenario: One-level hierarchy and subtask priorities are covered

- **WHEN** une référence montre des tâches et sous-tâches
- **THEN** le catalogue vérifie la hiérarchie à un seul niveau
- **AND** il vérifie que les sous-tâches conservent leurs propres priorités
- **AND** il n'introduit ni niveau supplémentaire, ni priorité héritée ou nouvelle règle

#### Scenario: Plain-text notes are covered

- **WHEN** une référence montre une note
- **THEN** le catalogue vérifie l'affichage en texte brut avec sauts de ligne préservés
- **AND** il refuse toute interprétation Markdown, HTML ou lien actif
- **AND** il ne valide aucune nouvelle règle de contenu par la maquette

#### Scenario: Resume and Undo are covered

- **WHEN** une référence montre une reprise ou une annulation de retrait
- **THEN** le catalogue la compare à `resume-tracking` et `action-removal`
- **AND** il vérifie l'unicité de la reprise et la fenêtre d'annulation de dix secondes
- **AND** il n'invente ni historique persistant, ni corbeille, ni nouvelle préférence

#### Scenario: Consent, authentication, synchronization and restore are covered

- **WHEN** une référence montre un parcours Cloud, OTP, synchronisation ou restauration
- **THEN** le catalogue vérifie la séparation entre authentification et consentement
- **AND** il vérifie que les états distants ne sont pas déclarés sans preuve
- **AND** il vérifie que la restauration reste une intention distincte avec confirmation et sauvegarde
- **AND** il n'approuve aucune transmission, purge ou connexion implicite

#### Scenario: Active workspace and isolation are covered

- **WHEN** une référence montre un espace local ou Cloud
- **THEN** le catalogue vérifie l'espace actif et les frontières d'isolation
- **AND** il ne propose ni fusion de comptes, ni exposition d'un cache non vérifié
- **AND** il consigne toute divergence comme décision produit ou rejet

### Requirement: Responsive and accessibility observations

Le catalogue SHALL décrire les variantes 320, 390, 430 et 768 px et les
composants réutilisables, en consignant contrastes, tailles de cible, focus et
textes comme éléments à vérifier. La planche M32 SHALL rester une proposition de
composants, jamais une certification d'accessibilité.

#### Scenario: Required viewport widths are documented

- **WHEN** le catalogue décrit le responsive
- **THEN** les largeurs 320, 390, 430 et 768 px sont explicitement traitées
- **AND** chaque largeur indique les variantes ou comportements observés ou à vérifier
- **AND** aucune largeur n'est déclarée validée sans recette réelle

#### Scenario: Reusable components are inventoried

- **WHEN** le catalogue décrit les composants
- **THEN** il identifie les composants réutilisables candidats et leur fonction
- **AND** il distingue une proposition de composant d'un composant approuvé ou implémenté
- **AND** il ne crée aucune bibliothèque ni dépendance par la documentation

#### Scenario: Accessibility points remain to verify

- **WHEN** une référence ou la planche M32 est inspectée visuellement
- **THEN** les contrastes, tailles de cible, états de focus et textes sont consignés comme `À VÉRIFIER`
- **AND** ils ne sont pas présentés comme mesurés ou conformes
- **AND** une vérification réelle au clavier, au tactile ou au lecteur d'écran reste requise

#### Scenario: M32 is a component proposal, not a certification

- **WHEN** la planche M32 est citée
- **THEN** elle est décrite comme une proposition de composants
- **AND** elle ne certifie ni contraste, ni focus, ni cible tactile, ni ordre de lecture
- **AND** aucune conformité d'accessibilité n'est déduite de son existence

#### Scenario: Stitch is not device evidence

- **GIVEN** Stitch annonce une variante responsive
- **WHEN** le catalogue la reprend
- **THEN** il précise qu'aucun essai sur appareil réel n'a été effectué
- **AND** il conserve un statut à vérifier
- **AND** il ne qualifie pas la variante de preuve mobile ou tactile

### Requirement: TS-063 navigation subset and blockers

Le catalogue SHALL identifier soit un sous-ensemble validé pour le header, le
menu et les quatre destinations de TS-063, soit les points bloquants et la
décision attendue. Le prérequis TS-063 SHALL rester non levé sans validation
humaine explicite consignée.

#### Scenario: Candidate navigation subset is identified

- **WHEN** le catalogue prépare TS-063
- **THEN** il identifie les références candidates pour le header, le menu et les quatre destinations
- **AND** il précise les éléments conservés, corrigés ou à décider
- **AND** il ne déclare pas le sous-ensemble validé sans décision propriétaire

#### Scenario: Blocking points are listed without validation

- **GIVEN** aucune validation humaine du sous-ensemble navigation n'a eu lieu
- **WHEN** le catalogue est livré
- **THEN** il liste les points bloquants et la décision attendue
- **AND** il affiche un état `BLOCKED_PENDING_USER_VALIDATION` ou `CANDIDATES_LISTED`
- **AND** il ne présente pas TS-063 comme prêt à démarrer

#### Scenario: Gate remains closed until explicit human validation

- **GIVEN** tous les contrôles documentaires automatiques passent
- **WHEN** aucune validation humaine n'est consignée
- **THEN** le prérequis TS-063 reste non levé
- **AND** la CI verte ne vaut pas validation
- **AND** aucune implémentation de navigation n'est autorisée

#### Scenario: Human validation record is scoped and dated

- **GIVEN** le propriétaire approuve une partie des références
- **WHEN** la décision est consignée
- **THEN** le catalogue indique la date, la portée et les références approuvées
- **AND** les références non approuvées restent refusées, en attente ou non examinées
- **AND** une approbation partielle ne lève que les références explicitement approuvées

#### Scenario: No implementation authorization is implied

- **WHEN** le catalogue identifie un sous-ensemble validé
- **THEN** il autorise seulement la préparation de TS-063
- **AND** il n'autorise ni code React/CSS, ni migration, ni modification de route ou de données
- **AND** les autres portes de TS-063 restent applicables

### Requirement: Human validation ledger and truthful reporting

Le catalogue SHALL consigner les décisions humaines, les références approuvées
ou refusées et ce qui n'a pas été vérifié. Il MUST NOT présenter une inspection
partielle, un contrôle automatisé ou une génération Stitch comme une acceptation
humaine ou une preuve sur appareil réel.

#### Scenario: Decision ledger names explicit decisions

- **WHEN** une référence est approuvée, refusée ou laissée en attente
- **THEN** le catalogue consigne l'auteur de la décision, sa date et sa portée
- **AND** une décision implicite ou une absence de réponse n'est pas enregistrée comme approbation
- **AND** les décisions produit restent attribuées au propriétaire

#### Scenario: Non-verified items are reported

- **WHEN** le catalogue est livré
- **THEN** il énumère les références non examinées, les états non observés et les dimensions non testées
- **AND** il ne déclare pas une validation intégrale
- **AND** il distingue les limites d'accès des choix de rejet

#### Scenario: Automated documentation checks are labelled as such

- **WHEN** un contrôle de complétude du catalogue réussit
- **THEN** il est présenté comme une vérification documentaire déterministe
- **AND** il n'est pas présenté comme une revue visuelle, une acceptation humaine ou un test sur appareil
- **AND** les dimensions réelles restent dans la recette manuelle

#### Scenario: Silence is not approval

- **GIVEN** une référence n'a reçu aucune décision du propriétaire
- **WHEN** le catalogue est relu
- **THEN** elle reste `NOT_REVIEWED` ou en attente
- **AND** elle n'est pas comptée comme approuvée
- **AND** la porte TS-063 n'est pas levée à sa place

#### Scenario: Rejected and unreviewed references stay visible

- **WHEN** le bilan final est publié
- **THEN** les références rejetées ou non examinées restent listées avec leur statut
- **AND** elles ne sont ni supprimées, ni reformulées comme approuvées
- **AND** leur lien reste identifiable

### Requirement: Documentation-only delivery

La livraison SHALL rester documentaire : catalogue sous `docs/product/` et
artefacts OpenSpec. Elle MUST NOT modifier le code produit, les tests, les
données, la configuration Cloud, les workflows, le backlog, les maquettes
signées-off ni déclencher d'action réseau payante.

#### Scenario: Only documentation and OpenSpec change

- **WHEN** la livraison est contrôlée par `git status` et `git diff`
- **THEN** les seuls chemins modifiés sont le catalogue sous `docs/product/` et les artefacts du changement OpenSpec
- **AND** aucun fichier sous `site/`, `tests/`, `scripts/`, `.github/`, `backlog/` ou de configuration Cloud n'a changé
- **AND** aucun secret ni donnée personnelle n'est présent

#### Scenario: npm run check passes

- **WHEN** la livraison documentaire est vérifiée
- **THEN** `npm run check` réussit
- **AND** les tests existants ne sont ni contournés ni désactivés
- **AND** un échec réel n'est pas présenté comme un succès

#### Scenario: No data or Cloud side effect

- **WHEN** le catalogue est rédigé, relu ou contrôlé
- **THEN** aucune écriture IndexedDB, `localStorage` ou configuration Cloud n'est effectuée
- **AND** aucune authentification, synchronisation, restauration ou purge n'est déclenchée
- **AND** l'export et les données métier restent inchangés

#### Scenario: No Stitch modification or paid generation

- **WHEN** la livraison est publiée
- **THEN** aucune maquette Stitch n'a été créée, modifiée ou signée pendant l'audit
- **AND** aucun appel externe payant n'a été déclenché
- **AND** les corrections éventuelles restent des propositions documentées

#### Scenario: Catalog is versioned and identifiable

- **WHEN** le changement est archivé
- **THEN** le catalogue reste disponible sous un chemin stable de `docs/product/`
- **AND** il porte sa date, ses sources et les liens Stitch utilisés
- **AND** il est identifiable comme prérequis documentaire de TS-063
