# ASF-V3-025 — CLAIM_CHILD à preuve ACK-parent et CAS Git

**Statut : prototype non connecté, sans exécution payante, PR draft sur #116.**

Le prototype exige que le run enfant GitHub-native corresponde au même bot exécuteur, au même `wave_id`/`task_id` et au `reservation_sha` de l'événement de dispatch initial. Ce n'est jamais une permission de payer.

## Chaîne de preuve read-only

1. Capturer le contexte natif du workflow enfant et les trois inputs ; comparer le run original auprès de GitHub REST : workflow exact, bot, `run_attempt=1`, SHA de source `main`.
2. Vérifier les trois rulesets GitHub attendus, puis relire le registre global `ACTIVE` au SHA exact, avec l'identité du manifeste et du mandat propriétaire.
3. Rejouer le manifeste et le journal épinglés au SHA du HEAD de vague. Le journal doit être `CHILD_ACKNOWLEDGED`, avec **dernier événement `ACK_CHILD` épinglé au même `childRunId`**, à la même tâche et au même workflow.
4. Lire le **commit Git de l'ACK** et imposer son parent unique = `reservation_sha` passé au dispatch. Ceci empêche de revendiquer un ACK sans chaînage physique avec la réservation Git initiale.
5. Relire les références main, global et wave : aucune modification concurrente n'est admissible. Le résultat positif reste `child_claim_candidate_not_authorized`, tous les droits à `false`.

## Port CAS simulé

La fonction `attemptV3GithubChildClaimCAS` répète la vérification, calcule la transition `CLAIM_CHILD` via le kernel de cycle de vie, revérifie l'ensemble des preuves immédiatement avant un appel au CAS de vague `commitV3JournalCAS`, puis rejoue le journal au nouveau SHA. Une collision fast-forward ou une réponse réseau incertaine termine sans tentative supplémentaire.

**Très important** : aucun workflow actif n'appelle ce port. Les tests utilisent des faux transports ; le fait d'obtenir `EXECUTING` dans un journal simulé ne permet pas d'appeler OpenRouter. Il reste à lier une preuve de budget owner et le mutex payé V1/V3 **avant** le moindre départ facturable, avec vérification réelle des permissions de l'App contrôleur/exécuteur.

Prochain jalon : concevoir les contrôles du mutex paid global et du quota de démarrage, sans l'activer et sans copier les clés V1 vers V3. Séparer les tests GitHub réels des tests de contrats mockés.

Suivi : [issue #86](https://github.com/cedricmenec/threadstep/issues/86), [Notion ASF](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).