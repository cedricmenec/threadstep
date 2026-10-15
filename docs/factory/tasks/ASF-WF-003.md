# ASF-WF-003 | Rétablir le workflow manuel OpenCode

Date: 2026-10-15
Status: completed; PR #30 merged and independent CI/Pages verified
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
- [x] CI GitHub de PR #30 réussie (73 tests Node et Actionlint),
  puis fusion humaine effectuée.
- [x] Après #30, la CI de main et Pages ont réussi ; les pushs
  suivants ne génèrent plus d'exécutions parasites invalides du workflow.
  La syntaxe est validée par Actionlint et les tests Bash, sans
  lancement payant du mode direct.

## Prévention

Actionlint vérifie le YAML, les expressions et la structure de workflow.
Le test `bash -n` couvre la syntaxe Bash embarquée, y compris les
guillemets non refermés qui étaient la cause de l'incident. Ces deux
vérifications seront présentes dans les futures PR de factory.

**Aucun workflow OpenRouter n'est lancé pour cette réparation.**

## Preuves de résolution (15 octobre 2026)

[PR #30](https://github.com/cedricmenec/threadstep/pull/30),
[CI de PR](https://github.com/cedricmenec/threadstep/actions/runs/38746938998),
[CI main](https://github.com/cedricmenec/threadstep/actions/runs/38747525932)
et [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38747528029)
ont réussi. Le workflow manuel est de nouveau syntaxiquement valide ;
il n'a pas été réexécuté avec OpenRouter pour ce diagnostic.
