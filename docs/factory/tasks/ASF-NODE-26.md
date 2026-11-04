# ASF-NODE-26 | Migration du runtime Node

Autorisation propriétaire : migration, PR et fusion demandées explicitement le 4 novembre 2026.

## Implémentation

- [x] Aligner engines, lockfile racine, .nvmrc et .npmrc sur >=26.13.0 <27, avec pin exact 26.13.0.
- [x] Épingler les six workflows existants sur 26.13.0.
- [x] Mettre à jour les guides de développement et de reprise.

## Validation

La PR doit passer npm ci, npm run check, build, verify:build, verify:servers, actionlint et OpenSpec strict dans la CI indépendante sur son SHA exact avant fusion. Les résultats et liens sont consignés dans la PR.

## Portée

Les Apps, permissions, secrets, mutex et déclencheurs sont conservés. ThreadStep possède sa propre factory et ne reçoit pas une installation du kit portable. Aucun appel payant ni recette navigateur n'est nécessaire à cette migration de runtime.
