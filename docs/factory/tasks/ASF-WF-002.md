# ASF-WF-002 | Fusion automatique conditionnée à la CI

Date: 2026-10-15
Status: implemented; PR #29 merged, E2E OpenSpec auto-merge proven by PRs #32 and #34
Priority: high
Scope: two agent workflows, guarded native auto-merge, tests and documentation

## Objectif

Le déclenchement manuel du workflow devient la seule action humaine habituelle.
La factory publie une PR et demande à GitHub sa fusion automatique seulement
si la branche main impose la réussite d'une CI indépendante. Le propriétaire
peut toujours désactiver la fusion automatique au lancement.

## Critères d'acceptation

- [x] Ajouter aux workflows agent.yml et agent-openspec.yml un booléen
  auto_merge, activé par défaut et désactivable par le propriétaire.
- [x] Dans le workflow OpenSpec, ne jamais demander d'auto-merge pour plan
  (PR brouillon), même si la case auto_merge est cochée.
- [x] Après publication d'une PR finale, lire la configuration GitHub :
  repo allow_auto_merge=true, main protected=true, ruleset actif applicable
  à main avec obligation de PR et required status check nommé check.
- [x] Si un prérequis est absent, illisible ou ambigu, échouer sans fusion
  et conserver la PR en attente. Ne jamais fusionner sans cette preuve.
- [x] Confirmer que la PR est ouverte, non brouillon, ciblée sur main,
  avec la branche de l'agent et le SHA exact du dernier commit poussé.
- [x] Demander la fusion native différée via GitHub CLI avec --auto,
  --merge et --match-head-commit, sans --admin ni push direct vers main.
- [x] Réutiliser le jeton de la GitHub App existante sans introduire de
  nouveaux secrets ou permissions administratives.
- [x] Ne pas demander de fusion si le workflow direct n'a rien publié.
- [x] Empêcher le workflow direct de modifier les scripts de sécurité,
  conventions, backlog et fichiers internes de la factory.
- [x] Ajouter des tests statiques et des tests unitaires des conditions
  de refus et des paramètres de PR, sans déclencher OpenRouter.
- [x] Mettre à jour le mode opératoire, la sécurité, l'état actuel,
  les décisions et la feuille de route de la factory.
- [x] PR #29 fusionnée avec CI réussie, puis PR #30 corrective fusionnée.
- [x] Deux PR OpenSpec (#32, #34) ont été fusionnées automatiquement
  par la GitHub App après réussite du check indépendant.

## État GitHub constaté, puis corrigé le 15 octobre 2026

- Le dépôt autorise Allow auto-merge : true.
- La branche main est protected : true.
- Le ruleset actif Protect Main (id 25163425) impose la création de PR,
  interdit les force-pushs et la suppression, sans bypass déclaré.
- **Première lecture** : la règle required_status_checks existait, mais
  sa liste était vide. La CI n'était donc pas encore obligatoire.
- **Seconde lecture, pendant la revue de cette PR** : le propriétaire a
  ajouté le required status check `check` associé à GitHub Actions
  (integration_id 15368). La règle est désormais active et vérifiée.
- L'API historique branch-protection retourne 403 pour le connecteur,
  mais la lecture du ruleset public permet de contrôler les exigences.
- La suite du travail ne nécessite pas de changer encore les règles
  pour ce scénario, tant que `Protect Main` reste inchangé.

## Précaution permanente

Le workflow reverifie la présence du check obligatoire à **chaque run**.
Si l'administrateur supprime `check` ou désactive le ruleset, la demande
de fusion automatique échoue en laissant la PR ouverte. Cela empêche
qu'une évolution ultérieure des paramètres GitHub crée un auto-merge
sans CI indépendante.

## Limites explicites

- Aucun agent payant n'a été exécuté pour valider cette modification.
- Le cycle GitHub auto-merge est maintenant **prouvé sur les PR OpenSpec**
  #32 et #34, mais pas sur un workflow direct ni sur une CI volontairement rouge.
- Le required status check de GitHub peut avoir besoin d'une mise à
  jour de la branche selon les règles choisies et les autres PR fusionnées.
- Les exigences d'approbation de PR restent appliquées si l'administrateur
  décide de les ajouter ; la fusion pourrait alors attendre une revue.
- Les scripts de CI et de publication Pages sont inchangés.

## Vérification E2E postérieure (15 octobre 2026)

[PR #32](https://github.com/cedricmenec/threadstep/pull/32)
et [PR #34](https://github.com/cedricmenec/threadstep/pull/34) :
`auto_merge.enabled_by` et `merged_by` signalent tous deux
`threadstep-software-factory[bot]`, après passage de CI sur PR.
[CI main](https://github.com/cedricmenec/threadstep/actions/runs/38755434920)
et [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38755434958)
réussis. L'échec volontaire de CI, l'auto-merge de l'agent direct
et les contraintes d'approbation supplémentaires n'ont pas été testés.
