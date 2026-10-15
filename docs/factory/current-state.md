# État courant de l'Autonomous Software Factory

**Référence vérifiée : 15 octobre 2026, après fusion des PR #25 et #26.**
Point d'entrée unique pour reprendre le pilote. Les règles exécutables sont
[AGENTS.md](../../AGENTS.md), les workflows dans .github/workflows/ et les
spécifications canoniques dans openspec/specs/. L'historique reste dans GitHub.

## Architecture en service

- **GitHub, source de vérité** : dépôt public cedricmenec/threadstep ;
  backlog sous backlog/tasks/, vision et contrat produit dans docs/product/,
  changement OpenSpec actif ou archivé sous openspec/changes/.
- **Application pilote** : site statique dans site/, navigateur et
  localStorage, import/export JSON, publication GitHub Pages, sans backend.
- **Deux exécuteurs manuels** : agent.yml (direct, sans OpenSpec) et
  agent-openspec.yml (plan / apply / auto / finalize). Le propriétaire
  déclenche un task_id et un modèle dans Actions ; aucun ordonnanceur
  automatique ni orchestration de vagues n'est déployé.
- **Formulaire OpenSpec** (évolution ASF-WF-001) : phase `auto` et modèle
  DeepSeek V4.1 Flash pré-sélectionnés (GLM 5.3 Flash et les autres phases
  toujours disponibles). Numéro `9`, `09`, `009` ou nom `TS-009`
  normalisé en `TS-009` avant les opérations payantes. Les runs OpenSpec
  sont sérialisés pour éviter les courses entre variantes d'ID. Le clic
  manuel « Run workflow » reste indispensable ; les 3 appels OpenCode
  de `auto` ne sont pas plafonnés en USD. Cette modification de configuration
  est contrôlée par tests statiques ; aucun run payé de validation n'a été lancé.
- **OPSX natif OpenCode, validé sur TS-009** : le runner installe
  @fission-ai/openspec@1.14.1, génère les fichiers agent avec
  openspec init --tools opencode,agents, vérifie les skills et les commandes,
  puis lance opencode run --command opsx-sync ts-009. Le test a modifié la
  section MODIFIED d'une spécification déjà canonique, et non seulement
  ajouté une nouvelle capacité.
- **Contrats et isolation** : le script scripts/sync-guard.mjs compare les
  empreintes de contenu des fichiers suivis et non suivis avant/après sync,
  interdit les changements hors openspec/specs/ et exige une modification
  canonique. Le script scripts/check-openspec-task-phases.mjs, ajouté par
  PR #25, interdit des demandes explicitement post-sync dans la checklist
  pré-sync au moment du plan et au démarrage de apply.
- **Publication** : GitHub App threadstep-software-factory, branche
  agent/openspec/TS-NNN, PR, CI indépendante et fusion autorisée par le
  propriétaire. Les workflows d'agent n'effectuent pas eux-mêmes de merge.
- **Versions/coûts** : OpenSpec épinglé en 1.14.1, OpenCode installé par
  opencode-ai@latest, observé en 1.19.0 durant TS-008. Modèles OpenRouter
  configurés : DeepSeek V4.1 Flash et GLM 5.3 Flash. Les appels restent
  payants ; il n'existe ni plafond USD garanti ni relevé de dépense
  automatique dans le workflow.

## Preuves d'exécution vérifiées

| Référence | Preuve et conclusion |
| --- | --- |
| PR #8, TS-005 | Pilote OpenSpec plan/apply, archivé et fusionné. |
| PR #16 | Correction des étapes de validation ignorées par l'ancien auto TS-007. |
| PR #19 | Premier sync sémantique guidé par un prompt OpenCode, archive --skip-specs. |
| PR #21, TS-008 | Auto complet, 41 tests, nouvelle capacité resume-tracking ADDED, PR et CI/Pages réussies. |
| PR #22 | Génération des skills/commandes OpenCode et garde-fou SHA-256 avant/après sync. |
| PR #23 et #24 | Préparation du backlog TS-009 et plan OpenSpec fusionné prématurément, sans code. |
| Run 38710098331 | Premier apply TS-009 : code généré et 54 tests OK, bloqué par une checklist demandant un contrôle post-sync avant sync. Rien de publié. |
| PR #25 | Contrat des phases de checklist et cinq tests de non-régression rapides, fusionné. |
| Run 38712079641, PR #26 | Second apply TS-009 : 55 tests, invocation OPSX native, garde-fou de périmètre, fusion MODIFIED, archive, PR fusionnée. |
| Runs 38713003608 et 38713003743 | CI de main après PR #26 : 60 tests réussis ; déploiement Pages réussi. |

Références :
[TS-009 apply](https://github.com/cedricmenec/threadstep/actions/runs/38712079641) ·
[PR #26](https://github.com/cedricmenec/threadstep/pull/26) ·
[CI main](https://github.com/cedricmenec/threadstep/actions/runs/38713003608) ·
[Pages](https://github.com/cedricmenec/threadstep/actions/runs/38713003743).

**Portée de la preuve OPSX :** la modification de
openspec/specs/next-action-suggestion/spec.md a remplacé uniquement
« Suggestion card content », conservé son scénario d'origine et ajouté
trois scénarios, sans dupliquer ni effacer les autres exigences. Le test
démontre MODIFIED, **pas REMOVED ni RENAMED**. L'archive du change est dans
openspec/changes/archive/2026-10-15-ts-009/.

## Incident et reprise : TS-009

La PR #24 contenait seulement le plan et a été fusionnée trop tôt. Le
premier apply, run 38710098331, a créé localement le code et passé 54 tests,
mais la checklist 4.3 demandait un diff **après** sync tandis que le workflow
exigeait toutes les cases cochées **avant** sync. Arrêt protecteur légitime,
sans commit distant : les fichiers locaux du runner ont été perdus.

Le plan a été corrigé sur la branche persistante de TS-009 : contrôle pré-sync
dans la checklist et revue post-sync hors cases à cocher. Le second
[apply 38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641)
a entièrement réussi et publié la PR #26, désormais fusionnée. La PR #25
prévoit une détection statique anticipée de cet anti-pattern. **Ne pas relancer
TS-009**, son change est archivé et son code est livré.

Ce cas rappelle que le plan fusionné dans main avant apply est une exception,
pas le parcours recommandé : conserver le plan en PR brouillon, exécuter
apply sur la branche d'agent, puis fusionner la PR finale.

## Risques et limites encore ouverts

1. **Protection de main absente** : l'API GitHub renvoie protected: false
   après la fusion #26. Required checks et règles de branche ne sont pas
   activés ; les succès de CI ne sont pas un verrou administratif.
2. **Budget** : aucun plafond OpenRouter USD exécutable par run/vague, ni
   comptabilité fournisseur corrélée aux runs. Chaque lancement effectif
   reste une opération à autoriser.
3. **Reproductibilité** : OpenCode installé par @latest, à épingler après
   validation d'une version cible ; OpenSpec est déjà épinglé.
4. **Isolation** : empreintes SHA-256 et filtres de chemins sont des
   protections de fichiers, non une sandbox contre les actions du modèle.
5. **Couverture OPSX** : MODIFIED vérifié ; REMOVED, RENAMED, conflits de
   modifications multiples non encore démontrés.
6. **Reprise transactionnelle** : pas de checkpoints distants automatiques
   pour chaque étape d'apply, comme illustré par le premier run TS-009.
7. **Validation UI** : 60 tests Node et Pages réussis, mais pas de preuve
   de campagne complète lecteur d'écran et mobile automatisée.
8. **Synchronisation des statuts** : les métadonnées des tâches du backlog
   nécessitent encore une tenue manuelle, désormais réconciliée par
   [ASF-DOC-001](tasks/ASF-DOC-001.md).

## Étapes suivantes recommandées

- Configurer la protection de main (checks requis, politique de revue,
  interdiction des pushs directs et force-pushs) dans les paramètres GitHub.
- Épingler OpenCode, tracer les coûts fournisseur et fixer une politique
  de dépenses/reprises proportionnée.
- Préparer une nouvelle expérimentation **distincte** pour REMOVED/RENAMED
  ou une fusion sémantique conflictuelle, sans rejouer TS-009.
- Étudier la persistance de checkpoints et l'orchestration par vagues,
  sans introduire d'auto-merge sans décision explicite.
- Maintenir cette page, la roadmap, les ADR et les statuts du backlog
  à chaque livraison.

## Documentation de référence

[Mode opératoire](openspec-manual-pilot.md) ·
[Protocole OpenSpec](openspec-protocol.md) ·
[Sécurité GitHub](github-autonomy-and-security.md) ·
[Décisions](decisions.md) ·
[Roadmap](roadmap.md) ·
[Tâche de réconciliation](tasks/ASF-DOC-001.md).
