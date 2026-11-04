# ASF V3 | Qualification G2/G3 sur GitHub réel (plan non exécutant)

Date : 23 octobre 2026. Statut : **recette préparée, essais live NON exécutés**.
Suivi : [issue #86](https://github.com/cedricmenec/threadstep/issues/86), [PR canonique #183](https://github.com/cedricmenec/threadstep/pull/183), [Notion](https://app.notion.com/p/3fc12ac9163680adb3e3e3f63d827f69).

## 0. Frontière de confiance et interdictions

- GitHub App Controller V3 : ID **5361227**. Executor V1 : ID **5321746**. Les métadonnées de bypass ne prouvent jamais les permissions effectives d'une installation ou d'un token.
- Les quatre rulesets ASF V3 et main sont structurellement conformes au contrôle REST du 23 octobre 2026, mais ils ne constituent pas la recette G2/G3.
- **Ref de production** `refs/heads/asf/control/active-wave-v3` absent (GET 404). Ne jamais le créer, le modifier ou essayer un refus dessus durant cette recette.
- Ne pas utiliser la clé OpenRouter, le workflow V3 opérationnel, l'environnement de production ni les refs protégées de `threadstep` comme support des écritures de test.
- L'ancien dépôt privé `asf-v3-mutex-lab` a renvoyé **403** sur ses règles. Ne pas le supposer éligible ni le rendre public sans décision.
- Avant toute première émission d'un jeton privilégié, modification de ruleset, installation App ou **écriture sur ref protégée de laboratoire**, obtenir une autorisation distincte. Aucun test en présence d'une ambiguïté d'identité, de plan GitHub, de facturation runner, d'ownership ou de périmètre de dépôt. Pas de retry automatique après réponse d'écriture ambiguë.

## 1. Environnement à approuver avant les mutations

1. Choisir un dépôt de laboratoire **éligible aux rulesets** sous contrôle du propriétaire ; ne pas changer la visibilité ou le plan de l'ancien laboratoire. Le qualifier par GET de ses règles réellement enregistrées, pas uniquement par le formulaire GitHub.
2. Prévoir deux préfixes de refs **sans données métier ni secrets**, réservés aux essais de writer et d'immuabilité. Les règles de laboratoire doivent reproduire les deux **paires indépendantes** G1 : writer `creation+update`, bypass unique Controller V3 `always` ; history `deletion+non_fast_forward`, zéro bypass, avec exclusions vides. Vérifier ces détails via REST.
3. Vérifier à la source, dans la configuration d'installation GitHub App, le dépôt autorisé et les permissions effectivement accordées. Attendre uniquement le minimum nécessaire pour les essais Git de laboratoire. Ne jamais exporter une clé PEM ou un token dans ChatGPT, Notion, les artefacts GitHub ou les logs.
4. Capturer le SHA `main` du laboratoire avant la campagne. Avoir un mécanisme explicite d'invalidation et de nettoyage **hors récursion/retry automatique** pour les refs de test ; ne jamais tenter de supprimer des refs protégées pour « nettoyer » sans mandat spécifique.
5. Préparer un manifeste de tests en lecture seule fixant dépôt, App ID, installation ID (non secret), ref/scope précis, premier SHA, scénarios autorisés, durée maximale et absence de tout modèle facturable. Un token de travail éphémère reste dans un environnement protégé.

## 2. Matrice de scénarios G2/G3

| ID | Action prévue après autorisation | Critère d'acceptation et preuve indépendante |
| --- | --- | --- |
| G2-01 | Inventorier les installations et leurs permissions via la source GitHub autorisée, sans créer de token de mutation | App Controller et Executor distinctes, dépôt et droits effectifs clairement identifiés ; tout champ absent = INCONNU |
| G2-02 | Observer protections et ref test avant mutation avec deux lectures du SHA de base | Cibles, exclusions, types, bypass exacts ; un 404 = absence observée uniquement, jamais droit CREATE |
| G3-01 | Tenter CREATE/UPDATE sur ref writer avec jeton **Executor V1**, puis `GITHUB_TOKEN` de laboratoire | Les deux sont refusés **par le serveur GitHub** ; une erreur de connectivité ou jeton invalide n'est pas un test de protection réussi |
| G3-02 | Tenter un seul CREATE autorisé par Controller sur ref de test explicitement approuvée | Succès prouvé par identité réelle, HTTP réponse et readback indépendant du SHA et du commit attendu |
| G3-03 | Tenter un unique fast-forward Controller `force:false` avec parent contrôlé | SHA avancé par un seul commit à parent unique, valeur relue au même SHA ; pas de mutation alternative en cas de perte de réponse |
| G3-04 | Tenter DELETE et non-fast-forward/force-push avec Controller sur une ref laboratoire sacrifiable | Refus effectif des deux malgré bypass writer ; readback confirmant l'historique intact |
| G3-05 | Tenter CREATE/UPDATE depuis une installation App sur un dépôt explicitement **hors de son périmètre** | Refus serveur avec preuve du dépôt et de l'identité, sans confondre absence de droits et indisponibilité réseau |
| G3-06 | Soumettre deux propositions de commits frères à partir du même parent, sur une ref test dédiée | Une seule proposition devient HEAD ; l'autre est refusée ou déclarée incertaine, sans deuxième tentative d'écriture automatique |
| G3-07 | Simuler une réponse POST/PATCH perdue après envoi sur une ref dédiée, puis redémarrer l'observateur | Relecture de l'état et STOP/QUARANTINE ; zéro nouvelle émission CREATE/PATCH sans nouvelle décision humaine |
| G3-08 | Enregistrer durablement `BEGIN_CREATE_ATTEMPT` sur un support CAS protégé distinct, **avant** l'unique CREATE Git de genèse de laboratoire | Crash/reprise/concurrence démontrés entre deux runners ; un seul enregistrement gagnant, zéro second CREATE après statut ambigu |
| G3-09 | Tester la conservation d'un registre existant et la mise en quarantaine sur incident | Interdiction de réinitialiser un registre même vide ; toute incertitude bloque une nouvelle admission |
| G3-10 | Vérifier les transitions terminales sur fixtures réalistes (sans modèle) | RELEASE exige les preuves exactes PR/merge/CI/main/Pages ; QUARANTINE conserve le blocage et le CAS monowriter |

## 3. Preuves obligatoires

Pour chaque cas : commit et ref de laboratoire exacts, SHA parent/enfant, identifiant d'installation App **sans token**, run/attempt GitHub exact, horodatage, requête **sanitisée** (méthode et route sans Authorization), classe du statut HTTP, readback indépendant et conclusion `PASS`, `FAIL`, `UNKNOWN` ou `NOT_RUN`. Une simple assertion simulée, un 403 de plan GitHub ou un échec de clé/token **ne prouve pas** un refus par ruleset.

Un test d'écriture ambigu aboutit à `UNKNOWN`, bloque les suivants si nécessaire et interdit tout nouveau CREATE/PATCH automatique. Ne jamais recopier les jetons, entêtes Authorization, clés PEM ou secrets dans les preuves.

Les minutes de runner, la visibilité des dépôts et l'accès aux installations peuvent avoir des effets de coût ou de privilège. Vérifier les conditions avant toute campagne ; même sans OpenRouter, ne pas présumer un coût nul.

## 4. Choix d'architecture encore à trancher : intention durable

Le protocole pur existant impose un CAS durable de `BEGIN_CREATE_ATTEMPT` **avant** `POST /git/refs`. Le ref global étant absent, **ce même ref ne peut pas servir de journal préalable à sa propre création**.

Le support d'intention doit donc exister séparément et garantir : une seule autorité writer, écriture monotone avec CAS Git non forcé, protection contre suppression et réécriture, readback indépendant après crash, résistance à deux runners, quarantaine après réponse perdue. Un ref d'intention distinct sous une paire de rulesets déjà prévue est une piste à évaluer, **pas une autorisation de le créer**, ni une décision d'architecture prise. Les GitHub Issues, commentaires ou artefacts non CAS ne sont pas une preuve d'atomicité par eux-mêmes.

## 5. Décision de sortie

- **G2 PASS** seulement avec permissions réelles attestées et protocole d'intention durable qualifié.
- **G3 PASS** seulement avec tous les refus et écritures contrôlées prouvés côté GitHub, y compris concurrence et réponses perdues, sur environnement approuvé.
- **G4 reste bloqué** après G2/G3, jusqu'à autorisation spécifique d'intégration sensible #183, d'éventuels secrets/workflows puis d'un pilote payé. Aucune preuve de ce plan ne constitue cette autorisation.
