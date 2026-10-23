# Spec Delta

## Purpose

Offrir sur Overview une synthèse globale et navigable des étapes urgentes encore
en attente, avec leur projet d'origine, sans nouvelle persistance ni
modification des règles de suggestion, de reprise ou de filtrage des projets.

## ADDED Requirements

### Requirement: Zone globale disponible après lecture autorisée

La vue Overview SHALL afficher, seulement quand la lecture métier autorisée est
achevée et que les projets sont disponibles, une zone compacte et distincte
intitulée « Urgences à traiter ». Elle MUST rester absente ou masquée sur les
autres routes, pendant l'initialisation, une lecture en attente, une liaison
non vérifiée ou une action requise ; le chargement ou le diagnostic existant
MUST rester affiché à sa place.

#### Scenario: Zone visible sur Overview autorisé

- **GIVEN** une lecture métier autorisée achevée et des projets disponibles
- **WHEN** la vue Overview est affichée
- **THEN** la zone « Urgences à traiter » est visible
- **AND** elle est distincte des cartes projet et ne les duplique pas

#### Scenario: Zone absente sur une autre route

- **GIVEN** la vue de détail d'un projet ou une page de paramètres est affichée
- **WHEN** la route n'est pas Overview
- **THEN** la zone « Urgences à traiter » n'est pas rendue

#### Scenario: Lecture en attente

- **GIVEN** la lecture métier autorisée n'est pas achevée
- **WHEN** la vue Overview est affichée
- **THEN** le chargement ou le diagnostic prévu reste affiché
- **AND** aucun message « Aucune urgence en attente » n'est affiché
- **AND** aucune ligne d'urgence fictive n'est rendue

#### Scenario: Liaison non vérifiée

- **GIVEN** une liaison de compte non vérifiée ou incompatible
- **WHEN** la vue Overview est affichée
- **THEN** aucune ligne ni aucun état vide de la synthèse n'est affiché
- **AND** aucun document mis en cache non autorisé n'est utilisé

### Requirement: Sélection des urgences en attente

La zone SHALL lister chaque étape du document métier autorisé dont `done` vaut
`false` et `priority` vaut `urgent`, qu'elle soit tâche parente ou sous-tâche.
Elle MUST NOT dépendre de l'état terminé, replié ou hors aperçu du parent, ni
des filtres de projets ou de complétion. Une étape terminée ou non urgente MUST
NOT apparaître. La sélection MUST rester purement dérivée et sans mutation.

#### Scenario: Parent urgent et sous-tâche urgente

- **GIVEN** un projet dont une tâche parente et une sous-tâche sont toutes deux
  `done: false` et `priority: urgent`
- **WHEN** la synthèse est calculée
- **THEN** le parent et la sous-tâche produisent deux lignes distinctes

#### Scenario: Sous-tâche urgente sous un parent terminé

- **GIVEN** un projet dont le parent est `done: true` mais dont une sous-tâche
  reste `done: false` et `priority: urgent`
- **WHEN** la synthèse est calculée et le parent est replié
- **THEN** la sous-tâche apparaît dans la synthèse

#### Scenario: Sous-tâche urgente hors de l'aperçu

- **GIVEN** une sous-tâche urgente appartient à un parent situé au-delà des cinq
  parents visibles dans l'aperçu de sa carte
- **WHEN** la synthèse est calculée
- **THEN** la sous-tâche apparaît dans la synthèse

#### Scenario: Projet masqué par le filtre de projets

- **GIVEN** un mode de filtre de projets masque une carte contenant une urgence
  en attente
- **WHEN** la synthèse est calculée
- **THEN** l'urgence reste listée
- **AND** la carte reste masquée selon son propre filtre

#### Scenario: Urgences terminées ou déclassées exclues

- **GIVEN** une étape urgente est marquée `done: true` ou sa priorité passe à
  `normal` ou `later`
- **WHEN** la synthèse est recalculée
- **THEN** l'étape disparaît de la liste

#### Scenario: Aucune mutation par la sélection

- **GIVEN** un document affiché
- **WHEN** la synthèse est calculée ou rerendue
- **THEN** les identifiants, titres, priorités, états `done`, relations parentes
  et ordres sont strictement inchangés

### Requirement: Contenu, identité stable et rendu sûr

Chaque ligne SHALL afficher le titre de l'étape et le nom du projet, et pour une
sous-tâche « Sous-tâche de [titre du parent] ». Elle SHALL exposer les
identifiants stables du projet et de l'étape pour distinguer des titres
homonymes. Tous les textes utilisateur MUST être rendus comme des nœuds texte,
jamais comme du HTML interprété.

#### Scenario: Ligne d'une tâche parente

- **GIVEN** une tâche parente urgente en attente
- **WHEN** sa ligne est affichée
- **THEN** elle montre le titre de la tâche et le nom du projet
- **AND** elle n'affiche pas de mention de sous-tâche

#### Scenario: Ligne d'une sous-tâche

- **GIVEN** une sous-tâche urgente en attente dont le parent porte un titre
- **WHEN** sa ligne est affichée
- **THEN** elle montre le titre de la sous-tâche, le nom du projet et
  « Sous-tâche de [titre du parent] »

#### Scenario: Titres homonymes dans deux projets

- **GIVEN** deux projets différents contiennent des étapes de même titre
- **WHEN** la synthèse est affichée
- **THEN** elle montre deux lignes distinctes
- **AND** chaque ligne conserve les IDs stables de son propre projet et de son
  étape

#### Scenario: Balisage utilisateur rendu littéralement

- **GIVEN** un titre de projet, d'étape ou de parent contient
  `<img src=x onerror=alert(1)>`
- **WHEN** une ligne est affichée
- **THEN** le contenu est rendu comme du texte littéral
- **AND** aucun élément n'est créé à partir de ce texte

### Requirement: Ordre déterministe sans tri persistant

Les urgences SHALL suivre l'ordre enregistré des projets, puis l'ordre enregistré
des étapes dans chaque projet, en plaçant chaque sous-tâche auprès de son parent.
Aucun tri par priorité, titre, date ou état, aucune modification de priorité et
aucune écriture d'ordre MUST être effectué.

#### Scenario: Ordre des projets conservé

- **GIVEN** les projets A, B et C sont enregistrés dans cet ordre
- **WHEN** chacun contient une urgence en attente
- **THEN** la liste affiche A puis B puis C

#### Scenario: Ordre des étapes conservé

- **GIVEN** un projet enregistre les étapes urgentes u1 puis u2
- **WHEN** la synthèse est calculée
- **THEN** u1 précède u2
- **AND** aucun tri par identifiant ou par titre n'est appliqué

#### Scenario: Sous-tâche auprès de son parent

- **GIVEN** un parent urgent et ses sous-tâches urgentes sont enregistrés avec
  d'autres étapes dans le projet
- **WHEN** la synthèse est calculée
- **THEN** chaque sous-tâche urgente est placée auprès de son parent
- **AND** l'ordre relatif des sous-tâches d'un même parent est conservé

#### Scenario: Aucun changement d'ordre enregistré

- **GIVEN** un document affiché
- **WHEN** la synthèse est calculée, développée ou réduite
- **THEN** l'ordre des projets et des étapes dans le document est inchangé

### Requirement: Limite de cinq, compteur et développement

La zone SHALL afficher au plus les cinq premières urgences. Au-delà de cinq, elle
SHALL afficher le nombre exact des urgences non affichées et une commande
« Voir toutes les urgences ». Cette commande SHALL afficher toutes les urgences
et une commande « Réduire » SHALL revenir à cinq. Sans excédent, aucune commande
de développement ni compteur MUST être affiché.

#### Scenario: Zéro à cinq urgences

- **GIVEN** la synthèse contient 0, 1 ou 5 urgences
- **WHEN** elle est affichée initialement
- **THEN** elle affiche respectivement 0, 1 ou 5 lignes
- **AND** aucune commande de développement ni compteur d'excédent n'est affiché

#### Scenario: Six urgences

- **GIVEN** la synthèse contient six urgences
- **WHEN** elle est affichée initialement
- **THEN** les cinq premières lignes sont visibles
- **AND** le compteur indique exactement une urgence non affichée
- **AND** « Voir toutes les urgences » est disponible

#### Scenario: Plus de six urgences

- **GIVEN** la synthèse contient huit urgences
- **WHEN** elle est affichée initialement
- **THEN** les cinq premières lignes sont visibles
- **AND** le compteur indique exactement trois urgences non affichées

#### Scenario: Voir toutes les urgences

- **GIVEN** la synthèse est réduite avec un excédent
- **WHEN** « Voir toutes les urgences » est activé
- **THEN** toutes les urgences sont affichées dans le même ordre
- **AND** le compteur d'excédent est masqué
- **AND** aucune donnée n'est écrite

#### Scenario: Réduire

- **GIVEN** toutes les urgences sont affichées
- **WHEN** « Réduire » est activé
- **THEN** seules les cinq premières restent visibles
- **AND** le compteur d'excédent est de nouveau affiché
- **AND** aucune donnée n'est écrite

### Requirement: État vide autorisé

Quand la lecture métier autorisée est achevée et qu'aucune urgence en attente
n'existe, la zone SHALL afficher le message exact « Aucune urgence en attente »,
sans compteur ni commande de développement. Elle MUST NOT afficher ce message
avant autorisation ni remplacer le chargement, le diagnostic ou une action
requise par un faux état vide.

#### Scenario: Document autorisé sans urgence

- **GIVEN** une lecture métier autorisée achevée et aucune urgence en attente
- **WHEN** la vue Overview est affichée
- **THEN** la zone affiche « Aucune urgence en attente »
- **AND** aucun compteur ni commande de développement n'est affiché

#### Scenario: Dernière urgence traitée

- **GIVEN** une urgence en attente est la seule de la synthèse
- **WHEN** elle est terminée ou déclassée
- **THEN** la zone affiche « Aucune urgence en attente »

#### Scenario: Nouvelle urgence après l'état vide

- **GIVEN** la zone affiche « Aucune urgence en attente »
- **WHEN** une étape passe à `priority: urgent` et reste non terminée
- **THEN** la nouvelle urgence apparaît dans la liste

### Requirement: État de présentation transitoire

L'état développé/réduit SHALL vivre uniquement en mémoire. Il SHALL être
conservé pendant les mutations et rafraîchissements autorisés de la même vue et
du même espace, et réinitialisé à réduit lors d'une véritable entrée de vue, d'un
rechargement, d'un changement de compte ou d'espace et d'un import ou d'une
restauration réussis. Il MUST NOT être stocké, exporté, synchronisé ni encodé
dans l'URL.

#### Scenario: Mutation locale avec liste développée

- **GIVEN** la synthèse est développée dans la vue courante
- **WHEN** une urgence est terminée, ajoutée ou dépriorisée
- **THEN** l'état développé est conservé
- **AND** les lignes sont recalculées depuis le document courant

#### Scenario: Rafraîchissement Dexie ou inter-onglets

- **GIVEN** la synthèse est développée
- **WHEN** un rafraîchissement Dexie ou inter-onglets autorisé fournit un nouvel
  état dans la même vue et le même espace
- **THEN** l'état développé est conservé
- **AND** aucun rechargement de page n'est déclenché par ce seul événement

#### Scenario: Véritable entrée de vue

- **GIVEN** la synthèse est développée
- **WHEN** l'utilisateur quitte Overview puis y revient par navigation, y
  compris avec Précédent ou Suivant
- **THEN** la synthèse est revenue à l'état réduit

#### Scenario: Rechargement ou nouvel onglet

- **WHEN** la page est rechargée ou ouverte dans un nouvel onglet
- **THEN** la synthèse est à l'état réduit
- **AND** aucune préférence d'affichage n'est relue depuis un stockage

#### Scenario: Changement d'espace ou de compte

- **GIVEN** la synthèse est développée dans l'espace A
- **WHEN** l'espace ou le compte autorisé devient B
- **THEN** la synthèse est réinitialisée à l'état réduit
- **AND** aucune ligne de l'espace A n'est conservée

#### Scenario: Import ou restauration réussis

- **WHEN** un import ou une restauration autorisés réussissent
- **THEN** la synthèse revient à l'état réduit
- **AND** son contenu est dérivé du document remplacé

#### Scenario: Aucune persistance ni synchronisation

- **WHEN** la synthèse est développée, réduite ou réinitialisée
- **THEN** aucune clé de stockage, aucun champ d'export, aucune requête réseau,
  aucune synchronisation et aucun fragment d'URL ne porte son état

### Requirement: Ouverture et révélation d'une cible par IDs stables

Chaque ligne SHALL proposer une commande « Ouvrir dans le projet » identifiant
le projet et l'étape par leurs IDs stables. Son activation SHALL ouvrir la vue
de détail du projet et révéler l'étape exacte, y compris une sous-tâche d'un
parent replié ou une étape au-delà du quota de cinq parents. Si la cible a
disparu, l'action MUST être annulée sans navigation vers un autre projet ni
contenu d'un autre espace.

#### Scenario: Ouverture d'une urgence visible ou masquée

- **GIVEN** une ligne d'urgence dont le projet est visible ou masqué par le
  filtre de projets courant
- **WHEN** « Ouvrir dans le projet » est activé
- **THEN** la vue de détail de son projet est ouverte
- **AND** l'étape exacte est révélée dans cette vue

#### Scenario: Sous-tâche d'un parent replié

- **GIVEN** une urgence est une sous-tâche dont le parent est replié
- **WHEN** sa commande d'ouverture est activée
- **THEN** la vue de détail ouvre le bon projet
- **AND** le parent est développé pour révéler la sous-tâche exacte

#### Scenario: Urgence au-delà de l'aperçu de cinq parents

- **GIVEN** une urgence appartient à un parent situé au-delà des cinq parents
  visibles dans l'aperçu de sa carte
- **WHEN** sa commande d'ouverture est activée
- **THEN** la vue de détail est ouverte
- **AND** l'étape exacte est révélée

#### Scenario: Cible disparue entre le rendu et le clic

- **GIVEN** une ligne est affichée mais son étape ou son projet a disparu du
  document courant
- **WHEN** sa commande d'ouverture est activée
- **THEN** aucune navigation vers un autre projet n'est effectuée
- **AND** aucun contenu d'un autre espace n'est affiché
- **AND** l'état de révélation transitoire est nettoyé

#### Scenario: Ouverture sans modification métier

- **GIVEN** une urgence est ouverte depuis la synthèse
- **WHEN** la navigation et la révélation sont terminées
- **THEN** les priorités, états `done`, relations parentes, ordres, IDs,
  suggestion et reprise sont inchangés

### Requirement: Accessibilité des lignes et commandes

Les lignes, le compteur et les commandes de développement et d'ouverture SHALL
être utilisables au clavier, au toucher et par un lecteur d'écran, avec des
libellés français, une cible d'au moins 44 × 44 px et un focus visible. La
commande d'ouverture MUST avoir un nom accessible identifiant le projet et
l'étape. Aucune nouvelle région live MUST répéter un état inchangé.

#### Scenario: Ouverture au clavier et au toucher

- **GIVEN** une ligne de la synthèse est affichée
- **WHEN** sa commande est atteinte au clavier puis activée par Entrée ou Espace,
  ou touchée
- **THEN** l'ouverture et la révélation se produisent
- **AND** le focus reste visible et la cible tactile respecte au moins
  44 × 44 px

#### Scenario: Nom accessible de la commande

- **GIVEN** une ligne concerne une étape et un projet donnés
- **WHEN** sa commande est rendue
- **THEN** son nom accessible identifie le projet et l'étape
- **AND** il distingue deux titres homonymes par leur contexte de projet

#### Scenario: État de développement annoncé

- **GIVEN** la synthèse est réduite ou développée
- **WHEN** la commande de développement est rendue
- **THEN** son libellé est « Voir toutes les urgences » ou « Réduire »
- **AND** son état est compréhensible sans couleur seule

#### Scenario: Aucune annonce dupliquée

- **GIVEN** la synthèse est rerendue avec un contenu inchangé
- **WHEN** les mêmes lignes et le même compteur restent affichés
- **THEN** aucune nouvelle région live n'est créée
- **AND** aucune annonce accessible supplémentaire n'est produite

### Requirement: Indépendance et non-régression des surfaces existantes

La liste SHALL être globale et indépendante des filtres de projets, de
« Masquer les étapes terminées », de la suggestion et de « Je reprends ici ».
Elle MUST NOT modifier les compteurs globaux, la suggestion, la reprise, les
cartes projet, les filtres, les priorités, les identifiants, les relations
parentes ou l'ordre enregistré.

#### Scenario: Filtres de projets indépendants

- **GIVEN** un mode de filtre de projets est actif
- **WHEN** la synthèse est affichée
- **THEN** elle conserve toutes les urgences autorisées, y compris celles des
  projets masqués
- **AND** les cartes projet suivent uniquement le mode de filtre actif

#### Scenario: Masquage des étapes terminées indépendant

- **GIVEN** « Masquer les étapes terminées » est activé ou désactivé
- **WHEN** la synthèse est affichée
- **THEN** son contenu et son ordre sont inchangés
- **AND** l'affichage des étapes dans les cartes suit uniquement ce filtre

#### Scenario: Compteurs globaux identiques

- **GIVEN** un document avec plusieurs projets et urgences
- **WHEN** la synthèse est développée, réduite ou ouverte
- **THEN** les compteurs globaux, la suggestion et « Je reprends ici » restent
  identiques

#### Scenario: Aucune carte projet dupliquée

- **GIVEN** la synthèse est affichée
- **WHEN** une urgence est listée
- **THEN** la carte projet complète n'est pas reproduite dans la synthèse
- **AND** les contrôles des cartes existantes restent uniques

### Requirement: Réactualisation après mutations et actualisations autorisées

La liste SHALL être recalculée depuis le document courant après un changement de
priorité, une complétion, une suppression puis Undo, un ajout, un import réussi
et un événement Dexie autorisé. Elle MUST NOT créer de lecture, d'écriture,
d'abonnement, de synchronisation ou de requête supplémentaire.

#### Scenario: Complétion ou déclassement

- **GIVEN** une urgence est listée
- **WHEN** elle est cochée ou passe à une priorité non urgente
- **THEN** elle disparaît de la synthèse

#### Scenario: Suppression puis Undo

- **GIVEN** une urgence est listée
- **WHEN** elle est supprimée puis restaurée par « Annuler »
- **THEN** elle disparaît puis réapparaît dans la synthèse
- **AND** l'Undo conserve son comportement existant

#### Scenario: Ajout ou nouvelle priorité urgente

- **GIVEN** la synthèse est affichée
- **WHEN** une étape est ajoutée ou passe à `priority: urgent` sans être
  terminée
- **THEN** elle apparaît à sa position déterministe

#### Scenario: Import et événement Dexie autorisé

- **GIVEN** un import réussi ou un événement Dexie autorisé remplace ou actualise
  le document
- **WHEN** la vue Overview est rerendue
- **THEN** la synthèse est recalculée depuis ce nouvel état
- **AND** aucune lecture, écriture ou synchronisation supplémentaire n'est
  créée par la synthèse

### Requirement: Sécurité d'identité et réponses tardives

La liste MUST être dérivée uniquement du document métier déjà autorisé et
achevé. Lors d'un changement d'espace ou de compte, elle SHALL être vidée et
réinitialisée avant l'affichage du nouvel espace. Une réponse ou un événement
tardif de l'espace A MUST NOT produire de ligne sous l'espace B ni révéler une
cible de A.

#### Scenario: Bascule d'espace A vers B

- **GIVEN** des urgences de l'espace A sont affichées
- **WHEN** l'espace B devient autorisé
- **THEN** les urgences de A disparaissent immédiatement
- **AND** B affiche son propre chargement, ses propres urgences ou l'état vide
  autorisé selon son état réel
- **AND** aucune ligne de A n'est conservée

#### Scenario: Événement tardif de A après la bascule

- **GIVEN** l'espace B est autorisé et affiché
- **WHEN** un événement ou une réponse tardive de A arrive
- **THEN** aucune ligne de A n'apparaît sous B
- **AND** aucune cible de A n'est révélée

#### Scenario: Ouverture d'une cible disparue pendant une réponse tardive

- **GIVEN** une ligne affichée fait référence à une cible qui n'existe plus
  dans le document autorisé courant
- **WHEN** l'ouverture est demandée
- **THEN** l'action est annulée proprement
- **AND** aucun contenu d'un autre espace n'est remonté

### Requirement: Continuité du focus, du défilement et des états locaux

Le développement, la réduction, l'ouverture et les rerendus SHALL préserver un
focus pertinent, un ancrage de défilement cohérent, les brouillons, les groupes
développés et les filtres lorsque les éléments concernés restent affichés. Si la
ligne focalisée disparaît, le focus SHALL rejoindre un contrôle restant
pertinent. Les réductions réelles de contenu restent permises.

#### Scenario: Développer et réduire sans perte de contexte

- **GIVEN** des cartes projet ont des groupes développés et des brouillons, et la
  synthèse est réduite
- **WHEN** « Voir toutes les urgences » puis « Réduire » sont activés
- **THEN** le focus reste sur un contrôle pertinent de la synthèse
- **AND** les groupes développés, les brouillons et les filtres des cartes
  restent inchangés
- **AND** le défilement reste borné par la hauteur réelle

#### Scenario: Ligne focalisée devenue absente

- **GIVEN** le focus se trouve sur une ligne de la synthèse
- **WHEN** une mutation fait disparaître cette ligne au rerendu
- **THEN** le focus rejoint un contrôle restant pertinent
- **AND** aucun focus ne reste sur un nœud détaché

#### Scenario: Ouverture et révélation dans le détail

- **GIVEN** une urgence est ouverte depuis la synthèse
- **WHEN** la vue de détail est rendue
- **THEN** l'étape exacte est mise en évidence ou focalisée
- **AND** le focus n'est pas laissé sur le bouton détaché de la synthèse

#### Scenario: Rafraîchissement identique sans oscillation

- **GIVEN** la synthèse et son état développé sont inchangés
- **WHEN** plusieurs rerendus autorisés se succèdent
- **THEN** le contenu, le compteur et le libellé de développement ne sont pas
  réécrits inutilement
- **AND** aucune annonce supplémentaire n'est produite

### Requirement: Aucune persistance ni accès supplémentaire

La projection, le rendu, le développement et l'ouverture SHALL être des
opérations de présentation. Ils MUST NOT écrire ou lire Dexie ou
`localStorage`, ajouter un index, un listener, un `fetch`, une authentification,
un champ d'export/import, une préférence, une entrée d'historique ou une règle
de suggestion.

#### Scenario: Développement et ouverture sans effet de bord

- **GIVEN** la synthèse est affichée
- **WHEN** elle est développée, réduite ou qu'une urgence est ouverte
- **THEN** le document, le stockage local, l'export JSON, l'historique et les
  préférences sont strictement inchangés
- **AND** aucune opération Dexie, Cloud, réseau ou d'authentification n'est
  déclenchée

#### Scenario: Export et import inchangés

- **GIVEN** un document avec des urgences est exporté puis réimporté
- **WHEN** la synthèse est utilisée avant ou après
- **THEN** la forme de sauvegarde et les enregistrements métier sont identiques
- **AND** aucun champ, statut ou préférence de synthèse n'est ajouté

#### Scenario: Suggestion et reprise inchangées

- **GIVEN** la synthèse est affichée, développée ou utilisée pour ouvrir une
  urgence
- **WHEN** la suggestion ou la reprise est ensuite calculée
- **THEN** son résultat dépend uniquement du document et des règles existantes
- **AND** aucune règle de sélection de la synthèse ne l'influence
