# ThreadStep : architecture cible Dexie Cloud et plan de livraison

**Statut : proposition, non implémentée.** Cadrage initial : 17 octobre 2026.

## 1. Contrat et état observé

La [spécification complète et normative](specs/dexie-cloud-local-first.md) est fournie par le propriétaire. Ses SHALL/MUST et scénarios guident les tâches TS-024 à TS-030.

Contrairement à l'hypothèse « IndexedDB existante », la version de `main` à la préparation utilise `localStorage` : clé `threadstep.document.v1` dans `site/app.js`. `site/core.js` maintient un document JSON V1 avec sujets et items. Les préférences de reprise sont également locales mais séparées. `site/index.html` impose `connect-src 'none'`.

Les contraintes historiques de `AGENTS.md`, de `docs/product/vision.md` et de `docs/product/mvp.md` proscrivent backend, authentification, service distant et dépendance JS tierce. **La présente demande modifie l'objectif produit futur**, mais **ne modifie pas la politique d'agent** : une PR de politique distincte, revue et autorisée explicitement est requise avant toute exécution de tâches de code qui violerait `AGENTS.md`. Ce blocage explique `status: proposed` et `automation: manual`.

## 2. Architecture cible

```text
ThreadStep (JS vanilla, site statique GitHub Pages /threadstep/)
 ├─ configuration URL Cloud HTTPS, conservée hors synchronisation
 ├─ Dexie.js + dexie-cloud-addon, schema explicite et versionné
 │    ├─ IndexedDB distinctes par instance Cloud via nameSuffix natif
 │    ├─ tables de sujets et d'actions synchronisables, IDs uniques
 │    └─ données purement locales jamais copiées au cloud
 ├─ Dexie Cloud : OTP email natif, permissions, réplication bidirectionnelle
 └─ export/import V1 explicites et migration non destructive localStorage
```

Choisir une granularité de tables évitant l'écrasement de **tout le document** sur chaque modification, ce qui introduirait une perte d'écritures concurrentes entre appareils. Le modèle conserve identité, relations parent/enfant, priorité, ordre des items, notes et opérations actuelles (undo, promotion, suggestion, suivi). Les identifiants des tables doivent être globalement uniques, sans `++id`. Avec `@id`, les préfixes obligatoires Dexie Cloud imposent une stratégie documentée de correspondance des anciens IDs, sans casser l'export JSON V1 ni les références.

La synchronisation est directe entre navigateur et Dexie Cloud. Une écriture locale réussit sur commit IndexedDB, sans attendre l'acquittement distant. Après première configuration et authentification valides, les opérations locales peuvent fonctionner hors ligne selon la session et les autorisations applicables. Un navigateur jamais configuré ou authentifié ne peut pas commencer hors ligne.

La migration de la clé `localStorage` historique vers des tables synchronisées expose potentiellement des données à un service cloud : obtenir **un consentement explicite avant migration** et conserver la source. Il ne faut ni effacer une ancienne IndexedDB en changeant d'URL, ni effectuer de copie automatique entre A et B. Déconnexion et purge sont des opérations différentes, avec confirmations et précautions vis-à-vis des modifications non synchronisées.

## 3. Matrice de traçabilité

| Requirement du document fourni | Couverture backlog |
| --- | --- |
| Base locale Dexie versionnée | TS-024, TS-025, TS-026, TS-030 |
| Configuration locale de Dexie Cloud | TS-024, TS-029 |
| Authentification exclusivement par OTP email | TS-027, TS-030 |
| Synchronisation via Dexie Cloud | TS-025, TS-027, TS-030 |
| Écritures locales non bloquantes | TS-025, TS-028 |
| Indicateur global de synchronisation explicite | TS-028 |
| Déconnexion distincte de la purge locale | TS-029 |
| Diagnostic technique minimal | TS-028 |
| Frontière de sécurité frontend | TS-024, TS-027, TS-030 |
| Sélection non destructive de la base Dexie Cloud | TS-024, TS-029 |
| Validation automatisée des garanties du socle | TS-030 et tests propres à chaque tâche |

**Exigence additionnelle liée au code réel :** migration du document localStorage V1 (TS-026).

## 4. Dépendances et publication sûre

Ordre conseillé : **TS-024**, puis **TS-025 et TS-027**, puis **TS-026**, **TS-028**, **TS-029** et enfin **TS-030**.

Prérequis au développement : approuver la modification de politique agent/produit, disposer d'une **base Dexie Cloud de test** et d'une origine Pages autorisée, vérifier l'accès sans secret embarqué, choisir le packaging reproductible JS et les règles CSP HTTPS/WSS strictement nécessaires. Les fichiers CLI `dexie-cloud.key` et `dexie-cloud.json` restent hors sources et livrables. Le service Cloud peut impliquer des coûts, sans aucune dépense autorisée par cette PR.

**Ne pas publier un état intermédiaire sur main qui rend invisibles les données V1 avant migration ou qui les envoie sans consentement.** Regrouper les changements incompatibles dans une même livraison finale ou prévoir une bascule gardée et testée. La fusion des PR de développement et les appels OpenRouter/OpenSpec exigent des autorisations distinctes ; les risques medium/high bloquent la sélection automatique via le backlog orchestrator.

La recette destructrice (purge, collisions de données, logout pending et changements A/B) doit utiliser des instances isolées, jamais la production. Tests Node/CI et OpenSpec strict ne prouvent pas la recette réelle OTP, multi-appareils, clavier et mobile ; conserver ces preuves séparées.

## 5. Documentation fournisseur à relire à l'implémentation

- https://dexie.org/docs/cloud/authentication
- https://dexie.org/docs/cloud/DexieCloudOptions
- https://dexie.org/docs/cloud/SyncState
- https://dexie.org/docs/cloud/best-practices
- https://dexie.org/docs/cloud/cli
