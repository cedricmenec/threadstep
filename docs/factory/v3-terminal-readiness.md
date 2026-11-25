# ASF-V3-015 — Réconciliation terminale GitHub-native (read-only)

État : **protocole de preuve prêt pour qualification par simulation**, aucune mutation Git, aucun paiement.

**Chaîne de revues** : [#87](https://github.com/cedricmenec/threadstep/pull/87) (V3 consolidée) → [#96](https://github.com/cedricmenec/threadstep/pull/96) (bootstrap + preuves GitHub) → lot V3-015.

## Fonction : observeV3GithubTerminalReadiness

Arguments : \`readClient, waveId, kind, reason\` avec \`kind\` valant \`RELEASE\` ou \`QUARANTINE\`. Aucune entrée \`manifest\`, \`journal\`, \`registry\`, \`globalSha\` ou \`deliveryEvidenceHash\` choisie par un appelant.

1. Relire et qualifier les rulesets GitHub actifs, en particulier la branche globale (protection anti-destruction, anti-force-push, writer App limité), à partir des détails de rulesets reçus, sans booléen de confiance de l'agent.
2. Relire le ref global et le ref de vague au HEAD actuel. Lire \`manifest.json\` et \`journal.json\` **à un seul et même SHA de vague**, en appliquant la validation de schéma, le contrôle des secrets et le rejeu intégral de transitions du noyau V3.
3. Lire \`registry.json\` au SHA du ref global et rejouer le registre pour vérifier qu'il possède encore la bonne vague ACTIVE et le mandat owner d'origine.
4. Pour \`RELEASE\`, parcourir toutes les preuves \`DELIVERED\` du journal reconstitué, exiger unicité des numéros de PR, recouper chaque PR GitHub, ses CI, son merge et son déploiement Pages via la fonction V3-014. Les preuves observées doivent être **identiques** à celles conservées dans le journal. Le cas \`COMPLETE_NO_WORK\` sans livrable ne permet que la construction d'une proposition, jamais une libération.
5. Soumettre le tuple à la fonction pure \`inspectV3GithubTerminalCandidate\`, calculer le hash des preuves indépendantes et exiger un état terminal admissible.
6. Relire les deux refs pour détecter toute modification observée durant l'opération. Retourner \`terminal_reconciled_not_authorized\` avec une proposition et ses SHA, **mais absolument aucun droit de RELEASE, WRITE, QUARANTINE ni paiement**.

L'observateur ne peut pas rendre une décision valide contre une transition concurrente entre le dernier GET et le PATCH futur : ce verrou de concurrence relève **exclusivement** du writer CAS global à implémenter et à auditer.

## Frontière stricte avec la production

- Le lecteur Github injecté doit être un authentique adaptateur contrôlé par le workflow owner, pas un objet fourni par le modèle. Les tests sont simulés.
- Une PR/Pages indépendante peut être validée mais le journal de livraison V3 réel doit auparavant avoir été écrit par CAS. Il faut lier ce protocole au **writer terminal global** avec relecture finale à l'instant d'écriture.
- **QUARANTINE reste une proposition** ; un incident de sécurité peut justifier le blocage conservatoire mais la remédiation exige une décision humaine.
- On ne promeut jamais \`consistent_not_authorized\` en autorisation de payer. Le workflow V3 demeure inerte et ne reçoit aucun token write.
- Même après le futur writer terminal, la possibilité de lancer des vagues exige le propriétaire GitHub, les règles effectives, le bootstrap unique, l'ACK/CLAIM_CHILD, le mutex V1/V3 et une revue séparée avant dépenses.

## Test à suivre

\`tests/asf-v3-github-native-terminal-readiness.test.mjs\` couvre les vagues sans travail, l'arrêt ambigu, le ruleset manquant, le rejeu corrompu, le ref de vague absent, la course sur le ref global et les entrées non fiables.

Il reste ensuite la mise en œuvre **non payante** de la validation en situation concurrente et du writer terminal restreint, ainsi que les droits GitHub App et la capture des inputs propriétaires par le workflow d'origine.
