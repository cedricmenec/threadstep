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

## État implémenté et intégration OpenCode (15 octobre 2026)

Le protocole fonctionne en pilote dans agent-openspec.yml : plan, apply, auto,
finalize, contrôle du plan, tests, validation stricte, sync et archive.
La PR #21 et le [run TS-008](https://github.com/cedricmenec/threadstep/actions/runs/38645900430)
démontrent cette chaîne sur une nouvelle capacité. La CLI OpenSpec 1.14.1 y
était installée, mais le sync était décrit dans le prompt, sans commande native.

**Important :** openspec init génère des Agent Skills et, pour OpenCode, des
fichiers de commandes. La CLI n'exécute pas directement la syntaxe /opsx:sync.
La PR de consolidation configure explicitement OpenCode via init --tools
opencode,agents, puis opencode run --command opsx-sync, avec une vérification
des empreintes hors specs canoniques. Son efficacité reste à tester après fusion.

- Agent Skills OpenCode : .opencode/skills/openspec-*/SKILL.md ;
  commandes OpenCode : .opencode/commands/opsx-*.md.
- Cible partagée : .agents/skills/openspec-*/SKILL.md ; pas de slash commands
  OPSX pour cette cible.
- La synchronisation agentique doit conserver les exigences hors delta
  et refléter le comportement implémenté ; la validation CLI stricte ne vérifie
  pas à elle seule la sémantique.
- Après sync par l'agent, archive --yes --skip-specs évite de refaire la fusion.

Le prochain test doit **modifier une capacité existante** avec MODIFIED et un
scénario ADDED, puis comparer la spécification canonique avant/après.
Le résultat TS-008 avec uniquement ADDED n'établit pas cette preuve.

## Références et procédures

- [État courant](current-state.md)
- [Pilote OpenSpec manuel](openspec-manual-pilot.md)
- [OpenSpec supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
- [OpenSpec commandes](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md)
- [OpenCode skills](https://opencode.ai/docs/skills/)
- [OpenCode CLI](https://opencode.ai/docs/cli/)
