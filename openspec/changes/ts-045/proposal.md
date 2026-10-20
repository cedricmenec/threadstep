# Proposal

## Why

Le 20 octobre 2026, après TS-043/TS-044, des projets déjà visibles sont devenus
inaccessibles sur laptop avec le diagnostic `Cache local non vérifié`. La
récupération manuelle dans un nouveau cache isolé a rétabli la visibilité sans
prouver ni la cause racine, ni une perte distante, ni une synchronisation
complète entre appareils. L'incertitude actuelle empêche de distinguer un cache
historique légitimement non vérifiable d'une régression de bootstrap ou
d'hydratation, et laisse l'utilisateur recréer une copie locale sans preuve.

## What Changes

- Instrumenter localement et de façon expurgée la séquence de bootstrap :
  configuration, registre, ouverture de base, restauration de session,
  observation d'identité, évaluation de liaison, lecture du cache, premier pull
  et preuve distante. La trace ne contient que des codes, catégories, compteurs
  et booléens, jamais email, OTP, jeton, identifiant utilisateur brut ni contenu
  métier.
- Classifier tout état `UNVERIFIED` par chemin reproduit : cache hérité sans
  attestation, premier pull avant liaison, liaison antérieure perdue, échec
  d'écriture de liaison, identité retardée, compte changé, `remoteDbId` changé,
  preuve distante absente ou cause indéterminée. La classification distingue
  explicitement l'état historique autorisé, la régression de reprise et le
  changement d'identité ou de destination.
- Rendre durable et relisible une liaison déjà attestée pour un compte, une URL
  et une base effective identiques. Une attestation légataire cohérente peut
  restaurer un pointeur de registre manquant ; elle ne peut jamais adopter un
  cache peuplé sans preuve.
- Vérifier la cohérence du `remoteDbId` observé avec la liaison et corriger les
  courses de démarrage : identité native retardée, événements concurrents,
  onglets multiples et écritures de registre non relues. Un résultat ancien ne
  doit pas remplacer une évaluation plus récente.
- Préserver strictement les protections existantes : cache peuplé non vérifié,
  compte différent, destination différente, attestation manquante et mutations
  en attente restent masqués sans copie, purge ou rattachement opportuniste. La
  récupération isolée reste explicite et non destructive.
- Conserver les transitions non destructives entre espace local et Cloud,
  suspension, reprise, déconnexion, purge confirmée, expiration de session,
  hors ligne et scénarios A/B/A.
- Ajouter des tests déterministes sur `site/workspace-identity.js`,
  `site/app.js`, `site/sync-diagnostics.js` et le nouveau module de diagnostic
  de bootstrap, puis documenter la matrice de régression et les règles de
  rédaction.

## Capabilities

### New Capabilities

- Aucune : le comportement appartient aux capacités existantes d'identité
  d'espace et de cycle de synchronisation.

### Modified Capabilities

- `workspace-identity-isolation` : liaison durable à travers reload, OTP et
  reprise ; réhydratation sûre d'une attestation antérieure ; cohérence du
  `remoteDbId` ; classification expurgée des causes `UNVERIFIED` ; ordonnancement
  des évaluations concurrentes ; transitions non destructives préservées.
- `cloud-sync-lifecycle` : le diagnostic expose séparément la preuve de liaison
  et la preuve distante ; `in-sync` ou un pull attesté ne valent ni convergence
  métier ni preuve sur un autre appareil.

## Impact

- `site/workspace-identity.js` : résolution d'attestation, fusion idempotente du
  registre, conservation de `remoteDbId`, garde de cohérence et classification.
- `site/bootstrap-diagnostics.js` (nouveau) : trace bornée expurgée et
  classifieur pur des causes de bootstrap.
- `site/app.js` : ordre bootstrap/lecture métier, abonnements aux observables
  natifs, génération monotone, réhydratation avant lecture et branchement du
  diagnostic.
- `site/sync-diagnostics.js` : exposition en lecture seule de la catégorie de
  liaison/bootstrap sans la confondre avec la preuve distante.
- `tests/ts-045-*.test.mjs`, `tests/workspace-identity.test.mjs`,
  `tests/sync-diagnostics.test.mjs` et tests statiques `app.js` : scénarios
  déterministes, rédaction, ordre, concurrence et non-régression.
- `docs/architecture.md` : matrice de régression, catégories de cause et règles
  d'expurgation.
- `package.json` : ajout du nouveau module au contrôle `node --check`.
- Aucun changement de schéma IndexedDB, de format de sauvegarde, de workflow
  ASF, de secret ni de permission Cloud.

## Non-goals

- Refonte esthétique du diagnostic (TS-047) et guide utilisateur détaillé
  (TS-046).
- Suppression, migration destructive ou purge automatique de bases existantes.
- Modification des workflows ASF, d'`AGENTS.md`, des secrets ou des règles de
  publication.
- Déclarer la cause racine de l'incident sans reproduction ni preuve.
- Déduire une convergence inter-appareils d'un test simulé, d'un commit local ou
  d'un état natif `in-sync`.

## Uncertainties and decisions to confirm

- La cause exacte de l'incident du 20 octobre 2026 n'est pas encore démontrée.
  Le plan ne l'invente pas : il ajoute l'instrumentation, corrige uniquement les
  mécanismes de bootstrap/hydratation reproduits par des tests, et laisse une
  catégorie `indéterminée` explicite pour une cause non reproductible.
- La réhydratation depuis l'attestation d'activation existante est retenue comme
  preuve locale antérieure, jamais comme consentement à adopter un cache non
  attesté. Si cette source s'avère absente ou incohérente sur les profils réels,
  l'état reste bloqué et la récupération isolée explicite.
- Les libellés exacts des catégories de cause et leur place dans la page de
  synchronisation restent des choix d'implémentation ; ils ne doivent ni
  masquer une donnée métier ni affaiblir les protections existantes.
- La vérification réelle sur instance Dexie Cloud isolée, deux appareils, OTP
  réel et comparaison du contenu métier reste une recette humaine séparée de la
  CI.
