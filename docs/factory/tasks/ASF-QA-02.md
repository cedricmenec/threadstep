# ASF-QA-02 | Ne pas bloquer les tâches sur une recette humaine antérieure

**Type :** factory, politique de planification, exécution manuelle. **Date :** 27 octobre 2026.

## Symptôme et décision propriétaire

Le run [TS-065 #40419591019](https://github.com/cedricmenec/threadstep/actions/runs/40419591019) a généré un plan puis bloqué `apply` : le plan exigeait une PR documentant le GO manuel desktop/Android de TS-064. Or [TS-064 PR #214](https://github.com/cedricmenec/threadstep/pull/214) était déjà fusionnée, sa CI et Pages étaient vertes. La publication d'un rapport [#215](https://github.com/cedricmenec/threadstep/pull/215) a constitué une étape de friction uniquement pour satisfaire la gate inventée par le plan. Une deuxième PR d'attestation [#218](https://github.com/cedricmenec/threadstep/pull/218) a été préparée pour TS-065, puis **fermée sans fusion** à la demande du propriétaire.

**Décision :** une tâche produit dépendante peut démarrer dès que la précédente est **implémentée, vérifiée par CI indépendante, fusionnée, validée sur `main` et déployée**. Il n'est plus nécessaire de créer une PR ou de recueillir un GO humain pour débloquer `plan`/`apply`.

## Séparation simple des responsabilités

1. **Dépendance technique `depends_on` :** constater livraison réelle à partir de PR, SHA, checks et Pages. Une attestation de recette passée n'est **pas** un prérequis implicite.
2. **Recette humaine :** conserver la liste et marquer honnêtement `NOT_RUN` / non attesté lorsque sa preuve n'existe pas. Un résultat `FAIL` réel reste un problème à examiner, mais il n'est pas légitime d'interpréter l'absence de rapport comme un échec.
3. **Décision produit explicite propre à la nouvelle tâche :** ne pas supprimer le besoin d'approbation quand la tâche le requiert, par exemple le **choix des références Stitch Overview pour TS-066**, ou un consentement et arbitrage de sécurité.
4. **Coûts et protections :** aucun lancement de LLM payant, modification de permissions, contournement Protect Main, auto-merge nouveau, assouplissement de `npm run check`, OpenSpec strict ou `sync-guard`.

## Changements

- Actualiser `AGENTS.md`, le contrat Backlog V2, le modèle de tâche, le contrat de checklist et le guide OpenSpec.
- Ajouter la règle aux consignes d'`openspec/config.yaml` et aux prompts `plan`/`apply` du workflow, sans nouveau script ni état d'orchestration.
- Protéger cette différence avec des tests déterministes vérifiant la présence des consignes et l'absence de besoin d'attestation antérieure ; garder TS-066 en `proposed` tant que l'approbation Stitch manque.
- Le rapport de recette antérieur de TS-064 reste un document historique véridique, **pas** un modèle de PR obligatoire. Le GO TS-065 communiqué en conversation et Notion n'a pas besoin d'être recopié sur `main` pour avancer.

## Validation et limites

- [ ] CI indépendante `check` sur SHA exact, tests, syntaxe GitHub Actions et vérification OpenSpec.
- [ ] Diff limité à la politique/documentation Factory et tests, sans code fonctionnel, chemins secrets ou modification d'autorisations.
- [ ] Fusion après CI verte, puis CI de `main` et Pages contrôlées.
- [ ] Notion reflète la décision ; aucun coût OpenRouter déclenché.

**Limite :** les tests de chaîne d'instructions statiques démontrent que les prompts portent la règle, pas qu'un LLM payant ne l'ignorera jamais. Ne pas rejouer TS-065, déjà livrée. La porte Stitch TS-066 est **distincte** de cette suppression de GO manuel.
