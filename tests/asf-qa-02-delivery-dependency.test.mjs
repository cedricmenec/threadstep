import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

const workflow = read(".github/workflows/agent-openspec.yml");
const contract = read("AGENTS.md");
const backlogContract = read("docs/factory/backlog-v2-task-contract.md");
const checklistContract = read("docs/factory/openspec-checklist-contract.md");
const config = read("openspec/config.yaml");
const taskTemplate = read("backlog/tasks/TEMPLATE.md");
const ts066 = read("backlog/tasks/TS-066.md");

test("ASF-QA-02: plans and implementation do not invent a preceding manual GO gate", () => {
  const plan = workflow.split("- name: Explore and propose, no product code changes")[1]
    ?.split("- name: Validate the produced plan")[0];
  const apply = workflow.split("- name: Apply the reviewed plan with OpenCode")[1]
    ?.split("- name: Checkpoint verified implementation before OPSX sync")[0];
  assert.ok(plan && apply, "OpenSpec plan/apply prompts must be present");
  assert.match(plan, /Do NOT require a prior human\/manual acceptance report/);
  assert.match(plan, /merged PR, successful independent\/main CI and successful Pages deploy/);
  assert.match(apply, /Do not stop apply solely because a previous task lacks/);
  assert.match(apply, /Verified PR\/CI\/Pages delivery is enough/);
  assert.match(config, /never invent a prior manual acceptance GO gate/);
  assert.match(checklistContract, /Ce n'est pas une porte d'entrée de la tâche suivante/);
});

test("ASF-QA-02: product dependencies use real delivery and preserve manual review honesty", () => {
  assert.match(contract, /Ne pas bloquer une tâche dépendante faute de GO\/rapport de recette humaine/);
  assert.match(backlogContract, /Résolution de `depends_on` pour les tâches produit/);
  assert.match(backlogContract, /une CI `main` verte et Pages réussi/);
  assert.match(taskTemplate, /do not require a prior\s+human\/manual acceptance report/);
  assert.match(contract, /sans cases à cocher/);
  assert.match(config, /Manual acceptance section WITHOUT checkboxes/);
  assert.match(workflow, /Unchecked tasks remain; refusing archive/);
  assert.match(workflow, /node scripts\/sync-guard\.mjs verify/);
});

test("ASF-QA-02: a distinct explicit Stitch product choice is still required for TS-066", () => {
  assert.match(ts066, /^status: proposed$/m);
  assert.match(ts066, /^depends_on:\r?\n  - TS-065$/m);
  assert.match(ts066, /les références Stitch spécifiques à Overview devront être examinées et approuvées explicitement/);
  assert.match(contract, /décision\s+produit explicite/i);
  assert.match(config, /Preserve explicit new product design or security decisions/);
  assert.match(workflow, /Explicit decisions needed for THIS task \(e\.g\. Stitch references/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});
