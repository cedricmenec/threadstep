# ThreadStep — recette fonctionnelle manuelle

## GO propriétaire TS-065 (27 octobre 2026)

Le propriétaire confirme une recette manuelle globale **desktop et Android** pour les interactions React Overview livrées via PR #216. Voir le [rapport TS-065](react-overview-ts-065-acceptance.md) pour la provenance et les limites : les vérifications individuelles non attestées ne sont pas cochées rétroactivement. Ce GO ne valide pas à lui seul les références Stitch nécessaires à TS-066.


## Recette propriétaire TS-064 (26 octobre 2026)

Le propriétaire a déclaré une **validation globale desktop et Android** de la
surface React des cartes Overview livrée par la PR #214. Le compte rendu et
ses limites de preuve scénario par scénario figurent dans le
[rapport daté TS-064](react-overview-ts-064-acceptance.md). Ce GO humain ne
transforme pas les cases non renseignées de cette checklist générale en PASS.


**État au 16 octobre 2026 : recette manuelle déclarée OK par le propriétaire.** Attestation globale ; les scénarios individuels ci-dessous restent non cochés en l'absence de relevé détaillé et ne sont pas présentés comme vérifiés indépendamment. Voir [rapport de clôture ASF](../factory/closeout-2026-10-16.md).

Version de la checklist : Version testée à noter : `main` et commit `97d326c5b262622f8146348f385eb1e0d838829c` (16 octobre 2026), ou un SHA plus récent vérifié.

## Préparation sans perte de données

Les copies locales et distantes, les preuves de synchronisation et les
procédures sûres à relire avant une action risquée sont décrites dans le
[Guide de la persistance et de la synchronisation](guide-persistance-et-synchronisation.md).

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

## Navigation, menu et pages de paramètres (TS-041)

À vérifier dans un vrai navigateur, sur téléphone et sur ordinateur. Ce
contrôle reste **à effectuer** tant qu'aucune preuve réelle n'est consignée.

- Le bouton « Menu » est présent dans l'en-tête sur toutes les pages et
  ouvre un panneau contenant, dans l'ordre, « Mes projets », « Paramètres »,
  « Imports / Exports » et « Synchronisation Dexie Cloud ».
- Les fragments `#/parametres`, `#/parametres/donnees` et
  `#/parametres/synchronisation` affichent la bonne page ; les liens
  profonds, Précédent/Suivant et le rechargement restaurent la vue, y compris
  pour `#/sujet/<id>`.
- Échap ferme le menu et rend le focus au bouton ; un clic extérieur le
  ferme ; après un lien, le focus rejoint le titre de destination ;
  `aria-expanded` et l'état masqué restent cohérents.
- Le menu et les pages de paramètres restent utilisables à 320 px et au
  clavier, sans débordement horizontal, avec des cibles d'au moins 44 × 44 px.
- Les commandes d'export, d'import et de restauration sont réunies sur
  `#/parametres/donnees` ; l'accueil ne duplique plus la barre d'actions.
  Les commandes de connexion, de configuration Cloud, d'activation et de
  gestion des espaces sont réunies avec le diagnostic complet sur
  `#/parametres/synchronisation`, chacune une seule fois.
- Naviguer entre Mes projets et les pages de paramètres ne modifie aucune
  donnée IndexedDB, aucune configuration Cloud et ne déclenche ni requête
  réseau, ni authentification, ni pull.

## Imports / Exports sur une page dédiée (TS-042)

À vérifier dans de vrais navigateurs de test, sur ordinateur et sur mobile,
avec des données synthétiques uniquement. Ces contrôles restent **à
effectuer** tant qu'aucune preuve réelle n'est consignée.

- Depuis le menu, ouvrir `#/parametres/donnees` au clavier et au toucher ;
  vérifier les sections « Exporter », « Importer et fusionner » et
  « Restaurer un état antérieur », les libellés visibles, le focus, les
  cibles d'au moins 44 × 44 px et l'absence de débordement à 320 px.
  Vérifier que l'accueil n'affiche plus la barre d'actions de données.
- Comparer un export `threadstep.indexeddb-backup` produit avant et après
  le déplacement : mêmes sujets, tâches, relations, compteurs et empreinte,
  sans secret, OTP, jeton, configuration Cloud ni donnée de compte.
- Importer deux fois une sauvegarde moderne : aucun doublon. Provoquer une
  collision et une référence invalide : elles sont bloquées. Présenter un
  fichier V1 et un JSON invalide : message explicite, aucune écriture et
  fichier source intact.
- Démarrer une restauration : vérifier la portée affichée, l'obligation de
  télécharger la sauvegarde de l'état actuel et la saisie exacte de
  `RESTAURER`. Tester annulation, changement de page, rechargement et
  hors-ligne : aucune restauration ni perte implicite.
- Dans une confirmation réelle de purge, de déconnexion ou d'action sur un
  espace de travail, vérifier que la sauvegarde de sécurité reste
  accessible dans ce même contexte. Vérifier aussi que l'export brut reste
  accessible depuis le diagnostic de récupération en lecture seule.

## Diagnostic de synchronisation dédié (TS-043)

À vérifier dans de vrais navigateurs de test, sur ordinateur et sur mobile,
avec des profils isolés et des données synthétiques uniquement. Ces contrôles
restent **à effectuer** tant qu'aucune preuve réelle n'est consignée.

- Ouvrir `#/parametres/synchronisation` depuis le menu, vérifier le titre
  « Synchronisation Dexie Cloud », la synthèse de l'état courant, les
  informations techniques, le retour aux paramètres et l'absence de
  débordement horizontal à 320 px. Revenir à Mes projets, puis utiliser
  Précédent/Suivant et recharger : les mêmes valeurs diagnostiques et le même
  contexte Dexie doivent rester visibles.
- Avec un profil local isolé et le réseau désactivé, vérifier l'affichage
  « Cloud non configuré » et « local uniquement », l'absence d'OTP, l'absence
  d'ouverture d'instance Cloud et l'absence de requête réseau. Comparer avec
  le résumé minimal de Mes projets.
- Avec un profil Cloud de test et une session active, vérifier séparément la
  session, la connexion, la phase, le cache ou la base, le pull initial, les
  écritures locales, les erreurs classées et la preuve distante. Simuler une
  erreur réseau et un rechargement : aucune base vide n'est affirmée, aucune
  relance n'est automatique et aucun email, OTP, token, titre, note ou contenu
  métier n'apparaît.
- Vérifier au clavier et au lecteur d'écran le focus après navigation, les
  annonces de statut et d'erreur, la raison de désactivation et la cible de
  44 px de « Relancer la lecture distante ». Le pull manuel conserve ses
  garde-fous ; l'ouverture ou la fermeture de la page ne le déclenche jamais.
- Vérifier que « Configuration », « Première activation », « Connexion » et
  « Espaces de travail » contiennent une seule fois `#cloud-config`,
  `#cloud-activation`, `#auth-panel` et `#workspace-panel`, sans formulaire
  dupliqué ailleurs dans le document.

## Paramètres Cloud unifiés et onboarding (TS-044)

À vérifier manuellement dans de vrais navigateurs de test, sur ordinateur et
sur smartphone, avec des profils isolés et une instance Dexie Cloud de test.
Ces scénarios restent **à effectuer** tant qu'aucune preuve réelle n'est
consignée ; aucun test simulé ne les atteste.

- Depuis un profil local vierge, vérifier le démarrage sans Cloud, l'usage
  normal de Mes projets, puis l'accès à la configuration et à l'onboarding
  depuis Paramètres. Soumettre une URL invalide puis une URL valide, recharger
  et vérifier que la même URL est conservée sans copie ni OTP implicite.
- Provoquer un OTP, quitter la page pendant la saisie, revenir : le formulaire,
  le statut et l'erreur éventuelle restent inchangés, aucun code n'est soumis
  ni redemandé par la navigation. Vérifier l'expiration et la reprise de
  session selon le flux natif.
- Démarrer une activation sur un espace local peuplé, afficher une revue de
  plan, quitter puis revenir : la revue et la destination restent affichées et
  la confirmation reste désactivée sans consentement explicite. Vérifier
  qu'aucune copie, insertion ou validation n'a eu lieu avant l'opt-in et la
  confirmation, puis tester l'annulation.
- Avec deux navigateurs et un compte de test connecté, vérifier le même
  espace, les tâches et les statuts de diagnostic après refresh, changement de
  page et reconnexion. Provoquer une divergence, un état hors ligne, une erreur
  réseau et un pull initial non vérifié : les tâches locales restent
  accessibles, aucune base vide n'est affirmée et aucune relance n'est
  automatique.
- Vérifier que le lien d'accès contextuel de Mes projets apparaît uniquement
  lorsqu'une action Cloud ou une erreur locale le justifie, qu'il reste
  distinct du résumé non interactif et qu'il n'exécute aucune action.
- Tester séparément « Sélectionner cet espace » (changement d'espace),
  « Suspendre Cloud », « Se déconnecter » et « Purger la copie locale » :
  libellés, nom de base, portée, avertissement sur les écritures non
  transmises, sauvegarde JSON, annulation et confirmation. Vérifier qu'aucune
  donnée distante ni aucun autre espace n'est détruit.
- Vérifier le parcours A/B/A d'URL, la transition entre espace autonome et
  espace synchronisé, la conservation des données et du diagnostic après
  chaque changement, ainsi que la lisibilité à 320 px, les cibles de 44 px et
  les annonces d'un lecteur d'écran.

## Continuité des interactions dans les listes longues (TS-049)

Le contrat transversal applicable est
[`ux-interaction-continuity`](../../openspec/specs/ux-interaction-continuity/spec.md).
Ne jamais déduire la conformité sur une tablette de la seule réussite d'un
téléphone ou d'une simulation Node. Vérifier que la liste ne se contracte pas
temporairement lors d'un rendu et que le focus reste sur un contrôle monté.

- [ ] Dans une longue liste, à plusieurs écrans du haut, créer une étape puis
  en créer une deuxième : ni saut en haut, ni perte de saisie/focus.
- [ ] Au même endroit, cocher et décocher une étape avec et sans le filtre
  « Masquer les étapes terminées » : ancrage conservé ou repli cohérent
  sur un élément voisin quand l'étape disparaît.
- [ ] Répéter création et complétion sur **tablette Android en portrait et
  paysage**, puis sur **téléphone Android** et sur ordinateur. Noter appareil,
  version du navigateur, orientation, état du clavier virtuel et SHA/Pages.
- [ ] Vérifier que navigation explicite et changement de compte ne retiennent
  pas artificiellement l'ancienne hauteur ou le focus métier.

**Historique utilisateur communiqué (21 octobre 2026, heure de Paris) :**
sur Huawei MediaPad M5 10 pouces Android, le saut était reproduit en portrait
et en paysage après la PR #163 alors que le Samsung A40 Android fonctionnait.
Après le correctif de rendu atomique
[PR #165](https://github.com/cedricmenec/threadstep/pull/165), l'utilisateur
a confirmé « Ça fonctionne » sur la tablette. Version du navigateur, orientation
de cette dernière confirmation, cas clavier/Cloud et preuve instrumentée :
**non fournis**. Cette remontée ne valide pas automatiquement toutes les
cases ci-dessus ni TS-050.

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
