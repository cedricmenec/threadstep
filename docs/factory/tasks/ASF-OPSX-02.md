# ASF-OPSX-02 | Valider les checklists avant l'appel payant apply

Date : 2026-10-17
Type : factory
Automation : manual
Status : implemented, CI et fusion à vérifier sur GitHub
Priority : high
Scope : garde-fou statique `tasks.md`, workflow, tests, documentation
Source : [plan ASF dans Notion](https://app.notion.com/p/3fc12ac9163681e0ba61ca7e6a93a767)

## Objectif

Empêcher le run OpenSpec de payer une phase `apply` pour un plan
contenant des cases de recette humaine ou de travaux possibles
seulement après OPSX sync, archive et publication. Les neuf
cases du [run TS-017 #39019660492](https://github.com/cedricmenec/threadstep/actions/runs/39019660492)
illustrent le défaut. Ne pas cocher automatiquement ces cases ni
supprimer les validations métier requises après publication.

## Travail réalisé

- [x] Étendre `scripts/check-openspec-task-phases.mjs` sans nouvel
  appel réseau, dépendance ni modèle payant.
- [x] Détecter les cases explicites de recette manuelle, clavier,
  tactile, viewport, écran, navigateur réel, revues visuelles,
  publication PR, archive, CI/Pages postérieures, y compris
  sur plusieurs lignes et les cases pré-cochées.
- [x] Rejeter toutes les cases logées dans `Manual acceptance`
  ou `Post-sync review` ; ignorer les exemples dans les blocs
  de code Markdown et conserver le numéro de ligne.
- [x] Laisser passer les tests automatisés explicitement nommés
  (Node, DOM, assertions, tests unitaires et simulation) lorsque
  aucune recette réelle n'est demandée.
- [x] Ajouter un garde-fou dédié dans le workflow **avant** le
  premier appel OpenRouter `apply` pour `phase=apply|auto`,
  tout en conservant les contrôles aux phases de préparation
  et de validation `plan`.
- [x] Refuser fichiers introuvables, checklist vide et autres
  erreurs de lecture sans basculer en mode permissif.
- [x] Ne pas affaiblir le gate de cases inachevées avant archive,
  le contrôle de périmètre, la protection du plan, la sync,
  la CI obligatoire, la fusion et les permissions existantes.
- [x] Compléter tests déterministes, documentation du contrat,
  guide, index et journal des décisions.

## Vérification et limites

- La suite Node et la CI indépendante `check` seront la preuve
  de conformité des tests et du workflow, sans dépense OpenRouter.
- Le validateur est **heuristique** et peut laisser passer une
  paraphrase inédite : une exécution `auto` conserve un risque
  résiduel. Le mode `plan` puis revue avant `apply` reste
  recommandé. Les tests ne prétendent pas établir le comportement
  futur du LLM.
- Conserver la recette manuelle après publication ; son absence
  ne devient jamais une preuve d'acceptation humaine.
- ASF-OPSX-03 (checkpoint) et ASF-OPSX-04 (reprise) restent
  hors périmètre ; aucune nouvelle autorisation d'exécution
  payante, de secret ou de permissions n'est ajoutée.
