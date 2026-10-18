# Cycle de vie Dexie : spécifications cibles versionnées (v1.0)

**Statut au 18 octobre 2026 : exigences produit approuvées, implémentation en cours de planification.** Cette cible reprend les huit spécifications validées dans [Notion](https://app.notion.com/p/3fd12ac9163681769406d0e98180b7ef). La [spécification historique](dexie-cloud-local-first.md) et les anciennes exigences OpenSpec sont conservées comme sources de traçabilité ; leur présence ne prouve pas qu'elles satisfont la nouvelle cible.

## Décision et invariants

1. Une application intégratrice commence avec un **espace IndexedDB/Dexie autonome**, durable et utilisable sans URL Cloud, OTP ou connectivité.
2. L'activation de Dexie Cloud est **facultative**, explicite, tardive et distincte de la migration du format historique.
3. Les données locales historiques sont **isolées du workspace synchronisé** jusqu'au consentement de transfert portant sur une destination et un plan réellement présentés. La simple configuration de l'addon peut initier une réplication : ne pas mettre le contenu non consenti dans une table synchronisée, et ne pas considérer `sync({ purpose: 'pull' })` comme une barrière anti-push.
4. La réussite de la transaction IndexedDB ne démontre pas une synchronisation distante ; le diagnostic sépare local, connexion, pull, push et erreur.
5. Migration locale, fusion/réconciliation, import JSON et restauration ont des objectifs et contrats distincts. Les identités métier restent stables, sans préfixage récursif ni réimport dupliqué.
6. Pas de purge, copie entre instances, changement de compte, écrasement ou envoi de données implicite. Les erreurs et les reprises sont non destructrices et observables.

## Contrats OpenSpec approuvés (cible générique)

| Capability | Rôle |
|---|---|
| [local-indexeddb-persistence](../../../openspec/specs/local-indexeddb-persistence/spec.md) | Démarrage et écritures locales indépendants du Cloud |
| [cloud-opt-in-activation](../../../openspec/specs/cloud-opt-in-activation/spec.md) | Connexion volontaire et découverte distante, sans push pré-consentement |
| [cloud-sync-lifecycle](../../../openspec/specs/cloud-sync-lifecycle/spec.md) | Réplication native, statuts et diagnostic |
| [legacy-storage-migration](../../../openspec/specs/legacy-storage-migration/spec.md) | Conversion historique vers la base locale autonome |
| [data-reconciliation](../../../openspec/specs/data-reconciliation/spec.md) | Inventaire, conflits, copies, plan revalidé |
| [data-backup-import-restore](../../../openspec/specs/data-backup-import-restore/spec.md) | JSON, déduplication, fusion et restauration explicite |
| [workspace-identity-isolation](../../../openspec/specs/workspace-identity-isolation/spec.md) | Isolation des comptes/instances et déconnexion sans purge |

## Profil de produit, non généralisable

[threadstep-integration-profile](../../../openspec/specs/threadstep-integration-profile/spec.md) fixe pour ThreadStep les objets `subjects`/`items`, `parentId`/`subjectId`, les 40 sujets et 500 étapes par sujet, la clé V1 `threadstep.document.v1`, les exports compatibles V1, la destination `dexie.cloud` et le login natif OTP email. Ces contraintes **ne sont pas propagées aux sept capacités génériques**. Un autre produit doit fournir son propre profil pour clés/stores/droits/authentification/formats/tests.

## Compatibilité et précédence pendant la transition

Les capacités OpenSpec existantes `dexie-cloud-configuration`, `dexie-local-database`, `email-otp-authentication`, `legacy-document-migration`, `local-first-business-persistence` et `cloud-migration-reconciliation` décrivent en partie le parcours livré jusqu'à TS-031, notamment une configuration Cloud obligatoire pour accéder au mode métier synchronisé. Ce **n'est pas** l'architecture cible de ThreadStep.

- Pour **les nouvelles tâches TS-032 à TS-039**, les huit spécifications ci-dessus constituent les exigences cibles approuvées. En cas de contradiction avec l'ancien parcours « Cloud obligatoire », la cible approuvée prime pour la partie modifiée, mais l'agent MUST documenter explicitement le delta et mettre à jour les capacités historiques affectées au moment de chaque changement via OpenSpec sync. Ne pas ignorer silencieusement les contradictions.
- Pour **le comportement livré**, consulter `site/`, les tests et les PR fusionnées ; les nouvelles capacités ne sont pas des preuves de livraison.
- Ne pas modifier rétroactivement les archives `openspec/changes/archive/`. Les phases de plan/apply restent distinctes des recettes manuelles et CI post-sync.

## Décision complémentaire (18 octobre 2026) — fin de compatibilité V1 après transition

La tâche [TS-040](../../../backlog/tasks/TS-040.md), à exécuter **après TS-036 à TS-039**, prévoit d'éliminer du runtime le stockage métier historique `localStorage` et le **support des sauvegardes/documents V1**. Cette décision ultérieure complète la cible initiale, qui demandait encore de conserver la récupération du V1 : les exigences canoniques concernées devront être adaptées **par deltas OpenSpec lors de l'implémentation**, avec traçabilité de la décision et conservation des archives.

**Ordre de sécurité impératif :** les sauvegardes produites **aujourd'hui à partir d'IndexedDB** utilisent encore la forme JSON `version: 1` de `recordsToDocument`. Avant de retirer le lecteur V1, livrer un nouveau format de sauvegarde **IndexedDB versionné, exportable et restaurable**, avec recette sur profil de test et avertissement de changement de format. Il n'est ensuite **pas nécessaire** de conserver la compatibilité des anciens exports V1. Ne jamais supprimer automatiquement les clés historiques : nettoyage local ciblé uniquement après intégrité de la base et sauvegarde moderne vérifiées, avec consentement.

## Ordre de réalisation et dépendances

| Étape | Tâche | Issue principale |
|---|---|---|
| 1 | [TS-032](../../../backlog/tasks/TS-032.md) | IndexedDB autonome, sans Cloud |
| 2 | [TS-033](../../../backlog/tasks/TS-033.md) | Migration V1 vers local Dexie |
| 3 | [TS-034](../../../backlog/tasks/TS-034.md) | Diagnostic états natifs et premier pull |
| 4 | [TS-035](../../../backlog/tasks/TS-035.md) | Imports/restaurations idempotents |
| 5 | [TS-036](../../../backlog/tasks/TS-036.md) | Réconciliation liée au plan affiché |
| 6 | [TS-037](../../../backlog/tasks/TS-037.md) | Activation opt-in et premier push consenti |
| 7 | [TS-038](../../../backlog/tasks/TS-038.md) | Isolation URL/utilisateur, logout/purge |
| 8 | [TS-039](../../../backlog/tasks/TS-039.md) | Tests E2E, sécurité et recette Chrome mobile |
| 9 | [TS-040](../../../backlog/tasks/TS-040.md) | Retrait des données métier localStorage et formats de sauvegarde V1 après migration vers des exports IndexedDB versionnés |

Les tâches sont `ready` pour **préparer un plan** mais `automation: manual` / `risk: high`. Ne pas lancer de modèle OpenSpec payant sans autorisation de l'utilisateur. La validation CI peut attester le format du dépôt et les tests statiques, **pas** la fiabilité de la synchronisation sur un vrai service distant.

## Recette non négociable

Sur une **instance Dexie Cloud isolée**, avec export de secours et deuxième navigateur : première utilisation offline, activation tardive avec cible vide et peuplée, conflits et changements entre preview et commit, réimport d'anciens JSON, propagation bidirectionnelle, changement de compte/URL, déconnexion avec mutations en attente, reboot et erreurs réseau. Aucun test destructeur en base personnelle.

**Référence de suivi :** [journal d'implémentation Notion](https://app.notion.com/p/3fc12ac91636815a88a8e55164604d6a).
