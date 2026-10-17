import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { forbiddenPostSyncTasks } from "../scripts/check-openspec-task-phases.mjs";

test("rejects a checklist item whose post-sync step is wrapped", () => {
  const tasks = "# Tasks\n\n- [ ] 4.3 Before sync, inspect the delta; after sync, diff\n  the canonical spec against previous revision.\n";
  assert.equal(forbiddenPostSyncTasks(tasks).length, 1);
});

test("accepts an implementation task with a separate post-sync review section", () => {
  const tasks = "# Tasks\n- [ ] 4.3 Inspect the delta before the workflow gate.\n\n## Post-sync review\n- After sync, compare all other requirements and scenarios.\n";
  assert.deepEqual(forbiddenPostSyncTasks(tasks), []);
});

test("detects an already-checked impossible task and archive work", () => {
  const tasks = "# Tasks\n- [x] Do this after archiving the change.\n- [ ] Another step post-sync\n";
  assert.equal(forbiddenPostSyncTasks(tasks).length, 2);
});

test("allows ordinary implementation tasks and current TS-009 plan correction", () => {
  const tasks = "# Tasks\n- [ ] 1.1 Implement helper.\n  Run tests and compare behavior before sync.\n- [ ] 1.2 Write new tests.\n";
  assert.deepEqual(forbiddenPostSyncTasks(tasks), []);
});

test("OpenSpec workflow checks phase contract on plan and existing apply", () => {
  const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
  assert.match(workflow, /node scripts\/check-openspec-task-phases\.mjs "\$change\/tasks\.md"/);
  assert.match(workflow, /node scripts\/check-openspec-task-phases\.mjs "openspec\/changes\/\$CHANGE_ID\/tasks\.md"/);
});


const agentContract = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const config = readFileSync(new URL("../openspec/config.yaml", import.meta.url), "utf8");
const manual = readFileSync(new URL("../docs/factory/openspec-checklist-contract.md", import.meta.url), "utf8");
const example = readFileSync(new URL("../docs/factory/examples/openspec-tasks-example.md", import.meta.url), "utf8");

test("ASF-OPSX-01 plan and apply prompts preserve the 3-space checklist contract", () => {
  const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
  const plan = workflow.split("      - name: Explore and propose, no product code changes")[1]?.split("      - name: Validate the produced plan")[0];
  const apply = workflow.split("      - name: Apply the reviewed plan with OpenCode")[1]?.split("      - name: Verify, semantic sync and archive OpenSpec")[0];
  assert.ok(plan && apply, "both paid prompts must be visible in the workflow");
  assert.match(plan, /docs\/factory\/openspec-checklist-contract\.md/);
  assert.match(plan, /examples\/openspec-tasks-example\.md/);
  assert.match(plan, /Every checkbox MUST be completable and provable/);
  assert.match(plan, /Manual acceptance[\s\S]*WITHOUT checkboxes/);
  assert.match(plan, /Post-sync review[\s\S]*WITHOUT checkboxes/);
  assert.match(apply, /Read docs\/factory\/openspec-checklist-contract\.md/);
  assert.match(apply, /mark tasks\.md items \[x\][\s\S]*only for implementation/);
  assert.match(apply, /never mark them as passed/);
  assert.match(workflow, /Unchecked tasks remain; refusing archive/);
  assert.match(workflow, /openspec archive "\$CHANGE_ID" --yes --skip-specs/);
});

test("ASF-OPSX-01 OpenSpec rules and AGENTS preserve human acceptance without pretending it passed", () => {
  assert.match(config, /rules:[\s\S]*tasks:[\s\S]*runner during apply BEFORE OPSX sync/);
  assert.match(config, /Manual acceptance section WITHOUT checkboxes/);
  assert.match(config, /Post-sync review section WITHOUT checkboxes/);
  assert.match(config, /never report unperformed checks as passed/);
  assert.match(agentContract, /Manual acceptance[\s\S]*without checkboxes/);
  assert.match(agentContract, /Post-sync review[\s\S]*without checkboxes/);
  assert.match(manual, /still \*\*required for the human acceptance\*\*/);
  assert.match(manual, /ASF-OPSX-02/);
});

test("ASF-OPSX-01 example uses checkboxes only for work executable during apply", () => {
  const parts = example.split(/^## (Implementation checklist.*|Manual acceptance|Post-sync review)$/m);
  assert.ok(parts.length >= 7, "example needs all three explicit sections");
  assert.match(example, /^- \[ \] 1\.1 /m);
  const manualPart = example.split("## Manual acceptance\n")[1]?.split("## Post-sync review\n")[0];
  const afterPart = example.split("## Post-sync review\n")[1];
  assert.ok(manualPart && afterPart);
  for (const section of [manualPart, afterPart]) {
    assert.doesNotMatch(section, /^\s*-\s+\[[ xX]\]/m);
  }
  assert.deepEqual(forbiddenPostSyncTasks(example), []);
});
