# Design

## Context

Voir `proposal.md` — Why. L'état actuel fournit déjà des briques fiables :
`site/sync-diagnostics.js` normalise `syncState`/`persistedSyncState`,
`site/workspace-identity.js` expose l'espace effectif, la base locale, la
liaison et l'URL, et `site/cloud-settings.js` résout l'étape d'onboarding. La
page `#/parametres/synchronisation` affiche ces dimensions dans des panneaux
juxtaposés et un diagnostic technique unique. TS-045 stabilise l'identité du
cache ; TS-046 fournit le vocabulaire utilisateur. TS-047 ne doit donc ajouter
aucune règle de synchronisation, de consentement ou de purge : uniquement une
couche de lecture, de mise en forme et de guidage réutilisant les handlers
existants.

Contraintes structurantes :

- `dexie-cloud-addon` 4.4.15 expose `cloud.events.syncComplete` et
  `persistedSyncState`, mais `SyncState` public ne fournit pas de champ de date
  contractuel. `persistedSyncState.timestamp` est un détail d'implémentation non
  présumé stable.
- La page ne doit ouvrir aucune base, aucun OTP, aucun pull par navigation.
- Aucune donnée métier, email, OTP, token, `userId` brut ni message serveur brut
  ne doit atteindre le DOM ou un stockage d'observation.
- `#cloud-config`, `#cloud-activation`, `#auth-panel`, `#workspace-panel` et
  `#sync-diagnostic` restent uniques, avec leurs handlers d'origine.

## Goals / Non-Goals

**Goals:**

- Un modèle de présentation pur, déterministe et testable qui transforme les
  signaux existants en un résumé de confiance, un catalogue d'états et cinq
  checklists d'intention.
- Une hiérarchie visuelle en trois questions, avec divulgation progressive et
  accès clavier/toucher, sans dupliquer les contrôles métier.
- Une date de synchronisation honnête : attribuée ou « Date non disponible ».
- Des tests Node couvrant les états, les transitions, les événements tardifs, le
  rechargement, les comptes/URL différents, les écritures en attente et les
  horodatages non attestés.

**Non-Goals:**

- Modifier la réplication, l'authentification, les règles d'accès, la
  réconciliation ou les confirmations existantes.
- Lire le contenu métier pour produire le résumé.
- Prouver la convergence inter-appareils en CI.
- Déplacer les panneaux hors de la page de synchronisation ou changer leurs
  identifiants/handlers.

## Decisions

### 1. Nouveau module pur `site/sync-trust-guidance.js`

Le module expose un unique constructeur de vue, par exemple
`buildTrustGuidance(input)`, sans DOM, stockage, réseau ni IndexedDB. Il reçoit
un diagnostic déjà normalisé (`buildSyncDiagnostic`), la contribution workspace
(`buildWorkspaceDiagnostic`), l'étape d'onboarding, l'état d'activation et une
observation horodatée éventuelle. Il retourne des chaînes françaises et des
descripteurs d'intention prêts à rendre.

Pourquoi : isole toute la logique de vérité et de libellé des handlers, permet
des tests Node exhaustifs et évite qu'une modification de rendu change la
sémantique. Alternative écartée : mettre la logique dans `app.js`, non testable
sans DOM simulé et plus risquée pour les handlers existants.

Ordre de priorité des états (du plus bloquant au plus serein) :

1. liaison `MISMATCH`, `DESTINATION_MISMATCH`, `UNVERIFIED` ou cache masqué ;
2. erreur de stockage ou de lecture locale ;
3. erreur de permission, d'origine, de session ou réseau ;
4. hors ligne / pull initial en attente ou en échec ;
5. écritures en attente ou inconnues ;
6. Cloud non configuré ou activation/OTP en cours ;
7. synchronisation observée disponible.

Cet ordre garantit qu'un état masqué n'est jamais résumé comme « synchronisé ».
Les libellés exacts du résumé sont centralisés dans des constantes et testés :
« Local uniquement, enregistré sur cet appareil », « Copie locale IndexedDB
reliée à Dexie Cloud », « Données Cloud temporairement masquées, non présumées
perdues », « Date non disponible ».

### 2. Observation horodatée passive et attribuée

Le module fournit aussi des helpers purs :

- `shouldRecordSyncObservation(input)` : vrai uniquement si l'événement
  `syncComplete` vient d'être reçu, si la session est authentifiée, si la
  liaison courante est `BOUND`, si l'URL normalisée, le nom de base locale, le
  `remoteDbId` et le `userDigest` courants sont non nuls et concordent, si
  `persistedSyncState.initiallySynced === true` avec révision serveur connue,
  et si la phase native est `in-sync`.
- `buildSyncObservationRecord(input, now)` : enregistre
  `{version, url, databaseName, remoteDbId, userDigest, observedAt, source}`.
  `observedAt` est l'instant où l'événement attribuable est traité, jamais
  l'heure de chargement.
- `readSyncObservation(storage)` / `writeSyncObservation(storage, record)` :
  lecture/écriture tolérantes aux erreurs, sur une clé locale versionnée dédiée
  (`threadstep.sync-observation.v1`), non synchronisée.
- `resolveObservedSync(input)` : n'affiche la date que si l'observation stockée
  correspond exactement à l'URL, la base locale, le `remoteDbId` et le
  `userDigest` courants et que la liaison reste `BOUND` ; sinon
  `{available: false, label: "Date non disponible"}`.

Pourquoi : `persistedSyncState.timestamp` n'est pas un contrat public et ne
prouve pas l'attribution au workspace courant. L'événement natif observé dans le
code existant (`subscribeToChanges`) est le seul signal de réussite exploitable ;
il est déjà utilisé pour l'attestation et les écritures locales. Alternative
écartée : afficher `persistedSyncState.timestamp` directement — trop fragile et
non attribuable après changement de compte/URL. Alternative écartée : stocker la
date dans le registre de workspaces — modifierait son schéma validé par TS-045.

L'écriture d'observation est strictement passive : elle ne bloque pas
`load()`, ne modifie aucune table métier et échoue silencieusement en affichant
« Date non disponible ». La clé est additive ; son absence n'exige aucune
migration. En cas de rollback, l'ancienne version ignore simplement cette clé.

### 3. Hiérarchie DOM en trois questions et divulgation progressive

`site/index.html` reçoit, en tête de `#settings-sync-page` :

1. `#sync-trust-location` — « Où sont mes données ? » ;
2. `#sync-trust-evidence` — « Sont-elles synchronisées ? » ;
3. `#sync-trust-actions` — « Que puis-je faire maintenant ? ».

Les sections métier existantes restent dans le document avec leurs identifiants
uniques, mais sont enveloppées dans des `<details>` natifs, avec `<summary>`
accessible. Le diagnostic technique et les identifiants supplémentaires passent
sous un `<details id="sync-technical-info">` nommé « Informations techniques ».
Aucun contrôle n'est déplacé hors de sa section d'origine ni dupliqué.

Pourquoi : `<details>/<summary>` fournit gratuitement le clavier, le toucher,
`aria-expanded` et l'absence d'état JavaScript à maintenir. Alternative écartée :
accordéons JS avec `aria-expanded` manuel — plus de code, plus de risques de
désynchronisation et de focus. L'état replié n'est pas persisté : l'ouverture de
la page reste sans effet.

Le rendu utilise `replaceChildren` sur des conteneurs dédiés et des `<button>`
« Pourquoi ? »/« En savoir plus » avec `aria-expanded` et `aria-controls`. Les
zones de statut utilisent `role="status"`/`aria-live="polite"` avec un texte
complet, jamais une couleur seule. Les styles ajoutent des règles 320 px, des
cibles tactiles de 44 px et des libellés textuels d'état (`data-state` seulement
comme crochet visuel).

### 4. Checklist d'intentions sans nouveau handler

Le modèle retourne cinq intentions fixes, chacune avec les étapes filtrées par
l'état courant et un lien/renvoi vers le contrôle existant. Le rendu produit des
liens d'ancrage ou boutons de focus (`aria-controls`) qui ouvrent le `<details>`
concerné et focalisent le contrôle existant. Aucune intention n'appelle un
handler métier : les actions restent déclenchées par les boutons existants et
leurs confirmations.

Pourquoi : respecte « aucun transfert, relance, déconnexion ou purge
implicite » et évite une seconde source de vérité pour les opérations sensibles.
Alternative écartée : dupliquer des boutons d'action dans la checklist — viole
l'unicité des contrôles et le contrat TS-044.

Le contenu dangereux (purge, déconnexion, suspension) est présenté comme étape
de lecture avec la portée des copies et un renvoi vers la confirmation
existante ; la checklist ne pré-remplit ni ne pré-sélectionne rien.

### 5. Catalogue d'états explicite

Un dictionnaire pur associe chaque état à `{meaning, accessibleData,
maskedData, risk, safeAction, forbiddenActions}`. Les états non reconnus
tombent sur « état indéterminé » et n'inventent ni base vide ni perte. Les
messages d'erreur serveur bruts ne sont jamais utilisés : seules les catégories
de `classifySyncError` et les libellés contrôlés sont rendus.

### 6. Tests déterministes avant sync

Nouveau fichier `tests/ts-047-trust-guidance.test.mjs` couvrant au minimum :

- chaque libellé exact et chaque priorité d'état ;
- local / synchronisé / masqué / vide / erreur réseau / stockage / permission ;
- `UNVERIFIED`, `MISMATCH`, session expirée, hors ligne, pull en attente,
  écritures en attente ou inconnues ;
- cinq intentions et filtrage conditionnel ;
- absence d'action implicite : aucune intention ne référence un handler
  destructeur et les contrôles existants restent uniques ;
- observation attribuée, absence d'observation, événement tardif après changement
  de compte/URL/workspace, rechargement avec correspondance et sans
  correspondance, échec d'écriture ;
- absence d'email/OTP/token/`userId`/titre/note dans les sorties ;
- présence des trois questions, des `<details>` et de « Informations
  techniques » dans le HTML ; absence de duplication d'identifiants ;
- présence des règles 320 px, focus visible et cibles 44 px dans le CSS ;
- `npm run check` et `openspec validate ts-047 --strict --no-interactive`.

## Risks / Trade-offs

- **Un événement `syncComplete` peut arriver sans que tous les champs
  d'attribution soient encore à jour** → ne rien enregistrer ; l'UI affiche
  « Date non disponible ». Un test couvre l'événement tardif et le changement
  d'espace.
- **Une observation locale peut survivre à un changement de compte** → lecture
  conditionnée à la correspondance URL/base/`remoteDbId`/`userDigest` et à une
  liaison `BOUND` ; sinon masquage. Test de régression dédié.
- **La clé locale d'observation pourrait être considérée comme un nouveau
  stockage sensible** → elle ne contient que des identifiants techniques déjà
  présents dans le registre, plus un horodatage ; aucune donnée métier, aucun
  email/token. Elle n'est jamais synchronisée.
- **La restructuration HTML peut casser les sélecteurs des tests TS-043/TS-044**
  → conserver les identifiants et les contrôles, n'ajuster que les assertions de
  structure réellement modifiées par la spécification ; tests statiques dédiés
  à l'unicité.
- **Le résumé peut surcharger le premier écran** → trois blocs courts, détails
  repliés, pas de duplication du diagnostic ; tests de présence et styles
  compacts.
- **Une intention pourrait être perçue comme une action** → chaque étape est un
  texte ou un renvoi de focus ; aucune exécution au clic sur un titre
  d'intention ; les libellés disent explicitement « consulter » ou « ouvrir ».

## Migration Plan

1. Ajouter le module pur et ses tests sans toucher au comportement existant.
2. Ajouter la structure HTML et le rendu de la synthèse, en conservant les
   contrôles et handlers actuels.
3. Brancher l'observation horodatée sur l'événement natif existant, avec
   `try/catch` et absence de blocage.
4. Ajouter les styles accessibles et responsive.
5. Exécuter `npm run check` et la validation OpenSpec.
6. Recette manuelle multi-appareils séparée (hors checklist).

Rollback : retirer le rendu et la clé d'observation ; aucune donnée métier ni
schéma IndexedDB n'est modifié. La clé versionnée restante est inerte.

## Open Questions

Aucune question bloquante. La seule incertitude produit — la sémantique d'un
horodatage natif — est résolue par la règle « attribué ou Date non disponible »
et couverte par des scénarios et tests ; elle ne change ni les specs ni le
découpage des tâches.
