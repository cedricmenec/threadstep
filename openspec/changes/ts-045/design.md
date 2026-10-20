# Design

## Context

Voir [proposal.md](proposal.md) pour le problème et la valeur attendue. Le
bootstrap actuel de `site/app.js` lit la configuration Cloud et l'attestation
d'activation, initialise le registre d'espaces, ouvre la base synchronisée puis
restaure la session native. La liaison de compte est ensuite évaluée dans
`refreshAccountBinding` à partir de `currentUser`, du nombre d'enregistrements
locaux et de l'entrée de registre. `site/workspace-identity.js` porte déjà
l'isolation, la récupération isolée et le diagnostic expurgé ;
`site/sync-diagnostics.js` porte les états natifs et la preuve distante.

Constats de code qui motivent l'investigation, sans être déclarés causes
racines de l'incident :

- le registre et l'attestation d'activation sont deux sources locales
  distinctes ; une entrée de registre sans `userDigest` n'est pas réalimentée
  depuis une attestation cohérente ;
- `registerWorkspace` conserve le `userDigest` existant mais pas le
  `remoteDbId` existant lors d'un ré-enregistrement ;
- un échec d'écriture de la liaison n'empêche pas la session courante de lire
  les données, mais peut produire un cache peuplé non vérifié après reload ;
- l'évaluation de liaison dépend d'une identité native potentiellement retardée
  par rapport à l'état d'authentification ; `currentUser` et le `remoteDbId`
  persisté ne déclenchent pas directement une réévaluation de liaison ;
- le `remoteDbId` observé n'est pas comparé à la liaison dans le chemin normal
  de lecture métier ;
- le registre est réécrit en bloc sans relecture, ce qui expose les onglets
  concurrents à des écrasements de champs.

## Goals / Non-Goals

**Goals:**

- Rendre la séquence de bootstrap et de liaison observable, reproductible et
  expurgée, avec une classification stable des causes de `UNVERIFIED`.
- Garantir qu'une liaison déjà attestée sous le même compte, la même URL et la
  même base effective est relue avant toute lecture métier, sans nouvelle copie
  locale ni récupération automatique.
- Ne corriger que les mécanismes reproduits par un test déterministe, tout en
  laissant une catégorie indéterminée honnête pour l'incident non reproduit.
- Préserver sans affaiblissement toutes les protections de compte, destination,
  mutations en attente, purge, export et transitions d'espace.

**Non-Goals:**

- Prouver en CI une authentification OTP réelle, une synchronisation Dexie Cloud
  réelle ou une convergence entre deux appareils.
- Modifier le schéma IndexedDB, le format de sauvegarde ou les consentements.
- Reconstruire l'interface du diagnostic (TS-047) ou rédiger le guide
  utilisateur (TS-046).
- Déduire un compte, une destination ou un consentement à partir d'un simple
  état natif transitoire.

## Investigation hypotheses

Ces hypothèses sont à confirmer ou infirmer pendant `apply` par des fixtures
déterministes. Aucune n'est présentée comme cause racine avant reproduction.

| Hypothèse | Chemin à reproduire | Preuve attendue | Décision si confirmée |
| --- | --- | --- | --- |
| H1 — perte du pointeur de liaison | registre sans `userDigest`, attestation d'activation cohérente pour la même URL | test pur de résolution d'attestation | réhydrater le registre, sans copier de données |
| H2 — écriture de liaison non durable | cache vide, authentification, `setItem` en échec puis reload | test avec stockage qui refuse l'écriture | ne pas autoriser la lecture métier tant que la liaison n'est pas relue |
| H3 — `remoteDbId` perdu au ré-enregistrement | `registerWorkspace` d'une entrée existante avec `remoteDbId` | test unitaire de registre | préserver les champs absents de l'entrée existante |
| H4 — identité native retardée | état authentifié avant émission de `currentUser` | test de rejeu d'événements | réévaluer avec génération monotone, sans état bloqué durable |
| H5 — onglets concurrents | deux read-modify-write successifs du registre | test de fusion avec relecture | fusionner les champs de liaison et refuser un écrasement divergent |
| H6 — cache réellement non attesté | cache peuplé sans digest dans aucune source | test de classification | conserver le blocage et la récupération explicite |
| H7 — cause non reproductible | séquence instrumentée incomplète ou contradictoire | test de classification indéterminée | conserver le blocage, exposer `indéterminée`, ne pas inventer |

## Decisions

### 1. Le registre reste l'autorité de liaison, l'attestation d'activation est une source de réhydratation contrôlée

La résolution lit d'abord l'entrée de registre. Si elle porte un `userDigest`
valide, elle est autoritaire. Si elle ne porte pas de digest, une attestation
d'activation locale n'est adoptée que si son URL normalisée correspond, que la
base effective correspond au registre et que les `remoteDbId` disponibles sont
absents ou identiques. Un digest provenant uniquement du compte courant n'est
jamais adopté sur un cache peuplé.

*Alternative rejetée :* lier automatiquement un cache peuplé au compte
nouvellement authentifié. Cela contournerait l'isolation et la récupération
TS-035/TS-038.

### 2. Écriture de liaison idempotente, fusionnée et relue

Une écriture de liaison relit le registre courant, fusionne uniquement les
champs de liaison pour la même URL et la même base, refuse d'effacer un digest
ou un `remoteDbId` existant par une valeur absente, écrit une seule clé locale
puis relit pour vérifier. Un échec de relecture ou d'écriture est exposé et
laisse les données métier masquées ; il ne crée ni cache de récupération ni
nouvelle base.

*Alternative rejetée :* conserver une écriture en bloc sans relecture. Elle
perd des champs et ne prouve pas la durabilité de la liaison.

### 3. Évaluation de liaison ordonnée par génération et abonnée aux observables utiles

Chaque évaluation reçoit une génération monotone. Les événements retardés
`currentUser`, `persistedSyncState` (dont `remoteDbId`) et changements de
session déclenchent une réévaluation, mais un résultat d'une génération
antérieure ne peut ni rétablir un état périmé ni écraser une liaison plus
récente. Une identité encore indisponible produit un état indéterminé
transitoire, jamais une conclusion définitive.

*Alternative rejetée :* ne réévaluer que sur le changement d'état
d'authentification. Une identité native ou un `remoteDbId` plus récent resterait
ignoré.

### 4. Cohérence de destination sans dégrader une liaison locale déjà attestée

Si un `remoteDbId` est observable et diffère de celui de la liaison, les données
métier sont masquées, le diagnostic l'explique et aucune copie n'est faite. Si
aucune preuve distante fraîche n'est disponible (hors ligne, pull en attente),
une liaison locale déjà attestée reste lisible et la preuve distante reste
`indéterminée` ; cela ne doit pas déclencher la récupération isolée.

*Alternative rejetée :* exiger une preuve distante fraîche pour toute lecture
locale. Cela rendrait un espace déjà lié inutilisable hors ligne et confondrait
preuve distante et liaison locale.

### 5. Trace bornée expurgée et classifieur pur

Nouveau module `site/bootstrap-diagnostics.js` :

- une liste fermée de codes d'étape (`registry-read`, `base-open`,
  `session-restored`, `identity-observed`, `binding-evaluated`,
  `cache-read`, `initial-pull`, `remote-evidence`, `business-read`) ;
- des événements bornés (nombre maximal fixe) avec séquence monotone, horodatage
  relatif et valeurs booléennes/compteurs uniquement ;
- un classifieur pur produisant une catégorie stable et une origine
  (`historical-unverified`, `bootstrap-regression`,
  `identity-or-destination-change`, `indeterminate`) ;
- aucune URL brute, aucun digest, aucun identifiant, aucun texte libre, aucun
  titre, note, email, OTP ou jeton dans la trace sérialisée.

La trace courante est conservée localement sous une clé dédiée optionnelle,
écrasée au début d'un bootstrap. Une clé absente, illisible ou d'une version
inconnue produit une trace vide, jamais une erreur de démarrage ni une action
destructive.

*Alternative rejetée :* journaliser des messages natifs ou des identifiants
pour faciliter le diagnostic. Cela exposerait des données personnelles et des
secrets dans un dépôt et un site publics.

### 6. Diagnostic : liaison et preuve distante restent deux dimensions

`sync-diagnostics.js` expose la catégorie de bootstrap/liaison et sa nature
(historique, régression, changement d'identité, indéterminée) dans une ligne
distincte. Les libellés restent en français et en lecture seule. Un état
`in-sync`, un pull initial terminé ou une lecture locale réussie ne sont jamais
présentés comme une convergence métier ou inter-appareils.

*Alternative rejetée :* fondre la classification dans le statut global de
synchronisation. Cela ferait disparaître la distinction entre transport,
liaison et preuve métier.

### 7. Tests déterministes et frontière de recette

Les tests couvrent les modules purs, les séquences d'événements, les ordres
retardés, les échecs de stockage et les gardes statiques de `app.js`. Aucun test
CI n'ouvre de vraie base Dexie Cloud, ne demande d'OTP ni ne compare deux
appareils. La recette réelle reste dans `Manual acceptance` et la vérification
post-publication dans `Post-sync review`, sans case à cocher.

## Risks / Trade-offs

- **Une régression non reproduite reste inexpliquée** → L'instrumentation
  expurgée, la catégorie `indéterminée` et les tests de non-régression rendent
  l'état honnête et investigable ; aucune cause n'est inventée.
- **La réhydratation depuis l'attestation d'activation pourrait adopter une
  liaison obsolète** → Elle n'est acceptée que pour la même URL, la même base et
  des `remoteDbId` compatibles ; toute divergence reste bloquée.
- **Une nouvelle garde `remoteDbId` pourrait masquer des données hors ligne** →
  Seul un `remoteDbId` effectivement observé et différent bloque ; l'absence de
  preuve fraîche ne dégrade pas une liaison attestée.
- **Une trace locale pourrait contenir une donnée sensible** → Liste blanche de
  codes, tests de rédaction, taille bornée et aucune sérialisation libre.
- **Des écritures concurrentes de registre pourraient encore se chevaucher** →
  Relecture-fusion avant écriture, conservation des champs présents, génération
  monotone et tests d'onglets concurrents ; au pire, l'état reste masqué et
  récupérable, sans suppression.
- **Les tests simulés pourraient être pris pour une preuve de convergence** →
  Le diagnostic et la documentation séparent explicitement preuve locale,
  preuve native et recette réelle sur instance isolée.

## Migration Plan

1. Ajouter la trace et le classifieur purs, puis les tests de rédaction et de
   bornage.
2. Ajouter la résolution d'attestation, la fusion/écriture vérifiée et la garde
   `remoteDbId` dans `workspace-identity.js`, avec tests de reproduction.
3. Brancher l'ordre bootstrap et les abonnements natifs dans `app.js`, puis
   vérifier les protections et les transitions existantes.
4. Exposer la classification dans le diagnostic et mettre à jour la matrice de
   régression et les tests concernés.
5. Exécuter `npm run check` et `openspec validate ts-045 --strict
   --no-interactive`.

Aucune migration de données n'est requise : aucune base n'est renommée, copiée
ou supprimée. La nouvelle clé de trace locale est optionnelle et peut rester
absente. Un retour arrière du code retrouve les bases et les liaisons existantes
sans perte. La récupération isolée reste la seule voie explicite pour un cache
réellement non vérifiable.

## Open Questions

- La cause exacte de l'incident du 20 octobre 2026 restera `indéterminée` si les
  fixtures ne la reproduisent pas. Cette question n'exige pas de trancher avant
  l'implémentation : le plan garantit que l'état restera bloqué, expurgé et
  instrumenté, et que la recette réelle sera rapportée séparément.
