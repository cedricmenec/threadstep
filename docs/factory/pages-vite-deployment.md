# ASF-WF-004 | Publication du build Vite sur GitHub Pages

## Frontières d'autorisation

Cette procédure accompagne [ASF-WF-004](tasks/ASF-WF-004.md). Le fichier protégé
`.github/workflows/pages.yml` est changé uniquement dans une PR ASF dédiée,
après autorisation du propriétaire, sous le ruleset `Protect Main` et le
contrôle CI indépendant `check`. Une PR non fusionnée ne déploie pas le site.
Aucun agent produit `TS-NNN` n'est autorisé à modifier les workflows.

## Pipeline cible

1. `CI / check`, déclenché sur les PR : Actionlint épinglé, `npm ci`,
   `npm run check`, `npm run build`, `npm run verify:build` et
   `npm run verify:servers`. Les validations OpenSpec et le smoke OpenCode
   sans modèle demeurent actifs.
2. `Pages / validate`, sur `main` : `npm ci` (versions verrouillées)
   suivi de `npm run check`. Un échec empêche les jobs suivants.
3. `Pages / build`, dépendant de `validate` : `npm ci`, `npm run build`,
   `npm run verify:build`, `npm run verify:servers`, puis configuration
   Pages et **upload exclusivement de `dist/`**. Aucun `continue-on-error`,
   aucun `if: always()` et aucune copie silencieuse de `site/`.
4. `Pages / deploy`, dépendant de `build` : l'action de publication
   GitHub existante et les droits `pages: write`/`id-token: write` restent
   limités au workflow Pages. Aucun nouveau secret ni privilège n'est requis.

Source : `site/` (code JavaScript vanilla et vendeur Dexie versionné).
Build non versionné : `dist/`, généré sous la base `/threadstep/`.
Ressources attendues : `dist/index.html` et `dist/assets/*`, dont un
unique chunk vendor Dexie ; les ressources externes runtime restent
interdites. La CSP de production reprend celle de `site/index.html`,
sans CSP HMR, `unsafe-eval` ni `unsafe-inline`.

## Conditions de décision avant fusion

Sur la PR d'implémentation ASF, lire le diff du workflow et des tests,
contrôler que `AGENTS.md`, permissions, règles de branche, secrets et autres
workflows protégés n'ont pas été modifiés hors périmètre. Confirmer que
`check` est `completed/success` sur le **SHA exact de la PR** et qu'il
provient de GitHub Actions, sans condition contournée. Un test simulé
de fichier manquant/CSP affaiblie/chemin incorrect doit échouer avant
l'upload, sans utiliser l'environnement de production. Le propriétaire doit
autoriser la fusion de la PR d'implémentation ; ne jamais employer `--admin`
ou de push direct vers `main`.

## Vérification après fusion

- Rapprocher le SHA de `main` et les runs `CI` et `Pages` associés.
  Attendre les jobs `validate`, `build`, `deploy` terminés avec succès.
- Inspecter le journal `Pages / build` et son upload : **`path: dist`**
  et un artefact effectivement construit, non `path: site`.
- Tester sans connexion/secret `https://cedricmenec.github.io/threadstep/`
  puis les fragments `#/parametres`, `#/parametres/donnees`,
  `#/parametres/synchronisation` et un détail projet de test. Contrôler
  l'absence de 404/CSP bloquante et les assets préfixés `/threadstep/`.
- La CI verte et un HTTP 200 ne prouvent **pas** l'intégrité d'une base
  IndexedDB existante, un OTP réel ni la convergence Dexie Cloud. La recette
  mobile Chrome Android/desktop, hors ligne, clavier et lecteurs d'écran reste
  séparée et doit être faite sur données de test.

## Rollback sans suppression des données

Déclencheurs : page blanche, erreurs d'assets ou CSP bloquantes, données
existantes non consultables ou régression critique confirmée. Ne jamais
purger une base IndexedDB, forcer une migration Cloud ou effacer un export.

1. Préserver les liens, le SHA et les logs de l'incident. Si l'application
   est inaccessible, récupérer/faire conserver un export existant sans
   effectuer de restauration ou de purge improvisée.
2. Ouvrir une branche depuis `main` et une PR ASF de rollback : revenir à
   `path: site` pour `actions/upload-pages-artifact@v4`, désactiver la
   bascule et réconcilier les tests/documents qui imposent `path: dist`.
   Alternative : `git revert` du commit ASF-WF-004 d'implémentation,
   avec revue de son diff. **Ne pas utiliser un push direct ni
   `gh pr merge --admin`.**
3. Attendre le contrôle indépendant `check` sur le SHA exact ; fusionner
   via GitHub après autorisation, laisser Pages redéployer le dossier `site/`.
4. Recontrôler le SHA `main`, les jobs de déploiement, les ressources
   `/threadstep/` et la navigation. Ne pas déclarer réparée une session
   IndexedDB/Dexie sur la seule base d'un déploiement vert.
5. Consigner l'incident et les écarts de recette. Les fichiers métier,
   sauvegardes JSON et comptes Dexie ne sont pas modifiés par le rollback.

La compatibilité navigateur et la non-destruction des données passent avant
une bascule forcée. React, Tailwind et Stitch restent hors de ce chantier.
