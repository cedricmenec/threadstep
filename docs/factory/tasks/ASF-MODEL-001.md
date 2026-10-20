# ASF-MODEL-001 | Bloquer les modèles OpenCode non autorisés en arrière-plan

**Nature :** factory, sécurité des autorisations et coûts. **Exécution :** manuelle, sans déclenchement payant pour cette modification. **Priorité :** haute. **Date :** 20 octobre 2026. **Statut :** correctif en PR (la fusion et la recette restent à confirmer).

## Incident observé

Sur le run OpenSpec TS-047, le fournisseur OpenRouter affiche un prompt système « You are a title generator. You output ONLY a thread title. Nothing else. », accompagné du prompt de plan OpenSpec. Le fournisseur est Google Nano Banana, absent des choix explicitement autorisés pour la factory.

**Cause racine vérifiée par rapprochement du dépôt et de la documentation OpenCode :**

1. Les workflows `.github/workflows/agent-openspec.yml` et `.github/workflows/agent.yml` passent `--model "$OPENCODE_MODEL"` aux appels métier.
2. Ni `small_model` ni l'agent interne `title` ne sont configurés. Aucun `opencode.json` n'est présent dans le dépôt.
3. OpenCode possède un agent caché de génération de titres ; si `small_model` est absent, il sélectionne automatiquement une famille de modèle chez le fournisseur principal. Cette sélection peut choisir un modèle de génération d'image coûteux, même lorsque l'utilisateur a autorisé uniquement DeepSeek ou GLM. Voir https://github.com/anomalyco/opencode/issues/52004.
4. `opencode-ai@latest` rend ce comportement dépendant des versions publiées en amont. Aucun secret GitHub ne fuit nécessairement à cause de ce seul appel, mais le prompt métier transmis à l'agent de titrage peut constituer une requête et une dépense non approuvées.

L'utilisateur a fourni les extraits du prompt ; sans exporter les journaux de facturation du fournisseur, le volume et le montant exact des requêtes ne sont pas attestés.

## Correctif ciblé

- Utiliser `scripts/asf/opencode-model-policy.mjs` comme source versionnée de la liste de **trois modèles autorisés**, cohérente avec les choix des workflows directs et orchestrés.
- Définir `OPENCODE_CONFIG_CONTENT` au début des jobs : `model` = modèle choisi ; `small_model` = le même modèle choisi ; `agent.title.disable = true`. Aucun appel payant supplémentaire n'est requis pour les titres.
- Charger ce script de politique exclusivement depuis **`origin/main`** dans les deux workflows, jamais depuis une branche de tâche ancienne ou modifiable par un agent. Échouer *avant* le premier appel OpenRouter si le modèle est absent ou hors liste.
- Respecter les phases plan/apply/finalize/auto, le contrat OpenSpec, les secrets et l'auto-merge existants sans élargir les droits. Ne pas committer de configuration OpenCode générée sur le runner.

## Vérifications automatisées, réalisables sans facturation

- [ ] Chaque modèle autorisé produit une configuration `model === small_model` avec `agent.title.disable === true`.
- [ ] Un modèle non approuvé, y compris `openrouter/google/gemini-nano-banana-2.1`, bloque l'étape et n'écrit aucune configuration de sortie.
- [ ] Les trois entrées de workflow disposent d'une liste cohérente de modèles.
- [ ] Les deux exécuteurs chargent la politique depuis `origin/main`, avant tous les appels `opencode run`, y compris OPSX sync.
- [ ] CI indépendante `check` : tests Node, syntaxe et `actionlint` réussis sur le SHA final de la PR.

## Recette manuelle après livraison, non revendiquée par les tests

Avec autorisation explicite d'une **future** exécution OpenRouter et sur une tâche de test sans donnée sensible : consulter le run GitHub et les logs OpenRouter, constater l'absence de prompt de titre et de tout appel à un modèle hors sélection, sur l'agent direct et les phases OpenSpec appropriées. Ne pas lancer un run payant uniquement pour cette recette sans autorisation. Vérifier le coût exact côté OpenRouter indépendamment de la CI.

## Limites et points de vigilance

- Ce contrôle corrige **le mécanisme identifié de titrage et la sélection par défaut de petit modèle**. La CI statique ne prouve pas à elle seule l'absence universelle de tout autre appel LLM dans des versions futures d'OpenCode.
- **Évolution distincte recommandée :** épingler puis tester une version précise d'OpenCode plutôt que `@latest`, et instaurer une télémétrie agrégée des coûts par run sans informations sensibles. Ne pas annoncer un plafond USD inexistant.
- Ne jamais mettre de clé OpenRouter ni de contenu de prompt métier dans des artefacts publics ou des tests. Aucun changement à GitHub Apps, permissions, secrets ou `main` sans PR.

## Preuves indépendantes disponibles au 20 octobre 2026

- CI initiale [#39446584380](https://github.com/cedricmenec/threadstep/actions/runs/39446584380) : échec isolé d'un test de lecture de la syntaxe des choix YAML de l'orchestrateur (apostrophes/guillemets). Le blocage est intervenu avant la fin de la chaîne de vérification ; aucune phase OpenRouter.
- CI après correction du test [#39446798846](https://github.com/cedricmenec/threadstep/actions/runs/39446798846) : `check=success` sur `6710efe5a59fac2ba0d804f2f36b2a03276f73de`, incluant les tests négatifs, la vérification des workflows et la validation OpenSpec. Toute modification ultérieure de PR exige son propre `check` indépendant au SHA final.
- **Aucune preuve E2E OpenRouter sur runner post-correctif** : ne pas lancer de tests payants sans nouvel accord du propriétaire. Vérifier ultérieurement les factures réelles pour confirmer qu'aucune génération de titre n'a eu lieu.
