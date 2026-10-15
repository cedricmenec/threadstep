# État courant de l'Autonomous Software Factory

**Référence : 15 octobre 2026.** Point d'entrée pour la reprise et le résumé opérationnel. Le contrat exécutable est [AGENTS.md](../../AGENTS.md) et les workflows sont dans .github/workflows/. Vérifier le SHA et les logs GitHub avant toute opération.

## Architecture effectivement implémentée

- **Source de vérité** : dépôt public cedricmenec/threadstep, backlog Markdown sous backlog/tasks/, intention produit sous docs/product/, changements et spécifications OpenSpec sous openspec/.
- **Produit pilote** : application statique, navigateur et localStorage, import/export JSON, GitHub Pages, sans backend.
- **Exécution** : deux workflows GitHub Actions manuels, agent.yml (direct) et agent-openspec.yml (phases plan, apply, auto, finalize). Aucun ordonnanceur autonome.
- **Agents et versions** : OpenCode via OpenRouter. OpenSpec est épinglé sur @fission-ai/openspec@1.14.1 ; OpenCode reste installé par @latest, observé en 1.19.0 durant TS-008.
- **OPSX** : la présente PR propose de générer les skills et commandes OpenCode via openspec init --tools opencode,agents dans le runner éphémère, puis d'appeler opencode run --command opsx-sync. **Cette nouvelle invocation n'est pas encore testée E2E.** Historiquement, TS-008 a reçu une simple instruction évoquant /opsx:sync.
- **Livraison** : branches agent/openspec/TS-NNN, jeton temporaire de l'App threadstep-software-factory, PR et CI indépendante. Fusion humaine uniquement.
- **Coûts** : plan appelle au moins un modèle, apply au moins deux, auto au moins trois, finalize au moins un. Aucune limite USD techniquement garantie et aucun relevé de coût automatique.

## Incidents, preuves et jalons

| Référence | État vérifié |
| --- | --- |
| PR #8 | TS-005 : cycle OpenSpec plan/apply, fusion humaine. |
| PR #16 | Correction des étapes ignorées en mode auto durant TS-007. |
| PR #17 | Finalize introduit sans modèle, puis rendu payant par la PR #19. |
| PR #19 | Sync sémantique guidée par agent, puis archive --skip-specs. |
| PR #20 | Backlog et spécification produit TS-008. |
| PR #21 | TS-008 exécutée en auto, implémentée, archivée et fusionnée par cedricmenec. |
| Run 38645900430 | Toutes les étapes obligatoires exécutées, 41 tests réussis, OpenSpec valide. |
| Runs 38647009079 et 38647009093 | CI de main et Pages réussies après la PR #21. |

Liens : [PR #21](https://github.com/cedricmenec/threadstep/pull/21), [run agent](https://github.com/cedricmenec/threadstep/actions/runs/38645900430), [CI main](https://github.com/cedricmenec/threadstep/actions/runs/38647009079), [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38647009093).

TS-008 a créé la **nouvelle** capacité resume-tracking : 10 exigences et 31 scénarios dans le delta. Cette exécution ne démontre **pas encore** la fusion sémantique de MODIFIED/REMOVED/RENAMED dans une spécification canonique préexistante.

## Incident de reprise TS-009 (15 octobre 2026)

- PR #24 a fusionné le plan (et seulement le plan) avant apply.
- Le run [38710098331](https://github.com/cedricmenec/threadstep/actions/runs/38710098331)
  a réussi la génération de code, 54 tests Node et la validation du change,
  puis s'est arrêté sur « Unchecked tasks remain; refusing archive ».
- Cause : la case 4.3 attendait un diff post-sync alors que le workflow bloque
  toute case non cochée **avant** sync. Pas de sync, pas d'archive, pas de PR
  de code publiée : les modifications non commitées du runner ont été perdues.
- Une correction ciblée de tasks.md a été faite sur la branche
  agent/openspec/TS-009. Elle ne nécessite pas de refaire plan ; il faut
  relancer apply pour reconstruire le code puis effectuer sync. Le second run
  [38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641)
  a **réussi** (55 tests, commande OPSX, garde-fou de contenu, archive) et
  ouvert la [PR #26](https://github.com/cedricmenec/threadstep/pull/26).
  La CI de la PR est passée ; fusion encore soumise à revue. Une PR factory
  distincte (#25) empêche désormais les futurs plans impossibles après fusion.

## Risques et limites

1. **Intégration OPSX** : TS-009 run 38712079641 a confirmé la commande OpenCode opsx-sync, le garde-fou de contenu et une modification MODIFIED d'une capacité canonique existante. La sémantique de la spécification reste revue par un humain ; les opérations RENAMED/REMOVED n'ont pas encore été éprouvées.
2. **Protection de main** : GitHub signale protected: false au 15 octobre ; la lecture détaillée retourne 403 avec les permissions du connecteur. Aucune règle n'a été modifiée.
3. **Isolation** : le garde-fou proposé vérifie les empreintes des fichiers hors openspec/specs/ avant/après sync, y compris les fichiers déjà modifiés, et exige un changement canonique. Il ne remplace ni une sandbox, ni la validation sémantique humaine.
4. **Dépenses** : pas de plafond USD, ni de montant réel de TS-008 observé dans les logs ; aucune dépense sans consentement.
5. **Qualité UI** : CI/Node réussis, pas de preuve complète sur navigateur mobile et technologies d'assistance.
6. **Durabilité** : le plan auto est initialement commité localement ; checkpoints distants et reprise transactionnelle à industrialiser.
7. **Versionnement** : OpenCode installé à latest, à épingler après stabilisation du pilote.

## Suite recommandée

- Revoir puis fusionner cette PR de consolidation **après** la CI et la revue des changements ; ne pas la considérer comme une preuve E2E.
- Configurer la protection de main et des checks requis, sous autorisation de l'administrateur.
- Préparer TS-009 **dans une PR produit distincte**, avec une modification ciblée de next-action-suggestion : section MODIFIED et scénario ADDED pour tester une fusion dans une capacité existante.
- Seulement après autorisation explicite, exécuter un test payant borné, auditer le run, les fichiers modifiés, la checklist, les specs canoniques et le coût réel.
- Maintenir ce document, les ADR et la roadmap lors de chaque évolution en distinguant implémenté, testé et hypothèses.

## Références

[Mode opératoire](openspec-manual-pilot.md) · [Protocole OPSX](openspec-protocol.md) · [Sécurité GitHub](github-autonomy-and-security.md) · [Décisions](decisions.md) · [Feuille de route](roadmap.md) · [Outils OpenSpec](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md) · [OpenCode skills](https://opencode.ai/docs/skills/) · [OpenCode CLI](https://opencode.ai/docs/cli/).
