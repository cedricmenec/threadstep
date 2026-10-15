# ASF-BOOT-002 | Vérifier les dépendances ASF à partir de GitHub

Status: implemented in PR, awaiting independent CI and human merge
Type: factory
Automation: manual
Date: 2026-10-16
Related incident: Agent ASF runs 38821781408 and 38822070883

## Problème

Après fusion de la PR #40 (ASF-V2-001), les runs d'ASF-V2-002 échouaient avant OpenRouter car la fiche de la tâche précédente restait au statut ready. La PR #41 a réparé cette divergence mais la tenue de statut documentaire ne doit pas devenir un préalable permanent à l'exécution.

## Périmètre / critères

- [x] Conserver le contrôle statique de l'ID, du type, des dépendances et de l'éligibilité de la tâche sélectionnée.
- [x] Décorréler l'état documentaire des dépendances de la preuve réelle de livraison.
- [x] Vérifier en lecture seule une PR Agent ASF unique et fusionnée, issue de la GitHub App attendue et de la branche run attendue.
- [x] Vérifier l'exécution propriétaire concluante, le check indépendant `check` de la PR et du merge commit, et la réussite de CI main + Pages après fusion.
- [x] Vérifier que le merge SHA appartient à l'historique de main, sans confondre PR ouverte et livraison.
- [x] Refuser les preuves absentes/ambiguës, les permissions insuffisantes et les erreurs API avant tout appel payé.
- [x] Ajouter des fixtures déterministes pour prouver les refus et dissocier les tests de l'évolution réelle des tâches.
- [x] Mettre à jour le mode opératoire et le suivi de factory sans modifier secrets ni permissions d'écriture.
- [ ] Vérifier le dernier SHA de la PR, la CI indépendante et Actionlint.
- [ ] Après autorisation, vérifier la fusion, CI main et Pages. Ne pas lancer un run payé pour cette recette.

## Limites

Le mode bootstrap n'a vocation à reconnaître que les PR Agent ASF publiées selon le contrat propriétaire ; toute livraison manuelle non conforme requiert une réconciliation spécifique. Les lectures GitHub sont bornées, une page de réponses incomplète ou une API indisponible bloque. La CI historique et Pages constituent des preuves de livraison, non une sandbox ni un plafond financier. Un revert ultérieur du code livré nécessite encore une politique de réconciliation dédiée.
