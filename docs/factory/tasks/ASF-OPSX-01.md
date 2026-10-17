# ASF-OPSX-01 | Séparer checklist pré-sync et recettes postérieures

Date : 2026-10-17
Type : factory
Automation : manual
Status : implemented in PR, independent CI and merge verification pending
Priority : high
Scope : contrat OpenSpec, prompt `plan`/`apply`, gabarit, tests et documentation
Référence : [plan Notion DEV / Projets / ASF](https://app.notion.com/p/3fc12ac9163681e0ba61ca7e6a93a767)

## Contexte

Le run OpenSpec TS-017
[#39019660492](https://github.com/cedricmenec/threadstep/actions/runs/39019660492)
a laissé neuf cases de recette humaine non cochées ; le workflow
a échoué avant sync/archive et avant publication du travail.
Le garde-fou d'archivage a correctement refusé la checklist incomplète.
Le défaut relève du **contrat de planification**, pas de ce refus.

## Résultat attendu

L'agent génère `tasks.md` avec des cases uniquement pour les opérations
de développement et de tests effectivement réalisables et vérifiables
sur runner au cours de `apply`, avant sync/archive. La recette humaine
et les vérifications post-sync restent des rubriques narratives à
réaliser après livraison, sans case. Aucune exigence métier n'est effacée.

## Checklist de développement et documentation

- [x] Lire le workflow, `AGENTS.md`, le contrat OpenSpec et l'incident TS-017.
- [x] Renforcer la source `rules.tasks` dans `openspec/config.yaml`.
- [x] Renforcer la formulation du prompt `plan` et celle du prompt `apply`,
      sans changer les permissions, le routage ou les appels de modèles.
- [x] Clarifier dans `AGENTS.md` les deux sections non cochables et
      la valeur probante des seules tâches réellement exécutées.
- [x] Ajouter le contrat dédié et l'exemple de `tasks.md` ;
      mettre à jour `docs/factory/openspec-manual-pilot.md`,
      `docs/factory/openspec-protocol.md`, `README.md`
      et les décisions, avec limites et run de référence.
- [x] Ajouter des tests statiques visant la conformité des prompts,
      de la configuration, du guide et de l'exemple ; ne pas
      modifier le validateur de phases existant dans cette PR.
- [x] Confirmer que l'évolution ne demande aucun nouveau secret,
      aucune permission GitHub, aucune modification de la logique
      de sélection, du `check` obligatoire ou de l'auto-merge.

## Vérifications de livraison, preuves à constater après publication

- Vérifier `npm run check`, Actionlint et la CI `check` indépendante
  sur le SHA réel de la PR ; ne pas considérer cette liste comme
  une checklist OpenSpec `apply`.
- Confirmer la fusion avec protections `main`, la CI post-fusion
  et Pages si elles sont déclenchées.
- Vérifier qu'un nouveau `tasks.md` produit lors d'un
  **futur** `phase=plan` respecte réellement la séparation,
  avant autorisation d'`apply` payant.

## Hors périmètre et limites

- Pas de nouvelle analyse heuristique fail-closed de toutes les
  formulations manuelles, réservée à **ASF-OPSX-02**.
- Pas de checkpoint du code non publié ni de mécanisme de reprise
  (ASF-OPSX-03/04).
- Pas d'exécution OpenSpec/OpenRouter pour tester ce changement ;
  les tests statiques ne démontrent pas un comportement du modèle.
- Toujours refuser les cases non cochées avant archivage ;
  ne jamais cocher des validations humaines non exécutées.
