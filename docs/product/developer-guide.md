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
        ↕ localStorage limité aux réglages techniques Cloud ; préférences dans le store IndexedDB local `meta` ; clé V1 retirée, inerte et supprimable seulement avec consentement
        ↕ import / export JSON explicites
GitHub Pages publie l'artefact Vite dist/ généré depuis site/ ; aucune API produit
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
par `serializeIndexedDbBackup` au format `threadstep.indexeddb-backup` et
n'inclut ni URL Cloud, ni OTP, ni identifiant, ni secret. La clé historique
`threadstep.document.v1` n'est ni lue comme stockage métier, ni supprimée, ni
renommée, ni convertie automatiquement. Un fichier `version: 1` est refusé
explicitement sans écriture. Le transfert vers une base synchronisée après
consentement reste TS-037.

## Sauvegarde IndexedDB modern et retrait V1 (TS-040)

`site/indexeddb-backup.js` est le contrat pur de sauvegarde. `serializeIndexedDbBackup`
projette directement les enregistrements `subjects`/`items` confirmés, triés par
identifiant, avec une liste blanche de champs métier. Le document produit déclare
`format: "threadstep.indexeddb-backup"`, `formatVersion: 1`, une provenance
`source: "indexeddb"` et `idsCanonical: true`, les compteurs et une empreinte
SHA-256. Les identifiants canoniques sont conservés tels quels, y compris ceux
qui commencent littéralement par `legacy:` ; aucun préfixe n'est ajouté ni retiré.

`parseIndexedDbBackup` est le seul lecteur des fichiers utilisateur. Il refuse
sans écriture un document `version: 1` (`unsupported-v1-backup`), un format
inconnu (`unknown-format`), une structure invalide, des identifiants dupliqués,
des références orphelines, un dépassement de quota, des compteurs incohérents ou
une empreinte erronée. Aucun parseur V1 de secours, aucune heuristique `legacy:`
et aucune conversion silencieuse ne subsiste dans les parcours d'import, de
fusion ou de restauration.

`site/local-migration.js` expose `planModernRecordsMerge` / `planModernLocalImport`
pour une fusion locale strictement additive : un enregistrement identique ne
produit aucune opération, un identifiant absent est inséré et un identifiant
existant au contenu différent bloque tout le plan. L'import Cloud utilise le même
jeu d'enregistrements via `planReconciliation({ records })`, avec le plan attesté,
la revue et le consentement existants.

La préférence de reprise et les métadonnées locales sont migrées de façon
idempotente depuis `threadstep.resume.v1` vers le store IndexedDB `meta`
(`site/local-metadata.js`). Une cible déjà peuplée reste autoritaire, une
écriture indisponible ne supprime jamais la clé historique et ne prétend pas
avoir rendu la préférence durable, et chaque workspace possède son propre store.
`meta` est déclaré dans `unsyncedTables` et n'apparaît jamais dans un export.

Le nettoyage de `threadstep.document.v1`, `threadstep.migration.v1`,
`threadstep.resume.v1` et `threadstep.migration.dismissals.v1` est facultatif,
limité à l'origine et au navigateur courants, et exige une sauvegarde IndexedDB
vérifiée dans la session, une migration terminée et une confirmation explicite.
L'option par défaut est « ne rien effacer » ; une annulation ou une erreur laisse
les valeurs intactes. Aucun démarrage, rechargement, login, synchronisation ou
changement d'espace n'appelle ce nettoyage.

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
l'interface masque les outils métier avant connexion sans effacer les données.
Aucune valeur `threadstep.document.v1` n'est lue comme sauvegarde métier et
aucun bouton d'export V1 n'est proposé. Les données métier restent dans
IndexedDB ; une absence d'email malgré la configuration correcte nécessite le
contrôle opérateur de l'origine autorisée Dexie Cloud, la connectivité et la
réception email réelle. Ne pas purger le navigateur ni importer un backup dans
une base potentiellement déjà peuplée avant diagnostic.

## Modèle de données

- Stockage métier exclusivement IndexedDB (`subjects`/`items`) ; la clé `threadstep.document.v1` n'est plus une source métier.
- Sauvegarde portable `threadstep.indexeddb-backup` (format versionné, provenance, compteurs, empreinte) exportée et restaurée depuis IndexedDB.
- Préférences locales dans le store IndexedDB `meta`, non synchronisé et jamais exporté.
- Un fichier V1 (`version: 1`) est refusé explicitement sans écriture.
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

La **certification E2E local-first et Cloud (TS-039)** est décrite dans
[e2e-certification.md](e2e-certification.md). `scripts/product/e2e-matrix.mjs`
produit un rapport CI déterministe sans réseau ni écriture, avec les classes de
preuve `ci`, `real-dexie`, `limitation` et `incident`. Ce rapport automatique ne
prouve jamais à lui seul une recette réelle : la recette sur instance Dexie
Cloud isolée, Chrome mobile, deux navigateurs, OTP réel, hors ligne et réseau
intermittent reste une observation manuelle distincte, consignée séparément.
Une CI verte ne doit pas être présentée comme une propagation distante ou une
accessibilité vérifiée.

## Outillage Vite et publication Pages (TS-057, ASF-WF-004)

Vite est une **dépendance de développement épinglée** (`vite@7.3.7`, sans `^` ni
`~`) installée par `npm ci`. Le code applicatif reste vanilla, sans framework.
`site/` est la source unique ; `dist/` est un artefact local non versionné
(présent dans `.gitignore`). **GitHub Pages publie désormais `dist/`**, construit
sur le runner à partir de `site/` par ASF-WF-004. L'ancienne publication `site/`
reste disponible comme option de retour arrière via PR sécurisée.

```sh
npm ci
npm run dev        # serveur de développement sous /threadstep/
npm run build      # artefact statique local dans dist/
npm run preview    # prévisualisation de dist/ sous /threadstep/
npm run verify:build    # deux builds comparés + inspection sécurité/chemins
npm run verify:servers  # preview et dev sous /threadstep/, puis arrêt des serveurs
npm run check      # suite existante, sans dépendre de Vite
```

`vite.config.mjs` fixe `root: "site"`, `base: "/threadstep/"`, une sortie
`dist/` absolue hors de `site/`, `publicDir: false`, `appType: "spa"` et des
noms d'assets déterministes. Les liens de navigation par fragment
(`#/`, `#/parametres`, `#/parametres/donnees`,
`#/parametres/synchronisation`, `#/sujet/<id>`) restent résolus par le routeur
existant ; ils ne dépendent d'aucune route serveur.

**Vendor Dexie.** `site/vendor/dexie-cloud.mjs` reste le prébundle local
versionné produit par `npm run vendor:build`. `site/app.js` l'importe
localement ; Vite l'isole dans un chunk unique `vendor-dexie-*` et injecte son
préchargement. Le `modulepreload` manuel obsolète a été retiré de
`site/index.html`. Aucun CDN, secret, fichier `dexie-cloud.key`/`dexie-cloud.json`
ni URL d'instance Dexie Cloud n'est embarqué par le build.

**CSP.** `site/index.html` porte la CSP de production, reprise à l'identique
dans `dist/` : `script-src 'self'`, `style-src 'self'`, `connect-src` limité aux
hôtes Dexie Cloud. Le serveur `dev` reçoit, uniquement en mode `serve`, une CSP
distincte autorisant le WebSocket HMR local (`ws://localhost:*`,
`ws://127.0.0.1:*`) et les styles injectés (`style-src 'self' 'unsafe-inline'`),
sans `unsafe-eval`. `preview` et le site publié conservent la CSP stricte ; la
dérogation de développement n'est jamais écrite dans `site/` ni dans `dist/`.

**Diagnostic des chemins cassés.** Servir l'artefact à la racine du domaine
(`/`) n'est pas une cible supportée : utiliser `/threadstep/`. Un 404 sur un
asset construit indique en général une base incorrecte ou un `dist/` obsolète ;
relancer `npm run build`, puis `npm run verify:build` et `npm run verify:servers`
qui vérifient chaque URL locale et chaque fichier référencé. Une vue vide alors
que le document charge correctement relève du routeur par fragment, pas d'un
chemin d'asset : comparer avec le site statique servi depuis `site/`.

**Retour arrière.** Si les ressources du site construit échouent en production,
si la CSP bloque une fonction critique ou si les données auparavant visibles
ne sont plus consultables, ne jamais purger IndexedDB ni réinitialiser Dexie.
Créer une PR ASF de retour arrière basée sur `main`, restaurer dans
`.github/workflows/pages.yml` la publication `path: site` (et réconcilier les
tests et documents de publication avec cet état), puis exiger la CI `check`
indépendante et la fusion normale sous protection `main`. Vérifier ensuite
Pages, l'URL publique et le chargement des ressources. Une annulation complète
de la PR ASF-WF-004 avec `git revert`, revue et CI, est également possible.
Aucun retour arrière ne touche les bases locales, la configuration Cloud ou
les exports JSON. Ne jamais pousser directement sur `main` ni contourner CI.


**Pipeline de publication ASF-WF-004.** Sur PR, le job indépendant `check`
installe les dépendances épinglées (`npm ci`) puis exécute `npm run check`,
`npm run build`, `npm run verify:build` et `npm run verify:servers`. Sur
`main`, Pages exige la validation, construit un nouvel artefact avec `npm ci`,
contrôle la reproductibilité, la CSP, les URLs préfixées `/threadstep/`,
les assets et l'unicité du vendor Dexie avant l'upload exclusif de `dist/`.
Le déploiement normal de Pages reste déclenché par push sur `main` ; une PR
non fusionnée ne publie rien. L'URL de contrôle est
`https://cedricmenec.github.io/threadstep/`. La réussite des tests et du
pipeline ne vaut pas recette Android ou authentification OTP réelle.

Les vérifications automatiques couvrent la reproductibilité, les chemins, la
CSP, le vendor et l'absence de fichiers sensibles. La comparaison visuelle,
mobile, clavier, lecteur d'écran, hors ligne, IndexedDB réelle, import/export,
restauration et Cloud/OTP reste une **recette manuelle** sur données de test et
un environnement Cloud isolé.

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

[Guide utilisateur](guide-utilisation.md) · [Exigences MVP historiques](mvp.md) · [Cible Dexie Cloud](specs/dexie-cloud-local-first.md) · [Recette fonctionnelle](acceptance-checklist.md) · [Certification E2E](e2e-certification.md) · [Vision](vision.md) · [Architecture générale](../architecture.md) · [ASF développeur](../factory/developer-guide.md).


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

## Provenance, récupération et réparation des références (TS-035)

TS-035 rend le mapping d'identités **provenance-aware** dans
`site/migration.js`. Chaque source est classée explicitement comme V1 brut,
export IndexedDB déjà projeté, export historique `legacy:legacy:` ou provenance
inconnue. Une source inconnue reste **ambiguë** et bloque toute écriture, avec
ou sans préfixe, jusqu'à une décision explicite : ni le titre, ni la
ressemblance, ni le retrait de `legacy:` ne prouvent une identité. La réponse
choisie entre dans l'empreinte du plan, donc changer d'avis invalide le
consentement précédent.

`site/data-integrity-recovery.js` fournit une taxonomie de lecture distincte :
`storage-unavailable`, `read-refused`, `projection-invalid`,
`not-visible-unauthorized` et `indeterminate`. Aucun de ces états ne devient un
espace vide, une base Cloud vide ou une synchronisation confirmée. Une
projection métier invalide ouvre une **consultation en lecture seule** : les
sujets cohérents restent lisibles, chaque anomalie est listée par code
(`dangling-subject`, `prefix-variant`, etc.) et aucune réparation automatique
n'est lancée au chargement.

L'**export brut de récupération** est distinct de la sauvegarde métier `threadstep.indexeddb-backup`. Il est lu
depuis les stores bruts, inclut les orphelins et les métadonnées utiles, expose
compteurs et empreinte, et exclut tokens, OTP, identifiants d'authentification
et secrets. Tant qu'une anomalie d'intégrité existe, la sauvegarde métier modern est
désactivée avec explication ; aucun enregistrement accessible n'est omis
silencieusement. La fixture de régression déterministe **5 sujets / 19 tâches
dont une orpheline** et les variantes `legacy:s1` / `legacy:legacy:s1` couvrent
ce diagnostic sans écrire.

Le plan de réparation est prévisualisable et déterministe : sources, cible,
destination/compte, variante d'identité, mapping proposé, changements
`subjectId`/`parentId`, champs métier préservés, groupes ambigus ou bloqués,
compteurs avant/après et empreinte. Un rattachement n'est proposé que si la
provenance sélectionnée fournit une identité unique ; l'application exige une
**sauvegarde de récupération vérifiée** (empreinte et comptes) et un
**consentement** lié au plan et à la destination (URL, `remoteDbId`, session,
droits/realms). Le commit ne modifie que les références planifiées, sans
suppression ni renommage massif, et reste idempotent après reprise.

La **convergence** reste prudente : un commit IndexedDB local ou un signal
`in-sync` seul ne prouve rien. Seul un pull natif attesté suivi d'une lecture
métier fraîche contenant les enregistrements réparés peut afficher une
convergence sur cet appareil ; la convergence sur un second appareil reste une
recette manuelle sur instance isolée. Aucun titre, note, email, OTP ou token
n'est journalisé : les événements exposent uniquement des codes et des comptes.

## Consentement lié au plan affiché et cycle de vie historique (TS-036)

`site/migration-reconciliation.js` expose `reviewDisplayedPlan`, qui compare le
**plan affiché** et un plan recalculé par statut, empreinte, opérations `add`
ordonnées et groupes bloqués. `site/app.js` conserve `displayedPlan` et
`previewFingerprint` au moment du rendu ; la confirmation utilise uniquement
l'empreinte réellement vue. Si la source, la cible, la destination, l'URL, le
`remoteDbId`, l'utilisateur, les droits/realms, les résolutions ou l'ordre des
insertions changent, l'ancien consentement est refusé, le nouvel inventaire est
affiché et l'adaptateur de commit n'est pas appelé. `runReconciliation` compare
aussi le plan frais fourni par la revalidation juste avant l'unique transaction
`add`, sans `put`, `delete` ni écrasement.

`site/migration-lifecycle.js` ne porte plus que la garde de génération et
l'ordonnancement du pied de page. Aucun panneau, écartement ou message de
migration V1 ne subsiste. Une erreur de stockage ou de lecture réelle n'est
jamais effacée par la disparition d'un état transitoire, et un résultat
asynchrone ancien ne remplace pas le diagnostic courant.

Le seul accès restant aux clés V1 retirées est l'inventaire de nettoyage de
`site/local-recovery.js`, qui lit leur présence sans parser leur valeur. Cet
inventaire ne déclenche ni écriture, ni trafic Cloud, ni conversion.

Le message de bas de page est réduit avec un propriétaire et une génération.
Une erreur de stockage ou de lecture réelle n'est jamais effacée par la
disparition d'un blocage de migration, un message de migration périmé ne
remplace pas un statut plus récent, et aucune réévaluation de migration
n'annonce une synchronisation distante non prouvée. Les messages de migration
sont remplacés uniquement par le statut vérifié du parcours actif.

Les tests Node déterministes couvrent l'invalidation du consentement, les
opérations réordonnées, les groupes bloqués, les écartements, les générations
concurrentes, la conservation de V1 et le footer. La recette Chrome mobile,
tactile, clavier, lecteur d'écran, second navigateur et Cloud réel demeure
manuelle sur une instance isolée.

## Activation Cloud depuis l'espace local (TS-037)

`site/cloud-activation.js` porte les règles pures de l'activation : machine à
états (`local`, `preparing`, `connecting`, `discovering`, `review`,
`transfer-pending`, `active`, `failed`, `cancelled`), marqueur local, routage de
démarrage, classification de cible, réduction de la première synchronisation et
prédicats d'isolation. Le module n'accède ni au DOM, ni à IndexedDB, ni au
réseau ; `site/app.js` injecte les signaux natifs `currentUser`, `syncState` et
`persistedSyncState`, les événements `online`/`offline` et les adaptateurs de
stockage.

Deux bases restent physiquement distinctes : `threadstep-local` est ouverte par
`openLocalDatabase()` sans addon Cloud, tandis que la base synchronisée
`threadstep` est ouverte séparément avec Dexie Cloud. Avant consentement,
l'assistant peut configurer l'URL, effectuer l'OTP natif et le premier pull sans
jamais écrire un enregistrement local dans une table répliquée.
`evaluateActivationIsolation` et `findPreConsentSourceWrites` vérifient que la
source, la cible et les opérations restent séparées.

Le marqueur `threadstep.cloud.activation.v1` (version 1, statut `activating`,
`cancelled` ou `active`, URL normalisée, `remoteDbId` facultatif, empreinte de
source et identité utilisateur hachée) ne contient aucun titre, note, email,
OTP, jeton ni identifiant brut. Au démarrage, un marqueur absent ou annulé ouvre
`threadstep-local`, un marqueur `activating` ouvre la base synchronisée pour la
reprise, et une configuration Cloud héritée sans marqueur reste active. Le
bouton d'annulation avant consentement écrit `cancelled` et revient à l'espace
local sans purge ; après le commit local, l'annulation reste
`transfer-pending` et n'affirme pas annuler la copie synchronisée.

La source locale est lue en transaction `r`, projetée avec `recordsToDocument()`
et déclarée `indexeddb-export`. Le plan est construit par `planReconciliation()`
puis affiché (`destination`, `remoteDbId`, compteurs, insertions `add`, conflits,
groupes bloqués). La confirmation réutilise `reviewDisplayedPlan()` et
`runReconciliation()` : une source, cible, URL, session, résolution ou version
de plan différente refuse le commit sans écriture.

La classification de cible est fermée par défaut : `verified-empty` exige une
lecture distante attestée avec pull initial et révision serveur ; une erreur de
lecture, un cache vide, un état hors ligne ou une identité/URL/`remoteDbId`
incohérent donne `unavailable` ou `identity-mismatch`, jamais une cible vide.

`reduceFirstSync` distingue `local-written`, `pending`, `remote-complete`,
`error` et `indeterminate`. Un `in-sync` générique ne vaut pas preuve de
propagation par enregistrement ; un échec après le commit conserve la preuve
d'écriture locale et n'annonce aucun push réussi. Les tests déterministes
`tests/ts-037-activation.test.mjs` couvrent les étapes, l'isolation, les cibles
vide/peuplée/divergente/indisponible/autre compte, l'annulation, le rechargement
et la reprise idempotente. La recette navigateur, mobile, tactile, clavier,
lecteur d'écran et Cloud réel reste **manuelle** sur une instance isolée.
