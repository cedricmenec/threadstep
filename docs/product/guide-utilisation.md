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

## Sujets, actions et priorités

1. Entrer un intitulé dans « Ajouter un sujet ou un projet… », puis
   choisir « + Ajouter ».
2. Dans le sujet, saisir une action, choisir sa priorité
   **Urgent**, **Normal** ou **Plus tard**, puis « + Étape ».
3. Cocher une action pour la marquer terminée. Les priorités déterminent
   toujours l'ordre des groupes affichés : Urgent, Normal, Plus tard.
4. « + Sous-étape » ajoute une étape d'un seul niveau sous une action.
   « Modifier » permet de changer le titre et la priorité.
5. Les boutons fléchés de chaque **sujet** permettent de monter ou
   descendre ce sujet. « Supprimer » un sujet demande une confirmation
   et retire aussi ses actions.

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
  sur téléphone, activer **« Monter »** ou **« Descendre »**
  à côté de l'action ; chaque activation la déplace d'une place
  dans son groupe de priorité. Les directions impossibles sont
  désactivées.
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
- Pour utiliser le clavier, ou si le glisser-déposer est peu
  pratique sur téléphone, activer **« Monter »** ou **« Descendre »**
  à côté de la sous-étape ; chaque activation la déplace d'une
  place dans son groupe. Les directions impossibles sont
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

- **Par défaut, les sous-tâches sont affichées** : le bouton indique
  **« Masquer les sous-tâches »**.
- Un clic masque temporairement uniquement les sous-tâches de cette
  action : son titre, sa priorité, son état et ses boutons restent
  affichés et utilisables, comme les actions voisines. Le bouton
  devient alors **« Voir 1 sous-tâche »** lorsqu'une seule sous-tâche
  est visible sous les filtres courants, ou **« Voir N sous-tâches »**
  lorsqu'il y en a plusieurs. Un nouveau clic les réaffiche dans
  le même ordre et avec les mêmes états, avec
  **« Masquer les sous-tâches »**.
- Le décompte suit le filtre **« Masquer les étapes terminées »** :
  une sous-étape terminée et masquée par ce filtre n'est pas comptée,
  même si l'action parente est repliée.
- Chaque action se replie indépendamment : plusieurs actions peuvent
  être repliées en même temps, dans un même sujet ou dans des sujets
  différents.
- Le repli est **temporaire et propre à l'onglet** : il survit aux
  opérations ordinaires, mais un rechargement, un nouvel onglet ou un
  import repartent avec toutes les actions dépliées. Aucun réglage
  n'est enregistré et le fichier exporté reste identique.
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

Les actions sont enregistrées automatiquement dans le stockage
local de **ce navigateur et ce profil**. Utiliser régulièrement
**« Exporter mes données »** pour obtenir un fichier JSON de secours,
puis « Importer JSON » pour le restaurer. Un import demande
confirmation avant de remplacer le document courant.

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
