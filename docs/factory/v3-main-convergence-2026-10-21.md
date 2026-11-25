# ASF V3 C3 : branche de convergence GitHub-native / main

**État : qualification isolée, aucune fusion ni activation.** Date : 21 octobre 2026.

## Provenance et stratégie

- Source `main` : `10ab810a6af520041774d52980f568f2522d40a6`.
- Source V3 complète : [PR #168](https://github.com/cedricmenec/threadstep/pull/168),
  SHA `6dfb1bae360a60f92a7ffd7a46ffabea6ff8f305`, elle-même issue
  des 18 PR canoniques de #87 à #168.
- Ancêtre de comparaison : `0d1b9c1fc41ebcf9ab8b87d1b4c9407263676965`.
- Convergence par commit Git avec **deux parents exacts**, d'abord `main`,
  ensuite la source V3. L'arbre réconcilié est
  `a9b3441c556d20297a1dade1b30e0b948b6c0c20`.
- Audit 3 voies de toutes les entrées (sans troncature) : **107 fichiers V3
  propres**, **398 fichiers relevant de main**, aucun conflit de chemin ou
  contenu, **668 fichiers feuilles** dans l'arbre assemblé.
  Les fichiers partagés ont conservé la version main lorsqu'elle est la seule
  modifiée. Les 107 nouvelles entrées V3 sont reliées aux blobs exacts du SHA
  source. Chaque entrée de l'arbre assemblé a été vérifiée contre la règle
  déterministe de fusion avant la mise à jour de la branche.

## Contrat de sécurité

La branche de convergence est un **brouillon non privilégié**, et n'est pas
une autorisation de mise en service. Ne pas fusionner la chaîne de PR V3 et
la branche de convergence en parallèle : choisir une seule stratégie
d'intégration finale pour éviter les double-apports et conserver un seul CAS
enfant #111/#113/#168. Les ports alternatifs #116/#117 ne sont pas importés.

Les workflows V3 conservés dans cette branche possèdent des barrières
d'exécution inertes. Le contrôle de concurrence payant reste au niveau des
jobs sous `threadstep-paid-development-v1` et aucun retry payant n'est
autorisé. Les permissions réelles des deux Apps, les protections wave et le
bootstrap du registre global restent à approuver séparément.

Aucun secret, règle de branche, ref protégé ou workflow de production n'a été
modifié. Aucun appel OpenRouter n'a été exécuté.

## Conditions de sortie C3

- [x] Inventaire et réconciliation à trois voies de tous les fichiers.
- [x] Un merge commit non privilégié avec historique V3 et main exacts.
- [x] Préservation des nouveautés main et de tous les blobs V3 par contrôle
      des arbres.
- [ ] Exécuter et vérifier `npm run check`, actionlint et OpenSpec dans la
      CI GitHub sur le SHA exact de la PR de convergence.
- [ ] Corriger les régressions intégrées sans affaiblir les refus de sécurité.
- [ ] Réconcilier les décisions de disposition des anciennes PR, sans fusion.
- [ ] Mettre à jour le suivi Notion et l'issue #86 avec les preuves.

**Hors C3 :** création des règles `asf/waves/*`, permissions Apps,
activation secrets, création du registre global, dispatch payant, pilotes
et fusion sensible. Voir la [fiche ASF-V3-032](tasks/ASF-V3-032.md).
