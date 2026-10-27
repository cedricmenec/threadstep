import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = "docs/product/react-project-detail-qualification.md";
const report = readFileSync(resolve(root, reportPath), "utf8");
const developerGuide = readFileSync(resolve(root, "docs/product/developer-guide.md"), "utf8");
const architecture = readFileSync(resolve(root, "docs/architecture.md"), "utf8");

const allowedStatuses = new Set(["PASS", "FAIL", "NOT_RUN"]);
const physicalEnvironments = new Set([
  "Navigateur isolé",
  "Android réel",
  "Tactile",
  "Clavier physique",
  "Lecteur d'écran",
  "Dexie Cloud de test"
]);

function matrixRows() {
  return report.split("\n")
    .filter((line) => /^\|\s*Q\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return {
        id: cells[0],
        path: cells[1],
        environment: cells[2],
        evidence: cells[3],
        status: cells[4],
        date: cells[5],
        raw: line
      };
    });
}

test("TS-060 the qualification report contains the required dated matrix structure", () => {
  assert.match(report, /^# Qualification du pilote React — détail projet \(TS-060\)/);
  assert.match(report, /24 octobre 2026/);
  assert.match(report, /[0-9a-f]{40}/);
  assert.match(report, /## Matrice de recette/);
  assert.match(report, /## Comparaison avec le bilan TS-059/);
  assert.match(report, /docs\/product\/react-project-detail-pilot\.md/);
  assert.match(report, /## Mesures avant\/après/);
  assert.match(report, /## Recommandation et décision/);
  assert.match(report, /## Limites et scénarios physiques non exécutés/);

  const rows = matrixRows();
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  for (const row of rows) {
    assert.equal(row.path.length > 0, true, row.raw);
    assert.equal(row.environment.length > 0, true, row.raw);
    assert.equal(row.evidence.length > 0, true, row.raw);
    assert.equal(allowedStatuses.has(row.status), true, row.id + " status " + row.status);
    assert.equal(row.date.length > 0, true, row.raw);
  }

  const combined = rows.map((row) => row.path.toLowerCase() + " " + row.environment.toLowerCase()).join(" | ");
  for (const required of [
    "création", "édition", "sous-tâche", "filtre", "priorité", "menu",
    "glisser-déposer", "clavier", "retrait", "undo", "liste", "retour/avant",
    "rechargement", "clavier virtuel", "tactile", "lecteur d'écran", "dexie cloud"
  ]) {
    assert.match(combined, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), required);
  }
});

test("TS-060 physical rows stay NOT_RUN and automated PASS rows cite a real command", () => {
  const rows = matrixRows();
  const physical = rows.filter((row) => physicalEnvironments.has(row.environment));
  assert.ok(physical.length >= 7);
  for (const row of physical) {
    assert.equal(row.status, "NOT_RUN", row.id + " must not claim a physical PASS");
  }
  const automated = rows.filter((row) => row.environment.startsWith("Automatisé"));
  assert.ok(automated.length >= 10);
  for (const row of automated) {
    assert.equal(row.status, "PASS", row.id);
    assert.match(row.evidence, /tests\/ts-060-/);
  }
  assert.doesNotMatch(report, /\|\s*PASS\s*\|\s*—/);
  assert.match(report, /aucune preuve physique Android,/);
});

test("TS-060 the report records numeric build and coverage measures compared to TS-059", () => {
  for (const measure of [
    "936 456", "936 490", "558 172", "558 206", "36 285", "5 923",
    "99,19", "91,02", "93,84", "33 tests", "6 fichiers"
  ]) {
    assert.match(report, new RegExp(measure.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), measure);
  }
  assert.match(report, /Total `dist\/assets` \| 936 456 octets \| 936 490 octets \| \+34 octets/);
  assert.match(report, /Chunk applicatif `app-\*\.js` \| 558 172 octets \| 558 206 octets \| \+34 octets/);
  assert.match(report, /seule correction bornée/);
  assert.match(report, /Un seul défaut reproductible a été démontré/);
  assert.match(report, /controller-commands\.js/);
});

test("TS-060 the decision is an explicit bounded NO-GO and never a green-CI global GO", () => {
  assert.match(report, /\*\*Décision :\*\* \*\*NO-GO\*\*/);
  assert.match(report, /\*\*NO-GO borné pour le lot suivant\.\*\*/);
  assert.match(report, /La\s+CI verte ne constitue pas un GO global/);
  assert.match(report, /ne déclenche, ne planifie et n'autorise aucune autre migration,\s+fusion ou publication/);
  assert.match(report, /TS-061 ou TS-063/);
  assert.match(report, /décision humaine explicite/);
});

test("TS-060 developer and architecture docs describe qualification, measures and proof separation", () => {
  for (const text of ["TS-060", "react-project-detail-qualification.md", "NOT_RUN",
    "npm run verify:build", "site/react-boundary.js", "n'autorise automatiquement"]) {
    assert.match(developerGuide, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), text);
  }
  assert.match(developerGuide, /node --test --experimental-test-coverage tests\/ts-060-\*\.test\.mjs/);
  assert.match(developerGuide, /Une\s+preuve automatisée ou une CI verte ne remplace ni navigateur isolé/);
  assert.match(architecture, /TS-060/);
  assert.match(architecture, /NOT_RUN/);
  assert.match(architecture, /bounded human recommendation/);
});

test("TS-060 protected paths and existing business specs remain unchanged", () => {
  const protectedPaths = [
    "AGENTS.md",
    "opencode.json",
    ".github/workflows/",
    "backlog/tasks/TS-060.md",
    "openspec/specs/",
    "openspec/changes/archive/",
    "package.json",
    "package-lock.json",
    "site/core.js",
    "site/index.html"
  ];
  const status = execSync("git status --porcelain", { cwd: root, encoding: "utf8" })
    .replace(/\n$/, "")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, ""));
  const authorizedShellMigration = new Set(["site/index.html"]);
  if (existsSync(resolve(root, "tests/ts-067-navigation-state.test.mjs"))) {
    authorizedShellMigration.add("site/core.js");
  }
  const violations = status.filter((path) =>
    protectedPaths.some((protectedPath) =>
      path === protectedPath || path.startsWith(protectedPath)) &&
    !authorizedShellMigration.has(path));
  assert.deepEqual(violations, []);
});
