import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("TS-071 product guides describe the actual card and mobile reorder behavior", () => {
  const presentation = read("docs/product/react-overview-presentation.md");
  const interactions = read("docs/product/react-overview-interactions.md");
  assert.match(presentation, /DS-CARD-OVERVIEW-72/);
  assert.match(presentation, /état filtré distinct/);
  assert.match(presentation, /44 × 44 px/);
  assert.match(presentation, /poignée de glisser-déposer est masquée/);
  assert.match(interactions, /commandes Monter\/Descendre/);
  assert.match(interactions, /canMoveWithinPriority/);
});

test("TS-071 OpenSpec separates executable checks from human acceptance", () => {
  const tasks = read("openspec/changes/ts-071/tasks.md");
  const manual = tasks.slice(tasks.indexOf("## Manual acceptance"), tasks.indexOf("## Post-sync review"));
  const postSync = tasks.slice(tasks.indexOf("## Post-sync review"));
  assert.match(tasks, /Implementation checklist/);
  assert.doesNotMatch(manual, /- \[[ x]\]/i);
  assert.doesNotMatch(postSync, /- \[[ x]\]/i);
  assert.match(manual, /lecteur d’écran/);
  assert.match(postSync, /contrôle indépendant/);
});
