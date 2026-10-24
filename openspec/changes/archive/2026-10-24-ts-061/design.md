# Design

## Context

Voir `proposal.md` — Why. Le détail projet React est la seule surface métier
React livrée ; il consomme `site/react-adapter.js`, `site/project-detail/` et
les commandes existantes. Overview, Paramètres, Imports / Exports,
Synchronisation et la navigation restent vanilla. `site/styles.css` est une
feuille unique contenant déjà les classes, les couleurs et les états utilisés
par les deux rendus.

Les composants du détail dupliquent aujourd'hui trois familles de contrôles :
boutons avec classes `primary` / `secondary` / `subtle`, sélecteurs de priorité
avec les mêmes libellés et options, et champs texte avec des noms accessibles
répétés. Les valeurs visuelles correspondantes sont écrites en dur dans la
feuille CSS.

La porte TS-060 est actuellement fermée : le rapport
`docs/product/react-project-detail-qualification.md` conclut à un NO-GO borné
tant que la recette physique n'a pas produit de preuves `PASS` et qu'une
décision humaine favorable n'a pas été consignée. La fiche TS-061 interdit
alors de modifier la surface React livrée.

## Goals / Non-Goals

**Goals :**

- Centraliser un vocabulaire de tokens sémantiques versionné et consommable par
  React comme par le CSS vanilla, à valeurs graphiques identiques.
- Réduire les duplications réelles du détail avec trois primitives de
  présentation : bouton, contrôle de priorité et champ texte.
- Préserver les éléments HTML, classes, libellés, noms accessibles, ordres,
  focus, scroll, brouillons et commandes du détail.
- Rendre mesurables et documentés les objectifs de contraste, de focus, de
  cible tactile et de stabilité responsive, y compris les exceptions
  préexistantes.
- Prouver le contrat par des tests déterministes et laisser les dimensions
  réelles à la recette humaine.

**Non-Goals :**

- Remplacer `site/styles.css` par un framework, Tailwind, un kit Stitch ou une
  bibliothèque de composants externe.
- Refondre la mise en page, changer les couleurs ou les polices, migrer
  Overview ou les pages de paramètres.
- Déplacer une règle métier, une validation, une écriture, une route ou un état
  persistant dans les primitives.
- Modifier `site/react-adapter.js`, `site/react-boundary.js`, les commandes du
  contrôleur, `site/core.js`, Dexie, l'OTP, la CSP ou les workflows.
- Considérer un test jsdom comme une preuve de rendu navigateur, de toucher, de
  clavier physique ou de lecteur d'écran.

## Decisions

### 1. Fermer la porte avant toute modification de la surface React

Le premier travail d'`apply` est une vérification déterministe du rapport
TS-060. Tant que le rapport ne porte pas un GO favorable et daté, aucun fichier
sous `site/` n'est modifié. Ce choix applique directement la contrainte de la
fiche TS-061 et évite de construire un socle sur un pilote non qualifié.

*Alternative écartée :* ignorer le NO-GO parce que les tests déterministes
TS-060 sont verts. Une CI verte ne remplace ni la recette physique ni la
décision humaine.

### 2. Fichier de tokens séparé, importé en tête du CSS existant

Créer `site/styles/tokens.css` comme source unique des variables sémantiques.
`site/styles.css` commence par un `@import` local vers ce fichier, ce qui
fonctionne dans la source statique et dans le build Vite. Les règles existantes
restent dans `site/styles.css` après l'import, donc leur ordre de cascade est
conservé.

Le fichier contient au minimum :

- **couleur** : fond, surface, texte, texte atténué, bordure, action, focus,
  erreur et surface d'erreur, ainsi que les paires des trois priorités ;
- **typographie** : famille existante, tailles, graisses, interlignes et
  interlettrages utilisés par les contrôles partagés ;
- **espacement** : échelle bornée et espacements de page/détail ;
- **rayons** : valeurs existantes de 6 à 16 px et rayon pilule ;
- **focus** : largeur, décalage et couleur du contour ;
- **erreur** : texte, surface et bordure ;
- **désactivé** : opacité et couleur de texte des commandes inactives ;
- **responsive** : largeur maximale de contenu, marges de page compacte et
  constante de point de rupture documentée.

Les noms sont sémantiques (`--color-text-muted`, `--color-focus`,
`--space-page-inline`, `--radius-control`, `--control-target-min`) et non des
noms de composants ou de marques.

*Alternative écartée :* laisser les valeurs dans `site/styles.css` sans fichier
dédié. Cela aurait gardé une source implicite difficile à auditer et n'aurait
pas créé de contrat partageable avec le vanilla.

### 3. Remplacement borné et à valeur identique

La tokenisation ne vise pas une réécriture intégrale de la feuille. Elle couvre
les déclarations partagées par les primitives et les états transverses :
typographie de base, boutons, priorité, champs, focus visible, erreurs,
désactivation, espacements du détail et média queries compactes. Les panneaux
Cloud, restauration et diagnostic non concernés conservent leurs valeurs
littérales dans ce lot.

Chaque remplacement reprend exactement la valeur existante (`#f6f5f1`,
`#24382f`, `#a9ba69`, `44px`, `620px`, etc.). Un test compare les valeurs
tokenisées documentées aux valeurs de référence et vérifie que toute variable
référencée est définie.

Les media queries ne peuvent pas consommer une valeur de custom property de
façon fiable : le point de rupture `620px` reste donc écrit littéralement dans
les `@media`, avec la constante documentée dans le fichier de tokens et
vérifiée par test. Les tokens responsive portent les dimensions de mise en page
et d'espacement, pas la condition de média query elle-même.

*Alternative écartée :* convertir toute la feuille d'un coup. Le risque de
dérive graphique et de régression sur des panneaux hors périmètre serait trop
élevé pour un lot de socle.

### 4. Trois primitives fines sous `site/ui/`

Les primitives retenues correspondent à des duplications observées :

- `site/ui/Button.jsx` : rend un unique `<button>`, applique la classe de
  variante (`primary`, `secondary`, `subtle`, `danger`), conserve la classe
  fournie, transmet `type`, `disabled`, les attributs ARIA et le callback ;
- `site/ui/PriorityControl.jsx` : rend un unique `<select>` avec les options
  `urgent`, `normal`, `later`, les libellés existants et la valeur contrôlée.
  La variante `badge` ajoute `priority priority-<valeur> priority-control` ;
  la variante `field` ne rend que la classe fournie ;
- `site/ui/TextField.jsx` : rend un `input` ou un `textarea` avec `aria-label`
  fourni, `required`, `maxLength`, `disabled`, `value` et, si l'appelant le
  demande, `aria-invalid` et `aria-describedby` vers le message d'erreur
  existant.

Un module `site/ui/priority-options.js` importe `PRIORITIES` de `site/core.js`
et centralise les libellés `Urgent` / `Normal` / `Plus tard`. Il ne duplique
aucune règle de mutation ni de validation.

Les primitives n'ajoutent pas de wrapper, ne changent pas la structure DOM et ne
calculent aucune règle métier. Le parent reste responsable du libellé complet du
nom accessible, de l'état contrôlé, de l'erreur et de l'intention métier.

*Alternative écartée :* un composant `FormField` avec label et message intégrés
aurait changé l'ordre et la structure DOM existants du renommage, de la création
et de l'éditeur. Un champ mince conserve la parité.

### 5. Répartition exacte de la réutilisation dans le détail

- `Button` remplace les boutons de retour, renommage, création, sauvegarde,
  annulation, déclencheur de menu et commandes de menu, en conservant leurs
  classes et attributs actuels.
- `PriorityControl` remplace le sélecteur du formulaire de création (variante
  champ), le badge interactif de la ligne de tâche (variante badge) et le
  sélecteur de l'éditeur inline (variante champ).
- `TextField` remplace les champs de renommage, de création, de titre et de note
  de l'éditeur, en conservant `aria-label`, `maxLength`, `required`,
  `placeholder`, `rows`, classes et ordre.

Ainsi les trois primitives ont des consommateurs réels et au moins deux sont
effectivement rendues dans la surface du détail. Aucun autre composant n'est
extrait sans duplication démontrée.

*Alternative écartée :* créer aussi un routeur, un provider de thème ou un
contexte de design system. Aucun consommateur ne le justifie et cela
introduirait une seconde architecture.

### 6. Parité DOM et continuité des états

Les tests de rendu comparent les classes, libellés, noms accessibles, attributs
ARIA, ordres de menu et ordres de priorité avant/après adoption. Les
gestionnaires restent ceux des commandes du contrôleur ; une primitive ne fait
que relayer la valeur ou l'événement.

La continuité reste portée par l'architecture existante : brouillons locaux
identifiés par l'ID stable, état transitoire du contrôleur, `flushSync`, clés
stables et helpers de focus/scroll de `site/app.js`. Les primitives étant des
rendus sans état propre hors champ contrôlé, elles ne réinitialisent ni les
parents développés, ni le menu, ni le brouillon, ni le scroll. Les exceptions de
navigation, rechargement, import et identité restent celles de
`ux-interaction-continuity`.

*Alternative écartée :* déplacer l'état contrôlé dans les primitives. Cela
aurait créé une seconde source de vérité et compliqué la préservation des
brouillons.

### 7. Accessibilité mesurée, aucune correction silencieuse de palette

Le design conserve les couleurs existantes. Un test calcule les ratios de
contraste des paires documentées et un registre liste les exceptions :

- focus `#a9ba69` sur blanc, sous la cible non textuelle de 3:1 ;
- texte secondaire `#859087` sur blanc, sous la cible texte de 4,5:1 ;
- badges de priorité dont certaines paires, notamment `later`, restent sous la
  cible texte.

Ces valeurs sont préexistantes, ne sont pas introduites par TS-061 et ne sont
pas déclarées conformes. Toute correction de palette serait un changement
visuel sensible nécessitant une décision produit et une tâche distincte.

Les primitives exposent le focus via le token commun, le désactivé via
l'attribut natif et l'opacité tokenisée, et les cibles de 44 px via les classes
de contexte existantes (`detail-return`, `task-menu-command`, etc.). Les tests
vérifient la présence des tokens et attributs ; la perception réelle, le zoom et
les mesures sur appareil restent manuels.

*Alternative écartée :* changer le focus en vert plus sombre pour atteindre
3:1. Cela améliorerait l'accessibilité mais modifierait l'interface sans
décision spécifique, contrairement à la contrainte de parité du lot.

### 8. Tests déterministes et build

- `tests/ts-061-design-tokens.test.mjs` : présence et unicité des catégories,
  valeurs mappées, résolution des variables, absence de ressource distante,
  stabilité de la constante responsive et audit de contraste avec registre
  d'exceptions.
- `tests/ts-061-ui-primitives.test.mjs` : rendu des trois primitives avec
  jsdom/esbuild, variantes, classes, options, `aria-*`, états désactivé et
  invalide, callbacks uniques, absence d'import métier et de wrapper.
- `tests/ts-061-project-detail-parity.test.mjs` : détail rendu avec les
  primitives, comparaison des classes, libellés, noms accessibles, ordres et
  interactions avec les assertions TS-059 ; usage réel d'au moins deux
  primitives.
- `tests/ts-061-ui-docs.test.mjs` : documentation des tokens, primitives,
  états, accessibilité, exceptions, intégration progressive et retour arrière.
- Les tests TS-059 existants restent la référence de non-régression. Le build
  est vérifié par `npm run build` et `npm run verify:build`, qui contrôlent déjà
  la CSP, les chemins `/threadstep/`, l'absence de CDN et la reproductibilité.

*Alternative écartée :* un test de capture visuelle par navigateur headless.
Il ajouterait une dépendance lourde et ne prouverait pas le rendu réel sur
appareil ; les tests structurels et la recette manuelle couvrent mieux ce lot.

### 9. Documentation et intégration progressive

Créer `docs/product/ui-foundation.md` avec les tokens, leurs valeurs, les
primitives, les variantes, les états, les règles d'accessibilité, les exceptions
mesurées, les largeurs à vérifier et la procédure d'adoption d'une maquette
validée. Completer `docs/product/developer-guide.md` et `docs/architecture.md`
avec les chemins, le point d'import CSS et le retour arrière.

La règle d'intégration est explicite : une maquette validée ne s'applique
qu'après rapprochement avec les specs canoniques, composant par composant, sans
conversion automatique d'une route. Overview et les paramètres ne sont pas
migrés par ce changement.

## Risks / Trade-offs

- **Dérive graphique lors du remplacement des valeurs** → mapping valeur pour
  valeur, test de résolution des variables, comparaison structurelle et recette
  visuelle avant/après.
- **Primitive qui altère le DOM ou les noms accessibles** → rendu d'un seul
  élément, classes et attributs transmis, tests de parité avec TS-059 et ordre
  de lecture.
- **Contraste insuffisant présenté comme conforme** → audit calculé, registre
  d'exceptions explicite, aucune correction de palette silencieuse.
- **Responsive non prouvé par jsdom** → garde-fous structurels déterministes,
  puis vérification réelle à 320, 390, 430, 768 et 1280 px dans la recette
  manuelle.
- **Poids du build en hausse** → primitives locales sans dépendance, mesure
  avant/après dans le bilan et comparaison avec TS-059/TS-060.
- **Travail entrepris alors que TS-060 est NO-GO** → arrêt explicite au premier
  contrôle, avant toute modification sous `site/`.

## Migration Plan

1. Vérifier le rapport TS-060 ; si la décision n'est pas GO, s'arrêter sans
   modifier le produit et rapporter le blocage.
2. Capturer les tailles de build, le CSS et les classes/libellés de référence
   du détail dans des fichiers temporaires non versionnés.
3. Ajouter `site/styles/tokens.css`, l'importer dans `site/styles.css` et
   tokeniser les déclarations partagées à valeur identique.
4. Ajouter les trois primitives et le module de libellés, puis les adopter dans
   le détail sans changer la structure DOM.
5. Ajouter les tests de tokens, primitives, parité et documentation ; exécuter
   les tests TS-059 existants.
6. Documenter les conventions, les exceptions et les mesures avant/après.
7. Exécuter `npm run check`, `npm run build`, `npm run verify:build`,
   `openspec validate ts-061 --strict --no-interactive` et le contrôle de phases
   des tâches.

**Retour arrière :** retirer les imports des primitives et revenir aux boutons,
sélecteurs et champs inline précédents, puis retirer l'import des tokens et le
fichier s'il n'est plus consommé. Aucune migration de données, aucun changement
d'identité, de base, de route ou de configuration n'est nécessaire.

## Open Questions

Aucune question bloquante pour l'implémentation. L'étendue exacte des
déclarations CSS non partagées qui pourraient être tokenisées ensuite peut être
élargie sans changer les specs, à condition de rester à valeur identique ; elle
ne conditionne ni les primitives ni les tests de ce lot.
