# ASF V2 — recette finale, pannes et reprise manuelle

**État au 16 octobre 2026 :** parcours E2E à une tâche et à deux tâches **vérifiés**. Les six simulations E2E passent dans le code livré. **CI rouge réelle**, tests matériels (clavier/mobile), contrôle de permissions GitHub App à l'instant de clôture et tests destructifs en conditions réelles **non revendiqués**.

> Cette page est une procédure de qualification, **pas** une autorisation pour créer une PR avec une CI cassée, désactiver les protections ou dépenser sur OpenRouter. Toute opération risquée a besoin d'un périmètre et d'une approbation indépendants. Les incidents se corrigent en PR et non en altérant une branche de journal déjà écrite.

## A. Critères de clôture ASF-V2-011

| Contrôle | État et preuve | Avant clôture formelle |
| --- | --- | --- |
| ASF-V2-001..011 en `main` | PR de livraison de chaque fiche ASF ; voir [état](current-state.md). | Aucun déploiement manquant connu |
| Recette pure (6 scénarios) | `node scripts/asf/fixtures/e2e.mjs` ; [scénarios](e2e-validation.md). | Rejouer sur le HEAD de clôture et relever la CI |
| Pilote 1 tâche | [run 38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283) ; PR #55, journal `wave-38886939283` en `DELIVERED`, quota 1/1 | Vérifier l'absence de redémarrage/duplicata |
| Vague 2 tâches | [run 38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187) ; PR #58/#59, journal `wave-38910657187`, 2/2, `stop: null` | Vérifier les SHA et CI/Pages de chaque fusion |
| Aucun troisième départ | Quota 2/2, deux réservations et deux PR de produit ; troisième slot absent de V1 | Conserver les preuves |
| `check` réellement rouge | **Non testé sur GitHub** ; seulement simulé par `red-ci` | Test isolé ci-dessous, avec autorisation préalable |
| Reprise après interruption | Fenêtres de crash et CAS **simulées** | Revue des journaux, éventuellement exercice non-payant sur un banc dédié |
| Protect Main / App / absence de bypass | `main` protégé et ruleset actif observés ; permissions fines à contrôler par owner | Relevé daté + capture/settings et comparaison avec le YAML |
| Recette utilisateur ThreadStep | CI/Pages réussies pour TS-012/13/14 ; test physique non observé | [Checklist manuelle produit](../product/acceptance-checklist.md) |

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
