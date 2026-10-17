# ASF V3-028 | Simulation GitHub Actions du mutex V1/V3 (isolée)

**Statut : fixtures inertes stockées dans la documentation, pas dans `.github/workflows/` de `threadstep`. Aucun run réel n'est déclenché ni prouvé par cette PR.**

Ce jeu de trois fichiers est destiné **uniquement** à un futur dépôt de laboratoire distinct, nommé exactement `asf-v3-mutex-lab`, après autorisation du propriétaire. Il met en pratique le protocole [ASF-V3-027](../../v3-paid-mutex-concurrency-validation.md) issu de [#120](https://github.com/cedricmenec/threadstep/pull/120). La PR [#112](https://github.com/cedricmenec/threadstep/pull/112) contrôle le contrat statique du verrou en production. La présente PR ne déploie aucun code ni workflow réel.

## Fichiers

| Fichier | Workflow | Job et groupe |
| --- | --- | --- |
| `v1-shared.yml` | ASF Mutex Lab V1 Shared | `simulate-v1`, `threadstep-paid-development-v1` |
| `v3-shared.yml` | ASF Mutex Lab V3 Shared | `simulate-v3`, **même groupe** |
| `v3-control.yml` | ASF Mutex Lab V3 Independent Control | `simulate-control`, `threadstep-v3-mutex-lab-control` |

Chaque fichier n'accepte que `workflow_dispatch` manuel, sans aucun secret ni action externe et avec `permissions: {}`. Le job vérifie que `github.event.repository.name == 'asf-v3-mutex-lab'` : **toute copie accidentelle dans `threadstep` sera ignorée au niveau du job**. L'attente est limitée aux choix `15`, `45` ou `120` secondes, avec `timeout-minutes: 5`. Le verrou figure au **niveau du job** et garde `cancel-in-progress: false`. Pas de `queue: max` (décision distincte).

## Déploiement éventuel, manuel et hors production

1. Obtenir **au préalable** l'accord owner pour un dépôt d'essai séparé et les minutes GitHub Actions. Aucun dépôt n'est créé ici. Préférer un dépôt d'essai privé et restreint.
2. Vérifier que ce dépôt s'appelle **exactement** `asf-v3-mutex-lab`, qu'il ne porte aucun secret et qu'il n'est pas une dépendance ni un fork opérationnel de `threadstep`.
3. Après revue des trois fixtures, les copier **manuellement** dans le répertoire `.github/workflows/` du dépôt d'essai en conservant leurs noms. Avant tout commit de laboratoire, vérifier la syntaxe à l'aide d'`actionlint` dans **ce dépôt**.
4. Contrôler dans le dépôt d'essai que seuls ces workflows de simulation sont présents et que les permissions du token Actions sont minimales. Ne pas exécuter depuis `threadstep`.
5. Effectuer les déclenchements manuels selon M01–M07 de la PR #120, en relevant les URLs, `run_id`, `run_attempt`, états `queued/pending/in_progress/completed`, conclusions, horodatages jobs et les lignes `LAB_START/LAB_END`.
6. Enregistrer `pass`, `fail` ou `inconclusive` avec les preuves et toute course. Ne déclencher **aucun retry automatique**. Ne pas considérer un run `cancelled` comme une dépense, un claim durable ou un droit au retry.

**Scénarios conseillés :** M01 et M02 avec un job long `120` et un job court `15` dans le même groupe, M03 avec trois dispatchs concurrents (possible remplacement du pending), M04 avec `v3-control` et l'un des partagés. M05–M07 sont évalués suivant le protocole ASF-V3-027. La saturation de runners peut rendre un scénario `inconclusive`.

## Sécurité et limites

- Les trois noms de groupes ont une portée **par dépôt**. Le dépôt d'essai ne prend donc jamais le mutex du vrai `threadstep`.
- Le laboratoire ne prouve pas les permissions GitHub App, le CAS du journal, le `CLAIM_CHILD`, le plafond 1–10, les secrets d'environnement ou le droit au premier appel facturable.
- Les seules dépenses éventuelles sont celles de l'infrastructure de runners selon l'offre GitHub, **pas des modèles**. Vérifier les quotas avant déclenchement.
- Un audit statique conservateur existe dans `scripts/asf/v3/mutex-lab-template-audit.mjs` et ses tests. Il n'est pas un parseur YAML complet ; actionlint et une revue indépendante restent indispensables.
- Aucun `main`, ref Git global, ruleset, environnement privilégié, workflow V1 ni V3 productif n'est modifié par les fichiers de ce dossier.

Suivi : [issue #86](https://github.com/cedricmenec/threadstep/issues/86).
