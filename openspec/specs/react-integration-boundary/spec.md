# react-integration-boundary Specification

## Purpose

Préparer une frontière d'intégration React bornée, réversible et sans second
store métier, afin qu'une future surface de présentation puisse être montée
dans ThreadStep sans changer l'interface, les données, la synchronisation ni
la sécurité de la version livrée.

## Requirements

### Requirement: Dépendances React exactes et compilation JSX locale

Le projet SHALL déclarer `react` et `react-dom` à des versions exactes et un
lockfile cohérent. `npm ci` MUST installer exactement ces versions. Vite SHALL
compiler le JSX localement avec le runtime automatique, sans Babel, sans CDN et
sans script inline. Le build MUST rester statique, sous `/threadstep/`, avec la
CSP de production inchangée.

#### Scenario: Installation reproductible

- **GIVEN** un lockfile versionné contenant React et React DOM
- **WHEN** `npm ci` est exécuté sur le runner
- **THEN** l'installation réussit sans mise à jour de version
- **AND** les versions résolues correspondent exactement à `package.json` et au lockfile

#### Scenario: JSX compilé localement

- **GIVEN** une fixture `.jsx` utilisant le runtime automatique
- **WHEN** la compilation locale configurée pour Vite est appliquée
- **THEN** la sortie référence le runtime JSX local de React
- **AND** aucune dépendance Babel, aucun CDN et aucun script inline ne sont requis

#### Scenario: Build statique et CSP préservée

- **WHEN** `npm run build` et `npm run verify:build` sont exécutés
- **THEN** l'artefact est statique, résolu sous `/threadstep/` et sans requête réseau implicite
- **AND** sa CSP est identique à celle de `site/index.html`
- **AND** `script-src 'self'` reste appliqué sans `unsafe-inline` ni `unsafe-eval`

### Requirement: Propriété DOM unique et bornée

Au plus une racine React SHALL posséder un conteneur borné à la fois. Tant que
cette racine est active, le renderer vanilla MUST NOT remplacer ni modifier ses
descendants. Avant un nouveau rendu vanilla, la racine SHALL être démontée.
Plusieurs cycles de navigation et de rafraîchissement MUST NOT cumuler des
racines ni laisser des listeners actifs dupliqués.

#### Scenario: Montage puis démontage

- **GIVEN** un conteneur borné et une fixture React synthétique
- **WHEN** la racine est montée puis démontée
- **THEN** le conteneur ne contient plus d'arbre React après le démontage
- **AND** aucun listener actif de la fixture ne subsiste

#### Scenario: Le vanilla ne possède pas le conteneur actif

- **GIVEN** une racine React active dans son conteneur
- **WHEN** le renderer vanilla tente de remplacer les descendants du conteneur
- **THEN** l'écriture est refusée
- **AND** l'arbre React et son propriétaire restent uniques

#### Scenario: Cycles navigation et rafraîchissement

- **GIVEN** une surface montée, démontée puis remontée plusieurs fois
- **WHEN** une navigation simulée et un rafraîchissement simulé sont répétés
- **THEN** aucun descendant n'a deux propriétaires DOM
- **AND** aucun listener actif n'est dupliqué
- **AND** le nombre de conteneurs React actifs ne dépasse jamais un

### Requirement: Instantané métier en lecture seule et état transitoire séparé

L'adaptateur SHALL fournir un instantané métier détaché et non mutable, dérivé
du document existant, avec des identifiants d'items stables. Les états UI
transitoires SHALL être identifiés séparément du métier. Un rafraîchissement de
données autorisé SHALL recréer l'instantané sans réinitialiser les états
transitoires encore valides.

#### Scenario: L'instantané ne modifie pas le document

- **GIVEN** un instantané obtenu depuis le document courant
- **WHEN** un consommateur tente de modifier ses propriétés ou ses listes
- **THEN** la tentative échoue ou reste sans effet
- **AND** le document métier et ses identifiants restent inchangés

#### Scenario: Identité stable des items

- **GIVEN** un projet et ses tâches affichés via l'adaptateur
- **WHEN** un rafraîchissement autorisé produit un nouvel instantané
- **THEN** les identifiants des projets, tâches et sous-tâches inchangés restent identiques
- **AND** aucun nouvel identifiant n'est créé par la présentation

#### Scenario: Rafraîchissement sans perte des états valides

- **GIVEN** un menu ouvert, un parent développé et un brouillon encore applicable
- **WHEN** un rafraîchissement de données autorisé est notifié
- **THEN** ces états transitoires restent disponibles dans le nouvel instantané
- **AND** aucune écriture métier n'est déclenchée par la notification

### Requirement: Intentions via commandes explicites et flux existant

L'adaptateur SHALL exposer uniquement des commandes nommées qui délèguent aux
fonctions et au flux d'écriture du contrôleur existant. Le montage, le rendu, le
démontage et une préférence visuelle MUST NOT émettre d'écriture Dexie ou
IndexedDB, ni de requête Cloud, ni d'authentification OTP. Aucun second store
métier et aucune souscription directe de React à Dexie Cloud ou à l'OTP ne
SHALL être introduits.

#### Scenario: Commandes routées vers le contrôleur

- **GIVEN** un adaptateur initialisé avec les callbacks du contrôleur existant
- **WHEN** une commande nommée est invoquée
- **THEN** l'intention est transmise au callback correspondant
- **AND** aucune règle métier parallèle ni aucun second document n'est créé

#### Scenario: Aucune écriture implicite de présentation

- **GIVEN** un adaptateur et une fixture React montés sur des données synthétiques
- **WHEN** la surface est montée, rendue, démontée et qu'une préférence visuelle change
- **THEN** aucune écriture Dexie ou IndexedDB n'est émise
- **AND** aucune requête Cloud, aucun OTP et aucune migration ne sont déclenchés

#### Scenario: Absence de nouvelle source de vérité

- **WHEN** les modules d'intégration et le build sont inspectés
- **THEN** ils n'importent ni n'instancient un second store métier, Dexie Cloud ou l'OTP
- **AND** les identifiants et validations proviennent de `site/core.js` et du contrôleur existant

### Requirement: Invalidation aux frontières de contexte

L'ancienne présentation SHALL être invalidée, démontée et rendue invisible
lorsqu'une route change de vue ou de projet, qu'une identité ou un espace
autorisé change, qu'un chargement bloquant survient, que les données deviennent
indisponibles ou que le projet disparaît. Aucune donnée du contexte précédent ne
MUST rester visible.

#### Scenario: Transition de route

- **GIVEN** une surface active pour le projet A
- **WHEN** la route passe à Overview, à un autre projet ou à Paramètres
- **THEN** la surface précédente est démontée et invalidée
- **AND** aucun contenu de A n'est rendu dans la nouvelle vue

#### Scenario: Changement de compte ou d'espace non autorisé

- **GIVEN** une surface active pour une identité autorisée
- **WHEN** l'identité, la base, l'empreinte de compte change ou l'accès métier devient faux
- **THEN** l'ancien instantané n'est plus disponible
- **AND** aucune donnée du contexte précédent n'est affichée, copiée ou écrite

#### Scenario: Chargement bloquant ou projet disparu

- **GIVEN** une surface active
- **WHEN** une lecture bloquante survient ou le projet disparaît après import ou restauration
- **THEN** l'ancienne présentation est invalidée
- **AND** aucun état vide ne réutilise les données de l'ancien contexte

#### Scenario: Rafraîchissement autorisé non invalidant

- **GIVEN** une surface active dans une même vue et une même identité autorisée
- **WHEN** un rafraîchissement de données survient
- **THEN** l'instantané est notifié et mis à jour
- **AND** la surface n'est pas traitée comme une nouvelle navigation

### Requirement: Surface React activée uniquement sur le détail projet

La surface React métier SHALL être activée uniquement pour la vue détail d'un
projet `#/sujet/:id`, dans le conteneur borné cédé par le contrôleur existant.
Overview, Paramètres, Imports / Exports et Synchronisation MUST rester ceux du
rendu vanilla livré. L'activation MUST NOT créer de préférence persistée, de
route, de clé de stockage ou de transfert de données. Le retour au vanilla SHALL
démonter ou invalider la racine avant le rendu suivant.

#### Scenario: Aucune activation prématurée

- **GIVEN** l'application livrée par ce changement
- **WHEN** les routes existantes sont ouvertes
- **THEN** seule la route `#/sujet/<id>` valide monte la surface React du détail
- **AND** Overview, Paramètres, Imports / Exports et Synchronisation restent
  ceux du rendu vanilla actuel

#### Scenario: URLs et fragments inchangés

- **WHEN** les routes `#/`, `#/parametres`, `#/parametres/donnees`,
  `#/parametres/synchronisation` et `#/sujet/<id>` sont exercées
- **THEN** leur interprétation, leur chargement direct et leur rafraîchissement restent inchangés
- **AND** aucune nouvelle route ou préférence persistée n'est créée

#### Scenario: Bascule réversible sans données

- **GIVEN** une surface React active sur le détail d'un projet
- **WHEN** la surface est démontée ou invalidée et que le vanilla reprend le
  rendu, notamment vers Overview ou une page de paramètres
- **THEN** aucun stockage local, aucune préférence, aucune route et aucune
  donnée métier ne sont créés ou modifiés par la bascule
- **AND** la racine React ne possède plus le conteneur

### Requirement: Fixture et vérification déterministes

Le changement SHALL fournir une fixture React à données synthétiques et des
tests déterministes exécutables sans navigateur réel, sans réseau et sans
données personnelles. Les tests MUST couvrir le montage/démontage, les cycles
navigation/rafraîchissement, l'unicité de propriétaire et de listener,
l'adaptateur, l'invalidation et l'absence d'écriture.

#### Scenario: Test d'intégration de la racine

- **GIVEN** la fixture synthétique et un DOM déterministe
- **WHEN** la racine est montée, démontée puis remontée avec navigation et rafraîchissement simulés
- **THEN** les assertions de propriétaire unique, de listener unique et d'absence d'écriture réussissent

#### Scenario: Aucun accès réel aux données ou au réseau

- **WHEN** les tests d'intégration React et d'adaptateur s'exécutent
- **THEN** ils utilisent des données synthétiques et des espions locaux
- **AND** ils n'ouvrent aucune base réelle, n'appellent aucun service Cloud et ne lisent aucune donnée personnelle

#### Scenario: Suite existante verte et sortie statique

- **WHEN** `npm run check`, les tests ciblés et `npm run build` sont exécutés
- **THEN** les tests existants restent verts et l'artefact reste statique
- **AND** les tests de non-régression des URLs/hash et d'identité stable réussissent

### Requirement: Documentation, taille du build et retour arrière

La documentation SHALL identifier les fichiers concernés, le traitement JSX, la
CSP, le contrat de montage/démontage, le diagnostic, l'écart de taille du build
et la procédure de retour arrière. Elle MUST distinguer les preuves
automatisées des vérifications humaines et ne MUST NOT présenter le socle comme
une migration de vue achevée.

#### Scenario: Fichiers et bascule documentés

- **WHEN** la documentation développeur est relue
- **THEN** elle liste les modules de frontière et d'adaptateur, le point de bascule vers le vanilla et la procédure de diagnostic
- **AND** elle précise qu'aucune préférence persistée, route ou donnée n'est créée par la bascule

#### Scenario: Écart de taille mesuré

- **GIVEN** les builds avant et après l'ajout du socle
- **WHEN** les tailles des assets et des chunks sont comparées
- **THEN** l'écart est consigné
- **AND** l'absence éventuelle de React dans le bundle de production est expliquée sans être confondue avec une preuve d'activation

#### Scenario: Retour arrière sans perte

- **WHEN** la procédure de retour arrière est suivie
- **THEN** le rendu vanilla reste la référence et aucune base, configuration, préférence ou export utilisateur n'est modifié
