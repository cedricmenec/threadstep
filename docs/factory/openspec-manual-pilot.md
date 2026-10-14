# Pilote OpenSpec manuel : plan, apply et auto

Ce pilote introduit un **second workflow** : `.github/workflows/agent-openspec.yml`.
Le workflow historique `agent.yml` continue de fonctionner sans OpenSpec.
Aucun exécuteur payant ne se déclenche sur `push`, `pull_request` ni automatiquement.

## Utilisation

1. Préparer et fusionner dans `main` une tâche `backlog/tasks/TS-NNN.md` prête.
2. Aller dans **Actions → Agent OpenSpec (manual, staged) → Run workflow**, sur `main`.
   Saisir `task_id=TS-NNN`, `phase=plan` et choisir le modèle. **Ce lancement
   exécute OpenCode/OpenRouter et peut donc coûter de l'argent**, même sans coder.
3. Le workflow crée/réutilise `agent/openspec/TS-NNN`, prépare les artefacts sous
   `openspec/changes/ts-nnn/`, valide leur structure, exécute `npm run check`,
   et ouvre une **PR brouillon**. Inspecter proposition, design, deltas de specs et
   checklist avant toute phase suivante. Aucune modification produit autorisée en `plan`.
4. Une fois le plan revu, relancer volontairement **le même workflow** depuis
   `main`, avec `task_id=TS-NNN` et `phase=apply`. Cette phase utilise le
   change préexistant, implémente et teste, vérifie la checklist, puis exécute
   `openspec archive ... --yes`. L'archivage OpenSpec **synchronise les deltas**
   dans `openspec/specs/` et déplace le change dans `openspec/changes/archive/`.
   La PR existante est mise à jour et marquée prête pour revue.
5. Les PR des agents sont désormais publiées avec un jeton temporaire de la GitHub App. Vérifier que la CI démarre et réussit, puis **contrôler la CI et le diff** avant fusion humaine.

## Checklist de documentation de cette évolution

- [x] Documenter les trois modes `plan`, `apply` et `auto` et leur coût.
- [x] Documenter les vérifications avant apply, les tests, la synchronisation et l'archivage.
- [x] Documenter les limites : pas de revue intermédiaire, pas de plafond USD garanti, fusion manuelle.
- [x] Mettre à jour le contrat `AGENTS.md` et la méthodologie pour rendre obligatoire une tâche documentaire sur les futures évolutions de la factory.

## Mode auto : un seul lancement, sans validation intermédiaire

Choisir `phase=auto` et `task_id=TS-NNN` dans le même workflow, après fusion
de la tâche de backlog sur `main`. Ce choix autorise **deux appels OpenCode /
OpenRouter** successifs au cours d'un même run : d'abord plan, puis apply.
Le plan est validé strictement et contrôlé pour éviter des modifications hors
du répertoire du change ; il est enregistré dans un commit local avant apply,
afin de détecter toute réécriture des artefacts validés. Après apply, le workflow
exige les tests, une checklist entièrement cochée et la validation OpenSpec,
puis synchronise les deltas par `openspec archive --yes` et ouvre une PR
**non brouillon** avec le code et les specs finales. La fusion reste manuelle.

Un échec bloque les étapes suivantes et empêche la publication finale. En
particulier, le plan n'est pas publié en PR intermédiaire en mode auto.
Le timeout du job est de 60 minutes, mais **aucun plafond USD garanti** n'est
appliqué. `auto` ne doit être choisi que pour une tâche petite, claire et
préapprouvée. En cas d'ambiguïté métier, préférer `plan` puis `apply`.

## Invariants et limites

- La GitHub App est utilisée pour publier branches et PR ; aucun auto-merge,
  orchestrateur ou provisionnement de secrets n'est effectué par ce workflow.
- `plan` et `apply` restent déclenchés séparément. `auto` est un déclenchement
  explicite unique qui autorise les deux phases payantes, mais ni la fusion de
  la PR ni l'exécution d'une autre tâche.
- Une PR `plan` ne doit contenir que `openspec/changes/ts-nnn/**` ; `apply`
  bloque les changements de workflows, `AGENTS.md`, secrets, backlog et
  configuration de l'exécuteur. Ces gardes ne remplacent pas une isolation sandbox.
- `apply` échoue sans plan valide, si la checklist reste incomplète, si les tests
  échouent ou si la validation/archivage échoue. L'échec ne fusionne rien.
- Branches/PR réutilisables par ID ; une même tâche ne peut pas être lancée
  simultanément sur les deux phases. Ne pas réutiliser un ID déjà archivé.
- L'implémentation peut encore consommer plusieurs essais ou dépasser une dépense
  souhaitée : **pas de plafond USD techniquement appliqué**. Budget et reprise
  transactionnelle restent des étapes futures.
- OpenSpec CLI épinglé sur `@fission-ai/openspec@1.14.1` ; le mode `auto`
  reste à valider par un run réel. OpenCode conserve actuellement
  `opencode-ai@latest`, comme le pilote précédent.
- Ce dispositif est un prototype : CI indépendante sur PR et merge manuel restent
  obligatoires ; les mécanismes de confirmation de périmètre sont encore à renforcer.

## Essai contrôlé recommandé

Choisir une **nouvelle petite tâche de comportement** non déjà réalisée, exécuter
`plan` puis inspecter les fichiers. Si les fichiers ne sont pas conformes, ne
pas lancer `apply`. Ensuite lancer `apply` et contrôler le verdict du workflow,
l'archive et les specs canoniques, les tests et la CI de la PR.
