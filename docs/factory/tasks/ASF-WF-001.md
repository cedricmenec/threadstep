# ASF-WF-001 | Simplifier le formulaire GitHub Actions OpenSpec

Status: implemented in PR (pending independent CI and merge)
Date: 2026-10-15
Priority: normal
Scope: workflow OpenSpec, deterministic task-id normalization, tests, factory docs

## Besoin

Réduire les interactions nécessaires pour lancer un run OpenSpec tout en
conservant le choix manuel du propriétaire, la compatibilité des anciens
identifiants et les garde-fous actuels. Par défaut, afficher la phase auto
et le modèle DeepSeek V4.1 Flash.

## Critères d'acceptation

- [x] Le formulaire workflow_dispatch pré-sélectionne phase=auto, puis
  plan/apply/finalize restent disponibles sans changement d'exécution.
- [x] Le formulaire pré-sélectionne
  openrouter/deepseek/deepseek-v4.1-flash, avec
  openrouter/z-ai/glm-5.3-flash toujours sélectionnable.
- [x] L'input obligatoire task_id accepte 9, 09, 009 et TS-009.
  Il produit toujours le même identifiant canonique TS-009 pour
  backlog, branche d'agent, change OpenSpec et messages de commit.
- [x] La validation a lieu avant installation et invocation d'OpenCode,
  préserve l'interdiction d'exécuter une tâche inexistante et rejette
  zéro, plus de trois chiffres, chemins, nombres partiels et formes
  non canoniques de TS-NNN.
- [x] Les variantes de saisie ne permettent pas deux runs parallèles
  sur la même branche : un job de prévalidation transmet le TS-NNN
  canonique au groupe de concurrence **propre à cette tâche**.
  Les tâches distinctes peuvent toujours s'exécuter en parallèle.
- [x] Ajouter des tests déterministes offline pour le normaliseur,
  ses entrées invalides, le CLI et la configuration du workflow.
- [x] Actualiser documents opératoires, décisions, roadmap,
  backlog et contrat des agents dans cette même PR.
- [x] Préserver déclenchement uniquement manuel, filtre du propriétaire,
  autorisation de fusion distincte, garde-fous OPSX et CI.
- [x] Vérifier la CI indépendante du code et du normaliseur sur la PR :
  [run 38717714727](https://github.com/cedricmenec/threadstep/actions/runs/38717714727), succès.

## Vérifications après fusion

Contrôler la CI sur main et Pages. La sélection effective des valeurs par
l'interface GitHub sera vérifiable au prochain lancement manuel, sans
exécuter un nouveau workflow payant pour cette seule modification.

## Précaution sur les coûts

La phase auto par défaut lance normalement trois appels OpenCode
(plan, apply et sync OPSX), chacun pouvant générer des requêtes fournisseur
supplémentaires, sans plafond USD intégré. Ce choix n'exécute rien tant
que le propriétaire n'a pas cliqué sur « Run workflow ». Vérifier phase
et modèle avant chaque déclenchement. Aucun workflow_dispatch
payant n'a été demandé pour réaliser cette tâche.

## Limites

La normalisation concerne agent-openspec.yml uniquement :
le workflow direct historique agent.yml est inchangé.
L'alias numérique n'élargit ni les autorisations GitHub, ni le
périmètre fonctionnel des tâches. Le job de prévalidation normalise
et vérifie l'existence de la tâche avant les appels payants.
Le verrou de concurrence s'applique à chaque tâche canonique :
les autres tâches conservent leur parallélisme. GitHub peut remplacer
un run encore en attente par une exécution plus récente du même groupe.
