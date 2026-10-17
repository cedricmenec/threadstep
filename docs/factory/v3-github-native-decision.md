# ASF V3 — décision GitHub-native (17 octobre 2026)

**Décision de produit confirmée par le propriétaire : simplifier la sécurité.**
Les signatures Ed25519, l'émetteur dédié, le pinning de clé et le checkpoint externe ne sont plus des prérequis V3. GitHub Actions, les runs propriétaire, les règles de protection Git et les permissions séparées forment la **racine de confiance** retenue.

Le but n'est pas d'empêcher absolument un deuxième appel facturé quelques centimes : il est de prévenir **10 à 100+ démarrages incontrôlés**, les vagues concurrentes et les reprises sans preuve.

## À garder

- Démarrage explicite par le propriétaire via workflow_dispatch V3 sur main, choix du modèle, du quota 1–10, auto-merge, SHA backlog et candidats figés.
- Séparation entre le **contrôleur GitHub Actions propriétaire** et **l'agent enfant** ; ce dernier ne doit jamais pouvoir changer le mandat original, créer un ref global, ni créer ou modifier des règles de protection.
- Registre global sur ref GitHub **refs/heads/asf/control/active-wave-v3**, JSON avec révision/état/historique. Une seule vague ACTIVE, arrêt sur QUARANTINED.
- Un **journal de vague**, manifest et journal au même commit SHA, quota de démarrages persisté avec CAS Git Data fast-forward. Une interruption ambiguë est STOP, jamais un retry de dépense automatique.
- Groupe job-level **threadstep-paid-development-v1** partagé V1/V3 **uniquement si un job V3 payant est ajouté plus tard**, cancel-in-progress:false, et préflight avant toute clé OpenRouter.
- Des limites d'exécution concrètes (temps maximal, nombre de tours/appels modèle) à préparer avant le pilote payant, même si le plafond de dollars peut venir plus tard.
- Vérification indépendante merge/CI/main/Pages et de l'incident avant RELEASE/QUARANTINE.

## Ce qui est supprimé du chemin V3

- Émetteur Ed25519, clé privée, rotation, empreinte SPKI, validation des témoins signés et ancre de genèse cryptographique.
- Service de checkpoint externe.
- Toute demande de clé secrète au propriétaire dans ChatGPT.

Les **historiques cryptographiques** restent dans les anciennes PR closes pour audit. Les fichiers cryptographiques sont supprimés de la branche intégrée courante, pour éviter deux architectures simultanées.

## Bootstrap : une seule fois par dépôt, sans cryptographie

1. L'owner installe et vérifie les **protections de la branche globale**, dont anti-suppression, anti-force push et restriction des mises à jour à **une identité App contrôleur** distincte de l'agent, avec permissions minimales.
2. Dans un workflow de confiance propriétaire sur **main**, le bootstrap (à implémenter) vérifie que le ref global est **absent**, crée un commit Git avec le registre vierge \`createAdmissionRegistry()\`, puis crée le ref **une seule fois**. Si le ref existe, il vérifie sa structure et **ne le remplace jamais**. Tout 403/409/422 ou réponse ambiguë doit être inspecté, sans nouvelle création automatique.
3. Chaque vague crée son propre \`manifest.json\` et \`journal.json\` à une branche \`asf/waves/<waveId>\`. Le contrôleur enregistre ADMIT par CAS du ref global.
4. RELEASE n'est autorisé qu'après observation indépendante de livraison, puis écriture CAS du registre. QUARANTINE bloque tout nouveau démarrage et requiert décision manuelle de résolution.

Dans la branche actuelle, \`planV3GithubBootstrap\` est **un plan en lecture seule**, pas un créateur de ref. Aucun bootstrap live effectué.

## CAS : une écriture gagnante, pas une transaction magique

Le writer global \`attemptV3GithubNativeAdmission\` est isolé : il recharge le run propriétaire, le ref global, les règles GitHub et le registre au même SHA, calcule ADMIT, crée tree/commit enfant du HEAD et tente **PATCH Git ref force:false**. Un concurrent sur une même tête ne peut pas aboutir en fast-forward ; une réponse perdue donne \`uncertain\`, jamais un retry automatique.

**Une réussite du writer reste une preuve de persistance, pas une autorisation de payer.** L'agent enfant aura encore besoin de CLAIM_CHILD CAS, de l'ACK du run, du mutex payant et de l'absence de retry.

## Protection GitHub indispensable

La vérification \`observeV3GithubNativeControl\` observe :
- propriétaire et inputs du run réel récupéré à son ID GitHub ;
- règles main PR + required check + anti-force push ;
- une règle de la branche **globale** empêchant suppression, non-fast-forward et modifications hors de l'App writer désignée ;
- état du registre exact depuis le commit HEAD et relecture du ref.

Son résultat nominal est \`consistent_not_authorized\`, même en simulant des protections parfaites. **C'est le workflow lui-même, une identité App réellement restreinte et les règles GitHub configurées qui constituent la sécurité ; un test avec un readClient factice ne peut pas les authentifier.**

Le ruleset main actuel est actif et exige PR+CI mais **n'a pas de reviewer obligatoire** ; c'est un compromis assumable pour un mainteneur unique. Aucun ruleset global ni App writer correspondant n'a été vérifié comme installé à ce stade. Ils nécessitent encore configuration réelle/approbation au niveau dépôt.

## Étapes exactes avant activer V3 payante

| Phase | À réaliser | État |
|---|---|---|
| 1. Consolidation | Garder une seule PR intégrée, enlever modules Ed25519 et mettre la CI au vert | En cours |
| 2. Contrôleur GitHub | Implémenter l'owner workflow qui capture directement les six inputs et peut initialiser/mettre à jour le registre avec une App **contrôleur uniquement** | Prototype CLI inerte |
| 3. Protection réelle | Configurer règles refs/global, scope des tokens App, séparation contrôleur/enfant, branche main protégée | Non approuvé/non configuré |
| 4. Terminal CAS | Utiliser journal de vague PINNÉ et preuves GitHub livraison/incidents dans writer RELEASE/QUARANTINE, avec CAS et stop sûr | Validation pure uniquement |
| 5. Enfant payé | Dispatch ACK, CLAIM_CHILD CAS, même mutex V1, no-retry payé, limites temps/tours | Workflows inertes |
| 6. Essais réels | Tests d'intégration GitHub App sans paiement (deux runs, perte PATCH, bootstrap, fermeture de vague) | Non exécutés |
| 7. Pilote | Accord propriétaire pour **1 tâche** payante, puis extension progressive au plafond 1–10 | Non autorisé |

**Le travail logiciel peut continuer dès maintenant. Une exécution V3 autonome et payante est encore bloquée.**
