# ASF V3 — Plan final d'ancrage de confiance et portes d'intégration

**Statut (17 octobre 2026) : contrat de racine de confiance préparé, racine réelle NON configurée. Aucune activation.**
Travail dans [PR #81](https://github.com/cedricmenec/threadstep/pull/81), dépendance [#79](https://github.com/cedricmenec/threadstep/pull/79), [#77](https://github.com/cedricmenec/threadstep/pull/77), [#75](https://github.com/cedricmenec/threadstep/pull/75).

## Réponse opérationnelle

**On peut démarrer immédiatement une branche d'intégration V3 non payante**, en combinant les modules précédents, sans toucher aux workflows ni à main. **On ne peut pas lancer une vague V3 payante.** Il reste six portes ci-dessous, dont certaines demandent une décision humaine de sécurité et des essais GitHub réels.

La sécurité ne doit pas être évaluée au **nombre de PR** ou au nombre de tests seulement. Les tests actuels utilisent principalement des transports GitHub simulés. La vraie autorité propriétaire, la protection du registre, l'issuer Ed25519 et les changements de workflows n'existent pas.

## État réel des protections, constat à date

Lecture **read-only** du ruleset GitHub #25163425 « Protect Main » :
- \`enforcement: active\`, cible \`refs/heads/main\` ; bypass list vide dans le résultat ;
- interdiction des suppressions et non-fast-forward ;
- passage par PR et contrôle indépendant \`check\` requis ;
- \`required_approving_review_count: 0\`.

Ce ruleset protège certaines écritures mais **n'impose pas la revue indépendante d'une nouvelle clé de confiance ni la validation par le propriétaire des fichiers sensibles**. Le droit d'une GitHub App sur le **ref global V3** n'est pas établi par le seul ruleset \`main\` ; un second contrôle de permission et de protection est obligatoire. L'API \`GET /branches/main/protection\` a renvoyé 403 dans ce contexte de consultation : on ne doit pas extrapoler à d'autres règles cachées.

Un dépôt administré par un seul propriétaire peut avoir besoin d'une **approbation out-of-band et d'un pin indépendant**, plutôt que d'exiger simplement un reviewer GitHub impossible à obtenir. Le mécanisme doit être défini et audité avant activation, pas improvisé par le runner.

## Implémentation actuelle : production désactivée par construction

\`scripts/asf/v3/production-trust-root.mjs\` devient l'interface prévue d'observation de la racine **en production** :

- \`PINNED_PRODUCTION_ROOT = null\` : aucune clé ni SHA d'autorisation n'est créée ou acceptée.
- \`auditConfiguredV3ProductionTrustRoot({readClient})\` **ne prend pas de paramètre** \`trustedAnchor\`, \`verificationKey\`, \`ownerApproved\` ou \`issuer\`. Ces valeurs ne peuvent pas être dictées par un prompt, un input workflow ou un fichier non fiable. Tant que la configuration est \`null\`, la fonction renvoie \`disabled\` sans même effectuer de requête GitHub.
- \`inspectV3PinnedRootCandidate(candidate)\` vérifie uniquement la **forme** d'une future configuration, en particulier l'empreinte SHA256 SPKI Ed25519, l'identité du dépôt/ref et le checkpoint. Il renvoie \`well_formed_untrusted_candidate\`, avec **tous les droits à false** : un candidat valide ne constitue pas une approbation.
- \`inspectV3MainTrustRuleset(ruleset)\` évalue une observation des règles de branche ; si aucune revue de PR n'est obligatoire, il renvoie \`owner_review_required\` ; une revue obligatoire ne suffit pas à produire une confiance cryptographique.

La configuration statique \`null\` est volontaire. Une future PR owner-approved doit **modifier ce code protégé** pour fournir la clé publique approuvée et l'ancre exacte, après mise en place du publisher de confiance et vérification du ref global. Aucun secret ou clé privée ne doit être commité. Les valeurs compilées doivent provenir d'une source de confiance hors de l'agent ; **mettre un PEM public dans le code ne crée pas à lui seul l'autorité owner**.

### Paramètres exacts à approuver pour l'ancre initiale

| Champ à épingler | Origine que l'owner doit faire auditer | Test |
|---|---|---|
| \`publicKeyPem\` | clé publique Ed25519 générée **pour l'issuer indépendant** | empreinte DER SPKI SHA256 approuvée |
| \`genesisSha\` | commit du registre initial vide, créé par writer de confiance après accord | GET Git commit + parents |
| \`sourceSha\` | SHA exact de \`main\` sélectionné, non une étiquette mutable | parent unique de la genèse |
| \`checkpointSha\` | dernier commit global enregistré **par mécanisme indépendant monotone** | ne peut pas reculer |
| \`checkpointRegistryHash\` | SHA256 canonique du snapshot relu au checkpoint | compare au registre relu |
| \`verificationKeyFingerprint\` | empreinte de la clé publique **déjà approuvée** | interdit la substitution de clé |
| \`repository\`, \`ref\` | valeurs constantes de politique | toujours \`cedricmenec/threadstep\`, \`refs/heads/asf/control/active-wave-v3\` |

**Ce qui doit être approuvé hors de cette PR** : personne/compte autorisé à émettre, processus de génération et garde de clé privée, identité GitHub App et permissions minimales, preuve des inputs owner, bootstrap initial avec journal vierge, auteur du writer et contrôle sur le ref global, mécanisme de checkpoint monotone, révocation/rotation. Un succès de test avec une paire de clés en mémoire n'est pas un remplacement de ces décisions.

## Six portes avant V3 opérationnelle

| Porte | Travail concret | État au 17/10 |
|---|---|---|
| G1 — consolidation | Revoir #66–#81, choisir l'ordre, éviter les fichiers dupliqués de #73, constituer une branche d'intégration cohérente et revalider CI | **Ouvert** : 6 PR V3 ouvertes (#66–#68, #83, #85, #87) ; 9 PR de code historiques clôturées sans fusion |
| G2 — confiance | Issueur owner autorisé, capture des inputs #79, clé publique épinglée, genèse/checkpoint #81, protection des refs et anti-rollback | **Bloquant**, contrat prêt, ancre réelle absente |
| G3 — protocole global | Writer CAS global + bootstrap Git, preuves pour \`RELEASE/QUARANTINE\` et incidents, une seule vague à la fois | **Bloquant**, seul \`ADMIT\` simulé |
| G4 — contrôleur/exécuteur | Workflows V3 autorisés, enfant compatible bot App, owner inputs réels, \`CLAIM_CHILD\` avant paiements, groupe \`threadstep-paid-development-v1\` | **Bloquant**, aucun workflow V3 actif |
| G5 — preuves et GitHub réel | Runs App non payants, concurrence vraie, dispatch ACK, CAS global/waves, permissions limitées, PR/CI/main/Pages vérifiés et erreur de réponse perdue | **Non réalisé en bout en bout** |
| G6 — pilote payant | Après accord explicite du propriétaire, vague **1 tâche**, coût surveillé, incident fail-closed, puis 2 et jusqu'à 10 seulement après preuve complète | **Interdit sans autorisation distincte** |

**Ordre recommandé** : commencer G1 immédiatement en code et tests sans paiement, décider G2 avec le propriétaire, construire G3 et G4 en PR sensibles séparées, qualifier G5 sans paiement, puis seulement autoriser G6. Les portes G2/G3/G4 sont des **conditions bloquantes**, et non des améliorations optionnelles.

### Différence entre coder et activer

- **Lancement de l'implémentation globale** = brancher des modules sous une nouvelle branche de revue, composer des tests d'intégration, documenter les interfaces et simuler des runs. Cela **ne nécessite pas de clé privée, de workflow V3, ni de dépense**. Peut démarrer dès maintenant.
- **Lancement du système V3 live** = création/protection du registre et des branches de vagues, signature d'un mandat owner, délégation de droits, jobs GitHub App et potentiellement OpenRouter. **Ne pas commencer** tant que les six portes ne sont pas franchies et que les changements sensibles ne sont pas owner-approved.

## Décision propriétaire minimale à obtenir plus tard

Ne pas solliciter le propriétaire pour inventer une clé, fournir un token dans le chat ou lancer OpenRouter. La décision structurante est : **approuver ou non un émetteur séparé avec sa propre identité et clé privée, ainsi qu'un mécanisme externe de pin/checkpoint**, et autoriser dans une PR distincte les permissions/protections nécessaires.

Tant que le mécanisme d'approbation de l'ancre n'est pas décidé, le fail-closed doit rester effectif ; ce n'est pas un retard logiciel qu'un assistant peut résoudre en signant arbitrairement son propre mandat.

## Qualification

\`tests/asf-v3-production-trust-root.test.mjs\` vérifie que la production est \`disabled\` même lorsque l'appelant fournit un faux root et une fausse clé, qu'un candidat de configuration auto-signé est toujours non autorisant, et que les règles observées de \`main\` nécessitent une validation propriétaire supplémentaire.

**Cette PR n'installe aucune configuration, clé, secret, GitHub App, workflow, protection ou branche opérationnelle.**
