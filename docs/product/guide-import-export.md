# ThreadStep | Importer, exporter et restaurer ses données

Référence vérifiée dans le code de `main` au commit
`5ef4079ad6e35239ea43cb72412eb124642e0376` (4 novembre 2026).
Ce guide décrit le comportement livré, sans modifier le format.

## Choisir la bonne opération

Ouvrez **Menu → Imports / Exports** (`#/parametres/donnees`).

| Opération | Usage | Effet sur l'espace courant |
| --- | --- | --- |
| Exporter mes données | Conserver une copie hors du navigateur | Télécharge un fichier, sans modifier les données |
| Importer et fusionner un JSON | Ajouter des données d'une sauvegarde | Fusion après prévisualisation et consentement, sans suppression |
| Restaurer un état antérieur | Revenir au contenu d'une sauvegarde | Peut remplacer des valeurs et supprimer les éléments absents du fichier, après sauvegarde et confirmation renforcée |

Les opérations concernent l'espace actif. Un export contient les données métier
localement lisibles de cet espace, pas tous les espaces de travail ni une preuve
d'exhaustivité de la base distante. En mode Cloud, vérifiez d'abord le diagnostic
de synchronisation si vous attendez des modifications d'un autre appareil.

## Exporter une sauvegarde

1. Dans la section **Exporter**, activez **Exporter mes données**.
2. Conservez le fichier téléchargé `threadstep-backup.json` hors des données du
   navigateur. Vous pouvez le renommer sans changer son contenu.
3. Pour vérifier sa lisibilité, sélectionnez-le dans l'import et examinez la
   prévisualisation, puis annulez sans confirmer d'écriture.

Le fichier comprend tous les projets et toutes les tâches lisibles de l'espace,
y compris les tâches terminées, les sous-tâches et les notes. Les filtres et la
limite d'aperçu de la vue d'ensemble ne limitent pas son contenu.
Les identifiants, relations, priorités et ordres sont conservés.

L'export ne déclenche pas de transfert réseau. Il exclut les secrets, jetons,
OTP, comptes, données d'authentification, configuration Cloud et métadonnées
natives de droits/realms. Les préférences locales d'affichage et de suivi ne font
pas partie des champs métier exportés.

**Le JSON contient les titres et notes en clair.** Son empreinte contrôle
l'intégrité du contenu métier ; elle ne chiffre pas le fichier et ne prouve pas
son origine. Conservez-le dans un emplacement adapté à son contenu.

Si une anomalie d'intégrité empêche une sauvegarde fidèle, l'export métier est
bloqué. Le diagnostic peut proposer un **export brut de récupération** distinct,
à conserver pour une investigation, sans le présenter comme une sauvegarde
réimportable.

## Importer et fusionner

1. Dans **Importer et fusionner**, choisissez **Importer et fusionner un JSON**,
   puis un fichier de sauvegarde moderne.
2. Examinez la prévisualisation et la destination avant de donner votre
   consentement.
3. Confirmez uniquement le plan voulu, ou choisissez de ne rien importer.
4. Après succès, vérifiez les projets et tâches. En mode Cloud, vérifiez
   séparément la synchronisation et la réception sur un autre appareil.

La sélection du fichier ne vaut pas consentement à l'écriture. Le fichier source
reste intact. L'import se fonde sur les **identifiants**, pas sur les titres :
deux projets de même titre mais d'identifiants différents restent distincts.
Les IDs sont canoniques et conservés tels quels, même s'ils commencent par
`legacy:`.

En mode local, seuls les enregistrements absents sont ajoutés. Un même ID avec
un contenu différent bloque la fusion ; il n'est pas écrasé automatiquement.
Réimporter un contenu déjà présent à l'identique n'ajoute aucun doublon.

En mode Cloud, le parcours exige une connexion et une lecture distante attestée,
puis une réconciliation explicite. Les conflits doivent être résolus dans le
plan, en conservant la version Cloud ou en important la version du fichier comme
copie lorsque cette option est proposée. Les groupes bloqués ne sont pas
importés implicitement. Une écriture locale réussie ne prouve pas la convergence
distante.

Si la cible change avant confirmation, le plan doit être revalidé. Une erreur de
validation ou une annulation avant confirmation n'écrit aucune donnée.

## Restaurer un état antérieur

1. Dans la section dédiée, choisissez **Restaurer un état antérieur** et le
   fichier à restaurer.
2. Lisez la portée et les nombres d'enregistrements ajoutés et supprimés. Des
   valeurs d'enregistrements existants peuvent aussi être remplacées.
3. Activez **Télécharger la sauvegarde de l'état actuel**. Le fichier se nomme
   `threadstep-avant-restauration.json`.
4. Saisissez exactement `RESTAURER`, puis activez
   **Restaurer et remplacer l'état actuel**, si le plan l'autorise.
5. Vérifiez le résultat. En espace synchronisé, contrôlez séparément les effets
   distants : la restauration écrit dans l'espace actif et ces modifications
   peuvent être répliquées par Dexie Cloud.

La restauration est distincte de la fusion. Une sauvegarde vide peut supprimer
tous les projets et tâches de la cible. Le moteur revalide l'état avant
l'écriture et refuse un plan périmé. Une transaction locale échouée n'est pas
présentée comme une restauration partielle réussie.

Une annulation, une navigation ou un rechargement n'exécute pas automatiquement
une restauration. Si l'état courant n'est pas lisible ou sauvegardable, la
restauration est bloquée. La sauvegarde préalable peut être un export brut de
récupération si l'état ne permet pas de produire un export métier valide ;
ce fichier brut ne peut pas être chargé dans le parcours d'import habituel.

## Format du fichier JSON

Le format accepté est **`threadstep.indexeddb-backup`**, version de format **1**.
Il s'agit d'un fichier JSON texte, téléchargé avec le type
`application/json`. Aucun CSV, classeur Excel ou export administratif CLI Dexie
Cloud n'est accepté par ce parcours.

| Champ racine | Type et valeur | Rôle |
| --- | --- | --- |
| `format` | chaîne `"threadstep.indexeddb-backup"` | Identifie le format |
| `formatVersion` | nombre `1` | Version de l'enveloppe |
| `provenance` | objet | Provenance et versions internes |
| `counts` | objet `{subjects, items}` | Nombres exacts de projets et de tâches, sous-tâches comprises |
| `records` | objet `{subjects: [], items: []}` | Données métier en deux listes |
| `checksum` | chaîne hexadécimale SHA-256 de 64 caractères | Empreinte du contenu métier canonique |

L'export courant produit cette provenance :

```json
{
  "source": "indexeddb",
  "idsCanonical": true,
  "mappingVersion": 2,
  "schemaVersion": 3
}
```

`source` et `idsCanonical` sont imposés à la lecture.
`mappingVersion` et `schemaVersion` sont obligatoires et entiers ; le lecteur
actuel ne les limite pas aux valeurs 2 et 3. La version de format reste un
contrôle distinct, strictement égal à 1.

### Projets : records.subjects

| Champ obligatoire | Type et contrainte |
| --- | --- |
| `id` | Chaîne non vide, au plus 100 caractères, unique parmi les projets |
| `title` | Chaîne non blanche, au plus 100 caractères |
| `order` | Nombre fini supérieur ou égal à zéro |

### Tâches et sous-tâches : records.items

| Champ | Type et contrainte |
| --- | --- |
| `id` | Obligatoire, chaîne non vide, au plus 100 caractères, unique parmi les tâches |
| `subjectId` | Obligatoire, identifiant d'un projet présent dans `subjects` |
| `parentId` | Obligatoire : `null` pour une tâche principale, ID d'une tâche principale du même projet pour une sous-tâche |
| `title` | Obligatoire, chaîne non blanche, au plus 300 caractères |
| `priority` | Obligatoire, `"urgent"`, `"normal"` ou `"later"` |
| `done` | Obligatoire, booléen `true` ou `false` |
| `order` | Obligatoire, nombre fini supérieur ou égal à zéro |
| `note` | Facultatif, chaîne d'au plus 2 000 caractères, retours à la ligne compris |

Une tâche ne peut être son propre parent. Les sous-tâches n'ont qu'un niveau :
leur parent ne peut pas être lui-même une sous-tâche. Les limites de validation
sont **40 projets** et **500 tâches par projet**, sous-tâches comprises.

Les listes du fichier sont triées par identifiant lors de l'export ; leur
position n'est pas l'ordre d'affichage. L'affichage utilise notamment
`priority` et `order`.

### Exemple complet et valide

Cet exemple contient un projet, une tâche et une sous-tâche. L'empreinte a été
calculée avec le sérialiseur de l'application et vérifiée avec son lecteur.

```json
{
  "format": "threadstep.indexeddb-backup",
  "formatVersion": 1,
  "provenance": {
    "source": "indexeddb",
    "idsCanonical": true,
    "mappingVersion": 2,
    "schemaVersion": 3
  },
  "counts": { "subjects": 1, "items": 2 },
  "records": {
    "subjects": [
      { "id": "projet-1", "title": "Projet exemple", "order": 0 }
    ],
    "items": [
      {
        "id": "sous-tache-1",
        "subjectId": "projet-1",
        "parentId": "tache-1",
        "title": "Vérifier les informations",
        "priority": "later",
        "done": false,
        "order": 0
      },
      {
        "id": "tache-1",
        "subjectId": "projet-1",
        "parentId": null,
        "title": "Préparer la prochaine étape",
        "priority": "normal",
        "done": false,
        "order": 0,
        "note": "Contexte facultatif."
      }
    ]
  },
  "checksum": "23b9feaab726b9f76a9e8624d68aff1727d6d8f2404ccef69e4ac55343a79338"
}
```

### Calcul de l'empreinte et édition manuelle

Le lecteur ne calcule pas le SHA-256 des octets du fichier entier.
`computeBackupChecksum(records)` :

1. Projette uniquement les champs métier décrits ci-dessus.
2. Trie chaque liste par `String(id).localeCompare(...)`.
3. Sérialise l'objet `{subjects, items}` avec les clés de chaque objet triées,
   sans espaces de présentation, tout en conservant l'ordre des listes.
4. Calcule le SHA-256 du texte encodé en UTF-8.

Les métadonnées racines ne sont pas couvertes par cette empreinte ; les compteurs
sont vérifiés séparément. Ajouter des sauts de ligne ou réindenter le JSON ne
change donc pas sa validité. Modifier un titre, une note ou une relation exige de
recalculer l'empreinte, et éventuellement les compteurs. Pour produire un fichier,
réutilisez le sérialiseur du projet plutôt qu'une empreinte copiée d'un exemple.
N'ajoutez aucun secret ni champ privé supplémentaire au fichier.

## Refus, compatibilité et limites

| Situation | Résultat du moteur |
| --- | --- |
| Ancienne enveloppe `"version": 1` | `unsupported-v1-backup`, sans conversion ni écriture |
| Format ou version de format inconnu | `unknown-format` |
| JSON illisible, provenance ou champ invalide | `invalid-backup` |
| Identifiant en double dans une liste | `duplicate-id` |
| Projet ou parent absent/incohérent | `dangling-reference` |
| Limite de projets/tâches dépassée | `quota-exceeded` |
| Compteurs inexacts | `count-mismatch` |
| Empreinte incorrecte | `checksum-mismatch` |

L'interface peut regrouper certains refus sous un message générique de format ;
les codes ci-dessus sont ceux du lecteur, pas nécessairement des textes affichés.

Les deux « versions 1 » ne désignent pas le même format :
`formatVersion: 1` dans l'enveloppe moderne est accepté ;
l'ancienne enveloppe `version: 1` est refusée, même avec des IDs `legacy:`.
Renommer le fichier ou ajouter un champ `format` ne convertit pas un export V1.

L'interface impose actuellement une taille maximale de **1 048 576 octets**
(affichée comme 1 Mo) au fichier d'import **et de restauration**. L'export ne
dispose pas d'un contrôle équivalent de taille : une sauvegarde respectant les
quotas métier peut dépasser ce seuil et être refusée à la réimportation.
Ce guide ne promet donc pas que tout export sera réimportable quelle que soit sa taille.

Le format `threadstep.raw-recovery.v1` est un instantané distinct destiné à la
récupération. Il n'est accepté ni par l'import/fusion ni comme source de
restauration moderne. Un export utilisateur n'est pas une sauvegarde
administrative complète de Dexie Cloud et ne restaure pas comptes ou permissions.

## Références de maintenance

- [Contrat canonique](../../openspec/specs/data-backup-import-restore/spec.md)
- [Sérialiseur et lecteur](../../site/indexeddb-backup.js)
- [Parcours et contrôles de taille](../../site/app.js)
- [Fusion locale](../../site/local-migration.js)
- [Réconciliation Cloud](../../site/migration-reconciliation.js)
- [Récupération et restauration](../../site/data-integrity-recovery.js)
- [Persistance et synchronisation](guide-persistance-et-synchronisation.md)
