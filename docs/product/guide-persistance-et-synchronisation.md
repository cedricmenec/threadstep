# ThreadStep | Guide de la persistance et de la synchronisation

**État documenté : 20 octobre 2026**, d'après le code livré et les
spécifications canoniques du dépôt. Ce guide explique où sont vos projets,
quand ils peuvent être transmis à Dexie Cloud, quelles copies existent et
comment agir sans risque.

Application : https://cedricmenec.github.io/threadstep/

> En cas de doute, ne purgez rien et n'effacez pas les données du navigateur.
> Exportez d'abord une sauvegarde vérifiée. Une liste vide à l'écran ne prouve
> jamais que la base distante est vide.

## 1. Réponse courte : où sont mes projets ?

ThreadStep fonctionne d'abord **sur votre appareil**. Les projets sont lus et
écrits dans une base **IndexedDB** du navigateur. Dexie Cloud n'est pas une
base distante interrogée directement à la place d'IndexedDB : lorsque le Cloud
est activé et consenti, Dexie Cloud **réplique** les données vers la base
locale active, et l'application continue de lire et d'écrire cette base locale.

| Mode | Base locale utilisée | Réplication distante | Utilisable sans URL, OTP ou réseau |
| --- | --- | --- | --- |
| Local autonome | IndexedDB `threadstep-local` | Aucune | Oui |
| Espace Dexie Cloud | IndexedDB locale distincte par workspace, de la forme `threadstep-ws-…` (suffixe natif éventuel) | Oui, vers une instance Dexie Cloud, sous conditions de consentement, de session, de permissions et de connexion | L'ouverture locale peut fonctionner selon la session et les droits, mais l'authentification initiale et la preuve distante exigent une connexion |
| Récupération isolée | Nouveau cache local `threadstep-recovery-…` | Aucune base distante créée ; lecture du serveur dans ce nouveau cache local | La récupération exige une session et une connexion |

En mode local autonome, **aucune réplication distante n'existe** :
`threadstep-local` reste sur l'appareil et l'application fonctionne sans URL,
OTP ni réseau. Un nom comme `threadstep-ws-…` ou `threadstep-recovery-…`
identifie donc un **cache local**. Il ne crée pas, à lui seul, une nouvelle
base distante.

## 2. Schéma des copies

```text
Appareil A
├─ threadstep-local                 (local autonome, aucune réplication)
├─ threadstep-ws-…                  (cache local de l'espace Cloud A, répliqué)
│    └─ réplication conditionnelle ↔ instance Dexie Cloud de l'espace A
└─ threadstep-recovery-…            (cache local isolé, créé explicitement)

Appareil B
└─ threadstep-ws-…                  (autre cache local du même espace Cloud A)
     └─ réplication conditionnelle ↔ même instance Dexie Cloud

Les bases distantes ne sont pas lues directement par l'application :
Dexie Cloud réplique vers la base locale active.
```

Conséquences à retenir :

- **Chaque espace Cloud a son propre cache local.** Changer d'espace change la
  base locale active ; cela ne copie ni ne fusionne les projets entre espaces.
- **La base locale autonome reste séparée.** Configurer une URL Cloud ne copie
  ni ne rattache automatiquement `threadstep-local`.
- **Le cache de récupération est local et isolé.** Il sert à relire le serveur
  sans purger ni fusionner l'ancien cache.
- **Les autres caches ne sont pas supprimés** par une sélection d'espace, une
  suspension, une déconnexion ou une purge portant sur un seul espace.

## 3. Les six niveaux de preuve

Ces six formulations ne sont pas interchangeables. Un niveau plus élevé ne se
déduit pas automatiquement du précédent.

| Niveau | Ce que cela prouve | Ce que cela ne prouve pas |
| --- | --- | --- |
| **Enregistré sur cet appareil** | La transaction IndexedDB locale a réussi ; le contenu est relu dans ce navigateur et ce profil. | Qu'un transfert réseau a eu lieu, ni qu'un autre appareil voit ce contenu. |
| **Transfert local en attente** | Une modification a été écrite localement et n'est pas encore attestée comme transmise. | Que le serveur l'a reçue, ni qu'elle est perdue. |
| **Pull natif terminé** | Dexie Cloud signale que la lecture distante initiale ou demandée est terminée sur cet appareil. | Que toute la copie distante est complète, ni que les données métier affichées sont toutes autorisées ou cohérentes. |
| **Synchronisation native en phase** (`in-sync`) | Dexie Cloud signale un état natif de synchronisation en phase sur cet appareil. | Que l'intégralité de la copie distante existe, que chaque écriture est prouvée une par une, ni qu'un autre appareil affiche déjà les mêmes projets. |
| **Lecture métier attestée** | Une lecture fraîche des enregistrements métier a réussi sur cet appareil après un signal natif. | Une propagation vers un autre appareil, ni l'absence de conflits ou de droits masquants. |
| **Contenu confirmé sur un autre appareil** | Une vérification a réellement été faite sur l'autre appareil. | Rien de plus : cette preuve doit être observée séparément. |

### Ce que `in-sync` ne prouve pas

Un état natif `in-sync` ne prouve pas que toute la copie distante est complète.
Un pull terminé ou une lecture locale ne le prouvent pas non plus, et ils ne
prouvent pas qu'un autre appareil affiche déjà les mêmes projets. La vérification inter-appareils
reste une **preuve séparée**, à effectuer sur le second appareil.

Lorsque la preuve distante manque, l'état doit rester **indéterminé**. Une base
locale vide, une erreur ou une absence de signal ne sont jamais une preuve que
le Cloud est vide.

## 4. Matrice des scénarios

Chaque ligne décrit une situation et ses conséquences. Sur un écran étroit,
faites défiler le tableau horizontalement : la ligne reste un scénario complet.
Les actions sensibles sont détaillées séparément au point 6.

### 4.1 Démarrage, activation et perte de session

| Scénario | Espace actif | Données consultables localement | Destinataire distant éventuel | Données conservées mais non affichées | Danger | Sauvegarde conseillée | Action exacte | Retour arrière |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Premier lancement local** | `threadstep-local` | Vos projets locaux | Aucun | Aucune | Supprimer les données du site, croire qu'un compte est nécessaire | Exporter dès que des données comptent | Utiliser « Mes projets » sans configuration | Aucune action nécessaire ; les données restent locales |
| **Configurer une URL sans activer** | `threadstep-local` | Les mêmes projets locaux | Aucun contenu métier ; l'URL est seulement enregistrée dans ce navigateur | Aucune | Croire que l'URL copie ou active déjà la synchronisation | Exporter avant toute manipulation | `#/parametres/synchronisation` > « Configuration », enregistrer une URL HTTPS valide | La configuration n'attache ni ne copie les données ; rester local est possible |
| **Activation depuis des données locales** | `threadstep-local` jusqu'au consentement, puis `threadstep-ws-…` après le transfert | Source locale, puis copie locale synchronisée après le commit | Instance Dexie Cloud cible, uniquement après consentement | La source autonome reste conservée et n'est plus affichée lorsque l'espace synchronisé est sélectionné | Confondre OTP et consentement ; purger la source après le transfert | Exporter la source et vérifier le plan affiché | Suivre « Configuration » puis « Connexion » OTP, « Première activation », revue du plan et consentement | Annuler avant consentement laisse tout intact ; après commit, aucune suppression n'est automatique |
| **Connexion sur un autre appareil** | `threadstep-ws-…` propre à cet appareil | Les données reçues par le pull, après vérification de la liaison de compte | La même instance Cloud, selon la session et les permissions | Un cache local non vérifié ou masqué | Conclure qu'un cache local vide signifie un Cloud vide | Exporter avant toute modification importante | Configurer la même URL, se connecter par OTP, attendre la première lecture et vérifier l'espace | Rester local ou se déconnecter sans purger ; les autres bases restent conservées |
| **Perte de session (expiration ou révocation)** | La base locale de l'espace, mais les données métier peuvent être masquées si l'identité n'est plus prouvée | La copie physique peut rester présente ; l'affichage autorisé dépend de la preuve d'identité | Aucun transfert tant que la session n'est pas valide | Les données métier masquées jusqu'à une réauthentification valide | Purger sous l'effet de la panique alors que le cache est intact | Exporter si l'espace est encore lisible, sinon conserver le cache | Rétablir une session avec le même compte, ou rester sur l'espace local | Une réauthentification avec le même compte réutilise le même espace ; aucune copie n'est créée |

### 4.2 Changement d'espace, suspension, déconnexion et reprise

| Scénario | Espace actif | Données consultables localement | Destinataire distant éventuel | Données conservées mais non affichées | Danger | Sauvegarde conseillée | Action exacte | Retour arrière |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Changement d'espace, d'URL ou de compte** | La base de l'espace sélectionné | Uniquement les données de cet espace, après vérification | Uniquement la destination correspondant à cet espace et à ce compte | Les autres caches et leurs changements restent conservés | Croire que deux espaces partagent ou fusionnent leurs projets | Exporter chaque espace concerné avant le changement | « Sélectionner cet espace », ou enregistrer une autre URL puis se connecter | Resélectionner l'espace précédent ; aucune autre base n'est supprimée |
| **Suspension Cloud** | Retour à `threadstep-local` | Les projets autonomes | Aucun nouvel envoi | Le cache Cloud suspendu et ses changements restent conservés | Confondre suspension, déconnexion et purge | Exporter le cache Cloud s'il contient des changements utiles | « Suspendre Cloud » | « Sélectionner cet espace » pour reprendre la même base et la même destination |
| **Déconnexion** | `threadstep-local` après la déconnexion | Les projets autonomes ; le cache synchronisé peut être supprimé par la déconnexion native | Les données distantes ne sont pas supprimées | Le cache autonome reste ; la copie distante reste côté serveur | Perdre des changements locaux non transmis ; croire que la déconnexion efface le serveur | Télécharger la sauvegarde JSON proposée dans la confirmation | « Se déconnecter », lire la portée et confirmer | Annuler avant confirmation ; après déconnexion, une reconnexion peut relire le serveur, mais des changements non transmis peuvent être perdus |
| **Retour au local** | `threadstep-local` | Les projets autonomes | Aucun nouvel envoi | Le cache synchronisé reste sur l'appareil mais n'est pas affiché | Croire que le retour local copie automatiquement les projets Cloud | Exporter le cache Cloud avant de le quitter | Sélectionner l'espace local autonome | Resélectionner l'espace Cloud ; ses données locales restent conservées |
| **Reprise Cloud** | Le `threadstep-ws-…` de l'espace choisi | Le cache de cet espace, après session et vérification | La même destination Cloud qu'avant la suspension | L'espace autonome et les autres espaces | Croire qu'un nouveau cache de récupération est nécessaire | Exporter si des changements sont en attente | Sélectionner l'espace suspendu, puis rétablir la session si nécessaire | Suspendre de nouveau ; aucune suppression distante n'est déclenchée |

### 4.3 Réseau, erreurs, écritures et caches non vérifiés

| Scénario | Espace actif | Données consultables localement | Destinataire distant éventuel | Données conservées mais non affichées | Danger | Sauvegarde conseillée | Action exacte | Retour arrière |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Hors ligne ou erreur réseau** | La base de l'espace courant | Les données déjà présentes localement, selon les droits | Transfert en attente ou indéterminé | Aucune donnée cachée par défaut | Conclure que le Cloud est vide ou que tout est perdu | Exporter si les données sont lisibles | Attendre le réseau, consulter le diagnostic, puis « Relancer la lecture distante » si elle est autorisée | Aucune action destructive n'est nécessaire ; reprendre après retour du réseau |
| **Écriture non transmise** | La base synchronisée locale | La modification est visible sur cet appareil | Le serveur ne l'a pas encore attestée | Aucune | Se déconnecter ou purger avant la transmission | Exporter avant toute action risquée | Garder la session et le réseau, puis vérifier l'état de synchronisation | Il n'y a pas d'annulation distante automatique ; conserver le cache et reprendre la synchronisation |
| **Cache `UNVERIFIED`** | L'espace existe, mais les données métier sont masquées | La copie physique peut être présente ; elle n'est pas affichée | Aucune preuve distante n'est affirmée | Les projets du cache non vérifié | Purger en croyant que le serveur est vide, ou supposer une perte certaine | Ne pas purger ; exporter si une action sûre le permet | « Retrouver les projets Cloud dans un nouveau cache isolé » pour `UNVERIFIED`, après lecture de l'avertissement | L'ancien cache et ses mutations restent conservés ; la récupération isolée ne les fusionne pas |
| **Cache `MISMATCH`** | L'espace existe, mais l'identité ou la destination ne correspond pas à la liaison | Les données restent masquées | Aucun transfert vers une autre identité | Les données de l'ancienne liaison | Copier ou exposer des données à un autre compte ; purger sans sauvegarde | Ne pas purger ; noter l'espace et la base affichés | Revenir au compte ou à la destination attendus ; sinon déconnexion ou purge explicitement confirmée | Le cache reste intact tant qu'aucune purge n'est confirmée ; ne jamais supposer une perte distante |
| **Récupération dans une base isolée** | Un nouveau cache local `threadstep-recovery-…` | Les données relues depuis le serveur dans ce nouveau cache | La même instance Cloud, en lecture selon les droits | L'ancien cache et ses mutations en attente | Croire que ce nom crée une nouvelle base distante, ou qu'il fusionne automatiquement | L'ancien cache reste conservé ; exporter après récupération vérifiée | « Retrouver les projets Cloud dans un nouveau cache isolé », puis confirmer | L'ancien cache n'est ni purgé ni fusionné ; revenir à l'ancien espace ou récupérer de nouveau explicitement |

### 4.4 Sauvegardes, import, restauration et suppression navigateur

| Scénario | Espace actif | Données consultables localement | Destinataire distant éventuel | Données conservées mais non affichées | Danger | Sauvegarde conseillée | Action exacte | Retour arrière |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Exporter mes données** | L'espace courant | Tous les sujets, tâches et relations lisibles | Aucun | Aucune | Croire que le fichier est une synchronisation entre appareils | Vérifier que le fichier se télécharge bien | `#/parametres/donnees` > « Exporter mes données » | Le fichier reste disponible hors du navigateur ; l'espace n'est pas modifié |
| **Importer et fusionner un JSON** | L'espace courant | Les enregistrements existants et ceux absents du fichier | Transfert Cloud éventuel ensuite, sans garantie de propagation | Aucune suppression | Croire que l'import remplace l'état ou écrase des changements récents | Exporter l'état actuel avant l'import | `#/parametres/donnees` > « Importer et fusionner un JSON », puis revue et confirmation | Fusion additive et idempotente ; réimporter le même fichier ne duplique pas |
| **Restaurer un état antérieur** | L'espace courant | L'état choisi remplace l'état actuel après confirmation | Transfert Cloud éventuel ensuite, non prouvé | L'état remplacé n'est plus affiché une fois la restauration faite | Perte du contenu actuel non sauvegardé | La sauvegarde de l'état actuel est exigée avant la restauration | `#/parametres/donnees` > « Restaurer un état antérieur », saisir `RESTAURER` et confirmer | Revenir à la sauvegarde de l'état actuel ; aucune restauration implicite après annulation ou rechargement |
| **Suppression des données du navigateur** | Plus aucun espace ThreadStep dans ce navigateur | Plus rien n'est garanti localement | Aucun envoi ; les données distantes éventuelles ne sont pas supprimées par cette action | Tous les caches, les sauvegardes internes et les préférences peuvent disparaître | Suppression définitive sans export préalable | Exporter chaque espace indispensable et conserver le fichier hors du navigateur | Utiliser les réglages du navigateur pour effacer les données du site | Aucun retour arrière local ; une reconnexion peut relire le serveur si les données y existent, sans preuve préalable ni garantie |

### 4.5 Avant / après : les transitions à retenir

- **Activation.** Avant : `threadstep-local` est actif, aucune URL ni OTP n'est
  requis. Après la configuration et l'OTP, la source locale reste intacte.
  Après le consentement et le commit, une copie locale `threadstep-ws-…` existe
  et la transmission reste en attente jusqu'à une preuve native.
- **Changement d'espace.** Avant : un espace et une base locale sont actifs.
  Après : un autre espace et une autre base locale sont actifs, sans copie ni
  fusion ; les caches précédents restent conservés.
- **Déconnexion.** Avant : le cache synchronisé peut contenir des changements
  non transmis. Après : le cache synchronisé local peut être supprimé, mais la
  copie distante n'est pas supprimée et l'espace autonome reste disponible.
- **Récupération isolée.** Avant : un cache non vérifié masque ses données.
  Après : un nouveau cache `threadstep-recovery-…` relit le serveur ; l'ancien
  cache, ses tables de mutations et ses changements restent intacts.

## 5. Reconnaître l'espace et la base actifs

Avant toute action sensible :

1. Ouvrez `#/parametres/synchronisation` et la section
   « Espaces de travail ».
2. Notez le type d'espace affiché : local autonome ou synchronisé, l'URL
   éventuelle et le **nom effectif de la base locale**.
3. Consultez le diagnostic : session, connexion, phase native, pull initial,
   écritures locales et preuve distante sont des informations distinctes.
4. Vérifiez que les projets visibles correspondent à l'espace attendu.
5. Exportez une sauvegarde `threadstep.indexeddb-backup` si elle est
   accessible et si les données comptent.

Une base locale vide, un cache masqué et une absence de preuve distante sont
trois situations différentes. Aucune ne permet de conclure que le Cloud est
vide.

## 6. Actions sensibles : procédures séparées

Les actions ci-dessous ne sont **jamais** des étapes implicites les unes des
autres. Lire, consulter ou reprendre un espace ne déclenche ni déconnexion, ni
purge, ni import, ni restauration, ni suppression des données du navigateur.

Procédure commune avant une action risquée :

1. Identifier l'espace actif et le nom de la base locale.
2. Vérifier les projets consultables et les changements en attente signalés.
3. Télécharger une sauvegarde `threadstep.indexeddb-backup` et vérifier qu'elle
   est lisible.
4. Lire la portée affichée dans la confirmation.
5. En cas de doute, annuler : l'annulation ne doit rien supprimer.

### 6.1 Se déconnecter

1. Vérifier l'espace actif, l'URL et la base locale dans
   `#/parametres/synchronisation` > « Espaces de travail ».
2. Lire l'avertissement sur les changements non transmis.
3. Télécharger la sauvegarde JSON proposée par la confirmation.
4. Activer « Se déconnecter », puis confirmer explicitement.

Après : la session est terminée. La déconnexion native peut supprimer le cache
synchronisé local ; elle ne supprime pas les données distantes. L'espace
autonome reste conservé. Un retour arrière consiste à annuler avant
confirmation ; après confirmation, se reconnecter permet de relire le serveur,
mais des changements non transmis peuvent être définitivement perdus.

### 6.2 Suspendre Cloud

1. Vérifier l'espace Cloud actif et ses changements en attente.
2. Exporter le cache Cloud si des modifications comptent.
3. Activer « Suspendre Cloud ».

Après : `threadstep-local` redevient actif. Le cache suspendu, l'URL et la
liaison restent conservés ; aucune déconnexion ni purge n'a lieu. Pour revenir,
utiliser « Sélectionner cet espace » et reprendre la même base.

### 6.3 Purger la copie locale

1. Vérifier l'espace et le nom exact de la base locale affichés.
2. Lire l'avertissement sur les changements non transmis et l'indication que la
   copie distante n'est pas supprimée.
3. Télécharger la sauvegarde JSON proposée.
4. Activer « Purger la copie locale », puis confirmer explicitement.

Après : seule la base locale identifiée est supprimée. Les autres espaces, la
configuration Cloud et les données distantes restent intacts. Le retour arrière
est l'annulation avant confirmation ; après la purge, les données locales ne
sont plus récupérables par ThreadStep, mais une reconnexion peut relire le
serveur si les données distantes existent.

### 6.4 Importer et fusionner un JSON

1. Vérifier l'espace actif et exporter l'état actuel.
2. Ouvrir `#/parametres/donnees` > « Importer et fusionner un JSON ».
3. Lire la prévisualisation et vérifier que l'intention est bien additive.
4. Confirmer.

Après : les enregistrements absents sont ajoutés, sans suppression ni
remplacement automatique. Un fichier V1 (`version: 1`) est refusé sans écriture.
Réimporter le même fichier ne duplique pas les enregistrements. Le retour
arrière consiste à restaurer la sauvegarde exportée avant l'import, dans une
intention distincte.

### 6.5 Restaurer un état antérieur

1. Vérifier l'espace actif et la portée de la restauration.
2. Télécharger la sauvegarde de l'état actuel : elle est exigée.
3. Choisir le fichier `threadstep.indexeddb-backup` à restaurer.
4. Saisir exactement `RESTAURER`, puis confirmer.

Après : l'état choisi remplace l'état actuel de l'espace affiché. Une
annulation, un changement de page ou un rechargement ne déclenche aucune
restauration. Le retour arrière repose sur la sauvegarde de l'état actuel
téléchargée avant l'opération.

### 6.6 Supprimer les données du navigateur

Cette action se fait dans les réglages du navigateur, hors de ThreadStep.

1. Exporter chaque espace indispensable.
2. Conserver le fichier hors du navigateur et vérifier qu'il est lisible.
3. Noter que les données Cloud éventuelles ne sont pas supprimées par cette
   action locale.
4. Effacer les données du site dans le navigateur.

Après : tous les caches ThreadStep de ce navigateur peuvent disparaître
définitivement. Il n'existe aucun retour arrière local. Une reconnexion
ultérieure peut relire des données distantes si elles existent et sont
autorisées, mais cela ne prouve ni leur complétude ni leur propagation.

### 6.7 Retrouver les projets Cloud dans un nouveau cache isolé

Cette action est explicite et non destructive. Elle est proposée notamment
lorsqu'un cache `UNVERIFIED` masque des données.

1. Vérifier la session, la destination et l'absence de mutation native en
   attente.
2. Lire l'avertissement : la connexion et la destination ont été vérifiées,
   mais cela ne prouve pas que toutes les données de l'ancien cache sont
   présentes sur le serveur.
3. Activer « Retrouver les projets Cloud dans un nouveau cache isolé ».
4. Confirmer la création du nouveau cache local.

Après : un cache `threadstep-recovery-…` relit le serveur. L'ancien cache et
ses mutations ne sont ni purgés ni fusionnés automatiquement. Ce nom est un
cache local : il ne crée pas de nouvelle base distante.

## 7. FAQ de dépannage priorisée

### 7.1 « Mes projets est vide »

Un écran vide peut signifier : un espace local réellement vide, un cache
`UNVERIFIED` ou `MISMATCH` masqué, un filtre qui cache les étapes, ou une
absence de preuve distante. Avant toute purge, ouvrez
`#/parametres/synchronisation` et identifiez l'espace actif et le nom de la
base locale. Ne concluez pas que le Cloud est vide. Si un cache masqué existe,
lisez le scénario « Cache `UNVERIFIED` » ou « Cache `MISMATCH` » et conservez
l'ancien cache.

### 7.2 « Connecté mais projets absents »

Une session valide ne prouve pas que le contenu distant est complet ni que la
liaison de compte autorise la lecture. Vérifiez la phase native, le pull
initial, l'état de liaison et la base locale active. Un cache peut être masqué
par une identité ou une destination différente. Ne purgez pas : utilisez la
récupération isolée si elle est proposée, ou rétablissez le compte attendu.

### 7.3 « Quelle est ma base active ? »

Ouvrez `#/parametres/synchronisation` > « Espaces de travail ». Le panneau
affiche l'espace, l'URL éventuelle et le nom effectif de la base locale.
`threadstep-local` désigne l'espace autonome ; `threadstep-ws-…` désigne le
cache local d'un espace synchronisé ; `threadstep-recovery-…` désigne un cache
de récupération isolé.

### 7.4 « Pourquoi un nouveau nom IndexedDB ? »

Un autre espace, une autre URL, un autre compte ou une récupération isolée peut
sélectionner une autre base locale. Le nouveau nom identifie un **cache local**,
pas une nouvelle base distante. L'ancien cache reste conservé : ne le purgez
pas sans sauvegarde vérifiée et sans avoir compris pourquoi le nom a changé.

### 7.5 « Que signifie dernière synchronisation ? »

Une mention de « dernière synchronisation » décrit une observation native sur
cet appareil à un moment donné. Elle ne prouve pas que toute la copie distante
est complète, ni qu'un autre appareil affiche déjà les mêmes projets. Pour une
preuve réelle, vérifiez séparément sur l'autre appareil. Si le signal manque ou
se contredit, l'état reste indéterminé.

### 7.6 « Que se passe-t-il si je change de téléphone ou supprime les données du navigateur ? »

Changer de téléphone ne copie rien automatiquement. Sur le nouvel appareil,
configurez la même URL, connectez-vous avec le même compte et attendez la
première lecture distante ; la propagation reste à vérifier séparément.
Supprimer les données du navigateur peut effacer définitivement tous les caches
locaux de cet appareil. Cela ne prouve pas l'absence de données distantes et ne
les supprime pas. Exportez et conservez une sauvegarde hors du navigateur avant
toute suppression.

## 8. Limites de durabilité, de sécurité et de preuve

### 8.1 Stockage navigateur et sauvegardes

- Les données IndexedDB peuvent être supprimées, refusées, saturées ou
  indisponibles selon le navigateur, le profil, le mode privé ou les réglages
  de l'appareil.
- Une sauvegarde `threadstep.indexeddb-backup` est un fichier local. Ce n'est
  **pas** une synchronisation entre appareils.
- Exportez et vérifiez une sauvegarde avant toute manipulation risquée. Un
  export non vérifié ne protège pas contre une perte.
- Les fichiers V1 (`version: 1`) ne sont plus acceptés à l'import ou à la
  restauration. Ils ne constituent pas un chemin de récupération actif.

### 8.2 Permissions Cloud et authentification

- Les permissions et l'identité sont contrôlées par Dexie Cloud. Certains
  enregistrements peuvent être invisibles ou non autorisés sans être supprimés.
- L'authentification initiale nécessite une connexion et un OTP natif.
- Une OTP confirmée, une session valide ou un pull terminé ne prouvent pas le
  contenu distant complet.

### 8.3 Hors ligne et propagation

- Une écriture locale peut réussir hors ligne. Sa transmission distante reste
  alors en attente ou indéterminée.
- Une erreur réseau, un pull incomplet ou une absence de signal ne signifient
  jamais que le Cloud est vide.
- La propagation vers un autre appareil n'est pas attestée par un état
  `in-sync` local, un pull ou une lecture métier sur le premier appareil.
  Vérifiez séparément sur le second appareil.

## 9. Glossaire sans jargon

- **IndexedDB** : base de données intégrée au navigateur, utilisée par
  ThreadStep pour enregistrer les projets sur l'appareil.
- **Espace autonome** : mode `threadstep-local`, sans réplication Cloud.
- **Espace synchronisé** : espace Cloud dont les données sont répliquées vers
  un cache local `threadstep-ws-…`.
- **Cache local** : copie de travail IndexedDB propre à un appareil et à un
  espace.
- **Base distante** : instance Dexie Cloud côté service. Elle n'est pas lue
  directement à la place du cache local.
- **OTP** : code à usage unique envoyé par le service d'authentification pour
  confirmer une connexion. Il ne vaut pas consentement au transfert.
- **Pull** : lecture des données distantes par le mécanisme natif Dexie Cloud.
- **Push** : envoi de modifications locales vers le service distant.
- **Réplication** : échange natif entre la base locale active et Dexie Cloud.
- **Attestation** : preuve observable produite par les signaux natifs ou par une
  lecture métier réussie, sur un appareil donné.
- **Sauvegarde** : fichier exporté `threadstep.indexeddb-backup`, conservé hors
  du navigateur. Ce n'est pas une synchronisation.
- **Restauration** : remplacement explicite de l'état courant par une
  sauvegarde choisie, avec confirmation renforcée.

## 10. Pour aller plus loin

Sources officielles Dexie utilisées par le projet :

- [Authentification Dexie Cloud](https://dexie.org/docs/cloud/authentication)
- [Options de Dexie Cloud](https://dexie.org/docs/cloud/DexieCloudOptions)
- [États de synchronisation Dexie Cloud](https://dexie.org/docs/cloud/SyncState)
- [Bonnes pratiques Dexie Cloud](https://dexie.org/docs/cloud/best-practices)

Sources internes de vérité :

- Code livré : [dexie-foundation.js](../../site/dexie-foundation.js),
  [workspace-identity.js](../../site/workspace-identity.js),
  [sync-diagnostics.js](../../site/sync-diagnostics.js),
  [app.js](../../site/app.js)
- [Persistance IndexedDB locale](../../openspec/specs/local-indexeddb-persistence/spec.md)
- [Activation volontaire Cloud](../../openspec/specs/cloud-opt-in-activation/spec.md)
- [Cycle de synchronisation Cloud](../../openspec/specs/cloud-sync-lifecycle/spec.md)
- [Isolation des espaces](../../openspec/specs/workspace-identity-isolation/spec.md)
- [Sauvegarde, import et restauration](../../openspec/specs/data-backup-import-restore/spec.md)
- [Intégrité et récupération](../../openspec/specs/data-integrity-recovery/spec.md)

Ce guide décrit l'état livré et les limites de preuve connues. Il ne garantit
pas une propagation distante complète et ne remplace pas une vérification sur
un second appareil.
