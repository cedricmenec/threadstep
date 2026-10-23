# Design

## Context

Voir `proposal.md` — Why et `specs/static-build-pipeline/spec.md` pour les
comportements attendus.

L'état livré est une application statique dont l'entrée est `site/index.html`.
`site/app.js` importe localement les modules métier et
`site/vendor/dexie-cloud.mjs`, prébundle esbuild versionné produit par
`npm run vendor:build`. La CSP de production est déclarée dans une balise
`meta` de `site/index.html`. GitHub Pages publie directement `site/` via
`.github/workflows/pages.yml`, fichier protégé qui ne doit pas être modifié ici.
`npm run check` s'exécute sans `npm ci` dans les workflows actuels : il ne doit
donc pas dépendre de Vite.

## Goals / Non-Goals

**Goals:**

- Ajouter un pipeline Vite local minimal, épinglé et reproductible, sans
  toucher au code métier ni au déploiement.
- Garantir que l'artefact `dist/` est isolé, préfixé `/threadstep/`, sans
  secret, sans CDN et avec une seule instance Dexie.
- Séparer strictement la CSP de production de la dérogation HMR locale.
- Fournir des vérifications déterministes exécutables sur le runner avant
  OPSX sync, et documenter la recette navigateur restante.
- Conserver `site/` comme source réellement publiée.

**Non-Goals:**

- Choisir un framework UI, modifier le DOM, les styles, la navigation ou les
  parcours métier.
- Modifier les noms de base, le schéma, les formats de sauvegarde, les routes
  ou la configuration Cloud.
- Changer `.github/workflows/pages.yml`, basculer Pages vers `dist/`, créer un
  serveur de production ou ajouter du SSR.
- Ajouter une télémétrie, un CDN, une dépendance runtime ou un secret.

## Decisions

### 1. Une nouvelle capacité d'outillage, sans modifier les specs métier

`static-build-pipeline` porte uniquement le contrat du build et de la preview.
Les capacités existantes (`app-navigation`, `dexie-local-database`,
`local-indexeddb-persistence`, `data-backup-import-restore`,
`cloud-opt-in-activation`, `email-otp-authentication`,
`workspace-identity-isolation`, `frontend-security-boundary`) ne changent pas :
le delta exige leur préservation et référence leurs contrats sans les réécrire.

*Alternative écartée :* ajouter des exigences Vite dans chaque spec métier
créerait des doublons et laisserait croire à un changement fonctionnel.

### 2. Vite épinglé et scripts séparés du `check` sans dépendances

`package.json` reçoit Vite dans `devDependencies` avec une version exacte
(résolue à l'implémentation via `npm install --save-dev --save-exact vite`, puis
figée dans `package.json` et `package-lock.json`). Aucun `^` ou `~` n'est
accepté. `dexie` et `dexie-cloud-addon` restent inchangés.

Scripts ajoutés :

- `dev` : `vite`
- `build` : `vite build`
- `preview` : `vite preview`
- `verify:build` : vérification déterministe du build
- `verify:servers` : vérification locale de `dev` et `preview`

`check` reste la suite existante et n'importe pas Vite, car les workflows
actuels exécutent `npm run check` sans installer les dépendances. Les contrôles
qui exigent Vite sont exécutés après `npm ci` dans les tâches d'apply et dans
des commandes dédiées.

*Alternative écartée :* ajouter `vite build` à `check` casserait la CI
indépendante qui ne fait pas `npm ci` et mélangerait validation produit et
outillage optionnel.

### 3. Racine `site/`, base `/threadstep/`, sortie `dist/`

`vite.config.mjs` fixe :

- `root: "site"` ;
- `base: "/threadstep/"` ;
- `build.outDir` absolu vers `dist/`, avec `emptyOutDir: true` ;
- `publicDir: false`, pour ne jamais copier un répertoire public non maîtrisé ;
- `build.target: "es2020"`, cohérent avec le prébundle Dexie et les navigateurs
  cibles ;
- `appType: "spa"` pour le repli de document, sans introduire de route serveur ;
- des noms de fichiers déterministes (`assets/app-[hash].js`,
  `assets/vendor-dexie-[hash].js`, assets avec hash).

`dist/` est ajouté à `.gitignore`. La racine `site/` reste la seule source
versionnée ; `dist/` n'est jamais publié par ce lot.

*Alternatives écartées :* sortir dans `site/dist` risquerait d'être publié par
Pages et de polluer les imports ; `publicDir: "site"` copierait toute la source
et des fichiers non souhaités ; une base relative ne respecterait pas la
publication sous `/threadstep/` demandée.

### 4. Vendor Dexie : prébundle conservé, chunk unique

`site/vendor/dexie-cloud.mjs` reste le prébundle local versionné et
reconstructible par `npm run vendor:build`. `site/app.js` continue de l'importer
localement. Vite le place dans un chunk séparé via `manualChunks`, ce qui évite
un second exemplaire de Dexie et rend l'ordre vérifiable.

Le `<link rel="modulepreload" href="./vendor/dexie-cloud.mjs">` manuel est
retiré de `site/index.html` : après bundling, ce fichier n'est plus émis sous ce
nom et le lien serait cassé ou créerait un double chargement. Vite injecte le
préchargement du chunk vendor réel. L'assertion statique existante est mise à
jour pour vérifier l'import local et l'absence de lien obsolète, sans relâcher
les contrôles de versions ni de CDN.

*Alternatives écartées :* copier le vendor en asset public avec un import
externe complique les chemins relatifs et le préchargement ; laisser le lien
manuel risque un doublon ; importer Dexie depuis `node_modules` au runtime
violerait le chargement local prévisible.

### 5. CSP : production intacte, HMR isolé au serveur de développement

La CSP de `site/index.html` reste la source de vérité de production. Un plugin
Vite `apply: "serve"` remplace la balise uniquement dans la réponse du serveur
de développement par une CSP dédiée :

- ajout de `ws://localhost:*` et `ws://127.0.0.1:*` pour le HMR ;
- ajout de `style-src 'self' 'unsafe-inline'` pour les styles injectés en dev ;
- aucun `unsafe-eval`, aucun CDN, aucun élargissement des hôtes Dexie Cloud.

Le build ne passe pas par ce plugin. `preview` sert le HTML construit avec la
CSP de production. Les tests comparent la CSP source et la CSP construite, et
vérifient que la dérogation dev n'apparaît pas dans `dist/`.

*Alternatives écartées :* assouplir la balise source affaiblirait la
publication ; désactiver complètement le HMR dégraderait le serveur de
développement sans nécessité ; une CSP uniquement dans un en-tête HTTP ne
couvrirait pas le site statique.

### 6. Sécurité et frontières de données préservées

Le build ne fait qu'analyser et transformer les modules atteignables depuis
`site/index.html`. Il n'exécute pas `site/app.js`, n'ouvre aucune base, ne lit
aucune configuration utilisateur, n'injecte aucune variable d'environnement et
ne définit aucune URL Cloud.

La vérification inspecte l'artefact pour exclure `dexie-cloud.key`,
`dexie-cloud.json`, `.env`, secrets, tests, sources internes non atteignables,
scripts inline non autorisés, `eval`/`new Function`, CDN et URL d'instance
imposée. Elle vérifie aussi que les constantes de base et de schéma restent
celles de la source livrée.

Les parcours import/export/restauration, consentement, OTP, synchronisation et
isolation de comptes ne sont pas modifiés. Leur preuve réelle reste la recette
manuelle sur données de test ; les tests automatiques ne font que constater
l'absence de changement des modules et l'absence d'appel implicite de
l'outillage.

### 7. Reproductibilité et vérification sur le runner

`tools/verify-build.mjs` construit deux fois dans des répertoires temporaires
avec la même configuration, compare les chemins relatifs et les empreintes
SHA-256, puis inspecte le premier artefact :

- CSP identique à la source ;
- toutes les URL locales préfixées `/threadstep/` et fichiers correspondants
  présents ;
- aucun fichier sensible, aucun CDN, aucun script inline non autorisé ;
- un seul chunk `vendor-dexie-*` et son préchargement ;
- absence de doublons ou de résidus.

`tools/verify-servers.mjs` démarre `npm run preview` sur une base
`/threadstep/`, vérifie le document, les assets et la CSP, puis démarre
`npm run dev` sur un port libre et vérifie la réponse avec la CSP de
développement et le client Vite. Les serveurs sont arrêtés et les ports libérés
dans tous les cas. Aucun accès externe n'est effectué.

*Alternative écartée :* comparer seulement des listes de fichiers ne
détecterait ni un asset manquant, ni un chemin hors base, ni un doublon de
vendor.

### 8. Documentation et frontière de publication

`docs/product/developer-guide.md` reçoit une section Vite : commandes,
versionnement exact, `site/` source et `dist/` artefact local, base
`/threadstep/`, stratégie vendor, CSP dev/production, `verify:build`,
`verify:servers`, diagnostic des chemins cassés et retour arrière.
`docs/architecture.md` est corrigé pour ne plus affirmer « sans build » sans
distinguer l'outillage local de la publication statique.

La documentation indique explicitement que GitHub Pages publie encore `site/`
et que la bascule vers `dist/` exige une tâche ASF dédiée. Le retour arrière
consiste à conserver ou restaurer la publication de `site/` : aucune donnée,
base ou configuration n'est touchée.

### 9. Focus, défilement et états transitoires

Aucun rendu, balisage métier, style ou gestion d'événement de l'application
n'est modifié. Le retrait du `modulepreload` est une indication de performance
et ne change ni le DOM utile, ni le focus, ni les ancres de défilement, ni les
groupes développés, ni l'état local des vues. Les invariants de
`ux-interaction-continuity` restent donc ceux du site actuel et sont couverts
par les tests existants et la recette manuelle comparative.

## Risks / Trade-offs

- **Chunk vendor dupliqué ou préchargement incohérent** → chunk `vendor-dexie`
  unique, retrait du lien manuel, vérification du nombre de chunks et des
  références émises.
- **CSP de développement confondue avec la production** → plugin limité à
  `apply: "serve"`, tests comparant la balise source, la balise construite et
  la réponse dev.
- **`npm ci` absent de la CI actuelle** → ne pas importer Vite dans `check` ;
  vérifier le build dans des commandes dédiées après installation.
- **Chemin cassé sous GitHub Pages** → base `/threadstep/`, inspection de
  toutes les URL locales et preview sous la base ; recette manuelle sur le
  chemin réel.
- **Faux sentiment de sécurité sur les données** → le build ne prouve pas la
  persistance réelle ; la reprise IndexedDB, l'OTP et la synchronisation
  restent des vérifications manuelles sur données de test.
- **Divergence entre `site/` publié et `dist/` vérifié** → documentation
  explicite, workflow Pages inchangé, comparaison manuelle des deux versions.

## Migration Plan

1. Installer Vite à version exacte, mettre à jour le lockfile et ajouter les
   scripts.
2. Ajouter la configuration, l'ignore de `dist/`, retirer le `modulepreload`
   obsolète et ajouter les outils/tests de vérification.
3. Exécuter `npm ci`, `npm run vendor:build`, `npm run build`,
   `npm run verify:build`, `npm run verify:servers`, puis `npm run check`.
4. Mettre à jour la documentation développeur et d'architecture.
5. Aucune migration de données, de schéma, d'export ou de configuration Cloud.
6. Retour arrière : supprimer ou ignorer l'outillage et `dist/`, conserver la
   publication `site/` ; aucune donnée utilisateur n'est affectée.

## Open Questions

Aucune question bloquante pour les specs, l'approche ou le découpage. La version
exacte de Vite est volontairement résolue pendant l'implémentation et figée dans
le lockfile, sans changer le contrat observable.
