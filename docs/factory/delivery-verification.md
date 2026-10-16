# Adaptateur GitHub de vérification des livraisons (ASF-V2-007)

**Statut :** implémentation présente dans la PR de la tâche, **non fusionnée** et
**non vérifiée par une CI GitHub indépendante**. Preuves locales uniquement.
**Spécification normative :** [Orchestrator V1](specs/orchestrator-v1.md)
(ASF-ORCH-001), §6, §7, §8.
**Dépendance :** [manifeste, journal et quotas](wave-manifest-journal.md)
(ASF-V2-006).
**Tâche :** [ASF-V2-007](tasks/ASF-V2-007.md).

## Objet et périmètre

Un run OpenSpec `success` **n'est pas** une livraison. Ce module fournit une
observation GitHub **en lecture seule** qui distingue explicitement :

- **`verified`** : une PR finale fusionnée, à la branche, au `head SHA`, à base
  `main`, à l'auteur attendu, avec le contrôle indépendant `check` réussi sur le
  SHA de tête **et** sur le commit de fusion, ce commit présent dans `main`, et
  les runs post-fusion du profil (`CI` et `Pages` pour ThreadStep) verts ;
- **`pending`** : un « pas encore livré » définitif — PR ouverte/brouillon,
  fusionnée mais run ou contrôle manquant, attente de runs post-fusion ;
- **`unknown`** : une preuve incomplète ou contradictoire — erreur API/transport,
  plafond de pagination atteint, PR ambiguë ou concurrente, mauvaise base,
  branche, auteur ou SHA, contrôle absent/non prouvé, ou commit de fusion absent
  de `main`. **Échec fermé.**

Aucune écriture GitHub, aucun merge, aucun push, aucun appel payant. L'état
d'archivage est **observé mais ne conditionne jamais** le verdict : une livraison
vérifiée non archivée satisfait une dépendance
([Scheduler V1](specs/scheduler-v1.md) §4).

## Fichiers

- `scripts/asf/github/client.mjs` : client lecture seule, transport injecté,
  **pagination bornée** (`truncated`) et **timeouts bornés** ; toute erreur
  devient une valeur d'erreur structurée, jamais une donnée.
- `scripts/asf/github/transport.mjs` : seul fichier de ce dossier lié à un
  processus ; lie le `gh` CLI en lecture seule avec `timeout` et `maxBuffer`.
- `scripts/asf/github/index.mjs` : surface publique du client.
- `scripts/asf/delivery/verify.mjs` : moteur de verdict pur
  (`verified`/`pending`/`unknown`), profils ASF et OpenSpec, projection vers les
  preuves du scheduler.
- `scripts/asf/delivery/observe.mjs` : collecte l'observation via le client,
  sans logique de décision.
- `scripts/asf/delivery/index.mjs` : surface publique de l'adaptateur.
- `tests/asf-github-delivery.test.mjs` : 23 tests déterministes sur fixtures.

## Client borné et sans fuite

`createGithubClient({ transport })` reçoit un transport async
`(path, { timeoutMs }) => json` et n'effectue lui-même **aucune** E/S.

| Garantie | Contrat |
| --- | --- |
| Pagination | `paginate` collecte des tableaux page par page jusqu'à `maxPages` ; une dernière page **pleine** au plafond renvoie `truncated: true`. Une liste tronquée est une preuve **incomplète**. |
| Timeout | Chaque appel est borné (`timeoutMs`, défaut 15 s) ; un timeout ou un `AbortError` devient `code: "timeout"`. |
| Erreur ≠ donnée | Toute exception du transport renvoie `{ ok: false, error: { code, status } }` avec `data: null`. |
| Sans secret | Le message brut du transport est **abandonné** ; seuls `code` et `status` sont conservés, donc aucun jeton ne peut être recopié. |
| Chemin | Un chemin absolu ou ressemblant à une URL est refusé (`invalid_path`) sans appeler le transport. |

Le transport réel (`createGhTransport`) exécute `gh api <path>` en lecture seule.
Comme `execFileSync` est synchrone et ne peut pas être interrompu par le
`Promise.race` du client, **il impose lui-même** son `timeout` et son
`maxBuffer`.

## Vérification pure de la livraison

`verifyDelivery(config, observation)` ne lit ni réseau, ni horloge, ni état
mutable. La configuration décrit l'identité attendue :

| Champ | Rôle |
| --- | --- |
| `taskId`, `repository`, `base` | Corrélation tâche / dépôt / base (`main`). |
| `prTitle`, `branchPattern`, `runCorrelation` | Titre exact de la PR finale, motif de branche, corrélation du run enfant (`branch-run-id` pour ASF, `head-branch` pour OpenSpec). |
| `runPath` | Chemin du workflow enfant attendu. |
| `expectedAuthor` | Auteur/App attendu de la PR. |
| `check` | Contrôle indépendant obligatoire (`check`, App `github-actions`, id `15368`). |
| `postMergeRuns` | Runs post-fusion exigés par le profil (`CI`, `Pages`). |
| `rejectBodyPattern` | Marqueur de PR `plan` (OpenSpec) refusé. |

`createAsfDeliveryConfig` et `createOpenspecDeliveryConfig` fournissent ces
configurations, alignées sur `agent-asf.yml` et `agent-openspec.yml`.

Ordre d'évaluation (tous les échecs sont fermés) :

1. Erreur API/transport présente → `unknown`.
2. Pagination tronquée → `unknown`.
3. Zéro PR fusionnée → `pending` (une PR ouverte ou brouillon reste `pending`) ;
   un **run `success` sans PR fusionnée ne débloque donc rien**.
4. Plus d'une PR fusionnée, ou une PR ouverte en plus de la fusionnée → `unknown`.
5. PR `plan` ou brouillon → `pending`.
6. Base, branche, dépôt de tête ou auteur non conformes → `unknown`.
7. SHA de tête/fusion invalides, ou `head_sha` du run divergent → `unknown`.
8. Run enfant absent/incomplet/rouge → `pending` ; provenance (chemin, événement,
   acteur) non conforme → `unknown`.
9. Contrôle `check` absent ou non prouvé (`unknown`), en cours ou rouge
   (`pending`).
10. Commit de fusion absent de `main` (`comparaison` ≠ `ahead`/`identical`) →
    `unknown`.
11. Runs post-fusion manquants/en attente/rouges → `pending`.
12. Tout est prouvé → `verified` avec une preuve sans secret
    (`pr`, `headSha`, `mergeSha`, `runId`, `postMergeRuns`, `archived`).

## Projection vers le scheduler

`toSchedulerEvidence(verdict)` projette le verdict dans le vocabulaire du noyau
ASF-V2-004 (`verified | unknown`) :

- `verified` → `{ status: "verified", proof }` ;
- `unknown` → `{ status: "unknown" }` → `STOP_UNCERTAIN` dans le scheduler ;
- `pending` → `null` : la dépendance est **omise** des preuves, donc traitée
  comme non livrée (blocage sûr), **jamais** comme libre ni comme incertaine.

Ainsi une erreur API ne devient jamais une « absence de conflit », et une
livraison en attente ne consomme aucune place payante.

## Critères d'acceptation et validation locale

- **Un run `success` sans PR fusionnée ne débloque rien.** Vérifié : avec un run
  vert mais aucune PR fusionnée, `verifyDelivery` renvoie `pending` avec
  `no_merged_pull_request` (ou `pull_request_open`) et `proof: null`.
- **Draft plan, mauvais SHA, CI rouge ou check inconnu ne deviennent jamais
  `DELIVERED`.** Vérifié : une PR plan/brouillon → `pending` ; un `head_sha`
  divergent ou invalide → `unknown` ; un `check` rouge → `pending` ; un `check`
  absent, d'une autre App ou de conclusion inconnue → `unknown`.
- **Livré mais non archivé peut satisfaire une dépendance après preuve
  suffisante ; tests sur fixtures passent.** Vérifié : `archived: false` et
  `archived: true` donnent tous deux `verified` (seul `proof.archived` change) ;
  `toSchedulerEvidence` renvoie `verified` ; suite complète verte.
- **Erreur API lue comme inconnue, jamais comme absence de conflit.** Vérifié :
  une entrée `errors` produit `unknown` avec `api_error` ; `truncated` produit
  `unknown` avec `pagination_limit`.

Commandes exécutées localement sur la branche de la tâche :

- `node --test tests/asf-github-delivery.test.mjs` → **23 tests réussis**.
- `npm run check` → **233 tests réussis**, puis `backlog:check`
  (11 actifs, 0 archivé), puis `node --check site/core.js` et
  `node --check site/app.js` ; aucun workflow GitHub n'est modifié, donc
  Actionlint n'est pas requis.

## Limites et éléments non revendiqués

- **Non revendiqué** : CI GitHub indépendante sur le bon SHA, fusion,
  vérification post-fusion sur `main`, dispatch réel, appel OpenRouter payant,
  workflow orchestrateur (ASF-V2-008/009) ou archiveur (ASF-V2-010).
- L'adaptateur **observe** la livraison ; il ne déclenche rien, ne réserve aucun
  quota et ne fusionne rien.
- Les profils ASF et OpenSpec sont alignés sur les workflows observés au
  16 octobre 2026 ; toute évolution de branche, de titre de PR ou de nom de
  contrôle doit mettre à jour la configuration et ses tests.
- Le transport `gh` réel n'est pas exercé par les tests unitaires (transport
  synthétique) ; son intégration E2E appartient à l'orchestrateur.
