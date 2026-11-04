# ASF-V3-024 — ACK_CHILD et CLAIM_CHILD par CAS de journal Git

**Statut : développement isolé derrière des ports GitHub injectés, PR brouillon empilée sur #109.** Aucune action live, secret, token App, permission d'écriture ou coût.

## Nouveau contrat

- `observeV3GithubChildAckReadiness` continue de vérifier le run enfant réel dans l'API GitHub et un journal en `DISPATCH_PENDING` au SHA `reservation_sha` provenant du `workflow_dispatch` natif.
- `observeV3GithubChildClaimReadiness` applique la même identité stricte et exige un journal au statut `CHILD_ACKNOWLEDGED`, avec **dernier événement** `ACK_CHILD` pour le même run ID, task ID, tentative 1 et workflowRef exacts. Le commit de cette ACK doit avoir **exactement un parent** égal à `reservation_sha` initial : impossible de revendiquer un ACK arbitraire ou périmé.
- Le nouveau module `github-native-child-wave-cas.mjs` fait **deux observations indépendantes** avant toute écriture, relit le manifeste/journal Git au SHA précis, applique `advanceV3` par rejeu complet, vérifie la projection d'état (`CHILD_ACKNOWLEDGED` puis `EXECUTING`) et le lien avec le même enfant.
- Le writer non privilégié utilise le port déjà présent `commitV3JournalCAS` / `createAsfV3GitDataPort` : arbre contenant seulement `journal.json`, commit Git à parent unique = SHA attendu et un **seul** PATCH `force:false`. Un commit concurrent au même parent provoque un conflit : **aucun retry automatique**.
- Après le PATCH, un nouveau snapshot SHA-pinné doit contenir exactement le nouveau journal et le manifeste initial ; le ref global owner-admis et le SHA `main` doivent rester identiques aux observations initiales. Toute incertitude arrête sans déclarer un succès.

**La mise à jour de journal n'est PAS une autorisation de paiement.** Même un statut positif `persisted_simulation` conserve `authorized:false`, `canAck:false`, `canClaim:false`, `canWrite:false`, `canDispatch:false`, `canSpend:false`, `canRetry:false`. L'intitulé indique explicitement que le transport testé est simulé et ne prouve pas les droits de l'App GitHub.

## Cas d'attaque testés

Double ACK, CLAIM avant ACK, CLAIM répété, usurpation d'un autre run enfant, commit ACK d'un mauvais parent, ref en concurrence, perte d'accusé de PATCH après succès réel du mock, faux succès PATCH sans mise à jour, journal post-PATCH corrompu, ruleset writer d'une mauvaise App, run REST falsifié, registre global invalide et SHA de réservation modifié.

## Ce qui reste avant un agent V3 réellement exécutant

1. **Le child workflow reste inerte** : il ne détient aucun transport d'écriture et se termine par son refus final. L'ACK et le CLAIM ne sont pas raccordés à la production.
2. Revoir quel acteur GitHub possède le droit d'écriture sur les refs `asf/waves/*` ; ne jamais exposer ce droit au modèle ni considérer un token V1 comme une autorité globale. Actuellement, les règles vérifiées protègent le **ref global**, non les refs individuelles de vague.
3. Apporter un mécanisme sûr de remontée d'attestation native enfant vers le contrôleur, avec anti-rejeu durable, avant d'autoriser l'écriture `ACK_CHILD` puis `CLAIM_CHILD` depuis un runner authentifié.
4. Réconcilier le **mutex payé partagé V1/V3** et le quota de 1–10 avant toute activation d'OpenRouter. Un journal en `EXECUTING` ne déclenche aucun modèle automatiquement.
5. Vérifier les droits App, workflows et règles effectifs sur un dépôt d'essai, sans paiement, et obtenir les autorisations owner distinctes pour activation privilégiée, bootstrap live et tout pilote payé.

Voir [Issue sécurité #86](https://github.com/cedricmenec/threadstep/issues/86) et [guide Notion ASF V3](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).