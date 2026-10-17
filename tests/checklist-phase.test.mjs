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
  assert.match(manual, /restent \*\*obligatoires pour l'acceptation humaine\*\*/);
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


import { checklistEntries, forbiddenImplementationTasks } from "../scripts/check-openspec-task-phases.mjs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("ASF-OPSX-02 rejects manual/touch/visual/keyboard/screen-reader checkboxes in English and French", () => {
  const samples = [
    "- [ ] 2.2 Verify the rendered overview in a real browser",
    "- [ ] 2.3 Confirm on a narrow touch viewport that controls are usable",
    "- [ ] 2.4 Visually inspect the mobile layout",
    "- [ ] 2.5 Test keyboard-only navigation and focus",
    "- [ ] 2.6 Test with a screen reader",
    "- [ ] 2.7 Valider au toucher sur un téléphone réel",
    "- [x] 2.8 Vérifier la lisibilité visuelle dans le navigateur",
  ];
  for (const sample of samples) {
    const problems = forbiddenImplementationTasks("# Implementation\n" + sample + "\n");
    assert.equal(problems.length, 1, sample);
    assert.equal(problems[0].line, 2, sample);
    assert.ok(problems[0].reason, sample);
  }
});

test("ASF-OPSX-02 rejects explicit sync/archive and post-publication work in checkboxes", () => {
  const samples = [
    "- [ ] 4.1 Archive the change using openspec archive",
    "- [ ] 4.2 Publish PR and check CI",
    "- [ ] 4.3 After merging PR, verify GitHub Pages deployment",
    "- [ ] 4.4 Verify the canonical specs after OPSX sync",
    "- [ ] 4.5 Archiver le changement OpenSpec",
    "- [ ] 4.6 Vérifier CI après la fusion de la PR",
  ];
  for (const sample of samples) {
    assert.equal(forbiddenImplementationTasks(sample + "\n").length, 1, sample);
  }
});

test("ASF-OPSX-02 rejects all checkboxes inside manual/post-sync sections regardless of wording", () => {
  const plan = "# Tasks\n## Implementation checklist\n- [ ] Add logic\n## Manual acceptance\n- [ ] Check UI\n### Keyboard\n- [x] Run npm run check\n## Post-sync review\n- [ ] Run tests\n## Appendix\n- Later, human acceptance\n";
  const problems = forbiddenImplementationTasks(plan);
  assert.deepEqual(problems.map(x => x.line), [5, 7, 9]);
});

test("ASF-OPSX-02 avoids false positives for automated UI checks and regression/guard tests", () => {
  const samples = [
    "- [ ] Add deterministic tests that assert the DOM button is accessible on mobile",
    "- [ ] Verify keyboard focus via jsdom assertions",
    "- [ ] Test touch target attributes using static checks",
    "- [ ] Add unit tests for the archive guard, never archive a change",
    "- [ ] Test that CI metadata parsing is correct, without publishing",
    "- [ ] Add automated Playwright tests for responsive viewport behavior",
    "- [ ] Test a simulated screen reader label in Node tests",
    "- [ ] Validate the proposal before OPSX sync",
    "- [ ] Inspect the delta before the workflow gate",
  ];
  for (const sample of samples) {
    assert.deepEqual(forbiddenImplementationTasks(sample + "\n"), [], sample);
  }
});

test("ASF-OPSX-02 ignores code fences, text-only manual review and preserves valid line numbers", () => {
  const plan = "# Change\n\n```md\n- [ ] Manually review in a browser\n```\n## Implementation checklist\n- [ ] Write tests\n  with deterministic output\n\n## Manual acceptance\n- Inspect browser manually, without a checkbox\n\n## Post-sync review\n- After merge, check CI and Pages\n";
  assert.deepEqual(forbiddenImplementationTasks(plan), []);
  assert.deepEqual(checklistEntries(plan).map(x => ({ line: x.line, text: x.text })), [{ line: 7, text: "Write tests with deterministic output" }]);
});

test("ASF-OPSX-02 CLI exits nonzero with path, line and reason before paid apply", () => {
  const dir = mkdtempSync(join(tmpdir(), "openspec-gate-"));
  try {
    const bad = join(dir, "bad-tasks.md");
    const good = join(dir, "good-tasks.md");
    writeFileSync(bad, "# Tasks\n- [ ] 1.1 Manually verify mobile on real browser\n");
    writeFileSync(good, "# Tasks\n- [ ] 1.1 Add deterministic Node tests for mobile DOM\n## Manual acceptance\n- Verify the real mobile browser manually\n");
    const script = new URL("../scripts/check-openspec-task-phases.mjs", import.meta.url).pathname;
    const fail = spawnSync(process.execPath, [script, bad], { encoding: "utf8" });
    assert.equal(fail.status, 1);
    assert.match(fail.stderr, /line=2::Requires manual/);
    assert.match(fail.stderr, /No paid apply may start/);
    const pass = spawnSync(process.execPath, [script, good], { encoding: "utf8" });
    assert.equal(pass.status, 0, pass.stderr);
    const missing = spawnSync(process.execPath, [script, join(dir, "absent.md")], { encoding: "utf8" });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /preflight unavailable/);
    const empty = join(dir, "empty.md");
    writeFileSync(empty, "# Tasks\n## Manual acceptance\n- Inspect on mobile\n");
    assert.equal(spawnSync(process.execPath, [script, empty], { encoding: "utf8" }).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ASF-OPSX-02 workflow gates plan and existing apply before model implementation", () => {
  const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
  assert.match(workflow, /node scripts\/check-openspec-task-phases\.mjs "\$change\/tasks\.md"/);
  const gate = workflow.indexOf("- name: Gate implementation checklist before paid apply");
  const apply = workflow.indexOf("- name: Apply the reviewed plan with OpenCode");
  assert.ok(gate >= 0 && gate < apply, "must gate before paid apply");
  const segment = workflow.slice(gate, apply);
  assert.match(segment, /inputs\.phase == 'apply' \|\| inputs\.phase == 'auto'/);
  assert.match(segment, /node scripts\/check-openspec-task-phases\.mjs "openspec\/changes\/\$CHANGE_ID\/tasks\.md"/);
  assert.match(workflow, /Unchecked tasks remain; refusing archive/);
  assert.match(workflow, /node scripts\/sync-guard\.mjs verify/);
});
