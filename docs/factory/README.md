# Autonomous Software Factory | Dossier de référence

**Statut : architecture cible documentée, prototype opérationnel partiel.**  
**Mise à jour : 14 octobre 2026.**  
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
- La fusion et le déploiement automatiques sont des capacités futures conditionnées par des garde-fous, **pas une autorisation générale de contourner la CI**.

## Où lire quoi ?

1. [Spécification fonctionnelle](functional-specification.md) : acteurs, capacités, scénarios, critères et exigences non fonctionnelles.
2. [Architecture technique](technical-architecture.md) : composants, ports/adaptateurs, contrats, états, stockages et modes d'exécution.
3. [Méthodologie opérationnelle](operating-methodology.md) : de la voix au backlog, du lancement à la livraison, et incidents.
4. [Cycle de développement OpenSpec](openspec-protocol.md) : Explore → Propose → Apply → Verify → Sync → Archive.
5. [Autonomie et sécurité GitHub](github-autonomy-and-security.md) : blocage de CI sur PR créée par bot, GitHub App/PAT, contrôles, budgets, garde-fous.
6. [Feuille de route et critères de passage](roadmap.md) : état confirmé, évolutions et tests de bout en bout.
7. [Décisions et alternatives](decisions.md) : décisions actuelles, options et arbitrages à venir.

## Source de vérité et limites

- Exécution actuelle : `.github/workflows/agent.yml`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`.
- Règles de l'agent dans **`AGENTS.md`** ; backlog dans **`backlog/tasks/TS-NNN.md`** ; besoins ThreadStep dans **`docs/product/`**.
- Ce dossier **spécifie** le futur système ; il n'implémente ni orchestrateur, ni GitHub App, ni pipeline OpenSpec complet.
- Les modèles OpenRouter, flags CLI, tarifs et politiques GitHub peuvent évoluer : **versionner, tester et revalider** avant activation.
- Une session conversationnelle n'est pas un exécuteur permanent : la continuité autonome doit être portée par GitHub Actions ou un orchestrateur hébergé, avec un état persistant.
