# ASF V3 — Workflows de revue GitHub-native

**Statut : PR #87, non déployée, non payante, toujours fail-closed.** Aucun secret, droit write ou jeton OpenRouter ajouté.

## backlog-orchestrator-v3.yml

Trigger workflow_dispatch réservé à l'owner sur main et première tentative. Les six inputs attendus sont wave_id, model, max_task_starts (1–10), auto_merge, backlog_commit et candidate_set_sha256. Le job owner-preflight effectue checkout sans persistance des identifiants, configuration Node 22, puis appelle workflow-runtime-preflight.mjs controller. Les permissions YAML restent contents:read et actions:read. **Il ne crée encore ni registre ni vague.**

## agent-openspec-v3.yml

Trigger workflow_dispatch pour l'App bot prévue, main, première tentative, avec wave_id, task_id et reservation_sha. Ces inputs ne sont jamais des permissions. Le job child-preflight fait checkout sans persistance, Node 22, puis workflow-runtime-preflight.mjs child. **Il échoue volontairement avant tout claim ou paiement.**

Le workflow V1 agent-openspec.yml est inchangé ; les identifiants V3 utilisent le nouvel enfant -v3.yml.

## Modèle de confiance simplifié

Le CLI vérifie des métadonnées de contexte puis refuse toujours la dépense car le contrôleur global et le CLAIM_CHILD ne sont pas branchés. Une future PR doit utiliser le contrôleur owner seul pour capturer directement les inputs du run GitHub, puis le registre global Git protégé et le CAS ; aucune clé Ed25519 ni ancre externe ne sont nécessaires.

Avant une étape OpenRouter : vrai ACK GitHub du child run, journal de vague relu/rejoué, CLAIM_CHILD CAS exclusif, quota de démarrages, groupe threadstep-paid-development-v1 au niveau du JOB payant, cancel-in-progress:false, zéro retry payé et bornes d'exécution (durée/tours).

Les vrais droits de l'App contrôleur (write sur le ref global) et ceux de l'agent doivent être vérifiés séparément ; le contrôle d'un ruleset simulé ne les authentifie pas. Voir issue #86 et docs/factory/v3-github-native-decision.md.

Il est interdit de remplacer le refus CLI par un accès OpenRouter avant validation de bout en bout et accord du propriétaire.