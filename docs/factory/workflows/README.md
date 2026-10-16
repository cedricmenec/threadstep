# ASF : carte fonctionnelle des workflows GitHub Actions

**Référentiel initial ASF-V3-DOC-001, état du code V1/V2 au 16 octobre 2026.** Sources : les YAML sur `main` (référence de rédaction : `646da5ba6b494948aa7d7f7647ef485066900cd2`). La V3 1..10 est **à l'étude**, non disponible. Cette page décrit la réalité actuelle, pas un projet d'évolution. Lire le [contrat documentaire](step-documentation-contract.md).

## Quelle entrée choisir ?

| Workflow / YAML | Déclenchement | Jobs | Valeur métier / résultat | Guide par step |
| --- | --- | --- | --- | --- |
| [Agent manuel](../../../.github/workflows/agent.yml) | `workflow_dispatch` propriétaire, tâche produit, modèle et option auto-merge | `develop` | Implémentation directe d'une tâche `TS-NNN`, tests puis PR ; pas de protocole OpenSpec | À produire |
| [Agent OpenSpec](../../../.github/workflows/agent-openspec.yml) | `workflow_dispatch` propriétaire ou `workflow_call` par un orchestrateur authentifié | `normalize-task`, `staged-development` | Phases `plan`, `apply`, `auto`, `finalize` ; code et specs synchronisées, PR finale après vérifications | À produire |
| [Backlog Orchestrator V1](../../../.github/workflows/backlog-orchestrator.yml) | `workflow_dispatch` propriétaire, `dry-run` ou `execute`, quota 1 ou 2 | `prepare`, `first`, `after_first`, `second`, `after_second` | Sélectionne et réserve puis confie une tâche à OpenSpec ; bloque la suivante sans livraison vérifiée | À produire |
| [Agent ASF](../../../.github/workflows/agent-asf.yml) | `workflow_dispatch` propriétaire, tâche factory `ASF-V2-NNN` | `preflight`, `develop`, `publish` | Modifie de façon restreinte la factory ; patch validé séparément puis PR **sans auto-merge** | [Détail complet de V2](agent-asf.md) |
| [CI](../../../.github/workflows/ci.yml) | `pull_request` vers main et `push` sur main | `check` | Vérifications indépendantes : Actionlint, tests, index et OpenSpec | À produire |
| [Pages](../../../.github/workflows/pages.yml) | `push` sur main ; `workflow_dispatch` | `validate`, `build`, `deploy` | Vérifie, assemble et publie le site statique via GitHub Pages | À produire |

Les noms de workflow sont des étiquettes UI. Les chemins YAML sont les références exécutables. Un modèle pré-sélectionné ou une tâche marquée `ready` n'autorise jamais une dépense payante.

## Chemin fonctionnel 1 : agent produit direct

L'utilisateur autorise explicitement une tâche de backlog. L'agent vérifie le périmètre, implémente directement avec OpenCode/OpenRouter, exécute les tests puis publie une PR. La fusion demandée par `auto_merge=true` reste conditionnée aux contrôles GitHub indépendants. L'agent direct ne synchronise pas des artefacts OpenSpec.

## Chemin fonctionnel 2 : OpenSpec, manuel ou orchestré

`plan` produit un plan en PR brouillon, `apply` reprend un plan examiné, `auto` combine les phases de planification, implémentation et synchronisation sémantique, `finalize` clôt des travaux déjà présents. `auto` peut faire **trois appels payants** à OpenCode/OpenRouter. Le chemin orchestré exige une authentification de vague avant toute phase payante. Le succès du workflow n'est pas une preuve suffisante de livraison pour l'orchestrateur.

## Chemin fonctionnel 3 : orchestrateur de backlog V1

`prepare` fige les candidats, la politique et les empreintes du backlog, puis, seulement en mode `execute`, réserve un slot. `first` invoque OpenSpec réutilisable ; `after_first` vérifie réellement PR, CI, fusion et Pages avant de réserver `second`. `after_second` ferme la vague. Il ne s'agit ni d'une boucle de 10 tâches ni d'une matrix parallèle. Journal et quotas ne doivent pas être réinitialisés pour retenter une tâche coûteuse.

`dry-run` observe et explique une sélection, sans appel au modèle, écriture de vague ou permission de publication.

## Chemin fonctionnel 4 : maintenance ASF, séparée du produit

L'exécuteur ASF est volontairement distinct des agents produit. Il ne possède pas une permission générale d'éditer tous les fichiers : sa politique versionnée nomme des tâches V2 et refuse des chemins sensibles, notamment `.github/workflows/` et la politique elle-même. Les tâches V2-008/009 ont nécessité un parcours humain séparé. Voir le [guide détaillé](agent-asf.md).

## Contrôles transverses et terminologie

- **Job réussi** : code du job terminé sans erreur, pas nécessairement livré.
- **PR publiée** : proposition de changement, peut être ouverte, refusée ou en attente.
- **Livraison vérifiée** : PR/SHAs corrélés, required `check` indépendant, fusion autorisée, CI main et Pages post-fusion prouvées.
- **Réservation** : quota consommé avant dispatch, même en cas d'issue ultérieure ambiguë.
- **Stop conservateur** : échec, divergence, appel GitHub incertain ou délai dépassé bloque un nouveau départ.
- **Permissions** : `GITHUB_TOKEN` à droits minimaux et GitHub App de publication séparés selon workflows ; aucun secret en documentation.

## Où sont les autres références ?

[Guide développeur](../developer-guide.md) · [mode opératoire V1](../backlog-orchestrator-manual.md) · [pilote OpenSpec](../openspec-manual-pilot.md) · [Agent ASF](../agent-asf-manual.md) · [sécurité et GitHub App](../github-autonomy-and-security.md) · [état vérifié](../current-state.md) · [architecture cible V3](../asf-v3-architecture.md, uniquement si fusionnée sur la branche consultée).

## Couverture actuelle et maintenance

**Couvert dans cette première PR** : carte de tous les workflows, contrat des fiches, documentation step par step de `agent-asf.yml`. **Non couvert à ce stade** : les descriptions exhaustives des cinq autres YAML, leurs diagrammes de séquence et le contrôle automatisé de dérive. Cette dette constitue le reste du programme documentaire ASF-V3-DOC-001.

Avant toute mise à jour : vérifier le YAML en vigueur et son SHA, ne jamais déduire un état opérationnel d'une fiche historique. Chaque ajout, suppression, renommage ou modification de `if`, variable, autorisation, action ou commande doit réviser la fiche correspondante.
