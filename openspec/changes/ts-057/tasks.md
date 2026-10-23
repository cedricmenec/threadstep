# Tasks

## 1. Toolchain, scripts et configuration Vite

- [ ] 1.1 Ajouter Vite en `devDependencies` avec `npm install --save-dev --save-exact vite`, puis vérifier que `package.json`, la racine du lockfile et `node_modules/vite` portent exactement la même version sans `^` ni `~`, et que `dexie`/`dexie-cloud-addon` restent à leurs versions actuelles ; exécuter `npm ci` et une assertion Node sur ces valeurs avant de cocher.
- [ ] 1.2 Ajouter les scripts `dev`, `build`, `preview`, `verify:build` et `verify:servers` sans retirer ni modifier l'intention de `test`, `backlog:check`, `vendor:build` et `check` ; ajouter `dist/` à `.gitignore` et vérifier avec `node -e` la présence des scripts et `git check-ignore dist/`.
- [ ] 1.3 Créer `vite.config.mjs` avec `root: "site"`, `base: "/threadstep/"`, une sortie `dist/` absolue distincte de `site/`, `emptyOutDir: true`, `publicDir: false`, `appType: "spa"`, `build.target: "es2020"` et des noms de sortie déterministes ; vérifier avec `node --check vite.config.mjs`.
- [ ] 1.4 Ajouter `tests/ts-057-build-config.test.mjs` avec des assertions statiques sur la version exacte, le lockfile, les scripts, la racine `site/`, la base `/threadstep/`, la sortie hors source, `publicDir: false`, `.gitignore`, l'absence de nouvelle dépendance runtime et la conservation des commandes existantes ; exécuter `node --test tests/ts-057-build-config.test.mjs`.

## 2. Intégration de la source et du vendor Dexie

- [ ] 2.1 Retirer de `site/index.html` le `modulepreload` manuel vers `./vendor/dexie-cloud.mjs`, conserver l'import local dans `site/app.js` et adapter `tests/dexie-foundation.test.mjs` pour vérifier l'import local, l'absence de lien obsolète et l'absence de CDN ; exécuter `node --test tests/dexie-foundation.test.mjs tests/email-otp-auth.test.mjs`.
- [ ] 2.2 Configurer dans `vite.config.mjs` un chunk `vendor-dexie` unique pour `site/vendor/dexie-cloud.mjs` et des noms de chunks/actifs stables ; exécuter `npm run build`, puis vérifier par une assertion Node qu'un seul fichier `assets/vendor-dexie-*.js` est émis et que le HTML construit le référence sous `/threadstep/`.
- [ ] 2.3 Exécuter `npm run vendor:build`, vérifier que `site/vendor/dexie-cloud.mjs` reste inchangé avec `git diff --exit-code -- site/vendor/dexie-cloud.mjs`, puis relancer `npm run build` et confirmer qu'aucun second bundle Dexie n'est émis.

## 3. Vérification déterministe du build et des serveurs

- [ ] 3.1 Créer `tools/verify-build.mjs` avec des fonctions d'inspection pures exportables, un import paresseux de Vite pour le CLI, deux builds dans des répertoires temporaires, comparaison des chemins relatifs et empreintes SHA-256, inspection de la CSP, des URL `/threadstep/`, de la présence des fichiers, des fichiers sensibles, des CDN, des scripts inline, d'`eval`/`new Function`, du chunk vendor unique et des résidus ; ajouter `tests/ts-057-build-verify.test.mjs` couvrant au moins un asset manquant, une URL racine non préfixée, un fichier sensible, un vendor dupliqué et une CSP incorrecte ; exécuter `node --test tests/ts-057-build-verify.test.mjs`.
- [ ] 3.2 Créer `tools/verify-servers.mjs` qui démarre `npm run preview` sous `/threadstep/`, vérifie le document, les ressources, la CSP de production et le fait que la racine non préfixée n'est pas servie comme l'application, démarre `npm run dev` sur un port libre, vérifie la CSP de développement et le client Vite, puis arrête les processus et libère les ports dans tous les cas ; exécuter `npm run build && npm run verify:servers`.
- [ ] 3.3 Exécuter `npm run verify:build` et rapporter le résultat réel des deux builds comparés ; ne pas cocher si une comparaison, un chemin, un asset ou un contrôle de sécurité échoue.

## 4. CSP, données et frontières préservées

- [ ] 4.1 Ajouter dans `vite.config.mjs` le plugin de CSP de développement limité à `apply: "serve"` avec uniquement le WebSocket local et les styles injectés nécessaires, sans `unsafe-eval` ; ajouter des assertions dans `tests/ts-057-build-config.test.mjs` prouvant que la CSP source de production reste exacte, que la dérogation n'est pas appliquée au build et qu'aucun `unsafe-eval` n'est introduit ; exécuter le test ciblé.
- [ ] 4.2 Ajouter dans `tests/ts-057-build-config.test.mjs` des assertions que la configuration n'importe ni n'exécute `site/app.js` ou Dexie, n'utilise ni `define` ni variable d'environnement pour les noms de base, la version de schéma, les stores, les routes ou les formats de sauvegarde, et que les constantes de `site/dexie-foundation.js`, `site/core.js` et `site/indexeddb-backup.js` restent celles attendues ; exécuter `node --test tests/ts-057-build-config.test.mjs tests/core.test.mjs tests/dexie-foundation.test.mjs tests/local-persistence.test.mjs tests/ts-041-navigation.test.mjs`.
- [ ] 4.3 Ajouter dans `tools/verify-build.mjs` et son test les contrôles de l'artefact construit : absence de `dexie-cloud.key`/`dexie-cloud.json`, `.env`, secrets, CDN, script inline non autorisé, URL d'instance imposée, `unsafe-eval` et doublon Dexie ; vérifier avec `node --test tests/ts-057-build-verify.test.mjs`.

## 5. Documentation et frontière de publication

- [ ] 5.1 Mettre à jour `docs/product/developer-guide.md` avec les commandes Vite, la version exacte, `site/` source et `dist/` artefact local, la base `/threadstep/`, la stratégie vendor, les CSP dev/production, `verify:build`, `verify:servers`, le diagnostic des chemins cassés et le retour arrière ; mettre à jour `docs/architecture.md` pour distinguer outillage local et publication statique.
- [ ] 5.2 Ajouter `tests/ts-057-build-docs.test.mjs` vérifiant la présence des commandes documentées, de la base `/threadstep/`, de la distinction `dist/`/`site/`, de la procédure de retour arrière et de l'affirmation que Pages publie encore `site/` ; vérifier par lecture statique que `.github/workflows/pages.yml` publie toujours `path: site` et qu'aucun fichier de workflow n'est requis par le changement ; exécuter le test.

## 6. Vérification d'intégration pré-sync

- [ ] 6.1 Exécuter `npm ci` sur le lockfile final et rapporter le résultat réel.
- [ ] 6.2 Exécuter `npm run vendor:build`, `npm run build`, `npm run verify:build` et `npm run verify:servers` dans cet ordre et rapporter les résultats réels ; ne pas cocher si l'une des commandes échoue.
- [ ] 6.3 Exécuter les tests ciblés `node --test tests/ts-057-build-config.test.mjs tests/ts-057-build-verify.test.mjs tests/ts-057-build-docs.test.mjs tests/dexie-foundation.test.mjs tests/email-otp-auth.test.mjs tests/ts-041-navigation.test.mjs tests/local-persistence.test.mjs tests/core.test.mjs` et rapporter le résultat réel.
- [ ] 6.4 Exécuter `npm run check` et rapporter le résultat réel ; ne pas cocher si un test, `backlog:check` ou un contrôle syntaxique échoue.
- [ ] 6.5 Exécuter `openspec validate ts-057 --strict --no-interactive` et rapporter le résultat réel ; ne pas cocher si la validation échoue.
- [ ] 6.6 Exécuter `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-057/tasks.md` et rapporter le résultat réel ; ne pas cocher si le contrôle pré-sync échoue.
- [ ] 6.7 Vérifier avec `git status --porcelain` et une assertion Node que `AGENTS.md`, `opencode.json`, `.github/workflows/`, `backlog/tasks/TS-057.md`, `openspec/specs/` et `openspec/changes/archive/` n'ont pas été modifiés, et qu'aucun secret ou fichier de configuration sensible n'a été ajouté ; ne pas cocher en cas d'écart.

## Manual acceptance

À exécuter sur desktop et Chrome Android, avec des données de test uniquement.
Ces vérifications restent **à effectuer** et ne sont pas prouvées par la CI.

- Comparer visuellement et fonctionnellement le site statique actuel et le build Vite servi sous `/threadstep/` : ouverture d'Overview, navigation par menu et fragments, détail de projet, tâches et sous-tâches, états vides, chargement, erreurs, scroll et focus.
- Vérifier les accès directs, le rechargement et Précédent/Suivant sur `#/`, `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation` et un `#/sujet/<id>` valide.
- Utiliser une base locale de test existante et confirmer que projets, tâches et sous-tâches persistent après build, rechargement et navigation, sans migration ni changement d'identité IndexedDB.
- Sur données de test, exercer import JSON, export JSON, prévisualisation de restauration, restauration annulée et consentement avant restauration ; vérifier que les gardes existantes et les formats restent inchangés.
- Sur un environnement Dexie Cloud de test isolé, vérifier la configuration Cloud et les transitions OTP/session sans purger de données réelles ni provoquer de transfert implicite ; confirmer l'isolation des comptes.
- Comparer le fonctionnement hors ligne et après refresh, puis contrôler dans les outils réseau l'absence de CDN, de ressource manquante, de requête implicite et d'erreur CSP.
- Vérifier au clavier et avec un lecteur d'écran les parcours comparés, ainsi que le toucher et le rendu mobile : focus visible, atteignabilité, absence de débordement horizontal et absence de régression par rapport au site statique.
- Contrôler les cibles tactiles, le scroll et les états transitoires (groupes développés, brouillons, vues de paramètres) pendant les rafraîchissements et les changements de route.
- Ces observations doivent être consignées séparément de la CI ; une coche de build ne vaut pas acceptation visuelle, mobile ou lecteur d'écran.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer le delta canonique `static-build-pipeline` avec les exigences et scénarios de ce changement, notamment l'isolation de `dist/`, la base `/threadstep/`, le vendor unique, la CSP et la frontière Pages.
- Relire le diff OpenSpec et l'archive du changement, vérifier que `site/`, les spécifications métier existantes et les archives antérieures n'ont pas été modifiés accidentellement, et qu'aucun secret ni fichier sensible n'est versionné.
- Exécuter à nouveau `npm ci`, `npm run build`, `npm run verify:build`, `npm run verify:servers` et `npm run check` sur le SHA final, puis conserver les résultats réels.
- Contrôler la CI indépendante `check` sur le SHA exact de la PR, la protection de `main`, le diff de sécurité et l'absence de modification des workflows.
- Vérifier la fusion, la CI post-fusion et le déploiement GitHub Pages ; conserver l'ancien chemin de publication `site/` tant que la tâche ASF de bascule vers l'artefact Vite n'est pas explicitement autorisée et validée.
- Séparer strictement les preuves CI des recettes desktop, Chrome Android, clavier, focus, lecteur d'écran et données de test. Ne pas annoncer que Pages sert déjà le build Vite sur la seule base de cette tâche.
