# ASF V3 : revue croisée des PR et préparation du branchement sécurisé

**Revue de consolidation du 16 octobre 2026. Statut : NON PRÊT POUR PRODUCTION.**
Documentation mise à jour dans le lot ASF-V3-005, [PR #73](https://github.com/cedricmenec/threadstep/pull/73), avec le test d'intégration du port Git Data de [#74](https://github.com/cedricmenec/threadstep/pull/74).

## 1. Portée de la consolidation

Cette revue examine les contrats de :

| PR | Livrable | Rôle dans la chaîne V3 | Qualification actuelle |
|---|---|---|---|
| [#66](https://github.com/cedricmenec/threadstep/pull/66) | Cycle de vie, mandat, limites | Contrat d'architecture | Documentation, en revue |
| [#67](https://github.com/cedricmenec/threadstep/pull/67) | Inventaire et documentation workflows | Exploitabilité | Documentation, en revue |
| [#68](https://github.com/cedricmenec/threadstep/pull/68) | Agent ASF général et politique de privilèges | Séparation agent produit/usine | Documentation, en revue |
| [#69](https://github.com/cedricmenec/threadstep/pull/69) | \`lifecycle.mjs\` | Manifeste, 1..10, réservation, ACK, claim, livraison, checkpoint | Transitions pures testées |
| [#70](https://github.com/cedricmenec/threadstep/pull/70) | \`provenance.mjs\`, \`git-cas.mjs\` | API GitHub en lecture seule, commit CAS | Ports simulés testés |
| [#71](https://github.com/cedricmenec/threadstep/pull/71) | \`trusted-snapshot.mjs\`, \`transaction-bridge.mjs\` | Lecture figée et précondition au claim | Tests unitaires avec dépendances injectées |
| [#73](https://github.com/cedricmenec/threadstep/pull/73) | \`integration.mjs\`, tests d'ensemble | Raccordement concret #69/#70/#71 ; désormais #74 | Simulation complète des véritables fonctions |
| [#74](https://github.com/cedricmenec/threadstep/pull/74) | \`github-git-data-port.mjs\` | Requêtes Git Data réelles via transport injectable | Contrat REST simulé |
| [#75](https://github.com/cedricmenec/threadstep/pull/75) | Registre global, audit mutex et genèse | Admission unique inter-vagues | Modèle et audit des workflows V1, non persistés |

Toutes ces PR sont en revue. Leur présence ne constitue pas une fusion, une approbation de permissions ni une activation.

### Renforcement de la PR #73 par cette revue

Les fichiers \`scripts/asf/v3/github-git-data-port.mjs\` et \`tests/asf-v3-git-data-port.test.mjs\` sont **recopiés sans modification** depuis #74 dans la branche temporaire #73, uniquement pour compiler le chemin d'intégration. Le nouveau \`tests/asf-v3-integrated-git-data.test.mjs\` utilise ensemble :

\`createV3Manifest → advanceV3 → createV3WaveReadPort → loadV3TrustedSnapshot → observeV3RunProvenance → attemptV3ChildClaim → reconstructV3Journal → commitV3JournalCAS → createAsfV3GitDataPort\`.

Les requêtes HTTP GET/POST/PATCH sont interceptées par un serveur GitHub **en mémoire** qui conserve refs, trees et commits. Les tests contrôlent une écriture positive unique, deux claims concurrents, une réponse PATCH perdue après modification distante, le mauvais acteur de l'App, et un waveId étranger. Aucune écriture GitHub réelle ni OpenRouter n'est utilisée ici.

Cette extension réduit l'écart entre deux mocks indépendants. **Elle ne prouve toujours pas** le comportement de deux runners réels ni de la GitHub App.

## 2. Bloqueurs avant le premier workflow V3

### P0 : le workflow enfant actuel refuse l'acteur GitHub App

Le fichier **sur main** \`.github/workflows/agent-openspec.yml\` contient :
- \`normalize-task.if: github.actor == github.repository_owner\` ;
- \`staged-development.if: github.actor == github.repository_owner\` ;
- un \`workflow_dispatch\` avec \`task_id, phase, auto_merge, model\`, **sans inputs** \`wave_id, parent_run_id, reservation_sha\` ;
- ces trois champs existent uniquement dans \`workflow_call\` de la V1.

En revanche, les contrats V3 [#70](https://github.com/cedricmenec/threadstep/pull/70) et [#71](https://github.com/cedricmenec/threadstep/pull/71) prévoient que l'enfant soit déclenché par \`workflow_dispatch\` avec l'acteur \`threadstep-software-factory[bot]\`. **La voie existante ne peut pas être utilisée telle quelle.** Ne pas contourner les conditions owner-only, ni tenter d'injecter des champs \`workflow_dispatch\` non déclarés.

**Décision requise :** autorisation explicite et revue séparée pour un workflow V3 enfant dédié, aux inputs minimaux et à l'authentification avant paid step, avec permissions App minimales.

### P0 : une provenance Git n'est pas une origine autorisée

[#69](https://github.com/cedricmenec/threadstep/pull/69) valide la **forme** du manifeste et la conformité d'un acteur déclaré. [#70](https://github.com/cedricmenec/threadstep/pull/70) vérifie qu'un run propriétaire existe et possède les métadonnées attendues. [#75](https://github.com/cedricmenec/threadstep/pull/75) établit que même un commit initial et un run concordants ne prouvent pas que le propriétaire a autorisé la création de cette branche. Il manque le **publisher de genèse de confiance** et la validation indépendante de sa preuve au moment du premier \`ADMIT\`.

Un \`manifestHash\` seul n'est ni une signature d'origine ni un droit à OpenRouter. **Interdiction de relier un hash auto-déclaré à un claim payant.**

### P0 : le registre global n'a pas d'atomicité distante

[#75](https://github.com/cedricmenec/threadstep/pull/75) modélise une seule vague \`ACTIVE\` sur le ref projeté \`refs/heads/asf/control/active-wave-v3\`. [#74](https://github.com/cedricmenec/threadstep/pull/74) est volontairement restreinte aux branches \`refs/heads/asf/waves/<waveId>\` : **ce port ne peut pas écrire le registre global**.

Sans writer CAS du registre global et protections d'écriture, deux vagues peuvent être admises indépendamment ; le mutex payant seul ne constitue pas une admission V3 exclusive. La fin \`STOP_UNCERTAIN\` doit garder le registre bloqué et requérir un diagnostic propriétaire.

### P0 : aucun preflight V3 réellement branché avant paiement

Le pont [#71](https://github.com/cedricmenec/threadstep/pull/71) produit un **checkpoint de claim**, pas une capacité d'appeler OpenRouter. Aucun \`.github/workflows/agent-openspec-v3.yml\` n'est présent sur main, aucun token App d'écriture n'a été autorisé, et le runner ne charge pas ces ports avant les appels modèle.

L'absence de ce preflight **doit empêcher tout essai payant**, même si les tests de 10 tâches et la simulation de CAS sont verts.

### P1 : la corrélation des dispatchs inter-runs reste hypothétique

\`workflow_dispatch\` et \`repository_dispatch\` sont des mécanismes **projetés**, pas une transaction commune avec les refs Git. Le bot attendu, le format exact de \`run.path\`, l'événement, l'ACK du nouveau run ID et la gestion d'une réponse POST ambiguë ne sont pas qualifiés sur un vrai run V3.

Il faut une qualification **non payante** des runs et du transport GitHub App. Une réponse réseau ambiguë provoque un arrêt conservateur sans retry du POST, et non une sélection de tâche suivante.

### P1 : disponibilité et comportement du mutex payé GitHub Actions

Les trois jobs V1 qui consomment \`OPENROUTER_API_KEY\` partagent actuellement \`threadstep-paid-development-v1\` au niveau job, avec \`cancel-in-progress:false\`. Tout job payant V3 devra s'y conformer.

Mais un groupe GitHub Actions n'est **pas une file durable de dix tâches** : des jobs \`pending\` peuvent être annulés ou remplacés lorsqu'un autre arrive. Une annulation avant claim, après réservation ou après dispatch n'autorise aucune répétition payante. Le journal durable doit refléter l'incertitude.

## 3. Matrice de sécurité

| Garantie métier | Preuve locale | Preuve réelle restant à produire |
|---|---|---|
| Plafond de 1 à 10 démarrages | V3-002 et tests quota | Input V3 owner autorisé et journal durable dans un workflow |
| Un claim par réservation | V3-002/004/005 et tests concurrents | Deux runners réels sur ref CAS protégé |
| Provenance d'un run enfant | V3-003/005 avec API mockée | Attestation App et corrélation du dispatch |
| Continuer après livraison prouvée | V3-002/004/005 | PR, CI indépendante et Pages observés réellement |
| Une seule vague V3 | V3-007 modèle global | Ref global initialisé et CAS authentifié |
| Un job payant V1/V3 | V3-007 audit statique V1 | Job V3 protégé par mutex et paid-preflight revus |
| Aucun retry après incident | Modèles V3 et tests erreurs | Workflow stop + diagnostic propriétaire |
| Génèse owner autorisée | V3-007 constate le manque d'ancre | Publisher approuvé, preuve protégée du mandat |
| Aucun droit supplémentaire | Diffs de PR sans workflows | Revue App et Actions séparée avant activation |

## 4. Revue et stratégie de branches

**Ne fusionner aucune PR par simple constat d'une CI verte.** La PR #73 est une branche temporaire créée à partir de la #71 et comporte des fichiers identiques des #69, #70 et désormais #74. Son diff vers main est donc volontairement plus large que la modification ASF-V3-005 seule.

Ordre de revue humaine suggéré : #66 / #67 / #68 (contrats), #69 (noyau), #70 (preuve et CAS), #71 (pont), #74 (Git Data), #75 (admission globale), puis **rebase/recréation propre de #73** en se limitant à \`integration.mjs\`, à ses tests et à ses documents d'intégration déjà validés.

Pour chaque décision de fusion, obtenir le consentement propriétaire explicitement ; revoir les protections de main, les SHA finaux, actionlint, \`npm run check\`, et le détail des tests non payants. Toute PR workflow/permissions est un palier autonome, également soumis à autorisation explicite.

## 5. Critère de sortie de cette revue

La préparation est acceptable pour **d'autres tests non payants**, pas pour production, si tous les tests intégrés et indépendants restent verts sur le SHA exact de la branche. La levée des P0 ci-dessus, le contrôle du writer global et une revue des droits par le propriétaire sont préalables **obligatoires** au premier démarrage payant d'une vague V3.

Ce document n'est pas une autorisation d'activer les workflows, de modifier leurs permissions, ni de fusionner.
