import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const doc = read("docs/product/react-app-shell.md");
const guide = read("docs/product/developer-guide.md");

test("TS-067 architecture decision records the delivered responsive shell and boundaries", () => {
  for (const heading of [
    "Carte de propriété DOM",
    "Placement de l'hôte et shell responsive",
    "Rail desktop et tiroir compact",
    "Point de rupture local",
    "Points de montage",
    "Frontières route, identité et blocage",
    "Focus, scroll et continuité",
    "État de destination courante",
    "Dépendance TS-066",
    "Diagnostic",
    "Retour arrière",
    "Preuves automatisées et recette humaine",
    "Limites"
  ]) {
    assert.match(doc, new RegExp("## " + heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), heading);
  }
  for (const phrase of [
    /1024 px/,
    /@media\(min-width:1024px\)/,
    /rail persistant/,
    /tiroir/,
    /data-open="true\|false"/,
    /aria-current="page"/,
    /navigationFragmentForRoute/,
    /enfant direct de\s+`<main class="shell">`/,
    /actifs est borné à deux|borné à deux/,
    /Ne remonte jamais|ne remonte jamais/,
    /aucune écriture/,
    /NOT_RUN/,
    /non coché par `apply`/,
    /npm run check/,
    /npm run build/,
    /npm run verify:build/
  ]) {
    assert.match(doc, phrase);
  }
  assert.match(doc, /^# Coque React bornée/m);
  assert.match(doc, /M01, M02, M15, M16 et M19/);
  assert.match(doc, /DESKTOP-1/);
  assert.match(doc, /M32/);
});

test("TS-067 developer guide lists entry points, deterministic tests and rollback", () => {
  assert.match(guide, /Shell de navigation responsive Stitch \(TS-067\)/);
  for (const heading of ["Points d'entrée", "Tests et vérifications", "Retour arrière", "Limites de la vérification"]) {
    assert.match(guide, new RegExp("### " + heading), heading);
  }
  for (const phrase of [
    /site\/app-shell\/AppNavigation\.jsx/,
    /navigationFragmentForRoute/,
    /site\/styles\.css/,
    /1024px/,
    /tests\/ts-067-navigation-state\.test\.mjs/,
    /tests\/ts-067-app-shell-layout\.test\.mjs/,
    /tests\/ts-067-app-shell-responsive\.test\.mjs/,
    /tests\/ts-067-docs\.test\.mjs/,
    /npm run check/,
    /npm run build/,
    /npm run verify:build/,
    /recette humaine/,
    /NOT_RUN/
  ]) {
    assert.match(guide, phrase);
  }
});

test("TS-067 documentation separates structural evidence from manual acceptance", () => {
  assert.match(doc, /Les tests jsdom prouvent[\s\S]*ne prouvent ni le rendu visuel/);
  assert.match(doc, /Ces scénarios restent à vérifier/);
  assert.match(doc, /Une CI verte, un test jsdom ou une revue statique ne valent/);
  assert.doesNotMatch(doc, /recette (desktop|mobile|Android) (réussie|validée|attestée)/i);
  assert.doesNotMatch(guide, /recette (desktop|mobile|Android) (réussie|validée|attestée)/i);
});
