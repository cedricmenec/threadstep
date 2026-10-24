# ASF-OPSX-DEPS-01 : installer les dépendances projet avant la validation OpenSpec

**Type :** factory, correctif ciblé, exécution manuelle. **Date :** 24 octobre 2026.

## Incident et périmètre

- TS-058 a été fusionnée via [PR #198](https://github.com/cedricmenec/threadstep/pull/198), apportant des tests qui importent `esbuild`.
- Le [run TS-059 #40100098015](https://github.com/cedricmenec/threadstep/actions/runs/40100098015/job/120890329291) s'est arrêté à `Validate the produced plan` : `ERR_MODULE_NOT_FOUND` pour `esbuild` dans trois suites TS-058. Bilan : 1 081 tests passés et trois suites en erreur.
- `package.json` déclare `esbuild` en dépendance de développement et la CI indépendante installe déjà avec `npm ci` ; l'exécuteur OpenSpec n'installait jusqu'alors que ses outils *globaux*.
- Aucune modification de produit TS-059, aucun checkpoint de plan ou d'implémentation publié, aucune branche distante `agent/openspec/TS-059` attestée.

## Correctif autorisé

- Installer Node 22 puis exécuter `npm ci` à partir du checkout du dépôt, avant la création du jeton GitHub App et avant tout appel OpenCode. Cet unique prérequis s'applique à `plan`, `apply`, `auto` et `finalize`.
- Conserver inchangés les versions globales OpenSpec/OpenCode, le choix de modèle, les garde-fous de checkpoint, les permissions, les secrets et la logique de fusion.
- Ajouter un test Node statique empêchant le retour d'un `npm run check` dans l'exécuteur avant l'installation des dépendances.
- Documenter l'incident et la procédure de reprise dans `docs/factory/validation-and-recovery.md`.

## Validation et limites

- [ ] Relecture du diff limitée au workflow, au test et à la documentation factory.
- [ ] Syntaxe GitHub Actions validée par `actionlint` en CI indépendante.
- [ ] `npm ci`, `npm run check`, build et vérifications indépendantes réussis sur le SHA exact de la PR.
- [ ] PR fusionnée sans bypass après check `check` réussi, CI et Pages post-fusion vérifiées.

**Hors périmètre :** ne pas relancer TS-059 ni déclencher OpenRouter dans cette PR. La CI valide le garde-fou sans prouver une exécution OpenSpec payante. Une reprise nécessite un nouveau `workflow_dispatch` autorisé en `phase=auto`, car aucun plan distant n'a été checkpointé.

**Portabilité :** le projet ASF AgentKit (`cedricmenec/asf-agent-kits`) extrait une version portable du workflow dans sa PR #93. L'agent du kit doit traiter séparément l'ordre d'installation des dépendances configurable par dépôt, sans copier aveuglément les hypothèses `npm`/Node propres à ThreadStep.
