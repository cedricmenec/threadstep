# ThreadStep — documentation développeur

**Application pilote, état 16 octobre 2026 :** TS-012, TS-013 et TS-014 livrées par les PR [#55](https://github.com/cedricmenec/threadstep/pull/55), [#58](https://github.com/cedricmenec/threadstep/pull/58), [#59](https://github.com/cedricmenec/threadstep/pull/59). La dernière CI et Pages sur `main` sont réussies. Les essais matériels demeurent distincts des tests Node.

## Architecture

ThreadStep est une application **statique**, en JavaScript vanilla sans build front-end ni backend. `site/index.html` expose les formulaires et les zones d'affichage ; `site/styles.css` gère le responsive ; `site/core.js` contient les fonctions pures du modèle ; `site/app.js` implémente le DOM, les événements, `localStorage`, JSON, focus, pointeurs et notifications.

```text
site/index.html
  ├─ site/styles.css
  ├─ site/app.js → site/core.js
  │             → site/dexie-foundation.js
  │             → site/vendor/dexie-cloud.mjs (Dexie.js + dexie-cloud-addon, buildé)
  ├─ site/dexie-foundation.js (validation d'URL, portail, schéma, configuration locale)
  └─ site/vendor/dexie-cloud.mjs
        ↕ localStorage du navigateur
        ↕ import / export JSON explicites
GitHub Pages publie uniquement site/ ; aucune API produit
```

CSP `connect-src https://*.dexie.cloud wss://*.dexie.cloud` : seuls les hôtes Dexie Cloud sont joignables ; aucun contenu des tâches n'est transmis avant configuration et consentement. Les valeurs utilisateur doivent devenir des nœuds texte, jamais du HTML interpolé. Un export JSON personnel doit rester local à l'utilisateur.

## Socle Dexie Cloud (TS-024)

Le socle local-first est amorcé par `site/dexie-foundation.js` : `validateCloudUrl` n'accepte qu'une URL HTTPS sous `dexie.cloud` (validation purement syntaxique, sans réseau), `shouldOpenSyncedDatabase` et `cloudConfigureOptions` produisent `{ databaseUrl, requireAuth: true }` sans désactiver `nameSuffix`, et `dexieSchema` déclare une version entière explicite avec des magasins synchronisés à identifiants uniques `@id` (jamais `++id`). L'URL est conservée en local sous la clé non synchronisée `threadstep.cloud.config.v1`, distincte de `threadstep.document.v1` et absente de l'export JSON. `site/app.js` ne construit et ne configure la base synchronisée que derrière `shouldOpenSyncedDatabase` ; sans URL valide, un formulaire de configuration accessible est présenté et aucune opération métier Dexie n'est exécutée. Les dépendances `dexie` et `dexie-cloud-addon` sont épinglées dans `package.json`/`package-lock.json` et livrées en ESM local `site/vendor/dexie-cloud.mjs` (`npm run vendor:build`), sans CDN tiers à l'exécution. Aucun secret, fichier `dexie-cloud.key`/`dexie-cloud.json`, jeton d'administration ni URL d'instance imposée ne doit être livré.

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
les tests ; `site/app.js` l'implémente au-dessus de Dexie dans une transaction
`rw`. Une écriture est confirmée localement dès la validation de la transaction,
sans attendre d'accusé Dexie Cloud. Un échec IndexedDB est rejeté avec le type
d'erreur `local`, distinct du type `sync` : il n'est jamais présenté comme un
succès. La propagation multi-onglets passe par le canal de changement
(`BroadcastChannel` et l'abonnement aux changements Dexie), et non uniquement
par l'événement `storage`. Les préférences purement locales (`threadstep.resume.v1`)
restent hors des tables synchronisées et hors de l'export.

Une **garde de compatibilité** non destructive lit le document historique
`threadstep.document.v1` sans jamais le supprimer ni le réécrire de façon
destructive, et sans le transférer à Dexie Cloud sans consentement explicite :
`site/app.js` conserve l'écriture locale V1 et propose désormais la conversion
explicite (TS-026) sous consentement, sans purger la source. La recette
navigateur, hors ligne, multi-onglets et IndexedDB réel reste une validation
manuelle.

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
relaie la saisie email/code aux callbacks natifs. Aucun `fetchTokens`, aucun
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

**État courant du pilote :** le socle de configuration Dexie Cloud (TS-024), la persistance local-first (TS-025), la migration historique (TS-026) et l'authentification OTP email native (TS-027) sont intégrés ; l'indicateur de synchronisation, la purge locale et la consolidation de la recette restent à livrer (TS-028 à TS-030). Tant qu'aucune URL valide n'est enregistrée, aucune base synchronisée n'est ouverte et les données restent dans le navigateur. La CSP n'autorise que les hôtes Dexie Cloud. Cette progression est **additive** : le document `threadstep.document.v1` et ses exports restent inchangés.

**Cible Dexie Cloud, non déployée :** la
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
