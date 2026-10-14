# Pilote OpenSpec à deux phases, manuel

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
5. Approuver au besoin l'exécution de la CI sur PR créée avec `GITHUB_TOKEN`,
   puis **contrôler la CI et le diff** avant fusion humaine.

## Invariants et limites

- Aucune GitHub App, auto-merge, orchestrateur, provisionnement de secrets
  ni consommation OpenRouter lors de l'installation de ce pilote.
- Les **deux phases** payantes exigent un déclenchement explicite. Aucun lancement
  ne doit être traité comme approbation de la PR ou autorisation d'une autre tâche.
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
- OpenSpec CLI épinglé sur `@fission-ai/openspec@1.14.1`, compatibilité
  fonctionnelle **à valider en run réel**. OpenCode conserve actuellement
  `opencode-ai@latest`, comme le pilote précédent.
- Ce dispositif est un prototype : CI indépendante sur PR et merge manuel restent
  obligatoires ; les mécanismes de confirmation de périmètre sont encore à renforcer.

## Essai contrôlé recommandé

Choisir une **nouvelle petite tâche de comportement** non déjà réalisée, exécuter
`plan` puis inspecter les fichiers. Si les fichiers ne sont pas conformes, ne
pas lancer `apply`. Ensuite lancer `apply` et contrôler le verdict du workflow,
l'archive et les specs canoniques, les tests et la CI de la PR.
