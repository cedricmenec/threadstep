# ASF V3 — consolidation GitHub-native

**Décision du 17 octobre 2026 : la PR #87 est l'unique PR d'intégration V3 non payante.**

Sources physiques : les modules lifecycle, provenance, git-cas, trusted-snapshot, transaction-bridge, integration et github-git-data-port proviennent des PR #69–#74 consolidées dans #83. L'admission, les quotas, le mutex et les preuves de run proviennent de #75. L'ensemble est présent une fois par chemin sous scripts/asf/v3.

## Architecture retenue

- Mandat initial : GitHub Actions workflow_dispatch sur main, contrôleur propriétaire et vérification indépendante du run et des six inputs.
- Admission : github-native-control.mjs observe les rulesets et l'état du ref global. github-native-global-cas.mjs propose ADMIT avec un seul Git Data CAS fast-forward non forcé. Aucun transport write n'est encore branché en production.
- Bootstrap : registre global vierge une seule fois par dépôt, depuis un job propriétaire de confiance, sans jamais écraser un registre existant. Pas de signature ni de service de checkpoint externe.
- Par vague : snapshot immutable manifest/journal au même SHA, quotas 1–10, CLAIM_CHILD CAS, arrêt sans retry payé automatique.
- Terminal : global-terminal-evidence.mjs propose RELEASE/QUARANTINE d'après le journal réel rejoué, mais un contrôle GitHub des livraisons et un writer CAS de sortie restent à implémenter.
- Workflows : backlog-orchestrator-v3.yml et agent-openspec-v3.yml sont non payants, read-only et bloqués volontairement par workflow-runtime-preflight.mjs ; V1 inchangée.
- Limite opérationnelle : le propriétaire et GitHub constituent la confiance, pas un PEM Ed25519. App writer du registre et permissions GitHub réelles encore à approuver.

## Gestion des PR

Les PR de code historiques #69, #70, #71, #73, #74, #75, #77, #79 et #81 ont été clôturées sans fusion, sources préservées dans l'historique. La PR #83 a consolidé le code initial, #85 a ajouté une proposition terminale et #87 les workflows. Ces contenus convergent **dans #87** plutôt que dans plusieurs PR à fusionner successivement. Les PR purement documentaires #66–#68 restent distinctes.

La documentation des anciens prototypes Ed25519 et les tests associés sont retirés de l'arbre courant ; l'histoire Git reste disponible dans les PR correspondantes. La documentation de référence est docs/factory/v3-github-native-decision.md.

## Conditions avant première V3 opérationnelle

1. Qualifier CI complète de #87 et contrôler manuellement la diff consolidée.
2. Installer et tester une protection réelle du ref global et une App contrôleur distincte de l'agent.
3. Implémenter bootstrap one-shot et contrôleur owner qui capture réellement le contexte d'inputs.
4. Compléter la sortie RELEASE/QUARANTINE sous CAS et la preuve indépendante de livraison.
5. Implémenter dispatch, ACK, CLAIM_CHILD, mutex paid partagé V1, no-retry et bornes temps/tours.
6. Dry-run GitHub App non payant puis accord explicite pour un pilote payant d'une tâche.

**Jamais de fusion, de ref global opérationnel, de secret, de token write ni d'appel OpenRouter depuis cette PR de préparation.**