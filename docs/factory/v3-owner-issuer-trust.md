# ASF V3 : préflight owner et conception de l'émetteur de confiance

**Statut : contrôle de cohérence proposé, non opérationnel et non autorisant.**
Tâche [ASF-V3-009](tasks/ASF-V3-009.md). Dépendance technique [PR #77](https://github.com/cedricmenec/threadstep/pull/77), basée sur [PR #75](https://github.com/cedricmenec/threadstep/pull/75). Audit V3 : [v3-cross-pr-security-review.md](v3-cross-pr-security-review.md), actuellement dans la PR #73.

## Problème précis : run owner valide ≠ inputs approuvés

Un run GitHub portant \`actor=cedricmenec\`, \`workflow_dispatch\`, le bon workflow V3, \`run_attempt=1\` et le bon SHA signifie seulement que les métadonnées du run correspondent à l'attendu. **Il n'établit pas que le propriétaire a demandé le modèle, le nombre de démarrages, l'auto-merge et la liste de tâches inscrits dans le manifeste.**

L'API REST \`GET /repos/{owner}/{repo}/actions/runs/{run_id}\` sert ici à une vérification indépendante de l'identité du run. Les inputs de \`workflow_dispatch\` sont, eux, spécifiés dans la définition YAML du workflow et transmis à \`inputs\` et \`github.event.inputs\` dans son contexte d'exécution. Il ne faut pas reconstituer le mandat depuis le seul JSON du run GET, ni depuis des champs proposés par un agent.

Références :
- [GitHub Docs — Get a workflow run](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run).
- [GitHub Docs — workflow_dispatch inputs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatchinputs).

## Contrat de données du contrôle proposé

Le code \`scripts/asf/v3/owner-intent-preflight.mjs\` accepte trois éléments **distincts** :
1. **Manifeste V3 figé** et strict : dépôt fixé \`cedricmenec/threadstep\`, modèle allowlist, \`maxTaskStarts\` de 1 à 10, \`maxConcurrentTasks=1\`, \`maxPaidRetries=0\`, \`candidateTasks\` uniques, acteur et workflow owner correspondant à \`main\`.
2. **Owner context proposé**, avec \`runId\`, \`actor\`, \`runAttempt=1\`, \`workflowRef\`, \`eventName\`, \`ref\`, \`sha\` et six inputs explicites. **La provenance directe de ce contexte doit être garantie par le futur workflow V3 protégé** ; l'entrée \`ownerContext\` injectable de ce module n'offre PAS une telle garantie.
3. **Observation indépendante GitHub** de la même exécution, chargée par un client lecture seule à l'URL exacte construite depuis \`runId\`, et vérifiée pour acteur, dépôt, workflow, événement, tentative, branche et SHA.

### Inputs à approuver pour le futur workflow propriétaire V3

| Input projeté | Rôle métier / comparaison | Règle fail-closed |
|---|---|---|
| \`wave_id\` | identité de vague figée | chaîne identique au manifeste |
| \`model\` | choix du modèle sur l'allowlist | égal au modèle du manifeste |
| \`max_task_starts\` | plafond de 1 à 10 démarrages payants | chaîne canonique (\`1\`…\`10\`), quota strict |
| \`auto_merge\` | autorisation d'auto-merge selon les règles de protection existantes | chaîne explicite \`true\` ou \`false\` conforme au booléen du manifeste |
| \`backlog_commit\` | SHA du code/backlog sélectionné | SHA40 exact, identique à celui du run |
| \`candidate_set_sha256\` | gel de la **liste ordonnée** des tâches et de leur hash de contenu | \`contentSha256(candidateTasks)\` strictement identique |

**Ces six inputs ne sont pas aujourd'hui configurés sur un workflow V3.** Il s'agit d'une proposition à soumettre dans une PR de workflow **séparément approuvée**. Un workflow ne doit pas autoriser un émetteur à recalculer les inputs du propriétaire *après coup* : la valeur owner initiale est l'autorité métier à protéger.

### Déroulement proposé à implémenter après approbation

\`\`\`text
Owner (UI workflow_dispatch sur main)
   │  choix explicites et gel des candidats
   ▼
Contexte de workflow approuvé, immutable sur main protégé
   │  inputs capturés directement depuis github.event.inputs
   ▼
Préflight ASF-V3-009 (compare les six champs au manifeste)
   │
   ├── GET GitHub /actions/runs/<id> (observation indépendante)
   ├── mismatch / rerun / 403 / réseau ambigu ──► STOP
   ▼
consistent_not_authorized
   │  NE SIGNER NI DISPATCHER À CE STADE
   ▼
Émetteur de confiance DISTINCT, politique owner-approved (non implémenté)
   │  confirme protections, candidate snapshots et non-réutilisation
   │  signe mandat avec clé privée isolée / vérificateur épinglé
   ▼
Reçu Ed25519 de #77, témoin immuable, ADMIT CAS global
   ▼
Contrôles réservations par vague et mutex payant partagé
\`\`\`

La réponse positive de \`inspectV3OwnerIntent\` est **\`status=consistent_not_authorized\`**, jamais \`authorized:true\`. Elle renvoie un \`manifestHash\`, un \`candidateSetHash\`, \`ownerRunId\`, \`waveId\` et \`sourceSha\` informatifs. Le résultat contient toujours \`canSign:false\`, \`canDispatch:false\`, \`canSpend:false\`. Aucun fichier du module ne signe, publie de run ou manipule un token.

## Frontières de confiance et limitations encore ouvertes

### 1. Provenance et code du runner

Le modèle de comparaison n'est utile que si le contexte source est contrôlé par un **workflow propriétaire** défini et approuvé sur une branche protégée. Le même JSON envoyé par un agent hostile satisferait les contrôles de cohérence si un appelant le soumettait. La politique de production devra empêcher cette substitution en plaçant l'évaluation dans un runner/procédé de confiance séparé de l'agent, en fixant l'identité des workflows, des appels et des secrets. Aucune interface du module ne donne une garantie d'authenticité de l'argument \`ownerContext\`.

### 2. Autorité de signature Ed25519

La PR #77 protège la preuve signée et son stockage mais injecte \`verificationKey\` depuis un appelant de test. Une autorisation réelle nécessiterait :
- clé publique de vérification **épinglée** dans le contrôle de confiance approuvé, avec fingerprint et rotation encadrés ;
- clé privée confinée à l'émetteur, **jamais** à l'agent produit, au manifeste, aux inputs de dispatch ou au job OpenRouter ;
- séparation entre la validation du mandat owner et l'accès au writer du ref global ;
- contrôle que le reçu signé correspond exactement au run initial de la vague et au hash de manifeste approuvé ;
- mécanisme de révocation/incident après compromis, sans retry payant automatique.

L'utilisation d'un issuer injecté ou d'une clé apportée par l'agent ne prouve pas que le propriétaire a consenti. **Aucune clé de production n'est créée ou stockée par ASF-V3-009.**

### 3. Candidats et ordre de gel

Le hash de la liste ordonnée des candidats est calculé avec le canoniseur existant. Il protège contre une modification de l'ensemble *une fois la valeur owner capturée*, mais ne prouve pas que l'ensemble a été préparé par un lecteur fiable du backlog au bon SHA. Un préflight indépendant des métadonnées du backlog et de la sélection de tâches reste nécessaire ; ne pas permettre à l'issuer de fabriquer a posteriori la valeur \`candidate_set_sha256\` qu'il vérifie.

### 4. Permissions et absence de workflow V3

Le workflow \`backlog-orchestrator-v3.yml\` prévu n'existe pas en production. Le workflow OpenSpec enfant actuel contient des conditions owner-only incompatibles avec un dispatch bot V3. Cette PR ne change pas le YAML. Tout nouveau workflow propriétaire, l'accès \`Actions:write\` ou \`Contents:write\`, le pinning de clés et le bootstrap effectif nécessitent une **revue de sécurité et un consentement explicite séparés**.

### 5. Ambiguïté d'un appel API

Une observation GitHub manquante, inaccessible ou ambiguë produit \`uncertain\`, sans attribuer une permission au run. Un run rejoué (\`run_attempt > 1\`), terminé en échec, de mauvais acteur, workflow, dépôt ou SHA est rejeté. Pas de nouvelle tentative automatique de paiement.

## Validation du lot

\`tests/asf-v3-owner-intent-preflight.test.mjs\` vérifie, avec un \`createGithubClient\` simulé et sans réseau :
- la concordance nominale d'un manifeste V3 et de ses six inputs, avec lecture de l'exact run ID ;
- l'impossibilité d'obtenir \`authorized:true\`, une signature, un token ou un droit de dépense ;
- les refus d'un autre \`waveId\`, d'un modèle modifié, de quotas 2→3 ou 02, d'un auto-merge non demandé, du mauvais commit et du hash candidat falsifié ;
- le refus d'acteur, de ref, de SHA, de workflow, de rerun, de run GitHub terminé en erreur et de champs inconnus ;
- l'arrêt conservateur si GitHub répond 403, sans retry et sans exposer le contenu brut de l'erreur.

La validation des contrats avec le vrai publisher et la GitHub App est **non réalisée**. La CI indépendante atteste des fonctions testées et de leur innocuité réseau, pas de l'autorisation owner.

**Décision proposée : conserver l'issuer désactivé et ne pas entreprendre d'intégration workflow/permissions/payante avant validation séparée de la racine de confiance.**
