# ThreadStep — recette fonctionnelle manuelle

**État au 16 octobre 2026 : recette manuelle déclarée OK par le propriétaire.** Attestation globale ; les scénarios individuels ci-dessous restent non cochés en l'absence de relevé détaillé et ne sont pas présentés comme vérifiés indépendamment. Voir [rapport de clôture ASF](../factory/closeout-2026-10-16.md).

Version de la checklist : Version testée à noter : `main` et commit `97d326c5b262622f8146348f385eb1e0d838829c` (16 octobre 2026), ou un SHA plus récent vérifié.

## Préparation sans perte de données

Avant de tester, **exporter le JSON réel**. Utiliser de préférence un navigateur/profil de test. Dans le produit, créer deux sujets A et B, plusieurs actions de même priorité, une action parente P avec trois sous-tâches (dont une terminée) et un autre parent Q. Ne pas vider le stockage de son profil habituel : l'import demande confirmation et remplace le document courant.

## Tests utilisateur à consigner

Cocher les cases **uniquement après observation réelle** ; noter navigateur, appareil, date, SHA et anomalie éventuelle dans le rapport ASF.

- [ ] Créer, renommer, terminer et supprimer des sujets/actions ; changer les priorités ; vérifier Urgent → Normal → Plus tard.
- [ ] Ajouter/modifier une sous-tâche et confirmer qu'elle reste sous son parent après rechargement.
- [ ] Réordonner deux actions principales de même priorité avec les boutons puis glisser-déposer ; refuser les déplacements inter-priorités ou entre sujets.
- [ ] Avec trois enfants dont un terminé, masquer puis démasquer les étapes terminées ; les compteurs et résultats filtrés sont cohérents.
- [ ] **TS-012/013 :** lorsque P est déplié, voir « Masquer les sous-tâches » ; cliquer et obtenir « Voir 3 sous-tâches » quand replié ; cliquer pour réafficher exactement les trois. Avec le filtre, le bouton replié doit indiquer « Voir 2 sous-tâches ». Vérifier le singulier, l'absence du bouton à zéro enfant visible et l'indépendance entre P et Q.
- [ ] Le clic de repli ne modifie ni l'ordre, ni les états, ni le JSON exporté. Un rechargement réaffiche les enfants (état de repli éphémère).
- [ ] **TS-014 :** réordonner au doigt puis via « Monter/Descendre » deux enfants de même parent et priorité ; refuser le drop sur un autre parent/priorité ; contrôler l'absence de changement lors d'un drop invalide.
- [ ] Vérifier que l'ordre valide des enfants reste après rechargement et un export/import JSON, alors que le repli ne persiste pas. Vérifier que les IDs/états/parents restent identiques.
- [ ] Activer « Masquer les étapes terminées » : poignées de déplacement absentes, boutons de déplacement désactivés, aucun contrôle enfant visible sous un parent replié.
- [ ] Retirer une sous-tâche ; activer « Annuler » avant 10 secondes et vérifier son rétablissement ; vérifier ensuite qu'un retrait expiré ne peut plus être annulé.
- [ ] Consulter « Une étape pour maintenant » et son explication ; utiliser « Garder le fil », « Je reprends ici », « Voir dans la liste » et « Ne plus suivre ». Vérifier stabilité malgré déplacements/renommage et invalidation lors du retrait de la cible.
- [ ] Tester navigation au **clavier seul** (Tab, Entrée, Espace), focus visible, noms accessibles, états `aria-expanded`, boutons désactivés aux bornes.
- [ ] Tester sur **un téléphone tactile** (viewport étroit), déplacement et repli, sans scroll involontaire ni zones de clic trop petites. Tester avec lecteur d'écran si possible.
- [ ] Exporter un JSON, l'importer dans un environnement de test et vérifier restauration des sujets/états/ordre ; vérifier que l'état éphémère de repli et la préférence de reprise restent distincts.
- [ ] Vérifier qu'aucune requête n'envoie le contenu de ses tâches vers un service distant ; vérifier le message si le stockage navigateur est bloqué.

## Compte rendu

```text
Date et validateur :
SHA / Pages déployé :
Ordinateur : navigateur, version, OS :
Téléphone : navigateur, OS :
Clavier et accessibilité :
Nombre de tests réussis / non réalisés / échoués :
Anomalies + preuve éventuelle (sans données privées) :
Décision : ACCEPTÉ / À CORRIGER / PARTIEL
```

Les PR #55, #58, #59, les tests Node et CI/Pages démontrent une **livraison technique**, pas l'achèvement de cette recette manuelle.
