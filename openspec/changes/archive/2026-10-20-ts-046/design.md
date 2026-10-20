# Design

## Context

Voir `proposal.md` — Why. Le code livré constitue la source de vérité :
`site/dexie-foundation.js` définit `threadstep-local`, le préfixe
`threadstep-ws-` et l'activation du suffixage natif `nameSuffix` ;
`site/workspace-identity.js` gère le registre d'espaces, les états
`UNVERIFIED`/`MISMATCH`, la suspension, la déconnexion et la purge ;
`site/sync-diagnostics.js` expose les états natifs, le pull initial et la preuve
distante ; `site/app.js` porte les libellés visibles et l'action de récupération
isolée `threadstep-recovery-…`.

Les spécifications canoniques `local-indexeddb-persistence`,
`cloud-opt-in-activation`, `cloud-sync-lifecycle`,
`workspace-identity-isolation`, `data-backup-import-restore` et
`data-integrity-recovery` fixent les garanties et les limites. Le guide
utilisateur doit les traduire en français clair sans créer de nouvelle règle.

Le dépôt ne dispose pas encore de test dédié à la documentation de persistance.
Les tests existants lisent déjà des fichiers Markdown avec `node:test`, ce qui
permet une validation déterministe sur le runner.

## Goals / Non-Goals

**Goals:**

- Un document autonome, lisible de bout en bout, qui répond d'abord à « où sont
  mes données ? », puis « sont-elles transférées ? » et « que puis-je faire sans
  risque ? ».
- Une terminologie alignée sur les libellés et noms réellement affichés par
  l'application.
- Des scénarios avant/après complets et une FAQ priorisée qui ne promettent
  jamais plus que les signaux natifs ne prouvent.
- Des liens entrants visibles depuis le guide général et les références produit.
- Une couverture automatisable de la structure, des liens, des termes et des
  limites de preuve, sans prétendre tester la compréhension humaine.

**Non-Goals:**

- Changer l'interface, les handlers, le diagnostic ou les flux Cloud.
- Décrire un parcours V1 obsolète ou une migration qui n'existe plus.
- Prouver par des tests Node la lisibilité réelle, le rendu mobile ou la
  compréhension d'une personne non technique.
- Documenter une cause racine `UNVERIFIED` non démontrée ou une propagation
  inter-appareils non observée.

## Decisions

### 1. Guide unique et autonome, liens entrants séparés

Créer `docs/product/guide-persistance-et-synchronisation.md` comme document
principal, avec ses propres sections et ancres. `guide-utilisation.md` reçoit un
lien visible vers ce guide dans la partie « Enregistrement, export et import ».
`dexie-cloud-rollout.md` et `acceptance-checklist.md` reçoivent une référence
adaptée à leur rôle (architecture/recette), sans recopier le guide.

*Alternative rejetée :* étendre fortement `guide-utilisation.md`. Cela
mélangerait les gestes métier quotidiens et les procédures de persistance
sensible, rendrait le guide quotidien trop long et compliquerait la mise à jour
ciblée.

### 2. Modèle local-first présenté par les copies, pas par la technique

Le guide ouvre sur une représentation simple des copies :

1. `threadstep-local` : espace autonome, IndexedDB locale, aucune réplication,
   utilisable sans URL, OTP ou réseau.
2. Espace Cloud : une IndexedDB locale distincte nommée `threadstep-ws-…`
   (suffixée nativement par Dexie Cloud) et une instance distante répliquée
   sous conditions après activation consentie.
3. `threadstep-recovery-…` : nouveau cache local isolé créé explicitement pour
   relire le serveur, jamais une nouvelle base distante.

Le guide précise qu'aucune base distante n'est interrogée directement à la
place d'IndexedDB : Dexie Cloud réplique vers la base locale active.

*Alternative rejetée :* expliquer d'abord `nameSuffix`, les tables ou les
événements natifs. Cela parle au développeur, pas à l'utilisateur.

### 3. Lexique de preuve à six niveaux, non fusionnables

Le guide définit et réutilise six formulations distinctes : « enregistré sur
cet appareil », « transfert local en attente », « pull natif terminé »,
« synchronisation native en phase », « lecture métier attestée » et « contenu
confirmé sur un autre appareil ». Une section « Ce que cela ne prouve pas »
accompagne chaque formulation. `in-sync`, un pull terminé ou une lecture locale
ne sont jamais présentés comme une preuve de la copie distante complète ou
d'un autre appareil.

*Alternative rejetée :* un unique statut « synchronisé ». Il masquerait les
différences entre commit local, transport, lecture distante et convergence
métier réelle.

### 4. Matrice de scénarios avec colonnes avant/après fixes

Chaque scénario est présenté en tableau court avec les colonnes : espace actif,
données consultables localement, destinataire distant éventuel, données
conservées mais non affichées, danger, sauvegarde conseillée, action exacte,
retour arrière. Un court paragraphe avant/après précède ou suit le tableau pour
les cas complexes.

La couverture minimale inclut : premier lancement local, configuration sans
activation, activation avec OTP/lecture/plan/consentement, connexion sur un
autre appareil, suspension, déconnexion, changement d'espace/d'URL/de compte,
retour au local, reprise Cloud, hors ligne/erreur, écriture non transmise,
`UNVERIFIED`/`MISMATCH`, récupération isolée, export/import/restauration et
suppression des données navigateur. Les actions destructives (déconnexion,
import, restauration, purge, suppression navigateur) ont leur propre section ou
sous-section, séparée des actions de simple consultation ou de reprise.

*Alternative rejetée :* une longue liste narrative de scénarios. Les colonnes
fixes rendent les conséquences comparables et les oublis plus faciles à
détecter.

### 5. FAQ priorisée et glossaire reliés aux sections techniques

La FAQ suit l'ordre exigé : « Mes projets est vide », « Connecté mais projets
absents », « Quelle est ma base active ? », « Pourquoi un nouveau nom
IndexedDB ? », « Que signifie dernière synchronisation ? », « Que se passe-t-il
si je change de téléphone ou supprime les données du navigateur ? ». Chaque
réponse renvoie à un scénario ou à une section, jamais à une supposition.

Le glossaire définit sans jargon : IndexedDB, espace autonome, espace
synchronisé, cache local, base distante, OTP, pull, push, réplication,
attestation, sauvegarde, restauration. Les liens officiels Dexie sont regroupés
dans une section « Pour aller plus loin ».

*Alternative rejetée :* un glossaire dispersé. Un bloc unique facilite la
relecture et évite les définitions contradictoires.

### 6. Validation documentaire statique, pas de fausse preuve UI

Ajouter `tests/ts-046-persistence-guide.test.mjs` avec `node:test` pour vérifier
de façon déterministe : existence du guide, liens relatifs résolus, présence
des noms de bases et des six formulations, couverture de chaque scénario requis,
présence et ordre de la FAQ, glossaire et liens Dexie, séparation des actions
sensibles, absence d'ancien parcours V1, absence de promesse du type « tout est
sauvegardé dans le Cloud » ou « `in-sync` prouve… », et absence d'adresses
email, OTP, jetons ou secrets d'exemple. Le test peut aussi vérifier que
`guide-utilisation.md`, `dexie-cloud-rollout.md` et `acceptance-checklist.md`
contiennent un lien vers le guide.

Les dimensions visuelles, mobiles, clavier, lecteur d'écran et compréhension
réelle restent dans `Manual acceptance`, sans case cochée.

*Alternative rejetée :* ne compter que sur `npm run check`. Il ne détecterait ni
un lien cassé ni une régression éditoriale de couverture.

## Risks / Trade-offs

- **Le guide dérive du code après TS-045/TS-047** → Les tests ancrent les
  termes et noms actuels ; toute PR de correctif qui change un libellé ou un
  parcours met à jour le guide et ses tests dans la même livraison.
- **Une formulation rassurante dépasse la preuve réelle** → Une liste de
  formulations interdites et la section « Ce que cela ne prouve pas » sont
  vérifiées par test ; la recette humaine relit les nuances.
- **Les tableaux deviennent illisibles sur mobile** → Colonnes courtes, une
  ligne par scénario, paragraphes avant/après pour le contexte, et recette
  réelle à 320 px.
- **La FAQ duplique les scénarios et diverge** → Chaque réponse pointe vers une
  section unique de référence ; les tests vérifient les six intitulés.
- **La cause `UNVERIFIED` reste inconnue** → Le guide décrit l'état observable,
  les données masquées mais conservées et l'action de récupération isolée, sans
  affirmer de cause racine.
- **Un changement documentaire casse un test existant** → Les liens sont
  additifs ; `npm test` et `npm run check` sont exécutés avant toute coche.

## Migration Plan

1. Rédiger le guide autonome avec ses sections, tableaux, FAQ et glossaire.
2. Ajouter les liens entrants visibles depuis les documents produit adaptés.
3. Ajouter le test documentaire déterministe.
4. Exécuter le test ciblé, puis `npm test`, `npm run check` et
   `openspec validate ts-046 --strict --no-interactive`.
5. Si un écart TS-045/TS-047 est découvert avant publication, corriger le guide
   et ses tests dans la PR concernée ; sinon, consigner la limite comme
   non prouvée.

Aucun rollback de données n'est nécessaire : le changement est documentaire et
n'écrit ni IndexedDB ni configuration.

## Open Questions

- Aucune question bloquante. Le nom du fichier et l'ordre éditorial peuvent être
  ajustés pendant l'implémentation sans changer les exigences.
