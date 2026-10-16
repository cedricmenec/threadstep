# ASF V3 : contrat du contrôleur pur et protocole de preuve inter-runs

**Statut : noyau de simulation en PR, non intégré à GitHub Actions et non authentifié en production.**
**Tâche :** [ASF-V3-002](tasks/ASF-V3-002.md). **Conception parente :** [PR #66](https://github.com/cedricmenec/threadstep/pull/66), dont la revue n'est pas une autorisation payante.

## Objectif fonctionnel

Autoriser **au plus dix débuts de tâches payantes** après un seul lancement propriétaire, dans un périmètre de backlog gelé. Le scheduler reprend une nouvelle candidate seulement après une livraison démontrée par PR, check indépendant, fusion, CI main et Pages. Le quota compte **les réservations**, et non les livraisons ou les appels OpenCode individuels.

Le présent noyau pur calcule uniquement des transitions. Il ne peut **ni envoyer un dispatch GitHub, ni lire une preuve CI, ni réclamer réellement un jeton App, ni lancer un modèle**. Les « preuves » lui sont transmises comme **faits injectés par l'appelant** : un adaptateur GitHub à permissions réduites devra les vérifier indépendamment et atomiquement avant qu'elles aient une valeur de sécurité.

## Architecture et modules

| Élément | Emplacement | Rôle et garantie réelle aujourd'hui |
| --- | --- | --- |
| Contrôleur V3 pur | \`scripts/asf/v3/lifecycle.mjs\` | Validation stricte, journal replayable, transitions sans I/O et refus déterministe des opérations non autorisées |
| Hash canonique réutilisé | \`scripts/asf/waves/hash.mjs\` | SHA-256 du manifeste et du checkpoint, sans réinterprétation de leur texte |
| Allowlist modèle réutilisée | \`scripts/asf/waves/manifest.mjs\` | Deux modèles OpenRouter existants, pas d'ajout de fournisseur |
| Test de simulation | \`tests/asf-v3-lifecycle.test.mjs\` | Erreurs de frontière, anti-replay, dix tâches, CAS de révision, preuve incohérente |
| **À créer en PR suivante** | Adaptateur GitHub/store V3 | Read API indépendant, véritable CAS sur Git remote SHA, mutex global multi-vagues, dispatch et confirmation runId |
| **À créer en PR sensible séparée** | Workflow V3 + vérificateur enfant | Preflight authentifié, token App Actions write limité, claim atomique **avant** OpenRouter, CI/merge/Pages indépendants |

## Contrat de manifeste version 2

\`createV3Manifest\` exige :
- identité \`waveId\` unique, dépôt \`owner/repo\`, \`backlogCommit\` sur 40 caractères hexadécimaux ;
- \`model\` appartenant à l'allowlist V1, \`autoMerge\` booléen, \`maxTaskStarts\` entier strict de 1 à 10 (l'API \`parseV3MaxTasks\` valide la saisie UI) ;
- une liste non vide de candidates \`TS-NNN\` uniques, chacune avec SHA-256 exact, hors découverte dynamique après gel ;
- \`authorization\` avec owner correspondant au propriétaire du dépôt, référence source à \`.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main\`, runId et source SHA cohérents.

Le manifeste retourné est profondément figé. \`schemaVersion=2\`, \`policyVersion=asf-orch-v3\`, \`maxConcurrentTasks=1\`, \`maxPaidRetries=0\`. Il ne peut ni augmenter son quota, ni absorber des nouvelles candidates après lancement. Aucune conversion de journal V1 n'est tentée.

**Limite volontaire :** la validation d'une identité déclarative owner/runId ne prouve pas le compte GitHub qui a réellement déclenché le run. Cette preuve incombera à l'adaptateur GitHub après consultation de l'API.

## Journal et transactions proposées

\`createV3Journal(manifest)\` initialise :
\`revision=0\`, \`reserved=0\`, \`delivered=0\`, \`status=READY\`, \`active=null\`, \`events=[]\`, \`awaitingController=false\`, \`stop=null\`.

\`advanceV3(manifest, journal, event, expectedRevision)\` :
1. Reconstruit et revalide **chaque événement** du journal depuis l'état vide ; détecte toute divergence dans les compteurs, statut, manifeste ou séquence.
2. Refuse une révision attendue divergente ; ne modifie jamais le journal précédent.
3. Valide l'événement avec sa liste exacte de champs ; aucun payload arbitraire ajouté au journal.
4. Retourne un **nouvel objet profondément immuable** avec révision +1 et entrée append-only.

Le \`expectedRevision\` **simule** la sérialisation. Un vrai adaptateur multi-run **doit en plus** lire le commit SHA Git distant, pousser sous condition de ce SHA et échouer sur tout conflit (y compris course inter-processus). Une simple vérification de révision Node est insuffisante.

### Transitions métier autorisées

| Événement | État requis | État produit | Effet / garde-fou |
| --- | --- | --- | --- |
| \`RESERVE\` | \`READY\`, aucun contrôleur attendu | \`RESERVED\` | Identifiant \`waveId:slot\`, ajoute la tâche à \`attempted\`, consomme 1 quota |
| \`DISPATCH_INTENT\` | \`RESERVED\` | \`DISPATCH_PENDING\` | Fige l'intention avant POST ; le noyau **n'émet** aucun POST |
| \`ACK_CHILD\` | \`DISPATCH_PENDING\` | \`CHILD_ACKNOWLEDGED\` | Run ID enfant et attempt=1, workflow attendu ; le futur adaptateur vérifiera l'identité GitHub |
| \`CLAIM_CHILD\` | \`CHILD_ACKNOWLEDGED\` | \`EXECUTING\` | Un seul claim par réservation / run, avant appel modèle |
| \`PR_PUBLISHED\` | \`EXECUTING\` | \`DELIVERY_PENDING\` | Enregistre numéro PR et head SHA |
| \`DELIVERED\` | \`DELIVERY_PENDING\` | \`DELIVERED\` | Exige données concordantes sur check head, merge SHA, check main, Pages et protections |
| \`CHECKPOINT\` | \`DELIVERED\` | \`READY\` ou \`COMPLETED_QUOTA\` | Désactive la tâche active ; demande un nouveau contrôleur si quota disponible |
| \`ATTACH_CONTROLLER\` | \`READY\` après \`CHECKPOINT\` | \`READY\` | Vérifie hash et révision du checkpoint, mandat owner originel et identité du nouveau run contrôleur |
| \`COMPLETE_NO_WORK\` | \`READY\`, idle et autorisé | \`COMPLETED_NO_WORK\` | Clôture sans consommer de quota ; décision scheduler **fiable** à injecter plus tard |
| \`STOP_FAILED\`, \`STOP_UNCERTAIN\` | Toute phase non terminale | Arrêt terminal | Jamais une nouvelle réservation ou un nouveau dispatch |
| \`RECONCILE_NOTE\` | \`STOP_FAILED\` ou \`STOP_UNCERTAIN\` | Même arrêt | Historique de diagnostic uniquement, sans autorisation ni dépense |

\`v3NextAction\` retourne \`SELECT_NEXT\`, \`PERSIST_DISPATCH_INTENT\`, \`RECONCILE_DISPATCH_NO_RETRY\`, \`VERIFY_CONTINUATION\`, \`AWAIT_CHILD_CLAIM\`, \`AWAIT_EXECUTOR\`, \`VERIFY_GITHUB_DELIVERY\`, \`PERSIST_CHECKPOINT\` ou \`STOP\`. **Ce ne sont que des libellés de décision, pas des actions sur le réseau.**

## Scénario A : dix livraisons nominales

1. Owner autorise \`max_tasks=10\`. Créer manifeste et journal dans l'adaptateur futur.
2. Sélectionner une tâche parmi les candidates figées, réserver, écrire \`DISPATCH_INTENT\`.
3. Le contrôleur autorisé doit faire **exactement un** appel \`workflow_dispatch\` ; si résultat ambigu, STOP sans réessayer.
4. Sur retour GitHub certain, écrire ACK du run enfant. Le preflight enfant, non payant, attend cet ACK, valide GitHub puis effectue l'unique claim CAS avant appel OpenRouter.
5. Publication de PR puis vérification indépendante des identifiants, SHAs, checks, fusion et Pages. Écrire \`DELIVERED\` puis \`CHECKPOINT\`.
6. Un nouveau run contrôleur, autorisé par le **mandat originel** et le checkpoint, est attaché avant une nouvelle réservation. Répéter jusqu'à dix.
7. \`COMPLETED_QUOTA\` interdit le onzième départ, même si deux candidates autorisées supplémentaires restent dans le manifeste.

Le noyau a une simulation E2E **sans paiement et sans GitHub** pour ce scénario. Le processus réel de continuation reste à implémenter.

## Scénario B : réponse dispatch perdue après quatre livraisons

1. Quatre tâches \`DELIVERED\`, puis la cinquième est réservée. \`reserved=5\`, \`delivered=4\`.
2. Le contrôleur commite \`DISPATCH_INTENT\` et tente un POST GitHub. Réponse inconnue, donc **aucun deuxième POST**.
3. Le futur adaptateur enregistre \`STOP_UNCERTAIN\` ; l'enfant éventuellement créé ne doit pas franchir le preflight payant sans un ACK de runId persisté et un claim exclusif.
4. Le propriétaire analyse les runs/PR GitHub. Une note de réconciliation peut être ajoutée, **mais jamais rejouer le cinquième claim** ou décrémenter \`reserved\`.
5. Une éventuelle nouvelle vague est un nouveau mandat humain explicite, avec sa propre identité, et ne réécrit pas l'historique.

## Frontières de sécurité à fermer avant activation

1. **Observations GitHub authentifiées** : ce module ne vérifie pas réellement les événements GitHub, les labels owner, les permissions App, la branche protégée, le caractère indépendant de \`check\`, ni l'appartenance des SHA au graphe \`main\`. Les champs \`origin\`, \`controller\`, \`ACK_CHILD\` et \`DELIVERED.proof\` doivent provenir d'un adaptateur qui refuse les données fournies par un run non fiable.
2. **CAS réel et concurrence globale** : les fonctions pures ne peuvent garantir l'exclusivité des claims *entre processus GitHub* sans une primitive atomique correctement sécurisée. Reprendre le concept de la V1 sans supposer que le mutex d'un job couvre plusieurs workflows/runs.
3. **Crash window** : le \`DISPATCH_INTENT\` est durable avant réseau. Après un doute sur le POST, on ne le répète jamais. Même si GitHub a créé un run, l'enfant doit attendre le checkpoint d'ACK avant paiement.
4. **Runner App** : créer le token Actions write uniquement dans le contexte contrôleur approuvé ; pas de Workflows write implicite, pas d'App token dans un agent modèle.
5. **Modèles et budget** : la liste des modèles reste celle du V1. Le plafond 10 compte les tâches et ne garantit pas de plafond USD, surtout en phase OpenSpec \`auto\`.

**Aucun changement de code V1 ni de workflow** n'est demandé par ce lot. Fusionner ce module, si autorisé, n'active aucune exécution V3.

## Tests et recette

Les tests \`tests/asf-v3-lifecycle.test.mjs\` couvrent validation 1..10, manifeste immuable, réservations, refus de lancement prématuré, ACK et claim uniques, IDs/attempts erronés, CI/Pages échoués, attachement au checkpoint original, simulation complète de 10 tâches, onzième refusé, arrêt et note de diagnostic non payante, rejeu et conflit de révision. Ils importent les modules V1 pour confirmer que le manifeste V1 continue de refuser 10.

Validation attendue : \`node --test tests/asf-v3-lifecycle.test.mjs\`, puis \`npm run check\`, plus CI GitHub indépendante sur le SHA de tête final. L'ouverture d'une PR ne prouve pas à elle seule le résultat ; rattacher les preuves GitHub au descriptif lors de la revue.

### Suites techniques après autorisation distincte

- **ASF-V3-003 :** adaptateur de sécurité et preuve GitHub réelle, origin/child/controller, anti-replay et CAS distant.
- **ASF-V3-004 :** workflow GitHub Actions de dispatcher/continuation avec version et vérification des permissions.
- **ASF-V3-005 :** coûts, délais, journal d'observation, traitement des erreurs et diagnostique opérateur.
- **ASF-V3-006 :** qualification progressive dry-run puis éventuels pilotes payants autorisés au cas par cas.
