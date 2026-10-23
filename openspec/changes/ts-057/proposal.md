# Proposal

## Why

ThreadStep est aujourd'hui servi directement depuis `site/` sans serveur de
développement ni build vérifié. Préparer des composants UI réutilisables exige
un outillage local reproductible, mais son introduction ne doit modifier ni
l'expérience utilisateur, ni la persistance IndexedDB/Dexie Cloud, ni la
publication GitHub Pages actuelle. Ce changement fournit un pipeline Vite
développable et vérifiable **sans basculer le déploiement**.

## What Changes

- Ajouter Vite comme dépendance de développement **épinglée à une version
  exacte**, avec un `package-lock.json` cohérent, et exposer
  `npm run dev`, `npm run build`, `npm run preview` et une commande de
  vérification du build. `npm run check`, `npm test`, `npm run vendor:build`
  et les autres commandes existantes sont conservées.
- Déclarer `site/` comme racine source Vite et produire l'artefact statique
  dans un répertoire distinct et non versionné (`dist/`), jamais dans `site/`.
  L'artefact ne contient que les ressources atteignables depuis le document
  d'entrée : ni tests, ni secrets, ni fichiers de développement, ni
  `dexie-cloud.key`/`dexie-cloud.json`.
- Configurer la base de publication `/threadstep/` pour que les modules ES,
  styles, icône, ressources et bundle Dexie se résolvent sous ce préfixe, y
  compris en `preview`. Aucune URL locale absolue non préfixée à la racine du
  domaine ne doit apparaître dans l'artefact.
- Conserver le chargement local et déterministe de Dexie : le prébundle
  versionné `site/vendor/dexie-cloud.mjs` reste la source, Vite l'intègre en
  un seul chunk vendor sans second instance Dexie, sans CDN et sans URL
  d'instance imposée.
- Préserver la CSP de production dans `site/index.html` et dans l'artefact
  construit. Le serveur de développement reçoit, uniquement en mode `serve`,
  une CSP distincte limitée au HMR local ; `preview` et le site publié
  conservent la CSP de production stricte.
- Ajouter une vérification déterministe qui construit deux fois, compare les
  arborescences et contenus, inspecte chemins, CSP, assets, absence de
  fichiers sensibles et stratégie Dexie, puis démarre `dev` et `preview` pour
  vérifier le chargement sous `/threadstep/`.
- Documenter les commandes, la distinction entre artefact local et site
  réellement publié, les contraintes HMR, le diagnostic des chemins cassés et
  le retour arrière vers la publication statique actuelle.
- Ne modifier ni `.github/workflows/`, ni `AGENTS.md`, ni `opencode.json`, ni
  les secrets, permissions ou mécanismes de sécurité ASF. Aucun changement de
  schéma IndexedDB, de nom de base, de route, de format de sauvegarde, de
  configuration Cloud ou de parcours OTP n'est introduit.

## Capabilities

### New Capabilities

- `static-build-pipeline`: contrat observable du pipeline Vite local
  (versionnement exact, commandes, isolation de l'artefact, base
  `/threadstep/`, chargement local de Dexie, CSP de production séparée du HMR,
  reproductibilité, preview et frontière de publication inchangée).

### Modified Capabilities

Aucune. Les comportements métier, de navigation, de persistance, de sécurité
et de synchronisation existants ne changent pas. Le nouveau delta exige
explicitement leur préservation et référence les capacités canoniques
`app-navigation`, `dexie-local-database`, `local-indexeddb-persistence`,
`data-backup-import-restore`, `cloud-opt-in-activation`,
`email-otp-authentication`, `workspace-identity-isolation` et
`frontend-security-boundary` sans réécrire leurs exigences.

## Impact

- `package.json` et `package-lock.json` : Vite en `devDependencies` à version
  exacte et nouvelles commandes, sans mise à jour silencieuse de `dexie` ou
  `dexie-cloud-addon`.
- Nouveau `vite.config.mjs` : racine `site/`, base `/threadstep/`, sortie
  `dist/` hors source, `publicDir: false`, chunk vendor unique, CSP de
  développement limitée au mode `serve`.
- `site/index.html` : suppression du `modulepreload` manuel devenu obsolète
  lorsque Vite injecte le préchargement du chunk réel ; CSP de production
  inchangée. Les imports locaux et la structure de l'application restent
  identiques.
- `.gitignore` : ajout de `dist/` pour ne jamais versionner l'artefact.
- Nouveaux outils de vérification (`build`/`preview`/`dev`) et tests Node
  déterministes ; mise à jour ciblée des assertions statiques qui exigeaient
  l'ancien `modulepreload`.
- `docs/product/developer-guide.md` et `docs/architecture.md` : commandes,
  architecture source/build, CSP, diagnostic et retour arrière.
- Aucun changement de `site/app.js` métier, de schéma, de données, de
  workflow, de secret ou de déploiement Pages.

## Non-goals

- React, Tailwind, composants Stitch, refonte graphique, nouvelle navigation
  ou nouvelle fonctionnalité métier.
- Migration de données, changement de nom de base IndexedDB, d'URL Dexie
  Cloud, de routes publiques ou de format de sauvegarde.
- Modification de `.github/workflows/pages.yml` ou bascule effective de
  GitHub Pages vers l'artefact Vite. Cette bascule reste une tâche ASF
  distincte, explicitement autorisée et revue.
- Serveur de production, backend, rendu SSR, CDN runtime ou télémétrie.

## Assumptions and uncertainties

- La version exacte de Vite n'est pas figée dans ce plan : elle sera résolue
  pendant `apply` avec `npm install --save-dev --save-exact vite`, puis
  enregistrée dans `package.json` et `package-lock.json`. Aucun `^` ni `~`
  n'est accepté, et Node 22 doit rester le moteur déclaré.
- La stratégie retenue est de conserver `site/vendor/dexie-cloud.mjs` comme
  prébundle source et de le laisser être intégré par Vite dans un chunk vendor
  unique. Le `modulepreload` manuel est retiré car il pointerait vers un
  fichier non émis et pourrait créer un second chargement de Dexie ; Vite
  injecte le préchargement du chunk réel. C'est un détail d'outillage, pas un
  changement de comportement.
- Le HMR Vite nécessite un WebSocket local et parfois des styles injectés.
  La stratégie retenue est une CSP de développement séparée, appliquée
  uniquement par transformation du serveur `serve`, avec `ws://localhost:*`,
  `ws://127.0.0.1:*` et `style-src 'unsafe-inline'`, sans `unsafe-eval`. La
  CSP de production n'est ni modifiée dans la source ni dans l'artefact.
- Le serveur `preview` sert l'artefact sous `/threadstep/`. Un accès à la
  racine sans préfixe n'est pas une cible supportée ; le diagnostic documenté
  doit permettre de distinguer un chemin cassé d'une route par fragment.
- Les vérifications de persistance réelle après rechargement, de session OTP,
  de synchronisation et d'isolation de comptes restent des recettes humaines
  sur données de test. Les tests automatisés prouvent seulement l'identité des
  constantes, l'absence de migration déclenchée par l'outillage et l'absence
  d'appel réseau implicite du build ou du serveur local.
- Aucune décision produit n'est prise sur le futur remplacement de la
  publication `site/` par `dist/` ; le présent lot ne modifie pas Pages et ne
  doit pas être présenté comme un déploiement Vite en production.
