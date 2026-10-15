# ASF-WF-002 | Fusion automatique conditionnée à la CI

Date: 2026-10-15
Status: implemented in PR, waiting for review/merge
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
- [ ] Obtenir un avis de CI sur la PR et la revue humaine avant fusion.

## État GitHub constaté avant préparation

- Le dépôt autorise Allow auto-merge : true.
- La branche main est protected : true.
- Le ruleset actif Protect Main (id 25163425) impose la création de PR,
  interdit les force-pushs et la suppression, et n'a pas de bypass déclaré.
- **Blocage critique :** la règle required_status_checks existe, mais
  required_status_checks est une **liste vide**. Le contrôle CI check
  n'est donc pas actuellement obligatoire.
- L'API historique branch-protection retourne 403 pour le connecteur,
  mais la lecture du ruleset public a réussi. Le vérificateur de fusion
  s'appuie sur les règles actives, pas seulement sur le booléen protected.

## Action manuelle de configuration avant usage

Dans Settings > Rules > Rulesets > Protect Main, ajouter le contrôle
GitHub Actions `check` à la liste Required status checks, si possible
en imposant la source GitHub Actions. Vérifier que le ruleset est actif.

Tant que cette condition manque, un workflow lancé avec auto_merge=true
publiera la PR (si le développement réussit) mais s'arrêtera sur le
contrôle de prérequis, **sans demander ni effectuer de fusion**.

## Limites explicites

- Aucun agent payant n'a été exécuté pour valider cette modification.
- CI/tests valident le garde-fou, mais pas un cycle GitHub auto-merge
  opérationnel en situation réelle.
- Le required status check de GitHub peut avoir besoin d'une mise à
  jour de la branche selon les règles choisies et les autres PR fusionnées.
- Les exigences d'approbation de PR restent appliquées si l'administrateur
  décide de les ajouter ; la fusion pourrait alors attendre une revue.
- Les scripts de CI et de publication Pages sont inchangés.
