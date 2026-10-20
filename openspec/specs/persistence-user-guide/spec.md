# persistence-user-guide Specification

## Purpose

Fournir une documentation utilisateur durable, exacte et actionnable sur la
persistance IndexedDB de ThreadStep, les espaces Dexie Cloud, les copies
locales et distantes, les preuves de synchronisation et les procédures sûres.

## Requirements

### Requirement: Autonomous and discoverable guide

ThreadStep SHALL fournir un guide autonome sous `docs/product/` consacré à la
persistance IndexedDB et à Dexie Cloud. Le guide SHALL être accessible depuis le
guide d'utilisation général et depuis les références de documentation produit
adaptées.

#### Scenario: Standalone persistence guide exists

- **WHEN** une personne ouvre la documentation produit du dépôt
- **THEN** un guide dédié à la persistance et à la synchronisation Dexie Cloud existe sous `docs/product/`
- **AND** il est lisible de bout en bout sans dépendre d'un autre document pour comprendre les copies et les actions principales
- **AND** il cite le code livré et les spécifications canoniques comme sources, sans reproduire l'ancien parcours V1

#### Scenario: Visible inbound links

- **GIVEN** le guide général `docs/product/guide-utilisation.md`
- **WHEN** une personne consulte la section sur l'enregistrement, l'export et l'import
- **THEN** un lien visible mène au guide de persistance
- **AND** les références produit adaptées, dont la documentation de déploiement Dexie Cloud et la recette fonctionnelle, contiennent également un lien vers ce guide
- **AND** aucun de ces documents ne duplique intégralement le guide

### Requirement: Explicit local-first copy model

Le guide SHALL décrire les copies avec leurs noms et types réels. Il MUST
distinguer l'espace autonome sans réplication, l'IndexedDB locale distincte de
chaque espace Cloud et l'instance distante répliquée sous conditions.

#### Scenario: Autonomous local mode

- **GIVEN** aucune activation Cloud
- **WHEN** le guide décrit le mode local
- **THEN** il indique que la base `threadstep-local` est une base IndexedDB locale autonome
- **AND** il indique qu'aucune réplication distante n'existe dans ce mode
- **AND** il précise que l'application reste utilisable sans URL, OTP ou réseau

#### Scenario: Cloud workspace copy

- **GIVEN** une activation Dexie Cloud consentie
- **WHEN** le guide décrit l'espace synchronisé
- **THEN** il indique qu'une IndexedDB locale distincte par workspace est utilisée, avec un nom effectif de la forme `threadstep-ws-…`
- **AND** il indique qu'une instance distante est répliquée sous conditions de session, de permissions, de consentement et de connexion
- **AND** il explique que Dexie Cloud réplique vers cette base locale et n'est jamais interrogé directement à la place d'IndexedDB

#### Scenario: Recovery cache is local only

- **WHEN** le guide décrit la récupération dans un nouveau cache isolé
- **THEN** il indique qu'un nom `threadstep-recovery-…` identifie un cache IndexedDB local
- **AND** il précise que ce nom ne crée ni ne désigne une nouvelle base distante
- **AND** il indique que l'ancien cache et ses mutations restent conservés

### Requirement: Distinct synchronization evidence levels

Le guide SHALL employer six niveaux distincts : enregistré sur cet appareil,
transfert local en attente, pull natif terminé, synchronisation native en phase,
lecture métier attestée et contenu confirmé sur un autre appareil. Il MUST NOT
présenter un niveau comme la preuve des autres.

#### Scenario: Six evidence labels are defined

- **WHEN** le guide présente les états de persistance et de synchronisation
- **THEN** les six formulations sont définies séparément en français clair
- **AND** chacune indique ce qu'elle prouve et ce qu'elle ne prouve pas
- **AND** elles ne sont pas fusionnées en un unique statut « synchronisé »

#### Scenario: In-sync is not completeness proof

- **GIVEN** un état natif `in-sync`
- **WHEN** le guide explique la synchronisation native en phase
- **THEN** il indique que cet état ne prouve pas que toute la copie distante est complète
- **AND** il indique qu'il ne prouve pas qu'un autre appareil affiche déjà les mêmes projets
- **AND** il renvoie à une vérification séparée sur un autre appareil

#### Scenario: No unproven remote guarantee

- **WHEN** le guide décrit un pull terminé ou une lecture métier locale
- **THEN** il ne les présente jamais comme une confirmation de contenu sur un autre appareil
- **AND** il conserve un état explicitement indéterminé lorsque la preuve distante manque
- **AND** il ne décrit jamais Dexie Cloud comme une base distante consultée directement à la place d'IndexedDB

### Requirement: Scenario matrix with before and after consequences

Le guide SHALL présenter les scénarios sous forme de tableaux de décision
courts. Chaque scénario MUST rendre explicites l'espace actif, les données
consultables localement, le destinataire distant éventuel, les données
conservées mais non affichées, le danger, la sauvegarde conseillée, l'action
exacte et la possibilité de retour arrière.

#### Scenario: Complete decision columns

- **WHEN** une personne lit un scénario de la matrice
- **THEN** le tableau ou son paragraphe avant/après indique l'espace actif
- **AND** il indique les données consultables localement et celles conservées mais non affichées
- **AND** il indique le destinataire distant éventuel
- **AND** il indique le danger, la sauvegarde conseillée, l'action exacte et la possibilité de retour arrière

#### Scenario: Local start and configuration coverage

- **WHEN** le guide couvre le premier lancement local et la configuration d'une URL sans activation
- **THEN** il précise qu'aucune donnée n'est envoyée et qu'aucune réplication n'est active
- **AND** il indique que `threadstep-local` reste l'espace actif
- **AND** il précise que configurer l'URL ne copie ni ne rattache les données locales

#### Scenario: Activation and other-device coverage

- **WHEN** le guide couvre l'activation depuis des données locales et la connexion sur un autre appareil
- **THEN** il décrit la configuration, l'OTP natif, la première lecture distante, la revue du plan, le consentement et le transfert comme des étapes distinctes
- **AND** il indique que l'OTP seul ne vaut pas consentement
- **AND** il précise que la source locale reste conservée

#### Scenario: Transition and session coverage

- **WHEN** le guide couvre la suspension, la déconnexion, le changement d'espace, d'URL ou de compte, le retour au local et la reprise Cloud
- **THEN** chaque scénario indique la base active et la destination concernée
- **AND** il indique ce qui reste conservé et ce qui est masqué
- **AND** il précise qu'aucune autre base ni donnée distante n'est supprimée par ces transitions

#### Scenario: Offline, error and pending write coverage

- **WHEN** le guide couvre le hors ligne, une erreur et une écriture non transmise
- **THEN** il distingue l'enregistrement local réussi de la transmission distante
- **AND** il indique que la modification peut rester en attente sans être perdue localement
- **AND** il indique les conséquences d'une déconnexion ou d'une purge avant transmission

#### Scenario: Cache protection and recovery coverage

- **WHEN** le guide couvre un cache `UNVERIFIED` ou `MISMATCH` et la récupération dans une base isolée
- **THEN** il indique que les données peuvent être conservées mais masquées, sans supposer une perte distante
- **AND** il présente la récupération isolée comme une action explicite et non destructive
- **AND** il indique que l'ancien cache et ses mutations ne sont ni purgés ni fusionnés automatiquement

#### Scenario: Data management and browser deletion coverage

- **WHEN** le guide couvre l'export, l'import, la restauration et la suppression des données du navigateur
- **THEN** il distingue la sauvegarde, la fusion additive et la restauration remplaçante
- **AND** il conseille une sauvegarde vérifiée avant toute action risquée
- **AND** il indique que supprimer les données du navigateur peut être définitif et ne prouve pas l'absence de données distantes

### Requirement: Safe procedures and separated sensitive actions

Le guide SHALL permettre à une personne non technique de trouver une procédure
sans risque avant toute déconnexion, import, restauration ou purge. Les actions
sensibles MUST être séparées des actions de consultation et de reprise.

#### Scenario: Safe procedure before destructive action

- **GIVEN** une personne souhaite se déconnecter, importer, restaurer ou purger
- **WHEN** elle consulte le guide
- **THEN** elle trouve une procédure dédiée qui commence par vérifier l'espace actif et les données consultables
- **AND** elle indique la sauvegarde conseillée et le retour arrière possible
- **AND** elle distingue clairement cette action d'une simple lecture ou d'une reprise Cloud

#### Scenario: Sensitive actions are not mixed

- **WHEN** le guide présente les actions disponibles
- **THEN** la déconnexion, la suspension, la purge locale, l'import, la restauration et la suppression des données navigateur sont présentées séparément
- **AND** aucune action destructive n'est présentée comme une étape implicite d'une autre
- **AND** les noms reprennent les contrôles réellement affichés par l'application

### Requirement: Prioritized troubleshooting FAQ

Le guide SHALL contenir une FAQ de dépannage priorisée. Elle MUST couvrir six
questions dans un ordre stable et renvoyer chaque réponse à une section ou un
scénario de référence.

#### Scenario: Required FAQ order

- **WHEN** une personne ouvre la FAQ
- **THEN** les questions « Mes projets est vide », « Connecté mais projets absents », « Quelle est ma base active ? », « Pourquoi un nouveau nom IndexedDB ? », « Que signifie dernière synchronisation ? » et « Que se passe-t-il si je change de téléphone ou supprime les données du navigateur ? » apparaissent dans cet ordre
- **AND** chaque réponse indique l'état observable et l'action sûre
- **AND** aucune réponse n'affirme une perte ou une synchronisation non prouvée

#### Scenario: Empty projects is not an empty Cloud

- **GIVEN** la liste des projets est vide ou masquée
- **WHEN** la FAQ traite « Mes projets est vide »
- **THEN** elle distingue un espace local vide, un cache masqué et une preuve distante absente
- **AND** elle indique comment identifier la base active avant toute purge
- **AND** elle ne conclut jamais que la cible Cloud est vide

#### Scenario: New IndexedDB name is explained

- **WHEN** la FAQ traite « Pourquoi un nouveau nom IndexedDB ? »
- **THEN** elle explique qu'un espace, une URL ou une récupération isolée peut sélectionner une autre base locale
- **AND** elle précise que ce nom identifie un cache local et non une nouvelle base distante
- **AND** elle renvoie aux précautions de conservation de l'ancien cache

### Requirement: Limits, glossary and official references

Le guide SHALL expliquer les limites de durabilité du stockage navigateur et
des sauvegardes, des permissions Cloud, de l'authentification, de l'état hors
ligne et de l'absence de propagation distante attestée. Il SHALL inclure un
glossaire sans jargon et des liens vers les sources officielles Dexie.

#### Scenario: Durability and backup limits

- **WHEN** le guide décrit le stockage local et les sauvegardes
- **THEN** il indique que les données navigateur peuvent être supprimées ou indisponibles
- **AND** il indique que la sauvegarde JSON n'est pas une synchronisation entre appareils
- **AND** il recommande un export vérifié avant une manipulation risquée

#### Scenario: Cloud permissions and authentication limits

- **WHEN** le guide décrit l'accès Cloud
- **THEN** il indique que les permissions et l'identité sont contrôlées par Dexie Cloud
- **AND** il indique que l'authentification initiale nécessite une connexion
- **AND** il ne promet pas qu'une session ou une OTP prouve le contenu distant

#### Scenario: Plain glossary and official links

- **WHEN** une personne consulte le glossaire
- **THEN** les termes IndexedDB, espace autonome, espace synchronisé, cache local, base distante, OTP, pull, réplication, sauvegarde et restauration sont définis sans jargon
- **AND** une section de références pointe vers les sources officielles Dexie utilisées par le projet
- **AND** ces liens ne contiennent aucun secret ni donnée personnelle

### Requirement: Current terminology and privacy

Le guide SHALL employer les noms, liens et libellés du code actuel. Il MUST
rester en français clair, lisible sur mobile, et MUST NOT contenir d'adresse
email réelle, d'OTP, de jeton, de secret ni de donnée personnelle d'utilisateur.

#### Scenario: Controls and code names match

- **WHEN** le guide cite un contrôle ou un nom technique
- **THEN** les libellés correspondent aux contrôles réellement affichés, notamment « Se déconnecter », « Suspendre Cloud », « Purger la copie locale », « Retrouver les projets Cloud dans un nouveau cache isolé » et les sections de `#/parametres/synchronisation`
- **AND** les noms `threadstep-local`, `threadstep-ws-…` et `threadstep-recovery-…` correspondent au code livré
- **AND** les limites et les états correspondent aux spécifications canoniques applicables

#### Scenario: No obsolete V1 path

- **WHEN** le guide présente l'import, l'export ou la restauration
- **THEN** il ne propose ni n'encourage l'import ou la restauration d'un document V1
- **AND** il indique le format `threadstep.indexeddb-backup` pour la sauvegarde moderne
- **AND** il ne présente pas l'ancien parcours V1 comme un chemin de récupération actif

#### Scenario: No personal data or secret

- **WHEN** le guide est relu et testé
- **THEN** il ne contient aucune adresse email réelle, aucun OTP, aucun jeton, aucune clé ni aucun secret
- **AND** il ne contient aucune donnée personnelle d'utilisateur ni contenu métier réel
- **AND** ses exemples utilisent des libellés génériques et des données fictives

#### Scenario: Mobile-readable French

- **WHEN** le guide est affiché sur un écran mobile
- **THEN** ses sections, tableaux et listes restent structurés sans dépendre d'une largeur de bureau
- **AND** le vocabulaire reste en français clair et non jargon
- **AND** les instructions critiques restent lisibles sans survol ni interaction complexe

### Requirement: Publication fidelity and TS-045 coordination

Le guide SHALL rester fidèle à l'état effectivement livré au moment de sa
publication. Si TS-045 ou TS-047 découvre un écart réel avant publication, le
guide MUST être corrigé dans la PR de correctif correspondante, sans transformer
une hypothèse en garantie.

#### Scenario: Unproven cause stays unproven

- **GIVEN** la cause racine d'un état `UNVERIFIED` n'est pas démontrée
- **WHEN** le guide explique ce cas
- **THEN** il le décrit comme un état observable avec données conservées et masquées
- **AND** il ne présente aucune cause racine comme confirmée
- **AND** il renvoie aux actions sûres et à la récupération isolée explicite

#### Scenario: Discrepancy is corrected before publication

- **GIVEN** TS-045 ou TS-047 modifie un libellé, une limite ou un parcours décrit dans le guide
- **WHEN** la correction est publiée
- **THEN** le guide et ses tests documentaires sont mis à jour dans la même PR
- **AND** aucune affirmation antérieure devenue fausse n'est conservée
- **AND** les tests CI et la recette humaine restent distingués des garanties de propagation distante
