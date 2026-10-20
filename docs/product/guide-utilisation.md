# ThreadStep | Guide d'utilisation

**État technique vérifié : 16 octobre 2026**, après les PR #55 (TS-012),
#58 (TS-013) et #59 (TS-014), avec CI et Pages post-fusion réussies.
TS-016 (vue de détail et renommage ciblé d'un projet) est documentée ici ;
sa vérification par PR, CI sur SHA exact et Pages reste à confirmer après fusion.
Recette manuelle : **déclarée OK par le propriétaire le 16 octobre 2026** ; [checklist détaillée et limites de preuve](acceptance-checklist.md).
Application : https://cedricmenec.github.io/threadstep/

ThreadStep est une page web personnelle en français pour retrouver
rapidement la prochaine action de plusieurs sujets de travail.
Elle est utilisable sur téléphone ou sur ordinateur, sans compte,
serveur applicatif ni intelligence artificielle dans le navigateur.

## Navigation, menu et paramètres (TS-041)

Le bouton **« Menu »** de l'en-tête ouvre un panneau de navigation
disponible sur téléphone comme sur ordinateur. Il contient exactement
quatre entrées, dans cet ordre : **Mes projets**, **Paramètres**,
**Imports / Exports** et **Synchronisation Dexie Cloud**, qui ciblent
respectivement `#/`, `#/parametres`, `#/parametres/donnees` et
`#/parametres/synchronisation`.

- Les trois pages de paramètres affichent un titre explicite et un lien
  de retour : « Retour à Mes projets » depuis `#/parametres`, puis
  « Retour aux paramètres » depuis les deux pages de destination.
- Les liens profonds, Précédent/Suivant et le rechargement restaurent la
  page correspondant au fragment courant. La route `#/sujet/<id>` et son
  retour vers Mes projets restent inchangés.
- Le menu se ferme après navigation, avec **Échap** et lors d'une action
  extérieure. Échap rend le focus au bouton ; après un lien, le focus
  rejoint le titre de la page affichée.
- La page **Imports / Exports** (`#/parametres/donnees`) réunit désormais
  les commandes d'export, d'import/fusion et de restauration dans trois
  sections distinctes. L'accueil **n'affiche plus** la barre d'actions de
  données : les commandes ne sont ni dupliquées ni recréées.
- La page Synchronisation Dexie Cloud (`#/parametres/synchronisation`)
  héberge le **diagnostic complet** en lecture seule et son résumé, ainsi que
  les sections « Configuration », « Première activation », « Connexion » et
  « Espaces de travail ». Chaque formulaire ou commande existant y apparaît
  **une seule fois**, avec son identifiant et son handler d'origine. La
  sauvegarde de sécurité proposée dans une confirmation de purge, de
  déconnexion ou d'action sur un espace de travail, ainsi que l'export brut du
  diagnostic de récupération, restent disponibles **dans leur contexte
  d'origine**, sans navigation préalable vers `#/parametres/donnees`.
- Ouvrir, fermer ou changer de page ne déclenche aucune écriture
  IndexedDB, requête réseau, authentification ni modification Cloud.

## Diagnostic de synchronisation dédié (TS-043)

La page `#/parametres/synchronisation` réunit le **diagnostic complet** Dexie
Cloud en lecture seule, son titre « Synchronisation Dexie Cloud », une
synthèse de l'état courant et les informations techniques déjà produites par
les signaux natifs. Elle affiche séparément la session, la connexion, la
phase, la base ou le cache, le pull initial, les écritures locales, les
erreurs classées et la preuve distante disponible. Un espace local sans
configuration indique clairement « Cloud non configuré » et « local
uniquement », sans ouvrir d'instance Cloud, demander un OTP ni envoyer de
requête.

Mes projets ne conserve qu'un **résumé d'attention minimal**, non interactif
et annoncé par une zone de statut, lorsqu'un état Cloud configuré n'est pas
entièrement en phase ou qu'une erreur locale existe. Ce résumé ne propose
aucune relance et reste masqué pour un local non configuré sain ou une
synchronisation configurée entièrement en phase.

L'action « Relancer la lecture distante » reste dans le diagnostic avec ses
**garde-fous** et son handler natif existants. Ouvrir, quitter ou recharger la
page ne lance jamais ce pull manuel : seule son activation explicite, lorsque
ses préconditions l'autorisent, peut le déclencher. Aucun secret, email, OTP,
token ni contenu métier n'apparaît dans la page ni dans le résumé, et
l'absence de preuve distante n'est jamais présentée comme une base vide.

## Paramètres Cloud unifiés et onboarding contextuel (TS-044)

La page `#/parametres/synchronisation` est désormais l'unique destination
Cloud : configuration HTTPS, activation opt-in, connexion OTP, espaces de
travail et diagnostic y sont réunis dans des sections nommées, sans doublon
ni second formulaire. Un lien d'accès distinct, visible depuis Mes projets
uniquement lorsqu'une session, un pull, une écriture ou une activation
suspendue réclame une action, ouvre cette page sans lancer d'OTP, de pull, de
transfert ou de purge.

Le bandeau **« Parcours d'onboarding »** affiche l'étape la plus avancée
réellement attestée et l'action suivante autorisée : mode local autonome,
configuration d'une URL HTTPS, activation opt-in, connexion OTP native,
première lecture distante, revue de plan, consentement, transfert puis
synchronisation active. Un état hors ligne, non vérifié ou en erreur reste
explicitement récupérable et n'est jamais présenté comme une cible vide. Une
URL invalide est refusée sans effet ; une URL valide reste enregistrée après
rechargement et ne copie aucune donnée locale.

Ouvrir, quitter ou recharger la page ne réinitialise ni ne soumet un OTP en
cours, une revue d'activation, une erreur ou un consentement affiché ; seule
une action explicite peut soumettre, annuler, confirmer ou purger. Les quatre
actions d'espace restent distinctes : « Sélectionner cet espace » pour changer
d'espace, « Suspendre Cloud », « Se déconnecter » et « Purger la copie
locale ». Chacune affiche l'URL, le nom effectif de la base locale, la portée
concernée, l'avertissement sur les changements non transmis, une sauvegarde
JSON préalable, une annulation et une confirmation explicite. Aucune purge ni
suspension ne supprime de donnée distante ou un autre espace.

## Imports, exports et restauration (TS-042)

La page `#/parametres/donnees`, accessible depuis le menu, distingue trois
intentions sans changer les moteurs existants :

- **Exporter** produit un fichier JSON local IndexedDB au format
  `threadstep.indexeddb-backup`. Il contient les sujets, tâches et
  relations, sans secret, OTP, jeton ni réglage Cloud.
- **Importer et fusionner** est additif et non destructif : une
  prévisualisation précède l'écriture, les enregistrements déjà présents
  ne sont pas dupliqués et l'état courant n'est jamais supprimé. Un
  fichier V1 ou invalide est refusé avec un message explicite, sans
  écriture.
- **Restaurer un état antérieur** remplace l'état actuel. La restauration
  exige le téléchargement préalable d'une sauvegarde, la saisie exacte de
  `RESTAURER` et un plan autorisé. Une annulation, un changement de page
  ou un rechargement ne déclenche aucune restauration implicite.

## Sujets, actions et priorités

1. Entrer un intitulé dans « Ajouter un sujet ou un projet… », puis
   choisir « + Ajouter ».
2. Dans le sujet, saisir une action, choisir sa priorité
   **Urgent**, **Normal** ou **Plus tard**, puis « + Étape ».
3. Cocher une action pour la marquer terminée. Les priorités déterminent
   toujours l'ordre des groupes affichés : Urgent, Normal, Plus tard.
4. Le menu « ⋮ » d'une action regroupe ses commandes : « Ajouter une
   sous-tâche » (tâche principale), « Modifier », « Garder le fil » et
   le déplacement clavier « Monter » / « Descendre ».
5. Les boutons fléchés de chaque **sujet** permettent de monter ou
   descendre ce sujet. « Supprimer » un sujet demande une confirmation
   et retire aussi ses actions.

## Distinguer une tâche et ses sous-tâches (TS-020)

Une **tâche principale** et ses **sous-tâches directes** se
reconnaissent au premier regard, dans la vue d'ensemble comme dans la
vue de détail, sans se fier à la couleur ni au badge de priorité :

- Une tâche principale ouvre une ligne plus marquée : titre un peu plus
  grand et plus espacé au-dessus, note et commandes regroupées sous elle.
- Les sous-tâches sont **indentées** sous leur parent, reliées par un
  **guide vertical** à gauche de la liste et affichées dans une
  typographie légèrement plus petite et plus dense. L'indentation, le
  guide et l'échelle typographique restent visibles même si la couleur
  est ignorée ; au moins deux de ces indices ne dépendent pas de la
  couleur.
- La même hiérarchie s'applique quand une étape est **terminée**, quand
  le filtre **« Masquer les étapes terminées »** réduit la liste et
  quand une action parente est **repliée**. Les tâches restent des
  éléments de liste et les sous-tâches un groupe imbriqué du bon parent :
  l'ordre de lecture, les noms accessibles et le clavier sont
  préservés.
- Les couleurs de priorité et de complétion, le focus visible, les
  cibles tactiles d'au moins 44 × 44 px et les préférences de mouvement
  réduit sont inchangés. Le guide et l'indentation ne déclenchent ni
  glisser-déposer, ni édition, ni changement de priorité ou de
  complétion. La présentation s'adapte aux petits écrans sans
  débordement horizontal et n'écrit rien dans les données.

## Lignes compactes et menu d'actions « ⋮ » (TS-023)

Pour parcourir une liste plus dense sur ordinateur comme sur mobile,
chaque tâche et chaque sous-tâche garde directement visibles ses
commandes principales — case de complétion, titre, badge de priorité
interactif, poignée de glisser-déposer et bouton de repli — et
regroupe ses commandes secondaires dans un menu **« ⋮ »** :

- Le bouton **« ⋮ »** porte le nom accessible **« Actions pour
  [titre] »** et une cible d'au moins 44 × 44 px. Son état
  (`aria-expanded`) indique si le menu est ouvert.
- Le menu contient uniquement les commandes applicables :
  **« Modifier »** et **« Retirer »** partout, **« Ajouter une
  sous-tâche »** sur une tâche principale, **« Promouvoir en tâche
  principale »** sur une sous-tâche directe, **« Garder le fil »**
  (ou l'état suivi) sur une tâche principale non terminée, et
  **« Monter »** / **« Descendre »** quand le déplacement est
  possible. Aucune commande n'est dupliquée sur la ligne.
- Le déplacement clavier **« Monter »** / **« Descendre »** quitte la
  ligne visible mais reste disponible dans le menu, sans geste de
  glisser-déposer, avec les mêmes règles de groupe (même sujet, même
  parent, même priorité) et les mêmes directions impossibles
  désactivées. Les flèches de réordonnancement des **projets**
  restent inchangées.
- Le menu s'ouvre et se ferme à la souris, au toucher, avec **Entrée**
  ou **Espace**, et **Échap** le referme ; **Tab** parcourt ses
  commandes dans l'ordre affiché. Un clic ou un appui à l'extérieur,
  un changement de vue ou l'activation d'une commande le referment, et
  le focus revient au bouton après la fermeture. Un seul menu est
  ouvert à la fois.
- L'ouverture et la fermeture d'un menu n'écrivent rien dans le
  stockage local, ne modifient pas le document et ne déclenchent aucun
  glisser-déposer. Les commandes déplacées conservent leurs
  validations, notifications, enregistrements et annulations
  habituels ; le badge de priorité garde ses trois valeurs, sa zone
  interactive d'au moins 44 × 44 px et ne déclenche ni le menu ni le
  glisser-déposer.

## Promouvoir une sous-tâche en tâche principale (TS-022)

Une sous-tâche devenue autonome n'a pas besoin d'être recréée. Chaque
**sous-tâche directe** propose, dans son menu **« ⋮ »** et dans la vue
d'ensemble comme dans la vue de détail, la commande
**« Promouvoir en tâche principale »** :

- L'opération est immédiate, sans fenêtre de confirmation, car aucune
  donnée n'est détruite. La sous-tâche garde son identifiant, son titre,
  sa priorité, son état terminé et sa note éventuelle : seul son
  `parentId` devient `null`.
- La tâche promue rejoint le même projet comme tâche principale. Elle
  est placée juste après son ancien parent, sans modifier l'ordre des
  autres éléments ni les priorités ; les autres sous-tâches restent
  attachées à leur parent.
- Les listes, le total de tâches principales et l'aperçu se mettent à
  jour ; le compteur d'étapes en attente ne change pas. La tâche promue
  reçoit le focus, ou son détail s'ouvre si elle se trouve au-delà des
  cinq tâches visibles de l'aperçu. Si l'ancien parent n'a plus aucune
  sous-tâche visible, son bouton de repli disparaît.
- Une promotion valide n'enregistre qu'une fois. Une action invalide
  (identifiant inconnu, élément déjà principal, parent absent ou
  incohérent) n'écrit rien, et une promotion déjà effectuée ne se
  rejoue pas.
- Il n'existe pas de bouton inverse « rétrograder ». Le bouton est
  utilisable au clavier, à la souris et au toucher, avec un libellé
  explicite, une cible d'au moins 44 × 44 px et un focus visible.
- Le format de sauvegarde `threadstep.indexeddb-backup` et les règles
  existantes d'édition, de note, de retrait/annulation et de
  réordonnancement restent inchangés. Un fichier V1 est refusé.

## Ajouter une note facultative à une action (TS-019)

Chaque action principale et chaque sous-étape peut porter une **note
en texte libre**, utile pour un contexte trop long pour le titre
(numéro de téléphone, raison d'attente, lien à suivre) :

- Dans le formulaire **« Modifier »**, la zone multiligne
  **« Note (facultative) »** est préremplie avec la note existante.
  « Enregistrer » valide le titre, la priorité et la note ensemble ;
  la note accepte jusqu'à **2 000 caractères**, retours à la ligne
  compris, et les conserve tels quels.
- Une note **vide ou uniquement composée d'espaces** supprime le champ
  `note` de l'action. Une saisie de plus de 2 000 caractères affiche
  un message d'erreur accessible et n'enregistre rien. « Annuler », ou
  « Enregistrer » sans rien changer, n'écrit rien. L'identifiant,
  l'état terminé, la priorité, le parent et l'ordre ne sont jamais
  modifiés par l'enregistrement de la note.
- Une note non vide s'affiche dans le corps de l'action, sous son
  titre et au-dessus des sous-étapes, **en texte brut** : le contenu
  n'est jamais interprété comme du HTML, du Markdown ou un lien actif,
  même s'il ressemble à du balisage. Le rendu est identique dans la
  vue d'ensemble et dans la vue de détail.
- Les notes survivent aux opérations habituelles (terminer, changer la
  priorité, réordonner, replier, retirer puis annuler) et au
  rechargement. La sauvegarde `threadstep.indexeddb-backup` les inclut ;
  un **import** refuse entièrement un fichier dont une note n'est pas du
  texte ou dépasse 2 000 caractères, sans écraser les données locales.
- Aucune migration ni nouvelle clé de stockage : `note` reste un champ
  **facultatif** des enregistrements d'étape.

## Ouvrir un projet dans une vue dédiée (TS-016)

Chaque carte de la vue d'ensemble propose un bouton **« Ouvrir le projet »**
dans son en-tête. L'activer affiche une vue interne dédiée au sujet choisi,
sans quitter l'application ni recharger la page :

- La vue de détail montre le **titre du projet**, son compteur d'étapes en
  attente, ses actions principales et leurs sous-étapes directes dans une
  présentation plus aérée que l'overview. Aucune carte d'un autre projet
  n'apparaît.
- Toutes les commandes d'étape restent disponibles et se comportent comme
  dans la vue d'ensemble : ajouter, modifier, terminer, filtrer, replier ou
  déplier, réordonner dans le groupe autorisé (même sujet, même priorité),
  retirer et annuler le retrait. Les mêmes règles de validation, de
  priorité, de parenté, de filtre et d'ordre s'appliquent.
- Les deux vues lisent et modifient **le même document et les mêmes
  identifiants** : aucune copie de projet, d'action ou de sous-étape. Toute
  modification faite dans le détail apparaît immédiatement dans l'overview,
  le compteur global, la suggestion, le suivi « Je reprends ici » et
  l'export JSON.
- Le bouton **« Retour à la vue d'ensemble »** ramène aux cartes. Les
  boutons Précédent/Suivant du navigateur et le rechargement d'un lien de
  détail valide restaurent la bonne vue.
- L'ouverture, la fermeture et le changement de vue sont des opérations
  d'**affichage uniquement** : elles n'écrivent rien dans le stockage local,
  ne modifient pas le document et ne créent aucune nouvelle préférence, clé
  ni identifiant.
- Si l'adresse ne correspond à aucun projet présent (lien mal formé, projet
  importé absent ou supprimé depuis un autre onglet), un message accessible
  « Projet introuvable » et un bouton de retour s'affichent, sans créer ni
  modifier de projet.

### Renommer le projet depuis le détail

Le bouton **« Renommer le projet »** ouvre une saisie explicite pré-remplie
avec le nom actuel, avec **« Enregistrer »** et **« Annuler »** :

- Le nom est nettoyé de ses espaces de début et de fin ; il doit rester
  **non vide** et **au plus 100 caractères**, comme à la création d'un sujet.
- Enregistrer un nom valide change **uniquement le titre** du projet visé et
  actualise aussitôt la vue de détail puis la carte de l'overview. Son
  identifiant, ses étapes, les `parentId`, l'ordre et les priorités restent
  inchangés, et le nouveau nom est conservé au rechargement comme à
  l'export/import JSON.
- Annuler, proposer un nom vide ou trop long, ou enregistrer le nom déjà en
  place n'écrit rien : ni le document, ni le stockage local, ni l'export JSON.

## Aperçu limité à cinq tâches par projet (TS-017)

Pour garder chaque carte compacte, la vue d'ensemble n'affiche que les
**cinq premières tâches principales visibles** de chaque projet, dans
l'ordre et le filtre existants (priorité puis ordre manuel ; filtre
« Masquer les étapes terminées » appliqué avant la limite) :

- Une tâche principale et ses sous-tâches directes comptent pour **une
  seule** entrée du quota : les sous-tâches affichées ne consomment pas
  de place supplémentaire et gardent leur repli et leur filtre habituels.
- La limite est **propre à chaque carte** et ne modifie pas les données.
  Une étape terminée exclue par le filtre ne consomme aucune place, et
  les compteurs de la carte et de la page restent fondés sur le document
  complet.
- S'il reste plus de cinq tâches principales visibles, un **seul**
  bouton **« Voir plus »** apparaît sous la liste, avec un nom accessible
  qui nomme le projet. S'il en reste cinq ou moins, aucun bouton n'est
  affiché ; l'état vide habituel est conservé si aucune étape n'est
  visible.
- **« Voir plus »** ouvre la **vue de détail** du bon projet (la même
  route `#/sujet/<id>` que « Ouvrir le projet »), avec le même retour,
  le même historique et le même focus. Le détail n'applique **aucune
  limite de cinq** : toutes les tâches autorisées par le filtre y sont
  accessibles, y compris celles masquées dans l'aperçu.
- Les tâches au-delà du quota ne sont pas présentes dans l'aperçu,
  ne peuvent pas y recevoir le focus et ne sont ni sources ni cibles
  d'un déplacement par glisser-déposer dans cette vue. Le bouton
  « Ouvrir le projet » reste dans l'en-tête de la carte.

## Total des tâches principales (TS-018)

Chaque carte projet affiche dans son en-tête, sous le compteur en
attente, un libellé explicite en français :

- **« 0 tâche au total »**, **« 1 tâche au total »** ou
  **« N tâches au total »** (pluriel dès deux). Ce total compte toutes
  les **tâches principales** (`parentId: null`) du projet, terminées ou
  non, et **exclut les sous-tâches directes**, qui ne l'augmentent pas.
- Il reste **indépendant** du filtre « Masquer les étapes terminées »,
  du repli des sous-tâches et de la limite d'affichage à cinq tâches de
  l'aperçu (TS-017) : il est recalculé sur le document complet à chaque
  rendu et se met à jour lors d'un ajout, d'un retrait, d'une
  annulation, d'un import ou d'un réordonnancement.
- Le compteur existant **« N étape(s) en attente »** conserve exactement
  son calcul (toutes les étapes non terminées, sous-tâches comprises) et
  son libellé. Les deux nombres restent distincts et complémentaires.
- Le même total est aussi affiché dans l'en-tête de la **vue de détail**
  pour la cohérence, sans changer la navigation ni le compteur en
  attente.

Le total est purement présentationnel : il ne crée aucun champ, aucune
clé de stockage ni écriture localStorage et ne modifie pas l'export JSON.

## Changer la priorité depuis son badge (TS-015)

Le badge **Urgent**, **Normal** ou **Plus tard** de chaque action
principale et de chaque sous-étape est un contrôle interactif :

- Un clic ou un appui sur le badge ouvre un choix explicite parmi
  **Urgent**, **Normal** et **Plus tard**. La valeur actuelle est
  indiquée. Au clavier, un **Tab** place le focus sur le badge, puis
  **Entrée** ou **Espace** ouvre le choix ; **Échap** le referme sans
  rien changer.
- Choisir une autre priorité l'applique **uniquement à l'étape
  visée**, immédiatement : le badge et sa couleur sont actualisés et
  l'étape reprend sa place dans le groupe de priorité correspondant
  (Urgent, Normal, Plus tard). L'enregistrement local est automatique,
  comme pour les autres modifications.
- Choisir la valeur déjà sélectionnée, fermer le choix sans sélection
  ou appuyer sur **Échap** n'écrit rien : ni le document, ni le
  stockage local, ni l'export JSON.
- Le badge ne déclenche ni le déplacement, ni la case de complétion,
  ni le repli des sous-tâches, ni « Retirer », ni l'édition du titre.
  Les identifiants, les titres, l'état terminé, le parent et l'ordre
  relatif des autres étapes restent inchangés ; changer la priorité
  d'une sous-étape ne la rattache jamais à un autre parent.
- Le formulaire complet **« Modifier »** reste disponible et son
  réglage de priorité fonctionne toujours. Le compteur, la suggestion
  « Une étape pour maintenant », le suivi « Je reprends ici » et le
  réordonnancement par groupe reflètent la nouvelle priorité. Une
  priorité modifiée survit à un rechargement et à un export suivi
  d'un import.

## Réorganiser les actions de même priorité (TS-011)

L'ordre est personnalisable **à l'intérieur d'un groupe de priorité
du même sujet uniquement** :

- Faire glisser la **poignée ⠿** d'une action principale vers une autre
  action de **même priorité**, au moyen d'une souris, d'un doigt ou
  d'un stylet. Les dépôts sur une autre priorité, un autre sujet,
  une sous-étape ou une zone vide sont refusés.
- Pour utiliser le clavier, ou si le glisser-déposer est peu pratique
  sur téléphone, ouvrir le menu **« ⋮ »** de l'action puis activer
  **« Monter »** ou **« Descendre »** ; chaque activation la déplace
  d'une place dans son groupe de priorité. Les directions impossibles
  sont désactivées.
- Si **« Masquer les étapes terminées »** est coché, le réordonnancement
  est temporairement désactivé. Afficher de nouveau toutes les étapes
  pour les déplacer.
- Une action parente conserve ses sous-étapes. Le geste de déplacement
  d'une **action principale** ne déplace pas indépendamment ses enfants ;
  ceux-ci possèdent leur propre réordonnancement décrit ci-dessous.

L'ordre choisi est sauvegardé localement, rétabli au rechargement
et inclus dans le fichier exporté. À priorité égale,
« Une étape pour maintenant » tient compte du nouvel ordre
des actions, tout en conservant l'ordre des sujets comme
critère de départage.

## Réorganiser les sous-étapes de même priorité (TS-014)

L'ordre des sous-étapes d'une **même action parente** est
personnalisable **à l'intérieur d'un groupe de priorité** :

- Faire glisser la **poignée ⠿** d'une sous-étape vers une autre
  sous-étape **du même parent et de la même priorité**, à la
  souris, au doigt ou au stylet. Les dépôts sur une action
  principale, un autre parent, un autre sujet, une autre priorité
  ou une zone vide sont refusés : rien n'est déplacé ni enregistré.
- Pour utiliser le clavier, ou si le glisser-déposer est peu pratique
  sur téléphone, ouvrir le menu **« ⋮ »** de la sous-étape puis
  activer **« Monter »** ou **« Descendre »** ; chaque activation la
  déplace d'une place dans son groupe. Les directions impossibles sont
  désactivées. Le nom accessible indique la sous-étape, sa
  priorité et son action parente.
- Le déplacement ne change jamais le parent, la priorité, le titre,
  l'identifiant ni l'état terminé : seule la position dans le groupe
  change.
- Si **« Masquer les étapes terminées »** est coché, le
  réordonnancement des sous-étapes est temporairement désactivé,
  comme pour les actions principales.
- Une action parente repliée ne montre pas ses sous-étapes : aucune
  poignée n'est proposée et aucun dépôt invisible n'est possible.
  Déplier réaffiche les sous-étapes dans le même ordre.

L'ordre choisi est sauvegardé localement, rétabli au rechargement
et inclus dans le fichier exporté, sans nouvelle clé ni nouveau
champ. Le réordonnancement des actions principales (TS-011) reste
inchangé, et le compteur, la suggestion et le suivi
« Je reprends ici » ne sont pas affectés.

## Replier et déplier les sous-étapes (TS-012)

Lorsqu'une action principale possède au moins une sous-étape
visible, un bouton de repli apparaît à côté de ses commandes. Son
libellé indique combien de sous-étapes sont concernées.

- **Par défaut, les sous-tâches sont repliées** : le bouton indique
  **« Voir 1 sous-tâche »** ou **« Voir N sous-tâches »** selon le
  nombre de sous-étapes visibles sous les filtres courants.
- Un clic masque ou réaffiche uniquement les sous-tâches de cette
  action : son titre, son éventuelle note, sa priorité, son état et
  ses boutons restent affichés et utilisables, comme les actions
  voisines. Dépliée, le bouton indique **« Masquer les sous-tâches »** ;
  un nouveau clic les réaffiche ou les replie dans le même ordre et
  avec les mêmes états.
- Le décompte suit le filtre **« Masquer les étapes terminées »** :
  une sous-étape terminée et masquée par ce filtre n'est pas comptée,
  même si l'action parente est repliée.
- Chaque action se replie indépendamment : plusieurs actions peuvent
  être dépliées en même temps, dans un même sujet ou dans des sujets
  différents.
- Le repli est **temporaire et propre à l'onglet** : il survit aux
  opérations ordinaires d'une même vue (édition, priorité, terminer,
  filtre, réordonnancement), mais **chaque entrée dans une vue**
  (overview vers détail, détail vers overview, autre projet, ou
  Précédent/Suivant du navigateur) repart avec toutes les actions
  **repliées**, tout comme un rechargement, un nouvel onglet ou un
  import. Aucun réglage n'est enregistré et le fichier exporté reste
  identique.
- Le bouton est utilisable à la souris, au doigt et au clavier
  (Tab, Entrée, Espace). Si **« Masquer les étapes terminées »** est
  actif, déplier ne révèle jamais une étape terminée masquée ; une
  action dont toutes les sous-étapes sont masquées n'affiche pas de
  bouton.

## Retirer et annuler une étape (TS-010)

- **« Retirer »** enlève immédiatement une action ou une sous-étape.
  Retirer une action parente retire aussi ses sous-étapes.
- Une notification **« Étape retirée »** apparaît en bas de la page
  avec le bouton **« Annuler »**. Pendant environ **10 secondes**,
  ce bouton rétablit l'action, ses éventuelles sous-étapes et leurs
  propriétés. La restauration est aussi sauvegardée.
- Après expiration de la notification, l'annulation n'est plus
  disponible. Une nouvelle suppression remplace la précédente
  comme **seule suppression annulable**.
- Fermer ou recharger la page, importer un autre document, retirer
  le sujet d'origine ou recevoir un remplacement depuis un autre
  onglet invalide cette possibilité d'annulation.
- La suppression d'un **sujet complet** reste soumise à confirmation ;
  elle ne dispose pas de ce snackbar.

## Suggestion et reprise

**« Une étape pour maintenant »** affiche une action principale
non terminée selon la priorité, l'ordre des sujets puis
l'ordre des actions de même priorité. La carte explique en français
pourquoi cette action est suggérée. Il s'agit d'une suggestion
consultative : elle ne change pas vos données.

**« Garder le fil »** marque explicitement l'action principale que
vous souhaitez reprendre. Une carte « Je reprends ici » permet
de la retrouver ou de ne plus la suivre. Le suivi est stocké
localement séparément des données exportées ; il est effacé
si son action disparaît ou est terminée.

Les raccourcis **« Voir dans la liste »** de la suggestion et du suivi
atteignent toujours l'action visée, même lorsqu'elle se trouve
**au-delà des cinq entrées** de l'aperçu d'une carte : dans ce cas,
ils ouvrent la **vue de détail du bon projet** et y révèlent l'action
en respectant le filtre courant, sans cibler un élément absent de
l'aperçu. Aucune de ces actions d'affichage ne modifie le document,
le stockage local ni l'export JSON.

## Enregistrement, export et import

Les actions sont enregistrées automatiquement dans **IndexedDB**, dans
ce navigateur et ce profil. Pour comprendre les copies locales et
distantes, les niveaux de preuve de synchronisation et les procédures
sûres avant une action risquée, consultez le
[Guide de la persistance et de la synchronisation](guide-persistance-et-synchronisation.md).

Depuis `#/parametres/donnees`, utiliser
régulièrement **« Exporter mes données »** pour obtenir une sauvegarde au
format `threadstep.indexeddb-backup`, puis **« Importer et fusionner un
JSON »** pour ajouter uniquement les enregistrements absents.
**« Restaurer un état antérieur »** reste une intention distincte, avec
sauvegarde préalable et confirmation renforcée. Les sauvegardes de
sécurité des opérations dangereuses et l'export brut du diagnostic
restent accessibles dans leur contexte d'origine.

Les fichiers à l'ancien format V1 (`version: 1`), même récemment produits
depuis IndexedDB, ne sont **plus acceptés** : l'application affiche un refus
explicite sans rien importer ni effacer. Les anciennes clés V1 conservées
dans le navigateur sont inertes. Un panneau « Anciennes clés V1 conservées »
permet, seulement si vous le confirmez et après une sauvegarde IndexedDB
vérifiée, de supprimer uniquement ces clés pour l'origine et le navigateur
courants ; l'option par défaut est **« Ne rien effacer »**.

La sauvegarde locale **n'est pas une synchronisation entre
appareils** : autre téléphone, navigateur, profil ou mode privé
peuvent montrer d'autres données. Un effacement des données du site
peut être définitif sans export préalable. Si le stockage est
indisponible, exporter manuellement les données avant de quitter.

## Accessibilité et vérification

Le déplacement dispose de boutons clavier/tactiles ; le snackbar
dispose d'un bouton d'annulation et d'une zone d'annonce.
Les validations automatisées TS-012/013/014 et le déploiement Pages sont réussis,
mais ils ne constituent **pas** une preuve de recette manuelle complète
sur appareils iOS/Android ni avec tous les lecteurs d'écran.

Références techniques :
[Spécification MVP](mvp.md) ·
[Recette manuelle](acceptance-checklist.md) ·
[Guide développeur](developer-guide.md) ·
[Backlog TS-013](../../backlog/tasks/TS-013.md) ·
[Backlog TS-010](../../backlog/tasks/TS-010.md) ·
[Backlog TS-011](../../backlog/tasks/TS-011.md) ·
[Backlog TS-012](../../backlog/tasks/TS-012.md) ·
[Backlog TS-014](../../backlog/tasks/TS-014.md) ·
[Backlog TS-016](../../backlog/tasks/TS-016.md) ·
[Spécification action-removal](../../openspec/specs/action-removal/spec.md) ·
[Spécification action-ordering](../../openspec/specs/action-ordering/spec.md) ·
[Spécification substep-ordering](../../openspec/specs/substep-ordering/spec.md).
