# ASF-OPENCODE-001 | Stabiliser l'installation du CLI OpenCode dans les agents

**Nature :** factory, fiabilité des outils agents et reproductibilité. **Exécution :** manuelle, pas de modèle payant pour la correction. **Priorité :** haute. **Date :** 22 octobre 2026. **Statut :** changement livré uniquement lorsque PR, CI et fusion sont vérifiées.

## Incident et diagnostic établi

- [Agent OpenSpec TS-052, run #39783720926](https://github.com/cedricmenec/threadstep/actions/runs/39783720926), `phase=auto` : échec du job `staged-development` à l'étape « Install OpenCode » avant tout appel modèle.
- `npm install --global opencode-ai@latest` a sélectionné le wrapper 1.19.4 dont le `postinstall.mjs` n'a pas trouvé les binaires attendus sur npm (`opencode-linux-x64@1.19.4` ETARGET ; `opencode-linux-x64-baseline@1.19.4` E404). Ne pas attribuer cet échec au code de TS-052 ni à Dexie.
- Les jobs de normalisation, validation de la branche, politique de modèle approuvé et installation OpenSpec ont réussi ; les étapes plan/apply/sync ont été `skipped`. Dernier checkpoint durable `none`, aucune branche publiée et aucun appel OpenRouter de ce run n'est attendu.
- Le dépôt possède une preuve de réussite antérieure avec OpenCode **1.19.0** (pilote OpenSpec TS-009) ; retenir cette version déjà éprouvée plutôt qu'une version `@latest` mouvante. Il s'agit d'un retour à une version connue, pas d'une validation que les binaires 1.19.4 seront publiés ultérieurement.

## Modification autorisée

- Épingler `opencode-ai@1.19.0` dans `.github/workflows/agent-openspec.yml`, `.github/workflows/agent.yml` et `.github/workflows/agent-asf.yml`. Préserver les modèles approuvés, `small_model`, le blocage de l'agent `title`, les autorisations GitHub App, le verrou unique et les checkpoints existants.
- Exiger `opencode --version == 1.19.0` après chaque installation. Une erreur empêche tous les appels OpenRouter sans fallback vers un package flottant ou une autre version.
- Ajouter dans `CI / check` un smoke test `npm install --global opencode-ai@1.19.0` suivi de `opencode --version` sur Ubuntu : pas de connexion de modèle ni de jeton fournisseur.
- Renforcer les tests Node déterministes pour empêcher un retour à `@latest`, confirmer les trois exécuteurs, la version attendue et l'ordre installation/validation/appel payant. Actualiser la documentation factory et sa politique de mise à niveau.

## Critères de validation

- [ ] `npm run check` et `actionlint` valident les workflows, les tests existants et les nouveaux invariants.
- [ ] Sur le SHA exact de la PR, le job `CI / check` installe effectivement `opencode-ai@1.19.0` depuis npm sur `ubuntu-latest` et constate `opencode --version == 1.19.0`.
- [ ] Le diff est limité aux workflows agents/CI, tests et documentation ASF. Aucun secret, modèle supplémentaire, nouvelle autorisation GitHub ou changement produit.
- [ ] Fusion GitHub protégée après CI indépendante réussie et vérification post-fusion sur `main` ; aucune commande OpenRouter payante ne participe à la validation de cette PR.

## Reprise contrôlée TS-052

Après livraison du correctif et contrôle de la CI, relancer manuellement `Agent OpenSpec` avec `task_id=TS-052`, `phase=auto`, modèle explicitement approuvé. L'ancien run n'a ni plan ni checkpoint distant ; `apply` et `finalize` seraient inadaptés. Toute relance payante exige une autorisation distincte. Ne jamais lancer de retry automatique du run GitHub échoué avec son ancien YAML ; un `Re-run jobs` pourrait réutiliser le commit de workflow défaillant.

## Hors périmètre et limites

- Aucune correction TS-052/Dexie ni refonte du catalogue de modèles LLM ; rester distinct d'ASF-MODEL-001 et de l'idée de catalogue centralisé.
- Le smoke test prouve uniquement la disponibilité et l'exécution du CLI Linux sur le runner, **pas** la qualité, le coût ni la compatibilité complète d'une exécution OpenCode avec OpenRouter ou OpenSpec. La recette du prochain run payant reste manuelle.
- Mise à jour de la version uniquement par PR distincte, avec vérification des paquets wrapper/binaire, politique de modèles et `check` indépendant.
