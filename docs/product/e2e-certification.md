# Certification E2E local-first et Cloud (TS-039)

Ce document décrit la recette reproductible des parcours local-first et Dexie
Cloud. Il sépare quatre classes de preuve qui ne doivent jamais être
confondues :

- **CI** : contrôles déterministes exécutés par le runner Node sur les modules
  purs livrés. Ils ne prouvent ni IndexedDB réel, ni Chrome mobile, ni OTP, ni
  propagation distante.
- **Recette Dexie réelle** : observations faites sur une instance Dexie Cloud
  de test isolée, avec de vrais navigateurs et un vrai email OTP.
- **Limites** : propriétés natives que le runner ne peut pas prouver.
- **Incidents ouverts** : anomalies de recette connues. Un incident ouvert rend
  la certification globale non réussie.

La matrice automatique est produite par `scripts/product/e2e-matrix.mjs` et
ses tests par `tests/product-e2e-matrix.test.mjs`. Le compte rendu manuel reste
un artefact humain séparé : il n'est ni copié dans `tasks.md`, ni coché par
`apply`, ni déduit d'une CI verte.

## 1. Matrice des parcours requis

| Parcours | Preuve CI | Recette réelle ou limite |
| --- | --- | --- |
| Local-only | Démarrage vide sans Cloud, écriture locale, relecture et clé V1 intacte | Limite IndexedDB/tactile ; recette navigateur locale |
| Activation | Isolation avant consentement, étapes guidées | Observation de la revue et du consentement |
| Première synchronisation | Commit local, attente et complétion distante distincts | Propagation et signal natif observés |
| Cible peuplée | Classification vide, peuplée, divergente, indisponible, compte différent | Cible peuplée réelle |
| Divergence | Conflit bloqué sans écrasement silencieux | Divergence introduite sur l'instance de test |
| Conflits concurrents | Consentement lié au plan affiché, plan périmé refusé, rollback sans écriture partielle | Deux navigateurs concurrents |
| Reimport JSON | Sauvegarde IndexedDB moderne réimportée sans doublon, refus sans écriture d'un document V1 | Double reimport moderne réel et refus V1 |
| Restauration | Sauvegarde vérifiée, remplacement explicite, merge distinct | Restauration d'une sauvegarde plus ancienne |
| Déconnexion | Logout distinct de la purge, avertissement en attente | Logout natif avec écritures en attente |
| Changement d'URL | Isolation A/B/A et bases locales distinctes | Bascule A/B/A sur deux profils |
| Changement de session | Liaison de compte vérifiée, compte différent bloqué | Changement de session sur une même URL |
| Erreurs réseau | Erreur réseau distincte d'une erreur de stockage, hors ligne non vide | Coupure et réseau intermittent réels |
| États | Statut d'écriture locale jusqu'à l'attestation native | Libellés observés dans le diagnostic |
| Persistance | Relations, ordres, notes et empreintes stables | Rechargement réel |
| Empreintes | Empreintes de source et de plan déterministes | Non applicable hors runner |
| Sécurité | Diagnostic redacted sans identifiant brut | Captures redacted uniquement |
| Idempotence | Opérations et imports répétés sans effet supplémentaire | Répétition réelle sans doublon |

Les garanties transverses `states`, `persistence`, `fingerprints`, `security` et
`idempotence` sont reliées à au moins un parcours requis dans le rapport.

## 2. Protocole manuel sur instance Dexie Cloud isolée

### 2.1 Préparation sans données personnelles

1. Utiliser une **instance Dexie Cloud de test isolée** et deux profils de
   navigateur indépendants. Ajouter un profil Chrome mobile ou l'émulation
   mobile de Chrome avec un appareil réel si possible.
2. Ne jamais utiliser, purger ou modifier une base personnelle. Ne jamais
   utiliser un document métier réel.
3. Créer un jeu synthétique : 5 sujets, 18 étapes, des sous-étapes, des notes,
   des priorités mixtes, des états `done` et des relations parent/enfant.
   Utiliser des identifiants synthétiques, par exemple `legacy:test-subject-1`.
4. Produire et **vérifier la restauration d'une sauvegarde IndexedDB moderne**
   dans un profil de test vierge avant toute manipulation ; noter la date,
   le SHA de commit, le format et le nombre de sujets/étapes.
5. Dans un profil de test seulement, ajouter éventuellement une clé historique
   synthétique `threadstep.document.v1` ; vérifier qu'elle reste inerte et
   intacte. Aucun export V1, conversion ou effacement automatique ne doit être proposé.

### 2.2 Environnements et authentification

La recette exige :

- **Chrome mobile** et un **second navigateur ou profil indépendant** ;
- une **session OTP email réelle** sur l'instance de test ; l'OTP ne vaut pas
  consentement de transfert ;
- une URL d'instance de test du type `https://e2e-example.dexie.cloud`, sans
  identifiant ni jeton dans l'URL ;
- un mode **hors ligne** et un **réseau intermittent** provoqués
  volontairement ;
- une observation de la **propagation dans les deux sens** A→B et B→A.

### 2.3 Parcours à exécuter

1. **Local-only** : sans Cloud et hors ligne, créer, modifier, terminer,
   réordonner et retirer des sujets et étapes, recharger, puis vérifier les
   mêmes enregistrements et relations sans requête Cloud et sans OTP. Vérifier
   qu'aucun panneau historique ni export V1 n'est proposé et que l'éventuelle
   clé V1 synthétique reste intacte.
2. **Activation** : depuis l'espace local peuplé, établir une session OTP
   réelle. Vérifier qu'aucun enregistrement local n'est transmis avant
   l'acceptation explicite du plan de réconciliation affiché.
3. **Première synchronisation** : observer séparément le commit local,
   l'état en attente et la complétion distante. Un simple état `in-sync` local ne
   prouve pas la propagation.
4. **Cibles** : exercer une cible vérifiée vide et une cible déjà peuplée.
   Introduire une divergence, un conflit dépendant et une modification entre
   la prévisualisation et la confirmation. Vérifier que l'ancien consentement
   est refusé sans écrasement ni doublon.
5. **Propagation bidirectionnelle** : sur les deux navigateurs, créer et
   modifier des sujets et sous-étapes indépendants dans chaque sens. Après
   reconnexion hors ligne et coupure intermittente, vérifier la propagation
   A→B et B→A, l'avertissement de changements en attente, la reprise sans
   doublon et la conservation des relations après rechargement.
6. **Reimport et restauration** : importer deux fois le même JSON au format
   `threadstep.indexeddb-backup`, puis restaurer une sauvegarde moderne de test
   plus ancienne. Vérifier l'idempotence, l'intention explicite merge/restore
   et la conservation des sujets, étapes, notes, priorités, ordres, états `done`
   et relations parent/enfant. Présenter séparément un fichier `version: 1` et
   confirmer son refus explicite **sans aucune écriture**.
7. **Déconnexion et purge** : tester séparément le logout avec écritures en
   attente et la purge locale sur l'instance de test. Vérifier l'avertissement,
   l'annulation, l'instantané JSON, le comportement natif du logout, l'absence
   de suppression métier distante et la récupération de l'espace autonome.
8. **URL et session** : basculer A/B/A et changer de session sur une même URL.
   Vérifier qu'aucune donnée d'un autre espace ou d'un autre compte n'est
   affichée, exportée ou copiée.
9. **Réseau** : couper puis rétablir le réseau pendant une écriture ou une
   synchronisation. Vérifier la conservation locale et la reprise sans doublon ;
   une erreur réseau reste distincte d'un échec de transaction IndexedDB.
10. **Accessibilité et mobile** : inspecter visuellement les panneaux
    d'activation, de réconciliation, de diagnostic, d'espaces et de
    récupération. Naviguer uniquement avec Tab/Entrée/Espace/Échap, vérifier le
    retour de focus, les noms accessibles, les annonces de région live, les
    cibles tactiles d'au moins 44 px et la sortie lecteur d'écran. Ne capturer
    que des statuts redacted.

### 2.4 Preuve attendue

Chaque étape consigne : identifiant de scénario, appareil, navigateur et
version, date, SHA du commit, résultat observé, statut `réussi`, `échoué`,
`partiel` ou `non exécuté`, et incident éventuel. Une observation non exécutée
reste `non exécutée` et n'est jamais présentée comme acceptée.

## 3. Données de test et secrets

- Les fixtures, rapports et comptes rendus ne contiennent que des données
  synthétiques.
- Ne jamais écrire ni capturer : adresse email, valeur OTP, jeton, mot de
  passe, URL avec identifiants, identifiant personnel, titre, note ou contenu
  métier réel.
- Les seules URL citées sont des hôtes d'exemple `*.dexie.cloud` sans
  credentials. Les identifiants de fixture utilisent le préfixe synthétique
  `legacy:` ou des identifiants explicitement factices.
- Aucun transfert de données héritées vers Dexie Cloud n'est effectué sans
  consentement explicite. L'exécuteur CI n'émet aucune requête réseau.
- Les captures d'écran sont redacted et ne montrent ni compte, ni URL
  personnelle, ni contenu métier.

## 4. Sauvegarde moderne et clés historiques V1 retirées

1. Depuis l'espace IndexedDB de test, exporter le fichier de sauvegarde au
   format `threadstep.indexeddb-backup` et confirmer sa restauration complète
   dans un profil de test vierge. Les anciens fichiers `version: 1`, y compris
   certains exports historiquement produits depuis IndexedDB, ne sont plus
   acceptés.
2. Vérifier qu'une clé synthétique `threadstep.document.v1` reste inerte et
   qu'un import/restauration V1 est refusé **sans écriture ni effacement**.
3. Tester les commandes de nettoyage uniquement dans un profil de test :
   inventaire limité aux anciennes clés, option « ne rien effacer » par défaut,
   sauvegarde moderne vérifiée, confirmation explicite et suppression ciblée.
   L'annulation et l'échec doivent préserver les valeurs.
4. En cas d'incident ou d'absence apparente de données, restaurer uniquement
   une sauvegarde moderne préalablement vérifiée, dans un espace de test.
   Ne jamais purger une base personnelle ou la base Dexie Cloud réelle. Une
   restauration locale n'est pas une preuve de propagation distante.

## 5. Modèle de compte rendu

Le compte rendu manuel reprend exactement les sections suivantes. Il ne
remplace pas le rapport CI et ne fusionne pas leurs statuts.

```text
Instance de test (catégorie, date, SHA) :
Navigateurs et appareils :
Jeu de données synthétique (sujets / étapes) :
Export de secours vérifié : oui / non

CI
- Scénarios et contrôles exécutés par le runner :
- Statut : réussi / échoué / non exécuté
- Référence du rapport automatique :

Recette Dexie réelle
- Scénario :
- Observation attendue :
- Observation mesurée :
- Statut : réussi / échoué / partiel / non exécuté
- Preuve redacted :

Limites
- Propriété non prouvée par la CI :
- Impact sur la certification :

Incidents ouverts
- Identifiant :
- Gravité :
- Statut : ouvert / résolu
- Description sans donnée sensible :

Décision : accepté / partiel / à corriger
```

Règles du modèle :

- une observation non exécutée reste `non exécutée` ;
- une exécution partielle reste `partielle` ;
- la CI verte ne vaut jamais preuve d'une ligne de la recette Dexie réelle ;
- un incident ouvert interdit d'annoncer la certification globale réussie ;
- aucune mention « accepté » ne doit apparaître sans observation réelle.

## 6. Audit des capacités historiques

Cet audit vérifie les capacités historiques référencées par TS-039.
Aucun fichier sous `openspec/changes/archive/` n'a été modifié, et les textes
canoniques archivés n'ont pas été réécrits pour masquer un écart.

| Capacité | Conclusion au niveau exigence |
| --- | --- |
| `dexie-cloud-configuration` | Le libellé historique concerne l'ouverture synchronisée ; aucune exigence ne fait dépendre l'accès métier local d'une URL Cloud ou d'un OTP. Aucune contradiction normative. |
| `dexie-local-database` | Compatible avec l'espace local autonome et sa base distincte. Aucune contradiction normative. |
| `email-otp-authentication` | L'OTP authentifie une session Cloud ; il n'est pas requis en local-only. Aucune contradiction normative. |
| `legacy-document-migration` | Depuis TS-040, les documents historiques V1 sont inertes ; l'import, la restauration et l'export V1 sont retirés. Seul un nettoyage local volontaire peut retirer des clés historiques après vérification d'une sauvegarde moderne. |
| `local-first-business-persistence` | Compatible avec la persistance locale et l'activation facultative. Aucune contradiction normative. |
| `cloud-migration-reconciliation` | Le transfert exige un consentement explicite distinct de l'authentification. Aucune contradiction normative. |

Conclusion historique pour TS-039 : les capacités applicables à cette recette
ont évolué avec TS-040 ; les exigences canoniques actuelles font foi. Les
archives OpenSpec restent conservées sans modification. Toute autre évolution
doit passer par un delta normatif explicite.

## 7. Limites assumées

La CI ne prouve pas : IndexedDB réel, Chrome mobile, clavier, focus, tactile,
lecteur d'écran, livraison OTP, websocket Dexie Cloud, résolution serveur des
conflits, effacement du cache par logout natif, ni convergence entre deux
navigateurs. Ces propriétés restent des exigences de recette manuelle et ne
sont jamais comptées comme réussies par la matrice automatique.

Aucun service payant n'est appelé, aucune base personnelle n'est utilisée et
aucune donnée de test n'est envoyée à Dexie Cloud par l'exécuteur CI.
