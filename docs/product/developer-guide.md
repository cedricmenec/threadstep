# ThreadStep — documentation développeur

**Application pilote, état 16 octobre 2026 :** TS-012, TS-013 et TS-014 livrées par les PR [#55](https://github.com/cedricmenec/threadstep/pull/55), [#58](https://github.com/cedricmenec/threadstep/pull/58), [#59](https://github.com/cedricmenec/threadstep/pull/59). La dernière CI et Pages sur `main` sont réussies. Les essais matériels demeurent distincts des tests Node.

## Architecture

ThreadStep est une application **statique**, en JavaScript vanilla sans build front-end ni backend. `site/index.html` expose les formulaires et les zones d'affichage ; `site/styles.css` gère le responsive ; `site/core.js` contient les fonctions pures du modèle ; `site/app.js` implémente le DOM, les événements, `IndexedDB` (via Dexie), JSON, focus, pointeurs, préférences locales et notifications.

```text
site/index.html
  ├─ site/styles.css
  ├─ site/app.js → site/core.js
  │             → site/dexie-foundation.js
  │             → site/vendor/dexie-cloud.mjs (Dexie.js + dexie-cloud-addon, buildé)
  ├─ site/dexie-foundation.js (validation d'URL, portail, schémas local et synchronisé)
  └─ site/vendor/dexie-cloud.mjs
        ↕ IndexedDB du navigateur (threadstep-local par défaut, threadstep si Cloud configuré)
        ↕ localStorage limité aux préférences et à la clé historique threadstep.document.v1
        ↕ import / export JSON explicites
GitHub Pages publie uniquement site/ ; aucune API produit
```

CSP `connect-src https://*.dexie.cloud wss://*.dexie.cloud` : seuls les hôtes Dexie Cloud sont joignables ; aucun contenu des tâches n'est transmis avant configuration et consentement. Les valeurs utilisateur doivent devenir des nœuds texte, jamais du HTML interpolé. Un export JSON personnel doit rester local à l'utilisateur.

## Socle Dexie Cloud (TS-024)

Le socle local-first est amorcé par `site/dexie-foundation.js` : `validateCloudUrl` n'accepte qu'une URL HTTPS sous `dexie.cloud` (validation purement syntaxique, sans réseau), `shouldOpenSyncedDatabase` et `cloudConfigureOptions` produisent `{ databaseUrl, requireAuth: true }` sans désactiver `nameSuffix`, et `dexieSchema` déclare une version entière explicite avec des magasins synchronisés à identifiants uniques `@id` (jamais `++id`). L'URL est conservée en local sous la clé non synchronisée `threadstep.cloud.config.v1`, distincte de `threadstep.document.v1` et absente de l'export JSON. `site/app.js` ne construit et ne configure la base **synchronisée** que derrière `shouldOpenSyncedDatabase` ; sans URL valide, il ouvre l'espace local autonome décrit ci-dessous et aucune instance Dexie Cloud n'est construite. Les dépendances `dexie` et `dexie-cloud-addon` sont épinglées dans `package.json`/`package-lock.json` et livrées en ESM local `site/vendor/dexie-cloud.mjs` (`npm run vendor:build`), sans CDN tiers à l'exécution. Aucun secret, fichier `dexie-cloud.key`/`dexie-cloud.json`, jeton d'administration ni URL d'instance imposée ne doit être livré.

## Persistance métier local-first (TS-025)

`site/persistence.js` est le module pur de persistance métier. Il projette le
document V1 en **entités fines** : un enregistrement `subjects` par sujet et un
enregistrement `items` par étape, avec identifiants stables globalement uniques,
`subjectId`, `parentId`, `order`, `priority`, `done`, `title` et `note`
facultative. `documentToRecords` et `recordsToDocument` reproduisent exactement
la forme JSON V1, donc l'export/import et les références `parentId` restent
inchangés. Les planificateurs de mutation (`planAddStep`, `planRenameSubject`,
`planPromoteStep`, `planReorderStep`, `planRemoveStep`, `planRestoreRemoval`,
`planImport`, etc.) réutilisent les fonctions pures de `site/core.js` puis
calculent un diff : ils ne produisent que les opérations `put`/`delete` des
enregistrements réellement modifiés, jamais un remplacement du document entier.
C'est ce qui évite qu'un appareil écrase l'édition indépendante d'un autre.

L'adaptateur de stockage est un contrat injectable `commit(operations)`.
`createMemoryStore` en fournit une implémentation en mémoire déterministe pour
les tests ; `createDexieStore` implémente au-dessus de Dexie une transaction
`rw` atomique, partagée par l'espace local autonome et l'espace synchronisé.
Une écriture est confirmée localement dès la validation de la transaction,
sans attendre d'accusé Dexie Cloud. Un échec IndexedDB est rejeté avec le type
d'erreur `local`, distinct du type `sync` : il n'est jamais présenté comme un
succès. La propagation multi-onglets passe par le canal de changement
(`BroadcastChannel` et l'abonnement aux changements Dexie), et non uniquement
par l'événement `storage`. Les préférences purement locales (`threadstep.resume.v1`)
restent hors des tables synchronisées et hors de l'export.

Une **garde de compatibilité** non destructive lit le document historique
`threadstep.document.v1` sans jamais le supprimer ni le réécrire de façon
destructive, et sans le transférer à Dexie Cloud sans consentement explicite :
en mode local, `site/app.js` affiche une notice de préservation et l'export
historique existant, sans conversion automatique. La conversion explicite
reste TS-033 et le transfert consenti vers une base synchronisée reste TS-037.
La recette navigateur, hors ligne, multi-onglets et IndexedDB réel reste une
validation manuelle.

## Espace local IndexedDB par défaut (TS-032)

`site/dexie-foundation.js` expose `LOCAL_DATABASE_NAME` (`threadstep-local`),
`localDexieSchema()` et `openLocalDatabase(Dexie)`. L'espace local utilise la
même version de schéma entière et les mêmes magasins `subjects`/`items` à
identifiants chaîne que le schéma synchronisé, mais il est ouvert par un
constructeur Dexie nu : aucun addon `dexieCloud`, aucun `db.cloud.configure()`,
aucun OTP et aucune requête réseau. Le nom reste distinct de la base
synchronisée `threadstep` afin qu'enregistrer une URL Cloud plus tard ne
rattache ni ne copie automatiquement les données locales.

Au démarrage sans URL Cloud valide, `site/app.js` ouvre cet espace local et
rend la vue métier immédiatement, sans contrôleur d'authentification. Toutes
les lectures, créations, éditions, suppressions, réordonnancements, imports et
exports passent par `createDexieStore(...)` et une transaction IndexedDB. Une
confirmation locale n'est affichée qu'après validation du commit ; un échec
d'ouverture, de lecture ou de transaction affiche une erreur locale distincte
d'une erreur réseau, restaure la dernière vue confirmée et bloque les écritures
suivantes. Aucun repli silencieux sur `localStorage` n'est effectué pour les
données métier.

L'export JSON est reconstruit depuis les enregistrements IndexedDB confirmés
via `recordsToDocument`, conserve la forme V1 et n'inclut ni URL Cloud, ni OTP,
ni identifiant, ni secret. La clé historique `threadstep.document.v1` n'est ni
lue comme stockage métier, ni supprimée, ni renommée, ni convertie
automatiquement ; elle reste exportable à l'identique via
`availableLocalBackup(localStorage)`. Les exports V1 existants restent
importables. La conversion explicite des données historiques est planifiée par
TS-033 ; le transfert vers une base synchronisée après consentement reste TS-037.

## Migration du document historique (TS-026)

`site/migration.js` est le module pur de conversion du document
`threadstep.document.v1` vers les tables synchronisées. `detectHistoricalDocument`
lit la clé historique et n'accepte le document que si `parseDocument` le valide :
une valeur absente, illisible ou invalide ne déclenche aucune migration et laisse
la source intacte. `describeMigration` présente la destination Dexie Cloud, le
nombre de sujets et d'étapes transférés et l'effet de synchronisation à venir
**avant** toute demande de consentement.

`planMigration` projette le document via `documentToRecords`, remappe les
identifiants historiques de façon déterministe, stable et injective
(`mapLegacyId`, préfixe documenté) en suivant les `parentId` et `subjectId`, puis
ne produit que les opérations `put` des enregistrements manquants : un
enregistrement déjà identique n'est jamais réécrit, une base déjà migrée ne
produit aucune opération (**idempotent**), un identifiant présent avec un contenu
différent est signalé comme collision et une base cible non vide est signalée
sans écrasement. `runMigration` n'appelle `commit(operations)` qu'après un
consentement explicite (`{ confirmed: true }`), en une seule opération atomique,
et abandonne si la destination a changé entre la divulgation et l'écriture : le
changement d'URL n'importe jamais implicitement une base dans une autre. Aucun
chemin n'appelle `removeItem(STORAGE_KEY)` ni ne réécrit la valeur historique de
façon destructive, donc après un refus, une exception ou une interruption, la
source reste lisible, exportable et **non destructive** pour la cible. La
préférence locale de reprise reste hors des tables synchronisées.

## Conversion locale explicite du document historique (TS-033)

`site/local-migration.js` convertit un document `threadstep.document.v1` valide
vers l'espace local autonome `threadstep-local` **sans construire ni configurer
d'instance Dexie Cloud**, sans OTP, sans requête réseau et sans push. La
conversion n'est jamais automatique : `detectLocalSource` lit la valeur brute et
calcule son empreinte SHA-256 via `site/fingerprint.js`, puis
`planLocalConversion` présente la destination, l'inventaire source, l'inventaire
de la cible, les insertions absentes et l'empreinte examinée avant tout
consentement. Une source absente, illisible ou invalide ne produit aucun plan et
aucune écriture.

La projection conserve sujets, étapes, sous-étapes, relations `subjectId` et
`parentId`, ordre, notes, priorités, états `done` et la préférence locale de
reprise. Le mapping local est idempotent : un identifiant déjà préfixé
`legacy:` n'est jamais préfixé une seconde fois. `runLocalConversion` relit la
source et la cible, exige un consentement lié à l'empreinte du plan, puis
commite une seule fois. Un refus, une source modifiée, une cible modifiée, une
collision ou un échec de transaction n'écrit rien ; une seconde exécution ne
crée aucun doublon. La provenance non synchronisée `threadstep.migration.v1`
enregistre l'empreinte, la version de mapping, la cible et les comptes, sans
aucun titre ni note, et distingue « conversion locale terminée » d'une
activation Cloud.

Le scénario de recette de référence est un document V1 de **5 sujets et
18 étapes**, retrouvé après rechargement sans Cloud, avec la source
`threadstep.document.v1` et son export de secours **non destructifs** et
identiques. Le transfert local vers une base synchronisée, l'OTP et tout push
restent hors de cette conversion et relèvent de **TS-037**.

## Réconciliation Dexie Cloud d'une base déjà peuplée (TS-031)

`site/migration-reconciliation.js` est le cœur pur, déterministe et sans DOM
de la réconciliation entre un document `threadstep.document.v1` (ou une
sauvegarde JSON) et une base Dexie Cloud authentifiée. Avant toute lecture de
la cible, `evaluateSyncAttestation` exige une **synchronisation initiale
attestée** par les signaux natifs (`syncState`, `persistedSyncState`,
utilisateur, `remoteDbId`, `serverRevision`, realms et URL). Hors ligne, session
refusée, sync initiale en attente, état indéterminé ou lecture IndexedDB en
erreur bloquent la planification : une IndexedDB vide n'est jamais interprétée
comme un Cloud vide. `withAttestedTarget` n'appelle le lecteur de cible
qu'après cette attestation et transforme un échec de lecture en `read-error`
explicite.

L'inventaire `buildInventory` sépare les magasins `subjects` et `items`, compare
uniquement les champs métier (titre, note, priorité, `done`, ordre, `subjectId`,
`parentId`) et ignore les métadonnées natives `owner`, `realmId` et `$ts`. Il
classe chaque enregistrement en `identical`, `absent-in-cloud`, `conflict`,
`cloud-only` ou `invalid`. L'ordre est comparé **relativement** aux
enregistrements source mappés, afin que des enregistrements propres au Cloud
intercalés ne créent pas de faux conflit.

`planReconciliation` produit uniquement des opérations `add` : les groupes
indépendants absents sont insérés, les enregistrements identiques et propres au
Cloud ne sont jamais réécrits, et un conflit non résolu ne bloque que sa branche
dépendante. Pour chaque divergence, le plan propose **conserver la version Cloud** (`keep-cloud`) ou **importer la version
historique comme copie** (`import-copy`). Les copies reçoivent
un identifiant déterministe dérivé de la source et de la destination, sont
vérifiées avant insertion et remappent parents et descendants ; une seconde
exécution reconnaît la copie déjà appliquée. Aucun `put`, `delete` ni écrasement
n'est planifié, et les quotas de 40 sujets / 500 étapes par sujet restent
appliqués.

Chaque plan porte une empreinte canonique de la source, de l'URL et de la base
distante, de la session utilisateur, de la projection de la cible et des
résolutions. `runReconciliation` refuse, **sous la couche de migration et pas
seulement dans l'interface**, tout consentement absent ou lié à un autre plan,
puis revalide l'attestation et ces empreintes juste avant de confier les
insertions à un adaptateur atomique. Une évolution de source, destination,
session, cible, conflit ou connectivité produit `stale-plan` sans écriture.
L'adaptateur Dexie utilise une transaction `rw` et `add` uniquement : une
collision tardive, une panne ou une interruption ne laisse aucun demi-groupe et
n'annonce jamais un succès distant.

`reduceReconciliationStatus` distingue écrit localement, synchronisation en
attente, hors ligne en attente, synchronisé et erreur de synchronisation. Un
commit IndexedDB reste « écrit localement » ; seul un `syncComplete` natif
ultérieur avec attestation saine peut produire « synchronisé ». L'interface
`site/app.js` affiche l'inventaire, la destination, les conflits et les champs
différents avec `createElement`/`textContent` uniquement (pas d'`innerHTML`), des
`fieldset`/radios accessibles, un contrôle de consentement explicite distinct de
l'OTP et une zone `aria-live`. L'import JSON Cloud réutilise exactement ce plan
et ces protections ; l'import JSON local sans Cloud conserve sa confirmation et
son remplacement actuels. La clé `threadstep.document.v1` et les exports JSON ne
sont jamais supprimés, et aucun changement d'URL ne copie implicitement une base
vers une autre.

La recette réelle Chrome mobile, tactile, clavier, lecteur d'écran, première
synchronisation, propagation réseau et copies sur une instance Dexie Cloud
**isolée** reste manuelle : les tests Node ne prouvent pas le comportement
distant.

## Diagnostic de synchronisation et relance native (TS-034)

`site/sync-diagnostics.js` est le cœur pur et injectable du diagnostic Dexie
Cloud. Il expose séparément la session, la connexion, la phase native, le pull
initial, la base configurée (URL normalisée et `remoteDbId` disponible), les
erreurs classées et le statut des écritures locales, ainsi qu'une preuve
distante calculée avec l'attestation existante. Cette vue est strictement en
**lecture seule** : elle ne lit aucun enregistrement métier, ne modifie rien et
ne construit aucun état `connected` simulé.

Les valeurs transitoires `connecting`, `pulling` et `pushing` ne deviennent
jamais des erreurs permanentes ; les statuts absents, inconnus ou contradictoires
restent `indeterminate`. Un pull initial n'est `complete` qu'avec
`initiallySynced === true` et une révision serveur connue. Un échec, une lecture
impossible ou un état indéterminé n'est jamais interprété comme une base
distante vide : le message l'affirme explicitement et aucune migration ni import
n'est déclenché.

`classifySyncError` n'inspecte que des champs stables (`name`, `code`,
`messageCode`, `httpStatus`, `status`, `license.status`) et projette une
catégorie et un code issus d'une liste fermée. Les messages d'erreur bruts, les
emails, OTP, jetons, titres et notes ne sont jamais rendus, journalisés ni
sérialisés. La vue n'affiche qu'une catégorie de session, jamais l'email ni
l'identifiant utilisateur brut.

`reduceLocalWriteStatus` distingue une écriture locale confirmée (IndexedDB),
une synchronisation en attente, une synchronisation prouvée par un état natif
`in-sync` avec pull initial terminé, et une erreur. Un commit local n'est jamais
présenté comme `synced` ; une erreur de synchronisation ultérieure conserve la
preuve locale et affiche l'erreur séparément. Le diagnostic suit
`currentUser`, `syncState` et `persistedSyncState`, y compris après rechargement
ou reprise de session.

La relance contrôlée du pull initial appelle uniquement
`db.cloud.sync({ purpose: "pull", wait: true })`, une seule fois, après avoir
vérifié que la base est configurée, la session authentifiée, le réseau
disponible et qu'aucun échange n'est en cours. Elle ne se connecte pas, n'importe
rien et n'écrit aucune donnée produit ; un échec reste `failed` ou
`indeterminate` et ne conclut jamais à un Cloud vide. Le panneau mobile utilise
un `<dl>` accessible, une zone `aria-live` et un bouton de relance d'au moins
44 px, opérable au clavier. Sans Cloud configuré, il indique que la
synchronisation n'est pas activée sans construire d'instance synchronisée.

Les tests Node couvrent tous les statuts et phases natifs, les sessions, les
erreurs, la rédaction, les transitions local/pending/synced, la relance et le
rendu statique. La recette réelle OTP, Chrome mobile, coupure réseau, droits,
origine et premier pull sur une instance Dexie Cloud **isolée** reste manuelle.

## Authentification OTP email native (TS-027)

`site/authentication.js` est le module pur de la connexion : `signInMethods`
n'expose que la méthode email/OTP native, `deriveAuthState` déduit l'état
(chargement, authentifié, déconnecté, expiré, première connexion hors ligne,
refusé), `canAccessBusiness` conditionne tout accès métier, et
`classifyAuthFailure`/`classifyPermissionFailure` traduisent les codes natifs
en messages français fixes, sans jamais rendre le corps brut d'un fournisseur.
`createAuthController` orchestre ces états au-dessus d'un adaptateur injecté et
n'appelle `login({ grant_type: "otp" })` qu'après une action explicite de
l'utilisateur, avec l'adresse déjà saisie lors d'un nouvel envoi.

Dans `site/app.js`, l'adaptateur natif appelle `db.cloud.login` avec le grant
OTP forcé, s'abonne à `db.cloud.currentUser` et `db.cloud.userInteraction`, et
relaie la saisie email/code aux callbacks natifs. **Indispensable :**
`cloudConfigureOptions()` active `customLoginGui: true` en plus de
`requireAuth: true`, sinon Dexie Cloud n'utilise pas le contrat
`userInteraction` de ce formulaire. Cet oubli a été identifié lors d'une
recette manuelle : clic sur « Recevoir un code », aucun email et aucun retour
visible. Les tests unitaires anciens validaient le contrôleur simulé, mais
pas le branchement complet requis par le fournisseur. Aucun `fetchTokens`, aucun
point d'échange de jetons applicatif, aucun backend et aucun appel `fetch` ne
sont introduits : l'authentification et la réplication parlent directement à
Dexie Cloud. Aucun fournisseur alternatif n'est proposé, même si le service en
expose.

Une base configurée avec `requireAuth: true` n'affiche les outils métier, ne
charge le document, ne s'abonne aux changements, ne propose la migration TS-026
et n'écrit qu'après un état authentifié. Une session valide est réutilisée au
rechargement sans nouveau code ; une session expirée réaffiche la connexion avec
un message dédié. La clé locale non secrète `threadstep.auth.seen.v1` sert
uniquement à distinguer « session expirée » de « première connexion » et ne
contient ni identité, ni code, ni jeton. Sans session, hors ligne, aucun échange
OTP n'est lancé et la première connexion est refusée avec un message explicite ;
la connectivité n'est jamais une preuve d'authentification. Un refus de droits,
d'origine ou d'identité est présenté tel quel, sans nouvelle tentative avec une
autre identité, sans contournement et sans suppression des données locales.

Les permissions `owner`/`realmId`, l'origine autorisée et la configuration de la
base restent des décisions du service Dexie Cloud : l'application ne fabrique ni
n'écrase ces champs et n'ajoute aucune règle d'accès de secours. **Procédure
opérateur hors build :** ajouter l'origine GitHub Pages du site à la liste des
origines autorisées de l'instance isolée dans la console Dexie Cloud, puis
vérifier la connexion sur cette base de test. Aucune URL d'instance, clé CLI ou
valeur privilégiée n'est enregistrée dans le dépôt, le bundle ou la
documentation publique. La réception réelle d'un OTP, les tests multi-appareils,
le clavier, le lecteur d'écran et l'isolation entre deux identités restent une
recette manuelle sur base isolée.

**Incident Chrome mobile de connexion (18/10/2026, TS-027) :** même après
activation de `customLoginGui: true`, un clic peut sembler inerte lorsque
`currentUser` reste en `loading` ou que Dexie Cloud demande une confirmation
intermédiaire de l'email sans changer l'affichage du formulaire. Le bouton
utilise un événement `click` explicite (en plus de Enter/`submit`),
`startSignIn` accepte un déclenchement **uniquement sur action de
l'utilisateur** même pendant `loading`, et l'interaction `email` native est
soumise une seule fois avec l'adresse déjà validée. Les alertes du fournisseur
restent visibles et n'entraînent aucune nouvelle authentification. Le champ
OTP accepte aussi les codes **alphanumériques** natifs au lieu d'imposer huit
chiffres. Les tests unitaires vérifient ces cas sans preuve de délivrance
réelle d'email. La recette sur Chrome mobile + instance Dexie Cloud doit
encore confirmer les échanges réseau, l'origine autorisée et l'absence de
régression sur les données locales.

**Protection des données pendant une panne d'authentification :**
l'interface masque les outils métier avant connexion, sans effacer le
`localStorage`. Si une sauvegarde historique `threadstep.document.v1`
est encore lisible dans **cette origine et ce navigateur**, la page de
connexion affiche le nombre de sujets/étapes retrouvés et permet un
**export JSON de secours sans session**. Celui-ci télécharge le texte exact
de la clé historique : il ne déclenche ni import, ni ouverture d'IndexedDB,
ni migration, ni envoi au Cloud. Conserver tout export externe déjà effectué.
Si aucune donnée V1 n'est présente sur cette origine, le bouton n'apparaît
pas : cela ne prouve pas que les données sont supprimées d'une autre origine
ou d'une IndexedDB. Une absence d'email malgré la configuration correcte
nécessite ensuite le contrôle opérateur de l'origine autorisée Dexie Cloud,
la connectivité et la réception email réelle. Ne pas purger le navigateur ni
importer un backup dans une base potentiellement déjà peuplée avant diagnostic.

## Modèle de données

- Document versionné `threadstep.document.v1` dans le `localStorage`.
- Un document contient des **sujets** ordonnés ; chaque sujet contient un tableau `items`.
- Une action principale possède `parentId: null` ; une sous-tâche possède `parentId` égal à l'ID de son action principale. **Un seul niveau** d'imbrication.
- L'ordre des priorités est `urgent`, `normal`, `later`. À priorité égale, la position dans le tableau `items` détermine l'ordre. Réordonner un parent n'arrache pas ses enfants.
- Une action possède ID stable, titre, priorité et `done`. Le réordonnancement ne modifie que l'ordre dans le tableau : pas de nouvelle clé, pas de migration de schéma.
- La sélection de « Je reprends ici » est une préférence locale distincte, non exportée. L'état des parents repliés et la suppression annulable pendant 10 secondes sont éphémères par onglet ; ne pas les persister dans le document.

Les formats et leurs validations se trouvent dans `site/core.js` et `tests/core.test.mjs` ; consulter leur code avant toute migration.

## Fonctionnalités et contrats

| Besoin | Implémentation / comportement |
| --- | --- |
| Sujets et actions, priorité, terminer, modifier | `site/app.js` appelle les fonctions pures de `site/core.js` ; les données sont sauvegardées automatiquement |
| Une sous-tâche par parent | `parentId` et `visibleItems` ; filtre de complétion appliqué à l'affichage |
| Actions principales, ordre manuel | TS-011 : drag/pointer + « Monter / Descendre », même sujet et priorité |
| Repli des sous-tâches | TS-012/TS-021 : `expandedParents` par onglet (défaut replié), `substepView`, `toggleExpandedParent`, `isViewEntry`, `substepAncestorId`, `aria-expanded` |
| Libellé du repli | TS-013 : `substepToggleLabel`, « Voir N sous-tâches » **lorsque replié**, « Masquer les sous-tâches » **lorsque déplié** ; décompte des enfants visibles |
| Sous-tâches, ordre manuel | TS-014 : `reorderWithinPriority` et `moveWithinPriority` opèrent dans le groupe **même parent + même priorité**, sans déplacer d'autres groupes |
| Masquer les étapes terminées | Filtre visuel, ne modifie pas les données ; interdit les réordonnancements tant qu'il est actif |
| Retrait/annulation | TS-010 : suppression immédiatement persistée, retour arrière 10 secondes dans l'onglet (si non invalidé) |
| Suggestion / reprise | Calcul déterministe de la prochaine action ; suivi « Je reprends ici » distinct, fondé sur des IDs stables |
| Export/import JSON | Sauvegarde manuelle portable ; import contrôlé et confirmé avant remplacement |

Les sous-tâches masquées par repli **existent toujours** et conservent leur ordre ; une actualisation ou une entrée dans une vue replie les parents mais garde les réordonnancements sauvegardés.

## Développer et tester

```sh
npm run check
npm test
npm run backlog:check
node --check site/core.js
node --check site/app.js
```

La suite est basée sur `node --test tests/*.test.mjs`. Ne pas modifier `backlog/index.json` à la main : régénérer via `npm run backlog:index` après une fiche nouvelle/modifiée. Les changements UI doivent être testés sur ordinateur et mobile, avec clavier, lecteur d'écran si possible et viewport étroit : les tests Node purs ne simulent pas toute l'accessibilité du navigateur.

Toutes les modifications passent par une branche et PR ; les workflows CI et Pages fournissent une preuve indépendante après fusion. Les tâches produit `TS-NNN` sont spécifiées sous `backlog/tasks/` ; les spécifications canoniques OpenSpec vivent sous `openspec/specs/`, leur historique sous `openspec/changes/archive/`.

## Frontières de sécurité et évolution

**État courant du pilote :** le socle de configuration Dexie Cloud (TS-024), la persistance local-first (TS-025), la migration historique (TS-026), l'authentification OTP email native (TS-027) et l'espace local IndexedDB par défaut (TS-032) sont intégrés ; l'indicateur de synchronisation, la purge locale et la consolidation de la recette restent à livrer (TS-028 à TS-030). Sans URL valide, aucune base synchronisée n'est construite : la vue métier lit et écrit l'espace local `threadstep-local`. La CSP n'autorise que les hôtes Dexie Cloud, et aucun appel n'est émis en mode local. La clé `threadstep.document.v1` et ses exports restent préservés ; sa conversion explicite relève de TS-033 et le transfert consenti de TS-037.

**Cible Dexie Cloud et bascule locale :** la
[spécification normative](specs/dexie-cloud-local-first.md)
autorise et exige dans son périmètre IndexedDB/Dexie.js,
authentification OTP email native et synchronisation.
Le [plan de livraison](dexie-cloud-rollout.md) demande des origines
et URL contrôlées, une CSP adaptée sans ouverture superflue,
aucun secret côté client, une migration non destructive et
le consentement avant transfert des anciennes données.
Les clés OpenRouter restent réservées à la **factory** sur GitHub
Actions. Aucun format JSON incompatible ne doit être livré
sans migration et vérification explicites.

## Documentation liée

[Guide utilisateur](guide-utilisation.md) · [Exigences MVP historiques](mvp.md) · [Cible Dexie Cloud](specs/dexie-cloud-local-first.md) · [Recette fonctionnelle](acceptance-checklist.md) · [Vision](vision.md) · [Architecture générale](../architecture.md) · [ASF développeur](../factory/developer-guide.md).


## Correctif de persistance et reprise TS-025 à TS-027 (18/10/2026)

La source de vérité d'une instance Dexie Cloud **authentifiée** est désormais
`IndexedDB` (tables `subjects` et `items`) ; l'ancienne clé
`threadstep.document.v1` est préservée comme historique **non modifié**, sans
transfert automatique. Après un OTP ou un rechargement, `db.open()` déclenche la
restauration native de session, puis l'interface lit les tables dans une
transaction cohérente. Les évènements `db.cloud.events.syncComplete` déclenchent
une nouvelle lecture, tout comme les messages multi-onglets.

Le modèle historique produit des IDs UUID stables et `legacy:<id>` lors de la
migration. Dexie Cloud refuse ces identifiants sur des stores `@id` (réservés
aux IDs générés de trois lettres). La version locale passe à **2** avec des
clés primaires explicites `id` : elle conserve les mêmes keyPaths IndexedDB,
les anciens IDs et les relations ; aucune purge ni copie cross-instance.
Une base Cloud dont le schéma serait *scellé* peut nécessiter une modification
**opérateur** du schéma de service avant le premier push : ne jamais contourner
une erreur d'autorisation en reconfigurant silencieusement l'instance.

Une mutation n'est annoncée comme « enregistrée dans IndexedDB » **qu'après
validation de la transaction** ; un échec bloque les écritures suivantes et
restitue la dernière vue confirmée. Les états Cloud ne sont pas inventés :
une transaction locale ne prouve jamais un push distant.
L'import JSON dans une base synchronisée exige une confirmation explicite
indiquant l'URL du Cloud, ne vise qu'une base cible vide, utilise le plan de
migration idempotent et ne modifie pas l'export source. La migration historique
réévalue la cible avant le commit. Un échec de lecture IndexedDB bloque
l'import et la migration : il n'est plus interprété comme une base vide.

**Recette manuelle indispensable :** sur une base Cloud isolée et une origine
Pages autorisée, vérifier l'OTP sur Chrome mobile, le reload sans nouveau code,
l'import consenti puis la réapparition des sujets, le push/pull sur un deuxième
appareil, l'absence de collisions et le comportement d'une base Cloud scellée.
Les tests Node et CI ne vérifient pas le réseau distant ; conserver les exports
originaux jusqu'à confirmation du round-trip inter-appareils.


**Limites de recette automatisée pour le correctif de persistance :**
`site/synced-records.js` fournit une lecture atomique vérifiable avec un
adaptateur Dexie simulé et refuse erreurs et références orphelines. Les
métadonnées natives `owner`, `realmId` sont écartées **uniquement de la vue
métier** ; aucune permission n'est modifiée. Un import/migration est effectué
avec `add` transactionnel (jamais `put`) afin de refuser une collision
intervenue après la relecture du plan. Il faut encore effectuer la recette
sur Dexie Cloud réel avec un schéma de serveur autorisant les clés `id`.
