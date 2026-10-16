# ASF V3 : adaptateur Git Data REST, contrat et frontières de confiance

**État : code d'adaptation HTTP avec transport injecté, non relié à GitHub Actions.** Fiche [ASF-V3-006](tasks/ASF-V3-006.md). Contrats amont [#70](https://github.com/cedricmenec/threadstep/pull/70) et [#73](https://github.com/cedricmenec/threadstep/pull/73).

## Fonction métier

Une vague V3 de dix tâches ne doit pas perdre la sérialisation de son journal lorsque plusieurs contrôleurs ou exécuteurs tentent une mise à jour. Le noyau #69 et le CAS #70 possèdent une interface abstraite d'écriture de Git. Cette PR ajoute un port qui traduit **exactement** cette interface vers les noms et corps des requêtes GitHub REST Git Data.

Elle ne lance aucun travail payant, ne modifie aucune branche à l'exécution et **n'authentifie pas un agent**. Son transport injectable simule les requêtes lors des tests ; un transport réseau réel et son modèle de permission sont un chantier de sécurité distinct.

## API exposée

\`createAsfV3GitDataPort({ waveId, transport })\` crée un port figé :

| Fonction | Méthode et endpoint GitHub REST | Forme de réponse normalisée |
|---|---|---|
| \`getRef(ref)\` | \`GET repos/cedricmenec/threadstep/git/ref/heads/asf/waves/<waveId>\` | \`{sha}\` |
| \`getCommit(sha)\` | \`GET repos/cedricmenec/threadstep/git/commits/<sha>\` | \`{sha,treeSha,parents:[sha]}\` |
| \`createTree({baseTreeSha,files})\` | \`POST repos/cedricmenec/threadstep/git/trees\` | \`{sha}\` |
| \`createCommit({treeSha,parents,message})\` | \`POST repos/cedricmenec/threadstep/git/commits\` | \`{sha}\` |
| \`updateRef({ref,sha,force:false})\` | \`PATCH repos/cedricmenec/threadstep/git/refs/heads/asf/waves/<waveId>\` | \`{sha}\` |

Le \`transport({method,path,body})\` est injecté depuis un composant extérieur soumis à revue. Un agent OpenCode ne doit pouvoir ni choisir ce transport ni lui injecter un token. Aucune fonction de ce module ne possède \`fetch\`, \`execFile\`, accès aux secrets ou identifiants GitHub : seul l'appel au transport externe détermine si une requête est réellement envoyée.

### Restrictions d'entrées

- Le dépôt est une constante : \`cedricmenec/threadstep\`.
- \`waveId\` doit être un identifiant alphanumérique minuscule / tiret / point / underscore borné, **sans slash ni encodage d'URL**.
- La branche opérationnelle est formée par le code : \`refs/heads/asf/waves/<waveId>\`. Impossible d'utiliser \`refs/heads/main\`, \`test/\`, ou un autre dépôt.
- \`createTree\` n'accepte **qu'une** entrée \`journal.json\` en mode \`100644\`, type \`blob\`. \`base_tree\` est le tree du commit parent, pour conserver les autres documents immuables de la branche.
- Le journal est une chaîne JSON UTF-8 avec \`schemaVersion=2\`, le \`waveId\` attendu, une révision strictement positive, une limite de 512 Kio et aucun secret reconnaissable par la policy existante. **Cette validation n'est PAS un replay du journal** : #70/#73 doivent valider le manifeste et tous les événements avant d'appeler ce port.
- \`createCommit\` n'accepte qu'un seul parent 40 hex et une forme de message réservée aux checkpoints ASF V3.
- \`updateRef\` exige explicitement \`force === false\` ; jamais de repli en mode forcé.
- Toute réponse GitHub doit présenter l'identité du ref, du SHA, du parent ou de l'arbre conforme à la requête. Une réponse incohérente devient une erreur, jamais un succès.
- Les erreurs de transport sont normalisées sans message brut ni secrets ; aucune tentative automatique de retry.

## Atomicité du ref, mais pas des API réseau

La séquence \`#70 commitV3JournalCAS\` puis ce port doit être :

\`\`\`text
Ref R -> commit H / tree T
         │
         ├── Client A: tree TA, commit CA(parent H) ──── PATCH R=CA, force:false -> succès
         └── Client B: tree TB, commit CB(parent H) ──── PATCH R=CB, force:false -> refus FF
\`\`\`

La garantie Github REST de \`force:false\` est de ne pas écraser une branche avec une mise à jour qui **n'est pas fast-forward**. L'API REST native ne documente **pas** un contrôle d'égalité atomique \`expected_sha\` pour le PATCH. Le protocole crée donc systématiquement le prochain commit avec exactement l'ancien HEAD comme parent. Lorsque deux auteurs travaillent depuis H, les commits frères CA et CB ne peuvent pas tous deux devenir le successeur par fast-forward. GitHub peut émettre 409 ou 422 ; 422 peut aussi correspondre à d'autres erreurs de validation. Toute erreur incertaine doit faire échouer la tentative et déclencher une consultation hors paiement.

Un POST \`createTree\` ou \`createCommit\` peut réussir même si la réponse est perdue : ces objets détachés ne prouvent aucune mise à jour du ref. La réponse PATCH perdue est **encore plus critique** : le commit peut être visible sur le ref. Le port et le contrôleur n'émettent **jamais** un deuxième PATCH automatiquement. La lecture de réconciliation et la décision humaine relèvent du contrôleur de supervision.

### Permissions et frontière réelle

L'API GitHub Git Data est **une API d'écriture de dépôt**. Les opérations de création de tree, commit et update-ref nécessitent typiquement une permission GitHub App \`Contents: write\`, qui n'est **pas accordée ici**. Ce port n'est pas une élévation de privilège ; son éventuelle utilisation dans un job de contrôleur nécessitera une revue indépendante du scope et des identifiants.

L'interdiction de modifier le manifeste dans \`createTree\` suppose que l'historique de la branche ait été initialisé par un acteur sûr et que le token de publication soit limité à un workflow rigoureusement défini. Ce port ne prouve pas que le manifeste originel est autorisé, ni que des acteurs extérieurs ne peuvent réécrire la branche, ni qu'il existe un verrou global entre deux vagues.

## Validations automatisées (sans réseau)

\`tests/asf-v3-git-data-port.test.mjs\` contrôle :
- l'égalité exacte des chemins REST, méthodes et corps JSON ;
- la normalisation des objets \`tree\`, \`parents\`, ref et commit renvoyés ;
- la lecture de l'ancien HEAD, le POST de tree basé sur \`base_tree\`, le POST de commit à un parent ;
- le PATCH du seul ref opérationnel avec \`force:false\` ;
- la course de deux commits frères et l'impossibilité simulée de deux fast-forwards ;
- le refus des chemins, schémas, contenus secrets ou trop volumineux ;
- les réponses GitHub incohérentes et les transports indisponibles ;
- l'absence de retry même après perte de la réponse du PATCH.

Dans la PR #73, un essai GitHub **réel mais non payant** sur la branche sandbox \`test/asf-v3-005-cas-38976058955\` a observé une première mise à jour acceptée et une seconde écriture périmée refusée. **Cet essai n'avait pas utilisé le port présent**, ni un token App de production, et n'était pas un test de concurrence simultanée. Il ne doit pas être confondu avec une qualification E2E de #70 + #73 + ce port.

## Plan de qualification ultérieure

1. Faire revoir #66, #69, #70, #71, #73, puis ce port #74 indépendamment. Rebaser les branches de consolidation pour éviter l'écrasement des sources communes.
2. Exécuter un E2E Git REST GitHub **non payant**, avec ce véritable port, sur un ref de test spécialement autorisé et des droits d'écriture GitHub App clairement approuvés. Le port actuel reste volontairement verrouillé sur les refs opérationnels \`asf/waves/*\` : cet E2E nécessitera un adaptateur de sandbox distinct et strict, **pas** de contournement du garde-fou dans le port actuel.
3. Vérifier de manière indépendante l'origine du manifeste, les scopes App, l'interdiction des workflows non autorisés, l'unicité du claim et les contrôles des runners.
4. Ne considérer des modifications Actions ou un pilote modèle payant qu'après une autorisation supplémentaire du propriétaire.

**Références GitHub documentées :** [Git refs](https://docs.github.com/en/rest/git/refs), [Git trees](https://docs.github.com/en/rest/git/trees), [Git commits](https://docs.github.com/en/rest/git/commits).
