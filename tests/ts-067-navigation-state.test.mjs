import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NAV_MENU_ENTRIES,
  navigationFragmentForRoute,
  parseRoute
} from "../site/core.js";
import { appShellSourceFiles } from "./helpers/ts-063-app-shell-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

test("TS-067 delivery dependency is the archived TS-066 change, not a manual gate", () => {
  const archive = resolve(root, "openspec/changes/archive/2026-10-27-ts-066");
  for (const file of ["proposal.md", "design.md", "tasks.md"]) {
    assert.ok(existsSync(resolve(archive, file)), "missing " + file);
  }
  for (const module of [
    "site/app-shell/AppShell.jsx",
    "site/app-shell/AppHeader.jsx",
    "site/app-shell/AppNavigation.jsx",
    "site/app-shell/AppShellSurface.jsx"
  ]) {
    assert.ok(existsSync(resolve(root, module)), module);
  }
  const tasks = read("openspec/changes/ts-067/tasks.md");
  const checklist = tasks.slice(0, tasks.indexOf("## Manual acceptance"));
  assert.doesNotMatch(checklist, /GO manuel|attestation TS-066|bloqué par la recette/i);
});

test("TS-067 pure mapping covers every parsed route without inventing destinations", () => {
  const cases = [
    [parseRoute("#/"), "#/"],
    [parseRoute(""), "#/"],
    [parseRoute("#/inconnu"), "#/"],
    [parseRoute("#/sujet/projet%20a"), "#/"],
    [parseRoute("#/sujet/"), "#/"],
    [parseRoute("#/sujet/%E0%A4%A"), "#/"],
    [parseRoute("#/parametres"), "#/parametres"],
    [parseRoute("#/parametres/donnees"), "#/parametres/donnees"],
    [parseRoute("#/parametres/synchronisation"), "#/parametres/synchronisation"],
    [null, null],
    [undefined, null],
    ["#/", null],
    [42, null],
    [{}, null],
    [{ view: "settings" }, null],
    [{ view: "settings", section: "other" }, null],
    [{ view: "inconnu" }, null]
  ];
  for (const [route, expected] of cases) {
    assert.equal(navigationFragmentForRoute(route), expected, JSON.stringify(route));
  }
});

test("TS-067 mapping never mutates the four frozen destinations", () => {
  const before = NAV_MENU_ENTRIES.map((entry) => ({ ...entry }));
  for (const hash of ["#/", "#/sujet/a", "#/parametres", "#/parametres/donnees", "#/parametres/synchronisation", "#/inconnu"]) {
    navigationFragmentForRoute(parseRoute(hash));
  }
  navigationFragmentForRoute(null);
  navigationFragmentForRoute({ view: "settings", section: "data" });
  assert.deepEqual(NAV_MENU_ENTRIES.map((entry) => ({ ...entry })), before);
  assert.equal(Object.isFrozen(NAV_MENU_ENTRIES), true);
  for (const entry of NAV_MENU_ENTRIES) assert.equal(Object.isFrozen(entry), true);
});

test("TS-067 keeps exactly four destinations, their order and their fragments", () => {
  assert.deepEqual(NAV_MENU_ENTRIES.map((entry) => entry.label), [
    "Mes projets",
    "Paramètres",
    "Imports / Exports",
    "Synchronisation Dexie Cloud"
  ]);
  assert.deepEqual(NAV_MENU_ENTRIES.map((entry) => entry.fragment), [
    "#/",
    "#/parametres",
    "#/parametres/donnees",
    "#/parametres/synchronisation"
  ]);
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.deepEqual(parseRoute("#/inconnu"), { view: "overview" });
  assert.deepEqual(parseRoute("#/sujet/a"), { view: "subject", subjectId: "a" });
});

test("TS-067 adds no route, fragment, history, router or store to the shell", () => {
  const core = read("site/core.js");
  const helperStart = core.indexOf("export function navigationFragmentForRoute(");
  const helperEnd = core.indexOf("\n}\n", helperStart);
  assert.ok(helperStart > 0 && helperEnd > helperStart);
  const helper = core.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /location|history|pushState|replaceState|localStorage|sessionStorage|fetch|indexedDB/i);
  for (const { name, source } of appShellSourceFiles()) {
    assert.doesNotMatch(source, /pushState|replaceState|history\.|react-router|useNavigate|location\.hash|window\.location/, name);
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|new\s+Dexie|\bfetch\s*\(/, name);
  }
});
