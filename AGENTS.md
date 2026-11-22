# ThreadStep: guide des agents

Ce fichier est la **carte d'entrée** du dépôt pour les agents de développement.
Ne charger que les documents utiles à la tâche (progressive disclosure).
Les exigences produit et les procédures spécialisées vivent dans leurs sources dédiées.

## Principes communs

- Lire les critères d'acceptation, le code et les spécifications applicables avant de modifier.
- Respecter le périmètre demandé ; distinguer état livré, historique et évolution projetée.
- Protéger les secrets et les données utilisateur : voir [sécurité](docs/security/README.md).
- Travailler sur une branche dédiée, jamais directement sur `main`.
- Ne pas contourner les validations ni annoncer des tests non exécutés comme réussis.
- Préserver les comportements et données existants, sauf évolution explicitement spécifiée.

## Carte documentaire

| Besoin | Sources à lire |
| --- | --- |
| Comprendre le produit | [Vision](docs/product/vision.md), [guide développeur](docs/product/developer-guide.md) |
| Préparer ou lire une tâche | [Backlog](backlog/README.md), [tâches](backlog/tasks/), [contrat V2](docs/factory/backlog-v2-task-contract.md) |
| Exigences canoniques et changements | [Spécifications OpenSpec](openspec/specs/), [archives](openspec/changes/archive/) |
| Sécurité, confidentialité et permissions | [Règles générales](docs/security/README.md) |
| Développer, tester, vérifier le produit | [Guide produit](docs/product/developer-guide.md), [tests](tests/) |
| Utiliser ou modifier l'ASF | [Contrat ASF](agents-asf.md), [documentation factory](docs/factory/README.md) |
| GitHub Actions et publication | [Workflows](.github/workflows/), procédures du domaine concerné |
| Démarrer une session ChatGPT | [ChatGPT.md](ChatGPT.md) |

## Parcours de travail

1. Identifier la tâche, son périmètre et les critères d'acceptation.
2. Suivre les liens pertinents et inspecter l'implémentation existante.
3. Modifier de manière ciblée, puis exécuter `npm run check` et les tests liés.
4. Rapporter les changements, les contrôles réellement effectués et les limites.
5. Pour ASF, OpenCode, OpenRouter, orchestration OpenSpec, checkpoints ou livraison automatisée, **lire d'abord [agents-asf.md](agents-asf.md)**.

## Entretien de cette carte

Conserver ce fichier sous 100 lignes. Placer les règles détaillées près de leur
domaine, préférer les liens à la duplication et actualiser la source de vérité.
