# ThreadStep | Guide d'utilisation

**État vérifié : 15 octobre 2026**, après les PR #32 (TS-010) et #34
(TS-011). Application : https://cedricmenec.github.io/threadstep/

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
- Une action parente conserve ses sous-étapes ; celles-ci ne se
  réorganisent pas indépendamment par ce geste.

L'ordre choisi est sauvegardé localement, rétabli au rechargement
et inclus dans le fichier exporté. À priorité égale,
« Une étape pour maintenant » tient compte du nouvel ordre
des actions, tout en conservant l'ordre des sujets comme
critère de départage.

## Replier et déplier les sous-étapes (TS-012)

Lorsqu'une action principale possède au moins une sous-étape
visible, un bouton **« Replier »** apparaît à côté de ses commandes.

- **« Replier »** masque temporairement uniquement les sous-étapes
  de cette action : son titre, sa priorité, son état et ses boutons
  restent affichés et utilisables, comme les actions voisines.
  **« Déplier »** les réaffiche dans le même ordre et avec les mêmes
  états.
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
Les validations automatisées et le déploiement Pages sont réussis,
mais ils ne constituent **pas** une preuve de recette manuelle complète
sur appareils iOS/Android ni avec tous les lecteurs d'écran.

Références techniques :
[Spécification MVP](mvp.md) ·
[Backlog TS-010](../../backlog/tasks/TS-010.md) ·
[Backlog TS-011](../../backlog/tasks/TS-011.md) ·
[Backlog TS-012](../../backlog/tasks/TS-012.md) ·
[Spécification action-removal](../../openspec/specs/action-removal/spec.md) ·
[Spécification action-ordering](../../openspec/specs/action-ordering/spec.md).
