# ASF-OPSX-01 | Contrat de checklist OpenSpec exécutable

**Décision : 17 octobre 2026.** Norme de rédaction du `tasks.md` OpenSpec
produit par la factory ThreadStep. Elle renforce le contrat de phases déjà
existant, sans remplacer les règles de vérification des livraisons.

## Motif et périmètre

Le run [TS-017 #39019660492](https://github.com/cedricmenec/threadstep/actions/runs/39019660492)
a réussi sa génération et son application mais a échoué avant OPSX sync :
`Unchecked tasks remain; refusing archive`. Son plan comprenait neuf
cases non réalisées, notamment des recettes d'interface navigateur
et tactile. La publication de PR n'a jamais commencé, donc aucun code
de ce run n'a été poussé sous `agent/openspec/TS-017`.

**ASF-OPSX-01** corrige le **contrat donné au planificateur et à
l'implémenteur**, pas encore la détection mécanique complète des
checklists impossibles (**ASF-OPSX-02**) ni la sauvegarde d'un travail
non publié (**ASF-OPSX-03**).

## Structure normative de tasks.md

### 1. Implementation checklist (pré-sync, cases autorisées)

- Chaque entrée de type `- [ ]` ou `- [x]` doit représenter une
  modification ou vérification **réalisable, observable et prouvable**
  pendant `apply` **sur le runner courant**, avant la synchronisation
  sémantique OPSX, l'archivage et toute publication.
- Exemples admissibles : fonctions, rendu DOM généré, styles,
  attributs accessibles vérifiables automatiquement, tests Node,
  compatibilité d'import JSON, `npm run check`, validation OpenSpec
  locale, vérifications de non-mutation déterministes.
- Pour chaque critère produit, prévoir une preuve automatisable lorsque
  raisonnablement possible. **Le critère fonctionnel reste exigible**
  même si ses dimensions d'usage humain ne sont pas prouvables en CI.
- L'agent coche uniquement les opérations vraiment effectuées et
  réussies. En cas d'échec de test ou de spécification, ne pas cocher :
  bloquer explicitement, sans inventer une preuve.

### 2. Manual acceptance (hors checklist)

- **Section narrative sans cases à cocher**, répertoriant
  les vérifications qui nécessitent un vrai navigateur, téléphone,
  revue visuelle, toucher, navigation Tab/Entrée/Espace, focus réel,
  lecteur d'écran, ou inspection manuelle de l'export/import.
- Ne pas confondre une assertion DOM/un test automatisé avec une
  campagne d'accessibilité, mobile ou ergonomique réellement exécutée.
- Ces scénarios restent **obligatoires pour l'acceptation humaine**
  et doivent être signalés comme `à vérifier` jusqu'à obtention
  d'une preuve réelle. Leur présence n'empêche pas le contrôle
  pré-sync d'archiver l'implémentation testée.

### 3. Post-sync review (hors checklist)

- **Section narrative sans cases à cocher** pour comparer les deltas
  sémantiques après OPSX sync, vérifier l'archive, puis la CI GitHub
  indépendante, la PR, la fusion, le déploiement GitHub Pages et
  toute revue de sécurité/diff ultérieure.
- Le workflow exécute les opérations sync/archive/publication :
  ne jamais demander de les accomplir dans une case de `apply`.
- Après publication, fournir les références effectives et séparer
  strictement travail livré, tests CI réussis et recette humaine
  non encore effectuée.

Voir [l'exemple complet de tasks.md](examples/openspec-tasks-example.md)
avec checklist vérifiable et deux rubriques narratives.

## Points d'insertion opérationnels

- `AGENTS.md` : règle générale de l'agent, à lire avant le plan.
- `openspec/config.yaml` : contraintes `rules.tasks` utilisées
  lors de la génération du change.
- `.github/workflows/agent-openspec.yml` : prompt `plan`
  renforcé et instruction `apply` ne cochant que le travail prouvé.
- `scripts/check-openspec-task-phases.mjs` : détecteur existant
  des cas post-sync dans les cases ; **inchangé dans cette tâche**.
- Les tests statiques protègent les formulations du contrat dans
  ces entrées, sans facturer de modèle.

## Validation et limites

- Vérifier `npm run check`, Actionlint, la validation OpenSpec et
  le contrôle indépendant GitHub `check` sur la PR.
- Une CI verte prouve ici les modifications du contrat et leurs
  tests statiques, **pas la conformité d'un plan produit généré
  avec un modèle payant**. Aucune exécution OpenRouter n'est
  nécessaire ni autorisée pour tester ASF-OPSX-01.
- Le validateur existant refuse des références post-sync
  détectables dans des cases, mais ne sait pas rejeter de manière
  générale toutes les tâches UI manuelles. Un plan `auto`
  inadéquat peut encore atteindre `apply`. **ASF-OPSX-02** devra
  étendre le fail-closed de plan avant la première phase apply payante.
- Pour TS-017 à TS-020, privilégier un premier lancement
  **`phase=plan` autorisé explicitement**, relire les cases
  de `tasks.md` puis autoriser `apply` séparément. Aucun
  nouveau run ni dépense n'est déclenché par cette PR.
