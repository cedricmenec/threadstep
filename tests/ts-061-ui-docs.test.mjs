import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const foundation = read("docs/product/ui-foundation.md");
const guide = read("docs/product/developer-guide.md");
const architecture = read("docs/architecture.md");
const tokens = read("site/styles/tokens.css");

test("TS-061 the UI foundation documents tokens, mapping and React/vanilla usage", () => {
  assert.match(foundation, /^# Socle UI ThreadStep/);
  assert.match(foundation, /site\/styles\/tokens\.css/);
  assert.match(foundation, /@import "\.\/styles\/tokens\.css";/);
  for (const category of [
    "Couleur", "Typographie", "Espacement", "Rayons", "Focus", "Erreur",
    "État désactivé", "Responsive"
  ]) {
    assert.match(foundation, new RegExp(category, "i"), "category " + category);
  }
  for (const value of ["#f6f5f1", "#24382f", "#a9ba69", "#d4dbcf", "44px", "620px"]) {
    assert.ok(tokens.includes(value), "token source value " + value);
    assert.ok(foundation.includes(value), "documented value " + value);
  }
  assert.match(foundation, /React/);
  assert.match(foundation, /vanilla/);
  assert.match(foundation, /Vite/);
  assert.match(foundation, /exceptions? préexistantes?/i);
  assert.match(foundation, /4,5:1/);
  assert.match(foundation, /3:1/);
  assert.match(foundation, /320, 390, 430, 768 et 1280 px/);
  assert.match(foundation, /focus.*#a9ba69|#a9ba69.*focus/is);
  assert.match(foundation, /#859087/);
  assert.match(foundation, /badges de priorité/i);
});

test("TS-061 the UI foundation documents primitive APIs, variants, states and rollback", () => {
  for (const file of [
    "site/ui/Button.jsx",
    "site/ui/PriorityControl.jsx",
    "site/ui/TextField.jsx",
    "site/ui/priority-options.js",
    "site/styles/tokens.css"
  ]) {
    assert.ok(existsSync(resolve(root, file)), file);
    assert.ok(foundation.includes(file) || guide.includes(file), "referenced " + file);
  }
  for (const term of ["Button", "PriorityControl", "TextField", "priority-options.js"]) {
    assert.match(foundation, new RegExp(term.replace(".", "\\.")));
  }
  for (const variant of ["primary", "secondary", "subtle", "danger", "badge", "field"]) {
    assert.match(foundation, new RegExp("`" + variant + "`"));
  }
  for (const state of ["focus", "disabled", "aria-invalid", "aria-describedby", "required", "maxLength", "rows"]) {
    assert.match(foundation, new RegExp(state, "i"));
  }
  assert.match(foundation, /tokens consommés|Tokens consommés/i);
  assert.match(foundation, /Retour arrière/);
  assert.match(foundation, /Intégration progressive/);
  assert.match(foundation, /Aucune migration de données|aucune migration de données/);
  assert.match(foundation, /ne s'agit \*\*pas\*\* d'une migration générale|pas d'une migration générale/i);
  assert.doesNotMatch(foundation, /migration générale autorisée|convertit automatiquement Overview/i);
});

test("TS-061 documentation separates deterministic checks from human acceptance", () => {
  assert.match(foundation, /Vérifications automatisées et recette humaine/);
  assert.match(foundation, /tests déterministes/i);
  assert.match(foundation, /prouvent \*\*pas\*\* un rendu navigateur réel/is);
  assert.match(foundation, /clavier physique/i);
  assert.match(foundation, /tactile/i);
  assert.match(foundation, /Chrome Android/i);
  assert.match(foundation, /lecteur d'écran/i);
  assert.match(foundation, /`PASS`, `FAIL` ou `NOT_RUN`/);
  assert.doesNotMatch(foundation, /recette humaine (réussie|validée|terminée)/i);
});

test("TS-061 developer guide and architecture describe the shared foundation", () => {
  assert.match(guide, /Socle UI : tokens et primitives React \(TS-061\)/);
  assert.match(guide, /site\/styles\/tokens\.css/);
  assert.match(guide, /site\/ui\/Button\.jsx/);
  assert.match(guide, /site\/ui\/PriorityControl\.jsx/);
  assert.match(guide, /site\/ui\/TextField\.jsx/);
  assert.match(guide, /Retour arrière/);
  assert.match(guide, /Overview.*vanilla/is);
  assert.match(guide, /node --test tests\/ts-061-\*\.test\.mjs/);
  assert.match(architecture, /TS-061/);
  assert.match(architecture, /site\/styles\/tokens\.css/);
  assert.match(architecture, /site\/ui\//);
  assert.match(architecture, /docs\/product\/ui-foundation\.md/);
});

test("TS-061 build measurements are present and numeric", () => {
  assert.match(foundation, /## Mesures de build/);
  const rows = foundation.split("\n").filter((line) => /^\|\s*(Total|Chunk|CSS)/.test(line));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 4, row);
    for (const value of cells.slice(1)) {
      assert.match(value, /^[-+]?\d+$/, "numeric measurement in " + row);
    }
  }
  const [total, app, css] = rows.map((row) => row.split("|").slice(2, -1).map((cell) => Number(cell.trim())));
  assert.ok(total[0] > 0 && total[1] > 0);
  assert.ok(app[0] > 0 && app[1] > 0);
  assert.ok(css[0] > 0 && css[1] > 0);
  assert.ok(!foundation.includes("Les valeurs « Après » sont renseignées"));
});
