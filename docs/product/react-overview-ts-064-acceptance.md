# TS-064 | Attestation propriétaire de recette manuelle Overview React

**Statut : GO fonctionnel déclaré, avec limites de traçabilité.**  
**Date de déclaration : 26 octobre 2026.**  
**Source :** confirmation explicite du propriétaire dans la conversation de suivi DEV | ThreadStep, après la livraison de TS-064.

## Livraison technique concernée

- **Tâche :** [TS-064](../../backlog/tasks/TS-064.md).
- **PR produit :** [#214](https://github.com/cedricmenec/threadstep/pull/214), fusionnée le 26 octobre 2026.
- **Commit fusionné :** `e1e39f8b273ad85f97951163ae64394360031f4a`.
- **CI main :** [#40417372644](https://github.com/cedricmenec/threadstep/actions/runs/40417372644), terminée avec succès.
- **Pages :** [#40417372565](https://github.com/cedricmenec/threadstep/actions/runs/40417372565), déploiement terminé avec succès.
- **Attestation distincte des preuves CI :** le propriétaire déclare avoir fait la recette manuellement sur desktop et Android et que « tout semble bien aller » ; il considère la recette valide. Le navigateur exact, les versions, captures et relevés scénario par scénario n'ont pas été communiqués.

## Matrice de déclaration humaine

`PASS (déclaré)` signifie **validation globale exprimée par le propriétaire**, pas preuve indépendante ni procès-verbal par scénario. `NOT_RUN (non attesté)` indique qu'aucune exécution précise n'a été rapportée ; cela **ne prétend pas** que le propriétaire n'a jamais essayé ce scénario.

| Scénario / environnement | Statut enregistré | Preuve et limite |
| --- | --- | --- |
| Parcours fonctionnel TS-064 sur desktop réel | **PASS (déclaré)** | Recette manuelle réalisée et jugée valide par le propriétaire, déclaration du 26 octobre 2026 ; contrôles individuels non listés. |
| Parcours fonctionnel TS-064 sur appareil Android réel | **PASS (déclaré)** | Même déclaration explicite, sans version Android ni navigateur précisés. |
| Présence de la racine React Overview et du rendu des cartes | **PASS (observation console rapportée)** | Résultat utilisateur : `reactOverview: true`, `reactCards: 6`, `navigationReactRoot: true`, `devtoolsRenderers: 1`, `rendererNames: ['react-dom']` ; il s'agit d'une observation du navigateur, pas d'une recette fonctionnelle exhaustive. |
| Focus, clavier physique, tactile, scroll, états de chargement, filtres, changements d'espace et synchronisation | **NOT_RUN (non attesté individuellement)** | Inclus potentiellement dans la recette globale, mais aucun résultat distinct `PASS`/`FAIL` ni appareil/version n'a été fourni pour chaque scénario. |
| Lecteur d'écran, accessibilité perçue et instance Dexie Cloud de test isolée | **NOT_RUN (non attesté individuellement)** | Aucune preuve spécifique fournie, aucune affirmation de réussite. |

## Décision de dépendance pour TS-065

Le propriétaire a **expressément confirmé la recette manuelle globale desktop et Android de TS-064**, après le déploiement réel. Ce document consigne ce **GO fonctionnel humain déclaré** comme preuve de passage du prérequis produit `depends_on: TS-064` pour la préparation de TS-065.

Ce GO **n'autorise pas** à transformer les scénarios non attestés en `PASS`, à cocher la checklist OpenSpec `tasks.md` du modèle ou à déclarer l'accessibilité et la synchronisation multi-appareils vérifiées. Les essais spécifiques demeurent dans la section `Manual acceptance` de TS-065 et devront être réellement réalisés et tracés après sa livraison. La décision de lancer une phase OpenCode payante reste séparée.

## Pourquoi ce fichier est nécessaire

La section `Manual acceptance` d'un changement OpenSpec est volontairement **narrative et sans cases à cocher**. L'agent d'implémentation consulte les **fichiers du dépôt**, pas les déclarations non versionnées dans une conversation ni le seul état d'une page Notion. Aucune action manuelle de saisie GitHub n'était explicitée lors de TS-064.

Pour une prochaine dépendance produit :

1. L'utilisateur réalise la recette sur les environnements disponibles et indique explicitement le résultat (`GO`, `NO-GO` ou réserve), avec les scénarios et appareils réellement vérifiés s'il en possède le relevé.
2. L'assistant ou le responsable de livraison consigne cette déclaration dans un **rapport daté et versionné sous `docs/product/`**, avec liens vers la PR et la CI, et sépare `PASS` déclaré de `NOT_RUN` non attesté.
3. Ce rapport est livré sur `main` via PR et CI indépendante **avant** de lancer la tâche dépendante. Si le plan dépendant a déjà été sauvegardé sur `agent/openspec/TS-NNN`, il faut également faire apparaître le rapport sur **cette branche persistante** avant `apply`, sans réécrire le plan.
4. Le prochain agent vérifie le rapport réellement accessible et ne substitue pas une CI, un diagnostic de composants React ou un simple `GO` supposé aux preuves physiques.

**Aucune action sur les données IndexedDB, Dexie ou un espace utilisateur n'est impliquée par cette attestation.**
