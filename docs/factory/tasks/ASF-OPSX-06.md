# ASF-OPSX-06 | Checkpoint denylist et gitignore, sans blocage du code produit

Date : 2026-10-17
Type : factory
Automation : manual
Risk : high
Status : correction proposée, CI et fusion à vérifier
Incident : [TS-024 run 39073690462](https://github.com/cedricmenec/threadstep/actions/runs/39073690462)

## Besoin et décision

Les exécutions TS-024 ont échoué après `apply` bien que la compilation,
les tests et la validation du change soient réussis : le checkpoint
refuse successivement les chemins nouvellement nécessaires aux
dépendances de Dexie. Une allowlist par chemins produit est fragile.

Seule la phase `plan` garde une whitelist des artefacts OpenSpec.
La phase `apply` et la publication utilisent une **denylist des seuls
chemins protégés**, chargée depuis la branche `main` de confiance :
les `tools/`, assets, `package.json`, `package-lock.json` et
autres fichiers métier ne nécessitent aucune mise à jour ASF.
Les nouveaux chemins secrets sensibles restent refusés quel que
soit leur répertoire. Les specs canoniques ne peuvent changer qu'à
la phase de publication post-sync.

`.gitignore` complète cette mesure pour les fichiers non suivis,
sans remplacer le contrôle sur les fichiers déjà suivis ou ajoutés
explicitement via `git add -f`. Les cas suspects et la publication
restent fail-closed ; la revue de code/CI détecte les autres risques
qui ne se résument pas à un nom de fichier.

## Checklist obligatoire de cette PR factory

- [x] Garder la contrainte stricte de plan et passer apply/publish
  à une denylist de chemins risqués, sans wildcard autorisant
  les fichiers protégés par inadvertance.
- [x] Refuser credentials, `.env*`, clés, caches, dépendances installées,
  config npm et chemins mal formés, quel que soit le dossier.
- [x] Charger la politique depuis `origin/main` et l'appliquer
  avant et après staging, aux deux checkpoints et à la PR finale.
- [x] Étendre `.gitignore` aux fichiers non suivis sensibles tout
  en conservant les assets vendored versionnés utiles à l'app.
- [x] Ajouter les tests pour les trois nouveaux fichiers TS-024,
  les fichiers futurs inconnus, les faux positifs évités
  et la publication d'une archive de la seule tâche courante.
- [x] Documenter la différence entre `.gitignore` et garde de sécurité,
  et les modalités de reprise sans dépenses automatiques.
- [ ] CI `check` indépendante verte sur la PR, puis fusion protégée.
- [ ] Vérification CI et Pages de `main`, puis reprise du checkpoint
  plan TS-024 sans réécrire ni effacer les artefacts existants.

## Non-objectifs et risques résiduels

Pas d'ajout de permission GitHub App, pas de bypass de ruleset,
pas de lancement du modèle payant. Une denylist ne détecte pas tout
secret injecté au sein d'un fichier légitime : l'audit de diff, les
tests et les revues humaines restent obligatoires.
