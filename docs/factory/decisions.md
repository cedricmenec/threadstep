# Journal des décisions de conception

Les entrées **Acceptée** fixent l'intention de l'architecture cible ; elles ne prouvent pas l'implémentation.

| ADR | Statut | Choix et raison |
| --- | --- | --- |
| ASF-ADR-001 | Acceptée | **Factory générique** et **ThreadStep application pilote** sont séparées conceptuellement. Réutilisabilité sans imposer la stack de ThreadStep. |
| ASF-ADR-002 | Acceptée | **OpenRouter** est le fournisseur de modèles imposé par le projet ; modèle sélectionnable à chaque run. **OpenCode** est un adaptateur initial substituable. |
| ASF-ADR-003 | Acceptée | Backlog **Markdown versionné** en source canonique pendant le pilote ; création d'issues GitHub facultative. |
| ASF-ADR-004 | Acceptée | **`AGENTS.md`** porte les conventions et contraintes ; ne pas le confondre avec l'état des tâches. |
| ASF-ADR-005 | Acceptée | **Deux entrées durables** : manuel explicite et orchestrateur externe optionnel. Exécuteur/validations identiques. |
| ASF-ADR-006 | Acceptée, pilote manuel implémenté | **Spec-driven avec OpenSpec** : Explore, Propose, Apply, Verify, Sync, Archive sur les évolutions fonctionnelles. |
| ASF-ADR-007 | Acceptée | Branches de travail durables et livraison PR par défaut ; absence de fusion automatique pendant le pilote. |
| ASF-ADR-008 | Acceptée, implémentée et testée | GitHub App dédiée plutôt que PAT : PR #21 créée par le bot, CI de PR réussie. |
| ASF-ADR-009 | Acceptée | Les tests GitHub et la protection `main` sont des contrôles indépendants et ne doivent jamais être contournés pour gagner en autonomie. |
| ASF-ADR-010 | Acceptée (future) | L'orchestrateur sélectionne les tâches uniquement dans un **périmètre de vague explicitement autorisé** avec plafonds et vérification des dépendances. |
| ASF-ADR-011 | Option ouverte | Mode direct main de Mestryn conservé comme référence mais non activé dans ThreadStep. |
| ASF-ADR-012 | Acceptée, implémentée et testée pour ADDED/MODIFIED | Après apply, synchronisation sémantique par agent et archive --skip-specs : TS-008 prouve ADDED, TS-009 PR #26 prouve MODIFIED dans une capacité existante. REMOVED/RENAMED restent à tester. |
| ASF-ADR-013 | Acceptée, implémentée et validée E2E | OpenSpec init --tools opencode,agents, commande OpenCode --command opsx-sync et garde-fou SHA-256. Prouvé sur TS-009 run 38712079641 et PR #26 ; isolation hors sandbox non garantie. |
| ASF-ADR-014 | Acceptée, implémentée | Contrat de checklist pré-sync : contrôles post-sync hors cases à cocher ; validateur statique dans plan/apply (PR #25), testé en CI. |

## Origines vérifiables

- Ancien dépôt `cedricmenec/mestryn` : `.github/workflows/opencode.yml` offre `/oc`, checkpoints, reprise, création de PR et mode opt-in `DELIVERY: MAIN` réalisant un push fast-forward après validations.
- Attention : le workflow Mestryn **ne fait pas un auto-merge de PR par défaut** ; sa promotion directe ne contourne pas la branch protection.
- Dépôt pilote `cedricmenec/threadstep` : PR #1 (socle), PR #2 (smoke test fusionnée), PR #3 (règles/backlog), PR #4 (fonctionnalité réelle fusionnée), PR #21 (TS-008), PR #25 (garde checklist), PR #26 (TS-009).
- Référence GitHub au 14/10/2026 : [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token) et [GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/making-authenticated-api-requests-with-a-github-app-in-a-github-actions-workflow).
- Référence OpenSpec : [CLI](https://openspec.dev/docs/cli) et [Setup](https://openspec.dev/docs/setup).

**Statut actualisé le 15 octobre 2026, après PR #26.** L'historique initial n'est pas l'état courant ; voir [current-state.md](current-state.md) et [ASF-DOC-001](tasks/ASF-DOC-001.md).

## Questions à décider avant autonomie totale

1. Les classes de changements qui autorisent l'auto-merge versus review humaine.
2. Le déclenchement par vague et son budget maximum.
3. Le niveau de preuve exigé pour OpenSpec et les contrôles de code.
4. Le mode de persistance externe si plusieurs workers sont envisagés.
5. Les politiques de permissions pour plusieurs projets.
