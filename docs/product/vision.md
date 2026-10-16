# ThreadStep | Product vision

ThreadStep helps one person keep track of their **next concrete action** across several parallel work subjects, including work that is awaiting asynchronous feedback.

## Problem
A conventional task manager often demands too much ceremony. A Markdown document works, but requires manual restructuring to make next steps visible.

## Users
Initially a single user on desktop or mobile, without an account.

## Core value
Open the page and immediately know what to resume next for each active subject.

## Product principles
- Short-term, actionable, intentionally minimal.
- One subject can contain several next actions and one level of substeps.
- Priorities: urgent, normal, later. Unfinished actions first through visual distinction.
- No mandatory due date, status workflow, sprint, team or notifications.
- Private user data stays inside local browser storage.
- Explicit JSON export/import for portable backups; no cross-device sync in MVP.

## Non-goals
Collaboration, authentication, remote synchronization, hosted database, project accounting, AI in the browser.

## Success criterion for experiment
A publicly hosted static app usable from a phone, with creation, completion and deletion of subjects/actions, priorities, substeps, persistence, backup/restore, tests and automated deployment.

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
