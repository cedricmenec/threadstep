# Backlog ThreadStep

Les besoins produit versionnés vivent dans backlog/tasks/TS-NNN.md.
Le contrat de travail des agents figure dans [AGENTS.md](../AGENTS.md),
les exigences dans docs/product/ et les spécifications canoniques dans
openspec/specs/. Les états ci-dessous ont été **réconciliés le
15 octobre 2026**, après fusion de la PR #26.

## Proposer une fonctionnalité

Exprimer le besoin en langage naturel ou vocal. L'assistant examine
la vision, les exigences et les tâches existantes, choisit un TS-NNN
libre, décompose le travail si nécessaire, écrit le périmètre et
les critères d'acceptation, puis fait valider les documents par PR.
Il n'est pas nécessaire de créer une issue GitHub.

## Exécution effective

- **Direct** : workflow Agent (manual, OpenRouter), avec task_id et modèle.
- **OpenSpec** : workflow Agent OpenSpec (manual, staged or auto), avec
  task_id, modèle OpenRouter et phase plan, apply, auto ou finalize.
- **Plan puis apply** : plan génère une PR brouillon de spécifications.
  La conserver ouverte pour revue avant d'exécuter apply sur la branche
  persistante, puis fusionner la PR de livraison après CI. Fusionner la
  seule PR de plan prématurément a provoqué l'incident TS-009.
- **Auto** : exécute les phases dans un seul run explicitement déclenché.
- **OPSX** : init des skills/commandes OpenCode, synchronisation via
  opsx-sync, garde-fou des contenus hors openspec/specs/, archive et
  validation stricte. MODIFIED a été éprouvé sur TS-009.
- **Contrat de phase** : les cases de tasks.md doivent toutes être
  réalisables avant sync ; les contrôles post-sync/CI sont distincts.
- La création d'un backlog ne déclenche pas à elle seule d'exécution
  payante. Les workflows n'ordonnancent aucune tâche et ne fusionnent
  jamais les PR automatiquement. Budget garanti et protection main
  restent à implémenter.

## État du backlog

| Tâche | Objet | Statut vérifié |
| --- | --- | --- |
| TS-001 | MVP statique | Livrée, CI et Pages réussies |
| TS-002 | Smoke test agent OpenCode | Livrée, [PR #2](https://github.com/cedricmenec/threadstep/pull/2) fusionnée |
| TS-003 | Orchestration de vagues autonomes | **Backlog uniquement**, non implémentée |
| TS-004 | Réordonner les sujets | Livrée, [PR #4](https://github.com/cedricmenec/threadstep/pull/4) fusionnée |
| TS-005 | Modifier une action/sous-étape | Livrée, [PR #8](https://github.com/cedricmenec/threadstep/pull/8) fusionnée et archivée |
| TS-006 | Masquer les étapes terminées | Livrée, [PR #12](https://github.com/cedricmenec/threadstep/pull/12) fusionnée |
| TS-007 | Suggestion déterministe d'action | Livrée, [PR #18](https://github.com/cedricmenec/threadstep/pull/18) fusionnée et archivée |
| TS-008 | « Je reprends ici » | Livrée, [PR #21](https://github.com/cedricmenec/threadstep/pull/21) fusionnée, capacité ADDED |
| TS-009 | Expliquer la suggestion | Livrée, [PR #26](https://github.com/cedricmenec/threadstep/pull/26) fusionnée, capacité MODIFIED et sync OPSX native |

**Important :** les cases historiques des fichiers de tâche ne sont pas
systématiquement mises à jour par le workflow. Le statut livré provient
des PR et CI vérifiées, pas de cases cochées a posteriori. Pour TS-005
et suivantes, les archives OpenSpec contiennent des checklists d'exécution.

L'historique exact est dans
[docs/factory/current-state.md](../docs/factory/current-state.md) et
la tâche de mise en cohérence
[ASF-DOC-001](../docs/factory/tasks/ASF-DOC-001.md).

## Précautions

Conserver des tâches suffisamment petites pour une seule exécution
bornée. Les priorités et dépendances sont du texte Markdown pendant
le pilote : il n'y a pas de moteur d'ordonnancement transactionnel.
Ne pas relancer une tâche déjà archivée uniquement pour « tester OPSX ».
