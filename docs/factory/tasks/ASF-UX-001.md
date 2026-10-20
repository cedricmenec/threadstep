# ASF-UX-001 | Rendre le contrat UX produit visible dans les plans OpenSpec

**Automation: manual**

## Contexte et demande

ThreadStep adopte un contrat produit canonique de continuité des interactions :
`openspec/specs/ux-interaction-continuity/spec.md` (PR produit dédiée). Une
spécification seule ne garantit pas que chaque futur plan d'évolution UI la
consultera. Cette tâche renforce uniquement l'instruction de planification
OpenSpec, sans modifier le comportement métier ni les permissions de la factory.

## Périmètre autorisé

- Dans `openspec/config.yaml`, ajouter au `context` un rappel vers la spec UX
  pour les tâches impliquant l'interface.
- Dans `rules.proposal`, `rules.specs`, `rules.design` et `rules.tasks`,
  demander une analyse des états transitoires, du focus, du défilement et des
  exceptions explicites, ainsi que les tests déterministes possibles.
- Conserver intégralement les consignes ASF-OPSX-01 de séparation des cases
  de `apply`, de `Manual acceptance` et de `Post-sync review`.

## Contrôles et risques

- Vérifier que `openspec/config.yaml` reste un YAML valide pour le schéma
  `spec-driven` et que les clés `rules` correspondent aux artefacts OpenSpec.
- Vérifier que le plan ne demande pas des tests navigateur manuels comme cases
  automatisables, et qu'il n'affirme aucune recette humaine non réalisée.
- Exécuter `npm run check`, la validation OpenSpec stricte et la CI indépendante.
- Revue manuelle de la qualité des prompts : l'instruction n'est pas une preuve
  que le modèle l'appliquera correctement à chaque exécution.
- Le risque fonctionnel est limité à l'instruction du planificateur mais peut
  affecter la qualité des futurs plans ; revue manuelle obligatoire.

## Exclusions

Aucun appel payant OpenRouter, changement de workflow, token, secret, politique
de fusion, modèle, implémentation UX ni modification de `AGENTS.md`.

## Statut

Proposition documentaire et de configuration, sans autorisation de lancement
de modèle. PR fusionnable uniquement après validation effective du SHA exact et
autorisation explicite du propriétaire pour cette livraison.
