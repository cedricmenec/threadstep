import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("TS-073 product guides describe the simplified project list and detail navigation", () => {
  const presentation = read("docs/product/react-overview-presentation.md");
  const interactions = read("docs/product/react-overview-interactions.md");
  assert.match(presentation, /aucun aperçu de tâche/i);
  assert.match(presentation, /tâches principales/);
  assert.match(presentation, /« tâche en cours »/);
  assert.match(interactions, /commande `openProject`/);
  assert.match(interactions, /restent\s+disponibles dans la vue de détail/);
});

test("TS-071 OpenSpec separates executable checks from human acceptance", () => {
  const tasks = read("openspec/changes/archive/2026-11-21-ts-071/tasks.md");
  const manual = tasks.slice(tasks.indexOf("## Manual acceptance"), tasks.indexOf("## Post-sync review"));
  const postSync = tasks.slice(tasks.indexOf("## Post-sync review"));
  assert.match(tasks, /Implementation checklist/);
  assert.doesNotMatch(manual, /- \[[ x]\]/i);
  assert.doesNotMatch(postSync, /- \[[ x]\]/i);
  assert.match(manual, /lecteur d’écran/);
  assert.match(postSync, /contrôle indépendant/);
});
