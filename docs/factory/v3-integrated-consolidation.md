# ASF-V3-011 — Intégration consolidée, un seul exemplaire par module

**DRAFT. Branche de qualification non payante, jamais exécuteur de production.**
Dépôt : \`cedricmenec/threadstep\`.
Date : 17 octobre 2026.
Cette branche est construite sur la tête de #81 et réunit les véritables modules de #69/#70/#71/#73/#74. Les PR historiques **restent non fusionnées** : la consolidation n'est pas une décision de déployer ou de clore les travaux.

## Contenu physique consolidé

**Côté wave (copies exactes depuis #73, déjà intégrées et testées avec #74) :**
- \`lifecycle.mjs\` — quota, réservations, événements/replay, non-retry, check-point.
- \`provenance.mjs\` — identité du run enfant/contrôleur observée depuis GitHub.
- \`git-cas.mjs\` — writer CAS du journal opérationnel par wave.
- \`trusted-snapshot.mjs\` — \`manifest.json\` et \`journal.json\` au même HEAD.
- \`transaction-bridge.mjs\` — revendication enfant et attachement de continuation.
- \`integration.mjs\` — assemblage réel des fonctions ci-dessus.
- \`github-git-data-port.mjs\` — adaptateur Git Data REST borné au journal de **la** vague.

**Côté admission et contrôle de confiance (hérités d'une seule branche #81 : #75 → #77 → #79 → #81) :**
- \`global-admission.mjs\`, \`bootstrap-evidence.mjs\`, \`paid-mutex-audit.mjs\`.
- \`signed-global-admission.mjs\`, \`signed-global-witness.mjs\`.
- \`owner-intent-preflight.mjs\`, \`registry-ancestry-audit.mjs\`, \`production-trust-root.mjs\`.

Chaque chemin de module \`scripts/asf/v3/*.mjs\` est **unique dans l'arbre Git**. Les sources préexistantes sont importées et conservées sans alias/suffixe de version concurrent. Les suites Node existantes des PR sont rassemblées sous leurs noms originaux. Un succès des tests signifie une cohérence de prototype **simulé**, pas une mise en service.

## Matrice des PR historiques : à examiner sans fusion automatique

| Source | Périmètre | Situation de fusion |
|---|---|---|
| #66–#68 | Architecture, documentation métier/workflows/agent | Lecture et revue distinctes, non remplacées par des copies automatiques |
| #69 | V3-002 lifecycle | Copie dans la consolidation depuis #73, à examiner avant fusion |
| #70 | V3-003 provenance + CAS | Copie depuis #73, à examiner avant fusion |
| #71 | V3-004 snapshot + pont | Copie depuis #73, à examiner avant fusion |
| #73 | V3-005 intégration et tests | Fichiers repris une fois, PR #73 historiquement empilée |
| #74 | V3-006 GitData port | Même fichier déjà présent dans #73, **ne PAS rajouter en doublon** |
| #75 | V3-007 admission globale | Une seule copie via historique #81 |
| #77 | V3-008 permis/témoins signés | Une seule copie via historique #81 |
| #79 | V3-009 owner intent | Une seule copie via historique #81 |
| #81 | V3-010 audit origine/checkpoint/root désactivée | Une seule copie via historique #81 |
| cette PR | V3-011 consolidation et qualification | **Pas de fusion avant revue propriétaire des dépendances** |

Pour nettoyer la liste de PR à la fin : le propriétaire décide si les anciennes PR sont absorbées, rebasées, ou fermées au profit de cette branche. Ne jamais les fusionner séparément et ensuite la branche consolidée sans vérifier les commits/sources exacts.

## Sécurité et portée non-payante

- Aucune permission GitHub App accordée, aucun secret, token ou clé privée. Root production = \`null\`, les succès de lecture/attestation retournent \`authorized:false\`.
- Aucun nouveau workflow/dispatcher dans **cette** branche. La création des workflows V3 fait l'objet d'une PR **séparée** avec mode no-paid et garde d'exécution.
- Aucun envoi à OpenRouter. Même \`CLAIM_CHILD\` réussi est **un état durable**, pas le droit d'invoquer un modèle.
- Aucune mutation du ref global opérationnel, création de branche de vague ou commit via l'API live dans ce lot.
- Les cas de double CAS/reponse PATCH perdue sont qualifiés sur un transport HTTP GitHub **simulé**, pas sur des runners concurrents de production.

## Portes d'activation globale

Lire \`docs/factory/v3-trust-root-activation-plan.md\`. Restent :
1. Racine indépendante owner-approved, issuer, clé publique pin, genesis + checkpoint monotone.
2. RELEASE/QUARANTINE signés, preuve de terminal issue d'un journal réel et mise à jour globale atomique (actuellement \`ADMIT\` seul).
3. Workflows V3 owner et enfant dedicated, autorisation/permissions revues, workflow enfant V1 owner-only **non réutilisable**, preflight avant une étape paid.
4. Qualification GitHub App et concurrence réelle **sans paiement**, puis pilote 1 tâche expressément approuvé.

## Critères de sortie de la consolidation

- [x] Un seul chemin physique pour chaque module V3.
- [x] Tests Node des deux ensembles apportés à la même branche.
- [ ] CI indépendante sur le SHA final : actionlint, \`npm run check\`, OpenSpec.
- [ ] Revue code/source-diffs des PR originelles.
- [ ] Revue humaine spécifique avant chaque fusion ou activation, y compris changements de workflow.
