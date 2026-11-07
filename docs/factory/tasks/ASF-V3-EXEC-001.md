# ASF-V3-EXEC-001 | Généralisation sécurisée de l'exécuteur Agent ASF

Status: proposed
Type: factory
Automation: manual
Priority: high
Dependencies: none
Phase: ASF V3 / sécurité et exécuteur
Created: 2026-10-16

## Besoin

L'Agent ASF V2 a été conçu avec une liste fermée de tâches ASF-V2-001..011 et des permissions/chemins spécifiques à cette phase. Concevoir un exécuteur pérenne pour plusieurs phases de développement de la factory **sans affaiblir** les barrières de sécurité et de publication qui le distinguent de l'agent produit.

## Portée de CETTE PR de spécification

- [x] Comparaison factuelle entre `agent.yml` et `agent-asf.yml` et rappel des protections existantes.
- [x] Identification des points d'ancrage V2 : validation d'IDs, listes de fichiers, dépendances, prompts, précontrôle et publication.
- [x] Proposition d'un contrat de tâche versionné, indépendant de la phase V2, et de profils d'autorisation explicites.
- [x] Refus explicite de tout auto-élargissement des permissions de l'Agent ASF et séparation d'une voie humaine pour les workflows/politiques sensibles.
- [x] Découpage de l'implémentation en PR code/tests puis PR workflow sensible, chacune avec revue, tests et documentation dédiée.
- [x] Spécification et matrice de tests documentées dans [le dossier de conception](../agent-asf-v3-generalization.md).

## Critères pour une future implémentation, non accomplis dans cette PR

- Le précontrôle accepte des tâches V3 reconnues par **politique approuvée** et refuse les identifiants inconnus, sans modifier le sens des tâches V2 déjà livrées.
- La liste de chemins et le profil sont définis par une source fiable, pas par un prompt ou un fichier que l'agent peut éditer pendant son exécution.
- `develop` ne possède jamais de jeton App d'écriture ; `publish` valide un patch borné avant tout token de publication.
- Toute modification de `.github/workflows/`, de la politique de publication ou d'une autorisation GitHub reste bloquée par le profil normal, avec voie sensible examinée **humainement avant application**.
- CI indépendante, contrôles de provenance, absence de retry payant implicite et de fusion automatique ASF.
- Couverture positive/négative d'identifiants, dépendances, path traversal, symlink, replays, doublons de PR et patch non fiable.

## Conditions et hors périmètre

Cette PR n'implémente **aucun** changement de code, aucune permission GitHub App, aucune autorisation payante ou mode auto de factory. La préparation de cette fiche et de son profil n'autorise aucune exécution.

L'implémentation éventuelle devra reposer sur la validation du cadrage ASF-V3-001 et une nouvelle autorisation pour chaque PR sensible. Aucune tâche factory n'entre dans la sélection automatique des tâches produit.

## Validation

Contrôler la cohérence du document avec `agent-asf.yml`, `agent.yml`, `scripts/agent-asf-policy.mjs`, `scripts/verify-asf-dependencies.mjs` et leurs tests. `npm run check` n'a pas été exécuté localement au moment de cette rédaction ; vérifier le `check` indépendant GitHub sur le SHA final. Pas de fusion sans approbation distincte.
