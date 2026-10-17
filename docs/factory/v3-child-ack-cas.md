# ASF V3-024 — CAS de l'ACK_CHILD, toujours non connecté

**PR brouillon empilée sur #109. Aucun token GitHub App, workflow privilégié ou paiement.**

Le contrôleur doit enregistrer une confirmation enfant `ACK_CHILD` dans le journal de la vague, sans laisser l'agent écraser une réservation concurrente. Ce prototype utilise `observeV3GithubChildAckReadiness` (#109) pour recouper le vrai run GitHub avec l'admission globale et la réservation `DISPATCH_PENDING`, puis le kernel `advanceV3` et le CAS `commitV3JournalCAS` existants.

## Algorithme

1. Observation indépendante du run enfant, de la règle de protection globale, du registre ACTIVE et des manifest/journal SHA-pinnés.
2. Chargement une nouvelle fois du snapshot de vague au SHA de réservation exact, replay complet et vérification du hash du journal.
3. Projection `ACK_CHILD` avec `childRunId`, `taskId`, `runAttempt:1` et workflow enfant épinglés ; la transition n'est permise que depuis `DISPATCH_PENDING`.
4. Nouvelle observation indépendante de GitHub avant écriture : l'identité de la tâche, du run, du manifeste, du journal et des deux refs doit toujours concorder.
5. Appel unique au port `commitV3JournalCAS` : tree conservant les autres fichiers, commit Git à parent unique = précédent SHA du ref de vague, PATCH non forcé.
6. Relecture du manifeste et du journal au **nouveau SHA** et rejeu ; vérifier `CHILD_ACKNOWLEDGED` et l'ID du run.

Un conflit, timeout, réponse PATCH perdue, journal corrompu ou relecture absente : aucune relance automatique ; la sortie ne confère jamais `canClaim` ni `canSpend`.

## Frontière de sécurité

La fonction `attemptV3GithubChildAckCAS` ne crée pas de client GitHub réel : ses ports de lecture et d'écriture sont injectés dans des tests locaux. La sécurité du futur writer dépend encore de l'authentification native du runner, de la séparation entre l'App exécuteur V1 et l'App contrôleur V3, et de la restriction effective du token de vague. Une simple réussite d'un mock n'est pas une permission de lancer OpenRouter.

**P0 restant :** vérifier en conditions réelles qui peut modifier `refs/heads/asf/waves/*`, choisir l'identité qui persiste les événements de journal, qualifier `CLAIM_CHILD` et le mutex paid partagé avant d'activer le workflow enfant.

Suivi : [issue #86](https://github.com/cedricmenec/threadstep/issues/86), [Notion ASF](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).