# Socle UI ThreadStep — tokens sémantiques et primitives React (TS-061)

Ce document décrit le socle partagé introduit par TS-061 pour le détail projet
React. Il ne s'agit **pas** d'une migration générale : Overview, Paramètres,
Imports / Exports, Synchronisation et la navigation restent rendus par le
vanilla existant. Les valeurs graphiques existantes sont conservées.

## Tokens sémantiques

Source unique : `site/styles/tokens.css`, importé en tête de `site/styles.css`
par `@import "./styles/tokens.css";`. Vite embarque ces variables dans le CSS
local sous `/threadstep/` ; aucune police, icône, feuille ou bibliothèque
distante n'est requise. Les tokens sont consommables par le CSS vanilla sans
monter React.

| Catégorie | Tokens principaux | Usage |
| --- | --- | --- |
| Couleur | `--color-page-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-text-secondary`, `--color-border`, `--color-action`, `--color-focus`, `--color-error*` | Fond, surfaces, textes, bordures, actions, focus et erreurs |
| Typographie | `--font-family-base`, `--font-size-control`, `--font-size-compact`, `--font-size-small`, `--font-weight-bold`, `--font-weight-heavy`, `--line-height-control`, `--letter-spacing-tight` | Famille et échelle existantes des contrôles partagés |
| Espacement | `--space-1` à `--space-6`, `--space-page-inline`, `--space-detail-inline`, `--space-control-block`, `--space-control-inline` | Marges et paddings partagés du détail |
| Rayons | `--radius-badge`, `--radius-input`, `--radius-control`, `--radius-panel`, `--radius-surface`, `--radius-pill` | Rayons existants de 6 à 16 px et pilule |
| Focus | `--focus-outline-width`, `--focus-outline-offset`, `--focus-outline` | Contour visible commun aux contrôles |
| Erreur | `--color-error`, `--color-error-surface`, `--color-error-border` | Messages et surfaces d'erreur |
| État désactivé | `--disabled-opacity`, `--disabled-opacity-soft` | Opacité des commandes inactives |
| Responsive | `--content-max-width`, `--detail-max-width`, `--control-target-min`, constante documentée `--breakpoint-compact: 620px` | Largeurs maximales, cible tactile et point de rupture |

Le point de rupture compact `620px` reste écrit littéralement dans les
`@media(max-width:620px)` : une custom property ne peut pas être consommée de
façon fiable dans une condition de média query. La constante est documentée
dans `tokens.css` et vérifiée par test.

### Valeurs mappées

Les valeurs tokenisées reprennent celles de la feuille livrée avant TS-061 :
`#f6f5f1` (fond), `#24382f` (texte), `#a9ba69` (focus), `#d4dbcf` (bordure),
`#263d31` / `#395b47` (action), `10px`, `9px` et `44px`. Aucune nouvelle
palette, police ou échelle typographique n'est introduite. Les panneaux Cloud,
restauration et diagnostic non concernés conservent leurs valeurs littérales.

## Audit de contraste

Ratios calculés par `tests/ts-061-design-tokens.test.mjs` à partir des tokens
versionnés. La cible texte est 4,5:1 et la cible non textuelle 3:1.

| Paire | Usage | Ratio mesuré | Cible | Statut |
| --- | --- | --- | --- | --- |
| body-text | Texte principal sur fond de page | 11.45:1 | 4,5:1 | Atteinte |
| control-text | Champs et commandes sur surface | 7.83:1 | 4,5:1 | Atteinte |
| secondary-text | Notes et descriptions | 5.00:1 | 4,5:1 | Atteinte |
| action-text | Libellé du bouton primaire | 11.70:1 | 4,5:1 | Atteinte |
| priority-normal | Badge de priorité normal | 5.21:1 | 4,5:1 | Atteinte |
| muted-text | Texte secondaire et compteurs | 3.31:1 | 4,5:1 | Exception préexistante |
| focus | Contour de focus visible | 2.12:1 | 3:1 | Exception préexistante |
| priority-urgent | Badge de priorité urgent | 4.47:1 | 4,5:1 | Exception préexistante |
| priority-later | Badge de priorité plus tard | 3.45:1 | 4,5:1 | Exception préexistante |

### Exceptions préexistantes

Ces exceptions ne sont **pas** introduites par TS-061 et ne sont pas déclarées
conformes :

- focus `#a9ba69` sur blanc : sous la cible non textuelle de 3:1 ;
- texte secondaire `#859087` sur blanc : sous la cible texte de 4,5:1 ;
- badges de priorité `urgent` et `later` : sous la cible texte de 4,5:1.

Les libellés de priorité sont centralisés par `site/ui/priority-options.js`, qui
réutilise `PRIORITIES` de `site/core.js`.

Toute correction de palette est un changement visuel sensible qui exige une
décision produit et une tâche distincte.

## Primitives React

Tokens consommés par les primitives : `--focus-outline`, `--disabled-opacity`,
`--control-target-min`, `--radius-control`, `--radius-input`,
`--color-border`, `--color-surface`, `--color-text` et les paires de priorité.

Les primitives vivent dans `site/ui/` et ne contiennent ni règle métier, ni
accès Dexie/IndexedDB/OTP, ni `persist()`, ni routeur, ni second store. Elles
rendent un seul élément HTML, transmettent les attributs fournis et n'ajoutent
aucun wrapper.

### `Button` — `site/ui/Button.jsx`

| Prop | Valeurs | Description |
| --- | --- | --- |
| `variant` | `primary`, `secondary`, `subtle`, `danger` | Classe visuelle existante ; valeur inconnue refusée |
| `type` | type HTML | Transmis tel quel, `button` par défaut |
| `className` | chaîne | Classe supplémentaire conservée après la variante |
| `children` | nœud | Libellé fourni par l'appelant |
| `onClick` | fonction | Callback relayé une seule fois |
| `disabled` | booléen | Attribut natif ; aucun callback invoqué |
| autres | attributs HTML/ARIA | Transmis à l'unique `<button>` |

États : focus visible via `--focus-outline`, désactivé via l'attribut `disabled`
et `--disabled-opacity` (pas uniquement par la couleur). Le nom accessible et
le libellé restent fournis par l'appelant.

### `PriorityControl` — `site/ui/PriorityControl.jsx`

| Prop | Valeurs | Description |
| --- | --- | --- |
| `value` | `urgent`, `normal`, `later` | Valeur contrôlée ; valeur inconnue refusée |
| `onChange` | fonction | Reçoit une seule fois la priorité choisie |
| `variant` | `badge`, `field` | Badge interactif ou champ de formulaire |
| `className` | chaîne | Classe existante du contexte |
| `ariaLabel` | chaîne | Nom accessible complet fourni par l'appelant |
| `disabled` | booléen | Attribut natif |

La variante `badge` produit `priority priority-<valeur> priority-control`. La
variante `field` ne rend que la classe fournie. Les options sont exactement
`Urgent`, `Normal`, `Plus tard` dans l'ordre `urgent`, `normal`, `later`. Le
contrôle n'émet aucune intention de drag, complétion ou édition.

### `TextField` — `site/ui/TextField.jsx`

| Prop | Valeurs | Description |
| --- | --- | --- |
| `as` | `input`, `textarea` | Élément unique rendu |
| `type` | type HTML | Pour `input` |
| `value` / `onChange` | contrôlés | Le parent reste propriétaire du brouillon |
| `ariaLabel` | chaîne | Nom accessible fourni |
| `required`, `maxLength`, `placeholder`, `rows`, `disabled` | attributs natifs | Transmis sans modification |
| `ariaInvalid` | booléen | Expose `aria-invalid="true"` |
| `errorId` | chaîne | Relie `aria-describedby` au message existant |

Le champ n'exécute aucune validation ni sauvegarde. Les messages d'erreur
restent rendus comme nœuds texte par le parent ; aucun élément exécutable n'est
créé.

## Adoption dans le détail projet

- `Button` remplace les boutons de retour, renommage, création, sauvegarde,
  annulation, déclencheur de menu, commandes de menu et bascule de sous-étapes.
- `PriorityControl` sert dans le formulaire de création (variante champ), la
  ligne de tâche (variante badge) et l'éditeur inline (variante champ).
- `TextField` sert pour le renommage, la création, le titre et la note de
  l'éditeur.

Les classes, libellés français, noms accessibles, attributs ARIA, ordre de
lecture, ordres de menu et priorités restent identiques. Les gestionnaires
restent ceux des commandes du contrôleur ; aucune primitive ne duplique une
écriture ni ne conserve d'état métier. Overview et les autres routes ne sont
pas migrés.

## Accessibilité

Objectifs : contraste texte 4,5:1, focus et éléments non textuels 3:1, cibles
tactiles visées à 44 px (`--control-target-min`) et navigation clavier. Les
contrôles interactifs existants conservent leurs `min-width`/`min-height` de
44 px. Les exceptions mesurées ci-dessus restent visibles et ne sont pas
présentées comme conformes.

## Responsive

Les règles partagées utilisent `min-width:0`, `max-width:100%` et le retour à
la ligne (`flex-wrap`) pour éviter un débordement introduit par les primitives.
Aucune primitive n'impose de largeur fixe supérieure à 320 px. Les largeurs à
vérifier en navigateur réel sont **320, 390, 430, 768 et 1280 px**.

## Intégration progressive des maquettes validées

1. Rapprocher la maquette des spécifications canoniques et du présent socle.
2. Choisir les tokens et primitives existants ; ne créer un composant que pour
   une duplication réellement observée.
3. Adapter une seul surface à la fois, avec parité de classes, libellés, ordre
   de lecture et comportements.
4. Ajouter des tests déterministes et une recette humaine dédiée.
5. Ne jamais convertir automatiquement Overview, la navigation, les paramètres
   ou les formulaires Cloud après livraison de ce socle.

## Vérifications automatisées et recette humaine

Les tests déterministes (`tests/ts-061-*.test.mjs` et les tests TS-059)
couvrent le rendu, les variantes, les états, les interactions, la parité DOM,
les tokens, le contraste calculé et les garde-fous structurels. Ils ne
prouvent **pas** un rendu navigateur réel, le clavier physique, le tactile,
Chrome Android, un lecteur d'écran ni le contraste perçu. Ces vérifications
restent une recette humaine obligatoire, à consigner séparément comme
`PASS`, `FAIL` ou `NOT_RUN`.

## Mesures de build

Mesures lues dans `dist/assets` avant et après l'adoption du socle. Les valeurs
sont des entiers d'octets.

| Mesure | Avant | Après | Écart |
| --- | ---: | ---: | ---: |
| Total `dist/assets` | 936490 | 941074 | +4584 |
| Chunk applicatif `app-*.js` | 558206 | 559568 | +1362 |
| CSS | 36285 | 39507 | +3222 |

L'écart provient des primitives locales (`site/ui/`) et des tokens embarqués
dans le CSS. Aucune dépendance, police, icône ou ressource distante n'est
ajoutée.

## Bilan de parité

Comparaison des instantanés DOM avant/après sur les états par défaut,
renommage et édition/menu du détail : 0 écart de classes, libellés, noms
accessibles, ordres, formulaires, sélecteurs de priorité et commandes de menu
sur 63 contrôles observés. Les instantanés de référence de l'exécution sont
conservés dans `/tmp/ts-061-dom-baseline.json` et `/tmp/ts-061-dom-after.json`.

- Tests déterministes exécutés : 1179 tests, 0 échec (`npm run check`).
- Build : 941074 octets au total, chunk applicatif 559568 octets, CSS 39507
  octets ; deux builds identiques vérifiés par `npm run verify:build`.
- CSS compilé : tokens présents, CSP inchangée, chemins sous `/threadstep/`,
  aucune ressource distante ajoutée.

La parité DOM automatisée ne remplace pas la comparaison visuelle réelle
demandée dans la recette humaine.

## Retour arrière

Retirer les imports de `Button`, `PriorityControl` et `TextField` des
composants du détail et revenir aux contrôles inline précédents, puis retirer
l'import des tokens et `site/styles/tokens.css` s'il n'est plus consommé.
Aucune migration de données, aucun changement d'identité, de base, de route,
de préférence, de clé de stockage ou de configuration Cloud n'est nécessaire.
Le rendu vanilla reste la référence.
