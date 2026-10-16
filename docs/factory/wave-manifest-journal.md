# Manifeste immuable, journal durable et quotas (ASF-V2-006)

**Statut :** implémentation présente dans la PR de la tâche, **non fusionnée** et
**non vérifiée par une CI GitHub indépendante**. Preuves locales uniquement.
**Spécification normative :** [Orchestrator V1](specs/orchestrator-v1.md) (ASF-ORCH-001), §4, §5, §7, §8, §11.
**Dépendance :** [noyau pur du scheduler](scheduler-core.md) (ASF-V2-004).
**Tâche :** [ASF-V2-006](tasks/ASF-V2-006.md).

## Objet et périmètre

Garantir qu'**une vague ne peut pas dépasser son autorisation, même après une
interruption**. La livraison fournit trois briques pures et testables :

1. un **manifeste figé** créé une fois à l'ouverture de la vague, gelé en
   profondeur et jamais muté ;
2. un **journal append-only** à états, tenu séparément du manifeste, qui
   reconstitue toutes les décisions, SHA et liens **sans secret** ;
3. une **réservation de quota avant dispatch**, un arrêt au premier échec et un
   **stockage durable** doté d'une comparaison de SHA attendu
   (compare-and-swap) qui refuse toute écriture concurrente ou divergente.

Aucun dispatch réel, aucun appel OpenRouter, aucune écriture Git, aucun
changement de secret ou de permission. Les fenêtres de crash (avant, pendant et
après dispatch) et les conflits de mise à jour sont **simulés en mémoire**.

## Fichiers

- `scripts/asf/waves/manifest.mjs` : manifeste immuable, validation stricte, empreinte.
- `scripts/asf/waves/journal.mjs` : machine à états, journal append-only, quota, décisions, reprise.
- `scripts/asf/waves/store.mjs` : stockage durable simulé avec compare-and-swap.
- `scripts/asf/waves/hash.mjs` : sérialisation canonique déterministe et hachage sha256.
- `scripts/asf/waves/secrets.mjs` : détecteur de valeurs ressemblant à un secret.
- `scripts/asf/waves/index.mjs` : surface publique réexportée.
- `tests/asf-waves-manifest.test.mjs` : 9 tests.
- `tests/asf-waves-journal.test.mjs` : 18 tests.

## Manifeste figé

`createWaveManifest(input)` valide puis gèle le manifeste. Il refuse toute
ouverture en cas d'erreur plutôt que de deviner.

| Champ | Contrat |
| --- | --- |
| `schemaVersion` | Doit valoir `1`. |
| `waveId` | Identité de vague, motif `[a-z0-9][a-z0-9._-]{2,63}`. |
| `repository` | `owner/name`. |
| `authorizedBy` | Libellé déclaratif de provenance ; **la source d'authentification reste l'acteur GitHub réel et le run parent**, jamais ce seul champ. |
| `backlogCommit` | SHA source (40 ou 64 hex) du snapshot autorisé. |
| `policyVersion` | Version de politique, `asf-orch-v1`. |
| `mode` | `execute` ou `dry-run`. |
| `executor` | `openspec`. |
| `phase` | `plan`, `apply`, `auto` ou `finalize`. |
| `model` | Doit appartenir à l'allowlist (`MODEL_ALLOWLIST`, cohérente avec `agent-openspec.yml` / `agent-asf.yml`). |
| `limits.maxTaskStarts` | Entier `1..2` (nombre de **départs payants réservables**). |
| `limits.maxConcurrentTasks` | V1 : exactement `1`. |
| `limits.maxPaidRetries` | V1 : exactement `0`. |
| `autoMerge` | Booléen ; `true` demande seulement la fusion native différée après garde-fous. |
| `candidateTasks` | Liste `{ id, sha256 }`, identifiants uniques et sûrs, SHA-256 hexadécimaux. |
| `authorization` | Référence d'autorisation `{ parentRunId, reference, authorizedAt? }`, **sans secret**. |

Règles de sécurité :

- **Champs inconnus refusés** (au niveau racine, `limits`, `authorization`,
  `candidateTasks`) : un jeton ne peut pas être glissé par accident dans
  l'autorisation.
- **Valeurs ressemblant à un secret refusées** (`findSecretPaths`), sans jamais
  recopier la valeur.
- L'empreinte `hashWaveManifest` est un sha256 de la sérialisation canonique
  (clés triées) : insensible à l'ordre d'insertion, elle change dès qu'une
  définition de candidate change. Le journal y est **lié**.

## Journal append-only, états et quota

États (`WAVE_STATE`) : `SELECTED`, `DISPATCH_RESERVED`, `EXECUTING`,
`PR_PUBLISHED`, `CI_PENDING`, `MERGE_PENDING`, `DELIVERED`, `FAILED`, `UNKNOWN`.

Événements (`WAVE_EVENT`) et transitions :

```text
SELECT            (aucun)         -> SELECTED
RESERVE_DISPATCH  SELECTED        -> DISPATCH_RESERVED   (consomme le quota)
DISPATCH_CONFIRMED DISPATCH_RESERVED -> EXECUTING         (exige workflowRunId)
DISPATCH_UNCERTAIN DISPATCH_RESERVED -> UNKNOWN           (STOP_UNCERTAIN)
PR_PUBLISHED      EXECUTING       -> PR_PUBLISHED        (exige prNumber, headSha)
CI_PENDING        PR_PUBLISHED    -> CI_PENDING
MERGE_PENDING     CI_PENDING      -> MERGE_PENDING
DELIVERED         MERGE_PENDING   -> DELIVERED           (exige mergeCommit)
FAILED            état actif      -> FAILED              (STOP_FAILED, premier échec)
UNKNOWN           état actif      -> UNKNOWN             (STOP_UNCERTAIN)
```

`applyEvent` est **append-only** : il ne mute jamais le journal reçu, incrémente
`seq` et `revision`, et refuse toute transition invalide, tout champ inconnu,
tout payload incomplet et toute valeur ressemblant à un secret.

`beginDispatch` réalise la procédure obligatoire avant tout appel payant :
`sélectionner` puis **réserver** le quota. Si la réservation est refusée
(quota épuisé, vague arrêtée, clé déjà tentée), le journal d'origine est rendu
inchangé : aucun `SELECT` orphelin n'est persisté.

`DISPATCH_RESERVED` est la preuve durable qu'un départ payant a été engagé :
`taskStartsReserved` est incrémenté **avant** le dispatch, et un échec ne le
restitue jamais automatiquement.

## Reprise et fenêtres de crash

`decideResume(journal, taskId)` renvoie l'état de reprise d'une clé, et
`planDispatch(journal, manifest, taskId)` décide sans jamais dispatcher :

| Fenêtre | État du journal | Décision de reprise |
| --- | --- | --- |
| Avant dispatch | aucun ou `SELECTED` | `DISPATCH` (aucun quota consommé) |
| Pendant dispatch | `DISPATCH_RESERVED` sans run id | `STOP_UNCERTAIN` (toute la vague est arrêtée) |
| Issue incertaine | `UNKNOWN` | `STOP_UNCERTAIN`, **jamais de second dispatch** |
| Après dispatch | `EXECUTING` (run id persisté) | `IN_FLIGHT` (concurrence verrouillée à 1) |
| Livré | `DELIVERED` | `ALREADY_DELIVERED` |
| Échec | `FAILED` | `STOP_FAILED` |

Aucune décision payante n'est accordée si la vague est arrêtée, si un quota est
épuisé, si la clé a déjà été tentée, si une tâche est en vol ou si un état
incertain subsiste (`pendingUncertainty`). La V1 vise **au plus une tentative
automatique par clé `waveId/taskId`**, jamais un exactly-once transactionnel.

## Stockage durable et conflits de mise à jour

`createMemoryWaveStore` modélise la branche opérationnelle
`asf/waves/<wave-id>` : `read(waveId)` renvoie le journal sérialisé et son SHA
de contenu, `commit(waveId, expectedSha, journal)` n'écrit que si le SHA attendu
correspond à l'état courant. `commitEvent` empile l'événement puis persiste via
compare-and-swap ; un conflit (`code: "conflict"`) est **retourné sans aucune
reprise automatique**.

`reconstructJournal` / `validateJournal` échouent fermé sur : JSON invalide,
schéma inconnu, champ inconnu, `seq` non contigu, transition invalide, écart de
quota, incohérence de révision, `manifestHash` divergent et entrée après un
arrêt. `loadJournal` distingue « aucune donnée » (journal vide valide) d'un
enregistrement corrompu (erreur).

## Journal reconstitué sans secret

`summarizeJournal` ne recopie qu'une **liste blanche** de champs : décisions,
états, `workflowRunId`/`workflowRunUrl`, `prNumber`/`prUrl`, `headSha`,
`mergeCommit`, `ciVerdict`. Aucun champ non validé ne peut donc fuiter, et
`findSecretPaths` interdit en amont toute valeur ressemblant à un secret.

`toSchedulerExecutionState` adapte le journal durable à l'entrée
`executionState` du noyau ASF-V2-004 (`{ attempts, quota, observedAt }`) ; les
clés réservées ou au-delà deviennent des tentatives, et une clé `UNKNOWN` reste
`executing` (jamais re-sélectionnée) tandis que l'arrêt au niveau vague signale
`STOP_UNCERTAIN`.

## Critères d'acceptation et validation locale

- **Trois départs impossibles quand `max_tasks=2`, y compris en cas de
  reprise.** Vérifié : après deux réservations, `planDispatch` et
  `beginDispatch` renvoient `QUOTA_REACHED` / `quota_reached` ; après
  sérialisation + reconstruction (ou relecture du store), le compteur reste à
  `2` et le troisième départ reste refusé.
- **Issue de dispatch incertaine ⇒ `STOP_UNCERTAIN`, jamais de second dispatch
  automatique.** Vérifié : `DISPATCH_UNCERTAIN` comme un
  `DISPATCH_RESERVED` non confirmé (crash pendant dispatch) produisent
  `STOP_UNCERTAIN` pour **toute** la vague ; un nouvel événement est refusé
  (`wave_stopped`) et une seconde tentative sur la même clé aussi.
- **Le journal reconstitué garde les décisions, SHA et liens sans secret.**
  Vérifié : `summarizeJournal` d'un journal reconstitué conserve l'historique
  d'états, `headSha`, `mergeCommit`, URLs de run/PR et numéros de PR, et
  `isSecretFree` reste vrai ; un payload portant un jeton est refusé et jamais
  persisté.
- **Tests sans paiement réussis.** Aucun réseau, horloge, `child_process`,
  `fetch`, `Math.random` ni appel OpenRouter dans les modules `waves/` (test
  statique dédié) ; `npm run check` réussit localement.

Commandes exécutées localement sur la branche de la tâche :

- `node --test tests/asf-waves-manifest.test.mjs` → **9 tests réussis**.
- `node --test tests/asf-waves-journal.test.mjs` → **18 tests réussis**.
- `npm run check` → **210 tests réussis**, puis `backlog:check`
  (11 actifs, 0 archivé), puis `node --check site/core.js` et
  `node --check site/app.js` ; aucun workflow GitHub n'est modifié, donc
  Actionlint n'est pas requis.

## Limites et éléments non revendiqués

- **Non revendiqué** : CI GitHub indépendante sur le bon SHA, fusion,
  vérification post-fusion sur `main`, exécution payante, dispatch réel,
  adaptation Git réelle de la branche `asf/waves/<wave-id>`, adaptateur GitHub
  de preuves (ASF-V2-007) ou workflow orchestrateur (ASF-V2-009).
- Le SHA de contenu du store modélise le compare-and-swap ; un adaptateur Git
  futur devra le projeter sur le SHA de tête de branche.
- La détection de secrets est heuristique (motifs connus) et ne remplace pas une
  hygiène stricte : le journal n'a jamais besoin d'un secret.
- Aucune résolution autonome d'un état `UNKNOWN` : la reprise manuelle et la
  réconciliation GitHub restent hors périmètre.
