# ASF-V3-025 — Convergence sur le mutex payé existant V1/V3

**Statut : contrat de lecture et de tests uniquement, PR brouillon empilée sur #111. Aucun nouveau job OpenRouter, aucune activation ou dépense.**

## Fait vérifié sur le `main` du dépôt GitHub

Les trois workflows V1 qui lancent potentiellement un modèle payant déclarent le **même** groupe au niveau de leur job `develop` :

| Workflow V1 | Job | Concurrence |
|---|---|---|
| `.github/workflows/agent-openspec.yml` | `develop` | `threadstep-paid-development-v1` / `cancel-in-progress: false` |
| `.github/workflows/agent-asf.yml` | `develop` | idem |
| `.github/workflows/agent.yml` | `develop` | idem |

Le parent `.github/workflows/backlog-orchestrator.yml` utilise un **autre groupe** `threadstep-asf-parent-wave-v1`, car il ne doit pas monopoliser le verrou d'un enfant payé.

La documentation GitHub précise que les groupes de concurrence sont **partagés dans le dépôt**, y compris entre workflows, et sérialisent les jobs du même groupe. Avec les paramètres par défaut, une nouvelle exécution en attente peut **annuler une ancienne exécution en attente**. Par conséquent un run annulé/omis/ambigü ne doit jamais être considéré comme un lancement payé réussi ni relancé automatiquement.

## Code ajouté

`scripts/asf/v3/github-native-paid-mutex-readiness.mjs` expose deux fonctions **non autorisantes** :

- `inspectV3SharedPaidMutexLayout` valide la disposition du job `develop` des trois workflows V1 existants, sans accepter une simple occurrence du nom dans un commentaire ou un job différent. Le préflight V3 `child-preflight` ne doit **pas prendre le verrou payé**.
- Le futur job V3 `paid-development`, s'il est ajouté par une PR propriétaire distincte, doit déclarer **au niveau du job** `concurrency: group: threadstep-paid-development-v1` et `cancel-in-progress: false`. Un groupe de verrouillage V3 différent, un groupe workflow parent, ou une annulation en cours sont rejetés.
- `observeV3GithubSharedPaidMutex` lit **les sources V1 au SHA `main` attendu** directement sur l'API GitHub (`contents?ref=<SHA>`), valide le metadata/base64 et relit `main` pour détecter une course. Un résultat `v1_lock_confirmed_v3_paid_job_absent` signifie précisément que **V3 n'a encore aucun job payé**.

Les contrôles sont volontairement un **audit d'une forme YAML connue**, pas un parseur YAML complet ni une preuve d'absence de toute invocation payante dans un dépôt. Les tests indépendants actionlint, la revue humaine et des scénarios réels de concurrence sont encore nécessaires.

**Toutes les réponses** restent `authorized:false`, `canStartPaid:false`, `canPay:false`, `canWrite:false`, `canDispatch:false`, `canSpend:false`, `canRetry:false`.

## À faire avant pilote

1. Auditer et approuver séparément le futur job `paid-development` : propriétaire, code et provenance GitHub App, règles d'environnement, absence d'accès au token payant avant les trois contrôles globaux et claims.
2. Brancher `inspectV3GithubSharedPaidMutex` à une étape du futur runtime owner sur `main`, et refuser si un des trois workflows V1 a divergé ou si `main` change pendant l'observation.
3. Tester les collisions GitHub Actions entre un vrai job V1 et un job V3 **sans API OpenRouter** ; distinguer jobs `pending`, `cancelled` et `in_progress` sans retry automatique.
4. Pour V3, vérifier avant exécution payante l'admission globale, le `CLAIM_CHILD` durable, la limite 1–10, le zéro retry payé, l'autorisation owner et le secret dans l'environnement protégé après audit.

Le ref global V3 est encore absent ; aucune transaction opérationnelle n'est autorisée par ce module. Voir [suivi GitHub #86](https://github.com/cedricmenec/threadstep/issues/86) et [Notion ASF](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).