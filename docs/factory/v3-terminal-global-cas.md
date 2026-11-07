# ASF-V3-022 — Writer terminal GitHub-native CAS (port isolé)

**Statut : code testé sur clients GitHub injectés uniquement. AUCUNE activation de workflow ni de GitHub App réelle.** Base empilée : #106 → #105 → #104 → #102 → #100 → #99 → #97 → #96 → #87.

## But

Compléter l'admission globale V3 avec la transition terminale opposée. Une vague active doit être **libérée** (`RELEASE`) seulement si son journal terminé et ses preuves indépendantes PR/checks/Pages sont valides ; une vague arrêtée doit passer en **QUARANTINED**, jamais redevenir disponible spontanément. Le registre global est unique sur `refs/heads/asf/control/active-wave-v3`.

## Algorithme implémenté

Le module `scripts/asf/v3/github-native-terminal-cas.mjs` reçoit `readClient` et `writeTransport` injectés. Il n'importe ni clé PEM, ni réseau GitHub, ni modèle payé, et n'est raccordé à aucun workflow.

1. Appeler `observeV3GithubTerminalReadiness` : GET des trois rulesets avec App `5361227`, ref global, ref de vague, manifeste et journal au SHA de la branche V3, replay, preuves indépendantes de livraison pour RELEASE, double lecture des refs.
2. Relire `registry.json` **au SHA global exact** et le rejouer ; vérifier `globalRegistryHash`, appliquer `advanceAdmissionRegistry` avec **le proposedEvent de l'observateur**, puis comparer `proposedRegistryHash` à la projection recalculée. `RELEASE` exige `state: AVAILABLE` ; `QUARANTINE` exige `state: QUARANTINED`.
3. **Répéter intégralement l'observation GitHub indépendante** juste avant la préparation du commit. Confronter les SHA, journal, preuve de livraison, event et hash de registre à l'observation initiale ; toute divergence stoppe avant le premier POST.
4. Relire les SHA des deux refs, puis le tree Git du commit parent global. Préparer une tree Git Data avec **`base_tree` du commit parent** et modification de **`registry.json` uniquement**.
5. Créer un commit à **parent unique = SHA global épinglé**. Vérifier les SHA de tree et de parent retournés ; le nouveau commit reste détaché avant le CAS.
6. Tenter **un unique** `PATCH /git/refs/heads/asf/control/active-wave-v3` avec `{force:false}`. Un concurrent ayant avancé le ref empêche qu'un commit frère puisse fast-forward. **Aucun retry**, y compris après timeout, erreur réseau, 409/422 ou réponse ambiguë.
7. Relire le ref global, le ref de vague, le commit écrit et le `registry.json` au SHA créé. L'intégrité doit être exacte. Un échec = `uncertain`, jamais une réussite déclarée ni une reprise automatique.

Le résultat nominal est `persisted` avec l'ancienne et la nouvelle empreinte SHA, le numéro de révision et l'état terminal. **Tous les indicateurs de permissions restent false (`authorized`, `canRelease`, `canQuarantine`, `canWrite`, `canDispatch`, `canSpend`, `canRetry`).** Persistance n'autorise jamais le démarrage d'un agent ou un paiement.

## Tests adversariaux

- `RELEASE` sur vague `COMPLETED_NO_WORK` et `QUARANTINE` sur `STOP_UNCERTAIN` ; contrôle de l'état global final.
- Ref global en course avant staging, collision de fast-forward pendant PATCH, réponse PATCH perdue même si l'écriture a réussi.
- Faux succès PATCH sans modification effective du ref, mauvais ref retourné, mauvais parent commit, réponse POST tree perdue.
- Ref de vague modifié après PATCH, contenu du registre post-PATCH corrompu ou indisponible, double observation incohérente.
- Journal ou registre initial invalide, mauvais App ID (V1) dans ruleset, transport absent et paramètres non sûrs ; aucun accès write si une preuve initiale est rejetée.

## Limites et conditions P0 avant réel

**Un transport injecté peut mentir.** Les tests ne constituent ni une authentification du runner owner ni une validation des permissions de l'App GitHub. Le futur workflow privilégié ne pourra brancher ce port qu'après un audit distinct du job protégé, de la provenance owner, de l'environnement GitHub App `5361227` et des tests de permission réelle (V1 refusée, aucune suppression/force-push) dans un dépôt isolé.

Le bootstrap initial du registre **n'existe toujours pas en production** ; le protocole one-shot #105 est une machine à états sans persistance durable. Sans ce bootstrap approuvé, le présent module ne peut rien clôturer.

Prochaines intégrations : port d'accès GitHub contrôleur audité, marqueur durable one-shot du bootstrap, dispatch/ACK/CLAIM_CHILD/mutex payé V1/V3 et tests E2E réels sans paiement. Aucun merge, secret, écriture du ref opérationnel ni dépense sans décision de l'owner.

Liens : [Notion — instructions owner](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882) · [Issue #86](https://github.com/cedricmenec/threadstep/issues/86).