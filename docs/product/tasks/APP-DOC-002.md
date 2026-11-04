# APP-DOC-002 | Documenter l'import, l'export et le format de sauvegarde

Status: completed
Date: 2026-11-04
Scope: documentation produit uniquement
Priority: normal

## Objectif

Rendre les procédures d'export, de fusion et de restauration compréhensibles,
avec le contrat exact du fichier et les limites du comportement livré.

## Périmètre et critères

- Documenter l'accès, la portée de l'espace actif et les trois intentions.
- Distinguer collisions locales et réconciliation Cloud sans écrasement implicite.
- Décrire enveloppe, provenance, champs, relations, quotas et calcul SHA-256.
- Fournir un exemple JSON complet validé par le sérialiseur et le lecteur.
- Expliquer refus V1, export brut distinct, confidentialité et limite de 1 Mo.
- Relier le guide depuis README et guide utilisateur ; corriger les indications
  obsolètes du README sur le stockage localStorage.
- Ne changer ni code produit, ni format, ni workflow.

## Vérifications réalisées

Code consulté sur main au SHA `5ef4079ad6e35239ea43cb72412eb124642e0376` :
`site/indexeddb-backup.js`, `site/app.js`, `site/local-migration.js`,
`site/migration-reconciliation.js`, `site/data-integrity-recovery.js`,
`site/core.js`, `site/dexie-foundation.js` et la spécification canonique
`data-backup-import-restore`.

L'exemple a été généré par `serializeIndexedDbBackup`, puis accepté par
`parseIndexedDbBackup`. Une vérification locale relit aussi le bloc JSON du
guide pour éviter une erreur de transcription. Aucun test d'écriture sur les
données de l'utilisateur n'est nécessaire pour ce changement documentaire.

La CI indépendante de la PR exécute les contrôles du dépôt dont
`npm run check`. Son résultat, la fusion et les contrôles main/Pages sont des
preuves de livraison à consulter sur la PR, pas des résultats présumés ici.
Aucune recette sur téléphone ou de restauration distante réelle n'est attestée.

## Limites exposées

La limite de 1 048 576 octets concerne import et restauration, sans contrôle
équivalent à l'export. Les codes du lecteur ne correspondent pas toujours aux
messages génériques de l'interface. L'export n'atteste pas l'exhaustivité distante.
