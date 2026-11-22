# Security and privacy for ThreadStep agents

Apply these requirements to all development methods, including direct Codex work and ASF.


- Le dépôt et le site publié sont publics. **Ne jamais committer ni exposer
  de secrets**, clés OpenRouter, jetons, clés d'administration cloud,
  fichiers de configuration sensibles ni données personnelles dans
  les sources, PR, logs ou documentation publique.
- Ne pas insérer des chaînes utilisateur non fiables comme HTML
  exécutable ; appliquer les contrôles prévus par les spécifications
  métier. Vérifier explicitement la sécurité, la confidentialité et
  les frontières de confiance avant tout échange réseau ou partage.
- Préserver les données utilisateurs et les anciens exports/imports,
  ou mettre en place une migration **explicite, non destructive et testée**.
  Ne pas transférer des données héritées vers un service externe
  sans respecter les exigences de consentement du contrat produit.



## Change boundaries and authorization

- Work on a dedicated branch, never push directly to `main`.
- Change only the authorized task scope, review acceptance criteria before editing.
- Preparing a plan or task does not authorize paid services, secret changes, or execution.
- A merge requires the user's authorization and the applicable independent CI checks.
- Never bypass branch protection or claim checks succeeded without evidence.

For ASF-specific implementation, publishing and recovery rules, see [agents-asf.md](../../agents-asf.md).
