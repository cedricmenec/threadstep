#!/usr/bin/env bash
# Small read-only summary of a CI failure. The full logs stay in Actions.
set -euo pipefail

log="${1:-}"
echo "### CI : échec à examiner"
echo
if [[ -z "$log" || ! -f "$log" ]]; then
  echo "Les tests n'ont pas produit de journal. Ouvrir la première étape rouge du run."
  exit 0
fi

echo 'Contrôle : `npm run check`. Extrait des erreurs (journal complet dans le job).'
echo
echo '```text'
if grep -Eq '^not ok [0-9]+ - ' "$log"; then
  awk '
    /^not ok [0-9]+ - / { failures++; if (failures <= 10) print }
    /^[[:space:]]+error: / { if (failures > 0 && failures <= 10) print }
    /^# (tests|pass|fail) [0-9]+/ { print }
  ' "$log"
else
  # Syntax/backlog checks may fail without any Node TAP "not ok" line.
  tail -n 16 "$log"
fi
echo '```'
echo
echo "Action : lire le test ou la commande en échec, corriger la cause puis relancer la CI. Aucun test rouge n'est ignoré."
