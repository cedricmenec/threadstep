# ASF-OPSX-09 | Vérifier le commit OpenSpec final avant publication

**Type :** factory. **Automation: manual**. **Date :** 26 octobre 2026.

## Incident et cause

Le [run TS-064 #40413844910](https://github.com/cedricmenec/threadstep/actions/runs/40413844910/job/121891116107) a validé le code au checkpoint `aea9a1615f2c2326d84af646cfdcd96fde8ad445`, puis exécuté la synchronisation sémantique et l'archivage OpenSpec. Les validations strictes ont réussi (50 specs et 54 changements archivés). La deuxième exécution de `npm run check`, introduite pour éviter les références à des fichiers déplacés lors de TS-063, a échoué **avant le commit final**.

Cinq tests lisent `git status --porcelain` et traitent toute modification de `openspec/specs/` ou `openspec/changes/archive/` comme une violation. Or ces écritures sont précisément autorisées et attendues lors d'OPSX sync et archive. Ils sont donc inadaptés à un contrôle effectué sur le worktree final encore sale. Ils restent utiles lorsqu'ils sont exécutés sur un état Git stabilisé.

## Correctif restreint

- Conserver le contrôle de code **avant** le checkpoint `apply`, les vérifications des tâches et le `sync-guard`.
- Conserver les validations OpenSpec strictes avant et après archivage.
- Déplacer le dernier `npm run check` vers l'étape de publication, **après** `git add -A`, le vérificateur de portée de confiance et le commit local, mais **avant** le push de branche et la création de PR.
- Exiger un worktree propre juste avant et juste après les tests finaux. Tout échec empêche la publication distante ; seul le checkpoint `apply` existant reste durable.
- Ne pas supprimer, ignorer ni désactiver les cinq tests historiques, ni déroger au contrôle indépendant `check` de la PR.

## Validation

- [ ] Vérifier l'ordre exact et la présence des contrôles via `tests/asf-openspec-postarchive-order.test.mjs`.
- [ ] Vérifier les scripts Bash/YAML, `npm run check`, le build et la CI indépendante sur le SHA de la PR.
- [ ] Fusionner la PR selon Protect Main, puis vérifier la CI de main.
- [ ] Pour TS-064, relancer **seulement après accord propriétaire explicite** un nouveau `phase=finalize` depuis le checkpoint `apply` existant. Cela redéclenche la **synchronisation OPSX payante**, mais pas l'implémentation ni le plan.

## Limites

Ce correctif résout un **conflit de phase** reproductible à l'issue du sync/archivage, et non tous les risques liés aux tests. Il ne prouve pas la réalisation de la recette humaine de TS-064 ni le succès d'une reprise future. Il ne modifie pas OpenCode, le modèle, le consentement, les secrets, les comptes, les spécifications produit ni la politique de fusion.

La simplification et l'observabilité de la suite de tests font l'objet de [ASF-QA-01](ASF-QA-01.md), tâche séparée.
