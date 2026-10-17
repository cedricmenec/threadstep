# ASF-V3-012 — Contrats de clôture et quarantaine liés au journal V3

**Statut : proposition de preuve cryptographique et de validation pure, sans writer global ni issuer réel.**
Branche distincte empilée sur l'intégration #83. Ne peut pas autoriser de nouvelles tâches.

## Pourquoi ce contrat est nécessaire

L'admission globale #75 accepte structurellement \`RELEASE\` avec un objet \`terminal\`, mais ses compteurs et son \`journalHash\` peuvent être forgés par un appelant. Le durcissement #77 refuse donc volontairement tous les événements non-ADMIT. Pour permettre une vraie clôture ou une quarantaine, il faut **lier cryptographiquement** l'intention au journal de vague intégralement rejoué et à des observations indépendantes de livraison/incident.

## Nouveau modèle proposé

\`scripts/asf/v3/global-terminal-evidence.mjs\` effectue la lecture/reconstruction **locale**, avec les vraies fonctions \`assertV3Manifest\`, \`reconstructV3Journal\`, \`replayAdmissionRegistry\` et \`advanceAdmissionRegistry\`.

La preuve Ed25519 (test synthétique uniquement) inclut \`kind\` RELEASE/QUARANTINE, \`waveId\`, \`manifestHash\`, \`globalHeadSha\`, \`waveHeadSha\`, \`journalHash\`, \`observationHash\`, \`reason\`, \`repository\`, une version et un domaine cryptographique séparé. La signature d'une autre vague, d'un autre HEAD global ou d'un autre journal ne peut pas être réutilisée.

| Contrat proposé | Condition métier minimale | Condition de confiance ENCORE MANQUANTE |
|---|---|---|
| \`RELEASE\` | \`COMPLETED_QUOTA\` ou \`COMPLETED_NO_WORK\` ; aucun travail actif ; \`reserved = delivered\` ; replay valide | Preuve des PR/merges/checks/Pages depuis l'API GitHub, **observée par issuer indépendant**, puis signature et CAS global |
| \`QUARANTINE\` | Vague en \`STOP_FAILED\` ou \`STOP_UNCERTAIN\`, motif strict ; replay valide | Preuve de l'incident/du run par source indépendante, signature d'une autorité owner, et CAS global |
| \`DIAGNOSTIC_NOTE\` | Interdit | Protocole et autorisation owner spécifiques |
| Sortie de quarantaine | Interdite | Nouvelle approbation explicite owner, jamais recovery silencieux |

\`inspectV3GlobalTerminalCandidate\` renvoie \`consistent_not_authorized\` si et seulement si la **forme**, le journal, le registre, les SHA et la signature synthétique correspondent. En toute circonstance : \`authorized:false\`, \`canRelease:false\`, \`canQuarantine:false\`, \`canSpend:false\`. Le hash d'observation fourni ne prouve pas l'existence d'une observation réelle : sa source doit être qualifiée et protégée par le futur issuer.

### Décisions restant explicitement bloquantes

1. L'émetteur indépendant doit **vérifier lui-même** l'observation des livraisons / échecs, puis signer. Le simple hash de l'agent ne suffit pas.
2. Stocker les permis RELEASE/QUARANTINE signés avec \`registry.json\` en un seul tree Git, étendre le lecteur de témoins #77 et l'audit d'ascendance #81. Tant que ce contrôle n'est pas livré, #77 bloque **toutes** les transitions non-ADMIT.
3. Étendre le writer CAS global pour passer de ACTIVE à AVAILABLE/QUARANTINED et prouver la parentalité du commit, le témoin signé et le HEAD stable ; **aucun retry en cas de réponse ambiguë**.
4. Conserver la quarantaine indéfiniment après un STOP ou une incertitude. Ne pas démarrer une vague suivante avant RELEASE nominal indépendant et ancré.
5. Réaliser les essais GitHub App réels sans paiement, après approbation des permissions.
6. Maintenir le mutex payé V1/V3 et le plafond 1..10 comme mesures indépendantes.

**Cette PR fait avancer le protocole des preuves, mais ne l'active pas ni ne ferme à elle seule le blocage G3.**
