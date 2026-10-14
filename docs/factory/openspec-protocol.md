# OpenSpec comme moteur du spec-driven development

## Exigence architecturale

Toute évolution comportementale doit être **pilotée par une spécification**, pas uniquement par un prompt de code. Le backlog reste la demande business ; un **change OpenSpec** matérialise les modifications du contrat produit et la checklist d'implémentation. Les deux modes, **manuel et orchestré**, passent par **le même protocole OpenSpec**.

## Cycle fonctionnel obligatoire cible

| Phase | Objectif | Entrées / sorties | Critère de passage |
| --- | --- | --- | --- |
| **Explore** | Examiner l'existant : besoins, code, specs et risques | `TS-NNN` + repo → notes, hypothèses, impacts | Périmètre et questions bloquantes identifiés |
| **Propose** | Rédiger le change | `openspec/changes/<id>/proposal.md`, `design.md`, `specs/**`, `tasks.md` selon schéma | Artefacts requis générés, revue des risques, validation stricte |
| **Apply** | Exécuter la checklist à périmètre constant | code, tests, checkpoints par tâche | Chaque item achevé et poussé, aucun échec ignoré |
| **Verify** | Tester le code et comparer au change | tests, build/lint selon repo, validation OpenSpec | Tous les contrôles pertinents réellement réussis |
| **Sync** | Intégrer les deltas dans les specs canoniques | `openspec/specs/**` reflète les nouvelles règles | Pas de divergence change ↔ produit |
| **Archive** | Clore le change sans perdre l'historique | `openspec/changes/archive/**` | Checklists achevées, validation finale stricte, archivage versionné |

Cette séquence est le **workflow logique**. Les noms `explore`, `propose`, `apply`, `sync` peuvent désigner des *Agent Skills* / commandes agents selon la version d'OpenSpec ; **ne pas supposer** que chaque nom est une sous-commande CLI littérale.

## CLI et Skills à adopter à une version figée

La documentation actuelle d'OpenSpec expose notamment :
- `openspec init`, `openspec new`, `openspec list`, `openspec show`, `openspec status`.
- `openspec instructions <artifact> --change <id>` pour obtenir les exigences de génération.
- `openspec validate --all --strict --no-interactive` lorsque supporté par la version installée.
- `openspec archive <change-name> -y` pour l'archivage non interactif et la mise à jour des specs.
- Skills tels que `openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-sync-specs`, `openspec-archive-change`, `openspec-verify-change`.

**Point d'intégration** : installer/configurer une version explicite et compatible de la CLI + Agent Skills dans la factory. Inspecter `openspec --help`, `openspec schemas` et les instructions de schéma lors du développement ; ne pas coder une supposition sur une CLI mouvante. Le projet doit versionner `openspec/config.yaml` et fixer son schéma (préférence initiale `spec-driven`).

## Mapping backlog → OpenSpec

- Un `TS-NNN` peut référencer un ou plusieurs changes **déterministes**, versionnés, en fonction de la taille réelle du besoin.
- Les spécifications canoniques sont les exigences de produit ; la proposition est le delta en cours.
- Les critères d'acceptation backlog alimentent `tasks.md` et les tests, sans constituer un duplicata contradictoire.
- Une reprise lit les changes, leurs checkboxes, les commits distants et les statuts ; aucune recréation systématique d'artefacts.
- Synchroniser puis archiver **après** validation de comportement ; une erreur de sync/archive doit bloquer la livraison au lieu d'être absorbée.
- Documenter les exceptions (simple README/formatage sans modification comportementale) dans le rapport de livraison et ne pas créer de faux changes.

## Invariants d'autonomie

1. **Explore / Propose** peuvent rester en mode plan seul lorsque demandé ; aucun code produit modifié.
2. Le passage à **Apply** nécessite une autorisation explicite d'exécution.
3. Un item `tasks.md` marqué fait correspondre code + checklist + commit + push + vérification du SHA distant.
4. Le modèle et le prompt ne sont jamais la preuve de conformité : les tests et la validation vérifient les conséquences.
5. Une modification du contrat public, des permissions ou de la persistance doit bloquer si les décisions sont ambiguës.
6. Le changement archivé et les specs canoniques doivent être dans un état versionné, vérifié et livrable.

## Pilote OpenSpec manuel proposé

Le nouveau workflow `.github/workflows/agent-openspec.yml` introduit un **lancement
manuel par phase** sans retirer le workflow OpenCode direct historique.
`phase=plan` explore le code et fait produire par OpenCode les artefacts
`proposal.md`, `design.md`, `specs/**/spec.md` et `tasks.md` dans
`openspec/changes/ts-nnn/`, puis les valide et publie une PR brouillon.
`phase=apply` exige ce plan déjà validé sur branche persistante, exécute
OpenCode, exige tests et checklist achevée, valide le change et archive avec
`openspec archive ts-nnn --yes` : **c'est cet archivage qui synchronise
les deltas vers `openspec/specs/`**.

Les phases ne sont pas des sous-commandes CLI `explore` ou `propose` :
ce sont des instructions agentiques guidées par les commandes CLI
`openspec instructions` et `openspec validate`. Les deux phases consomment
OpenRouter uniquement après déclenchement manuel. Version CLI épinglée sur
`1.14.1`. Exécution E2E démontrée sur TS-005 : phase plan, PR #8 brouillon, phase apply, puis implémentation et fusion par le propriétaire. Les contrôles détaillés des futurs changements restent à vérifier pour chaque run. Mode d'emploi : [pilote manuel](openspec-manual-pilot.md).

## État réel et améliorations à venir

ThreadStep exécute désormais OpenSpec via `.github/workflows/agent-openspec.yml`, en parallèle du workflow direct historique `.github/workflows/agent.yml`. TS-005 a été réalisée avec le cycle plan/apply et fusionnée. Les améliorations restantes sont :

1. Initialiser et figer CLI / Skills / config OpenSpec ; ajouter une tâche de démonstration.
2. Mettre `Explore + Propose + validation` sur branche dédiée, avec tests de conformité des artefacts.
3. Ajouter `Apply + Verify + Sync + Archive` et des checkpoints durables.
4. Garder la même interface d'entrée `task_id` en mode manuel ; l'orchestrateur n'est qu'un appelant supplémentaire.
5. Ajouter un test E2E qui prouve la présence des specs canoniques mises à jour, de l'archive, du code testé et de la PR.

## Références officielles

- [OpenSpec CLI](https://openspec.dev/docs/cli)
- [OpenSpec setup et Agent Skills](https://openspec.dev/docs/setup)
- Précédent concret : `mestryn/AGENTS.md` et ses règles d'OpenSpec autonome, à adapter plutôt qu'à copier aveuglément.
