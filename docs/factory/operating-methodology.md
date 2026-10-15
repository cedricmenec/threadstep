# Méthodologie et modes de fonctionnement

## 1. Cadrer par la voix, sans saisie manuelle de backlog

1. Le commanditaire explique un besoin et ses critères de valeur depuis ChatGPT sur téléphone.
2. L'assistant inspecte la vision métier, les specs, le code, `AGENTS.md` et les tâches existantes.
3. Il clarifie uniquement les décisions importantes ; découpe la demande en unités livrables si nécessaire.
4. Il produit une spécification fonctionnelle/technique proportionnée et les fichiers `backlog/tasks/TS-NNN.md`, selon `backlog/tasks/TEMPLATE.md` ; l'issue GitHub est facultative.
5. Il ouvre une PR documentaire ou pousse des documents selon autorisation, puis les rend disponibles sur `main` après contrôles.
6. La préparation du backlog **n'autorise pas** automatiquement une exécution payante.

## 2. Mode manuel : capacité permanente, pas mode provisoire

**Présentement réalisable :**
- `Actions → Agent (manual, OpenRouter) → Run workflow`, branche `main`, saisie de `task_id` et du modèle.
- L'agent lit le fichier de la tâche, effectue le développement, exécute `npm run check`, pousse une branche et ouvre/réutilise une PR.
- Les deux workflows publient via le jeton temporaire GitHub App ; la PR #21 de TS-008 a été créée par le bot, et sa CI s'est exécutée sans intervention supplémentaire. Ils proposent désormais `auto_merge=true` par défaut, qui n'est activé que pour une PR finale si le ruleset de `main` rend le check `check` obligatoire. Sinon la PR reste ouverte avec une erreur explicite. La fusion manuelle reste disponible.
- Une fois fusionné, CI sur `main` et Pages déploient la version testée.

**Évolution voulue :** proposer un bouton/commande `workflow_dispatch` avec `task_id`, `model`, `protocol`, `delivery` et budget autorisé ; **pas de dépendance obligatoire à un orchestrateur externe**. L'exécuteur reçoit et vérifie la même enveloppe de tâche qu'en mode automatique.

## 3. Mode orchestrateur externe : même exécuteur

- Acquiert le backlog et ses dépendances ; n'autorise que les tâches `ready` explicitement incluses dans la vague approuvée.
- Envoie le même contrat à un workflow réutilisable ou une API GitHub (déclenchement `workflow_dispatch`/`repository_dispatch`).
- Lit les verdicts réels des workflows GitHub, récupère la PR et le SHA, applique la politique de livraison, puis débloque les tâches dépendantes.
- Effectue au départ **une seule tâche en cours**, afin de simplifier conflits, coûts et observabilité.
- Ne décide jamais seul d'un changement fonctionnel risqué ou d'une migration destructive non spécifiée.
- Un éventuel dashboard ou processus serveur externe doit pouvoir tomber sans empêcher le lancement manuel.

## 4. Chaîne de développement cible par tâche

1. `authorize` : tâche prête, permission, modèle autorisé, plafond, mode de livraison.
2. `explore` : comprendre l'état du code et les spécifications canonisées.
3. `propose` : créer le change OpenSpec, proposition, design, specs delta et checklist.
4. `validate-plan` : vérifier la cohérence et les hypothèses.
5. `apply` : implémenter une tâche OpenSpec à la fois, tests, checkpoints Git durables.
6. `verify` : confronter exigences ↔ comportement ↔ tests et exécuter validation stricte.
7. `sync` : synchroniser les deltas OpenSpec avec les specs canoniques.
8. `archive` : archiver le change terminé, vérifier que les specs finales reflètent le code.
9. `publish` : pousser, ouvrir/réutiliser la PR, attendre CI indépendante, fusionner selon politique explicite.
10. `report` : statut, preuves, coût, références et prochaine action ; l'orchestrateur peut ensuite avancer.

**Distinction** : le workflow direct agent.yml travaille depuis le backlog sans OpenSpec ; agent-openspec.yml couvre plan/apply/auto/finalize, validations, synchronisation sémantique et archive. L'orchestrateur externe reste futur. Le mécanisme de commande OPSX native a été validé E2E sur TS-009 (run 38712079641, PR #26), avec garde-fou avant/après, synchronisation MODIFIED, archive et CI. Voir [current-state.md](current-state.md).

## 5. Documentation obligatoire pour toute évolution de la factory

Chaque PR qui modifie le moteur de la factory (workflows, agents, protocole OpenSpec, authentification GitHub App, CI, sécurité, coûts ou politique de livraison) inclut une **tâche de documentation explicite**, à cocher avant la fusion.

Checklist de référence :
- [ ] Identifier les documents `docs/factory/` concernés.
- [ ] Mettre à jour le fonctionnement réel, les paramètres non secrets, le mode opératoire, les limites et les garde-fous.
- [ ] Mettre à jour feuille de route et décisions lorsque le statut ou l'architecture évolue.
- [ ] Vérifier les liens, les exemples et la cohérence avec le workflow livré.
- [ ] Indiquer dans la description de PR les documents modifiés et ce qui reste non testé.

Cette exigence s'applique aussi aux évolutions réalisées directement par l'assistant via GitHub, et aux futures PR d'automatisation. Une exception documentaire doit être justifiée explicitement dans la PR. Ne jamais documenter de valeurs de secrets ou de clés privées.

## 6. Points de contrôle

- **Avant dépenses** : consentement sur tâche/vague et budget ; aucun secret dans le prompt publié.
- **Avant modification** : vérifier branche et SHA, sauvegarder la reprise.
- **Avant publication** : vérifier diff, interdiction de modifier les workflows, fichiers de secrets et politiques sans approbation spécifique.
- **Avant fusion** : réussite de la CI sur le SHA réel + OpenSpec vérifié + protections GitHub appliquées ; si un contrôle est en attente, stopper.
- **Après fusion** : vérifier présence sur `main`, pipeline `main`, déploiement si pertinent, rapport.

## 7. Procédure d'incident et reprise

Conserver la branche distante et ses checkpoints. Collecter workflow URL, horodatage, modèle, version OpenCode/OpenSpec, dernier SHA valide, OpenSpec `tasks.md`, échec vérifié. Ne jamais relancer sans tenir compte de la PR existante. Une relance dans le même `taskId` doit viser l'idempotence ; TS-009 illustre que la reprise n'est pas encore transactionnelle : les changements locaux d'un apply échoué ont été perdus, tandis que son plan versionné pouvait être repris. Après échec d'un test ou de sécurité, arrêter la vague plutôt que fusionner de force.

## 8. Retour d'expérience pilote

- `TS-002` : un agent exécuté sur demande a ouvert une PR documentaire, sans fusion automatique. Le workflow CI de PR créée avec `GITHUB_TOKEN` s'est trouvé en état `action_required` avant approbation humaine, puis a réussi.
- `TS-004` : exécution OpenCode terminée, PR #4 fusionnée, CI sur `main` et Pages réussies.
- `TS-005` : premier cycle OpenSpec plan/apply achevé, PR #8 fusionnée.
- PR #9 : jeton GitHub App ajouté aux deux workflows ; PR #21 (TS-008) et sa CI de PR réussie démontrent le fonctionnement. Après merge, CI main et Pages ont réussi.
- **TS-008 (PR #21)** : auto complet, 41 tests, sync guidée par prompt et archive réussies ; création ADDED seulement.
- **TS-009 (PR #26)** : plan/apply réussis après correction de la checklist, invocation de la commande OPSX native, sync MODIFIED d'une capacité existante, 55 tests pendant apply et 60 tests sur main après fusion, Pages réussi.
- **PR #25** : rejet en phase plan/pré-apply des cases post-sync dans les checklists, après l'incident du run 38710098331.
- **Limite actuelle** : déclenchement par tâche explicite, aucun scheduler, aucun budget USD garanti et aucune protection main confirmée. Voir [l'état courant](current-state.md).
