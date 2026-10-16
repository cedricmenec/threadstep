# Backlog Orchestrator V1 : mode opératoire

**Statut : implémentation proposée en PR ASF-V2-009.** Vérifier sa présence et ses contrôles dans main avant toute utilisation.

## Commande d'entrée

GitHub Actions > **Backlog Orchestrator V1 (owner, bounded wave)** > Run workflow, branche `main`. Réservé au propriétaire du dépôt.

- `mode=dry-run` : inspection du snapshot et de l'état GitHub, **zéro modèle, zéro paiement, zéro branche de journal**.
- `mode=execute` : le clic propriétaire **autorise un maximum de 1 ou 2 démarrages payants**, selon `max_tasks`. Le modèle est explicitement choisi. Un échec consomme le quota réservé et arrête la vague. Aucune tentative payante supplémentaire sans nouveau lancement approuvé.
- `auto_merge` n'autorise que la demande native de fusion après contrôle de Protect Main + required check ; pas de contournement.
- `model` est limité aux deux modèles OpenRouter approuvés.

Le workflow ne sélectionne que les tâches **product**, `ready`, `automation: allowed`, `risk: low`, contenues dans son manifeste initial, avec dépendances prouvées livrées. Le scheduler est purement déterministe et recalcule après chaque livraison vérifiée. Si une PR concurrente, une preuve inconnue, un drift de brief ou un API GitHub inaccessible est détecté, la vague s'arrête.

## Sécurité et journal

Chaque vague est identifiée par `wave-<github.run_id>`. Son journal et son manifeste sont conservés sur une branche `asf/waves/<id>`, inaccessible aux modèles d'exécution. Une réservation `DISPATCH_RESERVED` y est écrite et son SHA exact transmis à OpenSpec **avant** le premier appel payant. Un agent exécuteur indépendant réévalue propriétaire, ref main, parent et statut, manifeste, empreintes et quota. Les changements du journal s'effectuent avec une lease sur le SHA de branche.

Il y a **deux emplacements de job** au maximum, avec un contrôle GitHub complet entre les deux : run OpenSpec, PR finale fusionnée, SHA, check indépendant sur PR et merge commit, CI main et Pages. Un succès de workflow seul ne vaut pas livraison.

Les trois types d'agent rémunéré ont un verrou partagé de **job** ; l'orchestrateur parent détient un autre verrou pour les vagues. L'absence de `queue:max` garanti rend possible le remplacement d'un job en attente : l'annulation ou l'incertitude bloque et ne relance jamais le modèle.

## Restrictions de mise en service

1. Ne lancer **aucune** vague `execute` pour valider cette PR.
2. Faire valider Actionlint, Bash, tests Node, CI indépendante puis la fusion sous Protect Main.
3. ASF-V2-010 ajoute l'archivage automatique. ASF-V2-011 réalise d'abord des simulations E2E non payantes puis une expérimentation réelle séparément autorisée, limitée à une tâche, puis deux.
4. Aucune limite de coût USD n'est disponible dans cette V1 : `max_tasks` borne les *démarrages*, pas la facture du fournisseur.
5. Les livraisons et les branches de journal doivent être inspectées en cas d'arrêt `UNKNOWN` ; ne pas relancer directement un run échoué.

Références : [tâche ASF-V2-009](tasks/ASF-V2-009.md), [Orchestrator V1](specs/orchestrator-v1.md), [Agent ASF](agent-asf-manual.md).
