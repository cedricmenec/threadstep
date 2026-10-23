# ASF-V3-014 — Qualification du bootstrap et de la livraison (read-only)

**Statut : PR d'intégration non payante et sans permission de mutation.**
Base : V3 GitHub-native consolidée [#87](https://github.com/cedricmenec/threadstep/pull/87).
Tracking de l'acte owner : [#86](https://github.com/cedricmenec/threadstep/issues/86).

## Contrôles effectivement implémentés

### 1. Bootstrap — aucune création automatique

La nouvelle fonction \`observeV3GithubBootstrapReadiness({readClient,expectedMainSha})\` :

1. Relit les **vrais rulesets GitHub** complets avec les règles V3 existantes (protection de \`main\`, protection du ref V3, un seul bypass Integration).
2. Exige que le ref \`main\` pointe vers le SHA attendu du contexte de confiance owner. Aucune validation ne se fonde sur le SHA d'un manifest choisi par l'agent.
3. Interroge \`refs/heads/asf/control/active-wave-v3\`. Un GET 404 produit seulement \`absent_observed_untrusted\` : **404 peut masquer une permission refusée**.
4. Si le ref existe, lit \`registry.json\` au SHA exact et rejoue le registre. Un registre vide produit \`already_initialized_untrusted\`, non une permission de recréation. Un historique quelconque, notamment actif/quarantiné, produit \`existing_history_stop\`. Un JSON invalide provoque un arrêt.
5. Relit \`main\` et le ref global pour découvrir une modification pendant l'observation.

Les résultats sont **toujours non autorisants**, y compris un bootstrap absent observé deux fois. Il n'existe **aucun** POST/PATCH dans cette fonction, aucun token, aucune création de branche/ref et aucun fallback d'erreur ambiguë.

Attention : un GET cohérent ne remplace pas la garantie server-side apportée par un ruleset réel et des permissions App restreintes. Les tests simulent GitHub ; ils ne démontrent pas que l'App est installée.

### 2. Livraison — preuve indépendante mais aucune RELEASE

La nouvelle fonction \`observeV3GithubDelivery({readClient,prNumber,expectedHeadSha})\` :

1. Relit les règles GitHub main et global, au lieu de faire confiance à un booléen \`branchProtected\` fourni par le modèle.
2. Vérifie la PR GitHub exacte : fusionnée et fermée vers \`main\` dans le bon dépôt ; SHA de HEAD identique au SHA épinglé dans le **journal V3** ; SHA de fusion exact.
3. Confirme par \`GET compare/<mergeSha>...<mainSha>\` que le commit fusionné reste ancêtre de main.
4. Exige un \`check\` GitHub Actions réussi et **unique** sur le HEAD de la PR et sur le SHA de merge. Rejette les check-runs incomplets ou dupliqués, y compris les jeux de résultats paginés non traités.
5. Lit les runs Pages à \`head_sha=<mergeSha>\`, exige un unique run \`push\` sur main, réussi au premier attempt, sur la source \`.github/workflows/pages.yml\`. Relit les jobs et exige un job \`deploy\` réussi au SHA exact.
6. Relit \`main\` pour rejeter une course détectée.

Le résultat nominal, \`delivery_observed_not_authorized\`, contient la preuve compatible avec l'événement \`DELIVERED\` du noyau V3 et son hash canonique. **Le writer doit encore recharger le manifest et le journal de vague au commit Git exact**, lier cette preuve au taskId / PR de la réservation et persister le journal via CAS, puis seulement envisager un CAS du registre global. Un simple \`proofHash\` ne prouve rien. Une exécution Pages réussie ne prouve pas que le site est actuellement accessible.

Pour \`COMPLETED_NO_WORK\`, aucune PR n'existe : ce cas terminal requiert un traitement séparé fondé sur un journal de vague vide et vérifié. Ce lot n'accorde pas automatiquement RELEASE et ne traite pas la quarantaine.

## Qualification négative

Tests Node simulés : ruleset global manquant, absence ambiguë (403/503), 404 observé sans autorisation, histoire existante à ne pas réinitialiser, corruption de registre, changement de ref pendant une lecture, PR étrangère, HEAD différent, CI SHA incorrect/dupliqué, app de check étrangère, commit fusion non-ancêtre, workflow Pages incorrect/rejoué, job deploy manquant/échoué, pagination incomplète et exception API.

Les modules ne savent ni émettre un mandat owner, ni accéder à un secret, ni dispatcher, ni payer.

## Étapes dans l'ordre pour rendre V3 intégrable et activable

| Ordre | Résultat | Qui / autorisation | État |
|---|---|---|---|
| A | Finaliser contrat GitHub-native et sécurité de #87 + #V3-014 | Revue/tests sur PR brouillon | Implémentation read-only |
| B | Installer l'**App contrôleur** avec scope minimal, séparée de l'enfant ; bloquer toute modification du ref V3 hors App | **Owner / administrateur GitHub** | Non effectué |
| C | Ruleset exact de ref : anti-deletion, anti-force-push, restriction des mises à jour, seul bypass de l'App contrôleur ; tests de refus avec identité agent | **Owner / administrateur GitHub** | Non effectué |
| D | Bootstrap du registre vierge une fois, dans workflow owner sur main, via App contrôleur ; aucun overwrite ni retry ambigu | **Autorisation distincte owner** | Non effectué (observateur seulement) |
| E | Lier la preuve DELIVERY au journal de vague Git épinglé ; writer terminal CAS RELEASE/QUARANTINE avec preuve indépendante | PR non payante / tests de contention | Restant |
| F | Lier dispatch, ACK, CLAIM_CHILD, quota, no-retry, mutex V1/V3 et plafonds temps/tours | PR non payante / tests de contention | Restant |
| G | Essais GitHub réels sans paiement et revue de workflow privilégié | **Owner** pour droits | Restant |
| H | Autorisation séparée pour 1 première tâche payante, puis extension 1–10 | **Owner** | Non autorisé |

## Actes attendus de l'owner

À ce stade, **aucun secret à communiquer dans ChatGPT**. L'owner doit :
- examiner les diffs de sécurité de #87 et de la PR de ce lot ;
- confirmer l'identité de l'App contrôleur (App ID GitHub), son installation et ses droits minimaux ;
- configurer puis constater le ruleset V3 et ses restrictions GitHub dans l'interface, avec un test de refus de l'identité enfant ;
- autoriser **séparément** l'écriture de genèse quand le workflow owner non payant aura été audité, puis les droits des writers/dispatchers ;
- n'autoriser un premier appel OpenRouter que lorsque les scénarios E2E réels sans paiement seront verts.

L'approbation de la conception GitHub-native ou le présent message ne constitue **pas** une approbation implicite des permissions, du merge, du bootstrap live ni d'un paiement.

**Aucun workflow V3 modifié, aucun secret ou jeton configuré, aucun ref opérationnel créé, aucun merge, aucun dispatch et aucun appel payé.**
