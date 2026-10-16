# ASF V3 : cycle de vie formel d'une vague de 1 à 10 tâches

**État : proposition de conception pour revue, non implémentée ni autorisée à l'exécution.**
**Périmètre :** première mise en service à 10 démarrages maximaux, saisie numérique entière, un développement à la fois, reprise d'incident autorisée humainement ; extension 15 ultérieure. Source : [ASF-V3-001](tasks/ASF-V3-001.md) et [architecture cible](asf-v3-architecture.md).

## 1. Définitions pour éviter les confusions

- **Vague** : mandat borné accordé explicitement par le propriétaire ; existe même lorsqu'aucun job Actions n'est en cours.
- **Run contrôleur** : exécution technique courte qui fait avancer la vague et persiste les décisions. Plusieurs runs contrôleurs peuvent appartenir à une même vague.
- **Run exécuteur** : exécution OpenSpec attachée à **une** réservation. Un run OpenSpec en phase \`auto\` peut faire plusieurs appels modèles ; \`max_tasks\` ne borne pas les appels individuels ni les USD.
- **Réservation** : consommation monotone d'une unité du quota avant toute tentative de démarrage de tâche payante. Une réservation n'est jamais remboursée implicitement.
- **Continuation nominale** : poursuite d'une vague déjà autorisée **après** livraison vérifiée et checkpoint committé, avec preuve intégrale du mandat initial.
- **Reprise d'incident** : nouvel acte humain autorisant une réconciliation ou une nouvelle vague après panne, annulation, ambiguïté ou timeout. Ne signifie jamais ré-exécuter une tâche réservée.
- **Preuve de livraison** : run enfant corrélé, PR unique, branche et SHA attendus, \`check\` indépendant réussi, fusion contrôlée, \`check\` sur la fusion et CI/Pages post-fusion vérifiés.

L'invariant doit être formulé **au plus N démarrages réservés de tâches**, et non « N appels OpenRouter » ou « N PR fusionnées ».

## 2. Machine à états de la vague (proposition V3)

| État de vague | Signification fonctionnelle | Ce qui est autorisé |
| --- | --- | --- |
| \`DRAFT\` | Paramètres saisis, aucune autorisation dépensière enregistrée | Validation/dry-run uniquement |
| \`AUTHORIZED\` | Acteur propriétaire, ref/main, run et quota validés ; manifeste persistant | Création du checkpoint initial |
| \`READY\` | Snapshot gelé ; aucune tâche active et aucune incertitude | Sélection ou clôture |
| \`RESERVED\` | Tâche choisie ; réservation persistée et quota consommé | **Un** dispatch corrélé, pas de seconde réservation |
| \`DISPATCH_PENDING\` | Intention de lancer persistée ; appel API à exécuter ou à réconcilier | Traiter la réponse du **même** dispatch ; jamais envoyer un second HTTP POST après issue ambiguë |
| \`CHILD_ACKNOWLEDGED\` | GitHub a fourni le run ID, réconcilié et persisté | Autoriser seulement le run enfant identifié à réclamer la réservation |
| \`EXECUTING\` | Le run enfant a revendiqué la réservation atomiquement, son travail payant peut commencer | Surveiller uniquement cette tâche |
| \`DELIVERY_PENDING\` | Exécuteur terminé / PR observée ; livraison encore non prouvée | Lire les preuves GitHub ; aucun nouveau dispatch |
| \`DELIVERED\` | PR, checks, merge, CI main et Pages réellement vérifiés | Persister preuve et checkpoint |
| \`READY\` après checkpoint | Retour au choix de la prochaine tâche, seulement sous mandat toujours valide | Continuation nominale possible |
| \`COMPLETED_QUOTA\` | N réservations consommées et la dernière livraison réconciliée | Rapport final, aucun démarrage |
| \`COMPLETED_NO_WORK\` | Aucune autre tâche autorisée/exécutable dans le snapshot | Rapport final, aucun démarrage |
| \`BLOCKED_DEPENDENCIES\` | Candidats restants bloqués par dépendances externes | Clôturer ou attendre décision humaine, jamais élargir le snapshot |
| \`PAUSED_REVIEW\` | Revue/fusion humaine attendue (p. ex. \`auto_merge=false\`) | Observation bornée ; aucune réservation suivante sans livraison |
| \`STOP_FAILED\` / \`STOP_UNCERTAIN\` | Échec ou preuve insuffisante | Pas de nouveau dispatch ; diagnostic + autorisation humaine |
| \`CANCELLED\` | Arrêt demandé par le propriétaire | Aucun nouveau dispatch ; conserver les réservations et les runs in-flight à réconcilier |

\`DRAFT\`, \`AUTHORIZED\`, \`READY\`, \`CHILD_ACKNOWLEDGED\`, etc. sont **des noms de conception**, pas de nouveaux états actuellement implémentés dans \`journal.mjs\`. Les événements existants V1 \`SELECT\`, \`RESERVE_DISPATCH\`, \`DISPATCH_CONFIRMED\`, \`DELIVERED\`, \`FAILED\` et \`UNKNOWN\` devront être mappés dans un schéma/journal V3 explicitement versionné.

### Diagramme nominal

\`\`\`mermaid
flowchart TD
  A[Owner workflow_dispatch: 1..10] --> B[Preflight: utilisateur, droits, backlog, coûts]
  B --> C[Manifeste V3 immuable + journal initial]
  C --> D{Quota restant et état certain ?}
  D -->|Non| T[Clôture ou arrêt]
  D -->|Oui| E[Sélectionner une tâche du snapshot]
  E --> F[CAS: SELECT + RESERVE]
  F --> G[Écrire intention de dispatch]
  G --> H[Déclencher workflow enfant avec return_run_details]
  H --> I[Persister ACK et child_run_id]
  I --> J[Preflight enfant + claim atomique]
  J --> K[OpenSpec et proposition de PR]
  K --> L[Vérifier PR / check / fusion / CI main / Pages]
  L --> M{Livraison prouvée ?}
  M -->|Non ou inconnue| S[STOP / revue / diagnostic]
  M -->|Oui| N[Journal DELIVERED + checkpoint CAS]
  N --> D
\`\`\`

## 3. Séquence fonctionnelle détaillée

### Phase 0 : simulation facultative

1. Saisir \`mode=dry-run\`, \`max_tasks\`, modèle et options.
2. Parser \`max_tasks\` en entier **exact** entre 1 et 10 ; refuser \`0\`, \`11\`, les décimales, valeurs négatives, chaînes malformées et absence de champ.
3. Afficher le snapshot, les tâches candidates et les motifs d'exclusion ; signaler ce qui relève d'une projection hypothétique.
4. Aucune écriture de branche de vague, aucun jeton d'écriture, aucune réservation, aucun appel OpenCode/OpenRouter.

**Décision UX suggérée :** GitHub Actions \`workflow_dispatch.inputs.max_tasks.type: number\`, mais valider **encore** côté script avec \`Number.isInteger\` et les bornes ; ne jamais considérer la validation UI comme une autorisation.

### Phase 1 : autorisation et gel

1. Le propriétaire sélectionne \`execute\` et un quota \`N=1..10\` ; un **seul lancement explicite** autorise au plus N réservations.
2. Preflight vérifie acteur, \`main\`, tentative GitHub, modèle autorisé, protections de la branche, \`check\` indépendant, PR ouvertes/conflits, capacité à publier et état des preuves.
3. Créer un manifeste versionné et immuable contenant : dépôt, \`waveId\`, source SHA, identité et \`runId\` d'autorisation originelle, version de politique, modèle, phase, autoMerge, quota, concurrence, retries, liste complète des candidats avec hash exact de chaque fiche.
4. Commiter le manifeste et le journal initial vers la branche opérationnelle dédiée \`asf/waves/<waveId>\`, avec preuve de SHA de commit. Aucune tâche supplémentaire ajoutée après ce gel.
5. Le quota est disponible mais **non consommé** avant la première réservation. Aucune promesse sur le coût USD réel n'est implicite.

**Périmètre figé :** les fichiers produit peuvent évoluer au fil des livraisons ; les briefs candidats **non encore exécutés** ne peuvent pas changer par rapport à leur hash initial. Un changement de policy/workflow ou un commit externe inattendu sur main impose réconciliation conservatrice.

### Phase 2 : sélection et réservation

1. Vérifier la version de politique et la continuité de l'autorisation propriétaire, le journal et ses révisions, les verrous et les éventuels départs précédents.
2. Consulter GitHub pour l'état des PR, checks, merges, CI et Pages ; ne jamais remplacer une erreur API par « rien en cours ».
3. Recalculer l'éligibilité des candidats figés : \`product/ready/allowed/low\`, non déjà livrés ou tentés, dépendances livrées **par preuves**, pas simplement déclarées dans Markdown.
4. Trier de façon déterministe selon priorité, ancienneté et ID (politique scheduler conservée), puis choisir au plus une tâche.
5. Persister \`SELECT\` + \`RESERVE_DISPATCH\` avec incrément \`taskStartsReserved\` au moyen d'une mise à jour conditionnelle sur SHA attendu (**CAS**). La réservation est la barrière avant dépense.
6. Si l'écriture échoue ou si une autre réservation est active : aucun dispatch. Si quota épuisé ou pas de candidat : produire l'état terminal correspondant.

### Phase 3 : dispatch à deux temps et authentification de l'enfant

**Risque essentiel :** un POST GitHub peut avoir réellement démarré un run alors que le contrôleur perd la réponse. Un retry HTTP serait un second départ non autorisé.

Protocole recommandé, à auditer :

1. Persister une **intention de dispatch** liée de façon univoque à \`waveId\`, \`taskId\`, numéro de réservation, hash de manifeste, politique et source SHA.
2. Un composant contrôleur de confiance appelle l'API GitHub \`workflow_dispatch\` avec \`return_run_details=true\` et une App disposant des droits \`Actions: write\` nécessaires, soumis à approbation séparée. Ce token n'est jamais donné au modèle.
3. Sur réponse certaine, persister \`childRunId\` dans le journal avec CAS. Le **run enfant doit attendre cet ACK persisté**, même s'il démarre avant le retour du contrôleur.
4. Dans un job de preflight non payant, l'exécuteur lit le journal et confirme indépendamment auprès de GitHub : origine owner/main et run d'autorisation, workflow enfant attendu, childRunId exact, version de policy, modèle, tâche et hash du brief, autorisation active, réservation unique et état des autres tâches.
5. L'enfant revendique **atomiquement** la réservation pour son seul \`runId\` et sa seule tentative. Un second enfant, un rerun GitHub ou un double lancement sur la même réservation échoue **avant OpenRouter**. L'architecture de cette revendication et ses permissions restent à concevoir et tester.
6. Si la réponse GitHub ou l'ACK sont ambigus, ou si le contrôleur meurt avant de persister la confirmation, **ne pas renvoyer le POST**. L'enfant ne franchit pas le preflight payant sans ACK valide. Arrêt \`STOP_UNCERTAIN\`, quota conservé et diagnostic humain.

**Contrainte de preuve importante :** dans une invocation \`workflow_dispatch\` faite par une GitHub App, l'acteur immédiat du run enfant peut être l'App, et le run ID enfant diffère du run propriétaire. L'ancienne hypothèse V1 « child et parent partagent le même \`GITHUB_RUN_ID\` en \`workflow_call\` » est donc **incompatible** avec une transposition directe. Ne jamais essayer de contourner \`authenticate-executor.mjs\` pour contourner cette différence.

### Phase 4 : exécution et production d'une PR

1. Le run enfant déjà authentifié prend le verrou global de développement payant.
2. Checkout depuis le **dernier main vérifié**, tout en conservant la **définition de tâche initiale** (hash figé), et lance le protocole OpenSpec autorisé, sans lui donner la politique de contrôle de vague ou des droits supplémentaires.
3. Implémentation, validation locale, synchronisation sémantique OpenSpec et archive ; publication d'une PR corrélée par ID, run enfant, branche, SHA et métadonnées contrôlées.
4. \`auto_merge=true\` demande uniquement la fusion native, jamais un bypass de required \`check\`. \`auto_merge=false\` laisse l'étape de fusion au propriétaire, ce qui peut provoquer \`PAUSED_REVIEW\`.
5. Succès du job enfant signifie **travail technique terminé**, jamais automatiquement \`DELIVERED\`.

### Phase 5 : consolidation et preuve indépendante de livraison

1. Retrouver **une seule PR** correspondant au run et à la tâche, à l'agent attendu et aux commit SHAs, puis vérifier la tête actuelle.
2. Vérifier le \`check\` indépendant requis sur le head SHA exact et les protections GitHub actives.
3. Vérifier que GitHub a effectivement fusionné la PR dans \`main\` selon la politique en vigueur, que le merge SHA est atteint par \`main\` et que le \`check\` pertinent est réussi sur le SHA fusionné.
4. Vérifier que les exécutions post-fusion \`CI\` et \`Pages\` concernent bien le commit attendu et sont conclues avec succès.
5. Si tous les éléments sont vérifiés, écrire \`DELIVERED\` et un **checkpoint durable** lié à la version de manifeste/journal ; sinon attendre dans une **fenêtre configurée et bornée**. Erreur, CI rouge, conflit, annulation, délai atteint ou preuve absente => aucun départ suivant.
6. Si une nouvelle autorisation serait requise (panne ou état incertain), le contrôleur arrête. Ne pas confondre attente nominale de CI et reprise d'incident.

### Phase 6 : continuation nominale

Après \`DELIVERED\` et checkpoint écrits et vérifiés :

1. Réexaminer le quota, les fichiers de policy/contrôle et les éventuels changements sur main ; vérifier qu'une seule vague contrôlée détient le verrou correspondant.
2. Recalculer la prochaine candidate **dans le manifeste initial**. Les nouvelles tâches apparues sur main sont exclues.
3. Si le processus doit franchir une limite de durée ou terminer un job, une continuation technique peut être déclenchée dans **un nouveau run contrôleur**, mais seulement si GitHub et le journal attestent qu'il ne fait qu'exercer **le mandat initial** et son quota résiduel. Une continuation ne crée pas de nouvelle autorisation.
4. Aucune continuation automatique ne doit démarrer après \`STOP_FAILED\`, \`STOP_UNCERTAIN\`, \`PAUSED_REVIEW\` devenue bloquante ou \`CANCELLED\`.

Le **déclencheur exact** des runs de continuation reste un choix technique de ASF-V3-002/003/004. Il peut être événementiel ou commandé, à condition d'avoir une corrélation fiable, des écritures CAS et un refus absolu des appels non autorisés. La disponibilité de \`workflow_run\` ou de l'API ne constitue pas à elle seule une preuve de mandat.

### Phase 7 : clôture et rapport

- \`COMPLETED_QUOTA\` : quota N consommé ; N tâches potentiellement livrées mais pas nécessairement toutes si arrêt.
- \`COMPLETED_NO_WORK\` : plus de candidat éligible dans le périmètre autorisé ; compteur inférieur à N possible.
- \`BLOCKED_DEPENDENCIES\` : tâches candidates restantes bloquées ; ne pas attendre indéfiniment ni inventer une livraison externe.
- \`STOP_FAILED\` / \`STOP_UNCERTAIN\` / \`CANCELLED\` : terminal côté démarrages ; conserver les preuves et proposer une procédure de diagnostic humain.

Rapport final attendu : \`waveId\`, run owner initial, version/policy, nombre réservé, nombre délivré et en échec/inconnu, identifiants child run, PR, head/merge SHA, checks CI/Pages, durée, coûts **observés** et estimations séparées, motifs d'exclusion et décision opérationnelle suivante. Ne journaliser aucun secret.

## 4. Exemple nominal : une vague de 10 tâches

Exemple illustratif, **aucun de ces runs n'a eu lieu**.

| Étape | Réservations cumulées | Livraisons vérifiées | Condition pour avancer |
| --- | ---: | ---: | --- |
| Ouverture et manifeste | 0 / 10 | 0 | Owner validé, snapshot figé |
| Tâche 1, PR/CI/Pages OK | 1 / 10 | 1 | Checkpoint confirmé |
| Tâche 2, PR/CI/Pages OK | 2 / 10 | 2 | Checkpoint confirmé |
| Tâche 3, PR/CI/Pages OK | 3 / 10 | 3 | Checkpoint confirmé |
| Tâche 4, PR/CI/Pages OK | 4 / 10 | 4 | Checkpoint confirmé |
| Tâche 5, PR/CI/Pages OK | 5 / 10 | 5 | Checkpoint confirmé |
| Tâche 6, PR/CI/Pages OK | 6 / 10 | 6 | Checkpoint confirmé |
| Tâche 7, PR/CI/Pages OK | 7 / 10 | 7 | Checkpoint confirmé |
| Tâche 8, PR/CI/Pages OK | 8 / 10 | 8 | Checkpoint confirmé |
| Tâche 9, PR/CI/Pages OK | 9 / 10 | 9 | Checkpoint confirmé |
| Tâche 10, PR/CI/Pages OK | 10 / 10 | 10 | Clôture \`COMPLETED_QUOTA\` |

Un onzième départ est interdit même si une autre candidate est prête.

## 5. Exemple d'incident après quatre livraisons

Supposer les tâches 1 à 4 \`DELIVERED\` et la tâche 5 \`DISPATCH_RESERVED\` ; l'API de lancement retourne une erreur réseau sans certitude.

- Le compteur reste à **5 / 10** et les livraisons à **4**. Ni tâche 5 ni tâche 6 ne sont redéclenchées automatiquement.
- L'état passe à \`STOP_UNCERTAIN\`, avec identifiants de corrélation et SHA persistés.
- Le propriétaire examine les runs GitHub, le journal, la PR potentielle et les checks. Un diagnostic peut montrer que la tâche 5 n'a jamais quitté le preflight, ou qu'un run existant a poursuivi le travail.
- Une **réconciliation non payante** est possible sur faits GitHub prouvés, sans effacer les événements du journal ; les preuves de conclusion peuvent être conservées dans un audit append-only relié à la vague arrêtée.
- Pour lancer **d'autres** tâches, demander une **nouvelle autorisation explicite** (par exemple, une nouvelle vague distincte après résolution). Ne pas « ressusciter » un journal terminal ni rembourser les réservations, et ne pas présenter un run enfant incertain comme disponible à la relance.

## 6. Matrice d'arrêts et d'autorisation humaine

| Situation | Réaction automatique | Intervention humaine requise ? |
| --- | --- | --- |
| Livraison réussie, checkpoint certain, autre candidate autorisée | Continuer, si quota et politique invariants | Non : mandat initial conservé |
| CI/Pages en attente normale | Observer dans une fenêtre bornée, zéro départ suivant | Non, tant que la fenêtre nominale n'expire pas |
| \`auto_merge=false\` et PR en revue | Attendre sans démarrer la suite | Oui pour décider de la fusion ; si la fenêtre expire, nouvelle autorisation pour la reprise |
| Plus aucune tâche éligible | Fin \`NO_WORK\` ou \`BLOCKED_DEPENDENCIES\` | Pas pour terminer ; oui pour ouvrir une autre vague |
| API dispatch avec résultat ambigu | \`STOP_UNCERTAIN\`, zéro second POST | Oui, diagnostic puis autorisation explicite |
| Échec CI, conflit ou run enfant échoué | \`STOP_FAILED\`, aucun remplacement | Oui, analyse et décision |
| Crash contrôleur, job annulé, événement perdu, expiration du délai | Stop dès qu'une anomalie est détectée ; aucune continuation sans preuve exhaustive | Oui si incident avéré ; aucune relance payante cachée |
| Une autre PR, politique modifiée ou SHA de brief divergent | Fail-closed, ne pas élargir le mandat | Oui pour requalifier le périmètre |
| \`max_tasks=0\` ou \`11\` ou fractionnaire | Validation rejetée avant toute écriture | Non, corriger le formulaire |
| Deux run enfants revendiquent la même réservation | Une seule revendication CAS possible ; les autres échouent avant appel payant | Oui pour tout audit de double lancement suspecté |

## 7. Contrats et vérifications techniques à développer

1. **Manifeste V3 versionné** sans mutation ni migration réécrivant l'historique V1. Revalidation contre GitHub des décisions owner, et non seule confiance dans une chaîne JSON.
2. **Journal V3 append-only** et branches Git à lease SHA/CAS ; numéros de séquence monotones ; événements d'intention, ACK, claim, preuves et clôture explicitement vérifiés.
3. **Double garde-fou économique** : réservation **avant dispatch**, revendication unique **avant l'appel au modèle**. L'atomicité globale entre un POST réseau et un commit Git étant impossible, une réponse ambiguë entraîne un arrêt conservateur, pas la garantie que le travail ne soit jamais parti.
4. **Contrôle de parenté inter-runs** remplaçant les hypothèses V1 \`workflow_call\` et \`parentRunId === childRunId\`. Le child run déclenché par une App doit valider le **run owner originel** et son mandat à travers des preuves GitHub et le journal.
5. **Concurrence** : un seul claim et un seul développement payant à la fois, y compris face aux agents manuels et autres vagues ; conserver le verrou payant global V1 ou offrir un équivalent démontré.
6. **Temps** : aucune boucle d'attente non bornée. GitHub documente actuellement jusqu'à six heures pour un job runner hébergé et trente-cinq jours pour un run workflow ([limites GitHub](https://docs.github.com/en/actions/reference/limits)), mais ce ne sont pas des budgets souhaitables ; utiliser checkpoints et contrôleurs courts.
7. **Coûts** : jusqu'à dix exécutions \`phase=auto\` avec plusieurs étapes OpenCode payantes chacune. Suivre estimation, consommation observable et défaillance de télémétrie ; ne pas promettre un hard cap USD sans mécanisme fournisseur.
8. **Sécurité** : création tardive d'un token App de dispatch avec \`Actions: write\` approuvé séparément, aucun partage avec OpenCode, contrôle du required \`check\`, interdiction de \`--admin\`, état de protection vérifié.
9. **Compatibilité** : conserver les trois parcours manuels V1 et leurs garde-fous ; ne pas modifier leur contrat pour faciliter V3 sans revue dédiée.

## 8. Tests contractuels attendus pour ASF-V3-002/003/004

- Paramètres : 0, -1, vide, décimal, \`01\` si normalisation choisie, 1, 2, 3, 5, 10, 11, texte invalide.
- Frontières : au plus N réservations, refus exact du onzième, aucun run payant sans réservation ni ACK, jamais deux claims gagnants.
- Sélection : 10 tâches indépendantes, dépendances en chaîne, aucun candidat, candidat livré avant le lancement, tâche modifiée après gel, PR ouverte concurrente.
- Dispatch : succès ACK, enfant qui démarre avant ACK, POST envoyé/réponse perdue, CAS conflit, enfant doublon, rerun GitHub, fausse identité parent.
- Livraison : PR draft, check rouge, auto_merge false, merge SHA différent, check sur SHA obsolète, CI main OK mais Pages inconnu, preuves API indisponibles.
- Continuité : checkpoint nominal après n tâches, enfant lancé avant crash parent, contrôleur perdu, version de policy divergente, annulation manuelle, réconciliation sans rerun payé.
- Compatibilité : lecture V1, exécuteurs manuels et verrou de concurrence global ; coûts et logs sans secrets.
- Simulations E2E non payantes aux paliers 1/2/3/5/10 avant toute autorisation de pilote réel.

## 9. Points de revue avant approbation de l'architecture

1. **Décider comment sont éveillés les runs contrôleurs de continuation nominale** : événement vérifié, orchestrateur commandé ou autre, et démontrer que nul trigger hors mandat ne peut déclencher un nouveau paiement.
2. **Fixer l'atomicité du claim enfant et la séparation des tokens de contrôle/publi** : écrire le journal avant le paiement sans jamais offrir à OpenCode un jeton GitHub App.
3. **Fixer les délais nominalement acceptables** entre PR et merge/CI/Pages, y compris le mode \`auto_merge=false\`.
4. **Définir le cas de plusieurs waves et agents manuels concurrentiels** : verrou global, refus des PR externes et comportement de backpressure.
5. **Mettre par écrit la politique de budget** et l'action lorsque les coûts observés manquent. Les dix tâches ne sont pas dix unités de prix prévisible.

Aucune de ces décisions techniques ouvertes n'est une autorisation de modifier les workflows ou les droits.