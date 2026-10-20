# ThreadStep | Product vision

ThreadStep helps one person keep track of their **next concrete action** across several parallel work subjects, including work that is awaiting asynchronous feedback.

## Problem
A conventional task manager often demands too much ceremony. A Markdown document works, but requires manual restructuring to make next steps visible.

## Users
Initially one person on desktop or mobile, without an account in the original MVP. The Dexie Cloud target stays individual-first but introduces native email OTP for synchronization.

## Core value
Open the page and immediately know what to resume next for each active subject.

## Product principles
- Short-term, actionable, intentionally minimal.
- One subject can contain several next actions and one level of substeps.
- Priorities: urgent, normal, later. Unfinished actions first through visual distinction.
- No mandatory due date, status workflow, sprint, team or notifications.
- Local-first storage remains central. The future Dexie Cloud synchronization is configured explicitly, with authentication and consent before transmitting historical local data.
- Explicit JSON export/import for portable backups. Cross-device sync was outside the original MVP, but is in scope for the separately specified evolution.

- Continuité des interactions : une modification locale ou une actualisation asynchrone préserve le focus, le défilement et les états de présentation encore pertinents. Référence : [contrat UX transversal](../../openspec/specs/ux-interaction-continuity/spec.md).

## Non-goals
Collaboration, project accounting and AI in the browser. Authentication, synchronization and hosted storage were excluded from the historical MVP only and are now in scope for the Dexie Cloud evolution.

## Success criterion for experiment
A publicly hosted static app usable from a phone, with creation, completion and deletion of subjects/actions, priorities, substeps, persistence, backup/restore, tests and automated deployment.

## Évolution cible local-first (cadrée le 17 octobre 2026)

La [spécification normative Dexie Cloud](specs/dexie-cloud-local-first.md)
et [son plan de livraison](dexie-cloud-rollout.md) définissent désormais
l'évolution future : IndexedDB/Dexie.js, synchronisation cloud,
authentification email OTP native et migration non destructive des
données localStorage, avec consentement explicite avant leur transfert.
Les tâches TS-024 à TS-030 restent **proposées, non livrées**.
Ces exigences prévalent sur les anciens non-objectifs du MVP pour
ce périmètre seulement, sans fixer de règles générales à la factory.

## État du pilote (16 octobre 2026)

Le MVP a livré des fonctions complémentaires sans élargir sa mission :
annulation d'un retrait pendant dix secondes (TS-010, PR #32)
et réordonnancement tactile/souris des actions **de même priorité**
avec alternative clavier (TS-011, PR #34). Depuis, TS-012 et TS-013
(PR #55/#58) permettent le repli des sous-tâches et des libellés
« Voir N sous-tâches » / « Masquer les sous-tâches ». TS-014 (PR #59)
ajoute leur réordonnancement **à parent et priorité identiques**
(gestes tactiles/souris et commandes clavier). Le document reste local,
sans compte ni synchronisation cloud. La recette manuelle sur appareils
réels reste à mener.

Voir [le guide d'utilisation](guide-utilisation.md) pour les gestes
et limites, et [les exigences MVP](mvp.md) pour le contrat fonctionnel.
