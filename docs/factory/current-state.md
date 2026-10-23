# État courant de l'Autonomous Software Factory

## ASF V3, 23 octobre 2026 : G1 structuré mais non conforme, C4 préparatoire

**Cette section datée est plus récente que les états historiques conservés ci-dessous.** Le dépôt `main` exécute encore les workflows V1 ; la V3 n'est **ni fusionnée, ni activée, ni autorisée à payer**. Source de pilotage à réconcilier au prochain contrôle : [Notion ASF V3](https://app.notion.com/p/3fc12ac9163680adb3e3e3f63d827f69), [issue #86](https://github.com/cedricmenec/threadstep/issues/86).

- **Rapport API détaillé** : [G1 GitHub au 23 octobre](v3-g1-live-audit-2026-10-23.md). Cinq rulesets actifs : trois main/global conformes, mais writer wave #25747770 avec deux règles de suppression et de non-fast-forward excédentaires. L'immuable wave #25747923 est conforme. **G1 reste NO-GO** jusqu'à correction manuelle du seul writer.
- **Global control ref absent (404)**, ce qui n'autorise pas un bootstrap. App Controller V3 5361227 et App Executor V1 5321746 : permissions réelles et essais négatifs non démontrés.
- **Préparation V3** : [PR #169](https://github.com/cedricmenec/threadstep/pull/169) convergence, brouillon non fusionné ; [#177](https://github.com/cedricmenec/threadstep/pull/177), [#178](https://github.com/cedricmenec/threadstep/pull/178), [#179](https://github.com/cedricmenec/threadstep/pull/179), [#180](https://github.com/cedricmenec/threadstep/pull/180), [#181](https://github.com/cedricmenec/threadstep/pull/181) qualifiées en CI et toujours empilées en brouillon. La documentation C4 indépendante [#176](https://github.com/cedricmenec/threadstep/pull/176) est fusionnée. Les tests simulés ne démontrent pas les droits réels.
- **G3 laboratoire** : M01–M07 (mutex) conservés, mais l'API des rulesets du dépôt privé de test renvoie HTTP 403 (fonction non disponible dans sa configuration actuelle). Ne pas modifier sa visibilité ni déclencher des jobs supplémentaires sans une décision distincte.
- **Gates non franchies** : G2 writer et secret privilégié, genèse réelle, G3 permissions négatives/CAS live et G4 pilote LLM. Toute fusion sensible, écriture opérationnelle ou dépense nécessite accord ciblé et preuves GitHub.

## 17 octobre 2026 : fiabilisation ASF-OPSX-03/04 (PR en cours)

Le [run TS-023 #39047805814](https://github.com/cedricmenec/threadstep/actions/runs/39047805814)
a validé 444 tests et la checklist d'apply, puis OPSX sync a produit une
exigence canonique de plus de 500 caractères : `--all --strict` a échoué
après archivage local, sans commit distant. La correction déplace la
validation stricte **avant** archivage, ajoute deux checkpoints
**commit/push distants** après plan et apply, garde l'archive et la PR
finale conditionnées à l'ensemble des validations et publie des diagnostics
de reprise sans rejouer automatiquement le modèle.

La branche `agent/openspec/TS-NNN` peut contenir un plan validé seul,
puis du code validé ; sa présence ne prouve ni la synchronisation, ni la
livraison. En cas de panne post-plan : inspecter et autoriser `apply`.
En cas de panne post-apply : inspecter puis autoriser `finalize` (appel
OPSX toujours payant). Une phase `auto` sur un plan déjà présent échoue
sans le régénérer. L'orchestrateur V1 hérite de ces protections par son
workflow réutilisable, mais conserve son arrêt fail-closed et son quota 1..2.
Voir [tâche/checklist](tasks/ASF-OPSX-03.md) et
[qualité sync](opsx-sync-quality.md). Pas de preuve E2E OpenRouter nouvelle
avant une exécution distinctement autorisée ; CI/Pages à qualifier après PR.


## Clôture de recette — 16 octobre 2026

**Décision : ASF V2 clôturée pour son périmètre défini (vague V1 1..2 tâches).** Les composants ASF-V2-001 à 011 sont livrés ; les runs [38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283) et [38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187) démontrent les parcours payants 1/1 et 2/2, avec CI et Pages après chaque fusion.

**Test négatif réel autorisé et exécuté :** [PR #63](https://github.com/cedricmenec/threadstep/pull/63), commit `53a9c5074b579a1ffe94a9ae0409996b5fb4a48d`, [run 38935289219](https://github.com/cedricmenec/threadstep/actions/runs/38935289219) : `check=completed/failure`, `mergeable_state=blocked`, ruleset `Protect Main` actif (id 25163425), `check` obligatoire depuis GitHub Actions (integration 15368), `bypass_actors=[]`, `main` inchangé pendant la vérification ; PR fermée **sans fusion**. Ce test n'est **pas** une exécution rouge d'agent OpenSpec : cette branche de l'orchestrateur est prouvée par la simulation `red-ci` uniquement.

**Recette utilisateur ThreadStep :** propriétaire, déclarée **OK** le 16 octobre 2026 (détail appareils / cases non fourni). **Permissions GitHub App :** propriétaire, vérifiées et déclarées conformes le 16 octobre 2026 ; vérification privée non reproduite par l'assistant. Protections ruleset et checks : vérifiées via GitHub.

**Limites acceptées :** aucun test destructif de crash en production, pas de CI rouge d'agent payant en conditions réelles, pas de plafond monétaire USD, `max_tasks=1|2`, `strict_required_status_checks_policy=false`. Ces limites ne doivent pas être requalifiées en preuves positives. L'évolution à dix tâches relève d'une phase **ASF V3 ultérieure**, sans backlog ni implémentation à ce stade.


## Clôture ASF V2 — 16 octobre 2026 (à lire avant l'historique)

**ASF V2 clôturée pour le périmètre de l'orchestrateur V1 (`max_tasks=1|2`)**. La [décision motivée et les limites de preuve](closeout-2026-10-16.md) intègrent les deux pilotes réels, le `check` rouge de [PR #61](https://github.com/cedricmenec/threadstep/pull/61) bloquée puis fermée sans fusion, l'inspection du ruleset ainsi que l'attestation du propriétaire pour permissions App et recette manuelle. L'injection de panne dans un agent payant reste hors des essais réalisés.


Le titre « État courant » et les affirmations datées du 15 octobre conservées **ci-dessous** sont des instantanés historiques des premières PR. **L'état opérationnel réel** est désormais le suivant :

- **ASF-V2-001..011 livrées et fusionnées** : PR #40, #43..#50, #52 et #53 ; #49/#50 sont des livraisons sensibles manuelles explicitement reconnues via PR #51.
- **V1 réellement disponible** : `Backlog Orchestrator V1` sur `main`, `mode=dry-run|execute`, `max_tasks=1|2`, exécuteur OpenSpec authentifié, journal durable et contrôle post-fusion. Pas de budget monétaire garanti.
- **Pilote à une tâche** : [run 38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283), PR [#55](https://github.com/cedricmenec/threadstep/pull/55), merge `33adc80a9c090e166e132c7494066511311f16f8`, journal `wave-38886939283` : TS-012 `DELIVERED`, quota 1/1, CI et Pages post-fusion réussies.
- **Pilote à deux tâches** : [run 38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187) ; TS-013 [PR #58](https://github.com/cedricmenec/threadstep/pull/58), merge `eba9fd15ff9e2ac24ece20f742e0f12f78047856` ; TS-014 [PR #59](https://github.com/cedricmenec/threadstep/pull/59), merge `97d326c5b262622f8146348f385eb1e0d838829c`. Journal `wave-38910657187` : deux `DELIVERED`, 2 réservations/2, `stop: null`; contrôle intermédiaire réussi avant sélection du second.
- **Dernier commit de produit vérifié** : `97d326c5b262622f8146348f385eb1e0d838829c` ; CI [38912890270](https://github.com/cedricmenec/threadstep/actions/runs/38912890270) et Pages [38912890267](https://github.com/cedricmenec/threadstep/actions/runs/38912890267) réussies.
- **Protection** : `main` signalée comme `protected`, ruleset `Protect Main` actif (id 25163425) ; source d'identité GitHub Actions attendue pour `check` : app 15368. **BYPASS absent selon le ruleset lu par API `bypass_actors=[]` ; permissions fines App attestées conformes par le propriétaire le 16/10/2026** (non auditables indépendamment par l'API disponible).
- **Clôture** : `check` rouge **réel** observé sur [PR #61](https://github.com/cedricmenec/threadstep/pull/61) / [CI #38925574700](https://github.com/cedricmenec/threadstep/actions/runs/38925574700), état `blocked`, PR fermée non fusionnée ; recette manuelle **déclarée OK** par le propriétaire, permissions App **attestées** conformes ; ruleset API vérifié. Les six simulations E2E ne constituent toujours pas un crash réel ou une panne d'agent payant.
- **Archives produits** : `backlog/archive-index.json` est encore vide. TS-012/013/014 sont présentes en `ready/allowed/low` mais leurs PR sont déjà livrées ; **ne pas les relancer**. ASF-V2-010 fournit un archiveur déterministe ; aucune PR d'archivage automatique pour ces trois fiches n'est revendiquée.

Voir [guide ASF](developer-guide.md), [validation et reprise](validation-and-recovery.md) et [changement d'échelle](scale-to-ten.md).


**Référence vérifiée : 15 octobre 2026, après fusion de la PR #34.**
Point d'entrée unique pour reprendre le pilote. Les règles exécutables sont
[AGENTS.md](../../AGENTS.md), les workflows dans .github/workflows/ et les
spécifications canoniques dans openspec/specs/. L'historique reste dans GitHub.

## Architecture en service

- **GitHub, source de vérité** : dépôt public cedricmenec/threadstep ;
  backlog sous backlog/tasks/, vision et contrat produit dans docs/product/,
  changement OpenSpec actif ou archivé sous openspec/changes/.
- **Application pilote** : site statique dans site/, navigateur et
  localStorage, import/export JSON, publication GitHub Pages, sans backend.
- **Deux exécuteurs manuels** : agent.yml (direct, sans OpenSpec) et
  agent-openspec.yml (plan / apply / auto / finalize). Le propriétaire
  déclenche un task_id et un modèle dans Actions ; aucun ordonnanceur
  automatique ni orchestration de vagues n'est déployé.
- **Formulaire OpenSpec** (évolution ASF-WF-001) : phase `auto` et modèle
  DeepSeek V4.1 Flash pré-sélectionnés (GLM 5.3 Flash et les autres phases
  toujours disponibles). Numéro `9`, `09`, `009` ou nom `TS-009`
  normalisé en `TS-009` avant les opérations payantes. Les runs OpenSpec
  sont sérialisés **par tâche canonique**, grâce à un job de
  prévalidation. Les tâches différentes peuvent tourner en parallèle. Le clic
  manuel « Run workflow » reste indispensable ; les 3 appels OpenCode
  de `auto` ne sont pas plafonnés en USD. Cette modification de configuration
  est contrôlée par tests statiques ; aucun run payé de validation n'a été lancé.
- **OPSX natif OpenCode, validé sur TS-009** : le runner installe
  @fission-ai/openspec@1.14.1, génère les fichiers agent avec
  openspec init --tools opencode,agents, vérifie les skills et les commandes,
  puis lance opencode run --command opsx-sync ts-009. Le test a modifié la
  section MODIFIED d'une spécification déjà canonique, et non seulement
  ajouté une nouvelle capacité.
- **Contrats et isolation** : le script scripts/sync-guard.mjs compare les
  empreintes de contenu des fichiers suivis et non suivis avant/après sync,
  interdit les changements hors openspec/specs/ et exige une modification
  canonique. Le script scripts/check-openspec-task-phases.mjs, ajouté par
  PR #25, interdit des demandes explicitement post-sync dans la checklist
  pré-sync au moment du plan et au démarrage de apply.
- **Publication** : GitHub App threadstep-software-factory, branche
  agent/openspec/TS-NNN, PR et CI indépendante. ASF-WF-002 ajoute aux deux
  workflows un booléen `auto_merge=true` par défaut pour les PR finales,
  désactivable au lancement. Le script de fusion n'autorise que GitHub
  native auto-merge, après contrôle explicite d'un required status check
  `check` dans le ruleset actif de `main`. OpenSpec `plan` reste brouillon,
  jamais fusionné automatiquement. **E2E de fusion automatique OpenSpec
  prouvé** pour TS-010 (PR #32) et TS-011 (PR #34) : la GitHub App a
  demandé et effectué la fusion après CI indépendante. La fusion du
  workflow direct sans OpenSpec reste non éprouvée de bout en bout.
- **Versions/coûts** : OpenSpec épinglé en 1.14.1, OpenCode installé par
  `opencode-ai@1.19.0` (ASF-OPENCODE-001 ; le smoke test CI valide le binaire Linux), observé en 1.19.0 durant TS-008. Modèles OpenRouter
  configurés : DeepSeek V4.1 Flash et GLM 5.3 Flash. Les appels restent
  payants ; il n'existe ni plafond USD garanti ni relevé de dépense
  automatique dans le workflow.

## Preuves d'exécution vérifiées

| Référence | Preuve et conclusion |
| --- | --- |
| PR #8, TS-005 | Pilote OpenSpec plan/apply, archivé et fusionné. |
| PR #16 | Correction des étapes de validation ignorées par l'ancien auto TS-007. |
| PR #19 | Premier sync sémantique guidé par un prompt OpenCode, archive --skip-specs. |
| PR #21, TS-008 | Auto complet, 41 tests, nouvelle capacité resume-tracking ADDED, PR et CI/Pages réussies. |
| PR #22 | Génération des skills/commandes OpenCode et garde-fou SHA-256 avant/après sync. |
| PR #23 et #24 | Préparation du backlog TS-009 et plan OpenSpec fusionné prématurément, sans code. |
| Run 38710098331 | Premier apply TS-009 : code généré et 54 tests OK, bloqué par une checklist demandant un contrôle post-sync avant sync. Rien de publié. |
| PR #25 | Contrat des phases de checklist et cinq tests de non-régression rapides, fusionné. |
| Run 38712079641, PR #26 | Second apply TS-009 : 55 tests, invocation OPSX native, garde-fou de périmètre, fusion MODIFIED, archive, PR fusionnée. |
| Runs 38713003608 et 38713003743 | CI de main après PR #26 : 60 tests réussis ; déploiement Pages réussi. |
| PR #28, ASF-WF-001 | Formulaire OpenSpec : auto et DeepSeek V4.1 Flash par défaut ; saisie numérique TS-NNN normalisée, testé en CI et utilisé dans TS-010/11. |
| PR #29 puis #30 | Auto-merge natif à contrôles requis ; régression YAML de l'agent direct (#29), réparée en #30 avec Actionlint et validation Bash. |
| Runs 38749526539 et 38753301546 | Exécutions OpenSpec auto TS-010 et TS-011 réussies, avec demandes de fusion automatique. |
| PR #32 et #34 | Agent GitHub App confirmé comme auteur **de la fusion automatique** après CI des deux PR produits. |
| Runs 38755434920 et 38755434958 | CI main après #34 : **97 tests Node**, Actionlint et validations OpenSpec réussis ; Pages déployé. |

Références :
[TS-009 apply](https://github.com/cedricmenec/threadstep/actions/runs/38712079641) ·
[PR #26](https://github.com/cedricmenec/threadstep/pull/26) ·
[CI main](https://github.com/cedricmenec/threadstep/actions/runs/38713003608) ·
[Pages](https://github.com/cedricmenec/threadstep/actions/runs/38713003743).

Preuves récentes :
[run TS-010](https://github.com/cedricmenec/threadstep/actions/runs/38749526539) ·
[PR #32](https://github.com/cedricmenec/threadstep/pull/32) ·
[run TS-011](https://github.com/cedricmenec/threadstep/actions/runs/38753301546) ·
[PR #34](https://github.com/cedricmenec/threadstep/pull/34) ·
[CI main](https://github.com/cedricmenec/threadstep/actions/runs/38755434920) ·
[Pages](https://github.com/cedricmenec/threadstep/actions/runs/38755434958).

**Portée de la preuve OPSX :** la modification de
openspec/specs/next-action-suggestion/spec.md a remplacé uniquement
« Suggestion card content », conservé son scénario d'origine et ajouté
trois scénarios, sans dupliquer ni effacer les autres exigences. Le test
démontre MODIFIED, **pas REMOVED ni RENAMED**. L'archive du change est dans
openspec/changes/archive/2026-10-15-ts-009/.

## Incident et reprise : TS-009

La PR #24 contenait seulement le plan et a été fusionnée trop tôt. Le
premier apply, run 38710098331, a créé localement le code et passé 54 tests,
mais la checklist 4.3 demandait un diff **après** sync tandis que le workflow
exigeait toutes les cases cochées **avant** sync. Arrêt protecteur légitime,
sans commit distant : les fichiers locaux du runner ont été perdus.

Le plan a été corrigé sur la branche persistante de TS-009 : contrôle pré-sync
dans la checklist et revue post-sync hors cases à cocher. Le second
[apply 38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641)
a entièrement réussi et publié la PR #26, désormais fusionnée. La PR #25
prévoit une détection statique anticipée de cet anti-pattern. **Ne pas relancer
TS-009**, son change est archivé et son code est livré.

Ce cas rappelle que le plan fusionné dans main avant apply est une exception,
pas le parcours recommandé : conserver le plan en PR brouillon, exécuter
apply sur la branche d'agent, puis fusionner la PR finale.

## Incident du 15 octobre 2026 : workflow manuel temporairement invalide

La fusion de la [PR #29](https://github.com/cedricmenec/threadstep/pull/29)
a introduit une régression dans `.github/workflows/agent.yml` : garde-fou
`grep` tronqué et fin du job dupliquée. GitHub a alors affiché le chemin du
workflow et émis des exécutions en erreur, sans jobs, lors de pushs. Voir
[run 38745517607](https://github.com/cedricmenec/threadstep/actions/runs/38745517607).
La CI de main et Pages avaient réussi, car l'ancien pipeline ne vérifiait
pas la syntaxe complète des workflows.

La [PR #30](https://github.com/cedricmenec/threadstep/pull/30) a **corrigé**
le YAML de l'agent manuel et ajouté Actionlint épinglé ainsi qu'un
contrôle de syntaxe Bash des blocs `run`. La CI de main et Pages ont réussi
après #30. L'agent manuel est à nouveau disponible, mais son chemin
**auto-merge direct** reste non vérifié en E2E. Voir [ASF-WF-003](tasks/ASF-WF-003.md).

## Risques et limites encore ouverts

1. **Protection active, auto-merge OpenSpec éprouvé** : `protected: true`,
   ruleset `Protect Main` (id 25163425), PR et contrôle CI `check`
   obligatoires, source GitHub Actions (integration_id 15368).
   TS-010/TS-011 ont prouvé un succès de fusion automatique après CI.
   **Non prouvé** : refus E2E sur CI rouge, fusion automatique du mode direct
   et robustesse en présence de conflits/reviews requis.
2. **Budget** : aucun plafond OpenRouter USD exécutable par run/vague, ni
   comptabilité fournisseur corrélée aux runs. Chaque lancement effectif
   reste une opération à autoriser.
3. **Reproductibilité** : OpenCode épinglé à `1.19.0` sur les trois agents et vérifié par le smoke test CI ; OpenSpec reste épinglé à `1.14.1`. Toute évolution de version demande une PR factory avec preuve d'installation Linux.
4. **Isolation** : empreintes SHA-256 et filtres de chemins sont des
   protections de fichiers, non une sandbox contre les actions du modèle.
5. **Couverture OPSX** : MODIFIED vérifié ; REMOVED, RENAMED, conflits de
   modifications multiples non encore démontrés.
6. **Reprise transactionnelle** : pas de checkpoints distants automatiques
   pour chaque étape d'apply, comme illustré par le premier run TS-009.
7. **Validation UI** : 97 tests Node et Pages réussis après TS-011 ;
   pas de preuve d'une recette complète sur mobile physique ou lecteur d'écran.
8. **Synchronisation des statuts** : les métadonnées des tâches du backlog
   nécessitent encore une tenue manuelle, désormais réconciliée par
   [ASF-DOC-001](tasks/ASF-DOC-001.md).

## Étapes suivantes recommandées

- **Maintenir** le ruleset `Protect Main`, le statut obligatoire `check`
  et l'absence de contournement ; tester spécifiquement un cas CI rouge
  et le chemin auto-merge du workflow direct.
- Maintenir l'épingle et sa recette CI OpenCode, tracer les coûts fournisseur et fixer une politique
  de dépenses/reprises proportionnée.
- Préparer une nouvelle expérimentation **distincte** pour REMOVED/RENAMED
  ou une fusion sémantique conflictuelle, sans rejouer TS-009.
- Étudier la persistance de checkpoints et l'orchestration par vagues,
  avec déclenchement payant toujours explicite et respect du ruleset.
- Maintenir cette page, la roadmap, les ADR et les statuts du backlog
  à chaque livraison.

## Documentation de référence

[Mode opératoire](openspec-manual-pilot.md) ·
[Protocole OpenSpec](openspec-protocol.md) ·
[Sécurité GitHub](github-autonomy-and-security.md) ·
[Décisions](decisions.md) ·
[Roadmap](roadmap.md) ·
[Tâches de réconciliation](tasks/ASF-DOC-001.md) et
[ASF-DOC-002](tasks/ASF-DOC-002.md).

## Évolution proposée : ASF-BOOT-001 (en revue, non déployée)

La PR bootstrap propose un exécuteur **manuel** de tasks ASF-V2 avec jobs séparés, politique de chemins figée, PR en revue humaine, et exclusion explicite des changements de workflows (ASF-V2-008/009) jusqu'à la conception d'une voie de publication avec revue humaine avant push. Aucune preuve E2E payante, aucune activation, aucun changement de secret ou de protection main ne sont revendiqués avant fusion et tests. Voir [agent-asf-manual.md](agent-asf-manual.md) et [ASF-BOOT-001](tasks/ASF-BOOT-001.md).

## Correction proposée ASF-BOOT-002 : preuve GitHub de dépendance (en PR)

Après la livraison ASF-V2-001 en PR #40, deux tentatives ASF-V2-002 ont échoué en précontrôle (runs 38821781408, 38822070883) car la fiche précédente demeurait `ready`. Aucune facture OpenRouter n'a été engagée par ces runs. La PR #41 a réconcilié le statut et ses preuves. Le changement ASF-BOOT-002 propose de lire directement les preuves GitHub pendant le précontrôle de l'Agent ASF, indépendamment d'un statut de tâche documentaire encore non actualisé. Tant que cette PR n'est pas fusionnée et validée, ne pas décrire cette capacité comme opérationnelle.

## Implémentation ASF-V2-002 : index déterministe (sur main)

[ASF-V2-002](tasks/ASF-V2-002.md) apporte un parseur YAML strict, un
validateur de backlog et les projections `backlog/index.json` /
`backlog/archive-index.json`, avec `check` intégré à `npm run check`. Détails
dans [index déterministe](backlog-v2-index.md). L'implémentation est présente
sur `main` par la PR #43 (commit de fusion `294c67f`) ; la vérification GitHub
indépendante de cette PR n'est pas rejouée ici. Aucun appel OpenRouter payant
n'a été effectué pour cette tâche.

## Migration historique ASF-V2-003 (en revue, non fusionnée)

[ASF-V2-003](tasks/ASF-V2-003.md) ajoute le frontmatter V2 aux onze tâches
`backlog/tasks/TS-NNN.md` **sans modifier leur corps** (critères, cases non
cochées et preuves conservés), classe `TS-003` en dette factory, régénère
`backlog/index.json` (11 fiches actives, 0 archivée) et simplifie
`backlog/README.md`. Décisions, inventaire et incertitudes dans
[migration historique](backlog-v2-migration.md). Toutes les tâches historiques
portent `automation: manual` et `risk: unknown` : elles ne sont jamais
sélectionnées automatiquement. Preuve locale uniquement : `npm run check`
exécuté sur la branche de la PR → 137 tests réussis, `backlog:check`
(11 actifs, 0 archivé), puis `node --check` sur `site/core.js` et
`site/app.js`. Aucun workflow n'est modifié. Tant que la PR n'est pas
fusionnée avec une CI `check` indépendante réussie sur le bon SHA, cette
migration ne doit pas être décrite comme livrée sur `main`.

## Noyau pur du scheduler ASF-V2-004 (en revue, non fusionné)

[ASF-V2-004](tasks/ASF-V2-004.md) ajoute le [noyau pur du scheduler](scheduler-core.md)
sous `scripts/asf/scheduler/` : décision déterministe à partir d'entrées
injectées uniquement (instantané de backlog validé, manifeste de vague figé,
preuves de livraison/conflit, journal), sans réseau, sans horloge, sans mutation
et sans aucun dispatch. L'éligibilité V1 exige `product`/`ready`/`allowed`/`low`,
un hash autorisé, l'absence de livraison/tentative/conflit et des dépendances
prouvées livrées ; l'ordre est priorité, puis `created_at`, puis `id`. Les
preuves ambiguës, un hash divergent ou un instantané invalide produisent
`STOP_UNCERTAIN`, le quota épuisé `QUOTA_REACHED`. Preuve locale uniquement :
`node --test tests/asf-scheduler-core.test.mjs` → 30 tests réussis, puis
`npm run check` → 167 tests réussis, `backlog:check` (11 actifs, 0 archivé) et
`node --check` sur `site/core.js` et `site/app.js`. Tant que la PR n'est pas
fusionnée avec une CI `check` indépendante réussie sur le bon SHA, ce noyau ne
doit pas être décrit comme livré sur `main`, et aucun appel OpenRouter payant
n'a été effectué pour cette tâche.

## Simulation dry-run du scheduler ASF-V2-005 (en revue, non fusionnée)

[ASF-V2-005](tasks/ASF-V2-005.md) ajoute la [simulation dry-run](scheduler-dry-run.md)
sous `scripts/asf/scheduler/` : une CLI (`dry-run.mjs`) et des fixtures
(`fixtures.mjs`) qui réutilisent le noyau pur ASF-V2-004 et n'ont **aucun
effet** — pas d'appel OpenRouter, pas de dispatch, pas de réservation de quota,
pas d'écriture de journal. Elle expose les candidates, leurs motifs d'exclusion,
l'ordre potentiel et distingue les livraisons `verified`, l'état `unknown`
(→ `STOP_UNCERTAIN`, jamais présumé libre) et les `assumptions` hypothétiques
(projection explicitement non probante). Un backlog vide termine `NO_WORK` avec
zéro dispatch. Preuve locale uniquement : `node --test
tests/asf-scheduler-dry-run.test.mjs` → 16 tests réussis, puis `npm run check`
→ 183 tests réussis, `backlog:check` (11 actifs, 0 archivé), `node --check` sur
`site/core.js` et `site/app.js`. Aucun workflow n'est modifié. Tant que la PR
n'est pas fusionnée avec une CI `check` indépendante réussie sur le bon SHA,
cette CLI ne doit pas être décrite comme livrée sur `main`, et aucun appel
OpenRouter payant n'a été effectué pour cette tâche.

## Manifeste immuable, journal durable et quotas ASF-V2-006 (en revue, non fusionné)

[ASF-V2-006](tasks/ASF-V2-006.md) ajoute le [manifeste immuable, le journal
durable et les quotas](wave-manifest-journal.md) sous `scripts/asf/waves/` :
création d'un manifeste figé et gelé (SHA source, candidates + hash, identité de
vague, allowlist de modèle, `limits` `1..2`/`1`/`0`, `openspec`, `auto_merge`,
référence d'autorisation sans secret), journal append-only à états (`SELECTED`,
`DISPATCH_RESERVED`, `EXECUTING`, `PR_PUBLISHED`, `CI_PENDING`, `MERGE_PENDING`,
`DELIVERED`, `FAILED`, `UNKNOWN`), réservation du quota **avant** dispatch et
arrêt au premier échec. Le stockage durable simulé applique une comparaison de
SHA attendu (compare-and-swap) ; les fenêtres de crash avant, pendant et après
dispatch ainsi que les conflits de mise à jour sont testés sans paiement. Une
issue de dispatch incertaine produit `STOP_UNCERTAIN` et interdit tout second
dispatch automatique. Preuve locale uniquement : `node --test
tests/asf-waves-manifest.test.mjs` → 9 tests réussis, `node --test
tests/asf-waves-journal.test.mjs` → 18 tests réussis, puis `npm run check` → 210
tests réussis, `backlog:check` (11 actifs, 0 archivé), `node --check` sur
`site/core.js` et `site/app.js`. Aucun workflow n'est modifié. Tant que la PR
n'est pas fusionnée avec une CI `check` indépendante réussie sur le bon SHA, ce
manifeste, ce journal et ce moteur de quota ne doivent pas être décrits comme
livrés sur `main`, et aucun appel OpenRouter payant n'a été effectué pour cette
tâche.

## Adaptateur GitHub de vérification des livraisons ASF-V2-007 (en revue, non fusionné)

[ASF-V2-007](tasks/ASF-V2-007.md) ajoute l'[adaptateur GitHub de vérification
des livraisons](delivery-verification.md) sous `scripts/asf/github/` et
`scripts/asf/delivery/` : une observation GitHub **en lecture seule** qui
distingue un run `success` d'une livraison réellement vérifiée. Le verdict pur
`verifyDelivery` renvoie `verified` (PR finale fusionnée à la branche, au
`head SHA`, à la base `main` et à l'auteur attendus, contrôle indépendant
`check` prouvé sur le SHA de tête et le commit de fusion, commit présent dans
`main`, runs post-fusion `CI`/`Pages` verts), `pending` (PR ouverte/brouillon,
run ou contrôle manquant, attente post-fusion — ne débloque rien) ou `unknown`
(erreur API, pagination tronquée, PR ambiguë ou concurrente, identité/SHA
divergents, contrôle absent ou non prouvé). Le client borne la pagination
(`truncated`) et les timeouts et convertit toute erreur en valeur d'erreur,
**jamais** en absence de conflit. Livré mais non archivé satisfait une
dépendance ; l'archivage est observé mais ne conditionne pas le verdict. Preuve
locale uniquement : `node --test tests/asf-github-delivery.test.mjs` → 23 tests
réussis, puis `npm run check` → 233 tests réussis, `backlog:check` (11 actifs,
0 archivé), `node --check` sur `site/core.js` et `site/app.js`. Aucun workflow
n'est modifié. Tant que la PR n'est pas fusionnée avec une CI `check`
indépendante réussie sur le bon SHA, cet adaptateur ne doit pas être décrit
comme livré sur `main`, et aucun appel OpenRouter payant n'a été effectué pour
cette tâche.

## Recette E2E progressive ASF-V2-011 (recette simulée, en revue, non fusionnée)

[ASF-V2-011](tasks/ASF-V2-011.md) ajoute la [recette E2E progressive](e2e-validation.md)
(`scripts/asf/fixtures/e2e.mjs`, `tests/asf-e2e-validation.test.mjs`) : six
scénarios déterministes **hors paiement** qui réutilisent les modules purs
ASF-V2-004..010 et prouvent la logique de contrôle de l'orchestrateur. Backlog
vide ⇒ `NO_WORK` et zéro départ ; une dépendance livrée `verified` débloque son
dépendant dans la même vague figée ; les trois fenêtres de crash sont fermées
(`DISPATCH` avant, `STOP_UNCERTAIN` pendant `DISPATCH_RESERVED`, `IN_FLIGHT`
après, jamais de second dispatch) ; une CI rouge simulée n'est **jamais**
`verified` et produit `STOP_FAILED` sans fusion forcée ; une vague à deux tâches
réserve exactement deux départs (`QUOTA_REACHED` sur le troisième) avec recalcul
dynamique ; un accès concurrent est refusé par compare-and-swap et par le verrou
global de développement payant. Preuve locale : `node scripts/asf/fixtures/e2e.mjs`
→ 6/6 scénarios OK, `paidCalls = 0`, `dispatches = 0` ; `node --test
tests/asf-e2e-validation.test.mjs` → 10 tests réussis, puis `npm run check`.

**Non exécuté et non revendiqué** : phases **payantes** (pilote à une tâche,
vague à deux tâches, cas CI rouge réel), vérification au moment de la recette du
ruleset `Protect Main`, du `check` requis, des permissions réelles de la GitHub
App et de l'absence de bypass, CI GitHub indépendante sur le bon SHA, fusion,
post-fusion `main`/`Pages`, création réelle de PR documentaire. Aucun appel
OpenRouter payant n'a été effectué pour cette tâche ; la fusion de cette PR
n'autorise pas ces phases.
