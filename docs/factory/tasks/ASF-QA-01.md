# ASF-QA-01 | Audit et simplification des contrôles Factory/OpenSpec

**Type :** factory. **Automation: manual**. **Statut :** proposé. **Date :** 26 octobre 2026.

## Problème

Les incidents TS-063 et TS-064 montrent des contrôles exécutés dans des phases inadaptées, tandis que la CI exécute plus d'un millier de tests hétérogènes. Leur succès ou échec peut devenir difficile à interpréter, et un test de portée historique peut rejeter une opération OpenSpec légitime.

## Proposition à instruire

1. **Inventaire et classification :** cartographier chaque suite en `unit`, `integration`, `contract`, `workflow/security`, `Git worktree state`, `product UX` et `manual`. Identifier les tests dépendant du statut Git, du chemin courant d'une change OpenSpec, de jsdom ou d'un service.
2. **Contrôles par étape :** préciser le contrat de chaque gate (plan, apply, pre-sync, post-sync, post-archive sur commit local, PR CI, main/Pages). Éliminer seulement les doublons dont la couverture et le risque ont été démontrés équivalents.
3. **Observabilité :** synthèse CI lisible avec étape, suite, test, cause, lien vers logs, nombre de tests et prochaine action conseillée ; ne pas noyer les erreurs sous mille succès. Préférer les rapports machine lisibles et une synthèse GitHub plutôt qu'un filtrage de logs non fiable.
4. **Robustesse :** tests à données synthétiques, isolation des ressources asynchrones, interdiction des chemins OpenSpec éphémères dans les tests durables. Remplacer les assertions `git status` historiques par des validations attachées à un commit/base ou à une phase explicite, avec protection des modifications non autorisées démontrée.
5. **Mesure :** relever durées et fréquence des échecs intermittents sur plusieurs runs non payants, puis définir un budget/objectif de durée et une stratégie de réduction des exécutions complètes.

## Critères d'acceptation pour une future implémentation

- [ ] Rapport de cartographie des suites, phases et responsabilités.
- [ ] Résumé d'échec GitHub reproduisant un scénario connu sans divulguer de secrets.
- [ ] Contrôles de sécurité inchangés ou renforcés ; aucune exclusion silencieuse de tests rouges.
- [ ] Scénarios négatifs démontrant qu'une modification non autorisée reste bloquante.
- [ ] Absence d'appels OpenRouter et de modification de données Cloud pendant l'audit.
- [ ] CI indépendante et validation humaine avant fusion.

**Hors périmètre de ce cadrage :** changement du fournisseur LLM, suppression globale de tests, refonte du protocole OPSX sans preuve, nouvel automatisme payant.
