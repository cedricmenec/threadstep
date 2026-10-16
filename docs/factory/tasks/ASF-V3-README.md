# ASF V3 — backlog de préparation (proposition, non autorisée à l'exécution)

**Créé le 16 octobre 2026, pour reprise dans une autre session.**

**Cadrage décidé le 16 octobre 2026 (proposition de PR documentaire ASF-V3-001, en revue) :** première cible de mise en service **1 à 10 tâches**, champ **numérique entier** strictement validé, reprise après panne **uniquement sur diagnostic et autorisation explicite**, documentation détaillée des workflows **en parallèle**. L'extension à 15 est un objectif ultérieur et non une capacité disponible. Voir [fiche ASF-V3-001](ASF-V3-001.md) et [architecture/ADR proposée](../asf-v3-architecture.md). Les choix techniques de dispatch, de continuité nominale inter-runs, de budget et de timeouts restent à arbitrer ; aucune exécution V3 n'est autorisée.


**État : `proposed` — réflexion et découpage documentaire uniquement.** La phase [ASF V2 est clôturée](../closeout-2026-10-16.md). Le workflow opérationnel reste **Backlog Orchestrator V1**, limité à **1 ou 2 démarrages payants séquentiels**. La création de ce backlog **n'autorise** ni implémentation, ni run OpenRouter, ni nouveaux secrets/permissions, ni modification de `main` sans PR et contrôles.

## Demande à conserver

Faire évoluer l'Autonomous Software Factory pour que **le propriétaire choisisse, à chaque lancement, le nombre maximal de tâches**, avec une cible de **1 à 15 démarrages** et des paliers de validation envisageables à **3, 5, 10 puis 15**. Le paramétrage porte sur le **maximum de démarrages réservés**, *pas* sur un nombre garanti de livraisons réussies, ni sur un plafond de dépense en dollars.

- **Objectif fonctionnel :** permettre par exemple `max_tasks=3`, `5`, `10` ou `15` sans créer 15 variantes manuelles du workflow.
- **Nécessité :** préserver le contrôle de l'utilisateur sur le budget, les tâches candidates, la priorité, les dépendances et la décision de démarrer.
- **Règle de base envisagée :** **une seule tâche à la fois** (`maxConcurrentTasks=1`) ; sélection recalculée *après vérification réelle de la livraison précédente*.
- **Limite d'autorisation :** au plus `max_tasks` réservations et départs sur une vague ; **zéro retry payant automatique** ; arrêt conservateur en cas d'échec, conflit, check rouge, GitHub/API indisponible, annulation ou état ambigu.
- **Traçabilité :** manifeste initial immuable, hashes de chaque brief, journal durable append-only, réservation du quota *avant* l'appel payant et identifiants de corrélation fiables même après reprise.
- **Livraison :** PR sur branche d'agent, `check` indépendant sur tête et fusion, fusion selon `Protect Main`, CI et Pages post-fusion **avant** le démarrage suivant ; aucun bypass.
- **Durée et coûts :** dix ou quinze tâches peuvent dépasser la durée d'une seule exécution GitHub Actions. Le contrôleur devra gérer des **checkpoints inter-runs** et la réconciliation. Une limite de départs ne suffit pas à borner la facture OpenRouter : définir une politique de budget, de visibilité des coûts et de condition d'arrêt réellement vérifiable, sans promettre une borne USD que le fournisseur n'assure pas.
- **Compatibilité :** ne pas réécrire l'historique des vagues V1 et ne pas affaiblir le parcours manuel. Prévoir migration/versionnement des contrats de manifeste, journal, sécurité et tests avant activation.

La cible à **15** reste une intention de produit ; la conception devra confirmer le maximum réellement sûr à partir des limites de GitHub Actions, des preuves de reprise et des budgets. On peut commencer par qualifier **10**, puis porter le plafond à **15** avec un palier de recette séparé. Aucun de ces paliers n'est actuellement disponible.

## Découpage proposé en futures PR ASF V3

Les identifiants ci-dessous désignent **des lots de PR à créer après cadrage dans une prochaine session**, pas des tâches exécutables par l'Agent ASF V2. Ils ne sont **ni `ready`, ni `automation: allowed`** ; toute évolution de la factory est de type **factory / manual**, et les changements sensibles nécessitent une revue et une autorisation distinctes.

| Lot proposé | PR attendue | Pré-requis | Critère principal de recette |
| --- | --- | --- | --- |
| **ASF-V3-001 — Cadrage et ADR** | PR documentaire : besoins, politique de quotas 1..15, modèle de coût, temps d'attente, menaces et architecture de reprise | Aucun | Cas 0/1/2/3/5/10/15 et sécurité explicités ; limite V1 inchangée |
| **ASF-V3-002 — Contrôleur durable** | PR code/tests : machine à états itérative, manifeste versionné, journal et reprise déterministe | 001 | Réservation avant départ, maximum paramétré jamais dépassé, redémarrage idempotent, simulations jusqu'à 15 et test du 16e refusé |
| **ASF-V3-003 — Exécuteur et authentification** | PR de sécurité : preuve de parenté, réservation, modèle approuvé, SHA et permissions pour workflows enfants | 001, 002 | Aucune exécution sans autorisation owner/run/manifest validée ; protection contre double départ, replay et nouveaux accès |
| **ASF-V3-004 — Intégration GitHub Actions** | PR sensible : boucle/dispatcher, délais et contrôle PR/CI/Pages entre chaque tâche, entrée `max_tasks` | 002, 003 | Ordre réellement séquentiel ; stop en cas de check rouge, ambiguïté, timeout ; modes manuels V1 préservés |
| **ASF-V3-005 — Budget, observabilité et panne** | PR adaptée : journal de consommation observée, limites/alertes, tableau de résultats, tests concurrence/API/crash | 002–004 | Zéro reprise payante implicite, coûts distingués des quotas, diagnostic consolidé, aucun secret dans logs |
| **ASF-V3-006 — Recette et déploiement par paliers** | PR(s) documentaires : protocole de mise en service, preuves GitHub, comparaison V1/V3, rollback | 001–005 | Dry-runs et cas négatifs sans paiement ; pilotes 3/5/10 puis 15 **uniquement sur nouvelles autorisations explicites** |

Ce découpage est **indicatif** : revalider les dépendances, le périmètre de chaque PR et la nécessité de dissocier les modifications de workflows (sensibles) des autres avant d'émettre les fiches ASF-V3-001..006 formelles. Chaque PR factory devra comprendre ses tests, sa documentation et une revue humaine ; `check` indépendant obligatoire.

## Décisions à prendre au retour

1. **Plafond cible :** maximum 10 en première version, extension ultérieure à 15, ou 15 dès la conception avec mise en service progressive ?
2. **Ergonomie :** champ numérique strictement validé (1..15) ou liste de valeurs `1, 2, 3, 5, 10, 15` au premier déploiement ?
3. **Durée/reprise :** quels checkpoints et quelle action du propriétaire en cas de CI lente, annulation du parent ou run enfant déjà parti ?
4. **Budget :** seuil de dépense affiché/estimé, action lorsque mesure indisponible, maximum de temps et politique d'absence de garantie d'un véritable plafond fournisseur.
5. **Recette :** quelles tâches produit de faible risque et quel budget autoriser pour les pilotes réels, une fois la V3 implémentée ? Aucun choix n'est fait maintenant.

## Références de reprise

- [Étude technique ASF à 10 tâches](../scale-to-ten.md) : verrous actuels dans `.github/workflows/backlog-orchestrator.yml`, `scripts/asf/waves/manifest.mjs`, `authenticate-executor.mjs`, `orchestrate.mjs` et graph à deux slots.
- [Guide développeur ASF](../developer-guide.md) et [mode opératoire V1](../backlog-orchestrator-manual.md).
- [Clôture vérifiée ASF V2](../closeout-2026-10-16.md) et [validation/reprise](../validation-and-recovery.md).
- [Contrat de travail `AGENTS.md`](../../../AGENTS.md) et [guide de nouvelle session `ChatGPT.md`](../../../ChatGPT.md).

**Reprise recommandée :** lire ce document lors de la prochaine session, choisir le cadrage 10/15 et formaliser d'abord ASF-V3-001 dans une PR de conception. **Ne rien implémenter ni exécuter aujourd'hui du seul fait de la présence de ce backlog.**
