# Catalogue des références Stitch | TS-062

- **Version :** 1.0
- **Date de rédaction :** 2026-10-24
- **Statut du document :** catalogue documentaire livré ; revue humaine et
  validation des maquettes **en attente**.
- **Rôle produit :** prérequis documentaire de **TS-063**. Le prérequis reste
  **non levé** tant que le propriétaire n'a pas consigné explicitement sa
  décision.
- **Portée :** documentation seulement. Ce document ne modifie aucun code, test,
  donnée, configuration Cloud, workflow, backlog ni maquette Stitch.

## 1. Objet

Ce catalogue inventorie les 32 références mobiles `M01` à `M32` et les quatre
références desktop conservées. Il permet de répondre à quatre questions avant
toute migration visuelle :

1. quelles références existent et dans quel état de revue ?
2. quelles règles produit existantes priment sur chaque proposition visuelle ?
3. quels écarts sont du style, de la structure, de l'interaction ou une nouvelle
   fonctionnalité ?
4. quelles décisions humaines restent nécessaires avant TS-063 ?

Aucune référence n'est approuvée par le seul fait qu'elle a été générée dans
Stitch, qu'un lien existe ou que ce catalogue passe ses contrôles documentaires :
aucune référence absente n'est réputée approuvée.

## 2. Sources et hiérarchie des preuves

### 2.1 Sources utilisées

- **Tâche de référence :** `backlog/tasks/TS-062.md` (contexte, périmètre et
  critères d'acceptation).
- **Projet Stitch :**
  [projet 10325329939517341056](https://stitch.withgoogle.com/projects/10325329939517341056).
  Seul lien de projet disponible ; aucun lien profond par écran n'est fourni.
- **Cadrage UI-04 Notion :**
  [cadrage UI-04](https://app.notion.com/p/40212ac9163681c191f7ca3c39628b93).
  Il recense des divergences annoncées sur les suggestions, les priorités, les
  textes Cloud, les sous-tâches et les commandes hors périmètre.
- **Spécifications canoniques :** `openspec/specs/` (voir le socle de règles en
  section 8).
- **Contrats de sécurité Dexie Cloud :** spécifications `cloud-*`,
  `email-otp-authentication`, `workspace-identity-isolation` et
  `data-backup-import-restore`.
- **Code livré et tests existants :** référence d'implémentation effective, mais
  aucun code n'est modifié par ce catalogue.

### 2.2 Ordre de priorité

En cas de contradiction, l'ordre suivant s'applique :

1. **spécifications canoniques** `openspec/specs/` ;
2. **code livré et contrats de sécurité effectifs** ;
3. **décisions produit explicites du propriétaire**, datées et limitées ;
4. **références Stitch**, uniquement comme propositions visuelles.

Une maquette ne crée, ne modifie et n'approuve aucune règle métier, route,
persistance, synchronisation, exigence de sécurité ou format de données. Une
ligne de matrice renvoie toujours à une règle existante ou à une décision
explicite.

## 3. Vocabulaire contrôlé

### 3.1 Statuts de revue d'une référence

| Statut | Signification |
| --- | --- |
| `NOT_REVIEWED` | Référence non inspectée ou inaccessible ; jamais approuvée. |
| `PARTIALLY_REVIEWED` | Certains états seulement observés ; les états manquants sont listés. |
| `REVIEWED_KEEP` | Référence inspectée et utilisable sans correction observée. |
| `REVIEWED_CORRECT_IN_STITCH` | Référence inspectée ; une correction de la maquette est proposée, sous réserve d'accès et de périmètre. |
| `PRODUCT_DECISION_REQUIRED` | Référence inspectée ; une décision propriétaire est nécessaire. |
| `REJECTED` | Référence inspectée et écartée. |

### 3.2 Dispositions d'une ligne de matrice

| Disposition | Libellé français | Signification |
| --- | --- | --- |
| `KEEP` | conserver | La règle ou le comportement existant est retenu. |
| `CORRECT_IN_STITCH` | corriger dans Stitch | La référence doit être corrigée ; aucune correction n'est appliquée par défaut. |
| `PRODUCT_DECISION` | décision produit distincte | Le propriétaire doit trancher avant toute adoption. |
| `REJECT` | rejeter | La proposition est écartée du contrat actuel. |

Le statut de revue d'une référence et la disposition d'un écart sont deux
notions distinctes. Une référence peut porter plusieurs lignes de matrice.

## 4. Règles de preuve

- Une **génération Stitch** ne vaut pas revue : elle prouve seulement qu'une
  proposition visuelle existe.
- Un **lien** vers Stitch ne vaut pas revue : il rend la référence identifiable,
  pas inspectée.
- Un **contrôle de documentation** automatisé ne vaut pas revue : il vérifie la
  complétude et la cohérence du présent fichier, pas le rendu, le focus, le
  contraste ou le toucher.
- Une CI verte ne vaut pas preuve sur appareil réel.
- Une référence `NOT_REVIEWED` n'est ni approuvée, ni retenue, ni prête pour
  TS-063.
- Une inspection partielle produit `PARTIALLY_REVIEWED` et **liste les états
  manquants** ; elle ne devient jamais une approbation intégrale.
- Le silence du propriétaire n'est pas une approbation.

## 5. Inventaire des références

### 5.1 Convention d'identifiants

Les identifiants `M01` à `M32` sont ceux fournis par la tâche TS-062. Les
identifiants `DESKTOP-1` à `DESKTOP-4` sont une **convention locale de
catalogue** : ils ne sont pas des identifiants officiels Stitch et ne remplacent
aucun nom réel. Si une session autorisée révèle les vrais noms, ceux-ci seront
ajoutés à côté sans remplacer l'identifiant stable.

Chaque ligne ci-dessous utilise le même lien de projet, faute de lien profond
fourni. L'identifiant de la référence rend la ligne identifiable. Aucun nom
d'écran, état ou parcours non observé n'est inventé : la colonne « Surface /
état » indique seulement une **catégorie de couverture à confirmer**.

### 5.2 Références mobiles

Inventaire M01 à M32 (32 références mobiles).

| ID | Surface / état (catégorie à confirmer, non observée) | Statut de revue | Lien identifiable | Motif d'absence d'inspection |
| --- | --- | --- | --- | --- |
| M01 | Overview | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M02 | Overview | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M03 | Overview | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M04 | Overview | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M05 | Overview | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M06 | Détail d'un projet | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M07 | Détail d'un projet | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M08 | Détail d'un projet | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M09 | Détail d'un projet | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M10 | Tâches et éditeurs | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M11 | Tâches et éditeurs | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M12 | Tâches et éditeurs | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M13 | Tâches et éditeurs | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M14 | Tâches et éditeurs | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M15 | Navigation (header / menu) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M16 | Navigation (header / menu) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M17 | Navigation (header / menu) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M18 | Navigation (header / menu) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M19 | Paramètres | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M20 | Paramètres | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M21 | Paramètres | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M22 | Import / export / restauration | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M23 | Import / export / restauration | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M24 | Import / export / restauration | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M25 | Cloud (activation, OTP, synchronisation) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M26 | Cloud (activation, OTP, synchronisation) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M27 | Cloud (activation, OTP, synchronisation) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M28 | Cloud (activation, OTP, synchronisation) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M29 | Messages limites et états vides | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M30 | Messages limites et états vides | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M31 | Composants réutilisables | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |
| M32 | Composants réutilisables (planche de composants) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Session Stitch autorisée indisponible sur le runner ; aucun lien profond fourni. |

### 5.3 Références desktop

Les quatre références desktop sont conservées, mais leurs identifiants officiels
et leurs liens profonds ne sont pas fournis. `DESKTOP-1` à `DESKTOP-4` sont des
identifiants locaux de catalogue.

| ID | Surface / état (catégorie à confirmer, non observée) | Statut de revue | Lien identifiable | Motif d'absence d'inspection |
| --- | --- | --- | --- | --- |
| DESKTOP-1 | Desktop — catégorie de couverture à confirmer (Overview / détail) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Identifiant officiel et lien profond non fournis ; session autorisée indisponible sur le runner. |
| DESKTOP-2 | Desktop — catégorie de couverture à confirmer (détail / tâches) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Identifiant officiel et lien profond non fournis ; session autorisée indisponible sur le runner. |
| DESKTOP-3 | Desktop — catégorie de couverture à confirmer (navigation / paramètres) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Identifiant officiel et lien profond non fournis ; session autorisée indisponible sur le runner. |
| DESKTOP-4 | Desktop — catégorie de couverture à confirmer (Cloud / composants) | `NOT_REVIEWED` | [Projet Stitch](https://stitch.withgoogle.com/projects/10325329939517341056) | Identifiant officiel et lien profond non fournis ; session autorisée indisponible sur le runner. |

### 5.4 Couverture des surfaces exigées

Les neuf surfaces demandées par TS-062 sont nommées dans l'inventaire :
Overview ; détail d'un projet ; tâches et éditeurs ; navigation ; paramètres ;
import / export / restauration ; Cloud ; messages limites et états vides ;
composants réutilisables. Les catégories sont des **candidats de couverture non
confirmés**, pas des observations.

### 5.5 Références et états non examinés

- **Références non examinées :** les 32 références mobiles (`M01` à `M32`) et
  les quatre références desktop (`DESKTOP-1` à `DESKTOP-4`), soit 36 références.
- **États manquants :** tous les états, parcours et variantes de chaque
  référence restent non observés, y compris les états de chargement, d'erreur,
  d'édition, de confirmation, de focus, de menu ouvert et de restauration.
- **Raison :** l'accès Stitch nécessite une session autorisée et la tâche ne
  fournit ni session ni lien profond. Aucun nom d'écran n'est déduit.
- **Conséquence :** aucune validation intégrale n'est revendiquée. Les
  références restent `NOT_REVIEWED` jusqu'à inspection humaine réelle.

## 6. Matrice traçable des écarts

### 6.1 Règles de lecture

La matrice ci-dessous recense les **écarts signalés par le cadrage UI-04** et les
points de contrôle structurants du contrat. Elle ne prétend pas les avoir
revérifiés dans Stitch : chaque ligne le précise dans sa colonne « Écran /
état ». Une ligne fonctionnelle renvoie toujours à une règle canonique ou à une
décision produit explicite. Le propriétaire d'une décision produit est toujours
l'utilisateur/propriétaire, jamais l'agent.

Catégories autorisées : `STYLE`, `STRUCTURE`, `INTERACTION`, `NEW_FEATURE`.
Dispositions autorisées : `KEEP`, `CORRECT_IN_STITCH`, `PRODUCT_DECISION`,
`REJECT`.

### 6.2 Matrice

| ID | Origine | Écran / état | Différence observable | Catégorie | Disposition | Risque | Propriétaire | Règle ou décision | Référence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-01 | Cadrage UI-04 | Référence de navigation à identifier (non revérifiée) | Divergence annoncée sur l'ordre, les libellés ou l'état actif des destinations | `STRUCTURE` | `PRODUCT_DECISION` | Moyen : identité de navigation et retour | Utilisateur/propriétaire | `openspec/specs/app-navigation/spec.md` — quatre destinations `#/`, `#/parametres`, `#/parametres/donnees`, `#/parametres/synchronisation` | Projet Stitch ; référence précise à identifier |
| MAT-02 | Cadrage UI-04 | Header et menu (non revérifiés) | État ouvert/fermé, focus et fermeture du menu à comparer | `INTERACTION` | `PRODUCT_DECISION` | Moyen : clavier, focus et retour | Utilisateur/propriétaire | `openspec/specs/app-navigation/spec.md` — bouton « Menu », panneau et fermeture | Projet Stitch ; référence précise à identifier |
| MAT-03 | Cadrage UI-04 | Cartes projet de l'Overview (non revérifiées) | Aperçu des tâches parentes et présence éventuelle de commandes hors quota | `STRUCTURE` | `KEEP` | Élevé : visibilité et accès aux tâches | Utilisateur/propriétaire | `openspec/specs/subject-overview-preview/spec.md` — cinq tâches parentes, sous-tâches hors quota | Projet Stitch ; référence précise à identifier |
| MAT-04 | Cadrage UI-04 | Compteurs et progression (non revérifiés) | Compteurs, accords français et progression à comparer | `STRUCTURE` | `KEEP` | Moyen : exactitude des calculs | Utilisateur/propriétaire | `openspec/specs/overview-project-metrics/spec.md` — comptage unique, urgences et progression | Projet Stitch ; référence précise à identifier |
| MAT-05 | Cadrage UI-04 | Suggestion « Une étape pour maintenant » (non revérifiée) | Divergence annoncée sur la suggestion et son explication | `INTERACTION` | `PRODUCT_DECISION` | Élevé : sélection déterministe et confiance | Utilisateur/propriétaire | `openspec/specs/next-action-suggestion/spec.md` — priorité puis ordre sujet/action, sans hasard, date, réseau ou IA | Projet Stitch ; référence précise à identifier |
| MAT-06 | Cadrage UI-04 | Tâches et sous-tâches (non revérifiées) | Hiérarchie à un seul niveau à comparer | `STRUCTURE` | `CORRECT_IN_STITCH` | Élevé : relation parent/enfant et lectures | Utilisateur/propriétaire | `openspec/specs/task-hierarchy-presentation/spec.md` — un niveau, structure sémantique et indices non chromatiques | Projet Stitch ; référence précise à identifier |
| MAT-07 | Cadrage UI-04 | Priorités des sous-tâches (non revérifiées) | Priorité propre à chaque sous-tâche à préserver | `STRUCTURE` | `PRODUCT_DECISION` | Élevé : priorité héritée ou nouvelle règle | Utilisateur/propriétaire | `openspec/specs/task-hierarchy-presentation/spec.md` et `openspec/specs/next-action-suggestion/spec.md` — sous-tâches hors suggestion, priorités propres | Projet Stitch ; référence précise à identifier |
| MAT-08 | Cadrage UI-04 | Notes de tâche (non revérifiées) | Affichage de note potentiellement interprété comme Markdown ou HTML | `INTERACTION` | `KEEP` | Élevé : sécurité et fidélité du texte | Utilisateur/propriétaire | `openspec/specs/action-note/spec.md` — texte brut, sauts de ligne, aucun HTML/Markdown/lien actif | Projet Stitch ; référence précise à identifier |
| MAT-09 | Cadrage UI-04 | Reprise « Je reprends ici » (non revérifiée) | Emplacement et unicité de la reprise à comparer | `INTERACTION` | `KEEP` | Moyen : continuité après interruption | Utilisateur/propriétaire | `openspec/specs/resume-tracking/spec.md` — une seule action suivie, préférence locale par espace | Projet Stitch ; référence précise à identifier |
| MAT-10 | Cadrage UI-04 | Retrait et annulation (non revérifiés) | Fenêtre d'annulation et snackbar à comparer | `INTERACTION` | `KEEP` | Moyen : restauration exacte | Utilisateur/propriétaire | `openspec/specs/action-removal/spec.md` — retrait immédiat et annulation de dix secondes | Projet Stitch ; référence précise à identifier |
| MAT-11 | Cadrage UI-04 | Consentement Cloud (non revérifié) | Textes et confirmation de transfert à comparer | `STRUCTURE` | `KEEP` | Élevé : consentement et non-transfert implicite | Utilisateur/propriétaire | `openspec/specs/cloud-opt-in-activation/spec.md` — consentement lié au plan affiché | Projet Stitch ; référence précise à identifier |
| MAT-12 | Cadrage UI-04 | Authentification OTP (non revérifiée) | Textes d'authentification à comparer | `INTERACTION` | `KEEP` | Élevé : session, absence de secret et reprise | Utilisateur/propriétaire | `openspec/specs/email-otp-authentication/spec.md` — email et OTP natifs uniquement | Projet Stitch ; référence précise à identifier |
| MAT-13 | Cadrage UI-04 | Synchronisation Dexie Cloud (non revérifiée) | Textes Cloud et états de synchronisation à comparer | `STRUCTURE` | `KEEP` | Élevé : distinction local, en attente et synchronisé | Utilisateur/propriétaire | `openspec/specs/cloud-sync-lifecycle/spec.md` — états natifs distincts et diagnostic véridique | Projet Stitch ; référence précise à identifier |
| MAT-14 | Cadrage UI-04 | Espace actif et isolation (non revérifiés) | Espace local/Cloud et frontières de compte à comparer | `STRUCTURE` | `PRODUCT_DECISION` | Élevé : fuite ou fusion entre espaces | Utilisateur/propriétaire | `openspec/specs/workspace-identity-isolation/spec.md` — identité stable, registre par URL et compte | Projet Stitch ; référence précise à identifier |
| MAT-15 | Cadrage UI-04 | Import, fusion et restauration (non revérifiés) | Intentions distinctes et confirmations à comparer | `STRUCTURE` | `KEEP` | Élevé : perte de données et sauvegarde | Utilisateur/propriétaire | `openspec/specs/data-backup-import-restore/spec.md` — fusion additive, restauration distincte et confirmée | Projet Stitch ; référence précise à identifier |
| MAT-16 | Cadrage UI-04 | Paramètres et pages de données (non revérifiés) | Structure des sections et retours à comparer | `STRUCTURE` | `KEEP` | Faible : orientation et accès aux commandes | Utilisateur/propriétaire | `openspec/specs/app-navigation/spec.md` et `openspec/specs/data-backup-import-restore/spec.md` — titres, sections et contrôles uniques | Projet Stitch ; référence précise à identifier |
| MAT-17 | Cadrage UI-04 | Messages limites et états vides (non revérifiés) | Textes de limite et d'état vide à comparer | `STYLE` | `CORRECT_IN_STITCH` | Faible : clarté du message | Utilisateur/propriétaire | `openspec/specs/next-action-suggestion/spec.md` et `openspec/specs/overview-project-metrics/spec.md` — messages français et états déterministes | Projet Stitch ; référence précise à identifier |
| MAT-18 | Cadrage UI-04 | Commandes hors périmètre (non revérifiées) | Recherche, archives, partage, Markdown, raccourcis ou statistiques éventuellement proposés | `NEW_FEATURE` | `PRODUCT_DECISION` | Élevé : élargissement non autorisé du contrat | Utilisateur/propriétaire | Décision produit distincte requise ; aucune règle existante ne les autorise (voir section 9) | Projet Stitch ; référence précise à identifier |
| MAT-19 | Analyse documentaire (sans inspection Stitch) | M32 et composants (non revérifiés) | Planche de composants proposée, sans preuve d'accessibilité | `STYLE` | `PRODUCT_DECISION` | Moyen : contraste, cible et focus non prouvés | Utilisateur/propriétaire | Aucune règle d'accessibilité certifiée par M32 ; recette requise (section 10) | Projet Stitch ; référence M32 et composants à identifier |

Aucune ligne de cette matrice ne vaut approbation d'une fonctionnalité. Les
lignes `NEW_FEATURE` restent soumises à une tâche distincte et à l'accord du
propriétaire.

## 7. Socle de règles produit

Chaque règle ci-dessous est la référence opposable. Le catalogue ne recopie pas
les scénarios canoniques ; il décrit seulement la conséquence pour la revue
Stitch.

| Domaine | Règle canonique | Comportement à préserver face aux maquettes |
| --- | --- | --- |
| Navigation | `openspec/specs/app-navigation/spec.md` | Quatre destinations « Mes projets », « Paramètres », « Imports / Exports » et « Synchronisation Dexie Cloud », dans cet ordre, avec les routes `#/`, `#/parametres`, `#/parametres/donnees` et `#/parametres/synchronisation`. Aucune destination supplémentaire. |
| Aperçu Overview | `openspec/specs/subject-overview-preview/spec.md` | Au plus cinq tâches parentes visibles par carte ; les sous-tâches ne consomment pas d'emplacement ; « Voir plus » ouvre `#/sujet/<id>`. |
| Compteurs et progression | `openspec/specs/overview-project-metrics/spec.md` | Comptage unique des parents et sous-tâches, urgences inachevées, progression textuelle et accords français. |
| Suggestion déterministe | `openspec/specs/next-action-suggestion/spec.md` | Sélection par priorité puis ordre du sujet puis ordre de l'action ; aucune utilisation de hasard, date, réseau ou IA. |
| Hiérarchie et priorités | `openspec/specs/task-hierarchy-presentation/spec.md` | Un seul niveau de sous-tâches ; chaque sous-tâche conserve sa propre priorité ; aucun niveau ni priorité héritée ajoutés. |
| Notes | `openspec/specs/action-note/spec.md` | Note en texte brut, sauts de ligne préservés, aucune interprétation Markdown, HTML ou lien actif. |
| Reprise | `openspec/specs/resume-tracking/spec.md` | Une seule action suivie, restauration locale après interruption, révélation accessible et nettoyage sûr. |
| Undo | `openspec/specs/action-removal/spec.md` | Retrait immédiat, snackbar « Étape retirée », annulation exacte pendant dix secondes, aucun historique persistant ni corbeille. |
| Consentement | `openspec/specs/cloud-opt-in-activation/spec.md` | Authentification et consentement séparés ; consentement lié au plan et à la destination affichés ; aucun transfert implicite. |
| Authentification | `openspec/specs/email-otp-authentication/spec.md` | Email et OTP natifs uniquement ; session réutilisable ; aucun secret exposé ; aucun backend d'authentification applicatif. |
| Synchronisation | `openspec/specs/cloud-sync-lifecycle/spec.md` | États natifs distincts ; écriture locale distincte d'un push prouvé ; aucune base distante déclarée vide sans preuve. |
| Espace actif et isolation | `openspec/specs/workspace-identity-isolation/spec.md` | Espace local ou Cloud identifié, base locale propre à l'URL, compte lié par empreinte opaque, aucune fusion ou exposition implicite. |
| Restauration | `openspec/specs/data-backup-import-restore/spec.md` | Import/fusion additif, restauration distincte, diff, sauvegarde de sécurité, confirmation renforcée et aucune écriture implicite. |

## 8. Registre des idées non autorisées

Ces idées sont **non autorisées par le contrat actuel**. Elles ne peuvent pas
être adoptées au titre d'un simple changement de style, de structure ou
d'interaction. Chacune exige une **tâche distincte** et l'**accord du
propriétaire** avant toute implémentation.

| Idée | Référence ou écart qui la suggère | Classification | Statut actuel | Condition d'adoption |
| --- | --- | --- | --- | --- |
| Recherche | Références de navigation ou d'Overview à identifier | `NEW_FEATURE` | Non autorisé | Tâche distincte et accord du propriétaire. |
| Archives | Références de tâches ou de paramètres à identifier | `NEW_FEATURE` | Non autorisé | Tâche distincte et accord du propriétaire. |
| Partage | Références de projet ou de Cloud à identifier | `NEW_FEATURE` | Non autorisé | Tâche distincte et accord du propriétaire. |
| Markdown | Références de notes ou d'éditeurs à identifier | `NEW_FEATURE` | Non autorisé | Tâche distincte et accord du propriétaire ; le texte brut reste la règle. |
| Raccourcis | Références de navigation ou de tâches à identifier | `PRODUCT_DECISION` | Non autorisé | Tâche distincte et accord du propriétaire. |
| Statistiques | Références d'Overview ou de paramètres à identifier | `NEW_FEATURE` | Non autorisé | Tâche distincte et accord du propriétaire. |

Une idée de ce registre ne peut pas être déclarée approuvée, retenue ou couverte
par le style. La classification `NEW_FEATURE` ou `PRODUCT_DECISION` impose une
décision produit explicite.

## 9. Responsive, composants et accessibilité

### 9.1 Largeurs à vérifier

Aucune largeur n'est déclarée validée : Stitch n'est pas un essai sur appareil
réel. Les variantes et comportements restent `À VÉRIFIER` jusqu'à une recette
réelle.

| Largeur | Variantes ou comportements à vérifier | Statut |
| --- | --- | --- |
| 320 px | Débordement horizontal, lisibilité, titres longs, badges, menus et cibles tactiles. | `À VÉRIFIER` |
| 390 px | Mise en page mobile courante, hiérarchie des tâches, notes multilignes et focus. | `À VÉRIFIER` |
| 430 px | Grand mobile, espacement, textes tronqués et ordre de lecture. | `À VÉRIFIER` |
| 768 px | Bascule tablette/desktop, header, menu, densité des lignes et contrastes. | `À VÉRIFIER` |

### 9.2 Composants réutilisables candidats

Les composants suivants sont des **propositions candidates**, pas des
composants approuvés ou implémentés : bouton de menu, panneau de navigation,
en-tête de page, carte projet, ligne de tâche, guide de hiérarchie, badge de
priorité, zone de note, snackbar d'annulation, carte de reprise, champ OTP,
panneau de confirmation et message d'état. Aucune bibliothèque ni dépendance
n'est créée par ce catalogue.

### 9.3 Points d'accessibilité

- **Contrastes :** `À VÉRIFIER` sur texte, badges, focus, états désactivés et
  messages d'état.
- **Tailles de cible :** `À VÉRIFIER`, avec l'exigence existante d'au moins
  44 × 44 px pour les contrôles concernés.
- **Focus :** `À VÉRIFIER` sur Tab, Entrée, Espace, Échap, retour de focus et
  menu.
- **Textes :** `À VÉRIFIER` pour troncature, lisibilité, accords français et
  ordre de lecture.
- **Lecteur d'écran :** `À VÉRIFIER` ; aucune conformité n'est déduite d'une
  maquette.

### 9.4 Planche M32

`M32` est une **proposition, pas une certification** d'accessibilité. Elle ne
certifie ni contraste, ni focus, ni cible tactile, ni ordre de lecture. Son
existence ne prouve aucun comportement sur appareil réel.

## 10. Sous-ensemble navigation pour TS-063

### 10.1 État de la porte

**État : `BLOCKED_PENDING_USER_VALIDATION`.**

Le prérequis documentaire de TS-063 n'est **pas levé**. Aucune validation
propriétaire n'est consignée à la date du 2026-10-24. Une CI verte, un contrôle
documentaire ou l'existence de ce catalogue ne vaut pas validation.

### 10.2 Candidats à identifier

Les références candidates ne peuvent pas être désignées individuellement sans
inspection réelle. Les catégories candidates sont :

| Élément | Références candidates | État |
| --- | --- | --- |
| Header | Références mobiles de navigation parmi `M01` à `M32`, à identifier après inspection | Non identifié / `NOT_REVIEWED` |
| Menu | Références mobiles de navigation parmi `M01` à `M32`, à identifier après inspection | Non identifié / `NOT_REVIEWED` |
| Destination « Mes projets » (`#/`) | Références d'Overview ou de navigation à identifier | Non identifié / `NOT_REVIEWED` |
| Destination « Paramètres » (`#/parametres`) | Références de paramètres à identifier | Non identifié / `NOT_REVIEWED` |
| Destination « Imports / Exports » (`#/parametres/donnees`) | Références d'import/export/restauration à identifier | Non identifié / `NOT_REVIEWED` |
| Destination « Synchronisation Dexie Cloud » (`#/parametres/synchronisation`) | Références Cloud à identifier | Non identifié / `NOT_REVIEWED` |

### 10.3 Points bloquants et décision attendue

1. **Accès Stitch absent :** aucune session autorisée ni lien profond n'est
   disponible sur le runner ; les 36 références restent `NOT_REVIEWED`.
2. **Sous-ensemble non identifiable :** sans inspection, aucun identifiant ne
   peut être retenu pour le header, le menu ou les quatre destinations.
3. **Divergences produit non tranchées :** les écarts signalés par UI-04 sur les
   suggestions, priorités, textes Cloud, sous-tâches et commandes hors périmètre
   restent des `PRODUCT_DECISION`.
4. **Recette absente :** aucune mesure de contraste, aucun test clavier, tactile
   ou lecteur d'écran n'a été réalisé.

**Décision attendue du propriétaire :** inspecter les références, puis approuver
ou refuser explicitement, avec date, portée et identifiants, le sous-ensemble
header/menu/quatre destinations destiné à TS-063. Les références non approuvées
restent refusées, en attente ou `NOT_REVIEWED`.

### 10.4 Absence d'autorisation d'implémentation

Ce catalogue n'autorise ni code React/CSS, ni migration, ni modification de
route, de donnée ou de configuration Cloud. Il prépare uniquement la revue de
TS-063 ; les autres portes de TS-063 restent applicables.

## 11. Bilan des décisions humaines

### 11.1 Registre des décisions

| Date | Auteur | Portée | Références approuvées | Références refusées | Statut |
| --- | --- | --- | --- | --- | --- |
| 2026-10-24 | Aucun propriétaire (entrée documentaire de l'agent) | Aucune validation de maquette | Aucune | Aucune | En attente de décision propriétaire |

Le registre distingue explicitement :

- **décision du propriétaire :** aucune à ce jour ;
- **inspection partielle ou absente :** toutes les références sont
  `NOT_REVIEWED`, aucun état n'a été observé ;
- **contrôle documentaire automatisé :** vérifie la complétude du présent
  fichier pendant `apply`, sans valeur de revue visuelle ;
- **preuve sur appareil réel :** aucune ; aucun test navigateur, tactile,
  clavier ou lecteur d'écran n'a été exécuté.

### 11.2 Ce qui n'a pas été vérifié

- Les 32 références mobiles et les quatre références desktop.
- Les états de chargement, d'erreur, d'édition, de confirmation, de focus, de
  menu ouvert, de synchronisation et de restauration.
- Les contrastes, tailles de cible, focus visibles, textes tronqués et ordres de
  lecture.
- Les parcours réels sur mobile et desktop.
- Les décisions produit sur les suggestions, priorités, textes Cloud,
  sous-tâches, espace actif et commandes hors périmètre.

### 11.3 Règle de silence

Une référence sans décision du propriétaire reste `NOT_REVIEWED` ou en attente.
Elle n'est pas comptée comme approuvée et ne lève pas la porte TS-063. Le silence
n'est pas une approbation.

## 12. Limites et journal

- **Aucune maquette modifiée :** aucune correction Stitch n'est appliquée par ce
  catalogue. Toute correction reste une proposition soumise à un accès autorisé
  et à un périmètre validé.
- **Aucun appel payant :** aucun appel externe payant n'a été déclenché.
- **Aucun effet de données :** aucune écriture IndexedDB, `localStorage`,
  configuration Cloud, authentification, synchronisation, restauration, purge
  ou export n'a été effectuée.
- **Aucun code produit :** aucun fichier sous `site/`, `tests/`, `scripts/`,
  `.github/`, `backlog/`, `AGENTS.md`, `opencode.json` ni configuration Cloud
  n'a été modifié.
- **Contrôles pré-sync :** les assertions documentaires déterministes sont
  exécutées pendant `apply` à partir d'un script temporaire non versionné ; elles
  prouvent la complétude du catalogue, pas la qualité visuelle des maquettes.

## 13. Prérequis TS-063

Le prérequis documentaire de TS-063 est **non levé**. Il ne pourra être levé
qu'après validation humaine explicite, datée et limitée des références
nécessaires au header, au menu et aux quatre destinations. Les références
rejetées ou non examinées restent visibles dans ce catalogue et ne sont jamais
reformulées comme approuvées.
