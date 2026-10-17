# ASF V3 — Genèse et checkpoint Git du registre global

**État : audit déterministe READ-ONLY, aucun fonctionnement live.**
Tâche [ASF-V3-010](tasks/ASF-V3-010.md), base de travail empilée sur [#79](https://github.com/cedricmenec/threadstep/pull/79), [#77](https://github.com/cedricmenec/threadstep/pull/77), [#75](https://github.com/cedricmenec/threadstep/pull/75).

## Ce qui manquait après #77 / #79

La PR #77 vérifie désormais une signature Ed25519 en même temps que le registre append-only, et #79 compare les inputs du propriétaire et l'identité exacte du run. **Aucun de ces contrats ne garantit encore que l'identifiant de la branche Git pointe vers une genèse approuvée** : un auteur capable de déplacer le ref pourrait substituer une histoire complète, contenant des témoins valablement signés par une **clé qu'il choisit lui-même**. Une validation des champs seule ne protège pas contre cette substitution.

Un second risque est la **régression d'état** : si le ref est réécrit vers le commit genèse initial, la première admission disparaît du HEAD. Sans état externe monotone, l'agent pourrait croire le registre à nouveau libre. La clé du problème n'est pas le hash Git (qui identifie un contenu), mais **l'origine indépendante des valeurs censées être de confiance**.

## Contrat d'ancrage proposé

\`auditV3AnchoredGlobalRegistry({readClient, verificationKey, trustedAnchor})\` lit GitHub sans écrire. \`trustedAnchor\` doit avoir **exactement** les champs suivants :

| Champ | Sens et limite |
|---|---|
| \`version\` | contrat de l'ancre, fixé à \`1\` |
| \`repository\` | dépôt fixé \`cedricmenec/threadstep\` |
| \`ref\` | \`refs/heads/asf/control/active-wave-v3\` exactement |
| \`genesisSha\` | commit initial du registre vide, choisi et épinglé hors de l'agent |
| \`sourceSha\` | commit main dont la genèse doit descendre directement |
| \`checkpointSha\` | dernier HEAD déjà reconnu par la racine de confiance, jamais emprunté à l'agent |
| \`checkpointRegistryHash\` | SHA256 canonique du registre sur le checkpoint de confiance |
| \`verificationKeyFingerprint\` | SHA256 des octets DER SPKI de la **clé publique Ed25519** approuvée |

La clé publique est fournie séparément à la fonction pour la qualification. Le fingerprint ancré est comparé à la véritable représentation SPKI de la clé. Les chaînes PEM de clé privée et les objets \`KeyObject\` privés sont explicitement refusés. **Une clé publique choisie par l'appelant ne devient pas approuvée parce que son fingerprint correspond à un champ choisi par le même appelant.**

### Séquence de vérification

\`\`\`text
Source de confiance future, approuvée par owner
    fournit genesisSha + sourceSha + checkpointSha + hash + clé épinglée
              │
              ▼
V3-008 : GET ref global / registry @ HEAD / witnesses @ HEAD
    -> rejeu et signatures valides, sinon STOP
              │
              ▼
V3-010 : GET commit genesisSha -> parent DOIT être sourceSha
    -> GET registry.json?ref=genesisSha
    -> doit correspondre EXACTEMENT au registre vide canonique
              │
              ▼
Si HEAD == genesisSha : checkpoint DOIT être genesisSha
Si HEAD != genesisSha : GET HEAD -> parent DOIT être genesisSha
    -> registry: 1 seul ADMIT et état ACTIVE
    -> checkpoint DOIT être genesisSha ou HEAD
              │
              ▼
Hash checkpoint = hash du registre à ce SHA
    -> relire ref global -> HEAD identique
              │
              ▼
consistent_untrusted_anchor (authorized:false)
\`\`\`

Une branche avec un troisième commit, même contenant un registre valide, est refusée. Ce choix résulte de la version **ADMIT-only** de #77 : les libérations, la quarantaine, les migrations et les diagnostics n'ont pas encore leurs propres preuves. Un futur protocole devra remplacer ce graphe à 2 commits maximum par un historique authentifié plus complexe et justifier chaque écriture.

Le contrôle de checkpoint empêche de revenir à la genèse **si un checkpoint post-admission a été enregistré et épinglé ailleurs**. Sans ce stockage externe monotone, le retour arrière **n'est pas détectable par le seul état fourni à la fonction**. Même avec un checkpoint externe, une lecture « HEAD inchangé à l'instant t » n'est pas un verrou entre deux jobs.

## API, permissions et sécurité

Le module n'emploie que les lectures :
- \`GET repos/cedricmenec/threadstep/git/ref/heads/asf/control/active-wave-v3\` ;
- \`GET repos/cedricmenec/threadstep/git/commits/<SHA>\` ;
- \`GET repos/cedricmenec/threadstep/contents/registry.json?ref=<SHA>\` ;
- et les lectures SHA-pinnées des témoins Ed25519 déjà implémentées dans #77.

Il n'a aucun \`fetch\`, aucun exécuteur CLI, aucune API de mutation et ne connaît pas de token. L'origine du client injecté doit être contrôlée indépendamment, tout comme l'origine de l'ancre. Une erreur de transport, un ref mobile pendant la lecture, une corruption de commit, une génèse non vide, un checkpoint non sur l'historique permis ou une signature absente entraîne \`uncertain\` ou \`rejected\` **sans reprise automatique**.

Aucun succès de cette fonction ne permet \`canSign\`, \`canDispatch\` ou \`canSpend\`. Le résultat positif s'appelle délibérément \`consistent_untrusted_anchor\` et expose seulement un hash du registre et les SHA observés. Il ne prouve **pas** l'approbation owner, le pinning effectif de la clé ou l'existence d'un ref protégé en production.

## Tests et sortie

\`tests/asf-v3-registry-ancestry-audit.test.mjs\` construit deux commits Git fictifs, une liste d'événements, un justificatif signé par une clé **éphémère**, des réponses GET cohérentes et des variantes adversariales. Les tests refusent le rollback depuis un checkpoint d'admission, la branche à trois commits, une genèse possédant déjà un ADMIT, un parent de genèse inattendu, une clé non épinglée, un témoin manquant et une réponse de ref mobile.

Les tests restent une **simulation** des endpoints GitHub et ne qualifient ni les runners GitHub réels, ni un véritable acteur GitHub App, ni la protection effective des refs.

### Avant une utilisation opérationnelle

1. Obtenir une décision owner distincte pour la protection et l'initialisation du ref global. Ne pas créer le ref opérationnel depuis ce lot.
2. Définir et ancrer la configuration hors de l'agent et du dépôt non fiable ; protéger la mise à jour monotone du \`checkpointSha\` contre un rollback et organiser la rotation/revocation de clés.
3. Donner à un émetteur approuvé la responsabilité du contrôle des inputs et du run owner (préflight #79), **avant** l'émission d'un reçu Ed25519.
4. Relier l'admission signée au CAS réel du global ref puis au journal de vague, et vérifier toutes les erreurs réseau incertaines sans retry payant.
5. Concevoir ensuite RELEASE/QUARANTINE avec des preuves et permissions séparées. Aucun job payant V3 avant approbation workflow/permissions et garde \`threadstep-paid-development-v1\`.

**Conclusion : cohérence d'ancrage simulée, pas de racine de confiance installée et pas d'activation.**
