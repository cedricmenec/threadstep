# Autonomous Software Factory | Dossier de référence

**Statut : OpenSpec auto TS-010 et TS-011 livrés et fusionnés automatiquement par GitHub App après CI ; agent manuel restauré, Actionlint actif et OPSX natif éprouvé.**  
**Mise à jour : 15 octobre 2026.**  
**Projet pilote :** [ThreadStep](https://github.com/cedricmenec/threadstep).  
**Référence antérieure :** dépôt privé `mestryn`, notamment `.github/workflows/opencode.yml` et `AGENTS.md`.

## Vision

Construire une **usine logicielle générique pilotable par conversation, notamment vocale depuis un téléphone**, capable de passer d'un besoin métier à des spécifications, un backlog, du code testé et une livraison traçable. Le projet applicatif (ThreadStep) est **un pilote**, pas le produit « factory ». Après validation, les composants réutilisables doivent pouvoir être extraits.

Contraintes durables :
- **OpenRouter** fournit les modèles et les dépenses associées, avec une clé en secret GitHub ; **OpenCode** est le moteur pilote mais doit rester remplaçable.
- La spécification et le backlog vivent dans Git, pas seulement dans une conversation ou une issue GitHub.
- **Spec-driven development via OpenSpec** comme protocole cible, incluant Explore, Propose, Apply, vérification, synchronisation des specs et Archive.
- **Deux modes conservés** : **déclenchement manuel ciblé** et **orchestration externe / par vagues**. Ils utilisent exactement la même chaîne d'exécution et de contrôles ; l'orchestrateur est facultatif.
- Le travail est durable, reprenable après interruption, observable, reproductible et limité en coût.
- **Fusion automatique native GitHub et déploiement Pages observés** après CI requise sur TS-010/TS-011 ; l'orchestration externe par vagues reste une cible. Aucun mécanisme ne doit contourner les checks.

## Où lire quoi ?

1. [État courant et reprise](current-state.md) : preuves, risques, versions et prochaine expérimentation.
2. [Spécification fonctionnelle](functional-specification.md) : acteurs, capacités, scénarios, critères et exigences non fonctionnelles.
3. [Architecture technique](technical-architecture.md) : composants, ports/adaptateurs, contrats, états, stockages et modes d'exécution.
4. [Méthodologie opérationnelle](operating-methodology.md) : de la voix au backlog, du lancement à la livraison, et incidents.
5. [Cycle de développement OpenSpec](openspec-protocol.md) : Explore → Propose → Apply → Verify → Sync → Archive.
6. [Autonomie et sécurité GitHub](github-autonomy-and-security.md) : blocage de CI sur PR créée par bot, GitHub App/PAT, contrôles, budgets, garde-fous.
7. [Feuille de route et critères de passage](roadmap.md) : état confirmé, évolutions et tests de bout en bout.
8. [Décisions et alternatives](decisions.md) : décisions actuelles, options et arbitrages à venir.

## Source de vérité et limites

- Exécution actuelle : agent.yml (direct), agent-openspec.yml (plan/apply/auto/finalize), ci.yml et pages.yml.
- Contrat agent dans AGENTS.md, tâches sous backlog/tasks/, exigences produit sous docs/product/.
- TS-008 (#21) a validé ADDED ; TS-009 (#26) a validé OPSX natif MODIFIED. TS-010 (#32) et TS-011 (#34) ont livré leurs capacités OpenSpec et prouvé le chemin GitHub App → CI indépendante → fusion automatique → Pages.
- PR #25 a rendu explicite le contrat : chaque case de la checklist OpenSpec doit être réalisable avant la synchronisation ; la revue post-sync reste distincte.
- [ASF-DOC-001](tasks/ASF-DOC-001.md) documente la réconciliation du 15 octobre 2026.
- [ASF-DOC-002](tasks/ASF-DOC-002.md) trace la réconciliation après TS-011.
- Le document [current-state.md](current-state.md) sert d'entrée unique pour le statut vérifié. La protection main et le check `check` sont configurés ; l'orchestrateur, les plafonds de coût garantis et les checkpoints transactionnels restent à traiter.
- Les versions des outils, commandes et tarifs peuvent évoluer ; ne jamais déduire la validité du comportement de la seule présence d'un fichier ou de l'état green d'un run.
