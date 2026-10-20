# ASF-MODEL-002 | Faire évoluer le modèle OpenSpec par défaut sans affaiblir la CI

**Nature :** maintenance de la factory, configuration OpenRouter et validation CI.
**Mode :** correction manuelle sur la PR #160, sans appel OpenRouter payant.
**Date :** 20 octobre 2026.

## Contexte et périmètre autorisé

Le propriétaire sélectionne `openrouter/deepseek/deepseek-v4.1-flash-1017`
comme valeur par défaut du formulaire de lancement OpenSpec. Les autres
modèles autorisés doivent rester sélectionnables. Aucun changement de secret,
de permission, de politique d'autorisation de modèle ou de protection de
branche n'est nécessaire.

Le check de la PR #160 (run 39481777310) échoue lors de `npm run check`.
Le fichier `tests/factory-openspec.test.mjs`, ligne 19, contient une
chaîne non terminée dans l'appel `test(...)`. Cette modification avait
aussi retiré les assertions relatives aux choix de modèles et à la mention
des trois appels OpenCode en phase automatique.

## Correction et critères vérifiables

- Réparer la syntaxe du test tout en vérifiant le défaut `auto`.
- Vérifier explicitement la nouvelle valeur par défaut
  `openrouter/deepseek/deepseek-v4.1-flash-1017`.
- Préserver les assertions sur les anciens modèles disponibles et le
  libellé informant des trois appels payants en phase `auto`.
- Conserver la liste de modèles validée dans
  `scripts/asf/opencode-model-policy.mjs` et sa protection
  contre la génération de titres non autorisée.
- Actualiser `docs/factory/openspec-manual-pilot.md` avec la valeur
  proposée à l'utilisateur.
- Confirmer le check indépendant GitHub Actions sur le **dernier SHA**
  de la PR avant toute fusion. Ne pas transformer une CI rouge en
  acceptation tacite.

## Risques et limites

Les contrôles statiques ne prouvent pas la disponibilité du modèle
auprès d'OpenRouter ni le comportement d'un appel payant réel.
Aucune exécution payante n'est déclenchée pour cette correction.
La PR reste soumise aux protections normales de `main` et à la
revue/autorisation de fusion applicables.

## Preuves et suivi

- CI rouge d'origine : https://github.com/cedricmenec/threadstep/actions/runs/39481777310
- PR corrigée : https://github.com/cedricmenec/threadstep/pull/160
- Résultat CI après la correction : à établir sur le SHA final.
