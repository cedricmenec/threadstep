# Design

## Context

Le diagnostic natif existe déjà sous forme de modèle pur
(`site/sync-diagnostics.js`) alimenté par `site/app.js` depuis les observables
Dexie Cloud et rendu dans `#sync-diagnostic`. `site/bootstrap-diagnostics.js`
fournit déjà une classification expurgée et une trace bornée, mais pas de
chronologie d'ouverture de base ni d'émission d'observables. La page est servie
en HTTPS sur GitHub Pages : `navigator.clipboard` peut être disponible, mais son
absence ou son refus doit rester un cas normal.

Voir `proposal.md` pour la motivation, les non-objectifs et les incertitudes.

## Goals / Non-Goals

**Goals:**

- Produire un rapport Markdown déterministe, expurgé à la source, à partir des
  seuls champs normalisés existants.
- Traduire les états en constats, causes indéterminées et vérifications non
  destructives, sans promettre de récupération ni annoncer un succès distant.
- Ajouter une instrumentation mémoire minimale du cycle `db.open()`,
  observables natifs et demande OTP, sans bloquer ni persister.
- Offrir copie, aperçu sélectionnable et repli manuel accessible, y compris
  pendant `loading`, `connecting`, `initial`, pull en attente, hors ligne et
  erreur.
- Prouver par tests Node les contenus expurgés, les états couverts et les
  contrôles DOM/accessibles vérifiables ; réserver la recette réelle au manuel.

**Non-Goals:**

- Corriger la restauration OTP/session, le pull initial ou la visibilité des
  projets (TS-045/TS-048).
- Lire des données métier, interroger le réseau, tester Dexie, collecter des
  logs centralisés ou envoyer automatiquement le rapport à un fournisseur IA.
- Ajouter une option cachée de partage brut, un identifiant de suivi ou une
  persistance IndexedDB/localStorage/journal distant.
- Modifier les contrôles, consentements, workflows, secrets ou politiques
  d'isolation existants.

## Decisions

### 1. Module pur de rapport séparé du diagnostic natif

Créer `site/sync-diagnostic-report.js`, sans DOM ni I/O, exposant
`buildSyncDiagnosticReport(input)`, un helper de copie injectable et un
contrôleur de partage sans DOM. Il reçoit un diagnostic déjà normalisé
(produit par `buildSyncDiagnostic`), des données injectées (horloge, navigateur,
build, âges d'instrumentation) et retourne `{ text, sections, unavailable }`.
Il réutilise `buildDiagnosticView` pour les libellés stables mais ne sérialise
jamais l'objet diagnostic ni les valeurs natives.

- Pourquoi : la liste blanche doit porter sur la source, pas sur une regex du
  texte final. Un champ brut ajouté demain au diagnostic ne peut pas fuiter
  implicitement.
- Alternative écartée : expurger le texte rendu par concaténation HTML ou
  sérialiser l'objet Dexie natif ; trop fragile et contraire à TS-034/TS-048.

### 2. Structure stable et valeurs manquantes explicites

Le rapport comporte des sections Markdown fixes avec des clés identifiables :
horodatages local/UTC, application, navigateur, espace actif, réseau, session,
connexion, phase native, pull initial, écritures locales, preuve distante et
raison, liaison de compte, erreurs normalisées, bootstrap, relance, cycle
d'initialisation, limites, vérifications suggérées. Toute valeur absente vaut
`non disponible` ; toute cause non prouvée vaut `indéterminée`.

- Pourquoi : un assistant ou un humain doit pouvoir lire le même rapport sans
  connaître l'interface, et une absence ne doit jamais devenir une invention.
- Alternative écartée : JSON brut ; moins lisible et plus tentant à enrichir de
  champs sensibles.

### 3. Anonymisation par libellés de correspondance

Le rapport ne contient ni URL Cloud, ni nom de base IndexedDB, ni `remoteDbId`,
ni identifiant utilisateur. L'espace actif est décrit par son type et des
libellés sûrs (`base-locale-active`, `destination-cloud-active`,
`identifiant-distante-actif`) ; l'origine Cloud est `masquée par défaut`.
La classification de bootstrap, les erreurs et les états restent des codes ou
libellés normalisés.

- Pourquoi : masquer une origine ou un identifiant sans permettre de le
  réidentifier dans un rapport ultérieur. Aucun hachage stable ne sert
  d'identifiant de suivi.
- Alternative écartée : conserver l'URL ou un hash d'URL pour distinguer deux
  espaces ; ce serait un identifiant corrélable et inutile au support.

### 4. Session et preuve distante non déductives

Le rapport sépare toujours :

- le **fait observé** (session en restauration, absente, expirée, refus natif
  constaté, ou indéterminée) ;
- la **cause** encore indéterminée quand aucun refus natif n'est observé ;
- les **vérifications non destructives** suggérées (consulter la session,
  vérifier le réseau, vérifier la persistance de la configuration), sans action
  automatique et sans promesse de récupération.

Un `in-sync` ou une phase native ne suffit jamais à écrire que le Cloud est
attesté. Le rapport distingue `aucune preuve`, `cache masqué/non vérifié` et
`base locale vide observée` ; il indique qu'une base distante vide n'est pas
attestée par ce diagnostic. Le libellé historique « session absente ou
refusée » est expliqué comme ambigu et n'est pas une preuve de refus serveur.

### 5. Instrumentation mémoire bornée, passive et injectable

Créer `site/sync-lifecycle-instrumentation.js` avec une API pure :
`createSyncLifecycleInstrumentation({ now })` et des enregistrements pour
`db.open()` (`non démarré`, `en attente`, `résolu`, `en échec`), l'émission
initiale et le dernier changement de `currentUser`, `syncState` et
`persistedSyncState`, et le lancement/issue OTP (`non demandé`, `demandé`,
`réussi`, `échoué`, `annulé`). Aucun message, email, code, jeton, identité ou
stack n'est conservé : uniquement des états, des compteurs et des horodatages.

`snapshot(now)` calcule des âges arrondis et bornés (secondes puis minutes,
plafonnés à `≥ 7 jours`). Sans mesure, la valeur est `non disponible`. La
structure est de taille fixe, en mémoire, jamais écrite dans un stockage.

- Pourquoi : reproduire l'incident Android exige de savoir si `db.open()` a
  démarré et si les observables ont émis, sans transformer le diagnostic en
  journal persistant.
- Alternative écartée : enrichir la trace localStorage existante ; le contrat
  exige l'absence de persistance pour ce rapport.

### 6. Branchement passif dans `app.js` et le parcours OTP

Instancier l'instrumentation avant le bootstrap, enregistrer le début de
`syncedDatabase.open()`, son succès et son échec, puis enregistrer les émissions
dans les abonnements existants et lors de la lecture initiale des observables.
Envelopper l'appel de connexion OTP dans `createCloudAuthAdapter` (ou le
callback du contrôleur d'authentification) pour noter le lancement et l'issue,
sans modifier les arguments, l'email, le code ni le comportement d'erreur.

Chaque enregistrement est protégé et ne peut jamais rejeter, bloquer ou retarder
le bootstrap, la connexion ou la synchronisation. Aucun abonnement
supplémentaire n'est installé pour le rapport.

### 7. Aperçu et copie sans re-render destructif

Ajouter une zone de partage dans `paintSyncDiagnostic` avec :

1. un bouton `type="button"` « Copier le diagnostic pour assistance » toujours
   activé, avec cible tactile ≥ 44 px ;
2. un aperçu `<details>` contenant un `<textarea readonly>` ou un `<pre>`
   sélectionnable, construit au clic sur l'aperçu ;
3. un statut dédié `role="status"` `aria-live="polite"` pour la confirmation,
   l'erreur ou la consigne de copie manuelle.

Le rapport est recalculé au clic de copie et au clic d'aperçu ; il n'est jamais
calculé au rendu de la page. La copie appelle uniquement
`navigator.clipboard.writeText` si l'API existe et si le contexte est sécurisé.
Succès : confirmation accessible. API absente ou promesse rejetée : le rapport
reste intégral dans le champ, est sélectionné et le statut explique la copie
manuelle. Aucun message de succès n'est affiché sans écriture réussie.

Le clic de copie ne déclenche ni `renderSyncDiagnostic`, ni rafraîchissement
d'observable, ni relance. Pour un rafraîchissement de fond qui reconstruit la
section, l'état d'ouverture de l'aperçu et le dernier rapport sont conservés en
mémoire ; si le focus était dans la zone de partage, il est restauré sur le
même contrôle après reconstruction. Aucun `scrollIntoView` ni navigation n'est
déclenché, ce qui préserve l'ancre de lecture et le scroll sur mobile.

- Alternative écartée : `document.execCommand("copy")` comme repli caché ;
  moins prévisible et non nécessaire puisque le champ sélectionnable suffit.

### 8. Contexte navigateur minimal

Un petit analyseur local, injectable dans les tests, déduit la famille et la
version majeure du navigateur à partir de `navigator.userAgent`. Seules ces
valeurs sont transmises au rapport ; l'agent complet, la plateforme détaillée,
la langue et les autres champs ne sont ni affichés ni stockés. En l'absence de
reconnaissance, le rapport écrit `non disponible`.

### 9. Version/build

Aucune source de version n'est actuellement exposée au navigateur. Le rapport
accepte une valeur injectée et affiche `non disponible` en son absence. Aucun
numéro n'est inventé à partir de `package.json` sans mécanisme d'exposition
sûr et explicite.

### 10. Styles et accessibilité

Ajouter des styles pour le bouton, l'aperçu défilant, le retour à la ligne
forcé et le statut. Le libellé du bouton porte le nom accessible, le bouton
reste dans l'ordre de tabulation, l'aperçu utilisable au clavier, et les
messages ne dépendent pas de la couleur. Le rapport est du texte brut, jamais
interprété comme HTML.

### 11. Tests

- Tests Node du module de rapport : chaque section, valeurs absentes,
  `loading`/`signed-out`/`authenticated`/`refused`, offline, pull
  pending/failed/complete, cache `UNVERIFIED`, preuve distante, incident
  Android, relance et raisons.
- Tests de liste blanche avec messages, URLs et données pièges (emails, OTP,
  tokens, identifiants, titres, notes, cookies) vérifiant l'absence dans le
  texte et dans l'aperçu.
- Tests de l'instrumentation : `db.open()` résolu/rejeté/en attente, émissions
  initiales et changements, OTP, âges bornés, absence de chronologie, aucune
  persistance.
- Tests de la copie avec presse-papiers simulé : succès, API absente, rejet ;
  aucun faux succès.
- Tests statiques du DOM/accessibilité et de l'absence d'effets de bord
  (pas de login, pull, import, écriture, requête) dans le chemin de copie.
- `npm run check` et `openspec validate ts-051 --strict --no-interactive`.

La recette Chrome Android réelle, le presse-papiers réel, le lecteur d'écran et
le rendu portrait/paysage restent manuels, sans case à cocher.

## Risks / Trade-offs

- **Presse-papiers indisponible ou refusé selon le navigateur ou la permission**
  → conserver le rapport sélectionnable et annoncer la copie manuelle ; ne
  jamais afficher un succès non prouvé.
- **Fuite par un nouveau champ du diagnostic** → liste blanche explicite et
  tests pièges ; le module de rapport n'accepte pas d'objet brut.
- **L'instrumentation fausse le bootstrap ou ajoute du coût** → enregistrements
  synchrones bornés, sans I/O, protégés par `try`, taille fixe, aucun stockage.
- **Focus perdu lors du rafraîchissement natif de la page** → mémoriser l'état
  de l'aperçu et restaurer le focus sur le contrôle de partage après
  reconstruction, sans défilement.
- **Faux sentiment de récupération** → constats séparés de la cause, aucune
  promesse, aucune action destructive ou automatique proposée.
- **Version/build indisponible** → `non disponible` explicite, pas de valeur
  inventée ; l'absence n'empêche pas le rapport.
- **Chronologie absente sur les anciens chargements ou navigateurs** →
  `non disponible` pour chaque mesure concernée, sans bloquer le diagnostic.

## Migration Plan

Aucune migration de données. La fonctionnalité est additive et ne modifie ni le
schéma IndexedDB, ni le format d'export/import, ni la configuration Cloud. En
cas de retrait, supprimer le bouton, le module de rapport et l'instrumentation ;
aucun état persisté n'est à nettoyer.

## Open Questions

Aucune question bloquante. Le libellé exact de l'aperçu, la position visuelle du
bouton et la valeur de build restent ajustables sans changer les spécifications,
les scénarios ni le découpage des tâches.
