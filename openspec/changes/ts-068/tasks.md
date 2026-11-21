# Tasks

## Implementation checklist

### 1. Project and task card presentation

- [ ] 1.1 Harmoniser la carte projet Overview et l'aperçu des tâches avec les styles locaux et tokens existants ; ajouter des tests déterministes prouvant que les cinq groupes Stitch sont statiques/désactivés, les compteurs canoniques et l'ordre restent corrects, et les commandes existantes sont préservées.
- [ ] 1.2 Harmoniser le détail React et les lignes de tâche ; ajouter des tests déterministes prouvant que les actions existantes restent inchangées, les nouveaux éléments n'agissent pas, et les champs projet ou activité absents n'affichent aucune valeur d'exemple.
- [ ] 1.3 Ajouter et exécuter des tests Node/jsdom qui vérifient les règles CSS aux largeurs 320, 390, 430, 768 et 1280 px, les classes/relations DOM parent-sous-tâche et les invariants de focus, scroll et brouillon après re-rendu.

### 2. Pre-sync verification

- [ ] 2.1 Exécuter les tests ciblés de présentation et d'interaction ; corriger les échecs puis relancer les tests concernés.
- [ ] 2.2 Exécuter `npm run check`, `npm run build` et `npm run verify:build` ; consigner leurs résultats réels.
- [ ] 2.3 Exécuter `openspec validate ts-068 --strict --no-interactive` et `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-068/tasks.md` ; corriger tout échec.
- [ ] 2.4 Exécuter `node scripts/agent-openspec-checkpoint.mjs apply ts-068` et vérifier que le diff exact pré-sync est accepté.

## Manual acceptance

Inspecter Overview et le détail projet dans de vrais navigateurs desktop et mobile à des largeurs représentatives. Comparer la hiérarchie visuelle aux références Stitch approuvées ; vérifier l'absence de débordement ou de troncature, la lisibilité des textes longs et l'apparence désactivée/statique des cinq groupes. Tenter les interactions clavier et tactiles sur chaque élément désactivé et confirmer qu'aucune action, navigation, recherche, modification de tri, date, partage ou archivage ne survient. Vérifier les commandes existantes de création, édition, achèvement, priorité, réordonnancement, sous-tâche, ouverture/retour et suppression/annulation ; contrôler focus, scroll, groupes développés et continuité des brouillons. La revue réelle avec lecteur d'écran, focus, cibles tactiles et navigateurs d'appareil reste distincte des tests automatisés. Ne consigner que les vérifications effectuées.

## Post-sync review

Après le checkpoint code, prendre une empreinte du dépôt avec `node scripts/sync-guard.mjs snapshot /tmp/ts-068-sync-before.json`, synchroniser uniquement `openspec/specs/`, vérifier l'empreinte et exécuter `openspec validate --all --strict --no-interactive`. Revoir le diff sémantique des specs, archiver `ts-068` avec `--skip-specs`, puis exécuter `openspec validate --all --strict --no-interactive` et `openspec validate --archived --strict --no-interactive`. Revoir l'archive et le diff final, lancer le checkpoint de publication, pousser la branche finale et ouvrir/actualiser la PR. Vérifier la CI indépendante sur le SHA exact de la PR. Fusionner seulement après autorisation explicite du propriétaire et réussite des contrôles requis ; après fusion, vérifier la CI de main et GitHub Pages.
