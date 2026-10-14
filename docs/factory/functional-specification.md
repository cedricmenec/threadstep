# Spécification fonctionnelle de la factory

## 1. Acteurs et objectifs

- **Commanditaire / product owner** : exprime oralement ou par écrit un besoin, tranche les ambiguïtés et autorise une exécution / vague.
- **Assistant de cadrage** : produit ou met à jour la vision, les spécifications et les tâches versionnées dans le dépôt.
- **Exécuteur agentique** : réalise une tâche autorisée via OpenCode + OpenRouter, OpenSpec et outils de code.
- **Orchestrateur optionnel** : sélectionne les tâches prêtes, ordonne les vagues et supervise les reprises.
- **GitHub et CI indépendantes** : hébergent branches, preuves, tests, PR et déploiements, sans faire confiance à la seule déclaration de l'agent.

## 2. Capacités et critères d'acceptation cible

| ID | Capacité | Critère vérifiable |
| --- | --- | --- |
| ASF-01 | Capture conversationnelle des besoins | Une demande orale suffit à générer une proposition de tâche revue par le commanditaire ; aucune saisie manuelle d'issue obligatoire. |
| ASF-02 | Référentiel de spécifications | Les artefacts sont suivis dans Git, relisibles depuis une autre session et traçables à leur origine. |
| ASF-03 | Backlog structuré | Chaque `TS-NNN.md` contient besoin, périmètre, priorité, dépendances, critères, décisions et état. |
| ASF-04 | Planification et découpage | Les fonctionnalités trop vastes sont divisées en tâches testables et leurs dépendances explicites. |
| ASF-05 | **Mode manuel pérenne** | L'utilisateur peut choisir `task_id` + modèle et déclencher une tâche, même sans orchestrateur en fonctionnement. |
| ASF-06 | **Mode orchestré optionnel** | Un orchestrateur peut sélectionner une tâche prête et déléguer au même contrat d'exécution qu'ASF-05. |
| ASF-07 | **OpenSpec spec-driven** | Chaque modification fonctionnelle suit Explore, Propose, Apply, Verify, Sync et Archive, avec artefacts cohérents. |
| ASF-08 | Exécution remplaçable | OpenCode est le premier adaptateur ; une implémentation alternative ne change pas le contrat de tâche ni les gates de livraison. |
| ASF-09 | Modèles OpenRouter | Le modèle est explicite et autorisé ; clés jamais incluses dans les sources ou fichiers Pages. |
| ASF-10 | Durabilité / reprise | Une interruption conserve checkpoints, artefacts, logs et ID de run ; un redémarrage ne reproduit pas aveuglément les travaux finis. |
| ASF-11 | Vérification indépendante | Une PR ne devient livrable qu'après tests réels sur le SHA exact, validation OpenSpec et conformité du périmètre. |
| ASF-12 | Livraison configurable | Mode PR par défaut, fusion humaine durant le pilote ; auto-merge possible uniquement si la politique de branche et les checks l'autorisent. |
| ASF-13 | Enchaînement des tâches | La vague attend la livraison confirmée d'une tâche avant de débloquer les dépendantes ; aucun lancement spéculatif sur `main`. |
| ASF-14 | Observabilité | Une synthèse « en cours / livré / bloqué / échoué », avec URL des runs/PR, erreurs et consommation estimée, est accessible. |
| ASF-15 | Budget et périmètre | Limites par run/vague et stop sur anomalie, sans exposition de secrets ou contournement des contrôles. |
| ASF-16 | Portabilité | La définition d'une usine réutilisable est séparée des règles métiers de ThreadStep. |

## 3. Parcours cible

**A. Planifier** : conversation → reformulation du besoin → exploration du repo → spécification fonctionnelle/technique → une ou plusieurs tâches Markdown → PR documentaire → intégration des documents.

**B. Déclencher manuellement** : sélectionner `TS-NNN` et modèle → vérifier autorisation, dépendances, état → exécuteur commun → OpenSpec → tests → PR → contrôle / livraison selon politique. Aucun orchestrateur nécessaire.

**C. Exécuter une vague** : l'utilisateur autorise explicitement un périmètre (tâches, modèle(s), budget, politique de fusion) → orchestrateur sélectionne les tâches prêtes → appelle le même exécuteur → attend les résultats prouvés → actualise le graphe de dépendances → s'arrête sur plafond, échec critique ou besoin métier ambigu.

**D. Reprendre** : après interruption, relire état distant, branche de travail, commits, OpenSpec, tests et PR ; reprendre seulement les sous-tâches non validées.

## 4. Règles métier

1. Une tâche « prête » n'est **jamais** une autorisation implicite de consommer OpenRouter ou de fusionner.
2. Le code et les spécifications doivent raconter la même évolution ; sync et archive ne maquillent pas un échec de validation.
3. Un blocage de sécurité, de données ou de contrat public requiert une décision explicite.
4. Les modes manuel et orchestré ont la même définition de « terminé ».
5. La PR pilote `TS-002` peut rester ouverte en témoin ; elle ne doit pas empêcher des tâches indépendantes.
6. Le backlog Markdown est la source canonique initiale ; une issue GitHub est une vue/synchronisation optionnelle, pas une obligation.

## 5. Exigences non fonctionnelles

- **Sécurité** : moindre privilège, séparation secrets/code non fiable, aucune fuite dans les artefacts publics.
- **Robustesse** : idempotence des reprises et merges, branches de checkpoint durables, verrouillage de concurrence.
- **Audit** : SHA, références d'artefacts, version du modèle/CLI, commande de test, statut et décision de fusion.
- **Coût** : estimation et plafond configurable par tâche/vague ; suivi des erreurs/réessais ; limite de temps seule insuffisante.
- **Interoperabilité** : utilisation d'API GitHub et de contrats indépendants du runtime OpenCode.
- **Expérience mobile** : validations humaines ponctuelles réalisables depuis téléphone ; pas de PC requis pour le pilotage courant.
- **Observabilité** : états explicites, critères de sortie et messages de blocage exploitables depuis GitHub.

## 6. Hors périmètre du pilote

Exécution parallèle arbitraire, approbation IA équivalant à une approbation humaine requise par GitHub, achat/création de clés par l'assistant, synchronisation cloud de données utilisateur ThreadStep, serveur factory permanent dès la première étape.
