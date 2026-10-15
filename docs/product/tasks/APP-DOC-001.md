# APP-DOC-001 | Réconcilier la documentation produit après TS-010 et TS-011

Status: completed
Date: 2026-10-15
Scope: documentation applicative et métadonnées du backlog seulement
Priority: normal

## But

Aligner les documents produit avec les deux fonctionnalités réellement
livrées dans ThreadStep le 15 octobre 2026 : suppression réversible par
snackbar (TS-010) et réorganisation des actions de même priorité
(TS-011). Faciliter aussi la prise en main sur téléphone et ordinateur.

## Constats et vérifications

- [x] Vérifier les PR produit fusionnées #32 et #34, les spécifications
  canoniques action-removal et action-ordering, le code du site et les
  exécutions CI/Pages après merge.
- [x] Préserver le contrat produit déjà présent dans docs/product/mvp.md,
  sans modifier le sens de FR-02, FR-12, FR-13 et FR-15.
- [x] Rédiger un guide d'utilisation concis, en français, décrivant les
  interactions actuelles, les restrictions de déplacement, l'annulation,
  la sauvegarde, les exports et les limites multi-appareils.
- [x] Mettre à jour les métadonnées de livraison TS-010 et TS-011 sans
  cocher rétrospectivement les critères historiques.
- [x] Corriger le sommaire backlog et les entrées produit.
- [x] Ne modifier aucun fichier site/, test, workflow ni schéma JSON.
- [x] Garder distincts tests automatisés, déploiement confirmé et essais
  tactiles/lecteur d'écran manuels non attestés.

## Preuves

- [PR #32, TS-010](https://github.com/cedricmenec/threadstep/pull/32)
  : fusionnée le 15 octobre, capacité action-removal archivée.
- [PR #34, TS-011](https://github.com/cedricmenec/threadstep/pull/34)
  : fusionnée le 15 octobre, capacité action-ordering archivée.
- [CI finale de main](https://github.com/cedricmenec/threadstep/actions/runs/38755434920)
  : 97 tests Node réussis, actionlint et validation OpenSpec réussis.
- [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38755434958)
  : déploiement réussi.
- main au début de l'audit : af05c79fe9e5d6b6ae0620985f9ce6a11a1e2f03.

## Hors périmètre

Réimplémentation du glisser-déposer, modification du snackbar,
synchronisation cloud, ajout de tests navigateur/mobiles réels,
déclenchement d'OpenRouter et travail de factory.
