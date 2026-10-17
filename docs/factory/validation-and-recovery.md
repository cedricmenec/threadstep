# ASF V2 — recette finale, pannes et reprise manuelle

## Incident TS-024 (17 octobre 2026) : bootstrap Dexie bloqué au checkpoint d'apply

Le [run TS-024 #39070773239](https://github.com/cedricmenec/threadstep/actions/runs/39070773239)
(`phase=auto`) a réussi le plan, la validation stricte et **476/476 tests**
après apply, puis a été refusé au checkpoint d'implémentation :
`Checkpoint has forbidden paths: .gitignore, package.json,
package-lock.json, tools/vendor-dexie.mjs`.
Le garde-fou `scripts/agent-openspec-checkpoint.mjs` n'autorisait que
`site/`, `tests/`, `docs/product/` et `openspec/changes/ts-024/`.
Pourtant TS-024 doit pinner Dexie dans `package.json`, mettre à jour le
lockfile et produire localement les assets ; le plan approuvé prévoit
également `.gitignore` et le helper `tools/vendor-dexie.mjs`.

**Diagnostic vérifié :** la branche
`agent/openspec/TS-024` contient le seul checkpoint de **plan**
`b9a2edc2d5d1b8b1ee17bc14079fa22028aa9e00`, sans checkpoint
d'implémentation ni PR de livraison. Les modifications du runner après
apply, bien que testées, n'ont pas été poussées et ne sont pas
récupérables depuis cette branche. Aucun appel OPSX sync n'a commencé.

**Deuxième prérequis découvert :** le contexte `openspec/config.yaml`
interdisait encore sans condition authentification et dépendances,
alors que la PR de politique [#107](https://github.com/cedricmenec/threadstep/pull/107)
a transféré ces choix vers les spécifications produit. Cette consigne
obsolète contredit la proposition TS-024, qui signale explicitement
son retrait comme précondition à apply.

### Correction contrôlée

- Étendre **seulement pour `apply`** la portée des checkpoints aux
  quatre chemins explicitement requis : `.gitignore`,
  `package.json`, `package-lock.json`, `tools/vendor-dexie.mjs`.
  L'accès demeure refusé à `scripts/*`, `tools/*` autres,
  `.github/*`, `AGENTS.md`, `openspec/config.yaml`, secrets,
  spécifications canoniques avant OPSX sync et backlog.
- Charger le vérificateur de checkpoint **depuis `origin/main`**
  avant les phases payantes. Une branche de tâche issue d'un ancien
  `main` ne doit pas réintroduire silencieusement un ancien
  vérificateur après une correction de la factory. Les opérations
  de plan et apply utilisent ce même fichier de confiance.
- Rendre `openspec/config.yaml` neutre quant aux choix technologiques
  hors périmètre, tout en préservant migration, confidentialité,
  checklist, validation stricte et livraison via PR.
- Adapter les tests de non-régression, sans autoriser un répertoire
  exécutable générique ni désactiver les contrôles.

### Reprise sans régénérer le plan

1. **Après fusion du correctif factory et CI/Pages de main,** rapprocher
   sans perte la branche `agent/openspec/TS-024` du nouveau `main`.
   Confirmer que le plan et les deltas restent identiques et que
   `git diff origin/main...agent/openspec/TS-024` ne contient que
   `openspec/changes/ts-024/**`. Éviter un force-push.
2. Confirmer un HEAD distant qui conserve le marqueur de checkpoint
   `agent(TS-024): validated OpenSpec plan checkpoint` et l'absence
   d'un checkpoint `verified implementation`.
3. [Relire le plan](https://github.com/cedricmenec/threadstep/tree/agent/openspec/TS-024/openspec/changes/ts-024).
   Vérifier notamment les hypothèses `dexie.cloud` et packaging
   local, la coexistence `localStorage` et l'absence de secrets.
4. Sur [Agent OpenSpec](https://github.com/cedricmenec/threadstep/actions/workflows/agent-openspec.yml),
   lancer **un nouveau `workflow_dispatch`** avec
   `task_id=TS-024`, `phase=apply`, `auto_merge=false`
   et le modèle explicitement choisi. Ne pas utiliser
   `Re-run jobs`, `phase=auto`, ni `phase=plan`.
   **Ce nouvel apply est payant** et exige une autorisation
   distincte du run échoué ; la planification ne sera pas refacturée.
5. Vérifier le checkpoint d'implémentation poussé, puis OPSX sync,
   les validations strictes, l'archive, la PR finale, le check sur
   son SHA et la recette manuelle. Si OPSX échoue après checkpoint
   d'apply, repartir en `phase=finalize`, pas en `apply`.

**Limites :** corriger la factory ne récupère pas le contenu
d'apply perdu ni ne prouve que le prochain apply ou le sync payera
ou réussira. Aucune dépense supplémentaire, exécution OpenRouter,
modification de secret ou bypass GitHub n'est autorisé par le correctif.

## Incident TS-023 (17 octobre 2026) : checkpoints et reprise sans régénérer

Le [run #39047805814](https://github.com/cedricmenec/threadstep/actions/runs/39047805814)
a réussi la génération du plan, la validation, 444 tests Node, la checklist
et le sync sémantique OPSX de TS-023. La vérification stricte des specs
canoniques a échoué : l'exigence « Controls, focus and touch targets
preserved » excédait 500 caractères. La branche TS-022 est distincte :
[PR #95](https://github.com/cedricmenec/threadstep/pull/95) fusionnée et
`openspec/changes/archive/2026-10-17-ts-022/` présente. TS-023 n'a
pas été poussée, et les modifications du runner ont été perdues.

**Procédure pour les nouveaux runs avec checkpoint** :

1. Lire `GITHUB_STEP_SUMMARY`, le run et la branche
   `agent/openspec/TS-NNN` ; vérifier le SHA distant effectivement
   enregistré, les PR ouvertes, le dossier `openspec/changes/` ou
   `openspec/changes/archive/`, les tests et les fichiers modifiés.
2. Dernier checkpoint **plan** : inspecter proposition, design, deltas,
   `tasks.md` et les critères ; demander une **nouvelle** autorisation
   pour `phase=apply` (OpenRouter facturé). Ne pas lancer `auto`.
3. Dernier checkpoint **apply** : inspecter la checklist complète,
   le code et les résultats ; demander une **nouvelle** autorisation
   pour `phase=finalize` (OpenRouter OPSX sync facturé), pas `apply`.
   `finalize` exige une branche propre et un change encore actif.
4. Si `finalize` échoue sur `openspec validate --all --strict`,
   corriger le contenu/la qualité de sync lors d'une reprise contrôlée
   ou d'une intervention examinée, sans retirer `--strict` ni
   contourner le gate. Le code reste sur la branche distante.
5. Après archive et publication **uniquement**, comparer les specs,
   attendre le `check` indépendant sur SHA de la PR, puis la fusion
   protégée et le succès CI/Pages post-fusion. Documenter les recettes
   humaines séparément.

En l'absence de checkpoint confirmé, n'inférer aucune persistance du
succès d'une étape locale. Les nouveaux checkpoints ne sauvegardent
pas les fichiers partiellement produits pendant un appel interrompu,
et n'autorisent aucun retry payant automatique. Si l'exécuteur
réutilisable de Backlog Orchestrator V1 échoue, le parent s'arrête
toujours sans seconde tâche. Ne pas réinitialiser un journal de vague
pour tenter la reprise ; utiliser la branche et les preuves GitHub.


## Clôture de recette — 16 octobre 2026

**Décision : ASF V2 clôturée pour son périmètre défini (vague V1 1..2 tâches).** Les composants ASF-V2-001 à 011 sont livrés ; les runs [38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283) et [38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187) démontrent les parcours payants 1/1 et 2/2, avec CI et Pages après chaque fusion.

**Test négatif réel autorisé et exécuté :** [PR #63](https://github.com/cedricmenec/threadstep/pull/63), commit `53a9c5074b579a1ffe94a9ae0409996b5fb4a48d`, [run 38935289219](https://github.com/cedricmenec/threadstep/actions/runs/38935289219) : `check=completed/failure`, `mergeable_state=blocked`, ruleset `Protect Main` actif (id 25163425), `check` obligatoire depuis GitHub Actions (integration 15368), `bypass_actors=[]`, `main` inchangé pendant la vérification ; PR fermée **sans fusion**. Ce test n'est **pas** une exécution rouge d'agent OpenSpec : cette branche de l'orchestrateur est prouvée par la simulation `red-ci` uniquement.

**Recette utilisateur ThreadStep :** propriétaire, déclarée **OK** le 16 octobre 2026 (détail appareils / cases non fourni). **Permissions GitHub App :** propriétaire, vérifiées et déclarées conformes le 16 octobre 2026 ; vérification privée non reproduite par l'assistant. Protections ruleset et checks : vérifiées via GitHub.

**Limites acceptées :** aucun test destructif de crash en production, pas de CI rouge d'agent payant en conditions réelles, pas de plafond monétaire USD, `max_tasks=1|2`, `strict_required_status_checks_policy=false`. Ces limites ne doivent pas être requalifiées en preuves positives. L'évolution à dix tâches relève d'une phase **ASF V3 ultérieure**, sans backlog ni implémentation à ce stade.


**Clôture au 16 octobre 2026 : ASF-V2-001..011 validées pour le périmètre V1 borné.** Runs réels 1/2 tâches, simulation des six scénarios, vrai blocage de PR sur CI rouge et contrôles de branche vérifiés. La recette ThreadStep et les permissions d'installation sont **attestées par le propriétaire**, sans détail par appareil ni accès direct à la configuration sensible. Les tests destructifs dans un agent payant restent hors de cette clôture. Voir [rapport de clôture](closeout-2026-10-16.md).

> Cette page est une procédure de qualification, **pas** une autorisation pour créer une PR avec une CI cassée, désactiver les protections ou dépenser sur OpenRouter. Toute opération risquée a besoin d'un périmètre et d'une approbation indépendants. Les incidents se corrigent en PR et non en altérant une branche de journal déjà écrite.

## A. Critères de clôture ASF-V2-011

| Contrôle | État et preuve | Avant clôture formelle |
| --- | --- | --- |
| ASF-V2-001..011 en `main` | PR de livraison de chaque fiche ASF ; voir [état](current-state.md). | Aucun déploiement manquant connu |
| Recette pure (6 scénarios) | `node scripts/asf/fixtures/e2e.mjs` ; [scénarios](e2e-validation.md). | Rejouer sur le HEAD de clôture et relever la CI |
| Pilote 1 tâche | [run 38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283) ; PR #55, journal `wave-38886939283` en `DELIVERED`, quota 1/1 | Vérifier l'absence de redémarrage/duplicata |
| Vague 2 tâches | [run 38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187) ; PR #58/#59, journal `wave-38910657187`, 2/2, `stop: null` | Vérifier les SHA et CI/Pages de chaque fusion |
| Aucun troisième départ | Quota 2/2, deux réservations et deux PR de produit ; troisième slot absent de V1 | Conserver les preuves |
| `check` réellement rouge | **Observé** : [PR #61](https://github.com/cedricmenec/threadstep/pull/61), [CI #38925574700](https://github.com/cedricmenec/threadstep/actions/runs/38925574700) rouge, merge bloquée ; PR fermée sans fusion | Test GitHub réussi ; injection de panne agent non éprouvée |
| Reprise après interruption | Fenêtres de crash et CAS **simulées** | Revue des journaux, éventuellement exercice non-payant sur un banc dédié |
| Protect Main / App / absence de bypass | Ruleset `25163425` actif, `bypass_actors=[]`, `check` requis (GitHub Actions 15368) vérifiés par API ; permissions fines vérifiées **par le propriétaire** le 16/10/2026 | Attestation owner, pas inspection indépendante de l'installation |
| Recette utilisateur ThreadStep | Propriétaire : **recette manuelle OK**, attestation du 16/10/2026 | Pas de détails sur l'appareil ni de cases individuelles vérifiées indépendamment |

Une réussite de GitHub Actions ne suffit pas à cocher un test réellement non exécuté.

## B. Recette fonctionnelle manuelle (« recette manuelle »)

Sur [ThreadStep](https://cedricmenec.github.io/threadstep/) et sur un navigateur mobile, utiliser **un sujet et des actions de test**. Sauvegarder d'abord les données existantes via « Exporter mes données ». Suivre [la checklist produit](../product/acceptance-checklist.md), puis noter pour chaque test : date, navigateur, système, `main` SHA testé, réussite/échec, capture facultative (sans données privées). Tester clavier (Tab / Entrée / Espace), tactile, restaurations JSON, priorités, repli et ordre des sous-tâches.

Ce « reset » fonctionnel **n'est pas** une restauration du journal ASF. Pour repartir d'un jeu de test, réimporter le fichier JSON sauvegardé après confirmation ; ne pas effacer `localStorage` de son navigateur principal.

## C. Recette de panne déterministe, gratuite

Sur une copie propre du dépôt contenant `main` :

```sh
node scripts/asf/fixtures/e2e.mjs
node --test tests/asf-e2e-validation.test.mjs
npm run check
```

Relever la sortie dans la PR de recette. La suite simule : `empty-backlog` / `NO_WORK`, dépendance débloquée, crash avant/pendant/après dispatch (`STOP_UNCERTAIN` si ambigu), `red-ci` (pas de livraison), vague de deux tâches (quota, troisième interdit), accès concurrent (journal CAS et verrou de jobs). Les simulations **ne valident pas** à elles seules les permissions ou la protection du GitHub distant.

## D. Tester réellement un refus sur CI rouge — procédure isolée

**Exécuté une fois, le 16 octobre 2026 :** [PR #61](https://github.com/cedricmenec/threadstep/pull/61) ; [CI rouge #38925574700](https://github.com/cedricmenec/threadstep/actions/runs/38925574700) ; `check: failure`, `mergeable_state: blocked`, PR fermée **sans fusion** ; main inchangé. La procédure ci-dessous est conservée pour de futurs audits autorisés. Ne pas relancer ce test sur la branche du jour.

À faire **uniquement après autorisation spécifique**, en évitant une tâche payante :

1. Contrôler le ruleset sur `main` : `Protect Main` actif, PR obligatoire, required status `check` provenant de GitHub Actions et aucun bypass utilisable pour le test. Relever les écrans de configuration, sans publier de token.
2. Sur une **branche dédiée jetable**, ajouter un test Node volontairement en échec (par ex. `node:assert/strict` avec assertion fausse) dans une nouvelle PR. Ne pas toucher à `main`, aux workflows, aux secrets ou aux règles. Ne pas autoriser d'agent payant.
3. Observer la conclusion `failure` du `check` **sur le SHA exact** de la PR. Vérifier que l'option de fusion native ne permet **aucune fusion immédiate**, que `main` est inchangé, et qu'il n'existe aucune option de bypass employée.
4. Le test du blocage **d'une vraie PR d'agent OpenSpec avec `auto_merge=true`** est plus fort que ce test GitHub de base. Il nécessite un banc dédié/fault injection approuvée ; **ne pas prétendre** qu'une PR humaine rouge démontre cette chaîne intégrale.
5. Fermer la PR d'essai et supprimer sa branche après conservation des liens et SHA. **Ne jamais** fusionner un commit de test rouge ni neutraliser `check` pour faciliter la démonstration. En cas d'auto-merge en attente, le désactiver avant nettoyage.

Sur le vrai orchestrateur, `mergeDelivery` doit refuser de marquer `DELIVERED` une PR au check rouge. La simulation `red-ci` vérifie ce principe ; le test réel d'agent reste ouvert tant qu'il n'est pas observé.

## E. Reprise manuelle d'un incident d'orchestration (« reset »)

**Il n'existe pas de bouton « reset de vague » sûr dans la V1.** `rerun failed jobs`, recréer `wave-<id>` à la main, remettre le compteur à zéro ou supprimer `journal.json` peut provoquer un second appel payant ou une divergence de preuve. **Ne pas le faire.**

1. **Geler les lancements** : ne plus déclencher `execute` ni d'agent manuel et ne pas réactiver un auto-merge incertain.
2. Lire le run parent `Backlog Orchestrator V1`, les jobs `prepare`, `first`, `after_first`, `second`, `after_second`. Ouvrir sur GitHub la branche `asf/waves/wave-<run_id>`, puis **`manifest.json` et `journal.json`**, sans les modifier. Noter `taskStartsReserved`, `state`, `stop`, SHAs, PR et URL.
3. Rechercher les PR `agent/openspec/TS-NNN` et leurs merges ; vérifier `headSha`, required `check` de PR et du merge, puis les runs `CI` et `Pages` **post-fusion**. Ne pas accepter uniquement `success` du job OpenSpec.
4. **Si `DELIVERED`** : ne pas exécuter cette tâche à nouveau. Archiver éventuellement via une **PR documentaire** distincte et vérifiée. **Si `FAILED` ou `UNKNOWN`** : présumer une exécution possible, garder la réservation consommée ; soumettre une analyse/reconciliation à revue humaine, jamais un retry automatique.
5. **Si PR ouverte / CI lente** : attendre/inspecter, sans nouvelle vague. Le job `settle` interroge toutes les 15 s sur 7 minutes ; l'expiration arrête la vague, elle ne libère pas le quota. Réparer via PR distincte après analyse, pas avec `--admin`.
6. **Si décalage de SHA, API indisponible ou branche de journal divergente** : arrêter et sauvegarder les preuves. La correction nécessite revue d'un opérateur et, si du code factory doit changer, une PR ASF séparée. Ne jamais modifier les données de journal pour faire croire à `DELIVERED`.
7. Avant un **nouveau lancement, distinctement autorisé**, relire backlog, PR, journal, `main` et coûts ; commencer par un `dry-run`. Une vague échouée n'accorde aucune nouvelle autorisation et une tâche livrée ne doit jamais être relancée.

**Cas spécifique d'une CI post-fusion lente** : pour les tâches d'une même vague, le job `after_first` attend jusqu'à 7 min. Il n'est pas nécessaire de lancer un deuxième workflow manuellement. Pour une **nouvelle vague**, attendre la fin de CI/Pages du dernier merge et l'absence de PR ouvertes *avant* `prepare`.

## F. Revue sécurité finale par le propriétaire

- GitHub → Settings → Rules → Rulesets : `Protect Main` actif sur `main`, PR required, statut `check` obligatoire (GitHub Actions, integration ID attendu 15368), aucune dérogation. Documenter la date et la révision observées.
- GitHub → Settings → GitHub Apps / installation `threadstep-software-factory` : vérifier les permissions réellement accordées (Actions nécessaire au dispatch, Contents et Pull requests à l'écriture là où justifié, pas de Workflows write non nécessaire). Comparer avec `agent-openspec.yml`, `backlog-orchestrator.yml` et `authenticate-executor.mjs`. Les secrets ne sont pas copiés dans les preuves.
- Actions → Workflow permissions et Journaux : `workflow_dispatch` owner-only, identités et SHA vérifiés, app token non transmis aux jobs de développement non privilégiés, absence de tentative de bypass.
- Documenter les résultats du test CI rouge et les éventuels correctifs. Ne déclarer **ASF-V2-011 entièrement validée** que lorsque chaque ligne requise est étayée par une preuve vérifiable.

## G. Rapport de clôture à remplir

```text
Date / validateur :
HEAD main et PR de documentation :
Tests locaux + sortie :
Run pilote 1 : 38886939283 — journal / check / CI / Pages :
Run vague 2 : 38910657187 — journal / check / CI / Pages :
Recette fonctionnelle (navigateur, mobile, clavier) :
Test CI rouge réellement effectué ? Lien et SHA :
Protect Main / GitHub App / bypass (relevé daté) :
Incidents et limites acceptées :
Décision : VALIDÉ / PARTIEL / REFUSÉ
```
