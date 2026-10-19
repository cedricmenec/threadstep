# ThreadStep — recette fonctionnelle manuelle

**État au 16 octobre 2026 : recette manuelle déclarée OK par le propriétaire.** Attestation globale ; les scénarios individuels ci-dessous restent non cochés en l'absence de relevé détaillé et ne sont pas présentés comme vérifiés indépendamment. Voir [rapport de clôture ASF](../factory/closeout-2026-10-16.md).

Version de la checklist : Version testée à noter : `main` et commit `97d326c5b262622f8146348f385eb1e0d838829c` (16 octobre 2026), ou un SHA plus récent vérifié.

## Préparation sans perte de données

Avant de tester, **exporter le JSON réel**. Utiliser de préférence un navigateur/profil de test. Dans le produit, créer deux sujets A et B, plusieurs actions de même priorité, une action parente P avec trois sous-tâches (dont une terminée) et un autre parent Q. Ne pas vider le stockage de son profil habituel : l'import demande confirmation et remplace le document courant.

## Mode local IndexedDB sans Cloud (TS-032)

À vérifier sur Chrome mobile, sans URL Cloud enregistrée et hors ligne, dans un
profil de test. Ces contrôles restent manuels : les tests Node ne prouvent ni
IndexedDB réel, ni le hors ligne, ni le tactile, ni le lecteur d'écran.

- [ ] Au premier lancement sans Cloud, la vue métier est disponible sans OTP ni formulaire de configuration bloquant ; aucun appel réseau métier n'est visible dans l'onglet Réseau.
- [ ] Créer des sujets, des étapes et une sous-tâche, les modifier, en supprimer, puis recharger : les mêmes données et relations reviennent depuis l'espace local IndexedDB `threadstep-local`.
- [ ] Vérifier dans les outils du navigateur que l'ancienne clé `threadstep.document.v1`, si elle existe, reste intacte et n'affiche aucune notice de migration ni bouton d'export V1.
- [ ] Exporter une sauvegarde `threadstep.indexeddb-backup`, recharger, puis la restaurer dans un profil de test vierge en vérifiant sujets, étapes, hiérarchie, notes, priorités, ordres et états.
- [ ] Bloquer ou saturer IndexedDB : un message d'erreur local explicite apparaît, aucun faux succès n'est annoncé et l'export brut de récupération reste distinct de la sauvegarde métier.
- [ ] Présenter un fichier V1 : l'import et la restauration affichent un refus explicite et n'effacent rien.
- [ ] Sur un profil de test, choisir « Ne rien effacer », puis confirmer une sauvegarde vérifiée et vérifier que seul le nettoyage explicitement consenti supprime les clés V1 listées pour l'origine courante.
- [ ] Parcourir au clavier et au lecteur d'écran le panneau de nettoyage, les états d'erreur et les contrôles d'export ; vérifier le focus, les noms accessibles et les cibles tactiles.
- [ ] Après avoir configuré une URL Cloud, vérifier que la base synchronisée est distincte et qu'aucune donnée locale n'a été copiée ou envoyée par cette seule configuration.

## Sauvegarde IndexedDB modern et retrait V1 (TS-040)

À vérifier manuellement sur Chrome mobile et sur un second navigateur, dans des
profils de test, après avoir conservé une sauvegarde moderne de secours. Ces
contrôles ne sont pas prouvés par les tests Node. La conversion V1 n'existe plus :
aucun document `threadstep.document.v1` n'est proposé, converti, importé ou
restauré.

- Exporter depuis un espace local et depuis un espace Cloud de test, recharger,
  puis restaurer dans un profil vierge : vérifier 5 sujets, 18 étapes plus une
  tâche supplémentaire, la hiérarchie, les notes, priorités, ordres et états.
- Importer deux fois la même sauvegarde : aucun doublon. Provoquer une collision
  et un plan modifié avant confirmation : aucune perte et aucune écriture.
- Simuler une clé `threadstep.document.v1` : aucun panneau historique, aucun
  export V1 et aucun trafic Cloud ne réapparaissent. Présenter un fichier V1 :
  refus explicite, rien n'est effacé.
- Sur un profil de test uniquement, choisir « Ne rien effacer », puis vérifier
  qu'une sauvegarde moderne et la migration des préférences sont requises avant
  de supprimer les seules clés V1 listées pour l'origine courante. Tester
  l'annulation et une erreur : les valeurs restent intactes.

## Certification E2E local-first et Cloud (TS-039)

La matrice automatisée est décrite dans [e2e-certification.md](e2e-certification.md)
et exécutée par `node --test tests/product-e2e-matrix.test.mjs`. Elle couvre les
parcours local-only, activation, première synchronisation, cible peuplée,
divergence, conflits concurrents, reimport, restauration, déconnexion,
changement d'URL ou de session, erreurs réseau et les garanties transverses.

Les preuves **CI** (rapport automatique sans réseau) et la **recette Dexie
réelle** (instance isolée, Chrome mobile, deux navigateurs, OTP réel, hors
ligne et réseau intermittent) sont distinctes. Une CI verte ne prouve ni
IndexedDB réel, ni propagation distante, ni accessibilité : ces observations
restent manuelles, non cochées ici et à consigner séparément.

## Récupération non destructive d'un cache Cloud historique non vérifié (correctif TS-038)

À vérifier sur **deux profils de test** et une instance Dexie Cloud de test :
le correctif n'effectue pas automatiquement de rattachement d'un cache peuplé
à une identité récente. Il permet de relire le serveur dans une **nouvelle base
IndexedDB isolée** ; la base historique n'est ni supprimée, ni fusionnée.

- Se connecter à un espace Cloud historique `threadstep-<suffixe>` prérempli,
  sans `userDigest` dans le registre. Vérifier le diagnostic `UNVERIFIED`
  et que les données métier cachées ne deviennent pas visibles.
- Cliquer sur « Retrouver les projets Cloud dans un nouveau cache isolé » :
  avant confirmation, aucune base n'est créée, aucune mutation locale ni
  distante n'est émise. Confirmer puis ouvrir à nouveau la session native
  Dexie Cloud pour le même compte, et comparer les projets récupérés depuis
  le serveur sur les deux appareils.
- Dans Application > IndexedDB, vérifier que l'ancien cache, son contenu et
  ses tables `*_mutations` n'ont pas été supprimés/renommés, et que la
  nouvelle base contient uniquement des données reçues de Dexie Cloud.
- Simuler une mutation en attente, un état de mutation indéterminé, une phase
  offline, un `remoteDbId` différent, un changement d'utilisateur ou
  d'instance entre prévisualisation et confirmation, et une base de destination
  déjà existante : le correctif refuse la récupération **sans écriture**.
- Se connecter avec un autre compte après l'ouverture du nouveau cache :
  les données métier restent masquées. Tester l'annulation, reload, focus
  clavier, bouton tactile et lecture par lecteur d'écran.
- Ne jamais effectuer ce test en purgeant les bases personnelles : les
  enregistrements historiques peuvent contenir des modifications non poussées,
  même si la phase native Dexie indique `in-sync`.

## Tablette Android : première lecture Cloud avant liaison de compte

Recette manuelle à exécuter **sur des profils et données de test uniquement** :

- [ ] Sur un navigateur Android neuf, confirmer OTP et provoquer un pull qui peuple la base `threadstep-ws-*` avant le premier enregistrement de liaison : les données restent masquées et le diagnostic indique le cache non vérifié.
- [ ] Vérifier le bouton « Retrouver les projets Cloud dans un nouveau cache isolé » pour un workspace en activation ; lire l'avertissement et pouvoir annuler sans effet.
- [ ] Confirmer la récupération avec identité, cible, première synchronisation et absence de mutations attestées : nouvelle base vierge créée et liée au compte, ancienne IndexedDB et ses tables `*_mutations` inchangées, aucun push.
- [ ] Après recharge et OTP éventuellement renouvelé, vérifier les données autorisées, sans transfert fictif si la base locale autonome est vide.
- [ ] Simuler déconnexion réseau, pull non attesté, mutation en attente/inconnue, URL ou compte différent, base candidate préexistante : aucune récupération.
- [ ] Si la source locale autonome contient des données, vérifier qu'un transfert exige toujours revue et consentement explicite.

## Tests utilisateur à consigner

Cocher les cases **uniquement après observation réelle** ; noter navigateur, appareil, date, SHA et anomalie éventuelle dans le rapport ASF.

- [ ] Créer, renommer, terminer et supprimer des sujets/actions ; changer les priorités ; vérifier Urgent → Normal → Plus tard.
- [ ] Ajouter/modifier une sous-tâche et confirmer qu'elle reste sous son parent après rechargement.
- [ ] Réordonner deux actions principales de même priorité avec les boutons puis glisser-déposer ; refuser les déplacements inter-priorités ou entre sujets.
- [ ] Avec trois enfants dont un terminé, masquer puis démasquer les étapes terminées ; les compteurs et résultats filtrés sont cohérents.
- [ ] **TS-012/013/021 :** au chargement et à chaque entrée dans une vue, P est replié et le bouton indique « Voir 3 sous-tâches » (« Voir 2 sous-tâches » avec le filtre) ; cliquer pour déplier affiche exactement les trois et affiche « Masquer les sous-tâches », cliquer replie. Vérifier le singulier, l'absence du bouton à zéro enfant visible et l'indépendance entre P et Q.
- [ ] Le clic de repli ne modifie ni l'ordre, ni les états, ni le JSON exporté. Un rechargement ou un changement de vue repart avec les parents repliés (état de repli éphémère).
- [ ] **TS-014 :** réordonner au doigt puis via « Monter/Descendre » deux enfants de même parent et priorité ; refuser le drop sur un autre parent/priorité ; contrôler l'absence de changement lors d'un drop invalide.
- [ ] Vérifier que l'ordre valide des enfants reste après rechargement et un export/import JSON, alors que le repli ne persiste pas. Vérifier que les IDs/états/parents restent identiques.
- [ ] Activer « Masquer les étapes terminées » : poignées de déplacement absentes, boutons de déplacement désactivés, aucun contrôle enfant visible sous un parent replié.
- [ ] Retirer une sous-tâche ; activer « Annuler » avant 10 secondes et vérifier son rétablissement ; vérifier ensuite qu'un retrait expiré ne peut plus être annulé.
- [ ] Consulter « Une étape pour maintenant » et son explication ; utiliser « Garder le fil », « Je reprends ici », « Voir dans la liste » et « Ne plus suivre ». Vérifier stabilité malgré déplacements/renommage et invalidation lors du retrait de la cible.
- [ ] Tester navigation au **clavier seul** (Tab, Entrée, Espace), focus visible, noms accessibles, états `aria-expanded`, boutons désactivés aux bornes.
- [ ] Tester sur **un téléphone tactile** (viewport étroit), déplacement et repli, sans scroll involontaire ni zones de clic trop petites. Tester avec lecteur d'écran si possible.
- [ ] Exporter un JSON, l'importer dans un environnement de test et vérifier restauration des sujets/états/ordre ; vérifier que l'état éphémère de repli et la préférence de reprise restent distincts.
- [ ] Vérifier qu'aucune requête n'envoie le contenu de ses tâches vers un service distant ; vérifier le message si le stockage navigateur est bloqué.

## Compte rendu

```text
Date et validateur :
SHA / Pages déployé :
Ordinateur : navigateur, version, OS :
Téléphone : navigateur, OS :
Clavier et accessibilité :
Nombre de tests réussis / non réalisés / échoués :
Anomalies + preuve éventuelle (sans données privées) :
Décision : ACCEPTÉ / À CORRIGER / PARTIEL
```

Les PR #55, #58, #59, les tests Node et CI/Pages démontrent une **livraison technique**, pas l'achèvement de cette recette manuelle.
