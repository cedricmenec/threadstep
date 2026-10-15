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

## CLI et Agent Skills : intégration du pilote

La documentation actuelle d'OpenSpec expose notamment :
- `openspec init`, `openspec new`, `openspec list`, `openspec show`, `openspec status`.
- `openspec instructions <artifact> --change <id>` pour obtenir les exigences de génération.
- `openspec validate --all --strict --no-interactive` lorsque supporté par la version installée.
- `openspec archive <change-name> -y` pour l'archivage non interactif et la mise à jour des specs.
- Skills tels que `openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-sync-specs`, `openspec-archive-change`, `openspec-verify-change`.

**Point d'intégration implémenté :** OpenSpec 1.14.1 est épinglé, `openspec/config.yaml` et son schéma `spec-driven` sont versionnés, et les skills/commandes OpenCode sont générés à chaque runner éphémère via `openspec init --tools opencode,agents`. OpenCode reste installé par `@latest` et mérite un épinglage après validation.

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
3. Un item `tasks.md` coché atteste le travail d'implémentation vérifié **avant sync**, sans promettre un commit distant à chaque item : le workflow actuel publie au terme du run. Les contrôles post-sync ne sont pas des cases pré-sync.
4. Le modèle et le prompt ne sont jamais la preuve de conformité : les tests et la validation vérifient les conséquences.
5. Une modification du contrat public, des permissions ou de la persistance doit bloquer si les décisions sont ambiguës.
6. Le changement archivé et les specs canoniques doivent être dans un état versionné, vérifié et livrable.

## État implémenté et preuves (15 octobre 2026)

Le workflow agent-openspec.yml fonctionne avec plan, apply, auto et
finalize : contrôle du plan, tests, validation stricte, sync et archive.
TS-008 (PR #21) a validé un ajout ADDED avec un prompt agentique ; TS-009
(PR #26) a validé une modification MODIFIED d'une capacité existante avec
la commande OpenCode générée.

La CLI OpenSpec n'interprète pas elle-même /opsx:sync : openspec init
génère des **Agent Skills et commandes OpenCode**, ensuite exécutés par
opencode run --command opsx-sync. En runner éphémère :

- Installer @fission-ai/openspec@1.14.1 et OpenCode.
- Exécuter openspec init --tools opencode,agents.
- Vérifier .opencode/skills/openspec-sync-specs/SKILL.md,
  .opencode/commands/opsx-sync.md et
  .agents/skills/openspec-sync-specs/SKILL.md.
- Invoquer opencode run --auto --model "$OPENCODE_MODEL"
  --command opsx-sync "$CHANGE_ID".
- Comparer les empreintes de contenu avant/après avec
  scripts/sync-guard.mjs ; seules openspec/specs/ sont autorisées.
- Archiver par openspec archive "$CHANGE_ID" --yes --skip-specs, puis
  valider specs actives et archivées en mode strict.

Le run [38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641)
a passé toutes ces étapes ; la CI de main après merge #26 a réussi
[60 tests](https://github.com/cedricmenec/threadstep/actions/runs/38713003608).
La section canonique « Suggestion card content » a été modifiée avec son
scénario antérieur préservé et trois nouveaux scénarios ; exigences
voisines inchangées. Cela ne démontre pas REMOVED, RENAMED ou les conflits.

**Contrat des tâches** (PR #25) : ne cocher dans tasks.md que des étapes
réalisables pendant apply **avant** sync. Les inspections après sync,
archive ou CI sont des contrôles post-sync distincts sans checkbox. Le
validateur scripts/check-openspec-task-phases.mjs s'exécute au moment du
plan et au précontrôle apply. Il complète la revue humaine ; il n'est
pas une preuve de correction sémantique.

## Références et procédures

- [État courant](current-state.md)
- [Pilote OpenSpec manuel](openspec-manual-pilot.md)
- [OpenSpec supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
- [OpenSpec commandes](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md)
- [OpenCode skills](https://opencode.ai/docs/skills/)
- [OpenCode CLI](https://opencode.ai/docs/cli/)
