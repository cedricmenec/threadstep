# ASF-BOOT-001 | Exécuteur manuel sécurisé des tâches ASF

Date: 2026-10-16
Status: implementation proposed in PR, not deployed or execution-authorized
Type: factory
Automation: manual
Priority: critical
Dependencies: none

## Besoin

Pouvoir confier individuellement les tâches ASF-V2-001 à ASF-V2-011 à OpenCode/OpenRouter depuis GitHub Actions. Le chemin existant TS-NNN est réservé aux fonctionnalités produit et interdit à juste titre de modifier les fichiers sensibles de la factory. Ne pas l'affaiblir.

## Périmètre

- [x] Créer un workflow propriétaire uniquement, déclenchable manuellement sur main, avec task_id ASF explicite et modèle choisi.
- [x] Vérifier tâche ready/manual et références de dépendances avant toute utilisation d'OpenRouter. Une dépendance nécessite un statut delivered/completed et un lien de PR de preuve dans sa fiche.
- [x] Isoler l'agent de développement de toute permission GitHub d'écriture ; réserver le jeton App à un job séparé après contrôles.
- [x] Appliquer dans le job publication une politique de chemins par tâche figée en code approuvé, sans permettre à l'agent d'éditer sa propre politique.
- [x] Refuser les changements hors scope, symlinks, configurations sensibles et modifications de workflows autres que celles précisément prévues par ASF-V2-008 et ASF-V2-009.
- [x] Faire passer les tests au job non privilégié, transférer un patch limité, valider de nouveau après application puis ouvrir une PR dédiée.
- [x] Désactiver la fusion automatique : contrôle humain et CI indépendante obligatoires.
- [x] Ajouter tests de politique, guide d'exploitation, limites et sécurité, sans modifier les agents produit ou les secrets.
- [ ] Vérifier le dernier SHA de la PR, la CI indépendante `check`, Actionlint et validation Bash des étapes.
- [ ] Après autorisation de fusion, vérifier la CI de main et observer le workflow déclaré sur Actions.

## Limites et compromis explicités

- Un déclenchement `execute` engage des appels OpenRouter payants ; un seul appel `opencode run` ne garantit pas un plafond monétaire.
- Les tâches ASF-V2-008 et ASF-V2-009 nécessitent la permission GitHub App `Workflows: write`. Elle n'est pas demandée automatiquement à l'administrateur. Si elle est absente, publication refusée et reprise humaine.
- La révision humaine reste requise pour chaque PR ASF, même si la CI réussit.
- Pas de nouveau workflow OpenSpec pour les modifications de factory dans ce bootstrap ; l'agent ASF utilise OpenCode directement.
- Le check local est une vérification dans un runner non privilégié, non une sandbox. Le modèle reçoit la clé OpenRouter pendant sa seule étape ; il ne reçoit jamais le jeton GitHub App.
- Aucun modèle payé ni fusion de PR ne fait partie de l'implémentation de ce bootstrap.

## Validation post-PR

Comparer la PR au périmètre, lire les diff de sécurité, vérifier Actionlint et `npm run check` sur le dernier SHA, puis donner une autorisation distincte pour fusionner et, ultérieurement, pour lancer ASF-V2-001.
