# Design

## Context

Voir `proposal.md` — Why. `site/index.html` contient aujourd'hui un unique nœud
`#sync-diagnostic` après `#recovery-panel`, alimenté par `paintSyncDiagnostic`
dans `site/app.js`. Le diagnostic est construit hors DOM par
`buildSyncDiagnostic`, puis projeté par `buildDiagnosticView` avec des libellés
allowlistés. `setupSyncDiagnostics` installe un contrôleur unique et s'abonne
une seule fois par base synchronisée à `cloud.syncState`,
`cloud.persistedSyncState` et `cloud.currentUser`.

Les routes `#/`, `#/parametres`, `#/parametres/donnees` et
`#/parametres/synchronisation` existent déjà. `applySettingsVisibility` masque
ou affiche les sections de paramètres, et le changement de route ne reconstruit
ni ne rouvre la base Dexie. Les panneaux `#cloud-config`, `#cloud-activation`,
`#auth-panel` et `#workspace-panel` restent hors des pages de paramètres.

Le runner ne fournit ni DOM réel, ni IndexedDB, ni navigateur. Les preuves
automatisables restent des tests Node purs et des assertions statiques sur le
HTML, le CSS et le câblage JavaScript.

## Goals / Non-Goals

**Goals:**

- Déplacer le diagnostic complet dans `#/parametres/synchronisation` sans
  changer son identifiant, ses vues, ses abonnements ni ses garde-fous.
- Fournir une synthèse lisible sur la page et un résumé d'attention minimal sur
  Mes projets, tous deux dérivés du même diagnostic natif.
- Ajouter des emplacements descriptifs pour les futurs contrôles de TS-044 sans
  déplacer ni activer aucun formulaire.
- Prouver par des tests déterministes l'absence de nouvelle connexion, requête,
  ouverture de base, écriture, relance ou exposition de secret lors d'un
  changement de route.

**Non-Goals:**

- Modifier `buildSyncDiagnostic`, les règles d'attestation, `canRetryInitialPull`
  ou le flux `retrySyncInitialPull`.
- Déplacer, dupliquer ou recâbler `#workspace-panel`, `#cloud-activation`,
  `#cloud-config` et `#auth-panel`.
- Ajouter un routeur, un abonnement supplémentaire ou une nouvelle source de
  vérité pour l'état de synchronisation.
- Simuler un navigateur réel, un lecteur d'écran ou un appareil mobile en CI.

## Decisions

### 1. Déplacer le nœud `#sync-diagnostic` existant dans la page de paramètres

Le `<section id="sync-diagnostic">` est déplacé tel quel dans
`#settings-sync-page`. Son identifiant, `aria-labelledby="sync-diagnostic-title"`,
son état `hidden` initial et le rendu de `paintSyncDiagnostic` sont conservés.
La page entière est masquée par `applySettingsVisibility` hors de la route
`sync`, donc le diagnostic complet n'apparaît plus sur Mes projets.

Alternative rejetée : rendre le diagnostic dynamiquement à chaque ouverture de
route. Cela risquerait de réinstaller des abonnements, de perdre une valeur
asynchrone en cours ou de relancer une lecture sans nécessité. Un nœud unique
mis à jour par les mêmes événements préserve exactement le contexte.

### 2. Ajouter un résumé séparé, dérivé de la même vue

Un nouvel élément `#sync-summary` est ajouté hors des pages de paramètres, avec
`role="status"` et `aria-live="polite"`, masqué par défaut et sans aucun
contrôle interactif. `sync-diagnostics.js` expose un modèle pur
`buildDiagnosticSummary(diagnostic)` qui réutilise `buildDiagnosticView` et
retourne au minimum un booléen d'attention et un texte court.

Le résumé est affiché uniquement sur `#/` lorsqu'un état configuré n'est pas
entièrement en phase (session, connexion, phase, pull initial, écriture locale,
erreur) ou qu'une erreur locale existe. Il reste masqué pour un espace local non
configuré sans erreur et pour une synchronisation configurée en phase. La page
`#/parametres/synchronisation` affiche toujours une synthèse complète, même sans
attention particulière.

Alternative rejetée : laisser le diagnostic complet sur Mes projets. Cela
conserve la surcharge que TS-043 doit supprimer et duplique les annonces
accessibles. Alternative rejetée : dupliquer tout le diagnostic sur les deux
surfaces. Cela créerait deux zones `aria-live` concurrentes et deux boutons de
relance, avec un risque de déclenchement multiple.

### 3. Toujours dériver la page et le résumé du contrôleur existant

`paintSyncDiagnostic` reçoit déjà la valeur du contrôleur. Il continue de
construire `buildDiagnosticView`, puis met à jour la page et mémorise la
synthèse pour `#sync-summary`. `applySyncSummaryVisibility` ne fait que changer
`hidden` et le texte à partir de `route.view` et du modèle pur ; elle n'appelle
ni `setupSyncDiagnostics`, ni `refresh`, ni `retry`, ni une fonction Dexie.

Le cycle de vie des abonnements reste dans `setupSyncDiagnostics` : un seul
abonnement par observable et par base synchronisée. Le changement de route ne
crée ni ne détruit d'abonnement, car le diagnostic complet reste monté.

Alternative rejetée : déduire le résumé directement de variables Dexie dans le
gestionnaire de navigation. Cela disperserait la logique de diagnostic et
contournerait les normalisations et redactions de `buildDiagnosticView`.

### 4. Conserver les garde-fous de relance sans changement de logique

Le bouton « Relancer la lecture distante » reste créé par
`paintSyncDiagnostic`, relié uniquement à son écouteur `click`, et désactivé
selon `view.retry.disabled` et `canRetryInitialPull`. Aucun gestionnaire de
route, de rendu ou de visibilité ne doit appeler `retrySyncInitialPull` ni
modifier `syncRetryBusy`, `lastRetryError` ou les conditions d'éligibilité.

Le résumé d'attention ne contient aucun bouton. Il peut donc informer sans
offrir une seconde action de relance.

### 5. Emplacements descriptifs sans déplacement des contrôles sensibles

La page de synchronisation reçoit quatre sections statiques :
« Configuration », « Première activation », « Connexion » et « Espaces de
travail ». Elles contiennent uniquement des titres et des textes explicatifs
indiquant que les contrôles restent à leur emplacement actuel jusqu'à TS-044.
Aucun `form`, `input`, `select`, `button` ni identifiant existant
(`#cloud-config`, `#cloud-activation`, `#auth-panel`, `#workspace-panel`) n'y
est copié.

Alternative rejetée : déplacer les panneaux sensibles dès TS-043. Cela
mélangerait la page de diagnostic et le raccordement des actions, augmenterait
le risque et violerait le périmètre strictement read-only de la tâche.

### 6. Accessibilité et confidentialité vérifiables statiquement

La page conserve le titre focalisable `settings-sync-title`, le titre du
diagnostic `sync-diagnostic-title`, les listes de définitions, les messages
d'erreur textuels, la zone `role="status"`/`aria-live="polite"` et
`aria-describedby` du bouton de relance. Le résumé de Mes projets est une zone
de statut non interactive, masquée hors de la route d'ensemble ou lorsqu'il n'y
a rien à signaler.

Le modèle de synthèse ne lit que les libellés et messages allowlistés de
`buildDiagnosticView`. Il ne sérialise ni email, ni OTP, ni token, ni titre, ni
note, ni message d'erreur brut.

### 7. Tests statiques et purs adaptés au runner

Le nouveau `tests/ts-043-sync-page.test.mjs` vérifie :

- l'emplacement unique de `#sync-diagnostic` dans `#settings-sync-page` et des
  sections descriptives, sans contrôle copié ;
- la présence, l'état masqué initial et les attributs accessibles de
  `#sync-summary` ;
- les résultats de `buildDiagnosticSummary` pour local non configuré, états
  configurés en phase, en attente, en erreur, hors ligne et avec erreur locale ;
- l'absence de secret ou de contenu métier dans la synthèse ;
- l'attachement unique des abonnements et l'absence d'appel de relance,
  d'ouverture de base, de réseau ou d'authentification dans le rendu de route ;
- la conservation des conditions et du handler de `retrySyncInitialPull`.

`tests/ts-041-navigation.test.mjs` et `tests/ts-042-data-page.test.mjs` sont
adaptés à la nouvelle position du diagnostic et du résumé.

Alternative rejetée : ajouter jsdom ou Playwright. Cela ne fournirait toujours
ni IndexedDB réelle, ni lecteur d'écran, ni tactile, et alourdirait le runner
pour des assertions déjà couvertes statiquement.

## Risks / Trade-offs

- [Les tests statiques ne prouvent pas le rendu réel ni les annonces] → Les
  recettes visuelle, mobile, clavier et lecteur d'écran restent dans `Manual
  acceptance`.
- [Un nœud déplacé casse un test ou un sélecteur existant] → Des assertions
  d'unicité et d'emplacement échouent avant sync ; les tests TS-041/TS-042 sont
  mis à jour dans la même checklist.
- [Deux zones live annoncent le même état] → Le résumé n'est visible que sur
  `#/`, jamais lorsque la page de diagnostic est affichée.
- [Le résumé masqué cache une erreur locale] → `buildDiagnosticSummary`
  considère explicitement les erreurs locales et les tests couvrent ce cas.
- [Une relance se déclenche lors d'une navigation] → Aucun code de navigation
  n'appelle le handler ; des assertions de source et le maintien du seul
  écouteur `click` le prouvent.
- [Une future TS-044 déplace les contrôles] → Les sections descriptives sont
  prévues pour ce raccordement ; TS-043 n'anticipe ni formulaire ni handler.

## Migration Plan

Aucune migration de données. Modification de présentation réversible : replacer
le nœud `#sync-diagnostic` à son ancien emplacement, retirer `#sync-summary` et
les sections descriptives, puis restaurer les styles suffit à revenir à l'état
précédent. Aucun format, base, configuration Cloud, consentement ou archive
OpenSpec n'est modifié par l'implémentation.

## Open Questions

Aucune question ouverte ne change les spécifications, l'approche ou le découpage.
La formulation exacte du résumé et des textes descriptifs peut être ajustée
pendant `apply` sans modifier le comportement observable.
