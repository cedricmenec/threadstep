# ASF V3 — Fin de vague native GitHub (RELEASE et QUARANTINE)

**Décision 17 octobre 2026 : pas d'Ed25519 ni d'issuer externe.** La confiance repose sur le workflow propriétaire et un registre global Git protégé. Ce fichier décrit le prototype non payant de la PR #87, non encore relié à un writer live de sortie.

Le module scripts/asf/v3/global-terminal-evidence.mjs utilise les vrais validateurs du manifeste, du journal de vague et du registre global. inspectV3GithubTerminalCandidate propose RELEASE seulement si la vague se termine normalement, sans tâche active, avec reserved=delivered et un hash de preuve de livraison indiqué. QUARANTINE exige STOP_FAILED ou STOP_UNCERTAIN et un motif explicite.

**Important : le hash de preuve saisi par l'appelant ne prouve rien.** Une sortie effective doit être faite par un contrôleur fiable ayant relu au SHA Git épinglé la vague, les PR fusionnées, les checks main et Pages, puis écrit le nouveau registre via Git CAS force:false. La sortie de quarantaine ne doit jamais être automatique.

Le résultat du prototype est toujours authorized:false, canRelease:false, canQuarantine:false, canSpend:false ; il s'agit d'une proposition testable, pas d'un accès au writer.

La partie non encore faite : le lecteur GitHub indépendant des preuves de livraison, le writer CAS global RELEASE/QUARANTINE, la qualification réelle App et les permissions de la branche globale. L'admission seule est implémentée avec GitHub-native CAS non connecté dans scripts/asf/v3/github-native-global-cas.mjs.

Voir docs/factory/v3-github-native-decision.md et issue #86 pour les travaux restants.