# ASF-WF-004 | Préparer la publication GitHub Pages du build Vite

Date: 2026-10-24
Status: implementation in review; publication non vérifiée tant que PR, CI et Pages ne sont pas prouvés
Type: factory
Automation: manual
Priority: high
Risk: high
Dependencies: TS-057 (implemented by [PR #192](https://github.com/cedricmenec/threadstep/pull/192))
Scope: GitHub Actions Pages, CI de build, qualification et rollback du site ThreadStep

## Objectif et valeur

Passer, dans une **PR d'implémentation ASF distincte et explicitement autorisée**, de la publication directe de `site/` à la publication de l'artefact statique Vite `dist/`, sans changement fonctionnel ou visuel. L'objectif est de rendre effectif l'outillage Vite livré par TS-057 avant d'engager la migration progressive de l'UI.

Cette fiche **ne déclenche ni la bascule Pages ni une exécution payante**. Le site public continue d'utiliser `site/` tant que la PR de workflow n'est pas autorisée, vérifiée et fusionnée.

## État de référence vérifié

- `main` au commit `4fe459916cbb10e31fd90e88387eacca2e4a9bc0` intègre TS-057 : Vite `7.3.7` épinglé, `vite.config.mjs`, commandes `npm run build`, `npm run verify:build`, `npm run verify:servers`.
- Configuration Vite : source `site/`, artefact distinct `dist/`, `base: "/threadstep/"`, chunks Vite (dont un vendor Dexie), CSP production conservée.
- `.github/workflows/pages.yml` exécute `npm run check` puis `actions/upload-pages-artifact@v4` avec `path: site`. **Aucune étape `npm ci` ni `npm run build` n'y prépare actuellement `dist/`.**
- `.github/workflows/ci.yml` impose le job `check` sur PR et `main` ; Actionlint y est épinglé. [CI sur main TS-057](https://github.com/cedricmenec/threadstep/actions/runs/40032139550) et [Pages](https://github.com/cedricmenec/threadstep/actions/runs/40032139563) ont réussi, mais ces réussites **ne prouvent pas un déploiement de `dist/`**.
- Références : [AGENTS.md](../../../AGENTS.md), [ChatGPT.md](../../../ChatGPT.md), [spécification OpenSpec static-build-pipeline](../../../openspec/specs/static-build-pipeline/spec.md), [guide de développement ThreadStep](../../product/developer-guide.md), [cadrage Notion UI-01](https://app.notion.com/p/40212ac916368102ab70ee8bfaa1ae7d).

## Périmètre d'implémentation attendu

1. Sur branche dédiée, modifier de façon minimale `.github/workflows/pages.yml` : installer Node 22 et les dépendances via `npm ci` à partir du lockfile, lancer le build Vite reproductible, exécuter ses vérifications, puis publier **uniquement `dist/`** avec `actions/upload-pages-artifact@v4`. Adapter le découpage validate/build seulement si nécessaire ; ne jamais faire d'upload ou de déploiement après un échec de validation.
2. Faire échouer explicitement le pipeline si `npm ci`, `npm run check`, `npm run build`, `npm run verify:build` ou l'inspection de l'artefact échoue. Utiliser `npm run verify:servers` lorsque compatible avec le runner CI ; consigner toute limite motivée. Tenir compte des limites de temps réellement mesurées.
3. Ajouter une vérification **sur PR et avant fusion** que le build `dist/` fonctionne, par exemple via le job `check` de CI et des tests déterministes spécifiques au workflow. En cas d'ajustement nécessaire de `.github/workflows/ci.yml`, limiter sa modification à cette preuve de build, sans modifier la politique des required checks ni élargir les permissions. Ne pas faire exécuter de code de PR par un contexte privilégié `pull_request_target`.
4. Conserver les déclencheurs existants de Pages (`push` sur `main` et `workflow_dispatch`), la protection `Protect Main`, les permissions minimales du workflow, l'environnement `github-pages`, le verrou de concurrence et les versions des actions déjà approuvées, sauf justification et validation explicites.
5. Contrôler l'artefact : `dist/index.html` et tous les assets résolus sous `/threadstep/`, une seule version du vendor Dexie, CSP de production stricte, absence de CDN runtime, secrets, fichiers `.env`, source interne et métadonnées privées. Aucun fichier `site/` ne doit être publié parallèlement en dehors de l'artefact attendu.
6. Maintenir l'application vanilla, les routes par fragment, les exports/imports JSON, l'identité IndexedDB, les gardes de consentement/restauration, la configuration Dexie Cloud et les parcours OTP. Le workflow ne doit effectuer **aucune** migration de données, aucune action Dexie Cloud réelle et aucun changement de credential ou de configuration d'instance.
7. Documenter dans `docs/factory/` et dans le guide produit le nouveau chemin de publication, les vérifications, l'URL de contrôle, les preuves GitHub et la **procédure de retour arrière** consistant à rétablir `path: site` via une PR vérifiée puis à republier. Ne pas supprimer `site/`, les anciennes sauvegardes ni `dist/` local de l'utilisateur.

## Critères d'acceptation

- [ ] Une PR dédiée ne modifie les workflows protégés qu'au titre de cette tâche ASF et est revue sur son SHA exact, sans changement de secret, règle de branche, permission GitHub App ou droit d'administration.
- [ ] CI indépendante `check` de la PR : tests Node existants, tests de workflow, Actionlint, syntaxe Bash, installation reproductible, build Vite et inspection de `dist/` réussis. Un build erroné / asset manquant / fichier sensible / CSP affaiblie doit faire échouer les contrôles **avant toute publication**.
- [ ] La chaîne Pages effective exécute le build à partir d'un `npm ci` propre, ne publie que `dist/` après validations et n'utilise plus `path: site` comme source d'upload. Les jobs `validate`, `build` et `deploy` conservent une chaîne de dépendances qui refuse le déploiement en cas d'échec.
- [ ] Les ressources du site construit chargent correctement à `https://cedricmenec.github.io/threadstep/` et les chemins locaux restent sous `/threadstep/`. Rafraîchissement, retour et navigation `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation` et détail d'un projet fonctionnent.
- [ ] CSP, vendor Dexie, absence de secrets/CDN runtime, formats de sauvegarde, données locales et gardes Cloud restent inchangés. Les tests de code ne sont pas présentés comme une preuve de session OTP ou de synchronisation Cloud réelle.
- [ ] La stratégie de rollback est écrite et reproductible, avec conditions d'activation si le chargement du site échoue, sans purge IndexedDB ni rupture des fichiers de sauvegarde.
- [ ] Après **autorisation spécifique de fusion de la PR d'implémentation**, la CI de `main` et Pages réussissent sur le SHA publié ; la preuve de l'artefact `dist/`, son contenu et l'URL réelle sont consignés séparément des tests simulés. Aucun GO de production ne repose uniquement sur une CI verte de PR.

## Tests et validations attendus

- Contrôles automatisés sur PR : `npm ci`, `npm run check`, `npm run build`, `npm run verify:build`, `npm run verify:servers`, Actionlint et contrôle de l'absence de `path: site` dans l'upload cible. Pour la simulation de refus, tester au moins un artefact absent, une CSP altérée et un chemin non préfixé, **sans lancer de déploiement**.
- **Manual acceptance :** sur desktop et Chrome Android, avec données de test, valider après publication le chargement sous `/threadstep/`, l'origine IndexedDB inchangée, une session locale existante, les écrans Overview/projet/Paramètres, un export/import, une restauration annulée, le hors ligne, le clavier/focus et l'absence d'erreur réseau/CSP. Sur environnement Cloud de test uniquement, vérifier OTP et récupération de session sans transfert/purge implicite. La recette mobile TS-057 n'est pas déjà prouvée.
- **Post-merge review :** relever les SHA de PR et de `main`, URLs des runs CI/Pages, fichier effectivement uploadé, résultat de publication, recette et éventuelles limites. Mettre à jour la documentation d'état de la factory **après les preuves réelles**.

## Dépendances, exclusions et risque

- Dépendance : TS-057 fusionnée ; aucune dépendance au pilote React ou à la refonte Stitch.
- Risque **high** : l'artefact publié remplace l'entrée navigateur sur la même origine, avec un risque de chargement bloqué, d'échec CSP/assets ou de régression de la lecture locale. Qualifier et réduire ce risque avant fusion de la PR d'implémentation.
- Hors périmètre : React, Tailwind, changements de composants/UI, nouveaux droits GitHub, secrets OpenRouter, mise en production d'un service backend, changement Dexie/Cloud, nouvelle télémétrie, migrations de stockage, bascule CDN et optimisation non demandée.
- **Automation: manual** : l'agent OpenSpec de tâches produit `TS-NNN` ne doit pas être détourné pour modifier `.github/workflows/`. Utiliser la voie ASF explicitement autorisée, avec contrôle indépendant. **La création ou fusion de la présente fiche documentaire n'autorise pas la future bascule de publication.**

## Suivi de l'implémentation (24 octobre 2026)

La voie ASF manuelle a été autorisée explicitement par le propriétaire dans la session ThreadStep du 24 octobre 2026. La branche d'implémentation `feat/asf-wf-004-pages-vite-dist-20261024` prépare le changement des workflows Pages et CI, l'actualisation des tests TS-057, la vérification pré-publication et le [protocole de rollback](../pages-vite-deployment.md). **Le seul commit ou la création de PR ne prouve ni fusion, ni publication, ni recette physique.** Ne cocher les critères ci-dessus qu'après preuves effectives.

Le lancement d'un agent OpenRouter/LLM n'est pas nécessaire à cette implémentation manuelle ; aucune demande de secret ni de nouveau privilège ne doit être ajoutée. Le changement ne touche pas le stockage métier ou Dexie Cloud.
