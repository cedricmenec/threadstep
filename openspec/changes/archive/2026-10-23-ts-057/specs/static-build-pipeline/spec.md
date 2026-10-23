# Spec Delta

## Purpose

Définir le pipeline Vite local de ThreadStep : un build statique reproductible,
isolé de la source, chargé sous `/threadstep/` et sûr vis-à-vis de la CSP, des
données et de la publication GitHub Pages actuelle.

## ADDED Requirements

### Requirement: Version Vite épinglée et commandes disponibles

Le projet SHALL déclarer Vite en dépendance de développement à version exacte,
avec un `package-lock.json` cohérent. `npm ci` MUST installer exactement cette
version. Les commandes `npm run dev`, `npm run build` et `npm run preview`
MUST exister, et les commandes existantes, notamment `check`, `test` et
`vendor:build`, MUST rester disponibles.

#### Scenario: Installation reproductible

- **GIVEN** un lockfile versionné contenant Vite
- **WHEN** `npm ci` est exécuté sur le runner
- **THEN** l'installation réussit sans mise à jour de version
- **AND** la version résolue correspond exactement à celle de `package.json` et du lockfile

#### Scenario: Commandes exposées

- **WHEN** `npm run dev`, `npm run build` et `npm run preview` sont invoqués
- **THEN** chaque commande cible le pipeline Vite prévu sans erreur de script manquant
- **AND** `npm run check`, `npm test` et `npm run vendor:build` restent invoquables

### Requirement: Build statique reproductible

Deux exécutions consécutives de `npm run build` sur le même contenu SHALL
produire la même arborescence relative et les mêmes octets pour chaque fichier,
hors métadonnées explicitement documentées. L'artefact MUST être régénéré sans
résidu d'un build antérieur.

#### Scenario: Deux builds identiques

- **GIVEN** le même commit et le même lockfile
- **WHEN** deux builds sont exécutés dans des répertoires de sortie distincts
- **THEN** les chemins relatifs et les empreintes de contenu sont identiques
- **AND** aucun fichier d'un build précédent ne subsiste dans l'artefact

#### Scenario: Métadonnées non déterministes absentes

- **WHEN** l'artefact est inspecté après deux builds
- **THEN** aucun horodatage, identifiant aléatoire ou chemin absolu de la machine n'apparaît
- **AND** toute métadonnée explicitement tolérée est documentée

### Requirement: Artefact isolé et sans contenu sensible

Le build SHALL écrire dans un répertoire distinct de `site/`, non versionné, et
MUST NOT modifier la source. L'artefact MUST NOT inclure tests, secrets,
fichiers de développement, configurations locales, fichiers
`dexie-cloud.key`/`dexie-cloud.json` ou ressources internes non atteignables.
`site/` MUST rester publiable tel quel.

#### Scenario: Sortie hors de la source

- **WHEN** `npm run build` se termine
- **THEN** l'artefact est écrit dans un répertoire distinct de `site/`
- **AND** aucun fichier de `site/` n'a été écrasé, déplacé ou supprimé

#### Scenario: Fichiers sensibles exclus

- **WHEN** l'arborescence construite est inspectée
- **THEN** `dexie-cloud.key`, `dexie-cloud.json`, fichiers `.env`, secrets, tests et sources internes sont absents
- **AND** aucun contenu de développement non atteignable n'est copié

#### Scenario: Source statique toujours publiable

- **GIVEN** le workflow Pages actuel publie `site/`
- **WHEN** le changement est livré
- **THEN** `site/index.html` et ses imports locaux restent autonomes
- **AND** l'application statique reste chargeable sans exécuter Vite

### Requirement: Résolution sous /threadstep/ et routes par fragment

Le document construit SHALL résoudre scripts, styles, icône, ressources et
vendor via le préfixe `/threadstep/`. Il MUST NOT contenir d'URL locale absolue
à la racine du domaine. Les routes `#/`, `#/parametres`,
`#/parametres/donnees`, `#/parametres/synchronisation` et `#/sujet/<id>` MUST
rester inchangées au chargement direct, au rafraîchissement et dans
l'historique.

#### Scenario: Toutes les ressources sont préfixées

- **WHEN** le HTML et les fichiers construits sont inspectés
- **THEN** chaque URL locale de script, style, icône, ressource et vendor commence par `/threadstep/`
- **AND** aucune URL locale absolue non préfixée à la racine du domaine n'est présente

#### Scenario: Chargement direct et rafraîchissement

- **GIVEN** l'artefact servi sous `/threadstep/`
- **WHEN** l'utilisateur ouvre directement `#/`, `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation` ou un `#/sujet/<id>` valide, puis recharge
- **THEN** la vue correspondante est restaurée comme dans le site statique actuel

#### Scenario: Historique et navigation

- **GIVEN** une vue de projet ou de paramètres affichée
- **WHEN** l'utilisateur utilise Précédent ou Suivant
- **THEN** la vue correspondant au fragment courant est restaurée
- **AND** les états vides, de chargement et d'erreur existants ne sont pas modifiés

#### Scenario: Fragment inconnu

- **WHEN** le fragment ne correspond à aucune route connue
- **THEN** le repli déterministe existant vers Overview est conservé
- **AND** aucun panneau masqué n'est rendu visible par l'outillage

### Requirement: Vendor Dexie local sans doublon

Le build SHALL charger Dexie et `dexie-cloud-addon` depuis les dépendances
épinglées et le prébundle local, sans CDN runtime. Il MUST contenir une seule
instance Dexie, ne MUST NOT dupliquer le module vendor et ne MUST NOT imposer
d'URL Cloud ni de secret.

#### Scenario: Un seul vendor local

- **WHEN** les chunks construits sont inspectés
- **THEN** un seul chunk vendor Dexie est émis et référencé
- **AND** aucun second module Dexie n'est chargé ou préchargé

#### Scenario: Ordre de chargement déterministe

- **GIVEN** l'application construite
- **WHEN** le document charge le chunk applicatif
- **THEN** ses dépendances locales, dont le vendor Dexie, sont résolues avant l'usage de l'application
- **AND** aucun échec de résolution de module n'est présent

#### Scenario: Pas de CDN ni d'URL imposée

- **WHEN** le HTML et les JavaScript construits sont inspectés
- **THEN** aucun script CDN tiers n'est référencé
- **AND** aucune URL d'instance Dexie Cloud, clé ou credential n'est imposé au build

### Requirement: Identité de stockage local préservée

L'outillage SHALL NOT exécuter l'application au build ni modifier les noms de
base IndexedDB, la version de schéma, les stores, les routes, les formats de
sauvegarde ou les clés de configuration. L'application construite MUST ouvrir
les mêmes bases que la version statique actuelle.

#### Scenario: Le build n'exécute pas l'application

- **WHEN** `npm run build` s'exécute
- **THEN** aucune base IndexedDB n'est ouverte, migrée ou supprimée
- **AND** aucune préférence locale, import ou export n'est déclenché

#### Scenario: Constantes de stockage inchangées

- **WHEN** les sources et l'artefact construit sont comparés aux valeurs livrées
- **THEN** les noms de bases, la version de schéma et les stores restent identiques
- **AND** aucune variable d'environnement ou `define` Vite ne les remplace

#### Scenario: Reprise d'une base existante

- **GIVEN** une base locale existante contenant projets, tâches et sous-tâches
- **WHEN** la version construite est servie puis rechargée
- **THEN** l'application réutilise la même base et restitue ces données
- **AND** aucune migration, suppression ou nouvelle identité n'est déclenchée par Vite

### Requirement: Frontières métier et Cloud inchangées

Le build et la preview MUST conserver les gardes existantes d'import, export,
restauration, consentement, configuration Cloud, OTP, synchronisation et
isolation des comptes. Le chargement de l'artefact MUST NOT déclencher de
requête, migration, authentification ou transfert implicite.

#### Scenario: Aucune activité Cloud implicite

- **GIVEN** aucune configuration Cloud active
- **WHEN** l'artefact construit est chargé
- **THEN** aucune requête Cloud, authentification ou file de transfert n'est créée
- **AND** les données locales restent utilisables sans OTP

#### Scenario: Import, export et restauration conservés

- **WHEN** les parcours existants d'import/fusion, d'export JSON et de restauration sont exercés dans la version construite
- **THEN** les prévisualisations, consentements et refus existants restent applicables
- **AND** aucun format de sauvegarde ni garde de collision n'est modifié

#### Scenario: Configuration Cloud, OTP et isolation conservés

- **GIVEN** un environnement Dexie Cloud de test isolé
- **WHEN** la configuration, une session OTP et un changement de compte y sont exercés avec des données de test
- **THEN** les gardes d'activation, de synchronisation et d'isolation existantes restent observées
- **AND** aucun transfert implicite ni purge réelle n'est autorisé

### Requirement: CSP de production stricte et HMR isolé

L'artefact construit SHALL conserver la CSP de production de `site/index.html`,
limitée à `'self'` et aux hôtes Dexie Cloud. Le serveur de développement MAY
utiliser une CSP distincte limitée au HMR local ; cette dérogation MUST NOT
apparaître dans le build, la preview ou le site publié. Aucun script inline non
autorisé, `unsafe-eval` ou CDN MUST être introduit.

#### Scenario: CSP de production inchangée dans l'artefact

- **WHEN** le HTML construit est inspecté
- **THEN** sa CSP est identique à celle de `site/index.html`
- **AND** `script-src 'self'` reste appliqué sans `unsafe-inline` ni `unsafe-eval`

#### Scenario: CSP de développement séparée

- **WHEN** le serveur de développement est sollicité
- **THEN** il peut appliquer une CSP propre au HMR local
- **AND** cette CSP n'est ni écrite dans la source de production ni présente dans l'artefact

#### Scenario: Preview et publication non assouplies

- **WHEN** `npm run preview` sert l'artefact ou que `site/` est publié
- **THEN** seule la CSP de production stricte est appliquée
- **AND** aucun script inline non autorisé n'est présent

### Requirement: Vérification automatisée du build et de la preview

Une vérification automatisée SHALL construire deux fois, comparer les
artefacts, inspecter chemins, sécurité et vendor, puis charger `preview` sous
`/threadstep/`. Elle MUST échouer si une ressource manque, si un chemin sort de
la base ou si une URL externe est requise. Le diagnostic des chemins cassés MUST
être documenté.

#### Scenario: Vérification complète réussie

- **WHEN** la commande de vérification du build est exécutée après installation
- **THEN** les deux builds sont identiques et toutes les ressources locales se chargent sous `/threadstep/`
- **AND** le contrôle CSP, vendor et fichiers sensibles réussit

#### Scenario: Ressource manquante détectée

- **GIVEN** un artefact dont une ressource référencée est absente ou hors base
- **WHEN** la vérification s'exécute
- **THEN** elle échoue avec le chemin fautif
- **AND** aucun succès de build n'est déclaré

#### Scenario: Preview sous la base

- **GIVEN** l'artefact construit
- **WHEN** `preview` est interrogé sur `/threadstep/`
- **THEN** le document et ses ressources répondent correctement
- **AND** un accès à la racine non préfixée n'est pas présenté comme l'application

#### Scenario: Suite existante verte

- **WHEN** `npm run check` est exécuté après le changement
- **THEN** les tests existants et les contrôles statiques restent verts
- **AND** les tests propres au build sont exécutés séparément et leurs résultats réels sont rapportés

### Requirement: Publication Pages inchangée

Ce changement SHALL NOT modifier `.github/workflows/*` ni faire de `dist/` la
source publiée. `site/` MUST rester la source réellement publiée jusqu'à une
tâche ASF distincte, explicitement autorisée. La documentation MUST distinguer
l'artefact Vite vérifié localement du site en production et documenter le
retour arrière.

#### Scenario: Workflow Pages préservé

- **WHEN** le diff du changement est inspecté
- **THEN** aucun fichier sous `.github/workflows/` n'est modifié
- **AND** le workflow Pages continue de publier `site/`

#### Scenario: Documentation sans confusion de production

- **WHEN** la documentation du build est relue
- **THEN** elle présente `dist/` comme un artefact local vérifié, pas comme le site déjà déployé
- **AND** elle explique que Pages sert encore la publication statique actuelle

#### Scenario: Retour arrière documenté

- **GIVEN** un besoin de revenir à la publication actuelle
- **WHEN** la procédure de retour arrière est suivie
- **THEN** elle consiste à conserver ou restaurer la publication de `site/`
- **AND** aucune donnée, base ou configuration utilisateur n'est affectée
