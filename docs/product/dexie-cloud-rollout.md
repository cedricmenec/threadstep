# ThreadStep : architecture cible Dexie Cloud et plan de livraison

**Statut : architecture cible partiellement livrée.** Cadrage initial : 17 octobre 2026. Depuis TS-032, l'espace local IndexedDB autonome est le mode par défaut ; l'activation Cloud, l'OTP et la synchronisation restent optionnels et gouvernés par les tâches TS-024 à TS-030 puis TS-037.

## 1. Contrat et état observé

La [spécification complète et normative](specs/dexie-cloud-local-first.md) est fournie par le propriétaire. Ses SHALL/MUST et scénarios guident les tâches TS-024 à TS-030.

Contrairement à l'hypothèse « IndexedDB existante », la version de `main` à la préparation utilise `localStorage` : clé `threadstep.document.v1` dans `site/app.js`. `site/core.js` maintient un document JSON V1 avec sujets et items. Les préférences de reprise sont également locales mais séparées. `site/index.html` impose `connect-src 'none'`.

Les exclusions de cloud, d'authentification et de bibliothèques tierces
provenaient des non-objectifs du MVP historique, auparavant recopiés
dans `AGENTS.md`. Le contrat de coding a été recentré sur la méthode,
la sécurité, les tests et la publication, sans prohibition produit.
La [spécification normative](specs/dexie-cloud-local-first.md)
définit le nouveau périmètre ; le MVP reste une baseline historique.
Les tâches demeurent `status: proposed`, `automation: manual`
en raison de leur risque et de leur qualification, **pas d'une
interdiction générale de l'agent**.

## 2. Architecture cible

```text
ThreadStep (JS vanilla, site statique GitHub Pages /threadstep/)
 ├─ configuration URL Cloud HTTPS, conservée hors synchronisation
 ├─ espace local autonome IndexedDB threadstep-local (mode par défaut)
 │    ├─ même schéma versionné subjects/items à identifiants chaîne
 │    └─ aucun addon Cloud, aucun OTP, aucun réseau
 ├─ Dexie.js + dexie-cloud-addon, schema explicite et versionné
 │    ├─ IndexedDB distinctes par instance Cloud via nameSuffix natif
 │    ├─ tables de sujets et d'actions synchronisables, IDs uniques
 │    └─ données purement locales jamais copiées au cloud
 ├─ Dexie Cloud : OTP email natif, permissions, réplication bidirectionnelle
 └─ export/import V1 explicites et préservation non destructive localStorage
```

Choisir une granularité de tables évitant l'écrasement de **tout le document** sur chaque modification, ce qui introduirait une perte d'écritures concurrentes entre appareils. Le modèle conserve identité, relations parent/enfant, priorité, ordre des items, notes et opérations actuelles (undo, promotion, suggestion, suivi). Les identifiants des tables doivent être globalement uniques, sans `++id`. Avec `@id`, les préfixes obligatoires Dexie Cloud imposent une stratégie documentée de correspondance des anciens IDs, sans casser l'export JSON V1 ni les références.

La synchronisation est directe entre navigateur et Dexie Cloud. Une écriture locale réussit sur commit IndexedDB, sans attendre l'acquittement distant. Depuis TS-032, un navigateur jamais configuré peut travailler hors ligne dans l'espace local autonome ; après configuration et authentification valides, les opérations synchronisées peuvent aussi fonctionner hors ligne selon la session et les autorisations applicables.

La migration de la clé `localStorage` historique vers des tables synchronisées expose potentiellement des données à un service cloud : obtenir **un consentement explicite avant migration** et conserver la source. Il ne faut ni effacer une ancienne IndexedDB en changeant d'URL, ni effectuer de copie automatique entre A et B. Déconnexion et purge sont des opérations différentes, avec confirmations et précautions vis-à-vis des modifications non synchronisées.

## Espace local autonome TS-032

TS-032 sépare physiquement deux bases IndexedDB : `threadstep-local` pour le
mode autonome et `threadstep` (avec le `nameSuffix` natif) pour la base
synchronisée. Le mode local utilise le même schéma versionné et les mêmes
identifiants chaîne, mais il est ouvert sans addon Dexie Cloud. Toutes les
actions métier, l'import et l'export JSON passent par une transaction
IndexedDB ; une écriture n'est confirmée qu'après commit, et un échec
d'ouverture, de lecture ou d'écriture est signalé comme erreur locale, jamais
comme un succès ou une synchronisation en attente.

Le document historique `threadstep.document.v1` reste intact, lisible et
exportable sans conversion automatique. Sa conversion explicite est prévue par
TS-033 ; son éventuel transfert vers une base synchronisée après consentement
relève de TS-037. Configurer une URL Cloud ne copie ni ne rattache les
enregistrements locaux. Aucun OTP, aucune requête réseau et aucune file de
transfert ne sont créés en mode local. Les tests Node couvrent le bootstrap, les
transactions, les erreurs et la confidentialité ; Chrome mobile, le hors ligne
réel, le stockage bloqué et les lecteurs d'écran restent des recettes manuelles.

## Conversion locale explicite TS-033

TS-033 ajoute une étape distincte entre la conservation du document historique
et une éventuelle activation Cloud : `site/local-migration.js` projette un V1
validé vers `threadstep-local` après revue de la source, de la cible et des
insertions, puis consentement explicite. La conversion est atomique et
idempotente, ne préfixe pas deux fois un identifiant déjà converti, et bloque
sans écrasement en cas de collision ou de plan périmé. Elle conserve la source
`threadstep.document.v1` et son export de secours de façon non destructive,
enregistre une provenance locale `threadstep.migration.v1` sans contenu métier
et ne construit aucune instance Dexie Cloud, ne demande aucun OTP et ne
déclenche aucun push. Le scénario de référence est un document de 5 sujets et
18 étapes relu depuis IndexedDB après rechargement. Le transfert vers une base
synchronisée reste **TS-037**.

## 3. Matrice de traçabilité

| Requirement du document fourni | Couverture backlog |
| --- | --- |
| Base locale Dexie versionnée | TS-024, TS-025, TS-026, TS-030 |
| Configuration locale de Dexie Cloud | TS-024, TS-029 |
| Authentification exclusivement par OTP email | TS-027, TS-030 |
| Synchronisation via Dexie Cloud | TS-025, TS-027, TS-030 |
| Écritures locales non bloquantes | TS-025, TS-028 |
| Indicateur global de synchronisation explicite | TS-028 |
| Déconnexion distincte de la purge locale | TS-029 |
| Diagnostic technique minimal | TS-028 |
| Frontière de sécurité frontend | TS-024, TS-027, TS-030 |
| Sélection non destructive de la base Dexie Cloud | TS-024, TS-029 |
| Validation automatisée des garanties du socle | TS-030 et tests propres à chaque tâche |

**Exigence additionnelle liée au code réel :** migration du document localStorage V1 (TS-026).

## 4. Dépendances et publication sûre

Ordre conseillé : **TS-024**, puis **TS-025 et TS-027**, puis **TS-026**, **TS-028**, **TS-029** et enfin **TS-030**.

Prérequis au développement : relire et autoriser le périmètre du task et de sa spécification, disposer d'une **base Dexie Cloud de test** et d'une origine Pages autorisée, vérifier l'accès sans secret embarqué, choisir le packaging reproductible JS et les règles CSP HTTPS/WSS strictement nécessaires. Les fichiers CLI `dexie-cloud.key` et `dexie-cloud.json` restent hors sources et livrables. Le service Cloud peut impliquer des coûts, sans aucune dépense autorisée par cette PR.

**Ne pas publier un état intermédiaire sur main qui rend invisibles les données V1 avant migration ou qui les envoie sans consentement.** Regrouper les changements incompatibles dans une même livraison finale ou prévoir une bascule gardée et testée. La fusion des PR de développement et les appels OpenRouter/OpenSpec exigent des autorisations distinctes ; les risques medium/high bloquent la sélection automatique via le backlog orchestrator.

La recette destructrice (purge, collisions de données, logout pending et changements A/B) doit utiliser des instances isolées, jamais la production. Tests Node/CI et OpenSpec strict ne prouvent pas la recette réelle OTP, multi-appareils, clavier et mobile ; conserver ces preuves séparées.

## 5. Documentation fournisseur à relire à l'implémentation

- https://dexie.org/docs/cloud/authentication
- https://dexie.org/docs/cloud/DexieCloudOptions
- https://dexie.org/docs/cloud/SyncState
- https://dexie.org/docs/cloud/best-practices
- https://dexie.org/docs/cloud/cli


## Réconciliation TS-031 (mise à jour produit)

La migration vers une base Cloud déjà peuplée n'est plus bloquée globalement.
`site/migration-reconciliation.js` exige d'abord une **attestation de
synchronisation initiale** native et bloque toute planification hors ligne,
sessionnée différemment, en attente, indéterminée ou après erreur de lecture :
une IndexedDB vide ne vaut jamais preuve d'un Cloud vide. Le plan classe les
sujets et étapes par magasin (`identical`, `absent-in-cloud`, `conflict`,
`cloud-only`, `invalid`), ignore `owner`, `realmId` et `$ts`, insère uniquement
les groupes indépendants absents et ne réécrit jamais l'existant. Les conflits
offrent explicitement **keep-cloud** (conserver la version Cloud) ou
**import-copy** (importer l'historique comme copie à identifiant déterministe),
sans `put` ni écrasement et sans choix destructif par défaut. Le consentement est
lié à une empreinte de la source, de l'URL, de la base distante, de la session,
de la cible et des résolutions ; `runReconciliation` le revalide et refuse tout
plan périmé avant une transaction atomique `add`. Le statut affiché distingue
« écrit localement » d'une synchronisation réellement observée.

Cette évolution est couverte par des tests Node déterministes (source 5 sujets /
18 étapes, cible partiellement peuplée, copies idempotentes, collisions,
rollback, métadonnées Cloud, attestation, empreintes et rendu accessible). Elle
ne prouve pas la propagation réseau réelle. La recette sur une instance Dexie
Cloud **isolée**, avec exports préalables, Chrome mobile et second navigateur,
tactile/clavier/lecteur d'écran, premier sync non terminé, conflits, copies,
reconnexion et offline, reste obligatoire et à effectuer hors CI.

## Diagnostic et relance du pull initial TS-034

TS-034 rend observables les signaux natifs de synchronisation sans exposer de
données métier. Le module pur `site/sync-diagnostics.js` distingue la session,
la connexion, la phase native, le pull initial, l'URL normalisée et le
`remoteDbId` disponible, les erreurs classées et le statut des écritures
locales. `connecting`, `pulling`, `pushing`, `offline` et `indeterminate`
restent distincts ; un état transitoire n'est jamais promu en erreur permanente
et une information absente n'est jamais interprétée comme une base distante
vide.

Le diagnostic est en **lecture seule** et applique une règle de rédaction par
liste blanche : catégories et messages fixes, jamais de message d'erreur brut,
d'email, d'OTP, de jeton, de titre ou de note. Les états local, pending et synced
ne sont pas confondus : `synced` exige un état natif `in-sync` avec pull
initial terminé après une écriture locale, sinon le statut reste local, en
attente ou indéterminé.

La relance du pull initial est native et contrôlée : elle appelle uniquement
`db.cloud.sync({ purpose: "pull", wait: true })` lorsque la base est configurée,
la session authentifiée, le réseau disponible et qu'aucune synchronisation n'est
en cours. Elle ne simule pas de connexion, n'importe rien et n'écrit aucune
donnée produit. Un échec est expliqué sans jamais conclure que le Cloud est vide.
Un changement de session ou d'URL actualise le diagnostic et signale une
incohérence de base persistée sans copier de données entre espaces. La recette
réelle sur instance Cloud isolée, Chrome mobile, OTP, coupure réseau, droits et
premier pull reste manuelle et hors CI.
