# ASF-WF-003 | Rétablir le workflow manuel OpenCode

Date: 2026-10-15
Status: proposed fix in PR, not merged
Priority: critical
Scope: GitHub Actions manual agent workflow and independent workflow lint

## Incident observé

Après fusion de la PR #29, GitHub Actions a créé de nombreuses exécutions
intitulées `.github/workflows/agent.yml` ou « Workflows / Agent »,
déclenchées par des pushs de la branche de travail puis de main. Toutes
ont échoué **sans aucun job**, contrairement à la CI classique et Pages,
qui ont réussi.

L'origine est la corruption du YAML de
`.github/workflows/agent.yml` au cours de l'édition du garde-fou des
chemins protégés dans la PR #29 : la commande `grep` a perdu la fin
du motif et sa syntaxe shell, puis la fin du workflow a été dupliquée.
GitHub ne pouvait plus analyser ce workflow `workflow_dispatch`.

Cette régression a échappé à l'ancienne CI, qui exécutait les tests
Node et validait OpenSpec mais **ne lintait pas les workflows Actions**
et ne compilait pas la syntaxe Bash de leurs blocs `run: |`.

## Critères d'acceptation

- [x] Restaurer le garde-fou complet des chemins sensibles dans
  `agent.yml`, notamment scripts/, docs/factory/, backlog/ et
  openspec/config.yaml.
- [x] Supprimer les fragments et étapes dupliqués, sans modifier les
  paramètres `auto_merge` ni les protections introduites en PR #29.
- [x] Conserver `name: Agent (manual, OpenRouter)` et le déclencheur
  `workflow_dispatch`, sans nouveau déclencheur automatique.
- [x] Ajouter à la CI indépendante un contrôle Actionlint versionné
  sur l'ensemble de .github/workflows/.
- [x] Ajouter un test Node parcourant les scripts Bash des blocs
  `run: |`, les soumettant à `bash -n`, et vérifiant l'unicité
  des étapes de publication et de fusion.
- [x] Documenter l'incident et son correctif, sans changer le code produit.
- [ ] CI GitHub réussie sur la PR et revue du diff.
- [ ] Confirmation après fusion : le workflow a retrouvé son nom, aucun
  run d'échec automatique n'est créé par les pushs, CI de main et Pages OK.

## Prévention

Actionlint vérifie le YAML, les expressions et la structure de workflow.
Le test `bash -n` couvre la syntaxe Bash embarquée, y compris les
guillemets non refermés qui étaient la cause de l'incident. Ces deux
vérifications seront présentes dans les futures PR de factory.

**Aucun workflow OpenRouter n'est lancé pour cette réparation.**
