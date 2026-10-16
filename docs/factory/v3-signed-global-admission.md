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


## Durcissement : preuve durable et rejeu complet de l'historique signé

L'audit suivant a identifié une insuffisance initiale : le registre append-only conservait l'événement \`ADMIT\` mais ne conservait **pas** la signature Ed25519 ayant permis cet ADMIT. Une lecture ultérieure de \`registry.json\` pouvait donc certifier le rejeu des états et compteurs mais **pas** l'origine cryptographique de chaque admission. En présence d'un writer de ref abusif, un registre cohérent non signé pouvait paraître valide au lecteur.

Cette version propose désormais une écriture Git **à deux fichiers dans le même tree**, basée sur le tree parent :

| Chemin sous le ref global | Contenu |
|---|---|
| \`registry.json\` | État et événements complets, exclusivement append-only |
| \`admission-evidence/<waveId>.json\` | Payload d'admission exact et signature Ed25519 Base64 du justificatif, conservés sans secret privé |

Le ref de commit lu par \`observeGlobalAdmissionSnapshot(readClient, verificationKey)\` épingle **à la fois** le registre et chaque témoin historique. Le nouveau \`auditV3AdmissionWitnessChain\` :

1. Rejoue intégralement le registre V3 et refuse divergence.
2. Exige une clé publique Ed25519 fournie par le contexte de **confiance** (la politique réelle de pinning n'existe pas encore).
3. Pour chaque \`ADMIT\` depuis la genèse, charge \`admission-evidence/<waveId>.json?ref=<HEAD_SAME_SHA>\`.
4. Vérifie la forme fermée, la taille maximale de 4 KiB, le Base64 strict, UTF-8, puis la signature couvrant le claim exact, le dépôt et le ref global.
5. Refuse tout historique avec un témoin manquant, modifié, mal signé ou émis pour une autre vague ; le nombre de preuves relues est borné à 100 admissions. Au-delà : refus conservateur, procédure de migration et revue nécessaires.
6. Retourne seulement le statut \`signature_chain_verified\` avec \`authorized:false\`. **Il ne donne aucun droit de dispatch ou de paiement**.

Le read-back qui suit le PATCH exige désormais que l'état soit rejoué **et que les témoins de toutes les admissions historiques soient encore vérifiables** sous le nouveau HEAD. Une corruption de témoin après la mise à jour, un refus de GET ou une réponse perdue renvoie \`uncertain\` ou \`rejected\` sans retry automatique.

### Ce que ce durcissement ne résout pas

- La fonction pure \`replayAdmissionRegistry\` de #75 reste un validateur **de forme**, non une attestation d'origine. Aucun consommateur ne doit traiter \`replayAdmissionRegistry\` seul comme une autorisation.
- Le paramètre \`verificationKey\` est injectable pour la qualification, pas épinglé dans une racine de confiance de production. Une clé choisie par un agent ou un manifest pourrait valider une admission qu'il a lui-même signée. Le **P0 issuer/pinning/mandat propriétaire** demeure non résolu.
- La protection du ref global contre la réécriture ou le remplacement par un acteur externe est indispensable ; une signature n'assure pas à elle seule la conservation d'un historique dans Git.
- Une signature prouve seulement la possession de la clé privée. Un issuer indépendant doit d'abord établir le mandat propriétaire en vérifiant le run GitHub réel, ses inputs autorisés et la politique d'émission.
- Les événements \`RELEASE\`, \`QUARANTINE\` et les futurs événements de diagnostic nécessitent **leurs propres preuves et pouvoirs d'écriture**. Le module présent n'expose qu'\`ADMIT\`.
- Le témoin reste sur la même branche Git et au même SHA que le registre ; il s'agit d'une cohérence vérifiable et non d'un registre immuable hébergé par une autorité externe.

En conséquence : **la traçabilité est améliorée, mais l'activation V3 reste bloquée** jusqu'à approbation de l'issuer, de son ancre de clé, de l'initialisation du ref et des permissions.

### Durcissement de la libération non attestée

La vérification des seuls témoins `ADMIT` n'est pas suffisante : un writer abusif pourrait insérer un `RELEASE` de forme valide et des compteurs de fin inventés, ce qui rendrait `AVAILABLE` une vague non réellement livrée. **Le lecteur signé de cette version refuse donc tout événement autre que `ADMIT`** (`RELEASE`, `QUARANTINE`, `DIAGNOSTIC_NOTE`), même si le rejeu de la machine pure est correct. Cette restriction est volontaire : une future PR, avec décision propriétaire spécifique, devra créer et authentifier les preuves de clôture et de quarantaine avant de permettre ces transitions. Sans ce protocole, aucune seconde vague ne peut être ouverte après la première ; le prototype n'est pas exploitable comme ordonnanceur complet.

Un test adversarial construit un véritable successeur Git simulé portant un `RELEASE` non signé après une admission portant un témoin Ed25519 authentique : le nouvel instantané est refusé, et aucun second `PATCH` d'admission n'est émis.
