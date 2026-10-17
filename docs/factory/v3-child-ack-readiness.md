# ASF-V3-023 — Observateur ACK de l'agent enfant, GitHub-native et sans privilège

**Statut : PR en brouillon empilée sur #108, non payante.** L'App exécuteur V1 (`threadstep-software-factory`, App ID `5321746`) reste distincte de l'App de contrôle V3 (`5361227`). Le lecteur de l'agent enfant n'a ni clé App ni secret payé.

## Contrat

Le workflow `.github/workflows/agent-openspec-v3.yml` conserve ses trois inputs `wave_id`, `task_id`, `reservation_sha` et son `if` protégé (`threadstep-software-factory[bot]`, `main`, `run_attempt == 1`). Il ajoute **une seule étape de lecture** avant son refus final : `node scripts/asf/v3/child-ack-readiness.mjs verify`.

Ce script lit `GITHUB_EVENT_PATH` (événement natif du runner), recoupe `GITHUB_ACTOR`, `GITHUB_WORKFLOW_REF`, run ID, attempt, SHA de source et les trois inputs exacts. Il compare ensuite **le run GitHub REST original à son ID exact** : acteur bot, dépôt, chemin du workflow, événement `workflow_dispatch`, branche main, SHA et attempt.

Ensuite, le contrôleur logique lit les trois rulesets exacts, le HEAD actuel de main et le SHA du ref global, le registre global au commit pinné, et le snapshot manifeste+journal du ref `refs/heads/asf/waves/<wave_id>` au **SHA de réservation attendu**.

Une proposition `ACK_CHILD` n'est construite que si :

- Le registre global est `ACTIVE`, pointe vers le même `waveId`, le hash du manifeste, le run owner original et le `backlogCommit` validé ; son histoire inclut la vague.
- Le journal est rejouable, au **statut `DISPATCH_PENDING`**, avec réservation active pour la bonne tâche, le dernier événement `DISPATCH_INTENT`, quota non dépassé et aucun autre `childRunId` attaché.
- Les trois refs main/global/wave sont **relus** et identiques à leur premier état : la réservation ne peut pas être déplacée silencieusement entre deux observations.

La sortie `child_ack_candidate_not_authorized` propose `ACK_CHILD` avec `childRunId` et workflowRef exacts mais **n'écrit absolument rien**. `authorized`, `canAck`, `canClaim`, `canWrite`, `canDispatch`, `canSpend`, `canRetry` restent toujours à `false`. Le workflow enfant exécute **toujours** son étape de refus `workflow-runtime-preflight.mjs child` après cette lecture.

## Ce qu'il reste AVANT toute exécution payante

Le contrôleur GitHub App doit écrire `ACK_CHILD` par **CAS sur le ref de vague**, puis l'agent enfant doit relire cette ACK depuis Git au SHA exact, prouver la même identité/run et réussir une **CLAIM_CHILD atomique** par le mécanisme approuvé. Enfin le mutex paid `threadstep-paid-development-v1`, les quotas de vague et les autorisations effectives doivent être confirmés. Aucune preuve ACK isolée ne peut autoriser un appel OpenRouter.

**Sécurité :** les requêtes de production de ce script sont limitées à GET vers le run, rulesets, refs de `main`/global/wave, et les fichiers SHA-pinnés `manifest.json`, `journal.json`, `registry.json`. Aucun POST/PATCH, token de l'App contrôleur, secret ou permissions write. Les essais sont des réponses GitHub simulées : la réussite ne prouve pas les permissions des Apps réellement installées.

## Tests négatifs

- Fausse identité bot, mauvais run, mauvaise branche, attempt supérieur à 1, workflow enfant V1, input supplémentaire.
- Réservation absente, SHA de réservation périmé, mauvaise tâche, journal corrompu, absence de `DISPATCH_INTENT`.
- Règle GitHub erronée, registre global non admis ou corrompu, changements des refs avant le readback, API GitHub indisponible.

Suivi : [Issue #86](https://github.com/cedricmenec/threadstep/issues/86) et [Notion ASF V3](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).