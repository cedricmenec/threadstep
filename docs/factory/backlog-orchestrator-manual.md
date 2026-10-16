# Backlog Orchestrator V1 — mode opératoire vérifié

**Version en service : 16 octobre 2026.** Deux vraies expériences de livraison, [une tâche](https://github.com/cedricmenec/threadstep/actions/runs/38886939283) et [deux tâches](https://github.com/cedricmenec/threadstep/actions/runs/38910657187), ont réussi. **Max 2 tâches ; 1 agent payant simultané ; pas de plafond USD.** Voir [le guide développeur](developer-guide.md) et [la recette finale](validation-and-recovery.md).

## Lancer un dry-run non payant

1. Sur GitHub, [Backlog Orchestrator V1](https://github.com/cedricmenec/threadstep/actions/workflows/backlog-orchestrator.yml) > **Run workflow**, branche `main`.
2. Choisir `mode=dry-run`, `max_tasks=1` ou `2`, modèle autorisé et `auto_merge` selon la stratégie de la future exécution.
3. Lire le job `prepare` : décision `SELECT` / `NO_WORK` / arrêt conservateur et `task_id`. Le dry-run ne crée ni branche de vague, ni réservation, ni token d'écriture, ni appel OpenRouter. **Il n'exécute pas la deuxième candidate** : celle-ci dépendra du recalcul après livraison vérifiée.

## Lancer execute (autorisation distincte)

1. Relire les fiches `backlog/tasks/TS-NNN.md` (statut `ready`, `automation: allowed`, `risk: low`, `type: product`), les PR ouvertes (aucune), les protections `main`, la disponibilité CI/Pages, le montant acceptable des coûts OpenRouter et le dernier dry-run.
2. Sur `main`, sélectionner `mode=execute`, `max_tasks=1|2`, `model=openrouter/deepseek/deepseek-v4.1-flash` ou modèle autorisé, `auto_merge=true|false`. **Le clic engage la dépense** ; une auto-merge fausse exige fusion manuelle compatible avec le délai de vérification de la vague.
3. Consulter `prepare` : réservation persistante `DISPATCH_RESERVED` sur `asf/waves/wave-<run_id>`. Ne pas redéclencher ce même run.
4. Sur `first`, contrôler le job OpenSpec, la PR finale et le required `check`; `after_first` attend **check PR + merge**, puis **CI + Pages après fusion**. Fenêtre : **15 s entre vérifications, sept minutes maximum**. Si le slot 2 est autorisé et qu'une autre candidate est éligible, réserver la prochaine tâche après cette preuve — jamais avant.
5. Vérifier `second` puis `after_second` si applicable. Lire `journal.json` : `taskStartsReserved <= maxTaskStarts`, chaque tâche `DELIVERED` avec PR/SHA ou état `FAILED` / `UNKNOWN` explicite, `stop` documenté. Le succès du workflow seul **ne suffit pas** à prouver une livraison.

**Mode V1 :** le manifeste fige les candidates et SHA des briefs ; priorité, date et ID déterminent l'ordre. Le scheduler refuse les tâches déjà prouvées livrées, même si elles sont encore `ready` dans `backlog/index.json`. Plusieurs tâches peuvent viser les mêmes fichiers si elles sont **séquentielles** et que chaque livraison est revérifiée.

## Échecs et « reset »

- **PR ouverte** lors du précontrôle : arrêt, réconcilier/fermer/fusionner la PR sous protections, attendre post-CI et refaire un **nouveau dry-run**.
- **CI/Pages en attente** : patienter jusqu'à conclusion ; dans une vague, `after_first` attend déjà. Après sept minutes, arrêt fail-closed ; **pas de deuxième démarrage**.
- **`UNKNOWN` / crash / run annulé / GitHub indisponible** : bloquer le prochain lancement, examiner manifeste, journal, PR et checks, garder le quota réservé. **Ne jamais** supprimer ou réécrire le journal pour « reset ».
- **CI rouge réelle** : ne pas forcer `--admin` ni affaiblir le required check ; laisser la PR non fusionnée et réaliser une analyse humaine. [Procédure de test isolé](validation-and-recovery.md#d-tester-réellement-un-refus-sur-ci-rouge--procédure-isolée).
- **Besoin de dix tâches** : la V1 ne sait pas le faire ; lire [la proposition d'architecture](scale-to-ten.md), puis développer/tester une version dédiée.

Les protections GitHub et les secrets ne sont jamais modifiés par ce mode opératoire.
