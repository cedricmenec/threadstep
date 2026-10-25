import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoute, subjectRoute, STORAGE_KEY, RESUME_KEY } from "../site/core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const guide = read("docs/product/developer-guide.md");
const architecture = read("docs/architecture.md");
const report = read("docs/product/react-project-detail-pilot.md");
const pkg = JSON.parse(read("package.json"));

test("TS-059 routes, storage keys and JSON contracts are unchanged", () => {
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/parametres"), { view: "settings", section: "root" });
  assert.deepEqual(parseRoute("#/parametres/donnees"), { view: "settings", section: "data" });
  assert.deepEqual(parseRoute("#/parametres/synchronisation"), { view: "settings", section: "sync" });
  assert.deepEqual(parseRoute("#/sujet/p1"), { view: "subject", subjectId: "p1" });
  assert.equal(subjectRoute("p1"), "#/sujet/p1");
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.equal(RESUME_KEY, "threadstep.resume.v1");

  const newSources = [
    "site/project-detail/ProjectDetail.jsx",
    "site/project-detail/TaskList.jsx",
    "site/project-detail/TaskItem.jsx",
    "site/project-detail/SubtaskList.jsx",
    "site/project-detail/TaskActionMenu.jsx",
    "site/project-detail/TaskEditor.jsx",
    "site/project-detail/ProjectDetailSurface.jsx",
    "site/project-detail/controller-commands.js",
    "site/project-detail/surface-decision.js"
  ].map((file) => read(file)).join("\n");
  assert.doesNotMatch(newSources, /localStorage\.setItem|indexedDB\.open|threadstep\.[a-z]+\.v\d/);
  assert.doesNotMatch(newSources, /location\.hash\s*=\s*["'`]#\/parametres/);
  assert.deepEqual(
    Object.keys(pkg.dependencies).sort(),
    ["dexie", "dexie-cloud-addon", "react", "react-dom"]
  );
  assert.equal(pkg.dependencies.react, "19.3.1");
  assert.equal(pkg.dependencies["react-dom"], "19.3.1");
});

test("TS-059 documentation lists the components, ownership and transient split", () => {
  for (const file of [
    "site/project-detail/ProjectDetail.jsx",
    "site/project-detail/TaskList.jsx",
    "site/project-detail/TaskItem.jsx",
    "site/project-detail/SubtaskList.jsx",
    "site/project-detail/TaskActionMenu.jsx",
    "site/project-detail/TaskEditor.jsx",
    "site/project-detail/ProjectDetailSurface.jsx",
    "site/project-detail/controller-commands.js",
    "site/project-detail/surface-decision.js",
    "docs/product/react-project-detail-pilot.md"
  ]) {
    assert.ok(existsSync(resolve(root, file)), file);
  }
  assert.match(guide, /TS-059/);
  assert.match(guide, /surface React du détail/);
  assert.match(guide, /ProjectDetail\.jsx/);
  assert.match(guide, /Overview.*vanilla/is);
  assert.match(guide, /snapshot\.transient/);
  assert.match(guide, /flushSync/);
  assert.match(guide, /Retour arrière/);
  assert.match(guide, /Diagnostic/);
  assert.match(guide, /recette reste manuelle/);
  assert.match(architecture, /TS-059/);
  assert.match(architecture, /project-detail/);
});

test("TS-059 the pilot report contains measured before/after values and a decision", () => {
  assert.match(report, /690 229 octets/);
  assert.match(report, /936 456 octets/);
  assert.match(report, /\+246 227 octets/);
  assert.match(report, /311 945 octets/);
  assert.match(report, /558 172 octets/);
  assert.match(report, /couverture/i);
  assert.match(report, /réutilisabilité|réutilisable/i);
  assert.match(report, /complexité/i);
  assert.match(report, /risques d'intégration/i);
  assert.match(report, /\*\*GO\*\*|GO pour le pilote/);
  assert.doesNotMatch(report, /déclenche automatiquement|migration automatique autorisée/i);
  assert.match(report, /recette manuelle/i);
  assert.match(report, /non effectuées par la CI|non prouvés par jsdom|ne remplacent pas/i);
  assert.match(report, /\/tmp\/ts-059-coverage\.json/);
});

test("TS-059 no new route, storage key, migration or protected factory file is added", () => {
  const core = read("site/core.js");
  assert.match(core, /fragment === "" \|\| fragment === "\/"/);
  assert.match(core, /fragment === "\/sujet"/);
  assert.match(core, /fragment\.startsWith\("\/sujet\/"\)/);
  assert.doesNotMatch(core, /"\/parametres\/react|"\/react|"\/pilote/);

  const protectedPaths = [
    ".github/workflows",
    "AGENTS.md",
    "opencode.json",
    "backlog/tasks/TS-059.md",
    "openspec/specs",
    "openspec/changes/archive",
    "package.json",
    "package-lock.json",
    "site/index.html"
  ];
  const authorizedShellMigration = new Set(["site/index.html"]);
  const status = execFileSync("git", ["status", "--porcelain", "--", ...protectedPaths], {
    cwd: root,
    encoding: "utf8"
  }).replace(/\n$/, "").split("\n").filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, ""))
    .filter((path) => !authorizedShellMigration.has(path));
  assert.deepEqual(status, [], "protected paths must stay untouched:\n" + status.join("\n"));
});
