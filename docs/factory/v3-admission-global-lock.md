# ASF V3 : admission exclusive des vagues et verrouillage partagé des appels payants

**Statut : politique déterministe et audit statique en PR de revue, non raccordés à un workflow.**
Tâche : [ASF-V3-007](tasks/ASF-V3-007.md). Dépendances : [#66](https://github.com/cedricmenec/threadstep/pull/66), [#69](https://github.com/cedricmenec/threadstep/pull/69), [#70](https://github.com/cedricmenec/threadstep/pull/70), [#71](https://github.com/cedricmenec/threadstep/pull/71), [#73](https://github.com/cedricmenec/threadstep/pull/73), [#74](https://github.com/cedricmenec/threadstep/pull/74).

## 1. Problème métier : une tâche payante n'est pas une vague

Le propriétaire peut autoriser jusqu'à dix démarrages **dans une seule vague**. L'exécution doit rester séquentielle (\`maxConcurrentTasks=1\`) et ne comporte aucun retry payant automatique.

Un mutex porté par un job d'agent empêche des jobs en cours d'exécuter simultanément une section critique, mais ne prouve pas qu'un seul ordonnanceur ASF possède un mandat de vague actif. Deux vagues distinctes pourraient chacune réserver une tâche et attendre le mutex payé ; il y aurait alors deux mandats actifs. Le protocole proposé impose **deux barrières différentes** :

1. **Admission exclusive d'une vague** : un registre global commun à tous les waveIds refuse toute nouvelle admission tant qu'une vague est active ou quarantinée.
2. **Exclusivité d'un job payant V1/V3** : chaque job qui utilise \`OPENROUTER_API_KEY\` partage le groupe GitHub Actions fixe \`threadstep-paid-development-v1\`, au niveau du job.

La barrière de claim unique \`CLAIM_CHILD\`, le mandat owner et l'ACK GitHub décrits dans les PR antérieures restent obligatoires. Un mutex GitHub Actions seul n'est **pas une autorisation de dépenser**.

## 2. Registre global : contrat de données

La machine \`scripts/asf/v3/global-admission.mjs\` est **pure**, sans I/O, sans jeton et sans horloge. Son futur ref prévu est \`refs/heads/asf/control/active-wave-v3\`, séparé des journaux \`refs/heads/asf/waves/<waveId>\`.

\`createAdmissionRegistry()\` produit un registre \`schemaVersion=1\`, \`revision=0\`, \`state=AVAILABLE\`, \`active=null\`, \`events=[]\`, \`history=[]\`.

\`advanceAdmissionRegistry(registry,event,expectedRevision)\` reconstitue d'abord chaque événement du registre (append-only), refuse la divergence du snapshot et produit un nouvel objet figé. Les événements suivants sont les seuls autorisés :

| Événement | Précondition | Effet durable proposé |
|---|---|---|
| \`ADMIT\` | \`AVAILABLE\`, \`waveId\` inédit | Enregistrer \`waveId\`, \`manifestHash\`, \`ownerRunId\` et \`originSha\`, passer \`ACTIVE\` |
| \`RELEASE\` | \`ACTIVE\` et fin **nominale** \`COMPLETED_QUOTA\` ou \`COMPLETED_NO_WORK\` cohérente | Libérer la place pour une **autre** vague sans effacer l'historique |
| \`QUARANTINE\` | \`ACTIVE\` et incident avéré/incertain | Garder le waveId actif et interdire toute nouvelle vague |
| \`DIAGNOSTIC_NOTE\` | \`QUARANTINED\` | Journaliser un constat secret-free, **sans reprise, libération ni paiement** |

Le prototype ne contient **pas** d'événement de déquarantaine automatique. Une décision explicite du propriétaire, après audit du nombre exact de tâches payées et des runs enfants, sera nécessaire pour concevoir une opération distincte. Une fin \`STOP_FAILED\` ou \`STOP_UNCERTAIN\` ne suffit pas à auto-libérer le registre.

Une nouvelle vague avec un \`waveId\` antérieurement utilisé est refusée, même si son prédécesseur a été clos. Le registre n'est **pas** un gestionnaire automatique de file d'attente.

### Persistance et concurrence

Un simple \`expectedRevision\` local n'est pas une primitive d'atomicité inter-runners. Le futur writer du registre doit suivre une transaction Git Data CAS :

- Lire le HEAD du **même ref global**, et non un ref par vague.
- Valider le manifeste originel et son attestation par une source de confiance indépendante.
- Créer un commit à **parent unique** égal au HEAD lu ; n'ajouter que l'événement \`ADMIT/RELEASE/QUARANTINE\`.
- Écrire le ref global avec \`force:false\`, puis relire HEAD et vérifier le commit et le rejeu intégral. Deux commits frères ne peuvent pas être tous les deux fast-forward.
- Si écriture en conflit, réponse perdue, ref manquant ou observation incertaine : **pas de retry automatique de réservation ni de dispatch**. Contrôle et décision owner après diagnostic.

Ce nouveau ref a un schéma et des droits qui lui sont propres ; le port de [#74](https://github.com/cedricmenec/threadstep/pull/74), volontairement limité à \`asf/waves/<waveId>\`, **ne peut pas être utilisé tel quel pour le registre global**.

### Ordre de création d'une vague

\`\`\`text
Owner workflow_dispatch (run ID exact)
  -> validation du mandat, source SHA, candidates et modèle
  -> ancrage de confiance indépendant de l'identité du run
  -> ADMIT avec CAS sur le ref GLOBAL (un seul gagnant)
  -> création du manifeste/journal de vague par writer approuvé
  -> RESERVE + DISPATCH_INTENT puis workflow_dispatch de l'enfant
  -> ACK durable + CLAIM_CHILD atomique avant paiement
  -> vérification PR/check/merge/main/Pages
  -> checkpoint + nouvelle tâche, jusqu'à quota ou absence de travail
  -> RELEASE GLOBAL uniquement après fin nominale **prouvée**
\`\`\`

L'ordre et la preuve d'échec partiel entre \`ADMIT\` et création du journal devront être traités par un protocole d'initialisation idempotent **sans relance payante**, ou par quarantaine. Ce contrôle est **non implémenté**.

## 3. Origine du manifeste : contrôle de cohérence ≠ preuve de confiance

\`assessV3GenesisCandidate\` examine un manifeste V3, les **métadonnées du run owner récupérées depuis GitHub** et le commit initial supposé de la branche de vague. Le modèle refuse acteur erroné, \`run_attempt > 1\`, mauvaise branche, SHA source différente, workflow inattendu, commit de départ mal formé, manifeste hash divergent ou fichiers inattendus.

Même si toutes les métadonnées concordent, il renvoie \`CONSISTENT_BUT_UNANCHORED\` et \`ok:false\`. **Pourquoi ?** Un attaquant capable d'écrire une branche peut forger des champs d'auteur et créer un commit pointant vers un manifeste de son choix ; l'existence d'un run owner n'établit pas que ce run a créé ce commit. Un simple booléen \`ownerVerified\` dans un JSON de branche ne constitue aucune preuve de sécurité.

La future phase de bootstrap doit fournir un ancrage indépendant par un publisher GitHub App contrôlé (preuve de mandat et de provenance validée au moment de l'écriture, et reçu immuable sous un ref protégé distinct ou un système équivalent). Ni cette PR ni un agent modèle ne peuvent produire arbitrairement l'ancre qui les autorise eux-mêmes.

Le \`manifestHash\` est un hash de contenu, **pas une signature cryptographique** et pas une preuve de l'identité de l'émetteur.

## 4. Auditer les workflows actuels sans les modifier

\`auditPaidWorkflowMutex(workflowFiles, exhaustiveWorkflowPaths)\` lit des **sources YAML confiées par l'appelant**, identifie les jobs contenant \`OPENROUTER_API_KEY\` et recherche, **dans le bloc propre du job**, un \`concurrency.group\` exactement égal à \`threadstep-paid-development-v1\` et \`cancel-in-progress: false\`.

Les trois jobs payants V1 actuellement visibles sont :

| Workflow | Job payant | Groupe |
|---|---|---|
| \`agent.yml\` | \`develop\` | \`threadstep-paid-development-v1\` |
| \`agent-asf.yml\` | \`develop\` | \`threadstep-paid-development-v1\` |
| \`agent-openspec.yml\` | \`staged-development\` | \`threadstep-paid-development-v1\` |

Le test Node lit **tout le dossier** \`.github/workflows/\` et contrôle que l'inventaire correspond aux sources examinées. Il refuse les mutex divergents, le mutex placé au mauvais niveau et \`cancel-in-progress: true\`. Un futur job V3 est évalué par \`evaluateProposedV3PaidJob\` pour exiger ce groupe fixe, le claim avant paiement, \`runAttempt=1\`, zéro retry payant et l'admission globale.

**Limite importante :** cette fonction est un **audit syntaxique conservateur** d'un sous-ensemble YAML, pas un moteur général d'évaluation du workflow GitHub. Des accès payants masqués derrière une action tierce ou une variable renommée nécessitent une revue humaine et des tests dynamiques. Aucun YAML n'a été modifié par ce lot.

### Pourquoi cela ne fournit pas une file durable

La documentation GitHub indique qu'un groupe de concurrence ne peut exécuter qu'un job à la fois. Avec la politique usuelle, si un job supplémentaire arrive alors qu'un autre attend déjà, l'ancien **pending** peut être annulé et remplacé. \`cancel-in-progress: false\` protège le job *déjà en cours*, pas systématiquement tous les jobs *en attente*. Une vague V3 ne doit pas interpréter l'attente sous le mutex comme une file FIFO persistante de dix tâches.

En pratique, si un run enfant est annulé, remplacé, abandonné ou expire avant claim, la réservation demeure consommée et la vague passe en arrêt conservateur ; **aucun auto-retry payant**.

Source : [GitHub Docs, control workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## 5. Test et qualification

- \`tests/asf-v3-admission-mutex.test.mjs\` rejoue le registre, les conflits logiques, plusieurs waveIds, les attaques sur l'historique, la fin nominale, la quarantaine et les erreurs de quota.
- Ce test lit les fichiers YAML V1 réels pour contrôler le mutex. Les tests de mutation détruisent intentionnellement une configuration et vérifient un refus.
- Le module d'origine ne renvoie **jamais** \`ok:true\` à partir de champs GitHub auto-déclarés.

Le test est **non payant, sans réseau et sans droits Git**. Il ne prouve ni le CAS du registre dans GitHub, ni une preuve d'origine publiable, ni la réservation payante réelle.

## 6. Prochaines obligations avant workflow V3

1. Concevoir et faire revoir **un writer global** utilisant un ref contrôlé, avec politique de création, permissions GitHub App minimales et tests de deux admissions concurrentes sur GitHub réel **non payants**.
2. Établir l'attestation fiable de la genèse de chaque vague et vérifier le run propriétaire par API, y compris son acteur exact, SHA, branche et tentative.
3. Lier le writer global au claim de [#73](https://github.com/cedricmenec/threadstep/pull/73), au port Git Data de [#74](https://github.com/cedricmenec/threadstep/pull/74), au verdict indépendant de livraison et au mutex payant commun.
4. Faire approuver séparément toute modification des workflows/permissions et démarrer par un pilote sans OpenRouter.
5. Ne pas confondre un succès de CI sur la PR avec une preuve de fonctionnement à dix tâches sur GitHub réel.

**Décision d'architecture proposée :** une seule vague V3 active pour le dépôt, parallélisme payant global de 1 (V1/V3) et aucun mécanisme de sortie automatique de quarantaine. Ces garanties ne sont pas opérationnelles tant que le writer et les workflows ne sont pas branchés.
