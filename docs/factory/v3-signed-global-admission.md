# ASF V3 : admission signée sur registre global à CAS Git

**Prototype, non actif.** [Tâche ASF-V3-008](tasks/ASF-V3-008.md) et [base de PR #75](https://github.com/cedricmenec/threadstep/pull/75). Cette conception suit le [rapport de sécurité croisé](v3-cross-pr-security-review.md) de #73 mais ne le remplace pas.

## Contrat métier

L'owner autorise **au maximum une vague V3 active dans le dépôt**. Cette admission précède la création du journal opérationnel \`asf/waves/<waveId>\`, qui possède sa propre réservation CAS ; une admission globale n'est ni une réservation payante ni un droit de dispatch.

\`attemptSignedGlobalAdmission\` réalise une seule transition \`ADMIT\` de la politique pure V3-007. Il refuse toute nouvelle admission si le registre contient déjà une vague \`ACTIVE\` ou \`QUARANTINED\`, y compris si le projet suivant a d'autres tâches, un autre modèle ou un autre run. L'historique empêche la réutilisation d'un \`waveId\` libéré.

Ce module n'implémente pas \`RELEASE\`, \`QUARANTINE\` ou les séquences de récupération : leur sûreté dépend du rejeu réel du journal de vague, du diagnostic owner en cas d'incident et d'une permission explicitement revue.

## Preuve par signature : ce qu'elle garantit

Un justificatif de bootstrap a deux champs stricts \`payload\` et \`signature\`. Le payload canonique contient les huit propriétés suivantes :

| Champ | Exigence |
|---|---|
| \`version\` | \`1\` |
| \`purpose\` | \`asf-v3-admit-one-wave\` |
| \`repository\` | \`cedricmenec/threadstep\` |
| \`registryRef\` | \`refs/heads/asf/control/active-wave-v3\` |
| \`waveId\` | identifiant strict de la vague |
| \`manifestHash\` | SHA256 canonique du manifeste immuable |
| \`ownerRunId\` | run owner GitHub initial |
| \`originSha\` | SHA40 du source main initial |

La signature Ed25519 couvre \`"ThreadStep ASF V3 signed admission v1\n" + canonicalize(payload)\`, encodé en UTF-8. Le préfixe sépare les usages de signature et réduit le risque qu'une signature valide pour une autre fonction soit réutilisée. Un justificatif illisible, une signature non canonique, une mauvaise clé, un claim divergent, une version inattendue ou un mauvais ref provoquent \`rejected\` **avant toute mutation Git**.

**Limite P0 : la clé de vérification n'est pas épinglée dans ce dépôt, car il n'existe pas encore d'émetteur propriétaire approuvé.** Le code exige une clé injectée par un composant de confiance (non implémenté). Les tests créent des clés éphémères, mais **ce ne sont pas des credentials de l'owner**. Une clé publique choisie par l'agent, la branche, les inputs ou le manifest permettrait de forger une signature suffisante pour le prototype et n'établirait aucune autorisation owner.

L'issuer futur doit vérifier le run initial **par l'API GitHub**, le propriétaire, le workflow V3 attendu sur main, le \`runAttempt=1\`, le code source et manifeste exacts, l'exclusivité des droits sur le ref et le consentement humain, avant de signer. La signature ne prouve pas d'elle-même que ce contrôle a eu lieu. Il faut un lien d'attestation **indépendant** entre l'identité du publisher et la branche initiale de vague.

## Protocole d'écriture au registre global

Le code n'utilise qu'un ref global, jamais un ref distinct par waveId :

\`\`\`text
  signature Ed25519 validée avec clé de confiance
                 |
  GET git/ref/heads/asf/control/active-wave-v3  -> H
                 |
  GET contents/registry.json?ref=H -> replay intégral
                 |
  avance ADMIT, vérifie quotas / historique / état
                 |
  relit ref H puis GET git/commits/H -> tree T
                 |
  POST git/trees (base_tree T, registry.json seul)
                 |
  POST git/commits (parents: [H], tree nouveau)
                 |
  PATCH git/refs/heads/asf/control/active-wave-v3
       { sha: C, force: false }
                 |
  GET ref + registry @ C + commit C,
  vérifier état, hash, parent H et tree
                 |
      persisted OU conflict/uncertain, sans retry
\`\`\`

Toutes les requêtes sont produites par un transport \`writeTransport({method,path,body})\` injecté et un client GitHub **lecture seule** \`readClient.get(path)\`. Pas d'accès réseau, secret ou token intégré dans le module. Aucun changement de workflow, ni de permissions GitHub App.

Le REST GitHub Git refs PATCH avec \`force:false\` impose le **fast-forward** et non un paramètre \`expected_sha\`. La création de commits à parent unique H transforme deux writers concurrents en commits frères ; **un seul** peut fast-forwarder. Les objets Git détachés de l'écriture perdante peuvent exister et ne comptent pas comme une admission validée. Un code 422/409 au PATCH devient \`conflict\`, mais les erreurs génériques, la réponse perdue ou un read-back divergent deviennent \`uncertain\`. **Aucun retry automatique, aucune dépense et aucun autre waveId** dans ces cas.

### Limites opérationnelles

- Le ref global n'a pas été créé et son writer ne possède pas de GitHub App token ; un ref manquant est \`uncertain\`, **jamais** recréé automatiquement.
- Aucune preuve cryptographique n'atteste actuellement le mandat d'un owner au-delà de l'essai local avec clés éphémères.
- Ce module n'empêche pas un writer malveillant de déplacer un ref non protégé ; la protection de branche et la séparation des identités App sont indispensables.
- CAS inter-vagues ne remplace pas le mutex \`threadstep-paid-development-v1\` des jobs V1/V3 ni \`CLAIM_CHILD\` sur chaque vague.
- Un succès \`persisted\` atteste un état sur le ref **selon le transport et les réponses reçues**, pas la livraison d'une tâche, et **ne donne pas accès à OpenRouter**.
- La livraison, la sortie de quarantaine, la régénération de mandat et les migrations de versions nécessitent de nouveaux contrats et une décision owner.

## Tests automatisés

\`tests/asf-v3-signed-global-admission.test.mjs\` emploie des paires Ed25519 synthétiques et un Git REST simulé : validité cryptographique, altération du reçu, mauvaise clé, réussite d'une admission, refus d'une deuxième, **deux commits frères simultanés**, réponse PATCH perdue, API GitHub indisponible, mauvais ref, erreur écriture et interdiction d'autres endpoints.

Ils valident une séquence de **logique applicative** en mémoire, pas un déploiement effectif sur GitHub ni un issuer réel.

## Conditions de sortie / revue des permissions

1. Consentement explicite séparé pour la création/protection de \`asf/control/active-wave-v3\` et la chaîne issuer/génèse.
2. Publier une politique d'émission indépendante de l'agent, une clé de vérification **épinglée et revue**, une rotation avec nouvelle politique et révocation des permis compromis.
3. Qualifier non-payant les vrais endpoints et les permissions App sur un ref sandbox isolé, sans déverrouiller les refs opérationnels.
4. Raccorder le CAS global et la branche par vague aux vrais runners, avec \`stop\`/quarantaine en cas de réponse ambiguë et aucune relance payante.
5. Faire revue et fusion distinctes des PR de fond puis rebaser cette PR empilée ; revalider SHA exact.
6. Ne modifier aucun workflow sans accord owner spécifique, et ne lancer aucun appel OpenRouter pendant la qualification.

**Décision actuelle : prototype en PR Draft, utilisation opérationnelle interdite.**
