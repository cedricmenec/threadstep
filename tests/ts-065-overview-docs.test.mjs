import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoute, STORAGE_KEY, RESUME_KEY } from "../site/core.js";
import { overviewSourceFiles } from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const doc = read("docs/product/react-overview-interactions.md");
const guide = read("docs/product/developer-guide.md");
const app = read("site/app.js");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

test("TS-065 dependency gate verifies TS-064 archive, delivered ancestor, shared files and protected paths", () => {
  assert.ok(existsSync(resolve(root, "openspec/changes/archive/2026-10-26-ts-064")));
  const delivered = "e1e39f8b273ad85f97951163ae64394360031f4a";
  assert.match(read("docs/product/react-overview-ts-064-acceptance.md"), new RegExp(delivered));
  // GitHub Actions PR checkouts use a shallow synthetic merge commit by
  // default: the historical delivery SHA cannot be resolved locally.
  // Keep the ancestry assertion on full clones; on shallow checkouts require
  // the dated acceptance report in the actual tested HEAD tree instead.
  const shallow = git(["rev-parse", "--is-shallow-repository"]).trim() === "true";
  if (shallow) {
    const committedReport = git(["show", "HEAD:docs/product/react-overview-ts-064-acceptance.md"]);
    assert.match(committedReport, new RegExp(delivered), "TS-064 GO missing from tested HEAD");
  } else {
    assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", delivered, "HEAD"]));
  }
  assert.ok(existsSync(resolve(root, "site/overview")));
  assert.ok(existsSync(resolve(root, "site/project-detail/TaskItem.jsx")));
  const protectedPaths = [
    "site/core.js",
    "site/react-boundary.js",
    "site/react-adapter.js",
    "site/dexie-foundation.js",
    "package.json",
    "package-lock.json",
    "AGENTS.md",
    ".github/workflows",
    "backlog",
    "openspec/specs"
  ].filter((path) => !(existsSync(resolve(root, "tests/ts-067-navigation-state.test.mjs")) && path === "site/core.js"));
  const status = git(["status", "--porcelain", "--", ...protectedPaths]).trim();
  assert.equal(status, "", status);
});

test("TS-065 baseline control classes, accessible names and command names remain present", () => {
  const interactions = [
    ...overviewSourceFiles().map((entry) => entry.source),
    read("site/overview/use-overview-drag.js"),
    read("site/project-detail/TaskItem.jsx"),
    read("site/project-detail/TaskActionMenu.jsx"),
    read("site/ui/PriorityControl.jsx"),
    read("site/overview/OverviewTaskList.jsx")
  ].join("\n");
  for (const marker of [
    "task-menu-button",
    "task-check",
    "priority-control",
    "task-toggle",
    "task-handle",
    "overview-see-more"
  ]) {
    assert.match(interactions, new RegExp(marker), marker);
  }
  assert.match(read("site/overview/use-overview-drag.js"), /commandsRef\.current\.reorderItem/);
  assert.match(read("site/overview/overview-adapter.js"), /"reorderItem"/);
  assert.match(app, /function startDrag\(event, subject, item, handle\)/);
});

test("TS-065 interaction documentation maps ownership, delegated commands, drag, diagnostics and limits", () => {
  const headings = [
    "Carte de propriété des interactions",
    "Commandes déléguées",
    "Cycle du glisser-déposer",
    "Diagnostic",
    "Continuité des éditeurs et du focus",
    "Isolation des contextes",
    "Frontières de plateforme",
    "Retour arrière",
    "Preuves automatisées et recette humaine",
    "Limites"
  ];
  assert.match(doc, /^# Interactions et éditeurs Overview React/m);
  const positions = headings.map((heading) => {
    const index = doc.indexOf("## " + heading);
    assert.notEqual(index, -1, heading);
    return index;
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  for (const command of [
    "createItem",
    "updateItem",
    "setPriority",
    "toggleItem",
    "runMenuCommand",
    "toggleSubsteps",
    "removeItem",
    "undoRemoval",
    "trackItem",
    "reorderItem"
  ]) {
    assert.match(doc, new RegExp(command), command);
  }
  for (const phrase of [
    /use-overview-drag\.js/,
    /dragSession/,
    /pointercancel/,
    /Échap/,
    /TaskEditor/,
    /CreateTaskForm/,
    /npm run check/,
    /npm run build/,
    /npm run verify:build/,
    /Chrome Android/,
    /lecteur d'écran/,
    /hors checklist `apply`/
  ]) {
    assert.match(doc, phrase);
  }
});

test("TS-065 developer guide documents editor continuity, context isolation, platform boundary and rollback", () => {
  assert.match(guide, /Interactions et éditeurs Overview React \(TS-065\)/);
  for (const heading of [
    "Continuité des éditeurs",
    "Isolation des contextes",
    "Frontière de plateforme",
    "Retour arrière"
  ]) {
    assert.match(guide, new RegExp("### " + heading), heading);
  }
  assert.match(guide, /site\/overview\/use-overview-drag\.js/);
  assert.match(guide, /tests\/ts-065-overview-\*\.test\.mjs/);
  assert.match(guide, /docs\/product\/react-overview-interactions\.md/);
  assert.match(guide, /recette desktop et Android reste manuelle/);
});

test("TS-065 no route or storage key is introduced by interactions, documentation or build", () => {
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.deepEqual(parseRoute("#/sujet/p1"), { view: "subject", subjectId: "p1" });
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  const source = [
    ...overviewSourceFiles().map((entry) => entry.source),
    read("site/overview/use-overview-drag.js")
  ].join("\n");
  assert.doesNotMatch(source, /threadstep\.[a-z]+\.v\d/);
  assert.doesNotMatch(source, /location\.hash\s*=|pushState|replaceState/);
  assert.doesNotMatch(doc, /threadstep\.[a-z]+\.v\d/);
  assert.match(doc, /n'ajoutent aucune route, aucune clé de\s+stockage/);
});
